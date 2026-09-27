import { TILE, GRAVITY, MOVE_SPEED, JUMP_SPEED, MAX_FALL } from './config.js';

export function createPlayer(spawn) {
  return { x: spawn.x, y: spawn.y, w: 22, h: 28, vx: 0, vy: 0, onGround: false, facing: 1 };
}

function collide(p, world, dx, dy) {
  p.x += dx;
  p.y += dy;
  const x0 = Math.floor(p.x / TILE);
  const x1 = Math.floor((p.x + p.w - 1) / TILE);
  const y0 = Math.floor(p.y / TILE);
  const y1 = Math.floor((p.y + p.h - 1) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (!world.isSolid(tx, ty)) continue;
      if (dx > 0) p.x = tx * TILE - p.w;
      else if (dx < 0) p.x = (tx + 1) * TILE;
      if (dy > 0) {
        p.y = ty * TILE - p.h;
        p.onGround = true;
        p.vy = 0;
      } else if (dy < 0) {
        p.y = (ty + 1) * TILE;
        p.vy = 0;
      }
      return;
    }
  }
}

export function updatePlayer(p, input, world, dt) {
  const target = (Number(input.right) - Number(input.left)) * MOVE_SPEED;
  p.vx += (target - p.vx) * Math.min(1, dt * 12);
  if (target) p.facing = Math.sign(target);

  if (input.jump && p.onGround) {
    p.vy = -JUMP_SPEED;
    p.onGround = false;
  }
  p.vy = Math.min(MAX_FALL, p.vy + GRAVITY * dt);

  collide(p, world, p.vx * dt, 0);
  p.onGround = false;
  collide(p, world, 0, p.vy * dt);
}
