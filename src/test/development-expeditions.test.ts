import { describe, it, expect } from "vitest";
import {
  DEVELOPMENT_ENCOUNTERS,
  DEVELOPMENT_ARCHETYPES,
  EXPEDITIONS,
  developmentMonster,
} from "../game/development/expeditions/catalog";
import { MONSTERS, monsterDef } from "../game/monsters/catalog";
import { developmentWorld, advanceWorld, completeBuild } from "./helpers/developmentWorld";
import { CurrentDevelopmentSchema } from "../game/development/state";
import { OnlineCommandSchema } from "../server/characters/commands";
import { RACE_IDS } from "../game/world/races";
import { distance } from "../game/navigation";
import { advanceExperience, xpNeeded } from "../game/experience";
import { LEVEL_MAX } from "../game/kit/progression";
import type { GameSession } from "../game/session";

function totalXp(s: GameSession) {
  let xp = s.player.xp;
  for (let l = 1; l < s.player.level; l++) xp += xpNeeded(l);
  return xp;
}
function start(s: GameSession, id: string) {
  s.command({ type: "expedition", action: "go", id });
  for (let n = 0; n < 2000 && !s.expeditions.snapshot().entries.find((e) => e.id === id)!.near; n++)
    s.tick(50);
  s.command({ type: "cancel" });
  expect(s.expeditions.snapshot().entries.find((e) => e.id === id)!.near, s.notice).toBe(true);
  s.command({ type: "expedition", action: "start", id });
  expect(s.expeditions.snapshot().active?.phase, s.notice).toBe("running");
}
describe("bounded level-22–40 expeditions in the existing combat engine", () => {
  it("adds thirty-two variants from eight exact canonical IDs; never mutates the forty species", () => {
    expect(DEVELOPMENT_ARCHETYPES).toHaveLength(8);
    expect(DEVELOPMENT_ENCOUNTERS).toHaveLength(32);
    expect(EXPEDITIONS).toHaveLength(48);
    expect(MONSTERS).toHaveLength(40);
    for (const d of DEVELOPMENT_ENCOUNTERS) {
      const source = structuredClone(monsterDef(d.species)),
        copy = developmentMonster(d);
      copy.traits.machine = !copy.traits.machine;
      expect(monsterDef(d.species)).toEqual(source);
      const [hp, atk, def] =
        d.role === "heavy"
          ? [1.6, 1.15, 1.3]
          : d.role === "ranged"
            ? [0.9, 1, 1]
            : [0.75, 0.9, 0.85];
      expect(d.hp).toBe(Math.round((180 + 42 * d.level) * hp));
      expect(d.atk).toBe(Math.round((12 + 3.2 * d.level) * atk));
      expect(d.def).toBe(Math.round((5 + 1.3 * d.level) * def));
      expect(d.xp).toBe(Math.round(xpNeeded(d.level) * 0.08));
      expect(copy.id).toBe(source.id);
      expect(copy.loot).toEqual([]);
      expect(copy.respawn).toBe(0);
    }
  });
  it.each(RACE_IDS)(
    "requires a saved chapter and cannot spawn in safe cities or remote worlds: %s",
    (race) => {
      const { s } = developmentWorld(race, false),
        d = EXPEDITIONS.find((d) => d.race === race)!;
      expect(s.expeditions.snapshot().entries.find((e) => e.id === d.id)!.locked).toContain(
        "rozdział",
      );
      s.command({ type: "expedition", action: "start", id: d.id });
      expect(s.enemies).toHaveLength(0);
      const variant = DEVELOPMENT_ENCOUNTERS.find((v) => v.race === race)!;
      expect(() => s.monsters.spawnDevelopment(variant.id, { x: 2400, y: 600 })).toThrow(/mieście/);
      expect(() =>
        s.monsters.spawnDevelopment(
          DEVELOPMENT_ENCOUNTERS.find((v) => v.race !== race)!.id,
          s.player,
        ),
      ).toThrow(/wariant/);
    },
  );
  it.each(EXPEDITIONS)(
    "uses actual AI, real attacks, persisted variant discovery and a finite objective: $id",
    (d) => {
      const { s } = developmentWorld(d.race);
      completeBuild(s);
      s.player.items.potion = 3;
      s.saves!.save(s.player);
      const before = {
        xp: totalXp(s),
        practice: s.player.development!.practiceEarned,
        receipts: structuredClone(s.player.development!.rewardReceipts),
        knowledge: structuredClone(s.player.development!.knowledge),
      };
      start(s, d.id);
      const kills = new Map<string, number>();
      const observed = new Map<string, { xp: number; body: (typeof s.enemies)[number] }>();
      let attacks = 0;
      for (let n = 0; n < 12000 && s.expeditions.snapshot().active?.phase === "running"; n++) {
        const enemy = s.enemies.find(
          (e) => e.developmentVariant && e.hp > 0 && e.mode !== "dead" && !e.m.hidden,
        );
        for (const e of s.enemies)
          if (e.developmentVariant) observed.set(e.id, { xp: e.m.def.xp, body: e });
        if (enemy) {
          if (!s.kit.channel) {
            if (distance(s.player, enemy) > Math.min(80, s.kit.basicRange * 0.75))
              s.command({ type: "move", x: enemy.x, y: enemy.y });
            else {
              if (s.targetId !== enemy.id) s.command({ type: "target", id: enemy.id });
              s.command({ type: "ability", ability: "R" });
              for (const a of s.kit.abilities()) {
                if (
                  !a.ready ||
                  a.id === "T" ||
                  a.id === "R" ||
                  a.id === "potion" ||
                  a.ki > s.player.ki
                )
                  continue;
                if (
                  s.player.race === "sage" &&
                  ((a.id === "C1" && s.player.ki > s.kit.stats.maxKi * 0.5) ||
                    (a.id === "C4" && s.player.hp > s.kit.stats.maxHp * 0.7))
                )
                  continue;
                s.command({ type: "ability", ability: a.id });
                if (s.kit.channel) break;
              }
            }
          }
          if (s.player.hp < s.kit.stats.maxHp * 0.5)
            s.command({ type: "ability", ability: "potion" });
        } else {
          const point = s.expeditions.snapshot().active!.point;
          s.command({ type: "move", ...point });
        }
        s.tick(50);
        attacks += s.events.filter((e) => e.type === "attack" && e.source !== "player").length;
        for (const e of s.enemies)
          if (e.developmentVariant && e.hp === 0) kills.set(e.id, e.m.def.xp);
        for (const [id, e] of observed) if (e.body.mode === "dead") kills.set(id, e.xp);
        s.events.length = 0;
      }
      const active = s.expeditions.snapshot().active;
      expect(
        active?.phase,
        JSON.stringify({
          active,
          notice: s.notice,
          hp: s.player.hp,
          level: s.player.level,
          enemies: s.enemies.map((e) => ({
            kind: e.kind,
            hp: e.hp,
            phase: e.m.phase,
            home: e.home,
            x: e.x,
            y: e.y,
          })),
        }),
      ).toBe("passed");
      expect(attacks).toBeGreaterThan(0);
      expect(s.player.dead).toBe(false);
      expect(kills.size).toBe(d.layout === "single" ? 1 : d.layout === "pair" ? 2 : 4);
      expect(totalXp(s) - before.xp).toBe([...kills.values()].reduce((n, x) => n + x, 0));
      expect(s.player.development!.practiceEarned).toBe(before.practice);
      expect(s.player.development!.rewardReceipts).toEqual(before.receipts);
      expect(s.player.development!.knowledge).toEqual(before.knowledge);
      expect(s.player.development!.completedExpeditions[d.id]).toBe(true);
      expect(s.saves!.load()!.development!.completedExpeditions[d.id]).toBe(true);
      expect(CurrentDevelopmentSchema.safeParse(s.player.development).success).toBe(true);
      expect(s.loot).toHaveLength(0);
      expect(s.enemies).toHaveLength(0);
      const xp = totalXp(s);
      advanceWorld(s, 3000);
      expect(totalXp(s)).toBe(xp);
    },
    20000,
  );
  it("defeating a variant retries an atomic XP write without a duplicate payment", () => {
    const { s, fail } = developmentWorld();
    const d = EXPEDITIONS.find((d) => d.race === "planetary" && d.layout === "single")!;
    start(s, d.id);
    const enemy = s.enemies[0]!,
      before = totalXp(s);
    fail(true);
    // The persistence fault test uses an explicit lethal damage input, not a combat-playability certificate.
    s.monsters.damage(enemy, 100000, { tags: ["physical"] });
    expect(enemy.mode).toBe("dead");
    expect(totalXp(s)).toBe(before);
    expect(s.expeditions.snapshot().active?.pendingSaves).toBe(1);
    s.command({ type: "expedition", action: "leave", id: d.id });
    expect(s.expeditions.snapshot().active).not.toBeNull();
    fail(false);
    advanceWorld(s, 50);
    expect(totalXp(s)).toBe(before + enemy.m.def.xp);
    s.expeditions.killed(enemy);
    advanceWorld(s, 50);
    expect(totalXp(s)).toBe(before + enemy.m.def.xp);
  });
  it("walking away cleans only owned actors and does not complete a protection objective", () => {
    const { s } = developmentWorld();
    const d = EXPEDITIONS.find((d) => d.race === "planetary" && d.layout === "protection")!;
    start(s, d.id);
    const unrelated = s.monsters.spawn("boar", { x: 5000, y: 5000 });
    s.command({ type: "move", x: 5000, y: 5000 });
    advanceWorld(s, 15000);
    expect(s.expeditions.snapshot().active?.phase).toBe("failed");
    expect(s.enemies).toContain(unrelated);
    expect(s.enemies.some((e) => e.encounterOwner)).toBe(false);
    expect(s.player.development!.completedExpeditions[d.id]).toBeUndefined();
  });
  it("accepts bounded intentions, never client-supplied completions, coordinates or rewards", () => {
    expect(
      OnlineCommandSchema.safeParse({ type: "expedition", id: EXPEDITIONS[0]!.id, action: "start" })
        .success,
    ).toBe(true);
    for (const extra of [{ xp: 999 }, { completed: true }, { x: 1 }, { level: 40 }])
      expect(
        OnlineCommandSchema.safeParse({
          type: "expedition",
          id: EXPEDITIONS[0]!.id,
          action: "start",
          ...extra,
        }).success,
      ).toBe(false);
    expect(
      CurrentDevelopmentSchema.safeParse({
        ...developmentWorld().s.player.development,
        completedExpeditions: { unknown: true },
      }).success,
    ).toBe(false);
  });
  it("shares the canonical XP curve with ordinary kills and supports the approved technical level limit", () => {
    const p = { level: 100, xp: xpNeeded(100) - 1 };
    advanceExperience(p, 100);
    expect(p).toEqual({ level: 101, xp: 99 });
    const capped = { level: LEVEL_MAX, xp: 0 };
    advanceExperience(capped, 1000000);
    expect(capped.xp).toBe(xpNeeded(LEVEL_MAX) - 1);
    expect(() => advanceExperience(p, -1)).toThrow();
  });
});
