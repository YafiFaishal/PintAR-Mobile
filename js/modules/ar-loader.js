/**
 * PintAR Mobile — AR Loader (v6 — Based on working ar-test.html)
 *
 * This uses the EXACT same approach as ar-test.html which is proven to work:
 * - Same CDN URLs (aframe.io 1.3.0 + raw.githack AR.js master)
 * - a-scene injected directly into body with 'embedded' attribute
 * - Minimal arjs config: "sourceType: webcam; debugUIEnabled: false;"
 * - NO MutationObserver, NO style overrides, NO wrapper divs
 */

let arLoaded = false;
let loadingPromise = null;

// EXACT same URLs as ar-test.html (which works!)
const AFRAME_URL = 'https://aframe.io/releases/1.3.0/aframe.min.js';
const ARJS_URL = 'https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar.js';

// ─── Script Loader ───────────────────────────────────────────────
function loadScript(url) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${url}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = url;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load: ' + url));
    document.head.appendChild(s);
  });
}

// ─── Public: canRunAR ────────────────────────────────────────────
export function canRunAR() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return false;
  return true;
}

// ─── Public: getARSupportInfo ────────────────────────────────────
export function getARSupportInfo() {
  const info = {
    supported: false,
    reason: '',
    isSecure: location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1',
    hasMediaDevices: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
  };
  if (!info.isSecure) info.reason = 'Halaman harus diakses via HTTPS.';
  else if (!info.hasMediaDevices) info.reason = 'Browser tidak mendukung kamera.';
  else info.supported = true;
  return info;
}

// ─── Public: requestCameraPermission ─────────────────────────────
export async function requestCameraPermission() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    stream.getTracks().forEach(t => t.stop());
    return { granted: true, error: null };
  } catch (err) {
    let msg = 'Tidak dapat mengakses kamera.';
    if (err.name === 'NotAllowedError') msg = 'Izin kamera ditolak.';
    else if (err.name === 'NotFoundError') msg = 'Kamera tidak ditemukan.';
    else if (err.name === 'NotReadableError') msg = 'Kamera dipakai aplikasi lain.';
    return { granted: false, error: msg };
  }
}

// ─── Public: loadAR ──────────────────────────────────────────────
export async function loadAR() {
  if (arLoaded) return true;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      await loadScript(AFRAME_URL);
      await loadScript(ARJS_URL);
      if (typeof AFRAME === 'undefined') throw new Error('AFRAME not defined');
      arLoaded = true;
      console.log('[PintAR] AR libraries loaded');
      return true;
    } catch (e) {
      console.error('[PintAR] Failed to load AR:', e);
      loadingPromise = null;
      return false;
    }
  })();
  return loadingPromise;
}

export function isARLoaded() { return arLoaded; }

// ─── Public: startARScene ────────────────────────────────────────
/**
 * Uses EXACTLY the same structure as ar-test.html:
 * - a-scene with embedded + arjs attributes directly in body
 * - No wrapper divs, no style overrides
 */
export function startARScene(container, markerContent, options = {}) {
  if (!arLoaded) return null;
  destroyARScene();

  // Hide page content
  document.body.classList.add('ar-active');

  // Create a-scene — same config as ar-test.html
  const scene = document.createElement('a-scene');
  scene.id = 'pintar-ar-scene';
  scene.setAttribute('embedded', '');
  scene.setAttribute('arjs', 'sourceType: webcam; debugUIEnabled: false;');
  scene.setAttribute('vr-mode-ui', 'enabled: false');
  scene.setAttribute('renderer', 'logarithmicDepthBuffer: true; antialias: true;');

  // Marker with content
  const marker = document.createElement('a-marker');
  marker.setAttribute('preset', 'hiro');
  marker.id = 'pintar-ar-marker';
  marker.innerHTML = markerContent;
  scene.appendChild(marker);

  // Camera
  const cam = document.createElement('a-entity');
  cam.setAttribute('camera', '');
  scene.appendChild(cam);

  // Add scene to body
  document.body.appendChild(scene);

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.id = 'pintar-ar-close';
  closeBtn.textContent = '✕ Tutup AR';
  closeBtn.style.cssText = 'position:fixed;top:12px;right:12px;z-index:999999;padding:10px 18px;border-radius:20px;border:none;background:rgba(220,38,38,0.9);color:#fff;font-size:14px;font-weight:bold;cursor:pointer;';
  closeBtn.onclick = () => {
    destroyARScene();
    if (options.onClose) options.onClose();
  };
  document.body.appendChild(closeBtn);

  // Info/scan overlay
  const info = document.createElement('div');
  info.id = 'pintar-ar-info';
  info.style.cssText = 'position:fixed;bottom:12px;left:12px;right:12px;z-index:999999;padding:12px;background:rgba(0,0,0,0.7);color:#fff;border-radius:10px;text-align:center;font-size:13px;pointer-events:none;';
  info.textContent = 'Arahkan kamera ke marker Hiro...';
  document.body.appendChild(info);

  // Marker events
  setTimeout(() => {
    const m = document.getElementById('pintar-ar-marker');
    if (m) {
      m.addEventListener('markerFound', () => {
        info.textContent = 'Marker terdeteksi! 🎉';
        info.style.background = 'rgba(0,128,0,0.8)';
        if (options.onMarkerFound) options.onMarkerFound();
      });
      m.addEventListener('markerLost', () => {
        info.textContent = 'Marker hilang. Arahkan kamera lagi...';
        info.style.background = 'rgba(0,0,0,0.7)';
        if (options.onMarkerLost) options.onMarkerLost();
      });
    }
  }, 2000);

  return { destroy: destroyARScene };
}

// ─── Public: destroyARScene ──────────────────────────────────────
export function destroyARScene() {
  // Remove scene
  const scene = document.getElementById('pintar-ar-scene');
  if (scene) {
    scene.querySelectorAll('video').forEach(v => {
      try { if (v.srcObject) { v.srcObject.getTracks().forEach(t => t.stop()); } v.pause(); } catch(e){}
    });
    scene.remove();
  }

  // Remove orphan videos AR.js might leave
  document.querySelectorAll('body > video').forEach(v => {
    try { if (v.srcObject) { v.srcObject.getTracks().forEach(t => t.stop()); } v.pause(); } catch(e){}
    v.remove();
  });

  // Remove UI
  const btn = document.getElementById('pintar-ar-close');
  if (btn) btn.remove();
  const info = document.getElementById('pintar-ar-info');
  if (info) info.remove();

  // Show page content again
  document.body.classList.remove('ar-active');
}

// ─── SimCanvas (2D simulation renderer) ──────────────────────────
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
  start() { this.running = true; this._loop(); }
  stop() { this.running = false; }
  clear() { this.ctx.clearRect(0, 0, this.w, this.h); }
  destroy() { this.running = false; window.removeEventListener('resize', this._resizeBound); }
  _loop() {
    if (!this.running) return;
    this.ctx.clearRect(0, 0, this.w, this.h);
    if (this.drawFn) this.drawFn(this.ctx, this.w, this.h);
    requestAnimationFrame(() => this._loop());
  }
}
