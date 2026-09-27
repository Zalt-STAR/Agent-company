import { loadLevel } from './level.js';
import { createPlayer, updatePlayer } from './player.js';
import { createInput } from './input.js';
import { createRenderer } from './render.js';
import { checkEntities } from './entities.js';

const canvas = document.getElementById('game');
const coinsEl = document.getElementById('coins');
const timeEl = document.getElementById('time');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayText = document.getElementById('overlay-text');
const actionBtn = document.getElementById('overlay-action');

const IDLE = { left: false, right: false, jump: false };
const input = createInput();
const renderer = createRenderer(canvas);
let world;
let player;
let status = 'ready';
let time = 0;
let last = 0;

function showOverlay(title, text, action) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  actionBtn.textContent = action;
  overlay.hidden = false;
}

function updateHud() {
  coinsEl.textContent = `${world.collected}/${world.coinsTotal}`;
  timeEl.textContent = time.toFixed(1);
}

function reset() {
  world = loadLevel();
  player = createPlayer(world.spawn);
  time = 0;
  // Settle the player onto the ground before the first frame.
  for (let i = 0; i < 30; i++) updatePlayer(player, IDLE, world, 1 / 60);
  updateHud();
}

function start() {
  if (status !== 'ready') reset();
  status = 'playing';
  overlay.hidden = true;
}

function end(result, title, text) {
  status = result;
  showOverlay(title, text, 'Play again');
}

function frame(t) {
  const dt = Math.min(1 / 30, (t - last) / 1000);
  last = t;
  if (status === 'playing') {
    time += dt;
    updatePlayer(player, input.state, world, dt);
    const outcome = checkEntities(player, world);
    updateHud();
    if (outcome === 'lost') end('over', 'Ouch! 💥', 'You fell or hit spikes. Press Enter to retry.');
    else if (outcome === 'won') end('won', 'Level clear! 🏁', `Coins ${world.collected}/${world.coinsTotal} in ${time.toFixed(1)}s`);
  }
  renderer.draw(world, player);
  requestAnimationFrame(frame);
}

actionBtn.addEventListener('click', start);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && status !== 'playing') start();
});

reset();
showOverlay('Hop Hills', 'Reach the green flag. Grab coins, dodge spikes, mind the gaps.', 'Play');
renderer.draw(world, player);
requestAnimationFrame((t) => {
  last = t;
  frame(t);
});
