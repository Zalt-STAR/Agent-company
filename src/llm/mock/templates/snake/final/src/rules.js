export function evaluate(game, grid, winLength) {
  const head = game.snake.body[0];
  const outside = head.x < 0 || head.y < 0 || head.x >= grid.cols || head.y >= grid.rows;
  if (outside || game.snake.hitsSelf()) return 'lost';
  if (game.snake.body.length >= winLength) return 'won';
  return null;
}
