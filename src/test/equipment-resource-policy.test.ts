import { describe, expect, it } from "vitest";
import { GameSession } from "../game/session";
import { RACE_IDS } from "../game/world/races";

// Owner specification §3.1: increasing a maximum never restores its current resource.
describe.each(RACE_IDS)("equipment resource policy: %s", (race) => {
  for (const { item, resource, maximum } of [
    { item: "A-V1", resource: "hp", maximum: "maxHp" },
    { item: "A-A1", resource: "ki", maximum: "maxKi" },
  ] as const) {
    function setup() {
      const s = new GameSession(undefined, race);
      s.player.level = 40;
      s.player.bagItems![item] = 1;
      return s;
    }
    it(`${resource}: raising a maximum does not restore a wounded resource`, () => {
      const s = setup(),
        beforeMax = s.kit.stats[maximum],
        current = beforeMax * 0.4;
      s.player[resource] = current;
      s.command({ type: "equip", item });
      expect(s.kit.stats[maximum]).toBeGreaterThan(beforeMax);
      expect(s.player[resource]).toBe(current);
    });
    it(`${resource}: a full resource does not fill the newly added capacity`, () => {
      const s = setup(),
        current = s.kit.stats[maximum];
      s.player[resource] = current;
      s.command({ type: "equip", item });
      expect(s.kit.stats[maximum]).toBeGreaterThan(current);
      expect(s.player[resource]).toBe(current);
    });
    it(`${resource}: lowering a maximum clamps only excess and re-equipping does not refill it`, () => {
      const s = setup(),
        base = s.kit.stats[maximum];
      s.command({ type: "equip", item });
      s.player[resource] = s.kit.stats[maximum]; // Explicit full-resource precondition.
      s.command({ type: "unequip", slot: "armor" });
      expect(s.player[resource]).toBe(base);
      s.command({ type: "equip", item });
      expect(s.kit.stats[maximum]).toBeGreaterThan(base);
      expect(s.player[resource]).toBe(base);
      s.player[resource] = base * 0.25;
      s.command({ type: "unequip", slot: "armor" });
      expect(s.player[resource]).toBe(base * 0.25);
    });
  }
});
