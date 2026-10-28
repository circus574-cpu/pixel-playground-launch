import { describe, it, expect } from "vitest";
import { GameSession } from "../game/session";
import { WORLDS } from "../game/world/worlds";
import { RACES, RACE_IDS } from "../game/world/races";
import { MeasurementActivity } from "../game/development/heritage/measurement";
import type { HeritageGoal } from "../game/development/heritage/types";
import type { HeritageTarget } from "../game/development/heritage/bindings";
const goal: Extract<HeritageGoal, { kind: "measure" }> = {
  id: "unit:measure",
  kind: "measure",
  label: "Pomiary",
  site: "workshop",
  documents: [],
  hits: 3,
};
function create(race: (typeof RACE_IDS)[number], accept = true) {
  const world = {
    ...WORLDS[RACES[race].world],
    width: 960,
    height: 760,
    spawn: { x: 480, y: 500 },
    npcs: [],
    enemies: [],
    monsters: [],
    objects: [],
    obstacles: [],
  };
  const session = new GameSession(undefined, race, { practiceOnly: true, world });
  const completed: string[] = [],
    contacts: { target: string; damage: number }[] = [];
  const bindings: HeritageTarget[] = Array.from({ length: 3 }, (_, i) => ({
    id: `unit:measure:target:${i}`,
    label: `Cel ${i + 1}`,
    point: { x: 480 + i * 30, y: 440 },
    feature: world.id,
    interior: null,
    npc: null,
    witness: false,
    entrance: null,
  }));
  const measurement = new MeasurementActivity(
    session,
    goal,
    "unit-owner",
    bindings,
    () => completed,
    (target, contact) => {
      contacts.push({ target: target.id, damage: contact.raw });
      if (!accept) return false;
      completed.push(target.id);
      return true;
    },
  );
  const step = (ms: number) => {
    for (let n = 0; n < ms; n += 50) session.tick(Math.min(50, ms - n));
  };
  return { session, measurement, completed, contacts, step };
}
describe("measurements use production kit hits (unit fixtures, not late chapter acceptance)", () => {
  it.each(RACE_IDS)(
    "measures three distinct targets and keeps true readings without rewards or healing: %s",
    (race) => {
      const { session: s, measurement, completed, step } = create(race);
      const gold = s.player.gold,
        xp = s.player.xp,
        hp = s.player.hp,
        items = structuredClone(s.player.items);
      for (let i = 0; i < 3; i++) {
        const target = s.practiceTargets.list(null)[0]!;
        s.command({ type: "move", x: target.x, y: target.y + 50 });
        step(1000);
        s.command({ type: "target", id: target.id });
        s.command({ type: "ability", ability: "R" });
        step(500);
        expect(completed).toHaveLength(i + 1);
        step(1500);
      }
      const reading = measurement.snapshot();
      expect(reading.windows).toBe(3);
      expect(new Set(completed).size).toBe(3);
      expect(reading.readings).toHaveLength(3);
      for (const r of reading.readings) {
        expect(r.damage).toBeGreaterThan(0);
        expect(r.attack).toBe(s.kit.stats.attack);
        expect(r.maxKi).toBe(s.kit.stats.maxKi);
        expect(r.ki).toBeLessThanOrEqual(r.maxKi);
      }
      if (race === "android")
        expect(reading.readings.every((r) => r.resource?.label === s.kit.resource()?.label)).toBe(
          true,
        );
      expect(s.player.gold).toBe(gold);
      expect(s.player.xp).toBe(xp);
      expect(s.player.hp).toBe(hp);
      expect(s.player.items).toEqual(items);
      expect(s.loot).toHaveLength(0);
      expect(s.practiceTargets.list(null)).toHaveLength(0);
      measurement.dispose();
    },
  );
  it("does not accept an uncommitted hit as a measured objective or hide its target", () => {
    const { session: s, measurement, completed, contacts, step } = create("android", false);
    const target = s.practiceTargets.list(null)[0]!;
    s.command({ type: "target", id: target.id });
    s.command({ type: "ability", ability: "R" });
    step(500);
    expect(contacts).toHaveLength(1);
    expect(completed).toEqual([]);
    expect(measurement.snapshot().readings).toEqual([]);
    expect(s.practiceTargets.has(target)).toBe(true);
  });
  it("an expired in-flight projectile cannot advance a disposed instrument", () => {
    const { session: s, measurement, completed, contacts, step } = create("android");
    s.command({ type: "ability", ability: "R" });
    expect(s.projectiles.active.length).toBeGreaterThan(0);
    measurement.dispose();
    step(1000);
    expect(completed).toEqual([]);
    expect(contacts).toEqual([]);
  });
});
