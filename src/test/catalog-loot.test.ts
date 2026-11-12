import { describe, expect, it } from "vitest";
import { ITEM_CATALOG, getItemById } from "../game/items";
import {
  DROP_CHANCE,
  LOOT_MONSTERS,
  LOOT_POOLS,
  RARITY_WEIGHT,
  isLootable,
  itemDropChances,
  lootLevel,
  rollCatalogDrop,
} from "../game/items/loot";
import { GameSession, ensurePlayerEquipment, BAG_CELLS } from "../game/session";
import { itemSources } from "../game/admin/contentCatalog";

const sequence = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length]!;
};

describe("catalog loot tables (system ekonomii 12.11.2026: drop tylko słabe, rzadki)", () => {
  it("every weak item (common/uncommon, non-quest) has at least one random drop source", () => {
    const missing = ITEM_CATALOG.filter((i) => isLootable(i) && !itemDropChances(i.id).length);
    expect(missing.map((i) => i.id)).toEqual([]);
  });

  it("only weak items are lootable; better gear (rare/epic/legendary) is crafting-only", () => {
    for (const item of ITEM_CATALOG.filter(isLootable))
      expect(["common", "uncommon"]).toContain(item.rarity);
    for (const item of ITEM_CATALOG.filter((i) => ["rare", "epic", "legendary"].includes(i.rarity)))
      expect(itemDropChances(item.id)).toEqual([]);
  });

  it("story keys (quest items) never drop", () => {
    for (const item of ITEM_CATALOG.filter((i) => i.category === "quest"))
      expect(itemDropChances(item.id)).toEqual([]);
  });

  it("pools respect continent + level window and contain only weak items", () => {
    for (const monster of LOOT_MONSTERS) {
      const pool = LOOT_POOLS[monster.id]!;
      // Wysokopoziomowe potwory mogą mieć pustą pulę (słabe przedmioty są niskopoziomowe).
      pool.ids.forEach((id, i) => {
        const item = getItemById(id)!;
        expect(["common", "uncommon"]).toContain(item.rarity);
        expect(pool.weights[i]).toBe(RARITY_WEIGHT[item.rarity]);
        const c = item.sourceContinent;
        if (c && c !== "all" && c !== "neutral") expect(monster.world).toBe(c);
        expect(monster.level).toBeGreaterThanOrEqual(lootLevel(item) - 3);
        expect(monster.level).toBeLessThanOrEqual(lootLevel(item) + 5);
      });
    }
    // Co najmniej jeden potwór ma niepustą pulę słabych przedmiotów.
    expect(LOOT_MONSTERS.some((m) => LOOT_POOLS[m.id]!.ids.length > 0)).toBe(true);
  });

  it("minions do not roll catalog drops", () => {
    expect(LOOT_MONSTERS.some((m) => m.minion)).toBe(false);
  });

  it("a roll under the drop chance picks by weight; above it nothing drops", () => {
    const id = LOOT_MONSTERS[0]!.id;
    const pool = LOOT_POOLS[id]!;
    expect(rollCatalogDrop(id, sequence([0, 0]))).toBe(pool.ids[0]);
    expect(rollCatalogDrop(id, sequence([0, 0.999999]))).toBe(pool.ids.at(-1));
    expect(rollCatalogDrop(id, sequence([DROP_CHANCE]))).toBeNull();
    expect(rollCatalogDrop("unknown-monster", sequence([0, 0]))).toBeNull();
  });

  it("per-item chances of each monster with a pool sum to the drop chance", () => {
    const sums = new Map<string, number>();
    for (const item of ITEM_CATALOG)
      for (const { monster, chance } of itemDropChances(item.id))
        sums.set(monster.id, (sums.get(monster.id) ?? 0) + chance);
    const withPool = LOOT_MONSTERS.filter((m) => LOOT_POOLS[m.id]!.ids.length > 0);
    expect(sums.size).toBe(withPool.length);
    for (const sum of sums.values()) expect(sum).toBeCloseTo(DROP_CHANCE, 10);
  });

  it("observed drops follow the drop chance and the rarity weights", () => {
    let seed = 12345;
    const rng = () => {
      // mulberry32: consecutive outputs are independent enough for a rate check
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const id = LOOT_MONSTERS[0]!.id;
    const counts = new Map<string, number>();
    const n = 400_000;
    let drops = 0;
    for (let i = 0; i < n; i++) {
      const item = rollCatalogDrop(id, rng);
      if (!item) continue;
      drops++;
      counts.set(item, (counts.get(item) ?? 0) + 1);
    }
    expect(drops / n).toBeGreaterThan(DROP_CHANCE * 0.95);
    expect(drops / n).toBeLessThan(DROP_CHANCE * 1.05);
    for (const { monster, chance } of itemDropChances(LOOT_POOLS[id]!.ids[0]!))
      if (monster.id === id) {
        const seen = (counts.get(LOOT_POOLS[id]!.ids[0]!) ?? 0) / n;
        expect(Math.abs(seen - chance)).toBeLessThan(chance * 0.25);
      }
  });

  it("the admin catalogue lists the random drop sources with exact chances", () => {
    const item = ITEM_CATALOG.find((i) => isLootable(i))!;
    expect(itemSources(item.id).some((s) => s.startsWith("Losowy drop: "))).toBe(true);
  });
});

describe("catalog loot in the session", () => {
  const ground = (g: GameSession, item: string) => {
    g.loot.push({ id: "drop", x: g.player.x, y: g.player.y, item, quantity: 1, gold: 0 });
    g.command({ type: "loot", id: "drop" });
  };

  it("picking up a catalog item puts it in the bag", () => {
    const g = new GameSession();
    ensurePlayerEquipment(g.player);
    const id = ITEM_CATALOG.find((i) => i.category === "weapon")!.id;
    ground(g, id);
    expect(g.player.bagItems[id]).toBe(1);
    expect(g.loot.some((l) => l.id === "drop")).toBe(false);
  });

  it("a full bag keeps the drop on the ground", () => {
    const g = new GameSession();
    ensurePlayerEquipment(g.player);
    const items = ITEM_CATALOG.filter((i) => i.category === "material");
    for (let i = 0; g.player.bagItems && Object.keys(g.player.bagItems).length < BAG_CELLS; i++)
      g.player.bagItems[items[i]!.id] = 1;
    const extra = ITEM_CATALOG.find((i) => i.category === "weapon")!.id;
    ground(g, extra);
    expect(g.player.bagItems[extra]).toBeUndefined();
    expect(g.loot.some((l) => l.id === "drop")).toBe(true);
  });

  it("quest rewards grant catalog items instead of silently dropping them", () => {
    const g = new GameSession();
    ensurePlayerEquipment(g.player);
    const id = ITEM_CATALOG.find((i) => i.category === "consumable" && i.id !== "potion")!.id;
    g.grantQuestReward({ xp: 0, gold: 0, items: { [id]: 2 } as never }, "test");
    expect(g.player.bagItems[id]).toBe(2);
  });
});
