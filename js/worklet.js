// Motor de som: corre amostra a amostra num AudioWorklet.
// Cada módulo do rack é uma instância de uma das classes abaixo. Os sinais circulam em "volts":
// áudio ±5, envelopes 0..8, afinação a 1 V por oitava. Qualquer saída pode ligar a qualquer entrada
// de qualquer módulo; vários cabos na mesma entrada somam-se.

const TWO_PI = Math.PI * 2;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const idx = (a) => { const o = {}; a.forEach((n, i) => (o[n] = i)); return o; };
const decayCoef = (v) => Math.exp(-4.6 / (sampleRate * 0.01 * Math.pow(1000, clamp(v, 0, 1))));

function blep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}
const sawOsc = (ph, dt) => 2 * ph - 1 - blep(ph, dt);
function sqOsc(ph, dt, pw) {
  let p2 = ph + 1 - pw; if (p2 >= 1) p2 -= 1;
  return (ph < pw ? 1 : -1) + blep(ph, dt) - blep(p2, dt);
}

// Filtro ladder de 4 polos com saturação e ressonância auto-oscilante (2x oversampling)
class Ladder {
  constructor() { this.a = this.b = this.c = this.d = 0; }
  run(x, fc, k, hp) {
    const g = Math.min(1 - Math.exp((-TWO_PI * clamp(fc, 10, 18000)) / (2 * sampleRate)), 0.75);
    let u = 0;
    for (let i = 0; i < 2; i++) {
      u = Math.tanh(x - k * this.d);
      this.a += g * (u - this.a);
      this.b += g * (this.a - this.b);
      this.c += g * (this.b - this.c);
      this.d += g * (this.c - this.d);
    }
    if (hp) return u - 4 * this.a + 6 * this.b - 4 * this.c + this.d;
    return this.d * (1 + k * 0.3);
  }
}

// Filtro de estado variável (passa-banda e passa-baixo)
class Svf {
  constructor() { this.x1 = this.x2 = 0; this.a1 = this.a2 = this.a3 = 0; this.k = 1; this.lp = 0; }
  set(fc, q) {
    const g = Math.tan((Math.PI * clamp(fc, 20, sampleRate * 0.45)) / sampleRate);
    this.k = 1 / q;
    this.a1 = 1 / (1 + g * (g + this.k));
    this.a2 = g * this.a1;
    this.a3 = g * this.a2;
  }
  // devolve o passa-banda normalizado; o passa-baixo fica em this.lp
  run(x) {
    const v3 = x - this.x2;
    const v1 = this.a1 * this.x1 + this.a2 * v3;
    const v2 = this.x2 + this.a2 * this.x1 + this.a3 * v3;
    this.x1 = 2 * v1 - this.x1;
    this.x2 = 2 * v2 - this.x2;
    this.lp = v2;
    this.hp = x - this.k * v1 - v2;
    return v1 * this.k;
  }
}

class Mod {
  constructor(d) {
    this.id = d.id;
    this.O = idx(d.outs);
    this.I = idx(d.ins);
    this.o = new Float64Array(d.outs.length);
    this.sa = d.ins.map(() => []);
    this.si = d.ins.map(() => []);
    this.p = { ...d.p };
    this.s = { ...d.p };
    this.smooth = d.smooth;
    this.data = d.data || {};
    this.last = '';
    this.mix = d.mix || { level: 0.8, pan: 0.5, fx1: 0.25, fx2: 0.25 };
    this.gL = this.gR = this.gF1 = this.gF2 = 0;
    this.on = 1;
    this.pk = 0;
    this.init();
  }
  init() {}
  cmd() {}
  setData(k, v) { this.data[k] = v; }
  status() { return []; }
  inp(i, d) {
    const a = this.sa[i], n = a.length;
    if (n === 0) return d;
    const si = this.si[i];
    let v = 0;
    for (let k = 0; k < n; k++) v += a[k][si[k]];
    return v;
  }
  pat(i) { return this.sa[i].length > 0; }
  pre(anySolo) {
    const { s, p } = this;
    for (const k of this.smooth) s[k] += (p[k] - s[k]) * 0.3;
    // mixer: mute/solo, pan de potência constante e dois envios (FX1 → reverb, FX2 → delay)
    const { pan, fx1 = 0, fx2 = 0, mute, solo } = this.mix, a = pan * Math.PI * 0.5;
    this.on = mute || (anySolo && !solo) ? 0 : 1;
    const level = this.mix.level * this.on;
    this.gL += (level * Math.cos(a) * 1.414 - this.gL) * 0.3;
    this.gR += (level * Math.sin(a) * 1.414 - this.gR) * 0.3;
    this.gF1 += (level * fx1 - this.gF1) * 0.3;
    this.gF2 += (level * fx2 - this.gF2) * 0.3;
    this.block();
  }
}

// ============ M: monossintetizador melódico (arquitetura do Mother-32) ============
class ModM extends Mod {
  init() {
    this.step = -1; this.phase = 1; this.wasRun = false;
    this.seqGate = false; this.keyGate = false; this.note = 0;
    this.extInc = 8 / sampleRate; this.clkN = 0; this.prevClk = 0; this.edge = false;
    this.kb = -2; this.eg = 0; this.stage = 0; this.prevGate = false;
    this.lfo = 0; this.ph = 0; this.prevReset = 0;
    this.filter = new Ladder();
  }
  cmd(m) {
    if (m.c === 'noteOn') { this.note = m.n; this.keyGate = true; }
    if (m.c === 'noteOff') this.keyGate = false;
  }
  status() { return [this.step]; }
  block() {
    const { s, p, I } = this, sr = sampleRate;
    // TEMPO ligado: a entrada funciona como relógio externo (cada flanco ascendente é um passo)
    this.ext = this.pat(I.tempo);
    this.stepInc = this.ext ? this.extInc : ((30 * Math.pow(10, s.tempo)) / 60) * 4 / sr;
    this.gateLen = 0.1 + 0.88 * s.gateLen;
    this.glideC = s.glide < 0.01 ? 1 : 1 - Math.exp(-3 / (sr * 0.005 * Math.pow(400, s.glide)));
    this.atkInc = 1 / (sr * 0.001 * Math.pow(10000, s.attack));
    this.decC = Math.exp(-4.6 / (sr * 0.002 * Math.pow(5000, s.decay)));
    this.lfoInc = (0.1 * Math.pow(3500, s.lfoRate) * Math.pow(2, clamp(this.inp(I.lfoRate, 0), -5, 5))) / sr;
    this.cutBase = 20 * Math.pow(1000, s.cutoff);
    this.running = this.pat(I.run) ? this.inp(I.run, 0) > 1 : !!p.run;
    if (this.running && !this.wasRun) { this.step = -1; this.phase = 1; }
    if (!this.running && this.wasRun) { this.seqGate = false; this.step = -1; }
    this.wasRun = this.running;
  }
  tick() {
    const { s, p, I, O, o } = this, sr = sampleRate;
    const reset = this.inp(I.reset, 0);
    if (reset > 1 && this.prevReset <= 1) { this.step = -1; this.phase = 1; }
    this.prevReset = reset;
    if (this.ext) {
      const c = this.inp(I.tempo, 0);
      this.clkN++;
      if (c > 1 && this.prevClk <= 1) {
        if (this.clkN > 32) this.extInc = 1 / this.clkN; // mede o período para o gate length
        this.clkN = 0;
        if (!(this.inp(I.hold, 0) > 1)) this.phase = 1;
      } else if (this.phase < 0.999) this.phase = Math.min(0.999, this.phase + this.extInc);
      this.prevClk = c;
    }
    if (this.running || this.ext) {
      if (!this.ext && !(this.inp(I.hold, 0) > 1)) this.phase += this.stepInc;
      if (this.phase >= 1) {
        this.phase -= 1;
        if (this.phase >= 1) this.phase = 0;
        const steps = this.data.steps || [], len = this.data.len || 16;
        this.step = (this.step + 1) % len;
        const st = steps[this.step];
        if (st && !st.r) { if (!this.keyGate) this.note = st.n; this.seqGate = true; } else this.seqGate = false;
      }
      if (this.phase > this.gateLen) this.seqGate = false;
    }
    const clock = (this.running || this.ext) && this.step >= 0 && this.phase < 0.5 ? 5 : 0;
    const gate = this.seqGate || this.keyGate || this.inp(I.gate, 0) > 1;
    this.kb += (this.note / 12 - 2 - this.kb) * this.glideC;

    if (gate && !this.prevGate) this.stage = 1;
    if (!gate && this.prevGate) this.stage = 3;
    this.prevGate = gate;
    if (this.stage === 1) {
      this.eg += this.atkInc;
      if (this.eg >= 1) { this.eg = 1; this.stage = p.sustain ? 2 : 3; }
    } else if (this.stage === 3) {
      this.eg *= this.decC;
      if (this.eg < 1e-5) { this.eg = 0; this.stage = 0; }
    }
    const egV = this.eg * 8;

    this.lfo += this.lfoInc;
    if (this.lfo >= 1) this.lfo -= Math.floor(this.lfo);
    const lfoTri = 5 * (this.lfo < 0.5 ? 4 * this.lfo - 1 : 3 - 4 * this.lfo);
    const lfoSq = this.lfo < 0.5 ? 5 : -5;
    const lfoSel = p.lfoWave ? lfoSq : lfoTri;

    const vcoMod = (this.pat(I.vcoMod) ? this.inp(I.vcoMod, 0) : p.vcoModSrc ? lfoSel : egV) * s.vcoModAmt;
    const toFreq = p.vcoModDest === 1;
    const pitch = (s.freq - 0.5) * 2 + this.kb + this.inp(I.voct, 0) + (toFreq ? vcoMod * 0.4 : 0);
    const f = clamp(261.63 * Math.pow(2, clamp(pitch, -12, 8)) * (1 + this.inp(I.linFm, 0) / 5), 0, sr * 0.45);
    const dt = f / sr;
    this.ph += dt;
    if (this.ph >= 1) this.ph -= 1;
    const pw = clamp(0.5 + (s.pw - 0.5) * 0.9 + (toFreq ? 0 : vcoMod * 0.09), 0.03, 0.97);
    const saw = sawOsc(this.ph, dt);
    const pulse = sqOsc(this.ph, dt, pw);
    const noise = Math.random() * 2 - 1;

    const mixAmt = clamp(s.mix + this.inp(I.mixCv, 0) / 5, 0, 1);
    const mixB = this.pat(I.ext) ? this.inp(I.ext, 0) / 5 : noise;
    const pre = (p.wave ? pulse : saw) * (1 - mixAmt) + mixB * mixAmt;
    const vcfMod = (p.vcfModSrc ? lfoSel : egV) * s.vcfModAmt * (p.vcfModPol ? -1 : 1) + this.inp(I.cutoff, 0);
    const k = clamp(s.res + this.inp(I.res, 0) / 5, 0, 1) * 4.3;
    const vcf = this.filter.run(pre * 0.8, this.cutBase * Math.pow(2, clamp(vcfMod, -12, 12)), k, p.vcfMode);
    const gain = clamp((p.vcaMode ? 1 : this.eg) + this.inp(I.vcaCv, 0) / 8, 0, 1);
    const out = vcf * gain;

    const mult = this.inp(I.mult, 0);
    const vcMix = clamp(s.vcMix + this.inp(I.vcMixCtrl, 0) / 5, 0, 1);
    o[O.vca] = out * 5; o[O.noise] = noise * 5; o[O.vcf] = vcf * 5;
    o[O.saw] = saw * 5; o[O.pulse] = pulse * 5; o[O.lfoTri] = lfoTri; o[O.lfoSq] = lfoSq;
    o[O.vcMix] = this.inp(I.mix1, 0) * (1 - vcMix) + this.inp(I.mix2, 0) * vcMix;
    o[O.mult1] = mult; o[O.mult2] = mult;
    o[O.assign] = clock; o[O.eg] = egV; o[O.kb] = this.kb; o[O.gateOut] = gate ? 5 : 0;
    return out * s.vol;
  }
}

// ============ D: sintetizador de percussão (arquitetura do DFAM) ============
const D_PITCH = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `pitch${n}`);
const D_VEL = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `vel${n}`);
class ModD extends Mod {
  init() {
    this.step = 0; this.phase = 1; this.wasRun = false;
    this.manualFire = false; this.advance = false;
    this.prevAdv = 0; this.prevTrig = 0; this.trigCount = 0;
    this.vcoEg = 0; this.vcfEg = 0; this.vcaEg = 0; this.vcaTarget = 0; this.vcaAtk = false;
    this.ph1 = 0; this.ph2 = 0;
    this.filter = new Ladder();
  }
  cmd(m) {
    if (m.c === 'trig') this.manualFire = true;
    if (m.c === 'adv') this.advance = true;
  }
  status() { return [this.step]; }
  block() {
    const { s, p, I } = this, sr = sampleRate;
    this.stepInc = ((10 * Math.pow(1000, s.tempo)) / 60) * Math.pow(2, clamp(this.inp(I.tempo, 0), -5, 5)) / sr;
    this.vcoDecC = decayCoef(s.vcoDecay + this.inp(I.vcoDecay, 0) / 10);
    this.vcfDecC = decayCoef(s.vcfDecay + this.inp(I.vcfDecay, 0) / 10);
    this.vcaDecC = decayCoef(s.vcaDecay + this.inp(I.vcaDecay, 0) / 10);
    this.atkInc = 1 / (sr * (p.vcaEg ? 0.012 : 0.0008));
    this.cutBase = 20 * Math.pow(1000, s.cutoff);
    this.running = this.pat(I.run) ? this.inp(I.run, 0) > 1 : !!p.run;
    if (this.running && !this.wasRun) this.phase = 1;
    this.wasRun = this.running;
    this.advPatched = this.pat(I.adv);
    this.trigPatched = this.pat(I.trig);
  }
  tick() {
    const { s, p, I, O, o } = this, sr = sampleRate;
    let advance = this.advance, fire = this.manualFire;
    this.advance = this.manualFire = false;
    if (this.advPatched) {
      const a = this.inp(I.adv, 0);
      if (a > 1 && this.prevAdv <= 1) { advance = true; fire = fire || !this.trigPatched; this.trigCount = 240; }
      this.prevAdv = a;
    } else if (this.running) {
      this.phase += this.stepInc;
      if (this.phase >= 1) {
        this.phase -= 1;
        if (this.phase >= 1) this.phase = 0;
        advance = true; fire = fire || !this.trigPatched; this.trigCount = 240;
      }
    }
    if (advance) this.step = (this.step + 1) % 8;
    if (this.trigPatched) {
      const t = this.inp(I.trig, 0);
      if (t > 1 && this.prevTrig <= 1) fire = true;
      this.prevTrig = t;
    }
    const seqVel = p[D_VEL[this.step]] * 5;
    const seqPitch = (p[D_PITCH[this.step]] - 0.5) * 10;
    if (fire) {
      const vel = this.pat(I.vel) ? clamp(this.inp(I.vel, 0), 0, 5) : seqVel;
      this.vcoEg = 1; this.vcfEg = 1;
      this.vcaTarget = vel / 5; this.vcaAtk = true;
    }
    this.vcoEg *= this.vcoDecC; if (this.vcoEg < 1e-5) this.vcoEg = 0;
    this.vcfEg *= this.vcfDecC; if (this.vcfEg < 1e-5) this.vcfEg = 0;
    if (this.vcaAtk) {
      this.vcaEg += this.atkInc;
      if (this.vcaEg >= this.vcaTarget) { this.vcaEg = this.vcaTarget; this.vcaAtk = false; }
    } else {
      this.vcaEg *= this.vcaDecC; if (this.vcaEg < 1e-5) this.vcaEg = 0;
    }
    const trigOut = this.trigCount > 0 ? 5 : 0;
    if (this.trigCount > 0) this.trigCount--;

    const sw = p.seqPitch; // 0 = VCO 1&2, 1 = OFF, 2 = VCO 2
    const v1 = (s.vco1Freq - 0.5) * 10 + (sw === 0 ? seqPitch : 0) + (s.vco1Eg - 0.5) * 10 * this.vcoEg + this.inp(I.vco1Cv, 0);
    const dt1 = clamp(130.81 * Math.pow(2, clamp(v1, -10, 9)), 0, sr * 0.45) / sr;
    this.ph1 += dt1;
    let synced = false;
    if (this.ph1 >= 1) { this.ph1 -= 1; synced = true; }
    const o1 = p.vco1Wave ? sqOsc(this.ph1, dt1, 0.5) : 4 * Math.abs(this.ph1 - 0.5) - 1;

    const fm = clamp(s.fm + this.inp(I.fmAmt, 0) / 5, 0, 1);
    const v2 = (s.vco2Freq - 0.5) * 10 + (sw !== 1 ? seqPitch : 0) + (s.vco2Eg - 0.5) * 10 * this.vcoEg + this.inp(I.vco2Cv, 0);
    const f2 = 130.81 * Math.pow(2, clamp(v2, -10, 9)) * (1 + fm * fm * 12 * o1);
    const dt2 = clamp(Math.abs(f2), 0, sr * 0.45) / sr;
    this.ph2 += dt2;
    if (this.ph2 >= 1) this.ph2 -= 1;
    if (synced && p.sync) this.ph2 = dt1 > 0 ? clamp((this.ph1 / dt1) * dt2, 0, 0.999) : 0;
    const o2 = p.vco2Wave ? sqOsc(this.ph2, dt2, 0.5) : 4 * Math.abs(this.ph2 - 0.5) - 1;

    const noise = Math.random() * 2 - 1;
    const nLvl = clamp(s.noiseLvl + this.inp(I.noiseLvl, 0) / 5, 0, 1);
    const third = this.pat(I.ext) ? this.inp(I.ext, 0) / 5 : noise;
    const pre = (o1 * s.vco1Lvl + o2 * s.vco2Lvl + third * nLvl) * 0.8;
    const modSrc = this.pat(I.vcfMod) ? this.inp(I.vcfMod, 0) / 5 : noise;
    const fc = this.cutBase * Math.pow(2, clamp((s.vcfEg - 0.5) * 16 * this.vcfEg + modSrc * s.noiseMod * 5, -12, 12));
    const vcf = this.filter.run(pre, fc, s.res * 4.3, p.vcfMode);
    const out = vcf * clamp(this.vcaEg + this.inp(I.vcaCv, 0) / 8, 0, 1);

    o[O.vca] = out * 5; o[O.vcaEg] = this.vcaEg * 8; o[O.vcfEg] = this.vcfEg * 8; o[O.vcoEg] = this.vcoEg * 8;
    o[O.vco1] = o1 * 5; o[O.vco2] = o2 * 5;
    o[O.trigOut] = trigOut; o[O.velOut] = seqVel; o[O.pitch] = seqPitch;
    return out * s.vol;
  }
}

// ============ S: sintetizador sub-harmónico polirrítmico (arquitetura do Subharmonicon) ============
const S_RANGE = [5, 2, 1];
class ModS extends Mod {
  init() {
    this.phase = 1; this.wasRun = false; this.prevClock = 0; this.prevReset = 0; this.prevTrig = 0;
    this.cnt = [0, 0, 0, 0]; this.rd = [1, 1, 1, 1];
    this.step1 = 3; this.step2 = 3;
    this.clk1 = 0; this.clk2 = 0; this.clkOut = 0; this.trig = 0;
    this.vcaEg = 0; this.vcaSt = 0; this.vcfEg = 0; this.vcfSt = 0;
    this.ph = new Float64Array(6);
    this.filter = new Ladder();
  }
  status() { return [this.step1, this.step2]; }
  block() {
    const { s, p, I } = this, sr = sampleRate;
    this.inc = ((20 * Math.pow(150, s.tempo)) / 60) * 4 / sr;
    for (let r = 0; r < 4; r++) {
      this.rd[r] = clamp(Math.round(1 + 15 * p[`rhythm${r + 1}`] + this.inp(I[`rhythm${r + 1}`], 0) * 1.6), 1, 16);
    }
    this.vcaAtk = 1 / (sr * 0.001 * Math.pow(5000, s.vcaAttack));
    this.vcfAtk = 1 / (sr * 0.001 * Math.pow(5000, s.vcfAttack));
    this.vcaDecC = decayCoef(s.vcaDecay);
    this.vcfDecC = decayCoef(s.vcfDecay);
    this.cutBase = 20 * Math.pow(1000, s.cutoff);
    this.running = this.pat(I.play) ? this.inp(I.play, 0) > 1 : !!p.run;
    if (this.running && !this.wasRun) this.phase = 1;
    this.wasRun = this.running;
    this.div = [p.sub1Div, p.sub2Div, p.sub3Div, p.sub4Div].map((v) => Math.round(1 + 15 * v));
    this.range = S_RANGE[p.seqOct] || 1;
  }
  quant(v) { return this.p.quant ? Math.round(v * 12) / 12 : v; }
  tick() {
    const { s, p, I, O, o } = this, sr = sampleRate;
    let tickNow = false, fire = false;
    if (this.pat(I.clock)) {
      const c = this.inp(I.clock, 0);
      if (c > 1 && this.prevClock <= 1) tickNow = true;
      this.prevClock = c;
    } else if (this.running) {
      this.phase += this.inc;
      if (this.phase >= 1) { this.phase -= 1; if (this.phase >= 1) this.phase = 0; tickNow = true; }
    }
    const reset = this.inp(I.reset, 0);
    if (reset > 1 && this.prevReset <= 1) {
      this.step1 = this.step2 = 3;
      for (let r = 0; r < 4; r++) this.cnt[r] = this.rd[r] - 1;
    }
    this.prevReset = reset;
    if (tickNow) {
      this.clkOut = 240;
      let a1 = false, a2 = false;
      for (let r = 0; r < 4; r++) {
        if (++this.cnt[r] >= this.rd[r]) {
          this.cnt[r] = 0;
          if (p[`r${r + 1}s1`]) a1 = true;
          if (p[`r${r + 1}s2`]) a2 = true;
        }
      }
      if (a1) { this.step1 = (this.step1 + 1) % 4; this.clk1 = 240; fire = true; }
      if (a2) { this.step2 = (this.step2 + 1) % 4; this.clk2 = 240; fire = true; }
    }
    const t = this.inp(I.trigger, 0);
    if (t > 1 && this.prevTrig <= 1) fire = true;
    this.prevTrig = t;
    if (fire) { this.vcaSt = 1; this.vcfSt = 1; this.trig = 240; }
    if (this.vcaSt === 1) { this.vcaEg += this.vcaAtk; if (this.vcaEg >= 1) { this.vcaEg = 1; this.vcaSt = 2; } }
    else { this.vcaEg *= this.vcaDecC; if (this.vcaEg < 1e-5) this.vcaEg = 0; }
    if (this.vcfSt === 1) { this.vcfEg += this.vcfAtk; if (this.vcfEg >= 1) { this.vcfEg = 1; this.vcfSt = 2; } }
    else { this.vcfEg *= this.vcfDecC; if (this.vcfEg < 1e-5) this.vcfEg = 0; }

    const sv1 = (p[`a${this.step1 + 1}`] - 0.5) * 2, sv2 = (p[`b${this.step2 + 1}`] - 0.5) * 2;
    const seq1 = this.quant(sv1 * this.range), seq2 = this.quant(sv2 * this.range);
    const pitch1 = this.quant((s.vco1Freq - 0.5) * 6) + (p.s1Osc ? seq1 : 0) + this.inp(I.vco1, 0);
    const pitch2 = this.quant((s.vco2Freq - 0.5) * 6) + (p.s2Osc ? seq2 : 0) + this.inp(I.vco2, 0);
    const f1 = 261.63 * Math.pow(2, clamp(pitch1, -8, 6)), f2 = 261.63 * Math.pow(2, clamp(pitch2, -8, 6));
    const sub1 = this.inp(I.vco1Sub, 0) * 1.6, sub2 = this.inp(I.vco2Sub, 0) * 1.6;
    const d = this.div;
    const fr = [
      f1,
      f1 / clamp(d[0] - (p.s1Sub1 ? Math.round(sv1 * 8) : 0) - Math.round(sub1), 1, 16),
      f1 / clamp(d[1] - (p.s1Sub2 ? Math.round(sv1 * 8) : 0) - Math.round(sub1), 1, 16),
      f2,
      f2 / clamp(d[2] - (p.s2Sub1 ? Math.round(sv2 * 8) : 0) - Math.round(sub2), 1, 16),
      f2 / clamp(d[3] - (p.s2Sub2 ? Math.round(sv2 * 8) : 0) - Math.round(sub2), 1, 16),
    ];
    const pw1 = clamp(0.5 + this.inp(I.vco1Pwm, 0) * 0.09, 0.05, 0.95);
    const pw2 = clamp(0.5 + this.inp(I.vco2Pwm, 0) * 0.09, 0.05, 0.95);
    const w = this.w || (this.w = new Float64Array(6));
    for (let i = 0; i < 6; i++) {
      const dt = clamp(fr[i], 0, sr * 0.45) / sr;
      let ph = this.ph[i] + dt; if (ph >= 1) ph -= 1;
      this.ph[i] = ph;
      const sq = i < 3 ? p.vco1Wave : p.vco2Wave;
      w[i] = sq ? sqOsc(ph, dt, i < 3 ? pw1 : pw2) : sawOsc(ph, dt);
    }
    const pre = (w[0] * s.vco1Lvl + w[1] * s.sub1Lvl + w[2] * s.sub2Lvl + w[3] * s.vco2Lvl + w[4] * s.sub3Lvl + w[5] * s.sub4Lvl) * 0.45;
    const fc = this.cutBase * Math.pow(2, clamp((s.vcfEg - 0.5) * 16 * this.vcfEg + this.inp(I.cutoff, 0), -12, 12));
    const vcf = this.filter.run(pre, fc, s.res * 4.3, 0);
    const out = vcf * clamp(this.vcaEg + this.inp(I.vca, 0) / 8, 0, 1);

    o[O.vco1] = w[0] * 5; o[O.sub1] = w[1] * 5; o[O.sub2] = w[2] * 5;
    o[O.vco2] = w[3] * 5; o[O.sub3] = w[4] * 5; o[O.sub4] = w[5] * 5;
    o[O.vcaOut] = out * 5; o[O.vcaEg] = this.vcaEg * 8; o[O.vcfEg] = this.vcfEg * 8;
    o[O.seq1] = seq1; o[O.seq2] = seq2;
    o[O.seq1Clk] = this.clk1 > 0 ? 5 : 0; o[O.seq2Clk] = this.clk2 > 0 ? 5 : 0;
    o[O.trigOut] = this.trig > 0 ? 5 : 0; o[O.clockOut] = this.clkOut > 0 ? 5 : 0;
    if (this.clk1 > 0) this.clk1--; if (this.clk2 > 0) this.clk2--;
    if (this.trig > 0) this.trig--; if (this.clkOut > 0) this.clkOut--;
    return out * s.vol;
  }
}

// ============ L: sintetizador generativo com wavefolder (arquitetura do Labyrinth) ============
const PENTA = [0, 3, 5, 7, 10];
class ModL extends Mod {
  init() {
    this.phase = 1; this.wasRun = false; this.prevClock = 0; this.prevReset = 0; this.pt1 = 0; this.pt2 = 0;
    this.step = [-1, -1];
    this.bits = [new Uint8Array(8), new Uint8Array(8)];
    this.cv = [new Float64Array(8), new Float64Array(8)];
    this.reseed();
    this.eg1 = 0; this.a1 = false; this.eg2 = 0;
    this.t1 = 0; this.t2 = 0; this.clk = 0;
    this.ph = 0; this.mph = 0;
    this.svf = new Svf();
  }
  reseed() {
    for (let q = 0; q < 2; q++) for (let i = 0; i < 8; i++) {
      this.bits[q][i] = i === 0 || Math.random() < 0.6 ? 1 : 0;
      this.cv[q][i] = Math.random() * 2 - 1;
    }
  }
  cmd(m) {
    if (m.c === 'rseq') this.reseed();
    if (m.c === 'bit') this.bits[m.q][m.i] ^= 1;
  }
  status() {
    const mask = (b) => b.reduce((a, v, i) => a | (v << i), 0);
    return [this.step[0], this.step[1], mask(this.bits[0]), mask(this.bits[1])];
  }
  block() {
    const { s, p, I } = this, sr = sampleRate;
    this.inc = ((30 * Math.pow(10, s.tempo)) / 60) * 4 * Math.pow(2, clamp(this.inp(I.tempo, 0), -5, 5)) / sr;
    this.d1C = decayCoef(s.eg1Decay + this.inp(I.decay1, 0) / 10);
    this.d2C = decayCoef(s.eg2Decay + this.inp(I.decay2, 0) / 10);
    this.len = [1 + Math.round(7 * p.seq1Len), 1 + Math.round(7 * p.seq2Len)];
    this.cor = [clamp(s.seq1Corrupt + this.inp(I.corrupt1, 0) / 5, 0, 1), clamp(s.seq2Corrupt + this.inp(I.corrupt2, 0) / 5, 0, 1)];
    this.cutBase = 20 * Math.pow(1000, s.cutoff);
    this.running = this.pat(I.run) ? this.inp(I.run, 0) > 1 : !!p.run;
    if (this.running && !this.wasRun) this.phase = 1;
    this.wasRun = this.running;
    this.atk = 1 / (sr * 0.001);
  }
  quant(v) {
    const q = this.p.quant;
    if (!q) return v;
    const semis = Math.round(v * 12);
    if (q === 1) return semis / 12;
    const oct = Math.floor(semis / 12), n = semis - oct * 12;
    let best = 0;
    for (const x of PENTA) if (Math.abs(x - n) < Math.abs(best - n)) best = x;
    return oct + best / 12;
  }
  tick() {
    const { s, p, I, O, o } = this, sr = sampleRate;
    let tickNow = false, f1 = false, f2 = false;
    if (this.pat(I.clock)) {
      const c = this.inp(I.clock, 0);
      if (c > 1 && this.prevClock <= 1) tickNow = true;
      this.prevClock = c;
    } else if (this.running) {
      this.phase += this.inc;
      if (this.phase >= 1) { this.phase -= 1; if (this.phase >= 1) this.phase = 0; tickNow = true; }
    }
    const reset = this.inp(I.reset, 0);
    if (reset > 1 && this.prevReset <= 1) this.step[0] = this.step[1] = -1;
    this.prevReset = reset;
    if (tickNow) {
      this.clk = 240;
      for (let q = 0; q < 2; q++) {
        const st = (this.step[q] = (this.step[q] + 1) % this.len[q]);
        const c = this.cor[q];
        if (Math.random() < c * c) {
          if (Math.random() < 0.5) this.bits[q][st] ^= 1;
          this.cv[q][st] = Math.random() * 2 - 1;
        }
        if (this.bits[q][st]) { if (q === 0) { f1 = true; this.t1 = 240; } else { f2 = true; this.t2 = 240; } }
      }
    }
    if (this.pat(I.trig1)) { const t = this.inp(I.trig1, 0); f1 = t > 1 && this.pt1 <= 1; this.pt1 = t; }
    if (this.pat(I.trig2)) { const t = this.inp(I.trig2, 0); f2 = t > 1 && this.pt2 <= 1; this.pt2 = t; }
    if (f1) this.a1 = true;
    if (f2) this.eg2 = 1;
    if (this.a1) { this.eg1 += this.atk; if (this.eg1 >= 1) { this.eg1 = 1; this.a1 = false; } }
    else { this.eg1 *= this.d1C; if (this.eg1 < 1e-5) this.eg1 = 0; }
    this.eg2 *= this.d2C; if (this.eg2 < 1e-5) this.eg2 = 0;

    const st1 = Math.max(this.step[0], 0), st2 = Math.max(this.step[1], 0);
    const seq1 = this.quant(this.cv[0][st1] * s.seq1Range * 2);
    const seq2 = this.cv[1][st2] * s.seq2Range * 5;

    const mf = clamp(8.18 * Math.pow(2, clamp((s.modFreq) * 10 + this.inp(I.modCv, 0), -4, 11)), 0, sr * 0.45);
    this.mph += mf / sr; if (this.mph >= 1) this.mph -= 1;
    const mod = Math.sin(TWO_PI * this.mph);
    const fm = clamp(s.fm + this.inp(I.fmAmt, 0) / 5, 0, 1);
    const pitch = (s.vcoFreq - 0.5) * 8 + seq1 + (s.vcoEg - 0.5) * 8 * this.eg1 + this.inp(I.vcoCv, 0);
    const f = clamp(Math.abs(130.81 * Math.pow(2, clamp(pitch, -9, 8)) * (1 + fm * fm * 8 * mod)), 0, sr * 0.45);
    this.ph += f / sr; if (this.ph >= 1) this.ph -= 1;
    const vco = Math.sin(TWO_PI * this.ph);
    const noise = Math.random() * 2 - 1;

    const pre = vco * s.vcoLvl + mod * s.modLvl + noise * s.noiseLvl + this.inp(I.audio, 0) / 5;
    const foldAmt = clamp(s.fold + s.foldEg * this.eg2 + this.inp(I.fold, 0) / 5, 0, 1.5);
    const folded = Math.sin(pre * (1 + foldAmt * 6) * 1.5708);
    const fc = this.cutBase * Math.pow(2, clamp((s.vcfEg - 0.5) * 14 * this.eg2 + seq2 * 0.8 + this.inp(I.cutoff, 0), -12, 12));
    this.svf.set(fc, 0.5 + s.res * s.res * 24);
    const bp = this.svf.run(folded) * (1 + s.res * 2);
    const filt = this.svf.lp * (1 - s.filtMode) + bp * s.filtMode;
    const sig = folded * (1 - s.blend) + Math.tanh(filt) * s.blend;
    const out = sig * clamp(this.eg1 + this.inp(I.vcaCv, 0) / 8, 0, 1);

    o[O.vco] = vco * 5; o[O.mod] = mod * 5; o[O.noise] = noise * 5; o[O.foldOut] = folded * 5; o[O.vcf] = filt * 5;
    o[O.vca] = out * 5; o[O.eg1] = this.eg1 * 8; o[O.eg2] = this.eg2 * 8; o[O.seq1] = seq1; o[O.seq2] = seq2;
    o[O.clockOut] = this.clk > 0 ? 5 : 0; o[O.trig1Out] = this.t1 > 0 ? 5 : 0; o[O.trig2Out] = this.t2 > 0 ? 5 : 0;
    if (this.clk > 0) this.clk--; if (this.t1 > 0) this.t1--; if (this.t2 > 0) this.t2--;
    return out * s.vol;
  }
}

// ============ X: banco de filtros espectral e vocoder de 10 bandas (arquitetura do Spectravox) ============
const X_FREQS = Array.from({ length: 10 }, (_, k) => 110 * Math.pow(5200 / 110, k / 9));
class ModX extends Mod {
  init() {
    this.car = X_FREQS.map(() => new Svf());
    this.prog = X_FREQS.map((f) => { const v = new Svf(); v.set(f, 5); return v; });
    this.env = new Float64Array(10);
    this.gain = new Float64Array(10);
    this.envAll = 0;
    this.ph = 0; this.lfo = 0; this.lfoV = 0;
  }
  block() {
    const { s, p, I } = this, sr = sampleRate;
    this.lfo += (128 * 0.05 * Math.pow(600, s.lfoRate) * Math.pow(2, clamp(this.inp(I.lfoRate, 0), -5, 5))) / sr;
    if (this.lfo >= 1) this.lfo -= Math.floor(this.lfo);
    this.lfoV = this.lfo < 0.5 ? 4 * this.lfo - 1 : 3 - 4 * this.lfo;
    const shift = (s.shift - 0.5) * 4 + this.lfoV * s.lfoAmt * 1.5 + this.inp(I.shiftCv, 0);
    const mul = Math.pow(2, clamp(shift, -4, 4)), q = 2 + s.res * 22;
    for (let k = 0; k < 10; k++) {
      this.car[k].set(X_FREQS[k] * mul, q);
      const cvIn = I[`band${k + 1}`];
      const lvl = s[`b${k + 1}`];
      this.gain[k] = this.pat(cvIn) ? lvl * clamp(this.inp(cvIn, 0) / 5, 0, 1.5)
        : p.mode === 0 ? lvl * Math.min(this.env[k] * 8, 1.5) : lvl;
    }
    this.envC = 1 - Math.exp(-1 / (sr * 0.012));
  }
  tick() {
    const { s, p, I, O, o } = this, sr = sampleRate;
    const pitch = (s.vcoFreq - 0.5) * 6 + this.inp(I.voct, 0);
    const dt = clamp(130.81 * Math.pow(2, clamp(pitch, -8, 7)), 0, sr * 0.45) / sr;
    this.ph += dt; if (this.ph >= 1) this.ph -= 1;
    const vco = p.vcoWave ? sqOsc(this.ph, dt, clamp(0.5 + (s.pw - 0.5) * 0.9, 0.05, 0.95)) : sawOsc(this.ph, dt);
    const noise = Math.random() * 2 - 1;
    const carrier = this.pat(I.carrier) ? this.inp(I.carrier, 0) / 5 : vco * (1 - s.noiseMix) + noise * s.noiseMix;
    const program = (this.inp(I.program, 0) / 5) * s.progLvl * 2;
    let sum = 0;
    for (let k = 0; k < 10; k++) {
      const e = Math.abs(this.prog[k].run(program));
      this.env[k] += (e - this.env[k]) * this.envC;
      sum += this.car[k].run(carrier) * this.gain[k];
      o[O.env1 + k] = this.env[k] * 20;
    }
    this.envAll += (Math.abs(program) - this.envAll) * this.envC;
    const out = Math.tanh(sum * 1.6) * (p.vcaMode ? clamp(this.inp(I.vcaCv, 0) / 8, 0, 1) : 1);
    o[O.out] = out * 5; o[O.vco] = vco * 5; o[O.noise] = noise * 5; o[O.lfo] = this.lfoV * 5; o[O.env] = this.envAll * 16;
    return out * s.vol;
  }
}

// ============ Peças partilhadas por N e A: sequenciador de notas e envelope ADSR ============
// Sequenciador igual ao do M: tempo interno ou relógio externo (cada flanco é um passo), gate length, reset
class SeqCore {
  constructor() {
    this.step = -1; this.phase = 1; this.wasRun = false; this.running = false; this.ext = false;
    this.extInc = 8 / sampleRate; this.clkN = 0; this.prevClk = 0; this.prevReset = 0; this.gate = false; this.note = 0;
  }
  block(tempo, gateLen, ext, running) {
    this.ext = ext;
    this.inc = ext ? this.extInc : ((30 * Math.pow(10, tempo)) / 60) * 4 / sampleRate;
    this.gateLen = 0.1 + 0.88 * gateLen;
    if (running && !this.wasRun) { this.step = -1; this.phase = 1; }
    if (!running && this.wasRun) { this.gate = false; this.step = -1; }
    this.wasRun = this.running = running;
  }
  // devolve true no passo em que começa uma nota nova (this.note)
  tick(clk, reset, data) {
    let fresh = false;
    if (reset > 1 && this.prevReset <= 1) { this.step = -1; this.phase = 1; }
    this.prevReset = reset;
    if (this.ext) {
      this.clkN++;
      if (clk > 1 && this.prevClk <= 1) {
        if (this.clkN > 32) this.extInc = 1 / this.clkN;
        this.clkN = 0; this.phase = 1;
      } else if (this.phase < 0.999) this.phase = Math.min(0.999, this.phase + this.extInc);
      this.prevClk = clk;
    }
    if (this.running || this.ext) {
      if (!this.ext) this.phase += this.inc;
      if (this.phase >= 1) {
        this.phase -= 1;
        if (this.phase >= 1) this.phase = 0;
        const steps = data.steps || [], len = data.len || 16;
        this.step = (this.step + 1) % len;
        const st = steps[this.step];
        if (st && !st.r) { this.note = st.n; this.gate = true; fresh = true; } else this.gate = false;
      }
      if (this.phase > this.gateLen) this.gate = false;
    }
    return fresh;
  }
  clock() { return (this.running || this.ext) && this.step >= 0 && this.phase < 0.5 ? 5 : 0; }
}

// Envelope ADSR (valores 0..1); attack de 1 ms a 10 s, decay e release de 2 ms a 10 s
class Adsr {
  constructor() { this.v = 0; this.st = 0; this.g = false; }
  set(a, d, s, r) {
    const sr = sampleRate;
    this.ai = 1 / (sr * 0.001 * Math.pow(10000, clamp(a, 0, 1)));
    this.dc = Math.exp(-4.6 / (sr * 0.002 * Math.pow(5000, clamp(d, 0, 1))));
    this.rc = Math.exp(-4.6 / (sr * 0.002 * Math.pow(5000, clamp(r, 0, 1))));
    this.sus = clamp(s, 0, 1);
  }
  tick(gate, retrig) {
    if ((gate && !this.g) || (gate && retrig)) this.st = 1;
    if (!gate && this.g) this.st = 3;
    this.g = gate;
    if (this.st === 1) { this.v += this.ai; if (this.v >= 1) { this.v = 1; this.st = 2; } }
    else if (this.st === 2) this.v = this.sus + (this.v - this.sus) * this.dc;
    else if (this.st === 3) { this.v *= this.rc; if (this.v < 1e-5) { this.v = 0; this.st = 0; } }
    return this.v;
  }
}
// Oscilador com forma contínua: serra → quadrada → pulso estreito
function morphOsc(ph, dt, w) {
  if (w < 0.5) { const x = w * 2; return sawOsc(ph, dt) * (1 - x) + sqOsc(ph, dt, 0.5) * x; }
  return sqOsc(ph, dt, 0.5 - (w - 0.5) * 0.85);
}

// ============ N: monossintetizador de dois osciladores (arquitetura do Sirin) ============
class ModN extends Mod {
  init() {
    this.seq = new SeqCore(); this.keyGate = false; this.keyNote = 0; this.kb = -2;
    this.ph1 = 0; this.ph2 = 0; this.lfo = 0; this.sh = 0;
    this.fenv = new Adsr(); this.aenv = new Adsr();
    this.filter = new Ladder();
  }
  cmd(m) {
    if (m.c === 'noteOn') { this.keyNote = m.n; this.keyGate = true; this.retrig = true; }
    if (m.c === 'noteOff') this.keyGate = false;
  }
  status() { return [this.seq.step]; }
  block() {
    const { s, p, I } = this, sr = sampleRate;
    this.seq.block(s.tempo, s.gateLen, this.pat(I.clock), this.pat(I.run) ? this.inp(I.run, 0) > 1 : !!p.run);
    this.glideC = s.glide < 0.01 ? 1 : 1 - Math.exp(-3 / (sr * 0.005 * Math.pow(400, s.glide)));
    this.fenv.set(s.fA, s.fD, s.fS, s.fR);
    this.aenv.set(s.aA, s.aD, s.aS, s.aR);
    this.lfoInc = (0.05 * Math.pow(1000, s.lfoRate) * Math.pow(2, clamp(this.inp(I.lfoRate, 0), -5, 5))) / sr;
    this.cutBase = 20 * Math.pow(1000, s.cutoff);
  }
  tick() {
    const { s, p, I, O, o } = this, sr = sampleRate;
    const fresh = this.seq.tick(this.inp(I.clock, 0), this.inp(I.reset, 0), this.data);
    const note = this.keyGate ? this.keyNote : this.seq.note;
    const gate = this.keyGate || this.seq.gate || this.inp(I.gate, 0) > 1;
    const retrig = fresh || this.retrig; this.retrig = false;
    this.kb += (note / 12 - 2 - this.kb) * this.glideC;

    this.lfo += this.lfoInc;
    let wrap = false;
    if (this.lfo >= 1) { this.lfo -= Math.floor(this.lfo); wrap = true; }
    if (wrap) this.sh = Math.random() * 2 - 1;
    const l = this.lfo, lw = p.lfoWave;
    const lfo = lw === 0 ? (l < 0.5 ? 4 * l - 1 : 3 - 4 * l) : lw === 1 ? (l < 0.5 ? 1 : -1) : lw === 2 ? 1 - 2 * l : this.sh;

    const fe = this.fenv.tick(gate, retrig), ae = this.aenv.tick(gate, retrig);
    const base = this.kb + this.inp(I.voct, 0) + lfo * s.lfoPitch * 0.5;
    const f1 = clamp(261.63 * Math.pow(2, clamp(base + (p.osc1Oct - 1), -12, 8)), 0, sr * 0.45);
    const f2 = clamp(261.63 * Math.pow(2, clamp(base + (p.osc2Oct - 1) + (s.osc2Freq - 0.5) * (14 / 12), -12, 8)), 0, sr * 0.45);
    const dt1 = f1 / sr, dt2 = f2 / sr;
    this.ph1 += dt1;
    let sync = false;
    if (this.ph1 >= 1) { this.ph1 -= 1; sync = true; }
    this.ph2 += dt2;
    if (this.ph2 >= 1) this.ph2 -= 1;
    if (sync && p.sync) this.ph2 = this.ph1 * (dt2 / dt1);
    const v1 = morphOsc(this.ph1, dt1, s.osc1Wave), v2 = morphOsc(this.ph2, dt2, s.osc2Wave);
    const noise = Math.random() * 2 - 1;
    const pre = v1 * s.osc1Lvl + v2 * s.osc2Lvl + noise * s.noiseLvl + this.inp(I.ext, 0) / 5;
    const mod = (s.egAmt - 0.5) * 2 * fe * 8 + (this.kb + 2) * s.kbAmt + lfo * s.lfoCut * 3 + this.inp(I.cutoff, 0);
    const vcf = this.filter.run(pre * 0.75, this.cutBase * Math.pow(2, clamp(mod, -12, 12)), s.res * 4.3, 0);
    const out = vcf * clamp(ae + this.inp(I.vcaCv, 0) / 8, 0, 1);
    o[O.vca] = out * 5; o[O.vcf] = vcf * 5; o[O.vco1] = v1 * 5; o[O.vco2] = v2 * 5;
    o[O.fEg] = fe * 8; o[O.aEg] = ae * 8; o[O.lfo] = lfo * 5; o[O.kb] = this.kb;
    o[O.gateOut] = gate ? 5 : 0; o[O.clockOut] = this.seq.clock();
    return out * s.vol;
  }
}

// ============ A: semi-modular de três osciladores (arquitetura do ARP 2600) ============
// Ligações normalizadas (funcionam sem cabos e um cabo substitui-as): ring mod ← VCO 1 e VCO 2 (quadradas),
// VCA ← VCF, sample & hold ← ruído com relógio interno, lag ← teclado (portamento).
class ModA extends Mod {
  init() {
    this.seq = new SeqCore(); this.keyGate = false; this.keyNote = 0;
    this.ph = [0, 0, 0]; this.adsr = new Adsr(); this.ar = new Adsr();
    this.filter = new Ladder(); this.pink = 0; this.brown = 0;
    this.shPh = 0; this.shV = 0; this.prevShClk = 0; this.lag = -2;
    // reverb de mola simplificada: três combs com tempos curtos e um passa-tudo
    const sr = sampleRate;
    this.combs = [0.0297, 0.0371, 0.0411].map((t) => ({ b: new Float32Array(Math.floor(t * sr)), i: 0, lp: 0 }));
    this.ap = { b: new Float32Array(Math.floor(0.005 * sr)), i: 0 };
  }
  cmd(m) {
    if (m.c === 'noteOn') { this.keyNote = m.n; this.keyGate = true; this.retrig = true; }
    if (m.c === 'noteOff') this.keyGate = false;
  }
  status() { return [this.seq.step]; }
  block() {
    const { s, p, I } = this, sr = sampleRate;
    this.seq.block(s.tempo, s.gateLen, this.pat(I.clock), this.pat(I.run) ? this.inp(I.run, 0) > 1 : !!p.run);
    this.adsr.set(s.attack, s.decay, s.sustain, s.release);
    this.ar.set(s.arA, 0, 1, s.arR);
    this.lagC = s.porta < 0.01 ? 1 : 1 - Math.exp(-3 / (sr * 0.005 * Math.pow(400, s.porta)));
    this.shInc = (0.2 * Math.pow(250, s.shRate)) / sr;
    this.cutBase = 20 * Math.pow(1000, s.cutoff) * Math.pow(2, (s.fine - 0.5));
  }
  reverb(x) {
    let y = 0;
    for (const c of this.combs) {
      const d = c.b[c.i];
      c.lp += (d - c.lp) * 0.45;
      c.b[c.i] = x + c.lp * 0.78;
      c.i = (c.i + 1) % c.b.length;
      y += d;
    }
    const a = this.ap, d = a.b[a.i], v = y / 3 + d * 0.6;
    a.b[a.i] = v; a.i = (a.i + 1) % a.b.length;
    return d - v * 0.6;
  }
  tick() {
    const { s, p, I, O, o } = this, sr = sampleRate;
    const fresh = this.seq.tick(this.inp(I.clock, 0), this.inp(I.reset, 0), this.data);
    const note = this.keyGate ? this.keyNote : this.seq.note;
    const gate = this.keyGate || this.seq.gate || this.inp(I.gate, 0) > 1;
    const retrig = fresh || this.retrig || this.inp(I.trig, 0) > 1; this.retrig = false;
    const kbRaw = note / 12 - 2 + this.inp(I.kbCv, 0);
    // lag: sem cabo, faz portamento ao teclado
    const lagSrc = this.pat(I.lagIn) ? this.inp(I.lagIn, 0) : kbRaw;
    this.lag += (lagSrc - this.lag) * this.lagC;
    const kb = this.pat(I.lagIn) ? kbRaw : this.lag;

    // ruído com cor (branco → rosa → grave) e sample & hold
    const white = Math.random() * 2 - 1;
    this.pink += (white - this.pink) * 0.12; this.brown += (white - this.brown) * 0.01;
    const c = s.noiseColor, noise = c < 0.5 ? white * (1 - 2 * c) + this.pink * 2.5 * 2 * c : this.pink * 2.5 * (2 - 2 * c) + this.brown * 10 * (2 * c - 1);
    let shTrig = false;
    if (this.pat(I.shClk)) { const v = this.inp(I.shClk, 0); shTrig = v > 1 && this.prevShClk <= 1; this.prevShClk = v; }
    else { this.shPh += this.shInc; if (this.shPh >= 1) { this.shPh -= 1; shTrig = true; } }
    if (shTrig) this.shV = this.pat(I.shIn) ? this.inp(I.shIn, 0) / 5 : clamp(noise, -1, 1);
    const sh = this.shV;

    const env = this.adsr.tick(gate, retrig), ar = this.ar.tick(gate, retrig);

    // VCO 3 primeiro (modula os outros); com KB OFF fica fixo, bom para LFO
    const ph = this.ph;
    const p3 = (s.v3Coarse - 0.5) * 8 + (s.v3Fine - 0.5) * 0.5 + (p.v3Kb ? 0 : kb) + noise * s.v3Fm * 0.5 + this.inp(I.v3Fm, 0) + (p.v3Low ? -7 : 0);
    const dt3 = clamp(261.63 * Math.pow(2, clamp(p3, -16, 8)), 0, sr * 0.45) / sr;
    ph[2] += dt3; if (ph[2] >= 1) ph[2] -= 1;
    const v3tri = ph[2] < 0.5 ? 4 * ph[2] - 1 : 3 - 4 * ph[2];
    const v3saw = sawOsc(ph[2], dt3), v3pulse = sqOsc(ph[2], dt3, 0.5);

    const sine2 = Math.sin(TWO_PI * ph[1]);
    const p1 = (s.v1Coarse - 0.5) * 8 + (s.v1Fine - 0.5) * 0.5 + kb + sine2 * s.v1Fm1 * 2 + sh * s.v1Fm2 * 2 + this.inp(I.v1Fm, 0);
    const dt1 = clamp(261.63 * Math.pow(2, clamp(p1, -12, 8)), 0, sr * 0.45) / sr;
    ph[0] += dt1;
    let wrapped = false;
    if (ph[0] >= 1) { ph[0] -= 1; wrapped = true; }
    const v1saw = sawOsc(ph[0], dt1), v1sq = sqOsc(ph[0], dt1, 0.5);

    const p2 = (s.v2Coarse - 0.5) * 8 + (s.v2Fine - 0.5) * 0.5 + kb + v3tri * s.v2Fm * 2 + env * s.v2Adsr * 3 + this.inp(I.v2Fm, 0);
    const dt2 = clamp(261.63 * Math.pow(2, clamp(p2, -12, 8)), 0, sr * 0.45) / sr;
    ph[1] += dt2; if (ph[1] >= 1) ph[1] -= 1;
    if (wrapped && p.sync) ph[1] = ph[0] * (dt2 / dt1);
    const pw = clamp(0.5 + (s.v2Pw - 0.5) * 0.9 + (this.pat(I.v2Pwm) ? this.inp(I.v2Pwm, 0) / 10 : v3tri * s.v2Pwm * 0.45), 0.03, 0.97);
    const v2tri = ph[1] < 0.5 ? 4 * ph[1] - 1 : 3 - 4 * ph[1];
    const v2saw = sawOsc(ph[1], dt2), v2pulse = sqOsc(ph[1], dt2, pw), v2sine = Math.sin(TWO_PI * ph[1]);

    const ringA = this.pat(I.ringA) ? this.inp(I.ringA, 0) / 5 : v1sq;
    const ringB = this.pat(I.ringB) ? this.inp(I.ringB, 0) / 5 : v2pulse;
    const ring = ringA * ringB;

    // VCF: misturador de entrada, ladder com FM do ADSR, do seno do VCO 2 e do teclado
    const pre = ring * s.fRing + v1sq * s.fV1 + v2saw * s.fV2 + v3tri * s.fV3 + noise * s.fNoise + this.inp(I.vcfIn, 0) / 5;
    const fm = env * s.fAdsr * 8 + v2sine * s.fSine * 3 + (kb + 2) * s.fKb + this.inp(I.vcfFm, 0);
    const vcf = this.filter.run(pre * 0.45, this.cutBase * Math.pow(2, clamp(fm, -12, 12)), s.res * 4.3, 0);

    // VCA: sem cabo recebe o VCF e o ring mod; o ganho vem do ganho inicial e do envelope AR
    const vin = (this.pat(I.vcaIn) ? this.inp(I.vcaIn, 0) / 5 : vcf) + ring * s.vcaRing;
    const vca = vin * clamp(s.vcaInit + ar * s.vcaAr + this.inp(I.vcaCv, 0) / 8, 0, 1.2);
    const wet = this.reverb(vca);
    const out = vca * (1 - s.reverb * 0.5) + wet * s.reverb * 1.2;

    o[O.v1Saw] = v1saw * 5; o[O.v1Sq] = v1sq * 5; o[O.v2Sine] = v2sine * 5; o[O.v2Tri] = v2tri * 5; o[O.v2Saw] = v2saw * 5;
    o[O.v2Pulse] = v2pulse * 5; o[O.v3Tri] = v3tri * 5; o[O.v3Pulse] = v3pulse * 5; o[O.v3Saw] = v3saw * 5;
    o[O.noise] = clamp(noise, -1.5, 1.5) * 5; o[O.ring] = ring * 5; o[O.vcf] = vcf * 5; o[O.vca] = vca * 5;
    o[O.adsr] = env * 8; o[O.ar] = ar * 8; o[O.sh] = sh * 5; o[O.lag] = this.lag; o[O.kb] = kb;
    o[O.gateOut] = gate ? 5 : 0; o[O.clockOut] = this.seq.clock(); o[O.out] = out * 5;
    return out * s.vol;
  }
}

// ============ Peças partilhadas pelos módulos novos ============
// Reverb de mola simplificada: três combs com tempos curtos e um passa-tudo
class Spring {
  constructor() {
    const sr = sampleRate;
    this.combs = [0.0297, 0.0371, 0.0411].map((t) => ({ b: new Float32Array(Math.floor(t * sr)), i: 0, lp: 0 }));
    this.ap = { b: new Float32Array(Math.floor(0.005 * sr)), i: 0 };
  }
  run(x) {
    let y = 0;
    for (const c of this.combs) {
      const d = c.b[c.i];
      c.lp += (d - c.lp) * 0.45;
      c.b[c.i] = x + c.lp * 0.78;
      c.i = (c.i + 1) % c.b.length;
      y += d;
    }
    const a = this.ap, d = a.b[a.i], v = y / 3 + d * 0.6;
    a.b[a.i] = v; a.i = (a.i + 1) % a.b.length;
    return d - v * 0.6;
  }
}
const triOsc = (ph) => (ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph);
// Detetor de flanco ascendente (sinal acima de 1 V)
class Edge {
  constructor() { this.prev = 0; }
  up(v) { const r = v > 1 && this.prev <= 1; this.prev = v; return r; }
}

// ============ U: utilitários (atenuversores com mistura, dois VCAs, lógica, divisor de relógio e slew) ============
class ModU extends Mod {
  init() { this.clk = new Edge(); this.rst = new Edge(); this.cnt = -1; this.slew = 0; }
  block() {
    const { s, p } = this, sr = sampleRate;
    this.n = Math.round(1 + 15 * p.div);
    this.riseC = 1 - Math.exp(-1 / (sr * 0.001 * Math.pow(3000, s.rise)));
    this.fallC = 1 - Math.exp(-1 / (sr * 0.001 * Math.pow(3000, s.fall)));
  }
  tick() {
    const { s, I, O, o } = this;
    let mix = 0;
    for (let k = 1; k <= 4; k++) {
      const a = (s[`att${k}`] - 0.5) * 2, inn = I[`in${k}`];
      // sem cabo, o atenuversor dá uma tensão fixa (±5 V): serve de fonte de CV manual
      const v = this.pat(inn) ? this.inp(inn, 0) * a : a * 5;
      o[O[`out${k}`]] = v; mix += v;
    }
    o[O.mix] = mix;
    const v1 = this.inp(I.vca1In, 0) * clamp(s.vca1 + this.inp(I.vca1Cv, 0) / 8, 0, 1);
    const v2 = this.inp(I.vca2In, 0) * clamp(s.vca2 + this.inp(I.vca2Cv, 0) / 8, 0, 1);
    o[O.vca1Out] = v1; o[O.vca2Out] = v2;
    const a = this.inp(I.logA, 0) > 1, b = this.inp(I.logB, 0) > 1;
    o[O.and] = a && b ? 5 : 0; o[O.or] = a || b ? 5 : 0; o[O.xor] = a !== b ? 5 : 0;
    if (this.rst.up(this.inp(I.reset, 0))) this.cnt = -1;
    const c = this.inp(I.clk, 0);
    if (this.clk.up(c)) this.cnt++;
    const div = (n) => (this.cnt < 0 ? 0 : n === 1 ? (c > 1 ? 5 : 0) : (this.cnt % n) < n / 2 ? 5 : 0);
    o[O.div2] = div(2); o[O.div4] = div(4); o[O.divN] = div(this.n);
    const t = this.inp(I.slewIn, 0);
    this.slew += (t - this.slew) * (t > this.slew ? this.riseC : this.fallC);
    o[O.slewOut] = this.slew;
    return ((v1 + v2) / 5) * s.vol;
  }
}

// ============ T: sequenciador aleatório com memória (registo de deslocamento) e ritmo euclidiano ============
const T_SCALES = [null, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], [0, 2, 4, 5, 7, 9, 11], [0, 2, 3, 5, 7, 8, 10], [0, 3, 5, 7, 10]];
class ModT extends Mod {
  init() {
    this.reg = 0; this.reseed();
    this.phase = 1; this.wasRun = false; this.clkE = new Edge(); this.rstE = new Edge();
    this.eStep = -1; this.semis = 0; this.raw = 0; this.gateN = 0; this.eN = 0; this.clkOut = 0;
    this.period = sampleRate / 8; this.since = 0;
  }
  reseed() { this.reg = Math.floor(Math.random() * 65536) | 1; }
  cmd(m) {
    if (m.c === 'rseq') this.reseed();
    if (m.c === 'bit') this.reg ^= 1 << m.i;
  }
  status() { return [this.reg, this.len, this.eStep]; }
  block() {
    const { s, p, I } = this, sr = sampleRate;
    this.inc = ((30 * Math.pow(10, s.tempo)) / 60) * 4 / sr;
    this.len = 2 + Math.round(14 * p.len);
    this.prob = clamp(s.change + this.inp(I.changeCv, 0) / 5, 0, 1);
    this.range = clamp(s.range + this.inp(I.rangeCv, 0) / 5, 0, 1) * 48;
    this.eSteps = Math.round(1 + 15 * p.eSteps);
    this.eHits = Math.min(this.eSteps, Math.round(16 * p.eHits));
    this.eRot = Math.round(15 * p.eRot);
    this.running = this.pat(I.run) ? this.inp(I.run, 0) > 1 : !!p.run;
    if (this.running && !this.wasRun) this.phase = 1;
    this.wasRun = this.running;
  }
  quant(semis) {
    const sc = T_SCALES[this.p.scale];
    if (!sc) return semis;
    const oct = Math.floor(semis / 12), n = semis - oct * 12;
    let best = sc[0], d = 99;
    for (const x of [...sc, 12]) if (Math.abs(x - n) < d) { d = Math.abs(x - n); best = x; }
    return oct * 12 + best;
  }
  tick() {
    const { s, p, I, O, o } = this;
    let tickNow = false;
    this.since++;
    if (this.pat(I.clock)) {
      if (this.clkE.up(this.inp(I.clock, 0))) { tickNow = true; if (this.since > 32) this.period = this.since; this.since = 0; }
    } else if (this.running) {
      this.phase += this.inc;
      if (this.phase >= 1) { this.phase -= 1; if (this.phase >= 1) this.phase = 0; tickNow = true; this.period = 1 / this.inc; this.since = 0; }
    }
    if (this.rstE.up(this.inp(I.reset, 0))) this.eStep = -1;
    if (tickNow) {
      const L = this.len, last = (this.reg >> (L - 1)) & 1;
      const bit = Math.random() < this.prob * this.prob ? last ^ 1 : last;
      this.reg = ((this.reg << 1) | bit) & 0xffff;
      const v = (this.reg & 0xff) / 255;
      this.raw = v * 5;
      this.semis = Math.round(v * this.range);
      this.clkOut = 240;
      this.eStep = (this.eStep + 1) % this.eSteps;
      const k = (this.eStep + this.eRot) % this.eSteps;
      if (this.eHits > 0 && ((k * this.eHits) % this.eSteps) < this.eHits) this.eN = Math.max(240, this.period * 0.25);
    }
    const open = this.since < this.period * (0.1 + 0.85 * s.gateLen);
    const tr = this.inp(I.transpose, 0);
    o[O.cv] = (p.scale ? this.quant(this.semis + Math.round(tr * 12)) / 12 : this.semis / 12 + tr) + p.oct - 1;
    o[O.raw] = this.raw;
    o[O.gate] = open && this.reg & 1 ? 5 : 0;
    o[O.bit2] = open && this.reg & 2 ? 5 : 0;
    o[O.bit4] = open && this.reg & 8 ? 5 : 0;
    o[O.euclid] = this.eN > 0 ? 5 : 0;
    o[O.clockOut] = this.clkOut > 0 ? 5 : 0;
    if (this.eN > 0) this.eN--; if (this.clkOut > 0) this.clkOut--;
    return 0;
  }
}

// ============ G: semi-modular de dois osciladores com arpejador e mola (arquitetura do Grandmother) ============
function shapeOsc(w, ph, dt, pw) {
  return w === 0 ? triOsc(ph) : w === 1 ? sawOsc(ph, dt) : w === 2 ? sqOsc(ph, dt, 0.5) : sqOsc(ph, dt, pw);
}
class ModG extends Mod {
  init() {
    this.seq = new SeqCore(); this.keyGate = false; this.keyNote = 0; this.kb = -2;
    this.ph1 = 0; this.ph2 = 0; this.lfo = 0; this.sh = 0; this.hp = 0;
    this.env = new Adsr(); this.filter = new Ladder(); this.spring = new Spring();
    this.arpI = -1; this.arpDir = 1;
  }
  cmd(m) {
    if (m.c === 'noteOn') { this.keyNote = m.n; this.keyGate = true; this.retrig = true; }
    if (m.c === 'noteOff') this.keyGate = false;
  }
  status() { return [this.seq.step]; }
  // arpejador: toca as notas da sequência por ordem de altura, em 1 a 3 oitavas
  arpNote() {
    const { steps = [], len = 16 } = this.data, pool = [];
    const base = [...new Set(steps.slice(0, len).filter((st) => st && !st.r).map((st) => st.n))].sort((a, b) => a - b);
    for (let k = 0; k <= this.p.arpOct; k++) base.forEach((n) => pool.push(n + 12 * k));
    if (!pool.length) return this.seq.note;
    const mode = this.p.arp;
    if (mode === 3) this.arpI = Math.floor(Math.random() * pool.length);
    else if (mode === 1) this.arpI = (this.arpI + 1) % pool.length;
    else {
      if (pool.length === 1) this.arpI = 0;
      else {
        let nx = this.arpI + this.arpDir;
        if (nx >= pool.length || nx < 0) { this.arpDir = -this.arpDir; nx = this.arpI + this.arpDir; }
        this.arpI = clamp(nx, 0, pool.length - 1);
      }
    }
    return pool[this.arpI];
  }
  block() {
    const { s, p, I } = this, sr = sampleRate;
    this.seq.block(s.tempo, s.gateLen, this.pat(I.clock), this.pat(I.run) ? this.inp(I.run, 0) > 1 : !!p.run);
    this.glideC = s.glide < 0.01 ? 1 : 1 - Math.exp(-3 / (sr * 0.005 * Math.pow(400, s.glide)));
    this.env.set(s.attack, s.decay, s.sustain, s.release);
    this.lfoInc = (0.05 * Math.pow(1000, s.lfoRate) * Math.pow(2, clamp(this.inp(I.lfoRate, 0), -5, 5))) / sr;
    this.cutBase = 20 * Math.pow(1000, s.cutoff);
    this.hpC = 1 - Math.exp((-TWO_PI * 20 * Math.pow(100, s.hpCut)) / sr);
  }
  tick() {
    const { s, p, I, O, o } = this, sr = sampleRate;
    const fresh = this.seq.tick(this.inp(I.clock, 0), this.inp(I.reset, 0), this.data);
    if (fresh && p.arp) this.arpN = this.arpNote();
    if (!p.arp) this.arpI = -1;
    const note = this.keyGate ? this.keyNote : p.arp && this.arpN !== undefined ? this.arpN : this.seq.note;
    const gate = this.keyGate || this.seq.gate || this.inp(I.gate, 0) > 1;
    const retrig = fresh || this.retrig; this.retrig = false;
    this.kb += (note / 12 - 2 - this.kb) * this.glideC;

    this.lfo += this.lfoInc;
    if (this.lfo >= 1) { this.lfo -= Math.floor(this.lfo); this.sh = Math.random() * 2 - 1; }
    const l = this.lfo, lw = p.lfoWave;
    const tri = triOsc(l), sq = l < 0.5 ? 1 : -1;
    const lfo = lw === 0 ? tri : lw === 1 ? sq : lw === 2 ? 1 - 2 * l : lw === 3 ? 2 * l - 1 : this.sh;

    const env = this.env.tick(gate, retrig);
    const base = this.kb + this.inp(I.voct, 0) + lfo * s.modPitch * 0.5;
    const f1 = clamp(261.63 * Math.pow(2, clamp(base + p.osc1Oct - 2, -12, 8)), 0, sr * 0.45);
    const f2 = clamp(261.63 * Math.pow(2, clamp(base + p.osc2Oct - 2 + (s.osc2Freq - 0.5) * (14 / 12) + this.inp(I.osc2Cv, 0), -12, 8)), 0, sr * 0.45);
    const dt1 = f1 / sr, dt2 = f2 / sr;
    this.ph1 += dt1;
    let wrap = false;
    if (this.ph1 >= 1) { this.ph1 -= 1; wrap = true; }
    this.ph2 += dt2;
    if (this.ph2 >= 1) this.ph2 -= 1;
    if (wrap && p.sync) this.ph2 = this.ph1 * (dt2 / dt1);
    const pw = clamp(0.12 + lfo * s.modPw * 0.35 + this.inp(I.pwm, 0) / 12, 0.03, 0.97);
    const v1 = shapeOsc(p.osc1Wave, this.ph1, dt1, pw), v2 = shapeOsc(p.osc2Wave, this.ph2, dt2, pw);
    const noise = Math.random() * 2 - 1;
    let pre = v1 * s.osc1Lvl + v2 * s.osc2Lvl + noise * s.noiseLvl + this.inp(I.ext, 0) / 5;
    this.hp += (pre - this.hp) * this.hpC;
    if (s.hpCut > 0.01) pre -= this.hp;
    const kbT = [0, 0.5, 1][p.kbAmt];
    const mod = (s.egAmt - 0.5) * 2 * env * 8 + (this.kb + 2) * kbT + lfo * s.modCut * 3 + this.inp(I.cutoff, 0);
    const k = clamp(s.res + this.inp(I.res, 0) / 5, 0, 1) * 4.3;
    const vcf = this.filter.run(pre * 0.7, this.cutBase * Math.pow(2, clamp(mod, -12, 12)), k, 0);
    const vca = vcf * clamp((p.vcaMode ? 1 : env) + this.inp(I.vcaCv, 0) / 8, 0, 1);
    const wet = this.spring.run(this.pat(I.reverbIn) ? this.inp(I.reverbIn, 0) / 5 : vca);
    const out = vca * (1 - s.reverb * 0.5) + wet * s.reverb * 1.2;
    o[O.vco1] = v1 * 5; o[O.vco2] = v2 * 5; o[O.noise] = noise * 5; o[O.vcf] = vcf * 5; o[O.env] = env * 8;
    o[O.lfoTri] = tri * 5; o[O.lfoSq] = sq * 5; o[O.sh] = this.sh * 5; o[O.kb] = this.kb;
    o[O.gateOut] = gate ? 5 : 0; o[O.clockOut] = this.seq.clock(); o[O.spring] = wet * 5; o[O.vca] = out * 5;
    return out * s.vol;
  }
}

// ============ B: west coast (oscilador complexo, oscilador de modulação, pulser, 5 passos e low pass gates) ============
// Low pass gate: o "vactrol" abre depressa e fecha devagar; controla o ganho, o corte ou os dois
class Lpg {
  constructor() { this.c = 0; this.a = 0; this.b = 0; }
  run(x, ctl, mode) {
    const t = clamp(ctl, 0, 1.2);
    this.c += (t - this.c) * (t > this.c ? 0.006 : 0.00025 + 0.0006 * this.c);
    const c = this.c;
    const g = mode === 2 ? 1 : c;
    const k = mode === 0 ? 1 : 1 - Math.exp((-TWO_PI * 30 * Math.pow(500, clamp(c, 0, 1))) / sampleRate);
    this.a += (x - this.a) * k; this.b += (this.a - this.b) * k;
    return (mode === 0 ? x : this.b) * g;
  }
}
class ModB extends Mod {
  init() {
    this.phase = 1; this.wasRun = false; this.clkE = new Edge(); this.rstE = new Edge(); this.envE = new Edge();
    this.step = 0; this.pulseN = 0; this.env = 0; this.st = 0; this.holdN = 0;
    this.mph = 0; this.ph = 0; this.lpg1 = new Lpg(); this.lpg2 = new Lpg();
  }
  status() { return [this.step]; }
  block() {
    const { s, p, I } = this, sr = sampleRate;
    // período: de 20 s (knob a zero) a 50 ms (no máximo)
    this.inc = (0.05 * Math.pow(400, s.period)) / sr;
    this.atk = 1 / (sr * 0.001 * Math.pow(3000, s.attack));
    this.holdLen = sr * 0.002 * Math.pow(1000, s.hold);
    this.decC = Math.exp(-4.6 / (sr * 0.003 * Math.pow(2000, s.decay)));
    this.nSteps = 3 + p.steps;
    this.running = this.pat(I.run) ? this.inp(I.run, 0) > 1 : !!p.run;
    if (this.running && !this.wasRun) this.phase = 1;
    this.wasRun = this.running;
  }
  fireEnv() { this.st = 1; }
  tick() {
    const { s, p, I, O, o } = this, sr = sampleRate;
    let pulse = false;
    if (this.pat(I.clock)) pulse = this.clkE.up(this.inp(I.clock, 0));
    else if (this.running) {
      this.phase += this.inc;
      if (this.phase >= 1) { this.phase -= 1; if (this.phase >= 1) this.phase = 0; pulse = true; }
    }
    if (this.rstE.up(this.inp(I.reset, 0))) this.step = -1;
    if (pulse) { this.step = (this.step + 1) % this.nSteps; this.pulseN = Math.floor(sr * 0.008); this.fireEnv(); }
    if (this.envE.up(this.inp(I.envTrig, 0))) this.fireEnv();
    // envelope: ataque, sustentação (tempo) e decay; SELF repete-se sozinho
    if (this.st === 1) { this.env += this.atk; if (this.env >= 1) { this.env = 1; this.st = 2; this.holdN = this.holdLen; } }
    else if (this.st === 2) { if (--this.holdN <= 0) this.st = 3; }
    else if (this.st === 3) { this.env *= this.decC; if (this.env < 0.001) { this.env = 0; this.st = p.envMode ? 1 : 0; } }
    else if (p.envMode && this.st === 0) this.st = 1;

    const stp = Math.max(this.step, 0);
    const sv = (p[`s${stp + 1}`] - 0.5) * 2;
    let seqV = sv * s.seqAmt * 2;
    if (p.quant) seqV = Math.round(seqV * 12) / 12;

    const mf = (p.modRange ? 0.02 * Math.pow(2, s.modFreq * 10) : 20 * Math.pow(2, s.modFreq * 10)) * Math.pow(2, clamp(sv * s.modSeq * 2 + this.inp(I.modCv, 0), -8, 8));
    const mdt = clamp(mf, 0, sr * 0.45) / sr;
    this.mph += mdt; if (this.mph >= 1) this.mph -= 1;
    const mw = p.modWave, mod = mw === 0 ? sawOsc(this.mph, mdt) : mw === 1 ? sqOsc(this.mph, mdt, 0.5) : triOsc(this.mph);

    const index = clamp(s.index + this.inp(I.indexCv, 0) / 5, 0, 1);
    const pitch = (s.pitch - 0.5) * 6 + seqV + this.inp(I.pitchCv, 0);
    const f = Math.abs(261.63 * Math.pow(2, clamp(pitch, -8, 6)) * (1 + index * index * 8 * mod));
    this.ph += clamp(f, 0, sr * 0.45) / sr; if (this.ph >= 1) this.ph -= 1;
    const sine = Math.sin(TWO_PI * this.ph);
    const fold = clamp(s.timbre + s.timbreMod * mod * 0.5 + s.timbreEnv * this.env + this.inp(I.timbreCv, 0) / 5, 0, 1.5);
    const complex = Math.sin((sine + (s.sym - 0.5) * 0.8) * (1 + fold * 5) * 1.5708);

    const pulseG = this.pulseN > 0 ? 1 : 0; if (this.pulseN > 0) this.pulseN--;
    const in1 = this.pat(I.lpg1In) ? this.inp(I.lpg1In, 0) / 5 : mod;
    const in2 = this.pat(I.lpg2In) ? this.inp(I.lpg2In, 0) / 5 : complex;
    const l1 = this.lpg1.run(in1, pulseG + this.inp(I.lpg1Cv, 0) / 5, p.lpg1Mode) * s.lpg1;
    const l2 = this.lpg2.run(in2, this.env + this.inp(I.lpg2Cv, 0) / 5, p.lpg2Mode) * s.lpg2;
    const out = Math.tanh((l1 + l2) * 0.9);
    o[O.complex] = complex * 5; o[O.mod] = mod * 5; o[O.lpg1Out] = l1 * 5; o[O.lpg2Out] = l2 * 5;
    o[O.env] = this.env * 8; o[O.pulse] = pulseG * 5; o[O.seq] = seqV; o[O.out] = out * 5;
    return out * s.vol;
  }
}

// ============ K: dois filtros agressivos, dois envelopes e processador de sinal externo (arquitetura do MS-20) ============
class ModK extends Mod {
  init() {
    this.seq = new SeqCore(); this.keyGate = false; this.keyNote = 0; this.kb = -2; this.retrig = false;
    this.ph1 = 0; this.ph2 = 0; this.mg = 0; this.pink = 0; this.sh = 0; this.shE = new Edge(); this.mgPrev = 0;
    this.eg2 = new Adsr(); this.e1 = 0; this.e1St = 0; this.e1Wait = 0; this.prevGate = false;
    this.hpf = new Svf(); this.lpf = new Svf();
    this.eHp = 0; this.eLp = 0; this.eEnv = 0; this.tA = 0; this.tB = 0; this.tEnv = 0; this.zc = 0; this.zPos = false; this.fv = 0; this.fvT = 0;
  }
  cmd(m) {
    if (m.c === 'noteOn') { this.keyNote = m.n; this.keyGate = true; this.retrig = true; }
    if (m.c === 'noteOff') this.keyGate = false;
  }
  status() { return [this.seq.step]; }
  block() {
    const { s, p, I } = this, sr = sampleRate;
    this.seq.block(s.tempo, s.gateLen, this.pat(I.clock), this.pat(I.run) ? this.inp(I.run, 0) > 1 : !!p.run);
    this.portaC = s.porta < 0.01 ? 1 : 1 - Math.exp(-3 / (sr * 0.005 * Math.pow(400, s.porta)));
    this.eg2.set(s.attack, s.decay, s.sustain, s.release);
    this.e1Delay = sr * 0.002 * Math.pow(1000, s.e1Delay) * (s.e1Delay > 0.01 ? 1 : 0);
    this.e1Atk = 1 / (sr * 0.001 * Math.pow(5000, s.e1Attack));
    this.e1Rel = Math.exp(-4.6 / (sr * 0.002 * Math.pow(5000, s.e1Release)));
    this.mgInc = (0.05 * Math.pow(1000, s.mgRate)) / sr;
    this.espLoC = 1 - Math.exp((-TWO_PI * 30 * Math.pow(100, s.espLo)) / sr);
    this.espHiC = 1 - Math.exp((-TWO_PI * 200 * Math.pow(80, s.espHi)) / sr);
  }
  tick() {
    const { s, p, I, O, o } = this, sr = sampleRate;
    const fresh = this.seq.tick(this.inp(I.clock, 0), this.inp(I.reset, 0), this.data);
    const note = this.keyGate ? this.keyNote : this.seq.note;
    const gate = this.keyGate || this.seq.gate || this.inp(I.gate, 0) > 1;
    const retrig = fresh || this.retrig || this.inp(I.trig, 0) > 1; this.retrig = false;
    this.kb += (note / 12 - 2 - this.kb) * this.portaC;

    // MG: triângulo com forma variável (rampa ↔ triângulo ↔ dente de serra) e quadrada
    this.mg += this.mgInc; let mgWrap = false;
    if (this.mg >= 1) { this.mg -= Math.floor(this.mg); mgWrap = true; }
    const sh = clamp(s.mgShape, 0.02, 0.98), ph = this.mg;
    const mgTri = ph < sh ? (ph / sh) * 2 - 1 : 1 - ((ph - sh) / (1 - sh)) * 2;
    const mgSq = ph < 0.5 ? 1 : -1;

    // EG 1: delay, attack e release; EG 2: hold/ADSR
    if ((gate && !this.prevGate) || (gate && retrig)) { this.e1St = 1; this.e1Wait = this.e1Delay; }
    if (!gate && this.prevGate) this.e1St = 3;
    this.prevGate = gate;
    if (this.e1St === 1) { if (this.e1Wait > 0) this.e1Wait--; else { this.e1 += this.e1Atk; if (this.e1 >= 1) { this.e1 = 1; this.e1St = 2; } } }
    else if (this.e1St === 3) { this.e1 *= this.e1Rel; if (this.e1 < 1e-5) { this.e1 = 0; this.e1St = 0; } }
    const eg2 = this.eg2.tick(gate, retrig);

    const white = Math.random() * 2 - 1;
    this.pink += (white - this.pink) * 0.1;
    const pink = this.pink * 2.8;
    const shClkPatched = this.pat(I.shClk);
    if (shClkPatched ? this.shE.up(this.inp(I.shClk, 0)) : mgWrap) this.sh = this.pat(I.shIn) ? this.inp(I.shIn, 0) / 5 : white;

    // ESP: banda, envelope, gate e conversão de frequência em tensão (1 V/oitava)
    const ein = (this.inp(I.espIn, 0) / 5) * (0.2 + s.espGain * 8);
    this.eHp += (ein - this.eHp) * this.espLoC;
    this.eLp += (ein - this.eHp - this.eLp) * this.espHiC;
    const bp = Math.tanh(this.eLp);
    this.eEnv += (Math.abs(bp) - this.eEnv) * (Math.abs(bp) > this.eEnv ? 0.01 : 0.0005);
    const espGate = this.eEnv > s.espThr * 0.6 + 0.02;
    // F/V: filtra mais (dois polos no HIGH CUT) para ficar com a fundamental e conta os cruzamentos com histerese
    this.tA += (bp - this.tA) * this.espHiC; this.tB += (this.tA - this.tB) * this.espHiC;
    this.tEnv += (Math.abs(this.tB) - this.tEnv) * (Math.abs(this.tB) > this.tEnv ? 0.01 : 0.0005);
    const hyst = Math.max(0.005, this.tEnv * 0.5);
    this.zc++;
    if (!this.zPos && this.tB > hyst) {
      this.zPos = true;
      if (this.zc > 8 && espGate) this.fvT = Math.log2(sr / this.zc / 261.63);
      this.zc = 0;
    } else if (this.zPos && this.tB < -hyst) this.zPos = false;
    if (this.zc > sr * 0.1) this.zc = sr * 0.1;
    this.fv += (this.fvT - this.fv) * 0.002;

    const base = this.kb + this.inp(I.voct, 0) + mgTri * s.mgPitch * 0.5 + (s.egPitch - 0.5) * 2 * this.e1;
    const f1 = clamp(261.63 * Math.pow(2, clamp(base + p.v1Scale - 2, -12, 8)), 0, sr * 0.45);
    const f2 = clamp(261.63 * Math.pow(2, clamp(base + p.v2Scale - 2 + (s.v2Pitch - 0.5) * 2 + this.inp(I.v2Cv, 0), -12, 8)), 0, sr * 0.45);
    const dt1 = f1 / sr, dt2 = f2 / sr;
    this.ph1 += dt1; if (this.ph1 >= 1) this.ph1 -= 1;
    this.ph2 += dt2; if (this.ph2 >= 1) this.ph2 -= 1;
    const w1 = p.v1Wave, w2 = p.v2Wave;
    const pulse1 = sqOsc(this.ph1, dt1, clamp(0.5 - s.pw * 0.45, 0.04, 0.5));
    const v1 = w1 === 0 ? triOsc(this.ph1) : w1 === 1 ? sawOsc(this.ph1, dt1) : w1 === 2 ? pulse1 : white;
    const sq2 = sqOsc(this.ph2, dt2, 0.5);
    const v2 = w2 === 0 ? sawOsc(this.ph2, dt2) : w2 === 1 ? sq2 : w2 === 2 ? sqOsc(this.ph2, dt2, 0.1) : pulse1 * sq2;

    // HPF → LPF, com saturação e ressonância que grita no máximo
    const pre = Math.tanh((v1 * s.v1Lvl + v2 * s.v2Lvl + this.inp(I.ext, 0) / 5) * 0.9);
    const hpF = 20 * Math.pow(500, s.hpCut) * Math.pow(2, clamp((s.hpEg - 0.5) * 12 * eg2 + mgTri * s.hpMg * 4 + this.inp(I.hpCv, 0), -10, 10));
    this.hpf.set(hpF, 0.5 + s.hpPeak * s.hpPeak * 20);
    this.hpf.run(pre);
    const hp = Math.tanh(this.hpf.hp * (1 + s.hpPeak));
    const lpF = 20 * Math.pow(1000, s.lpCut) * Math.pow(2, clamp((s.lpEg - 0.5) * 16 * eg2 + mgTri * s.lpMg * 4 + this.inp(I.lpCv, 0), -10, 10));
    this.lpf.set(lpF, 0.5 + s.lpPeak * s.lpPeak * 30);
    this.lpf.run(hp);
    const lp = Math.tanh(this.lpf.lp * (1 + s.lpPeak * 1.5));
    const out = lp * clamp(eg2 + this.inp(I.vcaCv, 0) / 8, 0, 1);

    o[O.vco1] = v1 * 5; o[O.vco2] = v2 * 5; o[O.hpOut] = hp * 5; o[O.lpOut] = lp * 5;
    o[O.mgTri] = mgTri * 5; o[O.mgSq] = mgSq * 5; o[O.eg1] = this.e1 * 8; o[O.eg2] = eg2 * 8;
    o[O.white] = white * 5; o[O.pink] = clamp(pink, -1.5, 1.5) * 5; o[O.sh] = this.sh * 5;
    o[O.espBp] = bp * 5; o[O.espEnv] = this.eEnv * 16; o[O.espCv] = this.fv; o[O.espGate] = espGate ? 5 : 0;
    o[O.kb] = this.kb; o[O.gateOut] = gate ? 5 : 0; o[O.clockOut] = this.seq.clock(); o[O.vca] = out * 5;
    return out * s.vol;
  }
}

// ============ V: matriz de pinos 16×16 (arquitetura do VCS3) ============
// Fontes (linhas) e destinos (colunas) seguem V_ROWS e V_COLS em defs.js; os sinais circulam normalizados (±1).
class ModV extends Mod {
  init() {
    this.ph = [0, 0, 0]; this.pink = 0; this.brown = 0; this.filter = new Ladder(); this.spring = new Spring();
    this.trap = 0; this.tSt = 0; this.tN = 0; this.trigE = new Edge(); this.fire = false;
    this.src = new Float64Array(16); this.dst = new Float64Array(16); this.prev = new Float64Array(16);
    this.compile();
  }
  setData(k, v) { this.data[k] = v; if (k === 'pins') this.compile(); }
  compile() {
    const pins = this.data.pins || {};
    this.pins = Object.entries(pins).map(([key, lvl]) => { const [r, c] = key.split(',').map(Number); return [r, c, lvl]; })
      .filter(([r, c, l]) => r >= 0 && r < 16 && c >= 0 && c < 16 && l > 0);
    this.used = new Uint8Array(16);
    for (const [, c] of this.pins) this.used[c] = 1;
  }
  cmd(m) { if (m.c === 'trig') this.fire = true; }
  status() { return [this.tSt]; }
  block() {
    const { s } = this, sr = sampleRate;
    const t = (v) => sr * 0.002 * Math.pow(2500, v);
    this.tA = 1 / t(s.envA); this.tOn = t(s.envOn); this.tD = t(clamp(s.envD + this.prev[12] * 0.5, 0, 1)); this.tOff = t(s.envOff);
    this.manual = s.envOff > 0.98;
  }
  tick() {
    const { s, I, O, o, src, dst, prev } = this, sr = sampleRate;
    // trapézio: attack → on → decay → off; com OFF no máximo só dispara com o botão ou com a entrada
    if (this.trigE.up(this.inp(I.trig, 0)) || this.fire) { this.tSt = 1; this.fire = false; }
    if (this.tSt === 0 && !this.manual) this.tSt = 1;
    if (this.tSt === 1) { this.trap += this.tA; if (this.trap >= 1) { this.trap = 1; this.tSt = 2; this.tN = this.tOn; } }
    else if (this.tSt === 2) { if (--this.tN <= 0) this.tSt = 3; }
    else if (this.tSt === 3) { this.trap -= 1 / this.tD; if (this.trap <= 0) { this.trap = 0; this.tSt = this.manual ? 0 : 4; this.tN = this.tOff; } }
    else if (this.tSt === 4) { if (--this.tN <= 0) this.tSt = 1; }

    const voct = this.inp(I.voct, 0);
    const f1 = 261.63 * Math.pow(2, clamp((s.o1Freq - 0.5) * 10 + voct + prev[7] * 2, -12, 7));
    const f2 = 261.63 * Math.pow(2, clamp((s.o2Freq - 0.5) * 10 + voct + prev[8] * 2, -12, 7));
    const f3 = 0.05 * Math.pow(2, clamp(s.o3Freq * 14 + prev[9] * 2, -4, 16));
    const ph = this.ph, dts = [f1, f2, f3].map((f) => clamp(f, 0, sr * 0.45) / sr);
    for (let k = 0; k < 3; k++) { ph[k] += dts[k]; if (ph[k] >= 1) ph[k] -= 1; }
    // OSC 1: o shape deforma o seno (de meia onda a seno puro); OSC 2 e 3: largura do pulso e simetria do triângulo
    const sk = Math.pow(2, (s.o1Shape - 0.5) * 3), p1 = Math.pow(ph[0], sk);
    const pw2 = clamp(s.o2Shape + prev[14] * 0.45, 0.04, 0.96), pw3 = clamp(s.o3Shape, 0.04, 0.96);
    const skewTri = (x, w) => (x < w ? (x / w) * 2 - 1 : 1 - ((x - w) / (1 - w)) * 2);
    const white = Math.random() * 2 - 1;
    this.pink += (white - this.pink) * 0.12; this.brown += (white - this.brown) * 0.015;
    const c = s.noiseColor, noise = c < 0.5 ? white * (1 - 2 * c) + this.pink * 5 * c : this.pink * 2.5 * (2 - 2 * c) + this.brown * 12 * (2 * c - 1);

    src[0] = Math.sin(TWO_PI * p1) * s.o1Sine; src[1] = sawOsc(ph[0], dts[0]) * s.o1Saw;
    src[2] = sqOsc(ph[1], dts[1], pw2) * s.o2Pulse; src[3] = skewTri(ph[1], pw2) * s.o2Tri;
    src[4] = sqOsc(ph[2], dts[2], pw3) * s.o3Pulse; src[5] = skewTri(ph[2], pw3) * s.o3Tri;
    src[6] = clamp(noise, -1.5, 1.5) * s.noiseLvl;
    src[7] = this.inp(I.in1, 0) / 5; src[8] = this.inp(I.in2, 0) / 5;
    // fontes que dependem de destinos usam o valor da amostra anterior
    const fc = 20 * Math.pow(1000, s.fFreq) * Math.pow(2, clamp(prev[10] * 4 + this.inp(I.fCv, 0), -10, 10));
    const k = clamp(s.fRes + prev[11] * 0.5, 0, 1) * 4.3;
    const filt = this.filter.run(prev[6] * 0.8, fc, k, 0);
    src[9] = filt * s.fLvl;
    src[10] = this.trap * s.trapLvl;
    src[11] = prev[5] * this.trap * s.envSig;
    src[12] = prev[2] * prev[3] * s.ringLvl * 2;
    src[13] = this.spring.run(prev[4]) * s.revLvl;
    src[14] = (s.joyX - 0.5) * 2; src[15] = (s.joyY - 0.5) * 2;

    dst.fill(0);
    for (const [r, col, lvl] of this.pins) dst[col] += src[r] * lvl;
    prev.set(dst);
    const gain = this.used[13] ? clamp(dst[13], 0, 1.5) : 1;
    const out1 = Math.tanh(dst[0]) * s.out1 * gain, out2 = Math.tanh(dst[1]) * s.out2 * gain;
    const out = (out1 + out2) * 0.6;
    o[O.out1] = out1 * 5; o[O.out2] = out2 * 5; o[O.filter] = filt * 5; o[O.trap] = this.trap * 8;
    o[O.envSig] = src[11] * 5; o[O.ring] = src[12] * 5; o[O.osc3] = skewTri(ph[2], pw3) * 5; o[O.noise] = clamp(noise, -1.5, 1.5) * 5;
    o[O.matrix] = dst[15] * 5;
    return out * s.vol;
  }
}

const TYPES = { M: ModM, D: ModD, S: ModS, L: ModL, X: ModX, N: ModN, A: ModA, U: ModU, T: ModT, G: ModG, B: ModB, K: ModK, V: ModV };

class PulsoProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.mods = [];
    this.byId = {};
    this.cables = [];
    this.frame = 0;
    this.port.onmessage = (e) => this.msg(e.data);
  }
  msg(m) {
    const mod = m.id ? this.byId[m.id] : null;
    switch (m.t) {
      case 'add':
        if (this.byId[m.def.id] || !TYPES[m.def.type]) break;
        this.byId[m.def.id] = new TYPES[m.def.type](m.def);
        this.mods.push(this.byId[m.def.id]);
        break;
      case 'remove':
        this.mods = this.mods.filter((x) => x.id !== m.id);
        delete this.byId[m.id];
        this.wire();
        break;
      case 'clear': this.mods = []; this.byId = {}; this.cables = []; break;
      case 'p': if (mod) mod.p[m.k] = m.v; break;
      case 'all': if (mod) Object.assign(mod.p, m.p); break;
      case 'data': if (mod) mod.setData(m.k, m.v); break;
      case 'mix': if (mod) mod.mix = m.v; break;
      case 'cmd': if (mod) mod.cmd(m); break;
      case 'cables': this.cables = m.list; this.wire(); break;
    }
  }
  wire() {
    for (const m of this.mods) for (let i = 0; i < m.sa.length; i++) { m.sa[i].length = 0; m.si[i].length = 0; }
    for (const [a, out, b, inn] of this.cables) {
      const src = this.byId[a], dst = this.byId[b];
      if (!src || !dst || !(out in src.O) || !(inn in dst.I)) continue;
      dst.sa[dst.I[inn]].push(src.o);
      dst.si[dst.I[inn]].push(src.O[out]);
    }
  }
  process(_, outputs) {
    const outL = outputs[0][0], outR = outputs[0][1] || outputs[0][0];
    const outF1 = outputs[1] && outputs[1][0], outF2 = outputs[2] && outputs[2][0];
    if (!outL) return true;
    const mods = this.mods, n = mods.length;
    let anySolo = false;
    for (let m = 0; m < n; m++) if (mods[m].mix.solo) anySolo = true;
    for (let m = 0; m < n; m++) mods[m].pre(anySolo);
    for (let i = 0; i < outL.length; i++) {
      let l = 0, r = 0, f1 = 0, f2 = 0;
      for (let m = 0; m < n; m++) {
        const mod = mods[m];
        let v = mod.tick();
        if (!(v > -1e3 && v < 1e3)) { mod.init(); v = 0; }
        const a = v < 0 ? -v : v;
        if (a > mod.pk) mod.pk = a;
        l += v * mod.gL; r += v * mod.gR; f1 += v * mod.gF1; f2 += v * mod.gF2;
      }
      outL[i] = l === l ? l * 0.85 : 0;
      outR[i] = r === r ? r * 0.85 : 0;
      if (outF1) outF1[i] = f1 === f1 ? f1 * 1.2 : 0;
      if (outF2) outF2[i] = f2 === f2 ? f2 * 1.2 : 0;
    }
    for (let m = 0; m < n; m++) {
      const st = mods[m].status(), key = st.join(',');
      if (key !== mods[m].last) { mods[m].last = key; this.port.postMessage({ id: mods[m].id, st }); }
    }
    // nível de sinal de cada módulo, para os LEDs do mixer
    if (++this.frame % 8 === 0) {
      this.port.postMessage({ lv: mods.map((m) => [m.id, m.pk * m.mix.level * m.on]) });
      for (let m = 0; m < n; m++) mods[m].pk = 0;
    }
    return true;
  }
}

registerProcessor('pulso', PulsoProcessor);
