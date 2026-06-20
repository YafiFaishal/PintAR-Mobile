/**
 * PintAR Mobile — AR Loader (v5 — Complete Rewrite)
 *
 * Strategy: MINIMAL intervention. Let AR.js do its thing.
 * 
 * Previous versions failed because:
 * - MutationObserver overrode AR.js video/canvas styles → broke marker detection
 * - Custom overlay divs covered the camera feed
 * - Race conditions with iOS permission dialogs
 *
 * This version:
 * - Loads A-Frame 1.3.0 + AR.js 3.4.5 (most battle-tested combo)
 * - Injects a-scene DIRECTLY into document.body (as AR.js expects)
 * - Does NOT override any AR.js styles
 * - Provides only a close button overlay
 */

let arLoaded = false;
let loadingPromise = null;

// ─── CDN Sources ─────────────────────────────────────────────────
// A-Frame 1.3.0 is the most stable with AR.js 3.4.5
const CDN_AFRAME = [
  'https://aframe.io/releases/1.3.0/aframe.min.js',
  'https://cdn.jsdelivr.net/gh/aframevr/aframe@v1.3.0/dist/aframe-master.min.js'
];
const CDN_ARJS = [
  'https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar.js',
  'https://cdn.jsdelivr.net/gh/AR-js-org/AR.js@3.4.5/aframe/build/aframe-ar.js'
];

// ─── Script Loader ───────────────────────────────────────────────
function loadScript(url, timeout = 20000) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${url}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = url;
    const timer = setTimeout(() => { s.remove(); reject(new Error('Timeout: ' + url)); }, timeout);
    s.onload = () => { clearTimeout(timer); resolve(); };
    s.onerror = () => { clearTimeout(timer); s.remove(); reject(new Error('Failed: ' + url)); };
    document.head.appendChild(s);
  });
}

async function loadWithFallback(urls, label) {
  for (const url of urls) {
    try {
      await loadScript(url);
      console.log(`[PintAR] ✓ ${label} loaded from ${url}`);
      return;
    } catch (e) {
      console.warn(`[PintAR] ✗ ${label} failed:`, e.message);
    }
  }
  throw new Error(`All sources failed for ${label}`);
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
  if (!info.isSecure) {
    info.reason = 'Halaman harus diakses via HTTPS untuk menggunakan kamera.';
  } else if (!info.hasMediaDevices) {
    info.reason = 'Browser tidak mendukung akses kamera. Gunakan Chrome atau Safari terbaru.';
  } else {
    info.supported = true;
  }
  return info;
}

// ─── Public: requestCameraPermission ─────────────────────────────
export async function requestCameraPermission() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  // iOS: request motion/orientation permissions first (user gesture required)
  if (isIOS) {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      try { await DeviceMotionEvent.requestPermission(); } catch (e) { /* non-fatal */ }
    }
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try { await DeviceOrientationEvent.requestPermission(); } catch (e) { /* non-fatal */ }
    }
  }

  // Request camera
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    stream.getTracks().forEach(t => t.stop());
    return { granted: true, error: null };
  } catch (err) {
    let msg = 'Tidak dapat mengakses kamera.';
    if (err.name === 'NotAllowedError') msg = 'Izin kamera ditolak. Buka pengaturan browser → izinkan kamera.';
    else if (err.name === 'NotFoundError') msg = 'Kamera tidak ditemukan di perangkat.';
    else if (err.name === 'NotReadableError') msg = 'Kamera dipakai aplikasi lain.';
    else if (err.name === 'OverconstrainedError') {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true });
        s.getTracks().forEach(t => t.stop());
        return { granted: true, error: null };
      } catch (e2) { msg = 'Tidak ada kamera yang bisa diakses.'; }
    }
    return { granted: false, error: msg };
  }
}

// ─── Public: loadAR ──────────────────────────────────────────────
export async function loadAR() {
  if (arLoaded) return true;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      await loadWithFallback(CDN_AFRAME, 'A-Frame');
      await new Promise(r => setTimeout(r, 200));
      await loadWithFallback(CDN_ARJS, 'AR.js');
      if (typeof AFRAME === 'undefined') throw new Error('A-Frame not loaded');
      arLoaded = true;
      return true;
    } catch (e) {
      console.error('[PintAR] AR load failed:', e);
      loadingPromise = null;
      return false;
    }
  })();
  return loadingPromise;
}

export function isARLoaded() { return arLoaded; }

// ─── Public: startARScene ────────────────────────────────────────
/**
 * Starts AR by injecting a-scene directly into body.
 * This is how AR.js is DESIGNED to work — no custom wrappers.
 */
export function startARScene(container, markerContent, options = {}) {
  if (!arLoaded) return null;
  destroyARScene();

  // Create the a-scene and inject into body (NOT inside a div wrapper)
  // AR.js expects to control the entire page when active
  const scene = document.createElement('a-scene');
  scene.id = 'ar-scene-pintar';
  scene.setAttribute('embedded', '');
  scene.setAttribute('arjs', 'sourceType: webcam; debugUIEnabled: false; detectionMode: mono_and_matrix; matrixCodeType: 3x3;');
  scene.setAttribute('renderer', 'antialias: true; alpha: true;');
  scene.setAttribute('vr-mode-ui', 'enabled: false');
  scene.setAttribute('loading-screen', 'enabled: false');
  scene.setAttribute('device-orientation-permission-ui', 'enabled: false');
  scene.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; z-index:9999;';

  // Marker
  const marker = document.createElement('a-marker');
  marker.setAttribute('preset', 'hiro');
  marker.id = 'ar-hiro-marker';
  marker.innerHTML = markerContent;
  scene.appendChild(marker);

  // Camera entity
  const cam = document.createElement('a-entity');
  cam.setAttribute('camera', '');
  scene.appendChild(cam);

  // Add to body
  document.body.appendChild(scene);

  // Close button — on body, max z-index
  const closeBtn = document.createElement('button');
  closeBtn.id = 'ar-close-btn';
  closeBtn.textContent = '✕ Tutup AR';
  closeBtn.style.cssText = `
    position:fixed; top:12px; right:12px; z-index:2147483647;
    padding:10px 18px; border-radius:20px; border:none;
    background:rgba(0,0,0,0.8); color:#fff; font-size:14px;
    font-weight:bold; cursor:pointer; pointer-events:auto;
    touch-action:manipulation; -webkit-tap-highlight-color:transparent;
  `;
  closeBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    destroyARScene();
    if (options.onClose) options.onClose();
  };
  document.body.appendChild(closeBtn);

  // Scan overlay
  const overlay = document.createElement('div');
  overlay.id = 'ar-scan-overlay';
  overlay.style.cssText = `
    position:fixed; top:0; left:0; width:100%; height:100%; z-index:10000;
    pointer-events:none; display:flex; align-items:center; justify-content:center;
  `;
  overlay.innerHTML = `
    <div style="text-align:center; padding:24px; background:rgba(0,0,0,0.5); border-radius:16px; border:2px solid rgba(0,255,100,0.5);">
      <p style="color:#fff; font-size:14px; font-weight:600; margin:0 0 8px 0;">Arahkan kamera ke <strong>marker Hiro</strong></p>
      <p style="color:rgba(255,255,255,0.7); font-size:12px; margin:0;">Pastikan marker terlihat jelas & pencahayaan cukup</p>
    </div>
  `;
  document.body.appendChild(overlay);

  // Listen for marker events
  setTimeout(() => {
    const m = document.getElementById('ar-hiro-marker');
    if (m) {
      m.addEventListener('markerFound', () => {
        overlay.style.display = 'none';
        if (options.onMarkerFound) options.onMarkerFound();
      });
      m.addEventListener('markerLost', () => {
        overlay.style.display = 'flex';
        if (options.onMarkerLost) options.onMarkerLost();
      });
    }
  }, 2000);

  return { destroy: destroyARScene };
}

// ─── Public: destroyARScene ──────────────────────────────────────
export function destroyARScene() {
  // Remove scene
  const scene = document.getElementById('ar-scene-pintar');
  if (scene) {
    // Stop camera
    const videos = scene.querySelectorAll('video');
    videos.forEach(v => {
      try { if (v.srcObject) { v.srcObject.getTracks().forEach(t => t.stop()); v.srcObject = null; } v.pause(); } catch(e){}
    });
    scene.remove();
  }

  // Remove any orphan AR.js elements
  document.querySelectorAll('body > video').forEach(v => {
    try { if (v.srcObject) { v.srcObject.getTracks().forEach(t => t.stop()); } v.pause(); } catch(e){}
    v.remove();
  });

  // Remove UI elements
  const btn = document.getElementById('ar-close-btn');
  if (btn) btn.remove();
  const overlay = document.getElementById('ar-scan-overlay');
  if (overlay) overlay.remove();

  console.log('[PintAR] AR destroyed');
}

// ─── SimCanvas (2D simulation fallback) ──────────────────────────
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
