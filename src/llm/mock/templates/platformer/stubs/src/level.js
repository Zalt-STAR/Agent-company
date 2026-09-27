// Stub: replaced by the level ticket.
export function loadLevel() {
  return {
    width: 20, height: 14, coins: [], spikes: [], goal: null, spawn: { x: 64, y: 352 },
    coinsTotal: 0, collected: 0, tileAt: () => '.', isSolid: (tx, ty) => ty >= 12,
  };
}
