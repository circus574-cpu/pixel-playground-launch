import { describe, expect, it } from "vitest";
import { GameSession, newPlayer } from "../game/session";
import { WORLDS } from "../game/world/worlds";
import { Navigation, distance } from "../game/navigation";
import {
  EscortActivity,
  escortRoute,
  type EscortCheckpoint,
} from "../game/development/heritage/escort";
import type { HeritageTarget } from "../game/development/heritage/bindings";
import type { HeritageGoal } from "../game/development/heritage/types";
import { RACE_IDS, type RaceId } from "../game/world/races";
function fixture(race: RaceId = "planetary", accept = () => true, completed = 0) {
  const p = newPlayer(race);
  p.x = 350;
  p.y = 500;
  const world = {
    ...WORLDS[p.continent],
    width: 1500,
    height: 1200,
    spawn: { x: 350, y: 500 },
    enemies: [],
    monsters: [],
    npcs: [],
    objects: [],
    obstacles: [{ x: 440, y: 400, width: 35, height: 150 }],
    safeAreas: [],
    city: {
      name: "Fixture",
      bounds: { x: 50, y: 50, width: 80, height: 80 },
      roads: [],
      buildings: [],
    },
  };
  const s = new GameSession(undefined, race, { world });
  const base: HeritageTarget = {
    id: "delivery:target:0",
    label: "Towarzysz",
    point: world.spawn,
    feature: world.id,
    interior: null,
    npc: null,
    witness: false,
    entrance: null,
  };
  const goal: Extract<HeritageGoal, { kind: "escort" }> = {
    id: "delivery",
    label: "Dostawa",
    site: "trail",
    documents: [],
    kind: "escort",
    actor: "Przewoźnik",
    checkpoints: 2,
    combat: false,
    minHealthFraction: 0.5,
  };
  const route = [
      { x: 560, y: 500 },
      { x: 560, y: 710 },
    ],
    proofs: EscortCheckpoint[] = [];
  const attempt = new EscortActivity(s, goal, "owned-slot", base, route, completed, (proof) => {
    proofs.push(proof);
    return accept();
  });
  const tick = (count = 1) => {
    for (let n = 0; n < count; n++) {
      s.tick(50);
      attempt.update();
    }
  };
  return { s, goal, base, route, proofs, attempt, tick };
}
describe("physical peaceful escort with production navigation and movement", () => {
  it.each(RACE_IDS)("requires player and actual companion at both checkpoints: %s", (race) => {
    const { s, attempt, route, proofs, tick } = fixture(race);
    const hp = s.player.hp,
      ki = s.player.ki;
    tick(400);
    expect(attempt.snapshot().windows).toBe(0);
    expect(proofs).toHaveLength(0);
    for (let i = 0; i < route.length; i++) {
      s.command({ type: "move", ...route[i]! });
      for (let guard = 0; guard < 400 && attempt.snapshot().windows <= i; guard++) {
        tick();
        expect(s.nav.walkable(attempt.actor)).toBe(true);
      }
      expect(attempt.snapshot().windows).toBe(i + 1);
    }
    expect(attempt.snapshot().phase).toBe("passed");
    expect(proofs.map((p) => p.checkpoint)).toEqual([1, 2]);
    for (const proof of proofs) expect(distance(proof.player, proof.actor)).toBeLessThan(150);
    expect(s.player.xp).toBe(0);
    expect(s.player.gold).toBe(20);
    expect(s.player.hp).toBe(hp);
    expect(s.player.ki).toBe(ki);
    expect(s.player.development).toBeUndefined();
    tick(100);
    expect(proofs).toHaveLength(2);
  });
  it("retries a failed checkpoint commit without moving to the next point", () => {
    let accepted = false;
    const { s, attempt, route, tick } = fixture("planetary", () => accepted);
    s.command({ type: "move", ...route[0]! });
    tick(160);
    expect(attempt.snapshot().windows).toBe(0);
    expect(distance(attempt.actor, route[0]!)).toBeLessThan(20);
    accepted = true;
    tick();
    expect(attempt.snapshot().windows).toBe(1);
  });
  it("pauses with the real session and resumes only from the accepted checkpoint", () => {
    const { s, attempt, route, tick, goal, base } = fixture();
    s.command({ type: "move", ...route[0]! });
    tick(15);
    const before = { ...attempt.actor },
      now = s.nowMs;
    s.command({ type: "pause", value: true });
    tick(100);
    expect(attempt.actor).toEqual(before);
    expect(s.nowMs).toBe(now);
    s.command({ type: "pause", value: false });
    s.command({ type: "move", ...route[0]! });
    tick(160);
    expect(attempt.snapshot().windows).toBe(1);
    const resumed = new EscortActivity(s, goal, "owned-slot", base, route, 1, () => true);
    expect(resumed.actor).toEqual(route[0]);
    expect(resumed.nextTarget().point).toEqual(route[1]);
    expect(resumed.snapshot().windows).toBe(1);
  });
  it("fails on abandoning the companion and never accepts a combat escort as a delivery", () => {
    const { s, attempt, tick, goal, base, route } = fixture();
    s.command({ type: "move", x: 1200, y: 1050 });
    tick(180);
    expect(attempt.snapshot().phase).toBe("failed");
    expect(attempt.snapshot().windows).toBe(0);
    expect(
      () => new EscortActivity(s, { ...goal, combat: true }, "owner", base, route, 0, () => true),
    ).toThrow();
  });
  it("plans stable walkable, reachable legs and rejects an enclosed start", () => {
    const nav = new Navigation(1800, 1400, [{ x: 800, y: 500, width: 40, height: 350 }]);
    const start = { x: 600, y: 700 },
      route = escortRoute(nav, start, 4, "delivery");
    expect(escortRoute(nav, start, 4, "delivery")).toEqual(route);
    let previous = start;
    for (const point of route) {
      expect(nav.walkable(point)).toBe(true);
      expect(nav.path(previous, point).length).toBeGreaterThan(0);
      previous = point;
    }
    expect(() =>
      escortRoute(new Navigation(100, 100, []), { x: 50, y: 50 }, 2, "blocked"),
    ).toThrow();
  });
});
