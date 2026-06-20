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
  
  // Determine initial theme
  let currentTheme;
  if (saved) {
    currentTheme = saved;
  } else {
    // Auto-detect system preference
    currentTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  
  // Apply theme
  if (currentTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }

  const btn = document.getElementById('btn-theme');
  if (btn) {
    btn.addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const next = isDark ? 'light' : 'dark';
      
      if (next === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
      
      localStorage.setItem('pintar_theme', next);
      btn.textContent = next === 'dark' ? '☀️' : '🌙';
      
      // Update meta theme-color
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.content = next === 'dark' ? '#1e293b' : '#0066FF';
    });

    // Set initial icon
    btn.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
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

// ─── Bottom Sheet Swipe/Tap Handler (Global) ───
function initBottomSheet() {
  const sheet = document.getElementById('controls-sheet');
  if (!sheet) return;

  const handle = sheet.querySelector('.bottom-sheet-handle');
  const header = sheet.querySelector('.bottom-sheet-header');
  const btnToggle = sheet.querySelector('#btn-toggle-sheet');

  let startY = 0;
  let currentY = 0;
  let isDragging = false;

  function toggleSheet() {
    sheet.classList.toggle('open');
    if (btnToggle) {
      btnToggle.textContent = sheet.classList.contains('open') ? '▼' : '▲';
    }
  }

  function closeSheet() {
    sheet.classList.remove('open');
    if (btnToggle) btnToggle.textContent = '▲';
  }

  function openSheet() {
    sheet.classList.add('open');
    if (btnToggle) btnToggle.textContent = '▼';
  }

  // Tap handle or header to toggle
  if (handle) {
    handle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSheet();
    });
  }

  if (header) {
    header.addEventListener('click', (e) => {
      if (e.target === btnToggle || e.target.closest('#btn-toggle-sheet')) return;
      toggleSheet();
    });
  }

  if (btnToggle) {
    btnToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSheet();
    });
  }

  // Swipe down on handle/header to close
  const dragArea = handle || header;
  if (dragArea) {
    dragArea.addEventListener('touchstart', (e) => {
      if (!sheet.classList.contains('open')) return;
      startY = e.touches[0].clientY;
      isDragging = true;
      sheet.style.transition = 'none';
    }, { passive: true });

    dragArea.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      currentY = e.touches[0].clientY;
      const diff = currentY - startY;
      if (diff > 0) {
        // Only allow dragging down
        sheet.style.transform = `translateY(${diff}px)`;
      }
    }, { passive: true });

    dragArea.addEventListener('touchend', () => {
      if (!isDragging) return;
      isDragging = false;
      sheet.style.transition = '';
      const diff = currentY - startY;

      if (diff > 80) {
        // Swiped down enough → close
        closeSheet();
      } else {
        // Snap back open
        sheet.style.transform = '';
        openSheet();
      }
      sheet.style.transform = '';
      startY = 0;
      currentY = 0;
    });
  }

  // Start open by default
  openSheet();
}

// ─── Init ───
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initPWA();
  checkSensors();
  initBottomSheet();
});
