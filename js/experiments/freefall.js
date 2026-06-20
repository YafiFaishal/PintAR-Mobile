/**
 * PintAR Mobile — Free Fall Experiment
 * Physics: F = mg - Fd, where Fd = 0.5 * rho * v^2 * Cd * A
 */

import { sensorManager } from '../modules/sensors.js';
import { SimCanvas, loadAR, canRunAR, getARSupportInfo, requestCameraPermission, startARScene, destroyARScene } from '../modules/ar-loader.js';
import { SimpleGraph } from '../modules/graph.js';
import { showTutorial } from '../modules/tutorial.js';
import { initLKS } from '../modules/lks.js';
import { showQuiz } from '../modules/quiz.js';

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


// ─── Mode Switcher ───
const modeBtns = document.querySelectorAll('#mode-switcher .mode-btn');

function switchToSim() {
  destroyARScene();
  document.body.classList.remove('ar-active');
  arView.classList.add('hidden');
  arView.innerHTML = '';
  simView.classList.remove('hidden');
  // Delay to let DOM settle before resizing canvas
  setTimeout(() => { sim.start(); }, 100);
  mode = 'sim';
  modeBtns.forEach(b => b.classList.remove('active'));
  modeBtns[0].classList.add('active');
}

modeBtns.forEach((btn) => {
  btn.addEventListener('click', async () => {
    const newMode = btn.dataset.mode;
    if (newMode === mode) return;
    modeBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    mode = newMode;

    if (mode === 'ar') {
      const arInfo = getARSupportInfo();
      if (!arInfo.supported) {
        arView.classList.remove('hidden');
        simView.classList.add('hidden');
        arView.innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:var(--space-6);text-align:center;gap:var(--space-4);">
            <div style="font-size:3rem">${arInfo.isSecure ? '📵' : '🔒'}</div>
            <p style="color:var(--text-secondary);font-size:var(--fs-sm);line-height:1.6">${arInfo.reason}</p>
            ${!arInfo.isSecure ? '<p style="color:var(--text-muted);font-size:var(--fs-xs)">Tip: Deploy ke GitHub Pages atau gunakan localhost untuk HTTPS.</p>' : ''}
            <button class="btn btn-primary btn-sm" onclick="location.reload()">🔄 Muat Ulang</button>
          </div>`;
        return;
      }
      simView.classList.add('hidden');
      arView.classList.remove('hidden');
      document.body.classList.add('ar-active');
      arView.innerHTML = '<p style="padding:var(--space-6);text-align:center;color:var(--text-secondary)">Meminta izin kamera...</p>';

      const camResult = await requestCameraPermission();
      if (!camResult.granted) {
        arView.innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:var(--space-6);text-align:center;gap:var(--space-4);">
            <div style="font-size:3rem">📷</div>
            <p style="color:var(--text-secondary);font-size:var(--fs-sm);line-height:1.6">${camResult.error}</p>
            <button class="btn btn-primary btn-sm" onclick="location.reload()">🔄 Coba Lagi</button>
            <button class="btn btn-secondary btn-sm" id="btn-back-sim">← Kembali ke Simulasi</button>
          </div>`;
        document.getElementById('btn-back-sim')?.addEventListener('click', switchToSim);
        return;
      }

      arView.innerHTML = '<p style="padding:var(--space-6);text-align:center;color:var(--text-secondary)">Memuat AR...</p>';
      const loaded = await loadAR();
      if (loaded) {
        startARScene(arView, `
          <a-entity rotation="-60 0 0" scale="0.4 0.4 0.4">
            <a-plane position="0 0 0" rotation="-90 0 0" width="3" height="3" color="#e2e8f0" material="opacity:0.8"></a-plane>
            <a-cylinder position="-0.6 2 0" radius="0.04" height="4" color="#64748b"></a-cylinder>
            <a-box position="-0.6 4.05 0" width="0.4" height="0.1" depth="0.4" color="#ef4444"></a-box>
            <a-sphere position="0 4 0" radius="0.18" color="${obj.color}" material="metalness:0.7;roughness:0.2"
              animation="property:position;to:0 0.2 0;dur:1500;easing:easeInQuad;loop:true;delay:500">
            </a-sphere>
            <a-text value="h = 1/2 g t^2" position="0 -0.3 0" align="center" color="#D32F2F" width="3" font="monoid"></a-text>
          </a-entity>
        `, {
          onMarkerFound: () => window.showToast('Marker terdeteksi! 🎉', 'success', 2000),
          onMarkerLost: () => {},
          onClose: switchToSim,
          onError: (msg) => { window.showToast('AR Error: ' + msg, 'error', 5000); switchToSim(); }
        });
        window.showToast('AR aktif! Arahkan ke marker Hiro.', 'info');
      } else {
        window.showToast('Gagal memuat AR. Cek koneksi internet.', 'error');
        switchToSim();
      }
    } else {
      switchToSim();
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



// ─── Quiz Button ───
const quizFab = document.createElement('button');
quizFab.className = 'quiz-fab';
quizFab.innerHTML = '📝 Quiz';
quizFab.addEventListener('click', () => {
  showQuiz({
    experimentId: 'freefall',
    title: 'Quiz: Jatuh Bebas',
    questions: [
      {
        question: 'Rumus ketinggian benda jatuh bebas setelah waktu t adalah...',
        options: ['h = gt²', 'h = ½gt²', 'h = 2gt²', 'h = g/t²'],
        correct: 1,
        explanation: 'Rumus jatuh bebas: h = ½gt². Benda jatuh dari ketinggian h₀, posisi setelah t detik: y = h₀ - ½gt².'
      },
      {
        question: 'Di ruang hampa (vakum), benda mana yang jatuh lebih cepat?',
        options: ['Bola besi (berat)', 'Bulu ayam (ringan)', 'Sama cepatnya', 'Tergantung bentuknya'],
        correct: 2,
        explanation: 'Di ruang hampa tidak ada hambatan udara. Semua benda jatuh dengan percepatan sama (g), tidak peduli massanya!'
      },
      {
        question: 'Kecepatan benda jatuh bebas setelah 3 detik di Bumi (g=10 m/s²) adalah...',
        options: ['10 m/s', '20 m/s', '30 m/s', '45 m/s'],
        correct: 2,
        explanation: 'v = g × t = 10 × 3 = 30 m/s. Kecepatan bertambah 10 m/s setiap detiknya.'
      },
      {
        question: 'Apa efek hambatan udara pada benda yang jatuh?',
        options: ['Mempercepat jatuh', 'Membuat jatuh lebih lambat', 'Tidak ada efek', 'Membuat benda terbang'],
        correct: 1,
        explanation: 'Hambatan udara (drag) melawan arah gerak benda, sehingga benda jatuh lebih lambat. Benda ringan/lebar lebih terpengaruh.'
      },
      {
        question: 'Berapa jarak yang ditempuh benda jatuh bebas selama 2 detik? (g=10 m/s²)',
        options: ['10 m', '20 m', '30 m', '40 m'],
        correct: 1,
        explanation: 'h = ½gt² = ½ × 10 × 2² = ½ × 10 × 4 = 20 meter.'
      }
    ]
  });
});
document.body.appendChild(quizFab);
