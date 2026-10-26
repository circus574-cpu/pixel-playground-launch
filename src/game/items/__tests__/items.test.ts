import { describe, it, expect } from "vitest";
import { ITEM_CATALOG, ITEM_BY_ID, getItemById } from "../index";
import { CRAFTING_RECIPES, RECIPE_BY_ID, getRecipeById } from "../index";

describe("Item Catalog & Recipes Tests", () => {
  it("should have a rich catalog of items with no duplicate IDs", () => {
    expect(ITEM_CATALOG.length).toBeGreaterThanOrEqual(80);

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
        "boots",
        "accessory",
        "artifact",
      ]).toContain(item.category);

      expect(ids.has(item.id)).toBe(false);
      ids.add(item.id);
    }
  });

  it("should include the core runtime items required for game compatibility", () => {
    expect(getItemById("potion")).toBeDefined();
    expect(getItemById("tusk")).toBeDefined();
    expect(getItemById("sword")).toBeDefined();
    expect(getItemById("shield")).toBeDefined();
  });

  it("should have no duplicate recipe IDs", () => {
    expect(CRAFTING_RECIPES.length).toBeGreaterThanOrEqual(25);

    const ids = new Set<string>();
    for (const recipe of CRAFTING_RECIPES) {
      expect(recipe.id).toBeTruthy();
      expect(recipe.name).toBeTruthy();
      expect(recipe.requiredLevel).toBeGreaterThanOrEqual(1);
      expect(recipe.craftingCostCoins).toBeGreaterThanOrEqual(0);
      expect(["alchemy", "forge", "runic", "cyber_fabricator"]).toContain(recipe.station);

      expect(ids.has(recipe.id)).toBe(false);
      ids.add(recipe.id);
    }
  });

  it("should ensure every recipe ingredient exists in the item catalog", () => {
    for (const recipe of CRAFTING_RECIPES) {
      expect(recipe.ingredients.length).toBeGreaterThan(0);
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

  it("should have working helper lookup functions", () => {
    const potion = getItemById("potion");
    expect(potion?.name).toBe("Mikstura Życia");

    const basicPotionRecipe = getRecipeById("rec-potion-basic");
    expect(basicPotionRecipe?.station).toBe("alchemy");
  });
});
