// Motor de som: uma voz percussiva semi-modular construída com a Web Audio API.
// VCO1 + VCO2 (com FM de VCO2 para VCO1) + ruído -> filtro passa-baixo -> VCA -> efeitos -> saída.

const expMap = (v, min, max) => min * Math.pow(max / min, v); // v em 0..1

export class Engine {
  constructor() {
    this.ctx = null;
    this.params = {};
    this.routes = {};
  }

  async start() {
    if (this.ctx) {
      if (this.ctx.state !== 'running') await this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = (this.ctx = new AC({ latencyHint: 'interactive' }));

    // Fontes
    this.vco1 = ctx.createOscillator();
    this.vco2 = ctx.createOscillator();
    this.noise = ctx.createBufferSource();
    this.noise.buffer = this.makeNoise();
    this.noise.loop = true;

    // FM: VCO2 modula a frequência de VCO1
    this.fm = ctx.createGain();
    this.vco2.connect(this.fm).connect(this.vco1.frequency);

    // Mixer
    this.g1 = ctx.createGain();
    this.g2 = ctx.createGain();
    this.gn = ctx.createGain();
    this.vco1.connect(this.g1);
    this.vco2.connect(this.g2);
    this.noise.connect(this.gn);

    // Filtro e VCA
    this.vcf = ctx.createBiquadFilter();
    this.vcf.type = 'lowpass';
    this.vca = ctx.createGain();
    this.vca.gain.value = 0;
    [this.g1, this.g2, this.gn].forEach((g) => g.connect(this.vcf));
    this.vcf.connect(this.vca);

    // Barramento principal + efeitos
    this.bus = ctx.createGain();
    this.vca.connect(this.bus);

    this.delay = ctx.createDelay(2);
    this.delayFb = ctx.createGain();
    this.delayTone = ctx.createBiquadFilter();
    this.delayTone.type = 'lowpass';
    this.delayTone.frequency.value = 4000;
    this.delaySend = ctx.createGain();
    this.bus.connect(this.delaySend).connect(this.delay);
    this.delay.connect(this.delayTone).connect(this.delayFb).connect(this.delay);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(2.8);
    this.reverbSend = ctx.createGain();
    this.bus.connect(this.reverbSend).connect(this.reverb);

    this.master = ctx.createGain();
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -6;
    this.limiter.ratio.value = 12;
    this.limiter.attack.value = 0.002;
    this.limiter.release.value = 0.15;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;

    this.bus.connect(this.master);
    this.delay.connect(this.master);
    this.reverb.connect(this.master);
    this.master.connect(this.limiter).connect(this.analyser).connect(ctx.destination);

    this.vco1.start();
    this.vco2.start();
    this.noise.start();
    this.apply();
  }

  makeNoise() {
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // Resposta ao impulso sintética para o reverb (ruído com decaimento exponencial, estéreo)
  makeImpulse(seconds) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return buf;
  }

  setParams(params, routes) {
    this.params = params;
    this.routes = routes;
    this.apply();
  }

  // Parâmetros contínuos (não dependem de cada batida)
  apply() {
    if (!this.ctx) return;
    const p = this.params;
    const t = this.ctx.currentTime;
    const smooth = (param, v) => param.setTargetAtTime(v, t, 0.015);
    this.vco1.type = p.vco1Wave === 1 ? 'square' : 'triangle';
    this.vco2.type = p.vco2Wave === 1 ? 'square' : 'triangle';
    smooth(this.fm.gain, Math.pow(p.fm, 2) * 2000);
    smooth(this.g1.gain, p.vco1Level * 0.5);
    smooth(this.g2.gain, p.vco2Level * 0.5);
    smooth(this.gn.gain, p.noiseLevel * 0.5);
    smooth(this.vcf.Q, p.resonance * 22);
    smooth(this.delay.delayTime, 0.03 + p.delayTime * 0.97);
    smooth(this.delayFb.gain, p.delayFeedback * 0.9);
    smooth(this.delaySend.gain, p.delayMix);
    smooth(this.reverbSend.gain, p.reverbMix * 0.8);
    smooth(this.master.gain, p.volume);
    if (!this._hitScheduled) {
      this.vco1.frequency.setTargetAtTime(this.vco1Freq(0), t, 0.02);
      this.vco2.frequency.setTargetAtTime(this.vco2Freq(0), t, 0.02);
      this.vcf.frequency.setTargetAtTime(this.cutoffHz(0, 1), t, 0.02);
    }
  }

  vco1Freq(stepPitch) {
    const semis = this.routes.pitchToVco1 ? stepPitch * 24 : 0;
    return expMap(this.params.vco1Freq, 20, 2000) * Math.pow(2, semis / 12);
  }
  vco2Freq(stepPitch) {
    const semis = this.routes.pitchToVco2 ? stepPitch * 24 : 0;
    return expMap(this.params.vco2Freq, 10, 2000) * Math.pow(2, semis / 12);
  }
  cutoffHz(stepPitch, velocity) {
    let v = this.params.cutoff;
    if (this.routes.pitchToVcf) v += stepPitch * 0.3;
    if (this.routes.velToVcf) v -= (1 - velocity) * 0.35;
    return expMap(Math.min(1, Math.max(0, v)), 40, 16000);
  }

  // Dispara uma batida no tempo `time` (segundos do AudioContext)
  // stepPitch em -1..1, velocity em 0..1
  trigger(time, stepPitch = 0, velocity = 1) {
    if (!this.ctx) return;
    const p = this.params;
    this._hitScheduled = true;
    const t = Math.max(time, this.ctx.currentTime);
    const dec = (v) => 0.01 + Math.pow(v, 2) * 2.5; // 10 ms .. ~2.5 s

    // Envelope de afinação (desce do pico até à nota)
    const pitchDecay = dec(p.pitchDecay);
    [
      [this.vco1.frequency, this.vco1Freq(stepPitch), p.vco1EgAmt],
      [this.vco2.frequency, this.vco2Freq(stepPitch), p.vco2EgAmt],
    ].forEach(([param, f, amt]) => {
      const peak = Math.min(f * Math.pow(2, amt * 5), 20000);
      param.cancelScheduledValues(t);
      param.setValueAtTime(peak, t);
      param.exponentialRampToValueAtTime(Math.max(f, 1), t + pitchDecay);
    });

    // Envelope do filtro
    const base = this.cutoffHz(stepPitch, velocity);
    const peak = Math.min(base * Math.pow(2, p.vcfEgAmt * 7), 18000);
    const vcfDecay = dec(p.vcfDecay);
    this.vcf.frequency.cancelScheduledValues(t);
    this.vcf.frequency.setValueAtTime(peak, t);
    this.vcf.frequency.exponentialRampToValueAtTime(Math.max(base, 20), t + vcfDecay);

    // Envelope de amplitude
    const level = this.routes.velToVca ? Math.max(velocity, 0.0001) : 1;
    const vcaDecay = dec(p.vcaDecay);
    const g = this.vca.gain;
    // setTargetAtTime parte do valor que existir em `t`, por isso não há cliques
    g.cancelScheduledValues(t);
    g.setTargetAtTime(level, t, 0.001);
    g.setTargetAtTime(0, t + 0.005, vcaDecay / 4);
  }
}
