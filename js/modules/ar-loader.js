/**
 * PintAR Mobile — AR Loader
 * Lazy-loads A-Frame + AR.js only when needed.
 * Manages AR scene lifecycle, scan overlay, and marker detection.
 */

let arLoaded = false;
let loadingPromise = null;
let activeScene = null;

const AFRAME_URL = 'https://aframe.io/releases/1.6.0/aframe.min.js';
const ARJS_URL = 'https://raw.githack.com/AR-js-org/AR.js/3.4.8/aframe/build/aframe-ar.js';

function loadScript(url) {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    const existing = document.querySelector(`script[src="${url}"]`);
    if (existing) { resolve(); return; }
    const script = document.createElement('script');
    script.src = url;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/**
 * Check if device can run AR (has camera)
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
 * Create and start an AR scene inside a container.
 * Shows scan overlay until marker is detected.
 * 
 * @param {HTMLElement} container - The div to place the AR scene in
 * @param {string} markerContent - A-Frame entities HTML to place inside the marker
 * @param {object} options - { onMarkerFound, onMarkerLost }
 * @returns {object} - { destroy() } to clean up
 */
export function startARScene(container, markerContent, options = {}) {
  if (!arLoaded) return null;

  // Clean previous scene
  destroyARScene();

  // Build the full AR HTML
  // Get container dimensions for AR source sizing
  const cw = container.offsetWidth  || window.innerWidth;
  const ch = container.offsetHeight || Math.round(window.innerHeight * 0.4);

  container.innerHTML = `
    <!-- Scan Overlay -->
    <div class="ar-scan-overlay" id="ar-scan-overlay">
      <div class="ar-scan-box">
        <div class="ar-scan-corners">
          <span></span><span></span><span></span><span></span>
        </div>
        <p class="ar-scan-text">Arahkan kamera ke <strong>marker Hiro</strong></p>
        <p class="ar-scan-hint">Pastikan marker terlihat jelas & pencahayaan cukup</p>
      </div>
    </div>

    <!-- A-Frame AR Scene -->
    <a-scene
      embedded
      arjs="sourceType: webcam; facingMode: environment; debugUIEnabled: false; detectionMode: mono_and_matrix; matrixCodeType: 3x3; displayWidth: ${cw}; displayHeight: ${ch};"
      renderer="antialias: true; alpha: true; precision: mediump;"
      vr-mode-ui="enabled: false"
      loading-screen="enabled: false"
      style="position:absolute;top:0;left:0;width:100%;height:100%;"
    >
      <a-marker preset="hiro" id="ar-hiro-marker">
        ${markerContent}
      </a-marker>
      <a-entity camera></a-entity>
      <a-light type="ambient" color="#ffffff" intensity="0.7"></a-light>
      <a-light type="directional" color="#ffffff" intensity="0.5" position="1 2 1"></a-light>
    </a-scene>
  `;

  // Get references
  const overlay = container.querySelector('#ar-scan-overlay');
  const marker = container.querySelector('#ar-hiro-marker');

  // Listen for marker events
  if (marker) {
    marker.addEventListener('markerFound', () => {
      if (overlay) overlay.classList.add('hidden');
      if (options.onMarkerFound) options.onMarkerFound();
    });

    marker.addEventListener('markerLost', () => {
      if (overlay) overlay.classList.remove('hidden');
      if (options.onMarkerLost) options.onMarkerLost();
    });
  }

  activeScene = container;

  return {
    destroy: () => destroyARScene()
  };
}

/**
 * Destroy the active AR scene and release camera
 */
export function destroyARScene() {
  if (activeScene) {
    const scene = activeScene.querySelector('a-scene');
    if (scene) {
      // Stop camera stream
      const video = scene.querySelector('video');
      if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(t => t.stop());
      }
      scene.parentNode.removeChild(scene);
    }
    activeScene.innerHTML = '';
    activeScene = null;
  }
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

  clear() {
    this.ctx.clearRect(0, 0, this.w, this.h);
  }

  destroy() {
    this.running = false;
    window.removeEventListener('resize', this._resizeBound);
  }
}
