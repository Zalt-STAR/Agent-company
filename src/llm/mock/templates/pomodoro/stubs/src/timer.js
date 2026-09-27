// Stub: replaced by the timer engine ticket.
export const MODES = { work: { label: 'Focus', minutes: 25 } };

export function createTimer() {
  const state = { mode: 'work', remaining: 25 * 60, running: false, completedFocus: 0 };
  const noop = () => {};
  return { state, start: noop, pause: noop, reset: noop, skip: noop, select: noop, subscribe: noop };
}
