import { COLORS } from './config.js';

export function createHazards(width, height) {
  let blocks = [];
  let spawnIn = 0;

  return {
    update(dt, time) {
      const difficulty = 1 + time / 10;
      spawnIn -= dt;
      if (spawnIn <= 0) {
        const size = 18 + Math.random() * 30;
        blocks.push({ x: Math.random() * (width - size), y: -size, w: size, h: size, vy: (140 + Math.random() * 120) * difficulty });
        spawnIn = Math.max(0.18, 0.7 / difficulty);
      }
      for (const b of blocks) b.y += b.vy * dt;
      blocks = blocks.filter((b) => b.y < height);
    },
    hits(p) {
      return blocks.some((b) => p.x < b.x + b.w && p.x + p.w > b.x && p.y < b.y + b.h && p.y + p.h > b.y);
    },
    draw(ctx) {
      ctx.fillStyle = COLORS.hazard;
      for (const b of blocks) ctx.fillRect(b.x, b.y, b.w, b.h);
    },
  };
}
