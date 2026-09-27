import { TITLE, SURVIVE_SECONDS, COLORS } from './config.js';
import { createPlayer, updatePlayer } from './player.js';
import { createHazards } from './hazards.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const timeEl = document.getElementById('time');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayText = document.getElementById('overlay-text');
const actionBtn = document.getElementById('overlay-action');
document.title = TITLE;
document.getElementById('title').textContent = TITLE;
document.getElementById('goal').textContent = SURVIVE_SECONDS;

const keys = { left: false, right: false };
const KEYMAP = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
let player;
let hazards;
let status = 'ready';
let time = 0;
let last = 0;

function reset() {
  player = createPlayer(canvas.width, canvas.height);
  hazards = createHazards(canvas.width, canvas.height);
  time = 0;
}

function showOverlay(title, text, action) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  actionBtn.textContent = action;
  overlay.hidden = false;
}

function start() {
  if (status !== 'ready') reset();
  status = 'playing';
  overlay.hidden = true;
}

function draw() {
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  hazards.draw(ctx);
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.roundRect(player.x, player.y, player.w, player.h, 8);
  ctx.fill();
}

function frame(t) {
  const dt = Math.min(1 / 30, (t - last) / 1000);
  last = t;
  if (status === 'playing') {
    time += dt;
    updatePlayer(player, keys, dt, canvas.width);
    hazards.update(dt, time);
    timeEl.textContent = Math.min(time, SURVIVE_SECONDS).toFixed(1);
    if (hazards.hits(player)) {
      status = 'over';
      showOverlay('Hit! 💥', `You lasted ${time.toFixed(1)}s. Press Enter to retry.`, 'Try again');
    } else if (time >= SURVIVE_SECONDS) {
      status = 'won';
      showOverlay('You survived! 🎉', `${SURVIVE_SECONDS} seconds without a scratch.`, 'Play again');
    }
  }
  draw();
  requestAnimationFrame(frame);
}

window.addEventListener('keydown', (e) => {
  if (KEYMAP[e.key]) keys[KEYMAP[e.key]] = true;
  if (e.key === 'Enter' && status !== 'playing') start();
});
window.addEventListener('keyup', (e) => {
  if (KEYMAP[e.key]) keys[KEYMAP[e.key]] = false;
});
actionBtn.addEventListener('click', start);

reset();
showOverlay(TITLE, `Dodge the falling blocks for ${SURVIVE_SECONDS} seconds.`, 'Play');
draw();
requestAnimationFrame((t) => {
  last = t;
  frame(t);
});
