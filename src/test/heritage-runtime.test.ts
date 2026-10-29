import { SuperiorSaveStore, type SuperiorIndex } from "../game/world/generated/superiorSave";
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { GameSession, SaveStore, newPlayer, xpNeeded } from "../game/session";
import { RACE_IDS, type RaceId } from "../game/world/races";
import { WORLDS } from "../game/world/worlds";
import { HERITAGE_BY_ID, PROJECT_BY_ID } from "../game/development/heritage/catalog";
import { projectId, questId, type HeritageContentId } from "../game/development/heritage/types";
import { forgeProcedure } from "../game/development/heritage/reducer";
import { emptyDevelopment, DevelopmentSchema } from "../game/development/state";
import type { HeritageInteraction } from "../game/development/heritage/runtime";
import { equippedAttack } from "../game/development/heritage/equipment";
import { BUILDING_IDS } from "../game/city/types";
import { cityRoom } from "../game/city/room";
import { applyEdit, summarize } from "../game/account/gmEdit";

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
function harness(race: RaceId, level = 1) {
  const port = storage(),
    save = new SaveStore(port, "owned-slot"),
    p = newPlayer(race);
  save.load();
  p.level = level;
  if (level === 100) p.xp = xpNeeded(level) - 1;
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
  it("scanner inspects only known local installations after real H-N01/module configuration", () => {
    const { session: s } = harness("android"),
      id = finishFirst(s);
    s.command({
      type: "heritage",
      action: "claim",
      id,
      choiceId: HERITAGE_BY_ID.get(id)!.choices[0]!.id,
    });
    expect(s.player.development!.unlockedModules).toContain("mn-scanner");
    expect(s.heritage.scanner.snapshot()).toBeNull();
    s.command({ type: "development", action: "modules", ids: ["mn-scanner"] });
    expect(s.player.development!.equippedModuleIds).toEqual(["mn-scanner"]);
    const project = projectId("android", 1);
    reach(s, project, entry(s, project).targets[0]!.id);
    s.command({ type: "heritage", action: "start", id: project });
    const installation = s.heritage.projects.snapshot().find((v) => v.id === project)!;
    expect(installation).toBeDefined();
    expect(s.player.interior).toBe(installation.target.interior);
    s.command({ type: "move", ...installation.target.point });
    for (let tick = 0; tick < 100 && s.route.length; tick++) s.tick(100);
    expect(s.heritage.scanner.snapshot()!.installations.find((v) => v.id === project)?.near).toBe(
      true,
    );
    const before = structuredClone(s.player),
      ki = s.player.ki,
      hp = s.player.hp;
    s.command({ type: "heritage", action: "scan", id: project });
    expect(s.heritage.scanner.snapshot()!.reading).toMatchObject({
      id: project,
      state: "Odbudowa w toku",
      completedSteps: 0,
    });
    expect(s.player).toEqual(before);
    expect({ ki: s.player.ki, hp: s.player.hp }).toEqual({ ki, hp });
    // Arbitrary/unstarted projects cannot be queried through the command API.
    s.command({ type: "heritage", action: "scan", id: projectId("android", 6) });
    expect(s.heritage.scanner.snapshot()!.reading).toBeNull();
    s.command({ type: "heritage", action: "scan", id: project });
    const point = installation.target.point;
    s.nav.setLocalObstacles("scanner-occlusion-test", [
      { x: point.x - 15, y: point.y + 25, width: 30, height: 18 },
    ]);
    s.command({ type: "move", x: point.x, y: point.y + 90 });
    for (let tick = 0; tick < 100 && s.route.length; tick++) s.tick(100);
    expect(s.nav.visible(s.player, point)).toBe(false);
    expect(s.heritage.scanner.snapshot()!.installations).toEqual([]);
    expect(s.heritage.scanner.snapshot()!.reading).toBeNull();
    s.nav.setLocalObstacles("scanner-occlusion-test", []);
    expect(s.heritage.scanner.snapshot()!.reading).toBeNull();
    s.command({ type: "heritage", action: "scan", id: project });
    expect(s.heritage.scanner.snapshot()!.reading).not.toBeNull();
    s.command({ type: "development", action: "modules", ids: [] });
    expect(s.heritage.scanner.snapshot()).toBeNull();
    s.command({ type: "development", action: "modules", ids: ["mn-scanner"] });
    expect(s.heritage.scanner.snapshot()!.reading).toBeNull();
    const reloaded = new GameSession(s.saves, "android");
    expect(reloaded.heritage.scanner.snapshot()!.reading).toBeNull();
  });
  it("saves real delivery checkpoints atomically and resumes H-V02 after reload", () => {
    const { session: s, port } = harness("planetary");
    const first = finishFirst(s);
    s.command({
      type: "heritage",
      action: "claim",
      id: first,
      choiceId: HERITAGE_BY_ID.get(first)!.choices[0]!.id,
    });
    const performSimple = (game: GameSession, id: HeritageContentId) => {
      const e = entry(game, id),
        goal = e.goal,
        progress = e.progress!;
      const target = e.targets.find((t) => !progress.goal.completedTargetIds.includes(t.id))!;
      reach(game, id, target.id);
      let interaction: HeritageInteraction;
      if (goal.kind === "talk") interaction = { kind: "talk", responseId: goal.responses[0]!.id };
      else if (goal.kind === "inspect") interaction = { kind: "inspect" };
      else if (goal.kind === "solve")
        interaction = { kind: "solve", answerId: goal.puzzles[progress.goal.sequence]!.answerId };
      else if (goal.kind === "recover") interaction = { kind: "recover" };
      else if (goal.kind === "craft") interaction = { kind: "craft" };
      else if (goal.kind === "forge")
        interaction = {
          kind: "forge",
          operationId: forgeProcedure(goal, game.player.race)[progress.goal.sequence]!.id,
        };
      else throw Error("Unexpected physical delivery precondition: " + goal.kind);
      game.command({
        type: "heritage",
        action: "act",
        id,
        goalId: goal.id,
        targetId: target.id,
        revision: progress.goal.revision,
        interaction,
      });
    };
    const project = projectId("planetary", 1);
    reach(s, project, entry(s, project).targets[0]!.id);
    s.command({ type: "heritage", action: "start", id: project });
    for (let guard = 0; entry(s, project).status === "active" && guard < 40; guard++)
      performSimple(s, project);
    expect(entry(s, project).status).toBe("ready");
    s.command({ type: "heritage", action: "claim", id: project, choiceId: null });
    const id = questId("planetary", 2);
    reach(s, id, entry(s, id).targets[0]!.id);
    s.command({ type: "heritage", action: "start", id });
    for (let guard = 0; entry(s, id).goal.kind !== "escort" && guard < 40; guard++) {
      if (entry(s, id).goal.kind === "projects") s.tick(1000);
      else performSimple(s, id);
    }
    expect(entry(s, id).goal.kind).toBe("escort");
    reach(s, id, entry(s, id).targets[0]!.id);
    s.command({ type: "heritage", action: "activity-start", id });
    expect(s.heritage.activitySnapshot()?.phase).toBe("escort");
    const next = entry(s, id).targets[0]!;
    s.command({ type: "heritage", action: "go", id, targetId: next.id });
    port.fail = true;
    for (let tick = 0; tick < 200; tick++) s.tick(50);
    expect(entry(s, id).progress!.goal.sequence).toBe(0);
    port.fail = false;
    for (let tick = 0; tick < 200 && entry(s, id).progress!.goal.sequence === 0; tick++) s.tick(50);
    expect(entry(s, id).progress!.goal.sequence, s.notice).toBe(1);
    s.command({ type: "heritage", action: "activity-leave", id });
    const restored = new GameSession(new SaveStore(port, "owned-slot"), "planetary", {
      world: s.world,
    });
    expect(entry(restored, id).progress!.goal.sequence).toBe(1);
    expect(entry(restored, id).near).toBe(true);
    const practice = restored.player.development!.practiceEarned;
    restored.command({ type: "heritage", action: "activity-start", id });
    expect(restored.heritage.activitySnapshot()?.windows).toBe(1);
    const last = entry(restored, id).targets[0]!;
    restored.command({ type: "heritage", action: "go", id, targetId: last.id });
    for (let tick = 0; tick < 300 && entry(restored, id).goal.kind === "escort"; tick++)
      restored.tick(50);
    expect(entry(restored, id).goal.kind, restored.notice).not.toBe("escort");
    expect(restored.player.development!.practiceEarned).toBe(practice);
    for (let guard = 0; entry(restored, id).status === "active" && guard < 40; guard++)
      performSimple(restored, id);
    expect(entry(restored, id).status, restored.notice).toBe("ready");
    restored.command({
      type: "heritage",
      action: "claim",
      id,
      choiceId: HERITAGE_BY_ID.get(id)!.choices[0]!.id,
    });
    expect(entry(restored, id).status).toBe("done");
    expect(restored.player.development!.heritage.weapon!.stage).toBe(2);
    expect(restored.player.development!.practiceEarned).toBe(550);
    expect(new SaveStore(port, "owned-slot").load()!.development!.heritage.weapon!.stage).toBe(2);
  });
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
      // GM editing must read the equipped personal weapon and not demand an unrelated sword.
      const gmData = { player: structuredClone(s.player) };
      expect(summarize(gmData)!.weapon).toBe("heritage");
      expect(summarize(gmData)!.currentStats!.attack).toBe(s.kit.stats.attack);
      const gmEdit = applyEdit(gmData, { gold: 77 });
      expect(gmEdit.ok).toBe(true);
      expect(summarize(gmEdit.ok ? gmEdit.data : null)!.weapon).toBe("heritage");
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
  it("keeps a capped level-100 character readable after a legitimate chapter reward", () => {
    const { session: s, port } = harness("planetary", 100),
      id = finishFirst(s);
    s.command({
      type: "heritage",
      action: "claim",
      id,
      choiceId: HERITAGE_BY_ID.get(id)!.choices[0]!.id,
    });
    expect(entry(s, id).status, s.notice).toBe("done");
    expect(s.player.level).toBe(100);
    expect(s.player.xp).toBe(xpNeeded(100) - 1);
    expect(s.player.development!.rewardReceipts[`heritage:${id}:v1`]).toEqual({
      practice: 150,
      xp: 100,
      gold: 30,
    });
    const restored = new SaveStore(port, "owned-slot").load();
    expect(restored?.level).toBe(100);
    expect(restored?.development!.heritage.quests[id]!.status).toBe("done");
  });
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
    expect(JSON.parse(port.getItem("slot")!).version).toBe(9);
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

describe("first projects of all four cultures through real session actions", () => {
  it.each(RACE_IDS)(
    "finishes the first project after its own chapter, without duplicate XP/gold: %s",
    (race) => {
      const { session: s } = harness(race),
        chapter = finishFirst(s);
      s.command({
        type: "heritage",
        action: "claim",
        id: chapter,
        choiceId: HERITAGE_BY_ID.get(chapter)!.choices[0]!.id,
      });
      const id = projectId(race, 1),
        def = PROJECT_BY_ID.get(id)!;
      const first = entry(s, id).targets[0]!;
      reach(s, id, first.id);
      s.command({ type: "heritage", action: "start", id });
      expect(entry(s, id).status, s.notice).toBe("active");
      const gold = s.player.gold,
        xp = s.player.xp,
        level = s.player.level;
      const advance = (ms: number) => {
        for (let n = 0; n < ms; n += 50) s.tick(Math.min(50, ms - n));
      };
      let guard = 0;
      while (entry(s, id).status === "active" && guard++ < 60) {
        const e = entry(s, id),
          goal = e.goal,
          progress = e.progress!;
        const target = e.targets.find((t) => !progress.goal.completedTargetIds.includes(t.id))!;
        reach(s, id, target.id);
        if (goal.kind === "restraint") {
          s.command({ type: "heritage", action: "activity-start", id });
          advance(500);
          expect(s.heritage.activitySnapshot()?.phase).toBe("strike");
          s.command({ type: "ability", ability: "R" });
          expect(s.combatIn).toBeGreaterThan(0);
          s.command({ type: "pause", value: true });
          s.command({ type: "heritage", action: "activity-leave", id });
          expect(s.heritage.activitySnapshot()).toBeNull();
          expect(s.practiceTargets.list(s.player.interior)).toHaveLength(0);
          expect(s.player.development!.practiceEarned).toBe(150);
          s.command({ type: "pause", value: false });
          advance(5000);
          s.command({ type: "heritage", action: "activity-start", id });
          advance(500);
          expect(s.heritage.activitySnapshot()?.phase).toBe("strike");
          // Actual hit -> remaining strike -> hold, repeated three times. No manufactured proof.
          for (let cycle = 0; cycle < goal.windows; cycle++) {
            if (cycle === goal.windows - 1)
              while ((s.heritage.activitySnapshot()?.remainingMs ?? 0) > 150) advance(50);
            s.command({ type: "ability", ability: "R" });
            for (let t = 0; t < 100 && s.heritage.activitySnapshot()?.phase === "strike"; t++)
              advance(50);
            expect(s.heritage.activitySnapshot()?.phase, s.notice).toBe("hold");
            advance(2000);
          }
          expect(s.heritage.activitySnapshot()?.phase).toBe("surrender");
          advance(2000);
          expect(s.heritage.activitySnapshot()?.phase).toBe("passed");
          expect(s.combatIn).toBeGreaterThan(0);
          s.command({ type: "pause", value: true });
          s.command({ type: "heritage", action: "activity-finish", id });
          expect(entry(s, id).status, s.notice).toBe("ready");
          s.command({ type: "pause", value: false });
          advance(5000);
          continue;
        }
        let interaction: HeritageInteraction;
        if (goal.kind === "inspect") interaction = { kind: "inspect" };
        else if (goal.kind === "recover") interaction = { kind: "recover" };
        else if (goal.kind === "craft") interaction = { kind: "craft" };
        else if (goal.kind === "solve")
          interaction = { kind: "solve", answerId: goal.puzzles[progress.goal.sequence]!.answerId };
        else throw Error("Missing actual first-project handler " + goal.kind);
        s.command({
          type: "heritage",
          action: "act",
          id,
          goalId: goal.id,
          targetId: target.id,
          revision: progress.goal.revision,
          interaction,
        });
      }
      expect(entry(s, id).status, s.notice).toBe("ready");
      s.command({ type: "heritage", action: "claim", id, choiceId: null });
      expect(entry(s, id).status, s.notice).toBe("done");
      expect(s.player.development!.practiceEarned).toBe(350);
      expect(s.player.gold).toBe(gold);
      expect(s.player.xp).toBe(xp);
      expect(s.player.level).toBe(level);
      expect(s.heritage.projects.snapshot().find((p) => p.id === id)?.done).toBe(true);
      expect(s.snapshot().heritageProjects.some((p) => p.id === id)).toBe(true);
      s.command({ type: "heritage", action: "claim", id, choiceId: null });
      expect(s.player.development!.practiceEarned).toBe(350);
      expect(def.reward.practice).toBe(200);
      // Continue the same legally earned character through its actual second chapter.
      const second = questId(race, 2),
        secondDef = HERITAGE_BY_ID.get(second)!;
      const originalWeapon = structuredClone(s.player.development!.heritage.weapon!);
      reach(s, second, entry(s, second).targets[0]!.id);
      s.command({ type: "heritage", action: "start", id: second });
      for (let action = 0; entry(s, second).status === "active" && action < 80; action++) {
        const e = entry(s, second),
          goal = e.goal,
          progress = e.progress!;
        if (goal.kind === "projects") {
          advance(1000);
          continue;
        }
        const target =
          e.targets.find((t) => !progress.goal.completedTargetIds.includes(t.id)) ?? e.targets[0]!;
        reach(s, second, target.id);
        if (goal.kind === "restraint") {
          s.command({ type: "heritage", action: "activity-start", id: second });
          advance(500);
          for (let cycle = 0; cycle < goal.windows; cycle++) {
            expect(s.heritage.activitySnapshot()?.phase).toBe("strike");
            s.command({ type: "ability", ability: "R" });
            for (
              let ticks = 0;
              ticks < 100 && s.heritage.activitySnapshot()?.phase === "strike";
              ticks++
            )
              advance(50);
            expect(s.heritage.activitySnapshot()?.phase).toBe("hold");
            advance(2000);
          }
          advance(2000);
          expect(s.heritage.activitySnapshot()?.phase).toBe("passed");
          s.command({ type: "heritage", action: "activity-finish", id: second });
          advance(5000);
          continue;
        }
        if (goal.kind === "escort" && !goal.combat) {
          s.command({ type: "heritage", action: "activity-start", id: second });
          for (
            let checkpoint = progress.goal.sequence;
            checkpoint < goal.checkpoints;
            checkpoint++
          ) {
            s.command({
              type: "heritage",
              action: "go",
              id: second,
              targetId: entry(s, second).targets[0]!.id,
            });
            for (
              let tick = 0;
              tick < 400 &&
              entry(s, second).progress!.step === progress.step &&
              entry(s, second).progress!.goal.sequence === checkpoint;
              tick++
            )
              advance(50);
            const result = entry(s, second).progress!;
            expect(
              result.step !== progress.step || result.goal.sequence === checkpoint + 1,
              s.notice,
            ).toBe(true);
          }
          continue;
        }
        let interaction: HeritageInteraction;
        if (goal.kind === "talk") interaction = { kind: "talk", responseId: goal.responses[0]!.id };
        else if (goal.kind === "inspect") interaction = { kind: "inspect" };
        else if (goal.kind === "solve")
          interaction = { kind: "solve", answerId: goal.puzzles[progress.goal.sequence]!.answerId };
        else if (goal.kind === "recover") interaction = { kind: "recover" };
        else if (goal.kind === "forge")
          interaction = {
            kind: "forge",
            operationId: forgeProcedure(goal, race)[progress.goal.sequence]!.id,
          };
        else throw Error("Missing second chapter runtime handler " + goal.kind);
        s.command({
          type: "heritage",
          action: "act",
          id: second,
          goalId: goal.id,
          targetId: target.id,
          revision: progress.goal.revision,
          interaction,
        });
      }
      expect(entry(s, second).status, s.notice).toBe("ready");
      s.command({
        type: "heritage",
        action: "claim",
        id: second,
        choiceId: secondDef.choices[0]!.id,
      });
      expect(entry(s, second).status, s.notice).toBe("done");
      const weapon = s.player.development!.heritage.weapon!;
      expect(weapon.instanceId).toBe(originalWeapon.instanceId);
      expect(weapon.stage).toBe(2);
      expect(weapon.history).toEqual([chapter, second]);
      expect(s.player.development!.practiceEarned).toBe(550);
      expect(s.player.development!.rewardReceipts[`heritage:${second}:v1`]).toEqual({
        practice: 200,
        xp: 160,
        gold: 40,
      });
      expect(s.saves!.load()!.development!.heritage.weapon).toEqual(weapon);
      if (race === "android") expect(s.player.development!.unlockedModules).toContain("mn-cooling");
    },
  );
});
