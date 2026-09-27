// Stub: replaced by the level rendering ticket.
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  return {
    draw(world, player) {
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(player.x, player.y, player.w, player.h);
    },
  };
}
