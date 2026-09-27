import { TILE } from './config.js';

const overlaps = (p, x, y, w, h) => p.x < x + w && p.x + p.w > x && p.y < y + h && p.y + p.h > y;

/** Resolve pickups, hazards and the goal. Returns 'won', 'lost' or null. */
export function checkEntities(player, world) {
  for (const c of world.coins) {
    if (!c.taken && overlaps(player, c.x * TILE + 8, c.y * TILE + 8, 16, 16)) {
      c.taken = true;
      world.collected += 1;
    }
  }
  for (const s of world.spikes) {
    if (overlaps(player, s.x * TILE + 6, s.y * TILE + 12, TILE - 12, TILE - 12)) return 'lost';
  }
  if (player.y > world.height * TILE) return 'lost';
  const g = world.goal;
  if (g && overlaps(player, g.x * TILE, g.y * TILE - TILE, TILE, TILE * 2)) return 'won';
  return null;
}
