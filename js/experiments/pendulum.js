/**
 * PintAR Mobile — Pendulum Experiment
 * 2D Canvas simulation (default) + AR mode (lazy-loaded).
 * Physics: θ'' = -(g/L)sin(θ) - damping*θ'
 */

import { sensorManager } from '../modules/sensors.js';
import { SimCanvas, loadAR, canRunAR, startARScene } from '../modules/ar-loader.js';
import { SimpleGraph } from '../modules/graph.js';
import { showTutorial } from '../modules/tutorial.js';
import { initLKS } from '../modules/lks.js';

// ─── State ───
let L = 1.0;       // length (m)
let m = 1.0;       // mass (kg)
let g = 9.81;      // gravity
let theta0 = Math.PI / 6; // initial angle (30°)
let theta = theta0;
let omega = 0;     // angular velocity
let isSwinging = false;
let lastTime = 0;
let zeroCrossings = [];
let lastTheta = theta0;
let mode = 'sim';  // 'sim' or 'ar'

// ─── DOM ───
const canvas = document.getElementById('pendulum-canvas');
const simView = document.getElementById('sim-view');
const arView = document.getElementById('ar-view');
const ctrlLength = document.getElementById('ctrl-length');
const ctrlMass = document.getElementById('ctrl-mass');
const ctrlAngle = document.getElementById('ctrl-angle');
const ctrlGravity = document.getElementById('ctrl-gravity');
const btnStart = document.getElementById('btn-start');
const btnReset = document.getElementById('btn-reset');
const dispLength = document.getElementById('disp-length');
const dispMass = document.getElementById('disp-mass');
const dispAngle = document.getElementById('disp-angle');
const valTheory = document.getElementById('val-t-theory');
const valActual = document.getElementById('val-t-actual');
const valAngleDisp = document.getElementById('val-angle');
const graphCanvas = document.getElementById('graph-canvas');

// ─── Graph ───
let graph = null;
if (graphCanvas) {
  graph = new SimpleGraph(graphCanvas, {
    maxPoints: 80, color: '#0066FF', label: 'Simpangan (°)', minY: -65, maxY: 65
  });
}


// ─── 2D Canvas Renderer ───
const sim = new SimCanvas(canvas);

function drawPendulum(ctx, w, h) {
  const pivotX = w / 2;
  const pivotY = h * 0.15;
  const scale = Math.min(w, h) * 0.25; // visual length scaling
  const visualL = L * scale;
  const bobRadius = 8 + m * 3;

  // Bob position
  const bobX = pivotX + visualL * Math.sin(theta);
  const bobY = pivotY + visualL * Math.cos(theta);

  // Background gradient (subtle)
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() || '#f8fafc';
  ctx.fillRect(0, 0, w, h);

  // Pivot
  ctx.beginPath();
  ctx.arc(pivotX, pivotY, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#64748b';
  ctx.fill();

  // Support bar
  ctx.beginPath();
  ctx.moveTo(pivotX - 40, pivotY);
  ctx.lineTo(pivotX + 40, pivotY);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.stroke();

  // String
  ctx.beginPath();
  ctx.moveTo(pivotX, pivotY);
  ctx.lineTo(bobX, bobY);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Bob
  ctx.beginPath();
  ctx.arc(bobX, bobY, bobRadius, 0, Math.PI * 2);
  const gradient = ctx.createRadialGradient(bobX - 3, bobY - 3, 0, bobX, bobY, bobRadius);
  gradient.addColorStop(0, '#60a5fa');
  gradient.addColorStop(1, '#0066FF');
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.strokeStyle = '#1d4ed8';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Angle arc
  if (Math.abs(theta) > 0.02) {
    const arcR = 40;
    const startA = Math.PI / 2;
    const endA = Math.PI / 2 - theta;
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, arcR, Math.min(startA, endA), Math.max(startA, endA));
    ctx.strokeStyle = 'rgba(0, 102, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Info text
  ctx.font = '12px -apple-system, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'center';
  ctx.fillText(`T = 2π√(L/g) = ${(2 * Math.PI * Math.sqrt(L / g)).toFixed(2)}s`, w / 2, h - 20);
}

sim.setDrawFunction(drawPendulum);
sim.start();


// ─── Physics Loop ───
function physicsStep(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  if (isSwinging && dt > 0 && dt < 0.1) {
    const damping = 0.03;
    const alpha = -(g / L) * Math.sin(theta) - damping * omega;
    omega += alpha * dt;
    theta += omega * dt;

    // Zero crossing detection for period measurement
    if (lastTheta < 0 && theta >= 0) {
      zeroCrossings.push(timestamp);
      if (zeroCrossings.length >= 3) {
        const t1 = zeroCrossings[zeroCrossings.length - 3];
        const t3 = zeroCrossings[zeroCrossings.length - 1];
        valActual.textContent = ((t3 - t1) / 1000).toFixed(2);
      }
    }
    lastTheta = theta;

    // Update displays
    const deg = theta * (180 / Math.PI);
    valAngleDisp.textContent = deg.toFixed(1) + '°';
    if (graph) graph.addPoint(deg);
  }

  requestAnimationFrame(physicsStep);
}

requestAnimationFrame(physicsStep);

// ─── Update calculated values ───
function updateTheory() {
  const T = 2 * Math.PI * Math.sqrt(L / g);
  valTheory.textContent = T.toFixed(2);
}

function resetPendulum() {
  isSwinging = false;
  omega = 0;
  zeroCrossings = [];
  lastTime = 0;
  theta0 = parseFloat(ctrlAngle.value) * (Math.PI / 180);
  theta = theta0;
  lastTheta = theta0;
  valActual.textContent = '0.00';
  valAngleDisp.textContent = (theta0 * 180 / Math.PI).toFixed(1) + '°';
  btnStart.textContent = '▶ Ayunkan';
  if (graph) graph.clear();
}


// ─── Controls ───
ctrlLength.addEventListener('input', (e) => {
  L = parseFloat(e.target.value);
  dispLength.textContent = L.toFixed(1) + ' m';
  updateTheory();
  if (!isSwinging) resetPendulum();
});

ctrlMass.addEventListener('input', (e) => {
  m = parseFloat(e.target.value);
  dispMass.textContent = m.toFixed(1) + ' kg';
});

ctrlAngle.addEventListener('input', (e) => {
  if (!isSwinging) {
    const deg = parseFloat(e.target.value);
    dispAngle.textContent = deg + '°';
    theta0 = deg * (Math.PI / 180);
    theta = theta0;
    valAngleDisp.textContent = deg.toFixed(1) + '°';
  }
});

ctrlGravity.addEventListener('change', (e) => {
  g = parseFloat(e.target.value);
  updateTheory();
  if (!isSwinging) resetPendulum();
});

btnStart.addEventListener('click', () => {
  if (!isSwinging) {
    isSwinging = true;
    lastTime = 0;
    zeroCrossings = [];
    btnStart.textContent = '⏸ Berhenti';
  } else {
    isSwinging = false;
    btnStart.textContent = '▶ Ayunkan';
  }
});

btnReset.addEventListener('click', resetPendulum);

// Sheet is handled globally by app.js initBottomSheet()


// ─── Mode Switcher (Sim / AR) ───
let arInstance = null;
const modeBtns = document.querySelectorAll('#mode-switcher .mode-btn');
modeBtns.forEach((btn) => {
  btn.addEventListener('click', async () => {
    const newMode = btn.dataset.mode;
    if (newMode === mode) return;

    modeBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    mode = newMode;

    if (mode === 'ar') {
      if (!canRunAR()) {
        window.showToast('HP kamu tidak punya kamera. Pakai mode Simulasi.', 'warning');
        modeBtns[0].click();
        return;
      }
      sim.stop();
      simView.classList.add('hidden');
      arView.classList.remove('hidden');
      arView.innerHTML = '<p style="padding:var(--space-6);text-align:center;color:var(--text-secondary)">Memuat AR... Tunggu sebentar.</p>';

      const loaded = await loadAR();
      if (loaded) {
        arInstance = startARScene(arView, createARContent(), {
          onMarkerFound: () => window.showToast('Marker terdeteksi! 🎉', 'success', 2000),
          onMarkerLost: () => {}
        });
      } else {
        window.showToast('Gagal memuat AR. Cek koneksi internet.', 'error');
        modeBtns[0].click();
      }
    } else {
      if (arInstance) { arInstance.destroy(); arInstance = null; }
      arView.classList.add('hidden');
      arView.innerHTML = '';
      simView.classList.remove('hidden');
      sim.start();
    }
  });
});

function createARContent() {
  return `
    <a-entity rotation="-60 0 0" scale="0.5 0.5 0.5">
      <!-- Stand base -->
      <a-cylinder position="0 0 0" radius="0.5" height="0.1" color="#334155" material="metalness:0.7;roughness:0.3"></a-cylinder>
      <!-- Vertical pole -->
      <a-cylinder position="0 1.5 0" radius="0.04" height="3" color="#64748b"></a-cylinder>
      <!-- Horizontal arm -->
      <a-box position="0 3 0.6" width="0.08" height="0.08" depth="1.4" color="#64748b"></a-box>
      <!-- Pendulum -->
      <a-entity id="ar-pendulum" position="0 3 1.1">
        <a-cylinder position="0 -0.75 0" radius="0.01" height="1.5" color="#f0f4ff"></a-cylinder>
        <a-sphere position="0 -1.5 0" radius="0.18" color="#3b82f6"
          material="metalness:0.6;roughness:0.2"
          animation="property:position;to:0.4 -1.4 0;dir:alternate;dur:1500;loop:true;easing:easeInOutSine">
        </a-sphere>
      </a-entity>
      <!-- Label -->
      <a-text value="T = 2pi*sqrt(L/g)" position="0 -0.3 0" align="center" color="#0066FF" width="3" font="monoid"></a-text>
    </a-entity>
  `;
}


// ─── Sensor: use gyroscope to set angle (if available) ───
async function initSensors() {
  const avail = await sensorManager.checkAvailability();
  if (avail.gyroscope) {
    sensorManager.startGyroscope((data) => {
      if (!isSwinging && mode === 'sim') {
        let roll = data.gamma || 0;
        roll = Math.max(-60, Math.min(60, roll));
        theta0 = roll * (Math.PI / 180);
        theta = theta0;
        ctrlAngle.value = Math.abs(roll).toFixed(0);
        dispAngle.textContent = Math.abs(roll).toFixed(0) + '°';
      }
    });
  }
}

// ─── Tutorial ───
showTutorial('pendulum', [
  { icon: '⚖️', title: 'Eksperimen Bandul', description: 'Di sini kamu akan mempelajari gerak harmonik sederhana. Bandul berayun karena gaya gravitasi!' },
  { icon: '📐', title: 'Atur Parameter', description: 'Geser slider untuk mengubah panjang tali dan sudut awal. Lihat bagaimana ini mempengaruhi periode!' },
  { icon: '▶️', title: 'Mulai Ayunkan', description: 'Tekan tombol "Ayunkan" untuk memulai. Perhatikan periode teori vs periode aktual.' },
  { icon: '📋', title: 'Catat Hasil', description: 'Klik tombol 📋 di kanan bawah untuk mengisi Lembar Kerja Siswa dan kirim ke guru.' }
], () => {
  initSensors();
});

// ─── LKS Integration ───
initLKS({
  experimentId: 'pendulum',
  title: 'Bandul (Pendulum)',
  tujuan: 'Membuktikan rumus periode bandul T = 2π√(L/g) dan mengamati pengaruh panjang tali serta gravitasi terhadap periode ayunan.',
  questions: [
    'Apakah massa beban mempengaruhi periode bandul? Jelaskan berdasarkan hasil!',
    'Bagaimana hubungan panjang tali (L) dengan periode (T)?',
    'Bandingkan periode teori dengan periode aktual. Berapa persen selisihnya?'
  ],
  getDataFn: () => ({
    'L (m)': L.toFixed(2),
    'g (m/s²)': g.toFixed(2),
    'm (kg)': m.toFixed(1),
    'θ₀ (°)': (theta0 * 180 / Math.PI).toFixed(1),
    'T teori (s)': (2 * Math.PI * Math.sqrt(L / g)).toFixed(3),
    'T aktual (s)': valActual.textContent
  })
});

// ─── Init ───
updateTheory();
