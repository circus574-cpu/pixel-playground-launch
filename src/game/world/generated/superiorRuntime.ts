import { islandArtEnabled, islandFeatureArt, islandObjects } from "./islandArt";
import { dressEnabled, townDress } from "./worldDress";
import {
  aetheriaContinentEnabled,
  aetheriaObjects,
  aetheriaTerrainBindings,
  aetheriaBiomeAt,
} from "./aetheriaContinent";
import { pyraContinentEnabled, pyraObjects, pyraTerrainBindings } from "./pyraContinent";
import {
  nexusContinentEnabled,
  nexusObjects,
  nexusTerrainBindings,
  nexusBiomeAt,
} from "./nexusContinent";
import {
  buildSuperiorSimulationWorld,
  type SuperiorSimulationSource as Source,
} from "./simulationWorld";
import { STREAM_TEXTURE_BUDGET_BYTES, streamTextureBytes } from "../../assets/streamBudget";
import { chooseGroundResolution, groundTextureBytes } from "../../assets/groundBudget";
import {
  verdantiaContinentEnabled,
  continentObjects,
  continentTerrainBindings,
} from "./verdantiaContinent";
import type Phaser from "phaser";
import type { OnlineClient } from "../../online/client";
import { GameSession, type StoragePort } from "../../session";
import type { GameRuntime } from "../../mountGame";
import {
  actorVisual,
  catalog,
  textureBinding,
  monsterVisual,
  technicalPack,
} from "../../assets/catalog";
import { queueAssets, prepareTextures, animationKey } from "../../assets/phaserAssets";
import { monsterDef } from "../../monsters/catalog";
import { MONSTER_BASE } from "../../monsters/base.generated";

import { streamSpawns, type AuthoredSpawn } from "./spawnStream";
import {
  emptyAdminWorldOverrides,
  applyAdminWorldOverridesToRuntime,
  applyCustomSpawnsForFeature,
  countActiveOverrides,
  readAdminWorldOverrides,
} from "../adminWorldStore";
import { fetchPublishedWorld } from "../worldOverridesClient";
import { RACES, type RaceId } from "../races";
import { WORLDS } from "../worlds";
import type { CityDefinition, BuildingId } from "../../city/types";
import type { WorldDefinition, WorldNpc } from "../types";
import type { Point } from "../../navigation";
import type { Obstacle } from "../../movement";
import type { GameLoadingState } from "../../loading";
import { loadBrowserFeature } from "./browserLoader";
import { renderSuperior, type ArtObject, type FeatureArt } from "./renderSuperior";
import { arenaClearingEnabled, buildArenaIndex, clearsArena } from "../combatArena";
import { monsterFramePx, monsterSizesEnabled, type SizeClass } from "../../monsters/visualSize";
import { WORLD_BASE, WORLD_V2 } from "./worldVersion";
import { v2Places } from "../../worlds/v2Places";
import { questsV2 } from "../../quests/v2Tracker";
import { FEATURE_IDS, SuperiorSaveStore, type SuperiorIndex, type FeatureId } from "./superiorSave";

/** Drawn side of a creature per bestiary size class (world v2). */
const MONSTER_SIZE_PX: Record<string, number> = { S: 74, M: 96, L: 118 };

const BASE = WORLD_BASE;
const inside = (p: Point, b: Obstacle) =>
  p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;
const bytesHash = async (bytes: ArrayBuffer) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

export type SuperiorRuntime = GameRuntime & {
  index: SuperiorIndex;
  feature: FeatureId;
  featureName: string;
  canTravel: () => boolean;
  /** `staff`: a special character travels from anywhere outdoors, not only from the harbour. */
  travel: (destination: FeatureId, staff?: boolean) => boolean;
  save: SuperiorSaveStore;
  staffTeleport: (destination: FeatureId, point: Point, signal?: AbortSignal) => Promise<boolean>;
};

export async function prepareSuperior(options: {
  race: RaceId;
  online?: OnlineClient;
  storage?: StoragePort;
  saveKey: string;
  signal: AbortSignal;
  onLoading: (state: GameLoadingState) => void;
}): Promise<SuperiorRuntime> {
  const BASE = options.online ? "/game/worlds/superior-v2" : WORLD_BASE;
  const abort = new AbortController();
  options.signal.addEventListener("abort", () => abort.abort(), { once: true });
  const fetchJson = async <T>(path: string): Promise<T> => {
    const response = await fetch(BASE + "/" + path, { signal: abort.signal });
    if (!response.ok) throw Error("Nie można pobrać świata: " + response.status);
    return (await response.json()) as T;
  };
  options.onLoading({ phase: "preparing", message: "Otwieranie świata Superior…", progress: null });
  // Online: the world published on the server (the same edits the server simulates).
  // Local play: the editor's draft in this browser.
  const adminOverrides = options.online
    ? await fetchPublishedWorld(abort.signal)
        .then((w) => w.data)
        .catch(() => emptyAdminWorldOverrides())
    : readAdminWorldOverrides();
  if (options.online || countActiveOverrides(adminOverrides) > 0)
    applyAdminWorldOverridesToRuntime(adminOverrides);
  const index = await fetchJson<SuperiorIndex>("index.json");
  if (
    index.format !== "superior-runtime-1" ||
    index.features.length !== 10 ||
    new Set(index.features.map((f) => f.id)).size !== 10 ||
    index.features.some((f) => !FEATURE_IDS.includes(f.id))
  )
    throw Error("Nieobsługiwana wersja świata");
  let storage: StoragePort | null = options.storage ?? null;
  try {
    if (!options.online) storage = window.localStorage;
  } catch {
    /* The dedicated save reports unavailable storage. */
  }
  const save = new SuperiorSaveStore(storage, options.saveKey, index, RACES[options.race].world);
  const restored = save.load();
  const info = index.features.find((f) => f.id === save.feature)!;
  const loader = await loadBrowserFeature(BASE, save.feature, { signal: abort.signal });
  const source = loader.definition as unknown as Source;
  const artManifest = await fetchJson<Record<string, string>>("art/manifest.json");
  const artResponse = await fetch(BASE + "/art/" + save.feature + "/feature.art.json", {
    signal: abort.signal,
  });
  if (!artResponse.ok) throw Error("Nie można pobrać oprawy lądu");
  const artBytes = await artResponse.arrayBuffer();
  if ((await bytesHash(artBytes)) !== artManifest[save.feature + "/feature.art.json"])
    throw Error("Błędna suma oprawy lądu");
  const art = islandFeatureArt(
    info.id,
    JSON.parse(new TextDecoder().decode(artBytes)) as FeatureArt,
  );
  // Island settlements carry no authored city scenery at all (`acceptedCityScenery = 0`), so the
  // first frame of every island is bare paving. Dress it with the island's own motifs; nothing
  // here is solid and nothing has a footprint, so town collision stays exactly as authored.
  if (dressEnabled() && islandArtEnabled(info.id))
    art.acceptedCityScenery = [
      ...(art.acceptedCityScenery ?? []),
      ...townDress(
        info.id,
        source.settlements,
        [...art.buildings, ...art.acceptedCityBuildings],
        source.roads,
      ),
    ];
  // KI crystal nodes were bound to the Nexus machine crystal on every land. Outside Nexus they
  // show a natural crystal cluster; the node itself (position, kind) is unchanged.
  if (info.id !== "nexus")
    for (const r of art.resources)
      if (r.binding === "object.crystal") r.binding = "object.dungeon-kit.glowing-crystal-cluster";
  if (
    loader.worldSha256 !== info.worldSha256 ||
    source.geometry.width !== info.width ||
    source.geometry.height !== info.height ||
    source.feature !== info.id ||
    source.affinity !== info.affinity ||
    !Array.isArray(source.settlements) ||
    !source.settlements.length
  )
    throw Error("Nieprawidłowy ląd");
  // World v2 towns carry Argon's city names; famous locations become map landmarks.
  const places = WORLD_V2 ? v2Places(info.affinity) : undefined;
  if (places)
    for (const town of source.settlements) town.name = places.townNames[town.id] ?? town.name;
  const { base, world, cities, initialTown, heritageHome, outsideCities, shift } =
    buildSuperiorSimulationWorld({
      source,
      info,
      navigation: loader.navigation,
      restored,
      town: save.town,
      basePath: BASE,
      places,
    });
  save.town = initialTown;
  const session = new GameSession(save, options.race, {
    world,
    featureId: info.id,
    heritageHome,
    navigation: loader.navigation,
    enemyNavigation: loader.enemyNavigation(world.safeAreas ?? []),
    maximumActiveEnemies: 24,
    enemyPositionAllowed: outsideCities,
  });
  const rawSpawnData = (await loader.loadSpawns()) as {
    feature: string;
    overworld: AuthoredSpawn[];
  };
  const spawnData = {
    feature: rawSpawnData.feature,
    overworld: Object.values(adminOverrides.customSpawns).some((s) => s.feature === info.id)
      ? applyCustomSpawnsForFeature(info.id, rawSpawnData.overworld ?? [], adminOverrides).filter(
          (s) => outsideCities(s) && loader.navigation.walkable(s),
        )
      : rawSpawnData.overworld,
  };
  if (
    spawnData.feature !== info.id ||
    !Array.isArray(spawnData.overworld) ||
    spawnData.overworld.length > 10000 ||
    new Set(spawnData.overworld.map((s) => s.id)).size !== spawnData.overworld.length ||
    spawnData.overworld.some(
      (s) =>
        !s.id.startsWith(info.id + "-") ||
        !outsideCities(s) ||
        !loader.navigation.walkable(s) ||
        !Number.isFinite(s.respawnMs) ||
        s.respawnMs < 1000,
    )
  )
    throw Error("Nieprawidłowe spawny");
  // Playtest only (temporary QA aid): `?ki-test-spawn=<kind>` places one known creature just
  // outside the starting town, so browser tests need not walk deep into the wild. The published
  // game never reads it, and the authored spawn data stays unchanged.
  const testKind =
    location.pathname === "/scripts/playtest.html"
      ? new URLSearchParams(location.search).get("ki-test-spawn")
      : null;
  if (testKind) {
    // Nearest open ground beyond the town border, straight out from where the hero starts.
    const from = world.spawn;
    const gate = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]
      .map(([dx, dy]) => {
        let d = 0;
        while (d < 6000 && !outsideCities({ x: from.x + dx! * d, y: from.y + dy! * d })) d += 64;
        return loader.navigation.safe({ x: from.x + dx! * (d + 220), y: from.y + dy! * (d + 220) });
      })
      .filter((p) => outsideCities(p) && loader.navigation.walkable(p))
      .sort(
        (a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y),
      )[0];
    if (!gate) throw Error("Brak miejsca na potwora testowego");
    monsterDef(testKind); // Unknown kinds fail here, as authored ones would.
    spawnData.overworld.push({
      id: info.id + "-test-spawn",
      kind: testKind,
      ...gate,
      homeLeash: 300,
      respawnMs: 60000,
    });
  }
  world.huntKinds = [
    ...new Set(spawnData.overworld.filter((s) => monsterDef(s.kind).level <= 4).map((s) => s.kind)),
  ];
  for (const city of cities.values())
    for (const npc of city.npcs)
      if (npc.id === "hunter")
        npc.dialogue =
          "Poza osadą pokonaj trzech przeciwników pierwszych poziomów i wróć po nagrodę. Miasta pozostają bezpieczne.";
  // The session consumes the same initial snapshot; never rebase a writer on another tab mid-load.
  save.town = initialTown;
  if (WORLD_V2 && !options.online) questsV2.enterTown(info.affinity, initialTown);
  const stopRewards =
    WORLD_V2 && !options.online
      ? questsV2.onReward((reward) =>
          session.grantQuestReward(
            { xp: reward.xp, gold: reward.gold, items: reward.items as Record<string, number> },
            "przygoda Argona",
          ),
        )
      : () => false;
  const initialAssets = new Map<string, import("../../assets/schema").AssetDefinition>();
  // Diagnostic art is available only on the isolated local playtest document (as in mountGame).
  const preview =
    location.pathname === "/scripts/playtest.html" &&
    new URLSearchParams(location.search).get("ki-art") === "technical";
  const addAsset = (id: string) => {
    const asset =
      catalog.assets.get(id) ??
      (preview ? technicalPack.assets.find((a) => a.id === id) : undefined);
    if (!asset) throw Error("Brak zasobu: " + id);
    initialAssets.set(id, asset);
  };
  addAsset("ui-icons");
  for (const visual of [
    actorVisual(RACES[session.player.race].world, "hero", undefined, preview),
    ...base.npcs.map((n) => actorVisual(info.affinity, "npc", n.id)),
  ])
    for (const clip of Object.values(visual.clips)) addAsset(clip.asset);
  for (const [key, effect] of Object.entries(catalog.effects))
    if (!key.includes(".") || key.startsWith(info.affinity + ".")) addAsset(effect.asset);
  const shield = catalog.renderBindings["effect.shield"];
  if (shield) addAsset(shield.asset);
  for (const kind of ["floor", "stone"])
    addAsset(
      textureBinding(
        "terrain." + info.affinity + ".interior-" + kind,
        textureBinding("terrain.city-" + kind, { asset: "city-floor" }),
      ).asset,
    );
  const interiorBindings: Record<string, import("../../assets/schema").TextureRef> = {};
  const parts: Record<string, string> = {
    chest: "locked-chest",
    bed: "bed-with-blankets",
    shelf: "tall-bookshelf",
    desk: "counter-with-a-shelf",
  };
  for (const key of ["chest", "bed", "shelf", "desk", "anvil", "dummy"]) {
    const ref =
      catalog.renderBindings["object.interior-" + info.affinity + "." + parts[key]] ??
      textureBinding(
        "object." + info.affinity + ".interior." + key,
        textureBinding("object.city." + key, { asset: "city-props", frame: 0 }),
      );
    interiorBindings[key] = ref;
    addAsset(ref.asset);
  }
  const protectedAssets = new Set(initialAssets.keys());
  // On by default (`?ki-clear-arenas=0` opts out): decoration only, collision never reads art objects.
  const arenaIndex = arenaClearingEnabled(location.search)
    ? buildArenaIndex(spawnData.overworld)
    : null;
  const artCache = new Map<string, ArtObject[]>();
  const artRequests = new Map<string, Promise<ArtObject[]>>();
  const readArt = async (x: number, y: number) => {
    const id = x + "-" + y,
      cached = artCache.get(id);
    if (cached) {
      artCache.delete(id);
      artCache.set(id, cached);
      return cached;
    }
    if (artRequests.has(id)) return artRequests.get(id)!;
    const promise = (async () => {
      const path = info.id + "/chunks/" + id + ".art.json";
      const response = await fetch(BASE + "/art/" + path, { signal: abort.signal });
      if (!response.ok) throw Error("Nie można pobrać dekoracji");
      const buffer = await response.arrayBuffer();
      const text = new TextDecoder().decode(buffer).replace(/\r\n/g, "\n");
      if (
        (await bytesHash(buffer)) !== artManifest[path] &&
        (await bytesHash(new TextEncoder().encode(text).buffer)) !== artManifest[path]
      )
        throw Error("Błędna suma dekoracji");
      const value = JSON.parse(text) as { format: string; objects: ArtObject[] };
      if (value.format !== "superior-art-overlay-1" || !Array.isArray(value.objects))
        throw Error("Błędne dekoracje");
      value.objects = islandObjects(info.id, value.objects);
      // The generator scattered Nexus machine crystals through Verdantia's forests as decoration;
      // show a mossy forest boulder there instead. Positions and collision stay as authored.
      if (info.id === "verdant")
        for (const o of value.objects)
          if (o.binding === "object.crystal") o.binding = "object.biome-forest.mossy-boulder";
      if (verdantiaContinentEnabled(info.id))
        value.objects = continentObjects(value.objects, outsideCities, source.roads);
      if (pyraContinentEnabled(info.id))
        value.objects = pyraObjects(value.objects, outsideCities, source.roads);
      if (aetheriaContinentEnabled(info.id)) {
        const chunk = await loader.loadChunk(x, y);
        value.objects = aetheriaObjects(
          value.objects,
          outsideCities,
          source.roads,
          aetheriaBiomeAt(chunk),
        );
      }
      if (nexusContinentEnabled(info.id)) {
        const chunk = await loader.loadChunk(x, y);
        value.objects = nexusObjects(
          value.objects,
          outsideCities,
          source.roads,
          nexusBiomeAt(chunk),
        );
      }
      const objects = arenaIndex
        ? value.objects.filter((o) => !clearsArena(arenaIndex, o))
        : value.objects;
      artCache.set(id, objects);
      if (artCache.size > 12) artCache.delete(artCache.keys().next().value!);
      return objects;
    })();
    artRequests.set(id, promise);
    try {
      return await promise;
    } finally {
      artRequests.delete(id);
    }
  };
  // Warm the starting neighbourhood before Phaser's genuine asset-loading progress begins.
  const cx = Math.floor(session.player.x / 2048),
    cy = Math.floor(session.player.y / 2048);
  const warm: Promise<void>[] = [];
  const addBinding = (key: string) => {
    const binding = catalog.renderBindings[key],
      asset = binding && catalog.assets.get(binding.asset);
    if (!asset) throw Error("Brak zasobu świata: " + key);
    initialAssets.set(asset.id, asset);
  };
  for (const key of [...art.groundByBiome, art.water, art.road, art.plaza])
    if (key) addBinding(key);
  if (verdantiaContinentEnabled(info.id))
    for (const key of continentTerrainBindings) addBinding(key);
  if (pyraContinentEnabled(info.id)) for (const key of pyraTerrainBindings) addBinding(key);
  if (aetheriaContinentEnabled(info.id)) for (const key of aetheriaTerrainBindings) addBinding(key);
  if (nexusContinentEnabled(info.id)) for (const key of nexusTerrainBindings) addBinding(key);
  for (const obj of [
    ...art.buildings,
    ...art.acceptedCityBuildings,
    ...(art.acceptedCityScenery ?? []),
    ...(art.landmarks ?? []),
    ...art.resources,
    ...art.dungeonEntrances,
  ])
    if (Math.abs(obj.x - session.player.x) < 2048 && Math.abs(obj.y - session.player.y) < 2048)
      addBinding(obj.binding);
  for (let y = Math.max(0, cy - 1); y <= Math.min(Math.ceil(info.height / 2048) - 1, cy + 1); y++)
    for (let x = Math.max(0, cx - 1); x <= Math.min(Math.ceil(info.width / 2048) - 1, cx + 1); x++)
      warm.push(
        Promise.all([loader.loadChunk(x, y), readArt(x, y)]).then(([, objects]) => {
          for (const obj of objects) addBinding(obj.binding);
        }),
      );
  await Promise.all(warm);
  const owned = new Set([...initialAssets.keys()].filter((id) => !protectedAssets.has(id)));
  const owners = new Map<string, Set<string>>(),
    requests = new Map<string, Promise<void>>();
  const countedDeaths = new WeakSet<object>();
  let lastDialogue: string | null = null;
  let disposed = false,
    failed = false;
  const error = () => {
    if (disposed || failed) return;
    failed = true;
    session.paused = true;
    options.onLoading({
      phase: "error",
      message: "Nie udało się wczytać fragmentu świata. Postęp pozostaje zachowany; ponów próbę.",
      progress: null,
    });
  };
  const acquire = async (scene: Phaser.Scene, ids: Set<string>, owner: string) => {
    owners.set(owner, ids);
    await Promise.all(
      [...ids].map((id) => {
        if (scene.textures.exists(id)) return Promise.resolve();
        if (requests.has(id)) return requests.get(id)!;
        const promise = new Promise<void>((resolve, reject) => {
          const asset = catalog.assets.get(id);
          if (!asset) {
            reject(Error("Unknown world texture"));
            return;
          }
          const done = () => {
            cleanup();
            try {
              prepareTextures(scene, [asset]);
              resolve();
            } catch (cause) {
              reject(cause);
            }
          };
          const bad = (file: Phaser.Loader.File) => {
            if (file.key === id) {
              cleanup();
              reject(Error("World texture unavailable"));
            }
          };
          const cleanup = () => {
            scene.load.off("complete", done);
            scene.load.off("loaderror", bad);
          };
          scene.load.once("complete", done);
          scene.load.on("loaderror", bad);
          owned.add(id);
          queueAssets(scene, [asset]);
          if (!scene.load.isLoading()) scene.load.start();
        });
        requests.set(id, promise);
        return promise;
      }),
    );
  };
  const release = (scene: Phaser.Scene, owner: string) => {
    const ids = owners.get(owner);
    owners.delete(owner);
    const candidates = owners.size > 0 ? new Set([...(ids ?? []), ...owned]) : (ids ?? []);
    for (const id of candidates)
      if (owned.has(id) && ![...owners.values()].some((keys) => keys.has(id))) {
        if (scene.textures.exists(id)) {
          for (const visual of catalog.actors.values())
            for (const [state, clip] of Object.entries(visual.clips))
              if (clip.asset === id)
                for (const direction of Object.keys(clip.directions))
                  scene.anims.remove(animationKey(visual, state, direction));
          scene.textures.remove(id);
        }
        owned.delete(id);
        requests.delete(id);
      }
  };
  let activeScene: Phaser.Scene | undefined;
  // World v2 draws each creature at its bestiary size class (S/M/L = 0.62/0.8/0.98, an M creature
  // is as tall as the hero); presentation only — reach and collision stay in the monster rules.
  // Body-measured sizes (default on, `?ki-monster-sizes=0` opts out): the old S/M/L frames made most creatures look alike.
  const sizesByBody = monsterSizesEnabled(location.search);
  const enemyVisual = (kind: string) => {
    const visual = monsterVisual(kind);
    if (kind.startsWith("boss:")) {
      return { ...visual, size: [180, 180] as [number, number] };
    }
    const size = MONSTER_BASE.find((b) => b.id === kind)?.size;
    if (!WORLD_V2 || !size) return visual;
    const measured = sizesByBody ? monsterFramePx(kind, size as SizeClass) : undefined;
    const side = measured ?? MONSTER_SIZE_PX[size] ?? visual.size[1];
    return { ...visual, size: [side, side] as [number, number] };
  };
  const monsterAssets = new Map<string, Set<string>>();
  const neededByMonster = (kind: string) => {
    if (monsterAssets.has(kind)) return monsterAssets.get(kind)!;
    const ids = new Set<string>(),
      seen = new Set<string>();
    const add = (next: string) => {
      if (seen.has(next)) return;
      seen.add(next);
      for (const clip of Object.values(enemyVisual(next).clips)) ids.add(clip.asset);
      for (const skill of monsterDef(next).skills) if (skill.summon) add(skill.summon.kind);
    };
    add(kind);
    monsterAssets.set(kind, ids);
    return ids;
  };
  const spawnStream = streamSpawns(session, save, spawnData.overworld, {
    canAcquire(slot) {
      // Audyt 11.11.2026: stała rezerwy nie pokrywała podłoża (12 × 1024² × 4 = 48 MiB, nie 20).
      // Liczymy podłoże jawnie, po rozdzielczości, którą renderer naprawdę dobierze do tych atlasów.
      const ids = new Set([...protectedAssets, ...owned, ...neededByMonster(slot.kind)]);
      for (const keys of owners.values()) for (const id of keys) ids.add(id);
      if (!activeScene) return false;
      const atlasBytes = streamTextureBytes(ids, catalog.assets);
      const ground = groundTextureBytes(chooseGroundResolution(atlasBytes, 1024));
      return atlasBytes + ground <= STREAM_TEXTURE_BUDGET_BYTES;
    },
    async acquire(slot) {
      if (!activeScene || disposed) throw Error("World is not mounted");
      const ids = neededByMonster(slot.kind);
      try {
        await acquire(activeScene, ids, "spawn:" + slot.id);
      } catch (cause) {
        error();
        throw cause;
      }
    },
    release(slot) {
      if (activeScene && !disposed) release(activeScene, "spawn:" + slot.id);
    },
  });
  save.beforeSave = spawnStream.capture;
  let stopOnline = () => {};
  if (options.online) {
    const client = options.online;
    let latest = client.frame!;
    const apply = (frame: typeof latest) => {
      latest = frame;
      if (frame.checkpoint.runtime["quests"])
        questsV2.mirror(
          frame.checkpoint.runtime[
            "quests"
          ] as unknown as import("../../quests/types").PlayerSaveV5,
          (id) => client.intent({ type: "quest-start", id }),
        );
      session.player = structuredClone(frame.view.player);
      const town = (frame.checkpoint.runtime["superior"] as { town?: string } | undefined)?.town;
      const current = town && cities.get(town);
      if (current) {
        world.city = current.city;
        world.npcs = current.npcs;
        world.market = current.market;
        world.settlement = current.city.name;
        save.town = town;
      }
      session.staff = frame.view.staff;
      session.autoAttack = frame.view.autoAttack;
      Object.assign(session.training, frame.view.training);
      session.facing = { ...frame.facing };
      session.moving = frame.moving;
      session.targetId = frame.targetId;
      session.nowMs = frame.nowMs;
      session.dialogue = frame.view.dialogue;
      session.depotOpen = frame.view.depotOpen;
      session.notice = frame.view.notice;
      session.noticeId = frame.view.noticeId;
      session.loot = structuredClone(frame.loot);
      session.events.push(...frame.events);
    };
    if (latest.checkpoint.runtime["quests"])
      questsV2.mirror(
        latest.checkpoint.runtime["quests"] as unknown as import("../../quests/types").PlayerSaveV5,
        (id) => client.intent({ type: "quest-start", id }),
      );
    apply(latest);
    stopOnline = client.subscribe(apply);
    session.tick = () => {};
    session.command = (command) => {
      if (command.type === "pause") {
        session.paused = command.value;
        if (command.value) {
          client.direction(0, 0);
          client.command({ type: "cancel" });
        }
        return;
      }
      client.command(command);
    };
    session.manual = (x, y) => client.direction(x, y);
    session.discardBufferedInput = () => {
      client.direction(0, 0);
      client.command({ type: "cancel" });
    };
    session.flush = () => {};
    session.snapshot = () => latest.view;
    session.kit.abilities = () => latest.view.abilities;
    Object.defineProperty(session.kit, "shieldPoints", { get: () => latest.view.shieldPoints });
  }
  const canTravel = () =>
    !session.player.interior &&
    !session.player.dead &&
    !session.dialogue &&
    Math.hypot(session.player.x - info.arrival.x, session.player.y - info.arrival.y) < 320;
  return {
    session,
    authoritative: !!options.online,
    ...(options.online
      ? {
          networkPlayers: () =>
            (options.online!.frame?.peers ?? []).filter((p) => {
              const visual = actorVisual(RACES[p.race].world, "hero");
              return (
                !!activeScene &&
                Object.values(visual.clips).every((clip) =>
                  activeScene!.textures.exists(clip.asset),
                )
              );
            }),
        }
      : {}),
    save,
    index,
    feature: info.id,
    featureName: info.name,
    assets: [...initialAssets.values()],
    canTravel,
    travel(destination, staff = false) {
      if (options.online) {
        if (!canTravel()) return false;
        options.online.intent({ type: "travel", destination });
        return false;
      }
      const next = index.features.find((f) => f.id === destination);
      const allowed = staff
        ? !!session.staff && !session.player.interior && !session.player.dead
        : canTravel();
      return !!next && destination !== info.id && allowed && save.travel(session.player, next);
    },
    async staffTeleport(destination, point, signal) {
      if (options.online) {
        if (destination === info.id)
          options.online.command({ type: "staff", action: "teleport", ...point });
        else options.online.intent({ type: "staff-travel", destination, point });
        return new Promise<boolean>((resolve) => {
          const stop = options.online!.subscribe((frame) => {
            if (
              frame.feature === destination &&
              Math.hypot(frame.view.x - point.x, frame.view.y - point.y) < 32
            ) {
              clearTimeout(timeout);
              stop();
              resolve(true);
            }
          });
          const timeout = setTimeout(() => {
            stop();
            resolve(false);
          }, 8000);
        });
      }
      if (
        signal?.aborted ||
        !session.staff ||
        session.player.interior ||
        session.player.dead ||
        disposed ||
        !Number.isFinite(point.x) ||
        !Number.isFinite(point.y)
      )
        return false;
      const next = index.features.find((f) => f.id === destination);
      if (!next) return false;
      try {
        const nav =
          destination === info.id
            ? loader.navigation
            : (await loadBrowserFeature(BASE, destination, { signal: abort.signal })).navigation;
        if (
          signal?.aborted ||
          disposed ||
          !session.staff ||
          session.player.interior ||
          session.player.dead ||
          !nav.walkable(point)
        )
          return false;
        if (destination === info.id) {
          session.command({ type: "staff", action: "teleport", ...point });
          session.flush();
          return true;
        }
        return save.travel(session.player, next, point);
      } catch {
        return false;
      }
    },
    enemyVisual,
    interiorBindings,
    render: (scene) => {
      activeScene = scene;
      return renderSuperior(scene, {
        loader,
        art,
        roads: source.roads,
        cityRoads: (source.acceptedSource?.city?.roads ?? []).map((r) => ({ ...r, ...shift(r) })),
        outsideCities,
        readArt,
        acquire,
        release,
        error,
        currentDoors: () => [...(world.city?.buildings ?? [])],
        residentAtlasBytes: () => {
          const ids = new Set([...protectedAssets, ...owned]);
          for (const keys of owners.values()) for (const id of keys) ids.add(id);
          return streamTextureBytes(ids, catalog.assets);
        },
      });
    },
    afterTick() {
      if (options.online) {
        if (activeScene) {
          const frame = options.online.frame!;
          const peers = frame.peers ?? [];
          const peerOwners = new Set(peers.map((p) => "peer:" + p.race));
          for (const owner of owners.keys())
            if (owner.startsWith("peer:") && !peerOwners.has(owner)) release(activeScene, owner);
          for (const race of new Set(peers.map((p) => p.race))) {
            const owner = "peer:" + race;
            if (!owners.has(owner)) {
              const ids = new Set(
                Object.values(actorVisual(RACES[race].world, "hero").clips).map(
                  (clip) => clip.asset,
                ),
              );
              void acquire(activeScene, ids, owner).catch(error);
            }
          }
          // Stream only nearby server-selected actors. Never instantiate a second spawn simulation.
          const ready = frame.enemies.filter((e) =>
            [...neededByMonster(e.kind)].every((id) => activeScene!.textures.exists(id)),
          );
          session.enemies.splice(0, session.enemies.length, ...structuredClone(ready));
          const liveOwners = new Set(frame.enemies.map((e) => "online:" + e.kind));
          for (const owner of owners.keys())
            if (owner.startsWith("online:") && !liveOwners.has(owner)) release(activeScene, owner);
          for (const kind of new Set(frame.enemies.map((e) => e.kind)))
            if (!owners.has("online:" + kind))
              void acquire(activeScene, neededByMonster(kind), "online:" + kind).catch(error);
        }
        return;
      }
      spawnStream.update();
      if (!WORLD_V2) return;
      const p = session.player;
      if (!p.interior) questsV2.near(info.affinity, p.x, p.y);
      questsV2.level(p.level);
      if (session.dialogue && session.dialogue !== lastDialogue)
        questsV2.talk(info.affinity, save.town ?? "", session.dialogue);
      lastDialogue = session.dialogue ?? null;
      for (const event of session.events) {
        if (event.type !== "death" || event.target === "player" || countedDeaths.has(event))
          continue;
        countedDeaths.add(event);
        const kind = session.enemies.find((e) => e.id === event.target)?.kind;
        if (kind) questsV2.defeated(kind);
      }
    },
    beforeTick() {
      if (options.online) return;
      if (session.player.interior || session.paused || session.dialogue) return;
      const town = source.settlements.find(
        (t) => cities.has(t.id) && inside(session.player, t.bounds),
      );
      if (town && town.id !== save.town) {
        session.command({ type: "cancel" });
        const next = cities.get(town.id)!;
        world.city = next.city;
        world.settlement = next.city.name;
        world.npcs = next.npcs;
        world.market = next.market;
        save.town = town.id;
        if (WORLD_V2 && !options.online) questsV2.enterTown(info.affinity, town.id);
      }
    },
    dispose() {
      stopOnline();
      if (options.online) questsV2.detach();
      stopRewards();
      spawnStream.dispose();
      disposed = true;
      abort.abort();
      artCache.clear();
      requests.clear();
    },
  };
}
