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

// Matriz do Pulso V: linhas são fontes, colunas são destinos. Cada pino vale 1 (cheio) ou 0,3 (atenuado).
export const V_ROWS = ['OSC 1 SINE', 'OSC 1 SAW', 'OSC 2 PULSE', 'OSC 2 TRI', 'OSC 3 PULSE', 'OSC 3 TRI', 'NOISE', 'INPUT 1',
  'INPUT 2', 'FILTER', 'TRAPEZOID', 'ENV SIGNAL', 'RING', 'REVERB', 'JOY X', 'JOY Y'];
export const V_COLS = ['OUT 1', 'OUT 2', 'RING A', 'RING B', 'REVERB', 'ENV IN', 'FILTER IN', 'OSC 1 FREQ',
  'OSC 2 FREQ', 'OSC 3 FREQ', 'FILTER FREQ', 'FILTER Q', 'ENV DECAY', 'OUT LEVEL', 'OSC 2 SHAPE', 'MATRIX OUT'];
// som de partida: pulso do OSC 2 no filtro, filtro no envelope, envelope nas saídas e no reverb; OSC 3 lento e trapézio no filtro
const V_DEFAULT_PINS = { '2,6': 1, '9,5': 1, '11,0': 1, '11,1': 1, '11,4': 0.3, '13,0': 0.3, '13,1': 0.3, '5,10': 0.3, '10,10': 1, '5,8': 0.3 };

export const TYPES = {
  M: {
    name: 'PULSO M', sub: 'melódico · arquitetura do Mother-32', hasRun: true, custom: 'mseq', customWide: true,
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
      K('tempo', 'TEMPO', 0.56, { size: 'lg', keep: true, format: (v) => `${Math.round(10 * Math.pow(1000, v))}` }),
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
      ...[1, 2, 3, 4].map((n) => K(`a${n}`, `STEP ${n}`, [0.5, 0.62, 0.56, 0.7][n - 1], { bipolar: true, seq: true, size: 'sm', r: [0.3, 0.7] })),
      T('s1Osc', 'OSC 1', 1, { seq: true }), T('s1Sub1', 'SUB 1', 0, { seq: true }), T('s1Sub2', 'SUB 2', 0, { seq: true }),
      H('SEQUENCER 2'),
      ...[1, 2, 3, 4].map((n) => K(`b${n}`, `STEP ${n}`, [0.5, 0.44, 0.6, 0.5][n - 1], { bipolar: true, seq: true, size: 'sm', r: [0.3, 0.7] })),
      T('s2Osc', 'OSC 2', 1, { seq: true }), T('s2Sub1', 'SUB 1', 0, { seq: true }), T('s2Sub2', 'SUB 2', 0, { seq: true }),
      H('POLYRHYTHM'),
      K('tempo', 'TEMPO', 0.4, { size: 'lg', keep: true, format: (v) => `${Math.round(20 * Math.pow(150, v))}` }),
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

  N: {
    name: 'PULSO N', sub: 'dois osciladores e ladder · arquitetura do Sirin', hasRun: true, custom: 'mseq', customWide: true,
    controls: [
      H('OSCILLATORS'), S('osc1Oct', 'OSC 1 OCT', ["16'", "8'", "4'"], 1), K('osc1Wave', 'OSC 1 WAVE', 0),
      S('osc2Oct', 'OSC 2 OCT', ["16'", "8'", "4'"], 1), K('osc2Freq', 'OSC 2 FREQ', 0.5, { bipolar: true, r: [0.4, 0.6] }),
      K('osc2Wave', 'OSC 2 WAVE', 0.5), S('sync', 'SYNC', ['OFF', 'ON']), K('glide', 'GLIDE', 0, { r: [0, 0.4] }),
      H('MIXER'), K('osc1Lvl', 'OSC 1', 0.8, LVL), K('osc2Lvl', 'OSC 2', 0.6), K('noiseLvl', 'NOISE', 0, { r: [0, 0.3] }),
      H('FILTER'), K('cutoff', 'CUTOFF', 0.4, CUT), K('res', 'RESONANCE', 0.35, { r: [0, 0.8] }),
      K('egAmt', 'EG AMOUNT', 0.75, { bipolar: true, r: [0.5, 1] }), K('kbAmt', 'KB AMOUNT', 0.5),
      H('FILTER EG'), K('fA', 'VCF ATTACK', 0, { r: [0, 0.4] }), K('fD', 'VCF DECAY', 0.4, DEC), K('fS', 'VCF SUSTAIN', 0.2), K('fR', 'VCF RELEASE', 0.3, { r: [0, 0.6] }),
      H('AMP EG'), K('aA', 'VCA ATTACK', 0, { r: [0, 0.3] }), K('aD', 'VCA DECAY', 0.45, DEC), K('aS', 'VCA SUSTAIN', 0.6), K('aR', 'VCA RELEASE', 0.3, { r: [0, 0.6] }),
      H('LFO / SEQ'), K('lfoRate', 'LFO RATE', 0.45), S('lfoWave', 'LFO WAVE', ['TRI', 'SQ', 'SAW', 'S&H']),
      K('lfoPitch', 'LFO → PITCH', 0, { r: [0, 0.2] }), K('lfoCut', 'LFO → CUTOFF', 0, { r: [0, 0.5] }),
      K('tempo', 'TEMPO', 0.602, { keep: true, format: (v) => `${Math.round(30 * Math.pow(10, v))}` }),
      K('gateLen', 'GATE LENGTH', 0.5), K('vol', 'VOLUME', 0.7, VOL),
    ],
    jacks: [
      i('voct', '1V/OCT'), i('gate', 'GATE'), i('cutoff', 'CUTOFF'),
      i('vcaCv', 'VCA CV'), i('ext', 'EXT AUDIO'), i('lfoRate', 'LFO RATE'),
      i('clock', 'CLOCK', NR), i('run', 'RUN/STOP', NR), i('reset', 'RESET', NR),
      o('vco1', 'OSC 1'), o('vco2', 'OSC 2'), o('vcf', 'VCF'),
      o('fEg', 'FILTER EG'), o('aEg', 'AMP EG'), o('lfo', 'LFO'),
      o('kb', 'KB'), o('gateOut', 'GATE'), o('clockOut', 'CLOCK'), o('vca', 'OUT'),
    ],
    data: () => ({ steps: mSeq([0, 0, 12, 0, 7, 0, 3, 5, 0, 0, 12, 10, 7, 0, 3, null]), len: 16 }),
    lit: () => [],
  },

  A: {
    name: 'PULSO A', sub: 'semi-modular de três osciladores · arquitetura do ARP 2600', hasRun: true, custom: 'mseq', customWide: true,
    controls: [
      H('VCO 1'), K('v1Coarse', 'VCO 1 COARSE', 0.5, { bipolar: true, r: [0.4, 0.6] }), K('v1Fine', 'FINE', 0.5, { bipolar: true, r: [0.45, 0.55] }),
      K('v1Fm1', 'FM · VCO 2 SINE', 0, { r: [0, 0.3] }), K('v1Fm2', 'FM · S/H', 0, { r: [0, 0.3] }),
      H('VCO 2'), K('v2Coarse', 'VCO 2 COARSE', 0.5, { bipolar: true, r: [0.4, 0.65] }), K('v2Fine', 'FINE', 0.52, { bipolar: true, r: [0.45, 0.55] }),
      K('v2Fm', 'FM · VCO 3 TRI', 0, { r: [0, 0.3] }), K('v2Adsr', 'FM · ADSR', 0, { r: [0, 0.3] }),
      K('v2Pw', 'PULSE WIDTH', 0.5), K('v2Pwm', 'PWM · VCO 3', 0, { r: [0, 0.6] }), S('sync', 'SYNC 2→1', ['OFF', 'ON']),
      H('VCO 3'), K('v3Coarse', 'VCO 3 COARSE', 0.4, { bipolar: true }), K('v3Fine', 'FINE', 0.5, { bipolar: true }),
      K('v3Fm', 'FM · NOISE', 0, { r: [0, 0.3] }), S('v3Low', 'RANGE', ['AUDIO', 'LOW']), S('v3Kb', 'KYBD', ['ON', 'OFF']),
      H('NOISE / S&H / LAG'), K('noiseColor', 'NOISE COLOR', 0), K('shRate', 'S/H CLOCK', 0.5), K('porta', 'PORTAMENTO', 0, { r: [0, 0.4] }),
      H('VCF'), K('fRing', 'RING', 0, { r: [0, 0.5] }), K('fV1', 'VCO 1 SQ', 0.6), K('fV2', 'VCO 2 SAW', 0.5), K('fV3', 'VCO 3 TRI', 0, { r: [0, 0.4] }),
      K('fNoise', 'NOISE', 0, { r: [0, 0.3] }), K('cutoff', 'CUTOFF', 0.4, CUT), K('fine', 'FINE', 0.5, { bipolar: true }),
      K('res', 'RESONANCE', 0.3, { r: [0, 0.85] }), K('fAdsr', 'FM ADSR', 0.5), K('fSine', 'FM SINE', 0, { r: [0, 0.4] }), K('fKb', 'FM KYBD', 0.5),
      H('ADSR / AR'), K('attack', 'ATTACK', 0.02, { r: [0, 0.4] }), K('decay', 'DECAY', 0.4, DEC), K('sustain', 'SUSTAIN', 0.3), K('release', 'RELEASE', 0.3, { r: [0, 0.6] }),
      K('arA', 'AR ATTACK', 0.02, { r: [0, 0.3] }), K('arR', 'AR RELEASE', 0.35, { r: [0.1, 0.6] }),
      H('VCA / MIX'), K('vcaInit', 'INITIAL GAIN', 0, { keep: true }), K('vcaAr', 'AR', 1, { r: [0.6, 1] }), K('vcaRing', 'RING', 0, { r: [0, 0.4] }),
      K('reverb', 'REVERB', 0.2, { r: [0, 0.6] }), K('vol', 'VOLUME', 0.7, VOL),
      K('tempo', 'TEMPO', 0.602, { keep: true, format: (v) => `${Math.round(30 * Math.pow(10, v))}` }), K('gateLen', 'GATE LENGTH', 0.5),
    ],
    jacks: [
      i('kbCv', 'KYBD CV'), i('gate', 'GATE'), i('trig', 'TRIG'), i('v1Fm', 'VCO 1 FM'), i('v2Fm', 'VCO 2 FM'), i('v3Fm', 'VCO 3 FM'),
      i('v2Pwm', 'VCO 2 PWM'), i('ringA', 'RING A'), i('ringB', 'RING B'), i('vcfIn', 'VCF IN'), i('vcfFm', 'VCF FM'), i('vcaIn', 'VCA IN'),
      i('vcaCv', 'VCA CV'), i('shIn', 'S/H IN'), i('shClk', 'S/H CLOCK', NR), i('lagIn', 'LAG IN'), i('clock', 'CLOCK', NR), i('reset', 'RESET', NR), i('run', 'RUN/STOP', NR),
      o('v1Saw', 'VCO 1 SAW'), o('v1Sq', 'VCO 1 SQ'), o('v2Sine', 'VCO 2 SINE'), o('v2Tri', 'VCO 2 TRI'), o('v2Saw', 'VCO 2 SAW'), o('v2Pulse', 'VCO 2 PULSE'),
      o('v3Tri', 'VCO 3 TRI'), o('v3Saw', 'VCO 3 SAW'), o('v3Pulse', 'VCO 3 PULSE'), o('noise', 'NOISE'), o('ring', 'RING'), o('sh', 'S/H'),
      o('vcf', 'VCF'), o('vca', 'VCA'), o('adsr', 'ADSR'), o('ar', 'AR'), o('lag', 'LAG'), o('kb', 'KYBD'),
      o('gateOut', 'GATE'), o('clockOut', 'CLOCK'), o('out', 'OUT'),
    ],
    data: () => ({ steps: mSeq([0, null, 0, 12, null, 7, 10, null, 0, 3, null, 0, 15, 12, 7, null]), len: 16 }),
    lit: () => [],
  },

  U: {
    name: 'PULSO U', sub: 'utilitários · atenuadores, VCAs, lógica, divisor e slew', hasRun: false,
    controls: [
      H('ATENUVERSORES / MIX'), ...[1, 2, 3, 4].map((n) => K(`att${n}`, `ATT ${n}`, 0.75, { bipolar: true })),
      H('VCA'), K('vca1', 'VCA 1 GAIN', 0), K('vca2', 'VCA 2 GAIN', 0),
      H('DIVISOR / SLEW'), K('div', 'DIV N', 2 / 15, { format: int16 }), K('rise', 'SLEW RISE', 0.3), K('fall', 'SLEW FALL', 0.3),
      K('vol', 'VCA → MIXER', 0.8, VOL),
    ],
    jacks: [
      i('in1', 'IN 1'), i('in2', 'IN 2'), i('in3', 'IN 3'), i('in4', 'IN 4'),
      o('out1', 'OUT 1'), o('out2', 'OUT 2'), o('out3', 'OUT 3'), o('out4', 'OUT 4'),
      i('vca1In', 'VCA 1 IN'), i('vca1Cv', 'VCA 1 CV'), o('vca1Out', 'VCA 1 OUT'), o('mix', 'MIX 1-4'),
      i('vca2In', 'VCA 2 IN'), i('vca2Cv', 'VCA 2 CV'), o('vca2Out', 'VCA 2 OUT'), o('slewOut', 'SLEW OUT'),
      i('logA', 'LOGIC A'), i('logB', 'LOGIC B'), o('and', 'AND'), o('or', 'OR'), o('xor', 'XOR'),
      i('clk', 'DIV CLOCK'), i('reset', 'DIV RESET', NR), o('div2', '÷2'), o('div4', '÷4'), o('divN', '÷N'),
      i('slewIn', 'SLEW IN'),
    ],
    lit: () => [],
  },

  T: {
    name: 'PULSO T', sub: 'sequenciador aleatório com memória e ritmo euclidiano', hasRun: true, custom: 'tbits', customWide: true,
    controls: [
      H('REGISTO'), K('change', 'CHANGE', 0.25, { size: 'lg', seq: true, r: [0, 0.6] }),
      K('len', 'LENGTH', 6 / 14, { seq: true, format: (v) => `${2 + Math.round(14 * v)}` }),
      K('range', 'RANGE', 0.3, { seq: true, format: (v) => `${Math.round(v * 48)} st` }),
      S('scale', 'SCALE', ['OFF', 'CHROM', 'MAJ', 'MIN', 'PENTA'], 4, { keep: true }), S('oct', 'OCTAVE', ['−1', '0', '+1', '+2'], 1),
      H('EUCLIDIANO'), K('eSteps', 'STEPS', 15 / 15, { seq: true, format: int16 }), K('eHits', 'HITS', 5 / 16, { seq: true, format: (v) => `${Math.round(16 * v)}` }),
      K('eRot', 'ROTATE', 0, { seq: true, format: (v) => `${Math.round(15 * v)}` }),
      H('TEMPO'), K('tempo', 'TEMPO', 0.602, { keep: true, format: (v) => `${Math.round(30 * Math.pow(10, v))}` }), K('gateLen', 'GATE LENGTH', 0.5),
    ],
    jacks: [
      i('clock', 'CLOCK', NR), i('reset', 'RESET', NR), i('run', 'RUN/STOP', NR), i('changeCv', 'CHANGE CV'), i('rangeCv', 'RANGE CV'), i('transpose', 'TRANSPOSE'),
      o('cv', 'CV (1V/OCT)'), o('raw', 'RANDOM'), o('gate', 'GATE'), o('bit2', 'BIT 2'), o('bit4', 'BIT 4'),
      o('euclid', 'EUCLID'), o('clockOut', 'CLOCK'),
    ],
    lit: () => [],
  },

  G: {
    name: 'PULSO G', sub: 'semi-modular com arpejador e mola · arquitetura do Grandmother', hasRun: true, custom: 'mseq', customWide: true,
    controls: [
      H('OSCILLATORS'), S('osc1Oct', 'OSC 1 OCT', ["32'", "16'", "8'", "4'"], 2), S('osc1Wave', 'OSC 1 WAVE', ['TRI', 'SAW', 'SQ', 'PULSE'], 1),
      S('osc2Oct', 'OSC 2 OCT', ["32'", "16'", "8'", "4'"], 1), S('osc2Wave', 'OSC 2 WAVE', ['TRI', 'SAW', 'SQ', 'PULSE'], 2),
      K('osc2Freq', 'OSC 2 FREQ', 0.5, { bipolar: true, r: [0.4, 0.6] }), S('sync', 'HARD SYNC', ['OFF', 'ON']), K('glide', 'GLIDE', 0, { r: [0, 0.4] }),
      H('MIXER'), K('osc1Lvl', 'OSC 1', 0.8, LVL), K('osc2Lvl', 'OSC 2', 0.6), K('noiseLvl', 'NOISE', 0, { r: [0, 0.3] }),
      H('FILTER'), K('hpCut', 'HP CUTOFF', 0, { r: [0, 0.4] }), K('cutoff', 'CUTOFF', 0.42, CUT), K('res', 'RESONANCE', 0.3, { r: [0, 0.8] }),
      K('egAmt', 'EG AMOUNT', 0.7, { bipolar: true, r: [0.5, 1] }), S('kbAmt', 'KB TRACK', ['OFF', '½', 'FULL'], 1),
      H('ENVELOPE'), K('attack', 'ATTACK', 0, { r: [0, 0.35] }), K('decay', 'DECAY', 0.4, DEC), K('sustain', 'SUSTAIN', 0.4), K('release', 'RELEASE', 0.3, { r: [0, 0.6] }),
      S('vcaMode', 'VCA', ['ENV', 'DRONE'], 0, { keep: true }),
      H('MODULATION'), K('lfoRate', 'RATE', 0.4), S('lfoWave', 'WAVE', ['TRI', 'SQ', 'SAW', 'RAMP', 'S&H']),
      K('modPitch', 'MOD → PITCH', 0, { r: [0, 0.2] }), K('modCut', 'MOD → CUTOFF', 0, { r: [0, 0.5] }), K('modPw', 'MOD → PW', 0, { r: [0, 0.6] }),
      H('ARP / SEQ / REVERB'), S('arp', 'ARP', ['OFF', 'UP', 'UP/DN', 'RAND']), S('arpOct', 'ARP OCT', ['1', '2', '3']),
      K('tempo', 'TEMPO', 0.602, { keep: true, format: (v) => `${Math.round(30 * Math.pow(10, v))}` }), K('gateLen', 'GATE LENGTH', 0.5),
      K('reverb', 'SPRING MIX', 0.2, { r: [0, 0.6] }), K('vol', 'VOLUME', 0.7, VOL),
    ],
    jacks: [
      i('voct', '1V/OCT'), i('osc2Cv', 'OSC 2 CV'), i('pwm', 'PW MOD'), i('gate', 'GATE'), i('cutoff', 'CUTOFF'), i('res', 'RES'),
      i('ext', 'EXT AUDIO'), i('vcaCv', 'VCA CV'), i('lfoRate', 'RATE'), i('reverbIn', 'SPRING IN'),
      i('clock', 'CLOCK', NR), i('run', 'RUN/STOP', NR), i('reset', 'RESET', NR),
      o('vco1', 'OSC 1'), o('vco2', 'OSC 2'), o('noise', 'NOISE'), o('vcf', 'VCF'), o('env', 'ENV'),
      o('lfoTri', 'MOD TRI'), o('lfoSq', 'MOD SQ'), o('sh', 'S&H'), o('kb', 'KB'), o('gateOut', 'GATE'), o('clockOut', 'CLOCK'),
      o('spring', 'SPRING OUT'), o('vca', 'OUT'),
    ],
    data: () => ({ steps: mSeq([0, 7, 12, 3, 0, 10, 7, 15]), len: 8 }),
    lit: () => [],
  },

  B: {
    name: 'PULSO B', sub: 'west coast · oscilador complexo e low pass gates, ao estilo do Easel', hasRun: true,
    controls: [
      H('PULSER / SEQUENCER'), K('period', 'PULSER RATE', 0.6, { size: 'lg', keep: true, format: (v) => `${Math.round(3 * Math.pow(400, v))}/min` }),
      ...[1, 2, 3, 4, 5].map((n) => K(`s${n}`, `${n}`, [0.5, 0.62, 0.42, 0.7, 0.55][n - 1], { bipolar: true, seq: true, size: 'sm', r: [0.3, 0.7] })),
      S('steps', 'STEPS', ['3', '4', '5'], 2, { seq: true }), S('quant', 'QUANTIZE', ['OFF', '12-ET'], 1, { keep: true }),
      H('ENVELOPE'), K('attack', 'ATTACK', 0.02, { r: [0, 0.4] }), K('hold', 'SUSTAIN', 0.1, { r: [0, 0.4] }), K('decay', 'DECAY', 0.4, DEC),
      S('envMode', 'MODE', ['TRANS', 'SELF']),
      H('MOD OSC'), K('modFreq', 'MOD FREQ', 0.55, { size: 'lg' }), S('modWave', 'MOD WAVE', ['SAW', 'SQ', 'TRI'], 2),
      S('modRange', 'RANGE', ['AUDIO', 'LOW']), K('index', 'FM INDEX', 0.2, { r: [0, 0.6] }), K('modSeq', 'SEQ → MOD', 0, { r: [0, 0.5] }),
      H('COMPLEX OSC'), K('pitch', 'PITCH', 0.5, { bipolar: true, size: 'lg', r: [0.35, 0.65] }), K('seqAmt', 'SEQ → PITCH', 0.5),
      K('timbre', 'TIMBRE', 0.25), K('timbreMod', 'MOD → TIMBRE', 0.2, { r: [0, 0.6] }), K('timbreEnv', 'ENV → TIMBRE', 0.4), K('sym', 'SYMMETRY', 0.5, { bipolar: true }),
      H('LOW PASS GATES'), K('lpg1', 'LPG 1 · MOD', 0, { r: [0, 0.6] }), S('lpg1Mode', 'LPG 1 MODE', ['VCA', 'COMBO', 'LP'], 1),
      K('lpg2', 'LPG 2 · COMPLEX', 0.85, LVL), S('lpg2Mode', 'LPG 2 MODE', ['VCA', 'COMBO', 'LP'], 1), K('vol', 'VOLUME', 0.7, VOL),
    ],
    jacks: [
      i('clock', 'PULSER TRIG', NR), i('run', 'RUN/STOP', NR), i('reset', 'SEQ RESET', NR), i('envTrig', 'ENV TRIG'),
      i('pitchCv', 'PITCH CV'), i('modCv', 'MOD CV'), i('timbreCv', 'TIMBRE CV'), i('indexCv', 'INDEX CV'),
      i('lpg1Cv', 'LPG 1 CV'), i('lpg2Cv', 'LPG 2 CV'), i('lpg1In', 'LPG 1 IN'), i('lpg2In', 'LPG 2 IN'),
      o('complex', 'COMPLEX'), o('mod', 'MOD OSC'), o('lpg1Out', 'LPG 1'), o('lpg2Out', 'LPG 2'),
      o('env', 'ENV'), o('pulse', 'PULSER'), o('seq', 'SEQ'), o('out', 'OUT'),
    ],
    lit: ([s]) => [`s${s + 1}`],
  },

  K: {
    name: 'PULSO K', sub: 'dois filtros agressivos e processador externo · arquitetura do MS-20', hasRun: true, custom: 'mseq', customWide: true,
    controls: [
      H('VCO 1'), S('v1Scale', 'SCALE', ["32'", "16'", "8'", "4'"], 2), S('v1Wave', 'WAVE', ['TRI', 'SAW', 'PULSE', 'NOISE'], 1), K('pw', 'PW', 0.5),
      H('VCO 2'), S('v2Scale', 'SCALE', ["32'", "16'", "8'", "4'"], 2), S('v2Wave', 'WAVE', ['SAW', 'SQ', 'NARROW', 'RING'], 0),
      K('v2Pitch', 'PITCH', 0.5, { bipolar: true, r: [0.4, 0.6] }), K('v1Lvl', 'VCO 1 LEVEL', 0.8, LVL), K('v2Lvl', 'VCO 2 LEVEL', 0.5),
      K('porta', 'PORTAMENTO', 0, { r: [0, 0.4] }), K('mgPitch', 'MG → FREQ', 0, { r: [0, 0.2] }), K('egPitch', 'EG 1 → FREQ', 0.5, { bipolar: true, r: [0.4, 0.6] }),
      H('HPF / LPF'), K('hpCut', 'HP CUTOFF', 0.15, { r: [0, 0.5] }), K('hpPeak', 'HP PEAK', 0.2, { r: [0, 0.8] }),
      K('hpMg', 'HP MG', 0, { r: [0, 0.4] }), K('hpEg', 'HP EG 2', 0.5, { bipolar: true }),
      K('lpCut', 'LP CUTOFF', 0.45, CUT), K('lpPeak', 'LP PEAK', 0.4, { r: [0, 0.9] }), K('lpMg', 'LP MG', 0, { r: [0, 0.4] }), K('lpEg', 'LP EG 2', 0.7, { bipolar: true }),
      H('EG 1 / EG 2 / MG'), K('e1Delay', 'EG 1 DELAY', 0, { r: [0, 0.3] }), K('e1Attack', 'EG 1 ATTACK', 0.1, { r: [0, 0.4] }), K('e1Release', 'EG 1 RELEASE', 0.3, { r: [0, 0.6] }),
      K('attack', 'EG 2 ATTACK', 0, { r: [0, 0.35] }), K('decay', 'EG 2 DECAY', 0.4, DEC), K('sustain', 'EG 2 SUSTAIN', 0.4), K('release', 'EG 2 RELEASE', 0.3, { r: [0, 0.6] }),
      K('mgRate', 'MG RATE', 0.4), K('mgShape', 'MG SHAPE', 0.5),
      H('ESP / SEQ'), K('espGain', 'ESP GAIN', 0.5), K('espLo', 'ESP LOW CUT', 0.2), K('espHi', 'ESP HIGH CUT', 0.7), K('espThr', 'ESP THRESHOLD', 0.3),
      K('tempo', 'TEMPO', 0.602, { keep: true, format: (v) => `${Math.round(30 * Math.pow(10, v))}` }), K('gateLen', 'GATE LENGTH', 0.5), K('vol', 'VOLUME', 0.6, VOL),
    ],
    jacks: [
      i('voct', 'TOTAL FREQ'), i('v2Cv', 'VCO 2 FREQ'), i('ext', 'EXT SIGNAL'), i('hpCv', 'HP CUTOFF'), i('lpCv', 'LP CUTOFF'), i('vcaCv', 'VCA CV'),
      i('gate', 'GATE'), i('trig', 'EG TRIG'), i('espIn', 'ESP IN'), i('shIn', 'S&H IN'), i('shClk', 'S&H CLOCK', NR),
      i('clock', 'CLOCK', NR), i('run', 'RUN/STOP', NR), i('reset', 'RESET', NR),
      o('vco1', 'VCO 1'), o('vco2', 'VCO 2'), o('hpOut', 'HPF'), o('lpOut', 'LPF'), o('mgTri', 'MG TRI'), o('mgSq', 'MG SQ'),
      o('eg1', 'EG 1'), o('eg2', 'EG 2'), o('white', 'WHITE'), o('pink', 'PINK'), o('sh', 'S&H'),
      o('espBp', 'ESP BPF'), o('espEnv', 'ESP ENV'), o('espCv', 'ESP F/V'), o('espGate', 'ESP GATE'),
      o('kb', 'KB'), o('gateOut', 'GATE'), o('clockOut', 'CLOCK'), o('vca', 'OUT'),
    ],
    data: () => ({ steps: mSeq([0, 0, 12, null, 0, 10, null, 7, 0, null, 12, 15, null, 0, 3, null]), len: 16 }),
    lit: () => [],
  },

  V: {
    name: 'PULSO V', sub: 'matriz de pinos · arquitetura do VCS3', hasRun: false, custom: 'vpins', customWide: true,
    controls: [
      H('OSC 1 / 2'), K('o1Freq', 'OSC 1 FREQ', 0.5, { size: 'lg', r: [0.3, 0.7] }), K('o1Shape', 'OSC 1 SHAPE', 0.5),
      K('o1Sine', 'SINE LEVEL', 0.8), K('o1Saw', 'SAW LEVEL', 0.5),
      K('o2Freq', 'OSC 2 FREQ', 0.55, { size: 'lg', r: [0.3, 0.7] }), K('o2Shape', 'OSC 2 SHAPE', 0.5), K('o2Pulse', 'PULSE LEVEL', 0.7), K('o2Tri', 'TRI LEVEL', 0.5),
      H('OSC 3 / RUÍDO'), K('o3Freq', 'OSC 3 FREQ', 0.25, { format: (v) => `${(0.05 * Math.pow(2, v * 14)).toFixed(2)}Hz` }), K('o3Shape', 'OSC 3 SHAPE', 0.5),
      K('o3Pulse', 'PULSE LEVEL', 0.5), K('o3Tri', 'TRI LEVEL', 0.8), K('noiseColor', 'NOISE COLOUR', 0.5), K('noiseLvl', 'NOISE LEVEL', 0.5),
      H('FILTRO / RING / REVERB'), K('fFreq', 'FILTER FREQ', 0.45, CUT), K('fRes', 'RESPONSE', 0.4, { r: [0, 0.85] }), K('fLvl', 'FILTER LEVEL', 0.8),
      K('ringLvl', 'RING LEVEL', 0.6), K('revLvl', 'REVERB LEVEL', 0.6),
      H('TRAPEZOID'), K('envA', 'ATTACK', 0.1, { r: [0, 0.5] }), K('envOn', 'ON', 0.2, { r: [0, 0.5] }), K('envD', 'DECAY', 0.4, { r: [0.1, 0.7] }),
      K('envOff', 'OFF', 1, { format: (v) => (v > 0.98 ? 'MAN' : (v * 10).toFixed(1)) }), K('trapLvl', 'TRAP LEVEL', 0.8), K('envSig', 'SIGNAL LEVEL', 0.9),
      H('JOYSTICK / SAÍDA'), K('joyX', 'JOY X', 0.5, { bipolar: true }), K('joyY', 'JOY Y', 0.5, { bipolar: true }),
      K('out1', 'OUT 1 LEVEL', 0.8, { keep: true }), K('out2', 'OUT 2 LEVEL', 0.8, { keep: true }), K('vol', 'VOLUME', 0.6, VOL),
    ],
    jacks: [
      i('in1', 'INPUT 1'), i('in2', 'INPUT 2'), i('trig', 'ATTACK TRIG'), i('voct', 'OSC 1+2 V/OCT'), i('fCv', 'FILTER CV'),
      o('out1', 'OUT 1'), o('out2', 'OUT 2'), o('filter', 'FILTER'), o('trap', 'TRAPEZOID'), o('envSig', 'ENV SIGNAL'),
      o('ring', 'RING'), o('osc3', 'OSC 3 TRI'), o('noise', 'NOISE'), o('matrix', 'MATRIX OUT'),
    ],
    data: () => ({ pins: { ...V_DEFAULT_PINS } }),
    lit: () => [],
  },
};

export const FX_CONTROLS = [
  K('delayTime', 'DELAY TIME', 0.35, { format: (v) => `${Math.round((0.03 + v * 0.97) * 1000)}ms` }),
  K('delayFb', 'FEEDBACK', 0.4), K('delayMix', 'DELAY', 0.5), K('reverb', 'REVERB', 0.45), K('vol', 'MASTER', 0.8, { size: 'lg' }),
];

// Layout clássico: posição de cada controlo no painel, como nos aparelhos físicos.
// Todos os módulos têm a mesma largura. `grid` é o número de colunas da área de controlos e `rows` o de linhas;
// cada controlo fica em [coluna, linha] (centro, aceita frações) e pode trocar de tamanho com um 3.º valor.
// Três tamanhos: knob grande (lg), médio (md) e pequeno (sm). Os interruptores e botões ocupam o mesmo que um knob pequeno.
// `cols` é o número de colunas do patch bay. As posições vêm do conhecimento dos painéis, não foram medidas em fotografias.
const at = (row, list) => Object.fromEntries(list.map(([id, x, size, dy = 0]) => [id, [x, row + dy, size]]));
const LAYOUT = {
  M: { cols: 4, grid: 10.6, rows: 3, at: {
    ...at(0, [['freq', 0.6], ['pw', 1.9], ['wave', 2.9], ['mix', 3.9], ['cutoff', 5.3], ['res', 6.7], ['vcfMode', 7.7], ['vcaMode', 8.7], ['vol', 9.9]]),
    ...at(1, [['glide', 0.6], ['vcoModSrc', 1.9], ['vcoModAmt', 2.9], ['vcoModDest', 3.9], ['vcfModSrc', 4.9], ['vcfModAmt', 5.9], ['vcfModPol', 6.9], ['vcMix', 9.9]]),
    ...at(2, [['tempo', 0.6], ['gateLen', 1.9, 'sm'], ['lfoRate', 2.9], ['lfoWave', 3.9], ['attack', 4.9], ['sustain', 5.9], ['decay', 6.9]]),
  } },
  D: { cols: 3, grid: 12.5, rows: 4, at: {
    ...at(0, [['vcoDecay', 0.6], ['seqPitch', 1.6], ['vco1Eg', 2.6], ['vco1Freq', 3.9], ['vco1Wave', 5.1], ['vco1Lvl', 6.1], ['noiseLvl', 7.1], ['cutoff', 8.4], ['res', 9.7], ['vcfMode', 10.7], ['vol', 11.8]]),
    ...at(1, [['fm', 0.6], ['sync', 1.6], ['vco2Eg', 2.6], ['vco2Freq', 3.9], ['vco2Wave', 5.1], ['vco2Lvl', 6.1], ['vcfDecay', 7.1], ['vcfEg', 8.4], ['noiseMod', 9.7], ['vcaEg', 10.7], ['vcaDecay', 11.8]]),
    ...at(2, [['tempo', 0.8, 'lg', 0.5], ['@custom', 2.2, 'sm', 0.5], ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => [`pitch${n}`, 3.6 + (n - 1) * 1.1])]),
    ...at(3, [1, 2, 3, 4, 5, 6, 7, 8].map((n) => [`vel${n}`, 3.6 + (n - 1) * 1.1])),
  } },
  S: { cols: 4, grid: 13.6, rows: 4, at: {
    ...at(0, [['a1', 0.5], ['a2', 1.4], ['a3', 2.3], ['a4', 3.2], ['s1Osc', 4.1], ['s1Sub1', 4.8], ['s1Sub2', 5.5],
      ['vco1Freq', 6.8], ['sub1Div', 8.1], ['sub2Div', 9.1], ['vco1Wave', 10.1], ['cutoff', 11.6], ['res', 13]]),
    ...at(1, [['b1', 0.5], ['b2', 1.4], ['b3', 2.3], ['b4', 3.2], ['s2Osc', 4.1], ['s2Sub1', 4.8], ['s2Sub2', 5.5],
      ['vco2Freq', 6.8], ['sub3Div', 8.1], ['sub4Div', 9.1], ['vco2Wave', 10.1], ['vcfEg', 11.6], ['vol', 13]]),
    ...at(2, [['tempo', 0.6, 'lg', 0.5],
      ...[1, 2, 3, 4].flatMap((n) => {
        const x = 2 + (n - 1) * 1.7;
        return [[`rhythm${n}`, x], [`r${n}s1`, x + 0.75, 'sm', -0.18], [`r${n}s2`, x + 0.75, 'sm', 0.22]];
      }),
      ['seqOct', 9.1], ['quant', 10.1], ['vcfAttack', 11.6], ['vcfDecay', 12.8]]),
    ...at(3, [['vco1Lvl', 2], ['sub1Lvl', 3], ['sub2Lvl', 4], ['vco2Lvl', 5.4], ['sub3Lvl', 6.4], ['sub4Lvl', 7.4], ['vcaAttack', 11.6], ['vcaDecay', 12.8]]),
  } },
  L: { cols: 5, grid: 12, rows: 3, at: {
    ...at(0, [['vcoFreq', 0.7], ['vcoEg', 2], ['modFreq', 3.2], ['fm', 4.4], ['vcoLvl', 5.8], ['modLvl', 6.9], ['noiseLvl', 8], ['vol', 11.2]]),
    ...at(1, [['fold', 0.7], ['foldEg', 2], ['cutoff', 3.4], ['res', 4.8], ['vcfEg', 5.9], ['filtMode', 7], ['blend', 8.1], ['eg1Decay', 9.6], ['eg2Decay', 10.8]]),
    ...at(2, [['tempo', 0.7], ['seq1Range', 2], ['seq1Corrupt', 3.1], ['seq1Len', 4.2], ['seq2Range', 5.6], ['seq2Corrupt', 6.7], ['seq2Len', 7.8], ['quant', 9.2]]),
  } },
  X: { cols: 5, grid: 12, rows: 3, at: {
    ...at(0, [['vcoFreq', 0.7], ['vcoWave', 1.9], ['pw', 2.9], ['noiseMix', 3.9], ['progLvl', 5], ['mode', 6.1], ['vcaMode', 7.1], ['shift', 8.6], ['lfoRate', 10], ['lfoAmt', 11.1]]),
    ...at(1, [['res', 10], ['vol', 11.1]]),
    ...at(1.6, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => [`b${n}`, 0.7 + (n - 1) * 0.95])),
  } },
  // Pulso N: painel compacto de secretária; aqui os controlos ficam em quatro linhas pela ordem do fluxo de sinal
  N: { cols: 3, grid: 11, rows: 4, at: {
    ...at(0, [['osc1Oct', 0.6], ['osc1Wave', 1.6], ['osc2Oct', 2.8], ['osc2Freq', 3.8], ['osc2Wave', 4.8], ['sync', 5.8], ['cutoff', 7.3, 'lg'], ['res', 8.8], ['vol', 10.1]]),
    ...at(1, [['glide', 0.6], ['osc1Lvl', 1.6], ['osc2Lvl', 2.8], ['noiseLvl', 3.8], ['lfoRate', 4.8], ['lfoWave', 5.8], ['egAmt', 7.3], ['kbAmt', 8.8]]),
    ...at(2, [['fA', 0.6, 'sm'], ['fD', 1.6, 'sm'], ['fS', 2.6, 'sm'], ['fR', 3.6, 'sm'], ['lfoPitch', 4.8], ['lfoCut', 5.8], ['tempo', 7.3], ['gateLen', 8.8, 'sm']]),
    ...at(3, [['aA', 0.6, 'sm'], ['aD', 1.6, 'sm'], ['aS', 2.6, 'sm'], ['aR', 3.6, 'sm']]),
  } },
  // Pulso A: blocos da esquerda para a direita como no painel (VCOs, ruído/S&H, VCF, ADSR/AR, VCA/mistura); os sliders são knobs
  A: { cols: 6, grid: 12.4, rows: 4, at: {
    ...at(0, [['v1Coarse', 0.6], ['v1Fine', 1.5, 'sm'], ['v1Fm1', 2.4, 'sm'], ['v1Fm2', 3.3, 'sm'],
      ['fRing', 4.6, 'sm'], ['fV1', 5.4, 'sm'], ['fV2', 6.2, 'sm'], ['fV3', 7], ['fNoise', 7.8, 'sm'],
      ['attack', 9.1, 'sm'], ['decay', 9.9, 'sm'], ['sustain', 10.7, 'sm'], ['release', 11.5, 'sm']]),
    ...at(1, [['v2Coarse', 0.6], ['v2Fine', 1.5, 'sm'], ['v2Fm', 2.4, 'sm'], ['v2Adsr', 3.3, 'sm'],
      ['cutoff', 5, 'lg'], ['fine', 6.2, 'sm'], ['res', 7.2], ['arA', 9.1, 'sm'], ['arR', 9.9, 'sm'], ['vcaInit', 10.7, 'sm'], ['vcaAr', 11.5, 'sm']]),
    ...at(2, [['v2Pw', 0.6, 'sm'], ['v2Pwm', 1.5, 'sm'], ['sync', 2.4], ['v3Coarse', 3.5],
      ['fAdsr', 4.6, 'sm'], ['fSine', 5.4, 'sm'], ['fKb', 6.2, 'sm'], ['noiseColor', 7.4], ['vcaRing', 9.1, 'sm'], ['reverb', 10.1], ['vol', 11.5]]),
    ...at(3, [['v3Fine', 0.6, 'sm'], ['v3Fm', 1.5, 'sm'], ['v3Low', 2.4], ['v3Kb', 3.3], ['shRate', 4.6], ['porta', 5.8], ['tempo', 9.1], ['gateLen', 10.1, 'sm']]),
  } },
  U: { cols: 4, grid: 10, rows: 2, at: {
    ...at(0, [['att1', 0.8], ['att2', 1.9], ['att3', 3], ['att4', 4.1], ['vca1', 5.8], ['vca2', 6.9]]),
    ...at(1, [['div', 0.8], ['rise', 1.9], ['fall', 3], ['vol', 9]]),
  } },
  T: { cols: 4, grid: 10, rows: 2, at: {
    ...at(0, [['change', 0.8, 'lg'], ['len', 2.2], ['range', 3.4], ['scale', 4.6], ['oct', 5.7], ['tempo', 8.2], ['gateLen', 9.3]]),
    ...at(1, [['eSteps', 0.8], ['eHits', 2.2], ['eRot', 3.4]]),
  } },
  // Pulso G: da esquerda para a direita como no painel (modulação, osciladores, misturador, filtro, envelope, saída)
  G: { cols: 5, grid: 13, rows: 4, at: {
    ...at(0, [['lfoRate', 0.6], ['lfoWave', 1.7], ['osc1Oct', 3], ['osc1Wave', 4], ['osc1Lvl', 5.3], ['cutoff', 7.2, 'lg'], ['res', 8.7], ['attack', 10], ['decay', 11], ['sustain', 12]]),
    ...at(1, [['modPitch', 0.6], ['modCut', 1.7], ['osc2Oct', 3], ['osc2Wave', 4], ['osc2Lvl', 5.3], ['egAmt', 7.2], ['kbAmt', 8.7], ['release', 10], ['vcaMode', 11], ['vol', 12]]),
    ...at(2, [['modPw', 0.6], ['glide', 1.7], ['osc2Freq', 3], ['sync', 4], ['noiseLvl', 5.3], ['hpCut', 7.2], ['reverb', 8.7], ['arp', 10], ['arpOct', 11]]),
    ...at(3, [['tempo', 0.6], ['gateLen', 1.7]]),
  } },
  // Pulso B: pulser e sequenciador de 5 passos em cima, osciladores ao meio, low pass gates em baixo
  B: { cols: 4, grid: 13, rows: 4, at: {
    ...at(0, [['period', 0.7, 'lg'], ['s1', 2], ['s2', 3], ['s3', 4], ['s4', 5], ['s5', 6], ['steps', 7.1], ['quant', 8.1], ['attack', 9.6], ['hold', 10.7], ['decay', 11.8]]),
    ...at(1, [['modFreq', 0.7, 'lg'], ['modWave', 2], ['modRange', 3], ['index', 4.2], ['modSeq', 5.4], ['envMode', 9.6]]),
    ...at(2, [['pitch', 0.7, 'lg'], ['seqAmt', 2], ['timbre', 3.2], ['timbreMod', 4.4], ['timbreEnv', 5.6], ['sym', 6.8]]),
    ...at(3, [['lpg1', 0.7], ['lpg1Mode', 1.8], ['lpg2', 3.2], ['lpg2Mode', 4.3], ['vol', 11.8]]),
  } },
  // Pulso K: osciladores à esquerda, os dois filtros ao centro, envelopes e MG em baixo, ESP na última linha
  K: { cols: 6, grid: 13, rows: 4, at: {
    ...at(0, [['v1Scale', 0.6], ['v1Wave', 1.6], ['pw', 2.6], ['porta', 3.8], ['mgPitch', 4.9], ['egPitch', 6], ['hpCut', 7.4], ['hpPeak', 8.5], ['lpCut', 9.8, 'lg'], ['lpPeak', 11.1], ['vol', 12.3]]),
    ...at(1, [['v2Scale', 0.6], ['v2Wave', 1.6], ['v2Pitch', 2.6], ['v1Lvl', 3.8], ['v2Lvl', 4.9], ['hpMg', 7.4], ['hpEg', 8.5], ['lpMg', 9.8], ['lpEg', 11.1]]),
    ...at(2, [['e1Delay', 0.6], ['e1Attack', 1.6], ['e1Release', 2.6], ['attack', 3.8], ['decay', 4.9], ['sustain', 6], ['release', 7.1], ['mgRate', 8.5], ['mgShape', 9.6]]),
    ...at(3, [['espGain', 0.6], ['espLo', 1.6], ['espHi', 2.6], ['espThr', 3.6], ['tempo', 8.5], ['gateLen', 9.6]]),
  } },
  // Pulso V: osciladores, filtro e trapézio por cima; a matriz de pinos fica por baixo do painel
  V: { cols: 5, grid: 13, rows: 3, at: {
    ...at(0, [['o1Freq', 0.7, 'lg'], ['o1Shape', 1.9], ['o1Sine', 2.9], ['o1Saw', 3.9], ['o2Freq', 5.2, 'lg'], ['o2Shape', 6.4], ['o2Pulse', 7.4], ['o2Tri', 8.4], ['o3Freq', 9.7], ['o3Shape', 10.7]]),
    ...at(1, [['noiseColor', 0.7], ['noiseLvl', 1.9], ['fFreq', 3.3, 'lg'], ['fRes', 4.6], ['fLvl', 5.6], ['ringLvl', 6.8], ['revLvl', 7.8], ['o3Pulse', 9.7], ['o3Tri', 10.7]]),
    ...at(2, [['envA', 0.7], ['envOn', 1.7], ['envD', 2.7], ['envOff', 3.7], ['trapLvl', 4.9], ['envSig', 5.9], ['joyX', 7.4], ['joyY', 8.4], ['out1', 9.7], ['out2', 10.7], ['vol', 12]]),
  } },
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
  return { id, type, p: { ...t.defaults, run: 0 }, data: t.data ? t.data() : {}, min: false, mix: normMix() };
}

// Canal do mixer: FX1 vai para o reverb, FX2 para o delay. Racks antigos tinham um só envio (`send`).
export function normMix(mix = {}) {
  const { send = 0.25, ...rest } = mix;
  return { level: 0.8, pan: 0.5, fx1: send, fx2: send, mute: 0, solo: 0, ...rest };
}

// Relógio: saída que cada tipo usa como relógio master e entrada que aceita um relógio externo
export const CLOCK_OUT = { M: 'assign', D: 'trigOut', S: 'clockOut', L: 'clockOut', N: 'clockOut', A: 'clockOut', T: 'clockOut', G: 'clockOut', B: 'pulse', K: 'clockOut' };
export const CLOCK_IN = { M: 'tempo', D: 'adv', S: 'clock', L: 'clock', N: 'clock', A: 'clock', T: 'clock', G: 'clock', B: 'clock', K: 'clock', V: 'trig' };
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
  {
    name: 'Ecossistema generativo',
    about: 'Os sete módulos ligados entre si: o L dá o relógio e gera padrões que se vão corrompendo, o S muda a tonalidade de todos, o X vocoda a percussão sobre os acordes',
    make: makeEcosystem,
  },
];

// Patch generativo com todos os módulos. Tonalidade: dó menor.
// - L é o relógio master (100 BPM) e o gerador: os bits do SEQ 1 disparam a percussão, os do SEQ 2 o S&H do A,
//   e o "corrupt" vai mudando os padrões sozinho.
// - S faz a progressão de acordes (SEQ 1 muda de 16 em 16 passos: dó, fá, si♭, mi♭) e transpõe M, N, L e A.
// - M (11 passos), N (16) e A (7) tocam frases de comprimentos diferentes, que só se alinham de vez em quando.
// - X vocoda a percussão e os bleeps do L sobre os sub-harmónicos do S; o SEQ 2 do L mexe-lhe no spectral shift.
// - VC MIX do M serve de atenuador: o VCO 3 do A (modo LOW, ~0,3 Hz) passa por ele e abre lentamente o fold do L.
const semi = (n) => 0.5 + n / 24; // passo do sequenciador do S (±1 oitava, quantizado) para n semitons
function makeEcosystem() {
  const l = mod('L', 'l1', {
    tempo: Math.log10(100 / 30), vcoFreq: 0.625, vcoEg: 0.56, fm: 0.12, modFreq: 0.62, vcoLvl: 0.85,
    fold: 0.22, foldEg: 0.35, cutoff: 0.5, res: 0.45, vcfEg: 0.72, filtMode: 0.25, blend: 0.75,
    eg1Decay: 0.36, eg2Decay: 0.42, seq1Range: 0.55, seq1Corrupt: 0.32, seq1Len: 1,
    seq2Range: 0.25, seq2Corrupt: 0.45, seq2Len: 5 / 7, quant: 2, vol: 0.45,
  });
  const s = mod('S', 's1', {
    vco1Freq: 1 / 3, vco2Freq: 1 / 3, vco1Wave: 0, vco2Wave: 1, sub1Div: 2 / 15, sub2Div: 3 / 15, sub3Div: 1 / 15, sub4Div: 4 / 15,
    vco1Lvl: 0.55, sub1Lvl: 0.5, sub2Lvl: 0.35, vco2Lvl: 0.35, sub3Lvl: 0.3, sub4Lvl: 0.25,
    cutoff: 0.38, res: 0.35, vcfEg: 0.68, vcfAttack: 0.05, vcfDecay: 0.5, vcaAttack: 0.12, vcaDecay: 0.58, vol: 0.4,
    a1: semi(0), a2: semi(5), a3: semi(-2), a4: semi(3), b1: semi(0), b2: semi(7), b3: semi(3), b4: semi(10),
    s1Osc: 1, s1Sub1: 0, s1Sub2: 0, s2Osc: 1, s2Sub1: 0, s2Sub2: 1,
    rhythm1: 15 / 15, rhythm2: 2 / 15, rhythm3: 4 / 15, rhythm4: 6 / 15,
    r1s1: 1, r1s2: 0, r2s1: 0, r2s2: 1, r3s1: 0, r3s2: 1, r4s1: 0, r4s2: 0, seqOct: 2, quant: 1,
  });
  const m = mod('M', 'm1', {
    wave: 0, cutoff: 0.4, res: 0.55, vcfModAmt: 0.45, decay: 0.34, glide: 0.12, gateLen: 0.4, vcMix: 0.85, vol: 0.45,
  });
  m.data = { steps: mSeq([12, null, null, 19, null, 15, null, null, 22, null, 17]), len: 11 };
  const n = mod('N', 'n1', {
    osc1Oct: 1, osc1Wave: 0, osc2Oct: 0, osc2Freq: 0.5, osc2Wave: 0.5, osc1Lvl: 0.7, osc2Lvl: 0.55, glide: 0.08,
    cutoff: 0.28, res: 0.4, egAmt: 0.78, kbAmt: 0.5, fA: 0, fD: 0.35, fS: 0.1, fR: 0.25, aA: 0, aD: 0.4, aS: 0.5, aR: 0.2,
    lfoRate: 0.35, lfoWave: 3, lfoCut: 0.15, gateLen: 0.35, vol: 0.55,
  });
  n.data = { steps: mSeq([0, null, null, 0, null, null, 12, null, 0, null, null, 7, null, 10, null, null]), len: 16 };
  const d = mod('D', 'd1', {
    vco1Freq: 0.32, vco1Eg: 0.82, vcoDecay: 0.28, vco2Freq: 0.55, vco2Lvl: 0.25, vco2Wave: 1, fm: 0.12,
    noiseLvl: 0.2, cutoff: 0.5, res: 0.3, vcfDecay: 0.3, vcfEg: 0.7, noiseMod: 0.12, vcaDecay: 0.2, vol: 0.6, seqPitch: 0,
    ...Object.fromEntries([0.5, 0.5, 0.56, 0.5, 0.44, 0.5, 0.6, 0.53].map((v, k) => [`pitch${k + 1}`, v])),
    ...Object.fromEntries([1, 0.3, 0.6, 0.35, 0.9, 0.3, 0.7, 0.5].map((v, k) => [`vel${k + 1}`, v])),
  });
  const a = mod('A', 'a1', {
    v1Coarse: 0.5, v2Coarse: 0.5, v2Fine: 0.52, v2Pw: 0.5, v3Coarse: 0.15, v3Low: 1, v3Kb: 1,
    fRing: 0.25, fV1: 0.3, fV2: 0.5, fV3: 0, cutoff: 0.35, res: 0.5, fAdsr: 0.5, fKb: 0.5,
    attack: 0.02, decay: 0.45, sustain: 0.3, release: 0.5, arA: 0.05, arR: 0.5, vcaAr: 1, reverb: 0.5, gateLen: 0.6, vol: 0.45,
  });
  a.data = { steps: mSeq([24, null, null, 31, null, 27, null]), len: 7 };
  const x = mod('X', 'x1', { mode: 0, progLvl: 0.8, res: 0.55, shift: 0.5, lfoRate: 0.2, lfoAmt: 0.25, vol: 0.45 });
  const mixes = {
    l1: [0.7, 0.35, 0.4, 0.45], s1: [0.55, 0.5, 0.5, 0.15], m1: [0.6, 0.62, 0.3, 0.5], n1: [0.75, 0.5, 0.1, 0],
    d1: [0.7, 0.45, 0.15, 0.1], a1: [0.55, 0.7, 0.5, 0.3], x1: [0.6, 0.3, 0.45, 0.25],
  };
  const mods = [l, s, m, n, d, a, x];
  mods.forEach((u) => { const [level, pan, fx1, fx2] = mixes[u.id]; Object.assign(u.mix, { level, pan, fx1, fx2 }); });
  return {
    mods,
    cables: [
      // relógio: o L avança todos os sequenciadores
      ['l1', 'clockOut', 's1', 'clock'], ['l1', 'clockOut', 'm1', 'tempo'], ['l1', 'clockOut', 'n1', 'clock'],
      ['l1', 'clockOut', 'a1', 'clock'], ['l1', 'clockOut', 'd1', 'adv'],
      // ritmo generativo: bits do L disparam a percussão e o S&H do A
      ['l1', 'trig1Out', 'd1', 'trig'], ['l1', 'trig2Out', 'a1', 'shClk'],
      // harmonia: a progressão do S transpõe tudo
      ['s1', 'seq1', 'm1', 'voct'], ['s1', 'seq1', 'n1', 'voct'], ['s1', 'seq1', 'l1', 'vcoCv'],
      ['s1', 'seq1', 'a1', 'kbCv'], ['s1', 'seq1', 's1', 'vco2'], ['s1', 'seq2', 'd1', 'vco1Cv'],
      // vocoder: percussão e bleeps do L modulam os sub-harmónicos do S
      ['d1', 'vca', 'x1', 'program'], ['l1', 'vca', 'x1', 'program'],
      ['s1', 'vco1', 'x1', 'carrier'], ['s1', 'sub1', 'x1', 'carrier'],
      // modulação: o SEQ 2 do L (CV aleatória) passa pelo MULT do M para o shift do X e o corte do M
      ['l1', 'seq2', 'm1', 'mult'], ['m1', 'mult1', 'x1', 'shiftCv'], ['m1', 'mult2', 'm1', 'cutoff'],
      ['l1', 'seq1', 's1', 'cutoff'],
      // LFO lento do A atenuado pelo VC MIX do M a abrir o fold do L
      ['a1', 'v3Tri', 'm1', 'mix1'], ['m1', 'vcMix', 'l1', 'fold'],
      // pormenores: S&H do A no filtro da percussão, LFO do N na largura de pulso do A, velocidade alonga o decay
      ['a1', 'sh', 'd1', 'vcfMod'], ['n1', 'lfo', 'a1', 'v2Pwm'], ['d1', 'velOut', 'd1', 'vcaDecay'],
    ],
    fx: { ...FX, delayTime: (0.45 - 0.03) / 0.97, delayFb: 0.45, delayMix: 0.45, reverb: 0.55 },
  };
}

// Patches clássicos: técnicas conhecidas destas máquinas, montadas à mão (não são cópias dos livros de patches)
PRESETS.push(
  {
    name: 'Baixo PWM', classic: true, about: 'M: LFO na largura de pulso e filtro a seguir o teclado (KB → VCF CUTOFF)',
    make: () => ({
      mods: [mod('M', 'm1', { wave: 1, vcoModSrc: 1, vcoModDest: 0, vcoModAmt: 0.7, lfoRate: 0.3, cutoff: 0.4, res: 0.35, vcfModAmt: 0.45, decay: 0.45 })],
      cables: [['m1', 'kb', 'm1', 'cutoff']], fx: { ...FX },
    }),
  },
  {
    name: 'Acid com glide', classic: true, about: 'M: serra, ressonância alta, envelope curto no filtro e glide',
    make: () => ({
      mods: [mod('M', 'm1', { wave: 0, cutoff: 0.3, res: 0.78, vcfModAmt: 0.6, decay: 0.3, glide: 0.25, gateLen: 0.7, tempo: 0.65 })],
      cables: [], fx: { ...FX },
    }),
  },
  {
    name: 'Bombo e tom', classic: true, about: 'D: bombo com envelope de afinação; a velocidade alonga o decay (VELOCITY → VCA DECAY)',
    make: () => ({
      mods: [mod('D', 'd1', {
        vco1Freq: 0.3, vco1Eg: 0.8, vcoDecay: 0.3, vco1Lvl: 1, vco2Lvl: 0, noiseLvl: 0.05, cutoff: 0.45, vcfEg: 0.65, vcfDecay: 0.3,
        vcaDecay: 0.3, seqPitch: 1, vel1: 1, vel2: 0, vel3: 0.5, vel4: 0, vel5: 1, vel6: 0, vel7: 0.6, vel8: 0.3,
      })],
      cables: [['d1', 'velOut', 'd1', 'vcaDecay']], fx: { ...FX },
    }),
  },
  {
    name: 'Percussão FM', classic: true, about: 'D: hard sync e FM 1→2 aberta pelo envelope (VCO EG → 1→2 FM AMT)',
    make: () => ({
      mods: [mod('D', 'd1', {
        vco1Freq: 0.6, vco2Freq: 0.68, vco1Wave: 1, vco2Wave: 1, vco2Lvl: 0.7, sync: 1, fm: 0.15, vco1Eg: 0.55, vco2Eg: 0.7,
        vcoDecay: 0.3, cutoff: 0.65, res: 0.45, vcfDecay: 0.3, vcaDecay: 0.32, noiseLvl: 0,
        pitch1: 0.5, pitch2: 0.56, pitch3: 0.44, pitch4: 0.6, pitch5: 0.5, pitch6: 0.42, pitch7: 0.58, pitch8: 0.53,
      })],
      cables: [['d1', 'vcoEg', 'd1', 'fmAmt']], fx: { ...FX },
    }),
  },
  {
    name: 'M toca D', classic: true, about: 'M + D: ASSIGN → ADV/CLOCK para sincronizar e KB → VCO 1 CV para a percussão seguir a melodia',
    make: () => ({
      mods: [mod('M', 'm1', { cutoff: 0.38, res: 0.5 }), mod('D', 'd1', { seqPitch: 2, vco2Lvl: 0.5 })],
      cables: [['m1', 'assign', 'd1', 'adv'], ['m1', 'kb', 'd1', 'vco1Cv']], fx: { ...FX },
    }),
  },
  {
    name: 'Polirritmo 3:4', classic: true, about: 'S: dois sequenciadores em 3 contra 4, com sub-harmónicos a fazer acordes',
    make: () => ({
      mods: [mod('S', 's1', {
        rhythm1: 2 / 15, rhythm2: 3 / 15, r1s1: 1, r1s2: 0, r2s1: 0, r2s2: 1, sub1Div: 1 / 15, sub2Div: 2 / 15, sub3Div: 2 / 15, sub4Div: 4 / 15,
        sub1Lvl: 0.6, sub2Lvl: 0.5, sub3Lvl: 0.5, sub4Lvl: 0.4, cutoff: 0.4, vcfDecay: 0.5, vcaDecay: 0.55, tempo: 0.5,
      })],
      cables: [], fx: { ...FX },
    }),
  },
  {
    name: 'Baixo com sync', classic: true, about: 'N: dois osciladores com hard sync, o envelope do filtro a abrir o som e glide curto',
    make: () => ({
      mods: [mod('N', 'n1', { sync: 1, osc2Oct: 2, osc2Freq: 0.62, osc2Lvl: 0.8, osc1Lvl: 0.4, cutoff: 0.3, res: 0.45, egAmt: 0.85, fD: 0.3, fS: 0, glide: 0.15 })],
      cables: [['n1', 'fEg', 'n1', 'lfoRate']], fx: { ...FX },
    }),
  },
  {
    name: 'Ring e S&H', classic: true, about: 'A: ring mod no filtro e sample & hold do ruído a mexer no corte (S/H → VCF FM)',
    make: () => ({
      mods: [mod('A', 'a1', { fRing: 0.6, fV1: 0.2, fV2: 0.3, v2Coarse: 0.62, res: 0.6, cutoff: 0.45, shRate: 0.6, reverb: 0.35 })],
      cables: [['a1', 'sh', 'a1', 'vcfFm']], fx: { ...FX },
    }),
  },  {
    name: 'Máquina de Turing', classic: true, about: 'T + M + U: o registo aleatório toca o M (CV → 1V/OCT, GATE → GATE) e um atenuador do U leva o RANDOM ao filtro',
    make: () => {
      const m = mod('M', 'm1', { wave: 1, cutoff: 0.35, res: 0.6, vcfModAmt: 0.5, decay: 0.35, glide: 0.1, vcoModAmt: 0.3 });
      m.data = { steps: mSeq(Array(16).fill(null)), len: 16 };
      return {
        mods: [mod('T', 't1', { change: 0.15, range: 0.5, scale: 4 }), m, mod('U', 'u1', { att1: 0.6 })],
        cables: [['t1', 'cv', 'm1', 'voct'], ['t1', 'gate', 'm1', 'gate'], ['t1', 'raw', 'u1', 'in1'], ['u1', 'out1', 'm1', 'cutoff']],
        fx: { ...FX },
      };
    },
  },
  {
    name: 'Bongós west coast', classic: true, about: 'B: o pulser dispara o envelope, o low pass gate fecha devagar como um vactrol e o FM dá o corpo',
    make: () => ({
      mods: [mod('B', 'b1', { period: 0.66, timbre: 0.3, timbreEnv: 0.55, timbreMod: 0.15, index: 0.28, modFreq: 0.62, attack: 0, hold: 0, decay: 0.3, lpg2Mode: 1, seqAmt: 0.6, vol: 0.85 })],
      cables: [], fx: { ...FX },
    }),
  },
  {
    name: 'Arpejo com mola', classic: true, about: 'G: arpejador para cima e para baixo em duas oitavas sobre um acorde menor, LFO no filtro e reverb de mola',
    make: () => {
      const g = mod('G', 'g1', { arp: 2, arpOct: 1, cutoff: 0.36, res: 0.45, egAmt: 0.75, decay: 0.3, sustain: 0.2, lfoRate: 0.2, modCut: 0.25, reverb: 0.45, glide: 0.05 });
      g.data = { steps: mSeq([0, 3, 7, 10]), len: 4 };
      return { mods: [g], cables: [], fx: { ...FX } };
    },
  },
  {
    name: 'MS-20 a seguir', classic: true, about: 'N + K + U: o ESP do K ouve o N e converte a afinação em tensão (F/V → TOTAL FREQ), o gate do ESP abre os envelopes',
    make: () => {
      const k = mod('K', 'k1', { v1Scale: 2, v2Scale: 3, v2Wave: 1, v2Lvl: 0.4, lpCut: 0.35, lpPeak: 0.7, hpCut: 0.2, lpEg: 0.75, decay: 0.35, espLo: 0.05, espHi: 0.2, espGain: 0.6, espThr: 0.25, vol: 0.5 });
      k.data = { steps: mSeq(Array(16).fill(null)), len: 16 };
      return {
        mods: [mod('N', 'n1', { vol: 0.5 }), k, mod('U', 'u1', { att1: 0.7 })],
        cables: [['n1', 'clockOut', 'k1', 'clock'], ['n1', 'vca', 'k1', 'espIn'], ['k1', 'espCv', 'k1', 'voct'], ['u1', 'out1', 'k1', 'voct'], ['k1', 'espGate', 'k1', 'gate']],
        fx: { ...FX },
      };
    },
  },
  {
    name: 'Matriz VCS3', classic: true, about: 'V: só pinos, sem cabos. O trapézio repete-se sozinho, o OSC 3 lento mexe no filtro e no OSC 2, o ring junta OSC 1 e OSC 3',
    make: () => {
      const v = mod('V', 'v1', { envOff: 0.45, envA: 0.15, envOn: 0.25, envD: 0.45, o3Freq: 0.22, o1Freq: 0.45, o2Freq: 0.55, fRes: 0.55, revLvl: 0.7, vol: 0.85 });
      v.data = { pins: { '2,6': 1, '3,6': 0.3, '9,5': 1, '11,0': 1, '11,1': 1, '11,4': 1, '13,0': 0.3, '13,1': 0.3,
        '5,10': 1, '10,10': 1, '5,8': 0.3, '0,2': 1, '4,3': 1, '12,6': 0.3, '15,7': 0.3 } };
      return { mods: [v], cables: [], fx: { ...FX } };
    },
  },
);

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

// Pinos aleatórios para o Pulso V: um caminho de áudio até às saídas e algumas modulações
export function randomPins() {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const pins = {};
  const audio = pick([0, 1, 2, 3, 4, 6]);
  pins[`${audio},${pick([6, 2, 5])}`] = 1;
  pins[`${pick([0, 2, 4])},3`] = 0.3;
  pins['9,5'] = 1; pins['12,6'] = 0.3;
  pins[`11,0`] = 1; pins[`11,1`] = 1; pins[`11,4`] = 0.3; pins['13,0'] = 0.3;
  for (let k = 0; k < 3 + Math.floor(Math.random() * 3); k++) pins[`${pick([3, 5, 6, 10, 14, 15])},${pick([7, 8, 9, 10, 11, 12, 14])}`] = Math.random() < 0.5 ? 1 : 0.3;
  return pins;
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
