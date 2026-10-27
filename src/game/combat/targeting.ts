import type { Point } from "../navigation";
import type { Foe } from "../kit/types";

/** Resolve once per command. Explicit selection wins only while reachable and visible.
 * Unselected targets must be in the forward 120-degree cone; ties use stable IDs. */
export function combatTarget(
  origin: Point,
  facing: Point,
  reach: number,
  selected: Foe | undefined,
  candidates: readonly Foe[],
  visible: (a: Point, b: Point) => boolean,
): Foe | undefined {
  const valid = (f: Foe) =>
    f.hp > 0 && Math.hypot(f.x - origin.x, f.y - origin.y) <= reach && visible(origin, f);
  if (selected && valid(selected)) return selected;
  let best: Foe | undefined;
  let score = Infinity;
  const len = Math.hypot(facing.x, facing.y) || 1;
  for (const f of candidates) {
    const dx = f.x - origin.x,
      dy = f.y - origin.y,
      d = Math.hypot(dx, dy);
    if (d > reach || f.hp <= 0) continue;
    const alignment = d < 1e-6 ? 1 : (dx * facing.x + dy * facing.y) / (d * len);
    if (alignment < 0.5 || !visible(origin, f)) continue;
    const value = d + (1 - alignment) * reach * 0.15;
    if (value < score || (value === score && f.id < (best?.id ?? ""))) {
      best = f;
      score = value;
    }
  }
  return best;
}
