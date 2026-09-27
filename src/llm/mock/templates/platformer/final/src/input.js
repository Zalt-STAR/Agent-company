const KEYS = {
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
  ArrowUp: 'jump', w: 'jump', W: 'jump', ' ': 'jump',
};

export function createInput() {
  const state = { left: false, right: false, jump: false };
  const set = (e, down) => {
    const k = KEYS[e.key];
    if (!k) return;
    e.preventDefault();
    state[k] = down;
  };
  window.addEventListener('keydown', (e) => set(e, true));
  window.addEventListener('keyup', (e) => set(e, false));
  window.addEventListener('blur', () => {
    state.left = state.right = state.jump = false;
  });
  return { state };
}
