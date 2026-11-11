import { Engine } from './engine.js';
import { Knob } from './knob.js';
import { Scope } from './scope.js';
import { createStage } from './stage.js';
import { TYPES, FX_CONTROLS, PRESETS, CLOCK_IN, CLOCK_OUT, newModule, normMix, randomParams, randomMSeq, randomCables, noteName } from './defs.js';

const STORAGE_KEY = 'pulso-rack-v3';
const DEFAULT_VIEW = { mode: 'rack', skin: 'pulso', knobs: 'arc', layout: 'original', vars: null, mixMin: false, scopeMin: false };
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
      s.mods.forEach((m) => {
        m.p = { ...TYPES[m.type].defaults, ...m.p, run: 0 };
        m.mix = normMix(m.mix);
      });
      return { zoom: 1, cables: [], ...s, view: { ...DEFAULT_VIEW, ...s.view } };
    }
  } catch (_) { /* sem armazenamento */ }
  return { zoom: 1, view: { ...DEFAULT_VIEW }, ...PRESETS[0].make() };
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
const leds = {};
const engine = new Engine((msg) => {
  if (msg.lv) {
    msg.lv.forEach(([id, v]) => { if (leds[id]) leds[id].style.opacity = v > 0.01 ? Math.min(1, 0.35 + v * 1.5) : 0.12; });
    if (state.view.mode === 'stage') stage.levels(msg.lv);
  } else ui[msg.id]?.onStatus(msg.st);
});
const scope = new Scope($('scope'), () => engine.analyser);
async function wake() { await engine.start(state); scope.start(); }
const getMod = (id) => state.mods.find((m) => m.id === id);

function setParam(m, k, v) {
  m.p[k] = v;
  engine.send({ t: 'p', id: m.id, k, v });
  save();
}

// ---------- Modo Ícones ----------
const stage = createStage({
  root: $('stage'),
  getState: () => state,
  getMod,
  setParam,
  send: (m) => engine.send(m),
  save,
  wake,
  cablesChanged: () => cablesChanged(),
  fxChanged: () => { engine.fx(state.fx); save(); },
  toggleRun: (m) => { setParam(m, 'run', m.p.run ? 0 : 1); renderTransport(); },
  availHeight: () => Math.max(420, window.innerHeight - $('top-bar').offsetHeight - 24),
});
const inStage = () => state.view.mode === 'stage';
function syncMode() {
  document.documentElement.dataset.mode = inStage() ? 'stage' : 'rack';
  $('stage').hidden = !inStage();
  if (inStage()) stage.render(); else renderCables();
}
window.addEventListener('resize', () => { if (inStage()) stage.render(); });

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
  if (c.lever) {
    // interruptor de alavanca com o tamanho de um knob pequeno; as posições ficam escritas ao lado
    const wrap = el('div', 'switch lever');
    const body = el('div', 'lever-body');
    const lever = el('button', 'lever-btn', '<span class="lever-tip"></span>');
    lever.title = `${c.label}: ${c.options.join(' / ')}`;
    const names = el('div', 'lever-opts');
    const spans = c.options.map((label, i) => {
      const sp = el('span', '', label);
      sp.addEventListener('click', () => { set(i); refresh(); });
      names.appendChild(sp);
      return sp;
    });
    lever.addEventListener('click', () => { set((get() + 1) % c.options.length); refresh(); });
    const refresh = () => {
      const v = get(), n = c.options.length;
      lever.style.setProperty('--pos', n > 1 ? v / (n - 1) : 0);
      spans.forEach((sp, i) => sp.classList.toggle('on', i === v));
    };
    body.append(lever, names);
    wrap.append(body, el('div', 'knob-label', c.label));
    refresh();
    return { el: wrap, refresh };
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
let patchCols = 0;
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
    (u.minBtn = btn(m.min ? '▸' : '▾', 'Minimizar / expandir', () => setMin(m, !m.min), 'min-btn')),
    btn('✕', 'Remover módulo', () => removeModule(m.id)),
  );
  head.appendChild(tools);
  box.appendChild(head);
  u.head = head;

  const body = el('div', 'mod-body');
  // Controlos
  const controls = el('div', 'controls');
  const build = (c) => {
    const built = buildControl(c, () => m.p[c.id], (v) => setParam(m, c.id, v));
    if (c.id) { u.ctl[c.id] = built.el; u.refreshers.push(built.refresh); }
    return built.el;
  };
  const custom = t.custom ? CUSTOM[t.custom](m, u) : null;
  let customPlaced = false;
  if (state.view.layout === 'original') {
    // layout clássico: cada controlo na sua posição do painel, com três tamanhos (grande, médio, pequeno)
    controls.classList.add('panel');
    controls.style.setProperty('--rows', t.rows);
    const byId = Object.fromEntries(t.params.map((c) => [c.id, c]));
    Object.entries(t.at).forEach(([id, [x, y, size]]) => {
      let node, sz;
      if (id === '@custom') {
        if (!custom || t.customWide) return;
        node = custom; customPlaced = true; sz = size || 'sm';
      } else {
        const c = byId[id];
        sz = size || (c.type === 'knob' ? c.size || 'md' : 'sm');
        node = build({ ...c, size: sz, lever: c.type === 'switch' });
      }
      node.classList.add('at', `at-${sz}`);
      node.style.left = `${(x / t.grid) * 100}%`;
      node.style.setProperty('--y', y);
      controls.appendChild(node);
    });
    patchCols = t.cols;
  } else {
    t.controls.forEach((c) => controls.appendChild(build(c)));
    patchCols = 0;
  }
  const panel = state.view.layout === 'original';
  if (custom && !panel && !t.customWide) { controls.appendChild(custom); customPlaced = true; }
  body.appendChild(controls);

  // Patch bay
  const patch = el('div', 'patch');
  if (patchCols) { patch.style.gridTemplateColumns = `repeat(${patchCols}, var(--jack-w))`; patch.style.width = 'auto'; }
  t.jacks.forEach((j) => {
    const key = jackKey(m.id, j);
    const b = el('button', `jack ${j.out ? 'out' : 'in'}`, `<span class="hole"></span><span class="jack-label">${j.label}</span>`);
    b.title = `${j.out ? 'Saída' : 'Entrada'}: ${j.label}`;
    b.addEventListener('click', () => clickJack(key));
    u.jacks[key] = b;
    jackInfo[key] = { mod: m.id, jack: j.id, out: !!j.out, label: j.label, idx: t.jacks.indexOf(j), n: t.jacks.length };
    patch.appendChild(b);
  });
  body.appendChild(patch);
  box.appendChild(body);
  if (custom && !customPlaced) { custom.classList.add('wide'); box.appendChild(custom); }

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
  rack.querySelectorAll('.mod').forEach((e) => e.remove());
  Object.keys(ui).forEach((k) => delete ui[k]);
  Object.keys(jackInfo).forEach((k) => delete jackInfo[k]);
  state.mods.forEach(renderModule);
  renderMixer();
  renderTransport();
  applyView();
  applyZoom();
  syncMode();
}

let counter = 0;
function addModule(type) {
  let id;
  do { id = `${type.toLowerCase()}${++counter}`; } while (getMod(id));
  const m = newModule(type, id);
  state.mods.push(m);
  renderModule(m);
  engine.addModule(m);
  // o relógio master é sempre o do 1.º módulo do rack: liga-o à entrada de relógio do módulo novo
  const master = clockMaster();
  if (master && master !== m && CLOCK_IN[type]) {
    state.cables.push([master.id, CLOCK_OUT[master.type], id, CLOCK_IN[type]]);
    cablesChanged();
  }
  save();
  renderMixer();
  applyView();
  renderCables();
  if (inStage()) stage.render(); else ui[id].el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
// 1.º módulo do rack com saída de relógio (o Pulso X não tem; se for o primeiro, passa ao seguinte)
function clockMaster() { return state.mods.find((x) => CLOCK_OUT[x.type]); }
function removeModule(id) {
  state.mods = state.mods.filter((m) => m.id !== id);
  state.cables = state.cables.filter((c) => c[0] !== id && c[2] !== id);
  ui[id].el.remove();
  Object.keys(ui[id].jacks).forEach((k) => delete jackInfo[k]);
  delete ui[id];
  pending = null;
  engine.send({ t: 'remove', id });
  cablesChanged();
  renderMixer();
  applyView();
  renderTransport();
  renderCables();
  if (inStage()) stage.render();
}

// Minimizado, o módulo fica só com o cabeçalho; os cabos passam a terminar na barra do cabeçalho
function setMin(m, min) {
  m.min = min;
  const u = ui[m.id];
  u.el.classList.toggle('min', min);
  u.minBtn.textContent = min ? '▸' : '▾';
  if (pending && jackInfo[pending]?.mod === m.id) pending = null;
  save();
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
$('rand-knobs').addEventListener('click', () => { state.mods.forEach(randomizeKnobs); if (inStage()) stage.render(); });
$('rand-seq').addEventListener('click', () => { if (inStage()) stage.randomSeq(); else state.mods.forEach(randomizeSeq); });
$('rand-patch').addEventListener('click', () => {
  if (inStage()) { stage.randomPatch(); return; } // no modo ícones, o patch aleatório espalha os módulos e a proximidade faz os cabos
  state.cables = randomCables(state.mods); pending = null; cablesChanged(); renderCables();
});

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
    const key = `${modId}:${out ? 'o' : 'i'}:${jack}`, u = ui[modId], b = u?.jacks[key];
    if (!b) return null;
    if (getMod(modId)?.min) {
      // módulo minimizado: o cabo termina na base do cabeçalho, na posição relativa da tomada no patch bay
      const r = u.head.getBoundingClientRect(), j = jackInfo[key];
      return [r.left + 12 + ((j.idx + 0.5) / j.n) * (r.width - 24) - host.left, r.bottom - host.top, 12 * (state.zoom || 1), true];
    }
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
    const [x1, y1, w1, min1] = p1, [x2, y2, w2, min2] = p2, w = Math.max(w1, w2);
    const sag = Math.min(70, 16 + Math.hypot(x2 - x1, y2 - y1) * 0.22);
    const color = CABLE_COLORS[i % CABLE_COLORS.length];
    const end = (x, y, ww, min) => (min
      ? `<rect x="${x - ww * 0.3}" y="${y - ww * 0.3}" width="${ww * 0.6}" height="${ww * 0.6}" rx="2" fill="${color}" />`
      : `<circle cx="${x}" cy="${y}" r="${ww * 0.3}" fill="${color}" />`);
    return `<path d="M ${x1} ${y1} C ${x1} ${y1 + sag}, ${x2} ${y2 + sag}, ${x2} ${y2}" stroke="${color}" stroke-width="${Math.max(2, w * 0.28)}" />
      ${end(x1, y1, w1, min1)}${end(x2, y2, w2, min2)}`;
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
$('clear-cables').addEventListener('click', () => { state.cables = []; pending = null; cablesChanged(); renderCables(); stage.redraw(); });

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
  stage.syncRun();
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
  $(preset.classic ? 'classics' : 'presets').appendChild(btn(preset.name, preset.about || 'Carregar esta memória', () => loadRack(preset.make())));
});

// Substitui o rack por outro (memória de fábrica ou patch do banco), mantendo o visual e o transporte
function loadRack(data) {
  const running = state.mods.some((m) => m.p.run);
  const rackData = JSON.parse(JSON.stringify(data));
  rackData.mods = (rackData.mods || []).filter((m) => TYPES[m.type]);
  rackData.mods.forEach((m) => {
    m.p = { ...TYPES[m.type].defaults, ...m.p, run: running && TYPES[m.type].hasRun ? 1 : 0 };
    m.mix = normMix(m.mix);
    m.data = m.data || (TYPES[m.type].data ? TYPES[m.type].data() : {});
  });
  const ids = new Set(rackData.mods.map((m) => m.id));
  rackData.cables = (rackData.cables || []).filter((c) => ids.has(c[0]) && ids.has(c[2]));
  const fx = Object.fromEntries(FX_CONTROLS.map((c) => [c.id, c.def]));
  state = { zoom: state.zoom, view: state.view, stage: state.stage, mods: rackData.mods, cables: rackData.cables, fx: { ...fx, ...rackData.fx } };
  pending = null;
  renderRack();
  engine.sync(state);
  save();
}

// ---------- Banco de patches (guardado no browser, com exportação e importação em ficheiro) ----------
const BANK_KEY = 'pulso-bank-v1';
function readBank() {
  try { const b = JSON.parse(localStorage.getItem(BANK_KEY)); return Array.isArray(b) ? b : []; } catch (_) { return []; }
}
function writeBank(bank) {
  try { localStorage.setItem(BANK_KEY, JSON.stringify(bank)); return true; } catch (_) { return false; }
}
const snapshot = () => JSON.parse(JSON.stringify({ mods: state.mods, cables: state.cables, fx: state.fx }));
function renderBank(message = '') {
  const bank = readBank(), list = $('bank-list');
  list.innerHTML = '';
  if (!bank.length) list.appendChild(el('p', 'hint', 'Ainda não há patches guardados.'));
  bank.forEach((patch, i) => {
    const row = el('div', 'bank-row');
    const load = btn(patch.name, 'Carregar este patch', () => { loadRack(patch.rack); renderBank(`"${patch.name}" carregado.`); }, 'bank-name');
    row.append(
      load,
      el('span', 'readout', `${patch.rack.mods.length} mód.`),
      btn('↻', 'Substituir pelo rack atual', () => { bank[i].rack = snapshot(); writeBank(bank); renderBank(`"${patch.name}" atualizado.`); }),
      btn('✕', 'Apagar este patch', () => { bank.splice(i, 1); writeBank(bank); renderBank(`"${patch.name}" apagado.`); }),
    );
    list.appendChild(row);
  });
  $('bank-msg').textContent = message;
  $('bank-btn').textContent = `Carregar (${bank.length}) ▾`;
}
function saveToBank() {
  const input = $('bank-name');
  const bank = readBank();
  const name = input.value.trim() || `Patch ${bank.length + 1}`;
  const existing = bank.findIndex((p) => p.name === name);
  const entry = { name, saved: new Date().toISOString(), rack: snapshot() };
  if (existing >= 0) bank[existing] = entry; else bank.push(entry);
  const ok = writeBank(bank);
  input.value = '';
  renderBank(ok ? `"${name}" guardado.` : 'Não foi possível guardar neste browser.');
}
$('bank-save').addEventListener('click', saveToBank);
$('bank-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') saveToBank(); });
$('bank-export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ pulsoBank: 1, patches: readBank() }, null, 2)], { type: 'application/json' });
  const a = el('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'pulso-banco.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
$('bank-import').addEventListener('click', () => $('bank-file').click());
$('bank-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const incoming = (data.patches || []).filter((p) => p && typeof p.name === 'string' && p.rack && Array.isArray(p.rack.mods));
    if (!incoming.length) throw new Error('vazio');
    const bank = readBank();
    incoming.forEach((p) => {
      const at = bank.findIndex((x) => x.name === p.name);
      if (at >= 0) bank[at] = p; else bank.push(p);
    });
    writeBank(bank);
    renderBank(`${incoming.length} patch(es) importado(s).`);
  } catch (_) { renderBank('Ficheiro inválido.'); }
});
$('bank-btn').addEventListener('click', () => { $('bank-menu').hidden = !$('bank-menu').hidden; });
$('bank-quick').addEventListener('click', () => { $('bank-menu').hidden = false; $('bank-name').focus(); });
document.addEventListener('pointerdown', (e) => {
  if (!e.target.closest('#bank-menu, #bank-btn, #bank-quick')) $('bank-menu').hidden = true;
});
renderBank();

// ---------- Mixer: um canal por módulo, efeitos e master ----------
// De cima para baixo: FX1 (envio para o reverb), FX2 (envio para o delay), PAN e LEVEL
const MIX_CONTROLS = [
  { type: 'knob', id: 'fx1', label: 'FX1 REV', def: 0.25, size: 'sm' },
  { type: 'knob', id: 'fx2', label: 'FX2 DLY', def: 0.25, size: 'sm' },
  { type: 'knob', id: 'pan', label: 'PAN', def: 0.5, bipolar: true },
  { type: 'knob', id: 'level', label: 'LEVEL', def: 0.8 },
];
const sendMix = (m) => engine.send({ t: 'mix', id: m.id, v: m.mix });
function renderMixer() {
  const mixer = $('mixer');
  mixer.innerHTML = '';
  Object.keys(leds).forEach((k) => delete leds[k]);
  const count = {};
  const channels = [];
  const markMuted = () => {
    const anySolo = state.mods.some((m) => m.mix.solo);
    channels.forEach(([m, ch]) => ch.classList.toggle('muted', !!m.mix.mute || (anySolo && !m.mix.solo)));
  };
  state.mods.forEach((m) => {
    count[m.type] = (count[m.type] || 0) + 1;
    const ch = el('div', 'channel');
    channels.push([m, ch]);
    const name = el('div', 'ch-name', `<span class="sig"></span>${m.type} ${count[m.type]}`);
    leds[m.id] = name.querySelector('.sig');
    ch.appendChild(name);
    const flag = (key, label, title) => {
      const b = btn(label, title, () => {
        m.mix[key] = m.mix[key] ? 0 : 1;
        b.classList.toggle('on', !!m.mix[key]);
        sendMix(m); save(); markMuted();
      }, `ch-btn ch-${key}`);
      b.classList.toggle('on', !!m.mix[key]);
      return b;
    };
    const row = el('div', 'ch-btns');
    row.append(
      flag('mute', 'M', 'Mute'),
      flag('solo', 'S', 'Solo (podes ter vários canais em solo)'),
      btn('↧', 'Ir para o módulo no rack', () => locate(m), 'ch-btn'),
    );
    ch.appendChild(row);
    MIX_CONTROLS.forEach((c) => ch.appendChild(buildControl(c, () => m.mix[c.id], (v) => {
      m.mix[c.id] = v;
      sendMix(m);
      save();
    }).el));
    mixer.appendChild(ch);
  });
  markMuted();
  const fx = el('div', 'channel fx');
  fx.appendChild(el('div', 'ch-name', 'FX · MASTER'));
  const knobs = el('div', 'fx-grid');
  FX_CONTROLS.forEach((c) => knobs.appendChild(buildControl(c, () => state.fx[c.id], (v) => {
    state.fx[c.id] = v; engine.fx(state.fx); save();
  }).el));
  fx.appendChild(knobs);
  $('mixer-fx').replaceChildren(fx);
}

// Leva o rack até ao módulo e assinala-o por um instante
function locate(m) {
  const box = ui[m.id]?.el;
  if (!box || inStage()) return;
  box.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
  box.classList.remove('flash');
  void box.offsetWidth;
  box.classList.add('flash');
}
// A altura do topo fixo, para o scroll não esconder o módulo por baixo dele
const topEl = document.querySelector('.top');
new ResizeObserver(() => document.documentElement.style.setProperty('--top-h', `${topEl.offsetHeight}px`)).observe(topEl);

// Minimizar o mixer e o osciloscópio
function applyPanels() {
  const v = state.view;
  document.documentElement.dataset.mixMin = v.mixMin ? '1' : '0';
  document.documentElement.dataset.scopeMin = v.scopeMin ? '1' : '0';
  $('toggle-mixer').textContent = `${v.mixMin ? '▸' : '▾'} Mixer`;
  $('toggle-scope').textContent = `${v.scopeMin ? '▸' : '▾'} Scope`;
  $('toggle-mixer').classList.toggle('on', !v.mixMin);
  $('toggle-scope').classList.toggle('on', !v.scopeMin);
  renderCables();
}
$('toggle-mixer').addEventListener('click', () => { state.view.mixMin = !state.view.mixMin; applyPanels(); save(); });
$('toggle-scope').addEventListener('click', () => { state.view.scopeMin = !state.view.scopeMin; applyPanels(); save(); });

// ---------- Menu visual: skin, estilo dos knobs e layout ----------
const VIEW_OPTIONS = {
  mode: [['rack', 'Rack'], ['stage', 'Ícones']],
  skin: [['pulso', 'Pulso'], ['classic', 'Clássico'], ['funky', 'Funky'], ['seventies', 'Anos 70'], ['random', '⚄ Aleatório']],
  knobs: [['arc', 'Arco'], ['solid', 'Clássico'], ['random', '⚄ Aleatório']],
  layout: [['original', 'Clássico'], ['compact', 'Compacto']],
};
const hsl = (h, s, l) => `hsl(${((h % 360) + 360) % 360} ${s}% ${l}%)`;
function randomSkinVars() {
  const h = Math.random() * 360, a = h + 120 + Math.random() * 120, light = Math.random() < 0.3;
  return light ? {
    '--bg': hsl(h, 35, 80), '--panel': hsl(h, 40, 90), '--panel-2': hsl(h, 35, 82), '--line': hsl(h, 30, 55),
    '--text': hsl(h, 40, 12), '--muted': hsl(h, 25, 35), '--accent': hsl(a, 85, 45), '--led': hsl(a + 90, 90, 45),
    '--cap': hsl(a + 180, 40, 30), '--cap-line': hsl(h, 40, 15), '--pointer': hsl(h, 40, 95), '--on-text': '#fff',
  } : {
    '--bg': hsl(h, 35, 7), '--panel': hsl(h, 35, 13), '--panel-2': hsl(h, 30, 19), '--line': hsl(h + 20, 30, 34),
    '--text': hsl(h, 20, 92), '--muted': hsl(h, 20, 66), '--accent': hsl(a, 90, 62), '--led': hsl(a + 90, 95, 60),
    '--cap': hsl(a + 180, 40, 24), '--cap-line': hsl(a + 180, 30, 45), '--pointer': hsl(h, 20, 95), '--on-text': '#111',
  };
}
function applyView() {
  const v = state.view, root = document.documentElement;
  root.dataset.skin = v.skin;
  root.dataset.layout = v.layout;
  root.removeAttribute('style');
  if (v.skin === 'random') {
    if (!v.vars) v.vars = randomSkinVars();
    Object.entries(v.vars).forEach(([k, val]) => root.style.setProperty(k, val));
  }
  document.querySelectorAll('.knob').forEach((k) => {
    const rnd = v.knobs === 'random';
    k.classList.toggle('k-solid', v.knobs === 'solid' || (rnd && Math.random() < 0.5));
    if (rnd) {
      const h = Math.random() * 360;
      k.style.setProperty('--accent', hsl(h, 90, 60));
      k.style.setProperty('--cap', hsl(h + 180, 45, 28));
    } else { k.style.removeProperty('--accent'); k.style.removeProperty('--cap'); }
  });
  document.querySelectorAll('#view-menu button').forEach((b) => b.classList.toggle('on', v[b.dataset.key] === b.dataset.value));
}
Object.entries(VIEW_OPTIONS).forEach(([key, options]) => {
  const row = $(`view-${key}`);
  options.forEach(([value, label]) => {
    const b = btn(label, '', () => {
      const relayout = key === 'layout' && state.view.layout !== value;
      state.view[key] = value;
      if (key === 'skin' && value === 'random') state.view.vars = randomSkinVars(); // cada toque gera outra
      if (relayout) renderRack(); else applyView();
      if (key === 'mode') syncMode(); else renderCables();
      save();
    });
    b.dataset.key = key; b.dataset.value = value;
    row.appendChild(b);
  });
});
$('view-btn').addEventListener('click', () => { $('view-menu').hidden = !$('view-menu').hidden; });
document.addEventListener('pointerdown', (e) => {
  if (!e.target.closest('#view-menu, #view-btn')) $('view-menu').hidden = true;
});

renderRack();
applyPanels();
scope.drawIdle();

// Acesso para depuração na consola do browser
window.pulso = { engine, get state() { return state; } };

// Instalação como app (PWA) quando servido por http(s)
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
