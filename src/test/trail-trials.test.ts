import { describe, it, expect } from "vitest";
import { TrialAttempt } from "../game/development/trials/attempt";
import { trialPuzzles } from "../game/development/trials/puzzles";
import { ProtectedActor } from "../game/development/heritage/protectedActor";
import { tickTrial, walkTrial, completeTrial } from "./helpers/racialTrials";

describe("Szlaki — ordered movement, tracking and a real companion", () => {
  it("does not finish a route by waiting, and applies the canonical active deadline", () => {
    const a = new TrialAttempt("TV01", 1);
    a.begin();
    tickTrial(a, 3601);
    expect(a.snapshot().outcome).toBe("failed");
    expect(a.snapshot().successes).toBe(0);
  });
  it("counts entries, not frames inside a hazard, and fails on entry three", () => {
    const a = new TrialAttempt("TV01", 1);
    a.begin();
    const h = a.routeHazards[0]!;
    walkTrial(a, h);
    expect(a.snapshot().errors).toBe(1);
    tickTrial(a, 60);
    expect(a.snapshot().errors).toBe(1);
    for (let n = 2; n <= 3; n++) {
      walkTrial(a, { x: h.x, y: h.y + 120 });
      a.session.command({ type: "move", x: h.x, y: h.y });
      for (let i = 0; i < 100 && a.snapshot().errors < n; i++) tickTrial(a);
      expect(a.snapshot().errors).toBe(n);
    }
    expect(a.snapshot().outcome).toBe("failed");
  });
  it("only counts the next checkpoint, not a visit to the last one", () => {
    const a = new TrialAttempt("TV01", 1);
    a.begin();
    walkTrial(a, a.route[3]!);
    expect(a.snapshot().successes).toBe(0);
    expect(a.currentPoint).toEqual(a.route[0]);
    a.abandon();
  });
  it("tracking exposes exactly two/three/three choices and allows only one mistake", () => {
    for (const tier of [1, 2, 3] as const) {
      const a = new TrialAttempt("TV02", tier),
        p = trialPuzzles(a.definition, tier)[0]!;
      expect(p.options).toHaveLength(tier === 1 ? 2 : 3);
      a.begin();
      walkTrial(a, a.currentPoint!);
      a.inspect();
      const wrong = p.options.find((o) => o.id !== p.answer)!;
      a.answer(0, wrong.id);
      expect(a.snapshot().outcome).toBe("running");
      expect(a.snapshot().errors).toBe(1);
      a.answer(0, wrong.id);
      expect(a.snapshot().outcome).toBe("failed");
    }
  });
  it("an abandoned messenger dies to announced hazards rather than granting AFK checkpoints", () => {
    const a = new TrialAttempt("TV03", 1);
    a.begin();
    tickTrial(a, 600);
    expect(a.snapshot().outcome).toBe("failed");
    expect(a.snapshot().escort!.hp).toBe(40);
    expect(a.snapshot().successes).toBe(0);
    expect(a.session.loot).toEqual([]);
  });
  it("escort and hazard state stop after cancellation", () => {
    const a = new TrialAttempt("TV03", 3);
    a.begin();
    tickTrial(a, 110);
    a.abandon();
    const before = a.snapshot();
    tickTrial(a, 600);
    expect(a.snapshot()).toEqual(before);
    expect(a.snapshot().escortDanger).toBeNull();
  });
  it("environmental-only companion preserves safe-city target guards and caps damage to remaining HP", () => {
    const s = new TrialAttempt("TV01", 1).session;
    expect(() => new ProtectedActor(s, "guard", { x: 480, y: 550 }, 100, 0, true)).toThrow(
      "Invalid protected combat target",
    );
    const npc = new ProtectedActor(s, "trial-only", { x: 480, y: 550 }, 100, 0, true, false);
    expect(npc.hurtEnvironment(NaN)).toBe(0);
    expect(npc.hurtEnvironment(-10)).toBe(0);
    expect(npc.hurtEnvironment(50)).toBe(50);
    expect(npc.body.hp / npc.maxHp).toBe(0.5);
    expect(npc.hurtEnvironment(100)).toBe(50);
    expect(npc.valid()).toBe(false);
    npc.dispose();
    expect(npc.hurtEnvironment(20)).toBe(0);
  });
  it.each([1, 2, 3] as const)("escorts through all checkpoints with >=50%% HP, tier %i", (tier) => {
    const a = new TrialAttempt("TV03", tier);
    completeTrial(a);
    expect(a.snapshot().escort!.hp / a.snapshot().escort!.maxHp).toBeGreaterThanOrEqual(0.5);
  });
});
