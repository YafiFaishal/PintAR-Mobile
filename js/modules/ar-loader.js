/**
 * PintAR Mobile — AR Loader (v6)
 * 
 * Uses EXACT same approach as ar-test.html (which works on mobile+desktop):
 * - Same CDN: aframe.io/1.3.0 + raw.githack AR.js master
 * - Same config: sourceType: webcam; debugUIEnabled: false;
 * - a-scene with 'embedded' directly in body
 * - NO MutationObserver, NO forceFullscreen, NO wrapper divs
 */

let arLoaded = false;
let loadingPromise = null;

// Same URLs as ar-test.html
const AFRAME_URL = 'https://aframe.io/releases/1.3.0/aframe.min.js';
const ARJS_URL = 'https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar.js';

function loadScript(url) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${url}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = url;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed: ' + url));
    document.head.appendChild(s);
  });
}

export function canRunAR() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return false;
  return true;
}

export function getARSupportInfo() {
  const info = { supported: false, reason: '', isSecure: location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1', hasMediaDevices: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) };
  if (!info.isSecure) info.reason = 'Halaman harus diakses via HTTPS.';
  else if (!info.hasMediaDevices) info.reason = 'Browser tidak mendukung kamera.';
  else info.supported = true;
  return info;
}

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

export async function loadAR() {
  if (arLoaded) return true;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    try {
      await loadScript(AFRAME_URL);
      await loadScript(ARJS_URL);
      if (typeof AFRAME === 'undefined') throw new Error('AFRAME not defined');
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

/**
 * Start AR — same structure as ar-test.html
 */
export function startARScene(container, markerContent, options = {}) {
  if (!arLoaded) return null;
  destroyARScene();

  // Save scroll position before hiding content
  window._pintarScrollY = window.scrollY;
  document.body.classList.add('ar-active');
  // Prevent body scroll during AR
  document.body.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.width = '100%';
  document.body.style.top = `-${window._pintarScrollY}px`;

  // a-scene directly in body — exactly like ar-test.html
  const scene = document.createElement('a-scene');
  scene.id = 'pintar-ar-scene';
  scene.setAttribute('embedded', '');
  scene.setAttribute('arjs', 'sourceType: webcam; debugUIEnabled: false;');
  scene.setAttribute('vr-mode-ui', 'enabled: false');
  scene.setAttribute('renderer', 'logarithmicDepthBuffer: true; antialias: true;');

  const marker = document.createElement('a-marker');
  marker.setAttribute('preset', 'hiro');
  marker.id = 'pintar-ar-marker';
  marker.innerHTML = markerContent;
  scene.appendChild(marker);

  const cam = document.createElement('a-entity');
  cam.setAttribute('camera', '');
  scene.appendChild(cam);

  document.body.appendChild(scene);

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.id = 'pintar-ar-close';
  closeBtn.textContent = '✕ Tutup AR';
  closeBtn.style.cssText = 'position:fixed;top:12px;right:12px;z-index:999999;padding:12px 20px;border-radius:24px;border:2px solid rgba(255,255,255,0.3);background:rgba(220,38,38,0.9);color:#fff;font-size:14px;font-weight:bold;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.4);';
  closeBtn.onclick = () => { destroyARScene(); if (options.onClose) options.onClose(); };
  document.body.appendChild(closeBtn);

  // Info bar with scan instructions
  const info = document.createElement('div');
  info.id = 'pintar-ar-info';
  info.style.cssText = 'position:fixed;bottom:20px;left:16px;right:16px;z-index:999999;padding:14px 16px;background:rgba(0,0,0,0.75);color:#fff;border-radius:12px;text-align:center;font-size:13px;pointer-events:none;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,0.1);';
  info.innerHTML = '📷 Arahkan kamera ke <strong>marker Hiro</strong>';
  document.body.appendChild(info);

  // Marker events
  setTimeout(() => {
    const m = document.getElementById('pintar-ar-marker');
    if (m) {
      m.addEventListener('markerFound', () => {
        info.innerHTML = '✅ <strong>Marker terdeteksi!</strong> Objek 3D tampil di atas marker.';
        info.style.background = 'rgba(0,128,0,0.8)';
        if (options.onMarkerFound) options.onMarkerFound();
      });
      m.addEventListener('markerLost', () => {
        info.innerHTML = '📷 Arahkan kamera ke <strong>marker Hiro</strong>';
        info.style.background = 'rgba(0,0,0,0.75)';
        if (options.onMarkerLost) options.onMarkerLost();
      });
    }
  }, 2000);

  return { destroy: destroyARScene };
}

export function destroyARScene() {
  const scene = document.getElementById('pintar-ar-scene');
  if (scene) {
    scene.querySelectorAll('video').forEach(v => { try { if (v.srcObject) v.srcObject.getTracks().forEach(t => t.stop()); v.pause(); } catch(e){} });
    scene.remove();
  }
  document.querySelectorAll('body > video').forEach(v => { try { if (v.srcObject) v.srcObject.getTracks().forEach(t => t.stop()); v.pause(); } catch(e){} v.remove(); });
  const btn = document.getElementById('pintar-ar-close'); if (btn) btn.remove();
  const info = document.getElementById('pintar-ar-info'); if (info) info.remove();
  
  // Restore body scroll
  document.body.classList.remove('ar-active');
  document.body.style.overflow = '';
  document.body.style.position = '';
  document.body.style.width = '';
  document.body.style.top = '';
  
  // Restore scroll position
  if (window._pintarScrollY !== undefined) {
    window.scrollTo(0, window._pintarScrollY);
    window._pintarScrollY = undefined;
  }
}

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
  start() { this.running = true; this._resize(); this._loop(); }
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
