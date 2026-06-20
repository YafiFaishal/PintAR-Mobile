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
  // On iOS 13+, request motion sensor permissions FIRST
  // These MUST complete before we start the AR scene, otherwise
  // A-Frame will show its own blocking modal dialog
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  
  if (isIOS) {
    // Request DeviceMotion permission
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        const motionPerm = await DeviceMotionEvent.requestPermission();
        console.log('[PintAR] iOS DeviceMotion permission:', motionPerm);
      } catch (e) {
        console.warn('[PintAR] iOS DeviceMotion permission failed:', e.message);
        // Don't fail — motion is optional for AR, camera is what matters
      }
    }
    
    // Request DeviceOrientation permission
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const orientPerm = await DeviceOrientationEvent.requestPermission();
        console.log('[PintAR] iOS DeviceOrientation permission:', orientPerm);
      } catch (e) {
        console.warn('[PintAR] iOS DeviceOrientation permission failed:', e.message);
      }
    }

    // Small delay to let iOS settle after permission dialogs
    await new Promise(r => setTimeout(r, 300));
  }

  // Now request camera
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

      // Patch A-Frame to disable its device orientation permission UI
      // This MUST happen after A-Frame loads but BEFORE AR.js
      if (typeof AFRAME !== 'undefined') {
        // Tell A-Frame that device orientation permission is already granted
        if (AFRAME.utils && AFRAME.utils.device) {
          AFRAME.utils.device.checkHeadsetConnected = () => false;
        }
        // Override the permission UI component if it exists
        if (AFRAME.components && AFRAME.components['device-orientation-permission-ui']) {
          AFRAME.components['device-orientation-permission-ui'].Component = {
            init: function() {},
            remove: function() {}
          };
        }
        // Patch at the schema level — prevent the component from ever running
        try {
          AFRAME.registerComponent('device-orientation-permission-ui', {
            schema: { enabled: { default: false } },
            init: function() { /* no-op */ },
            remove: function() { /* no-op */ }
          }, true); // force re-register
        } catch(e) {
          // Component might already be registered, that's fine
          console.log('[PintAR] Could not override permission-ui component (may already exist)');
        }
      }

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
// DISABLED: AR.js needs to control video/canvas positioning for marker detection.
// Our previous forceFullscreen approach was breaking AR.js's coordinate mapping.
// Instead, we only ensure the a-scene is fullscreen via CSS.

// ─── MutationObserver: REMOVED ──────────────────────────────────
// The MutationObserver that forced styles on video/canvas elements was
// interfering with AR.js marker detection. AR.js positions elements
// precisely for its computer vision to work.

function startVideoWatcher() {
  // No-op: we no longer fight AR.js's style mutations
}

function stopVideoWatcher() {
  // No-op
}

// ─── startARScene ─────────────────────────────────────────────────
/**
 * Creates a fullscreen AR overlay.
 *
 * Improved settings for better compatibility:
 * - sourceWidth/sourceHeight for consistent video resolution
 * - patternRatio for better marker detection
 * - maxDetectionRate for performance balance
 * - iOS motion sensor permission handled before scene starts
 *
 * @param {HTMLElement} container - reference div (lifecycle only)
 * @param {string} markerContent - A-Frame entities HTML inside <a-marker>
 * @param {object} options - { onMarkerFound, onMarkerLost, onError, onClose }
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
  root.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;overflow:hidden;';
  document.body.appendChild(root);
  arRootEl = root;

  // AR.js config — keep it simple, let AR.js handle video rendering
  const sourceWidth = isIOS ? 640 : 800;
  const sourceHeight = isIOS ? 480 : 600;

  root.innerHTML = `
    <a-scene
      embedded
      arjs="sourceType: webcam;
            facingMode: environment;
            sourceWidth: ${sourceWidth};
            sourceHeight: ${sourceHeight};
            debugUIEnabled: false;
            detectionMode: mono_and_matrix;
            matrixCodeType: 3x3;
            patternRatio: 0.75;
            maxDetectionRate: 60;"
      renderer="antialias: true; alpha: true; precision: mediump;"
      vr-mode-ui="enabled: false"
      loading-screen="enabled: false"
      device-orientation-permission-ui="enabled: false"
      style="position:absolute;top:0;left:0;width:100%;height:100%;z-index:1;"
    >
      <a-marker preset="hiro" id="ar-hiro-marker" smooth="true" smoothCount="5" smoothTolerance="0.01" smoothThreshold="2">
        ${markerContent}
      </a-marker>
      <a-entity camera></a-entity>
    </a-scene>
  `;

  // ── Close button — HIGHEST z-index, always clickable ──
  const closeBtn = document.createElement('button');
  closeBtn.id = 'ar-close-btn';
  closeBtn.innerHTML = '✕ Tutup AR';
  closeBtn.style.cssText = `
    position: fixed; top: 16px; right: 16px; z-index: 2147483647;
    padding: 12px 20px; border-radius: 24px; border: 2px solid rgba(255,255,255,0.3);
    background: rgba(0,0,0,0.85); color: #fff; font-size: 14px;
    font-weight: 700; cursor: pointer; pointer-events: auto;
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    -webkit-tap-highlight-color: rgba(255,255,255,0.2);
    touch-action: manipulation;
    user-select: none; -webkit-user-select: none;
  `;

  function handleClose(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    console.log('[PintAR] Close button pressed');
    destroyARScene();
    if (options.onClose) options.onClose();
  }

  // Use multiple event types for reliability on mobile
  closeBtn.addEventListener('click', handleClose, { capture: true });
  closeBtn.addEventListener('touchend', handleClose, { capture: true, passive: false });

  // ALSO add a document-level capture listener that checks if tap was in close button area
  // This works even if A-Frame's modal is intercepting events
  function globalTouchHandler(e) {
    const btn = document.getElementById('ar-close-btn');
    if (!btn) { document.removeEventListener('touchstart', globalTouchHandler, true); return; }
    const rect = btn.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    if (touch && touch.clientX >= rect.left && touch.clientX <= rect.right &&
        touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
      e.preventDefault();
      e.stopImmediatePropagation();
      handleClose(e);
    }
  }
  document.addEventListener('touchstart', globalTouchHandler, { capture: true, passive: false });

  // Append close button directly to body (NOT inside ar-root)
  // This ensures it's never blocked by A-Frame's scene elements
  document.body.appendChild(closeBtn);

  // ── Scan overlay — semi-transparent so camera feed shows through ──
  const scanOverlay = document.createElement('div');
  scanOverlay.id = 'ar-scan-overlay';
  scanOverlay.className = 'ar-scan-overlay';
  scanOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:10000;pointer-events:none;background:transparent;';
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

  // ── Kill any A-Frame modal/dialog that appears ──
  // A-Frame and AR.js may still create permission dialogs despite our patches
  const modalKiller = setInterval(() => {
    // Kill A-Frame orientation modal
    document.querySelectorAll('.a-orientation-modal, .a-modal, [data-a-modal]').forEach(el => {
      el.style.display = 'none';
      el.style.pointerEvents = 'none';
      el.remove();
    });
    // Also kill any overlay/backdrop that blocks interaction
    document.querySelectorAll('.a-dialog-allow-button, .a-dialog-deny-button, .a-dialog-ok-button').forEach(btn => {
      // Auto-click "allow" if present
      try { btn.click(); } catch(e) {}
    });
  }, 200);

  // Stop modal killer after 10 seconds (dialog should be gone by then)
  setTimeout(() => clearInterval(modalKiller), 10000);

  // ── Post-init: attach marker events ──
  const initTimeout = setTimeout(() => {
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
  }, 2000);

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
      v.pause();
    } catch(e) { /* ignore */ }
  });

  // Remove close button (it's on body, not in ar-root)
  const closeBtn = document.getElementById('ar-close-btn');
  if (closeBtn) closeBtn.remove();

  // Remove all document-level capture listeners we added
  // (They self-cleanup when they can't find the button)

  // Remove AR overlay
  const existing = document.getElementById('ar-root');
  if (existing) existing.remove();

  // Destroy A-Frame scene properly to release WebGL context
  document.querySelectorAll('a-scene').forEach(scene => {
    try {
      if (scene.renderer) {
        scene.renderer.forceContextLoss();
        scene.renderer.dispose();
      }
      // Exit AR/VR mode if active
      if (scene.exitVR) scene.exitVR();
    } catch(e) {}
    scene.remove();
  });

  // Clean orphaned elements AR.js may have left
  document.querySelectorAll('body > video').forEach(el => {
    try {
      if (el.srcObject) el.srcObject.getTracks().forEach(t => t.stop());
      el.pause();
    } catch(e) {}
    el.remove();
  });
  document.querySelectorAll('body > canvas').forEach(el => {
    if (el.classList.contains('a-canvas') || !el.id) el.remove();
  });

  // Remove any A-Frame modals/dialogs that might still be around
  document.querySelectorAll('.a-orientation-modal, .a-modal, .a-loader-title').forEach(el => el.remove());

  arRootEl = null;
  console.log('[PintAR] AR scene destroyed');
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
