import planetData from "./planet.json" with { type: "json" };
/**
 * Geometry of planet Superior, shared by the atlas, the globe, the minimap and the game maps.
 * The four main cities form a regular tetrahedron on a sphere, so every pair is exactly
 * `cityDistance` game units apart along the surface. Quest islands sit on the six edge midpoints.
 * Pure maths: no game session, save or storage access.
 */
export type MapPoint = { x: number; y: number };
export type PlanetFeature = {
  kind: "continent" | "island";
  lon: number;
  lat: number;
  /** Centre of the feature in the original (source) painted atlas, in map units. */
  source: MapPoint;
};
export const PLANET = planetData as unknown as {
  radius: number;
  cityDistance: number;
  /** Shrink factor applied to continents and islands when they were re-laid on the sphere. */
  scale: number;
  mapUnitsWide: number;
  unitsPerMapUnit: number;
  features: Record<string, PlanetFeature>;
  islandEdges: Record<string, [string, string]>;
};
export const MAP_UNITS = { width: 2000, height: 1000 };
const RAD = Math.PI / 180;
export type LonLat = { lon: number; lat: number };

export function mapToLonLat(p: MapPoint): LonLat {
  return { lon: (p.x / MAP_UNITS.width) * 360 - 180, lat: 90 - (p.y / MAP_UNITS.height) * 180 };
}
export function lonLatToMap(p: LonLat): MapPoint {
  return {
    x: ((p.lon + 180) / 360) * MAP_UNITS.width,
    y: ((90 - p.lat) / 180) * MAP_UNITS.height,
  };
}
export function sphereVector(p: LonLat): [number, number, number] {
  const lo = p.lon * RAD,
    la = p.lat * RAD;
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
}
/** Surface distance in game units between two points on the planet. */
export function surfaceDistance(a: LonLat, b: LonLat): number {
  const [ax, ay, az] = sphereVector(a),
    [bx, by, bz] = sphereVector(b);
  return PLANET.radius * Math.acos(Math.max(-1, Math.min(1, ax * bx + ay * by + az * bz)));
}
export function featureCenter(id: string): LonLat {
  const f = PLANET.features[id];
  if (!f) throw new Error("Unknown planet feature: " + id);
  return { lon: f.lon, lat: f.lat };
}
/**
 * A point of the original painted continent/island (map units of the source atlas) → its place on
 * the planet atlas. Azimuthal equidistant around the feature centre: sizes and distances from the
 * centre are true, the whole feature is shrunk by `PLANET.scale`.
 */
export function sourceToPlanet(featureId: string, src: MapPoint): MapPoint {
  const f = PLANET.features[featureId];
  if (!f) throw new Error("Unknown planet feature: " + featureId);
  const k = (PLANET.unitsPerMapUnit * PLANET.scale) / PLANET.radius;
  const x = (src.x - f.source.x) * k,
    y = -(src.y - f.source.y) * k,
    rho = Math.hypot(x, y);
  if (rho < 1e-12) return lonLatToMap(f);
  const p0 = f.lat * RAD,
    l0 = f.lon * RAD;
  const lat = Math.asin(Math.cos(rho) * Math.sin(p0) + (y * Math.sin(rho) * Math.cos(p0)) / rho);
  const lon =
    l0 +
    Math.atan2(
      x * Math.sin(rho),
      rho * Math.cos(p0) * Math.cos(rho) - y * Math.sin(p0) * Math.sin(rho),
    );
  const d = ((((lon / RAD - f.lon + 180) % 360) + 360) % 360) - 180;
  return lonLatToMap({ lon: f.lon + d, lat: lat / RAD });
}
