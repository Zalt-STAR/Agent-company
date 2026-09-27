let nextId = 1;

export const FILTERS = {
  all: () => true,
  open: (i) => !i.done,
  done: (i) => i.done,
};

export function createItems() {
  let items = [];
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => fn());

  return {
    list(filter = 'all') {
      return items.filter(FILTERS[filter]);
    },
    get openCount() {
      return items.filter((i) => !i.done).length;
    },
    add(text) {
      const clean = text.trim().slice(0, 80);
      if (!clean) return false;
      items = [...items, { id: nextId++, text: clean, done: false }];
      emit();
      return true;
    },
    toggle(id) {
      items = items.map((i) => (i.id === id ? { ...i, done: !i.done } : i));
      emit();
    },
    remove(id) {
      items = items.filter((i) => i.id !== id);
      emit();
    },
    clearDone() {
      items = items.filter((i) => !i.done);
      emit();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
