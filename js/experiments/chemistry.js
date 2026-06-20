/**
 * PintAR Mobile — Chemistry Experiment
 * Simulates chemical reactions with color, pH, and temperature changes.
 */

import { sensorManager } from '../modules/sensors.js';
import { SimCanvas, loadAR, canRunAR, startARScene } from '../modules/ar-loader.js';
import { showTutorial } from '../modules/tutorial.js';
import { initLKS } from '../modules/lks.js';
import { showQuiz } from '../modules/quiz.js';

// ─── Reaction Data ───
const reactions = {
  neutralization: {
    name: 'Netralisasi',
    equation: 'NaOH + HCl → NaCl + H₂O',
    startColor: [148, 0, 211],   // purple (base)
    endColor: [0, 200, 0],       // green (neutral)
    startPh: 14, endPh: 7,
    tempChange: 5,   // exothermic
    hasBubbles: false, hasSteam: false
  },
  bakingSoda: {
    name: 'Gas CO₂',
    equation: 'CH₃COOH + NaHCO₃ → CH₃COONa + H₂O + CO₂↑',
    startColor: [255, 255, 0],   // yellow (acid)
    endColor: [240, 240, 240],   // white/cloudy
    startPh: 3, endPh: 8,
    tempChange: -4,  // endothermic
    hasBubbles: true, hasSteam: false
  },
  permanganate: {
    name: 'Oksidasi',
    equation: '2KMnO₄ + 3H₂O₂ → 2MnO₂ + 2KOH + 3O₂↑',
    startColor: [138, 43, 226],  // deep purple
    endColor: [139, 69, 19],     // brown
    startPh: 7, endPh: 7,
    tempChange: 40,  // highly exothermic
    hasBubbles: true, hasSteam: true
  }
};

// ─── State ───
let currentReaction = reactions.neutralization;
let progress = 0;  // 0–100
let isReacting = false;
let hasReacted = false;
let mode = 'sim';
let bubbles = []; // visual bubbles for canvas

// ─── DOM ───
const canvas = document.getElementById('chem-canvas');
const simView = document.getElementById('sim-view');
const arView = document.getElementById('ar-view');
const ctrlReaction = document.getElementById('ctrl-reaction');
const btnMix = document.getElementById('btn-mix');
const btnReset = document.getElementById('btn-reset');
const dispEquation = document.getElementById('disp-equation');
const valPh = document.getElementById('val-ph');
const valTemp = document.getElementById('val-temp');
const valProgress = document.getElementById('val-progress');
const phMarker = document.getElementById('ph-marker');


// ─── Canvas Renderer ───
const sim = new SimCanvas(canvas);

function lerpColor(c1, c2, t) {
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * t),
    Math.round(c1[1] + (c2[1] - c1[1]) * t),
    Math.round(c1[2] + (c2[2] - c1[2]) * t)
  ];
}

function drawChemistry(ctx, w, h) {
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim() || '#f8fafc';
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const flaskW = w * 0.35;
  const flaskH = h * 0.55;
  const flaskX = cx - flaskW / 2;
  const flaskY = h * 0.25;
  const neckW = flaskW * 0.4;
  const neckH = flaskH * 0.25;

  // Flask body
  ctx.beginPath();
  ctx.moveTo(cx - neckW / 2, flaskY);
  ctx.lineTo(cx - neckW / 2, flaskY + neckH);
  ctx.lineTo(flaskX, flaskY + neckH + flaskH * 0.2);
  ctx.lineTo(flaskX, flaskY + flaskH);
  ctx.lineTo(flaskX + flaskW, flaskY + flaskH);
  ctx.lineTo(flaskX + flaskW, flaskY + neckH + flaskH * 0.2);
  ctx.lineTo(cx + neckW / 2, flaskY + neckH);
  ctx.lineTo(cx + neckW / 2, flaskY);
  ctx.closePath();
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = 'rgba(200, 220, 240, 0.15)';
  ctx.fill();

  // Liquid
  const liquidTop = flaskY + neckH + flaskH * 0.25;
  const liquidH = flaskY + flaskH - liquidTop;
  const p = progress / 100;
  const col = lerpColor(currentReaction.startColor, currentReaction.endColor, p);
  ctx.fillStyle = `rgba(${col[0]}, ${col[1]}, ${col[2]}, 0.8)`;
  ctx.fillRect(flaskX + 4, liquidTop, flaskW - 8, liquidH - 4);

  // Bubbles
  if (currentReaction.hasBubbles && progress > 5 && progress < 100) {
    if (Math.random() < 0.3) {
      bubbles.push({ x: flaskX + 10 + Math.random() * (flaskW - 20), y: flaskY + flaskH - 10, r: 2 + Math.random() * 4 });
    }
    bubbles = bubbles.filter(b => { b.y -= 1.5; return b.y > liquidTop; });
    bubbles.forEach(b => {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fill();
    });
  }

  // Steam
  if (currentReaction.hasSteam && progress > 30) {
    for (let i = 0; i < 3; i++) {
      const sx = cx + (Math.random() - 0.5) * neckW;
      const sy = flaskY - 10 - Math.random() * 30;
      ctx.beginPath();
      ctx.arc(sx, sy, 4 + Math.random() * 6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,200,200,${0.3 - progress * 0.002})`;
      ctx.fill();
    }
  }

  // Labels
  ctx.font = '11px -apple-system, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'center';
  ctx.fillText(currentReaction.equation, cx, h - 15);
}

sim.setDrawFunction(drawChemistry);
sim.start();


// ─── Logic ───
function updateDisplay() {
  const p = progress / 100;
  const ph = currentReaction.startPh + (currentReaction.endPh - currentReaction.startPh) * p;
  const temp = 25 + currentReaction.tempChange * p;

  valPh.textContent = ph.toFixed(1);
  valTemp.textContent = temp.toFixed(0) + '°';
  valProgress.textContent = Math.round(progress) + '%';
  phMarker.style.left = ((ph / 14) * 100) + '%';

  // Color the pH value
  if (ph < 5) valPh.style.color = '#D32F2F';
  else if (ph < 8) valPh.style.color = '#2E7D32';
  else valPh.style.color = '#4A148C';
}

function advanceReaction(amount) {
  if (hasReacted) return;
  isReacting = true;
  progress = Math.min(100, progress + amount);

  if (progress >= 100) {
    hasReacted = true;
    isReacting = false;
    btnMix.textContent = '✓ Selesai';
    btnMix.disabled = true;
    window.showToast('Reaksi selesai!', 'success');
  }
  updateDisplay();
}

function resetExperiment() {
  progress = 0;
  isReacting = false;
  hasReacted = false;
  bubbles = [];
  btnMix.textContent = '🧪 Campurkan';
  btnMix.disabled = false;
  updateDisplay();
}

// ─── Controls ───
ctrlReaction.addEventListener('change', (e) => {
  currentReaction = reactions[e.target.value];
  dispEquation.textContent = currentReaction.equation;
  resetExperiment();
});

btnMix.addEventListener('click', () => {
  if (!hasReacted) {
    const interval = setInterval(() => {
      advanceReaction(5);
      if (hasReacted) clearInterval(interval);
    }, 100);
  }
});

btnReset.addEventListener('click', resetExperiment);

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
        const col = currentReaction.startColor;
        startARScene(arView, `
          <a-entity rotation="-60 0 0" scale="0.5 0.5 0.5">
            <a-cylinder position="0 0 0" radius="0.7" height="0.05" color="#334155"></a-cylinder>
            <a-cylinder position="0 0.6 0" radius="0.45" height="1.2" color="#a5f3fc" material="transparent:true;opacity:0.25;side:double"></a-cylinder>
            <a-cylinder position="0 0.45 0" radius="0.4" height="0.9" color="rgb(${col[0]},${col[1]},${col[2]})" material="transparent:true;opacity:0.75"></a-cylinder>
            <a-cylinder position="0 1.35 0" radius="0.22" height="0.5" color="#a5f3fc" material="transparent:true;opacity:0.2;side:double"></a-cylinder>
            <a-text value="${currentReaction.equation}" position="0 -0.3 0" align="center" color="#00C853" width="2.5" font="monoid"></a-text>
          </a-entity>
        `, {
          onMarkerFound: () => window.showToast('Marker terdeteksi! 🎉', 'success', 2000)
        });
        window.showToast('AR aktif! Arahkan ke marker.', 'info');
      } else { window.showToast('Gagal memuat AR.', 'error'); modeBtns[0].click(); }
    } else {
      arView.classList.add('hidden'); arView.innerHTML = '';
      simView.classList.remove('hidden'); sim.start();
    }
  });
});

// ─── Sensor: shake to mix ───
async function initSensors() {
  const avail = await sensorManager.checkAvailability();
  if (avail.accelerometer) {
    sensorManager.detectShake(10, (data) => {
      if (!hasReacted) {
        advanceReaction(data.intensity / 10 * 5);
      }
    });
  }
}

// ─── Tutorial ───
showTutorial('chemistry', [
  { icon: '⚗️', title: 'Reaksi Kimia', description: 'Di sini kamu akan mengamati reaksi kimia virtual. Lihat perubahan warna, pH, dan suhu!' },
  { icon: '🧪', title: 'Pilih Reaksi', description: 'Ada 3 jenis reaksi: netralisasi, penghasil gas, dan oksidasi. Masing-masing punya ciri khas.' },
  { icon: '📱', title: 'Goyangkan!', description: 'Goyangkan HP untuk mencampur bahan kimia, atau tekan tombol "Campurkan".' },
  { icon: '📋', title: 'Catat Hasil', description: 'Klik 📋 untuk isi LKS Digital dan kirim hasilnya ke guru.' }
], initSensors);

// ─── LKS ───
initLKS({
  experimentId: 'chemistry',
  title: 'Reaksi Kimia',
  tujuan: 'Mengamati perubahan yang terjadi pada reaksi kimia (warna, pH, suhu) dan mengidentifikasi jenis reaksi (eksotermik/endotermik).',
  questions: [
    'Sebutkan ciri-ciri terjadinya reaksi kimia yang kamu amati!',
    'Manakah reaksi yang bersifat eksotermik? Bagaimana kamu tahu dari data suhu?',
    'Mengapa pH berubah pada reaksi netralisasi? Jelaskan dengan teori asam-basa!'
  ],
  getDataFn: () => ({
    'Reaksi': currentReaction.name,
    'pH Awal': currentReaction.startPh.toFixed(1),
    'pH Akhir': valPh.textContent,
    'Suhu Akhir (°C)': valTemp.textContent,
    'Gelembung': currentReaction.hasBubbles ? 'Ya' : 'Tidak',
    'Progres': valProgress.textContent
  })
});

// Init
updateDisplay();



// ─── Quiz Button ───
const quizFab = document.createElement('button');
quizFab.className = 'quiz-fab';
quizFab.innerHTML = '📝 Quiz';
quizFab.addEventListener('click', () => {
  showQuiz({
    experimentId: 'chemistry',
    title: 'Quiz: Reaksi Kimia',
    questions: [
      {
        question: 'Reaksi NaOH + HCl → NaCl + H₂O termasuk reaksi...',
        options: ['Oksidasi', 'Reduksi', 'Netralisasi', 'Dekomposisi'],
        correct: 2,
        explanation: 'Reaksi antara asam (HCl) dan basa (NaOH) menghasilkan garam + air. Ini adalah reaksi netralisasi.'
      },
      {
        question: 'Ciri reaksi eksotermik adalah...',
        options: ['Suhu turun', 'Suhu naik', 'pH naik', 'Warna tidak berubah'],
        correct: 1,
        explanation: 'Reaksi eksotermik melepaskan kalor ke lingkungan sehingga suhu naik. Contoh: netralisasi asam-basa.'
      },
      {
        question: 'pH larutan netral adalah...',
        options: ['0', '5', '7', '14'],
        correct: 2,
        explanation: 'pH 7 = netral. pH < 7 = asam. pH > 7 = basa.'
      },
      {
        question: 'Gas yang dihasilkan dari reaksi cuka + baking soda adalah...',
        options: ['O₂', 'H₂', 'CO₂', 'N₂'],
        correct: 2,
        explanation: 'CH₃COOH + NaHCO₃ → CH₃COONa + H₂O + CO₂↑. Gas CO₂ keluar sebagai gelembung.'
      },
      {
        question: 'Indikator universal berubah warna hijau pada pH...',
        options: ['1-2 (sangat asam)', '5-6 (asam lemah)', '7 (netral)', '12-14 (basa kuat)'],
        correct: 2,
        explanation: 'Warna hijau pada indikator universal menunjukkan pH sekitar 7 (netral).'
      }
    ]
  });
});
document.body.appendChild(quizFab);
