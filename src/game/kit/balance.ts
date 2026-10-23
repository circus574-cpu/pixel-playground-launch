/**
 * Owner decision of 22.10.2026 (overrides the annex, which kept movement speed constant): speed grows by
 * 5% of the race's base value per level, up to level 20, and stays there afterwards.
 * At level L: base × (1 + 0.05 × (min(L, 20) − 1)). Attack interval still does not grow (annex).
 */
export const SPEED_GROWTH_PER_LEVEL = 0.05;
export const SPEED_GROWTH_UNTIL = 20;
export const speedGrowth = (level: number) =>
  1 + SPEED_GROWTH_PER_LEVEL * (Math.min(level, SPEED_GROWTH_UNTIL) - 1);
