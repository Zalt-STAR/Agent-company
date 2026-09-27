export const MODES = {
  work: { label: 'Focus', minutes: 25 },
  short: { label: 'Short break', minutes: 5 },
  long: { label: 'Long break', minutes: 15 },
};

export const FOCUS_BEFORE_LONG_BREAK = 4;

export function createTimer({ onComplete } = {}) {
  const listeners = new Set();
  const state = { mode: 'work', remaining: MODES.work.minutes * 60, running: false, completedFocus: 0 };
  let handle = null;

  const emit = () => listeners.forEach((fn) => fn(state));

  function setMode(mode) {
    state.mode = mode;
    state.remaining = MODES[mode].minutes * 60;
  }

  function nextMode() {
    if (state.mode !== 'work') return 'work';
    state.completedFocus += 1;
    return state.completedFocus % FOCUS_BEFORE_LONG_BREAK === 0 ? 'long' : 'short';
  }

  function tick() {
    state.remaining -= 1;
    if (state.remaining <= 0) {
      onComplete?.(state.mode);
      setMode(nextMode());
    }
    emit();
  }

  const api = {
    state,
    start() {
      if (state.running) return;
      state.running = true;
      handle = setInterval(tick, 1000);
      emit();
    },
    pause() {
      state.running = false;
      clearInterval(handle);
      handle = null;
      emit();
    },
    reset() {
      api.pause();
      setMode(state.mode);
      emit();
    },
    skip() {
      api.pause();
      setMode(state.mode === 'work' ? 'short' : 'work');
      emit();
    },
    select(mode) {
      api.pause();
      setMode(mode);
      emit();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  return api;
}
