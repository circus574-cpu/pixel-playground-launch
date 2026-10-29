import { it, expect, describe } from "vitest";
import { GameSession } from "../game/session";
import { RestraintActivity } from "../game/development/heritage/restraint";
import { RACE_IDS } from "../game/world/races";
import { WORLDS } from "../game/world/worlds";
import { RACES } from "../game/world/races";
import type { HeritageGoal } from "../game/development/heritage/types";
const goal: Extract<HeritageGoal, { kind: "restraint" }> = {
  id: "unit:restraint",
  kind: "restraint",
  label: "Próba",
  site: "trainer",
  documents: [],
  windows: 3,
  maxErrors: 2,
  surrender: true,
};
function arena(race: (typeof RACE_IDS)[number]) {
  const world = {
    ...WORLDS[RACES[race].world],
    spawn: { x: 480, y: 500 },
    width: 960,
    height: 760,
    npcs: [],
    enemies: [],
    monsters: [],
    objects: [],
    obstacles: [],
  };
  const s = new GameSession(undefined, race, { practiceOnly: true, world });
  const activity = new RestraintActivity(s, goal, "unit-owner", { x: 480, y: 440 });
  const step = (ms: number) => {
    for (let n = 0; n < ms; n += 50) {
      s.tick(Math.min(50, ms - n));
      activity.update();
    }
  };
  return { s, activity, step };
}
describe("real-kit restraint and ephemeral target lifecycle", () => {
  it.each(RACE_IDS)(
    "requires real hits plus three no-hit windows, then actual restraint on surrender: %s",
    (race) => {
      const { s, activity, step } = arena(race);
      const before = {
        xp: s.player.xp,
        gold: s.player.gold,
        items: structuredClone(s.player.items),
      };
      for (let cycle = 0; cycle < 3; cycle++) {
        expect(activity.snapshot().phase).toBe("strike");
        s.command({ type: "ability", ability: "R" });
        step(4000);
        expect(activity.snapshot().phase, s.notice).toBe("hold");
        step(2000);
      }
      expect(activity.snapshot().phase).toBe("surrender");
      expect(activity.proof()).toBeUndefined();
      step(2000);
      expect(activity.snapshot().phase).toBe("passed");
      expect(activity.proof()!.windows).toBe(3);
      expect(activity.proof()!.surrendered).toBe(true);
      expect(s.practiceTargets.list(s.player.interior)).toHaveLength(0);
      expect(s.player.xp).toBe(before.xp);
      expect(s.player.gold).toBe(before.gold);
      expect(s.player.items).toEqual(before.items);
      expect(s.loot).toHaveLength(0);
    },
  );
  it("does not pass from a timer without a player attack", () => {
    const { activity, step } = arena("legend");
    step(24000);
    expect(activity.snapshot().phase).toBe("failed");
    expect(activity.proof()).toBeUndefined();
  });
  it("a real hit after surrender fails only this attempt; a fresh attempt remains possible", () => {
    const { s, activity, step } = arena("legend");
    for (let i = 0; i < 3; i++) {
      s.command({ type: "ability", ability: "R" });
      step(6000);
    }
    expect(activity.snapshot().phase).toBe("surrender");
    s.command({ type: "ability", ability: "R" });
    step(50);
    expect(activity.snapshot().phase).toBe("failed");
    expect(s.player.dead).toBe(false);
    expect(activity.proof()).toBeUndefined();
    const retry = new RestraintActivity(s, goal, "unit-owner", { x: 480, y: 440 });
    expect(retry.snapshot().phase).toBe("strike");
    retry.dispose();
  });
  it("pause advances no windows, and disposal invalidates a projectile already in flight", () => {
    const { s, activity, step } = arena("android");
    s.paused = true;
    step(20000);
    expect(activity.snapshot().phase).toBe("strike");
    expect(activity.snapshot().remainingMs).toBe(4000);
    s.paused = false;
    s.command({ type: "ability", ability: "R" });
    expect(s.projectiles.active.length).toBe(1);
    activity.dispose();
    step(1000);
    expect(activity.snapshot().windows).toBe(0);
    expect(s.loot).toHaveLength(0);
    expect(s.player.xp).toBe(0);
  });
});
