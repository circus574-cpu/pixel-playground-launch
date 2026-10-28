import { SuperiorSaveStore, type SuperiorIndex } from "../game/world/generated/superiorSave";
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { GameSession, SaveStore, newPlayer } from "../game/session";
import { RACE_IDS, type RaceId } from "../game/world/races";
import { WORLDS } from "../game/world/worlds";
import { HERITAGE_BY_ID } from "../game/development/heritage/catalog";
import { questId, type HeritageContentId } from "../game/development/heritage/types";
import { forgeProcedure } from "../game/development/heritage/reducer";
import { emptyDevelopment, DevelopmentSchema } from "../game/development/state";
import type { HeritageInteraction } from "../game/development/heritage/runtime";
import { equippedAttack } from "../game/development/heritage/equipment";
import { BUILDING_IDS } from "../game/city/types";
import { cityRoom } from "../game/city/room";

function storage() {
  const data = new Map<string, string>();
  let fail = false;
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (fail) throw Error("quota");
      data.set(k, v);
    },
    set fail(v: boolean) {
      fail = v;
    },
  };
}
function harness(race: RaceId) {
  const port = storage(),
    save = new SaveStore(port, "owned-slot"),
    p = newPlayer(race);
  save.load();
  p.quests.steps = "done";
  p.x = 300;
  p.y = 500;
  expect(save.save(p)).toBe(true);
  const base = WORLDS[p.continent];
  const guide = { ...base.npcs.find((n) => n.id === "guide")!, x: 300, y: 450 };
  delete guide.building;
  const world = {
    ...base,
    width: 1500,
    height: 1200,
    objects: [],
    obstacles: [],
    enemies: [],
    monsters: [],
    spawn: { x: 300, y: 500 },
    city: {
      name: "Controlled integration fixture",
      roads: [],
      buildings: BUILDING_IDS.map((id, i) => ({
        id,
        name: id,
        door: { x: 400 + i * 130, y: 600 },
        objectId: "fixture-" + id,
        district: "Rynek",
        description: id,
      })),
    },
    npcs: [
      guide,
      { ...base.npcs.find((n) => n.id === "smith")!, x: 750, y: 600, building: "smithy" as const },
    ],
    market: { ...base.market, x: 600, y: 550 },
  };
  const session = new GameSession(save, race, { world });
  return { port, save, session };
}
function entry(s: GameSession, id: HeritageContentId) {
  return s.heritage.snapshot().find((e) => e.id === id)!;
}
function reach(s: GameSession, id: HeritageContentId, targetId: string) {
  for (let phase = 0; phase < 3; phase++) {
    const target = entry(s, id).targets.find((t) => t.id === targetId)!;
    if (target.near) return;
    s.command({ type: "heritage", action: "go", id, targetId });
    for (let tick = 0; tick < 150; tick++) {
      s.command({ type: "dialogue", action: "close" });
      s.tick(1000);
      if (entry(s, id).targets.find((t) => t.id === targetId)?.near) return;
      if (!s.route.length && !s.player.interior) break;
    }
  }
  expect(entry(s, id).targets.find((t) => t.id === targetId)?.near, s.notice).toBe(true);
}
function finishFirst(s: GameSession) {
  const id = questId(s.player.race, 1);
  const first = entry(s, id).targets[0]!;
  reach(s, id, first.id);
  s.command({ type: "heritage", action: "start", id });
  expect(entry(s, id).status).toBe("active");
  let guard = 0;
  while (entry(s, id).status === "active" && guard++ < 50) {
    const e = entry(s, id),
      goal = e.goal;
    const target = e.targets.find((t) => !e.progress!.goal.completedTargetIds.includes(t.id))!;
    reach(s, id, target.id);
    let interaction: HeritageInteraction;
    if (goal.kind === "talk") interaction = { kind: "talk", responseId: goal.responses[0]!.id };
    else if (goal.kind === "inspect") interaction = { kind: "inspect" };
    else if (goal.kind === "solve")
      interaction = { kind: "solve", answerId: goal.puzzles[e.progress!.goal.sequence]!.answerId };
    else if (goal.kind === "consent")
      interaction = { kind: "consent", granted: true, mode: "anonymous" };
    else if (goal.kind === "forge")
      interaction = {
        kind: "forge",
        operationId: forgeProcedure(goal, s.player.race)[e.progress!.goal.sequence]!.id,
      };
    else throw Error("Unexpected first chapter goal " + goal.kind);
    s.command({
      type: "heritage",
      action: "act",
      id,
      goalId: goal.id,
      targetId: target.id,
      revision: e.progress!.goal.revision,
      interaction,
    });
  }
  expect(entry(s, id).status, s.notice).toBe("ready");
  return id;
}

describe("heritage session transactions (controlled map fixtures, not browser acceptance)", () => {
  it.each(RACE_IDS)(
    "completes first chapter by physical movement/actions, claims once, equips and reloads: %s",
    (race) => {
      const { session: s, port } = harness(race),
        identity = s.player,
        id = finishFirst(s),
        def = HERITAGE_BY_ID.get(id)!;
      const hp = s.player.hp,
        ki = s.player.ki;
      s.command({ type: "heritage", action: "claim", id, choiceId: def.choices[0]!.id });
      expect(s.player).toBe(identity);
      expect(entry(s, id).status, s.notice).toBe("done");
      expect(s.player.level).toBe(2);
      expect(s.player.xp).toBe(0);
      expect(s.player.gold).toBe(50);
      expect(s.player.development!.practiceEarned).toBe(150);
      expect(s.player.hp).toBe(hp);
      expect(s.player.ki).toBe(ki);
      const weapon = s.player.development!.heritage.weapon!;
      expect(weapon.owner).toBe("owned-slot");
      expect(weapon.stage).toBe(1);
      expect(s.player.weapon).toBe(null);
      expect(equippedAttack(s.player)).toBe(0);
      s.command({ type: "heritage-weapon", action: "equip" });
      expect(s.player.weapon, s.notice).toBe("heritage");
      expect(equippedAttack(s.player)).toBe(8);
      expect(s.player.hp).toBe(hp);
      const bytes = port.getItem("owned-slot");
      s.command({ type: "heritage", action: "claim", id, choiceId: def.choices[1]!.id });
      expect(port.getItem("owned-slot")).toBe(bytes);
      const loaded = new SaveStore(port, "owned-slot").load()!;
      expect(loaded.development!.heritage.weapon).toEqual(weapon);
      expect(loaded.weapon).toBe("heritage");
      port.data.set("other-slot", bytes!);
      expect(new SaveStore(port, "other-slot").load()).toBeUndefined();
    },
  );
  it("failed storage leaves ready chapter, XP, gold, practice and personal item unchanged; retry grants once", () => {
    const { session: s, port } = harness("planetary"),
      id = finishFirst(s),
      before = structuredClone(s.player);
    const choiceId = HERITAGE_BY_ID.get(id)!.choices[0]!.id;
    port.fail = true;
    s.command({ type: "heritage", action: "claim", id, choiceId });
    expect(s.player).toEqual(before);
    port.fail = false;
    s.command({ type: "heritage", action: "claim", id, choiceId });
    expect(entry(s, id).status).toBe("done");
    expect(s.player.development!.practiceEarned).toBe(150);
  });
  it("does not accept a response from across the map, or replay a stale objective revision", () => {
    const { session: s } = harness("planetary"),
      id = questId("planetary", 1),
      first = entry(s, id);
    s.command({ type: "heritage", action: "start", id });
    const talk = entry(s, id);
    expect(talk.status).toBe("active");
    expect(talk.goal.kind).toBe("talk");
    s.command({ type: "move", x: 1000, y: 600 });
    for (let i = 0; i < 20; i++) s.tick(1000);
    const action = {
      type: "heritage" as const,
      action: "act" as const,
      id,
      goalId: talk.goal.id,
      targetId: first.targets[0]!.id,
      revision: 0,
      interaction: { kind: "talk" as const, responseId: "record" },
    };
    s.command(action);
    expect(entry(s, id).progress!.step).toBe(0);
    reach(s, id, first.targets[0]!.id);
    s.command(action);
    expect(entry(s, id).progress!.step).toBe(1);
    s.command(action);
    expect(entry(s, id).progress!.step).toBe(1);
  });
  it("migrates foundation development v1 read-only, backs original v6 bytes before v7 and keeps unknown fields", () => {
    const port = storage(),
      p = newPlayer();
    const { heritage: omitted, ...legacy } = emptyDevelopment();
    void omitted;
    const bytes = JSON.stringify({
      version: 6,
      revision: "foundation",
      player: { ...p, development: { ...legacy, version: 1 } },
    });
    port.data.set("slot", bytes);
    const save = new SaveStore(port, "slot"),
      loaded = save.load()!;
    expect(loaded.development!.version).toBe(2);
    expect(port.getItem("slot")).toBe(bytes);
    expect(save.save(loaded)).toBe(true);
    expect(JSON.parse(port.getItem("slot")!).version).toBe(7);
    expect(port.getItem("ki-legends:recovery:before-v7:slot")).toBe(bytes);
    const raw = JSON.parse(port.getItem("slot")!);
    raw.player.development.heritage.future = 1;
    const future = JSON.stringify(raw);
    port.data.set("slot", future);
    const futureSave = new SaveStore(port, "slot");
    expect(futureSave.load()).toBeUndefined();
    expect(futureSave.save(loaded)).toBe(false);
    expect(port.getItem("slot")).toBe(future);
  });
  it("requires real depot proximity and preserves identity through storage", () => {
    const { session: s, port } = harness("legend"),
      id = finishFirst(s);
    s.command({
      type: "heritage",
      action: "claim",
      id,
      choiceId: HERITAGE_BY_ID.get(id)!.choices[0]!.id,
    });
    const w = structuredClone(s.player.development!.heritage.weapon!);
    s.command({ type: "heritage-weapon", action: "deposit" });
    expect(s.player.development!.heritage.weapon!.location).toBe("bag");
    // Controlled interior fixture for the actual depot command, not a manufactured chapter result.
    s.player.interior = "depot";
    Object.assign(s.player, cityRoom("depot").chest);
    s.depotOpen = true;
    s.command({ type: "heritage-weapon", action: "deposit" });
    expect(s.player.development!.heritage.weapon!.location).toBe("depot");
    s.command({ type: "heritage-weapon", action: "withdraw" });
    expect(s.player.development!.heritage.weapon).toEqual(w);
    expect(DevelopmentSchema.safeParse(s.player.development).success).toBe(true);
    expect(port.getItem("owned-slot")).toBeTruthy();
  });
});

describe("interior reload regressions", () => {
  it("uses the actual portrait Pyra smithy dimensions and preserves bytes on an invalid room", () => {
    const port = storage();
    const index = JSON.parse(
      readFileSync("public/game/worlds/superior-v2/index.json", "utf8"),
    ) as SuperiorIndex;
    const save = new SuperiorSaveStore(port, "pyra-slot", index, "pyra");
    save.load();
    save.town = "pyra-capital";
    const p = {
      ...newPlayer("legend"),
      ...index.features.find((f) => f.id === "pyra")!.arrival,
      interior: "smithy" as const,
      x: 270,
      y: 900,
    };
    expect(save.save(p)).toBe(true);
    const loaded = new SuperiorSaveStore(port, "pyra-slot", index, "pyra").load();
    expect(loaded?.interior).toBe("smithy");
    expect(loaded?.x).toBe(270);
    expect(loaded?.y).toBe(900);
    const raw = JSON.parse(port.getItem("pyra-slot")!);
    raw.player.x = 541;
    const invalid = JSON.stringify(raw);
    port.data.set("pyra-slot", invalid);
    const blocked = new SuperiorSaveStore(port, "pyra-slot", index, "pyra");
    expect(blocked.load()).toBeUndefined();
    expect(blocked.save(p)).toBe(false);
    expect(port.getItem("pyra-slot")).toBe(invalid);
  });
  it("keeps outdoor targets in world coordinates after restoring inside a room", () => {
    const { session: s, save } = harness("planetary");
    const id = "P-V1" as const,
      outdoorBefore = s.heritage.snapshot().find((q) => q.id === id)!.targets[0]!.point;
    s.player.interior = "smithy";
    Object.assign(s.player, cityRoom("smithy").entry);
    expect(save.save(s.player)).toBe(true);
    const restored = new GameSession(save, "planetary", { world: s.world });
    expect(restored.player.interior).toBe("smithy");
    expect(restored.heritage.snapshot().find((q) => q.id === id)!.targets[0]!.point).toEqual(
      outdoorBefore,
    );
  });
});
