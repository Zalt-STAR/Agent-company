import { COLORS } from './config.js';

export function createRenderer(canvas, grid) {
  const ctx = canvas.getContext('2d');
  const cell = Math.floor(canvas.width / grid.cols);

  function block(x, y, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2, 5);
    ctx.fill();
  }

  return {
    draw(game) {
      ctx.fillStyle = COLORS.board;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = COLORS.grid;
      for (let y = 0; y < grid.rows; y++) {
        for (let x = 0; x < grid.cols; x++) if ((x + y) % 2 === 0) ctx.fillRect(x * cell, y * cell, cell, cell);
      }

      const f = game.food;
      ctx.fillStyle = COLORS.food;
      ctx.beginPath();
      ctx.arc(f.x * cell + cell / 2, f.y * cell + cell / 2, cell * 0.35, 0, Math.PI * 2);
      ctx.fill();

      game.snake.body.forEach((p, i) => block(p.x, p.y, i === 0 ? COLORS.head : COLORS.snake));
    },
  };
}
