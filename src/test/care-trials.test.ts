import { describe, it, expect } from "vitest";
import { TrialAttempt } from "../game/development/trials/attempt";
import {
  trialPuzzles,
  packAnswerValid,
  allocationAnswerValid,
  publicPuzzle,
} from "../game/development/trials/puzzles";
import { tickTrial, walkTrial, completeTrial } from "./helpers/racialTrials";

describe("Opieka: a complete pack, conserved water and timed terrain cover", () => {
  it.each([1, 2, 3] as const)(
    "pack tier %i requires exactly the right unique ingredients",
    (tier) => {
      const a = new TrialAttempt("TV07", tier),
        p = trialPuzzles(a.definition, tier)[0]!;
      expect(publicPuzzle(p)).not.toHaveProperty("answer");
      expect(packAnswerValid(p, p.answer)).toBe(true);
      const ids = p.answer.split(",");
      expect(packAnswerValid(p, ids.slice(1).join(","))).toBe(false);
      expect(packAnswerValid(p, [...ids, ids[0]!].join(","))).toBe(false);
      expect(packAnswerValid(p, [...ids.slice(1), "unknown"].join(","))).toBe(false);
      expect(packAnswerValid(p, [...ids].reverse().join(","))).toBe(true);
      expect(p.answer.length).toBeLessThanOrEqual(80);
      completeTrial(a);
      expect(a.snapshot().successes).toBe(tier + 2);
    },
  );
  it.each([1, 2, 3] as const)(
    "water tier %i has a feasible allocation and cannot invent units",
    (tier) => {
      const a = new TrialAttempt("TV08", tier),
        p = trialPuzzles(a.definition, tier)[0]!;
      expect(allocationAnswerValid(p, p.answer)).toBe(true);
      for (const value of [
        "-1,5",
        "1.5,2.5",
        "NaN,0",
        "0,0",
        "100,100",
        "Infinity,0",
        "1,2,3",
        "9007199254740992,0",
      ])
        expect(allocationAnswerValid(p, value), value).toBe(false);
      expect(allocationAnswerValid(p, `${p.allocation!.total},0`)).toBe(false);
      completeTrial(a);
      expect(a.snapshot().successes).toBe([4, 6, 8][tier - 1]);
    },
  );
  it("an invalid pack or missing water is a failed attempt, not a partial reward", () => {
    for (const id of ["TV07", "TV08"] as const) {
      const a = new TrialAttempt(id, 1);
      a.begin();
      walkTrial(a, a.currentPoint!);
      a.inspect();
      a.answer(0, "");
      expect(a.snapshot().outcome).toBe("failed");
      expect(a.snapshot().successes).toBe(0);
    }
  });
  it("does not finish camp early after the first visit to all nodes", () => {
    const a = new TrialAttempt("TV09", 1);
    a.begin();
    for (let i = 0; i < 2; i++) {
      walkTrial(a, a.currentPoint!);
      const window = a.snapshot().camp!.windowMs;
      tickTrial(a, Math.ceil(window / 50));
    }
    expect(a.snapshot().successes).toBe(2);
    expect(a.snapshot().outcome).toBe("running");
    expect(a.snapshot().camp!.remainingMs).toBe(25000);
    completeTrial(a);
    expect(a.snapshot().activeMs).toBe(45000);
  });
  it("waiting away from cover fails the camp, while suspension stops its clock", () => {
    const a = new TrialAttempt("TV09", 3);
    a.begin();
    tickTrial(a, 50);
    const t = a.snapshot().activeMs;
    a.suspend(true);
    tickTrial(a, 400);
    expect(a.snapshot().activeMs).toBe(t);
    a.suspend(false);
    tickTrial(a, 200);
    expect(a.snapshot().outcome).toBe("failed");
  });
  it.each([1, 2, 3] as const)("camp tier %i uses actual walls for every defended point", (tier) => {
    const a = new TrialAttempt("TV09", tier);
    completeTrial(a);
    const r = a.snapshot().camp!;
    expect(a.snapshot().activeMs).toBe([45000, 60000, 75000][tier - 1]);
    expect(r.completed).toBe(tier + 1);
    expect(r.points.every((p) => p.guarded)).toBe(true);
    expect(a.session.loot).toEqual([]);
    expect(a.session.saves).toBeUndefined();
  });
  it("camp cancellation cannot continue ticking or award a result", () => {
    const a = new TrialAttempt("TV09", 1);
    a.begin();
    tickTrial(a, 50);
    a.abandon();
    const r = a.snapshot();
    tickTrial(a, 2000);
    expect(a.snapshot()).toEqual(r);
    expect(a.passed).toBe(false);
  });
});
