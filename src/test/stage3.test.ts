import { describe, expect, it, beforeEach } from "vitest";
import { GameSession, SaveStore, SAVE_KEY, stats, type NpcId } from "../game/session";
import { RACES, RACE_IDS } from "../game/world/races";
import { WORLDS, worldObstacles } from "../game/world/worlds";
import { CharacterStore } from "../game/characters";
import { CHARACTER_VISUALS, regionAssets } from "../game/world/assets";
import { distance } from "../game/navigation";
import { existsSync } from "node:fs";

function run(g: GameSession, until: () => boolean, limit = 1800) {
  for (let i = 0; i < limit && !until(); i++) g.tick(50);
  expect(
    until(),
    JSON.stringify({ world: g.world.id, notice: g.notice, x: g.player.x, y: g.player.y }),
  ).toBe(true);
}
function talk(g: GameSession, npc: NpcId) {
  g.command({ type: "interact", npc });
  run(g, () => g.dialogue === npc);
}
const close = (g: GameSession) => g.command({ type: "dialogue", action: "close" });
beforeEach(() => localStorage.clear());

describe.each(RACE_IDS)("%s playable region", (race) => {
  it("spawns safely; all NPCs, enemies and exploration targets are reachable; uses the human adapter", () => {
    const g = new GameSession(undefined, race);
    expect(g.player.continent).toBe(RACES[race].world);
    expect(g.player).toMatchObject(g.world.spawn);
    expect(g.nav.walkable(g.player)).toBe(true);
    for (const p of [...g.npcs, ...g.enemies, g.world.market, ...g.world.landmarks]) {
      expect(g.nav.walkable(p), JSON.stringify(p)).toBe(true);
      expect(g.nav.path(g.player, p).length, JSON.stringify(p)).toBeGreaterThan(0);
    }
    expect(CHARACTER_VISUALS[RACES[race].visual].url).toContain("hero-walk-v2");
    for (const asset of regionAssets(g.world))
      expect(existsSync("public" + asset.url), asset.url).toBe(true);
    expect(existsSync("public" + g.world.minimap)).toBe(true);
    for (const o of worldObstacles(g.world))
      expect(g.nav.walkable({ x: o.x + o.width / 2, y: o.y + o.height / 2 })).toBe(false);
  });
  it("completes exploration, hunting, loot, equipment, trade, upgrade and restores the exact world and progress", () => {
    const key = SAVE_KEY + race,
      g = new GameSession(new SaveStore(localStorage, key), race);
    talk(g, "guide");
    g.command({ type: "dialogue", action: "accept" });
    close(g);
    g.command({ type: "move", ...g.world.market });
    run(g, () => g.player.quests.steps === "ready");
    talk(g, "guide");
    g.command({ type: "dialogue", action: "claim" });
    close(g);
    talk(g, "hunter");
    g.command({ type: "dialogue", action: "accept" });
    close(g);
    for (const e of g.enemies.slice(0, 3)) {
      g.command({ type: "target", id: e.id });
      for (let i = 0; i < 1800 && e.hp > 0; i++) {
        g.tick(50);
        if (distance(g.player, e) < 100 && g.player.ki >= 12 && !g.player.cooldowns.flame)
          g.command({ type: "ability", ability: "flame" });
        if (g.player.hp < 50 && !g.player.cooldowns.potion)
          g.command({ type: "ability", ability: "potion" });
      }
      expect(e.hp, g.notice).toBe(0);
      const loot = g.loot.at(-1)!;
      g.command({ type: "loot", id: loot.id });
      run(g, () => !g.loot.some((l) => l.id === loot.id));
    }
    expect(g.player.items.tusk).toBe(3);
    expect(g.player.quests.boars).toBe("ready");
    talk(g, "hunter");
    g.command({ type: "dialogue", action: "claim" });
    close(g);
    talk(g, "smith");
    g.command({ type: "dialogue", action: "accept" });
    close(g);
    g.command({ type: "equip", item: "sword" });
    talk(g, "smith");
    g.command({ type: "dialogue", action: "claim" });
    const attack = stats(g.player).attack;
    g.command({ type: "dialogue", action: "upgrade" });
    expect(stats(g.player).attack).toBe(attack + 4);
    close(g);
    talk(g, "merchant");
    g.command({ type: "trade", item: "tusk", buy: false });
    g.command({ type: "trade", item: "potion", buy: true });
    close(g);
    expect(g.player.quests).toEqual({ steps: "done", boars: "done", gear: "done" });
    g.flush();
    expect(new GameSession(new SaveStore(localStorage, key)).player).toEqual(g.player);
  }, 20000);
});

describe("non-destructive character slots", () => {
  it("copies v1 without rewriting it, infers Planetarni, and keeps four independent characters", () => {
    const legacy = new GameSession();
    legacy.player.gold = 177;
    const {
      race: _race,
      continent: _continent,
      startContinent: _start,
      ...oldPlayer
    } = legacy.player;
    const raw = JSON.stringify({ version: 1, revision: "old", player: oldPlayer });
    localStorage.setItem(SAVE_KEY, raw);
    const store = new CharacterStore(localStorage, SAVE_KEY);
    const old = store.list()[0]!;
    expect(old.player?.race).toBe("planetary");
    expect(old.player?.gold).toBe(177);
    for (const race of RACE_IDS) {
      const slot = store.create(race)!;
      expect(slot.player?.race).toBe(race);
      store.select(slot);
      expect(store.active()?.id).toBe(slot.id);
    }
    expect(store.list()).toHaveLength(5);
    expect(localStorage.getItem(SAVE_KEY)).toBe(raw);
    const restored = new GameSession(new SaveStore(localStorage, old.key));
    restored.player.gold = 178;
    restored.flush();
    expect(localStorage.getItem(SAVE_KEY)).toBe(raw);
    expect(store.list().find((s) => s.id === "legacy")?.player?.gold).toBe(178);
  });
  it("keeps corrupt and future saves visible, protected, and allows a separate new game", () => {
    for (const raw of ["", "{broken", JSON.stringify({ version: 99 })]) {
      localStorage.clear();
      localStorage.setItem(SAVE_KEY, raw);
      const store = new CharacterStore(localStorage, SAVE_KEY);
      const invalid = store.list()[0]!;
      expect(invalid.player).toBeUndefined();
      expect(invalid.warning).not.toBe("");
      new GameSession(new SaveStore(localStorage, invalid.key)).flush();
      store.create("sage");
      expect(localStorage.getItem(SAVE_KEY)).toBe(raw);
      expect(localStorage.getItem(invalid.key)).toBe(raw);
    }
  });
  it("isolates test profiles and concurrent creations without a shared index", () => {
    const a = new CharacterStore(localStorage, SAVE_KEY),
      b = new CharacterStore(localStorage, SAVE_KEY);
    const one = a.create("legend")!,
      two = b.create("android")!;
    expect(one.key).not.toBe(two.key);
    expect(a.list()).toHaveLength(2);
    const qa = new CharacterStore(localStorage, SAVE_KEY + ":qa");
    qa.create("sage");
    expect(qa.list()).toHaveLength(1);
    expect(a.list()).toHaveLength(2);
  });
  it("uses distinct spatial layouts and local identities", () => {
    expect(new Set(Object.values(WORLDS).map((w) => JSON.stringify(w.spawn))).size).toBe(4);
    expect(new Set(Object.values(WORLDS).map((w) => w.npcs[0]!.name)).size).toBe(4);
    expect(new Set(Object.values(WORLDS).map((w) => JSON.stringify(w.objects))).size).toBe(4);
  });
});

describe("future eight-direction visual adapter", () => {
  it("maps diagonals to real future frames while keeping the present human sheet", async () => {
    const { facingDirection, EIGHT_DIRECTIONS, walkFrame } =
      await import("../game/world/characterVisual");
    const human = CHARACTER_VISUALS["human-v2"];
    expect(facingDirection({ x: 1, y: 1 }, EIGHT_DIRECTIONS)).toBe("down-right");
    expect(facingDirection({ x: -1, y: -1 }, EIGHT_DIRECTIONS)).toBe("up-left");
    expect(facingDirection({ x: 1, y: 1 }, human.directions)).toBe("down");
    expect(walkFrame(human, "left", 2)).toBe(6);
    expect(
      walkFrame({ ...human, kind: "atlas", directions: EIGHT_DIRECTIONS }, "down-right", 3),
    ).toBe("hero/walk/down-right/03");
  });
});
