import { describe, expect, it } from "vitest";
import {
  HERITAGE_QUESTS,
  HERITAGE_BY_ID,
  WORLD_PROJECTS,
  PROJECT_BY_ID,
} from "../game/development/heritage/catalog";
import {
  CHAPTERS,
  HERITAGE_QUEST_IDS,
  WORLD_PROJECT_IDS,
  emptyGoalProgress,
  emptyHeritageProgress,
  type HeritageGoal,
  type WorldProjectId,
} from "../game/development/heritage/types";
import {
  advanceHeritage,
  forgeProcedure,
  goalTargetIds,
  reduceGoal,
  rememberGoalEvent,
  weaponNameError,
  type GoalCommand,
  type GoalContext,
} from "../game/development/heritage/reducer";
import { RACE_IDS } from "../game/world/races";
import { MONSTER_BASE } from "../game/monsters/base.generated";

function context(goal: HeritageGoal, target = 0): GoalContext {
  return {
    owner: "slot:owner",
    race: "planetary",
    feature: goal.world ?? "verdant",
    interior: null,
    player: { x: 100, y: 100 },
    target: goalTargetIds(goal)[target]
      ? {
          id: goalTargetIds(goal)[target]!,
          point: { x: 120, y: 100 },
          feature: goal.world ?? "verdant",
          interior: null,
        }
      : null,
    visible: () => true,
    materials: {},
    currentKi: 50,
    kiCostMultiplier: 1,
    completedProjects: new Set(),
    approvedActivities: new Map(),
    approvedObservations: new Map(),
    approvedHits: new Map(),
    weaponOwned: true,
  };
}
function command(goal: HeritageGoal, kind: GoalCommand["kind"], target = 0): GoalCommand {
  return {
    owner: "slot:owner",
    goalId: goal.id,
    eventId: "event:1",
    expectedRevision: 0,
    targetId: goalTargetIds(goal)[target] ?? "",
    kind,
  } as GoalCommand;
}

describe("authored heritage content graph (data, not a browser-playability certificate)", () => {
  it("contains all four cultures, twenty-four chapters and twenty-four projects with stable unique IDs", () => {
    expect(HERITAGE_QUESTS).toHaveLength(24);
    expect(WORLD_PROJECTS).toHaveLength(24);
    expect(new Set(HERITAGE_QUESTS.map((q) => q.id))).toEqual(new Set(HERITAGE_QUEST_IDS));
    expect(new Set(WORLD_PROJECTS.map((p) => p.id))).toEqual(new Set(WORLD_PROJECT_IDS));
    const goals = [...HERITAGE_QUESTS, ...WORLD_PROJECTS].flatMap((d) => d.goals);
    expect(new Set(goals.map((g) => g.id)).size).toBe(goals.length);
  });
  it.each(RACE_IDS)(
    "has six real multi-step definitions and the exact per-race reward budget: %s",
    (race) => {
      const quests = HERITAGE_QUESTS.filter((q) => q.race === race),
        projects = WORLD_PROJECTS.filter((p) => p.race === race);
      expect(quests.map((q) => q.chapter)).toEqual(CHAPTERS);
      expect(projects).toHaveLength(6);
      expect(quests.reduce((n, q) => n + q.reward.xp, 0)).toBe(2100);
      expect(quests.reduce((n, q) => n + q.reward.practice, 0)).toBe(1700);
      expect(projects.reduce((n, p) => n + p.reward.practice, 0)).toBe(1200);
      for (const q of quests) {
        expect(q.goals.length).toBeGreaterThanOrEqual(4);
        expect(q.choices.length).toBeGreaterThanOrEqual(2);
        expect(q.choices.every((c) => c.chronicle.length > 40)).toBe(true);
        expect(q.prerequisite === null || HERITAGE_BY_ID.has(q.prerequisite)).toBe(true);
      }
    },
  );
  it("has no quest/project prerequisite cycle or unavailable guaranteed crafting component", () => {
    const definitions = new Map<
      string,
      (typeof HERITAGE_QUESTS)[number] | (typeof WORLD_PROJECTS)[number]
    >([...HERITAGE_QUESTS, ...WORLD_PROJECTS].map((d) => [d.id, d]));
    const visited = new Set<string>(),
      pending = new Set<string>();
    const visit = (id: string) => {
      expect(pending.has(id), "cycle at " + id).toBe(false);
      if (visited.has(id)) return;
      const d = definitions.get(id);
      expect(d).toBeDefined();
      pending.add(id);
      if (d!.prerequisite) visit(d!.prerequisite);
      for (const g of d!.goals)
        if (g.kind === "projects") for (const project of g.required) visit(project);
      pending.delete(id);
      visited.add(id);
    };
    for (const definition of definitions.values()) {
      visit(definition.id);
      const stock: Record<string, number> = {};
      for (const g of definition.goals) {
        if (g.kind === "recover")
          stock[g.material] = (stock[g.material] ?? 0) + g.targets.length * g.quantityPerTarget;
        if (g.kind === "craft" || g.kind === "forge")
          for (const part of g.recipe) {
            expect(
              stock[part.material] ?? 0,
              `${definition.id}: missing ${part.material}`,
            ).toBeGreaterThanOrEqual(part.quantity);
            stock[part.material] = (stock[part.material] ?? 0) - part.quantity;
          }
        if (g.kind === "solve")
          for (const puzzle of g.puzzles)
            expect(puzzle.options.filter((o) => o.id === puzzle.answerId)).toHaveLength(1);
        if (g.kind === "observe") expect(MONSTER_BASE.some((m) => m.id === g.species)).toBe(true);
      }
    }
    expect(visited.size).toBe(48);
    expect(PROJECT_BY_ID.get("P-N6")!.prerequisite).toBe("H-N05");
  });
});

describe("physical heritage goals and trust boundaries", () => {
  const inspect = HERITAGE_BY_ID.get("H-V01")!.goals.find((g) => g.kind === "inspect")!;
  it("rejects another owner, wrong target, stale revision, range, room and occluded interaction", () => {
    const p = emptyGoalProgress(),
      event = command(inspect, "inspect");
    for (const c of [
      { ...context(inspect), owner: "another" },
      { ...context(inspect), player: { x: 1000, y: 1000 } },
      { ...context(inspect), visible: () => false },
      { ...context(inspect), interior: "smithy" },
    ])
      expect(reduceGoal(inspect, p, event, c).changed).toBe(false);
    expect(
      reduceGoal(inspect, p, { ...event, expectedRevision: NaN }, context(inspect)).changed,
    ).toBe(false);
    expect(reduceGoal(inspect, p, { ...event, targetId: "other" }, context(inspect)).changed).toBe(
      false,
    );
  });
  it("requires the right dialogue response, not clicking a person", () => {
    const goal = HERITAGE_BY_ID.get("H-V01")!.goals[0]!;
    expect(goal.kind).toBe("talk");
    const p = emptyGoalProgress();
    expect(reduceGoal(goal, p, command(goal, "inspect"), context(goal)).changed).toBe(false);
    const event = { ...command(goal, "talk"), kind: "talk" as const, responseId: "record" };
    const result = reduceGoal(goal, p, event, context(goal));
    expect(result.next.outcome).toBe("done");
    expect(result.reason).not.toBe("");
    expect(reduceGoal(goal, result.next, event, context(goal)).changed).toBe(false);
  });
  it("counts distinct physical evidence and rejects double submission using the rendered revision", () => {
    const goal = HERITAGE_BY_ID.get("H-V01")!.goals.find((g) => g.id === "H-V01:homes")!;
    const event = command(goal, "inspect");
    const first = reduceGoal(goal, emptyGoalProgress(), event, context(goal));
    expect(first.next.sequence).toBe(1);
    expect(first.next.outcome).toBe("active");
    expect(reduceGoal(goal, first.next, event, context(goal)).changed).toBe(false);
    const second = reduceGoal(
      goal,
      first.next,
      { ...command(goal, "inspect", 1), eventId: "event:2", expectedRevision: 1 },
      context(goal, 1),
    );
    expect(second.next.sequence).toBe(2);
    const final = reduceGoal(
      goal,
      second.next,
      { ...command(goal, "inspect", 2), eventId: "event:3", expectedRevision: 2 },
      context(goal, 2),
    );
    expect(final.next.outcome).toBe("done");
    expect(advanceHeritage(emptyHeritageProgress(), final.next, 5).step).toBe(1);
  });
  it("preserves consent refusal and stores anonymity only after explicit agreement", () => {
    const goal = HERITAGE_BY_ID.get("H-A01")!.goals.find((g) => g.kind === "consent")!;
    const event = {
      ...command(goal, "consent"),
      kind: "consent" as const,
      granted: false,
      mode: "anonymous" as const,
    };
    expect(reduceGoal(goal, emptyGoalProgress(), event, context(goal)).changed).toBe(false);
    const result = reduceGoal(
      goal,
      emptyGoalProgress(),
      { ...event, granted: true },
      context(goal),
    );
    expect(result.next.consent[event.targetId]).toBe("anonymous");
  });
  it("checks recipe stock and KI together without partial consumption", () => {
    const goal = PROJECT_BY_ID.get("P-V1")!.goals.find((g) => g.kind === "craft")!;
    if (goal.kind !== "craft") throw Error("recipe");
    const event = command(goal, "craft");
    expect(reduceGoal(goal, emptyGoalProgress(), event, context(goal)).materials).toEqual({});
    const ctx = { ...context(goal), materials: { [goal.recipe[0]!.material]: 3 } };
    const paid = reduceGoal(goal, emptyGoalProgress(), event, ctx);
    expect(paid.materials[goal.recipe[0]!.material]).toBe(-3);
    expect(paid.next.outcome).toBe("done");
    const kiGoal = PROJECT_BY_ID.get("P-V3")!.goals.find((g) => g.id === "P-V3:flow")!;
    expect(kiGoal.kiCost).toBe(5);
    expect(
      reduceGoal(kiGoal, emptyGoalProgress(), command(kiGoal, "craft"), {
        ...context(kiGoal),
        currentKi: 4,
      }).changed,
    ).toBe(false);
    expect(
      reduceGoal(kiGoal, emptyGoalProgress(), command(kiGoal, "craft"), context(kiGoal)).kiDebit,
    ).toBe(5);
  });
  it("requires all committed projects rather than a claimed button success", () => {
    const goal = HERITAGE_BY_ID.get("H-P06")!.goals[0]!;
    const event = {
      ...command(goal, "projects"),
      kind: "projects" as const,
      source: "committed-state" as const,
    };
    expect(reduceGoal(goal, emptyGoalProgress(), event, context(goal)).changed).toBe(false);
    expect(
      reduceGoal(goal, emptyGoalProgress(), event, {
        ...context(goal),
        completedProjects: new Set<WorldProjectId>(["P-P5", "P-P6"]),
      }).next.outcome,
    ).toBe("done");
  });
  it("accepts only the next owned escort checkpoint with live nearby participants", () => {
    const goal = HERITAGE_BY_ID.get("H-V02")!.goals.find((g) => g.kind === "escort")!;
    const ctx = context(goal),
      state = emptyGoalProgress();
    const event = {
      ...command(goal, "escort-checkpoint"),
      kind: "escort-checkpoint" as const,
      source: "activity-runtime" as const,
      attemptId: "owned",
    };
    const proof = {
      owner: ctx.owner,
      goalId: goal.id,
      checkpoint: 1,
      actor: { x: 110, y: 100 },
      player: ctx.player,
      healthFraction: 1,
    };
    expect(reduceGoal(goal, state, event, ctx).changed).toBe(false);
    ctx.approvedEscortCheckpoints = new Map([["owned", proof]]);
    const first = reduceGoal(goal, state, event, ctx);
    expect(first.changed).toBe(true);
    expect(first.next.sequence).toBe(1);
    expect(first.next.outcome).toBe("active");
    for (const invalid of [
      { ...proof, owner: "other" },
      { ...proof, checkpoint: 2 },
      { ...proof, healthFraction: NaN },
      { ...proof, actor: { x: NaN, y: 100 } },
      { ...proof, player: { x: 600, y: 100 } },
    ]) {
      ctx.approvedEscortCheckpoints = new Map([["owned", invalid]]);
      expect(reduceGoal(goal, state, event, ctx).changed).toBe(false);
    }
    ctx.approvedEscortCheckpoints = new Map([["owned", proof]]);
    ctx.visible = () => false;
    expect(reduceGoal(goal, state, event, ctx).changed).toBe(false);
  });
  it("never accepts an invented activity result or observation source string", () => {
    const goal = HERITAGE_BY_ID.get("H-P05")!.goals.find((g) => g.kind === "restraint")!;
    const event = {
      ...command(goal, "activity"),
      kind: "activity" as const,
      source: "activity-runtime" as const,
      attemptId: "invented",
    };
    expect(reduceGoal(goal, emptyGoalProgress(), event, context(goal)).changed).toBe(false);
    const observation = HERITAGE_BY_ID.get("H-V03")!.goals.find((g) => g.kind === "observe")!;
    expect(observation).toBeDefined();
    if (observation.kind !== "observe") throw Error("observation");
    const observed = {
      ...command(observation, "observe"),
      kind: "observe" as const,
      source: "monster-runtime" as const,
      species: observation.species,
    };
    expect(
      reduceGoal(observation, emptyGoalProgress(), observed, context(observation)).changed,
    ).toBe(false);
  });
  it("performs the forge sequence and consumes the guaranteed part only at its final step", () => {
    const goal = HERITAGE_BY_ID.get("H-V02")!.goals.find((g) => g.kind === "forge")!;
    if (goal.kind !== "forge") throw Error("forge");
    const ctx = { ...context(goal), materials: { [goal.recipe[0]!.material]: 1 } };
    let progress = emptyGoalProgress();
    for (const step of forgeProcedure(goal, "planetary")) {
      const event = {
        ...command(goal, "forge"),
        kind: "forge" as const,
        operationId: step.id,
        expectedRevision: progress.revision,
        eventId: "forge:" + progress.revision,
      };
      const result = reduceGoal(goal, progress, event, ctx);
      progress = result.next;
      expect(Object.keys(result.materials).length).toBe(progress.outcome === "done" ? 1 : 0);
    }
    expect(progress.outcome).toBe("done");
    expect(progress.sequence).toBe(3);
  });
  it.each(["<img src=x>", "a", "a".repeat(25), "A\nB"])(
    "rejects unsafe or invalid personal names: %s",
    (value) => expect(weaponNameError(value)).not.toBe(""),
  );
  it("accepts Polish names and bounds the raw dedup window at sixty-four entries", () => {
    expect(weaponNameError("Żywy Szlak")).toBe("");
    let ids: string[] = [];
    for (let n = 0; n < 1000; n++) ids = rememberGoalEvent(ids, "event:" + n);
    expect(ids).toHaveLength(64);
    expect(ids[0]).toBe("event:936");
    expect(rememberGoalEvent(ids, "event:999")).toEqual(ids);
  });
});
