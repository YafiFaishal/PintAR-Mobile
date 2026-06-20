/**
 * PintAR Mobile — Main Application
 * Handles PWA install, theme toggle, sensor status, navigation, toast system.
 */

// ─── Toast System ───
window.showToast = function (message, type = 'info', duration = 3000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: '✓', warning: '⚠', error: '✕', info: 'ℹ' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || icons.info}</span> <span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    toast.style.transition = 'all 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, duration);
};

// ─── Theme Toggle ───
function initTheme() {
  const saved = localStorage.getItem('pintar_theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);

  const btn = document.getElementById('btn-theme');
  if (btn) {
    btn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      if (next === 'light') {
        document.documentElement.removeAttribute('data-theme');
      } else {
        document.documentElement.setAttribute('data-theme', next);
      }
      localStorage.setItem('pintar_theme', next);
      btn.textContent = next === 'dark' ? '☀️' : '🌙';
      // Update meta theme-color
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.content = next === 'dark' ? '#1e293b' : '#0066FF';
    });

    // Set initial icon
    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  }
}


// ─── PWA Install ───
let deferredPrompt = null;

function initPWA() {
  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  // Listen for install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallBanner();
  });
}

function showInstallBanner() {
  if (document.querySelector('.install-banner')) return;
  const banner = document.createElement('div');
  banner.className = 'install-banner';
  banner.innerHTML = `
    <p>📲 Pasang PintAR di HP untuk akses cepat & offline!</p>
    <button class="btn btn-sm btn-primary" id="btn-install">Pasang</button>
    <button class="dismiss" id="btn-dismiss-install">Nanti</button>
  `;
  document.body.appendChild(banner);

  document.getElementById('btn-install').addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        window.showToast('PintAR berhasil dipasang!', 'success');
      }
      deferredPrompt = null;
    }
    banner.remove();
  });

  document.getElementById('btn-dismiss-install').addEventListener('click', () => {
    banner.remove();
  });
}

// ─── Sensor Status Check ───
async function checkSensors() {
  const items = {
    accelerometer: document.getElementById('sensor-accel'),
    gyroscope: document.getElementById('sensor-gyro'),
    camera: document.getElementById('sensor-camera')
  };

  const avail = {
    accelerometer: typeof DeviceMotionEvent !== 'undefined',
    gyroscope: typeof DeviceOrientationEvent !== 'undefined',
    camera: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
  };

  Object.keys(items).forEach((key) => {
    const el = items[key];
    if (!el) return;
    const dot = el.querySelector('.status-dot');
    const text = el.querySelector('.status-text');
    if (dot && text) {
      if (avail[key]) {
        dot.className = 'status-dot available';
        text.textContent = 'Tersedia';
        text.style.color = 'var(--brand-secondary)';
      } else {
        dot.className = 'status-dot unavailable';
        text.textContent = 'Tidak tersedia';
        text.style.color = 'var(--brand-danger)';
      }
    }
  });
}


// ─── Navigation ───
window.goTo = function (path) {
  window.location.href = path;
};

// ─── Init ───
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initPWA();
  checkSensors();
});
