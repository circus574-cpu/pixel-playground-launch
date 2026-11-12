import { describe, expect, it } from "vitest";
import { GameSession } from "../game/session";
import { WORLDS } from "../game/world/worlds";
import { RACES, RACE_IDS, type RaceId } from "../game/world/races";
import { distance } from "../game/navigation";
import { EscortActivity, type EscortCheckpoint } from "../game/development/heritage/escort";
import { HeritageEncounter, heritageEnemy } from "../game/development/heritage/encounter";
import { ProtectionActivity } from "../game/development/heritage/protection";
import type { ApprovedActivity } from "../game/development/heritage/reducer";
import type { HeritageGoal } from "../game/development/heritage/types";
import type { HeritageTarget } from "../game/development/heritage/bindings";
function fixture(race: RaceId = "planetary") {
  const world = {
    ...WORLDS[RACES[race].world],
    width: 3000,
    height: 2200,
    spawn: { x: 1000, y: 1000 },
    npcs: [],
    monsters: [],
    enemies: [],
    objects: [],
    obstacles: [],
    safeAreas: [],
    city: {
      name: "Fixture",
      buildings: [],
      roads: [],
      bounds: { x: 50, y: 50, width: 100, height: 100 },
    },
  };
  const s = new GameSession(undefined, race, { world, random: () => 0.99 });
  // Isolated level precondition, not a claim of earning level 40 in a campaign.
  s.player.level = 40;
  s.player.hp = s.kit.stats.maxHp;
  s.player.ki = s.kit.stats.maxKi;
  const base: HeritageTarget = {
    id: "goal:target:0",
    label: "Cel",
    point: world.spawn,
    feature: world.id,
    interior: null,
    npc: null,
    witness: false,
    entrance: null,
  };
  return { s, base };
}
function escortGoal(race: RaceId): Extract<HeritageGoal, { kind: "escort" }> {
  return {
    id: `H-${{ planetary: "V", sage: "A", android: "N", legend: "P" }[race]}03:escort`,
    label: "Eskorta",
    site: "trail",
    documents: [],
    kind: "escort",
    actor: "Podopieczny",
    checkpoints: 2,
    combat: true,
    minHealthFraction: 0.5,
  };
}
function advance(s: GameSession, activity: EscortActivity | ProtectionActivity, fight: boolean) {
  const enemy = s.enemies.find((e) => heritageEnemy(e, s.enemies) && e.hp > 0 && e.mode !== "dead");
  const goal = activity.nextTarget().point;
  if (enemy && fight) {
    if (distance(s.player, enemy) > s.kit.basicRange * 0.75)
      s.command({ type: "move", x: enemy.x, y: enemy.y });
    else {
      s.command({ type: "target", id: enemy.id });
      s.command({ type: "ability", ability: "R" });
    }
  } else if (!enemy) s.command({ type: "move", ...goal });
  s.tick(50);
  activity.update();
}
describe("chapter combat activities use production movement, AI and attacks", () => {
  it.each(RACE_IDS)(
    "completes an actual escort with two defended checkpoints and no farming: %s",
    (race) => {
      const { s, base } = fixture(race),
        proofs: EscortCheckpoint[] = [];
      const before = {
        xp: s.player.xp,
        gold: s.player.gold,
        items: structuredClone(s.player.items),
      };
      const a = new EscortActivity(
        s,
        escortGoal(race),
        "owner",
        base,
        [
          { x: 1220, y: 1000 },
          { x: 1440, y: 1000 },
        ],
        0,
        (p) => {
          proofs.push(p);
          return true;
        },
      );
      for (let i = 0; i < 4000 && a.snapshot().phase === "escort"; i++) advance(s, a, true);
      expect(a.snapshot().phase, a.snapshot().message).toBe("passed");
      expect(proofs.map((p) => p.checkpoint)).toEqual([1, 2]);
      expect(proofs.every((p) => p.combatCleared && p.healthFraction >= 0.5)).toBe(true);
      expect(s.enemies).toHaveLength(0);
      expect(s.player.xp).toBe(before.xp);
      expect(s.player.gold).toBe(before.gold);
      expect(s.player.items).toEqual(before.items);
      expect(s.loot).toHaveLength(0);
      a.dispose();
      a.dispose();
    },
  );
  it("cannot complete a combat checkpoint merely by walking or waiting", () => {
    const { s, base } = fixture(),
      proofs: EscortCheckpoint[] = [];
    const a = new EscortActivity(
      s,
      escortGoal("planetary"),
      "owner",
      base,
      [
        { x: 1220, y: 1000 },
        { x: 1440, y: 1000 },
      ],
      0,
      (p) => {
        proofs.push(p);
        return true;
      },
    );
    for (let i = 0; i < 300; i++) advance(s, a, false);
    expect(proofs).toEqual([]);
    expect(a.snapshot().phase).not.toBe("passed");
    a.dispose();
    expect(s.enemies).toHaveLength(0);
  });
  it("cleans all opponents on interruption and resumes at the last committed checkpoint", () => {
    const { s, base } = fixture(),
      proofs: EscortCheckpoint[] = [];
    const route = [
      { x: 1220, y: 1000 },
      { x: 1440, y: 1000 },
    ];
    const a = new EscortActivity(s, escortGoal("planetary"), "owner", base, route, 0, (p) => {
      proofs.push(p);
      return true;
    });
    for (let i = 0; i < 2000 && !proofs.length; i++) advance(s, a, true);
    expect(proofs).toHaveLength(1);
    a.dispose();
    expect(s.enemies).toHaveLength(0);
    const resumed = new EscortActivity(s, escortGoal("planetary"), "owner", base, route, 1, (p) => {
      proofs.push(p);
      return true;
    });
    expect(resumed.actor).toMatchObject(route[0]!);
    for (let i = 0; i < 2000 && resumed.snapshot().phase === "escort"; i++)
      advance(s, resumed, true);
    expect(proofs.map((p) => p.checkpoint)).toEqual([1, 2]);
    expect(resumed.snapshot().phase).toBe("passed");
    resumed.dispose();
  });
  it("a failed checkpoint write cannot advance an escort", () => {
    const { s, base } = fixture();
    let writes = 0;
    const a = new EscortActivity(
      s,
      escortGoal("planetary"),
      "owner",
      base,
      [
        { x: 1220, y: 1000 },
        { x: 1440, y: 1000 },
      ],
      0,
      () => {
        writes++;
        return false;
      },
    );
    for (let i = 0; i < 1500 && !writes; i++) advance(s, a, true);
    expect(writes).toBeGreaterThan(0);
    expect(a.snapshot().windows).toBe(0);
    a.dispose();
  });
  it.each(["sage", "legend"] as const)(
    "defends three real outposts with resumable points: %s",
    (race) => {
      const { s, base } = fixture(race),
        proofs: ApprovedActivity[] = [];
      const goal: Extract<HeritageGoal, { kind: "protect" }> = {
        id: `H-${race === "sage" ? "A" : "P"}06:protect`,
        label: "Obrona",
        site: "trail",
        documents: [],
        kind: "protect",
        points: 3,
        waves: 3,
        minHealthFraction: 0.5,
      };
      const a = new ProtectionActivity(s, goal, "owner", base, 0, (p) => {
        proofs.push(p);
        return true;
      });
      for (let i = 0; i < 6000 && a.snapshot().phase === "protect"; i++) advance(s, a, true);
      expect(a.snapshot().phase, a.snapshot().message).toBe("passed");
      expect(proofs.map((p) => p.protectedPoints)).toEqual([1, 2, 3]);
      expect(proofs.every((p) => p.healthFraction >= 0.5)).toBe(true);
      expect(s.enemies).toHaveLength(0);
      a.dispose();
    },
  );
  it("rejects city encounters without touching ordinary NPCs or spawns", () => {
    const { s } = fixture();
    expect(
      () => new HeritageEncounter(s, "H-V03:escort", "Podopieczny", { x: 100, y: 100 }, true),
    ).toThrow(/poza miastem/);
    expect(s.enemies).toHaveLength(0);
  });
});
