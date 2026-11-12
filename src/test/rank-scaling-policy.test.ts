import { describe, expect, it } from "vitest";
import { rankBonusPower, rankedAttackMultiplier } from "../game/kit/rankScaling";
import { nodeDescription } from "../game/kit/nodePresentation";
import { createKit, validLearned, KIT_NODES } from "../game/kit";
import { statsPort, SaveStore, newPlayer } from "../game/session";
import { RACE_IDS } from "../game/world/races";

describe("owner rank decision 12.11.2026", () => {
  it("keeps the first bonus at half and adds ten percent of that new base", () => {
    expect(rankBonusPower(0)).toBe(0);
    for (const [rank, value] of [
      [1, 0.05],
      [2, 0.055],
      [3, 0.06],
      [8, 0.085],
      [10, 0.095],
    ] as const)
      expect(0.1 * rankBonusPower(rank)).toBeCloseTo(value, 12);
    expect(rankedAttackMultiplier(1.8, rankBonusPower(1))).toBe(1.4);
    expect(rankedAttackMultiplier(1.8, rankBonusPower(2))).toBeCloseTo(1.44);
  });
  for (const race of RACE_IDS)
    it(`${race}: keeps raw point counts, base statistics and saved allocation`, () => {
      const p = newPlayer(race);
      p.level = 10;
      const node = race === "android" ? "B2" : race === "legend" ? "B3" : "C2";
      const pre = node.startsWith("B") ? "B1" : "C1";
      p.skills = ["R", pre, ...Array<string>(8).fill(node)];
      expect(validLearned(race, 10, p.skills)).toBe(true);
      const kit = createKit(race, statsPort(p), p.skills);
      expect(kit.rank(node)).toBe(8);
      expect(kit.stats[race === "sage" ? "maxKi" : race === "android" ? "defense" : "maxHp"]).toBe(
        { planetary: 487, sage: 161, android: 36, legend: 562 }[race],
      );
      const data = new Map<string, string>();
      const saves = new SaveStore(
        {
          getItem: (k) => data.get(k) ?? null,
          setItem: (k, v) => {
            data.set(k, v);
          },
        },
        "rank-owner",
      );
      saves.load();
      expect(saves.save(p)).toBe(true);
      expect(saves.load()!.skills).toEqual(p.skills);
      expect(createKit(race, statsPort(saves.load()!), saves.load()!.skills).stats).toEqual(
        kit.stats,
      );
    });
  it("shows actual numerical bonuses and preserves execution thresholds and fixed mechanics", () => {
    expect(nodeDescription("legend", "B3", [])).toBe("+5% maks. życia.");
    expect(nodeDescription("legend", "B3", ["B3", "B3"])).toBe("+5,5% maks. życia.");
    expect(nodeDescription("planetary", "A4", ["A4"])).toContain("×1,4");
    expect(nodeDescription("sage", "A4", ["A4"])).toContain("×1,7");
    expect(nodeDescription("android", "A9", ["A9"])).toContain("poniżej 30%");
    expect(nodeDescription("android", "C8", ["C8"])).toContain("70");
    for (const race of RACE_IDS)
      for (const node of KIT_NODES[race])
        expect(nodeDescription(race, node.id, [node.id])).not.toMatch(/NaN|undefined/);
  });
});
