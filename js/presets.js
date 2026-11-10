// Valores por defeito, sons pré-memorizados e o randomizer.
// Todos os parâmetros estão normalizados em 0..1; o motor converte-os para Hz, segundos, etc.

export const DEFAULT_PARAMS = {
  vco1Freq: 0.3, vco1Wave: 0, vco1Level: 0.8, vco1EgAmt: 0.4,
  vco2Freq: 0.45, vco2Wave: 1, vco2Level: 0.2, vco2EgAmt: 0.2,
  fm: 0.1, noiseLevel: 0.1,
  cutoff: 0.45, resonance: 0.3, vcfEgAmt: 0.5, vcfDecay: 0.3,
  pitchDecay: 0.25, vcaDecay: 0.35,
  tempo: 0.4, swing: 0, volume: 0.8,
  delayTime: 0.35, delayFeedback: 0.4, delayMix: 0.15,
  reverbMix: 0.2,
};

export const DEFAULT_ROUTES = {
  pitchToVco1: true,
  pitchToVco2: true,
  pitchToVcf: false,
  velToVca: true,
  velToVcf: false,
};

const steps = (pitches, vels) =>
  pitches.map((p, i) => ({ pitch: p, vel: vels[i], on: vels[i] > 0.02 }));

export const PRESETS = [
  {
    name: 'Bombo',
    params: { ...DEFAULT_PARAMS, vco1Freq: 0.18, vco1Level: 1, vco1EgAmt: 0.55, vco2Level: 0, noiseLevel: 0.05, fm: 0,
      cutoff: 0.35, resonance: 0.1, vcfEgAmt: 0.4, pitchDecay: 0.2, vcaDecay: 0.4, tempo: 0.35, reverbMix: 0.1, delayMix: 0 },
    routes: { ...DEFAULT_ROUTES, pitchToVco2: false },
    steps: steps([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], [1, 0, 0, 0.6, 1, 0, 0.4, 0]),
  },
  {
    name: 'Metálico',
    params: { ...DEFAULT_PARAMS, vco1Freq: 0.55, vco1Wave: 1, vco2Freq: 0.72, vco2Wave: 1, vco2Level: 0.4, fm: 0.55,
      noiseLevel: 0, cutoff: 0.6, resonance: 0.55, vcfEgAmt: 0.6, vcfDecay: 0.2, pitchDecay: 0.1, vcaDecay: 0.25,
      delayMix: 0.3, delayTime: 0.25 },
    routes: { ...DEFAULT_ROUTES, pitchToVcf: true },
    steps: steps([0.5, 0.7, 0.4, 0.9, 0.5, 0.3, 0.75, 0.6], [1, 0.5, 0.8, 0.3, 1, 0.6, 0.4, 0.7]),
  },
  {
    name: 'Baixo ácido',
    params: { ...DEFAULT_PARAMS, vco1Freq: 0.22, vco1Wave: 1, vco1EgAmt: 0.05, vco2Freq: 0.32, vco2Level: 0.5,
      vco2EgAmt: 0.05, fm: 0, noiseLevel: 0, cutoff: 0.3, resonance: 0.75, vcfEgAmt: 0.65, vcfDecay: 0.28,
      pitchDecay: 0.1, vcaDecay: 0.32, tempo: 0.5, delayMix: 0.2, reverbMix: 0.15 },
    routes: { ...DEFAULT_ROUTES, velToVcf: true },
    steps: steps([0.5, 0.5, 0.75, 0.5, 0.58, 0.5, 0.33, 0.67], [1, 0.4, 0.9, 0, 1, 0.6, 0.8, 0.5]),
  },
  {
    name: 'Chuva',
    params: { ...DEFAULT_PARAMS, vco1Freq: 0.7, vco1Level: 0.3, vco1EgAmt: 0.3, vco2Level: 0, noiseLevel: 0.7,
      cutoff: 0.65, resonance: 0.65, vcfEgAmt: 0.3, vcfDecay: 0.1, pitchDecay: 0.05, vcaDecay: 0.12,
      tempo: 0.6, swing: 0.25, delayMix: 0.4, delayFeedback: 0.6, delayTime: 0.45, reverbMix: 0.5 },
    routes: { ...DEFAULT_ROUTES, pitchToVcf: true },
    steps: steps([0.6, 0.3, 0.8, 0.5, 0.9, 0.2, 0.7, 0.4], [0.8, 0.3, 0.6, 1, 0.2, 0.7, 0.5, 0.9]),
  },
];

const rnd = (min = 0, max = 1) => min + Math.random() * (max - min);

// Gera uma sequência nova: afinações quantizadas a semitons e alguns passos em silêncio
export function randomSteps() {
  return Array.from({ length: 8 }, (_, i) => {
    const semis = Math.round(rnd(-7, 7));
    const on = i === 0 || Math.random() > 0.3;
    return { pitch: 0.5 + semis / 48, vel: on ? rnd(0.35, 1) : 0, on };
  });
}

// Gera um som novo dentro de intervalos que soam quase sempre bem
export function randomParams(current) {
  return {
    ...current,
    vco1Freq: rnd(0.1, 0.65), vco1Wave: Math.random() > 0.5 ? 1 : 0, vco1Level: rnd(0.4, 1), vco1EgAmt: rnd(0, 0.7),
    vco2Freq: rnd(0.1, 0.8), vco2Wave: Math.random() > 0.5 ? 1 : 0, vco2Level: rnd(0, 0.6), vco2EgAmt: rnd(0, 0.5),
    fm: Math.random() > 0.5 ? rnd(0, 0.6) : 0, noiseLevel: Math.random() > 0.6 ? rnd(0, 0.6) : 0,
    cutoff: rnd(0.2, 0.75), resonance: rnd(0, 0.7), vcfEgAmt: rnd(0.1, 0.8), vcfDecay: rnd(0.08, 0.5),
    pitchDecay: rnd(0.05, 0.4), vcaDecay: rnd(0.1, 0.55),
  };
}
