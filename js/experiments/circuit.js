/**
 * PintAR Mobile — Rangkaian Listrik (Electric Circuit)
 *
 * Physics (Ohm's Law & Kirchhoff's Laws):
 *   V = I × R (Hukum Ohm)
 *   P = V × I = I²R = V²/R (Daya listrik)
 *
 * Rangkaian Seri:
 *   R_total = R₁ + R₂ + R₃
 *   I_total = V / R_total (arus sama di semua komponen)
 *   V₁ = I × R₁, V₂ = I × R₂, V₃ = I × R₃
 *
 * Rangkaian Paralel:
 *   1/R_total = 1/R₁ + 1/R₂ + 1/R₃
 *   V₁ = V₂ = V₃ = V_sumber (tegangan sama)
 *   I₁ = V/R₁, I₂ = V/R₂, I₃ = V/R₃
 *   I_total = I₁ + I₂ + I₃
 *
 * Rangkaian Campuran:
 *   R₂ paralel R₃: Rp = (R₂×R₃)/(R₂+R₃)
 *   R_total = R₁ + Rp (seri dengan R₁)
 */

import { sensorManager } from '../modules/sensors.js';
import { SimCanvas, loadAR, canRunAR, getARSupportInfo, requestCameraPermission, startARScene, destroyARScene } from '../modules/ar-loader.js';
import { showTutorial } from '../modules/tutorial.js';
import { initLKS } from '../modules/lks.js';

// ─── State ───
let V = 12;     // voltage (V)
let R1 = 100;   // resistance 1 (Ω)
let R2 = 200;   // resistance 2 (Ω)
let R3 = 300;   // resistance 3 (Ω)
let circuitType = 'series';
let mode = 'sim';

// Calculated
let Rtotal = 0;
let Itotal = 0;
let Ptotal = 0;
let I1 = 0, I2 = 0, I3 = 0;
let V1 = 0, V2 = 0, V3 = 0;

// ─── DOM ───
const canvas = document.getElementById('circuit-canvas');
const simView = document.getElementById('sim-view');
const arView = document.getElementById('ar-view');
const ctrlType = document.getElementById('ctrl-type');
const ctrlVoltage = document.getElementById('ctrl-voltage');
const ctrlR1 = document.getElementById('ctrl-r1');
const ctrlR2 = document.getElementById('ctrl-r2');
const ctrlR3 = document.getElementById('ctrl-r3');
const dispVoltage = document.getElementById('disp-voltage');
const dispR1 = document.getElementById('disp-r1');
const dispR2 = document.getElementById('disp-r2');
const dispR3 = document.getElementById('disp-r3');
const valVoltage = document.getElementById('val-voltage');
const valCurrent = document.getElementById('val-current');
const valResistance = document.getElementById('val-resistance');
const valPower = document.getElementById('val-power');
const dispDetail = document.getElementById('disp-detail');

// ─── Physics ───
function calculate() {
  if (circuitType === 'series') {
    // Seri: R_total = R₁ + R₂ + R₃
    Rtotal = R1 + R2 + R3;
    Itotal = V / Rtotal;
    I1 = I2 = I3 = Itotal;
    V1 = Itotal * R1;
    V2 = Itotal * R2;
    V3 = Itotal * R3;
    dispDetail.textContent = `Seri: R=${R1}+${R2}+${R3}=${Rtotal}Ω | I=${(Itotal*1000).toFixed(1)}mA | V₁=${V1.toFixed(1)}V, V₂=${V2.toFixed(1)}V, V₃=${V3.toFixed(1)}V`;
  } else if (circuitType === 'parallel') {
    // Paralel: 1/R = 1/R₁ + 1/R₂ + 1/R₃
    Rtotal = 1 / (1/R1 + 1/R2 + 1/R3);
    Itotal = V / Rtotal;
    I1 = V / R1;
    I2 = V / R2;
    I3 = V / R3;
    V1 = V2 = V3 = V;
    dispDetail.textContent = `Paralel: R=${Rtotal.toFixed(1)}Ω | I₁=${(I1*1000).toFixed(1)}mA, I₂=${(I2*1000).toFixed(1)}mA, I₃=${(I3*1000).toFixed(1)}mA`;
  } else {
    // Campuran: R₂ ∥ R₃ seri dengan R₁
    const Rp = (R2 * R3) / (R2 + R3);
    Rtotal = R1 + Rp;
    Itotal = V / Rtotal;
    I1 = Itotal;
    V1 = Itotal * R1;
    const Vp = Itotal * Rp;
    V2 = Vp; V3 = Vp;
    I2 = Vp / R2;
    I3 = Vp / R3;
    dispDetail.textContent = `Campuran: R₂∥R₃=${Rp.toFixed(1)}Ω, R_total=${Rtotal.toFixed(1)}Ω | I=${(Itotal*1000).toFixed(1)}mA`;
  }

  Ptotal = V * Itotal; // P = V × I

  valVoltage.textContent = V.toFixed(1);
  valCurrent.textContent = (Itotal * 1000).toFixed(1) + ' mA';
  valResistance.textContent = Rtotal.toFixed(1);
  valPower.textContent = (Ptotal * 1000).toFixed(1) + ' mW';
}

// ─── Canvas Renderer ───
const sim = new SimCanvas(canvas);

function drawCircuit(ctx, w, h) {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() || '#f8fafc';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const wireColor = '#475569';

  // Battery
  const batX = cx - 80;
  const batY = cy - 60;
  ctx.strokeStyle = wireColor;
  ctx.lineWidth = 2;

  // Draw battery symbol
  ctx.beginPath();
  ctx.moveTo(batX, batY - 15);
  ctx.lineTo(batX, batY + 15);
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(batX + 6, batY - 8);
  ctx.lineTo(batX + 6, batY + 8);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.font = '10px -apple-system, sans-serif';
  ctx.fillStyle = '#D32F2F';
  ctx.textAlign = 'center';
  ctx.fillText('+', batX + 6, batY - 18);
  ctx.fillText('−', batX, batY + 25);
  ctx.fillStyle = '#4a5568';
  ctx.fillText(`${V}V`, batX + 3, batY + 38);

  // Brightness indicator (simulated lamp) based on current
  const brightness = Math.min(1, Itotal * 10);
  const lampX = cx + 60;
  const lampY = cy - 60;
  ctx.beginPath();
  ctx.arc(lampX, lampY, 12, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 200, 0, ${brightness})`;
  ctx.fill();
  ctx.strokeStyle = wireColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Cross inside lamp
  ctx.beginPath();
  ctx.moveTo(lampX - 6, lampY - 6);
  ctx.lineTo(lampX + 6, lampY + 6);
  ctx.moveTo(lampX + 6, lampY - 6);
  ctx.lineTo(lampX - 6, lampY + 6);
  ctx.strokeStyle = wireColor;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.lineWidth = 2;
  ctx.strokeStyle = wireColor;

  if (circuitType === 'series') {
    // Series: all resistors in a line
    const startX = cx - 60;
    const endX = cx + 60;
    const rY = cy + 30;
    const rW = 30;
    const gap = 15;

    // Wires from battery
    ctx.beginPath();
    ctx.moveTo(batX + 6, batY - 15);
    ctx.lineTo(batX + 6, batY - 40);
    ctx.lineTo(endX, batY - 40);
    ctx.lineTo(endX, rY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(batX, batY + 15);
    ctx.lineTo(batX, rY);
    ctx.lineTo(startX - 10, rY);
    ctx.stroke();

    // Draw 3 resistors in series
    const positions = [startX - 10, startX + rW + gap, startX + 2 * (rW + gap)];
    const labels = [`R₁=${R1}Ω`, `R₂=${R2}Ω`, `R₃=${R3}Ω`];
    const currents = [I1, I2, I3];
    const voltages = [V1, V2, V3];

    positions.forEach((rx, i) => {
      drawResistor(ctx, rx, rY - 5, rW, 10, wireColor);
      ctx.font = '9px -apple-system, sans-serif';
      ctx.fillStyle = '#0066FF';
      ctx.textAlign = 'center';
      ctx.fillText(labels[i], rx + rW / 2, rY + 18);
      ctx.fillStyle = '#D32F2F';
      ctx.fillText(`${voltages[i].toFixed(1)}V`, rx + rW / 2, rY + 30);
    });

    // Connect resistors
    ctx.beginPath();
    ctx.moveTo(positions[0] + rW, rY);
    ctx.lineTo(positions[1], rY);
    ctx.moveTo(positions[1] + rW, rY);
    ctx.lineTo(positions[2], rY);
    ctx.moveTo(positions[2] + rW, rY);
    ctx.lineTo(endX, rY);
    ctx.strokeStyle = wireColor;
    ctx.stroke();

    // Current arrow
    ctx.fillStyle = '#00C853';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`I = ${(Itotal*1000).toFixed(1)} mA →`, cx, rY + 45);

  } else if (circuitType === 'parallel') {
    // Parallel: resistors side by side
    const topY = cy - 30;
    const botY = cy + 50;
    const leftX = cx - 50;
    const rightX = cx + 50;
    const spacing = 35;

    // Top and bottom wires
    ctx.beginPath();
    ctx.moveTo(batX + 6, batY - 15);
    ctx.lineTo(batX + 6, topY - 30);
    ctx.lineTo(rightX, topY - 30);
    ctx.lineTo(rightX, topY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(batX, batY + 15);
    ctx.lineTo(batX, botY + 10);
    ctx.lineTo(rightX, botY + 10);
    ctx.lineTo(rightX, botY);
    ctx.stroke();

    // Horizontal bus bars
    ctx.beginPath();
    ctx.moveTo(leftX - 20, topY);
    ctx.lineTo(rightX + 20, topY);
    ctx.moveTo(leftX - 20, botY);
    ctx.lineTo(rightX + 20, botY);
    ctx.stroke();

    // Draw 3 vertical resistors
    const xs = [leftX - 15, cx, rightX + 15];
    const labels = [`R₁=${R1}Ω`, `R₂=${R2}Ω`, `R₃=${R3}Ω`];
    const currents_arr = [I1, I2, I3];

    xs.forEach((x, i) => {
      ctx.beginPath();
      ctx.moveTo(x, topY);
      ctx.lineTo(x, topY + 10);
      ctx.stroke();
      drawResistorV(ctx, x - 5, topY + 10, 10, 30, wireColor);
      ctx.beginPath();
      ctx.moveTo(x, topY + 40);
      ctx.lineTo(x, botY);
      ctx.stroke();

      ctx.font = '8px -apple-system, sans-serif';
      ctx.fillStyle = '#0066FF';
      ctx.textAlign = 'center';
      ctx.fillText(labels[i], x, botY + 22);
      ctx.fillStyle = '#00C853';
      ctx.fillText(`${(currents_arr[i]*1000).toFixed(1)}mA`, x, topY - 5);
    });

  } else {
    // Mixed: R1 in series with (R2 parallel R3)
    ctx.font = '10px -apple-system, sans-serif';
    ctx.fillStyle = '#4a5568';
    ctx.textAlign = 'center';
    ctx.fillText('R₁ seri dengan (R₂ ∥ R₃)', cx, cy + 70);

    // Simplified visual
    const rY = cy;
    drawResistor(ctx, cx - 70, rY - 5, 30, 10, wireColor);
    ctx.fillStyle = '#0066FF';
    ctx.fillText(`R₁=${R1}Ω`, cx - 55, rY + 18);

    // Parallel box for R2||R3
    ctx.strokeStyle = wireColor;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(cx + 10, rY - 25, 60, 50);
    ctx.setLineDash([]);
    ctx.fillStyle = '#4a5568';
    ctx.fillText(`R₂=${R2}Ω`, cx + 40, rY - 5);
    ctx.fillText(`R₃=${R3}Ω`, cx + 40, rY + 12);
    ctx.fillStyle = '#00C853';
    ctx.fillText(`Rp=${((R2*R3)/(R2+R3)).toFixed(1)}Ω`, cx + 40, rY + 30);

    // Wires
    ctx.beginPath();
    ctx.moveTo(cx - 70, rY);
    ctx.lineTo(cx - 80, rY);
    ctx.moveTo(cx - 40, rY);
    ctx.lineTo(cx + 10, rY);
    ctx.moveTo(cx + 70, rY);
    ctx.lineTo(cx + 80, rY);
    ctx.strokeStyle = wireColor;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Formula at bottom
  ctx.font = '11px -apple-system, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'center';
  ctx.fillText('V = I × R  |  P = V × I  |  P = I²R', cx, h - 8);
}

function drawResistor(ctx, x, y, w, h, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w, h);
  // Zigzag inside (simplified)
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const px = x + (w / 4) * i + w / 8;
    ctx.moveTo(px, y + 2);
    ctx.lineTo(px, y + h - 2);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.stroke();
}

function drawResistorV(ctx, x, y, w, h, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w, h);
}

sim.setDrawFunction(drawCircuit);
sim.start();

// ─── Controls ───
ctrlType.addEventListener('change', (e) => { circuitType = e.target.value; calculate(); });
ctrlVoltage.addEventListener('input', (e) => { V = parseFloat(e.target.value); dispVoltage.textContent = V + ' V'; calculate(); });
ctrlR1.addEventListener('input', (e) => { R1 = parseFloat(e.target.value); dispR1.textContent = R1 + ' Ω'; calculate(); });
ctrlR2.addEventListener('input', (e) => { R2 = parseFloat(e.target.value); dispR2.textContent = R2 + ' Ω'; calculate(); });
ctrlR3.addEventListener('input', (e) => { R3 = parseFloat(e.target.value); dispR3.textContent = R3 + ' Ω'; calculate(); });


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
        startARScene(arView, `<a-entity rotation="-90 0 0" scale="0.5 0.5 0.5"><a-box position="-0.5 0 0" width="0.3" height="0.1" depth="0.2" color="#64748b"></a-box><a-box position="0 0 0" width="0.3" height="0.1" depth="0.2" color="#64748b"></a-box><a-box position="0.5 0 0" width="0.3" height="0.1" depth="0.2" color="#64748b"></a-box><a-sphere position="0 0.5 0" radius="0.15" color="#FFD600" material="emissive:#FFD600;emissiveIntensity:${Math.min(1, Itotal*10).toFixed(2)}"></a-sphere></a-entity>`, {
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

// ─── Tutorial ───
showTutorial('circuit', [
  { icon: '⚡', title: 'Rangkaian Listrik', description: 'Pelajari Hukum Ohm (V=IR) dan perbedaan rangkaian seri, paralel, dan campuran.' },
  { icon: '🔧', title: 'Atur Komponen', description: 'Ubah tegangan dan resistansi. Pada seri, arus sama. Pada paralel, tegangan sama.' },
  { icon: '💡', title: 'Amati', description: 'Perhatikan bagaimana arus dan daya berubah saat kamu mengubah resistansi.' },
  { icon: '📋', title: 'Catat', description: 'Klik 📋 untuk isi LKS. Buktikan Hukum Ohm dan Hukum Kirchhoff!' }
], () => {});

// ─── LKS ───
initLKS({
  experimentId: 'circuit',
  title: 'Rangkaian Listrik (Hukum Ohm)',
  tujuan: 'Membuktikan Hukum Ohm (V = IR) dan membandingkan karakteristik rangkaian seri, paralel, dan campuran.',
  questions: [
    'Pada rangkaian seri, jika R₁ diperbesar 2x lipat, bagaimana pengaruhnya terhadap arus total? Jelaskan!',
    'Mengapa pada rangkaian paralel, R_total selalu lebih kecil dari resistor terkecil?',
    'Hitung daya yang diserap R₂ pada rangkaian seri dengan V=12V, R₁=100Ω, R₂=200Ω, R₃=300Ω!'
  ],
  getDataFn: () => ({
    'Rangkaian': circuitType === 'series' ? 'Seri' : circuitType === 'parallel' ? 'Paralel' : 'Campuran',
    'V sumber (V)': V.toFixed(1),
    'R₁ (Ω)': R1,
    'R₂ (Ω)': R2,
    'R₃ (Ω)': R3,
    'R total (Ω)': Rtotal.toFixed(1),
    'I total (mA)': (Itotal * 1000).toFixed(2),
    'P total (mW)': (Ptotal * 1000).toFixed(2)
  })
});

// Init
calculate();
