import type { Point } from "../navigation";
import type { ForestObject } from "./forest";

/** Fade foreground scenery only when it covers the actor's torso behind its foot depth. */
export function coversPlayer(object: ForestObject, player: Point): boolean {
  if (object.kind === "bridge" || object.y <= player.y) return false;
  const left = object.x - object.width * object.anchorX;
  const top = object.y - object.height * object.anchorY;
  return (
    player.x >= left &&
    player.x <= left + object.width &&
    player.y - 45 >= top &&
    player.y - 45 <= top + object.height
  );
}
