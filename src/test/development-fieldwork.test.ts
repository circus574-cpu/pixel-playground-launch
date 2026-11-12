import { inSafeCity } from "../game/city/types";
import { describe, it, expect } from "vitest";
import { FIELDWORK } from "../game/development/fieldwork/catalog";
import { understandingBook, earnedSources } from "../game/development/fieldwork/knowledge";
import { CurrentDevelopmentSchema } from "../game/development/state";
import { RACE_IDS } from "../game/world/races";
import { distance } from "../game/navigation";
import { developmentWorld, advanceWorld } from "./helpers/developmentWorld";
import type { GameSession } from "../game/session";

function field(s: GameSession, id: string) {
  return s.fieldwork.snapshot().entries.find((e) => e.id === id)!;
}
function reach(s: GameSession, id: string) {
  s.fieldwork.refresh();
  const step = field(s, id).progress.step;
  s.command({ type: "fieldwork", action: "go", id });
  for (
    let t = 0;
    t < 2400 &&
    field(s, id).progress.step === step &&
    (!field(s, id).near || distance(s.player, field(s, id).target!.point) > 20);
    t++
  ) {
    s.command({ type: "dialogue", action: "close" });
    s.tick(50);
  }
  expect(
    field(s, id).progress.step > step || field(s, id).near,
    id + ": " + s.notice + " " + JSON.stringify(field(s, id).target),
  ).toBe(true);
  s.command({ type: "cancel" });
}
describe("real world racial-domain interactions", () => {
  it("has exactly sixteen domains with three finite stages and no extra reward source", () => {
    expect(FIELDWORK).toHaveLength(48);
    expect(new Set(FIELDWORK.map((f) => f.id)).size).toBe(48);
    for (const race of RACE_IDS) expect(FIELDWORK.filter((f) => f.race === race)).toHaveLength(12);
  });
  it.each(RACE_IDS)("requires actual ranks, proximity and a live owned save: %s", (race) => {
    const { s } = developmentWorld(race, false);
    const e = s.fieldwork.snapshot().entries[0]!;
    s.command({ type: "fieldwork", action: "start", id: e.id });
    expect(s.fieldwork.snapshot().active).toBeNull();
    expect(s.player.development!.fieldwork).toEqual({});
    expect(field(s, e.id).locked).toContain("stopień");
  });
  it.each(
    FIELDWORK.filter((f) =>
      ["trace", "shortcut", "circuit", "allocation", "evidence", "recovery"].includes(f.mode),
    ),
  )("persists physical stages without duplicate practice: $id", (def) => {
    const { s, port } = developmentWorld(def.race);
    // Earlier terrain stages are explicit prerequisites, not the behavior under test.
    for (const f of FIELDWORK.filter(
      (f) => f.race === def.race && f.domain === def.domain && f.tier < def.tier,
    ))
      s.player.development!.fieldwork[f.id] = { step: f.steps, done: true };
    expect(s.saves!.save(s.player)).toBe(true);
    const before = structuredClone(s.player.development!);
    const economic = { xp: s.player.xp, level: s.player.level, gold: s.player.gold };
    s.command({ type: "fieldwork", action: "start", id: def.id });
    expect(s.fieldwork.snapshot().active).toBeNull();
    reach(s, def.id);
    s.command({ type: "fieldwork", action: "start", id: def.id });
    expect(s.fieldwork.snapshot().active?.id, s.notice).toBe(def.id);
    for (let n = 0; n < def.steps && !field(s, def.id).progress.done; n++) {
      reach(s, def.id);
      const e = field(s, def.id);
      if (e.puzzle) {
        s.command({ type: "fieldwork", action: "act", id: def.id, answer: "invalid" });
        expect(field(s, def.id).progress).toEqual(e.progress);
        const answer = e.puzzle.allocation
          ? `${e.puzzle.allocation.first},${e.puzzle.allocation.second}`
          : def.mode === "evidence"
            ? e.puzzle.options[0]!.id
            : def.mode === "recovery"
              ? e.puzzle.options[e.progress.step]!.id
              : `Węzeł ${e.progress.step + 1}`;
        s.command({ type: "fieldwork", action: "act", id: def.id, answer });
      } else advanceWorld(s, 50);
    }
    expect(field(s, def.id).progress, s.notice).toEqual({ step: def.steps, done: true });
    expect(CurrentDevelopmentSchema.safeParse(s.player.development).success).toBe(true);
    expect(s.player.development!.practiceEarned).toBe(before.practiceEarned);
    expect(s.player.development!.rewardReceipts).toEqual(before.rewardReceipts);
    expect({ xp: s.player.xp, level: s.player.level, gold: s.player.gold }).toEqual(economic);
    expect(s.saves!.load()!.development!.fieldwork[def.id]).toEqual(field(s, def.id).progress);
    const bytes = port.getItem("owned-character");
    s.command({ type: "fieldwork", action: "act", id: def.id, answer: "Węzeł 1" });
    expect(port.getItem("owned-character")).toBe(bytes);
  });
  it("storage failure cannot finish an installation; retry preserves only committed checkpoints", () => {
    const { s, fail } = developmentWorld("android");
    const id = "F-N-construction-1";
    reach(s, id);
    s.command({ type: "fieldwork", action: "start", id });
    fail(true);
    s.command({ type: "fieldwork", action: "act", id, answer: "Węzeł 1" });
    expect(field(s, id).progress.step).toBe(0);
    fail(false);
    s.command({ type: "fieldwork", action: "act", id, answer: "Węzeł 1" });
    expect(field(s, id).progress.step).toBe(1);
    s.command({ type: "fieldwork", action: "leave", id });
    expect(s.practiceTargets.list(s.player.interior)).toEqual([]);
    reach(s, id);
    s.command({ type: "fieldwork", action: "start", id });
    s.command({ type: "fieldwork", action: "act", id, answer: "Węzeł 2" });
    expect(field(s, id).progress.done).toBe(true);
  });
  it("the understanding book exposes twelve verified fragments, never future or undecided sources", () => {
    const { s } = developmentWorld("sage");
    expect(
      understandingBook(s.player.development)
        .flatMap((c) => c.fragments)
        .filter((f) => f.source),
    ).toHaveLength(12);
    expect(
      understandingBook(undefined)
        .flatMap((c) => c.fragments)
        .filter((f) => f.source),
    ).toHaveLength(0);
    s.player.development!.heritage.quests["H-A01"]!.choiceId = null;
    expect(earnedSources("sage", s.player.development).some((v) => v.chapter === 1)).toBe(false);
  });
  it.each(FIELDWORK.filter((f) => f.mode === "measure"))(
    "requires real basic hits and records the actual kit without free resources: $id",
    (def) => {
      const { s } = developmentWorld(def.race);
      for (const f of FIELDWORK.filter(
        (f) => f.domain === def.domain && f.race === def.race && f.tier < def.tier,
      ))
        s.player.development!.fieldwork[f.id] = { step: f.steps, done: true };
      reach(s, def.id);
      s.command({ type: "fieldwork", action: "start", id: def.id });
      const before = s.player.development!.practiceEarned;
      for (let n = 0; n < 2000 && !field(s, def.id).progress.done; n++) {
        const e = field(s, def.id),
          target = s.practiceTargets
            .list(s.player.interior)
            .find((t) => t.hp > 0 && distance(t, e.target!.point) < 5);
        expect(target, s.notice).toBeDefined();
        if (distance(s.player, target!) > Math.min(50, s.kit.basicRange * 0.6))
          s.command({ type: "move", x: target!.x, y: target!.y });
        else {
          s.command({ type: "target", id: target!.id });
          s.command({ type: "ability", ability: "R" });
        }
        s.tick(50);
      }
      expect(field(s, def.id).progress.done, s.notice).toBe(true);
      expect(s.fieldwork.snapshot().reading?.text).toContain("ATK");
      expect(s.player.development!.practiceEarned).toBe(before);
    },
  );
});

it.each(
  FIELDWORK.filter((f) =>
    [
      "channel",
      "escort",
      "protect",
      "restraint",
      "break",
      "core-band",
      "core-windows",
      "ember-band",
      "ember-windows",
    ].includes(f.mode),
  ),
)(
  "completes real owned-world activity without borrowing a trial profile: $id",
  (def) => {
    const { s } = developmentWorld(def.race);
    for (const f of FIELDWORK.filter(
      (f) => f.race === def.race && f.domain === def.domain && f.tier < def.tier,
    ))
      s.player.development!.fieldwork[f.id] = { step: f.steps, done: true };
    const before = {
      skills: [...s.player.skills],
      practice: s.player.development!.practiceEarned,
      xp: s.player.xp,
      level: s.player.level,
    };
    reach(s, def.id);
    s.command({ type: "fieldwork", action: "start", id: def.id });
    expect(s.fieldwork.snapshot().active?.id, s.notice).toBe(def.id);
    let lastActive: unknown;
    let lastRestraintHit = -1,
      wasStrike = false;
    for (let n = 0; n < 6000 && !field(s, def.id).progress.done; n++) {
      const active = s.fieldwork.snapshot().active;
      if (!active) break;
      lastActive = {
        ...active,
        heroFx: s.fx.active,
        hero: { x: s.player.x, y: s.player.y },
        enemies: s.enemies.map((e) => ({
          kind: e.kind,
          x: e.x,
          y: e.y,
          hp: e.hp,
          phase: e.m.phase,
        })),
      };
      const a = active.activity,
        cast = (ability: "R" | "C1" | "C4" | "B1") => {
          if (!s.kit.remaining(ability)) s.command({ type: "ability", ability });
        };
      if (def.mode === "escort" || def.mode === "protect") {
        const enemy = s.enemies.find((e) => e.encounterOwner && e.hp > 0 && e.mode !== "dead");
        if (enemy) {
          if (distance(s.player, enemy) > s.kit.basicRange * 0.75)
            s.command({ type: "move", x: enemy.x, y: enemy.y });
          else {
            s.command({ type: "target", id: enemy.id });
            cast("R");
          }
        } else {
          const actor = a && "actor" in a ? a.actor : null;
          if (actor)
            expect(
              inSafeCity(s.world, actor, null),
              def.id + ": companion entered a safe city",
            ).toBe(false);
          const point = actor && distance(s.player, actor) > 190 ? actor : active.target.point;
          s.command({ type: "move", x: point.x, y: point.y });
        }
      } else if (def.mode === "channel") {
        if (!s.kit.channel) {
          if (distance(s.player, active.target.point) > 25)
            s.command({ type: "move", ...active.target.point });
          else {
            s.command({ type: "cancel" });
            cast("C1");
          }
        }
      } else if (def.mode === "restraint") {
        if (!a || !("windows" in a)) throw Error("Missing restraint activity");
        const target = s.practiceTargets.list(s.player.interior)[0]!;
        if (distance(s.player, target) > Math.min(40, s.kit.basicRange * 0.7))
          s.command({ type: "move", x: target.x, y: target.y });
        else if (a.phase === "strike") {
          if (!wasStrike) {
            lastRestraintHit = target.hits;
            wasStrike = true;
          }
          if (target.hits === lastRestraintHit) {
            s.command({ type: "target", id: target.id });
            cast("R");
          }
        } else wasStrike = false;
      } else if (a && "point" in a && a.point) {
        if (distance(s.player, a.point) > 15) s.command({ type: "move", ...a.point });
        else {
          s.command({ type: "cancel" });
          if ("targetId" in a) s.command({ type: "target", id: a.targetId });
          if (def.mode === "break") {
            if (a.phase === "window") cast("B1");
          } else if ("value" in a) {
            if (def.mode.endsWith("windows")) {
              if (a.phase === "window") cast(def.mode === "core-windows" ? "C1" : "C4");
              else if (a.phase === "build" && a.value / a.max < 0.35) cast("R");
            } else if (a.value / a.max < (def.mode === "core-band" ? 0.45 : 0.5)) cast("R");
          }
        }
      }
      s.tick(50);
      s.events.length = 0;
    }
    expect(
      field(s, def.id).progress.done,
      def.id +
        ": " +
        s.notice +
        " " +
        JSON.stringify({
          active: s.fieldwork.snapshot().active,
          lastActive,
          player: { x: s.player.x, y: s.player.y },
          enemies: s.enemies.map((e) => ({ id: e.id, hp: e.hp, phase: e.m.phase, x: e.x, y: e.y })),
        }),
    ).toBe(true);
    expect(s.player.skills).toEqual(before.skills);
    expect(s.player.development!.practiceEarned).toBe(before.practice);
    expect({ xp: s.player.xp, level: s.player.level }).toEqual({
      xp: before.xp,
      level: before.level,
    });
    expect(s.practiceTargets.list(s.player.interior)).toHaveLength(0);
    expect(s.enemies.filter((e) => e.encounterOwner)).toHaveLength(0);
    expect(s.saves!.load()!.development!.fieldwork[def.id]?.done).toBe(true);
  },
  20000,
);
