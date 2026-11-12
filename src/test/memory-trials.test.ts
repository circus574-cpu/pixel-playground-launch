import { describe, expect, it } from "vitest";
import { TrialAttempt } from "../game/development/trials/attempt";
import { domainRank } from "../game/development/trials/catalog";
import { trialPuzzles } from "../game/development/trials/puzzles";
import { completeTrial, tickTrial, walkTrial } from "./helpers/racialTrials";

const ids = ["TA10", "TA11", "TA12"] as const;
describe("Sage memory uses readable sources and ordered, owned interactions", () => {
  for (const id of ids)
    for (const tier of [1, 2, 3] as const)
      it(`${id} tier ${tier}: finishes only after every required evidence interaction`, () => {
        const a = new TrialAttempt(id, tier),
          owner = structuredClone(a.session.player);
        const puzzles = trialPuzzles(a.definition, tier);
        expect(puzzles).toHaveLength(id === "TA11" ? tier + 1 : tier + 2);
        expect(
          puzzles.every((p) => p.documents.length && p.documents.every((d) => d.text.length > 80)),
        ).toBe(true);
        tickTrial(a, 100);
        expect(a.snapshot().successes).toBe(0);
        expect(a.session.nowMs).toBe(0);
        completeTrial(a);
        expect(a.snapshot().successes).toBe(puzzles.length);
        expect(a.session.player.xp).toBe(owner.xp);
        expect(a.session.player.gold).toBe(owner.gold);
        expect(a.session.player.items).toEqual(owner.items);
        expect(a.session.player.skills).toEqual(owner.skills);
        expect(a.session.player.development).toBeUndefined();
        expect(a.session.saves).toBeUndefined();
      });
  it.each(ids)("%s rejects distant, unread, stale and repeated answers", (id) => {
    const a = new TrialAttempt(id, 1),
      puzzles = trialPuzzles(a.definition, 1);
    a.begin();
    a.answer(0, puzzles[0]!.answer);
    expect(a.snapshot().successes).toBe(0);
    walkTrial(a, a.currentPoint!);
    a.inspect();
    expect(a.snapshot().puzzle).not.toHaveProperty("answer");
    a.answer(1, puzzles[1]!.answer);
    expect(a.snapshot().successes).toBe(0);
    a.answer(0, puzzles[0]!.answer);
    expect(a.snapshot().successes).toBe(1);
    a.answer(0, puzzles[0]!.answer);
    expect(a.snapshot().successes).toBe(1);
    walkTrial(a, a.currentPoint!);
    a.inspect();
    const before = a.snapshot().activeMs;
    a.suspend(true);
    tickTrial(a, 100);
    a.answer(1, puzzles[1]!.answer);
    expect(a.snapshot().activeMs).toBe(before);
    expect(a.snapshot().successes).toBe(1);
    a.suspend(false);
    a.abandon();
    a.answer(1, puzzles[1]!.answer);
    expect(a.snapshot().outcome).toBe("abandoned");
  });
  it("fragment attribution requires the source containing that exact fragment", () => {
    const a = new TrialAttempt("TA10", 3);
    a.begin();
    walkTrial(a, a.currentPoint!);
    a.inspect();
    const p = a.snapshot().puzzle!;
    expect(p.prompt).toContain("zachodnim pomoście");
    expect(p.documents[0]!.text).toContain("Dziennik przewoźniczki: „Na zachodnim pomoście");
    a.answer(0, p.options.find((o) => o.label === "Rejestr kopisty")!.id);
    expect(a.snapshot().outcome).toBe("failed");
    expect(a.snapshot().successes).toBe(0);
  });
  it("the testimony distinguishes an unsupported claim from two supported claims", () => {
    const a = new TrialAttempt("TA11", 1);
    expect(a.instructions()).toContain("Brak dowodu nie oznacza");
    a.begin();
    walkTrial(a, a.currentPoint!);
    a.inspect();
    const p = a.snapshot().puzzle!;
    expect(p.documents[0]!.text).toContain("dwie skrzynie");
    expect(p.documents[0]!.text).not.toContain("identyczne dokumenty");
    a.answer(0, p.options.find((o) => o.label === "Dostarczono dwie skrzynie")!.id);
    expect(a.snapshot().outcome).toBe("failed");
  });
  it("chronology cannot be completed by putting a later event first", () => {
    const a = new TrialAttempt("TA12", 3);
    a.begin();
    walkTrial(a, a.currentPoint!);
    a.inspect();
    a.answer(0, a.snapshot().puzzle!.options.find((o) => o.label === "Sprawdzenie pieczęci")!.id);
    expect(a.snapshot().outcome).toBe("failed");
  });
  for (const tier of [1, 2, 3] as const)
    for (const fabrication of ["autorką dopisku jest Sora", "usuń informację"])
      it(`tier ${tier}: rejects replacing the unknown author with ${fabrication}`, () => {
        const a = new TrialAttempt("TA12", tier),
          puzzles = trialPuzzles(a.definition, tier);
        a.begin();
        for (let i = 0; i < puzzles.length - 1; i++) {
          walkTrial(a, a.currentPoint!);
          a.inspect();
          a.answer(i, puzzles[i]!.answer);
        }
        walkTrial(a, a.currentPoint!);
        a.inspect();
        const p = a.snapshot().puzzle!;
        expect(p.documents[0]!.text).toContain("autora nie ustalono");
        expect(p.options.find((o) => o.id === puzzles.at(-1)!.answer)?.label).toContain(
          "autor dopisku: nieustalony",
        );
        a.answer(puzzles.length - 1, p.options.find((o) => o.label.includes(fabrication))!.id);
        expect(a.snapshot().outcome).toBe("failed");
        expect(a.snapshot().successes).toBe(puzzles.length - 1);
      });
  it("memory ranks are separate from Planetary memory and require all three trials", () => {
    expect(domainRank({ TA10: 3, TA11: 3 }, "sage", "source-memory")).toBe(0);
    expect(domainRank({ TA10: 3, TA11: 2, TA12: 3 }, "sage", "source-memory")).toBe(2);
    expect(domainRank({ TA10: 3, TA11: 3, TA12: 3 }, "planetary", "memory")).toBe(0);
  });
});
