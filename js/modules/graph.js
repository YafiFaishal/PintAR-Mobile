/**
 * PintAR Mobile — Real-time Graph with Axis Labels
 * Shows Y-axis values, X-axis time markers, current value indicator,
 * and grid lines with numbers for proper data analysis.
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
    this.unitY = options.unitY || '';
    this.unitX = options.unitX || 't';
    this.minY = options.minY ?? -10;
    this.maxY = options.maxY ?? 10;
    this.autoScale = options.autoScale || false;

    // Layout padding for axis labels
    this.padLeft = 38;
    this.padRight = 10;
    this.padTop = 18;
    this.padBottom = 22;

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

    // Auto-scale Y axis if enabled
    if (this.autoScale && this.data.length > 1) {
      const min = Math.min(...this.data);
      const max = Math.max(...this.data);
      const padding = Math.max(1, (max - min) * 0.1);
      this.minY = min - padding;
      this.maxY = max + padding;
    }

    this.draw();
  }

  clear() {
    this.data = [];
    this.draw();
  }

  // Map data value to canvas Y
  _mapY(val) {
    const plotH = this.h - this.padTop - this.padBottom;
    return this.padTop + plotH - ((val - this.minY) / (this.maxY - this.minY)) * plotH;
  }

  // Map data index to canvas X
  _mapX(i) {
    const plotW = this.w - this.padLeft - this.padRight;
    return this.padLeft + (i / (this.maxPoints - 1)) * plotW;
  }

  draw() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;
    const pl = this.padLeft;
    const pr = this.padRight;
    const pt = this.padTop;
    const pb = this.padBottom;
    const plotW = w - pl - pr;
    const plotH = h - pt - pb;

    // Detect dark mode
    const isDark = getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim().startsWith('#0');
    const textColor = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)';
    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
    const bgColor = isDark ? '#0f172a' : '#f8fafc';
    const zeroColor = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)';
    const axisColor = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)';

    // Background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);

    // ─── Y-Axis Grid Lines + Labels ───
    const ySteps = 5;
    const yRange = this.maxY - this.minY;
    const yStep = yRange / ySteps;

    ctx.font = '9px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= ySteps; i++) {
      const val = this.minY + yStep * i;
      const y = this._mapY(val);

      // Grid line
      ctx.beginPath();
      ctx.moveTo(pl, y);
      ctx.lineTo(w - pr, y);
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Y-axis label
      ctx.fillStyle = textColor;
      let labelText;
      if (Math.abs(val) >= 100) labelText = Math.round(val).toString();
      else if (Math.abs(val) >= 10) labelText = val.toFixed(1);
      else labelText = val.toFixed(1);
      ctx.fillText(labelText, pl - 4, y);
    }

    // ─── Zero line (if within range) ───
    if (this.minY < 0 && this.maxY > 0) {
      const zeroY = this._mapY(0);
      ctx.beginPath();
      ctx.moveTo(pl, zeroY);
      ctx.lineTo(w - pr, zeroY);
      ctx.strokeStyle = zeroColor;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ─── Axes ───
    ctx.beginPath();
    ctx.moveTo(pl, pt);
    ctx.lineTo(pl, h - pb);
    ctx.lineTo(w - pr, h - pb);
    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // ─── X-Axis labels (time markers) ───
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = textColor;
    ctx.font = '8px -apple-system, sans-serif';

    const xLabelCount = 5;
    for (let i = 0; i <= xLabelCount; i++) {
      const dataIdx = Math.round((this.maxPoints - 1) * (i / xLabelCount));
      const x = this._mapX(dataIdx);

      // Tick mark
      ctx.beginPath();
      ctx.moveTo(x, h - pb);
      ctx.lineTo(x, h - pb + 3);
      ctx.strokeStyle = axisColor;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Time label (relative)
      if (this.data.length > 1) {
        const pointsFromEnd = this.maxPoints - 1 - dataIdx;
        const timeLabel = pointsFromEnd === 0 ? 'now' : `-${pointsFromEnd}`;
        ctx.fillText(timeLabel, x, h - pb + 4);
      }
    }

    // ─── Axis Labels ───
    // Y-axis label (rotated)
    if (this.label) {
      ctx.save();
      ctx.translate(8, h / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '9px -apple-system, sans-serif';
      ctx.fillStyle = textColor;
      ctx.fillText(this.label, 0, 0);
      ctx.restore();
    }

    // X-axis label
    if (this.unitX) {
      ctx.font = '8px -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillStyle = textColor;
      ctx.fillText(this.unitX, w - pr, h - pb + 4);
    }

    // ─── Data Line ───
    if (this.data.length < 2) {
      // No data message
      ctx.font = '11px -apple-system, sans-serif';
      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Belum ada data...', w / 2, h / 2);
      return;
    }

    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();

    this.data.forEach((val, i) => {
      const x = this._mapX(i);
      const y = this._mapY(val);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // ─── Fill under curve (subtle) ───
    const lastIdx = this.data.length - 1;
    const lastX = this._mapX(lastIdx);
    const baseY = this._mapY(0);

    ctx.lineTo(lastX, this.minY < 0 ? baseY : h - pb);
    ctx.lineTo(this._mapX(0), this.minY < 0 ? baseY : h - pb);
    ctx.closePath();
    ctx.fillStyle = this.color.replace(')', ',0.08)').replace('rgb', 'rgba');
    if (this.color.startsWith('#')) {
      const r = parseInt(this.color.slice(1, 3), 16);
      const g = parseInt(this.color.slice(3, 5), 16);
      const b = parseInt(this.color.slice(5, 7), 16);
      ctx.fillStyle = `rgba(${r},${g},${b},0.08)`;
    }
    ctx.fill();

    // ─── Current value indicator (last point) ───
    const lastVal = this.data[lastIdx];
    const lastY = this._mapY(lastVal);

    // Dot
    ctx.beginPath();
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Value badge
    const valText = Math.abs(lastVal) >= 100 ? Math.round(lastVal).toString() : lastVal.toFixed(1);
    const badge = `${valText}${this.unitY ? ' ' + this.unitY : ''}`;
    ctx.font = 'bold 10px -apple-system, sans-serif';
    const badgeW = ctx.measureText(badge).width + 8;
    const badgeH = 16;
    const badgeX = Math.min(lastX + 6, w - pr - badgeW - 2);
    const badgeY = Math.max(pt, lastY - badgeH / 2);

    // Badge background
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY - badgeH / 2, badgeW, badgeH, 4);
    ctx.fill();

    // Badge text
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(badge, badgeX + 4, badgeY);

    // ─── Min/Max indicators ───
    if (this.data.length > 5) {
      const maxVal = Math.max(...this.data);
      const minVal = Math.min(...this.data);
      ctx.font = '8px -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillStyle = isDark ? 'rgba(100,200,100,0.7)' : 'rgba(0,150,0,0.6)';
      ctx.fillText(`max: ${maxVal.toFixed(1)}`, w - pr - 2, pt + 4);
      ctx.fillStyle = isDark ? 'rgba(200,100,100,0.7)' : 'rgba(200,0,0,0.6)';
      ctx.fillText(`min: ${minVal.toFixed(1)}`, w - pr - 2, pt + 14);
    }
  }
}
