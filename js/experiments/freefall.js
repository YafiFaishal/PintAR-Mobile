/**
 * PintAR Mobile — Free Fall Experiment
 * Physics: F = mg - Fd, where Fd = 0.5 * rho * v^2 * Cd * A
 */

import { sensorManager } from '../modules/sensors.js';
import { SimCanvas, loadAR, canRunAR } from '../modules/ar-loader.js';
import { SimpleGraph } from '../modules/graph.js';
import { showTutorial } from '../modules/tutorial.js';
import { initLKS } from '../modules/lks.js';

// ─── State ───
let h0 = 10;
let currentY = h0;
let velocity = 0;
let timeElapsed = 0;
let g = 9.81;
let isFalling = false;
let lastTime = 0;
let useAir = false;
let mode = 'sim';

const objects = {
  iron: { mass: 10, drag: 0.47, area: 0.03, color: '#64748b', radius: 12 },
  wood: { mass: 1, drag: 0.47, area: 0.03, color: '#FF9100', radius: 12 },
  feather: { mass: 0.01, drag: 1.05, area: 0.05, color: '#a78bfa', radius: 8 }
};
let obj = objects.iron;
const airDensity = 1.225;

// ─── DOM ───
const canvas = document.getElementById('freefall-canvas');
const simView = document.getElementById('sim-view');
const arView = document.getElementById('ar-view');
const ctrlHeight = document.getElementById('ctrl-height');
const ctrlObject = document.getElementById('ctrl-object');
const ctrlEnv = document.getElementById('ctrl-env');
const ctrlGravity = document.getElementById('ctrl-gravity');
const btnDrop = document.getElementById('btn-drop');
const btnReset = document.getElementById('btn-reset');
const dispHeight = document.getElementById('disp-height');
const valTime = document.getElementById('val-time');
const valVelocity = document.getElementById('val-velocity');
const valPosition = document.getElementById('val-position');
const graphCanvas = document.getElementById('graph-canvas');

let graph = new SimpleGraph(graphCanvas, {
  maxPoints: 80, color: '#D32F2F', label: 'Posisi (m)', minY: 0, maxY: 12
});


// ─── 2D Canvas Renderer ───
const sim = new SimCanvas(canvas);

function drawFreefall(ctx, w, h) {
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() || '#f8fafc';
  ctx.fillRect(0, 0, w, h);

  const groundY = h - 30;
  const topY = 50;
  const scaleY = (groundY - topY) / h0;

  // Ground
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(0, groundY, w, h - groundY);
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(w, groundY);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Height markers
  ctx.font = '10px -apple-system, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'right';
  for (let i = 0; i <= h0; i += Math.ceil(h0 / 5)) {
    const y = groundY - i * scaleY;
    ctx.fillText(i + 'm', w / 2 - 30, y + 3);
    ctx.beginPath();
    ctx.moveTo(w / 2 - 25, y);
    ctx.lineTo(w / 2 - 20, y);
    ctx.strokeStyle = '#cbd5e0';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Tower
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(w / 2 - 22, topY, 4, groundY - topY);

  // Platform
  ctx.fillStyle = '#64748b';
  ctx.fillRect(w / 2 - 30, topY - 5, 40, 8);

  // Falling object
  const objY = groundY - currentY * scaleY;
  ctx.beginPath();
  ctx.arc(w / 2, objY, obj.radius, 0, Math.PI * 2);
  ctx.fillStyle = obj.color;
  ctx.fill();
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Impact flash
  if (currentY <= 0 && !isFalling) {
    ctx.beginPath();
    ctx.arc(w / 2, groundY, 20, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,102,255,0.2)';
    ctx.fill();
  }

  // Formula
  ctx.font = '11px -apple-system, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'center';
  ctx.fillText('h = ½gt²   v = gt', w / 2, h - 8);
}

sim.setDrawFunction(drawFreefall);
sim.start();


// ─── Physics Loop ───
function physicsStep(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  if (isFalling && dt > 0 && dt < 0.1) {
    let Fg = obj.mass * g;
    let Fd = 0;
    if (useAir) {
      Fd = 0.5 * airDensity * velocity * velocity * obj.drag * obj.area;
    }
    const accel = (Fg - Fd) / obj.mass;
    velocity += accel * dt;
    currentY -= velocity * dt;
    timeElapsed += dt;

    if (currentY <= 0) {
      currentY = 0;
      isFalling = false;
      if (navigator.vibrate) navigator.vibrate(30);
      btnDrop.textContent = '🍎 Jatuhkan';
      btnDrop.disabled = false;
    }

    valTime.textContent = timeElapsed.toFixed(2);
    valVelocity.textContent = velocity.toFixed(1);
    valPosition.textContent = currentY.toFixed(1);
    if (graph) graph.addPoint(currentY);
  }

  requestAnimationFrame(physicsStep);
}
requestAnimationFrame(physicsStep);

function resetExperiment() {
  isFalling = false;
  velocity = 0;
  timeElapsed = 0;
  currentY = h0;
  lastTime = 0;
  valTime.textContent = '0.00';
  valVelocity.textContent = '0.0';
  valPosition.textContent = h0.toFixed(1);
  btnDrop.textContent = '🍎 Jatuhkan';
  btnDrop.disabled = false;
  if (graph) { graph.maxY = h0 + 2; graph.clear(); graph.addPoint(h0); }
}

function triggerDrop() {
  if (!isFalling && currentY > 0) {
    isFalling = true;
    lastTime = 0;
    btnDrop.textContent = 'Jatuh...';
    btnDrop.disabled = true;
  }
}


// ─── Controls ───
ctrlHeight.addEventListener('input', (e) => {
  h0 = parseFloat(e.target.value);
  dispHeight.textContent = h0.toFixed(0) + ' m';
  if (!isFalling) resetExperiment();
});

ctrlObject.addEventListener('change', (e) => {
  obj = objects[e.target.value];
  if (!isFalling) resetExperiment();
});

ctrlEnv.addEventListener('change', (e) => {
  useAir = e.target.value === 'air';
  if (!isFalling) resetExperiment();
});

ctrlGravity.addEventListener('change', (e) => {
  g = parseFloat(e.target.value);
  if (!isFalling) resetExperiment();
});

btnDrop.addEventListener('click', triggerDrop);
btnReset.addEventListener('click', resetExperiment);

// Bottom sheet
const sheet = document.getElementById('controls-sheet');
const btnToggle = document.getElementById('btn-toggle-sheet');
btnToggle.addEventListener('click', () => {
  sheet.classList.toggle('open');
  btnToggle.textContent = sheet.classList.contains('open') ? '▼' : '▲';
});

// ─── Mode Switcher ───
const modeBtns = document.querySelectorAll('#mode-switcher .mode-btn');
modeBtns.forEach((btn) => {
  btn.addEventListener('click', async () => {
    const newMode = btn.dataset.mode;
    if (newMode === mode) return;
    modeBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    mode = newMode;

    if (mode === 'ar') {
      if (!canRunAR()) { window.showToast('Kamera tidak tersedia.', 'warning'); modeBtns[0].click(); return; }
      simView.classList.add('hidden');
      arView.classList.remove('hidden');
      arView.innerHTML = '<p style="padding:var(--space-6);text-align:center;color:var(--text-secondary)">Memuat AR...</p>';
      const loaded = await loadAR();
      if (loaded) {
        arView.innerHTML = `<a-scene embedded arjs="sourceType:webcam;debugUIEnabled:false;" vr-mode-ui="enabled:false" style="position:absolute;top:0;left:0;width:100%;height:100%;overflow:hidden;"><a-marker preset="hiro"><a-entity rotation="-60 0 0" scale="0.3 0.3 0.3"><a-plane position="0 0 0" rotation="-90 0 0" width="3" height="3" color="#e2e8f0"></a-plane><a-cylinder position="-0.8 2 0" radius="0.04" height="4" color="#94a3b8"></a-cylinder><a-sphere id="ar-ball" position="0 4 0" radius="0.15" color="${obj.color}"></a-sphere></a-entity></a-marker><a-entity camera></a-entity></a-scene>`;
        window.showToast('AR aktif! Arahkan ke marker Hiro.', 'info');
      } else { window.showToast('Gagal memuat AR.', 'error'); modeBtns[0].click(); }
    } else {
      arView.classList.add('hidden'); arView.innerHTML = '';
      simView.classList.remove('hidden'); sim.start();
    }
  });
});


// ─── Sensor: shake to drop ───
async function initSensors() {
  const avail = await sensorManager.checkAvailability();
  if (avail.accelerometer) {
    sensorManager.detectShake(15, () => {
      if (!isFalling) triggerDrop();
    });
  }
}

// ─── Tutorial ───
showTutorial('freefall', [
  { icon: '🍎', title: 'Gerak Jatuh Bebas', description: 'Pelajari bagaimana benda jatuh karena gravitasi. Bandingkan jatuh di ruang hampa vs udara!' },
  { icon: '⚙️', title: 'Atur Parameter', description: 'Ubah ketinggian, jenis benda, dan gravitasi. Di ruang hampa, semua benda jatuh bersamaan!' },
  { icon: '📱', title: 'Goyangkan HP', description: 'Kamu bisa goyangkan HP untuk menjatuhkan benda, atau tekan tombol "Jatuhkan".' },
  { icon: '📋', title: 'Catat & Kirim', description: 'Isi LKS Digital (📋) untuk mencatat hasil dan kirim ke guru via WhatsApp!' }
], initSensors);

// ─── LKS ───
initLKS({
  experimentId: 'freefall',
  title: 'Gerak Jatuh Bebas',
  tujuan: 'Memahami hukum gerak jatuh bebas (h = ½gt²) dan membandingkan jatuh bebas dengan dan tanpa hambatan udara.',
  questions: [
    'Apakah massa benda mempengaruhi waktu jatuh di ruang hampa? Mengapa?',
    'Apa perbedaan antara jatuh di ruang hampa dan di udara? Benda mana yang paling terpengaruh?',
    'Hitung kecepatan akhir teoritis (v = gt) dan bandingkan dengan hasil simulasi.'
  ],
  getDataFn: () => ({
    'h (m)': h0.toFixed(1),
    'Objek': ctrlObject.options[ctrlObject.selectedIndex].text,
    'g (m/s²)': g.toFixed(2),
    'Lingkungan': useAir ? 'Udara' : 'Hampa',
    't (s)': valTime.textContent,
    'v akhir (m/s)': valVelocity.textContent
  })
});

// Init
resetExperiment();
