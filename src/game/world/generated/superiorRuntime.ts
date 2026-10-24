import type Phaser from "phaser";
import { GameSession } from "../../session";
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
import { streamSpawns, type AuthoredSpawn } from "./spawnStream";
import { RACES, type RaceId } from "../races";
import { WORLDS } from "../worlds";
import type { CityDefinition, BuildingId } from "../../city/types";
import type { WorldDefinition, WorldNpc } from "../types";
import type { Point } from "../../navigation";
import type { Obstacle } from "../../movement";
import type { GameLoadingState } from "../../loading";
import { loadBrowserFeature } from "./browserLoader";
import { renderSuperior, type ArtObject, type FeatureArt } from "./renderSuperior";
import { FEATURE_IDS, SuperiorSaveStore, type SuperiorIndex, type FeatureId } from "./superiorSave";

const BASE = "/game/worlds/superior-v1";
type Settlement = Point & { id: string; name: string; kind: string; bounds: Obstacle };
type Source = {
  feature: FeatureId;
  affinity: keyof typeof WORLDS;
  name: string;
  geometry: { width: number; height: number; anchor: Point };
  sourceOffset: Point | null;
  acceptedSource: WorldDefinition | null;
  settlements: Settlement[];
  roads: { points: [number, number][]; width: number; kind: string }[];
  buildings: {
    id: string;
    settlement: string;
    service: string;
    door: Point;
    footprint: Obstacle;
  }[];
};
const names: Record<BuildingId, string> = {
  shop: "Sklep",
  hall: "Dom zgromadzeń",
  inn: "Gospoda",
  smithy: "Kuźnia",
  depot: "Depozyt",
  arena: "Arena treningowa",
};
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
  travel: (destination: FeatureId) => boolean;
  save: SuperiorSaveStore;
};

export async function prepareSuperior(options: {
  race: RaceId;
  saveKey: string;
  signal: AbortSignal;
  onLoading: (state: GameLoadingState) => void;
}): Promise<SuperiorRuntime> {
  const abort = new AbortController();
  options.signal.addEventListener("abort", () => abort.abort(), { once: true });
  const fetchJson = async <T>(path: string): Promise<T> => {
    const response = await fetch(BASE + "/" + path, { signal: abort.signal });
    if (!response.ok) throw Error("Nie można pobrać świata: " + response.status);
    return (await response.json()) as T;
  };
  options.onLoading({ phase: "preparing", message: "Otwieranie świata Superior…", progress: null });
  const index = await fetchJson<SuperiorIndex>("index.json");
  if (
    index.format !== "superior-runtime-1" ||
    index.features.length !== 10 ||
    new Set(index.features.map((f) => f.id)).size !== 10 ||
    index.features.some((f) => !FEATURE_IDS.includes(f.id))
  )
    throw Error("Nieobsługiwana wersja świata");
  let storage: Storage | null = null;
  try {
    storage = window.localStorage;
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
  const art = JSON.parse(new TextDecoder().decode(artBytes)) as FeatureArt;
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
  const offset = source.sourceOffset ?? { x: 0, y: 0 };
  const shift = (p: Point): Point => ({ x: p.x + offset.x, y: p.y + offset.y });
  const base = structuredClone(WORLDS[info.affinity]);
  const cities = new Map<
    string,
    { city: CityDefinition; npcs: WorldNpc[]; market: WorldDefinition["market"] }
  >();
  for (const town of source.settlements) {
    if (town.kind === "village") continue;
    const capital = town.id.endsWith("-capital") && source.acceptedSource;
    let city: CityDefinition, npcs: WorldNpc[], market: WorldDefinition["market"];
    if (capital && capital.city) {
      city = {
        ...structuredClone(capital.city),
        bounds: town.bounds,
        buildings: capital.city.buildings.map((b) => ({ ...b, door: shift(b.door) })),
        roads: [],
      };
      npcs = capital.npcs.map((n) => ({ ...n, ...shift(n) }));
      market = { ...capital.market, ...shift(capital.market) };
    } else {
      const buildings = source.buildings.filter(
        (b) => b.settlement === town.id && b.service in names,
      );
      if (buildings.length !== 6) continue;
      city = {
        name: town.name,
        bounds: town.bounds,
        roads: [],
        buildings: buildings.map((b) => ({
          id: b.service as BuildingId,
          objectId: b.id,
          door: b.door,
          name: names[b.service as BuildingId],
          district: town.name,
          description: names[b.service as BuildingId],
        })),
      };
      npcs = base.npcs.map((n) => ({
        ...n,
        name: town.name + " · " + n.role,
        x: town.x + (n.id === "hunter" ? -120 : 120),
        y: town.y + 180,
      }));
      market = { ...base.market, x: town.x, y: town.y };
    }
    cities.set(town.id, { city, npcs, market });
  }
  if (restored?.interior && !cities.has(save.town ?? ""))
    throw Error("Nieznane miasto zapisu wyprawy; oryginał zachowano.");
  const initialTown = cities.has(save.town ?? "")
    ? save.town!
    : [...cities.keys()].sort((a, b) => {
        const p = restored && !restored.interior ? restored : info.arrival;
        const aa = source.settlements.find((s) => s.id === a)!,
          bb = source.settlements.find((s) => s.id === b)!;
        return Math.hypot(p.x - aa.x, p.y - aa.y) - Math.hypot(p.x - bb.x, p.y - bb.y);
      })[0];
  if (!initialTown) throw Error("Brak osiągalnego miasta");
  save.town = initialTown;
  const first = cities.get(initialTown)!;
  const world: WorldDefinition = {
    ...base,
    name: source.name,
    settlement: first.city.name,
    width: info.width,
    height: info.height,
    spawn: loader.navigation.safe(info.arrival),
    minimap: BASE + "/" + info.id + "/minimap.svg",
    objects: [],
    obstacles: [],
    enemies: [],
    monsters: [],
    city: first.city,
    npcs: first.npcs,
    market: first.market,
    safeAreas: source.settlements.map((s) => s.bounds),
    landmarks: source.settlements.map((s) => ({
      x: s.x,
      y: s.y,
      label: s.name,
      kind: "settlement" as const,
    })),
  };
  const outsideCities = (p: Point) =>
    !source.settlements.some(
      (s) =>
        p.x >= s.bounds.x - 12 &&
        p.x <= s.bounds.x + s.bounds.width + 12 &&
        p.y >= s.bounds.y - 12 &&
        p.y <= s.bounds.y + s.bounds.height + 12,
    );
  const session = new GameSession(save, options.race, {
    world,
    navigation: loader.navigation,
    enemyNavigation: loader.enemyNavigation(world.safeAreas ?? []),
    maximumActiveEnemies: 24,
    enemyPositionAllowed: outsideCities,
  });
  const spawnData = (await loader.loadSpawns()) as { feature: string; overworld: AuthoredSpawn[] };
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
      if ((await bytesHash(buffer)) !== artManifest[path]) throw Error("Błędna suma dekoracji");
      const text = new TextDecoder().decode(buffer);
      const value = JSON.parse(text) as { format: string; objects: ArtObject[] };
      if (value.format !== "superior-art-overlay-1" || !Array.isArray(value.objects))
        throw Error("Błędne dekoracje");
      artCache.set(id, value.objects);
      if (artCache.size > 12) artCache.delete(artCache.keys().next().value!);
      return value.objects;
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
  for (const key of [...art.groundByBiome, art.water]) addBinding(key);
  for (const obj of [
    ...art.buildings,
    ...art.acceptedCityBuildings,
    ...(art.acceptedCityScenery ?? []),
    ...art.resources,
    ...art.dungeonEntrances,
  ])
    if (Math.abs(obj.x - session.player.x) < 4096 && Math.abs(obj.y - session.player.y) < 4096)
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
    for (const id of ids ?? [])
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
  const enemyVisual = monsterVisual;
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
      // Reserve twelve ground canvases plus 8 MiB for an incoming scenery chunk.
      const ids = new Set([...protectedAssets, ...owned, ...neededByMonster(slot.kind)]);
      for (const keys of owners.values()) for (const id of keys) ids.add(id);
      let bytes = 20 * 1024 * 1024;
      for (const id of ids) {
        const asset = catalog.assets.get(id);
        bytes += (asset?.width ?? 512) * (asset?.height ?? 512) * 4;
      }
      return !!activeScene && bytes <= 128 * 1024 * 1024;
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
  const canTravel = () =>
    !session.player.interior &&
    !session.player.dead &&
    !session.dialogue &&
    Math.hypot(session.player.x - info.arrival.x, session.player.y - info.arrival.y) < 320;
  return {
    session,
    save,
    index,
    feature: info.id,
    featureName: info.name,
    assets: [...initialAssets.values()],
    canTravel,
    travel(destination) {
      const next = index.features.find((f) => f.id === destination);
      return !!next && destination !== info.id && canTravel() && save.travel(session.player, next);
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
        readArt,
        acquire,
        release,
        error,
        currentDoors: () => [...(world.city?.buildings ?? [])],
      });
    },
    afterTick() {
      spawnStream.update();
    },
    beforeTick() {
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
      }
    },
    dispose() {
      spawnStream.dispose();
      disposed = true;
      abort.abort();
      artCache.clear();
      requests.clear();
    },
  };
}
