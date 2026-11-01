import { z } from "zod";
import { BUILDING_IDS } from "../../game/city/types";
import { ITEM_IDS, type Command } from "../../game/session";

const id = z.string().min(1).max(180);
const coord = z.number().finite().min(0).max(131072);
const simple = (type: string) => z.object({ type: z.literal(type) }).strict();
/** Only intentions enter the simulation. The browser cannot set player state, rewards,
 * time, staff permissions or simulation pause. Feature-specific intentions are added
 * explicitly; unsupported packets fail rather than falling back to a raw Command cast.
 */
export const OnlineCommandSchema = z.union([
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
  z.object({ type: z.literal("ability"), ability: z.string().min(1).max(4) }).strict(),
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
      action: z.enum(["close", "accept", "claim", "upgrade"]),
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
export function onlineCommand(input: unknown): Command {
  return OnlineCommandSchema.parse(input) as Command;
}
