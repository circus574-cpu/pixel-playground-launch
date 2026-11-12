import { it, expect } from "vitest";
import { developmentCompletion, developmentPracticeBudget } from "../game/development/completion";
import { emptyDevelopment } from "../game/development/state";
import { RACE_IDS } from "../game/world/races";
import { HERITAGE_QUESTS, WORLD_PROJECTS } from "../game/development/heritage/catalog";
import { emptyHeritageProgress } from "../game/development/heritage/types";
import { TRIALS } from "../game/development/trials/catalog";
import { trainingCost } from "../game/development/training";

it.each(RACE_IDS)(
  "%s: exact finite practice budget funds the most expensive legal 90 ranks",
  (race) => {
    const budget = developmentPracticeBudget(race);
    expect(budget).toEqual({
      chapters: 1700,
      projects: 1200,
      trials: 5400,
      exams: 7500,
      bestiary: 2000,
      total: 17800,
    });
    expect(
      trainingCost({ strength: 30, endurance: 30, kiCapacity: 30, defense: 0, kiControl: 0 }),
    ).toBe(17550);
    expect(budget.total).toBeGreaterThanOrEqual(17550);
  },
);
it.each(RACE_IDS)(
  "%s: title needs final chapter, every project and every grade III; it adds no reward",
  (race) => {
    const d = emptyDevelopment();
    expect(developmentCompletion(race, undefined).earned).toBe(false);
    // Controlled unit progress fixture, not a claim of a completed runtime campaign.
    for (const q of HERITAGE_QUESTS.filter((q) => q.race === race))
      d.heritage.quests[q.id] = { ...emptyHeritageProgress(), status: "done" };
    for (const p of WORLD_PROJECTS.filter((p) => p.race === race))
      d.heritage.projects[p.id] = { ...emptyHeritageProgress(), status: "done" };
    const trials = TRIALS.filter((t) => t.race === race);
    for (const t of trials) d.trials[t.id] = 3;
    const before = structuredClone(d);
    const complete = developmentCompletion(race, d);
    expect(complete.earned).toBe(true);
    expect(complete.greeting).toContain(complete.name);
    expect(d).toEqual(before);
    for (const t of trials) {
      d.trials[t.id] = 2;
      expect(developmentCompletion(race, d).earned).toBe(false);
      d.trials[t.id] = 3;
    }
    for (const p of WORLD_PROJECTS.filter((p) => p.race === race)) {
      d.heritage.projects[p.id]!.status = "active";
      expect(developmentCompletion(race, d).earned).toBe(false);
      d.heritage.projects[p.id]!.status = "done";
    }
    const finale = HERITAGE_QUESTS.find((q) => q.race === race && q.chapter === 6)!;
    d.heritage.quests[finale.id]!.status = "active";
    expect(developmentCompletion(race, d).earned).toBe(false);
  },
);
