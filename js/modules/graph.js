/**
 * PintAR Mobile — Simple Real-time Graph
 * Lightweight canvas-based graph for live data display.
 */

export class SimpleGraph {
  constructor(canvasEl, options = {}) {
    this.canvas = canvasEl;
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.data = [];
    this.maxPoints = options.maxPoints || 80;
    this.color = options.color || '#0066FF';
    this.label = options.label || '';
    this.minY = options.minY ?? -10;
    this.maxY = options.maxY ?? 10;
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    if (!this.canvas) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = rect.width;
    this.h = rect.height;
    this.draw();
  }

  addPoint(value) {
    this.data.push(value);
    if (this.data.length > this.maxPoints) this.data.shift();
    this.draw();
  }

  clear() {
    this.data = [];
    this.draw();
  }

  draw() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;

    ctx.clearRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (h / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Zero line
    const zeroY = h - ((0 - this.minY) / (this.maxY - this.minY)) * h;
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    ctx.lineTo(w, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    if (this.data.length < 2) return;

    // Draw line
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();

    const step = w / (this.maxPoints - 1);
    this.data.forEach((val, i) => {
      const x = i * step;
      const y = h - ((val - this.minY) / (this.maxY - this.minY)) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Label
    if (this.label) {
      ctx.font = '10px -apple-system, sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillText(this.label, 4, 12);
    }
  }
}
