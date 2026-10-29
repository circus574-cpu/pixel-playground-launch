import { z } from "zod";
export const TRAINABLE_STATS = ["dodge", "attackSpeed", "technique"] as const;
export type TrainableStat = (typeof TRAINABLE_STATS)[number];
export const TRAINABLE_NAMES = {
  dodge: "Unik",
  attackSpeed: "Szybkość ataku",
  technique: "Technika",
};
export const trainingRequirement = (rank: number) => 20 + rank * 5;
const track = z
  .object({ rank: z.number().int().min(0).max(100), progress: z.number().int().min(0).max(514) })
  .strict()
  .refine((t) => (t.rank === 100 ? t.progress === 0 : t.progress < trainingRequirement(t.rank)));
export const CombatTrainingSchema = z
  .object({ dodge: track, attackSpeed: track, technique: track })
  .strict();
export type CombatTraining = z.infer<typeof CombatTrainingSchema>;
export const emptyCombatTraining = (): CombatTraining => ({
  dodge: { rank: 0, progress: 0 },
  attackSpeed: { rank: 0, progress: 0 },
  technique: { rank: 0, progress: 0 },
});
export function advanceCombatTraining(current: CombatTraining | undefined, stat: TrainableStat) {
  const next = structuredClone(current ?? emptyCombatTraining()),
    t = next[stat];
  if (t.rank === 100) return next;
  t.progress++;
  if (t.progress >= trainingRequirement(t.rank)) {
    t.rank++;
    t.progress = 0;
  }
  return next;
}
/** New train-only parameters never read character level. Percentages use percentage points. */
export function trainedBonuses(t?: CombatTraining) {
  return {
    dodgeChance: (t?.dodge.rank ?? 0) * 0.1,
    attackSpeedPct: (t?.attackSpeed.rank ?? 0) * 0.25,
    technique: t?.technique.rank ?? 0,
  };
}
export const techniqueEffects = (technique: number) => ({
  crit: Math.min(5, technique * 0.05),
  resetChance: Math.min(5, technique * 0.05),
  kiDamage: Math.min(0.25, technique * 0.0025),
});
