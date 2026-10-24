import { describe, expect, it } from "vitest";
import { GameSession, SaveStore, newPlayer, type StoragePort } from "../game/session";
import { Navigation } from "../game/navigation";
import { WORLDS } from "../game/world/worlds";
import type { WorldDefinition } from "../game/world/types";
import type { RaceId } from "../game/world/races";

function fixture(race: RaceId = "planetary", store?: SaveStore) {
  const world: WorldDefinition = {
    ...WORLDS.verdant,
    safeAreas: [],
    width: 2000,
    height: 2000,
    spawn: { x: 500, y: 500 },
    enemies: [],
    monsters: [],
    obstacles: [],
    objects: [],
  };
  delete world.city;
  const game = new GameSession(store, race, {
    combatMode: "manual-prototype",
    world,
    navigation: new Navigation(2000, 2000, []),
    random: () => 0.99,
  });
  const foe = game.monsters.spawn("boar", { x: game.player.x + 50, y: game.player.y }, "target");
  // Keep a stationary, durable target while retaining the real damage/AI pipeline.
  foe.fx.stunMs = 100000;
  foe.hp = foe.maxHp = 100000;
  game.facing = { x: 1, y: 0 };
  game.events = [];
  return { game, foe };
}
function run(game: GameSession, milliseconds: number, fps = 60) {
  for (let i = 0; i < Math.round((milliseconds * fps) / 1000); i++) game.tick(1000 / fps);
}
function hold(game: GameSession) {
  game.command({ type: "combat", input: { kind: "hold", value: true } });
}

describe("Stage A session integration", () => {
  it("selecting a target neither chases nor attacks; windup cannot damage", () => {
    const { game, foe } = fixture();
    game.command({ type: "target", id: foe.id });
    run(game, 1000);
    expect(game.autoAttack).toBe(false);
    expect(game.route).toEqual([]);
    expect(foe.hp).toBe(100000);
    game.command({ type: "ability", ability: "R" });
    run(game, 100);
    expect(foe.hp).toBe(100000);
    run(game, 100);
    expect(foe.hp).toBeLessThan(100000);
    const hp = foe.hp;
    run(game, 2000);
    expect(foe.hp).toBe(hp);
  });
  it("same seeded damage, KI, cooldown and action count at 10–120 FPS", () => {
    const outcomes = [10, 15, 30, 60, 120].map((fps) => {
      const { game, foe } = fixture();
      game.player.ki = 0;
      hold(game);
      run(game, 10000, fps);
      return {
        hp: foe.hp,
        ki: game.player.ki,
        cooldown: game.kit.abilities()[0]!.remaining,
        attacks: game.events.filter((e) => e.type === "attack").length,
        now: game.nowMs,
      };
    });
    for (const result of outcomes) expect(result).toEqual(outcomes[0]);
    expect(outcomes[0]!.attacks).toBeGreaterThan(5);
  });
  it("movement and collision use simulation time, including overload", () => {
    const positions = [10, 30, 120].map((fps) => {
      const { game } = fixture();
      game.manual(1, 1, 0);
      run(game, 1000, fps);
      return { x: game.player.x, y: game.player.y };
    });
    expect(positions[0]).toEqual(positions[1]);
    expect(positions[1]).toEqual(positions[2]);
    const { game } = fixture();
    game.manual(1, 0, 0);
    game.tick(1000);
    expect(game.nowMs).toBeCloseTo((8 * 1000) / 60);
    expect(game.combatClock.droppedMs).toBeCloseTo(1000 - game.nowMs);
    expect(game.player.x).toBeCloseTo(500 + (game.kit.stats.speed * game.nowMs) / 1000);
    game.nav = new Navigation(2000, 2000, [{ x: 600, y: 0, width: 40, height: 2000 }]);
    run(game, 3000);
    expect(game.player.x).toBeLessThan(600);
  });
  it.each(["behind", "range", "wall", "city"])("does not hit through %s", (kind) => {
    const { game, foe } = fixture();
    if (kind === "behind") game.facing = { x: -1, y: 0 };
    if (kind === "range") foe.x += 150;
    if (kind === "wall")
      game.nav = new Navigation(2000, 2000, [{ x: 525, y: 450, width: 10, height: 100 }]);
    if (kind === "city") game.world.safeAreas = [{ x: 400, y: 400, width: 400, height: 400 }];
    hold(game);
    run(game, 400);
    expect(foe.hp).toBe(100000);
  });
  it.each(["pause", "cancel", "stun", "death", "blur", "dialogue"])(
    "cancels windup on %s",
    (kind) => {
      const { game, foe } = fixture();
      hold(game);
      game.tick(1000 / 60);
      if (kind === "pause") {
        game.command({ type: "pause", value: true });
        game.command({ type: "pause", value: false });
      }
      if (kind === "cancel") game.command({ type: "cancel" });
      if (kind === "stun") game.fx.stunMs = 500;
      if (kind === "death") game.player.dead = true;
      if (kind === "blur") game.resetCombatInput();
      if (kind === "dialogue") game.dialogue = "guide";
      run(game, 1000);
      expect(foe.hp).toBe(100000);
    },
  );
  it("legacy remains the default for other races and saved character content survives", () => {
    for (const race of ["legend", "sage", "android"] as const)
      expect(fixture(race).game.combatMode).toBe("legacy");
    const data = new Map<string, string>();
    const memory: StoragePort = {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => {
        data.set(k, v);
      },
    };
    const initial = new SaveStore(memory);
    initial.load();
    const player = newPlayer();
    player.gold = 789;
    player.items.sword = 1;
    player.weapon = "sword";
    initial.save(player);
    const { game } = fixture("planetary", new SaveStore(memory));
    expect(game.player.gold).toBe(789);
    expect(game.player.weapon).toBe("sword");
    const before = structuredClone(game.player);
    game.flush();
    expect(new SaveStore(memory).load()).toEqual(before);
    expect(JSON.stringify([...data.values()])).not.toContain("combatMode");
    expect(JSON.stringify([...data.values()])).not.toContain("actionId");
  });
});

it("manual arena preserves training services and gives no kill rewards", () => {
  const { game } = fixture();
  game.world.city = WORLDS.verdant.city!;
  game.player.interior = "arena";
  Object.assign(game.player, { x: 655, y: 325 });
  game.facing = { x: -55 / Math.hypot(55, 25), y: -25 / Math.hypot(55, 25) };
  game.command({ type: "training", action: "start" });
  const gold = game.player.gold,
    xp = game.player.xp;
  hold(game);
  run(game, 2500);
  expect(game.training.hits).toBeGreaterThan(1);
  expect(game.training.damage).toBeGreaterThan(0);
  expect(game.player.gold).toBe(gold);
  expect(game.player.xp).toBe(xp);
});

it("manual death/reward resolves once with a logical hit identity", () => {
  const { game, foe } = fixture();
  foe.hp = 1;
  game.player.quests.boars = "active";
  const kills = game.player.kills;
  hold(game);
  run(game, 1000);
  expect(game.player.kills).toBe(kills + 1);
  expect(game.events.filter((e) => e.type === "death" && e.target === foe.id)).toHaveLength(1);
  const hits = game.events.filter((e) => e.type === "hit" && e.target === foe.id);
  expect(hits).toHaveLength(1);
  expect(hits[0]!.hitId).toBe("player:basic:1:target");
  expect(hits[0]!.source).toBe("player");
});

it("existing skills queue on the simulation boundary and pause discards them", () => {
  const { game } = fixture();
  game.kit.learn("A1");
  game.command({ type: "ability", ability: "A1" });
  expect(game.player.ki).toBe(game.kit.stats.maxKi);
  game.command({ type: "pause", value: true });
  game.command({ type: "pause", value: false });
  game.tick(1000 / 60);
  expect(game.player.ki).toBe(game.kit.stats.maxKi);
  game.command({ type: "ability", ability: "A1" });
  game.tick(1000 / 60);
  expect(game.player.ki).toBeLessThan(game.kit.stats.maxKi);
});
