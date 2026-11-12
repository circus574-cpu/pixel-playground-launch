import { preparedDevelopment } from "../../../scripts/combat/developmentFixtures";
import { DISCIPLINES, EXAM_IDS, trainingCost } from "../../game/development/training";
import { expect } from "vitest";
import { GameSession, SaveStore, newPlayer } from "../../game/session";
import { WORLDS } from "../../game/world/worlds";
import { RACES, type RaceId } from "../../game/world/races";
import { BUILDING_IDS } from "../../game/city/types";
import { emptyDevelopment, CurrentDevelopmentSchema } from "../../game/development/state";

/** Explicit level/rank/chapter preconditions for interaction tests, never evidence of earning a campaign. */
export function developmentWorld(race: RaceId = "planetary", unlocked = true) {
  const data = new Map<string, string>();
  let fail = false;
  const port = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (fail) throw Error("fixture storage unavailable");
      data.set(k, v);
    },
  };
  const saves = new SaveStore(port, "owned-character");
  saves.load();
  const p = newPlayer(race);
  p.level = 40;
  p.quests.steps = "done";
  p.x = 2800;
  p.y = 2200;
  const d = unlocked ? preparedDevelopment(race, saves.identity) : emptyDevelopment();
  p.development = d;
  expect(CurrentDevelopmentSchema.safeParse(d).success).toBe(true);
  expect(saves.save(p)).toBe(true);
  const base = WORLDS[RACES[race].world];
  const world = {
    ...base,
    width: 6000,
    height: 6000,
    spawn: { x: 2800, y: 2200 },
    objects: [],
    obstacles: [],
    enemies: [],
    monsters: [],
    safeAreas: [],
    market: { ...base.market, x: 2700, y: 900 },
    city: {
      name: "Controlled interaction fixture",
      bounds: { x: 2000, y: 300, width: 1600, height: 1000 },
      roads: [],
      buildings: BUILDING_IDS.map((id, i) => ({
        id,
        name: id,
        door: { x: 2100 + i * 130, y: 1150 },
        objectId: "fixture-" + id,
        district: "Rynek",
        description: id,
      })),
    },
    npcs: base.npcs.map((n) => ({ ...n, x: 2400, y: 900 })),
  };
  const s = new GameSession(saves, race, { world, random: () => 0.99 });
  if (unlocked) {
    s.command({ type: "heritage-weapon", action: "equip" });
    for (const id of ["B1", "C1", "C2", "C3", "C4"]) s.command({ type: "learn", node: id });
  }
  s.player.hp = s.kit.stats.maxHp;
  s.player.ki = s.kit.stats.maxKi;
  expect(saves.save(s.player)).toBe(true);
  return {
    s,
    world,
    port,
    data,
    fail: (value: boolean) => {
      fail = value;
    },
  };
}
export function advanceWorld(s: GameSession, ms: number) {
  for (let n = 0; n < ms; n += 50) s.tick(Math.min(50, ms - n));
}

/** Explicit complete-build precondition, canonical training/skill rules; not an earned-save claim. */
export function completeBuild(s: GameSession) {
  const d = s.player.development!;
  for (const id of EXAM_IDS)
    if (!d.passedExamIds.includes(id)) {
      d.passedExamIds.push(id);
      d.rewardReceipts[id + ":v1"] = { practice: 250 };
      d.practiceEarned += 250;
    }
  for (const key of DISCIPLINES) d.training[key] = 18;
  d.practiceSpent = trainingCost(d.training);
  expect(CurrentDevelopmentSchema.safeParse(d).success).toBe(true);
  s.player.items.vest = 1;
  s.command({ type: "equip", item: "vest" });
  for (const branch of ["A", "B", "C"])
    for (const n of [1, 2, 3, 4, 5, 6, 7, 9])
      if (!s.player.skills.includes(branch + n)) s.command({ type: "learn", node: branch + n });
  s.player.hp = s.kit.stats.maxHp;
  s.player.ki = s.kit.stats.maxKi;
  s.player.items.potion = 3;
  expect(s.saves!.save(s.player)).toBe(true);
}
