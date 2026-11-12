import { describe, it, expect } from "vitest";
import { TrialAttempt } from "../game/development/trials/attempt";
import { completeTrial, tickTrial, walkTrial } from "./helpers/racialTrials";
import { loanSession } from "../game/development/loan";

describe("Legend body trials", () => {
  for (const id of ["TP01", "TP02"] as const)
    for (const tier of [1, 2, 3] as const)
      it(`${id} grade ${tier}: physical route or real shield breaks`, () => {
        const a = new TrialAttempt(id, tier);
        completeTrial(a);
        expect(a.snapshot().outcome).toBe("passed");
      });
  it("load changes actual movement speed only inside the loan", () => {
    const s = loanSession("legend");
    s.player.level = 20;
    const a = new TrialAttempt("TP01", 1);
    expect(a.session.kit.stats.speed).toBeCloseTo(s.kit.stats.speed * 0.8);
    a.abandon();
    expect(a.session.kit.stats.speed).toBeCloseTo(s.kit.stats.speed);
  });
  it("R cannot break the technical shield or replace B1", () => {
    const a = new TrialAttempt("TP02", 1);
    a.begin();
    walkTrial(a, a.currentPoint!);
    while (a.snapshot().body!.phase !== "window") tickTrial(a);
    const r = a.snapshot().body!;
    if (r.kind !== "break-windows") throw Error("Wrong fixture");
    a.session.command({ type: "target", id: r.targetId });
    a.session.command({ type: "ability", ability: "R" });
    tickTrial(a);
    expect(a.snapshot().successes).toBe(0);
    expect(a.snapshot().body).toMatchObject({ shielded: true, errors: 1 });
  });
});
