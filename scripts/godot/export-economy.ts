/**
 * Items, shop rules and crafting recipes of the browser game -> JSON for the native port (no player or world state).
 * Run: npx tsx scripts/godot/export-economy.ts
 */
import { writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { ITEM_CATALOG } from "../../src/game/items/catalog";
import { CRAFTING_RECIPES } from "../../src/game/items/recipes";
import { isShopItem, shopPrice, lootLevel } from "../../src/game/items/loot";

/** Same mapping as `getSlotForItem` in src/game/session.ts, without importing the whole session. */
function equipSlot(id: string, slot: string, category: string): string | null {
  if (id === "sword" || id === "heritage") return "weapon";
  if (id === "vest") return "armor";
  if (id === "shield") return "offhand";
  const key = slot || category;
  switch (key) {
    case "helmet":
      return "head";
    case "weapon":
      return "weapon";
    case "armor":
      return "armor";
    case "shield":
      return "offhand";
    case "gloves":
      return "hands";
    case "ring":
      return "ring";
    case "amulet":
    case "artifact":
    case "accessory":
    case "buff":
      return "amulet";
    case "boots":
      return "feet";
    default:
      return key.startsWith("artifact_") ? "amulet" : null;
  }
}

const items = ITEM_CATALOG.map((i) => ({
  id: i.id,
  name: i.name,
  category: i.category,
  rarity: i.rarity,
  price: i.price ?? 0,
  level: lootLevel(i),
  stats: i.stats ?? {},
  description: i.description ?? "",
  slot: equipSlot(i.id, i.slot ?? "", i.category),
  shopPrice: isShopItem(i) ? shopPrice(i) : 0,
  setId: i.setId ?? null,
  buff: i.buff ?? null,
}));
const recipes = CRAFTING_RECIPES.map((r) => ({
  id: r.id,
  name: r.name,
  station: r.station,
  requiredLevel: r.requiredLevel,
  cost: r.craftingCostCoins,
  ingredients: r.ingredients,
  result: r.resultItemId,
  count: r.resultCount,
}));
const out = new URL("../../ports/godot-pyra/data/economy.json", import.meta.url);
writeFileSync(
  out,
  JSON.stringify({
    items,
    recipes,
    shopMarkup: 4,
    potion: { heal: 0.4, cooldown: 6 },
    startGold: 20,
  }),
);
// icons
const dir = new URL("../../ports/godot-pyra/assets/icons/items/", import.meta.url);
mkdirSync(dir, { recursive: true });
let copied = 0;
for (const i of items) {
  const from = new URL(`../../public/game/items/${i.id}.webp`, import.meta.url);
  if (existsSync(from)) {
    copyFileSync(from, new URL(`${i.id}.webp`, dir));
    copied++;
  }
}
console.log(
  JSON.stringify({
    items: items.length,
    recipes: recipes.length,
    shop: items.filter((i) => i.shopPrice).length,
    icons: copied,
  }),
);
