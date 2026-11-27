#!/usr/bin/env tsx
/**
 * Exports canonical ANDROID_ITEM_CATALOG (450+ items: 65 base + 366 V2 + 19 Boss + 24 Heritage),
 * all 265 V2 crafting recipes, equipment sets, heritage weapon stages, and +1..+9 enhancement config
 * from src/server/godot/economy.ts to ports/godot-isometric-world/data/items_catalog.json.
 */
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ANDROID_CRAFT_RECIPES,
  ANDROID_EQUIPMENT_SETS,
  ANDROID_ITEM_CATALOG,
  BACKPACK_SIZE,
  BANK_SIZE,
  ENHANCE_MAX_LEVEL,
  ENHANCE_STAT_BONUS_PER_LEVEL,
  HERITAGE_WEAPON_STAGES,
  TRAINING_COOLDOWN_MS,
  enhanceCostForNextTier,
} from "../../src/server/godot/economy";

const iconsDir = resolve("ports/godot-isometric-world/assets/ui/icons");
const missingIcons = new Set<string>();
for (const item of ANDROID_ITEM_CATALOG) {
  if (!existsSync(resolve(iconsDir, item.icon))) {
    missingIcons.add(item.icon);
  }
}
if (missingIcons.size > 0) {
  throw new Error(`Missing UI icons referenced by catalog: ${[...missingIcons].join(", ")}`);
}

const enhanceTiers = Array.from({ length: ENHANCE_MAX_LEVEL }, (_, idx) =>
  enhanceCostForNextTier(idx),
);

const outPath = resolve("ports/godot-isometric-world/data/items_catalog.json");
const payload = {
  version: 3,
  backpack_size: BACKPACK_SIZE,
  bank_size: BANK_SIZE,
  training_cooldown_s: TRAINING_COOLDOWN_MS / 1000,
  enhance_max_level: ENHANCE_MAX_LEVEL,
  enhance_bonus_per_level: ENHANCE_STAT_BONUS_PER_LEVEL,
  enhance_tiers: enhanceTiers,
  items: ANDROID_ITEM_CATALOG,
  recipes: ANDROID_CRAFT_RECIPES,
  equipment_sets: ANDROID_EQUIPMENT_SETS,
  heritage_weapons: HERITAGE_WEAPON_STAGES,
};
writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
console.log(
  `Exported ${ANDROID_ITEM_CATALOG.length} items, ${ANDROID_CRAFT_RECIPES.length} recipes, ` +
    `${Object.keys(ANDROID_EQUIPMENT_SETS).length} sets, ${HERITAGE_WEAPON_STAGES.length} heritage weapons -> ${outPath}`,
);
