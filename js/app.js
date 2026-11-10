import { Engine } from './engine.js';
import { Knob } from './knob.js';
import { Scope } from './scope.js';
import { TYPES, FX_CONTROLS, PRESETS, newModule, randomParams, randomMSeq, randomCables, noteName } from './defs.js';

const STORAGE_KEY = 'pulso-rack-v3';
const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};
const btn = (label, title, fn, cls = '') => {
  const b = el('button', cls, label);
  if (title) b.title = title;
  b.addEventListener('click', fn);
  return b;
};

// ---------- Estado ----------
function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (s && Array.isArray(s.mods) && s.mods.every((m) => TYPES[m.type])) {
      s.mods.forEach((m) => { m.p = { ...TYPES[m.type].defaults, ...m.p, run: 0 }; });
      return { zoom: 1, cables: [], ...s };
    }
  } catch (_) { /* sem armazenamento */ }
  return { zoom: 1, ...PRESETS[0].make() };
}
let state = loadState();
let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) { /* ignorar */ }
  }, 300);
}

const ui = {}; // por módulo: elementos e funções de atualização
const engine = new Engine(({ id, st }) => ui[id]?.onStatus(st));
const scope = new Scope($('scope'), () => engine.analyser);
async function wake() { await engine.start(state); scope.start(); }
const getMod = (id) => state.mods.find((m) => m.id === id);

function setParam(m, k, v) {
  m.p[k] = v;
  engine.send({ t: 'p', id: m.id, k, v });
  save();
}

// ---------- Controlos ----------
const fmt10 = (v) => (v * 10).toFixed(1);
const fmtBi = (v) => { const x = (v - 0.5) * 10; return `${x > 0 ? '+' : ''}${x.toFixed(1)}`; };

// Constrói um controlo; devolve o elemento e uma função que o volta a desenhar a partir do estado
function buildControl(c, get, set) {
  if (c.type === 'head') return { el: el('h3', 'sec', c.text) };
  if (c.type === 'knob') {
    const k = new Knob({
      label: c.label, size: c.size || 'md', value: get(), defaultValue: c.def,
      format: c.format || (c.bipolar ? fmtBi : fmt10), onChange: set,
    });
    return { el: k.el, refresh: () => k.set(get(), false) };
  }
  if (c.type === 'toggle') {
    const b = el('button', 'toggle', c.label);
    const refresh = () => b.classList.toggle('on', get() === 1);
    b.addEventListener('click', () => { set(get() === 1 ? 0 : 1); refresh(); });
    refresh();
    return { el: b, refresh };
  }
  const wrap = el('div', 'switch');
  const opts = el('div', 'switch-opts');
  const buttons = c.options.map((label, i) => {
    const b = el('button', '', label);
    b.addEventListener('click', () => { set(i); refresh(); });
    opts.appendChild(b);
    return b;
  });
  const refresh = () => buttons.forEach((b, i) => b.classList.toggle('on', get() === i));
  wrap.append(opts, el('div', 'knob-label', c.label));
  refresh();
  return { el: wrap, refresh };
}

// ---------- Módulos ----------
const rack = $('rack');
function renderModule(m) {
  const t = TYPES[m.type];
  const u = (ui[m.id] = { ctl: {}, jacks: {}, refreshers: [], onStatus: () => {} });
  const box = (u.el = el('section', `mod type-${m.type}`));
  box.classList.toggle('min', !!m.min);

  // Cabeçalho
  const head = el('header', 'mod-head');
  head.appendChild(el('h2', '', `${t.name} <small>${t.sub}</small>`));
  const tools = el('div', 'tools');
  if (t.hasRun) {
    u.runBtn = btn('▶', 'Run / Stop', async () => { await wake(); setParam(m, 'run', m.p.run ? 0 : 1); renderTransport(); }, 'run');
    tools.appendChild(u.runBtn);
  }
  tools.append(
    btn('⚄ knobs', 'Knobs aleatórios neste módulo', () => randomizeKnobs(m)),
    btn('⚄ seq', 'Sequência aleatória neste módulo', () => randomizeSeq(m)),
    btn('–', 'Minimizar / expandir', () => { m.min = !m.min; box.classList.toggle('min', m.min); save(); renderCables(); }),
    btn('✕', 'Remover módulo', () => removeModule(m.id)),
  );
  head.appendChild(tools);
  box.appendChild(head);

  const body = el('div', 'mod-body');
  // Controlos
  const controls = el('div', 'controls');
  t.controls.forEach((c) => {
    const built = buildControl(c, () => m.p[c.id], (v) => setParam(m, c.id, v));
    if (c.id) { u.ctl[c.id] = built.el; u.refreshers.push(built.refresh); }
    controls.appendChild(built.el);
  });
  if (t.custom) controls.appendChild(CUSTOM[t.custom](m, u));
  body.appendChild(controls);

  // Patch bay
  const patch = el('div', 'patch');
  t.jacks.forEach((j) => {
    const key = jackKey(m.id, j);
    const b = el('button', `jack ${j.out ? 'out' : 'in'}`, `<span class="hole"></span><span class="jack-label">${j.label}</span>`);
    b.title = `${j.out ? 'Saída' : 'Entrada'}: ${j.label}`;
    b.addEventListener('click', () => clickJack(key));
    u.jacks[key] = b;
    jackInfo[key] = { mod: m.id, jack: j.id, out: !!j.out, label: j.label };
    patch.appendChild(b);
  });
  body.appendChild(patch);
  box.appendChild(body);

  const lit = t.lit;
  const prev = u.onStatus;
  u.onStatus = (st) => {
    Object.values(u.ctl).forEach((e) => e.classList.remove('lit'));
    lit(st).forEach((id) => u.ctl[id]?.classList.add('lit'));
    prev(st);
  };
  rack.appendChild(box);
}

const jackKey = (modId, j) => `${modId}:${j.out ? 'o' : 'i'}:${j.id}`;
const jackInfo = {};

// Blocos específicos de cada tipo
const CUSTOM = {
  // M: sequenciador de 32 passos com teclado de 13 botões
  mseq(m, u) {
    const wrap = el('div', 'custom');
    let sel = 0, oct = 0, playing = -1;
    const stepsEl = el('div', 'm-steps'), keys = el('div', 'keys'), bar = el('div', 'btn-row');
    const send = () => {
      engine.send({ t: 'data', id: m.id, k: 'steps', v: m.data.steps });
      engine.send({ t: 'data', id: m.id, k: 'len', v: m.data.len });
      save();
    };
    const lenBtn = btn('', 'Número de passos', () => {
      m.data.len = { 8: 16, 16: 32, 32: 8 }[m.data.len] || 16;
      sel = Math.min(sel, m.data.len - 1); send(); draw();
    });
    const octLabel = el('span', 'readout');
    const draw = () => {
      stepsEl.innerHTML = '';
      for (let i = 0; i < m.data.len; i++) {
        const st = m.data.steps[i];
        const b = el('button', 'm-step', st.r ? '·' : noteName(st.n));
        b.classList.toggle('sel', i === sel);
        b.classList.toggle('rest', st.r);
        b.classList.toggle('playing', i === playing);
        b.addEventListener('click', () => { sel = i; draw(); });
        stepsEl.appendChild(b);
      }
      lenBtn.textContent = `${m.data.len} passos`;
      octLabel.textContent = `oit ${oct >= 0 ? '+' : ''}${oct}`;
    };
    const write = (step) => { m.data.steps[sel] = step; sel = (sel + 1) % m.data.len; send(); draw(); };
    ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B', 'C'].forEach((name, i) => {
      const b = el('button', `key ${name.includes('#') ? 'black' : ''}`, name);
      b.addEventListener('pointerdown', async (e) => {
        e.preventDefault();
        b.setPointerCapture(e.pointerId);
        const n = i + oct * 12;
        await wake();
        engine.send({ t: 'cmd', id: m.id, c: 'noteOn', n });
        write({ n, r: false });
      });
      const off = () => engine.send({ t: 'cmd', id: m.id, c: 'noteOff' });
      b.addEventListener('pointerup', off);
      b.addEventListener('pointercancel', off);
      keys.appendChild(b);
    });
    bar.append(
      lenBtn,
      btn('oit −', 'Oitava abaixo', () => { oct = Math.max(-1, oct - 1); draw(); }), octLabel,
      btn('oit +', 'Oitava acima', () => { oct = Math.min(2, oct + 1); draw(); }),
      btn('pausa', 'Gravar uma pausa no passo', () => write({ n: 0, r: true })),
    );
    wrap.append(el('h3', 'sec', 'SEQUENCER · escolhe um passo e toca uma nota'), bar, stepsEl, keys);
    u.onStatus = ([s]) => {
      playing = m.p.run ? s : -1;
      [...stepsEl.children].forEach((b, i) => b.classList.toggle('playing', i === playing));
    };
    u.redraw = draw;
    draw();
    return wrap;
  },
  // D: botões TRIGGER e ADVANCE
  dbuttons(m) {
    const wrap = el('div', 'custom btn-row');
    wrap.append(
      btn('TRIGGER', 'Dispara os envelopes', async () => { await wake(); engine.send({ t: 'cmd', id: m.id, c: 'trig' }); }),
      btn('ADVANCE', 'Avança um passo', async () => { await wake(); engine.send({ t: 'cmd', id: m.id, c: 'adv' }); }),
    );
    return wrap;
  },
  // L: dois registos de 8 bits que o motor vai corrompendo
  lbits(m, u) {
    const wrap = el('div', 'custom');
    const rows = [0, 1].map((q) => {
      const row = el('div', 'bits');
      row.appendChild(el('span', 'readout', `SEQ ${q + 1}`));
      const cells = Array.from({ length: 8 }, (_, i) => {
        const b = btn('', `Passo ${i + 1}`, () => engine.send({ t: 'cmd', id: m.id, c: 'bit', q, i }), 'bit');
        row.appendChild(b);
        return b;
      });
      wrap.appendChild(row);
      return cells;
    });
    u.onStatus = ([s1, s2, m1, m2]) => {
      [[s1, m1], [s2, m2]].forEach(([s, mask], q) => rows[q].forEach((b, i) => {
        b.classList.toggle('on', !!(mask & (1 << i)));
        b.classList.toggle('playing', i === s);
      }));
    };
    return wrap;
  },
};

function renderRack() {
  rack.innerHTML = '';
  Object.keys(ui).forEach((k) => delete ui[k]);
  Object.keys(jackInfo).forEach((k) => delete jackInfo[k]);
  state.mods.forEach(renderModule);
  renderTransport();
  applyZoom();
}

let counter = 0;
function addModule(type) {
  let id;
  do { id = `${type.toLowerCase()}${++counter}`; } while (getMod(id));
  const m = newModule(type, id);
  state.mods.push(m);
  renderModule(m);
  engine.addModule(m);
  save();
  renderCables();
  ui[id].el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function removeModule(id) {
  state.mods = state.mods.filter((m) => m.id !== id);
  state.cables = state.cables.filter((c) => c[0] !== id && c[2] !== id);
  ui[id].el.remove();
  Object.keys(ui[id].jacks).forEach((k) => delete jackInfo[k]);
  delete ui[id];
  pending = null;
  engine.send({ t: 'remove', id });
  cablesChanged();
  renderTransport();
  renderCables();
}

function refreshModule(m) {
  ui[m.id].refreshers.forEach((r) => r && r());
  ui[m.id].redraw?.();
  engine.send({ t: 'all', id: m.id, p: m.p });
  save();
}

// ---------- Aleatório ----------
function randomizeKnobs(m) { Object.assign(m.p, randomParams(m.type, false)); refreshModule(m); }
function randomizeSeq(m) {
  Object.assign(m.p, randomParams(m.type, true));
  if (m.type === 'M') {
    m.data.steps = randomMSeq(m.data.len);
    engine.send({ t: 'data', id: m.id, k: 'steps', v: m.data.steps });
  }
  if (m.type === 'L') engine.send({ t: 'cmd', id: m.id, c: 'rseq' });
  refreshModule(m);
}
$('rand-knobs').addEventListener('click', () => state.mods.forEach(randomizeKnobs));
$('rand-seq').addEventListener('click', () => state.mods.forEach(randomizeSeq));
$('rand-patch').addEventListener('click', () => { state.cables = randomCables(state.mods); pending = null; cablesChanged(); renderCables(); });

// ---------- Cabos ----------
let pending = null;
function clickJack(key) {
  const j = jackInfo[key];
  const cableOf = (c) => (j.out ? c[0] === j.mod && c[1] === j.jack : c[2] === j.mod && c[3] === j.jack);
  if (pending === key) pending = null;
  else if (pending && jackInfo[pending].out !== j.out) {
    const a = j.out ? j : jackInfo[pending], b = j.out ? jackInfo[pending] : j;
    const exists = state.cables.findIndex((c) => c[0] === a.mod && c[1] === a.jack && c[2] === b.mod && c[3] === b.jack);
    if (exists >= 0) state.cables.splice(exists, 1); // repetir a mesma ligação tira o cabo
    else state.cables.push([a.mod, a.jack, b.mod, b.jack]);
    pending = null;
    cablesChanged();
  } else if (!pending && !j.out && state.cables.some(cableOf)) {
    // tocar numa entrada ligada tira o último cabo que lá chegou
    const last = state.cables.map(cableOf).lastIndexOf(true);
    state.cables.splice(last, 1);
    cablesChanged();
  } else pending = key;
  renderCables();
}
function cablesChanged() {
  engine.send({ t: 'cables', list: state.cables });
  save();
}

const CABLE_COLORS = ['#f6a84a', '#4ac3f6', '#e85d75', '#7bd88f', '#c792ea', '#ffd866', '#ff8a65', '#80cbc4'];
const cableSvg = $('cables');
const wrapEl = $('rack-wrap');
function renderCables() {
  const host = wrapEl.getBoundingClientRect();
  const center = (modId, jack, out) => {
    const b = ui[modId]?.jacks[`${modId}:${out ? 'o' : 'i'}:${jack}`];
    if (!b) return null;
    const r = b.querySelector('.hole').getBoundingClientRect();
    return [r.left + r.width / 2 - host.left, r.top + r.height / 2 - host.top, r.width];
  };
  cableSvg.setAttribute('width', host.width);
  cableSvg.setAttribute('height', host.height);
  const used = new Set();
  cableSvg.innerHTML = state.cables.map(([a, out, b, inn], i) => {
    const p1 = center(a, out, true), p2 = center(b, inn, false);
    if (!p1 || !p2) return '';
    used.add(`${a}:o:${out}`); used.add(`${b}:i:${inn}`);
    const [x1, y1, w] = p1, [x2, y2] = p2;
    const sag = Math.min(70, 16 + Math.hypot(x2 - x1, y2 - y1) * 0.22);
    const color = CABLE_COLORS[i % CABLE_COLORS.length];
    return `<path d="M ${x1} ${y1} C ${x1} ${y1 + sag}, ${x2} ${y2 + sag}, ${x2} ${y2}" stroke="${color}" stroke-width="${Math.max(2, w * 0.28)}" />
      <circle cx="${x1}" cy="${y1}" r="${w * 0.3}" fill="${color}" /><circle cx="${x2}" cy="${y2}" r="${w * 0.3}" fill="${color}" />`;
  }).join('');
  Object.values(ui).forEach((u) => Object.entries(u.jacks).forEach(([key, b]) => {
    b.classList.toggle('pending', pending === key);
    b.classList.toggle('used', used.has(key));
  }));
  $('patch-hint').textContent = pending
    ? `${jackInfo[pending].label}: escolhe uma ${jackInfo[pending].out ? 'entrada' : 'saída'} em qualquer módulo.`
    : 'Cabos: toca numa saída e depois numa entrada de qualquer módulo. Toca numa entrada ligada para tirar o cabo.';
}
new ResizeObserver(renderCables).observe(rack);
$('clear-cables').addEventListener('click', () => { state.cables = []; pending = null; cablesChanged(); renderCables(); });

// ---------- Transporte, zoom e barra de topo ----------
function renderTransport() {
  let any = false;
  state.mods.forEach((m) => {
    const u = ui[m.id];
    if (!u?.runBtn) return;
    any = any || !!m.p.run;
    u.runBtn.classList.toggle('on', !!m.p.run);
    u.runBtn.textContent = m.p.run ? '■' : '▶';
  });
  $('play').classList.toggle('on', any);
  $('play').textContent = any ? '■ Parar tudo' : '▶ Tocar tudo';
}
$('play').addEventListener('click', async () => {
  const on = !state.mods.some((m) => m.p.run);
  await wake();
  state.mods.forEach((m) => { if (TYPES[m.type].hasRun) setParam(m, 'run', on ? 1 : 0); });
  renderTransport();
});
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !e.repeat && e.target === document.body) { e.preventDefault(); $('play').click(); }
});

function applyZoom() {
  rack.style.zoom = state.zoom;
  $('zoom-label').textContent = `${Math.round(state.zoom * 100)}%`;
  renderCables();
}
const setZoom = (z) => { state.zoom = Math.min(1.6, Math.max(0.4, Math.round(z * 10) / 10)); applyZoom(); save(); };
$('zoom-out').addEventListener('click', () => setZoom(state.zoom - 0.1));
$('zoom-in').addEventListener('click', () => setZoom(state.zoom + 0.1));

Object.entries(TYPES).forEach(([type, t]) => {
  $('add-buttons').appendChild(btn(`+ ${t.name.split(' ')[1]}`, `Adicionar ${t.name} (${t.sub})`, () => addModule(type)));
});

PRESETS.forEach((preset) => {
  $('presets').appendChild(btn(preset.name, 'Carregar esta memória', () => {
    const running = state.mods.some((m) => m.p.run);
    state = { zoom: state.zoom, ...preset.make() };
    if (running) state.mods.forEach((m) => { if (TYPES[m.type].hasRun) m.p.run = 1; });
    pending = null;
    renderRack();
    fxRefresh.forEach((r) => r());
    engine.sync(state);
    save();
  }));
});

const fxRefresh = [];
FX_CONTROLS.forEach((c) => {
  const built = buildControl(c, () => state.fx[c.id], (v) => { state.fx[c.id] = v; engine.fx(state.fx); save(); });
  fxRefresh.push(built.refresh);
  $('fx-controls').appendChild(built.el);
});

renderRack();
scope.drawIdle();

// Acesso para depuração na consola do browser
window.pulso = { engine, get state() { return state; } };

// Instalação como app (PWA) quando servido por http(s)
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
