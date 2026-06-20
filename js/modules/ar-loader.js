/**
 * PintAR Mobile — AR Loader
 * Lazy-loads A-Frame + AR.js only when needed.
 * Provides fallback to 2D canvas simulation if AR unavailable.
 */

let arLoaded = false;
let loadingPromise = null;

const AFRAME_URL = 'https://aframe.io/releases/1.6.0/aframe.min.js';
const ARJS_URL = 'https://raw.githack.com/AR-js-org/AR.js/3.4.8/aframe/build/aframe-ar.js';

function loadScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/**
 * Check if device can run AR (has camera + gyroscope)
 */
export function canRunAR() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

/**
 * Lazy-load AR libraries. Returns true if successful.
 */
export async function loadAR() {
  if (arLoaded) return true;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      await loadScript(AFRAME_URL);
      await loadScript(ARJS_URL);
      arLoaded = true;
      return true;
    } catch (e) {
      console.warn('AR libraries failed to load:', e);
      return false;
    }
  })();

  return loadingPromise;
}

/**
 * Check if AR is loaded
 */
export function isARLoaded() {
  return arLoaded;
}

/**
 * Simple 2D physics canvas renderer (fallback when AR unavailable)
 */
export class SimCanvas {
  constructor(canvasEl) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.running = false;
    this.drawFn = null;
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2); // Cap at 2x for performance
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    this.ctx.scale(dpr, dpr);
    this.w = rect.width;
    this.h = rect.height;
  }

  setDrawFunction(fn) { this.drawFn = fn; }

  start() {
    this.running = true;
    this._loop();
  }

  stop() { this.running = false; }

  _loop() {
    if (!this.running) return;
    this.ctx.clearRect(0, 0, this.w, this.h);
    if (this.drawFn) this.drawFn(this.ctx, this.w, this.h);
    requestAnimationFrame(() => this._loop());
  }

  clear() {
    this.ctx.clearRect(0, 0, this.w, this.h);
  }
}
