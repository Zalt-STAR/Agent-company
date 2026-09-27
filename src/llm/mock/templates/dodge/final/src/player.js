export const PLAYER_SPEED = 360;

export function createPlayer(width, height) {
  const w = 44;
  const h = 18;
  return { x: (width - w) / 2, y: height - h - 16, w, h };
}

export function updatePlayer(p, keys, dt, width) {
  const dir = Number(keys.right) - Number(keys.left);
  p.x = Math.max(0, Math.min(width - p.w, p.x + dir * PLAYER_SPEED * dt));
}
