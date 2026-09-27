const KEYS = {
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
};
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
const MAX_QUEUE = 3;

export function createInput(target) {
  let queue = [];

  window.addEventListener('keydown', (e) => {
    const dir = KEYS[e.key];
    if (!dir) return;
    e.preventDefault();
    if (queue.length < MAX_QUEUE) queue.push(dir);
  });

  // Swipe support for touch screens.
  let start = null;
  target.addEventListener('pointerdown', (e) => {
    start = { x: e.clientX, y: e.clientY };
  });
  target.addEventListener('pointerup', (e) => {
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    start = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
    queue.push(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
  });

  return {
    next(current) {
      while (queue.length) {
        const d = queue.shift();
        if (d !== current && d !== OPPOSITE[current]) return d;
      }
      return current;
    },
    reset() {
      queue = [];
    },
  };
}
