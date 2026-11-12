import { describe, it, expect } from "vitest";
import { createKit, validLearned } from "../game/kit";
import { RACE_IDS as RACES } from "../game/world/races";
import { statsPort } from "../game/session";
import {
  RANK_MODELS,
  applyRankModel,
  percentBonus,
  wilson,
} from "../../scripts/combat/skill-rank-models";

describe("isolated rank-policy measurement adapters", () => {
  it("distinguishes +0.5 percentage points from +0.5 percent of a bonus", () => {
    expect(percentBonus(0.1, 0, 0.005)).toBe(0);
    expect(percentBonus(0.1, 1, 0.005)).toBe(0.1);
    expect(percentBonus(0.1, 8, 0.005)).toBeCloseTo(0.135);
    expect(0.1 * (1 + 7 * 0.005)).toBeCloseTo(0.1035);
  });
  for (const race of RACES)
    for (const model of RANK_MODELS.filter((m) => !m.id.startsWith("owner-")))
      it(`${race}/${model.id}: preserves first-rank stats, costs and cooldowns`, () => {
        const kit = createKit(
          race,
          statsPort({ level: 40, weapon: null, armor: null, upgrade: 0 }),
          [
            "R",
            "A1",
            "A2",
            "A3",
            "A4",
            "A5",
            "A6",
            "A7",
            "A9",
            "B1",
            "B2",
            "B3",
            "B4",
            "B5",
            "B6",
            "B7",
            "B9",
            "C1",
            "C2",
            "C3",
            "C4",
            "C5",
            "C6",
            "C7",
            "C9",
          ],
        );
        expect(validLearned(race, 40, [...kit.learned])).toBe(true);
        const resetBaseline = applyRankModel(kit, RANK_MODELS[0]);
        const before = { stats: kit.stats, abilities: kit.abilities() };
        const restore = applyRankModel(kit, model);
        expect({ stats: kit.stats, abilities: kit.abilities() }).toEqual(before);
        restore();
        expect({ stats: kit.stats, abilities: kit.abilities() }).toEqual(before);
      });
  it("changes actual kit stats without changing another kit or the learned point counts", () => {
    const port = statsPort({ level: 10, weapon: null, armor: null, upgrade: 0 });
    const learned = ["R", "B1", ...Array<string>(8).fill("B3")];
    const kit = createKit("legend", port, learned),
      other = createKit("legend", port, learned);
    applyRankModel(kit, RANK_MODELS[0]);
    applyRankModel(other, RANK_MODELS[0]);
    expect(kit.stats.maxHp).toBe(932);
    const restore = applyRankModel(kit, { id: "test", statStep: 0.005 });
    expect(kit.stats.maxHp).toBe(588);
    expect(kit.rank("B3")).toBe(8);
    expect(other.stats.maxHp).toBe(932);
    restore();
    expect(kit.stats.maxHp).toBe(932);
  });
  it("reports uncertainty for all wins and all losses", () => {
    expect(wilson(8, 8)[0]).toBeLessThan(0.7);
    expect(wilson(0, 8)[1]).toBeGreaterThan(0.3);
    expect(wilson(64, 64)[0]).toBeGreaterThan(wilson(8, 8)[0]);
  });
  it("owner formula: halves the first bonus and adds ten percent of that new base per further point", () => {
    const port = statsPort({ level: 10, weapon: null, armor: null, upgrade: 0 });
    for (const rank of [1, 2, 8]) {
      const kit = createKit("legend", port, ["R", "B1", ...Array<string>(rank).fill("B3")]);
      applyRankModel(
        kit,
        RANK_MODELS.find((m) => m.id === "owner-stats")!,
      );
      expect(kit.stats.maxHp).toBe(Math.floor(518 * (1 + 0.05 * (1 + 0.1 * (rank - 1))) + 0.5));
    }
  });
});
