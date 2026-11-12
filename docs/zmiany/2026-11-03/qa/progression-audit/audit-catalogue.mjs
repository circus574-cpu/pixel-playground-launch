/** Static upper bounds, not a claim of completing any campaign in the game. */
import {
  HERITAGE_QUESTS,
  WORLD_PROJECTS,
} from "../../../../../src/game/development/heritage/catalog.ts";
import { RACE_IDS } from "../../../../../src/game/world/races.ts";
import { EXAM_IDS, DISCIPLINES, rankCost } from "../../../../../src/game/development/training.ts";
import { VARIANT_IDS, MODULE_IDS, SPECIES_IDS } from "../../../../../src/game/development/state.ts";

// Confirmed missing constructors in HeritageRuntime.command at main@13983467.
const unsupported = (definition) =>
  definition.goals
    .filter((goal) => goal.kind === "protect" || (goal.kind === "escort" && goal.combat))
    .map((goal) => ({ id: goal.id, kind: goal.kind, combat: goal.combat ?? false }));
const all = [...HERITAGE_QUESTS, ...WORLD_PROJECTS];
const reachable = new Set();
let changed = true;
while (changed) {
  changed = false;
  for (const definition of all) {
    if (reachable.has(definition.id) || unsupported(definition).length) continue;
    if (definition.prerequisite && !reachable.has(definition.prerequisite)) continue;
    if (
      definition.goals.some(
        (goal) => goal.kind === "projects" && goal.required.some((id) => !reachable.has(id)),
      )
    )
      continue;
    reachable.add(definition.id);
    changed = true;
  }
}
const describe = (definition) => ({
  id: definition.id,
  name: definition.name,
  structurallyUnblocked: reachable.has(definition.id),
  directBlockers: unsupported(definition),
});
const commonPractice = EXAM_IDS.length * 250 + SPECIES_IDS.size * 50;
const rewards = (definitions) => definitions.reduce((sum, d) => sum + d.reward.practice, 0);
const trainingCosts = [0];
// Cheapest possible distribution: take the next cheapest rank across all disciplines.
const ranks = DISCIPLINES.map(() => 0);
for (let total = 1; total <= 90; total++) {
  let selected = 0;
  for (let i = 1; i < ranks.length; i++) if (ranks[i] < ranks[selected]) selected = i;
  trainingCosts.push(trainingCosts[total - 1] + rankCost(ranks[selected]));
  ranks[selected]++;
}
console.log(
  JSON.stringify(
    {
      scope:
        "Static upper bounds assume every other goal, all 30 exams and all 40 species succeed. No live account or save is read or modified.",
      counts: {
        disciplines: DISCIPLINES.length,
        exams: EXAM_IDS.length,
        chapters: HERITAGE_QUESTS.length,
        projects: WORLD_PROJECTS.length,
        variants: VARIANT_IDS.length,
        moduleIds: MODULE_IDS.length,
        bestiary: SPECIES_IDS.size,
      },
      budget: {
        rank30: Array.from({ length: 30 }, (_, rank) => rankCost(rank)).reduce((a, b) => a + b),
        requiredGuarantee: 17800, // Owner specification, not an implemented reward.
        missingRacialTrialPractice: 12 * (100 + 150 + 200),
        minimumForAny90Ranks: trainingCosts[90],
      },
      races: RACE_IDS.map((race) => {
        const chapters = HERITAGE_QUESTS.filter((d) => d.race === race);
        const projects = WORLD_PROJECTS.filter((d) => d.race === race);
        const staticPracticeUpperBound =
          commonPractice + rewards([...chapters, ...projects].filter((d) => reachable.has(d.id)));
        return {
          race,
          chapters: chapters.map(describe),
          projects: projects.map(describe),
          withoutRacialTrialsCatalogueOnly: commonPractice + rewards([...chapters, ...projects]),
          staticPracticeUpperBound,
          optimisticTrainingRankUpperBound: trainingCosts.findLastIndex(
            (cost) => cost <= staticPracticeUpperBound,
          ),
        };
      }),
    },
    null,
    2,
  ),
);
