/**
 * A world v2 position (land-local units) as a point of the planet atlas, through the same
 * per-cell affine transforms the overlay uses to place the painted land (worldOverlay.v2.json).
 */
export type OverlayTile = { land: string; crop: number[]; m: number[]; size: number[] };
export type OverlayLands = Record<string, { upp: number }>;

export function worldToAtlas(
  data: { lands?: OverlayLands; tiles: OverlayTile[] },
  land: string,
  x: number,
  y: number,
): { x: number; y: number } | null {
  const upp = data.lands?.[land]?.upp;
  if (!upp) return null;
  const px = x / upp,
    py = y / upp;
  let best: OverlayTile | null = null,
    bestDistance = Infinity;
  for (const t of data.tiles) {
    if (t.land !== land) continue;
    const [x0, y0, w, h] = t.crop as [number, number, number, number];
    // Inside the cell wins; otherwise the nearest cell (a seam cell may have been skipped).
    const dx = Math.max(x0 - px, 0, px - (x0 + w)),
      dy = Math.max(y0 - py, 0, py - (y0 + h));
    const d = dx * dx + dy * dy;
    if (d < bestDistance) {
      best = t;
      bestDistance = d;
      if (d === 0) break;
    }
  }
  if (!best) return null;
  const [a, b, c, d, e, f] = best.m as [number, number, number, number, number, number];
  return { x: a * px + c * py + e, y: b * px + d * py + f };
}

/** Inverse of the authored affine cell transform. Ocean/gaps never snap to a random land. */
export function atlasToWorld(
  data: { lands?: OverlayLands; tiles: OverlayTile[] },
  point: { x: number; y: number },
  land?: string,
): { land: string; x: number; y: number } | null {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  for (const tile of data.tiles) {
    if (land && tile.land !== land) continue;
    const upp = data.lands?.[tile.land]?.upp;
    if (!upp) continue;
    const [a, b, c, d, e, f] = tile.m as [number, number, number, number, number, number];
    const det = a * d - b * c;
    if (Math.abs(det) < 1e-10) continue;
    const dx = point.x - e,
      dy = point.y - f;
    const x = (d * dx - c * dy) / det,
      y = (a * dy - b * dx) / det;
    const [cx, cy, w, h] = tile.crop as [number, number, number, number];
    if (x < cx - 1e-6 || y < cy - 1e-6 || x > cx + w + 1e-6 || y > cy + h + 1e-6) continue;
    return { land: tile.land, x: x * upp, y: y * upp };
  }
  return null;
}
