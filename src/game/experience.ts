import { LEVEL_MAX } from "./kit/progression";
export const xpNeeded = (level: number) => 100 + (level - 1) * 60;
/** Shared canonical progression, including transactional rewards. Callbacks preserve ordinary level effects. */
export function advanceExperience(
  player: { xp: number; level: number },
  xp: number,
  onLevel?: () => void,
) {
  if (!Number.isSafeInteger(xp) || xp < 0) throw Error("Invalid experience award");
  player.xp += xp;
  let levels = 0;
  while (player.level < LEVEL_MAX && player.xp >= xpNeeded(player.level)) {
    player.xp -= xpNeeded(player.level);
    player.level++;
    levels++;
    onLevel?.();
  }
  if (player.level === LEVEL_MAX) player.xp = Math.min(player.xp, xpNeeded(LEVEL_MAX) - 1);
  return levels;
}
