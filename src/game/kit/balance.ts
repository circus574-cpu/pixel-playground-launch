/**
 * Owner decision of 11.11.2026 (overrides the 22.10.2026 flat 5%/level capped at 20): movement speed
 * grows additively by a diminishing percentage of the race's base value per level — 5% for levels
 * 2–9, 4% for 10–19, 3.5% for 20–29, 3% from 30 on, with no level cap. The final speed is bounded by
 * a hard ceiling MAX_MOVE_SPEED (1200 j/s) shared by client and server. Attack interval still does
 * not grow (annex).
 */
export const SPEED_GROWTH_TIERS: readonly { upTo: number; rate: number }[] = [
  { upTo: 9, rate: 0.05 },
  { upTo: 19, rate: 0.04 },
  { upTo: 29, rate: 0.035 },
  { upTo: Infinity, rate: 0.03 },
];

/** Twardy limit prędkości ruchu (j./s), wspólny dla klienta i serwera. */
export const MAX_MOVE_SPEED = 1200;

/** Mnożnik prędkości względem bazy rasy dla danego poziomu (addytywny % bazy, bez capu poziomu). */
export function speedGrowth(level: number): number {
  const l = Math.max(1, Math.floor(level));
  let growth = 0;
  let prev = 1;
  for (const tier of SPEED_GROWTH_TIERS) {
    growth += Math.max(0, Math.min(l, tier.upTo) - prev) * tier.rate;
    if (l <= tier.upTo) break;
    prev = tier.upTo;
  }
  return 1 + growth;
}
