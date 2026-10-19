export type Obstacle = { x: number; y: number; width: number; height: number };

/** A circular foot collider, shared by walking and attack line of sight. */
export function blockedAt(x: number, y: number, obstacles: readonly Obstacle[], radius = 12): boolean {
  return obstacles.some(b => {
    const dx = x - Math.max(b.x, Math.min(x, b.x + b.width));
    const dy = y - Math.max(b.y, Math.min(y, b.y + b.height));
    return dx * dx + dy * dy <= radius * radius;
  });
}

export function clearSight(ax: number, ay: number, bx: number, by: number, obstacles: readonly Obstacle[]): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 4));
  for (let i = 0; i <= steps; i++) {
    if (blockedAt(ax + (bx - ax) * i / steps, ay + (by - ay) * i / steps, obstacles, 1)) return false;
  }
  return true;
}
