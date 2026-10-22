import zonesData from "./zones.json" with { type: "json" };
/**
 * Pure mapping between a continent's game coordinates and the painted planet atlas used by
 * /mapa and the globe. No game session, save or storage access, so the planet map stays light.
 */
export type MapPoint = { x: number; y: number };
export type ZoneEntry = {
  id: "north" | "south" | "east" | "west";
  name: string;
  summary: string;
  /** Zone centre in game coordinates. */
  x: number;
  y: number;
  width: number;
  height: number;
};
export type OpenWorld = {
  width: number;
  height: number;
  /** The settlement in game coordinates; it maps onto the painted city on the atlas. */
  anchor: MapPoint;
  zones: ZoneEntry[];
  atlas: {
    settle: MapPoint;
    bbox: { x0: number; y0: number; x1: number; y1: number };
    crop: { x0: number; y0: number; x1: number; y1: number };
  };
};
export const OPEN_WORLDS = zonesData as unknown as Partial<Record<string, OpenWorld>>;
const axis = (v: number, anchor: number, size: number, settle: number, lo: number, hi: number) =>
  v <= anchor
    ? lo + (Math.max(0, v) / anchor) * (settle - lo)
    : settle + ((Math.min(size, v) - anchor) / (size - anchor)) * (hi - settle);
/** Game coordinates → atlas map units (piecewise linear: the city lands on its painted marker). */
export function atlasPoint(worldId: string, p: MapPoint): MapPoint | undefined {
  const w = OPEN_WORLDS[worldId];
  if (!w) return undefined;
  const { settle, bbox } = w.atlas;
  return {
    x: axis(p.x, w.anchor.x, w.width, settle.x, bbox.x0, bbox.x1),
    y: axis(p.y, w.anchor.y, w.height, settle.y, bbox.y0, bbox.y1),
  };
}
/** Position on the minimap image (percent), which is the atlas crop for open-world continents. */
export function minimapPercent(
  worldId: string,
  p: MapPoint,
  fallback: { width: number; height: number },
) {
  const w = OPEN_WORLDS[worldId];
  const a = atlasPoint(worldId, p);
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  if (!w || !a)
    return { left: clamp((p.x / fallback.width) * 100), top: clamp((p.y / fallback.height) * 100) };
  const c = w.atlas.crop;
  return {
    left: clamp(((a.x - c.x0) / (c.x1 - c.x0)) * 100),
    top: clamp(((a.y - c.y0) / (c.y1 - c.y0)) * 100),
  };
}
