import type { RaceId } from "../world/races";
import { KIT_NODES } from "./nodes.generated";

/**
 * One skill point per level, with no cap at 20 (owner decision 03.11.2026; the old limit was only a
 * starting point for the tree). Every node, the root included, costs one point. LEVEL_MAX is a
 * technical sanity bound for stored data (the `xp` field stays below 1 000 000), not a game limit.
 */
export const LEVEL_MAX = 10_000;
export const skillPointsAt = (level: number) => level;
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
  // A learned node can take more points (its rank grows); only the root stays at one point.
  if (learned.includes(id) && id === "R") return { ok: false, reason: "Już poznane." };
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
  // The same id more than once is a rank; every rank costs a point. Only the root is limited to one.
  if (learned.filter((id) => id === "R").length > 1) return false;
  if (learned.length > skillPointsAt(level)) return false;
  const nodes = KIT_NODES[race];
  const ids = new Set(nodes.map((n) => n.id));
  if (learned.some((id) => !ids.has(id))) return false;
  const set = new Set(learned);
  for (const id of set) {
    const n = nodes.find((x) => x.id === id)!;
    if (level < n.minLevel) return false;
    if (n.requires.length && !n.requires.some((r) => set.has(r))) return false;
    if (n.excludes && set.has(n.excludes)) return false;
  }
  return true;
}
/**
 * The largest valid subset of `wanted` (kept in the given order, root first): it respects the point
 * budget of the level, each node's minimum level, its prerequisites and its exclusions. Used to
 * heal data that no longer satisfies `validLearned` and to unlock "everything allowed".
 */
export function repairLearned(race: RaceId, level: number, wanted: readonly string[]): string[] {
  const nodes = KIT_NODES[race];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const pending = [...new Set(["R", ...wanted])].filter((id) => byId.has(id));
  const kept: string[] = [];
  const keptSet = new Set<string>();
  const budget = skillPointsAt(level);
  let progress = true;
  while (progress && kept.length < budget) {
    progress = false;
    for (const id of pending) {
      if (kept.length >= budget) break;
      if (keptSet.has(id)) continue;
      const n = byId.get(id)!;
      if (level < n.minLevel) continue;
      if (n.requires.length && !n.requires.some((r) => keptSet.has(r))) continue;
      if (n.excludes && keptSet.has(n.excludes)) continue;
      if (kept.some((k) => byId.get(k)!.excludes === id)) continue;
      kept.push(id);
      keptSet.add(id);
      progress = true;
    }
  }
  // Extra ranks the player had put into nodes that survived, while points remain.
  const asked = new Map<string, number>();
  for (const id of wanted) asked.set(id, (asked.get(id) ?? 0) + 1);
  for (const id of wanted) {
    if (kept.length >= budget) break;
    if (id === "R" || !keptSet.has(id)) continue;
    const have = kept.filter((k) => k === id).length;
    if (have < (asked.get(id) ?? 0)) kept.push(id);
  }
  return kept;
}
/** Every node the tree allows at this level, taken in tree order until the points run out. */
export function unlockAllowed(race: RaceId, level: number): string[] {
  return repairLearned(
    race,
    level,
    KIT_NODES[race].map((n) => n.id),
  );
}
export const START_NODES = ["R"] as const;
