/**
 * Open-world thinning (owner request 15.11.2026: fewer trees and other objects everywhere). The generated lands carry
 * ~90 000 decorations each; most of them are non-solid trees and bushes, so the world read as a continuous forest.
 * Presentation only: a decoration that has a collision footprint (`solid`) is always kept, collision never reads art
 * objects, and the choice is a hash of the position, so a chunk looks the same every time it is loaded.
 */
export const SCENERY_KEEP: Readonly<Record<string, number>> = {
  tree: 0.3,
  bush: 0.3,
  rock: 0.5,
  crystal: 0.4,
};

export type SceneryItem = { x: number; y: number; kind?: string; solid?: boolean };

/** Stable pseudo-random number in [0, 1) for a position. */
export function positionHash(x: number, y: number): number {
  let h = Math.imul(Math.round(x) | 0, 73856093) ^ Math.imul(Math.round(y) | 0, 19349663);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

export function keepsScenery(item: SceneryItem): boolean {
  const keep = SCENERY_KEEP[item.kind ?? ""];
  if (keep === undefined || item.solid) return true;
  return positionHash(item.x, item.y) < keep;
}

export function thinScenery<T extends SceneryItem>(items: readonly T[]): T[] {
  return items.filter(keepsScenery);
}
