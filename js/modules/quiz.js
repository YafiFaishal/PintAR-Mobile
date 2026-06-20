/**
 * PintAR Mobile — Quiz Module
 * Stores quiz results locally on student's phone (localStorage).
 * Each experiment has its own quiz with scoring & history.
 */

const QUIZ_STORAGE_KEY = 'pintar_quiz_v1';

// ─── Storage ───
function loadQuizData() {
  try { return JSON.parse(localStorage.getItem(QUIZ_STORAGE_KEY)) || {}; }
  catch { return {}; }
}

function saveQuizData(data) {
  localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(data));
}

/**
 * Get quiz history for an experiment
 */
export function getQuizHistory(experimentId) {
  const data = loadQuizData();
  return data[experimentId] || [];
}

/**
 * Get best score for an experiment
 */
export function getBestScore(experimentId) {
  const history = getQuizHistory(experimentId);
  if (!history.length) return null;
  return Math.max(...history.map(h => h.score));
}

/**
 * Save a quiz attempt
 */
function saveAttempt(experimentId, attempt) {
  const data = loadQuizData();
  if (!data[experimentId]) data[experimentId] = [];
  data[experimentId].push(attempt);
  // Keep max 20 attempts per experiment
  if (data[experimentId].length > 20) {
    data[experimentId] = data[experimentId].slice(-20);
  }
  saveQuizData(data);
}

/**
 * Get all quiz stats (for profile/summary)
 */
export function getAllStats() {
  const data = loadQuizData();
  const stats = {};
  Object.keys(data).forEach(expId => {
    const attempts = data[expId];
    stats[expId] = {
      totalAttempts: attempts.length,
      bestScore: Math.max(...attempts.map(a => a.score)),
      lastAttempt: attempts[attempts.length - 1]
    };
  });
  return stats;
}

/**
 * Initialize and show quiz for an experiment.
 * 
 * @param {object} config
 * @param {string} config.experimentId
 * @param {string} config.title
 * @param {Array} config.questions - [{ question, options: [A,B,C,D], correct: 0-3, explanation }]
 */
export function showQuiz(config) {
  const { experimentId, title, questions } = config;
  let currentQ = 0;
  let answers = [];
  let score = 0;

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'quiz-overlay';
  overlay.id = 'quiz-overlay';

  function renderQuestion() {
    const q = questions[currentQ];
    const progress = `${currentQ + 1}/${questions.length}`;

    overlay.innerHTML = `
      <div class="quiz-card">
        <div class="quiz-header">
          <span class="quiz-progress">${progress}</span>
          <h3 class="quiz-title">${title}</h3>
          <button class="quiz-close" id="quiz-close-btn">✕</button>
        </div>
        <div class="quiz-body">
          <p class="quiz-question">${q.question}</p>
          <div class="quiz-options">
            ${q.options.map((opt, i) => `
              <button class="quiz-option" data-idx="${i}">
                <span class="quiz-option-letter">${String.fromCharCode(65 + i)}</span>
                <span class="quiz-option-text">${opt}</span>
              </button>
            `).join('')}
          </div>
        </div>
        <div class="quiz-footer">
          <div class="quiz-progress-bar">
            <div class="quiz-progress-fill" style="width:${((currentQ) / questions.length) * 100}%"></div>
          </div>
        </div>
      </div>
    `;

    // Close button
    overlay.querySelector('#quiz-close-btn').addEventListener('click', () => {
      overlay.remove();
    });

    // Option click handlers
    overlay.querySelectorAll('.quiz-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        const isCorrect = idx === q.correct;

        // Disable all options
        overlay.querySelectorAll('.quiz-option').forEach(b => {
          b.style.pointerEvents = 'none';
        });

        // Show correct/wrong
        if (isCorrect) {
          btn.classList.add('correct');
          score++;
        } else {
          btn.classList.add('wrong');
          // Highlight correct answer
          overlay.querySelector(`.quiz-option[data-idx="${q.correct}"]`).classList.add('correct');
        }

        // Show explanation
        const explDiv = document.createElement('div');
        explDiv.className = 'quiz-explanation';
        explDiv.innerHTML = `
          <p class="${isCorrect ? 'correct-text' : 'wrong-text'}">
            ${isCorrect ? '✓ Benar!' : '✗ Salah!'}
          </p>
          <p class="explanation-text">${q.explanation || ''}</p>
        `;
        overlay.querySelector('.quiz-body').appendChild(explDiv);

        // Next button
        const nextBtn = document.createElement('button');
        nextBtn.className = 'btn btn-primary btn-block quiz-next-btn';
        nextBtn.textContent = currentQ < questions.length - 1 ? 'Soal Berikutnya →' : 'Lihat Hasil';
        nextBtn.style.marginTop = 'var(--space-4)';
        overlay.querySelector('.quiz-body').appendChild(nextBtn);

        nextBtn.addEventListener('click', () => {
          answers.push({ questionIdx: currentQ, selected: idx, correct: isCorrect });
          currentQ++;
          if (currentQ < questions.length) {
            renderQuestion();
          } else {
            renderResult();
          }
        });
      });
    });
  }

  function renderResult() {
    const percentage = Math.round((score / questions.length) * 100);
    let grade, emoji, message;

    if (percentage >= 80) { grade = 'A'; emoji = '🏆'; message = 'Luar biasa! Kamu menguasai materi ini!'; }
    else if (percentage >= 60) { grade = 'B'; emoji = '👍'; message = 'Bagus! Tinggal sedikit lagi untuk sempurna.'; }
    else if (percentage >= 40) { grade = 'C'; emoji = '📖'; message = 'Lumayan, coba ulangi eksperimen dan baca penjelasannya.'; }
    else { grade = 'D'; emoji = '💪'; message = 'Jangan menyerah! Coba lakukan eksperimen lagi dan perhatikan hasilnya.'; }

    // Save to localStorage
    const attempt = {
      date: new Date().toISOString(),
      score: percentage,
      correct: score,
      total: questions.length,
      grade: grade
    };
    saveAttempt(experimentId, attempt);

    // Get history
    const history = getQuizHistory(experimentId);
    const bestScore = Math.max(...history.map(h => h.score));

    overlay.innerHTML = `
      <div class="quiz-card">
        <div class="quiz-header">
          <span class="quiz-progress">Hasil</span>
          <h3 class="quiz-title">${title}</h3>
          <button class="quiz-close" id="quiz-close-btn">✕</button>
        </div>
        <div class="quiz-body" style="text-align:center">
          <div class="quiz-result-emoji">${emoji}</div>
          <div class="quiz-result-score">${score}/${questions.length}</div>
          <div class="quiz-result-percentage">${percentage}%</div>
          <div class="quiz-result-grade">Nilai: ${grade}</div>
          <p class="quiz-result-message">${message}</p>
          
          <div class="quiz-stats">
            <div class="quiz-stat">
              <span class="quiz-stat-value">${history.length}</span>
              <span class="quiz-stat-label">Percobaan</span>
            </div>
            <div class="quiz-stat">
              <span class="quiz-stat-value">${bestScore}%</span>
              <span class="quiz-stat-label">Skor Terbaik</span>
            </div>
          </div>

          <button class="btn btn-primary btn-block" id="quiz-retry-btn" style="margin-top:var(--space-4)">🔄 Coba Lagi</button>
          <button class="btn btn-secondary btn-block" id="quiz-done-btn" style="margin-top:var(--space-2)">✓ Selesai</button>
        </div>
      </div>
    `;

    overlay.querySelector('#quiz-close-btn').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#quiz-done-btn').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#quiz-retry-btn').addEventListener('click', () => {
      currentQ = 0;
      answers = [];
      score = 0;
      renderQuestion();
    });

    window.showToast && window.showToast(`Quiz selesai! Skor: ${percentage}% (${grade})`, percentage >= 60 ? 'success' : 'info');
  }

  renderQuestion();
  document.body.appendChild(overlay);
}
