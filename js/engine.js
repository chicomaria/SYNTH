// Liga o AudioWorklet (onde vivem as duas unidades) aos efeitos, ao osciloscópio e à saída.

import { OUTS, INS, SMOOTH_KEYS } from './defs.js';

export class Engine {
  constructor(onSteps) {
    this.ctx = null;
    this.onSteps = onSteps;
    this.pending = [];
  }

  async start(state) {
    if (this.ctx) {
      if (this.ctx.state !== 'running') await this.ctx.resume();
      return;
    }
    if (this.starting) return this.starting;
    this.starting = this.init(state);
    return this.starting;
  }

  async init(state) {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC({ latencyHint: 'interactive' });
    await ctx.audioWorklet.addModule('js/worklet.js');
    this.node = new AudioWorkletNode(ctx, 'pulso', {
      numberOfInputs: 0,
      outputChannelCount: [1],
      processorOptions: { outs: OUTS, ins: INS, params: state.p, smooth: SMOOTH_KEYS },
    });
    this.node.port.onmessage = (e) => this.onSteps(e.data);

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

  // Envia o estado completo (ao arrancar e ao carregar uma memória)
  sync(state) {
    if (!this.ctx) return;
    this.send({ t: 'all', p: state.p });
    this.send({ t: 'cables', list: state.cables });
    this.send({ t: 'dsteps', pitch: state.dPitch, vel: state.dVel });
    this.send({ t: 'msteps', steps: state.mSteps, len: state.mLen });
    this.fx(state.p);
  }

  param(k, v, p) {
    if (k.startsWith('fx')) this.fx(p);
    else this.send({ t: 'p', k, v });
  }

  fx(p) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const set = (param, v) => param.setTargetAtTime(v, t, 0.02);
    set(this.delay.delayTime, 0.03 + p.fxDelayTime * 0.97);
    set(this.delayFb.gain, p.fxDelayFb * 0.9);
    set(this.delaySend.gain, p.fxDelayMix);
    set(this.reverbSend.gain, p.fxReverb * 0.8);
    set(this.master.gain, p.fxVol);
  }
}
