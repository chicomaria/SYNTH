import { Engine } from './engine.js';
import { Knob } from './knob.js';
import { Scope } from './scope.js';
import {
  M_CONTROLS, D_CONTROLS, FX_CONTROLS, M_JACKS, D_JACKS, ALL_JACKS, DEFAULT_PARAMS,
  PRESETS, defaultState, randomDSeq, randomMSeq, noteName,
} from './defs.js';

const STORAGE_KEY = 'pulso-state-v2';
const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};

// ---------- Estado ----------
function loadState() {
  const base = defaultState();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.p && saved.mSteps?.length === 32 && saved.dPitch?.length === 8) {
      return { ...base, ...saved, p: { ...DEFAULT_PARAMS, ...saved.p, mRunning: 0, dRunning: 0 } };
    }
  } catch (_) { /* sem armazenamento */ }
  return base;
}
let state = loadState();
state.p.mRunning = 0;
state.p.dRunning = 0;
let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) { /* ignorar */ }
  }, 300);
}

let mPlayStep = -1, dPlayStep = 0;
const engine = new Engine(({ m, d }) => { mPlayStep = m; dPlayStep = d; renderPlayheads(); });
const scope = new Scope($('scope'), () => engine.analyser);
async function wake() { await engine.start(state); scope.start(); }

function setParam(k, v) {
  state.p[k] = v;
  engine.param(k, v, state.p);
  save();
}

// ---------- Controlos ----------
const knobs = {};
const switches = {};
const fmt10 = (v) => (v * 10).toFixed(1);
const fmtBi = (v) => { const x = (v - 0.5) * 10; return `${x > 0 ? '+' : ''}${x.toFixed(1)}`; };

function buildControl(c) {
  if (c.type === 'knob') {
    const k = new Knob({
      label: c.label, size: c.size || 'md', value: state.p[c.id], defaultValue: c.def,
      format: c.format || (c.bipolar ? fmtBi : fmt10),
      onChange: (v) => setParam(c.id, v),
    });
    knobs[c.id] = k;
    return k.el;
  }
  const wrap = el('div', 'switch');
  const opts = el('div', 'switch-opts');
  const buttons = c.options.map((label, i) => {
    const b = el('button', '', label);
    b.addEventListener('click', () => { setParam(c.id, i); render(); });
    opts.appendChild(b);
    return b;
  });
  const render = () => buttons.forEach((b, i) => b.classList.toggle('on', state.p[c.id] === i));
  wrap.append(opts, el('div', 'knob-label', c.label));
  switches[c.id] = render;
  render();
  return wrap;
}
M_CONTROLS.forEach((c) => $('m-controls').appendChild(buildControl(c)));
D_CONTROLS.forEach((c) => $('d-controls').appendChild(buildControl(c)));
FX_CONTROLS.forEach((c) => $('fx-controls').appendChild(buildControl(c)));

// ---------- Patch bay e cabos ----------
const jackEls = {};
const jackDef = Object.fromEntries(ALL_JACKS.map((j) => [j.id, j]));
let pending = null;
function buildJacks(list, host) {
  list.forEach((j) => {
    const b = el('button', `jack ${j.out ? 'out' : 'in'}`, `<span class="hole"></span><span class="jack-label">${j.label}</span>`);
    b.title = `${j.out ? 'Saída' : 'Entrada'}: ${j.label}`;
    b.addEventListener('click', () => clickJack(j.id));
    jackEls[j.id] = b;
    host.appendChild(b);
  });
}
buildJacks(M_JACKS, $('m-patch'));
buildJacks(D_JACKS, $('d-patch'));

function clickJack(id) {
  const isOut = !!jackDef[id].out;
  if (pending === id) pending = null;
  else if (pending && !!jackDef[pending].out !== isOut) {
    const [out, inn] = isOut ? [id, pending] : [pending, id];
    state.cables = state.cables.filter((c) => c[1] !== inn);
    state.cables.push([out, inn]);
    pending = null;
    cablesChanged();
  } else if (!pending && !isOut && state.cables.some((c) => c[1] === id)) {
    state.cables = state.cables.filter((c) => c[1] !== id); // tocar numa entrada ligada tira o cabo
    cablesChanged();
  } else pending = id;
  renderCables();
}
function cablesChanged() {
  engine.send({ t: 'cables', list: state.cables });
  save();
}

const CABLE_COLORS = ['#f6a84a', '#4ac3f6', '#e85d75', '#7bd88f', '#c792ea', '#ffd866'];
const cableSvg = $('cables');
function renderCables() {
  const host = cableSvg.parentElement.getBoundingClientRect();
  const center = (id) => {
    const r = jackEls[id].querySelector('.hole').getBoundingClientRect();
    return [r.left + r.width / 2 - host.left, r.top + r.height / 2 - host.top];
  };
  cableSvg.setAttribute('width', host.width);
  cableSvg.setAttribute('height', host.height);
  cableSvg.innerHTML = state.cables.map(([a, b], i) => {
    const [x1, y1] = center(a), [x2, y2] = center(b);
    const sag = Math.min(90, 30 + Math.hypot(x2 - x1, y2 - y1) * 0.25);
    const color = CABLE_COLORS[i % CABLE_COLORS.length];
    return `<path d="M ${x1} ${y1} C ${x1} ${y1 + sag}, ${x2} ${y2 + sag}, ${x2} ${y2}" stroke="${color}" />
      <circle cx="${x1}" cy="${y1}" r="6" fill="${color}" /><circle cx="${x2}" cy="${y2}" r="6" fill="${color}" />`;
  }).join('');
  const used = new Set(state.cables.flat());
  Object.entries(jackEls).forEach(([id, b]) => {
    b.classList.toggle('pending', pending === id);
    b.classList.toggle('used', used.has(id));
  });
  $('patch-hint').textContent = pending
    ? `${jackDef[pending].label}: escolhe agora uma ${jackDef[pending].out ? 'entrada' : 'saída'} para ligar o cabo.`
    : 'Toca numa saída e depois numa entrada para ligar um cabo. Toca numa entrada ligada para o tirar.';
}
new ResizeObserver(renderCables).observe(cableSvg.parentElement);
$('clear-cables').addEventListener('click', () => { state.cables = []; pending = null; cablesChanged(); renderCables(); });

// ---------- Unidade M: sequenciador de 32 passos e teclado de botões ----------
let mSel = 0;
let kbOct = 0;
const mStepsEl = $('m-steps');
function sendMSteps() {
  engine.send({ t: 'msteps', steps: state.mSteps, len: state.mLen });
  save();
}
function renderMSteps() {
  mStepsEl.innerHTML = '';
  for (let i = 0; i < state.mLen; i++) {
    const st = state.mSteps[i];
    const b = el('button', 'm-step', `<span class="led"></span><span>${st.r ? '·' : noteName(st.n)}</span>`);
    b.classList.toggle('sel', i === mSel);
    b.classList.toggle('rest', st.r);
    b.addEventListener('click', () => { mSel = i; renderMSteps(); });
    mStepsEl.appendChild(b);
  }
  $('m-len').textContent = `${state.mLen} passos`;
  $('m-oct').textContent = `Oitava ${kbOct >= 0 ? '+' : ''}${kbOct}`;
  renderPlayheads();
}
function writeStep(step) {
  state.mSteps[mSel] = step;
  mSel = (mSel + 1) % state.mLen;
  sendMSteps();
  renderMSteps();
}
const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C'];
KEYS.forEach((name, i) => {
  const b = el('button', `key ${name.includes('#') ? 'black' : ''}`, name);
  b.addEventListener('pointerdown', async (e) => {
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    const n = i + kbOct * 12;
    await wake();
    engine.send({ t: 'noteOn', n });
    writeStep({ n, r: false });
  });
  const off = () => engine.send({ t: 'noteOff' });
  b.addEventListener('pointerup', off);
  b.addEventListener('pointercancel', off);
  $('m-keys').appendChild(b);
});
$('m-rest').addEventListener('click', () => writeStep({ n: 0, r: true }));
$('m-len').addEventListener('click', () => {
  state.mLen = { 8: 16, 16: 32, 32: 8 }[state.mLen] || 16;
  mSel = Math.min(mSel, state.mLen - 1);
  sendMSteps();
  renderMSteps();
});
$('m-oct-down').addEventListener('click', () => { kbOct = Math.max(-1, kbOct - 1); renderMSteps(); });
$('m-oct-up').addEventListener('click', () => { kbOct = Math.min(2, kbOct + 1); renderMSteps(); });
$('m-rand').addEventListener('click', () => { state.mSteps = randomMSeq(state.mLen); sendMSteps(); renderMSteps(); });

// ---------- Unidade D: sequenciador de 8 passos ----------
const dStepUI = [];
function sendDSteps() {
  engine.send({ t: 'dsteps', pitch: state.dPitch, vel: state.dVel });
  save();
}
for (let i = 0; i < 8; i++) {
  const col = el('div', 'step');
  const led = el('div', 'led');
  const pitch = new Knob({
    label: `PITCH ${i + 1}`, size: 'sm', value: state.dPitch[i], defaultValue: 0.5, format: fmtBi,
    onChange: (v) => { state.dPitch[i] = v; sendDSteps(); },
  });
  const vel = new Knob({
    label: `VELOCITY ${i + 1}`, size: 'sm', value: state.dVel[i], defaultValue: 1, format: fmt10,
    onChange: (v) => { state.dVel[i] = v; sendDSteps(); },
  });
  col.append(led, pitch.el, vel.el, el('div', 'step-num', `${i + 1}`));
  $('d-steps').appendChild(col);
  dStepUI.push({ led, pitch, vel });
}
$('d-rand').addEventListener('click', () => {
  const r = randomDSeq();
  state.dPitch = r.pitch; state.dVel = r.vel;
  dStepUI.forEach((u, i) => { u.pitch.set(r.pitch[i], false); u.vel.set(r.vel[i], false); });
  sendDSteps();
});
$('d-trig').addEventListener('click', async () => { await wake(); engine.send({ t: 'dTrig' }); });
$('d-adv').addEventListener('click', async () => { await wake(); engine.send({ t: 'dAdv' }); });

function renderPlayheads() {
  [...mStepsEl.children].forEach((b, i) => b.classList.toggle('playing', state.p.mRunning === 1 && i === mPlayStep));
  dStepUI.forEach((u, i) => u.led.classList.toggle('lit', i === dPlayStep));
}

// ---------- Transporte ----------
function renderTransport() {
  const m = state.p.mRunning === 1, d = state.p.dRunning === 1;
  $('m-run').classList.toggle('on', m);
  $('m-run').textContent = m ? '■ STOP' : '▶ RUN';
  $('d-run').classList.toggle('on', d);
  $('d-run').textContent = d ? '■ STOP' : '▶ RUN';
  $('play').classList.toggle('on', m || d);
  $('play').textContent = m || d ? '■ Parar tudo' : '▶ Tocar tudo';
  renderPlayheads();
}
async function setRun(unit, on) {
  await wake();
  setParam(unit === 'm' ? 'mRunning' : 'dRunning', on ? 1 : 0);
  renderTransport();
}
$('m-run').addEventListener('click', () => setRun('m', state.p.mRunning !== 1));
$('d-run').addEventListener('click', () => setRun('d', state.p.dRunning !== 1));
$('play').addEventListener('click', async () => {
  const on = !(state.p.mRunning === 1 || state.p.dRunning === 1);
  await setRun('m', on);
  await setRun('d', on);
});
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !e.repeat && e.target === document.body) { e.preventDefault(); $('play').click(); }
});

// ---------- Memórias ----------
PRESETS.forEach((preset) => {
  const b = el('button', '', preset.name);
  b.addEventListener('click', () => {
    const next = preset.make();
    next.p.mRunning = state.p.mRunning;
    next.p.dRunning = state.p.dRunning;
    next.p.fxVol = state.p.fxVol;
    state = next;
    refreshAll();
  });
  $('presets').appendChild(b);
});

function refreshAll() {
  Object.entries(knobs).forEach(([k, knob]) => knob.set(state.p[k], false));
  Object.values(switches).forEach((r) => r());
  dStepUI.forEach((u, i) => { u.pitch.set(state.dPitch[i], false); u.vel.set(state.dVel[i], false); });
  mSel = 0; pending = null;
  renderMSteps();
  renderCables();
  renderTransport();
  engine.sync(state);
  save();
}

renderMSteps();
renderCables();
renderTransport();
scope.drawIdle();

// Acesso para depuração na consola do browser
window.pulso = { engine, get state() { return state; } };

// Instalação como app (PWA) quando servido por http(s)
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
