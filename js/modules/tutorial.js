/**
 * PintAR Mobile — Tutorial/Onboarding System
 * Step-by-step guided overlay for first-time users.
 */

const SEEN_KEY = 'pintar_tutorial_seen';

function getSeen() {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY)) || {}; }
  catch { return {}; }
}

function markSeen(id) {
  const seen = getSeen();
  seen[id] = true;
  localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
}

/**
 * Show a tutorial if not seen before.
 * @param {string} id - unique tutorial ID
 * @param {Array} steps - [{ icon, title, description }]
 * @param {Function} onComplete - called when tutorial finishes
 */
export function showTutorial(id, steps, onComplete) {
  const seen = getSeen();
  if (seen[id]) { onComplete && onComplete(); return; }

  let current = 0;
  const overlay = document.createElement('div');
  overlay.className = 'tutorial-overlay';

  function render() {
    const step = steps[current];
    const isLast = current === steps.length - 1;
    overlay.innerHTML = `
      <div class="tutorial-card">
        <div class="step-icon">${step.icon}</div>
        <h3>${step.title}</h3>
        <p>${step.description}</p>
        <div class="tutorial-dots">
          ${steps.map((_, i) => `<div class="dot ${i === current ? 'active' : ''}"></div>`).join('')}
        </div>
        <button class="btn btn-primary btn-block tutorial-next">
          ${isLast ? 'Mulai Eksperimen!' : 'Lanjut →'}
        </button>
        <button class="btn btn-sm tutorial-skip" style="margin-top:var(--space-3);background:none;color:var(--text-muted);font-size:var(--fs-xs)">
          Lewati tutorial
        </button>
      </div>
    `;

    overlay.querySelector('.tutorial-next').addEventListener('click', () => {
      if (isLast) { finish(); } else { current++; render(); }
    });

    overlay.querySelector('.tutorial-skip').addEventListener('click', finish);
  }

  function finish() {
    markSeen(id);
    overlay.remove();
    onComplete && onComplete();
  }

  render();
  document.body.appendChild(overlay);
}

/** Reset tutorials (for debugging) */
export function resetTutorials() {
  localStorage.removeItem(SEEN_KEY);
}
