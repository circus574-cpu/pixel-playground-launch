import { TRIAL_IDS } from "../../game/development/trials/catalog";
import { z } from "zod";
import { FEATURE_IDS } from "../../game/world/generated/superiorSave";
import { DISCIPLINES } from "../../game/development/training";
import { VARIANT_IDS, MODULE_IDS } from "../../game/development/state";
import { BUILDING_IDS } from "../../game/city/types";
import { ITEM_IDS, PlayerSchema } from "../../game/session";

const id = z.string().min(1).max(180);
const coord = z.number().finite().min(0).max(131072);
const heritageId = z.string().regex(/^(H-[VANP]0[1-6]|P-[VANP][1-6])$/);
const interaction = z.union([
  z.object({ kind: z.literal("talk"), responseId: id }).strict(),
  z.object({ kind: z.literal("solve"), answerId: id }).strict(),
  z
    .object({
      kind: z.literal("consent"),
      granted: z.boolean(),
      mode: z.enum(["named", "anonymous"]),
    })
    .strict(),
  z.object({ kind: z.literal("name-weapon"), name: z.string().min(1).max(48) }).strict(),
  z.object({ kind: z.literal("forge"), operationId: id }).strict(),
  ...["inspect", "recover", "craft", "retry"].map((kind) =>
    z.object({ kind: z.literal(kind) }).strict(),
  ),
]);
const staffSchema = z.union([
  z
    .object({
      type: z.literal("staff"),
      action: z.enum(["heal", "god", "level", "gold", "potions", "resetSkills", "killTarget"]),
    })
    .strict(),
  z
    .object({ type: z.literal("staff"), action: z.literal("teleport"), x: coord, y: coord })
    .strict(),
  z
    .object({
      type: z.literal("staff"),
      action: z.literal("setLevel"),
      level: PlayerSchema.shape.level,
    })
    .strict(),
  z
    .object({
      type: z.literal("staff"),
      action: z.literal("setGold"),
      gold: z.number().int().min(0).max(1000000),
    })
    .strict(),
  z
    .object({
      type: z.literal("staff"),
      action: z.literal("setXp"),
      xp: z.number().int().min(0).max(1000000),
    })
    .strict(),
  z
    .object({
      type: z.literal("staff"),
      action: z.literal("setHpKi"),
      hp: z.number().min(0).max(1000000),
      ki: z.number().min(0).max(1000000),
    })
    .strict(),
  z.object({ type: z.literal("staff"), action: z.literal("forceLearn"), node: id }).strict(),
  z
    .object({
      type: z.literal("staff"),
      action: z.literal("killAllNearby"),
      radius: z.number().min(1).max(2000).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("staff-travel"),
      destination: z.enum(FEATURE_IDS),
      point: z.object({ x: coord, y: coord }).strict().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("staff"),
      action: z.literal("setItem"),
      item: z.enum(ITEM_IDS as ["potion", "tusk", "sword", "vest"]),
      count: z.number().int().min(0).max(99999),
      depot: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("staff"),
      action: z.literal("setMaterial"),
      id,
      count: z.number().int().min(0).max(99999),
      depot: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("staff"),
      action: z.literal("setEquipment"),
      weapon: z.literal("sword").nullable().optional(),
      armor: z.literal("vest").nullable().optional(),
      upgrade: z.number().int().min(0).max(100).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("staff"),
      action: z.literal("setQuest"),
      quest: z.enum(["steps", "boars", "gear"]),
      status: z.enum(["locked", "active", "ready", "done"]),
    })
    .strict(),
  z
    .object({
      type: z.literal("staff"),
      action: z.literal("spawnMonster"),
      kind: id,
      x: coord.optional(),
      y: coord.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("staff"),
      action: z.literal("spawnBoss"),
      bossId: id,
      x: coord.optional(),
      y: coord.optional(),
    })
    .strict(),
]);
const simple = <T extends string>(type: T) => z.object({ type: z.literal(type) }).strict();
/** Only intentions enter the simulation. The browser cannot set player state, rewards,
 * time, staff permissions or simulation pause. Feature-specific intentions are added
 * explicitly; unsupported packets fail rather than falling back to a raw Command cast.
 */
export const OnlineCommandSchema = z.union([
  z
    .object({
      type: z.literal("heritage"),
      action: z.enum(["start", "scan", "activity-start", "activity-finish", "activity-leave"]),
      id: heritageId,
    })
    .strict(),
  z
    .object({ type: z.literal("heritage"), action: z.literal("go"), id: heritageId, targetId: id })
    .strict(),
  z
    .object({
      type: z.literal("heritage"),
      action: z.literal("act"),
      id: heritageId,
      goalId: id,
      targetId: id,
      revision: z.number().int().min(0),
      interaction,
    })
    .strict(),
  z
    .object({
      type: z.literal("heritage"),
      action: z.literal("claim"),
      id: heritageId,
      choiceId: id.nullable(),
    })
    .strict(),
  z.object({ type: z.literal("quest-start"), id }).strict(),
  z.object({ type: z.literal("travel"), destination: z.enum(FEATURE_IDS) }).strict(),
  z
    .object({
      type: z.literal("development"),
      action: z.literal("train"),
      discipline: z.enum(DISCIPLINES),
    })
    .strict(),
  z.object({ type: z.literal("development"), action: z.literal("reset-training") }).strict(),
  z
    .object({
      type: z.literal("development"),
      action: z.enum(["study", "study-route"]),
      species: id,
    })
    .strict(),
  z
    .object({
      type: z.literal("development"),
      action: z.literal("variant"),
      id: z.enum(VARIANT_IDS).nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal("development"),
      action: z.literal("modules"),
      ids: z.array(z.enum(MODULE_IDS)).max(6),
    })
    .strict(),
  z
    .object({
      type: z.literal("heritage-weapon"),
      action: z.enum(["equip", "deposit", "withdraw"]),
    })
    .strict(),
  z.object({ type: z.literal("move"), x: coord, y: coord }).strict(),
  z.object({ type: z.literal("target"), id }).strict(),
  z
    .object({
      type: z.literal("interact"),
      npc: z.enum([
        "guide",
        "hunter",
        "merchant",
        "smith",
        "keeper",
        "trainer",
        "innkeeper",
        "steward",
      ]),
    })
    .strict(),
  z
    .object({
      type: z.literal("training"),
      action: z.enum(["start", "reset", "stop"]),
      discipline: z.enum(["dodge", "attackSpeed", "technique"]).optional(),
    })
    .strict(),
  z.object({ type: z.literal("ability"), ability: z.string().min(1).max(16) }).strict(),
  simple("dodge"),
  simple("cancel"),
  simple("exit"),
  simple("chest"),
  simple("storage-close"),
  simple("rest"),
  simple("respec"),
  z
    .object({
      type: z.literal("dialogue"),
      action: z.enum(["close", "accept", "claim", "upgrade", "rumors", "boss_enter"]),
    })
    .strict(),
  z
    .object({
      type: z.literal("equip"),
      item: z.enum(ITEM_IDS as ["potion", "tusk", "sword", "vest"]),
    })
    .strict(),
  z.object({ type: z.literal("unequip"), slot: z.enum(["weapon", "armor"]) }).strict(),
  z.object({ type: z.literal("trade"), item: id, buy: z.boolean() }).strict(),
  z.object({ type: z.literal("brew"), recipe: z.enum(["hp", "ki", "antidote"]) }).strict(),
  z.object({ type: z.literal("loot"), id }).strict(),
  z.object({ type: z.literal("learn"), node: z.string().min(1).max(4) }).strict(),
  z.object({ type: z.literal("enter"), building: z.enum(BUILDING_IDS) }).strict(),
  z
    .object({
      type: z.literal("depot"),
      item: id,
      quantity: z.number().int().min(1).max(99),
      withdraw: z.boolean(),
    })
    .strict(),
]);
export const ServerIntentSchema = z.union([
  z
    .object({
      type: z.literal("trial-start"),
      id: z.enum(TRIAL_IDS),
      tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    })
    .strict(),
  z
    .object({
      type: z.literal("trial-action"),
      instanceId: id,
      action: z.enum([
        "ready",
        "suspend",
        "resume",
        "inspect",
        "close",
        "retry",
        "accept",
        "leave",
      ]),
      suspended: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("trial-answer"),
      instanceId: id,
      round: z.number().int().min(0).max(8),
      answerId: z.string().max(80),
      modules: z.array(z.enum(MODULE_IDS)).max(3).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("trial-input"),
      instanceId: id,
      command: z.union([
        z.object({ type: z.literal("move"), x: coord, y: coord }).strict(),
        z.object({ type: z.literal("target"), id }).strict(),
        z.object({ type: z.literal("ability"), ability: z.string().min(1).max(16) }).strict(),
        simple("cancel"),
        simple("dodge"),
      ]),
    })
    .strict(),

  OnlineCommandSchema,
  z
    .object({
      type: z.literal("exam-start"),
      discipline: z.enum(DISCIPLINES),
      tier: z.number().int().min(1).max(6),
      rehearsal: z.boolean(),
    })
    .strict(),
  z
    .object({
      type: z.literal("exam-action"),
      action: z.enum(["charge", "retry", "accept", "leave"]),
    })
    .strict(),
  z
    .object({
      type: z.literal("exam-input"),
      command: z.union([
        z.object({ type: z.literal("move"), x: coord, y: coord }).strict(),
        z.object({ type: z.literal("target"), id }).strict(),
        z.object({ type: z.literal("ability"), ability: z.string().min(1).max(16) }).strict(),
        simple("cancel"),
        simple("dodge"),
      ]),
    })
    .strict(),
]);
export function onlineCommand(input: unknown, staff = false) {
  if (staff && ["staff", "staff-travel"].includes((input as { type?: string })?.type ?? ""))
    return staffSchema.parse(input);
  return ServerIntentSchema.parse(input);
}
