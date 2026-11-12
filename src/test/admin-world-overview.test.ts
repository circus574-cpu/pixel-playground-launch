import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import { loadOverview, OVERVIEW_INDEX, jsonFile } from "../components/admin/world-overview/loader";
import {
  buildLandEntries,
  questEntries,
  overviewCatalog,
  visibleChunks,
  matches,
  type LandData,
} from "../components/admin/world-overview/model";
import {
  emptyAdminWorldOverrides,
  applyAdminWorldOverridesToRuntime,
} from "../game/world/adminWorldStore";
import { browserNavigation } from "../game/world/generated/browserTerrain";
import { buildSuperiorSimulationWorld } from "../game/world/generated/simulationWorld";
import { v2Places } from "../game/worlds/v2Places";
import { cityRoom } from "../game/city/room";
import { ALL_NPC_DIALOGUES } from "../game/dialogue";
import { ALL_CITIES_V2 } from "../game/worlds";
import { ITEM_CATALOG } from "../game/items/catalog";
import { CRAFTING_RECIPES } from "../game/items/recipes";
import { MONSTERS } from "../game/monsters/catalog";
import { ALL_QUESTS_V2 } from "../game/quests/engine";
import { WORLDS } from "../game/world/worlds";
let lands: LandData[] = [];
const data = (id: string, file: string) =>
  JSON.parse(readFileSync(`public/game/worlds/superior-v2/${id}/${file}`, "utf8"));
const navigate = (land: LandData) =>
  browserNavigation(
    land.info.width,
    land.info.height,
    data(land.info.id, "navigation.json"),
    data(land.info.id, "terrain.json"),
    land.collision,
  );
beforeAll(async () => {
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, options?: { signal?: AbortSignal }) => {
      if (options?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      return new Response(readFileSync("public" + input), { status: 200 });
    }),
  );
  lands = await loadOverview(emptyAdminWorldOverrides(), new AbortController().signal, () => {});
}, 45000);
afterAll(() => vi.unstubAllGlobals());
describe("Administrator sees actual Superior v2 contents", () => {
  it("matches the immutable source catalogue and never imports a pending PR as deployed content", () => {
    expect(overviewCatalog.quests).toEqual(ALL_QUESTS_V2);
    expect(overviewCatalog.monsters).toEqual(MONSTERS);
    expect(overviewCatalog.cities).toEqual(ALL_CITIES_V2);
    expect(overviewCatalog.dialogues).toEqual(ALL_NPC_DIALOGUES);
    expect(overviewCatalog.items).toEqual(ITEM_CATALOG);
    expect(overviewCatalog.recipes).toEqual(CRAFTING_RECIPES);
    expect(Object.keys(overviewCatalog.places)).toHaveLength(4);
  });
  it("reads all four continents, six islands and every authored spawn exactly once", () => {
    expect(lands.map((l) => l.info.id).sort()).toEqual(
      OVERVIEW_INDEX.features.map((f) => f.id).sort(),
    );
    const entries = lands.flatMap((l) => l.entries.filter((e) => e.layer === "spawns"));
    expect(entries).toHaveLength(8752);
    expect(lands.flatMap((l) => l.entries.filter((e) => e.layer === "roads"))).toHaveLength(1715);
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
    for (const land of lands) {
      expect(land.rejected).toEqual([]);
      expect(land.entries.filter((e) => e.layer === "spawns").map((e) => e.sourceId)).toEqual(
        data(land.info.id, "spawns.json").overworld.map((s: { id: string }) => s.id),
      );
    }
  });
  for (const info of OVERVIEW_INDEX.features)
    it(`${info.id}: NPC positions, services and room coordinates agree with the shared simulation`, () => {
      const land = lands.find((l) => l.info.id === info.id)!,
        nav = navigate(land);
      const source = structuredClone(land.source);
      const places = v2Places(info.affinity);
      for (const town of source.settlements) town.name = places?.townNames[town.id] ?? town.name;
      const runtime = buildSuperiorSimulationWorld({
        source,
        info,
        navigation: nav,
        town: null,
        basePath: "/game/worlds/superior-v2",
        places: v2Places(info.affinity),
      });
      for (const [town, city] of runtime.cities)
        for (const npc of city.npcs) {
          const e = land.entries.find(
            (e) =>
              e.layer === "npcs" && e.town === town && (e.details as { id: string }).id === npc.id,
          )!;
          expect(e, `${town} ${npc.id}`).toBeDefined();
          expect(e.name).toBe(npc.name);
          const at = npc.building ? cityRoom(npc.building, info.affinity).npc : nav.safe(npc);
          expect({ x: e.x, y: e.y }).toEqual({ x: at.x, y: at.y });
          if (npc.building) expect(e.room).toBe(town + ":" + npc.building);
          else expect(e.room).toBeUndefined();
        }
      for (const [town, city] of runtime.cities)
        for (const b of city.city.buildings) {
          const e = land.entries.find(
            (e) => e.layer === "buildings" && e.town === town && e.building === b.id && !e.room,
          )!;
          expect({ x: e.x, y: e.y }).toEqual(b.door);
        }
    }, 15000);
  it("keeps reserved dungeon entrances and decorative resources out of the active service list", () => {
    const entries = lands.flatMap((l) => l.entries);
    expect(entries.filter((e) => e.layer === "dungeons")).toHaveLength(22); // 16 continental endpoints + 6 island endpoints, not 22 playable dungeons.
    expect(entries.filter((e) => e.layer === "dungeons").every((e) => e.status === "data")).toBe(
      true,
    );
    expect(entries.filter((e) => e.layer === "resources").every((e) => e.status === "data")).toBe(
      true,
    );
  });
  it("maps combat objectives to actual spawn slots and reports targets without a v2 binding", () => {
    const q = questEntries(lands, emptyAdminWorldOverrides()),
      base = lands.flatMap((l) => l.entries);
    expect(q.entries.length).toBeGreaterThan(100);
    expect(q.unmapped.length).toBeGreaterThan(0);
    for (const e of q.entries) {
      const target = base.find((b) => b.id === e.related?.[0])!;
      expect(target).toBeDefined();
      expect([e.x, e.y, e.land, e.room]).toEqual([target.x, target.y, target.land, target.room]);
    }
  });
  it("applies custom spawns without mutation and rejects water/city positions as the game does", () => {
    const land = lands.find((l) => l.info.id === "verdant")!,
      authored = data("verdant", "spawns.json").overworld,
      nav = navigate(land),
      ov = emptyAdminWorldOverrides();
    const copy = JSON.stringify(authored),
      base = authored[0];
    ov.customSpawns[base.id] = { ...base, feature: "verdant", deleted: true };
    ov.customSpawns["valid"] = { ...authored[1], id: "valid", feature: "verdant" };
    ov.customSpawns["city"] = { ...base, id: "city", feature: "verdant", ...land.info.arrival };
    const out = buildLandEntries(land.info, land.source, authored, nav, ov);
    expect(out.entries.some((e) => e.sourceId === base.id)).toBe(false);
    expect(out.entries.some((e) => e.sourceId === "verdant-valid")).toBe(true);
    expect(out.entries.some((e) => e.sourceId === "verdant-city")).toBe(false);
    expect(out.rejected).toContain("verdant-city");
    expect(JSON.stringify(authored)).toBe(copy);
  });
  it("never changes runtime catalogues when a different data source is selected", () => {
    const before = JSON.stringify([MONSTERS, WORLDS, ALL_QUESTS_V2]),
      catalog = JSON.stringify(overviewCatalog);
    const land = lands[0]!,
      ov = emptyAdminWorldOverrides();
    ov.monsters[overviewCatalog.monsters[0]!.id] = { name: "Test" };
    buildLandEntries(
      land.info,
      land.source,
      data(land.info.id, "spawns.json").overworld,
      navigate(land),
      ov,
    );
    questEntries(lands, ov);
    expect(JSON.stringify([MONSTERS, WORLDS, ALL_QUESTS_V2])).toBe(before);
    expect(JSON.stringify(overviewCatalog)).toBe(catalog);
  });
  it("remains immutable even after the editor applied local overrides", () => {
    const snapshot = JSON.stringify(overviewCatalog),
      ov = emptyAdminWorldOverrides();
    ov.monsters[MONSTERS[0]!.id] = { name: "Local draft" };
    try {
      applyAdminWorldOverridesToRuntime(ov);
      expect(JSON.stringify(overviewCatalog)).toBe(snapshot);
    } finally {
      applyAdminWorldOverridesToRuntime(emptyAdminWorldOverrides());
    }
  });
  it("reflects explicit published place coordinates, loot probabilities and quest rewards without mutation", () => {
    const land = lands.find((l) => l.info.id === "verdant")!,
      ov = emptyAdminWorldOverrides();
    const id = Object.keys(overviewCatalog.places["verdant"]!.famous)[0]!;
    ov.famousPlaces[id] = { x: 25000, y: 26000 };
    const q = overviewCatalog.quests[0]!;
    ov.quests[q.id] = { rewardXp: 432, rewardCoins: 123 };
    const m = overviewCatalog.monsters.find((m) => m.world === "verdant")!;
    ov.monsters[m.id] = { lootChances: { [m.loot[0]!.name]: 0.96 } };
    const out = buildLandEntries(
      land.info,
      land.source,
      data("verdant", "spawns.json").overworld,
      navigate(land),
      ov,
    );
    expect(out.entries.find((e) => e.sourceId === id)).toMatchObject({ x: 25000, y: 26000 });
    const monster = out.entries.find((e) => e.layer === "spawns" && e.kind === m.id)!.details as {
      monster: { loot: { chance: number }[] };
    };
    expect(monster.monster.loot[0]!.chance).toBe(0.96);
    expect(questEntries(lands, ov).quests.find((x) => x.id === q.id)!.reward).toMatchObject({
      xp: 432,
      coins: 123,
    });
  });
  it("bounds scenery requests, supports edge chunks and does not turn zoom-out into a full download", () => {
    expect(visibleChunks({ x: 0, y: 0, width: 80000, height: 60000 }, 80000, 60000)).toEqual([]);
    expect(visibleChunks({ x: -100, y: -100, width: 200, height: 200 }, 80000, 60000)).toEqual([
      { x: 0, y: 0 },
    ]);
    expect(
      visibleChunks({ x: 4000, y: 4000, width: 2000, height: 2000 }, 80000, 60000),
    ).toHaveLength(4);
  });
  it("matches Polish names without accents and preserves explicit layer/status metadata", () => {
    const e = lands.flatMap((l) => l.entries).find((e) => e.name.includes("Przystań"))!;
    expect(matches(e, "przystan")).toBe(true);
    expect(matches(e, "nieistniejacy punkt")).toBe(false);
  });
  it("rejects a corrupt world file instead of silently displaying incorrect positions", async () => {
    await expect(
      jsonFile("/game/worlds/superior-v2/index.json", new AbortController().signal, "0".repeat(64)),
    ).rejects.toThrow("Niezgodna suma");
  });
});
