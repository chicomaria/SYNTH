// Sequenciador de 8 passos com relógio de "lookahead" (agenda as batidas com antecedência
// no relógio do AudioContext, o que dá um tempo estável mesmo com a interface ocupada).

export class Sequencer {
  constructor(engine, getState, onStep) {
    this.engine = engine;
    this.getState = getState;
    this.onStep = onStep;
    this.playing = false;
    this.step = -1;
    this.nextTime = 0;
    this.timer = null;
  }

  start() {
    if (this.playing) return;
    this.playing = true;
    this.step = -1;
    this.nextTime = this.engine.ctx.currentTime + 0.05;
    this.tick();
  }

  stop() {
    this.playing = false;
    clearTimeout(this.timer);
    this.onStep(-1);
  }

  stepDuration(index) {
    const { tempo, swing } = this.getState().params;
    const bpm = 40 + tempo * 200;
    const base = 60 / bpm / 2; // colcheias
    const s = swing * 0.5;
    return index % 2 === 0 ? base * (1 + s) : base * (1 - s);
  }

  // Avança um passo manualmente (útil com o sequenciador parado)
  advance() {
    this.step = (this.step + 1) % 8;
    this.fire(this.step, this.engine.ctx.currentTime);
  }

  fire(step, time) {
    const { steps } = this.getState();
    const s = steps[step];
    if (s.on) this.engine.trigger(time, s.pitch * 2 - 1, s.vel);
    const delayMs = Math.max(0, (time - this.engine.ctx.currentTime) * 1000);
    setTimeout(() => this.onStep(step), delayMs);
  }

  tick() {
    if (!this.playing) return;
    const ctx = this.engine.ctx;
    while (this.nextTime < ctx.currentTime + 0.1) {
      this.step = (this.step + 1) % 8;
      this.fire(this.step, this.nextTime);
      this.nextTime += this.stepDuration(this.step);
    }
    this.timer = setTimeout(() => this.tick(), 25);
  }
}
