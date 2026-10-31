import { ContinentId } from "../worlds/types";

export type ItemRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export type ItemCategory =
  | "consumable"
  | "material"
  | "weapon"
  | "armor"
  | "helmet"
  | "gloves"
  | "boots"
  | "legs"
  | "shield"
  | "accessory"
  | "amulet"
  | "ring"
  | "artifact"
  | "buff"
  | "tool"
  | "quest";

export type PassiveBuffEffectKey =
  | "maxHpPercent"
  | "maxKiPercent"
  | "atkPercent"
  | "defPercent"
  | "kiRegenPercent"
  | "moveSpeedPercent"
  | "kiCostReductionPercent"
  | "damageReductionPercent"
  | "hpRegenPercent"
  | "critChancePoints";

export type PassiveBuffUnit = "percent" | "points" | "percentage_points";

export interface PassiveArtifactBuff {
  mode: "passive";
  activation: "on_equip";
  duration: "while_equipped";
  cooldownSeconds: null;
  trigger: null;
  effect: PassiveBuffEffectKey;
  value: number;
  unit: PassiveBuffUnit;
  stackGroup: PassiveBuffEffectKey;
  requiresEquipped: true;
}

export interface SetBonusRule {
  requiredPieces: number;
  effect: PassiveBuffEffectKey;
  value: number;
  unit: PassiveBuffUnit;
  mode: "passive";
}

export interface ItemStats {
  hpBonus?: number;
  kiBonus?: number;
  atkBonus?: number;
  defBonus?: number;
  speedMultiplier?: number;
  kiRegenBonus?: number;
  critChancePercent?: number;
  atkPercent?: number;
  defPercent?: number;
  maxHpPercent?: number;
  maxKiPercent?: number;
  moveSpeedPercent?: number;
  kiRegenPercent?: number;
  hpRegenPercent?: number;
  damageReductionPercent?: number;
  kiCostReductionPercent?: number;
  critChancePoints?: number;
}

export type ItemSourceKind = "repo" | "image_equipment" | "image_buff" | "book" | "book_material";

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
  sourceContinent?: ContinentId | "all" | "neutral";
  level?: number | null;
  slot?: string | null;
  setId?: string;
  buff?: PassiveArtifactBuff | null;
  image?: string | null;
  imagePosition?: number;
  source?: ItemSourceKind;
}

export interface CraftingIngredient {
  itemId: string;
  count: number;
}

export type CraftingStation = "alchemy" | "forge" | "runic" | "cyber_fabricator" | "projekt_ksiegi";

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
  source?: "repo" | "book";
}
