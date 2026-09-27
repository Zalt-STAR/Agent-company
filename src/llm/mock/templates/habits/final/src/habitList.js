import { dayKey, lastDays } from './store.js';

const WEEKDAY = new Intl.DateTimeFormat(undefined, { weekday: 'narrow' });

export function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function mountList(el, store) {
  el.addEventListener('click', (e) => {
    const row = e.target.closest('.row[data-id]');
    if (!row) return;
    const id = Number(row.dataset.id);
    if (e.target.matches('.cell')) store.toggle(id, e.target.dataset.day);
    else if (e.target.matches('.remove')) store.remove(id);
  });

  function render() {
    if (!store.habits.length) {
      el.innerHTML = '<p class="empty">No habits yet — add one below.</p>';
      return;
    }
    const days = lastDays(7);
    el.innerHTML = `
      <div class="row head">
        <span></span>${days.map((d) => `<span>${WEEKDAY.format(d)}</span>`).join('')}<span>🔥</span><span></span>
      </div>
      ${store.habits
        .map(
          (h) => `
        <div class="row" data-id="${h.id}">
          <span class="name">${h.emoji} ${escapeHtml(h.name)}</span>
          ${days
            .map((d) => {
              const k = dayKey(d);
              return `<button class="cell ${h.done.has(k) ? 'on' : ''}" data-day="${k}" aria-label="${escapeHtml(h.name)} on ${k}"></button>`;
            })
            .join('')}
          <span class="streak">${store.streak(h.id)}</span>
          <button class="remove" aria-label="Remove ${escapeHtml(h.name)}">×</button>
        </div>`,
        )
        .join('')}`;
  }

  return { render };
}
