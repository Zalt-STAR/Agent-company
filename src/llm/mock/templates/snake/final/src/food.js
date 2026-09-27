export function spawnFood(grid, occupied) {
  const taken = new Set(occupied.map((p) => `${p.x},${p.y}`));
  const free = [];
  for (let y = 0; y < grid.rows; y++) {
    for (let x = 0; x < grid.cols; x++) {
      if (!taken.has(`${x},${y}`)) free.push({ x, y });
    }
  }
  return free[Math.floor(Math.random() * free.length)] ?? { x: -1, y: -1 };
}
