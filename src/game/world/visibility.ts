import type { Point } from "../navigation";
import type { ForestObject } from "./forest";

let occluded = false;
/** Whether any object faded for the hero since the last reset (drives the hero's see-through outline). */
export const heroOcclusion = {
  reset() {
    occluded = false;
  },
  get covered() {
    return occluded;
  },
};

/** Opacity of a foreground object: faded only while it covers the actor's torso behind its foot depth. */
export function occlusionAlpha(object: ForestObject, player: Point): number {
  if (!coversPlayer(object, player)) return 1;
  // The outline is only for something tall standing right over the hero's body (a crown, a house),
  // not for ground props nearby (owner 26.10.2026: the hero showed as a pink silhouette in a meadow).
  if (object.height >= 140 && coversPlayer(object, player, 0)) occluded = true;
  // Crowns still read as in front of the hero, but a dense forest no longer hides them completely
  // (owner 26.10.2026: the hero was invisible among v2 trees).
  return /tree|pine|bamboo|oak|birch|spruce|willow|palm|cherry|crystal|bush/.test(object.kind) ? 0.12 : 0.18;
}

export function coversPlayer(object: ForestObject, player: Point, margin?: number): boolean {
  if (object.kind === "bridge" || object.y <= player.y) return false;
  const left = object.x - object.width * object.anchorX;
  const top = object.y - object.height * object.anchorY;
  // A margin around the torso: in a dense forest several crowns overlap the hero at once.
  const m = margin ?? (/tree|pine|bamboo|oak|birch|spruce|willow|palm/.test(object.kind) ? 48 : 0);
  return (
    player.x >= left - m &&
    player.x <= left + object.width + m &&
    player.y - 45 >= top - m &&
    player.y - 45 <= top + object.height + m
  );
}

/** A creature (monster, NPC, other player) that foliage must never hide. */
export type OcclusionFocus = Point & { id: string };

const coveredFoci = new Set<string>();
/** Which non-hero creatures stood under something tall this frame (drives their see-through outline). */
export const focusOcclusion = {
  reset() {
    coveredFoci.clear();
  },
  covered(id: string) {
    return coveredFoci.has(id);
  },
};

const CROWN = /tree|pine|bamboo|oak|birch|spruce|willow|palm|cherry|crystal|bush/;
/**
 * Opacity of a foreground object for every creature that could stand behind it, so a dense forest
 * never hides a monster or a villager (owner 02.11.2026). Same fading as for the hero.
 */
export function foliageAlpha(object: ForestObject, foci: readonly OcclusionFocus[]): number {
  if (!foci.length || object.kind === "bridge") return 1;
  const left = object.x - object.width * object.anchorX - 48,
    right = left + object.width + 96,
    top = object.y - object.height * object.anchorY - 48 - 45,
    bottom = top + object.height + 96 + 90;
  let alpha = 1;
  for (const f of foci) {
    if (f.x < left || f.x > right || f.y < top || f.y > bottom) continue;
    if (!coversPlayer(object, f)) continue;
    if (object.height >= 140 && coversPlayer(object, f, 0)) coveredFoci.add(f.id);
    // Stronger fade than for the hero: several crowns stack in a forest, and a monster is small.
    alpha = Math.min(alpha, CROWN.test(object.kind) ? 0.12 : 0.18);
  }
  return alpha;
}
