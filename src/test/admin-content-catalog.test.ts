import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { catalog, monsterVisual } from "../game/assets/catalog";
import { itemBonuses, itemSources, monsterDrops, percent } from "../game/admin/contentCatalog";
import { MONSTERS } from "../game/monsters/catalog";
describe("Admin content catalogue uses actual loot definitions", () => {
  it("binds all forty monster previews to existing textures and idle atlas frames", () => {
    for (const m of MONSTERS) {
      const actor = monsterVisual(m.id),
        clip = actor.clips.idle!;
      const asset = catalog.assets.get(clip.asset)!;
      expect(existsSync("public" + asset.url), m.id).toBe(true);
      if (asset.atlasUrl) {
        const data = JSON.parse(readFileSync("public" + asset.atlasUrl, "utf8"));
        const frame = clip.directions.down?.[0] ?? Object.values(clip.directions)[0]?.[0];
        expect(data.frames[String(frame)], m.id).toBeDefined();
      }
    }
  });
  it("shows the real independent probabilities for every monster", () => {
    for (const m of MONSTERS)
      expect(monsterDrops(m.id).map((d) => d.chance)).toEqual(m.loot.map((d) => d.chance));
  });
  it("joins exact drop IDs and does not invent equipment sources", () => {
    expect(itemSources("tusk").some((s) => s.includes("100%"))).toBe(true);
    expect(
      itemSources("mchowa-galaretka").some((s) => s.includes("70%") && s.includes("Verdantia")),
    ).toBe(true);
    expect(itemSources("not-an-item")).toEqual([]);
    expect(itemSources("sword").some((s) => s.includes("Kupiec"))).toBe(true);
  });
  it("keeps override drop ordering and handles extra entries like the runtime", () => {
    expect(monsterDrops(MONSTERS[0]!.id, ["One", "Two", "Three"]).map((d) => d.chance)).toEqual([
      0.7, 0.35, 0.35,
    ]);
  });
  it("includes all supplied stats with their units", () => {
    expect(itemBonuses({ atkBonus: 8, critChancePoints: 2, kiCostReductionPercent: 5 })).toEqual([
      "Atak: 8",
      "Szansa krytyczna (p.p.): 2",
      "Redukcja kosztu KI (%): 5",
    ]);
    expect(percent(0.0035)).toBe("0,35%");
  });

  it("applies admin custom loot chances to runtime monsters and bosses", async () => {
    const { applyAdminWorldOverridesToRuntime, readAdminWorldOverrides } =
      await import("../game/world/adminWorldStore");
    const { MONSTERS } = await import("../game/monsters/catalog");
    const { BOSS_CATALOG } = await import("../game/bosses/catalog");

    const ov = readAdminWorldOverrides();
    const testMonsterId = MONSTERS[0]!.id;
    const firstDropName = MONSTERS[0]!.loot[0]!.name;

    ov.monsters[testMonsterId] = {
      lootChances: { [firstDropName]: 0.95 },
    };

    const testBossId = BOSS_CATALOG[0]!.id;
    const firstBossDropId = BOSS_CATALOG[0]!.lootTable[0]!.itemId;

    ov.bosses[testBossId] = {
      lootChances: { [firstBossDropId]: 85 },
    };

    applyAdminWorldOverridesToRuntime(ov);

    expect(MONSTERS[0]!.loot[0]!.chance).toBe(0.95);
    expect(
      BOSS_CATALOG[0]!.lootTable.find((d) => d.itemId === firstBossDropId)?.chancePercent,
    ).toBe(85);

    // Reset back
    delete ov.monsters[testMonsterId];
    delete ov.bosses[testBossId];
    applyAdminWorldOverridesToRuntime(ov);
  });
});
