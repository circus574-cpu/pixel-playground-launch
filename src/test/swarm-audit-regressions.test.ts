import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  BAG_CELLS,
  GameSession,
  ensurePlayerEquipment,
  getSlotForItem,
  newPlayer,
  type StoragePort,
} from "../game/session";
import { SuperiorSaveStore, type SuperiorIndex } from "../game/world/generated/superiorSave";
import { repairPlayerForLoad } from "../server/characters/playerRepair";
import { onlineCommand } from "../server/characters/commands";
import { createDefaultSaveV5, createQuestTracker } from "../game/quests/v2Tracker";
import { BOSS_CATALOG } from "../game/bosses";
import { buildSuperiorSimulationWorld } from "../game/world/generated/simulationWorld";
import { Navigation } from "../game/navigation";
import { WORLDS } from "../game/world/worlds";
import { getItemById } from "../game/items";
import { MATERIAL_IDS } from "../game/monsters/materials";

const superiorIndex = JSON.parse(
  readFileSync("public/game/worlds/superior-v1/index.json", "utf8"),
) as SuperiorIndex;

function memoryStorage() {
  const values = new Map<string, string>();
  const port: StoragePort = {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => {
      values.set(k, v);
    },
  };
  return { values, port };
}

function openTestSession() {
  const world = {
    ...WORLDS.verdant,
    width: 60000,
    height: 60000,
    enemies: [],
    monsters: [],
    objects: [],
    obstacles: [],
    safeAreas: [],
    npcs: structuredClone(WORLDS.verdant.npcs),
  };
  delete world.city;
  delete world.terrain;
  return new GameSession(undefined, "planetary", {
    world,
    navigation: new Navigation(60000, 60000, []),
  });
}

describe("SWARM audit regressions", () => {
  it("loads SuperiorSaveStore and repairs player when V2 catalog armor is equipped without vest", () => {
    const { port } = memoryStorage();
    const p = newPlayer();
    ensurePlayerEquipment(p);
    p.armor = "A-V1";
    p.equipment!.armor = "A-V1";
    p.items.vest = 0;

    const saver = new SuperiorSaveStore(port, "slot-v2-armor", superiorIndex, "verdant");
    expect(saver.save(p)).toBe(true);

    const loader = new SuperiorSaveStore(port, "slot-v2-armor", superiorIndex, "verdant");
    const restored = loader.load();
    expect(restored).toBeDefined();
    expect(restored?.armor).toBe("A-V1");
    expect(restored?.equipment?.armor).toBe("A-V1");
    expect(restored?.items.vest).toBe(0);

    const changed = repairPlayerForLoad(p, { width: 60000, height: 60000 }, { town: null });
    expect(changed).not.toContain("items.vest");
    expect(p.items.vest).toBe(0);
  });

  it("prevents dead monsters from regenerating HP and clears regen/DoTs on death", () => {
    const s = openTestSession();
    const e = s.monsters.spawn("verdant-mchowy-szlamak", { x: s.player.x + 120, y: s.player.y });
    e.m.regen = 0.2;
    e.m.regenMs = 10000;
    e.fx.dots.push({ dps: 5, ms: 5000 });

    s.monsters.damage(e, e.maxHp + 100, { tags: ["physical"] });
    expect(e.mode).toBe("dead");
    expect(e.hp).toBe(0);
    expect(e.m.regen).toBe(0);
    expect(e.m.regenMs).toBe(0);
    expect(e.fx.dots).toHaveLength(0);

    e.m.regen = 0.25;
    e.m.regenMs = 5000;
    s.tick(500);
    expect(e.hp).toBe(0);
    expect(e.mode).toBe("dead");
  });

  it("applies +15% Ki Elixir buff (0.15), enforces potion 99 cap before spending, and clears all debuffs with antidote", () => {
    const s = openTestSession();
    s.dialogue = "alchemist";
    const alch = s.npcs.find((n) => n.id === "alchemist");
    if (alch) {
      s.player.x = alch.x;
      s.player.y = alch.y;
    }
    const mat = MATERIAL_IDS[0]!;
    s.player.gold = 200;
    s.player.items.potion = 99;
    s.player.materials[mat] = 5;

    s.command({ type: "brew", recipe: "hp", material: mat });
    expect(s.player.gold).toBe(200);
    expect(s.player.materials[mat]).toBe(5);

    s.command({ type: "brew", recipe: "ki", material: mat });
    expect(s.kit.buff("ki-focus")?.dealtPct).toBeCloseTo(0.15, 6);
    expect(s.player.gold).toBe(192);
    expect(s.player.materials[mat]).toBe(4);

    s.player.hp = 10;
    s.fx.slow = { pct: 0.4, ms: 5000 };
    s.fx.rootMs = 3000;
    s.fx.silenceMs = 3000;
    s.fx.blind = { pct: 0.3, ms: 3000 };
    s.fx.armor = { pct: 0.2, ms: 3000, stacks: 2 };
    s.fx.weaken = { pct: 0.2, ms: 3000 };
    s.fx.apply(
      { k: "dot", id: "poison", atkPct: 0.5, ms: 4000 },
      { cc: 1, stunImmune: false, atk: 20, machine: false },
    );
    s.command({ type: "brew", recipe: "antidote", material: mat });
    expect(s.fx.slow.ms).toBe(0);
    expect(s.fx.rootMs).toBe(0);
    expect(s.fx.silenceMs).toBe(0);
    expect(s.fx.blind.ms).toBe(0);
    expect(s.fx.armor.ms).toBe(0);
    expect(s.fx.weaken.ms).toBe(0);
    expect(s.fx.active).toHaveLength(0);
    expect(s.player.hp).toBeGreaterThan(10);
  });

  it("supports legacy, material, and V2 quest deliveries, unequips delivered legacy sword, and skips npc-* in deliveries()", () => {
    const baseSave = createDefaultSaveV5();
    baseSave.quests["M01"] = {
      questId: "M01",
      state: "active",
      currentStageIndex: 0,
      objectiveProgress: {},
      completionCount: 0,
    };
    baseSave.quests["S-A06"] = {
      questId: "S-A06",
      state: "active",
      currentStageIndex: 0,
      objectiveProgress: {},
      completionCount: 0,
    };
    const tracker = createQuestTracker(
      () => structuredClone(baseSave),
      () => {},
    );
    const deliveries = tracker.deliveries();
    expect(deliveries.some((d) => d.itemId.startsWith("npc-"))).toBe(false);
    expect(deliveries.some((d) => d.itemId === "potion")).toBe(true);

    const mat = MATERIAL_IDS[0]!;
    const s = openTestSession();
    ensurePlayerEquipment(s.player);
    const delivered: { itemId: string; amount: number }[] = [];
    s.setQuestTracker({
      deliveries: () => [
        { itemId: "sword", needed: 1 },
        { itemId: mat, needed: 2 },
        { itemId: "W-V1", needed: 1 },
      ],
      deliver: (itemId, amount) => {
        delivered.push({ itemId, amount });
      },
    });
    s.player.items.sword = 1;
    s.player.weapon = "sword";
    s.player.equipment!.weapon = "sword";
    s.player.upgrade = 1;
    s.player.materials[mat] = 5;
    s.player.bagItems!["W-V1"] = 1;

    s.command({ type: "quest-deliver", item: "sword" });
    expect(s.player.items.sword).toBe(0);
    expect(s.player.weapon).toBeNull();
    expect(s.player.equipment!.weapon).toBeNull();
    expect(s.player.upgrade).toBe(0);

    s.command({ type: "quest-deliver", item: mat });
    expect(s.player.materials[mat]).toBe(3);

    s.command({ type: "quest-deliver", item: "W-V1" });
    expect(s.player.bagItems!["W-V1"]).toBeUndefined();
    expect(delivered).toEqual([
      { itemId: "sword", amount: 1 },
      { itemId: mat, amount: 2 },
      { itemId: "W-V1", amount: 1 },
    ]);
  });

  it("enforces BAG_CELLS when unequipping/swapping V2 items and preserves displaced V2 weapons", () => {
    const s = openTestSession();
    ensurePlayerEquipment(s.player);
    s.player.level = 20;
    s.player.items.potion = 0;
    s.player.items.sword = 1;
    s.player.bagItems!["W-V2"] = 1;

    s.command({ type: "equip", item: "W-V2" });
    expect(s.player.equipment!.weapon).toBe("W-V2");
    expect(s.player.bagItems!["W-V2"]).toBeUndefined();

    // Equipping legacy sword returns displaced W-V2 to bagItems instead of losing it
    s.command({ type: "equip", item: "sword" });
    expect(s.player.weapon).toBe("sword");
    expect(s.player.bagItems!["W-V2"]).toBe(1);

    // Fill all BAG_CELLS distinct stacks so unequipping W-V2 refuses without data loss
    s.command({ type: "equip", item: "W-V2" });
    expect(s.player.bagItems!["W-V2"]).toBeUndefined();
    for (let i = 0; i < BAG_CELLS - 1; i++) {
      s.player.bagItems![`filler-${i}`] = 1;
    }
    // Now bag has 1 ("sword") + 39 ("filler-*") = 40 used cells
    s.command({ type: "unequip", slot: getSlotForItem("W-V2")! });
    expect(s.player.equipment!.weapon).toBe("W-V2");
    expect(s.player.bagItems!["W-V2"]).toBeUndefined();

    // Swapping W-V2 with W-V1 when W-V1 has stack of 2 (won't free its cell) should also refuse cleanly
    delete s.player.bagItems!["filler-38"];
    s.player.bagItems!["W-V1"] = 2; // still 40 cells used
    s.command({ type: "equip", item: "W-V1" });
    expect(s.player.equipment!.weapon).toBe("W-V2");
    expect(s.player.bagItems!["W-V1"]).toBe(2);
  });

  it("exits interiors, switches to outsideNav, and deduplicates live bosses on boss_enter", () => {
    const s = openTestSession();
    const boss = BOSS_CATALOG.find((b) => b.continent === "verdant")!;
    const warden = s.world.npcs.find((n) => n.id === "warden")!;
    warden.building = "depot";
    s.player.interior = "depot";
    const insideWarden = s.npcs.find((n) => n.id === "warden")!;
    s.player.x = insideWarden.x;
    s.player.y = insideWarden.y;
    s.dialogue = "warden";

    s.command({ type: "dialogue", action: "boss_enter", bossId: boss.id });
    expect(s.player.interior).toBeNull();
    expect(s.dialogue).toBeNull();
    expect(s.player.x).toBeGreaterThan(2000);
    const spawned = s.enemies.filter((en) => en.boss?.definition.id === boss.id);
    expect(spawned).toHaveLength(1);

    // Repeating boss_enter near outside warden reuses live boss instead of duplicating
    delete warden.building;
    s.player.x = warden.x;
    s.player.y = warden.y;
    s.dialogue = "warden";
    s.command({ type: "dialogue", action: "boss_enter", bossId: boss.id });
    expect(s.enemies.filter((en) => en.boss?.definition.id === boss.id)).toHaveLength(1);
  });

  it("supports GM staff commands setBagItem and setDepotGold in session and online schema", () => {
    const item = getItemById("W-V1")!;
    expect(
      onlineCommand(
        { type: "staff", action: "setBagItem", id: item.id, count: 4, depot: true },
        true,
      ),
    ).toMatchObject({ type: "staff", action: "setBagItem", id: item.id, count: 4, depot: true });
    expect(onlineCommand({ type: "staff", action: "setDepotGold", gold: 500 }, true)).toMatchObject(
      {
        type: "staff",
        action: "setDepotGold",
        gold: 500,
      },
    );

    const s = openTestSession();
    s.staff = "gm";
    s.command({ type: "staff", action: "setBagItem", id: item.id, count: 3 });
    expect(s.player.bagItems![item.id]).toBe(3);
    s.command({ type: "staff", action: "setBagItem", id: item.id, count: 0 });
    expect(s.player.bagItems![item.id]).toBeUndefined();
    s.command({ type: "staff", action: "setDepotGold", gold: 777 });
    expect(s.player.depot.gold).toBe(777);
  });

  it("caches session.npcs array reference and spreads non-capital town NPCs across coordinates", () => {
    const s = openTestSession();
    const first = s.npcs;
    const second = s.npcs;
    expect(second).toBe(first);
    s.player.interior = "shop";
    const inside = s.npcs;
    expect(inside).not.toBe(first);
    expect(inside).toBe(s.npcs);

    const services = ["shop", "hall", "inn", "smithy", "depot", "arena"] as const;
    const sim = buildSuperiorSimulationWorld({
      source: {
        feature: "verdant",
        affinity: "verdant",
        name: "Testowa Kraina",
        geometry: { width: 10000, height: 10000, anchor: { x: 2000, y: 2000 } },
        sourceOffset: null,
        acceptedSource: null,
        settlements: [
          {
            id: "test-town",
            name: "Osada Testowa",
            kind: "town",
            x: 2000,
            y: 2000,
            bounds: { x: 1000, y: 1000, width: 2000, height: 2000 },
          },
        ],
        roads: [],
        buildings: services.map((service, idx) => ({
          id: `b-${service}`,
          settlement: "test-town",
          service,
          door: { x: 1400 + idx * 160, y: 1600 },
          footprint: { x: 1360 + idx * 160, y: 1520, width: 80, height: 80 },
        })),
      },
      info: {
        id: "verdant",
        name: "Verdantia",
        affinity: "verdant",
        width: 10000,
        height: 10000,
        arrival: { x: 2000, y: 2000 },
        worldSha256: "test-sha",
      },
      navigation: new Navigation(10000, 10000, []),
      town: "test-town",
      basePath: "/test",
    });
    const coords = new Set(sim.world.npcs.map((n) => `${n.x},${n.y}`));
    expect(coords.size).toBe(sim.world.npcs.length);
  });
});
