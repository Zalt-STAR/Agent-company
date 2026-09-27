import { GRID, TICK_MS, WIN_LENGTH } from './config.js';
import { createSnake } from './snake.js';
import { createInput } from './input.js';
import { spawnFood } from './food.js';
import { createRenderer } from './render.js';
import { evaluate } from './rules.js';

const canvas = document.getElementById('board');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayText = document.getElementById('overlay-text');
const actionBtn = document.getElementById('overlay-action');

const renderer = createRenderer(canvas, GRID);
const input = createInput(canvas);
let game;
let best = 0;
let last = 0;
let acc = 0;

function showOverlay(title, text, action) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  actionBtn.textContent = action;
  overlay.hidden = false;
}

function updateHud() {
  scoreEl.textContent = game.score;
  bestEl.textContent = best;
}

function newGame() {
  const snake = createSnake(GRID);
  game = { snake, food: spawnFood(GRID, snake.body), score: 0, status: 'ready' };
  input.reset();
  acc = 0;
  updateHud();
  showOverlay('Snake', 'Steer with the arrow keys or WASD. Eat to grow — reach length ' + WIN_LENGTH + ' to win.', 'Start');
  renderer.draw(game);
}

function start() {
  game.status = 'playing';
  overlay.hidden = true;
}

function step() {
  const head = game.snake.move(input.next(game.snake.direction));
  if (head.x === game.food.x && head.y === game.food.y) {
    game.snake.grow();
    game.score += 1;
    best = Math.max(best, game.score);
    game.food = spawnFood(GRID, game.snake.body);
    updateHud();
  }
  const outcome = evaluate(game, GRID, WIN_LENGTH);
  if (outcome === 'lost') {
    game.status = 'over';
    showOverlay('Game over', `You scored ${game.score}. Press Enter to try again.`, 'Play again');
  } else if (outcome === 'won') {
    game.status = 'won';
    showOverlay('You win! 🏆', `Your snake reached length ${WIN_LENGTH}.`, 'Play again');
  }
}

function frame(t) {
  const dt = Math.min(100, t - last);
  last = t;
  if (game.status === 'playing') {
    acc += dt;
    while (acc >= TICK_MS && game.status === 'playing') {
      acc -= TICK_MS;
      step();
    }
  }
  renderer.draw(game);
  requestAnimationFrame(frame);
}

function primaryAction() {
  if (game.status === 'ready') start();
  else if (game.status === 'over' || game.status === 'won') {
    newGame();
    start();
  }
}

actionBtn.addEventListener('click', primaryAction);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    primaryAction();
  }
});

newGame();
requestAnimationFrame((t) => {
  last = t;
  frame(t);
});
