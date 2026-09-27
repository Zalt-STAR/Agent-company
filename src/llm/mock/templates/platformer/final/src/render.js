import { TILE, VIEW, COLORS } from './config.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW.h);
  sky.addColorStop(0, COLORS.skyTop);
  sky.addColorStop(1, COLORS.skyBottom);

  function hills(camX) {
    ctx.fillStyle = COLORS.hills;
    for (let i = -1; i < 6; i++) {
      const x = i * 220 - ((camX * 0.3) % 220);
      ctx.beginPath();
      ctx.ellipse(x, VIEW.h - 40, 160, 110, 0, Math.PI, 0);
      ctx.fill();
    }
  }

  function tile(c, x, y) {
    if (c === '#') {
      ctx.fillStyle = COLORS.ground;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = COLORS.grass;
      ctx.fillRect(x, y, TILE, 6);
    } else if (c === '=') {
      ctx.fillStyle = COLORS.platform;
      ctx.fillRect(x, y, TILE, 12);
    }
  }

  return {
    draw(world, player) {
      const maxCam = world.width * TILE - VIEW.w;
      const camX = Math.max(0, Math.min(maxCam, player.x - VIEW.w / 2));
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, VIEW.w, VIEW.h);
      hills(camX);

      ctx.save();
      ctx.translate(-Math.round(camX), 0);
      const first = Math.floor(camX / TILE);
      for (let ty = 0; ty < world.height; ty++) {
        for (let tx = first; tx <= first + VIEW.w / TILE + 1; tx++) tile(world.tileAt(tx, ty), tx * TILE, ty * TILE);
      }

      const bob = Math.sin(performance.now() / 200) * 3;
      ctx.fillStyle = COLORS.coin;
      for (const c of world.coins) {
        if (c.taken) continue;
        ctx.beginPath();
        ctx.arc(c.x * TILE + TILE / 2, c.y * TILE + TILE / 2 + bob, 8, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = COLORS.spike;
      for (const s of world.spikes) {
        const x = s.x * TILE;
        const y = s.y * TILE + TILE;
        ctx.beginPath();
        ctx.moveTo(x + 2, y);
        ctx.lineTo(x + TILE / 2, y - 22);
        ctx.lineTo(x + TILE - 2, y);
        ctx.fill();
      }

      if (world.goal) {
        const gx = world.goal.x * TILE + TILE / 2;
        const gy = world.goal.y * TILE + TILE;
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(gx - 2, gy - 72, 4, 72);
        ctx.fillStyle = COLORS.flag;
        ctx.beginPath();
        ctx.moveTo(gx + 2, gy - 72);
        ctx.lineTo(gx + 30, gy - 60);
        ctx.lineTo(gx + 2, gy - 48);
        ctx.fill();
      }

      ctx.fillStyle = COLORS.player;
      ctx.fillRect(Math.round(player.x), Math.round(player.y), player.w, player.h);
      ctx.fillStyle = '#fff';
      const eyeX = player.facing > 0 ? player.x + player.w - 9 : player.x + 3;
      ctx.fillRect(Math.round(eyeX), Math.round(player.y + 7), 6, 6);
      ctx.restore();
    },
  };
}
