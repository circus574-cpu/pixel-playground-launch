import { describe, it, expect } from "vitest";
import { GameSession } from "../game/session";
import { Navigation } from "../game/navigation";
import { WORLDS } from "../game/world/worlds";
import { MONSTERS } from "../game/monsters/catalog";
import { BOSS_CATALOG } from "../game/bosses/catalog";
import { bossPreviewEnabled, rollBossLoot } from "../game/bosses/runtime";
import { COMBAT_BUDGET, CombatVisualBudget } from "../game/combatBudget";
const seeded = (value: number) => () => {
  value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
  return value / 4294967296;
};
export function arena(seed = 574) {
  const world = {
    ...WORLDS.verdant,
    width: 8192,
    height: 8192,
    spawn: { x: 4096, y: 4096 },
    enemies: [],
    monsters: [],
    objects: [],
    npcs: [],
    obstacles: [],
    safeAreas: [{ x: 3500, y: 3500, width: 300, height: 300 }],
  };
  delete world.city;
  delete world.terrain;
  const g = new GameSession(undefined, "planetary", {
    world,
    navigation: new Navigation(8192, 8192, []),
    random: seeded(seed),
  });
  g.player.level = 20;
  g.player.hp = g.kit.stats.maxHp;
  g.player.ki = g.kit.stats.maxKi;
  return g;
}
for (const def of MONSTERS)
  describe(def.id, () => {
    it("seeded detection, attacks, statuses and safe-city boundary", () => {
      const run = () => {
        const g = arena();
        const e = g.monsters.spawn(def.id, { x: 4176, y: 4096 });
        g.monsters.damage(e, 1, { tags: ["physical"] });
        let attacks = 0,
          telegraphs = 0;
        for (let t = 0; t < 16000; t += 50) {
          g.tick(50);
          for (const ev of g.events) {
            if (ev.type === "attack") attacks++;
            if (ev.type === "telegraph") telegraphs++;
          }
          g.events.length = 0;
          g.player.hp = g.kit.stats.maxHp;
        }
        expect(Number.isFinite(e.hp + e.x + e.y)).toBe(true);
        expect(e.x < 3500 || e.x > 3800 || e.y < 3500 || e.y > 3800).toBe(true);
        // Force a hidden attacker beside the protected edge: neither ambush nor burrow may target a city.
        g.player.x = 3790;
        g.player.y = 3650;
        e.x = 3810;
        e.y = 3650;
        const hp = g.player.hp;
        for (let t = 0; t < 1000; t += 50) g.tick(50);
        expect(g.player.hp).toBeGreaterThanOrEqual(hp);
        expect(e.x < 3500 || e.x > 3800 || e.y < 3500 || e.y > 3800).toBe(true);
        expect(e.m.cast).toBeUndefined();
        return { x: e.x, y: e.y, hp: e.hp, phase: e.m.phase, attacks, telegraphs };
      };
      expect(run()).toEqual(run());
    });
    it("returns from its leash and cancels a telegraph when the player reaches safety", () => {
      const g = arena();
      const e = g.monsters.spawn(def.id, { x: 4176, y: 4096 });
      e.m.phase = "engage";
      e.mode = "chase";
      e.m.hidden = false;
      if (!def.traits.still) {
        e.home = { x: e.x - def.traits.leash - 500, y: e.y };
        g.tick(50);
        expect(e.m.phase).toBe("return");
      }
      g.player.x = 3650;
      g.player.y = 3650;
      g.tick(50);
      expect(e.m.cast).toBeUndefined();
    });
  });
for (const def of BOSS_CATALOG)
  describe("preview boss: " + def.id, () => {
    it("uses catalog stats, monotonic HP phases, unlocked attacks and telegraphs", () => {
      const g = arena();
      const e = g.summonBoss(def.id, { x: 4250, y: 4096 });
      expect(e.maxHp).toBe(def.stats.hp);
      expect(e.boss!.phase).toBe(1);
      for (const phase of def.phases) {
        e.hp = (e.maxHp * phase.hpThresholdPercent) / 100;
        g.monsters.damage(e, 1, { tags: ["ki"] });
        expect(e.boss!.phase).toBe(phase.phaseNumber);
        expect(e.m.def.skills.map((s) => s.id)).toEqual(
          def.attacks.filter((a) => phase.unlockedAttacks.includes(a.id)).map((a) => a.id),
        );
        expect(e.m.def.atk).toBe(def.stats.atk * (phase.statModifiers?.atkMultiplier ?? 1));
        for (const skill of e.m.def.skills) {
          expect(skill.cd).toBe(def.attacks.find((a) => a.id === skill.id)!.cooldownSeconds * 1000);
        }
      }
      e.hp = e.maxHp;
      g.tick(50);
      expect(e.boss!.phase).toBe(def.phases.at(-1)!.phaseNumber);
      expect(g.events.some((ev) => ev.type === "telegraph")).toBe(true);
    });
    it("dies once, rolls named preview loot once and does not alter the character inventory/XP", () => {
      const g = arena();
      const e = g.summonBoss(def.id, { x: 4250, y: 4096 });
      const p = structuredClone(g.player);
      g.monsters.damage(e, 1e9, { tags: ["ki"] });
      expect(e.mode).toBe("dead");
      const loot = structuredClone(g.bossRewards);
      expect(loot.length).toBeGreaterThan(0);
      g.killed(e);
      expect(g.bossRewards).toEqual(loot);
      expect(g.player).toEqual(p);
      expect(
        loot.every((d) =>
          def.lootTable.some(
            (l) => l.itemId === d.itemId && d.quantity >= l.minCount && d.quantity <= l.maxCount,
          ),
        ),
      ).toBe(true);
    });
  });
it("boss switch is playtest-only; zero-percent loot never rolls", () => {
  expect(bossPreviewEnabled("/", "?ki-bosses=1")).toBe(false);
  expect(bossPreviewEnabled("/scripts/playtest.html", "?ki-bosses=1")).toBe(true);
  expect(bossPreviewEnabled("/scripts/playtest.html", "")).toBe(false);
  expect(
    rollBossLoot(
      [{ itemId: "x", itemName: "X", chancePercent: 0, minCount: 1, maxCount: 1 }],
      () => 0,
    ),
  ).toEqual([]);
});
it("60 enemies have bounded active AI, distant sleepers wake and zones are capped", () => {
  const g = arena();
  for (let i = 0; i < 60; i++)
    g.monsters.spawn("pyra-ognista-salamandra", { x: 4100 + i * 4, y: 4200 }, "dense-" + i);
  g.tick(50);
  expect(g.enemies.filter((e) => !e.sleeping)).toHaveLength(COMBAT_BUDGET.activeEnemies);
  const e = g.enemies[0]!;
  e.x = 7000;
  e.y = 7000;
  g.tick(50);
  expect(e.sleeping).toBe(true);
  g.player.x = 7000;
  g.player.y = 7100;
  g.tick(50);
  expect(e.sleeping).toBe(false);
  for (let i = 0; i < 200; i++)
    g.monsters.addZone({ kind: "fire", ms: 10000, radius: 100, dps: 1 }, e, e);
  expect(g.monsters.zones.length).toBe(COMBAT_BUDGET.zones);
});
it("visual lifetime is bounded, warnings outlive decorations, teardown releases everything", () => {
  const budget = new CombatVisualBudget(4);
  let disposed = 0;
  budget.add(() => {
    disposed++;
  }, true);
  for (let i = 0; i < 60; i++)
    budget.add(() => {
      disposed++;
    });
  expect(budget.size).toBe(4);
  expect(disposed).toBe(57);
  budget.clear();
  expect(disposed).toBe(61);
  expect(budget.size).toBe(0);
});
it("shutdown blocks movement and resumes after the explicit lock duration", () => {
  const g = arena();
  const before = { x: g.player.x, y: g.player.y };
  g.kit.lockMs = 2000;
  g.manual(1, 0, 50);
  expect({ x: g.player.x, y: g.player.y }).toEqual(before);
  for (let i = 0; i < 40; i++) g.tick(50);
  g.manual(1, 0, 50);
  expect(g.player.x).toBeGreaterThan(before.x);
});
