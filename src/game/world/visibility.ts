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
  occluded = true;
  // Crowns still read as in front of the hero, but a dense forest no longer hides them completely
  // (owner 26.10.2026: the hero was invisible among v2 trees).
  return /tree|pine|bamboo|oak|birch|spruce|willow|palm/.test(object.kind) ? 0.45 : 0.28;
}

export function coversPlayer(object: ForestObject, player: Point): boolean {
  if (object.kind === "bridge" || object.y <= player.y) return false;
  const left = object.x - object.width * object.anchorX;
  const top = object.y - object.height * object.anchorY;
  // A margin around the torso: in a dense forest several crowns overlap the hero at once.
  const m = /tree|pine|bamboo|oak|birch|spruce|willow|palm/.test(object.kind) ? 48 : 0;
  return (
    player.x >= left - m &&
    player.x <= left + object.width + m &&
    player.y - 45 >= top - m &&
    player.y - 45 <= top + object.height + m
  );
}
