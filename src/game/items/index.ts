export * from "./types";
export * from "./catalog";
export * from "./recipes";

import { ITEM_CATALOG } from "./catalog";
import { CRAFTING_RECIPES } from "./recipes";
import { ItemCategory, ItemDefinition, CraftingRecipe, CraftingStation } from "./types";
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

export function getItemsByContinent(continent: ContinentId | "all"): ItemDefinition[] {
  return ITEM_CATALOG.filter(
    (item) => item.sourceContinent === continent || item.sourceContinent === "all",
  );
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
