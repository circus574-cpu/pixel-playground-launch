/**
 * What the server accepts as an Android cloud save. The Android game is a local PvE simulation (it is not authoritative), so the
 * server only keeps what is plainly a save of this game: right format, bounded size, known race and land, plausible numbers.
 * The device validates the content again in full when it loads the save.
 */
import { z } from "zod";

export const SAVE_FORMAT = "ki-godot-pyra-save-2";
export const RACES = ["legend", "planetary", "sage", "android"] as const;
export const LANDS = [
  "pyra",
  "verdant",
  "aether",
  "nexus",
  "island-1",
  "island-2",
  "island-3",
  "island-4",
  "island-5",
  "island-6",
] as const;
/** Cloud slots: one per character. A player has three; an administrator has no limit (up to what the database column holds). */
export const PLAYER_SAVE_SLOTS = 3;
export const MAX_SAVE_SLOT = 32_767;
export const MAX_SAVE_BYTES = 1_000_000;
export const MAX_LEVEL = 20;
/** Generous ceilings, not game rules: a save beyond them cannot come from play. */
export const MAX_GOLD = 50_000_000;
export const MAX_STACK = 9_999;

const pair = z.tuple([
  z.number().finite().min(-1e6).max(1e6),
  z.number().finite().min(-1e6).max(1e6),
]);
const countMap = z.record(z.string().max(80), z.number().int().min(0).max(MAX_STACK));

export const saveSchema = z
  .object({
    format: z.literal(SAVE_FORMAT),
    version: z.literal(2),
    race: z.enum(RACES),
    land: z.enum(LANDS),
    room: z.string().max(40),
    town: z.string().max(80).optional(),
    position: pair,
    cityReturn: pair,
    kit: z
      .object({
        level: z.number().int().min(1).max(MAX_LEVEL),
        xp: z.number().min(0).max(100_000_000),
        learned: z.array(z.string().max(40)).min(1).max(60),
        slots: z.array(z.string().max(40).nullable()).max(8),
        hp: z.number().min(0).max(1_000_000),
        ki: z.number().min(0).max(1_000_000),
      })
      .passthrough(),
    economy: z
      .object({
        gold: z.number().int().min(0).max(MAX_GOLD),
        bag: countMap,
        equipment: z.record(z.string().max(20), z.string().max(80).nullable()),
        depot: countMap,
        depotGold: z.number().int().min(0).max(MAX_GOLD),
        upgrades: z.record(z.string().max(20), z.number().int().min(0).max(5)),
      })
      .passthrough()
      .optional(),
    quests: z.record(z.string(), z.unknown()).optional(),
    dungeons: z.record(z.string().max(80), z.unknown()).optional(),
    events: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export type GodotSave = z.infer<typeof saveSchema>;

export type SaveSummary = { race: string; land: string; level: number; bytes: number };

/** Parses the raw request body; throws a ZodError (400) or a SaveRejected (413) when the save is not acceptable. */
export class SaveRejected extends Error {
  constructor(readonly code: "TOO_LARGE" | "INVALID_SAVE") {
    super(code);
  }
}

export function checkSave(data: unknown): { save: GodotSave; summary: SaveSummary } {
  const json = JSON.stringify(data);
  const bytes = Buffer.byteLength(json ?? "", "utf8");
  if (bytes > MAX_SAVE_BYTES) throw new SaveRejected("TOO_LARGE");
  const parsed = saveSchema.safeParse(data);
  if (!parsed.success) throw new SaveRejected("INVALID_SAVE");
  const save = parsed.data;
  return { save, summary: { race: save.race, land: save.land, level: save.kit.level, bytes } };
}
