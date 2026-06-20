/**
 * PintAR Mobile — Tata Surya (Solar System)
 *
 * Physics (Kepler's Laws):
 *   Hukum I: Orbit planet berbentuk elips dengan matahari di salah satu fokus
 *   Hukum II: Garis penghubung planet-matahari menyapu luas yang sama dalam waktu sama
 *   Hukum III: T² ∝ a³ → T² / a³ = konstan untuk semua planet
 *     T = periode orbit (tahun)
 *     a = semi-major axis (AU)
 *     T² = a³ (jika T dalam tahun dan a dalam AU)
 *
 * Gravitasi Newton:
 *   F = G × M × m / r²
 *   v_orbital = √(G × M / r)
 *   T = 2π × √(a³ / (G × M))
 */

import { SimCanvas, loadAR, canRunAR, startARScene } from '../modules/ar-loader.js';
import { showTutorial } from '../modules/tutorial.js';
import { initLKS } from '../modules/lks.js';

// ─── Planet Data (real values) ───
const planets = [
  { name: 'Merkurius', a: 0.387, e: 0.206, T: 0.241, color: '#A0522D', radius: 3, mass: '3.3×10²³ kg' },
  { name: 'Venus', a: 0.723, e: 0.007, T: 0.615, color: '#DEB887', radius: 4, mass: '4.87×10²⁴ kg' },
  { name: 'Bumi', a: 1.000, e: 0.017, T: 1.000, color: '#4169E1', radius: 5, mass: '5.97×10²⁴ kg' },
  { name: 'Mars', a: 1.524, e: 0.093, T: 1.881, color: '#CD5C5C', radius: 4, mass: '6.42×10²³ kg' },
  { name: 'Jupiter', a: 5.203, e: 0.049, T: 11.86, color: '#DAA520', radius: 10, mass: '1.90×10²⁷ kg' },
  { name: 'Saturnus', a: 9.537, e: 0.056, T: 29.46, color: '#F4A460', radius: 9, mass: '5.68×10²⁶ kg' },
  { name: 'Uranus', a: 19.19, e: 0.046, T: 84.01, color: '#87CEEB', radius: 6, mass: '8.68×10²⁵ kg' },
  { name: 'Neptunus', a: 30.07, e: 0.010, T: 164.8, color: '#4682B4', radius: 6, mass: '1.02×10²⁶ kg' }
];

// ─── State ───
let selectedPlanet = 2; // Earth
let timeScale = 1;
let showOrbits = true;
let showLabels = true;
let time = 0;
let mode = 'sim';
let animationId = null;

// ─── DOM ───
const canvas = document.getElementById('solar-canvas');
const simView = document.getElementById('sim-view');
const arView = document.getElementById('ar-view');
const ctrlPlanet = document.getElementById('ctrl-planet');
const ctrlSpeed = document.getElementById('ctrl-speed');
const dispSpeed = document.getElementById('disp-speed');
const valPlanetName = document.getElementById('val-planet-name');
const valSemiMajor = document.getElementById('val-semimajor');
const valPeriod = document.getElementById('val-period');
const valKepler3 = document.getElementById('val-kepler3');
const dispKeplerTable = document.getElementById('disp-kepler-table');

// ─── Physics: position from orbital mechanics ───
function getOrbitalPosition(planet, t) {
  // Simplified: circular approximation with eccentricity
  // For proper Kepler: solve Kepler's equation M = E - e*sin(E)
  // Here we use approximate position:
  const angularVelocity = (2 * Math.PI) / planet.T; // rad/year
  const meanAnomaly = angularVelocity * t;

  // Solve Kepler's equation iteratively: M = E - e*sin(E)
  let E = meanAnomaly;
  for (let i = 0; i < 10; i++) {
    E = meanAnomaly + planet.e * Math.sin(E);
  }

  // True anomaly
  const trueAnomaly = 2 * Math.atan2(
    Math.sqrt(1 + planet.e) * Math.sin(E / 2),
    Math.sqrt(1 - planet.e) * Math.cos(E / 2)
  );

  // Radius from focus (distance to Sun)
  const r = planet.a * (1 - planet.e * Math.cos(E));

  return {
    x: r * Math.cos(trueAnomaly),
    y: r * Math.sin(trueAnomaly),
    r: r,
    angle: trueAnomaly
  };
}

// ─── Canvas Renderer ───
const sim = new SimCanvas(canvas);

function drawSolarSystem(ctx, w, h) {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() || '#f8fafc';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;

  // Scale: fit inner planets (max ~2 AU) or outer (up to ~30 AU)
  const maxA = planets[Math.min(selectedPlanet + 2, planets.length - 1)].a;
  const scale = Math.min(w, h) * 0.4 / Math.max(maxA, 2);

  // Sun
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  const sunGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 8);
  sunGrad.addColorStop(0, '#FFFF00');
  sunGrad.addColorStop(1, '#FF8C00');
  ctx.fillStyle = sunGrad;
  ctx.fill();

  // Draw orbits and planets
  const visiblePlanets = planets.slice(0, Math.min(selectedPlanet + 3, planets.length));

  visiblePlanets.forEach((planet, i) => {
    const orbitRadius = planet.a * scale;

    // Orbit path (ellipse approximation)
    if (showOrbits) {
      ctx.beginPath();
      ctx.ellipse(cx - planet.e * orbitRadius, cy, orbitRadius, orbitRadius * Math.sqrt(1 - planet.e * planet.e), 0, 0, Math.PI * 2);
      ctx.strokeStyle = i === selectedPlanet ? 'rgba(0,102,255,0.5)' : 'rgba(150,150,150,0.3)';
      ctx.lineWidth = i === selectedPlanet ? 1.5 : 0.5;
      ctx.stroke();
    }

    // Planet position
    const pos = getOrbitalPosition(planet, time);
    const px = cx + pos.x * scale;
    const py = cy - pos.y * scale; // Flip Y

    // Planet
    ctx.beginPath();
    ctx.arc(px, py, planet.radius * (i === selectedPlanet ? 1.3 : 1), 0, Math.PI * 2);
    ctx.fillStyle = planet.color;
    ctx.fill();
    if (i === selectedPlanet) {
      ctx.strokeStyle = '#0066FF';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Labels
    if (showLabels && (i === selectedPlanet || visiblePlanets.length <= 5)) {
      ctx.font = '9px -apple-system, sans-serif';
      ctx.fillStyle = '#4a5568';
      ctx.textAlign = 'center';
      ctx.fillText(planet.name, px, py - planet.radius - 5);
    }
  });

  // Info
  ctx.font = '11px -apple-system, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'center';
  ctx.fillText('Hukum Kepler III: T² = a³ (T dalam tahun, a dalam AU)', cx, h - 8);
}

sim.setDrawFunction(drawSolarSystem);
sim.start();

// ─── Animation Loop ───
function animateOrbits() {
  time += 0.005 * timeScale;
  animationId = requestAnimationFrame(animateOrbits);
}
animateOrbits();

// ─── Update Info Panel ───
function updateInfo() {
  const p = planets[selectedPlanet];
  valPlanetName.textContent = p.name;
  valSemiMajor.textContent = p.a.toFixed(3) + ' AU';
  valPeriod.textContent = p.T.toFixed(3) + ' tahun';

  // Verify Kepler's Third Law: T²/a³ should ≈ 1
  const kepler3 = (p.T * p.T) / (p.a * p.a * p.a);
  valKepler3.textContent = kepler3.toFixed(4);

  // Build Kepler table for all planets
  let table = '<table style="width:100%;font-size:0.65rem;border-collapse:collapse;">';
  table += '<tr><th style="text-align:left;padding:2px">Planet</th><th>a (AU)</th><th>T (thn)</th><th>T²/a³</th></tr>';
  planets.forEach((pl, i) => {
    const k = (pl.T * pl.T) / (pl.a * pl.a * pl.a);
    const highlight = i === selectedPlanet ? 'font-weight:700;color:var(--brand-primary)' : '';
    table += `<tr style="${highlight}"><td style="padding:2px">${pl.name}</td><td style="text-align:center">${pl.a.toFixed(2)}</td><td style="text-align:center">${pl.T.toFixed(2)}</td><td style="text-align:center">${k.toFixed(3)}</td></tr>`;
  });
  table += '</table>';
  dispKeplerTable.innerHTML = table;
}

// ─── Controls ───
ctrlPlanet.addEventListener('change', (e) => {
  selectedPlanet = parseInt(e.target.value);
  updateInfo();
});

ctrlSpeed.addEventListener('input', (e) => {
  timeScale = parseFloat(e.target.value);
  dispSpeed.textContent = timeScale.toFixed(1) + 'x';
});

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
      if (!canRunAR()) {
        arView.classList.remove('hidden');
        simView.classList.add('hidden');
        arView.innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:var(--space-6);text-align:center;gap:var(--space-4);">
            <div style="font-size:3rem">📵</div>
            <p style="color:var(--text-secondary);font-size:var(--fs-sm);line-height:1.6">
              Kamera tidak tersedia atau izin ditolak.<br>
              Pastikan browser punya akses kamera, lalu muat ulang halaman.
            </p>
            <button class="btn btn-primary btn-sm" onclick="location.reload()">🔄 Muat Ulang</button>
          </div>`;
        return;
      }
      simView.classList.add('hidden'); arView.classList.remove('hidden');
      arView.innerHTML = '<p style="padding:var(--space-6);text-align:center;color:var(--text-secondary)">Memuat AR...</p>';
      const loaded = await loadAR();
      if (loaded) {
        arView.innerHTML = `<a-scene embedded arjs="sourceType: webcam; facingMode: environment; debugUIEnabled: false;" vr-mode-ui="enabled:false" style="position:absolute;top:0;left:0;width:100%;height:100%;overflow:hidden;"><a-marker preset="hiro"><a-entity scale="0.3 0.3 0.3"><a-sphere position="0 0 0" radius="0.3" color="#FFD600" material="emissive:#FF8C00;emissiveIntensity:0.8"></a-sphere><a-sphere position="1 0 0" radius="0.08" color="#4169E1" animation="property:rotation;to:0 360 0;dur:${planets[selectedPlanet].T * 3000};loop:true;easing:linear"></a-sphere></a-entity></a-marker><a-entity camera></a-entity></a-scene>`;
        window.showToast('AR aktif!', 'info');
      } else { window.showToast('Gagal memuat AR.', 'error'); modeBtns[0].click(); }
    } else {
      document.body.classList.remove('ar-active');
      arView.classList.add('hidden'); arView.innerHTML = '';
      simView.classList.remove('hidden'); sim.start();
    }
  });
});

// ─── Tutorial ───
showTutorial('solarsystem', [
  { icon: '🪐', title: 'Tata Surya', description: 'Eksplorasi orbit planet dan buktikan Hukum Kepler tentang gerak planet!' },
  { icon: '📐', title: 'Hukum Kepler III', description: 'T² = a³ — kuadrat periode orbit sebanding dengan pangkat tiga jarak rata-rata ke Matahari.' },
  { icon: '🔍', title: 'Pilih Planet', description: 'Pilih planet untuk melihat data orbitnya. Verifikasi bahwa T²/a³ ≈ 1 untuk semua planet!' },
  { icon: '📋', title: 'Catat', description: 'Isi LKS untuk membuktikan Hukum Kepler dari data orbit planet.' }
], () => {});

// ─── LKS ───
initLKS({
  experimentId: 'solarsystem',
  title: 'Tata Surya (Hukum Kepler)',
  tujuan: 'Membuktikan Hukum Kepler III: T² = a³ (dengan T dalam tahun dan a dalam AU) untuk semua planet dalam tata surya.',
  questions: [
    'Hitung T²/a³ untuk Bumi, Mars, dan Jupiter. Apakah nilainya konstan? Berapa nilai konstantanya?',
    'Jika ditemukan asteroid dengan jarak rata-rata 4 AU dari Matahari, berapa periode orbitnya?',
    'Mengapa planet yang lebih jauh dari Matahari memiliki periode orbit yang lebih lama? Jelaskan secara fisika!'
  ],
  getDataFn: () => {
    const p = planets[selectedPlanet];
    return {
      'Planet': p.name,
      'a (AU)': p.a.toFixed(3),
      'T (tahun)': p.T.toFixed(3),
      'e (eksentrisitas)': p.e.toFixed(4),
      'T²': (p.T * p.T).toFixed(3),
      'a³': (p.a * p.a * p.a).toFixed(3),
      'T²/a³': ((p.T * p.T) / (p.a * p.a * p.a)).toFixed(4)
    };
  }
});

// Init
updateInfo();
