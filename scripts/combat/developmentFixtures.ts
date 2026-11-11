import { CurrentDevelopmentSchema, emptyDevelopment } from "../../src/game/development/state";
import { HERITAGE_QUESTS, WORLD_PROJECTS } from "../../src/game/development/heritage/catalog";
import { emptyGoalProgress } from "../../src/game/development/heritage/types";
import { heritageReceipt } from "../../src/game/development/heritage/state";
import { TRIALS, trialReceipt, trialReward } from "../../src/game/development/trials/catalog";
import { requiredTrialUnlocks } from "../../src/game/development/trials/unlocks";
import type { RaceId } from "../../src/game/world/races";
/** Controlled prerequisite data for QA only. Never an earned campaign checkpoint, never imported by the game. */
export function preparedDevelopment(race: RaceId, owner: string) {
  const d = emptyDevelopment();
  for (const def of [...HERITAGE_QUESTS, ...WORLD_PROJECTS].filter((d) => d.race === race)) {
    const choice = "choices" in def ? def.choices[0]!.id : null;
    d.heritage["choices" in def ? "quests" : "projects"][def.id] = {
      step: def.goals.length,
      goal: emptyGoalProgress(),
      completedGoals: def.goals.map(() => ({ ...emptyGoalProgress(), outcome: "done" as const })),
      choiceId: choice,
      status: "done",
    };
    d.rewardReceipts[heritageReceipt(def.id)] = { ...def.reward };
    d.practiceEarned += def.reward.practice;
  }
  d.heritage.weapon = {
    instanceId: "owned-weapon",
    owner: owner,
    race,
    stage: 6,
    name: "Świadectwo Szlaku",
    history: HERITAGE_QUESTS.filter((q) => q.race === race).map((q) => q.id),
    location: "bag",
  };
  d.heritage.preparedWeaponStage = 6;
  for (const trial of TRIALS.filter((t) => t.race === race)) {
    d.trials[trial.id] = 3;
    for (const tier of [1, 2, 3] as const) {
      d.rewardReceipts[trialReceipt(trial.id, tier)] = { practice: trialReward(tier) };
      d.practiceEarned += trialReward(tier);
    }
  }
  const unlocks = requiredTrialUnlocks(d.trials);
  d.unlockedVariants = unlocks.variants;
  d.unlockedModules = unlocks.modules;

  return CurrentDevelopmentSchema.parse(d);
}
