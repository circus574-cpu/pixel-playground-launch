import type Phaser from "phaser";
import type { TextureRef } from "../assets/schema";
import { renderDepth } from "../assets/layers";
import type { Court, Road, ZoneFloor } from "./types";

/** World units per baked chunk and its texture resolution (px per world unit). */
export const ROAD_CHUNK_SIDE = 1024;
export const ROAD_BAKE_SCALE = 0.75;
/** Baked chunks farther than this from the view (world units) are released. */
const RELEASE_MARGIN = 640;
/** Diagnostic totals for the `?ki-debug=1` badge: how long lazy road baking blocks a frame. */
type BakeStats = { count: number; totalMs: number; maxMs: number };
const recordBake = (ms: number) => {
  const w = window as unknown as { __kiBake?: BakeStats };
  const stats = (w.__kiBake ??= { count: 0, totalMs: 0, maxMs: 0 });
  stats.count++;
  stats.totalMs += ms;
  stats.maxMs = Math.max(stats.maxMs, ms);
};
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
 * Bakes curved roads, organic courts and zone floors into world-aligned chunk textures with
 * feathered edges. Chunks are baked lazily when they come into view and the least recently seen
 * are released, so memory stays bounded on open-world maps. Collision and navigation never read this.
 */
export function bakeRoads(
  scene: Phaser.Scene,
  worldId: string,
  size: { width: number; height: number },
  roads: readonly Road[],
  courts: readonly Court[],
  path: TextureRef & { tileSize?: readonly number[] },
  plaza: TextureRef & { tileSize?: readonly number[] },
  zones: readonly ZoneFloor[] = [],
  zoneRefs: Readonly<Record<string, TextureRef & { tileSize?: readonly number[] }>> = {},
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
    ...zones
      .filter((z) => zoneRefs[z.texture])
      .map((z) => ({ kind: "zone" as const, z, b: bounds(z.points, 80) })),
    ...roads.map((r) => ({ kind: "road" as const, r, b: bounds(r.points, r.width / 2 + 20) })),
    ...courts.map((c) => ({ kind: "court" as const, c, b: bounds(c.points, 20) })),
  ];
  type Chunk = {
    key: string;
    image: Phaser.GameObjects.Image;
    x: number;
    y: number;
    seen: number;
  };
  const chunks = new Map<string, Chunk>();
  const bake = (x: number, y: number, hits: typeof shapes): Chunk | undefined => {
    const w = Math.min(ROAD_CHUNK_SIDE, size.width - x),
      h = Math.min(ROAD_CHUNK_SIDE, size.height - y);
    const key = `road-cache:${worldId}:${x}:${y}`;
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const texture = scene.textures.createCanvas(
      key,
      Math.ceil(w * ROAD_BAKE_SCALE),
      Math.ceil(h * ROAD_BAKE_SCALE),
    );
    if (!texture) return undefined;
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
    // Zone floors first: soft outward rim, then the textured surface.
    for (const s of hits)
      if (s.kind === "zone") {
        const fill = pattern(ctx, zoneRefs[s.z.texture]!);
        trace(ctx, s.z.points, true);
        for (const [grow, alpha] of [
          [64, 0.18],
          [38, 0.32],
          [16, 0.6],
        ] as const) {
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = fill;
          ctx.lineWidth = grow;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = fill;
        ctx.fill();
      }
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
      .setDepth(renderDepth("paths") - (hits.some((s) => s.kind === "zone") ? 1 : 0));
    const chunk = { key, image, x, y, seen: 0 };
    chunks.set(key, chunk);
    return chunk;
  };
  const release = (c: Chunk) => {
    c.image.destroy();
    scene.textures.remove(c.key);
    chunks.delete(c.key);
  };
  let frame = 0;
  let released = false;
  const dispose = () => {
    if (released) return;
    released = true;
    for (const c of [...chunks.values()]) release(c);
  };
  scene.events.once("shutdown", dispose);
  scene.events.once("destroy", dispose);
  const update = (budget: number) => {
    if (released) return;
    frame++;
    const view = scene.cameras.main.worldView;
    const wanted: { x: number; y: number; d: number }[] = [];
    for (let y = 0; y < size.height; y += ROAD_CHUNK_SIDE)
      for (let x = 0; x < size.width; x += ROAD_CHUNK_SIDE) {
        const inView =
          x < view.right + 128 &&
          x + ROAD_CHUNK_SIDE > view.left - 128 &&
          y < view.bottom + 128 &&
          y + ROAD_CHUNK_SIDE > view.top - 128;
        const key = `road-cache:${worldId}:${x}:${y}`;
        const chunk = chunks.get(key);
        if (chunk) {
          chunk.image.setVisible(inView);
          if (inView) chunk.seen = frame;
        } else if (inView) {
          const w = Math.min(ROAD_CHUNK_SIDE, size.width - x),
            h = Math.min(ROAD_CHUNK_SIDE, size.height - y);
          if (
            shapes.some(
              (s) => s.b.left < x + w && s.b.right > x && s.b.top < y + h && s.b.bottom > y,
            )
          )
            wanted.push({
              x,
              y,
              d: Math.hypot(x + w / 2 - view.centerX, y + h / 2 - view.centerY),
            });
        }
      }
    wanted.sort((a, b) => a.d - b.d);
    for (const { x, y } of wanted.slice(0, budget)) {
      const w = Math.min(ROAD_CHUNK_SIDE, size.width - x),
        h = Math.min(ROAD_CHUNK_SIDE, size.height - y);
      const started = performance.now();
      const chunk = bake(
        x,
        y,
        shapes.filter(
          (s) => s.b.left < x + w && s.b.right > x && s.b.top < y + h && s.b.bottom > y,
        ),
      );
      recordBake(performance.now() - started);
      if (chunk) chunk.seen = frame;
    }
    // Release chunks that left the view by more than RELEASE_MARGIN, so the set of baked chunks
    // depends only on where the camera is now, not on where it has been.
    for (const c of [...chunks.values()])
      if (
        c.x > view.right + RELEASE_MARGIN ||
        c.x + ROAD_CHUNK_SIDE < view.left - RELEASE_MARGIN ||
        c.y > view.bottom + RELEASE_MARGIN ||
        c.y + ROAD_CHUNK_SIDE < view.top - RELEASE_MARGIN
      )
        release(c);
  };
  update(Infinity);
  return {
    dispose,
    updateVisibility() {
      update(4);
    },
  };
}
