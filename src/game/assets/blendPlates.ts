import type Phaser from "phaser";

/**
 * Some generated props (a fountain on its grass square, bone piles, cliff chunks) were cut
 * with a rectangular plate of baked ground. Drawn on the painted terrain they read as pasted
 * pictures. Such a texture gets a copy whose rim fades softly into the ground beneath it;
 * every other texture is used unchanged. Walls, steps and banners are meant to keep their
 * hard outline (they join neighbours or hang as cloth).
 */
const JOINED = /wall|steps|staircase|gate|door|rug|banner/;
/** Buildings fill their plate with walls: only the outermost rim may fade, never the facade. */
const BUILDING = /city-(house|hall|market|inn|smithy|depot|arena|tower|shop|lab|forge|temple)/;
const plated = new Map<string, boolean>();
const PROBE = 64;

/** Fraction of an inner ring of the opaque bounding box that is itself opaque (1 = a full rectangle). */
function plateRing(source: CanvasImageSource) {
  const probe = document.createElement("canvas");
  probe.width = probe.height = PROBE;
  const ctx = probe.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, PROBE, PROBE);
  const alpha = ctx.getImageData(0, 0, PROBE, PROBE).data;
  const at = (x: number, y: number) => alpha[(y * PROBE + x) * 4 + 3]! > 200;
  let x0 = PROBE,
    y0 = PROBE,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < PROBE; y++)
    for (let x = 0; x < PROBE; x++)
      if (at(x, y)) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
  if (x1 - x0 < 8 || y1 - y0 < 8) return { ring: 0, x0, y0, x1, y1 };
  const ix = Math.max(1, Math.round((x1 - x0) * 0.04)),
    iy = Math.max(1, Math.round((y1 - y0) * 0.04));
  let opaque = 0,
    total = 0;
  for (let x = x0 + ix; x <= x1 - ix; x++) {
    opaque += Number(at(x, y0 + iy)) + Number(at(x, y1 - iy));
    total += 2;
  }
  for (let y = y0 + iy; y <= y1 - iy; y++) {
    opaque += Number(at(x0 + ix, y)) + Number(at(x1 - ix, y));
    total += 2;
  }
  return { ring: opaque / total, x0, y0, x1, y1 };
}

/** Texture key to draw for `asset`: the original, or its soft-rimmed copy when it has a plate. */
export function blendedTexture(scene: Phaser.Scene, asset: string, frame?: string | number) {
  if (frame !== undefined || JOINED.test(asset)) return asset;
  const key = asset + ":blended";
  if (scene.textures.exists(key)) return key;
  if (plated.get(asset) === false || !scene.textures.exists(asset)) return asset;
  const source = scene.textures.get(asset).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const { ring, x0, y0, x1, y1 } = plateRing(source);
  plated.set(asset, ring > 0.6);
  if (ring <= 0.6) return asset;
  const w = source.width,
    h = source.height,
    sx = w / PROBE,
    sy = h / PROBE;
  // Opaque plate in texture pixels; the rim fades over a fifth of its smaller side (props).
  const left = x0 * sx,
    top = y0 * sy,
    right = (x1 + 1) * sx,
    bottom = (y1 + 1) * sy;
  const fade = Math.min(right - left, bottom - top) * (BUILDING.test(asset) ? 0.06 : 0.2);
  const canvas = scene.textures.createCanvas(key, w, h);
  if (!canvas) return asset;
  const ctx = canvas.getContext();
  ctx.drawImage(source, 0, 0);
  const mask = document.createElement("canvas");
  mask.width = w;
  mask.height = h;
  const m = mask.getContext("2d")!;
  // A rounded, blurred plate silhouette: corners and edges melt into the terrain.
  m.filter = `blur(${Math.round(fade / 2)}px)`;
  m.fillStyle = "#000";
  m.beginPath();
  m.roundRect(
    left + fade / 2,
    top + fade / 2,
    right - left - fade,
    bottom - top - fade,
    fade * 1.5,
  );
  m.fill();
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(mask, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  canvas.refresh();
  return key;
}
