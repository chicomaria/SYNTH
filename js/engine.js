// Liga o AudioWorklet (onde vivem os módulos) aos efeitos, ao osciloscópio e à saída.

import { TYPES } from './defs.js';

export class Engine {
  constructor(onStatus) {
    this.ctx = null;
    this.onStatus = onStatus;
  }

  async start(state) {
    if (this.ctx) {
      if (this.ctx.state !== 'running') await this.ctx.resume();
      return;
    }
    if (!this.starting) this.starting = this.init(state);
    return this.starting;
  }

  async init(state) {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC({ latencyHint: 'interactive' });
    await ctx.audioWorklet.addModule('js/worklet.js');
    this.node = new AudioWorkletNode(ctx, 'pulso', { numberOfInputs: 0, outputChannelCount: [1] });
    this.node.port.onmessage = (e) => this.onStatus(e.data);

    this.delay = ctx.createDelay(2);
    this.delayFb = ctx.createGain();
    this.delayTone = ctx.createBiquadFilter();
    this.delayTone.type = 'lowpass';
    this.delayTone.frequency.value = 4000;
    this.delaySend = ctx.createGain();
    this.node.connect(this.delaySend).connect(this.delay);
    this.delay.connect(this.delayTone).connect(this.delayFb).connect(this.delay);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(ctx, 2.8);
    this.reverbSend = ctx.createGain();
    this.node.connect(this.reverbSend).connect(this.reverb);

    this.master = ctx.createGain();
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -6;
    this.limiter.ratio.value = 12;
    this.limiter.attack.value = 0.002;
    this.limiter.release.value = 0.15;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.node.connect(this.master);
    this.delay.connect(this.master);
    this.reverb.connect(this.master);
    this.master.connect(this.limiter).connect(this.analyser).connect(ctx.destination);

    this.ctx = ctx;
    this.sync(state);
    if (ctx.state !== 'running') await ctx.resume();
  }

  makeImpulse(ctx, seconds) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return buf;
  }

  send(msg) { if (this.node) this.node.port.postMessage(msg); }

  addModule(m) {
    const t = TYPES[m.type];
    this.send({ t: 'add', def: { id: m.id, type: m.type, ins: t.ins, outs: t.outs, p: m.p, smooth: t.smooth, data: m.data } });
  }

  // Envia o rack completo (ao arrancar e ao carregar uma memória)
  sync(state) {
    if (!this.ctx) return;
    this.send({ t: 'clear' });
    state.mods.forEach((m) => this.addModule(m));
    this.send({ t: 'cables', list: state.cables });
    this.fx(state.fx);
  }

  fx(p) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const set = (param, v) => param.setTargetAtTime(v, t, 0.02);
    set(this.delay.delayTime, 0.03 + p.delayTime * 0.97);
    set(this.delayFb.gain, p.delayFb * 0.9);
    set(this.delaySend.gain, p.delayMix);
    set(this.reverbSend.gain, p.reverb * 0.8);
    set(this.master.gain, p.vol);
  }
}
