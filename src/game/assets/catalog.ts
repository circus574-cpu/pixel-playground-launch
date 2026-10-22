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
    version: "origins-1",
    kind: "image",
    url: "/game/assets/origins-v1/loading-world.webp",
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
/** Review switches affect optional scenery; Planetary and Sage heroes are always active. */
export const PREVIEW_SWITCHES: Record<string, readonly string[]> = {
  // The legacy ?ki-hero-art=1 remains safe but is no longer required for Planetarni.
  /** Anime start point of Aetheria, awaiting the owner's review. */
  "ki-aether-art": ["aether-sanctuary"],
  "ki-nexus-art": ["nexus-start"],
  "ki-pyra-art": ["pyra-start"],
  /** Alternative Verdantia village; the accepted anime forest stays the default. */
  "ki-verdant-art": ["verdant-start"],
};
/** Both production heroes are always enabled; other preview artwork keeps its opt-in switch. */
export function previewPacks(search: string): string[] {
  const params = new URLSearchParams(search);
  return [
    "hero-sage",
    "hero-planetary",
    ...Object.entries(PREVIEW_SWITCHES).flatMap(([param, packs]) =>
      params.get(param) === "1" ? packs : [],
    ),
  ];
}
export const catalog = makeCatalog(
  (imported as unknown[]).map((p) => PackSchema.parse(p)),
  previewPacks(typeof window !== "undefined" ? window.location.search : ""),
);
export const technicalPack = PackSchema.parse(technical);
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

export function worldRenderRefs(worldId: WorldId, source = catalog): TextureRef[] {
  const world = WORLDS[worldId],
    refs: TextureRef[] = [];
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
  return refs;
}
