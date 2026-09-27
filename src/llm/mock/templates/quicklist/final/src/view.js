const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function mountView(root, items) {
  let filter = 'all';
  root.innerHTML = `
    <form class="entry">
      <input type="text" placeholder="Add an item…" aria-label="New item" maxlength="80" />
      <button class="add" type="submit">Add</button>
    </form>
    <div class="filters">
      <button data-filter="all">All</button><button data-filter="open">Open</button><button data-filter="done">Done</button>
    </div>
    <ul></ul>
    <div class="footer"><span class="count"></span><button class="clear">Clear done</button></div>`;

  const form = root.querySelector('form');
  const input = root.querySelector('input');
  const list = root.querySelector('ul');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (items.add(input.value)) input.value = '';
    input.focus();
  });
  root.addEventListener('click', (e) => {
    const f = e.target.dataset.filter;
    if (f) {
      filter = f;
      render();
      return;
    }
    if (e.target.matches('.clear')) items.clearDone();
    const li = e.target.closest('li[data-id]');
    if (!li) return;
    const id = Number(li.dataset.id);
    if (e.target.matches('.del')) items.remove(id);
    else if (e.target.matches('input[type="checkbox"]')) items.toggle(id);
  });

  function render() {
    const visible = items.list(filter);
    list.innerHTML = visible.length
      ? visible
          .map(
            (i) => `<li data-id="${i.id}" class="${i.done ? 'done' : ''}">
              <input type="checkbox" ${i.done ? 'checked' : ''} aria-label="Toggle ${esc(i.text)}" />
              <span>${esc(i.text)}</span><button class="del" aria-label="Delete">×</button></li>`,
          )
          .join('')
      : '<li class="empty">Nothing here yet.</li>';
    root.querySelectorAll('[data-filter]').forEach((b) => b.classList.toggle('active', b.dataset.filter === filter));
    root.querySelector('.count').textContent = `${items.openCount} open`;
  }

  return { render };
}
