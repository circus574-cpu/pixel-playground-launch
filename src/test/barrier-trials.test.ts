import { describe, expect, it } from "vitest";
import { TrialAttempt } from "../game/development/trials/attempt";
import { mirrorBoard, traceMirrors } from "../game/development/trials/mirrors";
import { publicPuzzle, trialPuzzles } from "../game/development/trials/puzzles";
import { completeTrial, tickTrial, walkTrial } from "./helpers/racialTrials";

describe("Barriers use borrowed shield capacity, optical routes and timed terrain cover", () => {
  it.each([1, 2, 3] as const)("tier %i resolves all mirror orientations geometrically", (tier) => {
    const board = mirrorBoard(tier),
      n = board.mirrors.length;
    let solutions = 0;
    for (let mask = 0; mask < 2 ** n; mask++) {
      const answer = Array.from({ length: n }, (_, i) => (mask & (1 << i) ? "\\" : "/")).join(",");
      const result = traceMirrors(board, answer);
      if (result.passed) {
        solutions++;
        expect(result.outcome).toBe("receiver");
        expect(result.path.at(-1)).toEqual(board.receiver);
        expect(result.path).not.toContainEqual(board.protected);
        for (const mirror of board.mirrors) expect(result.path).toContainEqual(mirror);
      }
    }
    expect(solutions).toBe(1);
    const a = new TrialAttempt("TA05", tier),
      p = trialPuzzles(a.definition, tier)[0]!;
    expect(publicPuzzle(p)).not.toHaveProperty("answer");
    expect(traceMirrors(board, p.answer).passed).toBe(true);
    expect(traceMirrors(board, Array(n).fill("\\").join(",")).outcome).toBe("protected");
    for (const bad of ["", "unknown", "NaN", "1,2", "/,/,/,/,/"])
      expect(traceMirrors(board, bad).passed).toBe(false);
  });
  it("terminates a beam initiated inside a closed optical cycle", () => {
    const board = {
      size: 8,
      source: { x: 1, y: 3 },
      receiver: { x: 7, y: 0 },
      protected: { x: 7, y: 7 },
      mirrors: [
        { x: 2, y: 3 },
        { x: 2, y: 5 },
        { x: 1, y: 5 },
        { x: 1, y: 3 },
      ],
    };
    expect(traceMirrors(board, ["\\", "/", "\\", "/"].join(",")).outcome).toBe("loop");
    expect(traceMirrors(board, ["\\", "/", "\\", "/"].join(",")).passed).toBe(false);
  });
  it("a beam into the protected point fails the actual attempt without progress", () => {
    const a = new TrialAttempt("TA05", 1);
    a.begin();
    walkTrial(a, a.currentPoint!);
    a.inspect();
    a.answer(0, ["\\", "/"].join(","));
    expect(a.snapshot().outcome).toBe("failed");
    expect(a.snapshot().successes).toBe(0);
  });
  it.each([1, 2, 3] as const)("tier %i really spends B1 capacity to preserve object HP", (tier) => {
    const a = new TrialAttempt("TA04", tier);
    const initialKi = a.session.player.ki;
    expect(a.session.kit.has("B1")).toBe(true);
    expect(a.session.player.skills).toEqual(["R", "B1"]);
    completeTrial(a);
    expect(a.snapshot().waves!.object.hp).toBe(100);
    expect(a.snapshot().waves!.completed).toBe(tier + 2);
    expect(a.session.kit.shieldPoints).toBeLessThan(a.session.kit.stats.maxHp * 0.15);
    // B1 used its normal cooldown and KI, without teaching anything to the owner.
    expect(a.session.kit.cooldowns["B1"]).toBeGreaterThan(0);
    expect(a.session.player.ki).toBeLessThan(initialKi);
    expect(a.session.saves).toBeUndefined();
  });
  it("AFK loses object HP and fails below 50%, never completing waves for a reward", () => {
    const a = new TrialAttempt("TA04", 1);
    a.begin();
    tickTrial(a, 1000);
    expect(a.snapshot().outcome).toBe("failed");
    expect(a.snapshot().waves!.object.hp).toBe(40);
    expect(a.passed).toBe(false);
  });
  it("a shield away from the interception position does not protect the object", () => {
    const a = new TrialAttempt("TA04", 1);
    a.begin();
    tickTrial(a, 30);
    a.session.command({ type: "ability", ability: "B1" });
    tickTrial(a, 36);
    expect(a.snapshot().waves!.object.hp).toBe(70);
    expect(a.session.kit.shieldPoints).toBe(a.session.kit.stats.maxHp * 0.15);
  });
  it("a bare-body interception or invulnerability cannot replace spent B1 capacity", () => {
    for (const invulnerable of [false, true]) {
      const a = new TrialAttempt("TA04", 1);
      a.begin();
      walkTrial(a, a.currentPoint!);
      if (invulnerable)
        a.session.kit.addBuff({ id: "fixture-dodge", ms: 5000, invulnerable: true });
      tickTrial(a, 80);
      expect(a.snapshot().waves!.object.hp).toBe(70);
    }
  });
  it.each([1, 2, 3] as const)(
    "tier %i covers real walls within the specified reaction window",
    (tier) => {
      const a = new TrialAttempt("TA06", tier);
      expect(a.snapshot().cover!.reactionMs).toBe([1800, 1500, 1300][tier - 1]);
      completeTrial(a);
      expect(a.snapshot().successes).toBe(tier + 2);
      expect(a.session.loot).toEqual([]);
    },
  );
  it("pre-positioning and standing still behind a wall do not count as a reaction", () => {
    const a = new TrialAttempt("TA06", 1);
    a.begin();
    walkTrial(a, a.snapshot().cover!.point);
    tickTrial(a, 100);
    expect(a.snapshot().outcome).toBe("failed");
    expect(a.snapshot().successes).toBe(0);
  });
  it("suspension freezes both activities and cancellation discards them", () => {
    for (const id of ["TA04", "TA06"] as const) {
      const a = new TrialAttempt(id, 1);
      a.begin();
      tickTrial(a, 20);
      a.suspend(true);
      const before = a.snapshot();
      tickTrial(a, 500);
      expect(a.snapshot()).toEqual(before);
      a.suspend(false);
      a.abandon();
      const abandoned = a.snapshot();
      tickTrial(a, 500);
      expect(a.snapshot()).toEqual(abandoned);
      expect(a.passed).toBe(false);
    }
  });
});
