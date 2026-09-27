export const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function createSnake(grid) {
  const cx = Math.floor(grid.cols / 2);
  const cy = Math.floor(grid.rows / 2);
  const body = [
    { x: cx, y: cy },
    { x: cx - 1, y: cy },
    { x: cx - 2, y: cy },
  ];
  let pending = 0;

  return {
    body,
    direction: 'right',
    move(dir) {
      this.direction = dir;
      const d = DIRS[dir];
      const head = { x: body[0].x + d.x, y: body[0].y + d.y };
      body.unshift(head);
      if (pending > 0) pending -= 1;
      else body.pop();
      return head;
    },
    grow(n = 1) {
      pending += n;
    },
    hitsSelf() {
      const [head, ...rest] = body;
      return rest.some((p) => p.x === head.x && p.y === head.y);
    },
  };
}
