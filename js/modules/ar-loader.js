/**
 * PintAR Mobile — AR Loader
 * Lazy-loads A-Frame + AR.js only when needed.
 * Manages AR scene lifecycle, scan overlay, and marker detection.
 *
 * Mobile fix: a-scene is appended directly to body WITHOUT "embedded"
 * so A-Frame renders truly fullscreen on iOS Safari without offset.
 */

let arLoaded = false;
let loadingPromise = null;
let arRootEl = null; // The fixed fullscreen overlay we inject into body

const AFRAME_URL = 'https://aframe.io/releases/1.6.0/aframe.min.js';
const ARJS_URL   = 'https://raw.githack.com/AR-js-org/AR.js/3.4.8/aframe/build/aframe-ar.js';

function loadScript(url) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${url}"]`);
    if (existing) { resolve(); return; }
    const script = document.createElement('script');
    script.src = url;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/** Check if device can run AR (has camera API) */
export function canRunAR() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

/** Lazy-load AR libraries. Returns true if successful. */
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

/** Check if AR is loaded */
export function isARLoaded() { return arLoaded; }

/**
 * Start AR scene. Appends a FIXED FULLSCREEN overlay to document.body
 * (not inside the container div) so A-Frame fills the screen correctly
 * on iOS Safari without camera offset.
 *
 * The header (z-index 150) and bottom sheet (z-index 200) float on top.
 *
 * @param {HTMLElement} container - Reference div (used for cleanup, not rendering)
 * @param {string} markerContent - A-Frame entities HTML inside <a-marker>
 * @param {object} options - { onMarkerFound, onMarkerLost }
 * @returns {{ destroy() }}
 */
export function startARScene(container, markerContent, options = {}) {
  if (!arLoaded) return null;

  // Clean any existing AR scene first
  destroyARScene();

  // ── Create fixed fullscreen overlay appended to body ──
  const root = document.createElement('div');
  root.id = 'ar-root';
  root.style.cssText = [
    'position:fixed',
    'top:0', 'left:0',
    'width:100%', 'height:100%',
    'z-index:100',
    'overflow:hidden',
    'background:#000',
  ].join(';');
  document.body.appendChild(root);
  arRootEl = root;

  // ── Scan overlay (fixed, above a-scene) ──
  const scanOverlay = document.createElement('div');
  scanOverlay.id = 'ar-scan-overlay';
  scanOverlay.className = 'ar-scan-overlay';
  // Override position to fixed so it sits above the a-scene canvas
  scanOverlay.style.cssText = 'position:fixed;inset:0;z-index:102;';
  scanOverlay.innerHTML = `
    <div class="ar-scan-box">
      <div class="ar-scan-corners">
        <span></span><span></span><span></span><span></span>
      </div>
      <p class="ar-scan-text">Arahkan kamera ke <strong>marker Hiro</strong></p>
      <p class="ar-scan-hint">Pastikan marker terlihat jelas &amp; pencahayaan cukup</p>
    </div>
  `;
  root.appendChild(scanOverlay);

  // ── A-Frame scene — NO "embedded", renders fullscreen natively ──
  const sceneWrapper = document.createElement('div');
  sceneWrapper.style.cssText = 'position:fixed;inset:0;z-index:100;';
  sceneWrapper.innerHTML = `
    <a-scene
      arjs="sourceType: webcam; facingMode: environment; debugUIEnabled: false; detectionMode: mono_and_matrix; matrixCodeType: 3x3;"
      renderer="antialias: true; alpha: true; precision: mediump;"
      vr-mode-ui="enabled: false"
      loading-screen="enabled: false"
    >
      <a-marker preset="hiro" id="ar-hiro-marker">
        ${markerContent}
      </a-marker>
      <a-entity camera></a-entity>
      <a-light type="ambient" color="#ffffff" intensity="0.7"></a-light>
      <a-light type="directional" color="#ffffff" intensity="0.5" position="1 2 1"></a-light>
    </a-scene>
  `;
  root.appendChild(sceneWrapper);

  // ── Marker detection events ──
  // Wait a tick for a-scene to register in DOM
  setTimeout(() => {
    const marker = document.getElementById('ar-hiro-marker');
    if (marker) {
      marker.addEventListener('markerFound', () => {
        scanOverlay.classList.add('hidden');
        if (options.onMarkerFound) options.onMarkerFound();
      });
      marker.addEventListener('markerLost', () => {
        scanOverlay.classList.remove('hidden');
        if (options.onMarkerLost) options.onMarkerLost();
      });
    }
  }, 0);

  return { destroy: () => destroyARScene() };
}

/** Destroy the active AR scene and release camera */
export function destroyARScene() {
  // Stop all camera streams
  document.querySelectorAll('video').forEach(v => {
    if (v.srcObject) {
      v.srcObject.getTracks().forEach(t => t.stop());
      v.srcObject = null;
    }
  });

  // Remove the fullscreen AR root overlay
  const existing = document.getElementById('ar-root');
  if (existing) existing.remove();

  // Also clean up any orphaned a-scene / video AR.js left in body
  document.querySelectorAll('body > a-scene').forEach(el => el.remove());
  document.querySelectorAll('body > video').forEach(el => el.remove());
  document.querySelectorAll('body > canvas:not(#pendulum-canvas):not(#graph-canvas)').forEach(el => el.remove());

  arRootEl = null;
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
    this._resizeBound = () => this._resize();
    window.addEventListener('resize', this._resizeBound);
  }

  _resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
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

  clear() { this.ctx.clearRect(0, 0, this.w, this.h); }

  destroy() {
    this.running = false;
    window.removeEventListener('resize', this._resizeBound);
  }
}
