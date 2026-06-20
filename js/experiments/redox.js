/**
 * PintAR Mobile — Reaksi Redoks (Redox Reactions)
 *
 * Chemistry Concepts:
 *   Oksidasi: kehilangan elektron, biloks naik
 *   Reduksi: menerima elektron, biloks turun
 *   
 *   E° sel = E° katoda (reduksi) - E° anoda (oksidasi)
 *   Jika E° sel > 0 → reaksi spontan
 *   
 * Standard Reduction Potentials (E° dalam Volt):
 *   Li⁺/Li     = -3.04
 *   Na⁺/Na     = -2.71
 *   Mg²⁺/Mg   = -2.37
 *   Al³⁺/Al   = -1.66
 *   Zn²⁺/Zn   = -0.76
 *   Fe²⁺/Fe   = -0.44
 *   H⁺/H₂     =  0.00 (referensi)
 *   Cu²⁺/Cu   = +0.34
 *   Ag⁺/Ag    = +0.80
 *   Au³⁺/Au   = +1.50
 *   Cl₂/Cl⁻   = +1.36
 *   MnO₄⁻/Mn²⁺ = +1.51
 */

import { sensorManager } from '../modules/sensors.js';
import { SimCanvas, loadAR, canRunAR, startARScene, destroyARScene } from '../modules/ar-loader.js';
import { showTutorial } from '../modules/tutorial.js';
import { initLKS } from '../modules/lks.js';

// ─── Reaction Database ───
const reactions = {
  zn_cu: {
    name: 'Sel Daniell (Zn + Cu²⁺)',
    equation: 'Zn(s) + Cu²⁺(aq) → Zn²⁺(aq) + Cu(s)',
    oxidation: { half: 'Zn → Zn²⁺ + 2e⁻', species: 'Zn', from: 0, to: 2, E: 0.76 },
    reduction: { half: 'Cu²⁺ + 2e⁻ → Cu', species: 'Cu', from: 2, to: 0, E: 0.34 },
    Ecell: 1.10,
    electrons: 2,
    observation: 'Logam Zn larut perlahan, endapan Cu berwarna cokelat kemerahan terbentuk. Larutan biru (CuSO₄) memudar.',
    colorStart: [0, 100, 200],   // blue (CuSO4)
    colorEnd: [180, 200, 220],   // pale/clear (ZnSO4)
    hasBubbles: false,
    hasDeposit: true,
    depositColor: '#B87333' // copper
  },
  fe_cu: {
    name: 'Besi + Tembaga Sulfat',
    equation: 'Fe(s) + Cu²⁺(aq) → Fe²⁺(aq) + Cu(s)',
    oxidation: { half: 'Fe → Fe²⁺ + 2e⁻', species: 'Fe', from: 0, to: 2, E: 0.44 },
    reduction: { half: 'Cu²⁺ + 2e⁻ → Cu', species: 'Cu', from: 2, to: 0, E: 0.34 },
    Ecell: 0.78,
    electrons: 2,
    observation: 'Paku besi berubah kemerahan (lapisan Cu). Larutan biru memudar menjadi kehijauan (FeSO₄).',
    colorStart: [0, 100, 200],
    colorEnd: [100, 180, 100],
    hasBubbles: false,
    hasDeposit: true,
    depositColor: '#B87333'
  },
  mg_hcl: {
    name: 'Magnesium + Asam Klorida',
    equation: 'Mg(s) + 2HCl(aq) → MgCl₂(aq) + H₂(g)↑',
    oxidation: { half: 'Mg → Mg²⁺ + 2e⁻', species: 'Mg', from: 0, to: 2, E: 2.37 },
    reduction: { half: '2H⁺ + 2e⁻ → H₂', species: 'H', from: 1, to: 0, E: 0.00 },
    Ecell: 2.37,
    electrons: 2,
    observation: 'Magnesium larut dengan cepat. Gelembung gas H₂ keluar deras. Reaksi eksotermik (panas).',
    colorStart: [220, 220, 220],
    colorEnd: [240, 240, 240],
    hasBubbles: true,
    hasDeposit: false,
    depositColor: ''
  },
  na_h2o: {
    name: 'Natrium + Air',
    equation: '2Na(s) + 2H₂O(l) → 2NaOH(aq) + H₂(g)↑',
    oxidation: { half: 'Na → Na⁺ + e⁻', species: 'Na', from: 0, to: 1, E: 2.71 },
    reduction: { half: '2H₂O + 2e⁻ → H₂ + 2OH⁻', species: 'H', from: 1, to: 0, E: -0.83 },
    Ecell: 1.88,
    electrons: 2,
    observation: 'Na bereaksi hebat dengan air! Gelembung H₂, larutan menjadi basa (NaOH). BAHAYA: bisa terbakar!',
    colorStart: [200, 220, 255],
    colorEnd: [255, 200, 200],
    hasBubbles: true,
    hasDeposit: false,
    depositColor: ''
  },
  fe_rust: {
    name: 'Perkaratan Besi',
    equation: '4Fe(s) + 3O₂(g) → 2Fe₂O₃(s)',
    oxidation: { half: 'Fe → Fe³⁺ + 3e⁻', species: 'Fe', from: 0, to: 3, E: 0.04 },
    reduction: { half: 'O₂ + 4e⁻ → 2O²⁻', species: 'O', from: 0, to: -2, E: 1.23 },
    Ecell: 1.27,
    electrons: 12,
    observation: 'Proses lambat. Besi berubah warna jadi cokelat-oranye (karat/Fe₂O₃). Dipercepat oleh air dan garam.',
    colorStart: [150, 150, 150],
    colorEnd: [180, 80, 20],
    hasBubbles: false,
    hasDeposit: true,
    depositColor: '#8B4513'
  },
  mno2_hcl: {
    name: 'MnO₂ + HCl (Gas Klorin)',
    equation: 'MnO₂(s) + 4HCl(aq) → MnCl₂(aq) + Cl₂(g)↑ + 2H₂O(l)',
    oxidation: { half: '2Cl⁻ → Cl₂ + 2e⁻', species: 'Cl', from: -1, to: 0, E: -1.36 },
    reduction: { half: 'MnO₂ + 4H⁺ + 2e⁻ → Mn²⁺ + 2H₂O', species: 'Mn', from: 4, to: 2, E: 1.23 },
    Ecell: 0.13,
    electrons: 2,
    observation: 'Gas kuning-hijau (Cl₂) keluar. BERACUN! Larutan berubah dari gelap ke jernih (Mn²⁺).',
    colorStart: [50, 50, 50],
    colorEnd: [200, 180, 200],
    hasBubbles: true,
    hasDeposit: false,
    depositColor: ''
  }
};

// ─── State ───
let currentReaction = reactions.zn_cu;
let progress = 0;
let isReacting = false;
let hasReacted = false;
let mode = 'sim';
let bubbles = [];

// ─── DOM ───
const canvas = document.getElementById('redox-canvas');
const simView = document.getElementById('sim-view');
const arView = document.getElementById('ar-view');
const ctrlReaction = document.getElementById('ctrl-reaction');
const btnReact = document.getElementById('btn-react');
const btnReset = document.getElementById('btn-reset');
const valOxidizer = document.getElementById('val-oxidizer');
const valReducer = document.getElementById('val-reducer');
const valEcell = document.getElementById('val-ecell');
const valProgress = document.getElementById('val-progress');
const dispEquation = document.getElementById('disp-equation');
const dispOxidation = document.getElementById('disp-oxidation');
const dispReduction = document.getElementById('disp-reduction');
const dispEox = document.getElementById('disp-eox');
const dispEred = document.getElementById('disp-ered');
const dispBiloks = document.getElementById('disp-biloks');
const dispEcell = document.getElementById('disp-ecell');
const dispSpontan = document.getElementById('disp-spontan');

// ─── Update UI ───
function updateUI() {
  const rx = currentReaction;
  dispEquation.textContent = rx.equation;
  dispOxidation.textContent = rx.oxidation.half;
  dispReduction.textContent = rx.reduction.half;
  dispEox.textContent = `E° = ${rx.oxidation.E > 0 ? '+' : ''}${rx.oxidation.E.toFixed(2)} V`;
  dispEred.textContent = `E° = ${rx.reduction.E > 0 ? '+' : ''}${rx.reduction.E.toFixed(2)} V`;
  dispBiloks.textContent = `${rx.oxidation.species}: ${rx.oxidation.from} → +${rx.oxidation.to} (oksidasi) | ${rx.reduction.species}: +${rx.reduction.from} → ${rx.reduction.to} (reduksi)`;
  dispEcell.textContent = `E° sel = ${rx.reduction.E.toFixed(2)} − (−${rx.oxidation.E.toFixed(2)}) = +${rx.Ecell.toFixed(2)} V`;
  dispSpontan.textContent = rx.Ecell > 0 ? '✓ Reaksi spontan (E° > 0)' : '✗ Tidak spontan (E° < 0)';
  dispSpontan.style.color = rx.Ecell > 0 ? 'var(--brand-secondary)' : 'var(--brand-danger)';

  valOxidizer.textContent = rx.reduction.species + (rx.reduction.from > 0 ? `${rx.reduction.from}⁺` : '');
  valReducer.textContent = rx.oxidation.species;
  valEcell.textContent = rx.Ecell.toFixed(2);
  valProgress.textContent = Math.round(progress) + '%';
}

// ─── Advance Reaction ───
function advanceReaction(amount) {
  if (hasReacted) return;
  isReacting = true;
  progress = Math.min(100, progress + amount);
  valProgress.textContent = Math.round(progress) + '%';

  if (progress >= 100) {
    hasReacted = true;
    isReacting = false;
    btnReact.textContent = '✓ Selesai';
    btnReact.disabled = true;
    window.showToast('Reaksi redoks selesai!', 'success');
  }
}

function resetExperiment() {
  progress = 0;
  isReacting = false;
  hasReacted = false;
  bubbles = [];
  btnReact.textContent = '⚡ Mulai Reaksi';
  btnReact.disabled = false;
  updateUI();
}

// ─── Canvas Renderer ───
const sim = new SimCanvas(canvas);

function lerpColor(c1, c2, t) {
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * t),
    Math.round(c1[1] + (c2[1] - c1[1]) * t),
    Math.round(c1[2] + (c2[2] - c1[2]) * t)
  ];
}

function drawRedox(ctx, w, h) {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() || '#f8fafc';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const rx = currentReaction;
  const p = progress / 100;
  const cx = w / 2;

  // Beaker
  const bLeft = cx - w * 0.25;
  const bRight = cx + w * 0.25;
  const bTop = h * 0.2;
  const bBottom = h * 0.8;
  const bW = bRight - bLeft;
  const bH = bBottom - bTop;

  // Glass beaker outline
  ctx.beginPath();
  ctx.moveTo(bLeft, bTop);
  ctx.lineTo(bLeft, bBottom);
  ctx.lineTo(bRight, bBottom);
  ctx.lineTo(bRight, bTop);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Liquid
  const liquidTop = bTop + bH * 0.15;
  const col = lerpColor(rx.colorStart, rx.colorEnd, p);
  ctx.fillStyle = `rgba(${col[0]}, ${col[1]}, ${col[2]}, 0.7)`;
  ctx.fillRect(bLeft + 2, liquidTop, bW - 4, bBottom - liquidTop - 2);

  // Metal piece (being oxidized)
  if (p < 1) {
    const metalW = 15 * (1 - p * 0.7);
    const metalH = 40 * (1 - p * 0.5);
    const metalX = bLeft + bW * 0.3;
    const metalY = liquidTop + 20;
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(metalX - metalW / 2, metalY, metalW, metalH);
    ctx.font = '8px sans-serif';
    ctx.fillStyle = '#4a5568';
    ctx.textAlign = 'center';
    ctx.fillText(rx.oxidation.species, metalX, metalY - 5);
  }

  // Deposit (reduced metal)
  if (rx.hasDeposit && p > 0.1) {
    const depSize = p * 25;
    const depX = bLeft + bW * 0.65;
    const depY = bBottom - 15;
    for (let i = 0; i < Math.floor(p * 8); i++) {
      const dx = depX + (Math.random() - 0.5) * depSize;
      const dy = depY - Math.random() * depSize * 0.5;
      ctx.beginPath();
      ctx.arc(dx, dy, 2 + Math.random() * 2, 0, Math.PI * 2);
      ctx.fillStyle = rx.depositColor;
      ctx.fill();
    }
  }

  // Bubbles
  if (rx.hasBubbles && p > 0.05 && p < 1) {
    if (Math.random() < 0.4) {
      bubbles.push({
        x: bLeft + 10 + Math.random() * (bW - 20),
        y: bBottom - 20,
        r: 1.5 + Math.random() * 3
      });
    }
    bubbles = bubbles.filter(b => { b.y -= 1.2; return b.y > liquidTop; });
    bubbles.forEach(b => {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fill();
    });
  }

  // Electron flow arrow
  if (p > 0 && p < 1) {
    const arrowY = bTop - 15;
    ctx.beginPath();
    ctx.moveTo(bLeft + bW * 0.25, arrowY);
    ctx.lineTo(bLeft + bW * 0.75, arrowY);
    ctx.strokeStyle = '#FFD600';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    // Arrow head
    ctx.beginPath();
    ctx.moveTo(bLeft + bW * 0.7, arrowY - 4);
    ctx.lineTo(bLeft + bW * 0.75, arrowY);
    ctx.lineTo(bLeft + bW * 0.7, arrowY + 4);
    ctx.fillStyle = '#FFD600';
    ctx.fill();
    ctx.font = '8px sans-serif';
    ctx.fillStyle = '#FFD600';
    ctx.textAlign = 'center';
    ctx.fillText(`${rx.electrons}e⁻`, cx, arrowY - 6);
  }

  // Labels
  ctx.font = '10px -apple-system, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'center';
  ctx.fillText(rx.equation, cx, h - 8);

  // Observation text
  if (p > 0.5) {
    ctx.font = '9px -apple-system, sans-serif';
    ctx.fillStyle = '#4a5568';
    ctx.textAlign = 'left';
    const obsLines = wrapText(ctx, rx.observation, w - 20);
    obsLines.forEach((line, i) => {
      ctx.fillText(line, 10, h * 0.85 + i * 12);
    });
  }
}

function wrapText(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  words.forEach(word => {
    const test = line + word + ' ';
    if (ctx.measureText(test).width > maxW) {
      lines.push(line.trim());
      line = word + ' ';
    } else {
      line = test;
    }
  });
  if (line.trim()) lines.push(line.trim());
  return lines.slice(0, 2); // max 2 lines
}

sim.setDrawFunction(drawRedox);
sim.start();

// ─── Controls ───
ctrlReaction.addEventListener('change', (e) => {
  currentReaction = reactions[e.target.value];
  resetExperiment();
});

btnReact.addEventListener('click', () => {
  if (!hasReacted) {
    const interval = setInterval(() => {
      advanceReaction(4);
      if (hasReacted) clearInterval(interval);
    }, 100);
  }
});

btnReset.addEventListener('click', resetExperiment);

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
      simView.classList.add('hidden');
      arView.classList.remove('hidden');
      document.body.classList.add('ar-active');
      arView.innerHTML = '<p style="padding:var(--space-6);text-align:center;color:var(--text-secondary)">Memuat AR...</p>';
      const loaded = await loadAR();
      if (loaded) {
        const col = currentReaction.colorStart;
        startARScene(arView, `<a-entity rotation="-60 0 0" scale="0.4 0.4 0.4"><a-cylinder position="0 0 0" radius="0.8" height="0.05" color="#e2e8f0"></a-cylinder><a-cylinder position="0 0.6 0" radius="0.5" height="1.2" color="#a5f3fc" material="transparent:true;opacity:0.25;side:double"></a-cylinder><a-cylinder position="0 0.4 0" radius="0.45" height="0.8" color="rgb(${col[0]},${col[1]},${col[2]})" material="transparent:true;opacity:0.7"></a-cylinder><a-box position="-0.2 0.3 0" width="0.12" height="0.5" depth="0.12" color="#94a3b8"></a-box></a-entity>`, {
          onMarkerFound: () => window.showToast('Marker terdeteksi! 🎉', 'success', 2000),
          onMarkerLost: () => {}
        });
        window.showToast('AR aktif! Arahkan ke marker Hiro.', 'info', 3000);
        window.showToast('AR aktif! Arahkan kamera ke marker Hiro.', 'info');
      } else { window.showToast('Gagal memuat AR.', 'error'); modeBtns[0].click(); }
    } else {
      destroyARScene();
      document.body.classList.remove('ar-active');
      arView.classList.add('hidden'); arView.innerHTML = '';
      simView.classList.remove('hidden'); sim.start();
    }
  });
});

// ─── Sensor: shake to react ───
async function initSensors() {
  const avail = await sensorManager.checkAvailability();
  if (avail.accelerometer) {
    sensorManager.detectShake(10, (data) => {
      if (!hasReacted) advanceReaction(data.intensity / 8 * 4);
    });
  }
}

// ─── Tutorial ───
showTutorial('redox', [
  { icon: '⚡', title: 'Reaksi Redoks', description: 'Redoks = Reduksi + Oksidasi. Satu zat melepas elektron (oksidasi), zat lain menerima (reduksi).' },
  { icon: '🔋', title: 'Potensial Sel (E°)', description: 'E° sel = E° katoda − E° anoda. Jika positif → reaksi spontan. Ini dasar baterai!' },
  { icon: '🧪', title: 'Pilih & Amati', description: 'Pilih reaksi, lalu goyangkan HP atau tekan tombol. Amati perubahan warna dan endapan!' },
  { icon: '📋', title: 'Catat & Analisis', description: 'Tentukan mana oksidator dan reduktor. Hitung E° sel dan tentukan spontanitas!' }
], initSensors);

// ─── LKS ───
initLKS({
  experimentId: 'redox',
  title: 'Reaksi Redoks',
  tujuan: 'Mengidentifikasi reaksi oksidasi dan reduksi, menentukan oksidator dan reduktor, serta menghitung potensial sel (E°).',
  questions: [
    'Pada reaksi Zn + Cu²⁺, zat mana yang berperan sebagai oksidator dan reduktor? Jelaskan!',
    'Hitung E° sel untuk reaksi Fe + Cu²⁺ → Fe²⁺ + Cu. Apakah reaksi ini spontan?',
    'Mengapa logam Na sangat reaktif dengan air? Kaitkan dengan nilai E° reduksinya!',
    'Jelaskan proses perkaratan besi (korosi) sebagai reaksi redoks. Apa yang teroksidasi dan tereduksi?'
  ],
  getDataFn: () => ({
    'Reaksi': currentReaction.name,
    'Persamaan': currentReaction.equation,
    'Oksidasi': currentReaction.oxidation.half,
    'Reduksi': currentReaction.reduction.half,
    'E° anoda (V)': currentReaction.oxidation.E.toFixed(2),
    'E° katoda (V)': currentReaction.reduction.E.toFixed(2),
    'E° sel (V)': currentReaction.Ecell.toFixed(2),
    'Spontan': currentReaction.Ecell > 0 ? 'Ya' : 'Tidak'
  })
});

// Init
updateUI();
