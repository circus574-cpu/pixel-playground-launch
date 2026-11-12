import type { RaceId } from "../world/races";
import type { DevelopmentState } from "./state";
import { HERITAGE_QUESTS, WORLD_PROJECTS } from "./heritage/catalog";
import { TRIALS, trialReward } from "./trials/catalog";
import { EXAM_IDS } from "./training";
import { MONSTER_BASE } from "../monsters/base.generated";

export const DEVELOPMENT_TITLES: Record<RaceId, string> = {
  planetary: "Strażnik Żywych Szlaków",
  sage: "Powiernik Żywej Pamięci",
  android: "Architekt Własnej Woli",
  legend: "Płomień Własnej Przysięgi",
};
/** Derived from owned, validated progress. No new save flag or independent reward ledger. */
export function developmentCompletion(race: RaceId, state: DevelopmentState | undefined) {
  const chapters = HERITAGE_QUESTS.filter((q) => q.race === race);
  const projects = WORLD_PROJECTS.filter((p) => p.race === race);
  const trials = TRIALS.filter((t) => t.race === race);
  const chapterCount = chapters.filter(
    (q) => state?.heritage.quests[q.id]?.status === "done",
  ).length;
  const projectCount = projects.filter(
    (p) => state?.heritage.projects[p.id]?.status === "done",
  ).length;
  const trialCount = trials.filter((t) => state?.trials[t.id] === 3).length;
  const earned = chapterCount === 6 && projectCount === 6 && trialCount === 12;
  return {
    name: DEVELOPMENT_TITLES[race],
    earned,
    chapters: chapterCount,
    projects: projectCount,
    trials: trialCount,
    greeting: earned
      ? `Witaj, ${DEVELOPMENT_TITLES[race]}. Twoje świadectwo jest częścią naszej historii.`
      : null,
  };
}
/** Compute the guaranteed finite budget from the active catalogs, never from chat totals. */
export function developmentPracticeBudget(race: RaceId) {
  const chapters = HERITAGE_QUESTS.filter((q) => q.race === race).reduce(
    (n, q) => n + q.reward.practice,
    0,
  );
  const projects = WORLD_PROJECTS.filter((p) => p.race === race).reduce(
    (n, p) => n + p.reward.practice,
    0,
  );
  const trials =
    TRIALS.filter((t) => t.race === race).length *
    ([1, 2, 3] as const).reduce((n, t) => n + trialReward(t), 0);
  const exams = EXAM_IDS.length * 250,
    bestiary = new Set(MONSTER_BASE.map((m) => m.id)).size * 50;
  return {
    chapters,
    projects,
    trials,
    exams,
    bestiary,
    total: chapters + projects + trials + exams + bestiary,
  };
}
