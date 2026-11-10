// Knob rotativo controlado com rato, toque ou roda do rato.
// Arrastar para cima/baixo (ou para os lados) muda o valor; Shift ou dois dedos dão ajuste fino;
// duplo clique/toque repõe o valor por defeito. Também funciona com o teclado (setas).

const SWEEP = 270; // graus de rotação
const START = -135;

function polar(cx, cy, r, deg) {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
function arc(cx, cy, r, from, to) {
  const [x1, y1] = polar(cx, cy, r, from);
  const [x2, y2] = polar(cx, cy, r, to);
  const large = to - from > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

export class Knob {
  constructor({ label, value = 0.5, defaultValue = value, size = 'md', format, onChange }) {
    this.value = value;
    this.defaultValue = defaultValue;
    this.format = format || ((v) => Math.round(v * 100));
    this.onChange = onChange || (() => {});

    const el = (this.el = document.createElement('div'));
    el.className = `knob knob-${size}`;
    el.innerHTML = `
      <div class="knob-dial" tabindex="0" role="slider" aria-label="${label}" aria-valuemin="0" aria-valuemax="100">
        <svg viewBox="0 0 100 100">
          <path class="knob-track" d="${arc(50, 50, 40, START, START + SWEEP)}" />
          <path class="knob-fill" />
          <circle class="knob-cap" cx="50" cy="50" r="30" />
          <line class="knob-pointer" x1="50" y1="50" x2="50" y2="24" />
        </svg>
      </div>
      <div class="knob-label">${label}</div>
      <div class="knob-value"></div>`;
    this.dial = el.querySelector('.knob-dial');
    this.fill = el.querySelector('.knob-fill');
    this.pointer = el.querySelector('.knob-pointer');
    this.readout = el.querySelector('.knob-value');
    this.bind();
    this.render();
  }

  set(v, notify = true) {
    v = Math.min(1, Math.max(0, v));
    if (v === this.value && notify) return;
    this.value = v;
    this.render();
    if (notify) this.onChange(v);
  }

  render() {
    const deg = START + this.value * SWEEP;
    this.fill.setAttribute('d', this.value > 0.001 ? arc(50, 50, 40, START, deg) : '');
    this.pointer.setAttribute('transform', `rotate(${deg} 50 50)`);
    this.readout.textContent = this.format(this.value);
    this.dial.setAttribute('aria-valuenow', Math.round(this.value * 100));
  }

  bind() {
    const d = this.dial;
    let startX, startY, startV, lastTap = 0;
    const pointers = new Set();

    d.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      pointers.add(e.pointerId);
      d.setPointerCapture(e.pointerId);
      startX = e.clientX;
      startY = e.clientY;
      startV = this.value;
      d.classList.add('active');
      const now = performance.now();
      if (now - lastTap < 300) this.set(this.defaultValue);
      lastTap = now;
    });
    d.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      const fine = e.shiftKey || pointers.size > 1;
      const delta = (startY - e.clientY + (e.clientX - startX)) / (fine ? 800 : 180);
      this.set(startV + delta);
    });
    const end = (e) => {
      pointers.delete(e.pointerId);
      if (!pointers.size) d.classList.remove('active');
    };
    d.addEventListener('pointerup', end);
    d.addEventListener('pointercancel', end);

    d.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.set(this.value - Math.sign(e.deltaY) * (e.shiftKey ? 0.005 : 0.03));
    }, { passive: false });

    d.addEventListener('keydown', (e) => {
      const stepSize = e.shiftKey ? 0.01 : 0.05;
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') this.set(this.value + stepSize);
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') this.set(this.value - stepSize);
      else if (e.key === 'Home') this.set(0);
      else if (e.key === 'End') this.set(1);
      else return;
      e.preventDefault();
    });
  }
}
