import { describe, it, expect } from "vitest";
import { TrialAttempt } from "../game/development/trials/attempt";
import { completeTrial, tickTrial } from "./helpers/racialTrials";
import { isCityStage, inSafeCity } from "../game/city/types";
import { validLearned } from "../game/kit";

describe("Legend combat and rescue are real engine encounters", () => {
  for (const id of ["TP03", "TP10", "TP11", "TP12"] as const)
    for (const tier of [1, 2, 3] as const)
      it(`${id} grade ${tier}: actual AI, movement and rescue`, () => {
        const a = new TrialAttempt(id, tier);
        expect(isCityStage(a.session.world)).toBe(false);
        expect(validLearned(a.race, 20, a.session.player.skills)).toBe(true);
        const before = { gold: a.session.player.gold, xp: a.session.player.xp };
        completeTrial(a);
        expect(a.snapshot().successes).toBe(a.targetCount);
        expect(a.session.enemies).toHaveLength(0);
        expect(a.session.player.gold).toBe(before.gold);
        expect(a.session.player.xp).toBe(before.xp);
      });
  it("AFK cannot complete a combat escort and its foes stay outside cities", () => {
    const a = new TrialAttempt("TP10", 1);
    a.begin();
    tickTrial(a, 10);
    expect(a.session.enemies.length).toBeGreaterThan(0);
    for (const enemy of a.session.enemies)
      expect(inSafeCity(a.session.world, enemy, null)).toBe(false);
    tickTrial(a, 2000);
    expect(a.snapshot().outcome).not.toBe("passed");
    a.abandon();
    expect(a.session.enemies).toHaveLength(0);
  });
});
