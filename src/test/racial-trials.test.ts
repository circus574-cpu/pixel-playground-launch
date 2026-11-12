import { completeTrial, tickTrial, walkTrial } from "./helpers/racialTrials";
import { describe, it, expect } from "vitest";
import { TrialAttempt } from "../game/development/trials/attempt";
import { TRIALS, type TrialTier } from "../game/development/trials/catalog";
import { trialPuzzles, moduleSolutionValid } from "../game/development/trials/puzzles";

describe("racial trials use actual navigation, kit hits and explicit puzzles", () => {
  for (const def of TRIALS)
    it.each([1, 2, 3] as const)(
      `${def.id} completes tier %i through production commands`,
      (tier) => {
        const a = new TrialAttempt(def.id, tier);
        completeTrial(a);
        expect(a.snapshot().successes).toBe(def.targets[tier - 1]);
        expect(a.session.loot).toHaveLength(0);
        expect(a.session.player.xp).toBe(0);
        expect(a.session.saves).toBeUndefined();
      },
    );
  it("does not advance active time or attacks until asset readiness", () => {
    const a = new TrialAttempt("TP07", 1);
    tickTrial(a, 500);
    expect(a.snapshot().activeMs).toBe(0);
    expect(a.snapshot().successes).toBe(0);
    a.begin();
    tickTrial(a, 220);
    expect(a.snapshot().outcome).toBe("failed");
    expect(a.snapshot().errors).toBe(3);
  });
  it("rejects remote, stale and wrong answers without turning an interaction into a result", () => {
    const a = new TrialAttempt("TA03", 2);
    a.begin();
    a.inspect();
    expect(a.snapshot().puzzle).toBeNull();
    a.answer(0, trialPuzzles(a.definition, 2)[0]!.answer);
    expect(a.snapshot().successes).toBe(0);
    walkTrial(a, a.currentPoint!);
    a.inspect();
    const correct = trialPuzzles(a.definition, 2)[0]!.answer;
    a.answer(0, correct);
    expect(a.snapshot().successes).toBe(1);
    a.answer(0, correct);
    expect(a.snapshot().successes).toBe(1);
    walkTrial(a, a.currentPoint!);
    a.inspect();
    a.answer(1, "wrong");
    expect(a.snapshot().errors).toBe(1);
    expect(a.snapshot().outcome).toBe("running");
    a.answer(1, "wrong");
    expect(a.snapshot().outcome).toBe("failed");
  });
  it("module selection requires actual count, roles, uniqueness and energy", () => {
    for (const tier of [1, 2, 3] as TrialTier[]) {
      const a = new TrialAttempt("TN08", tier),
        p = trialPuzzles(a.definition, tier)[0]!;
      expect(moduleSolutionValid(p, ["mn-scanner", "mn-scanner"])).toBe(false);
      expect(moduleSolutionValid(p, ["mn-cooling", "mn-optics", "mn-shield"])).toBe(false);
      expect(moduleSolutionValid(p, [])).toBe(false);
    }
  });
  it("cannot complete a positioning sequence by attacking without the required route", () => {
    const a = new TrialAttempt("TP09", 1);
    a.begin();
    const id = a.snapshot().targets[0]!.id;
    for (let i = 0; i < 200; i++) {
      a.session.command({ type: "target", id });
      a.session.command({ type: "ability", ability: "R" });
      tickTrial(a);
    }
    expect(a.snapshot().targets[0]!.hits).toBeGreaterThan(0);
    expect(a.snapshot().successes).toBe(0);
    a.abandon();
    expect(a.session.practiceTargets.list(null)).toHaveLength(0);
  });
});
