import { z } from "zod";
export const DIRECTIONS = [
  "down",
  "down-left",
  "left",
  "up-left",
  "up",
  "up-right",
  "right",
  "down-right",
] as const;
export const STATES = [
  "idle",
  "walk",
  "run",
  "attack",
  "skill",
  "hit",
  "death",
  "respawn",
] as const;
export type AnimationState = (typeof STATES)[number];
export type Direction = (typeof DIRECTIONS)[number];
const id = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,95}$/);
const frame = z.union([z.string().min(1), z.number().int().min(0)]);
const positive = z.number().finite().positive();
const size = z.tuple([positive, positive]);
export const RefSchema = z.object({ asset: id, frame: frame.optional() }).strict();
export const AssetSchema = z
  .object({
    id,
    version: z.string().min(1),
    kind: z.enum(["image", "svg", "sheet", "atlas"]),
    url: z.string().min(1),
    atlasUrl: z.string().optional(),
    frameWidth: positive.int().optional(),
    frameHeight: positive.int().optional(),
    width: positive.int().optional(),
    height: positive.int().optional(),
    grid: z.object({ columns: positive.int(), rows: positive.int() }).strict().optional(),
    crops: z
      .array(
        z
          .object({
            name: frame,
            x: z.number().min(0),
            y: z.number().min(0),
            width: positive,
            height: positive,
          })
          .strict(),
      )
      .optional(),
  })
  .strict();
export const ClipSchema = z
  .object({
    asset: id,
    fps: positive.max(60),
    loop: z.boolean(),
    directions: z.record(z.enum(DIRECTIONS), z.array(frame).min(1).max(64)),
  })
  .strict();
export const ActorSchema = z
  .object({
    id,
    profile: z.enum(["hero", "enemy", "npc"]).default("hero"),
    size,
    origin: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]),
    tintable: z.boolean().default(false),
    clips: z.record(z.enum(STATES), ClipSchema),
  })
  .strict()
  .refine((v) => !!v.clips.idle && !!v.clips.walk, "Actor needs idle and walk clips");
export const SCENERY_LAYERS = ["below", "objects", "overhead", "atmosphere"] as const;
export const BindingSchema = RefSchema.extend({
  layer: z.enum(SCENERY_LAYERS).optional(),
  fit: z.enum(["contain", "stretch"]).default("contain"),
  tileSize: size.optional(),
}).strict();
export const EffectSchema = z
  .object({
    asset: id,
    frames: z.array(frame).min(1),
    fps: positive.max(60),
    size,
    durationMs: positive.max(10000),
  })
  .strict();
export const PackSchema = z
  .object({
    schemaVersion: z.literal(1),
    id,
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    technical: z.boolean().default(false),
    previewOnly: z.boolean().default(false),
    assets: z.array(AssetSchema).min(1),
    actors: z.array(ActorSchema).default([]),
    actorBindings: z.record(z.string(), z.string()).default({}),
    renderBindings: z.record(z.string(), BindingSchema).default({}),
    effects: z.record(z.string(), EffectSchema).default({}),
  })
  .strict();
export type AssetDefinition = z.infer<typeof AssetSchema>;
export type TextureRef = z.infer<typeof RefSchema>;
export type ActorVisual = z.infer<typeof ActorSchema>;
export type Clip = z.infer<typeof ClipSchema>;
export type AssetPack = z.infer<typeof PackSchema>;
