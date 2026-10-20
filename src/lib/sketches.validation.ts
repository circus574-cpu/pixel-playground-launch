import { z } from "zod";

export const MAX_SKETCH_BYTES = 50 * 1024 * 1024;
export const uploadSketchSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(200)
    .refine(
      (name) =>
        !Array.from(name).some((char) => char.charCodeAt(0) < 32 || char === "/" || char === "\\"),
      "Nieprawidłowa nazwa pliku",
    ),
  size: z.number().int().min(0).max(MAX_SKETCH_BYTES),
});
export const sketchPathSchema = z.object({
  path: z.string().regex(/^[a-f0-9-]{36}--[A-Za-z0-9_-]+$/),
});
