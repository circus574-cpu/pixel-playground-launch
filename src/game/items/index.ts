export * from "./types";
export * from "./catalog";
export * from "./recipes";

import {
  EQUIPMENT_SET_BONUSES,
  ITEM_CATALOG,
  PASSIVE_BUFF_SET_BONUSES,
  V2_GLOBAL_STAT_CAPS,
} from "./catalog";
import { CRAFTING_RECIPES } from "./recipes";
import {
  ItemCategory,
  ItemDefinition,
  CraftingRecipe,
  CraftingStation,
  PassiveBuffEffectKey,
} from "./types";
import { ContinentId } from "../worlds/types";

export const ITEM_BY_ID: Record<string, ItemDefinition> = Object.fromEntries(
  ITEM_CATALOG.map((item) => [item.id, item]),
);

export function getItemById(id: string): ItemDefinition | undefined {
  return ITEM_BY_ID[id];
}

export function getItemsByCategory(category: ItemCategory): ItemDefinition[] {
  return ITEM_CATALOG.filter((item) => item.category === category);
}

export function getItemsByContinent(continent: ContinentId | "all" | "neutral"): ItemDefinition[] {
  return ITEM_CATALOG.filter(
    (item) => item.sourceContinent === continent || item.sourceContinent === "all",
  );
}

export function getItemsBySetId(setId: string): ItemDefinition[] {
  return ITEM_CATALOG.filter((item) => item.setId === setId);
}

export const RECIPE_BY_ID: Record<string, CraftingRecipe> = Object.fromEntries(
  CRAFTING_RECIPES.map((recipe) => [recipe.id, recipe]),
);

export function getRecipeById(id: string): CraftingRecipe | undefined {
  return RECIPE_BY_ID[id];
}

export function getRecipesByStation(station: CraftingStation): CraftingRecipe[] {
  return CRAFTING_RECIPES.filter((recipe) => recipe.station === station);
}

export function getRecipesByCrafter(crafterNpcId: string): CraftingRecipe[] {
  return CRAFTING_RECIPES.filter((recipe) => recipe.crafterNpcId === crafterNpcId);
}

export interface ComputedPassiveBonuses {
  rawTotals: Record<PassiveBuffEffectKey, number>;
  cappedTotals: Record<PassiveBuffEffectKey, number>;
  setCounts: Record<string, number>;
  scaledStats?: {
    maxHp: number;
    maxKi: number;
    atk: number;
    def: number;
  };
}

const EFFECT_KEYS: PassiveBuffEffectKey[] = [
  "maxHpPercent",
  "maxKiPercent",
  "atkPercent",
  "defPercent",
  "kiRegenPercent",
  "moveSpeedPercent",
  "kiCostReductionPercent",
  "damageReductionPercent",
  "hpRegenPercent",
  "critChancePoints",
];

/**
 * Oblicza łączne pasywne bonusy procentowe i zestawowe (V2) dla unikalnych założonych przedmiotów,
 * z zachowaniem globalnych limitów (caps) z `ZASADY_BALANSU_PASYWNE_ARTEFAKTY_V2.md`.
 */
export function computePassiveEquipmentBonuses(
  equippedItemIds: readonly string[],
  baseStats?: { hp: number; ki: number; atk: number; def: number },
): ComputedPassiveBonuses {
  const rawTotals: Record<PassiveBuffEffectKey, number> = {
    maxHpPercent: 0,
    maxKiPercent: 0,
    atkPercent: 0,
    defPercent: 0,
    kiRegenPercent: 0,
    moveSpeedPercent: 0,
    kiCostReductionPercent: 0,
    damageReductionPercent: 0,
    hpRegenPercent: 0,
    critChancePoints: 0,
  };
  const setCounts: Record<string, number> = {};
  const uniqueIds = new Set(equippedItemIds);

  for (const id of uniqueIds) {
    const item = ITEM_BY_ID[id];
    if (!item) continue;
    if (item.stats) {
      for (const key of EFFECT_KEYS) {
        const val = item.stats[key];
        if (typeof val === "number") rawTotals[key] += val;
      }
    }
    if (item.buff && item.buff.mode === "passive") {
      rawTotals[item.buff.effect] += item.buff.value;
    }
    if (item.setId) {
      setCounts[item.setId] = (setCounts[item.setId] ?? 0) + 1;
    }
  }

  for (const [setId, count] of Object.entries(setCounts)) {
    const rules = PASSIVE_BUFF_SET_BONUSES[setId] ?? EQUIPMENT_SET_BONUSES[setId];
    if (!rules) continue;
    for (const rule of rules) {
      if (count >= rule.requiredPieces) {
        rawTotals[rule.effect] += rule.value;
      }
    }
  }

  const cappedTotals = {} as Record<PassiveBuffEffectKey, number>;
  for (const key of EFFECT_KEYS) {
    cappedTotals[key] = Math.min(rawTotals[key], V2_GLOBAL_STAT_CAPS[key]);
  }

  const scaledStats = baseStats
    ? {
        maxHp: Math.floor(baseStats.hp * (1 + cappedTotals.maxHpPercent / 100)),
        maxKi: Math.floor(baseStats.ki * (1 + cappedTotals.maxKiPercent / 100)),
        atk: Math.round(baseStats.atk * (1 + cappedTotals.atkPercent / 100)),
        def: Math.round(baseStats.def * (1 + cappedTotals.defPercent / 100)),
      }
    : undefined;

  return {
    rawTotals,
    cappedTotals,
    setCounts,
    ...(scaledStats ? { scaledStats } : {}),
  };
}
