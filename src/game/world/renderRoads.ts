import type Phaser from "phaser";
import type { TextureRef } from "../assets/schema";
import { renderDepth } from "../assets/layers";
import type { Court, Road } from "./types";

/** World units per baked chunk and its texture resolution (px per world unit). */
export const ROAD_CHUNK_SIDE = 1024;
export const ROAD_BAKE_SCALE = 0.75;
type Pt = readonly [number, number];

/** Smooth Catmull-Rom curve through the authored points (presentation only). */
function trace(ctx: CanvasRenderingContext2D, pts: readonly Pt[], closed: boolean) {
  const n = pts.length;
  const at = (i: number) => pts[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))]!;
  ctx.beginPath();
  ctx.moveTo(pts[0]![0], pts[0]![1]);
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = at(i - 1),
      p1 = at(i),
      p2 = at(i + 1),
      p3 = at(i + 2);
    ctx.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) / 6,
      p1[1] + (p2[1] - p0[1]) / 6,
      p2[0] - (p3[0] - p1[0]) / 6,
      p2[1] - (p3[1] - p1[1]) / 6,
      p2[0],
      p2[1],
    );
  }
  if (closed) ctx.closePath();
}

function bounds(pts: readonly Pt[], pad: number) {
  const xs = pts.map((p) => p[0]),
    ys = pts.map((p) => p[1]);
  return {
    left: Math.min(...xs) - pad,
    top: Math.min(...ys) - pad,
    right: Math.max(...xs) + pad,
    bottom: Math.max(...ys) + pad,
  };
}

/**
 * Bakes curved roads and organic courts into world-aligned chunk textures with feathered
 * edges. Chunks without any road are skipped. Collision and navigation never read this.
 */
export function bakeRoads(
  scene: Phaser.Scene,
  worldId: string,
  size: { width: number; height: number },
  roads: readonly Road[],
  courts: readonly Court[],
  path: TextureRef & { tileSize?: readonly number[] },
  plaza: TextureRef & { tileSize?: readonly number[] },
) {
  const pattern = (ctx: CanvasRenderingContext2D, ref: typeof path) => {
    const frame = scene.textures.getFrame(ref.asset, ref.frame);
    const tile = document.createElement("canvas");
    tile.width = frame.cutWidth;
    tile.height = frame.cutHeight;
    tile
      .getContext("2d")!
      .drawImage(
        frame.source.image as CanvasImageSource,
        frame.cutX,
        frame.cutY,
        frame.cutWidth,
        frame.cutHeight,
        0,
        0,
        frame.cutWidth,
        frame.cutHeight,
      );
    const p = ctx.createPattern(tile, "repeat")!;
    const [tw, th] = ref.tileSize ?? [frame.cutWidth, frame.cutHeight];
    p.setTransform?.(new DOMMatrix().scale(tw! / frame.cutWidth, th! / frame.cutHeight));
    return p;
  };
  const shapes = [
    ...roads.map((r) => ({ kind: "road" as const, r, b: bounds(r.points, r.width / 2 + 20) })),
    ...courts.map((c) => ({ kind: "court" as const, c, b: bounds(c.points, 20) })),
  ];
  const chunks: { key: string; image: Phaser.GameObjects.Image; x: number; y: number }[] = [];
  for (let y = 0; y < size.height; y += ROAD_CHUNK_SIDE)
    for (let x = 0; x < size.width; x += ROAD_CHUNK_SIDE) {
      const w = Math.min(ROAD_CHUNK_SIDE, size.width - x),
        h = Math.min(ROAD_CHUNK_SIDE, size.height - y);
      const hits = shapes.filter(
        (s) => s.b.left < x + w && s.b.right > x && s.b.top < y + h && s.b.bottom > y,
      );
      if (!hits.length) continue;
      const key = `road-cache:${worldId}:${x}:${y}`;
      if (scene.textures.exists(key)) scene.textures.remove(key);
      const texture = scene.textures.createCanvas(
        key,
        Math.ceil(w * ROAD_BAKE_SCALE),
        Math.ceil(h * ROAD_BAKE_SCALE),
      );
      if (!texture) continue;
      const ctx = texture.getContext();
      ctx.setTransform(
        ROAD_BAKE_SCALE,
        0,
        0,
        ROAD_BAKE_SCALE,
        -x * ROAD_BAKE_SCALE,
        -y * ROAD_BAKE_SCALE,
      );
      ctx.lineCap = ctx.lineJoin = "round";
      const pathFill = pattern(ctx, path),
        plazaFill = pattern(ctx, plaza);
      // Feathered edge: soft shadow rim, then progressively opaque road surface.
      for (const s of hits)
        if (s.kind === "road") {
          trace(ctx, s.r.points, false);
          ctx.strokeStyle = "rgba(24, 44, 36, 0.22)";
          ctx.lineWidth = s.r.width + 22;
          ctx.stroke();
          for (const [grow, alpha] of [
            [12, 0.35],
            [6, 0.65],
            [0, 1],
          ] as const) {
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = pathFill;
            ctx.lineWidth = s.r.width + grow;
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
      for (const s of hits)
        if (s.kind === "court") {
          trace(ctx, s.c.points, true);
          ctx.strokeStyle = "rgba(24, 44, 36, 0.25)";
          ctx.lineWidth = 20;
          ctx.stroke();
          ctx.fillStyle = plazaFill;
          ctx.fill();
          ctx.strokeStyle = "rgba(226, 214, 160, 0.55)";
          ctx.lineWidth = 5;
          ctx.stroke();
        }
      texture.refresh();
      const image = scene.add
        .image(x, y, key)
        .setOrigin(0)
        .setScale(1 / ROAD_BAKE_SCALE)
        .setDepth(renderDepth("paths"));
      chunks.push({ key, image, x, y });
    }
  let released = false;
  const dispose = () => {
    if (released) return;
    released = true;
    for (const c of chunks) {
      c.image.destroy();
      scene.textures.remove(c.key);
    }
    chunks.length = 0;
  };
  scene.events.once("shutdown", dispose);
  scene.events.once("destroy", dispose);
  return {
    dispose,
    updateVisibility() {
      const view = scene.cameras.main.worldView;
      for (const c of chunks)
        c.image.setVisible(
          c.x < view.right + 128 &&
            c.x + ROAD_CHUNK_SIDE > view.left - 128 &&
            c.y < view.bottom + 128 &&
            c.y + ROAD_CHUNK_SIDE > view.top - 128,
        );
    },
  };
}
