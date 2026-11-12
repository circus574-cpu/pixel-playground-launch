import { describe, expect, it } from "vitest";
import { TrialAttempt } from "../game/development/trials/attempt";
import { completeTrial, tickTrial } from "./helpers/racialTrials";
import type { TrialTier } from "../game/development/trials/catalog";

describe("Android calibration uses production combat", () => {
  for (const id of ["TN01", "TN02", "TN03"] as const)
    for (const tier of [1, 2, 3] as TrialTier[])
      it(`${id} grade ${tier}: complete using real movement, marking and projectiles`, () => {
        const a = new TrialAttempt(id, tier);
        completeTrial(a);
        expect(a.snapshot().successes).toBe(a.targetCount);
        expect(a.session.practiceTargets.list(null)).toHaveLength(0);
      });
  it("moving targets follow the owner speed and stop on pause", () => {
    for (const [tier, speed] of [
      [1, 40],
      [2, 55],
      [3, 70],
    ] as const) {
      const a = new TrialAttempt("TN02", tier);
      a.begin();
      tickTrial(a);
      const before = a.snapshot().targets[0]!.x;
      tickTrial(a, 10);
      expect(a.snapshot().targets[0]!.x - before).toBeCloseTo(speed / 2);
      a.suspend(true);
      const paused = a.snapshot().targets[0]!.x;
      tickTrial(a, 10);
      expect(a.snapshot().targets[0]!.x).toBe(paused);
    }
  });
  it("three invalid shots fail, cooldown spam does not award a hit", () => {
    const a = new TrialAttempt("TN01", 1);
    a.begin();
    for (let i = 0; i < 3; i++) a.session.command({ type: "ability", ability: "R" });
    tickTrial(a);
    expect(a.snapshot().outcome).toBe("failed");
    expect(a.snapshot().successes).toBe(0);
  });
  it("selection and marking alone never complete a target", () => {
    const a = new TrialAttempt("TN03", 1);
    a.begin();
    const target = a.snapshot().targets[0]!;
    a.session.command({ type: "target", id: target.id });
    a.session.command({ type: "ability", ability: "A1" });
    tickTrial(a, 40);
    expect(a.snapshot().successes).toBe(0);
  });
});
