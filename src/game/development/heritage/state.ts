import { z } from "zod";
import { RACE_IDS } from "../../world/races";
import { HERITAGE_BY_ID, PROJECT_BY_ID } from "./catalog";
import {
  HERITAGE_QUEST_IDS,
  WORLD_PROJECT_IDS,
  type HeritageQuestId,
  type WorldProjectId,
  type HeritageContentId,
} from "./types";

const count = z.number().finite().int().min(0).max(10000);
const unique = (a: string[]) => new Set(a).size === a.length;
export const GoalProgressSchema = z
  .object({
    revision: count,
    completedTargetIds: z.array(z.string().min(1).max(160)).max(20).refine(unique),
    sequence: count,
    errors: count,
    consent: z.record(z.string().max(160), z.enum(["named", "anonymous"])),
    outcome: z.enum(["active", "failed", "done"]),
  })
  .strict();
export const HeritageProgressSchema = z
  .object({
    step: count,
    goal: GoalProgressSchema,
    completedGoals: z.array(GoalProgressSchema).max(30),
    choiceId: z.string().max(80).nullable(),
    status: z.enum(["active", "ready", "done"]),
  })
  .strict();
export const HeritageWeaponSchema = z
  .object({
    instanceId: z.string().min(1).max(160),
    owner: z.string().min(1).max(300),
    race: z.enum(RACE_IDS),
    stage: z.number().int().min(1).max(6),
    name: z.string().min(3).max(48),
    history: z
      .array(z.enum(HERITAGE_QUEST_IDS as [string, ...string[]]))
      .min(1)
      .max(6)
      .refine(unique),
    location: z.enum(["bag", "depot"]),
  })
  .strict();
const contentKey = (ids: readonly string[]) => z.string().refine((id) => ids.includes(id));
export const HeritageStateSchema = z
  .object({
    quests: z.record(contentKey(HERITAGE_QUEST_IDS), HeritageProgressSchema),
    projects: z.record(contentKey(WORLD_PROJECT_IDS), HeritageProgressSchema),
    materials: z.record(z.string().min(1).max(160), count),
    recentEventIds: z.array(z.string().min(1).max(160)).max(64).refine(unique),
    weapon: HeritageWeaponSchema.nullable(),
    preparedWeaponStage: z.number().int().min(0).max(6),
  })
  .strict()
  .superRefine((s, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    for (const [id, progress] of Object.entries({ ...s.quests, ...s.projects })) {
      const def = heritageDefinition(id as HeritageContentId);
      if (
        !def ||
        progress.step > def.goals.length ||
        progress.completedGoals.length !== progress.step ||
        progress.completedGoals.some((g) => g.outcome !== "done") ||
        (progress.status === "active") !== progress.step < def.goals.length
      )
        fail("Invalid heritage progress");
      const goal = def?.goals[progress.step];
      if (
        goal?.kind === "escort" &&
        progress.status === "active" &&
        progress.goal.sequence >= goal.checkpoints
      )
        fail("Invalid escort checkpoint");
      if (def && "choices" in def) {
        if (
          progress.status === "done"
            ? !def.choices.some((c) => c.id === progress.choiceId)
            : progress.choiceId !== null
        )
          fail("Invalid heritage choice");
      } else if (progress.choiceId !== null) fail("Project cannot have quest choice");
    }
    const completedChapters = Object.entries(s.quests).filter(([, q]) => q.status === "done");
    if (completedChapters.length && !s.weapon) fail("Completed chapter without personal weapon");
    for (const [id, p] of Object.entries({ ...s.quests, ...s.projects })) {
      const definition = heritageDefinition(id as HeritageContentId);
      if (definition?.prerequisite && s.quests[definition.prerequisite]?.status !== "done")
        fail("Heritage prerequisite missing");
      if (
        p.status === "done" &&
        definition?.goals.some(
          (g) =>
            g.kind === "projects" &&
            g.required.some((project) => s.projects[project]?.status !== "done"),
        )
      )
        fail("Chapter project prerequisite missing");
    }
    if (s.weapon) {
      if (s.weapon.history.length !== s.weapon.stage || s.weapon.stage > s.preparedWeaponStage)
        fail("Invalid weapon history");
      for (let i = 1; i <= s.weapon.stage; i++) {
        const id = `H-${{ planetary: "V", sage: "A", android: "N", legend: "P" }[s.weapon.race]}0${i}`;
        if (!s.weapon.history.includes(id) || s.quests[id]?.status !== "done")
          fail("Weapon without chapter");
      }
    }
  });
export type HeritageState = z.infer<typeof HeritageStateSchema>;
export type HeritageWeapon = z.infer<typeof HeritageWeaponSchema>;
export const emptyHeritage = (): HeritageState => ({
  quests: {},
  projects: {},
  materials: {},
  recentEventIds: [],
  weapon: null,
  preparedWeaponStage: 0,
});
export function heritageDefinition(id: HeritageContentId) {
  return HERITAGE_BY_ID.get(id as HeritageQuestId) ?? PROJECT_BY_ID.get(id as WorldProjectId);
}
export const heritageReceipt = (id: string) => `heritage:${id}:v1`;
export function expectedHeritageReward(key: string) {
  if (!key.startsWith("heritage:") || !key.endsWith(":v1")) return undefined;
  return heritageDefinition(key.slice(9, -3) as HeritageContentId)?.reward;
}

export function heritageRaceConsistent(
  s: HeritageState | undefined,
  race: (typeof RACE_IDS)[number],
): boolean {
  if (!s) return true;
  return (
    (!s.weapon || s.weapon.race === race) &&
    Object.keys({ ...s.quests, ...s.projects }).every(
      (id) => heritageDefinition(id as HeritageContentId)?.race === race,
    )
  );
}
