/**
 * PintAR Mobile — Pembiasan Cahaya (Light Refraction)
 * 
 * Physics (Snell's Law):
 *   n₁ × sin(θ₁) = n₂ × sin(θ₂)
 *   θ₂ = arcsin((n₁/n₂) × sin(θ₁))
 * 
 * Total Internal Reflection:
 *   Occurs when n₁ > n₂ and θ₁ > θ_critical
 *   θ_critical = arcsin(n₂/n₁)
 * 
 * Refraction Rules:
 *   - Light bends TOWARD normal when entering denser medium (n₂ > n₁)
 *   - Light bends AWAY from normal when entering less dense medium (n₂ < n₁)
 */

import { sensorManager } from '../modules/sensors.js';
import { SimCanvas, loadAR, canRunAR, getARSupportInfo, requestCameraPermission, startARScene, destroyARScene } from '../modules/ar-loader.js';
import { showTutorial } from '../modules/tutorial.js';
import { initLKS } from '../modules/lks.js';

// ─── State ───
let theta1 = 30; // degrees
let n1 = 1.00;   // refractive index medium 1
let n2 = 1.33;   // refractive index medium 2
let theta2 = 0;  // calculated
let isTotalReflection = false;
let mode = 'sim';

// ─── DOM ───
const canvas = document.getElementById('refraction-canvas');
const simView = document.getElementById('sim-view');
const arView = document.getElementById('ar-view');
const ctrlTheta1 = document.getElementById('ctrl-theta1');
const ctrlMedium1 = document.getElementById('ctrl-medium1');
const ctrlMedium2 = document.getElementById('ctrl-medium2');
const dispTheta1 = document.getElementById('disp-theta1');
const valTheta1 = document.getElementById('val-theta1');
const valTheta2 = document.getElementById('val-theta2');
const valN1 = document.getElementById('val-n1');
const valN2 = document.getElementById('val-n2');
const valStatus = document.getElementById('val-status');
const dispFormula = document.getElementById('disp-formula');
const dispCritical = document.getElementById('disp-critical');

// ─── Physics Calculation ───
function calculate() {
  const theta1Rad = theta1 * (Math.PI / 180);
  const sinTheta2 = (n1 / n2) * Math.sin(theta1Rad);

  // Check for Total Internal Reflection
  if (sinTheta2 > 1) {
    isTotalReflection = true;
    theta2 = 90; // doesn't actually refract
    valStatus.textContent = 'Refleksi Total!';
    valStatus.style.color = 'var(--brand-danger)';
  } else {
    isTotalReflection = false;
    theta2 = Math.asin(sinTheta2) * (180 / Math.PI);
    valStatus.textContent = 'Dibiaskan';
    valStatus.style.color = 'var(--brand-secondary)';
  }

  // Update displays
  valTheta1.textContent = theta1.toFixed(1) + '°';
  valTheta2.textContent = isTotalReflection ? '—' : theta2.toFixed(1) + '°';
  valN1.textContent = n1.toFixed(2);
  valN2.textContent = n2.toFixed(2);

  // Formula display
  dispFormula.textContent = `${n1.toFixed(2)} × sin(${theta1}°) = ${n2.toFixed(2)} × sin(${isTotalReflection ? '—' : theta2.toFixed(1) + '°'})`;

  // Critical angle (only if n1 > n2)
  if (n1 > n2) {
    const criticalAngle = Math.asin(n2 / n1) * (180 / Math.PI);
    dispCritical.textContent = `Sudut kritis: ${criticalAngle.toFixed(1)}° (n₁ > n₂)`;
  } else {
    dispCritical.textContent = 'Sudut kritis: — (n₁ ≤ n₂, tidak ada refleksi total)';
  }
}

// ─── 2D Canvas Renderer ───
const sim = new SimCanvas(canvas);

function drawRefraction(ctx, w, h) {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() || '#f8fafc';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const midY = h / 2;
  const midX = w / 2;

  // Medium 1 (top) — lighter
  ctx.fillStyle = 'rgba(135, 206, 250, 0.15)';
  ctx.fillRect(0, 0, w, midY);

  // Medium 2 (bottom) — denser = more opaque
  const opacity = Math.min(0.4, (n2 - 1) * 0.3);
  ctx.fillStyle = `rgba(0, 100, 200, ${opacity})`;
  ctx.fillRect(0, midY, w, h - midY);

  // Interface line (boundary)
  ctx.beginPath();
  ctx.moveTo(0, midY);
  ctx.lineTo(w, midY);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Normal (dashed vertical line)
  ctx.beginPath();
  ctx.setLineDash([6, 4]);
  ctx.moveTo(midX, midY - 120);
  ctx.lineTo(midX, midY + 120);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.setLineDash([]);

  // Label normal
  ctx.font = '10px -apple-system, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'center';
  ctx.fillText('Normal', midX + 30, midY - 110);

  // Incident ray (from top-left to center)
  const rayLen = 120;
  const theta1Rad = theta1 * (Math.PI / 180);
  const incX = midX - rayLen * Math.sin(theta1Rad);
  const incY = midY - rayLen * Math.cos(theta1Rad);

  ctx.beginPath();
  ctx.moveTo(incX, incY);
  ctx.lineTo(midX, midY);
  ctx.strokeStyle = '#FFD600';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Arrow on incident ray
  drawArrow(ctx, incX, incY, midX, midY, '#FFD600');

  // Refracted ray OR total internal reflection
  if (isTotalReflection) {
    // Reflected ray (same angle, opposite side)
    const refX = midX + rayLen * Math.sin(theta1Rad);
    const refY = midY - rayLen * Math.cos(theta1Rad);
    ctx.beginPath();
    ctx.moveTo(midX, midY);
    ctx.lineTo(refX, refY);
    ctx.strokeStyle = '#FF006E';
    ctx.lineWidth = 3;
    ctx.stroke();
    drawArrow(ctx, midX, midY, refX, refY, '#FF006E');

    // Label
    ctx.font = '12px -apple-system, sans-serif';
    ctx.fillStyle = '#FF006E';
    ctx.textAlign = 'center';
    ctx.fillText('REFLEKSI TOTAL', midX, midY + 30);
  } else {
    // Refracted ray
    const theta2Rad = theta2 * (Math.PI / 180);
    const refX = midX + rayLen * Math.sin(theta2Rad);
    const refY = midY + rayLen * Math.cos(theta2Rad);

    ctx.beginPath();
    ctx.moveTo(midX, midY);
    ctx.lineTo(refX, refY);
    ctx.strokeStyle = '#FF6D00';
    ctx.lineWidth = 3;
    ctx.stroke();
    drawArrow(ctx, midX, midY, refX, refY, '#FF6D00');

    // Partial reflection (faint)
    const partRefX = midX + rayLen * 0.4 * Math.sin(theta1Rad);
    const partRefY = midY - rayLen * 0.4 * Math.cos(theta1Rad);
    ctx.beginPath();
    ctx.moveTo(midX, midY);
    ctx.lineTo(partRefX, partRefY);
    ctx.strokeStyle = 'rgba(255, 214, 0, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Angle arcs
  // θ₁ arc
  ctx.beginPath();
  ctx.arc(midX, midY, 30, -Math.PI / 2, -Math.PI / 2 + theta1Rad, false);
  ctx.strokeStyle = '#FFD600';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#FFD600';
  ctx.font = '11px -apple-system, sans-serif';
  ctx.fillText(`θ₁=${theta1}°`, midX - 50, midY - 20);

  // θ₂ arc (if not total reflection)
  if (!isTotalReflection) {
    const theta2Rad = theta2 * (Math.PI / 180);
    ctx.beginPath();
    ctx.arc(midX, midY, 30, Math.PI / 2 - theta2Rad, Math.PI / 2, false);
    ctx.strokeStyle = '#FF6D00';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#FF6D00';
    ctx.fillText(`θ₂=${theta2.toFixed(1)}°`, midX + 15, midY + 35);
  }

  // Medium labels
  ctx.font = '11px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#4a5568';
  ctx.fillText(`Medium 1: n₁ = ${n1.toFixed(2)}`, 10, 20);
  ctx.fillText(`Medium 2: n₂ = ${n2.toFixed(2)}`, 10, midY + 20);

  // Snell's Law formula at bottom
  ctx.font = '11px -apple-system, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'center';
  ctx.fillText('Hukum Snell: n₁ sin(θ₁) = n₂ sin(θ₂)', midX, h - 10);
}

function drawArrow(ctx, fromX, fromY, toX, toY, color) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / len;
  const uy = dy / len;
  const arrowSize = 8;
  const tipX = fromX + dx * 0.6;
  const tipY = fromY + dy * 0.6;

  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX - arrowSize * ux + arrowSize * 0.4 * uy, tipY - arrowSize * uy - arrowSize * 0.4 * ux);
  ctx.lineTo(tipX - arrowSize * ux - arrowSize * 0.4 * uy, tipY - arrowSize * uy + arrowSize * 0.4 * ux);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

sim.setDrawFunction(drawRefraction);
sim.start();

// ─── Controls ───
ctrlTheta1.addEventListener('input', (e) => {
  theta1 = parseFloat(e.target.value);
  dispTheta1.textContent = theta1 + '°';
  calculate();
});

ctrlMedium1.addEventListener('change', (e) => {
  n1 = parseFloat(e.target.value);
  calculate();
});

ctrlMedium2.addEventListener('change', (e) => {
  n2 = parseFloat(e.target.value);
  calculate();
});


// Mode switcher
const modeBtns = document.querySelectorAll('#mode-switcher .mode-btn');

function switchToSim() {
  destroyARScene();
  document.body.classList.remove('ar-active');
  arView.classList.add('hidden');
  arView.innerHTML = '';
  simView.classList.remove('hidden');
  sim.start();
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
          <a-entity rotation="-90 0 0" scale="0.5 0.5 0.5">
            <!-- Medium 1 (atas - udara) -->
            <a-plane width="3" height="1.5" position="0 0.75 0" color="#87CEEB" material="transparent:true;opacity:0.2;side:double"></a-plane>
            <a-text value="n1=${n1.toFixed(2)}" position="-1.2 1.2 0.1" color="#fff" width="3"></a-text>
            <!-- Medium 2 (bawah - air/kaca) -->
            <a-plane width="3" height="1.5" position="0 -0.75 0" color="#004080" material="transparent:true;opacity:0.35;side:double"></a-plane>
            <a-text value="n2=${n2.toFixed(2)}" position="-1.2 -0.5 0.1" color="#fff" width="3"></a-text>
            <!-- Garis batas -->
            <a-box width="3" height="0.02" depth="0.02" position="0 0 0" color="#fff"></a-box>
            <!-- Sinar datang (kuning) -->
            <a-cylinder position="-0.4 0.6 0" rotation="0 0 ${30}" radius="0.02" height="1.2" color="#FFD600" material="emissive:#FFD600;emissiveIntensity:0.5"></a-cylinder>
            <!-- Sinar bias (orange) -->
            <a-cylinder position="0.3 -0.5 0" rotation="0 0 ${-22}" radius="0.02" height="1" color="#FF6D00" material="emissive:#FF6D00;emissiveIntensity:0.5"></a-cylinder>
            <!-- Normal (putih dash) -->
            <a-cylinder position="0 0 0" radius="0.008" height="2.5" color="#fff" material="opacity:0.5"></a-cylinder>
            <!-- Label -->
            <a-text value="Hukum Snell: n1.sin(θ1) = n2.sin(θ2)" position="0 -1.6 0.1" align="center" color="#fff" width="3.5"></a-text>
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

// ─── Sensor: tilt to change angle ───
async function initSensors() {
  const avail = await sensorManager.checkAvailability();
  if (avail.gyroscope) {
    sensorManager.startGyroscope((data) => {
      if (mode === 'sim') {
        let tilt = Math.abs(data.gamma || 0);
        tilt = Math.min(89, Math.max(0, tilt));
        theta1 = Math.round(tilt);
        ctrlTheta1.value = theta1;
        dispTheta1.textContent = theta1 + '°';
        calculate();
      }
    });
  }
}

// ─── Tutorial ───
showTutorial('refraction', [
  { icon: '🔬', title: 'Pembiasan Cahaya', description: 'Pelajari bagaimana cahaya berbelok saat melewati batas dua medium berbeda (Hukum Snell).' },
  { icon: '📐', title: 'Atur Sudut & Medium', description: 'Ubah sudut datang dan pilih medium (udara, air, kaca, berlian). Lihat sudut bias berubah!' },
  { icon: '🌈', title: 'Refleksi Total', description: 'Jika cahaya dari medium padat ke renggang dengan sudut besar → terjadi refleksi total!' },
  { icon: '📋', title: 'Catat Hasil', description: 'Klik 📋 untuk isi LKS dan buktikan Hukum Snell: n₁ sin θ₁ = n₂ sin θ₂' }
], initSensors);

// ─── LKS ───
initLKS({
  experimentId: 'refraction',
  title: 'Pembiasan Cahaya (Hukum Snell)',
  tujuan: 'Membuktikan Hukum Snell (n₁ sin θ₁ = n₂ sin θ₂) dan mengamati fenomena refleksi total internal.',
  questions: [
    'Saat cahaya masuk dari udara ke air, apakah sudut bias lebih besar atau lebih kecil dari sudut datang? Mengapa?',
    'Pada sudut berapa terjadi refleksi total saat cahaya dari kaca ke udara? Hitung secara teori!',
    'Jelaskan aplikasi refleksi total dalam kehidupan sehari-hari (contoh: serat optik)!'
  ],
  getDataFn: () => ({
    'n₁': n1.toFixed(2),
    'n₂': n2.toFixed(2),
    'θ₁ (°)': theta1.toFixed(1),
    'θ₂ (°)': isTotalReflection ? 'Refleksi Total' : theta2.toFixed(1),
    'n₁sinθ₁': (n1 * Math.sin(theta1 * Math.PI / 180)).toFixed(4),
    'n₂sinθ₂': isTotalReflection ? '—' : (n2 * Math.sin(theta2 * Math.PI / 180)).toFixed(4)
  })
});

// Init
calculate();
