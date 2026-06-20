/**
 * PintAR Mobile — LKS Digital (Lembar Kerja Siswa)
 * Slide-in panel for student worksheet with Web Share API support.
 */

const STORAGE_KEY = 'pintar_lks_v2';

function loadAll() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}

function saveEntry(expId, data) {
  const all = loadAll();
  if (!all[expId]) all[expId] = [];
  all[expId].push({ ...data, timestamp: Date.now() });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

/**
 * Initialize LKS for an experiment
 */
export function initLKS(config) {
  /*
    config = {
      experimentId: string,
      title: string,
      tujuan: string,
      questions: string[],
      getDataFn: () => object
    }
  */
  const capturedRows = [];

  // Create panel DOM
  const panel = createPanel(config);
  document.body.appendChild(panel);

  // Create FAB
  const fab = document.createElement('button');
  fab.className = 'lks-fab';
  fab.setAttribute('aria-label', 'Buka Lembar Kerja Siswa');
  fab.textContent = '📋';
  fab.addEventListener('click', () => panel.classList.add('open'));
  document.body.appendChild(fab);

  // Close button
  panel.querySelector('.lks-close').addEventListener('click', () => {
    panel.classList.remove('open');
  });

  // Capture data
  panel.querySelector('.lks-capture-btn').addEventListener('click', () => {
    if (config.getDataFn) {
      const data = config.getDataFn();
      if (data) {
        capturedRows.push(data);
        renderTable(panel.querySelector('.lks-table-wrap'), capturedRows);
        window.showToast && window.showToast('Data berhasil diambil!', 'success');
      }
    }
  });


  // Save
  panel.querySelector('.lks-save-btn').addEventListener('click', () => {
    const data = collectFormData(panel, config, capturedRows);
    saveEntry(config.experimentId, data);
    window.showToast && window.showToast('LKS berhasil disimpan!', 'success');
  });

  // Share (Web Share API / fallback to download)
  panel.querySelector('.lks-share-btn').addEventListener('click', () => {
    const data = collectFormData(panel, config, capturedRows);
    const text = formatLKSText(config, data, capturedRows);
    shareOrDownload(config, text);
  });
}

function collectFormData(panel, config, rows) {
  const v = (id) => { const el = panel.querySelector(`#${id}`); return el ? el.value.trim() : ''; };
  return {
    nama: v('lks-nama'),
    kelas: v('lks-kelas'),
    tanggal: v('lks-tanggal'),
    hipotesis: v('lks-hipotesis'),
    pengamatan: v('lks-pengamatan'),
    kesimpulan: v('lks-kesimpulan'),
    answers: config.questions ? config.questions.map((_, i) => v(`lks-qa-${i}`)) : [],
    dataRows: rows
  };
}

function formatLKSText(config, data, rows) {
  let txt = `LEMBAR KERJA SISWA — PintAR\n`;
  txt += `═══════════════════════════\n\n`;
  txt += `Eksperimen: ${config.title}\n`;
  txt += `Nama: ${data.nama || '—'}\n`;
  txt += `Kelas: ${data.kelas || '—'}\n`;
  txt += `Tanggal: ${data.tanggal || new Date().toLocaleDateString('id-ID')}\n\n`;
  txt += `TUJUAN:\n${config.tujuan}\n\n`;
  txt += `HIPOTESIS:\n${data.hipotesis || '—'}\n\n`;
  txt += `DATA PENGUKURAN:\n`;
  if (rows.length) {
    const cols = Object.keys(rows[0]);
    txt += cols.join(' | ') + '\n';
    txt += '-'.repeat(40) + '\n';
    rows.forEach((r) => { txt += cols.map(c => r[c]).join(' | ') + '\n'; });
  } else { txt += '(Belum ada data)\n'; }
  txt += `\nPENGAMATAN:\n${data.pengamatan || '—'}\n\n`;
  txt += `KESIMPULAN:\n${data.kesimpulan || '—'}\n`;
  if (config.questions && config.questions.length) {
    txt += `\nPERTANYAAN ANALISIS:\n`;
    config.questions.forEach((q, i) => {
      txt += `${i + 1}. ${q}\n   Jawaban: ${data.answers[i] || '—'}\n`;
    });
  }
  txt += `\n— PintAR ${new Date().toLocaleString('id-ID')} —\n`;
  return txt;
}


async function shareOrDownload(config, text) {
  // Try Web Share API first (most phones have this)
  if (navigator.share) {
    try {
      await navigator.share({
        title: `LKS ${config.title} — PintAR`,
        text: text
      });
      window.showToast && window.showToast('Berhasil dibagikan!', 'success');
      return;
    } catch (e) {
      if (e.name === 'AbortError') return; // User cancelled
    }
  }
  // Fallback: download as .txt
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `LKS_${config.experimentId}_${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  window.showToast && window.showToast('File diunduh!', 'info');
}

function renderTable(wrap, rows) {
  if (!rows.length) { wrap.innerHTML = '<p style="font-size:0.8rem;color:var(--text-muted)">Belum ada data.</p>'; return; }
  const cols = Object.keys(rows[0]);
  let html = '<table style="width:100%;font-size:0.75rem;border-collapse:collapse;"><thead><tr>';
  html += '<th style="padding:4px;border-bottom:1px solid var(--border-light);text-align:left">#</th>';
  cols.forEach(c => { html += `<th style="padding:4px;border-bottom:1px solid var(--border-light);text-align:left">${c}</th>`; });
  html += '</tr></thead><tbody>';
  rows.forEach((r, i) => {
    html += `<tr><td style="padding:4px">${i + 1}</td>`;
    cols.forEach(c => { html += `<td style="padding:4px;font-family:var(--font-mono);color:var(--brand-primary)">${r[c]}</td>`; });
    html += '</tr>';
  });
  html += '</tbody></table>';
  wrap.innerHTML = html;
}


function createPanel(config) {
  const el = document.createElement('div');
  el.className = 'lks-panel';
  el.id = 'lks-panel';

  let questionsHTML = '';
  if (config.questions && config.questions.length) {
    questionsHTML = `<div class="lks-section"><div class="lks-section-title">Pertanyaan Analisis</div>`;
    config.questions.forEach((q, i) => {
      questionsHTML += `
        <div class="form-group">
          <label class="form-label">${i + 1}. ${esc(q)}</label>
          <textarea class="form-textarea" id="lks-qa-${i}" rows="2" placeholder="Jawaban..."></textarea>
        </div>`;
    });
    questionsHTML += '</div>';
  }

  el.innerHTML = `
    <div class="lks-panel-header">
      <h3 style="font-size:var(--fs-base);font-weight:700">📋 LKS — ${esc(config.title)}</h3>
      <button class="btn btn-sm btn-secondary lks-close">✕</button>
    </div>
    <div class="lks-panel-body">
      <div class="lks-section">
        <div class="lks-section-title">Identitas Siswa</div>
        <div class="form-group">
          <label class="form-label">Nama Lengkap</label>
          <input class="form-input" id="lks-nama" type="text" placeholder="Nama kamu...">
        </div>
        <div class="form-group">
          <label class="form-label">Kelas / Kelompok</label>
          <input class="form-input" id="lks-kelas" type="text" placeholder="Contoh: 9A / Kel. 3">
        </div>
        <div class="form-group">
          <label class="form-label">Tanggal</label>
          <input class="form-input" id="lks-tanggal" type="date">
        </div>
      </div>
      <div class="lks-section">
        <div class="lks-section-title">Tujuan Percobaan</div>
        <p style="font-size:var(--fs-sm);color:var(--text-secondary);line-height:1.6">${esc(config.tujuan)}</p>
      </div>
      <div class="lks-section">
        <div class="lks-section-title">Hipotesis Awal</div>
        <div class="form-group">
          <textarea class="form-textarea" id="lks-hipotesis" placeholder="Apa prediksimu sebelum eksperimen?"></textarea>
        </div>
      </div>
      <div class="lks-section">
        <div class="lks-section-title">Data Pengukuran</div>
        <div class="lks-table-wrap"></div>
        <button class="btn btn-sm btn-secondary btn-block mt-3 lks-capture-btn">📸 Ambil Data dari Simulasi</button>
      </div>
      <div class="lks-section">
        <div class="lks-section-title">Hasil Pengamatan</div>
        <div class="form-group">
          <textarea class="form-textarea" id="lks-pengamatan" placeholder="Apa yang kamu amati?"></textarea>
        </div>
      </div>
      <div class="lks-section">
        <div class="lks-section-title">Kesimpulan</div>
        <div class="form-group">
          <textarea class="form-textarea" id="lks-kesimpulan" placeholder="Kesimpulan dari eksperimen ini..."></textarea>
        </div>
      </div>
      ${questionsHTML}
    </div>
    <div class="lks-panel-footer">
      <button class="btn btn-secondary lks-save-btn">💾 Simpan</button>
      <button class="btn btn-primary lks-share-btn">📤 Kirim/Share</button>
    </div>
  `;
  return el;
}

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
