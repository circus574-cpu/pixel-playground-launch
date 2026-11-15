/**
 * Placement of the painted land maps on the flat atlas (used by WorldOverlay). Pure geometry and canvas drawing, no React.
 */
import { MAP_W } from "./mapData";
import type { OverlayTile } from "./worldToAtlas";

type Tile = OverlayTile;

/**
 * One painted cell of a land map placed on the atlas by its four corners (atlas units). The generator fits an affine
 * transform to each cell from three exact corners (top-left, top-right, bottom-left) and guesses the fourth, so two
 * neighbours disagree about their shared edge by several atlas units and the zoomed map showed a patchwork of squares
 * with gaps. The corners are shared instead: every corner of the grid is placed once, from the cells that know it exactly.
 */
export type Pt = { x: number; y: number };
export type Cell = { src: [number, number, number, number]; q: [Pt, Pt, Pt, Pt] };
const meshCache = new WeakMap<Tile[], Map<Tile, Cell>>();

/** Distinct coordinates of a land's grid lines, merged when they differ only by the generator's rounding. */
function gridLines(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const lines: number[] = [];
  for (const v of sorted) if (!lines.length || v - lines[lines.length - 1]! > 0.05) lines.push(v);
  return lines;
}
const nearest = (lines: number[], v: number) => {
  let best = 0;
  for (let i = 1; i < lines.length; i++)
    if (Math.abs(lines[i]! - v) < Math.abs(lines[best]! - v)) best = i;
  return best;
};

export function buildMesh(tiles: Tile[]): Map<Tile, Cell> {
  const cached = meshCache.get(tiles);
  if (cached) return cached;
  const cells = new Map<Tile, Cell>();
  const lands = new Set(tiles.map((t) => t.land));
  for (const land of lands) {
    const own = tiles.filter((t) => t.land === land);
    const xs = gridLines(own.flatMap((t) => [t.crop[0]!, t.crop[0]! + t.crop[2]!]));
    const ys = gridLines(own.flatMap((t) => [t.crop[1]!, t.crop[1]! + t.crop[3]!]));
    const at = (t: Tile, x: number, y: number): Pt => {
      const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = t.m;
      return { x: a * x + c * y + e, y: b * x + d * y + f };
    };
    const exact = new Map<string, Pt>();
    const guessed = new Map<string, Pt>();
    const key = (i: number, j: number) => i + ":" + j;
    const corners = own.map((t) => {
      const [x0 = 0, y0 = 0, w = 0, h = 0] = t.crop;
      const i0 = nearest(xs, x0),
        i1 = nearest(xs, x0 + w),
        j0 = nearest(ys, y0),
        j1 = nearest(ys, y0 + h);
      if (!exact.has(key(i0, j0))) exact.set(key(i0, j0), at(t, x0, y0));
      if (!exact.has(key(i1, j0))) exact.set(key(i1, j0), at(t, x0 + w, y0));
      if (!exact.has(key(i0, j1))) exact.set(key(i0, j1), at(t, x0, y0 + h));
      guessed.set(key(i1, j1), at(t, x0 + w, y0 + h));
      return { t, i0, i1, j0, j1 };
    });
    for (const { t, i0, i1, j0, j1 } of corners) {
      const [x0 = 0, y0 = 0, w = 0, h = 0] = t.crop;
      const tl = exact.get(key(i0, j0)) ?? at(t, x0, y0);
      // A corner on the far side of the atlas seam is the same place shifted by one map width.
      const near = (p: Pt): Pt => {
        let x = p.x;
        while (x - tl.x > MAP_W / 2) x -= MAP_W;
        while (tl.x - x > MAP_W / 2) x += MAP_W;
        return { x, y: p.y };
      };
      const tr = near(exact.get(key(i1, j0)) ?? at(t, x0 + w, y0));
      const bl = near(exact.get(key(i0, j1)) ?? at(t, x0, y0 + h));
      const br = near(exact.get(key(i1, j1)) ?? guessed.get(key(i1, j1)) ?? at(t, x0 + w, y0 + h));
      cells.set(t, { src: [x0, y0, w, h], q: [tl, tr, bl, br] });
    }
  }
  meshCache.set(tiles, cells);
  return cells;
}

/** Affine transform taking three source points to three destination points. */
function triangleTransform(
  s: Pt[],
  d: Pt[],
): [number, number, number, number, number, number] | null {
  const [s0, s1, s2] = s as [Pt, Pt, Pt];
  const [d0, d1, d2] = d as [Pt, Pt, Pt];
  const det = (s1.x - s0.x) * (s2.y - s0.y) - (s2.x - s0.x) * (s1.y - s0.y);
  if (Math.abs(det) < 1e-9) return null;
  const a = ((d1.x - d0.x) * (s2.y - s0.y) - (d2.x - d0.x) * (s1.y - s0.y)) / det;
  const c = ((d2.x - d0.x) * (s1.x - s0.x) - (d1.x - d0.x) * (s2.x - s0.x)) / det;
  const b = ((d1.y - d0.y) * (s2.y - s0.y) - (d2.y - d0.y) * (s1.y - s0.y)) / det;
  const dd = ((d2.y - d0.y) * (s1.x - s0.x) - (d1.y - d0.y) * (s2.x - s0.x)) / det;
  return [a, b, c, dd, d0.x - a * s0.x - c * s0.y, d0.y - b * s0.x - dd * s0.y];
}

/** Hairline gaps between antialiased clip edges are hidden by growing each triangle by this many canvas pixels. */
const TRIANGLE_BLEED = 0.75;

function drawTriangle(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  s: Pt[],
  atlas: Pt[],
  scale: number,
  ox: number,
  oy: number,
) {
  const d = atlas.map((p) => ({ x: (p.x - ox) * scale, y: (p.y - oy) * scale }));
  const m = triangleTransform(s, d);
  if (!m) return;
  const g = { x: (d[0]!.x + d[1]!.x + d[2]!.x) / 3, y: (d[0]!.y + d[1]!.y + d[2]!.y) / 3 };
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.beginPath();
  d.forEach((p, i) => {
    const len = Math.hypot(p.x - g.x, p.y - g.y) || 1;
    const x = p.x + ((p.x - g.x) / len) * TRIANGLE_BLEED;
    const y = p.y + ((p.y - g.y) / len) * TRIANGLE_BLEED;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  });
  ctx.closePath();
  ctx.clip();
  ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
  const xs = s.map((p) => p.x),
    ys = s.map((p) => p.y);
  const bx = Math.min(...xs) - 1,
    by = Math.min(...ys) - 1;
  const bw = Math.max(...xs) - bx + 1,
    bh = Math.max(...ys) - by + 1;
  ctx.drawImage(image, bx, by, bw, bh, bx, by, bw, bh);
  ctx.restore();
}

/** Draws one cell. A cell that is a parallelogram (to within half a pixel) keeps the cheap single-rectangle path. */
export function drawCell(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  cell: Cell,
  scale: number,
  ox: number,
  oy: number,
) {
  const [sx, sy, sw, sh] = cell.src;
  const [tl, tr, bl, br] = cell.q;
  const dev = Math.hypot(br.x - (tr.x + bl.x - tl.x), br.y - (tr.y + bl.y - tl.y)) * scale;
  if (dev < 0.5) {
    const a = (tr.x - tl.x) / sw,
      b = (tr.y - tl.y) / sw,
      c = (bl.x - tl.x) / sh,
      d = (bl.y - tl.y) / sh;
    const e = tl.x - a * sx - c * sy,
      f = tl.y - b * sx - d * sy;
    ctx.setTransform(
      a * scale,
      b * scale,
      c * scale,
      d * scale,
      (e - ox) * scale,
      (f - oy) * scale,
    );
    ctx.drawImage(image, sx, sy, sw, sh, sx, sy, sw + 0.6, sh + 0.6);
    return;
  }
  // The painted cell is bilinear between its four corners; piecewise-linear triangles follow it closely.
  const n = Math.min(8, Math.max(2, Math.ceil(Math.sqrt(dev / 2))));
  const point = (u: number, v: number): [Pt, Pt] => {
    const fu = u / n,
      fv = v / n;
    return [
      { x: sx + sw * fu, y: sy + sh * fv },
      {
        x:
          (1 - fu) * (1 - fv) * tl.x + fu * (1 - fv) * tr.x + (1 - fu) * fv * bl.x + fu * fv * br.x,
        y:
          (1 - fu) * (1 - fv) * tl.y + fu * (1 - fv) * tr.y + (1 - fu) * fv * bl.y + fu * fv * br.y,
      },
    ];
  };
  for (let v = 0; v < n; v++)
    for (let u = 0; u < n; u++) {
      const p00 = point(u, v),
        p10 = point(u + 1, v),
        p01 = point(u, v + 1),
        p11 = point(u + 1, v + 1);
      drawTriangle(ctx, image, [p00[0], p10[0], p01[0]], [p00[1], p10[1], p01[1]], scale, ox, oy);
      drawTriangle(ctx, image, [p10[0], p11[0], p01[0]], [p10[1], p11[1], p01[1]], scale, ox, oy);
    }
}
