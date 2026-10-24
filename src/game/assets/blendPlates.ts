import type Phaser from "phaser";

/**
 * Some generated props (a fountain on its grass square, bone piles, cliff chunks) were cut
 * with a rectangular plate of baked ground. Drawn on the painted terrain they read as pasted
 * pictures. Such a texture gets a copy whose rim fades softly into the ground beneath it;
 * every other texture is used unchanged. Walls, steps and banners are meant to keep their
 * hard outline (they join neighbours or hang as cloth).
 */
const JOINED = /wall|steps|staircase|gate|door|rug|banner/;
/** Buildings: the base and sides of a cut terrace fade a little; the roof line never does. */
const BUILDING =
  /city-(house|hall|market|inn|smithy|depot|arena|tower|shop|lab|forge|temple)|warehouse/;
const plated = new Map<string, boolean>();
const PROBE = 64;

/** Whether the opaque area is a cut plate: its inner rim is mostly opaque, or its base and a side are. */
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
  if (x1 - x0 < 8 || y1 - y0 < 8) return { plate: false, x0, y0, x1, y1 };
  const ix = Math.max(1, Math.round((x1 - x0) * 0.04)),
    iy = Math.max(1, Math.round((y1 - y0) * 0.04));
  const share = (points: [number, number][]) =>
    points.filter(([x, y]) => at(x, y)).length / points.length;
  const across: number[] = [],
    down: number[] = [];
  for (let x = x0 + ix; x <= x1 - ix; x++) across.push(x);
  for (let y = y0 + iy; y <= y1 - iy; y++) down.push(y);
  const top = share(across.map((x) => [x, y0 + iy])),
    bottom = share(across.map((x) => [x, y1 - iy])),
    left = share(down.map((y) => [x0 + ix, y])),
    right = share(down.map((y) => [x1 - ix, y]));
  const ring =
    (across.length * (top + bottom) + down.length * (left + right)) /
    (2 * (across.length + down.length));
  // A base cut straight along the bottom and a side reads as pasted even under an organic roof.
  return { plate: ring > 0.6 || (bottom > 0.7 && Math.max(left, right) > 0.5), x0, y0, x1, y1 };
}

/** Texture key to draw for `asset`: the original, or its soft-rimmed copy when it has a plate. */
export function blendedTexture(scene: Phaser.Scene, asset: string, frame?: string | number) {
  if (frame !== undefined || JOINED.test(asset)) return asset;
  const key = asset + ":blended";
  if (scene.textures.exists(key)) return key;
  if (plated.get(asset) === false || !scene.textures.exists(asset)) return asset;
  const source = scene.textures.get(asset).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const { plate, x0, y0, x1, y1 } = plateRing(source);
  plated.set(asset, plate);
  if (!plate) return asset;
  const w = source.width,
    h = source.height,
    sx = w / PROBE,
    sy = h / PROBE;
  // Opaque plate in texture pixels; the rim fades over a fifth of its smaller side (props).
  const left = x0 * sx,
    top = y0 * sy,
    right = (x1 + 1) * sx,
    bottom = (y1 + 1) * sy;
  const building = BUILDING.test(asset);
  const fade = Math.min(right - left, bottom - top) * (building ? 0.1 : 0.2);
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
  // A building keeps its roof line: the mask starts above the image, so only the base and the
  // sides of its terrace melt into the ground.
  const maskTop = building ? -2 * fade : top + fade / 2;
  m.roundRect(
    left + fade / 2,
    maskTop,
    right - left - fade,
    bottom - fade / 2 - maskTop,
    fade * 1.5,
  );
  m.fill();
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(mask, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  canvas.refresh();
  return key;
}
