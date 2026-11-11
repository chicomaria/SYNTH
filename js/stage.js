// Modo Ícones: sem knobs nem patch bay. Cada módulo é um núcleo com ícones à volta.
// Arrastar um ícone muda dois parâmetros ao mesmo tempo (posição horizontal e vertical dentro do seu campo).
// Arrastar o núcleo de um módulo para junto de outro cria cabos entre eles (mais perto, mais cabos).
// O ícone de sequência gera e deforma a sequência do módulo (densidade e alcance).

import { TYPES, FX_CONTROLS } from './defs.js?v=11';

const HUE = { M: 30, D: 340, S: 140, L: 200, X: 280, N: 10, A: 100, FX: 55 };
const F = 22; // alcance do ícone dentro do campo, em px
const ICON = 38, CORE = 64, FIELD = 2 * F + ICON, SPACING = 90;
const LINK = [120, 180, 240]; // distância entre núcleos para 3, 2 e 1 cabos
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const keys = (a) => (a == null ? [] : Array.isArray(a) ? a : [a]);

const GLYPHS = {
  osc: '<path d="M2 12 C5 3 9 3 12 12 S19 21 22 12"/>',
  sub: '<path d="M2 8 C4 3 6 3 8 8 S12 13 14 8 M2 19 C7 12 12 12 22 19"/>',
  filter: '<path d="M2 8 H12 C16 8 17 18 22 18"/>',
  env: '<path d="M2 20 L8 4 L13 12 H17 L22 20"/>',
  lfo: '<path d="M2 14 L7 6 L12 18 L17 6 L22 14"/>',
  noise: '<path d="M2 12 L4 6 L6 17 L8 9 L10 19 L12 5 L14 15 L16 8 L18 18 L20 7 L22 12"/>',
  fm: '<path d="M2 12 C4 4 6 4 7 12 S10 20 11 12 M13 12 C15 8 17 8 18 12 S20 16 22 12"/>',
  seq: '<path d="M4 20 V14 M9 20 V6 M14 20 V11 M19 20 V4"/>',
  bands: '<path d="M3 20 V12 M7 20 V6 M11 20 V9 M15 20 V15 M19 20 V8"/>',
  tempo: '<path d="M7 21 L10 3 H14 L17 21 Z M12 18 L16 8"/>',
  wave: '<path d="M2 18 V6 H9 V18 H15 V6 H22"/>',
  mix: '<path d="M6 3 V21 M12 3 V21 M18 3 V21 M3 8 H9 M9 15 H15 M15 6 H21"/>',
  send: '<path d="M4 12 H18 M13 7 L18 12 L13 17"/>',
  run: '<path d="M7 4 L19 12 L7 20 Z"/>',
  stop: '<path d="M6 6 H18 V18 H6 Z"/>',
  delay: '<path d="M4 12 H8 M11 7 C14 9 14 15 11 17 M15 4 C20 8 20 16 15 20"/>',
  reverb: '<path d="M12 4 A8 8 0 1 0 12 20 A8 8 0 1 0 12 4 M12 8 A4 4 0 1 0 12 16 A4 4 0 1 0 12 8"/>',
  master: '<path d="M4 9 H8 L13 5 V19 L8 15 H4 Z M16 9 C18 11 18 13 16 15"/>',
};
const glyph = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${GLYPHS[n]}</svg>`;

// Ícones de cada tipo: x e y são os parâmetros que a posição controla (um, vários ou nenhum)
const A = (key, label, g, hue, x, y, extra = {}) => ({ key, label, glyph: g, hue, x, y, ...extra });
const MIXICONS = [
  A('mix', 'Mix', 'mix', 180, 'mix.pan', 'mix.level'),
  A('send', 'Envios FX1 · FX2', 'send', 250, 'mix.fx1', 'mix.fx2'),
];
const SPEC = {
  M: [
    A('osc', 'Oscilador', 'osc', 30, 'freq', 'pw'),
    A('vcf', 'Filtro', 'filter', 200, 'cutoff', 'res'),
    A('lfo', 'Movimento', 'lfo', 280, 'lfoRate', ['vcfModAmt', 'vcoModAmt']),
    A('env', 'Envelope', 'env', 140, 'decay', 'attack'),
    A('tempo', 'Tempo', 'tempo', 60, 'tempo', 'gateLen'),
    A('seq', 'Sequência', 'seq', 330, null, null, { seq: true, xl: 'densidade', yl: 'alcance' }),
    A('wave', 'Onda', 'wave', 10, null, null, { cycle: ['wave'] }),
    ...MIXICONS,
    A('run', 'Tocar', 'run', 120, null, null, { run: true }),
  ],
  D: [
    A('osc1', 'Osc 1', 'osc', 30, 'vco1Freq', 'vco1Eg'),
    A('osc2', 'Osc 2', 'osc', 50, 'vco2Freq', 'vco2Eg'),
    A('fm', 'FM', 'fm', 300, 'fm', 'vcoDecay'),
    A('vcf', 'Filtro', 'filter', 200, 'cutoff', 'res'),
    A('env', 'Envelopes', 'env', 140, 'vcfDecay', 'vcaDecay'),
    A('noise', 'Ruído', 'noise', 260, 'noiseLvl', 'noiseMod'),
    A('tempo', 'Tempo', 'tempo', 60, 'tempo', 'vcfEg'),
    A('seq', 'Sequência', 'seq', 330, null, null, { seq: true, xl: 'densidade', yl: 'alcance' }),
    A('wave', 'Ondas', 'wave', 10, null, null, { cycle: ['vco1Wave', 'vco2Wave'] }),
    ...MIXICONS,
    A('run', 'Tocar', 'run', 120, null, null, { run: true }),
  ],
  S: [
    A('osc1', 'Osc 1', 'osc', 30, 'vco1Freq', 'vco1Lvl'),
    A('subs1', 'Subs 1', 'sub', 40, 'sub1Div', 'sub2Div'),
    A('osc2', 'Osc 2', 'osc', 50, 'vco2Freq', 'vco2Lvl'),
    A('subs2', 'Subs 2', 'sub', 60, 'sub3Div', 'sub4Div'),
    A('vcf', 'Filtro', 'filter', 200, 'cutoff', 'res'),
    A('env', 'Envelopes', 'env', 140, 'vcfDecay', 'vcaDecay'),
    A('rhy1', 'Ritmos 1-2', 'tempo', 100, 'rhythm1', 'rhythm2'),
    A('rhy2', 'Ritmos 3-4', 'tempo', 80, 'rhythm3', 'rhythm4'),
    A('tempo', 'Tempo', 'tempo', 60, 'tempo', 'vcfEg'),
    A('seq', 'Sequência', 'seq', 330, null, null, { seq: true, xl: 'alcance', yl: 'subs' }),
    A('wave', 'Ondas', 'wave', 10, null, null, { cycle: ['vco1Wave', 'vco2Wave'] }),
    ...MIXICONS,
    A('run', 'Tocar', 'run', 120, null, null, { run: true }),
  ],
  L: [
    A('osc', 'Oscilador', 'osc', 30, 'vcoFreq', 'vcoEg'),
    A('mod', 'Modulador', 'fm', 300, 'modFreq', 'fm'),
    A('fold', 'Fold', 'noise', 340, 'fold', 'foldEg'),
    A('vcf', 'Filtro', 'filter', 200, 'cutoff', 'res'),
    A('env', 'Envelopes', 'env', 140, 'eg1Decay', 'eg2Decay'),
    A('mixer', 'Níveis', 'sub', 40, 'vcoLvl', 'modLvl'),
    A('noise', 'Ruído', 'noise', 260, 'noiseLvl', 'blend'),
    A('tempo', 'Tempo', 'tempo', 60, 'tempo', 'vcfEg'),
    A('seq', 'Sequência', 'seq', 330, null, null, { seq: true, xl: 'corrupção', yl: 'alcance' }),
    ...MIXICONS,
    A('run', 'Tocar', 'run', 120, null, null, { run: true }),
  ],
  X: [
    A('osc', 'Portadora', 'osc', 30, 'vcoFreq', 'pw'),
    A('noise', 'Ruído', 'noise', 260, 'noiseMix', 'progLvl'),
    A('shift', 'Spectral shift', 'bands', 200, 'shift', 'res'),
    A('lfo', 'Movimento', 'lfo', 280, 'lfoRate', 'lfoAmt'),
    A('bands', 'Bandas', 'bands', 330, null, null, { seq: true, xl: 'centro', yl: 'largura' }),
    A('wave', 'Onda', 'wave', 10, null, null, { cycle: ['vcoWave'] }),
    ...MIXICONS,
  ],
  N: [
    A('osc', 'Osciladores', 'osc', 30, 'osc1Wave', 'osc2Freq'),
    A('vcf', 'Filtro', 'filter', 200, 'cutoff', 'res'),
    A('lfo', 'Movimento', 'lfo', 280, 'lfoRate', ['lfoCut', 'lfoPitch']),
    A('env', 'Envelopes', 'env', 140, ['fD', 'aD'], 'egAmt'),
    A('tempo', 'Tempo', 'tempo', 60, 'tempo', 'gateLen'),
    A('seq', 'Sequência', 'seq', 330, null, null, { seq: true, xl: 'densidade', yl: 'alcance' }),
    A('wave', 'Sync', 'wave', 10, null, null, { cycle: ['sync'] }),
    ...MIXICONS,
    A('run', 'Tocar', 'run', 120, null, null, { run: true }),
  ],
  A: [
    A('osc1', 'VCO 1', 'osc', 30, 'v1Coarse', 'v1Fm1'),
    A('osc2', 'VCO 2', 'osc', 50, 'v2Coarse', 'v2Pw'),
    A('ring', 'Ring / ruído', 'fm', 300, 'fRing', 'fNoise'),
    A('vcf', 'Filtro', 'filter', 200, 'cutoff', 'res'),
    A('env', 'Envelopes', 'env', 140, 'decay', 'fAdsr'),
    A('tempo', 'Tempo', 'tempo', 60, 'tempo', 'gateLen'),
    A('seq', 'Sequência', 'seq', 330, null, null, { seq: true, xl: 'densidade', yl: 'alcance' }),
    A('wave', 'Sync', 'wave', 10, null, null, { cycle: ['sync'] }),
    ...MIXICONS,
    A('run', 'Tocar', 'run', 120, null, null, { run: true }),
  ],
  FX: [
    A('delay', 'Delay', 'delay', 55, 'delayTime', 'delayFb'),
    A('send', 'Envios', 'reverb', 200, 'delayMix', 'reverb'),
    A('master', 'Master', 'master', 120, null, 'vol'),
  ],
};

// Funções dos pontos de patch, para escolher os cabos quando dois módulos se aproximam
const ROLES = {
  M: { clockOut: ['assign'], audioOut: ['vca', 'vcf'], cvOut: ['eg', 'lfoTri', 'kb', 'lfoSq'], clockIn: [], audioIn: ['ext'], cvIn: ['cutoff', 'vcoMod', 'mixCv', 'lfoRate'] },
  D: { clockOut: ['trigOut'], audioOut: ['vca', 'vco1'], cvOut: ['vcaEg', 'vcfEg', 'vcoEg', 'velOut'], clockIn: ['adv'], audioIn: ['ext'], cvIn: ['vcfMod', 'vco1Cv', 'fmAmt', 'vco2Cv'] },
  S: { clockOut: ['clockOut', 'seq1Clk'], audioOut: ['vcaOut', 'vco1'], cvOut: ['seq1', 'seq2', 'vcfEg', 'vcaEg'], clockIn: ['clock'], audioIn: [], cvIn: ['cutoff', 'vco1', 'vco2', 'rhythm1'] },
  L: { clockOut: ['clockOut', 'trig1Out'], audioOut: ['vca', 'foldOut'], cvOut: ['seq1', 'seq2', 'eg1', 'eg2'], clockIn: ['clock'], audioIn: ['audio'], cvIn: ['cutoff', 'vcoCv', 'fold', 'fmAmt'] },
  N: { clockOut: ['clockOut'], audioOut: ['vca', 'vcf'], cvOut: ['fEg', 'lfo', 'kb', 'aEg'], clockIn: ['clock'], audioIn: ['ext'], cvIn: ['cutoff', 'voct', 'vcaCv', 'lfoRate'] },
  A: { clockOut: ['clockOut'], audioOut: ['vca', 'ring'], cvOut: ['adsr', 'sh', 'kb', 'ar'], clockIn: ['clock'], audioIn: ['vcfIn', 'ringA'], cvIn: ['vcfFm', 'v1Fm', 'v2Pwm', 'v2Fm'] },
  X: { clockOut: [], audioOut: ['out', 'vco'], cvOut: ['env', 'lfo'], clockIn: [], audioIn: ['program', 'carrier'], cvIn: ['shiftCv', 'voct', 'lfoRate', 'band1'] },
};
function routes(S, T) {
  const rs = ROLES[S.type], rt = ROLES[T.type];
  return [
    [rs.clockOut[0], rt.clockIn[0]], [rs.audioOut[0], rt.audioIn[0]], [rs.cvOut[0], rt.cvIn[0]],
    [rs.audioOut[1], rt.audioIn[1]], [rs.cvOut[1], rt.cvIn[1]], [rs.cvOut[2], rt.cvIn[2]], [rs.cvOut[3], rt.cvIn[3]],
  ].filter(([o, i]) => o && i).map(([o, i]) => [S.id, o, T.id, i, 'a']);
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
const fmt = (c, v) => (c && c.format ? c.format(v) : c && c.bipolar ? `${v > 0.5 ? '+' : ''}${((v - 0.5) * 10).toFixed(1)}` : (v * 10).toFixed(1));

export function createStage(ctx) {
  const root = ctx.root;
  let entries = [], svg = null, tip = null, W = 800;
  const S = () => {
    const s = ctx.getState();
    if (!s.stage) s.stage = { pos: {}, open: {}, seq: {}, seed: {} };
    return s.stage;
  };
  const jackLabel = (modId, jack, out) => {
    const m = ctx.getMod(modId);
    return TYPES[m?.type]?.jacks.find((j) => j.id === jack && !!j.out === out)?.label || jack;
  };

  // acesso uniforme aos parâmetros de um módulo, do mixer dele ou dos efeitos
  function access(entry) {
    if (entry.fake) {
      return {
        get: (k) => ctx.getState().fx[k],
        set: (k, v) => { ctx.getState().fx[k] = v; ctx.fxChanged(); },
        meta: (k) => FX_CONTROLS.find((c) => c.id === k),
      };
    }
    const m = ctx.getMod(entry.id);
    return {
      get: (k) => (k.startsWith('mix.') ? m.mix[k.slice(4)] : m.p[k]),
      set: (k, v) => {
        if (k.startsWith('mix.')) { m.mix[k.slice(4)] = v; ctx.send({ t: 'mix', id: m.id, v: m.mix }); ctx.save(); }
        else ctx.setParam(m, k, v);
      },
      meta: (k) => (k.startsWith('mix.')
        ? { label: { pan: 'PAN', level: 'LEVEL', fx1: 'FX1 REVERB', fx2: 'FX2 DELAY' }[k.slice(4)], def: { pan: 0.5, level: 0.8, fx1: 0.25, fx2: 0.25 }[k.slice(4)] }
        : TYPES[m.type].params.find((c) => c.id === k)),
    };
  }

  // ---------- Sequências: geradas de uma semente, por isso mover o ícone deforma a mesma sequência ----------
  function applySeq(entry, vx, vy) {
    const m = ctx.getMod(entry.id);
    if (!m) return;
    const seed = hash(entry.id) + (S().seed[entry.id] || 1) * 7919;
    const r = rng(seed);
    const set = (k, v) => ctx.setParam(m, k, v);
    if (m.type === 'M' || m.type === 'N' || m.type === 'A') {
      const scale = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24], avail = Math.min(scale.length, 2 + Math.round(vy * 9));
      const steps = Array.from({ length: 32 }, (_, i) => {
        const a = r(), b = r();
        if (i === 0) return { n: 0, r: false };
        return a < 0.25 + 0.75 * vx ? { n: scale[Math.floor(Math.pow(b, 1.6) * avail)], r: false } : { n: 0, r: true };
      });
      m.data.steps = steps;
      ctx.send({ t: 'data', id: m.id, k: 'steps', v: steps });
      ctx.save();
    } else if (m.type === 'D') {
      for (let i = 1; i <= 8; i++) {
        const u = r(), w = r(), p = r();
        set(`vel${i}`, i === 1 || u < 0.2 + 0.8 * vx ? 0.3 + 0.7 * w : 0.04);
        set(`pitch${i}`, 0.5 + Math.round((p * 2 - 1) * vy * 12) / 120);
      }
    } else if (m.type === 'S') {
      for (let n = 1; n <= 4; n++) { set(`a${n}`, 0.5 + (r() * 2 - 1) * 0.5 * vx); set(`b${n}`, 0.5 + (r() * 2 - 1) * 0.5 * vx); }
      ['s1Sub1', 's1Sub2', 's2Sub1', 's2Sub2'].forEach((k) => set(k, r() < vy ? 1 : 0));
    } else if (m.type === 'L') {
      set('seq1Corrupt', vx * 0.8); set('seq2Corrupt', vx * 0.8); set('seq1Range', vy); set('seq2Range', vy * 0.8);
    } else if (m.type === 'X') {
      const c = vx * 9, w = 0.6 + vy * 4;
      for (let k = 0; k < 10; k++) set(`b${k + 1}`, Math.max(0.05, Math.exp(-((k - c) ** 2) / (2 * w * w))));
    }
  }

  // ---------- Posições e geometria ----------
  const ringR = (n) => Math.max(92, Math.round((n * SPACING) / (2 * Math.PI)));
  const hueOf = (e) => HUE[e.type];

  function place(entry) {
    const pos = S().pos[entry.id];
    entry.cx = clamp(pos.x * W, CORE, Math.max(CORE, W - CORE));
    entry.cy = Math.max(70, pos.y);
    entry.core.style.transform = `translate(${entry.cx - CORE / 2}px, ${entry.cy - CORE / 2}px)`;
    entry.icons.forEach((ic) => {
      const ax = entry.cx + entry.R * Math.cos(ic.ang), ay = entry.cy + entry.R * Math.sin(ic.ang);
      ic.ax = ax; ic.ay = ay;
      ic.field.style.transform = `translate(${ax - FIELD / 2}px, ${ay - FIELD / 2}px)`;
      ic.label.style.transform = `translate(${ax - 40}px, ${ay + FIELD / 2 - 4}px)`;
      moveIcon(ic);
    });
  }
  function moveIcon(ic) {
    ic.el.style.transform = `translate(${ic.ax + ic.off.x - ICON / 2}px, ${ic.ay + ic.off.y - ICON / 2}px)`;
  }
  function fitHeight() {
    const maxR = Math.max(...entries.map((e) => e.R), 92);
    const need = Math.max(...entries.map((e) => e.cy + maxR + 80));
    const h = Math.max(ctx.availHeight(), need);
    root.style.height = `${h}px`;
    svg.setAttribute('width', W);
    svg.setAttribute('height', h);
  }

  function offsetsFor(entry, ic) {
    const acc = entry.fake ? access(entry) : null;
    const sp = ic.spec;
    if (sp.seq) { const q = S().seq[entry.id] || { x: 0.5, y: 0.5 }; return { x: (q.x * 2 - 1) * F, y: -(q.y * 2 - 1) * F }; }
    const a = acc || access(entry);
    const kx = keys(sp.x)[0], ky = keys(sp.y)[0];
    return { x: kx ? (a.get(kx) * 2 - 1) * F : 0, y: ky ? -(a.get(ky) * 2 - 1) * F : 0 };
  }

  // ---------- Desenho dos ícones ----------
  function paint(entry, ic) {
    const vx = (ic.off.x / F + 1) / 2, vy = (-ic.off.y / F + 1) / 2;
    ic.field.style.setProperty('--gx', `${vx * 100}%`);
    ic.field.style.setProperty('--gy', `${(1 - vy) * 100}%`);
    ic.el.style.setProperty('--h', Math.round(ic.spec.hue + vx * 50));
    return { vx, vy };
  }
  function tipText(entry, ic, vx, vy) {
    const a = access(entry), sp = ic.spec;
    const part = (ks, v, fallback) => {
      if (sp.seq) return `${fallback} ${(v * 10).toFixed(1)}`;
      const k = keys(ks)[0];
      if (!k) return null;
      const meta = a.meta(k);
      return `${meta?.label || k} ${fmt(meta, v)}`;
    };
    return [sp.label.toUpperCase(), part(sp.x, vx, sp.xl), part(sp.y, vy, sp.yl)].filter(Boolean).join(' · ');
  }
  function showTip(entry, ic, text) {
    tip.textContent = text;
    tip.style.transform = `translate(${ic.ax + ic.off.x + 26}px, ${ic.ay + ic.off.y - 34}px)`;
    tip.hidden = false;
  }

  function apply(entry, ic) {
    const { vx, vy } = paint(entry, ic);
    const a = access(entry), sp = ic.spec;
    if (sp.seq) {
      S().seq[entry.id] = { x: vx, y: vy };
      applySeq(entry, vx, vy);
    } else {
      keys(sp.x).forEach((k) => a.set(k, vx));
      keys(sp.y).forEach((k) => a.set(k, vy));
    }
    return tipText(entry, ic, vx, vy);
  }

  function cycleName(entry, sp) {
    const m = ctx.getMod(entry.id);
    return sp.cycle.map((k) => TYPES[m.type].params.find((c) => c.id === k).options[m.p[k]]).join(' · ');
  }
  function syncRun() {
    entries.forEach((e) => e.icons.forEach((ic) => {
      if (!ic.spec.run) return;
      const m = ctx.getMod(e.id);
      const on = !!m?.p.run;
      ic.el.classList.toggle('on', on);
      ic.el.innerHTML = glyph(on ? 'stop' : 'run');
    }));
  }

  function bindIcon(entry, ic) {
    const el = ic.el, sp = ic.spec;
    const hasX = sp.seq || keys(sp.x).length > 0, hasY = sp.seq || keys(sp.y).length > 0;
    if (sp.run || sp.cycle) {
      el.addEventListener('click', async () => {
        const m = ctx.getMod(entry.id);
        await ctx.wake();
        if (sp.run) { ctx.toggleRun(m); syncRun(); return; }
        const idx = sp.cycle.reduce((n, k, i) => n | (m.p[k] << i), 0), next = (idx + 1) % (1 << sp.cycle.length);
        sp.cycle.forEach((k, i) => ctx.setParam(m, k, (next >> i) & 1));
        ic.label.textContent = cycleName(entry, sp);
      });
      return;
    }
    let drag = null;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      ctx.wake();
      drag = { sx: e.clientX, sy: e.clientY, ox: ic.off.x, oy: ic.off.y };
      el.classList.add('drag');
    });
    el.addEventListener('pointermove', (e) => {
      if (!drag) return;
      ic.off.x = hasX ? clamp(drag.ox + e.clientX - drag.sx, -F, F) : 0;
      ic.off.y = hasY ? clamp(drag.oy + e.clientY - drag.sy, -F, F) : 0;
      moveIcon(ic);
      showTip(entry, ic, apply(entry, ic));
    });
    const end = () => { drag = null; el.classList.remove('drag'); tip.hidden = true; };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('dblclick', () => {
      const a = access(entry);
      const dx = keys(sp.x)[0] ? a.meta(keys(sp.x)[0])?.def ?? 0.5 : 0.5, dy = keys(sp.y)[0] ? a.meta(keys(sp.y)[0])?.def ?? 0.5 : 0.5;
      ic.off.x = hasX ? (dx * 2 - 1) * F : 0;
      ic.off.y = hasY ? -(dy * 2 - 1) * F : 0;
      moveIcon(ic);
      apply(entry, ic);
    });
    el.addEventListener('pointerenter', () => { const { vx, vy } = paint(entry, ic); showTip(entry, ic, tipText(entry, ic, vx, vy)); });
    el.addEventListener('pointerleave', () => { if (!drag) tip.hidden = true; });
    el.addEventListener('keydown', (e) => {
      const d = e.shiftKey ? 1 : 4, k = e.key;
      const mv = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[k];
      if (!mv) return;
      e.preventDefault();
      ic.off.x = hasX ? clamp(ic.off.x + mv[0], -F, F) : 0;
      ic.off.y = hasY ? clamp(ic.off.y + mv[1], -F, F) : 0;
      moveIcon(ic);
      showTip(entry, ic, apply(entry, ic));
    });
  }

  // ---------- Núcleos: arrastar para mover e ligar, clicar para recolher ----------
  function bindCore(entry) {
    const el = entry.core;
    let drag = null;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      ctx.wake();
      drag = { sx: e.clientX, sy: e.clientY, x: entry.cx, y: entry.cy, moved: false };
    });
    el.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (!drag.moved && Math.hypot(dx, dy) < 5) return;
      drag.moved = true;
      S().pos[entry.id] = { x: clamp((drag.x + dx) / W, 0.03, 0.97), y: Math.max(70, drag.y + dy) };
      place(entry);
      fitHeight();
      if (!entry.fake) relink(entry);
      else drawLinks();
    });
    el.addEventListener('pointerup', () => {
      if (drag && !drag.moved) { S().open[entry.id] = S().open[entry.id] === false; setOpen(entry); }
      drag = null;
      ctx.save();
    });
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); S().open[entry.id] = S().open[entry.id] === false; setOpen(entry); ctx.save(); } });
  }
  function setOpen(entry) {
    const open = S().open[entry.id] !== false;
    entry.core.classList.toggle('closed', !open);
    entry.core.setAttribute('aria-expanded', open);
    entry.icons.forEach((ic) => { ic.field.hidden = ic.label.hidden = ic.el.hidden = !open; });
  }

  // ---------- Cabos automáticos por proximidade ----------
  function linkPair(a, b, s) {
    const d = Math.hypot(a.cx - b.cx, a.cy - b.cy), n = d < LINK[0] ? 3 : d < LINK[1] ? 2 : d < LINK[2] ? 1 : 0;
    if (!n) return;
    const ia = s.mods.findIndex((m) => m.id === a.id), ib = s.mods.findIndex((m) => m.id === b.id);
    const [from, to] = ia <= ib ? [a, b] : [b, a];
    const fw = routes(from, to), bw = routes(to, from), mix = [];
    for (let i = 0; i < Math.max(fw.length, bw.length); i++) { if (fw[i]) mix.push(fw[i]); if (bw[i]) mix.push(bw[i]); }
    mix.slice(0, n).forEach((c) => { if (!s.cables.some((x) => x[0] === c[0] && x[1] === c[1] && x[2] === c[2] && x[3] === c[3])) s.cables.push(c); });
  }
  function relink(entry) {
    const s = ctx.getState();
    s.cables = s.cables.filter((c) => !(c[4] === 'a' && (c[0] === entry.id || c[2] === entry.id)));
    entries.filter((o) => o !== entry && !o.fake).forEach((o) => linkPair(entry, o, s));
    ctx.cablesChanged();
    drawLinks();
  }
  function relinkAll() {
    const s = ctx.getState();
    s.cables = s.cables.filter((c) => c[4] !== 'a');
    const real = entries.filter((e) => !e.fake);
    real.forEach((a, i) => real.slice(i + 1).forEach((b) => linkPair(a, b, s)));
    ctx.cablesChanged();
    drawLinks();
  }

  function drawLinks() {
    if (!svg) return;
    const s = ctx.getState(), byId = Object.fromEntries(entries.map((e) => [e.id, e]));
    const groups = {};
    s.cables.forEach((c) => {
      if (!byId[c[0]] || !byId[c[2]]) return;
      const k = [c[0], c[2]].sort().join('|');
      (groups[k] = groups[k] || []).push(c);
    });
    let defs = '', body = '', i = 0;
    Object.entries(groups).forEach(([k, list]) => {
      const [ida, idb] = k.split('|'), a = byId[ida], b = byId[idb];
      const id = `lg${i++}`, auto = list.some((c) => c[4] === 'a');
      defs += `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${a.cx}" y1="${a.cy}" x2="${b.cx}" y2="${b.cy}">
        <stop offset="0" stop-color="hsl(${hueOf(a)} 90% 62%)"/><stop offset="1" stop-color="hsl(${hueOf(b)} 90% 62%)"/></linearGradient>`;
      const mx = (a.cx + b.cx) / 2, my = (a.cy + b.cy) / 2, bend = 24;
      const nx = -(b.cy - a.cy), ny = b.cx - a.cx, len = Math.hypot(nx, ny) || 1;
      const qx = mx + (nx / len) * bend, qy = my + (ny / len) * bend;
      body += `<path d="M ${a.cx} ${a.cy} Q ${qx} ${qy} ${b.cx} ${b.cy}" stroke="url(#${id})" stroke-width="${2 + list.length * 1.5}" ${auto ? '' : 'stroke-dasharray="6 6"'} class="st-link"/>`;
      list.forEach((c, j) => {
        body += `<text x="${qx}" y="${qy + 14 + j * 11}" text-anchor="middle" class="st-link-label">${jackLabel(c[0], c[1], true)} → ${jackLabel(c[2], c[3], false)}</text>`;
      });
    });
    svg.innerHTML = `<defs>${defs}</defs>${body}`;
  }

  // ---------- Construção ----------
  function render() {
    root.innerHTML = '';
    W = Math.max(320, root.clientWidth || root.parentElement.clientWidth);
    const s = ctx.getState(), St = S(), count = {};
    const list = s.mods.map((m) => { count[m.type] = (count[m.type] || 0) + 1; return { id: m.id, type: m.type, name: `${m.type} ${count[m.type]}`, fake: false }; })
      .concat([{ id: 'fx', type: 'FX', name: 'FX', fake: true }]);

    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'st-links');
    svg.setAttribute('aria-hidden', 'true');
    root.appendChild(svg);

    // barra
    const bar = document.createElement('div');
    bar.className = 'st-bar';
    const mk = (label, title, fn) => { const b = document.createElement('button'); b.textContent = label; b.title = title; b.addEventListener('click', fn); bar.appendChild(b); };
    mk('Abrir todos', 'Mostrar os ícones à volta de todos os núcleos', () => { entries.forEach((e) => { St.open[e.id] = true; setOpen(e); }); ctx.save(); });
    mk('Recolher todos', 'Esconder os ícones, deixando só os núcleos', () => { entries.forEach((e) => { St.open[e.id] = false; setOpen(e); }); ctx.save(); });
    mk('Reorganizar', 'Voltar à grelha inicial e desfazer os cabos automáticos', () => { St.pos = {}; ctx.getState().cables = ctx.getState().cables.filter((c) => c[4] !== 'a'); ctx.cablesChanged(); render(); ctx.save(); });
    const hint = document.createElement('span');
    hint.className = 'st-hint';
    hint.textContent = 'Arrasta os ícones para mudar o som. Arrasta um núcleo para junto de outro para os ligar (mais perto, mais cabos). Clica no núcleo para recolher.';
    bar.appendChild(hint);
    root.appendChild(bar);

    tip = document.createElement('div');
    tip.className = 'st-tip';
    tip.hidden = true;

    entries = list.map((e) => {
      const specs = SPEC[e.type].filter((sp) => !(sp.run && !TYPES[e.type]?.hasRun));
      return { ...e, specs, R: ringR(specs.length), icons: [] };
    });
    const cell = 2 * (Math.max(...entries.map((e) => e.R)) + FIELD / 2 + 24);
    const cols = Math.max(1, Math.floor(W / cell));
    entries.forEach((e, i) => {
      if (!St.pos[e.id]) St.pos[e.id] = { x: ((i % cols) + 0.5) / cols, y: 60 + Math.floor(i / cols) * cell + cell / 2 };
    });

    entries.forEach((e) => {
      e.specs.forEach((sp, i) => {
        const ang = -Math.PI / 2 + (i * 2 * Math.PI) / e.specs.length;
        const field = document.createElement('div'); field.className = 'st-field';
        const label = document.createElement('div'); label.className = 'st-label';
        const el = document.createElement('button'); el.className = 'st-icon'; el.innerHTML = glyph(sp.glyph);
        el.setAttribute('aria-label', `${e.name}: ${sp.label}`);
        el.style.setProperty('--h', sp.hue);
        field.style.setProperty('--h', sp.hue);
        label.textContent = sp.cycle ? cycleName(e, sp) : sp.label;
        const ic = { spec: sp, ang, field, label, el, off: { x: 0, y: 0 }, ax: 0, ay: 0 };
        if (sp.run || sp.cycle) { field.classList.add('plain'); } else { ic.off = offsetsFor(e, ic); }
        e.icons.push(ic);
        root.append(field, label, el);
      });
    });
    entries.forEach((e) => {
      const core = document.createElement('button');
      core.className = 'st-core';
      core.style.setProperty('--h', HUE[e.type]);
      core.innerHTML = `<b>${e.type === 'FX' ? 'FX' : e.name}</b>`;
      core.setAttribute('aria-label', `Módulo ${e.name}`);
      e.core = core;
      root.appendChild(core);
    });
    root.appendChild(tip);

    entries.forEach((e) => {
      place(e);
      e.icons.forEach((ic) => { paint(e, ic); bindIcon(e, ic); });
      bindCore(e);
      setOpen(e);
    });
    fitHeight();
    drawLinks();
    syncRun();
  }

  return {
    render,
    syncRun,
    redraw: () => { if (svg) drawLinks(); },
    levels(lv) {
      lv.forEach(([id, v]) => { const e = entries.find((x) => x.id === id); if (e && e.core) e.core.style.setProperty('--lv', Math.min(1, v * 1.5).toFixed(2)); });
    },
    // aleatório: novas sementes e novos pontos para os ícones de sequência
    randomSeq() {
      const St = S();
      entries.filter((e) => !e.fake).forEach((e) => {
        St.seed[e.id] = 1 + Math.floor(Math.random() * 100000);
        St.seq[e.id] = { x: 0.3 + Math.random() * 0.7, y: 0.2 + Math.random() * 0.8 };
        applySeq(e, St.seq[e.id].x, St.seq[e.id].y);
      });
      ctx.save();
      render();
    },
    // aleatório: espalha os módulos pelo ecrã e deixa a proximidade decidir os cabos
    randomPatch() {
      const St = S();
      const real = entries.filter((e) => !e.fake);
      const h = Math.min(Math.max(ctx.availHeight(), root.offsetHeight), 1400);
      real.forEach((e) => { St.pos[e.id] = { x: 0.1 + Math.random() * 0.8, y: 90 + Math.random() * (h - 180) }; });
      render();
      relinkAll();
      // se o acaso não aproximou ninguém, junta dois módulos para haver pelo menos uma ligação
      if (real.length > 1 && !ctx.getState().cables.some((c) => c[4] === 'a')) {
        const [a, b] = [...real].sort(() => Math.random() - 0.5);
        St.pos[b.id] = { x: clamp(St.pos[a.id].x + 0.07, 0.05, 0.95), y: St.pos[a.id].y + 40 };
        render();
        relinkAll();
      }
      ctx.save();
    },
  };
}
