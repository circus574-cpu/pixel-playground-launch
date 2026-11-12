import { describe, expect, it } from "vitest";
import { TrialAttempt } from "../game/development/trials/attempt";
import { RecoveryUnit } from "../game/development/trials/recoveryUnit";
import { completeTrial } from "./helpers/racialTrials";

describe("Android identity and safe recovery", () => {
  for (const id of ["TN10", "TN11", "TN12"] as const)
    for (const tier of [1, 2, 3] as const)
      it(`${id} grade ${tier} is completable through inspected materials`, () => {
        const a = new TrialAttempt(id, tier);
        completeTrial(a);
        if (id === "TN12")
          expect(a.snapshot().recovery).toMatchObject({
            memoryIntact: true,
            complete: true,
            powered: true,
          });
      });
  it("cannot erase memory, skip prerequisites or replay a step", () => {
    const unit = new RecoveryUnit(3);
    expect(unit.execute("RESETUJ PAMIĘĆ — brak uprawnienia")).toBe(false);
    expect(unit.execute(unit.steps[2]!)).toBe(false);
    expect(unit.execute(unit.steps[0]!)).toBe(true);
    expect(unit.execute(unit.steps[0]!)).toBe(false);
    expect(unit.snapshot()).toMatchObject({
      stage: 1,
      memoryIntact: true,
      complete: false,
      powered: false,
    });
  });
});
