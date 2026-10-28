import {
  HeritageStateSchema,
  emptyHeritage,
  expectedHeritageReward,
  heritageReceipt,
} from "./heritage/state";
import { MONSTER_BASE } from "../monsters/base.generated";
import { z } from "zod";
import {
  DISCIPLINES,
  EXAM_IDS,
  TrainingSchema,
  examId,
  trainingCost,
  zeroTraining,
} from "./training";

const amount = z.number().finite().int().min(0).max(1000000);
export const VARIANT_IDS = [
  "mv-trail",
  "mv-earth",
  "mv-root",
  "ma-seal",
  "ma-barrier",
  "ma-focus",
  "mn-mark",
  "mn-barrier",
  "mn-discharge",
  "mp-cuts",
  "mp-break",
  "mp-burst",
] as const;
export const MODULE_IDS = [
  "mn-cooling",
  "mn-optics",
  "mn-shield",
  "mn-precision",
  "mn-scanner",
  "mn-routing",
] as const;
export type VariantId = (typeof VARIANT_IDS)[number];
export type ModuleId = (typeof MODULE_IDS)[number];
export const MODULE_ENERGY: Record<ModuleId, number> = {
  "mn-cooling": 4,
  "mn-optics": 4,
  "mn-shield": 4,
  "mn-precision": 3,
  "mn-scanner": 2,
  "mn-routing": 3,
};
const unique = <T>(xs: T[]) => new Set(xs).size === xs.length;
const ids = <T extends [string, ...string[]]>(all: T) =>
  z.array(z.enum(all)).max(all.length).refine(unique);
export const SPECIES_IDS = new Set(MONSTER_BASE.map((m) => m.id));
const speciesId = z.string().refine((id) => SPECIES_IDS.has(id));
const receipt = z
  .object({ practice: amount, xp: amount.optional(), gold: amount.optional() })
  .strict();
const DevelopmentBase = z
  .object({
    version: z.literal(1),
    practiceEarned: amount,
    practiceSpent: amount,
    training: TrainingSchema,
    passedExamIds: z
      .array(z.string().refine((id) => EXAM_IDS.includes(id)))
      .max(30)
      .refine(unique),
    unlockedVariants: ids([...VARIANT_IDS]),
    activeVariantId: z.enum(VARIANT_IDS).nullable(),
    unlockedModules: ids([...MODULE_IDS]),
    equippedModuleIds: ids([...MODULE_IDS]).refine(
      (m) => m.length <= 3 && m.reduce((n, id) => n + MODULE_ENERGY[id], 0) <= 10,
    ),
    knowledge: z.record(speciesId, z.number().int().min(1).max(4)),
    // Finite business keys: a repeated kill or exam cannot create a new reward ID.
    rewardReceipts: z.record(
      z
        .string()
        .refine(
          (id) =>
            expectedHeritageReward(id) !== undefined ||
            EXAM_IDS.some((exam) => id === `${exam}:v1`) ||
            [...SPECIES_IDS].some((species) => id === `bestiary:${species}:complete:v1`),
        ),
      receipt,
    ),
  })
  .strict();
function validateBase(s: Omit<z.infer<typeof DevelopmentBase>, "version">, ctx: z.RefinementCtx) {
  const fail = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  if (s.practiceSpent !== trainingCost(s.training) || s.practiceSpent > s.practiceEarned)
    fail("Inconsistent training ledger");
  if (Object.values(s.rewardReceipts).reduce((n, r) => n + r.practice, 0) !== s.practiceEarned)
    fail("Inconsistent reward ledger");
  if (s.activeVariantId && !s.unlockedVariants.includes(s.activeVariantId))
    fail("Locked active variant");
  if (s.equippedModuleIds.some((id) => !s.unlockedModules.includes(id)))
    fail("Locked equipped module");
  for (const discipline of DISCIPLINES) {
    for (let tier = 1; tier <= Math.floor(s.training[discipline] / 5); tier++) {
      if (!s.passedExamIds.includes(examId(discipline, tier)))
        fail("Training rank without threshold exam");
    }
  }
  for (const id of s.passedExamIds) {
    if (s.rewardReceipts[`${id}:v1`]?.practice !== 250) fail("Exam without receipt");
    const parts = id.split(":");
    const tier = Number(parts[2]);
    if (tier > 1 && !s.passedExamIds.includes(`exam:${parts[1]}:${tier - 1}`))
      fail("Exam prerequisite missing");
  }
  for (const [id, reward] of Object.entries(s.rewardReceipts)) {
    if (id.startsWith("exam:") && !s.passedExamIds.includes(id.slice(0, -3)))
      fail("Receipt without exam");
    if (id.startsWith("bestiary:")) {
      const species = id.slice(9, -12);
      if (s.knowledge[species] !== 4 || reward.practice !== 50) fail("Invalid bestiary reward");
    }
  }
  for (const [species, stage] of Object.entries(s.knowledge))
    if (stage === 4 && s.rewardReceipts[`bestiary:${species}:complete:v1`]?.practice !== 50)
      fail("Knowledge without receipt");
}
const LegacyDevelopmentSchema = DevelopmentBase.superRefine((s, ctx) => {
  validateBase(s, ctx);
  if (Object.keys(s.rewardReceipts).some((key) => key.startsWith("heritage:")))
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Legacy development cannot own heritage rewards",
    });
});
export const CurrentDevelopmentSchema = DevelopmentBase.extend({
  version: z.literal(2),
  heritage: HeritageStateSchema,
}).superRefine((s, ctx) => {
  validateBase(s, ctx);
  const fail = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  for (const [id, progress] of Object.entries({ ...s.heritage.quests, ...s.heritage.projects })) {
    const reward = s.rewardReceipts[heritageReceipt(id)];
    if ((progress.status === "done") !== (reward !== undefined))
      fail("Heritage reward/progress mismatch");
  }
  for (const [key, receipt] of Object.entries(s.rewardReceipts)) {
    const expected = expectedHeritageReward(key);
    if (!expected) continue;
    const id = key.slice(9, -3);
    const progress = s.heritage.quests[id] ?? s.heritage.projects[id];
    if (
      receipt.practice !== expected.practice ||
      progress?.status !== "done" ||
      ("xp" in expected
        ? receipt.xp !== expected.xp || receipt.gold !== expected.gold
        : receipt.xp !== undefined || receipt.gold !== undefined)
    )
      fail("Invalid heritage reward");
  }
});
export const DevelopmentSchema = z.union([
  CurrentDevelopmentSchema,
  LegacyDevelopmentSchema.transform((s) => ({
    ...s,
    version: 2 as const,
    heritage: emptyHeritage(),
  })),
]);
export type DevelopmentState = z.infer<typeof DevelopmentSchema>;
export function emptyDevelopment(): DevelopmentState {
  return {
    version: 2,
    heritage: emptyHeritage(),
    practiceEarned: 0,
    practiceSpent: 0,
    training: zeroTraining(),
    passedExamIds: [],
    unlockedVariants: [],
    activeVariantId: null,
    unlockedModules: [],
    equippedModuleIds: [],
    knowledge: {},
    rewardReceipts: {},
  };
}
