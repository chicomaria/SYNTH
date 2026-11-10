import { Engine } from './engine.js';
import { Sequencer } from './sequencer.js';
import { Knob } from './knob.js';
import { Scope } from './scope.js';
import { DEFAULT_PARAMS, DEFAULT_ROUTES, PRESETS, randomSteps, randomParams } from './presets.js';

const STORAGE_KEY = 'pulso-state-v1';
const clone = (o) => JSON.parse(JSON.stringify(o));

// ---------- Estado ----------
function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.params && saved.steps?.length === 8) {
      return {
        params: { ...DEFAULT_PARAMS, ...saved.params },
        routes: { ...DEFAULT_ROUTES, ...saved.routes },
        steps: saved.steps,
      };
    }
  } catch (_) { /* sem armazenamento disponível */ }
  const p = PRESETS[1];
  return { params: clone(p.params), routes: clone(p.routes), steps: clone(p.steps) };
}
let state = loadState();
let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) { /* ignorar */ }
  }, 300);
}

const engine = new Engine();
const seq = new Sequencer(engine, () => state, highlightStep);
const scope = new Scope(document.getElementById('scope'), () => engine.analyser);

function pushParams() {
  engine.setParams(state.params, state.routes);
  save();
}

// ---------- Formatação dos valores ----------
const expMap = (v, min, max) => min * Math.pow(max / min, v);
const hz = (min, max) => (v) => {
  const f = expMap(v, min, max);
  return f >= 1000 ? `${(f / 1000).toFixed(1)}k` : `${Math.round(f)}`;
};
const ms = (v) => {
  const s = 0.01 + Math.pow(v, 2) * 2.5;
  return s >= 1 ? `${s.toFixed(1)}s` : `${Math.round(s * 1000)}ms`;
};
const pct = (v) => `${Math.round(v * 100)}`;
const FORMATS = {
  vco1Freq: hz(20, 2000), vco2Freq: hz(10, 2000), cutoff: hz(40, 16000),
  pitchDecay: ms, vcfDecay: ms, vcaDecay: ms,
  tempo: (v) => `${Math.round(40 + v * 200)}`,
  delayTime: (v) => `${Math.round((0.03 + v * 0.97) * 1000)}ms`,
};

// ---------- Construção da interface ----------
const knobs = {};
function paramKnob(key, label, size = 'md') {
  const k = new Knob({
    label, size,
    value: state.params[key],
    defaultValue: DEFAULT_PARAMS[key],
    format: FORMATS[key] || pct,
    onChange: (v) => { state.params[key] = v; pushParams(); },
  });
  knobs[key] = k;
  return k.el;
}

const toggles = {};
function waveToggle(key) {
  const b = document.createElement('button');
  b.className = 'wave-toggle';
  b.title = 'Forma de onda';
  const render = () => {
    b.innerHTML = state.params[key] === 1
      ? '<svg viewBox="0 0 24 12"><path d="M1 10 V2 H12 V10 H23 V2"/></svg><span>Quadrada</span>'
      : '<svg viewBox="0 0 24 12"><path d="M1 10 L6.5 2 L12 10 L17.5 2 L23 10"/></svg><span>Triangular</span>';
  };
  b.addEventListener('click', () => { state.params[key] = state.params[key] === 1 ? 0 : 1; render(); pushParams(); });
  toggles[key] = render;
  render();
  return b;
}

function module(title, children, cls = '') {
  const m = document.createElement('section');
  m.className = `module ${cls}`;
  m.innerHTML = `<h2>${title}</h2><div class="module-body"></div>`;
  const body = m.querySelector('.module-body');
  children.forEach((c) => body.appendChild(c));
  return m;
}
const group = (...els) => {
  const g = document.createElement('div');
  g.className = 'group';
  els.forEach((e) => g.appendChild(e));
  return g;
};

const panel = document.getElementById('panel');
panel.append(
  module('VCO 1', [paramKnob('vco1Freq', 'Freq', 'lg'), group(waveToggle('vco1Wave')), paramKnob('vco1EgAmt', 'Env. afin.'), paramKnob('vco1Level', 'Nível')]),
  module('VCO 2', [paramKnob('vco2Freq', 'Freq', 'lg'), group(waveToggle('vco2Wave')), paramKnob('vco2EgAmt', 'Env. afin.'), paramKnob('vco2Level', 'Nível')]),
  module('Modulação', [paramKnob('fm', 'FM 2→1'), paramKnob('noiseLevel', 'Ruído'), paramKnob('pitchDecay', 'Decay afin.')]),
  module('Filtro', [paramKnob('cutoff', 'Corte', 'lg'), paramKnob('resonance', 'Ressonância'), paramKnob('vcfEgAmt', 'Env. filtro'), paramKnob('vcfDecay', 'Decay filtro')]),
  module('Amplitude', [paramKnob('vcaDecay', 'Decay', 'lg'), paramKnob('volume', 'Volume')]),
  module('Delay', [paramKnob('delayTime', 'Tempo'), paramKnob('delayFeedback', 'Repetições'), paramKnob('delayMix', 'Mistura')]),
  module('Reverb', [paramKnob('reverbMix', 'Mistura', 'lg')]),
);

// Patch bay simplificado: cada botão liga ou desliga uma "ligação de cabo"
const ROUTES = [
  ['pitchToVco1', 'Afinação do passo', 'VCO 1'],
  ['pitchToVco2', 'Afinação do passo', 'VCO 2'],
  ['pitchToVcf', 'Afinação do passo', 'Filtro'],
  ['velToVca', 'Velocidade', 'Volume'],
  ['velToVcf', 'Velocidade', 'Filtro'],
];
const patch = document.getElementById('patch');
const routeButtons = {};
ROUTES.forEach(([key, from, to]) => {
  const b = document.createElement('button');
  b.className = 'patch-cable';
  b.innerHTML = `<span class="jack"></span><span class="cable-label">${from} <b>→</b> ${to}</span><span class="jack"></span>`;
  b.addEventListener('click', () => { state.routes[key] = !state.routes[key]; renderRoutes(); pushParams(); });
  routeButtons[key] = b;
  patch.appendChild(b);
});
function renderRoutes() {
  Object.entries(routeButtons).forEach(([k, b]) => {
    b.classList.toggle('on', !!state.routes[k]);
    b.setAttribute('aria-pressed', !!state.routes[k]);
  });
}

// Sequenciador
const seqEl = document.getElementById('steps');
const stepUI = [];
function buildSteps() {
  seqEl.innerHTML = '';
  stepUI.length = 0;
  state.steps.forEach((s, i) => {
    const col = document.createElement('div');
    col.className = 'step';
    const led = document.createElement('div');
    led.className = 'led';
    const pitch = new Knob({
      label: `Afin. ${i + 1}`, size: 'sm', value: s.pitch, defaultValue: 0.5,
      format: (v) => { const st = Math.round((v * 2 - 1) * 24); return st > 0 ? `+${st}` : `${st}`; },
      onChange: (v) => { state.steps[i].pitch = v; save(); },
    });
    const vel = new Knob({
      label: `Vel. ${i + 1}`, size: 'sm', value: s.vel, defaultValue: 0.8,
      onChange: (v) => { state.steps[i].vel = v; save(); },
    });
    const on = document.createElement('button');
    on.className = 'step-on';
    on.textContent = i + 1;
    on.title = 'Ligar/desligar passo';
    on.addEventListener('click', () => { state.steps[i].on = !state.steps[i].on; renderStepOn(i); save(); });
    col.append(led, pitch.el, vel.el, on);
    seqEl.appendChild(col);
    stepUI.push({ col, led, pitch, vel, on });
    renderStepOn(i);
  });
}
function renderStepOn(i) {
  stepUI[i].on.classList.toggle('on', state.steps[i].on);
  stepUI[i].col.classList.toggle('muted', !state.steps[i].on);
}
function highlightStep(i) {
  stepUI.forEach((u, j) => u.led.classList.toggle('lit', i === j));
}

// Transporte
const transport = document.getElementById('transport-knobs');
transport.append(paramKnob('tempo', 'BPM', 'lg'), paramKnob('swing', 'Swing'));

const playBtn = document.getElementById('play');
playBtn.addEventListener('click', async () => {
  await engine.start();
  scope.start();
  if (seq.playing) { seq.stop(); playBtn.classList.remove('on'); playBtn.textContent = '▶ Tocar'; }
  else { seq.start(); playBtn.classList.add('on'); playBtn.textContent = '■ Parar'; }
});
document.getElementById('hit').addEventListener('click', async () => {
  await engine.start();
  scope.start();
  engine.trigger(engine.ctx.currentTime);
});
document.getElementById('advance').addEventListener('click', async () => {
  await engine.start();
  scope.start();
  seq.advance();
});

// Presets e randomizer
const presetsEl = document.getElementById('presets');
PRESETS.forEach((p) => {
  const b = document.createElement('button');
  b.textContent = p.name;
  b.addEventListener('click', () => {
    state = { params: { ...state.params, ...clone(p.params), volume: state.params.volume }, routes: clone(p.routes), steps: clone(p.steps) };
    refreshAll();
  });
  presetsEl.appendChild(b);
});
document.getElementById('rand-seq').addEventListener('click', () => { state.steps = randomSteps(); refreshAll(); });
document.getElementById('rand-sound').addEventListener('click', () => { state.params = randomParams(state.params); refreshAll(); });
document.getElementById('rand-all').addEventListener('click', () => {
  state.steps = randomSteps();
  state.params = randomParams(state.params);
  Object.keys(state.routes).forEach((k) => { state.routes[k] = Math.random() > 0.5; });
  state.routes.velToVca = true;
  refreshAll();
});

function refreshAll() {
  Object.entries(knobs).forEach(([k, knob]) => knob.set(state.params[k], false));
  Object.values(toggles).forEach((r) => r());
  state.steps.forEach((s, i) => {
    stepUI[i].pitch.set(s.pitch, false);
    stepUI[i].vel.set(s.vel, false);
    renderStepOn(i);
  });
  renderRoutes();
  pushParams();
}

// Atalho: barra de espaços toca/para
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !e.repeat && !(e.target instanceof HTMLInputElement)) {
    e.preventDefault();
    playBtn.click();
  }
});

buildSteps();
renderRoutes();
pushParams();
scope.drawIdle();

// Instalação como app (PWA) quando servido por http(s)
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// Acesso para depuração na consola do browser
window.pulso = { engine, seq, get state() { return state; } };
