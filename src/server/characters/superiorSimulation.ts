import type { TrialAttempt } from "../../game/development/trials/attempt";
import { createQuestTracker, createDefaultSaveV5 } from "../../game/quests/v2Tracker";
import type { PlayerSaveV5 } from "../../game/quests/types";
import type { ExamAttempt } from "../../game/development/exams";
import { isDeepStrictEqual } from "node:util";
import { monsterDef } from "../../game/monsters/catalog";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { GameSession, type Command, type Player, type StoragePort } from "../../game/session";
import { loadBrowserFeature } from "../../game/world/generated/browserLoader";
import {
  buildSuperiorSimulationWorld,
  type SuperiorSimulationSource,
} from "../../game/world/generated/simulationWorld";
import {
  FEATURE_IDS,
  SuperiorSaveStore,
  type SuperiorIndex,
  type FeatureId,
} from "../../game/world/generated/superiorSave";
import { streamSpawns, type AuthoredSpawn } from "../../game/world/generated/spawnStream";
import { applyCustomSpawnsForFeature } from "../../game/world/adminWorldStore";
import { v2Places } from "../../game/worlds/v2Places";
import { RACES } from "../../game/world/races";
import type { CharacterRecord, CharacterState } from "./repository";
import { onlineCommand } from "./commands";
import { captureCombat, restoreCombat } from "./transient";
import { repairPlayerForLoad } from "./playerRepair";

/** Filesystem fetcher for the SAME verified manifests/navigation as the browser. Never fetch
 * a URL supplied by a player and never select world v1 through a Node/window fallback. */
export function worldFileFetcher(publicRoot: string): typeof fetch {
  const root = path.resolve(publicRoot);
  return (async (input: string | URL | Request) => {
    const resource =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.pathname
          : new URL(input.url).pathname;
    if (
      !/^\/game\/worlds\/superior-v2\/[a-zA-Z0-9/_-]+\.json$/.test(resource) ||
      resource.includes("..")
    )
      throw Error("Unsafe server world path");
    const file = path.resolve(root, "." + resource);
    if (!file.startsWith(root + path.sep)) throw Error("Unsafe server world path");
    return new Response(await readFile(file, "utf8"), {
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
}

/** A server-owned in-memory simulation. Checkpoints still need the repository transaction
 * and an exclusive lease before this adapter may be exposed over the online protocol. */
export async function prepareServerSimulation(record: CharacterRecord, publicRoot: string) {
  const fetcher = worldFileFetcher(publicRoot);
  const basePath = "/game/worlds/superior-v2";
  const index = (await (await fetcher(basePath + "/index.json")).json()) as SuperiorIndex;
  if (
    index.format !== "superior-runtime-1" ||
    index.features.length !== 10 ||
    new Set(index.features.map((f) => f.id)).size !== 10
  )
    throw Error("Invalid server world index");
  let feature = record.state.runtime["feature"] ?? RACES[record.state.player.race].world;
  if (typeof feature !== "string" || !FEATURE_IDS.includes(feature as FeatureId))
    throw Error("Invalid saved feature");
  let info = index.features.find((f) => f.id === feature);
  if (!info) throw Error("Unknown saved feature");
  // An administrator teleport can move the stored player to another continent while the saved
  // feature (and its checkpoint) still name the old one; the stored player decides where it opens.
  const continentChanged = info.affinity !== record.state.player.continent;
  if (continentChanged) {
    const home = index.features.find((f) => f.id === record.state.player.continent);
    if (!home || home.affinity !== record.state.player.continent)
      throw Error("Unknown continent of the stored player");
    console.warn("[Online] Postać przeniesiona przez administratora na inny kontynent:", record.id);
    feature = home.id;
    info = home;
  }
  const loader = await loadBrowserFeature(basePath, feature, { fetcher });
  const source = loader.definition as unknown as SuperiorSimulationSource;
  if (
    loader.worldSha256 !== info.worldSha256 ||
    source.affinity !== info.affinity ||
    source.geometry.width !== info.width ||
    source.geometry.height !== info.height
  )
    throw Error("Server world/index mismatch");
  const data = new Map<string, string>();
  const port: StoragePort = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
  let envelope = record.state.runtime["superior"];
  // An administrator edit used to change only the stored player and leave the checkpoint copy
  // behind. The stored player is the authoritative one: adopt it into the checkpoint (it still has
  // to pass the full checkpoint validation below) instead of locking the character out.
  let healed = false;
  if (
    envelope !== undefined &&
    typeof envelope === "object" &&
    envelope !== null &&
    !Array.isArray(envelope) &&
    !isDeepStrictEqual(envelope["player"], record.state.player)
  ) {
    console.warn("[Online] Punkt zapisu różnił się od postaci; przyjęto postać z bazy:", record.id);
    envelope = {
      ...envelope,
      player: JSON.parse(JSON.stringify(record.state.player)) as typeof envelope,
    };
    healed = true;
  }
  // Edits made in the admin panel are brought back inside the checkpoint invariants (experience below
  // the next level, owned equipment, finished quest prerequisites, position inside the world).
  const stored: Player = JSON.parse(JSON.stringify(record.state.player)) as Player;
  const checkpointTown =
    envelope !== undefined &&
    typeof envelope === "object" &&
    envelope !== null &&
    !Array.isArray(envelope) &&
    !continentChanged &&
    typeof envelope["town"] === "string"
      ? envelope["town"]
      : null;
  const repaired = repairPlayerForLoad(stored, info, { town: checkpointTown });
  // A teleport to a spot nobody can stand on would crash the session constructor.
  if (!stored.interior && !loader.navigation.walkable(stored)) {
    Object.assign(stored, loader.navigation.safe(info.arrival));
    repaired.push("position");
  }
  if (repaired.length)
    console.warn("[Online] Naprawiono pola postaci po edycji:", record.id, repaired.join(", "));
  if (
    envelope !== undefined &&
    typeof envelope === "object" &&
    envelope !== null &&
    !Array.isArray(envelope) &&
    (repaired.length || continentChanged)
  ) {
    envelope = {
      ...envelope,
      feature: info.id,
      ...(continentChanged ? { town: null } : {}),
      player: stored as unknown as typeof envelope,
    };
    healed = true;
  }
  if (envelope !== undefined) data.set(record.id, JSON.stringify(envelope));
  const save = new SuperiorSaveStore(port, record.id, index, info.id);
  let restored = save.load();
  if (envelope !== undefined && !restored)
    throw Error("Invalid server checkpoint: " + save.warning);
  if (
    !healed &&
    restored &&
    !isDeepStrictEqual((envelope as { player: unknown }).player, record.state.player)
  )
    throw Error("Checkpoint/player mismatch");
  const initial: Player = restored ?? {
    ...structuredClone(stored),
    ...loader.navigation.safe(info.arrival),
  };
  const built = buildSuperiorSimulationWorld({
    source,
    info,
    navigation: loader.navigation,
    restored: initial,
    town: save.town,
    basePath,
    places: v2Places(info.affinity),
  });
  save.town = built.initialTown;
  if (!restored) {
    if (!save.save(initial)) throw Error("Cannot initialize server checkpoint");
    // The store has already loaded; the production session receives that same initial player.
    restored = initial;
  }
  const loadedStore = new SuperiorSaveStore(port, record.id, index, info.id);
  const session = new GameSession(loadedStore, initial.race, {
    world: built.world,
    navigation: loader.navigation,
    enemyNavigation: loader.enemyNavigation(built.world.safeAreas ?? []),
    featureId: info.id,
    heritageHome: built.heritageHome,
    enemyPositionAllowed: built.outsideCities,
    maximumActiveEnemies: 24,
  });
  const raw = (await loader.loadSpawns()) as { feature: string; overworld: AuthoredSpawn[] };
  if (
    raw.feature !== info.id ||
    !Array.isArray(raw.overworld) ||
    raw.overworld.length > 10000 ||
    new Set(raw.overworld.map((s) => s.id)).size !== raw.overworld.length
  )
    throw Error("Invalid server spawns");
  for (const slot of raw.overworld)
    if (
      !slot.id.startsWith(info.id + "-") ||
      !built.outsideCities(slot) ||
      !loader.navigation.walkable(slot) ||
      !Number.isFinite(slot.respawnMs) ||
      slot.respawnMs < 1000
    )
      throw Error("Invalid server spawn");
  // Spawns published from /admin (moved, added, removed); unplaceable ones are skipped.
  raw.overworld = applyCustomSpawnsForFeature(info.id, raw.overworld).filter(
    (slot) =>
      slot.id.startsWith(info.id + "-") &&
      built.outsideCities(slot) &&
      loader.navigation.walkable(slot),
  );
  built.world.huntKinds = [
    ...new Set(raw.overworld.filter((s) => monsterDef(s.kind).level <= 4).map((s) => s.kind)),
  ];
  const restoredClock = record.state.runtime["simulationMs"];
  if (
    restoredClock !== undefined &&
    (typeof restoredClock !== "number" || !Number.isFinite(restoredClock) || restoredClock < 0)
  )
    throw Error("Invalid server clock");
  let now = typeof restoredClock === "number" ? restoredClock : 0;
  session.nowMs = now;
  restoreCombat(session, record.state.runtime["combat"]);
  if (envelope !== undefined && !record.state.player.dead && record.state.player.hp > 0) {
    session.player.hp = Math.min(record.state.player.hp, session.kit.stats.maxHp);
    session.player.ki = Math.min(record.state.player.ki, session.kit.stats.maxKi);
  }
  const quests = createQuestTracker(
    () =>
      (record.state.runtime["quests"] as unknown as PlayerSaveV5 | undefined) ??
      createDefaultSaveV5(info.affinity),
    () => {},
  );
  quests.onReward((reward) =>
    session.grantQuestReward(
      { xp: reward.xp, gold: reward.gold, items: reward.items as Record<string, number> },
      "przygoda Argona",
    ),
  );
  quests.enterTown(info.affinity, loadedStore.town ?? "");
  let previousDialogue: string | null = null;
  const deaths = new WeakSet<object>();
  const stream = streamSpawns(
    session,
    loadedStore,
    raw.overworld,
    { acquire: async () => {}, release: () => {} },
    () => now,
  );
  loadedStore.beforeSave = stream.capture;
  let exam: ExamAttempt | undefined;
  let trial: TrialAttempt | undefined;
  return {
    session,
    get activeSession() {
      return trial?.session ?? exam?.session ?? session;
    },
    get trial() {
      return trial;
    },
    get exam() {
      return exam;
    },
    feature: info.id,
    async tick(dt: number) {
      if (!Number.isFinite(dt) || dt < 0 || dt > 1000) throw Error("Invalid server tick");
      if (trial) {
        if (trial.started) {
          trial.session.tick(dt);
          trial.update();
        }
        return;
      }
      if (exam) {
        exam.session.tick(dt);
        exam.update();
        return;
      }
      now += dt;
      stream.update();
      await Promise.resolve();
      await Promise.resolve();
      session.tick(dt);
      if (!session.player.interior) quests.near(info.affinity, session.player.x, session.player.y);
      quests.level(session.player.level);
      if (session.dialogue && session.dialogue !== previousDialogue)
        quests.talk(info.affinity, loadedStore.town ?? "", session.dialogue);
      previousDialogue = session.dialogue ?? null;
      for (const event of session.events) {
        if (event.type !== "death" || event.target === "player" || deaths.has(event)) continue;
        deaths.add(event);
        const kind = session.enemies.find((e) => e.id === event.target)?.kind;
        if (kind && !session.enemies.find((e) => e.id === event.target)?.encounterOwner)
          quests.defeated(kind);
      }
      const town = source.settlements.find(
        (t) =>
          built.cities.has(t.id) &&
          session.player.x >= t.bounds.x &&
          session.player.x <= t.bounds.x + t.bounds.width &&
          session.player.y >= t.bounds.y &&
          session.player.y <= t.bounds.y + t.bounds.height,
      );
      if (town && !session.player.interior) {
        const city = built.cities.get(town.id)!;
        if (loadedStore.town !== town.id) quests.enterTown(info.affinity, town.id);
        loadedStore.town = town.id;
        built.world.city = city.city;
        built.world.npcs = city.npcs;
        built.world.market = city.market;
      }
    },
    command(command: unknown) {
      const input = onlineCommand(command, !!session.staff);
      if (input.type === "trial-start") {
        if (!exam && !trial) trial = session.startRacialTrial(input.id, input.tier);
        if (trial) session.command({ type: "pause", value: true });
      } else if (input.type === "trial-action") {
        if (!trial || input.instanceId !== trial.instanceId) return;
        if (input.action === "ready") trial.begin(input.suspended ?? false);
        if (input.action === "suspend") trial.suspend(true);
        if (input.action === "resume") trial.suspend(false);
        if (input.action === "inspect") trial.inspect();
        if (input.action === "close") trial.closeReading();
        if (input.action === "retry") trial = session.retryRacialTrial(trial) ?? trial;
        if (input.action === "accept" && session.finishRacialTrial(trial)) trial = undefined;
        if (input.action === "leave" && trial) {
          session.leaveRacialTrial(trial);
          trial = undefined;
        }
        if (!trial) session.command({ type: "pause", value: false });
      } else if (input.type === "trial-answer") {
        if (trial && input.instanceId === trial.instanceId)
          trial.answer(input.round, input.answerId, input.modules);
      } else if (input.type === "trial-input") {
        if (trial?.started && input.instanceId === trial.instanceId)
          trial.session.command(input.command as Command);
      } else if (trial) return;
      else if (input.type === "exam-start") {
        if (!exam)
          exam = session.startDevelopmentExam(input.discipline, input.tier, input.rehearsal);
        if (exam) session.command({ type: "pause", value: true });
      } else if (input.type === "exam-action") {
        if (!exam) return;
        if (input.action === "charge") exam.chargeNode();
        if (input.action === "retry") exam = session.retryDevelopmentExam(exam) ?? exam;
        if (input.action === "accept" && session.finishDevelopmentExam(exam)) exam = undefined;
        if (input.action === "leave" && exam) {
          session.leaveDevelopmentExam(exam);
          exam = undefined;
        }
        if (!exam) session.command({ type: "pause", value: false });
      } else if (input.type === "exam-input") {
        exam?.session.command(input.command as Command);
      } else if (exam) return;
      else if (input.type === "quest-start") quests.start(input.id);
      else if (input.type !== "travel" && input.type !== "staff-travel")
        session.command(input as Command);
    },
    async travel(destination: FeatureId, staff = false, point?: { x: number; y: number }) {
      const next = index.features.find((f) => f.id === destination);
      if (
        exam ||
        trial ||
        !next ||
        next.id === info.id ||
        session.player.interior ||
        session.player.dead ||
        (!staff &&
          (session.dialogue ||
            Math.hypot(session.player.x - info.arrival.x, session.player.y - info.arrival.y) >=
              320)) ||
        (staff && !session.staff)
      )
        throw Error("TRAVEL_UNAVAILABLE");
      if (
        point &&
        !(await loadBrowserFeature(basePath, destination, { fetcher })).navigation.walkable(point)
      )
        throw Error("INVALID_DESTINATION");
      session.command({ type: "cancel" });
      if (!loadedStore.travel(session.player, next, point)) throw Error("TRAVEL_FAILED");
      const superior = JSON.parse(data.get(record.id)!);
      return {
        format: "server-character-1" as const,
        player: superior.player,
        runtime: {
          feature: next.id,
          simulationMs: now,
          combat: captureCombat(session),
          superior,
          quests: JSON.parse(JSON.stringify(quests.save)),
        },
      };
    },
    capture(): CharacterState {
      if (!loadedStore.save(session.player)) throw Error("Cannot capture server simulation");
      return {
        format: "server-character-1",
        player: structuredClone(session.player),
        runtime: {
          feature: info.id,
          simulationMs: now,
          quests: JSON.parse(JSON.stringify(quests.save)),
          combat: captureCombat(session),
          superior: JSON.parse(data.get(record.id)!),
        },
      };
    },
    dispose() {
      if (trial) session.leaveRacialTrial(trial);
      if (exam) session.leaveDevelopmentExam(exam);
      stream.dispose();
      session.heritage.cancelActivities();
    },
  };
}
