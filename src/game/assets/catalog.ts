import { CHARACTER_VISUALS, SHARED_ASSETS, regionAssets } from "../world/assets";
import { walkFrame } from "../world/characterVisual";
import { WORLDS } from "../world/worlds";
import { RACES, type WorldId } from "../world/races";
import imported from "./imported.json" with { type: "json" };
import technical from "../../../art/pipeline/examples/technical-pack.json" with { type: "json" };
import {
  PackSchema,
  type AssetDefinition,
  type ActorVisual,
  type AssetPack,
  type TextureRef,
} from "./schema";
const human = CHARACTER_VISUALS["human-v2"];
const humanClip = (walk: boolean) => ({
  asset: human.key,
  fps: human.frameRate,
  loop: true,
  directions: Object.fromEntries(
    human.directions.map((d) => [
      d,
      Array.from({ length: walk ? human.frames : 1 }, (_, i) => walkFrame(human, d, i)),
    ]),
  ),
});
const hero: ActorVisual = {
  id: "human-v2",
  profile: "hero",
  size: [96, 96],
  origin: [0.5, 0.95],
  tintable: true,
  clips: { idle: humanClip(false), walk: humanClip(true) },
};
const boarClip = {
  asset: SHARED_ASSETS.creatures.key,
  fps: 1,
  loop: true,
  directions: { down: ["boar"] },
};
const boar: ActorVisual = {
  id: "boar-v1",
  profile: "enemy",
  size: [84, 84],
  origin: [0.5, 0.8],
  tintable: false,
  clips: { idle: boarClip, walk: boarClip },
};
const baseAssets: AssetDefinition[] = [
  {
    id: "brand-loading",
    version: "key-art-1",
    kind: "image",
    url: "/game/assets/brand/loading-heroes.webp",
  },
  {
    id: "brand-loading-wide",
    version: "key-art-1",
    kind: "image",
    url: "/game/assets/brand/loading-wide.webp",
  },
  {
    id: human.key,
    version: "legacy-2",
    kind: "image",
    url: human.url,
    width: 1254,
    height: 1254,
    grid: { columns: human.columns, rows: human.directions.length },
  },
  {
    id: SHARED_ASSETS.creatures.key,
    version: "legacy-1",
    kind: "image",
    url: SHARED_ASSETS.creatures.url,
    width: 1254,
    height: 1254,
    crops: [{ name: "boar", x: 646.59375, y: 685.78125, width: 607.40625, height: 568.21875 }],
  },
  {
    id: SHARED_ASSETS.ui.key,
    version: "anime-forest-1",
    kind: "sheet",
    url: SHARED_ASSETS.ui.url,
    width: 768,
    height: 768,
    frameWidth: 256,
    frameHeight: 256,
  },
  {
    id: SHARED_ASSETS.forestTerrain.key,
    version: "anime-forest-1",
    kind: "image",
    url: SHARED_ASSETS.forestTerrain.url,
    width: 1904,
    height: 1904,
  },
  {
    id: SHARED_ASSETS.forestObjects.key,
    version: "anime-forest-1",
    kind: "atlas",
    url: SHARED_ASSETS.forestObjects.url,
    atlasUrl: SHARED_ASSETS.forestObjects.atlas,
    width: 2048,
    height: 1536,
  },
  ...[
    ...new Map(
      Object.values(WORLDS)
        .flatMap(regionAssets)
        .map((a) => [a.key, a]),
    ).values(),
  ].map((a) => ({ id: a.key, version: "stage3-1", kind: "svg" as const, url: a.url })),
];
export function makeCatalog(
  packs: readonly AssetPack[],
  includePreview: boolean | readonly string[] = false,
) {
  const assets = new Map(baseAssets.map((a) => [a.id, a]));
  const actors = new Map([hero, boar].map((a) => [a.id, a]));
  const actorBindings: Record<string, string> = {
    "hero.human-v2": hero.id,
    enemy: boar.id,
    npc: hero.id,
  };
  const renderBindings: AssetPack["renderBindings"] = {};
  const effects: AssetPack["effects"] = {};
  for (const pack of packs) {
    if (
      pack.previewOnly &&
      includePreview !== true &&
      (!Array.isArray(includePreview) || !includePreview.includes(pack.id))
    )
      continue;
    for (const asset of pack.assets) assets.set(asset.id, asset);
    for (const actor of pack.actors) actors.set(actor.id, actor);
    Object.assign(actorBindings, pack.actorBindings);
    Object.assign(renderBindings, pack.renderBindings);
    Object.assign(effects, pack.effects);
  }
  return { assets, actors, actorBindings, renderBindings, effects };
}
/** Packs enabled by each opt-in review switch (`?<param>=1`). */
export const PREVIEW_SWITCHES: Record<string, readonly string[]> = {
  /** Combat-only boss catalog preview; uses existing actor graphics. */
  "ki-bosses": [],
  /** Anime start point of Aetheria, awaiting the owner's review. */
  "ki-aether-art": ["aether-sanctuary"],
  "ki-nexus-art": ["nexus-start"],
  "ki-pyra-art": ["pyra-start"],
  /** Pyra smithy "Kuźnia Żaru" built from painted parts (vertical slice). */
  "ki-smithy-art": ["pyra-smithy"],
  /** Alternative Verdantia village; the accepted anime forest stays the default. */
  "ki-verdant-art": ["verdant-start"],
  /** Gemini-video walk cycles for Legend and Sage; other states stay unchanged. */
  "ki-hero-walk": ["hero-legend-walk-v3", "hero-sage-painted-walk-v3"],
  /** World v2 preview: painted ground per biome and freestanding props for every continent. */
  "ki-world-v2": [
    "ki-v2-terrain",
    "ki-v2-objects",
    "ki-v2-city",
    "ki-v2-buildings",
    "ki-v2-landmarks",
    "ki-v2-camps",
    // 37 bestiary monsters redrawn from the GPU masters (animate_creature.py, one painted view).
    "enemy-v2-aether-duch-bibliotekarza",
    "enemy-v2-aether-krysztalowy-motyl",
    "enemy-v2-aether-lew-swiatyni",
    "enemy-v2-aether-marionetka-rytualu",
    "enemy-v2-aether-mgielny-zuraw",
    "enemy-v2-aether-oko-wiedzy",
    "enemy-v2-aether-pergaminowy-straznik",
    "enemy-v2-aether-swietlik-pieczeci",
    "enemy-v2-aether-szmaragdowy-waz",
    "enemy-v2-aether-zloty-skarabeusz",
    "enemy-v2-nexus-dron-zwiadowca",
    "enemy-v2-nexus-kruk-danych",
    "enemy-v2-nexus-latarnia-plazmowa",
    "enemy-v2-nexus-pajak-spawalniczy",
    "enemy-v2-nexus-pelzacz-serwisowy",
    "enemy-v2-nexus-pies-lowca",
    "enemy-v2-nexus-roj-nanitow",
    "enemy-v2-nexus-skaner-gasienicowy",
    "enemy-v2-nexus-straznik-rdzenia",
    "enemy-v2-nexus-wiezyczka-autonomiczna",
    "enemy-v2-pyra-byk-areny",
    "enemy-v2-pyra-golem-ruin",
    "enemy-v2-pyra-magmowy-krab",
    "enemy-v2-pyra-ognista-salamandra",
    "enemy-v2-pyra-plomien-duch",
    "enemy-v2-pyra-popielny-wilk",
    "enemy-v2-pyra-skalny-berserker",
    "enemy-v2-pyra-skorpion-obsydianowy",
    "enemy-v2-pyra-wegielek",
    "enemy-v2-pyra-zarowy-nietoperz",
    "enemy-v2-verdant-bursztynowa-osa",
    "enemy-v2-verdant-cierniowy-wilk",
    "enemy-v2-verdant-grzybowy-zarodnik",
    "enemy-v2-verdant-lesny-pajak",
    "enemy-v2-verdant-mchowy-szlamak",
    "enemy-v2-verdant-korzeniowy-pelzacz",
    "enemy-v2-verdant-lisciak-skrytobojca",
    "enemy-v2-verdant-puchacz-pylowy",
    "enemy-v2-verdant-skalny-jelen",
    "enemy-v2-verdant-straznik-ruin",
  ],
};
/** All four delivered heroes are active packs; legacy hero URL flags are harmless. */
export function previewPacks(search: string): string[] {
  const params = new URLSearchParams(search);
  // World v2 is the default world (owner decision 26.10.2026); only `?ki-world-v1=1` turns it off.
  const on = (param: string) =>
    param === "ki-world-v2" ? params.get("ki-world-v1") !== "1" : params.get(param) === "1";
  return Object.entries(PREVIEW_SWITCHES).flatMap(([param, packs]) => (on(param) ? packs : []));
}
export const catalog = makeCatalog(
  (imported as unknown[]).map((p) => PackSchema.parse(p)),
  previewPacks(typeof window !== "undefined" ? window.location.search : ""),
);
export const technicalPack = PackSchema.parse(technical);
// Delivery manifests keep their validated 96px contract. These painted heroes
// need a larger presentation because their silhouettes occupy only part of a frame.
// Apply it here so rendering and label avoidance share the same bounds; physics
// continues to use the independent foot collider.
const enlargedHeroes = new Set([
  "hero-planetary-painted",
  "hero-sage-painted",
  "hero-android",
  "hero-legend",
]);
export function actorVisual(
  world: WorldId,
  kind: "hero" | "npc" | "enemy",
  role?: string,
  preview = false,
  source = catalog,
): ActorVisual {
  if (preview && kind === "hero") return technicalPack.actors[0]!;
  const bindings = source.actorBindings;
  const id =
    bindings[`${world}.${kind}.${role ?? "default"}`] ??
    bindings[`${world}.${kind}`] ??
    bindings[kind === "hero" ? "hero." + RACES[WORLDS[world].race].visual : kind];
  const actor = id && source.actors.get(id);
  if (!actor) throw new Error("Brak definicji wyglądu: " + world + "/" + kind);
  if (kind === "hero" && enlargedHeroes.has(actor.id)) return { ...actor, size: [160, 160] };
  return actor;
}
export function textureBinding(
  id: string,
  fallback: TextureRef,
  source = catalog,
): TextureRef & {
  layer?: "below" | "objects" | "overhead" | "atmosphere";
  fit?: "contain" | "stretch";
  tileSize?: [number, number];
  origin?: [number, number];
} {
  return source.renderBindings[id] ?? fallback;
}
/** Summoned small wasps share the existing wasp identity instead of becoming boars. */
export function monsterVisual(kind: string, source = catalog): ActorVisual {
  const visualKind = kind === "verdant-mala-osa" ? "verdant-bursztynowa-osa" : kind;
  const prefix = visualKind.split("-")[0] as WorldId;
  if (!(prefix in WORLDS)) return actorVisual("verdant", "enemy", undefined, false, source);
  return actorVisual(prefix, "enemy", visualKind.slice(prefix.length + 1), false, source);
}

export function worldAssets(
  worldId: WorldId,
  preview = false,
  source = catalog,
): AssetDefinition[] {
  const world = WORLDS[worldId],
    used = new Set<string>(["ui-icons"]);
  const add = (ref: TextureRef) => used.add(ref.asset);
  for (const role of [undefined, ...world.npcs.map((n) => n.id)]) {
    const visual = actorVisual(worldId, role ? "npc" : "hero", role, preview, source);
    for (const clip of Object.values(visual.clips)) used.add(clip.asset);
  }
  for (const clip of Object.values(actorVisual(worldId, "enemy", undefined, false, source).clips))
    used.add(clip.asset);
  // Installed bestiary packs are available to streaming worlds; only authored
  // monsters on the accepted static map belong to its eager asset set.
  for (const spawn of world.monsters ?? []) {
    const prefix = spawn.kind.split("-")[0] as WorldId;
    for (const clip of Object.values(
      actorVisual(prefix, "enemy", spawn.kind.slice(prefix.length + 1), false, source).clips,
    ))
      used.add(clip.asset);
  }
  for (const ref of worldRenderRefs(worldId, source)) add(ref);
  for (const [key, effect] of Object.entries(source.effects))
    if (!key.includes(".") || key.startsWith(worldId + ".")) used.add(effect.asset);
  return [...used].map((id) => {
    const asset =
      source.assets.get(id) ??
      (preview ? technicalPack.assets.find((a) => a.id === id) : undefined);
    if (!asset) throw new Error("Brak zasobu w manifeście: " + id);
    return asset;
  });
}
export function uiTextureUrl() {
  return catalog.assets.get("ui-icons")!.url;
}

export function loadingTextureUrl() {
  return catalog.assets.get("brand-loading")!.url;
}
/** Landscape variant for wide screens; portrait screens use the heroes crop. */
export function loadingWideTextureUrl() {
  return catalog.assets.get("brand-loading-wide")!.url;
}

/** Nature liquids that texture the inner blocking rectangles; collision stays in region JSON. */
const HAZARD_TEXTURES: Partial<Record<WorldId, string>> = {
  pyra: "terrain.nature-lava-flow",
  nexus: "terrain.nature-energy-liquid",
  aether: "terrain.nature-water-crystal",
};
export function hazardBinding(worldId: WorldId, source = catalog) {
  const key = HAZARD_TEXTURES[worldId];
  return key ? source.renderBindings[key] : undefined;
}

export function worldRenderRefs(worldId: WorldId, source = catalog): TextureRef[] {
  const world = WORLDS[worldId],
    refs: TextureRef[] = [];
  if (world.city)
    for (const key of [
      ...["city-road", "interior-floor", "interior-stone"].map(
        (name) => "terrain." + worldId + "." + name,
      ),
      ...["chest", "anvil", "dummy", "shelf", "bed", "desk"].map(
        (name) => "object." + worldId + ".interior." + name,
      ),
      "terrain.city-floor",
      "terrain.city-stone",
      ...["chest", "anvil", "dummy", "shelf", "bed", "desk"].map((name) => "object.city." + name),
    ]) {
      const ref = source.renderBindings[key];
      if (ref) refs.push(ref);
    }
  // Painted interior kits (e.g. the Pyra smithy) are loaded together with their world.
  for (const [key, ref] of Object.entries(source.renderBindings))
    if (
      key.startsWith("object." + worldId + ".smithy.") ||
      key.startsWith("terrain." + worldId + ".smithy-")
    )
      refs.push(ref);
  if (world.terrain)
    for (const id of [world.terrain.ground, world.terrain.path, world.terrain.plaza])
      refs.push(textureBinding("terrain." + id, { asset: id }, source));
  else refs.push(textureBinding("terrain.verdant", { asset: "forest-terrain" }, source));
  for (const obj of world.objects)
    refs.push(
      textureBinding(
        "object." + worldId + "." + obj.id,
        world.terrain
          ? textureBinding("object." + obj.asset, { asset: obj.asset! }, source)
          : textureBinding(
              "object.forest." + obj.kind,
              { asset: "forest-objects", frame: obj.kind },
              source,
            ),
        source,
      ),
    );
  for (const key of ["atmosphere." + worldId, "effect.shield", "terrain." + worldId + "-wall"]) {
    const ref = source.renderBindings[key];
    if (ref) refs.push(ref);
  }
  const hazard = hazardBinding(worldId, source);
  if (hazard) refs.push(hazard);
  for (const zone of world.terrain?.zones ?? []) {
    const ref = source.renderBindings["terrain." + zone.texture];
    if (ref) refs.push(ref);
  }
  return refs;
}
