// Visualizador: osciloscópio com disparo no cruzamento por zero, para a onda ficar estável.

export class Scope {
  constructor(canvas, getAnalyser) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.getAnalyser = getAnalyser;
    this.running = false;
    this.resize();
    new ResizeObserver(() => { this.resize(); if (!this.running) this.drawIdle(); }).observe(canvas);
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(1, Math.round(r.width * dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * dpr));
  }

  colors() {
    const cs = getComputedStyle(this.canvas);
    return { line: cs.getPropertyValue('--scope-line').trim() || '#f6a84a', grid: cs.getPropertyValue('--scope-grid').trim() || '#333' };
  }

  grid() {
    const { width: w, height: h } = this.canvas;
    const c = this.ctx;
    c.clearRect(0, 0, w, h);
    c.strokeStyle = this.colors().grid;
    c.lineWidth = 1;
    c.beginPath();
    for (let i = 1; i < 8; i++) { const x = (w * i) / 8; c.moveTo(x, 0); c.lineTo(x, h); }
    for (let i = 1; i < 4; i++) { const y = (h * i) / 4; c.moveTo(0, y); c.lineTo(w, y); }
    c.stroke();
  }

  drawIdle() {
    this.grid();
    const { width: w, height: h } = this.canvas;
    this.ctx.strokeStyle = this.colors().line;
    this.ctx.lineWidth = 2 * (window.devicePixelRatio || 1);
    this.ctx.beginPath();
    this.ctx.moveTo(0, h / 2);
    this.ctx.lineTo(w, h / 2);
    this.ctx.stroke();
  }

  start() {
    if (this.running) return;
    this.running = true;
    const draw = () => {
      const a = this.getAnalyser();
      if (a) this.frame(a);
      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  }

  frame(analyser) {
    if (!this.buf || this.buf.length !== analyser.fftSize) this.buf = new Float32Array(analyser.fftSize);
    const data = this.buf;
    analyser.getFloatTimeDomainData(data);
    const n = data.length / 2;
    let start = 0;
    for (let i = 1; i < n; i++) {
      if (data[i - 1] < 0 && data[i] >= 0) { start = i; break; }
    }
    this.grid();
    const { width: w, height: h } = this.canvas;
    const c = this.ctx;
    c.strokeStyle = this.colors().line;
    c.lineWidth = 2 * (window.devicePixelRatio || 1);
    c.lineJoin = 'round';
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * w;
      const y = h / 2 - data[start + i] * h * 0.45;
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.stroke();
  }
}
