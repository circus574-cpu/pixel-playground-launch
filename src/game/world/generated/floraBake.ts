import type Phaser from "phaser";
import { catalog } from "../../assets/catalog";
import type { BrowserChunk } from "./browserLoader";
import type { Point } from "../../navigation";

/**
 * Baked ground flora.
 *
 * The continent looks empty because the authored data carries 8–16 props per screen while
 * the capital carries 104. Adding those props as Phaser images would trade the emptiness
 * for a frame-rate drop: every prop is an animated object inside the streaming budget.
 * Small ground cover does not need that. It is drawn once into the chunk's baked canvas,
 * exactly like the world-aligned macro variation layer, and it never becomes a scene object.
 *
 * Presentation only: no collision, no navigation, no save data, no authored object list.
 */
const FLAG = () =>
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("ki-flora-bake") === "1";

export const floraBakeEnabled = () => FLAG();

const STEP = 96; // world units between candidate tufts
const CHUNK_SIDE = 2048;

type Bake = {
  scene: Phaser.Scene;
  ctx: CanvasRenderingContext2D;
  data: BrowserChunk;
  candidates: string[];
  scale: number;
  resolution: number;
  outside: (p: Point) => boolean;
  land: (p: Point) => boolean;
  nearRoad: (p: Point) => boolean;
};

function noise(x: number, y: number) {
  let n = Math.imul(Math.floor(x), 374761393) ^ Math.imul(Math.floor(y), 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/**
 * Draws deterministic ground cover into the chunk canvas.
 * Frames are cropped from the atlas the same way the island materials crop them, so no
 * neighbouring frame bleeds into the tuft.
 */
export function bakeFlora(b: Bake) {
  const usable = b.candidates.filter((c) => catalog.renderBindings[c] !== undefined);
  if (!usable.length) return 0;
  const { data, ctx, scale } = b;
  const draws: { y: number; draw: () => void }[] = [];

  for (let gy = 0; gy < CHUNK_SIDE; gy += STEP)
    for (let gx = 0; gx < CHUNK_SIDE; gx += STEP) {
      const roll = noise(gx + data.x, gy + data.y);
      if (roll > 0.42) continue;
      const p = {
        x: data.x + gx + roll * STEP,
        y: data.y + gy + noise(gy + data.x, gx + data.y) * STEP,
      };
      if (!b.outside(p) || !b.land(p) || b.nearRoad(p)) continue;

      const binding = usable[Math.floor(noise(p.x, p.y) * usable.length) % usable.length]!;
      const ref = catalog.renderBindings[binding]!;
      // Klucz tekstury to identyfikator zasobu — tak samo liczy go renderer
      // (textureId w renderSuperior.ts to odczyt renderBindings[binding].asset).
      if (!b.scene.textures.exists(ref.asset)) continue;
      const texture = b.scene.textures.get(ref.asset);
      const source = texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement | ImageBitmap;
      let sx = 0,
        sy = 0,
        sw = source.width,
        sh = source.height;
      if (ref.frame !== undefined) {
        const frame = texture.get(ref.frame);
        sx = frame.cutX;
        sy = frame.cutY;
        sw = frame.cutWidth;
        sh = frame.cutHeight;
      }
      const size = 26 + noise(p.y, p.x) * 34;
      const x = (p.x - data.x) * scale;
      const y = (p.y - data.y) * scale;
      draws.push({
        y,
        draw: () => {
          ctx.drawImage(source, sx, sy, sw, sh, x - size / 2, y - size, size, size);
        },
      });
    }

  // Północ na południe: dolna krawędź kępy zasłania górną sąsiadkę.
  draws.sort((a, c) => a.y - c.y);
  for (const d of draws) d.draw();
  return draws.length;
}

const TALL =
  /tree|oak|pine|cypress|conifer|bamboo|rock|boulder|stone|stump|log|crystal|arch|gate|altar|monolith|pylon|terminal|reactor|lab|observatory|building|hall|house|inn|shop|smithy|depot|arena|tower|bridge|steps|bunker|relay|cargo|chest|supplies|camp|tent|banner|totem|bonfire/;
const COVER = /bush|fern|flora|grass|flower|mushroom|reeds|shrubs?|sapling/;

/**
 * Small ground cover only. Trees, rocks and structures must stay real scene objects so
 * that occlusion, depth sorting and collision keep working exactly as authored.
 */
export const floraCandidates = (bindings: Iterable<string>) => {
  const out: string[] = [];
  for (const b of new Set(bindings)) {
    if (!b.startsWith("object.") || catalog.renderBindings[b] === undefined) continue;
    if (TALL.test(b) || !COVER.test(b)) continue;
    out.push(b);
  }
  return out;
};
