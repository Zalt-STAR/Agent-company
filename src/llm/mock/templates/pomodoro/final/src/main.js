import { createTimer } from './timer.js';
import { mountUI } from './ui.js';
import { createStats } from './stats.js';

const root = document.getElementById('app');
const stats = createStats();
const timer = createTimer({
  onComplete(mode) {
    stats.record(mode);
  },
});

const ui = mountUI(root, timer, stats);
timer.subscribe(() => ui.update());
ui.update();
