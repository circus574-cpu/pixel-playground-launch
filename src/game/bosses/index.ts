export * from "./types";
export * from "./catalog";

import { BOSS_CATALOG } from "./catalog";
import { BossDefinition } from "./types";
import { ContinentId } from "../worlds/types";

export const BOSS_BY_ID: Record<string, BossDefinition> = Object.fromEntries(
  BOSS_CATALOG.map((boss) => [boss.id, boss]),
);

export function getBossById(id: string): BossDefinition | undefined {
  return BOSS_BY_ID[id];
}

export function getBossesByContinent(continent: ContinentId): BossDefinition[] {
  return BOSS_CATALOG.filter((boss) => boss.continent === continent);
}

export function getBossesByLevel(minLevel: number, maxLevel: number): BossDefinition[] {
  return BOSS_CATALOG.filter((boss) => boss.level >= minLevel && boss.level <= maxLevel);
}
