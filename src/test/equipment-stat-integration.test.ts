import { describe, expect, it } from "vitest";
import { GameSession, getSlotForItem } from "../game/session";
import { RACE_IDS } from "../game/world/races";
import { getItemById, computePassiveEquipmentBonuses } from "../game/items";

describe.each(RACE_IDS)("equipment statistics %s", (race) => {
  function session() {
    const s = new GameSession(undefined, race);
    s.player.level = 40;
    s.player.hp = s.kit.stats.maxHp / 2;
    s.player.ki = s.kit.stats.maxKi / 3;
    return s;
  }
  function equip(s: GameSession, id: string) {
    s.player.bagItems![id] = 1;
    s.command({ type: "equip", item: id });
    expect(Object.values(s.player.equipment!)).toContain(id);
  }
  it("applies HP percentage once, reports the item delta, and preserves the health ratio", () => {
    const s = session(),
      before = s.kit.stats;
    equip(s, "A-V1");
    const pct = getItemById("A-V1")!.stats!.maxHpPercent!;
    expect(s.kit.stats.maxHp).toBe(Math.floor(before.maxHp * (1 + pct / 100) + 0.5));
    expect(s.player.hp / s.kit.stats.maxHp).toBeCloseTo(0.5, 10);
    expect(s.kit.statBreakdown.maxHp.items).toBe(s.kit.stats.maxHp - before.maxHp);
  });
  it("applies KI and KI regeneration without changing technique", () => {
    const s = session(),
      before = s.kit.stats;
    equip(s, "A-A1");
    expect(s.kit.stats.maxKi).toBeGreaterThan(before.maxKi);
    expect(s.kit.stats.kiRegen).toBeGreaterThan(before.kiRegen);
    expect(s.player.ki / s.kit.stats.maxKi).toBeCloseTo(1 / 3, 10);
    expect(s.kit.stats.technique).toBe(before.technique);
  });
  it("gives movement rather than attack speed and respects the capped percentage", () => {
    const s = session(),
      before = s.kit.stats;
    equip(s, "A-V3");
    expect(s.kit.stats.speed).toBeCloseTo(before.speed * 1.02);
    expect(s.kit.stats.attackSpeedPct).toBe(before.attackSpeedPct);
    expect(s.kit.stats.attackInterval).toBe(before.attackInterval);
  });
  it("gives critical percentage points without adding technique or its side effects", () => {
    const s = session(),
      before = s.kit.stats;
    equip(s, "U-W03");
    const expected = computePassiveEquipmentBonuses(["U-W03"]).cappedTotals.critChancePoints;
    expect(s.kit.stats.crit - before.crit).toBeCloseTo(expected);
    expect(s.kit.stats.technique).toBe(before.technique);
  });
  it("cannot heal or refill KI by repeatedly changing equipment", () => {
    const s = session(),
      before = s.kit.stats,
      hp = s.player.hp,
      ki = s.player.ki;
    for (let i = 0; i < 12; i++) {
      for (const id of ["A-V1", "A-A1"]) {
        equip(s, id);
        s.command({ type: "unequip", slot: getSlotForItem(id)! });
      }
    }
    expect(s.kit.stats.maxHp).toBe(before.maxHp);
    expect(s.kit.stats.maxKi).toBe(before.maxKi);
    expect(s.player.hp).toBeCloseTo(hp, 9);
    expect(s.player.ki).toBeCloseTo(ki, 9);
  });
});
