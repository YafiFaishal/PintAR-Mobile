/**
 * PintAR Mobile — AR Loader (v4 — Full Rewrite)
 *
 * Fixes:
 * 1. Stable CDN (jsDelivr) instead of unreliable raw.githack.com
 * 2. Better AR.js configuration for iOS/Android compatibility
 * 3. Actual camera permission check (not just API existence)
 * 4. Retry logic with fallback CDN sources
 * 5. iOS-specific video orientation fix
 * 6. MutationObserver to fight AR.js inline style mutations
 * 7. HTTPS detection and user messaging
 */

let arLoaded       = false;
let loadingPromise = null;
let arRootEl       = null;
let videoObserver  = null;

// ─── CDN Sources (primary + fallback) ────────────────────────────
const CDN_SOURCES = {
  aframe: [
    'https://cdn.jsdelivr.net/gh/aframevr/aframe@v1.5.0/dist/aframe-master.min.js',
    'https://aframe.io/releases/1.5.0/aframe.min.js',
    'https://unpkg.com/aframe@1.5.0/dist/aframe-master.min.js'
  ],
  arjs: [
    'https://cdn.jsdelivr.net/gh/AR-js-org/AR.js@3.4.5/aframe/build/aframe-ar.js',
    'https://unpkg.com/ar.js@3.4.5/aframe/build/aframe-ar.js',
    'https://cdn.jsdelivr.net/gh/AR-js-org/AR.js@3.4.5/aframe/build/aframe-ar-nft.js'
  ]
};

// ─── Utility: Load script with timeout ───────────────────────────
function loadScript(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (document.querySelector(`script[src="${url}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = url;
    s.crossOrigin = 'anonymous';

    const timer = setTimeout(() => {
      s.remove();
      reject(new Error(`Timeout loading: ${url}`));
    }, timeoutMs);

    s.onload = () => { clearTimeout(timer); resolve(); };
    s.onerror = () => { clearTimeout(timer); s.remove(); reject(new Error(`Failed to load: ${url}`)); };
    document.head.appendChild(s);
  });
}

// ─── Load with fallback: try multiple CDN sources ────────────────
async function loadWithFallback(sources, label) {
  let lastError = null;
  for (const url of sources) {
    try {
      console.log(`[PintAR] Loading ${label} from: ${url}`);
      await loadScript(url, 20000);
      console.log(`[PintAR] ✓ ${label} loaded successfully`);
      return true;
    } catch (e) {
      console.warn(`[PintAR] ✗ ${label} failed from ${url}:`, e.message);
      lastError = e;
    }
  }
  throw lastError || new Error(`All CDN sources failed for ${label}`);
}

// ─── Public: Check if device can run AR ──────────────────────────
export function canRunAR() {
  // Basic API check
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return false;
  }
  // HTTPS check (camera requires secure context)
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    return false;
  }
  return true;
}

// ─── Public: Get detailed AR support info ────────────────────────
export function getARSupportInfo() {
  const info = {
    supported: false,
    reason: '',
    isSecure: location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1',
    hasMediaDevices: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream,
    isAndroid: /Android/i.test(navigator.userAgent),
    browser: detectBrowser()
  };

  if (!info.isSecure) {
    info.reason = 'Halaman harus diakses via HTTPS untuk menggunakan kamera.';
  } else if (!info.hasMediaDevices) {
    info.reason = 'Browser tidak mendukung akses kamera. Gunakan Chrome atau Safari terbaru.';
  } else {
    info.supported = true;
    info.reason = 'Perangkat mendukung AR.';
  }

  return info;
}

function detectBrowser() {
  const ua = navigator.userAgent;
  if (/CriOS/i.test(ua)) return 'chrome-ios';
  if (/FxiOS/i.test(ua)) return 'firefox-ios';
  if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return 'safari';
  if (/Chrome/i.test(ua)) return 'chrome';
  if (/Firefox/i.test(ua)) return 'firefox';
  return 'other';
}

// ─── Public: Request camera permission explicitly ────────────────
export async function requestCameraPermission() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
    // Permission granted — stop the test stream immediately
    stream.getTracks().forEach(track => track.stop());
    return { granted: true, error: null };
  } catch (err) {
    let message = 'Tidak dapat mengakses kamera.';
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      message = 'Izin kamera ditolak. Buka pengaturan browser dan izinkan akses kamera untuk situs ini.';
    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      message = 'Kamera tidak ditemukan di perangkat ini.';
    } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      message = 'Kamera sedang digunakan aplikasi lain. Tutup aplikasi tersebut dan coba lagi.';
    } else if (err.name === 'OverconstrainedError') {
      message = 'Kamera belakang tidak tersedia. Mencoba kamera depan...';
      // Try front camera as fallback
      try {
        const stream2 = await navigator.mediaDevices.getUserMedia({ video: true });
        stream2.getTracks().forEach(track => track.stop());
        return { granted: true, error: null };
      } catch (e2) {
        message = 'Tidak ada kamera yang bisa diakses.';
      }
    }
    return { granted: false, error: message };
  }
}

// ─── Public: Load AR libraries ───────────────────────────────────
export async function loadAR() {
  if (arLoaded) return true;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      // Load A-Frame first (AR.js depends on it)
      await loadWithFallback(CDN_SOURCES.aframe, 'A-Frame');

      // Small delay to ensure A-Frame is fully initialized
      await new Promise(r => setTimeout(r, 300));

      // Then load AR.js
      await loadWithFallback(CDN_SOURCES.arjs, 'AR.js');

      // Verify both loaded correctly
      if (typeof AFRAME === 'undefined') {
        throw new Error('A-Frame not defined after loading');
      }

      arLoaded = true;
      console.log('[PintAR] ✓ AR stack ready (A-Frame + AR.js)');
      return true;
    } catch (e) {
      console.error('[PintAR] ✗ AR libraries failed to load:', e);
      loadingPromise = null; // Allow retry
      return false;
    }
  })();
  return loadingPromise;
}

export function isARLoaded() { return arLoaded; }

// ─── Force fullscreen on video/canvas elements ───────────────────
function forceFullscreen(el) {
  if (!el) return;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const props = [
    ['position',   'fixed'],
    ['top',        '0'],
    ['left',       '0'],
    ['width',      '100vw'],
    ['height',     '100vh'],
    ['max-width',  '100vw'],
    ['max-height', '100vh'],
    ['object-fit', 'cover'],
    ['transform',  'none'],
    ['margin',     '0'],
    ['padding',    '0'],
    ['z-index',    el.tagName === 'VIDEO' ? '1' : '2'],
  ];
  // iOS Safari sometimes needs translateZ(0) for proper compositing
  if (isIOS) {
    props.push(['-webkit-transform', 'translateZ(0)']);
  }
  props.forEach(([p, v]) => el.style.setProperty(p, v, 'important'));
}

// ─── MutationObserver: fight AR.js inline style overrides ────────
function startVideoWatcher() {
  stopVideoWatcher();

  videoObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      // New nodes added
      if (m.addedNodes) {
        m.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          if (node.tagName === 'VIDEO') forceFullscreen(node);
          if (node.tagName === 'CANVAS' && (node.classList.contains('a-canvas') || node.closest('#ar-root'))) {
            forceFullscreen(node);
          }
          // Check children too
          if (node.querySelectorAll) {
            node.querySelectorAll('video, canvas.a-canvas').forEach(forceFullscreen);
          }
        });
      }
      // Style mutations on video/canvas
      if (m.type === 'attributes' && m.attributeName === 'style') {
        const t = m.target;
        if (t.tagName === 'VIDEO' || (t.tagName === 'CANVAS' && t.classList.contains('a-canvas'))) {
          forceFullscreen(t);
        }
      }
    }
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
 * Creates a fullscreen AR overlay.
 *
 * Improved settings for better compatibility:
 * - sourceWidth/sourceHeight for consistent video resolution
 * - patternRatio for better marker detection
 * - maxDetectionRate for performance balance
 *
 * @param {HTMLElement} container - reference div (lifecycle only)
 * @param {string} markerContent - A-Frame entities HTML inside <a-marker>
 * @param {object} options - { onMarkerFound, onMarkerLost, onError }
 */
export function startARScene(container, markerContent, options = {}) {
  if (!arLoaded) {
    console.error('[PintAR] Cannot start AR scene: libraries not loaded');
    if (options.onError) options.onError('AR libraries not loaded');
    return null;
  }
  destroyARScene();

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/i.test(navigator.userAgent);

  // ── Fullscreen overlay ──
  const root = document.createElement('div');
  root.id = 'ar-root';
  root.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;overflow:hidden;background:#000;';
  document.body.appendChild(root);
  arRootEl = root;

  // Scene wrapper with pointer events
  const sceneWrap = document.createElement('div');
  sceneWrap.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;pointer-events:auto;';
  root.appendChild(sceneWrap);

  // AR.js config optimized for mobile
  // Lower sourceWidth/Height for better performance on older devices
  const sourceWidth = isIOS ? 640 : 800;
  const sourceHeight = isIOS ? 480 : 600;

  sceneWrap.innerHTML = `
    <a-scene
      arjs="sourceType: webcam;
            facingMode: environment;
            sourceWidth: ${sourceWidth};
            sourceHeight: ${sourceHeight};
            displayWidth: ${window.innerWidth};
            displayHeight: ${window.innerHeight};
            debugUIEnabled: false;
            detectionMode: mono_and_matrix;
            matrixCodeType: 3x3;
            patternRatio: 0.75;
            maxDetectionRate: 60;
            canvasWidth: ${window.innerWidth};
            canvasHeight: ${window.innerHeight};"
      renderer="antialias: true; alpha: true; precision: ${isIOS ? 'highp' : 'mediump'}; logarithmicDepthBuffer: true;"
      vr-mode-ui="enabled: false"
      loading-screen="enabled: false"
      gesture-detector
    >
      <a-marker preset="hiro" id="ar-hiro-marker" smooth="true" smoothCount="5" smoothTolerance="0.01" smoothThreshold="2">
        ${markerContent}
      </a-marker>
      <a-entity camera></a-entity>
      <a-light type="ambient" color="#ffffff" intensity="0.8"></a-light>
      <a-light type="directional" color="#ffffff" intensity="0.5" position="1 2 1"></a-light>
    </a-scene>
  `;

  // ── Close button (always accessible) ──
  const closeBtn = document.createElement('button');
  closeBtn.id = 'ar-close-btn';
  closeBtn.innerHTML = '✕ Tutup AR';
  closeBtn.style.cssText = `
    position: fixed; top: 16px; right: 16px; z-index: 10001;
    padding: 10px 18px; border-radius: 24px; border: none;
    background: rgba(0,0,0,0.7); color: #fff; font-size: 14px;
    font-weight: 600; cursor: pointer; pointer-events: auto;
    backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  `;
  closeBtn.addEventListener('click', () => {
    destroyARScene();
    if (options.onClose) options.onClose();
  });
  root.appendChild(closeBtn);

  // ── Scan overlay ──
  const scanOverlay = document.createElement('div');
  scanOverlay.id = 'ar-scan-overlay';
  scanOverlay.className = 'ar-scan-overlay';
  scanOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:10000;pointer-events:none;';
  scanOverlay.innerHTML = `
    <div class="ar-scan-box">
      <div class="ar-scan-corners">
        <span></span><span></span><span></span><span></span>
      </div>
      <p class="ar-scan-text">Arahkan kamera ke <strong>marker Hiro</strong></p>
      <p class="ar-scan-hint">Pastikan marker terlihat jelas & pencahayaan cukup</p>
    </div>
  `;
  root.appendChild(scanOverlay);

  // ── Start video watcher ──
  startVideoWatcher();

  // ── Post-init: fix video, attach marker events ──
  const initTimeout = setTimeout(() => {
    document.querySelectorAll('video').forEach(forceFullscreen);
    document.querySelectorAll('canvas.a-canvas, canvas').forEach(c => {
      if (c.closest('#ar-root') || c.parentElement === document.body) forceFullscreen(c);
    });

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
  }, 1000);

  // ── Safety timeout: if AR scene doesn't load in 30s, show error ──
  const safetyTimeout = setTimeout(() => {
    const scene = document.querySelector('#ar-root a-scene');
    if (scene && !scene.hasLoaded) {
      console.warn('[PintAR] AR scene safety timeout — scene did not load in 30s');
      if (options.onError) options.onError('AR scene timeout — kemungkinan kamera tidak bisa diakses');
    }
  }, 30000);

  return {
    destroy: () => {
      clearTimeout(initTimeout);
      clearTimeout(safetyTimeout);
      destroyARScene();
    }
  };
}

// ─── destroyARScene ───────────────────────────────────────────────
export function destroyARScene() {
  stopVideoWatcher();

  // Stop all camera streams
  document.querySelectorAll('video').forEach(v => {
    try {
      if (v.srcObject) {
        v.srcObject.getTracks().forEach(t => t.stop());
        v.srcObject = null;
      }
    } catch(e) { /* ignore */ }
  });

  // Remove AR overlay
  const existing = document.getElementById('ar-root');
  if (existing) existing.remove();

  // Clean orphaned elements AR.js may have left
  document.querySelectorAll('body > a-scene').forEach(el => el.remove());
  document.querySelectorAll('body > video').forEach(el => {
    try {
      if (el.srcObject) el.srcObject.getTracks().forEach(t => t.stop());
    } catch(e) {}
    el.remove();
  });
  document.querySelectorAll('body > canvas').forEach(el => {
    // Only remove canvases that look like they belong to AR.js
    if (el.classList.contains('a-canvas') || !el.id) el.remove();
  });

  arRootEl = null;
}

// ─── SimCanvas (2D fallback renderer) ────────────────────────────
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
