// Definição dos tipos de módulo: controlos, pontos de patch, memórias e aleatório.
// Knobs normalizados em 0..1; interruptores com valores inteiros.
// Opções dos knobs: bipolar, size, format, seq (pertence à sequência), keep (não entra no aleatório),
// r: [min, max] (intervalo usado pelo aleatório).

const K = (id, label, def = 0.5, opt = {}) => ({ type: 'knob', id, label, def, ...opt });
const S = (id, label, options, def = 0, opt = {}) => ({ type: 'switch', id, label, options, def, ...opt });
const T = (id, label, def = 0, opt = {}) => ({ type: 'toggle', id, label, def, ...opt });
const H = (text) => ({ type: 'head', text });
const i = (id, label, opt = {}) => ({ id, label, ...opt });
const o = (id, label) => ({ id, label, out: true });
const int16 = (v) => `${Math.round(1 + 15 * v)}`;
const VOL = { keep: true };
const LVL = { r: [0.4, 1] };
const DEC = { r: [0.2, 0.7] };
const CUT = { r: [0.3, 0.8], size: 'lg' };
const NR = { noRand: true }; // entradas que o patch aleatório evita

export const TYPES = {
  M: {
    name: 'PULSO M', sub: 'melódico · arquitetura do Mother-32', hasRun: true, custom: 'mseq',
    controls: [
      H('VCO'), K('freq', 'FREQUENCY', 0.5, { bipolar: true, size: 'lg', r: [0.3, 0.7] }), K('pw', 'PULSE WIDTH', 0.5),
      S('wave', 'VCO WAVE', ['SAW', 'PULSE']), K('mix', 'MIX', 0, { r: [0, 0.4] }), K('glide', 'GLIDE', 0, { r: [0, 0.4] }),
      S('vcoModSrc', 'VCO MOD SRC', ['EG', 'LFO'], 1), K('vcoModAmt', 'VCO MOD AMT', 0, { r: [0, 0.5] }),
      S('vcoModDest', 'VCO MOD DEST', ['PW', 'FREQ'], 0),
      H('VCF / VCA'), K('cutoff', 'CUTOFF', 0.45, CUT), K('res', 'RESONANCE', 0.3, { r: [0, 0.8] }),
      S('vcfMode', 'VCF MODE', ['LP', 'HP']), S('vcfModSrc', 'VCF MOD SRC', ['EG', 'LFO']),
      K('vcfModAmt', 'VCF MOD AMT', 0.4), S('vcfModPol', 'VCF MOD POL', ['+', '−']),
      S('vcaMode', 'VCA MODE', ['EG', 'ON'], 0, { keep: true }), K('vol', 'VOLUME', 0.7, VOL),
      H('LFO / EG / SEQ'), K('lfoRate', 'LFO RATE', 0.45), S('lfoWave', 'LFO WAVE', ['TRI', 'SQ']),
      K('attack', 'ATTACK', 0.05, { r: [0, 0.35] }), S('sustain', 'SUSTAIN', ['OFF', 'ON']), K('decay', 'DECAY', 0.5, DEC),
      K('tempo', 'TEMPO', 0.602, { keep: true, format: (v) => `${Math.round(30 * Math.pow(10, v))}` }),
      K('gateLen', 'GATE LENGTH', 0.5), K('vcMix', 'VC MIX', 0.5),
    ],
    jacks: [
      i('ext', 'EXT AUDIO'), i('mixCv', 'MIX CV'), i('vcaCv', 'VCA CV'), o('vca', 'VCA'),
      o('noise', 'NOISE'), i('cutoff', 'VCF CUTOFF'), i('res', 'VCF RES'), o('vcf', 'VCF'),
      i('voct', 'VCO 1V/OCT'), i('linFm', 'VCO LIN FM'), o('saw', 'VCO SAW'), o('pulse', 'VCO PULSE'),
      i('vcoMod', 'VCO MOD'), i('lfoRate', 'LFO RATE'), o('lfoTri', 'LFO TRI'), o('lfoSq', 'LFO SQ'),
      i('mix1', 'MIX 1'), i('mix2', 'MIX 2'), i('vcMixCtrl', 'VC MIX CTRL'), o('vcMix', 'VC MIX'),
      i('mult', 'MULT'), o('mult1', 'MULT 1'), o('mult2', 'MULT 2'), o('assign', 'ASSIGN'),
      i('gate', 'GATE'), o('eg', 'EG'), o('kb', 'KB'), o('gateOut', 'GATE'),
      i('tempo', 'TEMPO'), i('run', 'RUN/STOP', NR), i('reset', 'RESET', NR), i('hold', 'HOLD', NR),
    ],
    data: () => ({ steps: mSeq([0, 0, 12, 0, 3, 0, 10, 12, 0, 0, 12, 0, 7, 5, 3, null]), len: 16 }),
    lit: () => [],
  },

  D: {
    name: 'PULSO D', sub: 'percussão · arquitetura do DFAM', hasRun: true, custom: 'dbuttons',
    controls: [
      H('VCO'), K('vcoDecay', 'VCO DECAY', 0.35, DEC), S('seqPitch', 'SEQ PITCH MOD', ['VCO 1&2', 'OFF', 'VCO 2']),
      K('vco1Eg', 'VCO 1 EG AMT', 0.75, { bipolar: true }), K('vco1Freq', 'VCO 1 FREQ', 0.38, { bipolar: true, size: 'lg', r: [0.25, 0.7] }),
      S('vco1Wave', 'VCO 1 WAVE', ['TRI', 'SQ']), K('vco1Lvl', 'VCO 1 LEVEL', 0.8, LVL),
      K('fm', '1→2 FM AMT', 0, { r: [0, 0.6] }), S('sync', 'HARD SYNC', ['OFF', 'ON']),
      K('vco2Eg', 'VCO 2 EG AMT', 0.6, { bipolar: true }), K('vco2Freq', 'VCO 2 FREQ', 0.5, { bipolar: true, size: 'lg', r: [0.25, 0.75] }),
      S('vco2Wave', 'VCO 2 WAVE', ['TRI', 'SQ'], 1), K('vco2Lvl', 'VCO 2 LEVEL', 0.3),
      H('VCF / VCA'), K('noiseLvl', 'NOISE / EXT', 0.1, { r: [0, 0.5] }), K('cutoff', 'CUTOFF', 0.5, CUT),
      K('res', 'RESONANCE', 0.2, { r: [0, 0.7] }), S('vcfMode', 'VCF MODE', ['LP', 'HP']),
      K('vcfDecay', 'VCF DECAY', 0.4, DEC), K('vcfEg', 'VCF EG AMT', 0.7, { bipolar: true }), K('noiseMod', 'NOISE / VCF MOD', 0, { r: [0, 0.4] }),
      S('vcaEg', 'VCA EG', ['FAST', 'SLOW']), K('vcaDecay', 'VCA DECAY', 0.45, DEC), K('vol', 'VOLUME', 0.7, VOL),
      K('tempo', 'TEMPO', 0.56, { keep: true, format: (v) => `${Math.round(10 * Math.pow(1000, v))}` }),
      H('SEQUENCER · PITCH'),
      ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => K(`pitch${n}`, `${n}`, 0.5, { bipolar: true, seq: true, size: 'sm', r: [0.42, 0.58] })),
      H('SEQUENCER · VELOCITY'),
      ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => K(`vel${n}`, `${n}`, [1, 0.3, 0.6, 0.3, 1, 0.3, 0.6, 0.8][n - 1], { seq: true, size: 'sm' })),
    ],
    jacks: [
      i('trig', 'TRIGGER'), i('vcaCv', 'VCA CV'), o('vca', 'VCA'),
      i('vel', 'VELOCITY'), i('vcaDecay', 'VCA DECAY'), o('vcaEg', 'VCA EG'),
      i('ext', 'EXT AUDIO'), i('vcfDecay', 'VCF DECAY'), o('vcfEg', 'VCF EG'),
      i('noiseLvl', 'NOISE LEVEL'), i('vcoDecay', 'VCO DECAY'), o('vcoEg', 'VCO EG'),
      i('vcfMod', 'VCF MOD'), i('vco1Cv', 'VCO 1 CV'), o('vco1', 'VCO 1'),
      i('fmAmt', '1→2 FM AMT'), i('vco2Cv', 'VCO 2 CV'), o('vco2', 'VCO 2'),
      i('tempo', 'TEMPO'), i('run', 'RUN/STOP', NR), o('trigOut', 'TRIGGER'),
      i('adv', 'ADV/CLOCK', NR), o('velOut', 'VELOCITY'), o('pitch', 'PITCH'),
    ],
    lit: ([s]) => [`pitch${s + 1}`, `vel${s + 1}`],
  },

  S: {
    name: 'PULSO S', sub: 'sub-harmónico polirrítmico · arquitetura do Subharmonicon', hasRun: true,
    controls: [
      H('VCO 1'), K('vco1Freq', 'VCO 1 FREQ', 0.4, { size: 'lg', r: [0.25, 0.6] }), K('sub1Div', 'SUB 1 FREQ', 2 / 15, { format: int16 }),
      K('sub2Div', 'SUB 2 FREQ', 3 / 15, { format: int16 }), S('vco1Wave', 'VCO 1 WAVE', ['SAW', 'SQ']),
      K('vco1Lvl', 'VCO 1 LEVEL', 0.7, LVL), K('sub1Lvl', 'SUB 1 LEVEL', 0.5), K('sub2Lvl', 'SUB 2 LEVEL', 0.3),
      H('VCO 2'), K('vco2Freq', 'VCO 2 FREQ', 0.5, { size: 'lg', r: [0.3, 0.7] }), K('sub3Div', 'SUB 1 FREQ', 1 / 15, { format: int16 }),
      K('sub4Div', 'SUB 2 FREQ', 4 / 15, { format: int16 }), S('vco2Wave', 'VCO 2 WAVE', ['SAW', 'SQ'], 1),
      K('vco2Lvl', 'VCO 2 LEVEL', 0.5), K('sub3Lvl', 'SUB 1 LEVEL', 0.3), K('sub4Lvl', 'SUB 2 LEVEL', 0.2),
      H('VCF / VCA'), K('cutoff', 'CUTOFF', 0.45, CUT), K('res', 'RESONANCE', 0.3, { r: [0, 0.7] }), K('vcfEg', 'VCF EG AMT', 0.7, { bipolar: true }),
      K('vcfAttack', 'VCF ATTACK', 0.1, { r: [0, 0.4] }), K('vcfDecay', 'VCF DECAY', 0.45, DEC),
      K('vcaAttack', 'VCA ATTACK', 0.1, { r: [0, 0.4] }), K('vcaDecay', 'VCA DECAY', 0.5, DEC), K('vol', 'VOLUME', 0.6, VOL),
      H('SEQUENCER 1'),
      ...[1, 2, 3, 4].map((n) => K(`a${n}`, `STEP ${n}`, [0.5, 0.62, 0.56, 0.7][n - 1], { bipolar: true, seq: true, r: [0.3, 0.7] })),
      T('s1Osc', 'OSC 1', 1, { seq: true }), T('s1Sub1', 'SUB 1', 0, { seq: true }), T('s1Sub2', 'SUB 2', 0, { seq: true }),
      H('SEQUENCER 2'),
      ...[1, 2, 3, 4].map((n) => K(`b${n}`, `STEP ${n}`, [0.5, 0.44, 0.6, 0.5][n - 1], { bipolar: true, seq: true, r: [0.3, 0.7] })),
      T('s2Osc', 'OSC 2', 1, { seq: true }), T('s2Sub1', 'SUB 1', 0, { seq: true }), T('s2Sub2', 'SUB 2', 0, { seq: true }),
      H('POLYRHYTHM'),
      K('tempo', 'TEMPO', 0.4, { keep: true, format: (v) => `${Math.round(20 * Math.pow(150, v))}` }),
      ...[1, 2, 3, 4].flatMap((n) => [
        K(`rhythm${n}`, `RHYTHM ${n}`, [3, 2, 5, 7][n - 1] / 15, { format: int16, seq: true, size: 'sm' }),
        T(`r${n}s1`, 'SEQ 1', n === 1 ? 1 : 0, { seq: true }), T(`r${n}s2`, 'SEQ 2', n === 2 ? 1 : 0, { seq: true }),
      ]),
      S('seqOct', 'SEQ OCT', ['±5', '±2', '±1'], 2, { keep: true }), S('quant', 'QUANTIZE', ['OFF', '12-ET'], 1, { keep: true }),
    ],
    jacks: [
      i('vco1', 'VCO 1'), i('vco1Sub', 'VCO 1 SUB'), i('vco1Pwm', 'VCO 1 PWM'), i('vca', 'VCA'),
      o('vco1', 'VCO 1'), o('sub1', 'VCO 1 SUB 1'), o('sub2', 'VCO 1 SUB 2'), o('vcaOut', 'VCA'),
      i('vco2', 'VCO 2'), i('vco2Sub', 'VCO 2 SUB'), i('vco2Pwm', 'VCO 2 PWM'), i('cutoff', 'CUTOFF'),
      o('vco2', 'VCO 2'), o('sub3', 'VCO 2 SUB 1'), o('sub4', 'VCO 2 SUB 2'), o('vcaEg', 'VCA EG'),
      i('play', 'PLAY', NR), i('reset', 'RESET', NR), i('trigger', 'TRIGGER'), o('vcfEg', 'VCF EG'),
      i('rhythm1', 'RHYTHM 1'), i('rhythm2', 'RHYTHM 2'), i('rhythm3', 'RHYTHM 3'), i('rhythm4', 'RHYTHM 4'),
      i('clock', 'CLOCK', NR), o('clockOut', 'CLOCK'), o('trigOut', 'TRIGGER'),
      o('seq1', 'SEQ 1'), o('seq1Clk', 'SEQ 1 CLK'), o('seq2', 'SEQ 2'), o('seq2Clk', 'SEQ 2 CLK'),
    ],
    lit: ([a, b]) => [`a${a + 1}`, `b${b + 1}`],
  },

  L: {
    name: 'PULSO L', sub: 'generativo com wavefolder · arquitetura do Labyrinth', hasRun: true, custom: 'lbits',
    controls: [
      H('VCO'), K('vcoFreq', 'VCO FREQ', 0.45, { size: 'lg', r: [0.3, 0.65] }), K('vcoEg', 'VCO EG AMT', 0.5, { bipolar: true, r: [0.4, 0.7] }),
      K('modFreq', 'MOD VCO FREQ', 0.55), K('fm', 'VCO MOD AMT', 0.2, { r: [0, 0.6] }),
      K('vcoLvl', 'VCO LEVEL', 0.8, LVL), K('modLvl', 'MOD VCO LEVEL', 0, { r: [0, 0.4] }), K('noiseLvl', 'NOISE', 0, { r: [0, 0.3] }),
      H('FOLD / VCF'), K('fold', 'FOLD', 0.3), K('foldEg', 'FOLD EG AMT', 0.3), K('cutoff', 'CUTOFF', 0.5, CUT),
      K('res', 'RESONANCE', 0.4, { r: [0, 0.8] }), K('vcfEg', 'VCF EG AMT', 0.7, { bipolar: true }),
      K('filtMode', 'LP ↔ BP', 0), K('blend', 'BLEND', 0.7, { r: [0.3, 1] }),
      H('EG / SEQ'), K('eg1Decay', 'EG 1 DECAY', 0.45, DEC), K('eg2Decay', 'EG 2 DECAY', 0.35, DEC),
      K('tempo', 'TEMPO', 0.602, { keep: true, format: (v) => `${Math.round(30 * Math.pow(10, v))}` }),
      K('seq1Range', 'SEQ 1 CV RANGE', 0.5, { seq: true }), K('seq1Corrupt', 'SEQ 1 CORRUPT', 0.2, { seq: true, r: [0, 0.6] }),
      K('seq1Len', 'SEQ 1 LENGTH', 1, { seq: true, format: (v) => `${1 + Math.round(7 * v)}` }),
      K('seq2Range', 'SEQ 2 CV RANGE', 0.4, { seq: true }), K('seq2Corrupt', 'SEQ 2 CORRUPT', 0.2, { seq: true, r: [0, 0.6] }),
      K('seq2Len', 'SEQ 2 LENGTH', 5 / 7, { seq: true, format: (v) => `${1 + Math.round(7 * v)}` }),
      S('quant', 'QUANTIZE', ['OFF', 'CHROM', 'PENTA'], 2, { keep: true }), K('vol', 'VOLUME', 0.6, VOL),
    ],
    jacks: [
      i('vcoCv', 'VCO CV'), i('modCv', 'MOD VCO CV'), i('fmAmt', 'VCO MOD AMT'), i('fold', 'FOLD'),
      i('cutoff', 'CUTOFF'), i('vcaCv', 'VCA CV'), i('audio', 'AUDIO IN'), i('tempo', 'TEMPO'),
      i('trig1', 'EG 1 TRIG'), i('trig2', 'EG 2 TRIG'), i('decay1', 'EG 1 DECAY'), i('decay2', 'EG 2 DECAY'),
      i('corrupt1', 'CORRUPT 1'), i('corrupt2', 'CORRUPT 2'), i('clock', 'CLOCK', NR), i('reset', 'RESET', NR),
      i('run', 'RUN/STOP', NR), o('vco', 'VCO'), o('mod', 'MOD VCO'), o('noise', 'NOISE'),
      o('foldOut', 'FOLD'), o('vcf', 'VCF'), o('vca', 'VCA'), o('eg1', 'EG 1'),
      o('eg2', 'EG 2'), o('seq1', 'SEQ 1'), o('seq2', 'SEQ 2'), o('clockOut', 'CLOCK'),
      o('trig1Out', 'EG 1 TRIG'), o('trig2Out', 'EG 2 TRIG'),
    ],
    lit: () => [],
  },

  X: {
    name: 'PULSO X', sub: 'banco de filtros e vocoder · arquitetura do Spectravox', hasRun: false,
    controls: [
      H('CARRIER'), K('vcoFreq', 'VCO FREQ', 0.45, { size: 'lg', r: [0.25, 0.65] }), S('vcoWave', 'VCO WAVE', ['SAW', 'PULSE']),
      K('pw', 'PULSE WIDTH', 0.5), K('noiseMix', 'VCO ↔ NOISE', 0, { r: [0, 0.5] }), K('progLvl', 'PROGRAM LEVEL', 0.5, { keep: true }),
      S('mode', 'MODE', ['VOCODER', 'FILTER BANK'], 1, { keep: true }), S('vcaMode', 'VCA', ['ON', 'CV'], 0, { keep: true }),
      H('SPECTRAL'), K('shift', 'SPECTRAL SHIFT', 0.5, { bipolar: true, size: 'lg' }), K('lfoRate', 'LFO RATE', 0.3),
      K('lfoAmt', 'LFO AMOUNT', 0.4), K('res', 'RESONANCE', 0.5), K('vol', 'VOLUME', 0.4, VOL),
      H('BANDS'),
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => K(`b${n}`, `${n}`, 0.8, { size: 'sm' })),
    ],
    jacks: [
      i('program', 'PROGRAM IN'), i('carrier', 'CARRIER IN'), i('voct', 'VCO 1V/OCT'), i('shiftCv', 'SHIFT CV'),
      i('lfoRate', 'LFO RATE'), i('vcaCv', 'VCA CV'), o('out', 'OUT'), o('vco', 'VCO'), o('noise', 'NOISE'), o('lfo', 'LFO'), o('env', 'ENV'),
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => i(`band${n}`, `BAND ${n} CV`)),
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => o(`env${n}`, `BAND ${n} ENV`)),
    ],
    lit: () => [],
  },
};

export const FX_CONTROLS = [
  K('delayTime', 'DELAY TIME', 0.35, { format: (v) => `${Math.round((0.03 + v * 0.97) * 1000)}ms` }),
  K('delayFb', 'FEEDBACK', 0.4), K('delayMix', 'DELAY', 0.5), K('reverb', 'REVERB', 0.45), K('vol', 'MASTER', 0.8, { size: 'lg' }),
];

// Layout "original": controlos por linhas, pela ordem do painel do hardware, e colunas do patch bay
const n8 = (p) => [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `${p}${n}`);
const LAYOUT = {
  M: { cols: 4, rows: [
    ['freq', 'pw', 'wave', 'mix', 'cutoff', 'res', 'vcfMode', 'vcaMode', 'vol'],
    ['glide', 'vcoModSrc', 'vcoModAmt', 'vcoModDest', 'vcfModSrc', 'vcfModAmt', 'vcfModPol'],
    ['tempo', 'gateLen', 'lfoRate', 'lfoWave', 'attack', 'sustain', 'decay', 'vcMix'],
  ] },
  D: { cols: 3, rows: [
    ['vcoDecay', 'seqPitch', 'vco1Eg', 'vco1Freq', 'vco1Wave', 'vco1Lvl', 'noiseLvl', 'cutoff', 'res', 'vcfMode', 'vcaEg', 'vol'],
    ['fm', 'sync', 'vco2Eg', 'vco2Freq', 'vco2Wave', 'vco2Lvl', 'vcfDecay', 'vcfEg', 'noiseMod', 'vcaDecay'],
    ['tempo', ...n8('pitch')],
    ['@custom', ...n8('vel')],
  ] },
  S: { cols: 4, rows: [
    ['a1', 'a2', 'a3', 'a4', 's1Osc', 's1Sub1', 's1Sub2', 'vco1Freq', 'sub1Div', 'sub2Div', 'vco1Wave', 'cutoff', 'res', 'vcfEg'],
    ['b1', 'b2', 'b3', 'b4', 's2Osc', 's2Sub1', 's2Sub2', 'vco2Freq', 'sub3Div', 'sub4Div', 'vco2Wave', 'vcfAttack', 'vcfDecay', 'vcaAttack', 'vcaDecay'],
    ['tempo', 'rhythm1', 'r1s1', 'r1s2', 'rhythm2', 'r2s1', 'r2s2', 'rhythm3', 'r3s1', 'r3s2', 'rhythm4', 'r4s1', 'r4s2', 'seqOct', 'quant'],
    ['vco1Lvl', 'sub1Lvl', 'sub2Lvl', 'vco2Lvl', 'sub3Lvl', 'sub4Lvl', 'vol'],
  ] },
  L: { cols: 5, rows: [
    ['vcoFreq', 'vcoEg', 'modFreq', 'fm', 'vcoLvl', 'modLvl', 'noiseLvl', 'vol'],
    ['fold', 'foldEg', 'cutoff', 'res', 'vcfEg', 'filtMode', 'blend', 'eg1Decay', 'eg2Decay'],
    ['tempo', 'seq1Range', 'seq1Corrupt', 'seq1Len', 'seq2Range', 'seq2Corrupt', 'seq2Len', 'quant'],
  ] },
  X: { cols: 5, rows: [
    ['vcoFreq', 'vcoWave', 'pw', 'noiseMix', 'progLvl', 'mode', 'vcaMode', 'shift', 'lfoRate', 'lfoAmt', 'res', 'vol'],
    ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'b10'],
  ] },
};

for (const [key, t] of Object.entries(TYPES)) {
  Object.assign(t, LAYOUT[key]);
  t.params = t.controls.filter((c) => c.id);
  t.defaults = Object.fromEntries(t.params.map((c) => [c.id, c.def]));
  t.smooth = t.params.filter((c) => c.type === 'knob' && !c.seq).map((c) => c.id);
  t.ins = t.jacks.filter((j) => !j.out).map((j) => j.id);
  t.outs = t.jacks.filter((j) => j.out).map((j) => j.id);
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const noteName = (n) => `${NOTE_NAMES[((n % 12) + 12) % 12]}${Math.floor(n / 12) + 2}`;

function mSeq(notes) {
  const steps = Array.from({ length: 32 }, () => ({ n: 0, r: true }));
  notes.forEach((n, k) => { steps[k] = n === null ? { n: 0, r: true } : { n, r: false }; });
  return steps;
}

export function newModule(type, id) {
  const t = TYPES[type];
  return { id, type, p: { ...t.defaults, run: 0 }, data: t.data ? t.data() : {}, min: false, mix: { level: 0.8, pan: 0.5, send: 0.25 } };
}
const mod = (type, id, p = {}) => { const m = newModule(type, id); Object.assign(m.p, p); return m; };
const FX = Object.fromEntries(FX_CONTROLS.map((c) => [c.id, c.def]));

// Memórias: racks completos
export const PRESETS = [
  { name: 'Início', make: () => ({ mods: [mod('M', 'm1'), mod('D', 'd1')], cables: [], fx: { ...FX } }) },
  {
    name: 'Dupla em sincronia',
    make: () => ({
      mods: [
        mod('M', 'm1', { cutoff: 0.35, res: 0.55, vcfModAmt: 0.5, decay: 0.42 }),
        mod('D', 'd1', { pitch3: 0.56, pitch7: 0.56, pitch8: 0.6 }),
      ],
      // o relógio de passos da unidade melódica avança a percussão
      cables: [['m1', 'assign', 'd1', 'adv']],
      fx: { ...FX },
    }),
  },
  {
    name: 'Cinco máquinas',
    make: () => ({
      mods: [
        mod('M', 'm1', { cutoff: 0.35, res: 0.5, vol: 0.5 }),
        mod('D', 'd1', { vol: 0.6 }),
        mod('S', 's1', { vol: 0.45 }),
        mod('L', 'l1', { vol: 0.4 }),
        mod('X', 'x1', { vol: 0.35, mode: 0, progLvl: 0.7 }),
      ],
      cables: [
        ['m1', 'assign', 'd1', 'adv'],   // M dá o relógio à percussão...
        ['m1', 'assign', 's1', 'clock'], // ...ao sub-harmónico...
        ['m1', 'assign', 'l1', 'clock'], // ...e ao generativo
        ['d1', 'vca', 'x1', 'program'],  // a percussão modula o vocoder
        ['s1', 'vcaOut', 'x1', 'carrier'], // com os sub-harmónicos como portadora
        ['l1', 'seq2', 'm1', 'cutoff'],
      ],
      fx: { ...FX },
    }),
  },
];

const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);

// Valores aleatórios para os controlos de um módulo: `seq` escolhe a sequência ou o som
export function randomParams(type, seq) {
  const out = {};
  for (const c of TYPES[type].params) {
    if (!!c.seq !== seq || c.keep) continue;
    if (c.type === 'knob') {
      const [a, b] = c.r || [0, 1];
      out[c.id] = rnd(a, b);
      if (type === 'D' && c.id.startsWith('pitch')) out[c.id] = 0.5 + Math.round(rnd(-7, 7)) / 120;
      if (type === 'D' && c.id.startsWith('vel')) out[c.id] = c.id === 'vel1' || Math.random() > 0.25 ? rnd(0.3, 1) : rnd(0, 0.1);
    } else if (c.type === 'switch') out[c.id] = Math.floor(Math.random() * c.options.length);
    else out[c.id] = Math.random() < 0.4 ? 1 : 0;
  }
  if (type === 'S' && seq) {
    // garante que cada sequenciador tem pelo menos um ritmo e um destino
    out[`r${1 + Math.floor(Math.random() * 4)}s1`] = 1;
    out[`r${1 + Math.floor(Math.random() * 4)}s2`] = 1;
    out.s1Osc = 1; out.s2Osc = 1;
  }
  return out;
}

export function randomMSeq(len) {
  const scale = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];
  const steps = Array.from({ length: 32 }, () => ({ n: 0, r: true }));
  for (let k = 0; k < len; k++) {
    const rest = k !== 0 && Math.random() < 0.2;
    steps[k] = { n: k === 0 ? 0 : scale[Math.floor(Math.pow(Math.random(), 1.6) * scale.length)], r: rest };
  }
  return steps;
}

// Patch aleatório: alguns cabos entre saídas e entradas de todos os módulos
export function randomCables(mods) {
  const outs = [], ins = [];
  for (const m of mods) {
    for (const j of TYPES[m.type].jacks) (j.out ? outs : j.noRand ? [] : ins).push([m.id, j.id]);
  }
  if (!outs.length || !ins.length) return [];
  const n = Math.min(ins.length, 3 + Math.floor(Math.random() * 3) + mods.length);
  const cables = [], used = new Set();
  while (cables.length < n) {
    const a = outs[Math.floor(Math.random() * outs.length)], b = ins[Math.floor(Math.random() * ins.length)];
    const key = b.join(':');
    if (used.has(key)) continue;
    used.add(key);
    cables.push([...a, ...b]);
  }
  return cables;
}
