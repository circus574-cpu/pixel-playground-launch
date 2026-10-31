import { describe, it, expect } from "vitest";
import {
  ITEM_CATALOG,
  getItemById,
  CRAFTING_RECIPES,
  getRecipeById,
  PASSIVE_BUFF_SET_BONUSES,
  EQUIPMENT_SET_BONUSES,
  V2_GLOBAL_STAT_CAPS,
  getItemsBySetId,
  computePassiveEquipmentBonuses,
} from "../index";

describe("Item Catalog & Recipes Tests", () => {
  it("should have the full 366-item V2 catalog with no duplicate IDs", () => {
    expect(ITEM_CATALOG.length).toBe(366);

    const ids = new Set<string>();
    for (const item of ITEM_CATALOG) {
      expect(item.id).toBeTruthy();
      expect(item.name).toBeTruthy();
      expect(item.description).toBeTruthy();
      expect(item.price).toBeGreaterThanOrEqual(0);
      expect(["common", "uncommon", "rare", "epic", "legendary"]).toContain(item.rarity);
      expect([
        "consumable",
        "material",
        "weapon",
        "armor",
        "helmet",
        "gloves",
        "boots",
        "legs",
        "shield",
        "accessory",
        "amulet",
        "ring",
        "artifact",
        "buff",
        "tool",
        "quest",
      ]).toContain(item.category);

      expect(ids.has(item.id)).toBe(false);
      ids.add(item.id);
    }
  });

  it("should include the core runtime items required for game compatibility", () => {
    expect(getItemById("potion")).toBeDefined();
    expect(getItemById("tusk")).toBeDefined();
    expect(getItemById("sword")).toBeDefined();
    expect(getItemById("vest")).toBeDefined();
    expect(getItemById("shield")).toBeDefined();
  });

  it("should have all 140 V2 crafting recipes with no duplicate recipe IDs", () => {
    expect(CRAFTING_RECIPES.length).toBe(140);

    const ids = new Set<string>();
    for (const recipe of CRAFTING_RECIPES) {
      expect(recipe.id).toBeTruthy();
      expect(recipe.name).toBeTruthy();
      expect(recipe.requiredLevel).toBeGreaterThanOrEqual(1);
      expect(recipe.craftingCostCoins).toBeGreaterThanOrEqual(0);
      expect(["alchemy", "forge", "runic", "cyber_fabricator", "projekt_ksiegi"]).toContain(
        recipe.station,
      );

      expect(ids.has(recipe.id)).toBe(false);
      ids.add(recipe.id);
    }
  });

  it("should ensure every recipe ingredient exists in the item catalog", () => {
    for (const recipe of CRAFTING_RECIPES) {
      if (recipe.source !== "book") {
        expect(recipe.ingredients.length).toBeGreaterThan(0);
      }
      for (const ingredient of recipe.ingredients) {
        const item = getItemById(ingredient.itemId);
        expect(
          item,
          `Ingredient "${ingredient.itemId}" in recipe "${recipe.id}" must exist in ITEM_CATALOG`,
        ).toBeDefined();
        expect(ingredient.count).toBeGreaterThan(0);
      }
    }
  });

  it("should ensure every recipe result item exists in the item catalog and count > 0", () => {
    for (const recipe of CRAFTING_RECIPES) {
      const resultItem = getItemById(recipe.resultItemId);
      expect(
        resultItem,
        `Result item "${recipe.resultItemId}" in recipe "${recipe.id}" must exist in ITEM_CATALOG`,
      ).toBeDefined();
      expect(recipe.resultCount).toBeGreaterThan(0);
    }
  });

  it("should include 5x7 passive buff artifact sets and 10x7 equipment sets with percentage bonuses", () => {
    expect(Object.keys(PASSIVE_BUFF_SET_BONUSES)).toEqual([
      "BUFF-01",
      "BUFF-02",
      "BUFF-03",
      "BUFF-04",
      "BUFF-05",
    ]);
    for (const setId of Object.keys(PASSIVE_BUFF_SET_BONUSES)) {
      const items = getItemsBySetId(setId);
      expect(items).toHaveLength(7);
      for (const item of items) {
        expect(item.buff?.mode).toBe("passive");
        expect(item.buff?.activation).toBe("on_equip");
        expect(item.buff?.duration).toBe("while_equipped");
        expect(item.buff?.cooldownSeconds).toBeNull();
      }
    }
    expect(Object.keys(EQUIPMENT_SET_BONUSES)).toHaveLength(10);
    for (const setId of Object.keys(EQUIPMENT_SET_BONUSES)) {
      expect(getItemsBySetId(setId)).toHaveLength(7);
    }
  });

  it("should compute passive set bonuses, deduplicate identical IDs, and enforce global stat caps", () => {
    const buff05Ids = getItemsBySetId("BUFF-05").map((i) => i.id);
    // Duplicate IDs should not double-count
    const result = computePassiveEquipmentBonuses([...buff05Ids, ...buff05Ids], {
      hp: 1000,
      ki: 200,
      atk: 100,
      def: 50,
    });
    expect(result.setCounts["BUFF-05"]).toBe(7);
    // 7 pieces of BUFF-05 unlock 2pc (+6% hpRegen), 4pc (+4% damageReduction), 7pc (+6% kiCostReduction)
    expect(result.cappedTotals.hpRegenPercent).toBeGreaterThanOrEqual(6);
    expect(result.cappedTotals.damageReductionPercent).toBeGreaterThanOrEqual(4);
    expect(result.cappedTotals.kiCostReductionPercent).toBeGreaterThanOrEqual(6);
    expect(result.scaledStats?.maxHp).toBeGreaterThan(1000);

    // Global cap check
    const allItems = ITEM_CATALOG.map((i) => i.id);
    const maxResult = computePassiveEquipmentBonuses(allItems);
    for (const [key, cap] of Object.entries(V2_GLOBAL_STAT_CAPS)) {
      expect(maxResult.cappedTotals[key as keyof typeof V2_GLOBAL_STAT_CAPS]).toBeLessThanOrEqual(
        cap,
      );
    }
  });

  it("should have working helper lookup functions", () => {
    const potion = getItemById("potion");
    expect(potion?.name).toBe("Mikstura Życia");

    const basicPotionRecipe = getRecipeById("rec-potion-basic");
    expect(basicPotionRecipe?.station).toBe("alchemy");
  });
});
