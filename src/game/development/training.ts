import { z } from "zod";

export const DISCIPLINES = ["strength", "endurance", "kiCapacity", "defense", "kiControl"] as const;
export type Discipline = (typeof DISCIPLINES)[number];
export const TRAINING_NAMES: Record<Discipline, string> = {
  strength: "Siła",
  endurance: "Wytrzymałość",
  kiCapacity: "Pojemność KI",
  defense: "Obrona",
  kiControl: "Kontrola KI",
};
export const zeroTraining = () => ({
  strength: 0,
  endurance: 0,
  kiCapacity: 0,
  defense: 0,
  kiControl: 0,
});
const rank = z.number().finite().int().min(0).max(30);
export const TrainingSchema = z
  .object({ strength: rank, endurance: rank, kiCapacity: rank, defense: rank, kiControl: rank })
  .strict()
  .refine((t) => DISCIPLINES.reduce((n, d) => n + t[d], 0) <= 90, "Łączny limit treningu: 90");
export type Training = z.infer<typeof TrainingSchema>;
export const rankCost = (rank: number) => {
  if (!Number.isInteger(rank) || rank < 0 || rank >= 30) throw Error("Invalid training rank");
  return 50 + 10 * rank;
};
export const trainingCost = (training: Training) =>
  DISCIPLINES.reduce((sum, d) => {
    const r = training[d];
    return sum + r * 50 + 5 * r * (r - 1);
  }, 0);
export const examId = (d: Discipline, tier: number) => `exam:${d}:${tier}`;
export const EXAM_IDS = DISCIPLINES.flatMap((d) =>
  Array.from({ length: 6 }, (_, i) => examId(d, i + 1)),
);
export const examTier = (training: Training, d: Discipline) =>
  Math.min(6, Math.floor(training[d] / 5) + 1);
export function examAvailable(
  training: Training,
  passed: readonly string[],
  d: Discipline,
  tier: number,
) {
  return (
    Number.isInteger(tier) &&
    tier >= 1 &&
    tier <= 6 &&
    training[d] >= (tier === 1 ? 4 : (tier - 1) * 5) &&
    (tier === 1 || passed.includes(examId(d, tier - 1)))
  );
}
export function rankUnavailable(
  training: Training,
  passed: readonly string[],
  available: number,
  d: Discipline,
): string {
  const r = training[d];
  if (r >= 30) return "Osiągnięto stopień 30.";
  if (DISCIPLINES.reduce((sum, key) => sum + training[key], 0) >= 90)
    return "Wykorzystano 90 stopni. Trener pozwala bezpłatnie zmienić przydział.";
  if ((r + 1) % 5 === 0 && !passed.includes(examId(d, (r + 1) / 5)))
    return "Najpierw zdaj egzamin tego stopnia.";
  if (available < rankCost(r))
    return "Za mało praktyki. Zdobywaj ją za pierwsze ukończenie wyzwań.";
  return "";
}
