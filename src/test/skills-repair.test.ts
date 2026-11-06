import { describe, expect, it } from "vitest";
import { KIT_NODES } from "../game/kit/nodes.generated";
import { repairLearned, skillPointsAt, unlockAllowed, validLearned } from "../game/kit/progression";
import type { RaceId } from "../game/world/races";

const RACES_ALL = Object.keys(KIT_NODES) as RaceId[];

describe("naprawa i odblokowanie umiejętności", () => {
  it("odblokowanie dozwolonych zawsze daje poprawny zestaw (każda rasa, każdy poziom)", () => {
    for (const race of RACES_ALL)
      for (let level = 1; level <= 20; level++) {
        const set = unlockAllowed(race, level);
        expect(validLearned(race, level, set), `${race}/${level}`).toBe(true);
        expect(set[0]).toBe("R");
        expect(set.length).toBeLessThanOrEqual(skillPointsAt(level));
      }
  });

  it("zepsuty zestaw (wszystkie węzły na niskim poziomie) jest przycinany do poprawnego", () => {
    for (const race of RACES_ALL) {
      const all = KIT_NODES[race].map((n) => n.id);
      expect(validLearned(race, 4, all)).toBe(false);
      const fixed = repairLearned(race, 4, all);
      expect(validLearned(race, 4, fixed)).toBe(true);
      expect(fixed.length).toBeLessThanOrEqual(4);
    }
  });

  it("poprawny zestaw zostaje bez zmian, a duplikaty i nieznane węzły znikają", () => {
    for (const race of RACES_ALL) {
      const ok = unlockAllowed(race, 12);
      expect(repairLearned(race, 12, ok)).toEqual(ok);
      expect(repairLearned(race, 12, [...ok, ...ok, "NIE-MA"])).toEqual(ok);
    }
  });

  it("wykluczające się węzły nigdy nie trafiają razem do zestawu", () => {
    for (const race of RACES_ALL) {
      const set = new Set(unlockAllowed(race, 20));
      for (const n of KIT_NODES[race])
        if (n.excludes) expect(set.has(n.id) && set.has(n.excludes)).toBe(false);
    }
  });
});

describe("brak limitu poziomu 20", () => {
  it("punkty umiejętności rosną z poziomem także powyżej 20", () => {
    expect(skillPointsAt(20)).toBe(20);
    expect(skillPointsAt(21)).toBe(21);
    expect(skillPointsAt(150)).toBe(150);
  });

  it("na wyższym poziomie dozwolone jest więcej węzłów, a zestaw nadal jest poprawny", () => {
    for (const race of RACES_ALL) {
      const nodes = KIT_NODES[race].length;
      const at20 = unlockAllowed(race, 20);
      const at200 = unlockAllowed(race, 200);
      expect(at200.length).toBeGreaterThanOrEqual(at20.length);
      expect(at200.length).toBeLessThanOrEqual(nodes);
      expect(validLearned(race, 200, at200)).toBe(true);
    }
  });
});
