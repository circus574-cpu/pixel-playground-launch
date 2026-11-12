/** Owner 12.11.2026: half the original first-point bonus, then +10% of that new base per point. */
export function rankBonusPower(rank: number): number {
  return rank <= 0 ? 0 : 0.5 * (1 + 0.1 * (rank - 1));
}

/** One ordinary attack is the reference for a whole active attack, including a multi-hit total.
 * Scale only its extra damage; callers distribute this total across their existing hit schedule.
 * DOT, secondary hits, healing and shields are bonuses from zero and use rankBonusPower directly.
 */
export function rankedAttackMultiplier(firstTotal: number, power: number): number {
  return firstTotal >= 1 ? 1 + (firstTotal - 1) * power : firstTotal * power;
}
