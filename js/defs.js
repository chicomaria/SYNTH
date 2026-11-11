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
export const CLOCK_OUT = { M: 'assign', D: 'trigOut', S: 'clockOut', L: 'clockOut', N: 'clockOut', A: 'clockOut' };
export const CLOCK_IN = { M: 'tempo', D: 'adv', S: 'clock', L: 'clock', N: 'clock', A: 'clock' };
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
