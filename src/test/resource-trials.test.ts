import { describe, it, expect } from "vitest";
import { TrialAttempt } from "../game/development/trials/attempt";
import { completeTrial, tickTrial, walkTrial } from "./helpers/racialTrials";
import { validLearned } from "../game/kit";
import type { TrialTier } from "../game/development/trials/catalog";

describe("real core and ember management", () => {
  for (const id of ["TN04", "TN05", "TN06", "TP04", "TP05", "TP06"] as const)
    for (const tier of [1, 2, 3] as TrialTier[])
      it(`${id} grade ${tier}: legal profile, real actions, owned resources`, () => {
        const a = new TrialAttempt(id, tier);
        expect(validLearned(a.race, 20, a.session.player.skills)).toBe(true);
        if (a.race === "android")
          expect(a.session.kit.resource()!.max).toBe([100, 150, 70][tier - 1]);
        completeTrial(a);
        expect(a.snapshot().outcome).toBe("passed");
        expect(a.session.practiceTargets.list(null)).toHaveLength(0);
      });
  it("AFK cannot establish or sustain a band", () => {
    const a = new TrialAttempt("TP04", 1);
    a.begin();
    tickTrial(a, 4801);
    expect(a.snapshot().outcome).toBe("failed");
    expect(a.snapshot().successes).toBe(0);
  });
  it("an empty or early discharge earns nothing", () => {
    const a = new TrialAttempt("TN06", 1);
    a.begin();
    a.session.command({ type: "ability", ability: "C1" });
    tickTrial(a);
    expect(a.snapshot().outcome).toBe("failed");
    expect(a.snapshot().successes).toBe(0);
  });
  it("T is forbidden even if it cannot be cast", () => {
    const a = new TrialAttempt("TP04", 1);
    a.begin();
    a.session.command({ type: "ability", ability: "T" });
    tickTrial(a);
    expect(a.snapshot().outcome).toBe("failed");
  });
  it("KI regeneration never refills the cumulative budget", () => {
    const a = new TrialAttempt("TP06", 3);
    a.begin();
    walkTrial(a, a.currentPoint!);
    const id = a.snapshot().resourceControl!.targetId;
    for (let i = 0; i < 4; i++) {
      a.session.command({ type: "target", id });
      a.session.command({ type: "ability", ability: "C1" });
      tickTrial(a, 170);
    }
    expect(a.snapshot().outcome).toBe("failed");
    expect(a.snapshot().resourceControl!.spentKi).toBeGreaterThan(
      a.snapshot().resourceControl!.budgetKi,
    );
  });
});
