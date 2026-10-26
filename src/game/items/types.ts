import { ContinentId } from "../worlds/types";

export type ItemRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export type ItemCategory =
  "consumable" | "material" | "weapon" | "armor" | "helmet" | "boots" | "accessory" | "artifact";

export interface ItemStats {
  hpBonus?: number;
  kiBonus?: number;
  atkBonus?: number;
  defBonus?: number;
  speedMultiplier?: number;
  kiRegenBonus?: number;
  critChancePercent?: number;
}

export interface ItemDefinition {
  id: string;
  name: string;
  category: ItemCategory;
  rarity: ItemRarity;
  description: string;
  price: number;
  stackable: boolean;
  maxStack?: number;
  stats?: ItemStats;
  effectDescription?: string;
  sourceContinent?: ContinentId | "all";
}

export interface CraftingIngredient {
  itemId: string;
  count: number;
}

export type CraftingStation = "alchemy" | "forge" | "runic" | "cyber_fabricator";

export interface CraftingRecipe {
  id: string;
  name: string;
  station: CraftingStation;
  requiredLevel: number;
  craftingCostCoins: number;
  crafterNpcId?: string;
  ingredients: CraftingIngredient[];
  resultItemId: string;
  resultCount: number;
}
