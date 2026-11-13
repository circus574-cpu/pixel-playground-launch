import { describe, expect, it } from "vitest";
import sharp from "sharp";
import path from "node:path";
import { readFile } from "node:fs/promises";
import imported from "../game/assets/imported.json";

// A clip frame where the figure has (almost) no opaque pixels makes the hero vanish on screen. The engine holds the last
// frame of death, so a blank tail of the death clip left Legend invisible after dying (found 13.11.2026).
const HEROES = [
  "hero-planetary-painted-walk-v3",
  "hero-sage-painted-walk-v3",
  "hero-android-walk-v3",
  "hero-legend-walk-v3",
] as const;
type Rect = { x: number; y: number; w: number; h: number };
type Atlas = { frames: Record<string, { frame: Rect }> };
type Pack = {
  id: string;
  assets: { id: string; url: string; atlasUrl: string }[];
  actors: { clips: Record<string, { asset: string; directions: Record<string, string[]> }> }[];
};
describe("every frame of every hero clip shows the hero", () => {
  for (const id of HEROES)
    it(
      id,
      async () => {
        const pack = (imported as unknown as Pack[]).find((p) => p.id === id)!;
        const pages = new Map<string, { alpha: Buffer; width: number; atlas: Atlas }>();
        const page = async (assetId: string) => {
          if (!pages.has(assetId)) {
            const asset = pack.assets.find((a) => a.id === assetId)!;
            const raw = await sharp(path.join("public", asset.url))
              .ensureAlpha()
              .extractChannel(3)
              .raw()
              .toBuffer({ resolveWithObject: true });
            pages.set(assetId, {
              alpha: raw.data,
              width: raw.info.width,
              atlas: JSON.parse(
                await readFile(path.join("public", asset.atlasUrl), "utf8"),
              ) as Atlas,
            });
          }
          return pages.get(assetId)!;
        };
        const blank: string[] = [];
        for (const [name, clip] of Object.entries(pack.actors[0]!.clips)) {
          // the right-facing frames stand for the mirrored directions; down and up are separate frames
          for (const direction of ["right", "down", "up"]) {
            const frames = clip.directions[direction]!;
            const { alpha, width, atlas } = await page(clip.asset);
            const area = frames.map((frame) => {
              const r = atlas.frames[frame]!.frame;
              let n = 0;
              for (let y = r.y; y < r.y + r.h; y++)
                for (let x = r.x; x < r.x + r.w; x++) if (alpha[y * width + x]! > 128) n++;
              return n;
            });
            const median = [...area].sort((a, b) => a - b)[Math.floor(area.length / 2)]!;
            area.forEach((n, i) => {
              if (n < 0.2 * median) blank.push(`${name}/${direction}/${i}`);
            });
          }
        }
        expect(blank).toEqual([]);
      },
      60000,
    );
});
