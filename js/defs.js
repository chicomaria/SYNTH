// Definição dos controlos, dos pontos de patch, dos valores por defeito e das memórias.
// Knobs normalizados em 0..1; interruptores com valores inteiros.

const K = (id, label, def = 0.5, opt = {}) => ({ type: 'knob', id, label, def, ...opt });
const S = (id, label, options, def = 0) => ({ type: 'switch', id, label, options, def });

export const M_CONTROLS = [
  K('mFreq', 'FREQUENCY', 0.5, { bipolar: true, size: 'lg' }),
  K('mPw', 'PULSE WIDTH', 0.5),
  S('mWave', 'VCO WAVE', ['SAW', 'PULSE']),
  K('mMix', 'MIX', 0),
  K('mCutoff', 'CUTOFF', 0.45, { size: 'lg' }),
  K('mRes', 'RESONANCE', 0.3),
  S('mVcfMode', 'VCF MODE', ['LP', 'HP']),
  S('mVcaMode', 'VCA MODE', ['EG', 'ON']),
  K('mVol', 'VOLUME', 0.7),
  K('mGlide', 'GLIDE', 0),
  S('mVcoModSrc', 'VCO MOD SOURCE', ['EG', 'LFO'], 1),
  K('mVcoModAmt', 'VCO MOD AMOUNT', 0),
  S('mVcoModDest', 'VCO MOD DEST', ['PW', 'FREQ'], 0),
  S('mVcfModSrc', 'VCF MOD SOURCE', ['EG', 'LFO']),
  K('mVcfModAmt', 'VCF MOD AMOUNT', 0.4),
  S('mVcfModPol', 'VCF MOD POLARITY', ['+', '−']),
  K('mLfoRate', 'LFO RATE', 0.45),
  S('mLfoWave', 'LFO WAVE', ['TRI', 'SQ']),
  K('mAttack', 'ATTACK', 0.05),
  S('mSustain', 'SUSTAIN', ['OFF', 'ON']),
  K('mDecay', 'DECAY', 0.5),
  K('mTempo', 'TEMPO', 0.602, { format: (v) => `${Math.round(30 * Math.pow(10, v))}` }),
  K('mGateLen', 'GATE LENGTH', 0.5),
  K('mVcMix', 'VC MIX', 0.5),
];

export const D_CONTROLS = [
  K('dVcoDecay', 'VCO DECAY', 0.35),
  S('dSeqPitch', 'SEQ PITCH MOD', ['VCO 1&2', 'OFF', 'VCO 2']),
  K('dVco1Eg', 'VCO 1 EG AMT', 0.75, { bipolar: true }),
  K('dVco1Freq', 'VCO 1 FREQ', 0.38, { bipolar: true, size: 'lg' }),
  S('dVco1Wave', 'VCO 1 WAVE', ['TRI', 'SQ']),
  K('dVco1Lvl', 'VCO 1 LEVEL', 0.8),
  K('dNoiseLvl', 'NOISE / EXT', 0.1),
  K('dCutoff', 'CUTOFF', 0.5, { size: 'lg' }),
  K('dRes', 'RESONANCE', 0.2),
  S('dVcfMode', 'VCF MODE', ['LP', 'HP']),
  S('dVcaEg', 'VCA EG', ['FAST', 'SLOW']),
  K('dVol', 'VOLUME', 0.7),
  K('dFm', '1→2 FM AMT', 0),
  S('dSync', 'HARD SYNC', ['OFF', 'ON']),
  K('dVco2Eg', 'VCO 2 EG AMT', 0.6, { bipolar: true }),
  K('dVco2Freq', 'VCO 2 FREQ', 0.5, { bipolar: true, size: 'lg' }),
  S('dVco2Wave', 'VCO 2 WAVE', ['TRI', 'SQ'], 1),
  K('dVco2Lvl', 'VCO 2 LEVEL', 0.3),
  K('dVcfDecay', 'VCF DECAY', 0.4),
  K('dVcfEg', 'VCF EG AMT', 0.7, { bipolar: true }),
  K('dNoiseMod', 'NOISE / VCF MOD', 0),
  K('dVcaDecay', 'VCA DECAY', 0.45),
  K('dTempo', 'TEMPO', 0.56, { format: (v) => `${Math.round(10 * Math.pow(1000, v))}` }),
];

export const FX_CONTROLS = [
  K('fxDelayTime', 'DELAY TIME', 0.35, { format: (v) => `${Math.round((0.03 + v * 0.97) * 1000)}ms` }),
  K('fxDelayFb', 'FEEDBACK', 0.4),
  K('fxDelayMix', 'DELAY MIX', 0.1),
  K('fxReverb', 'REVERB', 0.12),
  K('fxVol', 'MASTER', 0.8),
];

const J = (id, label) => ({ id, label });
// Cada patch bay está na ordem do painel; `out: true` marca as saídas.
const o = (id, label) => ({ id, label, out: true });
export const M_JACKS = [
  J('mExt', 'EXT. AUDIO'), J('mMixCv', 'MIX CV'), J('mVcaCv', 'VCA CV'), o('mVca', 'VCA'),
  o('mNoise', 'NOISE'), J('mCutoff', 'VCF CUTOFF'), J('mRes', 'VCF RES'), o('mVcf', 'VCF'),
  J('mVoct', 'VCO 1V/OCT'), J('mLinFm', 'VCO LIN FM'), o('mSaw', 'VCO SAW'), o('mPulse', 'VCO PULSE'),
  J('mVcoMod', 'VCO MOD'), J('mLfoRate', 'LFO RATE'), o('mLfoTri', 'LFO TRI'), o('mLfoSq', 'LFO SQ'),
  J('mMix1', 'MIX 1'), J('mMix2', 'MIX 2'), J('mVcMixCtrl', 'VC MIX CTRL'), o('mVcMix', 'VC MIX'),
  J('mMult', 'MULT'), o('mMult1', 'MULT 1'), o('mMult2', 'MULT 2'), o('mAssign', 'ASSIGN'),
  J('mGateIn', 'GATE'), o('mEg', 'EG'), o('mKb', 'KB'), o('mGate', 'GATE'),
  J('mTempo', 'TEMPO'), J('mRun', 'RUN/STOP'), J('mReset', 'RESET'), J('mHold', 'HOLD'),
];
export const D_JACKS = [
  J('dTrigIn', 'TRIGGER'), J('dVcaCv', 'VCA CV'), o('dVca', 'VCA'),
  J('dVelIn', 'VELOCITY'), J('dVcaDecay', 'VCA DECAY'), o('dVcaEg', 'VCA EG'),
  J('dExt', 'EXT AUDIO'), J('dVcfDecay', 'VCF DECAY'), o('dVcfEg', 'VCF EG'),
  J('dNoiseLvl', 'NOISE LEVEL'), J('dVcoDecay', 'VCO DECAY'), o('dVcoEg', 'VCO EG'),
  J('dVcfMod', 'VCF MOD'), J('dVco1Cv', 'VCO 1 CV'), o('dVco1', 'VCO 1'),
  J('dFmAmt', '1→2 FM AMT'), J('dVco2Cv', 'VCO 2 CV'), o('dVco2', 'VCO 2'),
  J('dTempo', 'TEMPO'), J('dRun', 'RUN/STOP'), o('dTrig', 'TRIGGER'),
  J('dAdv', 'ADV/CLOCK'), o('dVel', 'VELOCITY'), o('dPitch', 'PITCH'),
];
export const ALL_JACKS = [...M_JACKS, ...D_JACKS];
export const OUTS = ALL_JACKS.filter((j) => j.out).map((j) => j.id);
export const INS = ALL_JACKS.filter((j) => !j.out).map((j) => j.id);

export const ALL_CONTROLS = [...M_CONTROLS, ...D_CONTROLS, ...FX_CONTROLS];
export const DEFAULT_PARAMS = Object.fromEntries(ALL_CONTROLS.map((c) => [c.id, c.def]));
export const SMOOTH_KEYS = [...M_CONTROLS, ...D_CONTROLS].filter((c) => c.type === 'knob').map((c) => c.id);

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const noteName = (n) => `${NOTE_NAMES[((n % 12) + 12) % 12]}${Math.floor(n / 12) + 2}`;

const mSeq = (notes) => {
  const steps = Array.from({ length: 32 }, () => ({ n: 0, r: true }));
  notes.forEach((n, i) => { steps[i] = n === null ? { n: 0, r: true } : { n, r: false }; });
  return steps;
};

export function defaultState() {
  return {
    p: { ...DEFAULT_PARAMS },
    dPitch: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
    dVel: [1, 0.3, 0.6, 0.3, 1, 0.3, 0.6, 0.8],
    mSteps: mSeq([0, 0, 12, 0, 3, 0, 10, 12, 0, 0, 12, 0, 7, 5, 3, null]),
    mLen: 16,
    cables: [],
  };
}

// Memórias: alterações em relação ao estado por defeito
export const PRESETS = [
  { name: 'Início', make: () => defaultState() },
  {
    name: 'Dupla em sincronia',
    make: () => {
      const s = defaultState();
      // O relógio de passos da unidade melódica avança a percussão
      s.cables = [['mAssign', 'dAdv']];
      Object.assign(s.p, { mCutoff: 0.35, mRes: 0.55, mVcfModAmt: 0.5, mDecay: 0.42, mWave: 0, fxDelayMix: 0.2 });
      s.dPitch = [0.5, 0.5, 0.62, 0.5, 0.5, 0.5, 0.62, 0.7];
      s.dVel = [1, 0.2, 0.7, 0.2, 1, 0.4, 0.7, 0.5];
      return s;
    },
  },
  {
    name: 'Metal FM',
    make: () => {
      const s = defaultState();
      Object.assign(s.p, {
        dFm: 0.6, dVco1Freq: 0.62, dVco2Freq: 0.71, dVco1Wave: 1, dVco2Lvl: 0.6, dVco1Eg: 0.55, dVco2Eg: 0.55,
        dCutoff: 0.7, dRes: 0.5, dVcfEg: 0.75, dVcfDecay: 0.3, dVcaDecay: 0.32, dSync: 1, dNoiseLvl: 0,
        mVol: 0, fxDelayMix: 0.3, fxReverb: 0.25,
      });
      s.dPitch = [0.5, 0.58, 0.44, 0.66, 0.5, 0.4, 0.61, 0.55];
      s.dVel = [1, 0.5, 0.8, 0.3, 1, 0.6, 0.4, 0.7];
      return s;
    },
  },
  {
    name: 'LFO no filtro',
    make: () => {
      const s = defaultState();
      // LFO triangular da unidade melódica abre o filtro da percussão; o EG modula o FM
      s.cables = [['mLfoTri', 'dVcfMod'], ['mAssign', 'dAdv'], ['mEg', 'dFmAmt']];
      Object.assign(s.p, {
        mVcfModSrc: 1, mVcfModAmt: 0.35, mLfoRate: 0.3, mWave: 1, mVcoModAmt: 0.5, mVcoModSrc: 1, mVcoModDest: 0,
        mSustain: 1, mDecay: 0.35, mGlide: 0.3, dNoiseMod: 0.5, dVco2Lvl: 0.5, dCutoff: 0.45, fxReverb: 0.3,
      });
      return s;
    },
  },
];

const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
export function randomDSeq() {
  const pitch = [], vel = [];
  for (let i = 0; i < 8; i++) {
    pitch.push(0.5 + Math.round(rnd(-7, 7)) / 120); // semitons, a 1 V por oitava
    vel.push(i === 0 ? 1 : Math.random() > 0.25 ? rnd(0.3, 1) : rnd(0, 0.12));
  }
  return { pitch, vel };
}
export function randomMSeq(len) {
  const scale = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];
  const steps = Array.from({ length: 32 }, () => ({ n: 0, r: true }));
  for (let i = 0; i < len; i++) {
    const rest = i !== 0 && Math.random() < 0.2;
    steps[i] = { n: i === 0 ? 0 : scale[Math.floor(Math.pow(Math.random(), 1.6) * scale.length)], r: rest };
  }
  return steps;
}
