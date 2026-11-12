import { describe, expect, it } from "vitest";
import { ITEM_CATALOG, getItemById, getRecipeById } from "../game/items";
import { isShopItem, shopPrice, SHOP_MARKUP, DROP_CHANCE } from "../game/items/loot";
import { CRAFTING_RECIPES } from "../game/items/recipes";
import { GameSession, ensurePlayerEquipment } from "../game/session";

describe("sklep kupca (system ekonomii 12.11.2026)", () => {
  it("sprzedaje tylko słabe przedmioty (common/uncommon), bez materiałów i questów", () => {
    for (const item of ITEM_CATALOG.filter(isShopItem)) {
      expect(["common", "uncommon"]).toContain(item.rarity);
      expect(item.category).not.toBe("material");
      expect(item.category).not.toBe("quest");
    }
    // żaden lepszy przedmiot nie jest w sklepie
    for (const item of ITEM_CATALOG.filter((i) => ["rare", "epic", "legendary"].includes(i.rarity)))
      expect(isShopItem(item)).toBe(false);
  });

  it("cena jest wygórowana: SHOP_MARKUP × cena katalogowa, min. poziom×60", () => {
    for (const item of ITEM_CATALOG.filter(isShopItem).slice(0, 40)) {
      const price = shopPrice(item);
      if (item.price) expect(price).toBeGreaterThanOrEqual(item.price * SHOP_MARKUP);
      expect(price).toBeGreaterThanOrEqual(60); // min. poziom 1 × 60
    }
  });

  it("drop jest rzadki (2%), nie 8%", () => {
    expect(DROP_CHANCE).toBe(0.02);
  });
});

describe("crafting (system ekonomii 12.11.2026)", () => {
  it("receptury pokrywają wszystkie lepsze przedmioty (rare+), bo nie dropią", () => {
    const results = new Set(CRAFTING_RECIPES.map((r) => r.resultItemId));
    const better = ITEM_CATALOG.filter(
      (i) => i.category !== "quest" && ["rare", "epic", "legendary"].includes(i.rarity),
    );
    const missing = better.filter((i) => !results.has(i.id));
    expect(missing.map((i) => i.id)).toEqual([]);
  });

  it("craft zużywa materiały i złoto oraz wydaje wynik", () => {
    const g = new GameSession();
    ensurePlayerEquipment(g.player);
    g.player.level = 1;
    g.player.gold = 100;
    g.player.items.potion = 0;
    g.player.materials["zielone-ziele"] = 2;
    g.player.materials["mchowa-galaretka"] = 1;
    g.command({ type: "craft", recipe: "rec-potion-basic" });
    expect(g.player.items.potion).toBe(2); // resultCount 2
    expect(g.player.gold).toBe(95); // koszt 5
    expect(g.player.materials["zielone-ziele"]).toBeUndefined();
    expect(g.player.materials["mchowa-galaretka"]).toBeUndefined();
  });

  it("craft odrzuca brak składników (nie zużywa niczego)", () => {
    const g = new GameSession();
    ensurePlayerEquipment(g.player);
    g.player.level = 1;
    g.player.gold = 100;
    g.player.items.potion = 0;
    g.player.materials["zielone-ziele"] = 1; // za mało (potrzeba 2)
    g.command({ type: "craft", recipe: "rec-potion-basic" });
    expect(g.player.items.potion).toBe(0);
    expect(g.player.gold).toBe(100);
    expect(g.player.materials["zielone-ziele"]).toBe(1);
  });

  it("craft odrzuca zbyt niski poziom", () => {
    const g = new GameSession();
    ensurePlayerEquipment(g.player);
    const recipe = CRAFTING_RECIPES.find((r) => r.requiredLevel >= 10)!;
    g.player.level = 1;
    g.player.gold = 10000;
    for (const ing of recipe.ingredients) g.player.materials[ing.itemId] = 99;
    g.command({ type: "craft", recipe: recipe.id });
    expect(g.player.bagItems?.[recipe.resultItemId]).toBeUndefined();
    expect(g.player.gold).toBe(10000);
  });

  it("craft odrzuca brak złota", () => {
    const g = new GameSession();
    ensurePlayerEquipment(g.player);
    g.player.level = 1;
    g.player.gold = 0;
    g.player.items.potion = 0;
    g.player.materials["zielone-ziele"] = 2;
    g.player.materials["mchowa-galaretka"] = 1;
    g.command({ type: "craft", recipe: "rec-potion-basic" });
    expect(g.player.items.potion).toBe(0);
    expect(g.player.materials["zielone-ziele"]).toBe(2);
  });

  it("craft nieznanej receptury jest odrzucany", () => {
    const g = new GameSession();
    g.player.gold = 100;
    g.command({ type: "craft", recipe: "nie-istnieje" });
    expect(g.player.gold).toBe(100);
  });

  it("wygenerowane receptury mają poprawne składniki (materiały) i wynik w katalogu", () => {
    const gen = CRAFTING_RECIPES.filter((r) => r.id.startsWith("rec-gen-"));
    expect(gen.length).toBeGreaterThan(0);
    for (const r of gen) {
      expect(getItemById(r.resultItemId)).toBeDefined();
      expect(getRecipeById(r.id)).toBeDefined();
      expect(r.ingredients.length).toBeGreaterThan(0);
      expect(r.craftingCostCoins).toBeGreaterThan(0);
    }
  });
});
