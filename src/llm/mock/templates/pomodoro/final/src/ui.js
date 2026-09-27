import { MODES } from './timer.js';

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function mountUI(root, timer, stats) {
  root.innerHTML = `
    <section class="card">
      <nav class="tabs" role="tablist">
        ${Object.entries(MODES)
          .map(([id, m]) => `<button class="tab" data-mode="${id}" role="tab">${m.label}</button>`)
          .join('')}
      </nav>
      <div class="dial">
        <svg viewBox="0 0 120 120" class="ring" aria-hidden="true">
          <circle cx="60" cy="60" r="${RADIUS}" class="track" />
          <circle cx="60" cy="60" r="${RADIUS}" class="progress" />
        </svg>
        <div class="time" aria-live="polite"></div>
      </div>
      <div class="controls">
        <button class="primary" data-action="toggle">Start</button>
        <button data-action="reset">Reset</button>
        <button data-action="skip">Skip</button>
      </div>
      <footer class="stats"></footer>
    </section>`;

  const timeEl = root.querySelector('.time');
  const toggleBtn = root.querySelector('[data-action="toggle"]');
  const progress = root.querySelector('.progress');
  const statsEl = root.querySelector('.stats');
  progress.style.strokeDasharray = String(CIRCUMFERENCE);

  const toggle = () => (timer.state.running ? timer.pause() : timer.start());

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.mode) timer.select(btn.dataset.mode);
    else if (btn.dataset.action === 'toggle') toggle();
    else if (btn.dataset.action === 'reset') timer.reset();
    else if (btn.dataset.action === 'skip') timer.skip();
  });

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault();
      toggle();
    }
  });

  function update() {
    const { mode, remaining, running } = timer.state;
    const total = MODES[mode].minutes * 60;
    timeEl.textContent = formatTime(remaining);
    document.title = `${formatTime(remaining)} · ${MODES[mode].label}`;
    toggleBtn.textContent = running ? 'Pause' : 'Start';
    progress.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - remaining / total));
    root.dataset.mode = mode;
    root.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.mode === mode));
    const s = stats.summary();
    statsEl.textContent = `${s.focusSessions} focus session${s.focusSessions === 1 ? '' : 's'} · ${s.focusMinutes} min focused`;
  }

  return { update };
}
