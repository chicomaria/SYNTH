// Motor de som: corre amostra a amostra num AudioWorklet.
// Duas unidades semi-modulares (M = monossintetizador melódico, D = sintetizador de percussão)
// e uma matriz de patch partilhada. Os sinais circulam em "volts": áudio ±5, envelopes 0..8,
// afinação a 1 V por oitava.

const TWO_PI = Math.PI * 2;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

function blep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}

// Filtro ladder de 4 polos com saturação e ressonância auto-oscilante (2x oversampling)
class Ladder {
  constructor() { this.a = this.b = this.c = this.d = 0; }
  run(x, g, k, hp) {
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

class PulsoProcessor extends AudioWorkletProcessor {
  constructor(opts) {
    super();
    const { outs, ins, params, smooth } = opts.processorOptions;
    this.O = {}; outs.forEach((n, i) => (this.O[n] = i));
    this.I = {}; ins.forEach((n, i) => (this.I[n] = i));
    this.o = new Float64Array(outs.length);
    this.src = new Int32Array(ins.length).fill(-1);
    this.p = { ...params };
    this.s = { ...params };
    this.smoothKeys = smooth;

    // Unidade M
    this.mSteps = Array.from({ length: 32 }, () => ({ n: 0, r: false }));
    this.mLen = 16;
    this.mStep = -1; this.mPhase = 1; this.mWasRun = false;
    this.mSeqGate = false; this.mKeyGate = false; this.mNote = 0;
    this.mKb = -2; this.mEg = 0; this.mEgStage = 0; this.mPrevGate = false;
    this.mLfo = 0; this.mPh = 0; this.mPrevReset = 0;
    this.mFilter = new Ladder();

    // Unidade D
    this.dPitch = new Float64Array(8).fill(0.5);
    this.dVel = new Float64Array(8).fill(1);
    this.dStep = 0; this.dPhase = 1; this.dWasRun = false;
    this.dFire = false; this.dManualFire = false; this.dAdvance = false;
    this.dPrevAdv = 0; this.dPrevTrig = 0; this.dTrigCount = 0;
    this.dVcoEg = 0; this.dVcfEg = 0; this.dVcaEg = 0; this.dVcaTarget = 0; this.dVcaAtk = false;
    this.dPh1 = 0; this.dPh2 = 0;
    this.dFilter = new Ladder();

    this.lastM = -2; this.lastD = -2;
    this.port.onmessage = (e) => this.msg(e.data);
  }

  msg(m) {
    switch (m.t) {
      case 'p': this.p[m.k] = m.v; break;
      case 'all': Object.assign(this.p, m.p); break;
      case 'cables':
        this.src.fill(-1);
        m.list.forEach(([out, inn]) => {
          if (out in this.O && inn in this.I) this.src[this.I[inn]] = this.O[out];
        });
        break;
      case 'dsteps': this.dPitch.set(m.pitch); this.dVel.set(m.vel); break;
      case 'msteps': this.mSteps = m.steps; this.mLen = m.len; break;
      case 'dTrig': this.dManualFire = true; break;
      case 'dAdv': this.dAdvance = true; break;
      case 'noteOn': this.mNote = m.n; this.mKeyGate = true; break;
      case 'noteOff': this.mKeyGate = false; break;
    }
  }

  process(_, outputs) {
    const out = outputs[0][0];
    if (!out) return true;
    const sr = sampleRate;
    const { p, s, o, O, I, src } = this;
    for (const k of this.smoothKeys) s[k] += (p[k] - s[k]) * 0.3;
    const inp = (i, d) => { const x = src[i]; return x < 0 ? d : o[x]; };
    const patched = (i) => src[i] >= 0;
    const cv01 = (v, i, scale) => clamp(v + inp(i, 0) / scale, 0, 1);
    const decayCoef = (v) => Math.exp(-4.6 / (sr * 0.01 * Math.pow(1000, v)));

    // ---- Constantes por bloco: unidade M ----
    const mStepInc = ((30 * Math.pow(10, s.mTempo)) / 60) * 4 * Math.pow(2, clamp(inp(I.mTempo, 0), -5, 5)) / sr;
    const mGateLen = 0.1 + 0.88 * s.mGateLen;
    const mGlideC = s.mGlide < 0.01 ? 1 : 1 - Math.exp(-3 / (sr * 0.005 * Math.pow(400, s.mGlide)));
    const mAtkInc = 1 / (sr * 0.001 * Math.pow(10000, s.mAttack));
    const mDecC = Math.exp(-4.6 / (sr * 0.002 * Math.pow(5000, s.mDecay)));
    const mLfoInc = (0.1 * Math.pow(3500, s.mLfoRate) * Math.pow(2, clamp(inp(I.mLfoRate, 0), -5, 5))) / sr;
    const mFreqBase = (s.mFreq - 0.5) * 2;
    const mCutBase = 20 * Math.pow(1000, s.mCutoff);
    const mPol = p.mVcfModPol ? -1 : 1;
    const mRunning = patched(I.mRun) ? inp(I.mRun, 0) > 1 : !!p.mRunning;
    if (mRunning && !this.mWasRun) { this.mStep = -1; this.mPhase = 1; }
    if (!mRunning && this.mWasRun) { this.mSeqGate = false; this.mStep = -1; }
    this.mWasRun = mRunning;

    // ---- Constantes por bloco: unidade D ----
    const dStepInc = ((10 * Math.pow(1000, s.dTempo)) / 60) * Math.pow(2, clamp(inp(I.dTempo, 0), -5, 5)) / sr;
    const dVcoDecC = decayCoef(cv01(s.dVcoDecay, I.dVcoDecay, 10));
    const dVcfDecC = decayCoef(cv01(s.dVcfDecay, I.dVcfDecay, 10));
    const dVcaDecC = decayCoef(cv01(s.dVcaDecay, I.dVcaDecay, 10));
    const dAtkInc = 1 / (sr * (p.dVcaEg ? 0.012 : 0.0008));
    const dF1Base = (s.dVco1Freq - 0.5) * 10;
    const dF2Base = (s.dVco2Freq - 0.5) * 10;
    const dEg1 = (s.dVco1Eg - 0.5) * 10;
    const dEg2 = (s.dVco2Eg - 0.5) * 10;
    const dCutBase = 20 * Math.pow(1000, s.dCutoff);
    const dVcfEgAmt = (s.dVcfEg - 0.5) * 16;
    const dRunning = patched(I.dRun) ? inp(I.dRun, 0) > 1 : !!p.dRunning;
    if (dRunning && !this.dWasRun) this.dPhase = 1;
    this.dWasRun = dRunning;
    const dAdvPatched = patched(I.dAdv);
    const dTrigPatched = patched(I.dTrigIn);
    const gMax = 0.75;

    for (let i = 0; i < out.length; i++) {
      // ================= Unidade M =================
      const reset = inp(I.mReset, 0);
      if (reset > 1 && this.mPrevReset <= 1) { this.mStep = -1; this.mPhase = 1; }
      this.mPrevReset = reset;
      if (mRunning) {
        if (!(inp(I.mHold, 0) > 1)) this.mPhase += mStepInc;
        if (this.mPhase >= 1) {
          this.mPhase -= 1;
          if (this.mPhase >= 1) this.mPhase = 0;
          this.mStep = (this.mStep + 1) % this.mLen;
          const st = this.mSteps[this.mStep];
          if (st && !st.r) { if (!this.mKeyGate) this.mNote = st.n; this.mSeqGate = true; } else this.mSeqGate = false;
        }
        if (this.mPhase > mGateLen) this.mSeqGate = false;
      }
      const mClock = mRunning && this.mPhase < 0.5 ? 5 : 0;
      const gate = this.mSeqGate || this.mKeyGate || inp(I.mGateIn, 0) > 1;
      this.mKb += (this.mNote / 12 - 2 - this.mKb) * mGlideC;

      // Envelope
      if (gate && !this.mPrevGate) this.mEgStage = 1;
      if (!gate && this.mPrevGate) this.mEgStage = 3;
      this.mPrevGate = gate;
      if (this.mEgStage === 1) {
        this.mEg += mAtkInc;
        if (this.mEg >= 1) { this.mEg = 1; this.mEgStage = p.mSustain ? 2 : 3; }
      } else if (this.mEgStage === 3) {
        this.mEg *= mDecC;
        if (this.mEg < 1e-5) { this.mEg = 0; this.mEgStage = 0; }
      }
      const mEgV = this.mEg * 8;

      // LFO
      this.mLfo += mLfoInc;
      if (this.mLfo >= 1) this.mLfo -= Math.floor(this.mLfo);
      const lfoTri = 5 * (this.mLfo < 0.5 ? 4 * this.mLfo - 1 : 3 - 4 * this.mLfo);
      const lfoSq = this.mLfo < 0.5 ? 5 : -5;
      const lfoSel = p.mLfoWave ? lfoSq : lfoTri;

      // VCO
      const vcoMod = (patched(I.mVcoMod) ? inp(I.mVcoMod, 0) : p.mVcoModSrc ? lfoSel : mEgV) * s.mVcoModAmt;
      const toFreq = p.mVcoModDest === 1;
      const mPitch = mFreqBase + this.mKb + inp(I.mVoct, 0) + (toFreq ? vcoMod * 0.4 : 0);
      let mf = 261.63 * Math.pow(2, clamp(mPitch, -12, 8)) * (1 + inp(I.mLinFm, 0) / 5);
      mf = clamp(mf, 0, sr * 0.45);
      const mdt = mf / sr;
      this.mPh += mdt;
      if (this.mPh >= 1) this.mPh -= 1;
      const pw = clamp(0.5 + (s.mPw - 0.5) * 0.9 + (toFreq ? 0 : vcoMod * 0.09), 0.03, 0.97);
      const ph = this.mPh;
      const saw = 2 * ph - 1 - blep(ph, mdt);
      let ph2 = ph + 1 - pw; if (ph2 >= 1) ph2 -= 1;
      const pulse = (ph < pw ? 1 : -1) + blep(ph, mdt) - blep(ph2, mdt);
      const mNoise = Math.random() * 2 - 1;

      // Mistura, filtro, VCA
      const mixAmt = clamp(s.mMix + inp(I.mMixCv, 0) / 5, 0, 1);
      const mixB = patched(I.mExt) ? inp(I.mExt, 0) / 5 : mNoise;
      const mPre = (p.mWave ? pulse : saw) * (1 - mixAmt) + mixB * mixAmt;
      const vcfMod = (p.mVcfModSrc ? lfoSel : mEgV) * s.mVcfModAmt * mPol + inp(I.mCutoff, 0);
      const mfc = clamp(mCutBase * Math.pow(2, clamp(vcfMod, -12, 12)), 10, 18000);
      const mg = Math.min(1 - Math.exp((-TWO_PI * mfc) / (2 * sr)), gMax);
      const mk = clamp(s.mRes + inp(I.mRes, 0) / 5, 0, 1) * 4.3;
      const mVcf = this.mFilter.run(mPre * 0.8, mg, mk, p.mVcfMode);
      const mGain = clamp((p.mVcaMode ? 1 : this.mEg) + inp(I.mVcaCv, 0) / 8, 0, 1);
      const mOut = mVcf * mGain;

      // ================= Unidade D =================
      let advance = this.dAdvance;
      let fire = this.dManualFire;
      this.dAdvance = this.dManualFire = false;
      if (dAdvPatched) {
        const a = inp(I.dAdv, 0);
        if (a > 1 && this.dPrevAdv <= 1) { advance = true; fire = fire || !dTrigPatched; this.dTrigCount = 240; }
        this.dPrevAdv = a;
      } else if (dRunning) {
        this.dPhase += dStepInc;
        if (this.dPhase >= 1) {
          this.dPhase -= 1;
          if (this.dPhase >= 1) this.dPhase = 0;
          advance = true; fire = fire || !dTrigPatched; this.dTrigCount = 240;
        }
      }
      if (advance) this.dStep = (this.dStep + 1) % 8;
      if (dTrigPatched) {
        const t = inp(I.dTrigIn, 0);
        if (t > 1 && this.dPrevTrig <= 1) fire = true;
        this.dPrevTrig = t;
      }
      const seqVel = this.dVel[this.dStep] * 5;
      const seqPitch = (this.dPitch[this.dStep] - 0.5) * 10;
      if (fire) {
        const vel = patched(I.dVelIn) ? clamp(inp(I.dVelIn, 0), 0, 5) : seqVel;
        this.dVcoEg = 1; this.dVcfEg = 1;
        this.dVcaTarget = vel / 5; this.dVcaAtk = true;
      }
      this.dVcoEg *= dVcoDecC; if (this.dVcoEg < 1e-5) this.dVcoEg = 0;
      this.dVcfEg *= dVcfDecC; if (this.dVcfEg < 1e-5) this.dVcfEg = 0;
      if (this.dVcaAtk) {
        this.dVcaEg += dAtkInc;
        if (this.dVcaEg >= this.dVcaTarget) { this.dVcaEg = this.dVcaTarget; this.dVcaAtk = false; }
      } else {
        this.dVcaEg *= dVcaDecC; if (this.dVcaEg < 1e-5) this.dVcaEg = 0;
      }
      const dTrigOut = this.dTrigCount > 0 ? 5 : 0;
      if (this.dTrigCount > 0) this.dTrigCount--;

      // VCO 1 e VCO 2
      const sw = p.dSeqPitch; // 0 = VCO 1&2, 1 = OFF, 2 = VCO 2
      const v1 = dF1Base + (sw === 0 ? seqPitch : 0) + dEg1 * this.dVcoEg + inp(I.dVco1Cv, 0);
      const f1 = clamp(130.81 * Math.pow(2, clamp(v1, -10, 9)), 0, sr * 0.45);
      const dt1 = f1 / sr;
      this.dPh1 += dt1;
      let synced = false;
      if (this.dPh1 >= 1) { this.dPh1 -= 1; synced = true; }
      const p1 = this.dPh1;
      const tri1 = 4 * Math.abs(p1 - 0.5) - 1;
      let p1b = p1 + 0.5; if (p1b >= 1) p1b -= 1;
      const o1 = p.dVco1Wave ? (p1 < 0.5 ? 1 : -1) + blep(p1, dt1) - blep(p1b, dt1) : tri1;

      const fm = clamp(s.dFm + inp(I.dFmAmt, 0) / 5, 0, 1);
      const v2 = dF2Base + (sw !== 1 ? seqPitch : 0) + dEg2 * this.dVcoEg + inp(I.dVco2Cv, 0);
      let f2 = 130.81 * Math.pow(2, clamp(v2, -10, 9)) * (1 + fm * fm * 12 * o1);
      f2 = clamp(Math.abs(f2), 0, sr * 0.45);
      const dt2 = f2 / sr;
      this.dPh2 += dt2;
      if (this.dPh2 >= 1) this.dPh2 -= 1;
      if (synced && p.dSync) this.dPh2 = dt1 > 0 ? clamp((this.dPh1 / dt1) * dt2, 0, 0.999) : 0;
      const q = this.dPh2;
      let qb = q + 0.5; if (qb >= 1) qb -= 1;
      const o2 = p.dVco2Wave ? (q < 0.5 ? 1 : -1) + blep(q, dt2) - blep(qb, dt2) : 4 * Math.abs(q - 0.5) - 1;

      // Mistura, filtro, VCA
      const dNoise = Math.random() * 2 - 1;
      const nLvl = clamp(s.dNoiseLvl + inp(I.dNoiseLvl, 0) / 5, 0, 1);
      const third = patched(I.dExt) ? inp(I.dExt, 0) / 5 : dNoise;
      const dPre = (o1 * s.dVco1Lvl + o2 * s.dVco2Lvl + third * nLvl) * 0.8;
      const modSrc = patched(I.dVcfMod) ? inp(I.dVcfMod, 0) / 5 : dNoise;
      const dfc = clamp(dCutBase * Math.pow(2, clamp(dVcfEgAmt * this.dVcfEg + modSrc * s.dNoiseMod * 5, -12, 12)), 10, 18000);
      const dg = Math.min(1 - Math.exp((-TWO_PI * dfc) / (2 * sr)), gMax);
      const dVcf = this.dFilter.run(dPre, dg, s.dRes * 4.3, p.dVcfMode);
      const dGain = clamp(this.dVcaEg + inp(I.dVcaCv, 0) / 8, 0, 1);
      const dOut = dVcf * dGain;

      // ================= Saídas do patch bay =================
      const mult = inp(I.mMult, 0);
      const vcMix = clamp(s.mVcMix + inp(I.mVcMixCtrl, 0) / 5, 0, 1);
      o[O.mVca] = mOut * 5; o[O.mNoise] = mNoise * 5; o[O.mVcf] = mVcf * 5;
      o[O.mSaw] = saw * 5; o[O.mPulse] = pulse * 5;
      o[O.mLfoTri] = lfoTri; o[O.mLfoSq] = lfoSq;
      o[O.mVcMix] = inp(I.mMix1, 0) * (1 - vcMix) + inp(I.mMix2, 0) * vcMix;
      o[O.mMult1] = mult; o[O.mMult2] = mult;
      o[O.mAssign] = mClock; o[O.mEg] = mEgV; o[O.mKb] = this.mKb; o[O.mGate] = gate ? 5 : 0;
      o[O.dVca] = dOut * 5; o[O.dVcaEg] = this.dVcaEg * 8; o[O.dVcfEg] = this.dVcfEg * 8; o[O.dVcoEg] = this.dVcoEg * 8;
      o[O.dVco1] = o1 * 5; o[O.dVco2] = o2 * 5;
      o[O.dTrig] = dTrigOut; o[O.dVel] = seqVel; o[O.dPitch] = seqPitch;

      out[i] = (mOut * s.mVol + dOut * s.dVol) * 1.4;
    }

    if (this.mStep !== this.lastM || this.dStep !== this.lastD) {
      this.lastM = this.mStep; this.lastD = this.dStep;
      this.port.postMessage({ m: this.mStep, d: this.dStep });
    }
    return true;
  }
}

registerProcessor('pulso', PulsoProcessor);
