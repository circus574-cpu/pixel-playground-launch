import { MONSTERS } from "../monsters/catalog";
import type { MonsterDef } from "../monsters/types";
import { ITEM_CATALOG } from "./catalog";
import type { ItemDefinition, ItemRarity } from "./types";

/**
 * Random catalog drops — system ekonomii przedmiotów (właściciel 12.11.2026).
 * Z potworów dropią WYŁĄCZNIE słabe przedmioty (common/uncommon) i to RZADKO (DROP_CHANCE).
 * Lepszy sprzęt (rare/epic/legendary) nie dropi — zdobywa się go craftingiem. Dzięki temu drop jest
 * miłym bonusem, a nie głównym źródłem ekwipunku; progresja idzie przez craft i sklep.
 * Każdy nie-minion potwór ma pulę słabych przedmiotów ze swojego kontynentu w oknie poziomów
 * [poziom przedmiotu - BELOW, + ABOVE]; wybór ważony rzadkością. Deterministyczne przez `random()`.
 */
export const RARITIES: readonly ItemRarity[] = ["legendary", "epic", "rare", "uncommon", "common"];

/** Rzadkość dropu: tylko słabe przedmioty (właściciel 12.11.2026). Lepsze — wyłącznie craft. */
export const DROP_RARITIES: readonly ItemRarity[] = ["common", "uncommon"];

/** Szansa na kill (nie-miniona) na jeden słaby przedmiot z katalogu. Rzadki drop (było 0.08). */
export const DROP_CHANCE = 0.02;

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

/** Dropi tylko słabe przedmioty (common/uncommon), bez kluczy fabularnych. Lepsze — wyłącznie craft. */
export const isLootable = (item: ItemDefinition) =>
  item.category !== "quest" && (DROP_RARITIES as readonly string[]).includes(item.rarity);

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

/**
 * Sklep kupca (system ekonomii 12.11.2026): sprzedaje WYŁĄCZNIE słabe przedmioty (common/uncommon,
 * bez materiałów i kluczy fabularnych) po WYGÓROWANEJ cenie, żeby trzeba było pograć, zanim się kupi.
 * Lepszy sprzęt — wyłącznie crafting. Cena = SHOP_MARKUP × cena katalogowa, min. poziom×60 monet.
 */
export const SHOP_MARKUP = 4;
export const isShopItem = (item: ItemDefinition) =>
  (DROP_RARITIES as readonly string[]).includes(item.rarity) &&
  item.category !== "quest" &&
  item.category !== "material";
export function shopPrice(item: ItemDefinition): number {
  const level = lootLevel(item);
  const base = item.price || level * 20;
  return Math.max(Math.ceil(base * SHOP_MARKUP), level * 60);
}
