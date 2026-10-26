import { describe, it, expect } from "vitest";
import { BOSS_CATALOG, BOSS_BY_ID, getBossById, getBossesByContinent } from "../index";
import { getItemById } from "../../items";
import { ContinentId } from "../../worlds/types";

describe("Bosses Catalog Consistency Tests", () => {
  it("should have exactly 8 bosses from Księga Przygody v1.0", () => {
    expect(BOSS_CATALOG.length).toBe(8);

    const ids = new Set<string>();
    for (const boss of BOSS_CATALOG) {
      expect(boss.id).toBeTruthy();
      expect(ids.has(boss.id)).toBe(false);
      ids.add(boss.id);
    }
  });

  it("should have exactly 2 bosses per continent (one Lv 15 and one Lv 20)", () => {
    const continents: ContinentId[] = ["verdant", "pyra", "aether", "nexus"];

    for (const cont of continents) {
      const continentBosses = getBossesByContinent(cont);
      expect(continentBosses.length).toBe(2);

      const levels = continentBosses.map((b) => b.level).sort((a, b) => a - b);
      expect(levels).toEqual([15, 20]);
    }
  });

  it("should have valid combat stats and scaling multipliers for all bosses", () => {
    for (const boss of BOSS_CATALOG) {
      expect(boss.name).toBeTruthy();
      expect(boss.title).toBeTruthy();
      expect(boss.lore.length).toBeGreaterThan(50);
      expect(boss.weakness.length).toBeGreaterThan(10);
      expect(boss.behavior.length).toBeGreaterThan(20);

      // Check stats
      expect(boss.stats.hp).toBeGreaterThanOrEqual(4000);
      expect(boss.stats.atk).toBeGreaterThanOrEqual(50);
      expect(boss.stats.def).toBeGreaterThanOrEqual(25);
      expect(boss.stats.xp).toBeGreaterThanOrEqual(500);

      // Check multipliers
      expect(boss.mult.hp).toBeGreaterThanOrEqual(8);
      expect(boss.mult.atk).toBeGreaterThanOrEqual(1.4);
      expect(boss.mult.def).toBeGreaterThanOrEqual(1.2);
    }
  });

  it("should have well-defined descending phase thresholds for all bosses", () => {
    for (const boss of BOSS_CATALOG) {
      expect(boss.phases.length).toBeGreaterThanOrEqual(3);

      let prevThreshold = 101;
      for (const phase of boss.phases) {
        expect(phase.name).toBeTruthy();
        expect(phase.description).toBeTruthy();
        expect(phase.hpThresholdPercent).toBeLessThan(prevThreshold);
        expect(phase.hpThresholdPercent).toBeGreaterThan(0);
        prevThreshold = phase.hpThresholdPercent;
      }
    }
  });

  it("should have valid attacks and phase unlocks", () => {
    for (const boss of BOSS_CATALOG) {
      expect(boss.attacks.length).toBeGreaterThanOrEqual(3);

      const attackIds = new Set(boss.attacks.map((a) => a.id));
      for (const attack of boss.attacks) {
        expect(attack.name).toBeTruthy();
        expect(attack.cooldownSeconds).toBeGreaterThan(0);
        expect(attack.damageMultiplier).toBeGreaterThan(0);
      }

      for (const phase of boss.phases) {
        for (const attackId of phase.unlockedAttacks) {
          expect(
            attackIds.has(attackId),
            `Attack "${attackId}" in boss "${boss.id}" phase "${phase.name}" must be defined in attacks array`,
          ).toBe(true);
        }
      }
    }
  });

  it("should ensure all boss loot drop item IDs exist in the item catalog", () => {
    for (const boss of BOSS_CATALOG) {
      expect(boss.lootTable.length).toBeGreaterThanOrEqual(2);

      for (const loot of boss.lootTable) {
        const item = getItemById(loot.itemId);
        expect(
          item,
          `Loot item ID "${loot.itemId}" for boss "${boss.id}" must exist in ITEM_CATALOG`,
        ).toBeDefined();

        expect(loot.chancePercent).toBeGreaterThan(0);
        expect(loot.chancePercent).toBeLessThanOrEqual(100);
        expect(loot.minCount).toBeGreaterThan(0);
        expect(loot.maxCount).toBeGreaterThanOrEqual(loot.minCount);
      }
    }
  });

  it("should provide functioning lookup helpers", () => {
    const ygdrasha = getBossById("ygdrasha");
    expect(ygdrasha).toBeDefined();
    expect(ygdrasha?.continent).toBe("verdant");
    expect(ygdrasha?.level).toBe(15);

    const pyrrhax = getBossById("pyrrhax");
    expect(pyrrhax).toBeDefined();
    expect(pyrrhax?.continent).toBe("pyra");
    expect(pyrrhax?.level).toBe(20);
  });
});
