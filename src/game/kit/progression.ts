import type { RaceId } from "../world/races";
import { KIT_NODES } from "./nodes.generated";

/** One skill point per level in 1–20; every node, the root included, costs one point. */
export const MAX_SKILL_LEVEL = 20;
export const skillPointsAt = (level: number) => Math.min(level, MAX_SKILL_LEVEL);
export const spentPoints = (learned: readonly string[]) => learned.length;
export const freePoints = (level: number, learned: readonly string[]) =>
  skillPointsAt(level) - spentPoints(learned);

export type LearnCheck = { ok: true } | { ok: false; reason: string };
export function canLearn(
  race: RaceId,
  level: number,
  learned: readonly string[],
  id: string,
): LearnCheck {
  const nodes = KIT_NODES[race];
  const node = nodes.find((n) => n.id === id);
  if (!node) return { ok: false, reason: "Nieznany węzeł." };
  if (learned.includes(id)) return { ok: false, reason: "Już poznane." };
  if (level < node.minLevel) return { ok: false, reason: "Wymaga poziomu " + node.minLevel + "." };
  if (freePoints(level, learned) < 1) return { ok: false, reason: "Brak punktów umiejętności." };
  if (node.requires.length && !node.requires.some((r) => learned.includes(r)))
    return {
      ok: false,
      reason:
        "Wymaga: " +
        node.requires.map((r) => nodes.find((n) => n.id === r)?.name ?? r).join(" lub ") +
        ".",
    };
  if (node.excludes && learned.includes(node.excludes))
    return {
      ok: false,
      reason:
        "Wyklucza się z: " +
        (nodes.find((n) => n.id === node.excludes)?.name ?? node.excludes) +
        ".",
    };
  return { ok: true };
}
/** Node ids in learning order that the tree allows; used to validate saves. */
export function validLearned(race: RaceId, level: number, learned: readonly string[]): boolean {
  if (new Set(learned).size !== learned.length) return false;
  if (learned.length > skillPointsAt(level)) return false;
  const nodes = KIT_NODES[race];
  const ids = new Set(nodes.map((n) => n.id));
  if (learned.some((id) => !ids.has(id))) return false;
  const set = new Set(learned);
  for (const id of learned) {
    const n = nodes.find((x) => x.id === id)!;
    if (level < n.minLevel) return false;
    if (n.requires.length && !n.requires.some((r) => set.has(r))) return false;
    if (n.excludes && set.has(n.excludes)) return false;
  }
  return true;
}
export const START_NODES = ["R"] as const;
