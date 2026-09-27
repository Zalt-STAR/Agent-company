// Stub: replaced by the food & rendering ticket.
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  return {
    draw() {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    },
  };
}
