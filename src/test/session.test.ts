import { describe, expect, it } from "vitest";
import {
  GameSession,
  SaveStore,
  SAVE_KEY,
  newPlayer,
  stats,
  type NpcId,
  type StoragePort,
} from "../game/session";
import { distance, Navigation } from "../game/navigation";
import { FOREST } from "../game/world/forest";

function memory(): StoragePort {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}
function run(game: GameSession, until: () => boolean, seconds = 40) {
  for (let i = 0; i < seconds * 20 && !until(); i++) game.tick(50);
  expect(
    until(),
    "simulation timed out: " +
      JSON.stringify({
        player: { x: game.player.x, y: game.player.y },
        dialogue: game.dialogue,
        notice: game.notice,
        target: game.target,
      }),
  ).toBe(true);
}
function talk(game: GameSession, npc: NpcId) {
  game.command({ type: "interact", npc });
  run(game, () => game.dialogue === npc);
}
function close(game: GameSession) {
  game.command({ type: "dialogue", action: "close" });
}

describe("complete adventure on the actual forest collision map", () => {
  it("walks, speaks, completes three quests, fights, takes damage, loots, equips, levels and restores", () => {
    const storage = memory(),
      game = new GameSession(new SaveStore(storage));
    talk(game, "guide");
    game.command({ type: "dialogue", action: "accept" });
    close(game);
    game.command({ type: "move", x: 1480, y: 800 });
    run(game, () => game.player.quests.steps === "ready");
    talk(game, "guide");
    game.command({ type: "dialogue", action: "claim" });
    const firstXp = game.player.xp;
    game.command({ type: "dialogue", action: "claim" });
    expect(game.player.xp).toBe(firstXp);
    close(game);
    talk(game, "hunter");
    game.command({ type: "dialogue", action: "accept" });
    close(game);
    let wasHurt = false,
      usedSkill = false;
    for (const enemy of game.enemies.slice(0, 3)) {
      game.command({ type: "target", id: enemy.id });
      for (let i = 0; i < 1200 && enemy.hp > 0; i++) {
        game.tick(50);
        if (game.player.hp < stats(game.player).maxHp) wasHurt = true;
        if (!usedSkill && distance(game.player, enemy) < 100 && enemy.hp < enemy.maxHp) {
          game.command({ type: "ability", ability: "R" });
          usedSkill = true;
        }
      }
      expect(enemy.hp, "could not defeat " + enemy.id).toBe(0);
      const loot = game.loot.at(-1)!;
      game.command({ type: "loot", id: loot.id });
      run(game, () => !game.loot.some((l) => l.id === loot.id));
    }
    expect(wasHurt).toBe(true);
    expect(usedSkill).toBe(true);
    expect(game.player.items.tusk).toBe(3);
    expect(game.player.quests.boars).toBe("ready");
    talk(game, "hunter");
    game.command({ type: "dialogue", action: "claim" });
    expect(game.player.items.sword).toBe(1);
    close(game);
    talk(game, "smith");
    game.command({ type: "dialogue", action: "accept" });
    close(game);
    game.command({ type: "equip", item: "sword" });
    talk(game, "smith");
    game.command({ type: "dialogue", action: "claim" });
    close(game);
    expect(game.player.quests).toEqual({ steps: "done", boars: "done", gear: "done" });
    expect(game.player.level).toBeGreaterThanOrEqual(2);
    game.flush();
    const restored = new GameSession(new SaveStore(storage));
    expect(restored.player).toEqual(game.player);
    expect(restored.notice).toContain("Wioska ocalona");
  }, 20000);
  it("all NPCs, tutorial point and living boars can be reached from spawn", () => {
    const game = new GameSession();
    for (const goal of [...game.npcs, ...game.enemies, { x: 1480, y: 800 }]) {
      expect(game.nav.walkable(goal)).toBe(true);
      expect(game.nav.path(game.player, goal).length, JSON.stringify(goal)).toBeGreaterThan(0);
    }
  });
});
describe("combat constraints and AI", () => {
  it("basic attack follows the annex damage model, reach and attack interval", () => {
    const game = new GameSession(undefined, "planetary", { random: () => 0.99 }),
      e = game.enemies[0]!;
    Object.assign(game.player, game.nav.safe({ x: e.x - 180, y: e.y }));
    game.targetId = e.id;
    game.command({ type: "ability", ability: "R" });
    expect(e.hp).toBe(66);
    expect(game.autoAttack).toBe(true);
    game.autoAttack = false;
    Object.assign(game.player, game.nav.safe({ x: e.x - 45, y: e.y }));
    game.command({ type: "ability", ability: "R" });
    expect(e.hp).toBe(54); // Atak 12 × 1,0 − Obrona 0 / 2
    expect(game.events.some((event) => event.type === "attack" && event.ability === "R")).toBe(
      true,
    );
    game.command({ type: "ability", ability: "R" });
    expect(e.hp).toBe(54); // odstęp 650 ms
    for (let i = 0; i < 14; i++) game.tick(50);
    game.command({ type: "ability", ability: "R" });
    expect(e.hp).toBeLessThan(54);
  });
  it("checks KI and cooldown, and blocks ranged attacks through obstacles", () => {
    const game = new GameSession(undefined, "sage", { random: () => 0.99 });
    game.player.level = 7;
    game.command({ type: "learn", node: "B1" });
    expect(game.player.skills).toContain("B1");
    game.player.ki = 0;
    game.command({ type: "ability", ability: "B1" });
    expect(game.kit.shieldPoints).toBe(0);
    game.player.ki = 80;
    game.command({ type: "ability", ability: "B1" });
    expect(game.kit.shieldPoints).toBeGreaterThan(0);
    expect(game.player.ki).toBe(68);
    const shield = game.kit.shieldPoints;
    game.command({ type: "ability", ability: "B1" });
    expect(game.player.ki).toBe(68);
    expect(game.kit.shieldPoints).toBe(shield);
    const enemy = game.enemies[0]!;
    let placed = false;
    for (const o of game.nav.obstacles) {
      const y = o.y + o.height / 2;
      const a = { x: o.x - 40, y },
        b = { x: o.x + o.width + 40, y };
      if (
        o.width < 300 &&
        game.nav.walkable(a) &&
        game.nav.walkable(b) &&
        !game.nav.visible(a, b)
      ) {
        Object.assign(game.player, a);
        Object.assign(enemy, b);
        placed = true;
        break;
      }
    }
    expect(placed).toBe(true);
    game.targetId = enemy.id;
    game.command({ type: "ability", ability: "R" });
    expect(enemy.hp).toBe(66);
  });
  it("a boar bite follows the annex model; death respawns without losing quests or items", () => {
    const game = new GameSession(undefined, "planetary", { random: () => 0.99 }),
      e = game.enemies[0]!;
    Object.assign(game.player, game.nav.safe({ x: e.x - 30, y: e.y }));
    e.m.phase = "engage";
    e.m.engaged = true;
    e.mode = "chase";
    e.attackIn = 0;
    game.tick(50);
    expect(game.player.hp).toBeCloseTo(125 - 6.5, 6); // 9 ATK − 5 DEF / 2
    game.player.hp = 1;
    e.attackIn = 0;
    game.tick(50);
    expect(game.player.dead).toBe(true);
    const items = { ...game.player.items };
    run(game, () => !game.player.dead, 5);
    expect(game.player.hp).toBe(125);
    expect(game.player.items).toEqual(items);
    expect(distance(game.player, FOREST.spawn)).toBeLessThan(25);
  });
  it("leashes, returns home, heals and eventually respawns dead enemies", () => {
    const game = new GameSession(),
      e = game.enemies[0]!;
    e.hp = 1;
    e.m.phase = "engage";
    e.m.engaged = true;
    e.mode = "chase";
    Object.assign(e, game.nav.safe({ x: e.home.x - 100, y: e.home.y }));
    game.tick(50);
    expect(e.mode).toBe("return");
    run(game, () => e.mode === "patrol");
    expect(e.hp).toBe(66);
    e.hp = 0;
    e.mode = "dead";
    e.timer = 1000;
    run(game, () => e.hp > 0, 3);
    expect(e.hp).toBe(66);
  });
  it("pauses during dialogue and resumes on close", () => {
    const game = new GameSession();
    talk(game, "guide");
    const p = { ...game.player };
    game.player.hp = 50;
    game.tick(100);
    expect(game.player.hp).toBe(50);
    game.command({ type: "move", x: 1400, y: 800 });
    expect(game.player.x).toBe(p.x);
    close(game);
    game.tick(100);
    expect(game.player.hp).toBeGreaterThan(50);
  });
});
describe("items, merchant and reward integrity", () => {
  it("smith upgrades an equipped weapon once and inventory caps preserve ground loot", () => {
    const game = new GameSession();
    game.player.items.sword = 1;
    game.command({ type: "equip", item: "sword" });
    talk(game, "smith");
    game.command({ type: "dialogue", action: "upgrade" });
    expect(game.player.gold).toBe(5);
    expect(stats(game.player).attack).toBe(24); // Planetarni 12 + ostrze 8 + ulepszenie 4
    game.command({ type: "dialogue", action: "upgrade" });
    expect(game.player.gold).toBe(5);
    close(game);
    game.player.items.tusk = 99;
    game.loot.push({
      id: "full",
      x: game.player.x,
      y: game.player.y,
      item: "tusk",
      quantity: 1,
      gold: 4,
    });
    game.command({ type: "loot", id: "full" });
    expect(game.loot).toHaveLength(1);
    expect(game.player.items.tusk).toBe(99);
    expect(game.player.gold).toBe(5);
  });
  it("does not consume a potion at full HP, restores HP and enforces cooldown", () => {
    const game = new GameSession();
    game.command({ type: "ability", ability: "potion" });
    expect(game.player.items.potion).toBe(3);
    game.player.hp = 20;
    game.command({ type: "ability", ability: "potion" });
    expect(game.player.hp).toBe(70); // 20 + 40% z 125
    expect(game.player.items.potion).toBe(2);
    game.command({ type: "ability", ability: "potion" });
    expect(game.player.items.potion).toBe(2);
  });
  it("requires a nearby merchant, checks balance and full stacks, protects equipped items", () => {
    const game = new GameSession();
    game.command({ type: "trade", item: "potion", buy: true });
    expect(game.player.gold).toBe(20);
    talk(game, "merchant");
    game.command({ type: "trade", item: "potion", buy: true });
    expect(game.player.items.potion).toBe(4);
    expect(game.player.gold).toBe(12);
    game.command({ type: "trade", item: "sword", buy: true });
    expect(game.player.items.sword).toBe(0);
    game.player.items.potion = 99;
    game.command({ type: "trade", item: "potion", buy: true });
    expect(game.player.gold).toBe(12);
    game.player.items.sword = 1;
    game.command({ type: "equip", item: "sword" });
    game.command({ type: "trade", item: "sword", buy: false });
    expect(game.player.items.sword).toBe(1);
    game.command({ type: "unequip", slot: "weapon" });
    game.command({ type: "trade", item: "sword", buy: false });
    expect(game.player.items.sword).toBe(0);
    expect(game.player.gold).toBe(30);
  });
  it("cannot claim combat reward early, and duplicate loot grants nothing", () => {
    const game = new GameSession();
    talk(game, "hunter");
    game.command({ type: "dialogue", action: "claim" });
    expect(game.player.items.sword).toBe(0);
    close(game);
    game.loot.push({
      id: "one",
      x: game.player.x,
      y: game.player.y,
      item: "tusk",
      quantity: 1,
      gold: 4,
    });
    game.command({ type: "loot", id: "one" });
    const gold = game.player.gold;
    game.command({ type: "loot", id: "one" });
    expect(game.player.gold).toBe(gold);
    expect(game.player.items.tusk).toBe(1);
  });
});
describe("versioned persistence", () => {
  it("preserves malformed and future-version saves", () => {
    for (const raw of ["{broken", JSON.stringify({ version: 2, player: newPlayer() })]) {
      const storage = memory();
      storage.setItem(SAVE_KEY, raw);
      const game = new GameSession(new SaveStore(storage));
      game.flush();
      expect(storage.getItem(SAVE_KEY)).toBe(raw);
      expect(game.snapshot().saveWarning).not.toBe("");
    }
  });
  it("does not let a stale second tab overwrite the first tab", () => {
    const storage = memory(),
      a = new GameSession(new SaveStore(storage)),
      b = new GameSession(new SaveStore(storage));
    a.player.gold = 99;
    a.flush();
    b.player.gold = 5;
    b.flush();
    expect(new GameSession(new SaveStore(storage)).player.gold).toBe(99);
    expect(b.snapshot().saveWarning).toContain("innej karcie");
  });
  it("handles unavailable/full storage without crashing gameplay", () => {
    const save = new SaveStore({
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    });
    const game = new GameSession(save);
    game.flush();
    expect(game.snapshot().saveWarning).toContain("Nie udało");
  });
});
describe("navigation", () => {
  it("routes around a wall, never walks through it, and rejects separated regions", () => {
    const nav = new Navigation(300, 300, [{ x: 130, y: 30, width: 30, height: 180 }]);
    const route = nav.path({ x: 60, y: 100 }, { x: 230, y: 100 });
    expect(route.length).toBeGreaterThan(2);
    expect(route.some((p) => p.y > 210)).toBe(true);
    expect(route.every((p) => nav.walkable(p))).toBe(true);
    const sealed = new Navigation(300, 300, [{ x: 130, y: 0, width: 30, height: 300 }]);
    expect(sealed.path({ x: 60, y: 100 }, { x: 230, y: 100 })).toEqual([]);
  });
});
