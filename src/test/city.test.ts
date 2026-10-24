import { describe, expect, it } from "vitest";
import {
  GameSession,
  SaveStore,
  newPlayer,
  MATERIAL_IDS,
  stats,
  type NpcId,
  type StoragePort,
} from "../game/session";
import { WORLDS } from "../game/world/worlds";
import { VERDANT_CITY } from "../game/city/verdantia";
import { inSafeCity } from "../game/city/types";
import { cityRoom } from "../game/city/room";
import { Navigation, distance } from "../game/navigation";
import type { BuildingId } from "../game/city/types";
function memory(): StoragePort {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
  };
}
function run(g: GameSession, ready: () => boolean, seconds = 100) {
  for (let i = 0; i < seconds * 20 && !ready(); i++) g.tick(50);
  expect(
    ready(),
    JSON.stringify({ p: g.player, notice: g.notice, route: g.route.slice(0, 2) }),
  ).toBe(true);
}
function enter(g: GameSession, building: BuildingId) {
  g.command({ type: "enter", building });
  run(g, () => g.player.interior === building);
}
function talk(g: GameSession, npc: NpcId) {
  g.command({ type: "interact", npc });
  run(g, () => g.dialogue === npc);
}
function chest(g: GameSession) {
  enter(g, "depot");
  g.command({ type: "chest" });
  run(g, () => g.depotOpen);
}
function transfer(g: GameSession, item: string, quantity = 1, withdraw = false) {
  g.command({ type: "depot", item, quantity, withdraw });
}

describe("Verdantia functional city", () => {
  it("can leave an interior to visit the guide, and a new destination cancels the old route", () => {
    const g = new GameSession();
    talk(g, "merchant");
    g.command({ type: "dialogue", action: "close" });
    talk(g, "guide");
    expect(g.player.interior).toBeNull();
    g.command({ type: "dialogue", action: "close" });
    g.command({ type: "enter", building: "smithy" });
    g.tick(50);
    talk(g, "guide");
    expect(g.player.interior).toBeNull();
  });
  it("has six separated, reachable buildings, collision and accessible interiors", () => {
    const g = new GameSession();
    expect(g.enemies.length).toBeGreaterThan(0);
    expect(g.enemies.every((e) => !inSafeCity(g.world, e, null))).toBe(true);
    for (const b of VERDANT_CITY.buildings) {
      expect(g.nav.walkable(b.door), b.name).toBe(true);
      expect(g.nav.path(g.player, b.door).length, b.name).toBeGreaterThan(0);
      for (const other of VERDANT_CITY.buildings)
        if (other.id !== b.id) expect(distance(b.door, other.door)).toBeGreaterThan(700);
      const r = cityRoom(b.id),
        nav = new Navigation(r.width, r.height, r.obstacles);
      for (const p of [r.npc, r.exit, r.chest, r.dummy])
        expect(nav.path(r.entry, p).length).toBeGreaterThan(0);
      const object = g.world.objects.find((o) => o.id === b.objectId)!;
      expect(g.nav.walkable({ x: object.x, y: object.y - 35 })).toBe(false);
    }
  });
  it("walks through entrances and exits between all six neighbourhoods", () => {
    const g = new GameSession();
    for (const b of VERDANT_CITY.buildings) {
      enter(g, b.id);
      expect(g.npcs).toHaveLength(1);
      expect(g.nav.width).toBe(cityRoom(b.id).width);
    }
    const last = g.building!;
    g.command({ type: "exit" });
    run(g, () => !g.player.interior);
    expect(distance(g.player, last.door)).toBeLessThan(2);
    expect(g.nav.width).toBe(g.world.width);
  });
  it("runs merchant service inside the shop and rejects remote or wrong-NPC trade", () => {
    const g = new GameSession();
    const before = structuredClone(g.player);
    g.command({ type: "trade", item: "potion", buy: true });
    expect(g.player.gold).toBe(before.gold);
    talk(g, "merchant");
    expect(g.player.interior).toBe("shop");
    g.command({ type: "trade", item: "potion", buy: true });
    expect(g.player.items.potion).toBe(4);
    expect(g.player.gold).toBe(12);
    g.command({ type: "dialogue", action: "close" });
    talk(g, "keeper");
    g.command({ type: "trade", item: "potion", buy: true });
    expect(g.player.items.potion).toBe(4);
  });
  it("keeps the city safe and does not create hunt progression or rewards from training", () => {
    const g = new GameSession(undefined, "planetary", { random: () => 0.99 });
    enter(g, "arena");
    g.command({ type: "training", action: "start" });
    run(g, () => distance(g.player, cityRoom("arena").dummy) <= 62);
    const before = structuredClone(g.player);
    g.command({ type: "ability", ability: "R" });
    expect(g.training.hits).toBe(1);
    expect(g.training.damage).toBeGreaterThan(0);
    g.command({ type: "ability", ability: "R" });
    expect(g.training.hits).toBe(1);
    for (let i = 0; i < 50; i++) g.tick(50);
    g.command({ type: "ability", ability: "R" });
    expect(g.training.hits).toBe(2);
    expect(g.player.gold).toBe(before.gold);
    expect(g.player.xp).toBe(before.xp);
    expect(g.player.kills).toBe(before.kills);
    expect(g.player.hp).toBe(before.hp);
    expect(g.loot).toHaveLength(0);
    expect(g.enemies.every((e) => !inSafeCity(g.world, e, null))).toBe(true);
    g.command({ type: "exit" });
    run(g, () => !g.player.interior);
    expect(g.training.active).toBe(false);
  });
  it("runs the introduction in the city and then sends the player outside to hunt", () => {
    const g = new GameSession();
    talk(g, "guide");
    g.command({ type: "dialogue", action: "accept" });
    g.command({ type: "dialogue", action: "close" });
    g.command({ type: "move", ...g.world.market });
    run(g, () => g.player.quests.steps === "ready");
    talk(g, "guide");
    g.command({ type: "dialogue", action: "claim" });
    expect(g.player.xp).toBe(40);
    expect(g.player.gold).toBe(20);
    g.command({ type: "dialogue", action: "close" });
    talk(g, "hunter");
    g.command({ type: "dialogue", action: "accept" });
    expect(g.player.quests.boars).toBe("active");
    expect(g.safe).toBe(true);
  });
  it("rest only charges at the inn, with the innkeeper and below full resources", () => {
    const g = new GameSession();
    g.player.hp = 100;
    g.command({ type: "rest" });
    expect(g.player.gold).toBe(20);
    talk(g, "innkeeper");
    g.player.hp = 100;
    g.player.ki = 0;
    g.command({ type: "rest" });
    expect(g.player.gold).toBe(15);
    expect(g.player.hp).toBe(stats(g.player).maxHp);
    expect(g.player.ki).toBe(stats(g.player).maxKi);
    g.command({ type: "rest" });
    expect(g.player.gold).toBe(15);
  });
  it("keeps monsters out of a city inside a combat continent", () => {
    const g = new GameSession(undefined, "sage");
    const b = g.world.city!.bounds!;
    const edge = { x: b.x + b.width + 40, y: b.y + b.height / 2 };
    const boar = g.monsters.spawn("boar", g.nav.safe(edge));
    Object.assign(g.player, g.nav.safe({ x: b.x + b.width - 60, y: b.y + b.height / 2 }));
    expect(g.safe).toBe(true);
    for (let i = 0; i < 100; i++) g.tick(50);
    expect(boar.m.engaged).toBe(false);
    expect(g.player.hp).toBe(g.kit.stats.maxHp);
    Object.assign(g.player, g.nav.safe({ x: edge.x + 60, y: edge.y }));
    expect(g.safe).toBe(false);
  });
  it("preserves combat outside the city stage on other continents", () => {
    const g = new GameSession(undefined, "sage");
    expect(g.world.city?.bounds).toBeDefined();
    expect(g.enemies.length).toBeGreaterThan(0);
    expect(g.safe).toBe(true);
    g.hurtPlayer(100, g.enemies[0]!, "melee");
    expect(g.player.hp).toBe(g.kit.stats.maxHp);
    Object.assign(g.player, g.nav.safe(g.enemies[0]!));
    expect(g.safe).toBe(false);
    const hp = g.player.hp;
    g.hurtPlayer(100, g.enemies[0]!, "melee");
    expect(g.player.hp).toBeLessThan(hp);
  });
});

describe("personal depot, conservation and guarded saves", () => {
  it("only transfers at an open chest, preserves totals and rejects invalid quantities and ids", () => {
    const g = new GameSession();
    g.player.items.potion = 10;
    transfer(g, "potion", 2);
    expect(g.player.items.potion).toBe(10);
    enter(g, "depot");
    transfer(g, "potion", 2);
    expect(g.player.items.potion).toBe(10);
    chest(g);
    transfer(g, "potion", 5);
    expect(g.player.items.potion).toBe(5);
    expect(g.player.depot.items.potion).toBe(5);
    for (const n of [0, -1, 0.5, 100, Infinity, NaN]) transfer(g, "potion", n);
    transfer(g, "constructor", 1);
    transfer(g, "__proto__", 1);
    expect(g.player.items.potion).toBe(5);
    expect(g.player.depot.items.potion).toBe(5);
    transfer(g, "potion", 3, true);
    expect(g.player.items.potion).toBe(8);
    expect(g.player.depot.items.potion).toBe(2);
  });
  it("keeps full stacks unchanged and protects equipped gear", () => {
    const g = new GameSession();
    g.player.items.sword = 1;
    g.player.weapon = "sword";
    g.player.depot.items.potion = 99;
    chest(g);
    transfer(g, "sword");
    expect(g.player.items.sword).toBe(1);
    expect(g.player.depot.items.sword).toBe(0);
    transfer(g, "potion");
    expect(g.player.items.potion).toBe(3);
    expect(g.player.depot.items.potion).toBe(99);
    g.command({ type: "unequip", slot: "weapon" });
    transfer(g, "sword");
    expect(g.player.items.sword).toBe(0);
    expect(g.player.depot.items.sword).toBe(1);
  });
  it("stores materials and the enhanced blade without losing or duplicating the upgrade after reload", () => {
    const storage = memory(),
      g = new GameSession(new SaveStore(storage));
    const mat = MATERIAL_IDS[0]!;
    g.player.items.sword = 1;
    g.player.upgrade = 1;
    g.player.materials[mat] = 7;
    chest(g);
    transfer(g, "sword");
    transfer(g, mat, 5);
    expect(g.player.upgrade).toBe(0);
    expect(g.player.depot.upgrade).toBe(1);
    const loaded = new GameSession(new SaveStore(storage));
    expect(loaded.player.interior).toBe("depot");
    loaded.command({ type: "chest" });
    run(loaded, () => loaded.depotOpen);
    transfer(loaded, "sword", 1, true);
    transfer(loaded, mat, 5, true);
    expect(loaded.player.items.sword).toBe(1);
    expect(loaded.player.upgrade).toBe(1);
    expect(loaded.player.depot.upgrade).toBe(0);
    expect(loaded.player.materials[mat]).toBe(7);
    expect(loaded.player.depot.materials[mat]).toBeUndefined();
    transfer(loaded, "sword", 1, true);
    expect(loaded.player.items.sword).toBe(1);
  });
  it("isolates character-slot chests and keeps stale tabs from overwriting a newer deposit", () => {
    const storage = memory(),
      one = new GameSession(new SaveStore(storage, "one")),
      two = new GameSession(new SaveStore(storage, "two"));
    one.flush();
    two.flush();
    const stale = new SaveStore(storage, "one");
    stale.load();
    chest(one);
    transfer(one, "potion", 2);
    expect(two.player.depot.items.potion).toBe(0);
    const original = storage.getItem("one");
    expect(stale.save(newPlayer())).toBe(false);
    expect(storage.getItem("one")).toBe(original);
  });
  it("loads v4 without rewriting it, then persists the room/depot as v5", () => {
    const storage = memory(),
      p = newPlayer();
    const old = JSON.parse(JSON.stringify(p));
    delete old.depot;
    delete old.interior;
    const raw = JSON.stringify({ version: 4, revision: "old", player: old });
    storage.setItem("slot", raw);
    const save = new SaveStore(storage, "slot");
    const loaded = save.load()!;
    expect(loaded.depot.items.potion).toBe(0);
    expect(loaded.interior).toBeNull();
    expect(storage.getItem("slot")).toBe(raw);
    expect(save.save(loaded)).toBe(true);
    expect(JSON.parse(storage.getItem("slot")!).version).toBe(5);
  });
  it.each(["future", "unknown-material", "foreign-interior", "invalid-upgrade"])(
    "preserves the original %s save",
    (kind) => {
      const storage = memory(),
        p = newPlayer();
      let version = 5;
      if (kind === "future") version = 6;
      if (kind === "unknown-material") p.depot.materials["unrecognised"] = 1;
      if (kind === "foreign-interior") {
        p.race = "sage";
        p.continent = "aether";
        p.startContinent = "aether";
        p.interior = "depot";
      }
      if (kind === "invalid-upgrade") p.depot.upgrade = 1;
      const raw = JSON.stringify({ version, revision: "fixture", player: p });
      storage.setItem("slot", raw);
      const save = new SaveStore(storage, "slot");
      expect(save.load()).toBeUndefined();
      expect(save.save(newPlayer())).toBe(false);
      expect(storage.getItem("slot")).toBe(raw);
    },
  );
});
