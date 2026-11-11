import { describe, expect, it } from "vitest";
import { TrialAttempt } from "../game/development/trials/attempt";
import { FOCUS_ROOM } from "../game/development/trials/focus";
import { domainRank, TRIALS } from "../game/development/trials/catalog";
import { completeTrial, tickTrial, walkTrial } from "./helpers/racialTrials";

function readyFlow() {
  const a = new TrialAttempt("TA07", 1);
  a.begin();
  walkTrial(a, a.currentPoint!);
  for (let i = 0; i < 100 && a.snapshot().focus!.phase !== "ready"; i++) tickTrial(a);
  expect(a.snapshot().focus!.phase).toBe("ready");
  a.session.command({ type: "cancel" });
  return a;
}
function feed(a: TrialAttempt, choice: string) {
  walkTrial(a, a.currentPoint!);
  a.inspect();
  a.answer(a.snapshot().round, choice);
}

describe("Skupienie uses real channels, cumulative KI and actively maintained nodes", () => {
  it.each([1, 2, 3] as const)(
    "tier %i completes real C1 cycles with normal cooldown and no save",
    (tier) => {
      const a = new TrialAttempt("TA07", tier);
      completeTrial(a);
      expect(a.session.player.skills).toEqual(["R", "C1"]);
      expect(a.session.kit.channelResult).toMatchObject({
        serial: tier + 1,
        id: "C1",
        completed: true,
      });
      expect(a.session.kit.remaining("C1")).toBeGreaterThan(10000);
      expect(a.session.kit.defs["C1"]!.cd).toBe(15000);
      expect(a.session.saves).toBeUndefined();
    },
  );
  it("signals for at least 1500 ms before accepting a channel", () => {
    const a = new TrialAttempt("TA07", 1);
    a.begin();
    walkTrial(a, a.currentPoint!);
    a.session.command({ type: "cancel" });
    expect(FOCUS_ROOM.cueMs).toBe(1500);
    const r = a.snapshot().focus!;
    expect(r.phase).toBe("cue");
    expect(r.remainingMs).toBeGreaterThan(1000);
    const deadline = a.session.nowMs + r.remainingMs;
    while (a.session.nowMs + 50 < deadline) tickTrial(a);
    expect(a.snapshot().focus!.phase).toBe("cue");
    tickTrial(a);
    expect(a.session.nowMs).toBeGreaterThanOrEqual(deadline);
    expect(a.snapshot().focus!.phase).toBe("ready");
  });
  it("starting C1 before the end of the cue fails rather than completing a flow cycle", () => {
    const a = new TrialAttempt("TA07", 1);
    a.begin();
    walkTrial(a, a.currentPoint!);
    a.session.command({ type: "cancel" });
    a.session.command({ type: "ability", ability: "C1" });
    tickTrial(a);
    expect(a.snapshot().outcome).toBe("failed");
    expect(a.snapshot().successes).toBe(0);
  });
  it.each(["move", "hit", "other"] as const)(
    "%s interruption on the final channel tick cannot become completion",
    (reason) => {
      const a = readyFlow();
      a.session.command({ type: "ability", ability: "C1" });
      tickTrial(a, 59);
      expect(a.session.kit.channel!.ms).toBe(50);
      if (reason === "move") a.session.manual(1, 0, 50);
      else if (reason === "hit") a.session.kit.absorb(1, "other");
      else a.session.kit.interruptChannel("other");
      tickTrial(a);
      expect(a.session.kit.channelResult).toMatchObject({ id: "C1", completed: false });
      expect(a.snapshot().outcome).toBe("failed");
      expect(a.snapshot().successes).toBe(0);
    },
  );
  it("a previous completed receipt cannot replace another channel", () => {
    const a = readyFlow();
    a.session.command({ type: "ability", ability: "C1" });
    tickTrial(a, 60);
    expect(a.snapshot().successes).toBe(1);
    tickTrial(a, 1500);
    expect(a.passed).toBe(false);
    expect(a.snapshot().successes).toBe(1);
  });
  it.each([1, 2, 3] as const)(
    "tier %i spends actual borrowed KI within its cumulative limit",
    (tier) => {
      const a = new TrialAttempt("TA08", tier);
      completeTrial(a);
      const r = a.snapshot().focus!;
      expect(r.spentKi).toBeCloseTo(a.session.kit.stats.maxKi * 0.1 * (tier + 2));
      expect(r.budgetKi).toBeCloseTo(a.session.kit.stats.maxKi * [0.7, 0.65, 0.6][tier - 1]!);
      expect(r.spentKi).toBeLessThanOrEqual(r.budgetKi);
      expect(a.session.player.skills).toEqual(["R"]);
    },
  );
  it("regeneration cannot refund spending; an inefficient route fails on total cost", () => {
    const a = new TrialAttempt("TA08", 3);
    a.begin();
    feed(a, "wide");
    feed(a, "wide");
    tickTrial(a, 10000);
    const before = a.session.player.ki;
    expect(before).toBe(a.session.kit.stats.maxKi);
    feed(a, "precise");
    expect(a.snapshot().successes).toBe(3);
    feed(a, "precise");
    expect(a.snapshot().outcome).toBe("failed");
    expect(a.snapshot().successes).toBe(3);
  });
  it("a mixed route within the limit is valid, not an opaque correct answer", () => {
    const a = new TrialAttempt("TA08", 1);
    a.begin();
    feed(a, "wide");
    feed(a, "precise");
    feed(a, "wide");
    expect(a.passed).toBe(true);
    expect(a.snapshot().focus!.spentKi).toBeCloseTo(a.session.kit.stats.maxKi * 0.6);
  });
  it("wrong round, absent inspection and duplicate answers cannot charge another target", () => {
    const a = new TrialAttempt("TA08", 1);
    a.begin();
    a.inspect();
    expect(a.snapshot().puzzle).toBeNull();
    a.answer(0, "precise");
    expect(a.snapshot().successes).toBe(0);
    walkTrial(a, a.currentPoint!);
    a.answer(0, "precise");
    expect(a.snapshot().successes).toBe(0);
    a.inspect();
    expect(a.snapshot().puzzle).not.toHaveProperty("answer");
    a.answer(1, "precise");
    a.answer(0, "unknown");
    expect(a.snapshot().successes).toBe(0);
    const before = a.session.player.ki;
    a.answer(0, "precise");
    expect(before - a.session.player.ki).toBeCloseTo(a.session.kit.stats.maxKi * 0.1);
    a.answer(0, "precise");
    expect(a.snapshot().successes).toBe(1);
  });
  it.each([1, 2, 3] as const)(
    "tier %i holds all nodes for the complete required duration",
    (tier) => {
      const a = new TrialAttempt("TA09", tier);
      completeTrial(a);
      expect(a.snapshot().activeMs).toBeGreaterThanOrEqual([45000, 60000, 75000][tier - 1]!);
      expect(a.snapshot().focus!.remainingMs).toBe(0);
      expect(a.snapshot().focus!.nodes).toHaveLength(tier + 1);
      expect(a.snapshot().focus!.nodes.every((n) => n.remainingMs > 0)).toBe(true);
    },
  );
  it("visiting once and going AFK loses a node before the full duration", () => {
    const a = new TrialAttempt("TA09", 1);
    a.begin();
    for (let i = 0; i < 2; i++) {
      walkTrial(a, a.currentPoint!);
      tickTrial(a, 12);
    }
    tickTrial(a, 600);
    expect(a.passed).toBe(false);
    expect(a.snapshot().outcome).toBe("failed");
    expect(a.snapshot().activeMs).toBeLessThan(45000);
  });
  it("the marked hazard fails the attempt through actual movement", () => {
    const a = new TrialAttempt("TA09", 1);
    a.begin();
    a.session.command({ type: "move", x: 520, y: 340 });
    tickTrial(a, 100);
    expect(a.snapshot().outcome).toBe("failed");
    expect(a.snapshot().reason).toContain("zagrożenia");
  });
  it.each(["TA07", "TA08", "TA09"] as const)(
    "%s respects suspension, readiness and cancellation",
    (id) => {
      const a = new TrialAttempt(id, 1);
      tickTrial(a, 1000);
      expect(a.snapshot().activeMs).toBe(0);
      a.begin();
      tickTrial(a, 10);
      a.suspend(true);
      const before = a.snapshot();
      tickTrial(a, 2000);
      expect(a.snapshot()).toEqual(before);
      a.suspend(false);
      a.abandon();
      const final = a.snapshot();
      tickTrial(a, 2000);
      expect(a.snapshot()).toEqual(final);
      expect(a.passed).toBe(false);
    },
  );
  it("the focus rank requires all three trials and their minimum tier", () => {
    expect(TRIALS.filter((t) => t.race === "sage" && t.domain === "focus")).toHaveLength(3);
    expect(domainRank({ TA07: 3, TA08: 3 }, "sage", "focus")).toBe(0);
    expect(domainRank({ TA07: 3, TA08: 2, TA09: 1 }, "sage", "focus")).toBe(1);
    expect(domainRank({ TA07: 3, TA08: 2, TA09: 3 }, "sage", "focus")).toBe(2);
  });
});
