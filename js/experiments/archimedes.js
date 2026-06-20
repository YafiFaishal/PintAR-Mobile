/**
 * PintAR Mobile — Hukum Archimedes
 *
 * Physics:
 *   Gaya Apung (Buoyant Force): Fa = ρ_fluid × V_submerged × g
 *   Berat Benda: W = m × g = ρ_object × V_object × g
 *   Berat Semu: W_apparent = W - Fa
 *
 * Kondisi:
 *   - Terapung: ρ_object < ρ_fluid (Fa = W, sebagian tercelup)
 *   - Melayang: ρ_object = ρ_fluid (Fa = W, seluruh tercelup)
 *   - Tenggelam: ρ_object > ρ_fluid (Fa < W)
 *
 * Fraksi tercelup saat terapung:
 *   V_sub / V_total = ρ_object / ρ_fluid
 */

import { sensorManager } from '../modules/sensors.js';
import { SimCanvas, loadAR, canRunAR, startARScene } from '../modules/ar-loader.js';
import { showTutorial } from '../modules/tutorial.js';
import { initLKS } from '../modules/lks.js';

// ─── Constants ───
const g = 9.81;

const objectData = {
  iron:     { name: 'Besi', density: 7874, color: '#64748b' },
  wood:     { name: 'Kayu', density: 600, color: '#D2691E' },
  ice:      { name: 'Es Batu', density: 917, color: '#B0E0E6' },
  aluminum: { name: 'Aluminium', density: 2700, color: '#C0C0C0' },
  cork:     { name: 'Gabus', density: 120, color: '#F5DEB3' }
};

const fluidData = {
  water:     { name: 'Air', density: 1000, color: 'rgba(0, 120, 255, 0.35)' },
  saltwater: { name: 'Air Laut', density: 1025, color: 'rgba(0, 100, 180, 0.4)' },
  oil:       { name: 'Minyak', density: 800, color: 'rgba(200, 180, 0, 0.3)' },
  mercury:   { name: 'Raksa', density: 13546, color: 'rgba(150, 150, 160, 0.7)' }
};

// ─── State ───
let obj = objectData.iron;
let fluid = fluidData.water;
let volume = 0.001;     // m³
let depthPercent = 100; // manual depth override (0-100)
let mode = 'sim';

// Calculated values
let weight = 0;
let buoyancy = 0;
let apparentWeight = 0;
let floatFraction = 1;  // fraction submerged when floating
let status = '';

// ─── DOM ───
const canvas = document.getElementById('archimedes-canvas');
const simView = document.getElementById('sim-view');
const arView = document.getElementById('ar-view');
const ctrlObject = document.getElementById('ctrl-object');
const ctrlFluid = document.getElementById('ctrl-fluid');
const ctrlVolume = document.getElementById('ctrl-volume');
const ctrlDepth = document.getElementById('ctrl-depth');
const dispVolume = document.getElementById('disp-volume');
const dispDepth = document.getElementById('disp-depth');
const valWeight = document.getElementById('val-weight');
const valBuoyancy = document.getElementById('val-buoyancy');
const valApparent = document.getElementById('val-apparent');
const valStatus = document.getElementById('val-status');
const dispCalc = document.getElementById('disp-calc');

// ─── Physics ───
function calculate() {
  const mass = obj.density * volume; // kg
  weight = mass * g; // N

  // Determine natural behavior
  if (obj.density < fluid.density) {
    // FLOATS — only partially submerged
    floatFraction = obj.density / fluid.density; // Archimedes' principle
    status = 'Terapung';
    valStatus.style.color = 'var(--brand-secondary)';
  } else if (obj.density === fluid.density) {
    floatFraction = 1.0;
    status = 'Melayang';
    valStatus.style.color = 'var(--brand-primary)';
  } else {
    // SINKS
    floatFraction = 1.0;
    status = 'Tenggelam';
    valStatus.style.color = 'var(--brand-danger)';
  }

  // Volume submerged based on depth control or natural float
  const effectiveDepth = depthPercent / 100;
  const vSubmerged = volume * effectiveDepth;

  // Buoyant force: Fa = ρ_fluid × V_submerged × g
  buoyancy = fluid.density * vSubmerged * g;

  // Apparent weight
  apparentWeight = Math.max(0, weight - buoyancy);

  // Update displays
  valWeight.textContent = weight.toFixed(2);
  valBuoyancy.textContent = buoyancy.toFixed(2);
  valApparent.textContent = apparentWeight.toFixed(2);
  valStatus.textContent = status;

  // Show calculation
  dispCalc.textContent = `Fa = ${fluid.density} × ${vSubmerged.toFixed(5)} × ${g} = ${buoyancy.toFixed(2)} N`;
}

// ─── Canvas Renderer ───
const sim = new SimCanvas(canvas);

function drawArchimedes(ctx, w, h) {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() || '#f8fafc';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const tankLeft = w * 0.15;
  const tankRight = w * 0.85;
  const tankTop = h * 0.25;
  const tankBottom = h * 0.85;
  const tankWidth = tankRight - tankLeft;
  const tankHeight = tankBottom - tankTop;

  // Water surface at 70% of tank
  const waterLevel = tankTop + tankHeight * 0.3;

  // Tank walls
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(tankLeft, tankTop);
  ctx.lineTo(tankLeft, tankBottom);
  ctx.lineTo(tankRight, tankBottom);
  ctx.lineTo(tankRight, tankTop);
  ctx.stroke();

  // Fluid
  ctx.fillStyle = fluid.color;
  ctx.fillRect(tankLeft + 2, waterLevel, tankWidth - 4, tankBottom - waterLevel - 2);

  // Water surface line
  ctx.strokeStyle = 'rgba(0, 100, 200, 0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(tankLeft, waterLevel);
  ctx.lineTo(tankRight, waterLevel);
  ctx.stroke();

  // Object
  const objSize = 20 + volume * 8000; // visual size
  const effectiveDepth = depthPercent / 100;

  // Object Y position based on submersion
  // When fully submerged, center is below water
  // When floating, only floatFraction is below water
  let objCenterY;
  if (obj.density < fluid.density && depthPercent >= floatFraction * 100) {
    // Natural floating position
    const submergedPart = floatFraction * objSize;
    objCenterY = waterLevel + submergedPart - objSize / 2;
  } else {
    // Manual depth or sinking
    objCenterY = waterLevel + (effectiveDepth * (tankBottom - waterLevel - objSize)) + objSize / 2 - objSize * 0.3;
  }

  const objCenterX = w / 2;

  // Draw object (rectangle for clarity)
  ctx.fillStyle = obj.color;
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1.5;
  ctx.fillRect(objCenterX - objSize / 2, objCenterY - objSize / 2, objSize, objSize);
  ctx.strokeRect(objCenterX - objSize / 2, objCenterY - objSize / 2, objSize, objSize);

  // Force arrows
  const arrowX = objCenterX + objSize / 2 + 20;

  // Weight arrow (down) - red
  const wArrowLen = Math.min(60, weight * 2);
  ctx.beginPath();
  ctx.moveTo(arrowX, objCenterY);
  ctx.lineTo(arrowX, objCenterY + wArrowLen);
  ctx.strokeStyle = '#D32F2F';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(arrowX - 5, objCenterY + wArrowLen - 8);
  ctx.lineTo(arrowX, objCenterY + wArrowLen);
  ctx.lineTo(arrowX + 5, objCenterY + wArrowLen - 8);
  ctx.fillStyle = '#D32F2F';
  ctx.fill();
  ctx.font = '10px -apple-system, sans-serif';
  ctx.fillStyle = '#D32F2F';
  ctx.textAlign = 'left';
  ctx.fillText(`W=${weight.toFixed(1)}N`, arrowX + 8, objCenterY + wArrowLen / 2);

  // Buoyancy arrow (up) - blue
  const faArrowLen = Math.min(60, buoyancy * 2);
  if (faArrowLen > 2) {
    ctx.beginPath();
    ctx.moveTo(arrowX - 30, objCenterY);
    ctx.lineTo(arrowX - 30, objCenterY - faArrowLen);
    ctx.strokeStyle = '#0066FF';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(arrowX - 35, objCenterY - faArrowLen + 8);
    ctx.lineTo(arrowX - 30, objCenterY - faArrowLen);
    ctx.lineTo(arrowX - 25, objCenterY - faArrowLen + 8);
    ctx.fillStyle = '#0066FF';
    ctx.fill();
    ctx.textAlign = 'right';
    ctx.fillText(`Fa=${buoyancy.toFixed(1)}N`, arrowX - 35, objCenterY - faArrowLen / 2);
  }

  // Labels
  ctx.font = '11px -apple-system, sans-serif';
  ctx.fillStyle = '#4a5568';
  ctx.textAlign = 'left';
  ctx.fillText(`${obj.name} (ρ=${obj.density} kg/m³)`, tankLeft, tankTop - 10);
  ctx.fillText(`${fluid.name} (ρ=${fluid.density} kg/m³)`, tankLeft, waterLevel - 5);

  // Formula
  ctx.textAlign = 'center';
  ctx.fillStyle = '#64748b';
  ctx.fillText('Fa = ρ_fluida × V_tercelup × g', w / 2, h - 8);
}

sim.setDrawFunction(drawArchimedes);
sim.start();

// ─── Controls ───
ctrlObject.addEventListener('change', (e) => {
  obj = objectData[e.target.value];
  calculate();
});

ctrlFluid.addEventListener('change', (e) => {
  fluid = fluidData[e.target.value];
  calculate();
});

ctrlVolume.addEventListener('input', (e) => {
  volume = parseFloat(e.target.value);
  dispVolume.textContent = volume.toFixed(4) + ' m³';
  calculate();
});

ctrlDepth.addEventListener('input', (e) => {
  depthPercent = parseFloat(e.target.value);
  dispDepth.textContent = depthPercent + '%';
  calculate();
});

// Bottom sheet
const sheet = document.getElementById('controls-sheet');
const btnToggle = document.getElementById('btn-toggle-sheet');
btnToggle.addEventListener('click', () => {
  sheet.classList.toggle('open');
  btnToggle.textContent = sheet.classList.contains('open') ? '▼' : '▲';
});

// Mode switcher
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
        arView.innerHTML = `<a-scene embedded arjs="sourceType:webcam;debugUIEnabled:false;" vr-mode-ui="enabled:false" style="position:absolute;top:0;left:0;width:100%;height:100%;overflow:hidden;"><a-marker preset="hiro"><a-entity rotation="-60 0 0" scale="0.4 0.4 0.4"><a-box position="0 0 0" width="2" height="1.5" depth="2" color="#a5f3fc" material="transparent:true;opacity:0.25;side:double"></a-box><a-box position="0 -0.2 0" width="1.8" height="1" depth="1.8" color="#0077be" material="transparent:true;opacity:0.4"></a-box><a-box id="ar-obj" position="0 0.2 0" width="0.5" height="0.5" depth="0.5" color="${obj.color}"></a-box></a-entity></a-marker><a-entity camera></a-entity></a-scene>`;
        window.showToast('AR aktif! Arahkan ke marker.', 'info');
      } else { window.showToast('Gagal memuat AR.', 'error'); modeBtns[0].click(); }
    } else {
      arView.classList.add('hidden'); arView.innerHTML = '';
      simView.classList.remove('hidden'); sim.start();
    }
  });
});

// ─── Sensor: tilt to change depth ───
async function initSensors() {
  const avail = await sensorManager.checkAvailability();
  if (avail.gyroscope) {
    sensorManager.startGyroscope((data) => {
      if (mode === 'sim') {
        // Map pitch (beta: -90 to 90) to depth (0-100%)
        let pitch = data.beta || 0;
        let depth = Math.round(Math.max(0, Math.min(100, (pitch + 90) / 180 * 100)));
        depthPercent = depth;
        ctrlDepth.value = depth;
        dispDepth.textContent = depth + '%';
        calculate();
      }
    });
  }
}

// ─── Tutorial ───
showTutorial('archimedes', [
  { icon: '🚢', title: 'Hukum Archimedes', description: 'Pelajari gaya apung! Benda yang dicelupkan ke cairan mendapat gaya dorong ke atas.' },
  { icon: '⚖️', title: 'Pilih Benda & Cairan', description: 'Bandingkan massa jenis benda dan cairan. Jika ρ_benda < ρ_fluida → benda terapung!' },
  { icon: '📱', title: 'Miringkan HP', description: 'Miringkan HP untuk mengatur kedalaman celup benda, atau geser slider.' },
  { icon: '📋', title: 'Catat Hasil', description: 'Klik 📋 untuk mengisi LKS. Catat gaya apung dan berat semu di berbagai kondisi.' }
], initSensors);

// ─── LKS ───
initLKS({
  experimentId: 'archimedes',
  title: 'Hukum Archimedes',
  tujuan: 'Membuktikan Hukum Archimedes: Fa = ρ_fluida × V_tercelup × g, dan menentukan kondisi terapung, melayang, dan tenggelam.',
  questions: [
    'Mengapa kayu terapung di air tapi tenggelam di minyak? Jelaskan dengan massa jenis!',
    'Hitung gaya apung bola besi (V=0.001 m³) yang seluruhnya tercelup di air. Apakah cukup untuk membuatnya terapung?',
    'Berapa persen volume es batu yang tercelup di air? Hitung menggunakan rumus fraksi tercelup!'
  ],
  getDataFn: () => ({
    'Objek': obj.name,
    'ρ objek (kg/m³)': obj.density,
    'Fluida': fluid.name,
    'ρ fluida (kg/m³)': fluid.density,
    'V objek (m³)': volume.toFixed(5),
    'W (N)': weight.toFixed(3),
    'Fa (N)': buoyancy.toFixed(3),
    'W semu (N)': apparentWeight.toFixed(3),
    'Status': status
  })
});

// Init
calculate();
