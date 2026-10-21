/**
 * Pure, browser-safe maths for the /mapa 3D globe.
 *
 * The globe wraps the same 2:1 painted atlas as the 2D map using an
 * equirectangular projection that matches three.js SphereGeometry UVs:
 * map x → longitude (u), map y → colatitude (1 − v). Region picking therefore
 * reuses the outlines traced from the atlas, so clicks stay aligned with the
 * painted coasts on the sphere too.
 */
import { MAP_H, MAP_W, REGIONS, containsPoint, type MapRegion, type Point } from "./mapData";

export type Vec3 = [number, number, number];

/** Camera limits, as distances from the planet centre (planet radius = 1). */
export const CAMERA = {
  min: 1.4,
  /** How far beyond the fitted opening distance the user may zoom out. */
  maxFactor: 1.3,
  /** Share of the shorter screen side the planet fills at the opening view. */
  fill: 0.84,
  /** Base vertical field of view on landscape screens (degrees). */
  fov: 38,
} as const;

/** Opening view: Verdantia's starting village side, with Pyra and island II in view. */
export const START_POINT: Point = { x: 800, y: 560 };

const TAU = Math.PI * 2;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Atlas point → position on a sphere of radius r (three.js world axes). */
export function mapToSphere(p: Point, r = 1): Vec3 {
  const phi = (p.x / MAP_W) * TAU;
  const theta = (clamp(p.y, 0, MAP_H) / MAP_H) * Math.PI;
  return [
    -r * Math.cos(phi) * Math.sin(theta),
    r * Math.cos(theta),
    r * Math.sin(phi) * Math.sin(theta),
  ];
}

/** Position on (or off) the sphere → atlas point. */
export function sphereToMap([x, y, z]: Vec3): Point {
  const r = Math.hypot(x, y, z) || 1;
  const theta = Math.acos(clamp(y / r, -1, 1));
  let phi = Math.atan2(z, -x);
  if (phi < 0) phi += TAU;
  return { x: (phi / TAU) * MAP_W, y: (theta / Math.PI) * MAP_H };
}

/** Texture UV from a raycast hit → atlas point (u wraps around the seam). */
export function uvToMap(u: number, v: number): Point {
  const wrapped = ((u % 1) + 1) % 1;
  return { x: wrapped * MAP_W, y: clamp(1 - v, 0, 1) * MAP_H };
}

/** Area-weighted centroid of a region outline (shoelace formula). */
export function outlineCentroid(region: MapRegion): Point {
  const o = region.outline;
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = o.length - 1; i < o.length; j = i++) {
    const p = o[i];
    const q = o[j];
    if (!p || !q) continue;
    const cross = q.x * p.y - p.x * q.y;
    a += cross;
    cx += (q.x + p.x) * cross;
    cy += (q.y + p.y) * cross;
  }
  if (Math.abs(a) < 1e-9) return region.center;
  return { x: cx / (3 * a), y: cy / (3 * a) };
}

/**
 * Where a region's globe marker sits: its centroid when that lies on the
 * region itself (it can fall in a bay for concave coasts), else its label.
 */
export function markerPoint(region: MapRegion): Point {
  const c = outlineCentroid(region);
  return containsPoint(region, c) ? c : region.label;
}

/** Region under an atlas point, or null for open ocean. */
export function regionAt(p: Point): MapRegion | null {
  return REGIONS.find((r) => containsPoint(r, p)) ?? null;
}

const DEG = Math.PI / 180;

/**
 * Vertical field of view for a viewport aspect (width / height). Portrait
 * phones widen it so the horizontal view stays close to the landscape one.
 */
export function globeFov(aspect: number) {
  if (aspect >= 1) return CAMERA.fov;
  const half = Math.atan(Math.tan((CAMERA.fov / 2) * DEG * 0.9) / aspect) / DEG;
  return clamp(half * 2, CAMERA.fov, 75);
}

/** Half of the narrower view angle, in radians. */
function narrowHalfAngle(aspect: number) {
  const halfV = (globeFov(aspect) / 2) * DEG;
  return aspect >= 1 ? halfV : Math.atan(Math.tan(halfV) * aspect);
}

/** Opening distance: the whole planet disc fits the shorter screen side. */
export function fitDistance(aspect: number) {
  return 1 / Math.sin(narrowHalfAngle(aspect) * CAMERA.fill);
}

export function maxDistance(aspect: number) {
  return fitDistance(aspect) * CAMERA.maxFactor;
}

export function focusDistance(region: MapRegion, aspect: number) {
  const k = region.kind === "island" ? 0.34 : 0.56;
  return 1 + (fitDistance(aspect) - 1) * k;
}

/** Camera position that looks straight down at a region. */
export function cameraFor(region: MapRegion, aspect: number): Vec3 {
  return mapToSphere(region.center, focusDistance(region, aspect));
}

export function startCamera(aspect: number): Vec3 {
  return mapToSphere(START_POINT, fitDistance(aspect));
}

export function clampDistance(d: number, aspect: number) {
  return clamp(d, CAMERA.min, maxDistance(aspect));
}

/** Zoom read-out: 100 % at the opening distance. */
export function zoomPercent(distance: number, aspect: number) {
  return Math.round((fitDistance(aspect) / distance) * 100);
}

/** Angular radius of the planet disc seen from a distance (radians). */
export function discHalfAngle(distance: number) {
  return Math.asin(1 / Math.max(distance, 1));
}

export { narrowHalfAngle };

/**
 * Whether a surface point faces the camera, as a 0..1 fade. A point is above
 * the horizon when dot(n, c) > 1/|c| for unit normal n and camera position c.
 */
export function horizonFade(surface: Vec3, camera: Vec3) {
  const n = Math.hypot(...surface) || 1;
  const c = Math.hypot(...camera) || 1;
  const dot = (surface[0] * camera[0] + surface[1] * camera[1] + surface[2] * camera[2]) / (n * c);
  const horizon = 1 / c;
  return clamp((dot - horizon) / 0.12, 0, 1);
}

export type GlobeEnv = {
  devicePixelRatio: number;
  coarsePointer: boolean;
  width: number;
  /** navigator.deviceMemory in GB, when the browser exposes it. */
  deviceMemory?: number | undefined;
  /** navigator.hardwareConcurrency, when available. */
  cores?: number | undefined;
};

export type GlobeQuality = {
  /** Upper bound for the renderer pixel ratio. */
  maxDpr: number;
  /** Load the 3840 px colour texture after the first frame. */
  hiResColor: boolean;
  /** Sphere width segments (height is half). */
  segments: number;
  antialias: boolean;
};

/** Render budget: phones and low-memory devices get a capped DPR and lighter assets. */
export function globeQuality(env: GlobeEnv): GlobeQuality {
  const mobile = env.coarsePointer || env.width < 900;
  const lowEnd = (env.deviceMemory ?? 8) <= 3 || (env.cores ?? 8) <= 4;
  const cap = mobile ? (lowEnd ? 1.25 : 1.5) : 2;
  const dpr = Math.max(1, env.devicePixelRatio || 1);
  return {
    maxDpr: Math.min(dpr, cap),
    hiResColor: !mobile && !lowEnd,
    segments: mobile || lowEnd ? 96 : 160,
    antialias: !mobile || dpr < 2,
  };
}
