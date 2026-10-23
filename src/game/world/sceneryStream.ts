/** Spatial grid for streaming scenery: only objects near the camera exist as game objects. */
export const SCENERY_CELL = 1024;

type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
};

const key = (cx: number, cy: number) => cx + cy * 4096;

/** Objects bucketed by the cell of their foot point (x, y). */
export function buildSceneryGrid(objects: readonly Pick<Box, "x" | "y">[]) {
  const grid = new Map<number, number[]>();
  objects.forEach((o, i) => {
    const k = key(Math.floor(o.x / SCENERY_CELL), Math.floor(o.y / SCENERY_CELL));
    const cell = grid.get(k);
    if (cell) cell.push(i);
    else grid.set(k, [i]);
  });
  return grid;
}

export type View = { left: number; right: number; top: number; bottom: number };

/** Largest object extent around its foot point: queries are padded by it so no object pops in late. */
export function sceneryReach(objects: readonly Box[]) {
  let reach = 0;
  for (const o of objects)
    reach = Math.max(
      reach,
      o.width * Math.max(o.anchorX, 1 - o.anchorX),
      o.height * Math.max(o.anchorY, 1 - o.anchorY),
    );
  return Math.ceil(reach);
}

/** Indices of objects whose foot cell lies within `view` grown by `pad` (an upper bound of those that can be visible). */
export function sceneryNear(grid: Map<number, number[]>, view: View, pad: number): number[] {
  const x0 = Math.floor((view.left - pad) / SCENERY_CELL),
    x1 = Math.floor((view.right + pad) / SCENERY_CELL),
    y0 = Math.floor((view.top - pad) / SCENERY_CELL),
    y1 = Math.floor((view.bottom + pad) / SCENERY_CELL);
  const out: number[] = [];
  for (let cy = y0; cy <= y1; cy++)
    for (let cx = x0; cx <= x1; cx++) {
      const cell = grid.get(key(cx, cy));
      if (cell) for (const i of cell) out.push(i);
    }
  return out;
}
