/** Spawn point totals for the admin spawn list (pure, no React). */
import { MONSTER_BASE } from "@/game/monsters/base.generated";

/** One authored spawn point from `<feature>/spawns.json`. */
export type SpawnPoint = {
  id: string;
  kind: string;
  x: number;
  y: number;
  level?: number;
  homeLeash: number;
  respawnMs: number;
  groupId?: string;
};

export type SpawnSummary = {
  kind: string;
  name: string;
  level: number;
  count: number;
  groups: number;
  respawn: [number, number];
  leash: [number, number];
};

export const monsterName = (kind: string) => MONSTER_BASE.find((m) => m.id === kind)?.name ?? kind;
export const monsterLevel = (kind: string) => MONSTER_BASE.find((m) => m.id === kind)?.level ?? 0;

/** Per-monster totals of a spawn list, sorted by monster level then name. */
export function summarizeSpawns(points: SpawnPoint[]): SpawnSummary[] {
  const by = new Map<string, SpawnPoint[]>();
  for (const p of points) by.set(p.kind, [...(by.get(p.kind) ?? []), p]);
  return [...by.entries()]
    .map(([kind, list]) => {
      const respawn = list.map((p) => Math.round(p.respawnMs / 1000));
      const leash = list.map((p) => p.homeLeash);
      return {
        kind,
        name: monsterName(kind),
        level: list[0]?.level ?? monsterLevel(kind),
        count: list.length,
        groups: new Set(list.map((p) => p.groupId ?? p.id)).size,
        respawn: [Math.min(...respawn), Math.max(...respawn)] as [number, number],
        leash: [Math.min(...leash), Math.max(...leash)] as [number, number],
      };
    })
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, "pl"));
}
