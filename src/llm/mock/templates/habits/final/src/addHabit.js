import { dayKey } from './store.js';

const ICONS = ['✅', '💧', '📚', '🏃', '🧘', '🥦', '💤', '✍️'];

export function mountForm(el, store) {
  el.innerHTML = `
    <form class="add">
      <select name="emoji" aria-label="Icon">${ICONS.map((e) => `<option>${e}</option>`).join('')}</select>
      <input name="habit" placeholder="New habit…" maxlength="40" autocomplete="off" aria-label="Habit name" />
      <button type="submit">Add</button>
    </form>
    <p class="summary"></p>`;

  const form = el.querySelector('form');
  const input = el.querySelector('input');
  const summary = el.querySelector('.summary');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    if (store.add(String(data.get('habit')), String(data.get('emoji')))) form.reset();
    input.focus();
  });

  const update = () => {
    const today = dayKey(new Date());
    const done = store.habits.filter((h) => h.done.has(today)).length;
    summary.textContent = `${done} of ${store.habits.length} habits done today`;
  };
  store.subscribe(update);
  update();
}
