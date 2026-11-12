/** CPU experiment only. Never imported by the game or used to migrate saves. */
import type { Kit, Mods } from "../../src/game/kit/base";
import { rankedAttackMultiplier } from "../../src/game/kit/rankScaling";
import type { RaceId } from "../../src/game/world/races";

export const RANK_MODELS = [
  { id: "current", description: "Current: every numerical effect × rank" },
  {
    id: "stats-025pp",
    statStep: 0.0025,
    description: "HP/KI/ATK/DEF: first bonus +0.25pp per extra point; other effects unchanged",
  },
  {
    id: "stats-05pp",
    statStep: 0.005,
    description: "HP/KI/ATK/DEF: first bonus +0.5pp per extra point; other effects unchanged",
  },
  {
    id: "stats-1pp",
    statStep: 0.01,
    description: "HP/KI/ATK/DEF: first bonus +1pp per extra point; other effects unchanged",
  },
  {
    id: "relative-05pct",
    otherStep: 0.005,
    description:
      "Every repeated numerical effect: first effect × (1 +0.5% per extra point); 10% becomes 10.005%, NOT 10.5%",
  },
  {
    id: "hybrid-05",
    statStep: 0.005,
    otherStep: 0.005,
    description:
      "Primary stats +0.5pp per extra point; remaining numerical effects +0.5% of their first-rank value",
  },
  {
    id: "first-only",
    otherStep: 0,
    description:
      "Diagnostic lower bound: first-rank numerical effects only, no refund of invested points",
  },
  {
    id: "owner-stats",
    statFirstScale: 0.5,
    statRepeat: 0.1,
    description:
      "Owner 12.11: primary stat bonuses halved at first point, each extra point +10% of new first-point bonus; other effects current",
  },
  {
    id: "owner-full",
    firstScale: 0.5,
    otherStep: 0.1,
    description:
      "Owner formula applied to every rank-scaled numerical effect, including whole active multipliers; damage interpretation awaits clarification",
  },
  {
    id: "owner-bonus",
    firstScale: 0.5,
    otherStep: 0.1,
    description:
      "Owner final policy: half numerical bonuses, +10% of new first bonus per extra rank; direct attacks retain one ordinary attack as their base",
  },
] as const;
export type RankModelId = (typeof RANK_MODELS)[number]["id"];
type RankModel = {
  id: string;
  statStep?: number;
  otherStep?: number;
  firstScale?: number;
  statFirstScale?: number;
  statRepeat?: number;
};
type StatField = "hpPct" | "kiPct" | "atkPct" | "defPct";
const PRIMARY: Record<RaceId, readonly [string, StatField, number][]> = {
  planetary: [
    ["C2", "hpPct", 0.1],
    ["B3", "defPct", 0.08],
  ],
  sage: [["C2", "kiPct", 0.15]],
  android: [
    ["C5", "kiPct", 0.12],
    ["B2", "defPct", 0.08],
  ],
  legend: [
    ["B3", "hpPct", 0.1],
    ["B2", "defPct", 0.08],
    ["A5", "atkPct", 0.08],
  ],
};
export function percentBonus(first: number, rank: number, step: number) {
  return rank <= 0 ? 0 : first + step * (rank - 1);
}
/** Override one disposable kit instance, not prototypes, catalog numbers, points, cooldowns or saves.
 * Only the named primary passive contributions use percentage points. Conditional terrain bonuses,
 * crit, speed, flat KI and durations remain current in stats-only arms; hybrid scales them relatively.
 * These are precisely defined comparison hypotheses, not an approved universal rank contract.
 */
export function applyRankModel(kit: Kit, model: RankModel): () => void {
  const access = kit as unknown as {
    mods(): Mods;
    bonusRank(id: string): number;
    castRank(id: string): number;
    castDamage(id: string, first: number): number;
    castGrowth(id: string): number;
    refresh(): void;
  };
  const originalBonus = access.bonusRank,
    originalMods = access.mods,
    originalCastRank = access.castRank,
    originalDamage = access.castDamage,
    originalGrowth = access.castGrowth;
  const rawRank = kit.rank.bind(kit);
  access.bonusRank = (id) => {
    const rank = rawRank(id);
    if (!rank) return 0;
    return model.otherStep === undefined
      ? rank
      : (model.firstScale ?? 1) * (1 + model.otherStep * (rank - 1));
  };
  access.castRank = (id) => access.bonusRank(id);
  access.castDamage = (id, first) =>
    model.id === "owner-bonus"
      ? rankedAttackMultiplier(first, access.castRank(id))
      : first * access.castRank(id);
  access.castGrowth = (id) =>
    model.id === "owner-bonus" ? access.castRank(id) / 0.5 : access.castRank(id);
  if (model.statStep !== undefined || model.statFirstScale !== undefined)
    access.mods = () => {
      const mods = { ...originalMods.call(kit) };
      for (const [id, field, coefficient] of PRIMARY[kit.race]) {
        const rank = rawRank(id);
        if (rank)
          mods[field] =
            (mods[field] ?? 0) -
            coefficient * access.bonusRank(id) +
            (model.statFirstScale === undefined
              ? percentBonus(coefficient, rank, model.statStep!)
              : coefficient * model.statFirstScale * (1 + model.statRepeat! * (rank - 1)));
      }
      return mods;
    };
  access.refresh();
  return () => {
    access.bonusRank = originalBonus;
    access.mods = originalMods;
    access.castRank = originalCastRank;
    access.castDamage = originalDamage;
    access.castGrowth = originalGrowth;
    access.refresh();
  };
}

/** Wilson 95% interval, including a nonzero uncertainty at 0/N and N/N. */
export function wilson(wins: number, total: number): [number, number] {
  if (!total) return [0, 1];
  const z = 1.95996398454,
    p = wins / total,
    d = 1 + (z * z) / total;
  const center = (p + (z * z) / (2 * total)) / d;
  const half = (z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total))) / d;
  return [Math.max(0, center - half), Math.min(1, center + half)];
}
