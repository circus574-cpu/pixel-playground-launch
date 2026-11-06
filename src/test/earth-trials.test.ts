import { describe, it, expect } from "vitest";
import { TrialAttempt } from "../game/development/trials/attempt";
import { trialPuzzles } from "../game/development/trials/puzzles";
import { completeTrial, tickTrial, walkTrial } from "./helpers/racialTrials";
import { distance } from "../game/navigation";

describe("Żywa Ziemia — real actions and independent objectives", () => {
  it("marking does not count as cleaning; a clean without a prior mark fails", () => {
    const a = new TrialAttempt("TV06", 1);
    a.begin();
    walkTrial(a, a.currentPoint!);
    a.inspect();
    const puzzles = trialPuzzles(a.definition, 1);
    const clean = puzzles[0]!.options.find((o) => o.label === "Oczyść Północ")!;
    a.answer(0, clean.id);
    expect(a.snapshot().outcome).toBe("failed");
    expect(a.snapshot().successes).toBe(0);
    const b = new TrialAttempt("TV06", 1);
    b.begin();
    walkTrial(b, b.currentPoint!);
    b.inspect();
    const at = { ...b.currentPoint! };
    b.answer(0, puzzles[0]!.answer);
    expect(b.snapshot().successes).toBe(0);
    expect(b.currentPoint).toEqual(at);
    b.answer(0, puzzles[0]!.answer);
    expect(b.snapshot().round).toBe(1);
    b.inspect();
    b.answer(1, puzzles[1]!.answer);
    expect(b.snapshot().successes).toBe(1);
  });
  it("refuses marking healthy ground and repairing out of dependency order", () => {
    for (const id of ["TV04", "TV06"] as const) {
      const a = new TrialAttempt(id, 3);
      a.begin();
      walkTrial(a, a.currentPoint!);
      a.inspect();
      const p = trialPuzzles(a.definition, 3)[0]!;
      const wrong = p.options.find((o) => o.id !== p.answer)!;
      a.answer(0, wrong.id);
      expect(a.snapshot().outcome).toBe("failed");
      expect(a.snapshot().successes).toBe(0);
    }
  });
  it("two counterattacks do not replace the required four avoided strikes", () => {
    const a = new TrialAttempt("TV05", 1);
    a.begin();
    for (let i = 0; i < 3000 && a.snapshot().successes < 2; i++) {
      const r = a.snapshot(),
        s = a.session;
      if (r.phase === "warning" && r.danger)
        s.command({ type: "move", x: r.danger.x, y: r.danger.y + (r.danger.y > 400 ? -155 : 155) });
      else if (r.phase === "counter") {
        const target = r.targets[0]!;
        if (distance(s.player, target) > s.kit.basicRange * 0.7)
          s.command({ type: "move", x: 600, y: 350 });
        else {
          s.command({ type: "target", id: target.id });
          s.command({ type: "ability", ability: "R" });
        }
      } else s.command({ type: "cancel" });
      tickTrial(a);
    }
    expect(a.snapshot().successes).toBe(2);
    expect(a.snapshot().dodges).toBe(2);
    expect(a.snapshot().outcome).toBe("running");
    completeTrial(a);
    expect(a.snapshot().dodges).toBe(4);
    expect(a.snapshot().successes).toBe(2);
  });
  it("cancelled rhythm cannot keep counting hits or time", () => {
    const a = new TrialAttempt("TV05", 3);
    a.begin();
    a.abandon();
    const result = a.snapshot();
    tickTrial(a, 100);
    expect(a.snapshot()).toEqual(result);
    expect(a.session.practiceTargets.list(null)).toEqual([]);
  });
});
