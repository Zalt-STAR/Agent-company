export function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function lastDays(n, today = new Date()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    out.push(d);
  }
  return out;
}

let nextId = 1;

export function createStore(seed = []) {
  const listeners = new Set();
  let habits = seed.map((h) => ({ id: nextId++, name: h.name, emoji: h.emoji ?? '✅', done: new Set() }));
  const emit = () => listeners.forEach((fn) => fn());

  return {
    get habits() {
      return habits;
    },
    add(name, emoji) {
      const clean = name.trim().slice(0, 40);
      if (!clean) return false;
      habits = [...habits, { id: nextId++, name: clean, emoji: emoji || '✅', done: new Set() }];
      emit();
      return true;
    },
    remove(id) {
      habits = habits.filter((h) => h.id !== id);
      emit();
    },
    toggle(id, key) {
      const h = habits.find((x) => x.id === id);
      if (!h) return;
      if (h.done.has(key)) h.done.delete(key);
      else h.done.add(key);
      emit();
    },
    /** Consecutive days done, ending today (or yesterday if today isn't done yet). */
    streak(id, today = new Date()) {
      const h = habits.find((x) => x.id === id);
      if (!h) return 0;
      const d = new Date(today);
      if (!h.done.has(dayKey(d))) d.setDate(d.getDate() - 1);
      let n = 0;
      while (h.done.has(dayKey(d))) {
        n += 1;
        d.setDate(d.getDate() - 1);
      }
      return n;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
