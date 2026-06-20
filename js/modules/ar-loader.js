/**
 * PintAR Mobile — AR Loader  (v3 — MutationObserver video fix)
 *
 * Root cause of camera shift on iOS/Android:
 *   AR.js continuously sets inline px-based styles on <video> via JS.
 *   CSS overrides get beaten by subsequent JS style mutations.
 *
 * Fix: MutationObserver intercepts every style mutation on the video
 *      and re-applies the correct fullscreen styles using setProperty('important').
 */

let arLoaded       = false;
let loadingPromise = null;
let arRootEl       = null;   // fixed overlay appended to body
let videoObserver  = null;   // MutationObserver that keeps video fullscreen

const AFRAME_URL = 'https://aframe.io/releases/1.6.0/aframe.min.js';
const ARJS_URL   = 'https://raw.githack.com/AR-js-org/AR.js/3.4.8/aframe/build/aframe-ar.js';

// ─── Script loader ───────────────────────────────────────────────
function loadScript(url) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${url}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = url; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ─── Public API ──────────────────────────────────────────────────
export function canRunAR() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

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
      console.warn('AR libs failed:', e);
      return false;
    }
  })();
  return loadingPromise;
}

export function isARLoaded() { return arLoaded; }

// ─── Force a video/canvas element to be truly fullscreen ─────────
function forceFullscreen(el) {
  if (!el) return;
  const props = [
    ['position',   'fixed'],
    ['top',        '0'],
    ['left',       '0'],
    ['width',      '100%'],
    ['height',     '100%'],
    ['max-width',  '100%'],
    ['max-height', '100%'],
    ['object-fit', 'cover'],
    ['transform',  'none'],
    ['z-index',    el.tagName === 'VIDEO' ? '99' : '100'],
  ];
  props.forEach(([p, v]) => el.style.setProperty(p, v, 'important'));
}

// ─── Start MutationObserver that fights AR.js style mutations ────
function startVideoWatcher() {
  stopVideoWatcher(); // clean previous observer

  videoObserver = new MutationObserver((mutations) => {
    mutations.forEach(m => {
      // New video/canvas nodes added anywhere in document
      m.addedNodes && m.addedNodes.forEach(node => {
        if (node.tagName === 'VIDEO')  forceFullscreen(node);
        if (node.tagName === 'CANVAS') forceFullscreen(node);
      });
      // Style attribute changed on an existing video/canvas
      if (m.type === 'attributes' && m.attributeName === 'style') {
        const t = m.target;
        if (t.tagName === 'VIDEO' || (t.tagName === 'CANVAS' && t.classList.contains('a-canvas'))) {
          forceFullscreen(t);
        }
      }
    });
  });

  videoObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style'],
  });
}

function stopVideoWatcher() {
  if (videoObserver) { videoObserver.disconnect(); videoObserver = null; }
}

// ─── startARScene ─────────────────────────────────────────────────
/**
 * Creates a fixed fullscreen AR overlay appended directly to body.
 * a-scene has NO "embedded" attribute → A-Frame renders fullscreen natively.
 * MutationObserver keeps the camera video truly full-screen on iOS & Android.
 *
 * @param {HTMLElement} container - reference div (for lifecycle, not rendering)
 * @param {string} markerContent  - A-Frame entities HTML inside <a-marker>
 * @param {object} options        - { onMarkerFound, onMarkerLost }
 */
export function startARScene(container, markerContent, options = {}) {
  if (!arLoaded) return null;
  destroyARScene();

  // ── Fullscreen overlay appended to body ──
  const root = document.createElement('div');
  root.id = 'ar-root';
  root.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:100;overflow:hidden;background:#000;pointer-events:none;';
  document.body.appendChild(root);
  arRootEl = root;

  // Re-enable pointer events for the a-scene wrapper (handles touch/tap)
  const sceneWrap = document.createElement('div');
  sceneWrap.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:100;pointer-events:auto;';
  root.appendChild(sceneWrap);

  sceneWrap.innerHTML = `
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
      <a-light type="ambient"      color="#ffffff" intensity="0.7"></a-light>
      <a-light type="directional"  color="#ffffff" intensity="0.5" position="1 2 1"></a-light>
    </a-scene>
  `;

  // ── Scan overlay on top of a-scene ──
  const scanOverlay = document.createElement('div');
  scanOverlay.id        = 'ar-scan-overlay';
  scanOverlay.className = 'ar-scan-overlay';
  scanOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:110;pointer-events:none;';
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

  // ── Start watcher BEFORE a-scene init so we catch the first style mutations ──
  startVideoWatcher();

  // ── Also run immediately after A-Frame loads (belt-and-suspenders) ──
  setTimeout(() => {
    document.querySelectorAll('video').forEach(forceFullscreen);
    document.querySelectorAll('canvas.a-canvas, canvas').forEach(c => {
      if (c.closest('#ar-root') || c.parentElement === document.body) forceFullscreen(c);
    });

    // Hook marker events
    const marker = document.getElementById('ar-hiro-marker');
    if (marker) {
      marker.addEventListener('markerFound', () => {
        scanOverlay.classList.add('hidden');
        options.onMarkerFound && options.onMarkerFound();
      });
      marker.addEventListener('markerLost', () => {
        scanOverlay.classList.remove('hidden');
        options.onMarkerLost && options.onMarkerLost();
      });
    }
  }, 500);

  return { destroy: () => destroyARScene() };
}

// ─── destroyARScene ───────────────────────────────────────────────
export function destroyARScene() {
  stopVideoWatcher();

  // Stop all camera streams
  document.querySelectorAll('video').forEach(v => {
    try { if (v.srcObject) { v.srcObject.getTracks().forEach(t => t.stop()); v.srcObject = null; } } catch(e){}
  });

  // Remove AR overlay
  const existing = document.getElementById('ar-root');
  if (existing) existing.remove();

  // Clean up any orphaned elements AR.js left in body
  document.querySelectorAll('body > a-scene').forEach(el => el.remove());
  document.querySelectorAll('body > video').forEach(el => { try { el.srcObject && el.srcObject.getTracks().forEach(t=>t.stop()); } catch(e){} el.remove(); });

  arRootEl = null;
}

// ─── SimCanvas ───────────────────────────────────────────────────
export class SimCanvas {
  constructor(canvasEl) {
    this.canvas = canvasEl;
    this.ctx    = canvasEl.getContext('2d');
    this.running = false;
    this.drawFn  = null;
    this._resize();
    this._resizeBound = () => this._resize();
    window.addEventListener('resize', this._resizeBound);
  }

  _resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr  = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width  = rect.width  * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width  = rect.width  + 'px';
    this.canvas.style.height = rect.height + 'px';
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
    this.w = rect.width;
    this.h = rect.height;
  }

  setDrawFunction(fn) { this.drawFn = fn; }
  start()  { this.running = true;  this._loop(); }
  stop()   { this.running = false; }
  clear()  { this.ctx.clearRect(0, 0, this.w, this.h); }
  destroy(){ this.running = false; window.removeEventListener('resize', this._resizeBound); }

  _loop() {
    if (!this.running) return;
    this.ctx.clearRect(0, 0, this.w, this.h);
    if (this.drawFn) this.drawFn(this.ctx, this.w, this.h);
    requestAnimationFrame(() => this._loop());
  }
}
