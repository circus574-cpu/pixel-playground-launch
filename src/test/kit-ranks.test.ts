import { describe, expect, it } from "vitest";
import { GameSession } from "../game/session";
import { Navigation } from "../game/navigation";
import { RACE_BASE } from "../game/kit/nodes.generated";
import { canLearn, freePoints, validLearned } from "../game/kit/progression";
import type { RaceId } from "../game/world/races";
import { WORLDS } from "../game/world/worlds";

function arena(race: RaceId, level = 20) {
  const world = structuredClone(WORLDS.aether);
  Object.assign(world, {
    width: 8192,
    height: 6144,
    city: undefined,
    enemies: [],
    monsters: [],
    obstacles: [],
    spawn: { x: 3000, y: 2000 },
  });
  const g = new GameSession(undefined, race, {
    world,
    navigation: new Navigation(8192, 6144, []),
  });
  g.player.level = level;
  return g;
}
const withSkills = (race: RaceId, skills: string[]) => {
  const g = arena(race);
  g.player.skills = skills;
  g.kit.forgetAll(skills);
  return g;
};

/** A passive node of each race with a plain percentage effect on one stat. */
const CASES: [RaceId, string, "maxHp" | "maxKi" | "defense" | "attack"][] = [
  ["planetary", "C2", "maxHp"],
  ["sage", "C2", "maxKi"],
  ["android", "B2", "defense"],
  ["legend", "A5", "attack"],
];

describe("rangi węzłów drzewka", () => {
  for (const [race, node, stat] of CASES)
    it(`${race}: ${node} has half its first bonus and +10% of that base per point`, () => {
      const coefficient = race === "sage" ? 0.15 : race === "planetary" ? 0.1 : 0.08;
      const key = stat === "maxHp" ? "hp" : stat === "maxKi" ? "ki" : stat;
      const raw = RACE_BASE[race].base[key] + 19 * RACE_BASE[race].perLevel[key];
      for (const [rank, factor] of [
        [1, 0.5],
        [2, 0.55],
        [3, 0.6],
        [8, 0.85],
      ] as const) {
        const actual = withSkills(race, ["R", ...Array<string>(rank).fill(node)]).kit.stats[stat];
        expect(actual).toBe(Math.floor(raw * (1 + coefficient * factor) + 0.5));
      }
    });

  it("kit zna rangę każdego węzła (0 gdy nie poznany)", () => {
    expect(withSkills("planetary", ["R", "A1", "A4", "A4"]).kit.rank("A4")).toBe(2);
    expect(withSkills("planetary", ["R", "A1", "A4"]).kit.rank("A4")).toBe(1);
    expect(withSkills("planetary", ["R"]).kit.rank("A4")).toBe(0);
  });

  it("uczenie kolejnej rangi kosztuje punkt, a reset przywraca sam korzeń", () => {
    const g = arena("planetary", 6);
    g.command({ type: "learn", node: "A1" });
    g.command({ type: "learn", node: "A1" });
    g.command({ type: "learn", node: "A1" });
    expect(g.player.skills).toEqual(["R", "A1", "A1", "A1"]);
    expect(g.kit.rank("A1")).toBe(3);
    expect(freePoints(6, g.player.skills)).toBe(2);
    expect(validLearned("planetary", 6, g.player.skills)).toBe(true);
    g.player.gold = 1000;
    g.command({ type: "respec" });
    expect(g.player.skills).toEqual(["R"]);
    expect(g.kit.rank("A1")).toBe(0);
  });

  it("korzeń ma zawsze jedną rangę, a rangi nie omijają punktów poziomu", () => {
    expect(canLearn("planetary", 6, ["R"], "R").ok).toBe(false);
    expect(validLearned("planetary", 20, ["R", "R"])).toBe(false);
    expect(validLearned("planetary", 2, ["R", "A1", "A1"])).toBe(false);
    expect(canLearn("planetary", 3, ["R", "A1", "A1"], "A1").ok).toBe(false);
  });
});
