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
  pre() {
    const { s, p } = this;
    for (const k of this.smooth) s[k] += (p[k] - s[k]) * 0.3;
    this.block();
  }
}

// ============ M: monossintetizador melódico (arquitetura do Mother-32) ============
class ModM extends Mod {
  init() {
    this.step = -1; this.phase = 1; this.wasRun = false;
    this.seqGate = false; this.keyGate = false; this.note = 0;
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
    this.stepInc = ((30 * Math.pow(10, s.tempo)) / 60) * 4 * Math.pow(2, clamp(this.inp(I.tempo, 0), -5, 5)) / sr;
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
    if (this.running) {
      if (!(this.inp(I.hold, 0) > 1)) this.phase += this.stepInc;
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
    const clock = this.running && this.phase < 0.5 ? 5 : 0;
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

const TYPES = { M: ModM, D: ModD, S: ModS, L: ModL, X: ModX };

class PulsoProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.mods = [];
    this.byId = {};
    this.cables = [];
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
    const out = outputs[0][0];
    if (!out) return true;
    const mods = this.mods, n = mods.length;
    for (let m = 0; m < n; m++) mods[m].pre();
    for (let i = 0; i < out.length; i++) {
      let sum = 0;
      for (let m = 0; m < n; m++) sum += mods[m].tick();
      out[i] = sum === sum ? sum * 1.2 : 0;
    }
    for (let m = 0; m < n; m++) {
      const st = mods[m].status(), key = st.join(',');
      if (key !== mods[m].last) { mods[m].last = key; this.port.postMessage({ id: mods[m].id, st }); }
    }
    return true;
  }
}

registerProcessor('pulso', PulsoProcessor);
