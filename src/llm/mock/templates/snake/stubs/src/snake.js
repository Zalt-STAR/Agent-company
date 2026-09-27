// Stub: replaced by the snake movement ticket.
export function createSnake(grid) {
  const body = [{ x: Math.floor(grid.cols / 2), y: Math.floor(grid.rows / 2) }];
  return { body, direction: 'right', move: () => body[0], grow() {}, hitsSelf: () => false };
}
