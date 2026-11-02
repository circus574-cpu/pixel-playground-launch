import { MONSTERS } from "../monsters/catalog";
import type { MonsterDef } from "../monsters/types";
import { ITEM_CATALOG } from "./catalog";
import type { ItemDefinition, ItemRarity } from "./types";

/**
 * Random catalog drops. Every catalog item except story keys (category "quest") can drop from at
 * least one monster on its continent ("all"/"neutral" items: every continent) whose level is near
 * the item's level. Each kill drops one catalog item with chance DROP_CHANCE; the item is picked
 * from the monster's pool weighted by rarity, so a legendary is rarer than a common of the same
 * pool. Deterministic through `random()`.
 */
export const RARITIES: readonly ItemRarity[] = ["legendary", "epic", "rare", "uncommon", "common"];

/** Chance per kill (of a non-minion monster) to drop one catalog item. */
export const DROP_CHANCE = 0.08;

/** Relative pick weight of an item of this rarity inside one monster's pool. */
export const RARITY_WEIGHT: Record<ItemRarity, number> = {
  common: 50,
  uncommon: 25,
  rare: 10,
  epic: 4,
  legendary: 1.5,
};

/** Level used for items without an explicit level. */
const RARITY_LEVEL: Record<ItemRarity, number> = {
  common: 1,
  uncommon: 5,
  rare: 9,
  epic: 13,
  legendary: 17,
};

/** Monster level window around the item level: [level - BELOW, level + ABOVE]. */
const BELOW = 3;
const ABOVE = 5;

const WORLDS = ["verdant", "aether", "nexus", "pyra"] as const;
const MAX_MONSTER_LEVEL = Math.max(...MONSTERS.map((m) => m.level));

export const isLootable = (item: ItemDefinition) => item.category !== "quest";

/** Level the drop pools use for an item (clamped to the highest monster level). */
export function lootLevel(item: ItemDefinition): number {
  return Math.min(item.level ?? RARITY_LEVEL[item.rarity], MAX_MONSTER_LEVEL);
}

function lootWorlds(item: ItemDefinition): readonly string[] {
  const c = item.sourceContinent;
  return c && (WORLDS as readonly string[]).includes(c) ? [c] : WORLDS;
}

const eligible = (monster: MonsterDef, item: ItemDefinition) => {
  const level = lootLevel(item);
  return (
    lootWorlds(item).includes(monster.world) &&
    monster.level >= level - BELOW &&
    monster.level <= level + ABOVE
  );
};

/** Monsters that roll catalog drops: minions spawned by another monster do not. */
export const LOOT_MONSTERS = MONSTERS.filter((m) => !m.minion);

export type LootPool = { ids: string[]; weights: number[]; total: number };

/** monster id → weighted item pool, sorted by id for a stable pick order. */
export const LOOT_POOLS: Record<string, LootPool> = Object.fromEntries(
  LOOT_MONSTERS.map((monster) => {
    const items = ITEM_CATALOG.filter((item) => isLootable(item) && eligible(monster, item)).sort(
      (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
    const weights = items.map((item) => RARITY_WEIGHT[item.rarity]);
    return [
      monster.id,
      { ids: items.map((i) => i.id), weights, total: weights.reduce((a, b) => a + b, 0) },
    ];
  }),
);

/** At most one catalog item for a kill of `monsterId`. */
export function rollCatalogDrop(monsterId: string, random: () => number): string | null {
  const pool = LOOT_POOLS[monsterId];
  if (!pool || !pool.ids.length || random() >= DROP_CHANCE) return null;
  let pick = random() * pool.total;
  for (let i = 0; i < pool.ids.length; i++) {
    pick -= pool.weights[i]!;
    if (pick < 0) return pool.ids[i]!;
  }
  return pool.ids.at(-1)!;
}

/** Exact drop chance of one item per kill, for every monster that can drop it. */
export function itemDropChances(itemId: string): { monster: MonsterDef; chance: number }[] {
  const out: { monster: MonsterDef; chance: number }[] = [];
  for (const monster of LOOT_MONSTERS) {
    const pool = LOOT_POOLS[monster.id]!;
    const at = pool.ids.indexOf(itemId);
    if (at >= 0) out.push({ monster, chance: (DROP_CHANCE * pool.weights[at]!) / pool.total });
  }
  return out;
}
