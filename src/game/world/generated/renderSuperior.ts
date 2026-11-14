import { islandArtEnabled, islandMaterial } from "./islandArt";
import { recordBake } from "../../assets/freezeProbe";
import {
  aetheriaContinentEnabled,
  aetheriaTerrainBindings,
  aetheriaBiomeBindings,
  aetheriaObjects,
  aetheriaRoadside,
  aetheriaBiomeAt,
  aetheriaNoise,
} from "./aetheriaContinent";
import {
  pyraContinentEnabled,
  pyraTerrainBindings,
  pyraBiomeBindings,
  pyraObjects,
  pyraRoadside,
  pyraPathScenery,
  pyraEffectFrame,
  pyraMoltenCell,
} from "./pyraContinent";
import { nexusGarden, nexusScenery, nexusWalkways } from "./nexusPainted";
import {
  nexusContinentEnabled,
  nexusTerrainBindings,
  nexusBiomeBindings,
  nexusObjects,
  nexusRoadside,
  nexusBiomeAt,
  nexusScatter,
  nexusAir,
  nexusEffectFrame,
  nexusEnergyCell,
} from "./nexusContinent";
import {
  verdantiaContinentEnabled,
  continentTerrainBindings,
  continentBiomeBindings,
  continentRoadside,
  continentObjects,
  extraSceneryEnabled,
} from "./verdantiaContinent";
import {
  paintedMeadowEnabled,
  paintedPaths,
  meadowLight,
  meadowScenery,
  meadowBuildings,
  aetherLegacyScenery,
} from "./paintedMeadow";
import { continentAir, continentDress, dressBiomeAt, dressEnabled } from "./worldDress";
import type Phaser from "phaser";
import { catalog } from "../../assets/catalog";
import {
  chooseGroundResolution,
  nextGroundResolution,
  groundResolutionOverride,
} from "../../assets/groundBudget";
import { buildSceneryGrid, sceneryNear, sceneryReach } from "../sceneryStream";
import { sizeScenery } from "../../assets/scenery";
import { renderDepth } from "../../assets/layers";
import { blendedTexture } from "../../assets/blendPlates";
import { foliageAlpha, occlusionAlpha, type OcclusionFocus } from "../visibility";
import { decodeRuns } from "./browserTerrain";
import type { Point } from "../../navigation";
import type { RegionObject } from "../types";
import type { loadBrowserFeature, BrowserChunk } from "./browserLoader";

export type ArtObject = RegionObject & {
  binding: string;
  door?: Point;
  layer?: "below" | "objects" | "overhead";
};
export type FeatureArt = {
  groundByBiome: string[];
  water: string;
  /** Painted road and town-square textures (art set ki-v2); flat colours when absent. */
  road?: string;
  plaza?: string;
  buildings: ArtObject[];
  acceptedCityBuildings: ArtObject[];
  acceptedCityScenery?: ArtObject[];
  /** Famous places standing in the open world (art set ki-v2), presentation only. */
  landmarks?: ArtObject[];
  resources: ArtObject[];
  dungeonEntrances: ArtObject[];
};
export type RenderSource = {
  loader: Awaited<ReturnType<typeof loadBrowserFeature>>;
  art: FeatureArt;
  roads: readonly { points: [number, number][]; width: number; kind: string }[];
  cityRoads: readonly { x: number; y: number; width: number; height: number }[];
  outsideCities?: (point: Point) => boolean;
  readArt: (x: number, y: number) => Promise<ArtObject[]>;
  acquire: (scene: Phaser.Scene, ids: Set<string>, owner: string) => Promise<void>;
  release: (scene: Phaser.Scene, owner: string) => void;
  error: (error: unknown) => void;
  currentDoors: () => { id: string; name: string; door: Point }[];
  /** Bajty atlasów już rezydujących w scenie; podłoże dobiera rozdzielczość do reszty budżetu. */
  residentAtlasBytes?: () => number;
};
const CHUNK = 2048;

type Tile = {
  data: BrowserChunk;
  items: ArtObject[];
  ground: Phaser.GameObjects.Image;
  images: Map<string, Phaser.GameObjects.Image>;
  shadows: Map<string, Phaser.GameObjects.Image>;
  /** Siatka przestrzenna z renderera v1: pętla widoczności chodzi tylko po komórkach w kadrze. */
  grid: Map<number, number[]>;
  reach: number;
  index: Map<string, number>;
  key: string;
};
const intersects = (
  o: ArtObject,
  v: { left: number; right: number; top: number; bottom: number },
  pad: number,
) =>
  o.x + o.width * (1 - o.anchorX) >= v.left - pad &&
  o.x - o.width * o.anchorX <= v.right + pad &&
  o.y + o.height * (1 - o.anchorY) >= v.top - pad &&
  o.y - o.height * o.anchorY <= v.bottom + pad;
const textureId = (binding: string) => {
  const value = catalog.renderBindings[binding];
  if (!value) throw Error("Brak grafiki świata: " + binding);
  return value.asset;
};

// Scratch canvases shared by every chunk: one pixel per terrain cell, and one full ground layer.
let cells: HTMLCanvasElement | undefined, layer: HTMLCanvasElement | undefined;
const cellCanvas = (width: number, height: number) => {
  cells ??= document.createElement("canvas");
  if (cells.width !== width || cells.height !== height) {
    cells.width = width;
    cells.height = height;
  }
  return cells;
};
const layerCanvas = (size = 512) => {
  layer ??= document.createElement("canvas");
  if (layer.width !== size || layer.height !== size) {
    layer.width = layer.height = size;
  }
  return layer;
};
/** Only streamed chunks have canvases; only nearby decorations have Phaser images. */
export function renderSuperior(scene: Phaser.Scene, source: RenderSource) {
  const feature = source.loader.definition.feature;
  const island = islandArtEnabled(feature);
  const dress = dressEnabled();
  const materials = new Map<string, HTMLCanvasElement>();
  const painted = paintedMeadowEnabled(feature) || island;
  const pyraContinent = pyraContinentEnabled(source.loader.definition.feature);
  const verdantContinent = verdantiaContinentEnabled(source.loader.definition.feature);
  const aetheriaContinent = aetheriaContinentEnabled(source.loader.definition.feature);
  const nexusContinent = nexusContinentEnabled(source.loader.definition.feature);
  const continent = verdantContinent || pyraContinent || aetheriaContinent || nexusContinent;
  const terrainBindings = nexusContinent
    ? nexusTerrainBindings
    : aetheriaContinent
      ? aetheriaTerrainBindings
      : pyraContinent
        ? pyraTerrainBindings
        : continentTerrainBindings;
  const biomeBindings = nexusContinent
    ? nexusBiomeBindings
    : aetheriaContinent
      ? aetheriaBiomeBindings
      : pyraContinent
        ? pyraBiomeBindings
        : continentBiomeBindings;
  const terrainPrefix = nexusContinent
    ? "terrain.nexus-continent."
    : aetheriaContinent
      ? "terrain.aetheria-continent."
      : pyraContinent
        ? "terrain.pyra-continent."
        : "terrain.verdantia-continent.";
  const remapObjects = pyraContinent ? pyraObjects : continentObjects;
  const roadside = pyraContinent ? pyraRoadside : continentRoadside;
  const outside = source.outsideCities ?? (() => false);
  const paintedPyra = painted && source.loader.definition.feature === "pyra";
  const paintedNexus = painted && source.loader.definition.feature === "nexus";
  const nexusRoads = paintedNexus ? nexusWalkways(source.art) : [];
  const renderRoads = [...source.roads, ...nexusRoads];
  // Audyt 11.11.2026: podłoże było poza budżetem tekstur. Dobieramy rozdzielczość do reszty
  // budżetu po atlasach, zamiast zawsze piec 1024 i przekraczać sufit o 28–48 MiB.
  // Opt-in profil wydajności (?ki-ground-res=512/768/1024): niższy sufit pieczenia = ~4× tańsza
  // pieczeń i krótsze zamrożenie. Bez parametru null → domyślna rozdzielczość bez zmian.
  const groundProfile = groundResolutionOverride(window.location.search);
  // Domyślnie 512: przy pieczeniu przyrostowym każdy krok jest tani (~25 ms), więc wejście w chunk
  // nie zamraża gry. ?ki-ground-res=1024/768 podnosi ostrość kosztem dłuższych kroków.
  const preferredResolution = groundProfile ?? 512;
  // Rozdzielczość startowa; po wolnym pieczeniu spada (nextGroundResolution), więc drawGround czyta `adaptive`.
  let adaptive =
    painted || continent
      ? chooseGroundResolution(source.residentAtlasBytes?.() ?? 0, preferredResolution)
      : preferredResolution;
  const shadowKey = "verdantia-continent-contact-shadow";
  if (continent && !scene.textures.exists(shadowKey)) {
    const texture = scene.textures.createCanvas(shadowKey, 64, 64)!;
    const ctx = texture.getContext();
    const shade = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    shade.addColorStop(0, "rgba(12,32,17,0.4)");
    shade.addColorStop(1, "rgba(12,32,17,0)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, 64, 64);
    texture.refresh();
  }
  const live = new Map<string, Tile>();
  const pending = new Set<string>();
  let wanted = new Set<string>();
  let disposed = false,
    failed = false,
    visible = true,
    lastCells = "",
    doorsKey = "";
  const markers: (Phaser.GameObjects.Ellipse | Phaser.GameObjects.Text)[] = [];
  const staticItems = [
    ...(pyraContinent ? pyraPathScenery(source.roads, outside) : []),
    ...(painted ? meadowBuildings(source.art.buildings) : source.art.buildings),
    ...(painted
      ? meadowBuildings(source.art.acceptedCityBuildings)
      : source.art.acceptedCityBuildings),
    ...(painted && source.loader.definition.feature === "aether"
      ? aetheriaContinent
        ? [
            ...aetherLegacyScenery(
              (source.art.acceptedCityScenery ?? []).filter((item) => !outside(item)),
            ),
            ...(source.art.acceptedCityScenery ?? []).filter(outside),
          ]
        : aetherLegacyScenery(source.art.acceptedCityScenery ?? [])
      : paintedNexus
        ? nexusScenery(source.art.acceptedCityScenery ?? [])
        : (source.art.acceptedCityScenery ?? [])),
    ...(source.art.landmarks ?? []),
    ...source.art.resources,
    ...source.art.dungeonEntrances,
    ...(paintedNexus
      ? nexusGarden(source.art)
      : painted && !island
        ? meadowScenery(source.art, source.cityRoads)
        : []),
  ];
  const staticGrid = new Map<string, ArtObject[]>();
  for (const item of staticItems) {
    const id = Math.floor(item.x / CHUNK) + "-" + Math.floor(item.y / CHUNK);
    const list = staticGrid.get(id) ?? [];
    list.push(item);
    staticGrid.set(id, list);
  }
  const drop = (id: string) => {
    const tile = live.get(id);
    if (!tile) return;
    for (const image of tile.images.values()) image.destroy();
    for (const shadow of tile.shadows.values()) shadow.destroy();
    tile.ground.destroy();
    scene.textures.remove(tile.key);
    live.delete(id);
    source.release(scene, id);
  };
  // Faza 5: pieczenie przyrostowe. drawGround jest generatorem — rejestruje warstwy tekstur i wykonuje
  // je po jednej z `yield`, żeby kolejka rozłożyła pieczenie na klatki (koniec zamrożeń 600–1760 ms).
  // Rendering jest pixel-identical; adaptacyjna rozdzielczość (adaptive) i recordBake zostają.
  type GroundResult = { key: string; image: Phaser.GameObjects.Image };
  function* drawGround(data: BrowserChunk, id: string): Generator<void, GroundResult, unknown> {
    const resolution = adaptive;
    const scale = resolution / CHUNK;
    const flags = decodeRuns(data.terrain.flags, data.terrain.width * data.terrain.height);
    const biome = decodeRuns(data.terrain.biome, flags.length);
    const key = "superior-ground:" + id;
    // Standard chunk: 1 MiB; opt-in painted review: 4 MiB. The world footprint is unchanged.
    const tex = scene.textures.createCanvas(key, resolution, resolution);
    if (!tex) throw Error("Nie można przygotować terenu");
    const ctx = tex.getContext();
    const pattern = (binding: string) => {
      const texture = scene.textures.get(textureId(binding));
      const ref = catalog.renderBindings[binding]!;
      let image = texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
      if (island && ref.frame !== undefined) {
        const frame = texture.get(ref.frame);
        const materialKey = ref.asset + ":" + ref.frame;
        let material = materials.get(materialKey);
        if (!material) {
          material = islandMaterial(
            frame.source.image as CanvasImageSource,
            frame.cutX,
            frame.cutY,
            frame.cutWidth,
            frame.cutHeight,
          );
          materials.set(materialKey, material);
        }
        image = material;
      }
      const tile = ctx.createPattern(image, "repeat")!;
      const size = catalog.renderBindings[binding]?.tileSize ?? [256, 256];
      // Preserve texture scale relative to the world footprint at either bake resolution.
      // Keep the
      // authored world-unit tile size instead of enlarging grass to 2048 units.
      tile.setTransform(
        new DOMMatrix()
          .translate(
            painted ? -(data.x % size[0]) * scale : 0,
            painted ? -(data.y % size[1]) * scale : 0,
          )
          .scale((size[0] * scale) / image.width, (size[1] * scale) / image.height),
      );
      return tile;
    };
    const courtyard = paintedNexus ? pattern("terrain.nexus-painted-courtyard") : undefined;
    const ground = source.art.groundByBiome.map(pattern),
      water = pattern(source.art.water),
      road = source.art.road ? pattern(source.art.road) : undefined,
      plaza = source.art.plaza ? pattern(source.art.plaza) : undefined;
    // Painted sets (with a road texture) are meant to be seen; the legacy kit stays a faint tint.
    const groundAlpha = painted ? 1 : road ? 0.6 : 0.15,
      waterAlpha = road ? 0.85 : 0.5;
    const tone = (binding: string) =>
      binding.includes("snow")
        ? "#cfdbd6"
        : binding.includes("sand")
          ? "#c6af82"
          : binding.includes("ash")
            ? "#66514a"
            : binding.includes("nexus")
              ? "#617d78"
              : binding.includes("cliff")
                ? "#8b917a"
                : binding.includes("forest-floor")
                  ? "#66774e"
                  : "#819763";
    // One pixel per 32-unit cell, enlarged with smoothing: biome edges and the coast blend
    // into each other instead of showing the CPU cell grid as pasted square patches.
    const cols = data.terrain.width,
      rows = data.terrain.height;
    const cellPoint = (i: number) => ({
      x: data.x + (((i % cols) + 0.5) * CHUNK) / cols,
      y: data.y + ((Math.floor(i / cols) + 0.5) * CHUNK) / rows,
    });
    let wilderness = continent;
    const small = cellCanvas(cols, rows),
      sctx = small.getContext("2d")!;
    const colors = sctx.createImageData(cols, rows);
    const biomes = new Set<number>();
    for (let i = 0; i < flags.length; i++) {
      if (wilderness && !outside(cellPoint(i))) wilderness = false;
      const land = !!(flags[i]! & 16);
      if (land) biomes.add(biome[i]!);
      const hex = land
        ? tone(source.art.groundByBiome[biome[i]!] ?? source.art.groundByBiome[0]!)
        : "#3b7082";
      colors.data[i * 4] = parseInt(hex.slice(1, 3), 16);
      colors.data[i * 4 + 1] = parseInt(hex.slice(3, 5), 16);
      colors.data[i * 4 + 2] = parseInt(hex.slice(5, 7), 16);
      colors.data[i * 4 + 3] = 255;
    }
    sctx.putImageData(colors, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    yield; // baza terenu jako osobny krok pieczenia
    ctx.drawImage(small, 0, 0, cols, rows, 0, 0, resolution, resolution);
    // Low-contrast texture reads as a continuous ground surface rather than a board of
    // repeated pictures; each texture fades in through the same smoothed cell mask.
    const layer = layerCanvas(resolution),
      lctx = layer.getContext("2d")!;
    const runTexture = (
      fill: CanvasPattern,
      alpha: number,
      inside: (i: number) => boolean,
      legacyTone = true,
    ) => {
      const mask = sctx.createImageData(cols, rows);
      let covered = false;
      for (let i = 0; i < flags.length; i++)
        if (inside(i)) {
          mask.data[i * 4 + 3] = 255;
          covered = true;
        }
      if (!covered) return;
      sctx.clearRect(0, 0, cols, rows);
      sctx.putImageData(mask, 0, 0);
      lctx.globalCompositeOperation = "source-over";
      lctx.clearRect(0, 0, resolution, resolution);
      lctx.fillStyle = fill;
      lctx.filter =
        legacyTone && painted && !island && !paintedPyra && !paintedNexus && fill !== water
          ? "saturate(0.82) brightness(0.9)"
          : "none";
      lctx.fillRect(0, 0, resolution, resolution);
      lctx.filter = "none";
      lctx.globalCompositeOperation = "destination-in";
      lctx.imageSmoothingEnabled = true;
      lctx.imageSmoothingQuality = "high";
      lctx.drawImage(small, 0, 0, cols, rows, 0, 0, resolution, resolution);
      ctx.globalAlpha = alpha;
      ctx.drawImage(layer, 0, 0);
      ctx.globalAlpha = 1;
    };
    // Rejestracja zamiast natychmiastowego rysowania: wywołania texture() poniżej tylko zbierają
    // operacje, a pętla przed meadowLight wykonuje je po jednej z `yield` (pieczenie na raty).
    const textureOps: [CanvasPattern, number, (i: number) => boolean, boolean][] = [];
    const texture = (
      fill: CanvasPattern,
      alpha: number,
      inside: (i: number) => boolean,
      legacyTone = true,
    ) => {
      textureOps.push([fill, alpha, inside, legacyTone]);
    };
    if (!wilderness)
      for (const b of aetheriaContinent ? [...biomes].sort((a, b) => a - b) : biomes)
        texture(ground[b] ?? ground[0]!, groundAlpha, (i) => !!(flags[i]! & 16) && biome[i] === b);
    if (painted && !island && !wilderness) {
      const shop = source.art.acceptedCityBuildings.find((b) => b.id === "accepted-city-shop");
      if (shop)
        texture(ground[0]!, 1, (i) => {
          const x = data.x + (((i % cols) + 0.5) * CHUNK) / cols;
          const y = data.y + ((Math.floor(i / cols) + 0.5) * CHUNK) / rows;
          return (
            !!(flags[i]! & 16) &&
            x > shop.x - 600 &&
            x < shop.x + 1500 &&
            y > shop.y - 750 &&
            y < shop.y + 1500
          );
        });
    }
    const city = painted ? source.loader.definition.feature : "";
    if (city === "aether" || city === "pyra") {
      const buildings = source.art.acceptedCityBuildings;
      const side = city === "pyra" ? 400 : 450,
        above = city === "pyra" ? 450 : 350,
        below = city === "pyra" ? 300 : 350;
      const left = Math.min(...buildings.map((b) => b.x)) - side;
      const right = Math.max(...buildings.map((b) => b.x)) + side;
      const top = Math.min(...buildings.map((b) => b.y)) - above;
      const bottom = Math.max(...buildings.map((b) => b.y)) + below;
      texture(ground[0]!, 1, (i) => {
        const x = data.x + (((i % cols) + 0.5) * CHUNK) / cols;
        const y = data.y + ((Math.floor(i / cols) + 0.5) * CHUNK) / rows;
        return !!(flags[i]! & 16) && x > left && x < right && y > top && y < bottom;
      });
    }
    if (paintedNexus) {
      const buildings = source.art.acceptedCityBuildings;
      const left = Math.min(...buildings.map((b) => b.x)) - 400;
      const right = Math.max(...buildings.map((b) => b.x)) + 400;
      const top = Math.min(...buildings.map((b) => b.y)) - 450;
      const bottom = Math.max(...buildings.map((b) => b.y)) + 300;
      const onCityLand = (i: number) => {
        const x = data.x + (((i % cols) + 0.5) * CHUNK) / cols;
        const y = data.y + ((Math.floor(i / cols) + 0.5) * CHUNK) / rows;
        return !!(flags[i]! & 16) && x > left && x < right && y > top && y < bottom;
      };
      texture(ground[0]!, 1, onCityLand);
      const inGarden = (x: number, y: number) =>
        buildings.some(
          (b) =>
            Math.hypot((x - b.x + 310) / 195, (y - b.y - 65) / 230) < 1 ||
            Math.hypot((x - b.x - 300) / 155, (y - b.y - 55) / 190) < 1,
        );
      texture(courtyard!, 1, (i) => {
        const x = data.x + (((i % cols) + 0.5) * CHUNK) / cols;
        const y = data.y + ((Math.floor(i / cols) + 0.5) * CHUNK) / rows;
        return onCityLand(i) && !inGarden(x, y);
      });
      texture(ground[1]!, 0.7, (i) => {
        const x = data.x + (((i % cols) + 0.5) * CHUNK) / cols;
        const y = data.y + ((Math.floor(i / cols) + 0.5) * CHUNK) / rows;
        return onCityLand(i) && inGarden(x, y);
      });
    }
    if (!wilderness) texture(water, waterAlpha, (i) => !(flags[i]! & 16));
    if (island) {
      texture(
        pattern(`terrain.${feature}.shore`),
        0.85,
        (i) =>
          !!(flags[i]! & 16) &&
          [i - 2, i + 2, i - cols * 2, i + cols * 2].some(
            (j) => j >= 0 && j < flags.length && !(flags[j]! & 16),
          ),
        false,
      );
      if (feature === "island-6")
        texture(
          pattern(`terrain.${feature}.lava`),
          0.8,
          (i) => !!(flags[i]! & 16) && !(flags[i]! & 1) && biome[i] === 3,
          false,
        );
    }
    if (continent) {
      for (const b of biomes)
        texture(
          pattern(biomeBindings[b] ?? biomeBindings[0]!),
          1,
          (i) => !!(flags[i]! & 16) && biome[i] === b && outside(cellPoint(i)),
          false,
        );
      texture(
        pattern(terrainPrefix + (pyraContinent ? "shore" : "sand")),
        0.8,
        (i) =>
          !!(flags[i]! & 16) &&
          biome[i] !== 2 &&
          (!aetheriaContinent || biome[i]! < 2) &&
          outside(cellPoint(i)) &&
          [i - 2, i + 2, i - cols * 2, i + cols * 2].some(
            (j) => j >= 0 && j < flags.length && !(flags[j]! & 16),
          ),
        false,
      );
      texture(
        pattern(terrainPrefix + "water"),
        1,
        (i) => !(flags[i]! & 16) && outside(cellPoint(i)),
        false,
      );
    }
    if (aetheriaContinent) {
      const dryLand = (i: number) => !!(flags[i]! & 16) && outside(cellPoint(i));
      texture(
        pattern(terrainPrefix + "snow"),
        0.95,
        (i) => {
          const p = cellPoint(i);
          return (
            dryLand(i) &&
            biome[i]! >= 2 &&
            Math.sin(p.x / 510) + Math.cos(p.y / 670) > (biome[i] === 3 ? 0.75 : -0.3)
          );
        },
        false,
      );
      texture(
        pattern(terrainPrefix + "wet"),
        0.65,
        (i) => {
          const p = cellPoint(i);
          return dryLand(i) && biome[i] === 0 && Math.sin(p.x / 490) + Math.cos(p.y / 740) > 1.2;
        },
        false,
      );
      texture(
        pattern(terrainPrefix + "river"),
        0.65,
        (i) =>
          !(flags[i]! & 16) &&
          outside(cellPoint(i)) &&
          [i - 2, i + 2, i - cols * 2, i + cols * 2].some(
            (j) => j >= 0 && j < flags.length && !!(flags[j]! & 16),
          ),
        false,
      );
    }
    if (pyraContinent) {
      const dryLand = (i: number) => !!(flags[i]! & 16) && outside(cellPoint(i));
      texture(
        pattern(terrainPrefix + "leaves"),
        0.95,
        (i) => {
          const p = cellPoint(i);
          return (
            dryLand(i) &&
            biome[i] === 0 &&
            Math.sin(p.x / 550) + Math.sin(p.y / 720) + Math.sin((p.x + p.y) / 1100) > 0.55
          );
        },
        false,
      );
      texture(pattern(terrainPrefix + "ash-rock"), 0.8, (i) => dryLand(i) && biome[i] === 3, false);
      texture(
        pattern(terrainPrefix + "sulfur"),
        0.7,
        (i) => {
          const p = cellPoint(i);
          return dryLand(i) && biome[i] === 3 && Math.sin(p.x / 430) + Math.cos(p.y / 600) > 1.25;
        },
        false,
      );
      // Molten material stays on already impassable volcanic cells.
      texture(
        pattern(terrainPrefix + "lava"),
        1,
        (i) => dryLand(i) && pyraMoltenCell(flags[i]!, biome[i]!),
        false,
      );
    }
    if (nexusContinent) {
      const dryLand = (i: number) => !!(flags[i]! & 16) && outside(cellPoint(i));
      // Crystal crust creeps over the core wastes in slow bands.
      texture(
        pattern(terrainPrefix + "crystal-ground"),
        0.85,
        (i) => {
          const p = cellPoint(i);
          return dryLand(i) && biome[i] === 3 && Math.sin(p.x / 470) + Math.cos(p.y / 610) > 1.15;
        },
        false,
      );
      // Damp moss pools gather where the synthetic gardens hold water.
      texture(
        pattern(terrainPrefix + "damp-stone"),
        0.6,
        (i) => {
          const p = cellPoint(i);
          return dryLand(i) && biome[i] === 1 && Math.sin(p.x / 520) + Math.cos(p.y / 700) > 1.3;
        },
        false,
      );
      // Pale stone caps the plateau rims.
      texture(
        pattern(terrainPrefix + "moss-stone"),
        0.7,
        (i) => {
          const p = cellPoint(i);
          return dryLand(i) && biome[i] === 2 && Math.sin(p.x / 560) + Math.sin(p.y / 640) > 1.35;
        },
        false,
      );
      // Charged liquid stays on already impassable core cells.
      texture(
        pattern(terrainPrefix + "energy-liquid"),
        1,
        (i) => dryLand(i) && nexusEnergyCell(flags[i]!, biome[i]!),
        false,
      );
      // A shallow glow rims every waterline outside the cities.
      texture(
        pattern(terrainPrefix + "shallow-water"),
        0.7,
        (i) =>
          !(flags[i]! & 16) &&
          outside(cellPoint(i)) &&
          [i - 2, i + 2, i - cols * 2, i + cols * 2].some(
            (j) => j >= 0 && j < flags.length && !!(flags[j]! & 16),
          ),
        false,
      );
      // Dry banks fringe the wastes where land meets water.
      texture(
        pattern(terrainPrefix + "dry-bank"),
        0.6,
        (i) => {
          const p = cellPoint(i);
          return (
            dryLand(i) &&
            biome[i] === 3 &&
            Math.sin(p.x / 380) + Math.cos(p.y / 460) > 0.6 &&
            [i - 2, i + 2, i - cols * 2, i + cols * 2].some(
              (j) => j >= 0 && j < flags.length && !(flags[j]! & 16),
            )
          );
        },
        false,
      );
    }
    // Wykonanie zarejestrowanych warstw po jednej na krok generatora — kolejka pieczenia daje
    // każdej klatce budżet czasu, więc pojedyncza warstwa nie zamraża gry.
    yield;
    for (const [fill, alpha, inside, legacyTone] of textureOps) {
      runTexture(fill, alpha, inside, legacyTone);
      yield;
    }
    if (
      painted &&
      !island &&
      !paintedPyra &&
      !paintedNexus &&
      !(aetheriaContinent && wilderness && (biomes.has(2) || biomes.has(3)))
    )
      meadowLight(ctx, data.x, data.y, scale);
    const silhouette = painted ? document.createElement("canvas") : undefined;
    if (silhouette) silhouette.width = silhouette.height = resolution + 48;
    const pen = silhouette?.getContext("2d") ?? ctx;
    if (silhouette) pen.translate(24, 24);
    const strokeRoad = (
      points: [number, number][],
      width: number,
      color: string | CanvasPattern,
      target = pen,
    ) => {
      if (points.length < 2) return;
      const scaled = points.map(([x, y]) => ({ x: (x - data.x) * scale, y: (y - data.y) * scale }));
      target.beginPath();
      target.moveTo(scaled[0]!.x, scaled[0]!.y);
      for (let i = 1; i < scaled.length - 1; i++) {
        const prev = scaled[i - 1]!,
          p = scaled[i]!,
          next = scaled[i + 1]!;
        const before = Math.hypot(p.x - prev.x, p.y - prev.y),
          after = Math.hypot(next.x - p.x, next.y - p.y);
        const radius = Math.min(width * scale * 0.55, before / 3, after / 3);
        if (before < 0.01 || after < 0.01) continue;
        target.lineTo(
          p.x + ((prev.x - p.x) * radius) / before,
          p.y + ((prev.y - p.y) * radius) / before,
        );
        target.quadraticCurveTo(
          p.x,
          p.y,
          p.x + ((next.x - p.x) * radius) / after,
          p.y + ((next.y - p.y) * radius) / after,
        );
      }
      target.lineTo(scaled.at(-1)!.x, scaled.at(-1)!.y);
      target.strokeStyle = color;
      target.lineWidth = width * scale;
      target.lineCap = "round";
      target.lineJoin = "round";
      target.stroke();
    };
    const roadFill = road;
    for (const road of renderRoads) {
      const xs = road.points.map((p) => p[0]),
        ys = road.points.map((p) => p[1]);
      if (
        Math.max(...xs) + road.width < data.x ||
        Math.min(...xs) - road.width > data.x + CHUNK ||
        Math.max(...ys) + road.width < data.y ||
        Math.min(...ys) - road.width > data.y + CHUNK
      )
        continue;
      if (!painted) strokeRoad(road.points, road.width + 16, "#88916a");
      strokeRoad(
        road.points,
        road.width,
        painted ? "#fff" : (roadFill ?? (road.kind === "trail" ? "#b2a27c" : "#bdae8b")),
      );
    }
    for (const road of source.cityRoads) {
      pen.fillStyle = painted ? "#fff" : (plaza ?? roadFill ?? "#b5ad8b");
      pen.beginPath();
      pen.roundRect(
        (road.x - data.x) * scale,
        (road.y - data.y) * scale,
        road.width * scale,
        road.height * scale,
        (Math.min(road.width, road.height) * scale) / 3,
      );
      pen.fill();
    }
    if (silhouette && roadFill && !wilderness)
      paintedPaths(ctx, silhouette, roadFill, data.x, data.y, scale);
    if (continent) {
      const natural = document.createElement("canvas");
      natural.width = natural.height = resolution;
      const nc = natural.getContext("2d")!;
      const createMask = () => {
        const c = document.createElement("canvas");
        c.width = c.height = resolution + 48;
        const p = c.getContext("2d")!;
        p.translate(24, 24);
        return { c, p };
      };
      const masks: ({ c: HTMLCanvasElement; p: CanvasRenderingContext2D } | undefined)[] =
        Array.from({ length: aetheriaContinent ? 5 : 4 });
      for (const r of source.roads) {
        // Split only the presentation stroke, keeping every original point and width.
        for (let i = 1; i < r.points.length; i++) {
          const a = r.points[i - 1]!,
            b = r.points[i]!;
          const mx = (a[0] + b[0]) / 2,
            my = (a[1] + b[1]) / 2;
          if (
            Math.max(a[0], b[0]) + r.width < data.x ||
            Math.min(a[0], b[0]) - r.width > data.x + CHUNK ||
            Math.max(a[1], b[1]) + r.width < data.y ||
            Math.min(a[1], b[1]) - r.width > data.y + CHUNK
          )
            continue;
          const col = Math.max(0, Math.min(cols - 1, Math.floor(((mx - data.x) / CHUNK) * cols)));
          const row = Math.max(0, Math.min(rows - 1, Math.floor(((my - data.y) / CHUNK) * rows)));
          const nearWater =
            aetheriaContinent &&
            [
              row * cols + col - 2,
              row * cols + col + 2,
              (row - 2) * cols + col,
              (row + 2) * cols + col,
            ].some((j) => j >= 0 && j < flags.length && !(flags[j]! & 16));
          const kind = aetheriaContinent
            ? biome[row * cols + col]! >= 2
              ? 3
              : nearWater
                ? 4
                : r.kind === "road" || r.kind === "city-path"
                  ? 0
                  : biome[row * cols + col] === 1
                    ? 2
                    : 1
            : pyraContinent
              ? biome[row * cols + col]! >= 2
                ? 2
                : r.kind.includes("trail")
                  ? 3
                  : r.kind === "road" || r.kind === "city-path"
                    ? 0
                    : 1
              : biome[row * cols + col] === 2
                ? 3
                : r.kind === "road" || r.kind === "city-path"
                  ? 0
                  : r.kind.includes("trail")
                    ? 2
                    : 1;
          const mask = (masks[kind] ??= createMask());
          strokeRoad([a, b], r.width, "#fff", mask.p);
        }
      }
      for (let i = 0; i < masks.length; i++)
        if (masks[i]) {
          paintedPaths(
            nc,
            masks[i]!.c,
            pattern(terrainPrefix + "road" + (i + 1)),
            data.x,
            data.y,
            scale,
          );
          masks[i]!.c.width = masks[i]!.c.height = 0;
        }
      const mask = sctx.createImageData(cols, rows);
      for (let i = 0; i < flags.length; i++)
        mask.data[i * 4 + 3] = outside(cellPoint(i)) && !!(flags[i]! & 16) ? 255 : 0;
      sctx.putImageData(mask, 0, 0);
      nc.globalCompositeOperation = "destination-in";
      nc.drawImage(small, 0, 0, cols, rows, 0, 0, resolution, resolution);
      ctx.drawImage(natural, 0, 0);
      natural.width = natural.height = 0;
    }
    if (paintedPyra && plaza) {
      const courts = document.createElement("canvas");
      courts.width = courts.height = resolution + 48;
      const courtPen = courts.getContext("2d")!;
      courtPen.translate(24, 24);
      courtPen.fillStyle = "#fff";
      // Decorative doorstep apron; navigation and the authored world remain unchanged.
      const hall = source.art.acceptedCityBuildings.find((b) => b.binding.endsWith(".pyra-hall"));
      const aprons = hall?.door
        ? [{ x: hall.door.x - 230, y: hall.door.y + 20, width: 460, height: 300 }]
        : [];
      for (const court of [...source.cityRoads, ...aprons]) {
        if (Math.min(court.width, court.height) < 300) continue;
        courtPen.beginPath();
        courtPen.roundRect(
          (court.x - data.x) * scale,
          (court.y - data.y) * scale,
          court.width * scale,
          court.height * scale,
          20 * scale,
        );
        courtPen.fill();
      }
      paintedPaths(ctx, courts, plaza, data.x, data.y, scale);
      courts.width = courts.height = 0;
    }
    if (paintedNexus && silhouette) {
      const edge = document.createElement("canvas");
      edge.width = edge.height = resolution;
      const edgeCtx = edge.getContext("2d")!;
      // A local emissive tint keeps the supplied panel detail visible against pale paving.
      edgeCtx.fillStyle = "#129ac6";
      edgeCtx.fillRect(0, 0, resolution, resolution);
      edgeCtx.globalCompositeOperation = "destination-in";
      edgeCtx.drawImage(silhouette, -24, -24);
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = 0.38;
      ctx.drawImage(edge, 0, 0);
      ctx.restore();
      // Dilated minus original mask yields a continuous outline, including intersections.
      for (const [radius, color] of [
        [3, "#b49b5d"],
        [1.5, "#5beaff"],
      ] as const) {
        edgeCtx.clearRect(0, 0, resolution, resolution);
        edgeCtx.globalCompositeOperation = "source-over";
        const r = radius * scale;
        for (const [dx, dy] of [
          [-r, 0],
          [r, 0],
          [0, -r],
          [0, r],
        ])
          edgeCtx.drawImage(silhouette, -24 + dx!, -24 + dy!);
        edgeCtx.globalCompositeOperation = "destination-out";
        edgeCtx.drawImage(silhouette, -24, -24);
        edgeCtx.globalCompositeOperation = "source-in";
        edgeCtx.fillStyle = color;
        edgeCtx.fillRect(0, 0, resolution, resolution);
        ctx.drawImage(edge, 0, 0);
      }
      edge.width = edge.height = 0;
    }
    if (paintedNexus && plaza) {
      const hall = source.art.acceptedCityBuildings.find((b) => b.binding.endsWith(".nexus-hall"));
      if (hall?.door) {
        const apron = document.createElement("canvas");
        apron.width = apron.height = resolution + 48;
        const pen = apron.getContext("2d")!;
        pen.fillStyle = "#fff";
        pen.fillRect(
          24 + (hall.door.x - 230 - data.x) * scale,
          24 + (hall.door.y + 20 - data.y) * scale,
          460 * scale,
          280 * scale,
        );
        paintedPaths(ctx, apron, plaza, data.x, data.y, scale);
        apron.width = apron.height = 0;
      }
    }
    if (silhouette) silhouette.width = silhouette.height = 0;
    tex.refresh();
    return {
      key,
      image: scene.add
        // A one-unit bleed prevents subpixel cracks between wilderness tiles when zooming.
        .image(
          data.x - (aetheriaContinent && wilderness ? 1 : 0),
          data.y - (aetheriaContinent && wilderness ? 1 : 0),
          key,
        )
        .setOrigin(0)
        .setDisplaySize(
          CHUNK + (aetheriaContinent && wilderness ? 2 : 0),
          CHUNK + (aetheriaContinent && wilderness ? 2 : 0),
        )
        .setDepth(renderDepth("ground"))
        // Slightly darker, cooler ground and scenery keep the actors in the foreground.
        .setTint(0xd0d4dc)
        .setVisible(visible),
    };
  }
  // Faza 5: pieczenie przyrostowe. Zamiast synchronicznego drawGround (zamrożenie 600–1760 ms),
  // kolejka prowadzi generator warstwa po warstwie z budżetem czasu na klatkę. Jeden chunk naraz
  // (współdzielone płótna robocze), ale jego koszt rozkłada się na wiele klatek. Adaptacyjna
  // rozdzielczość (nextGroundResolution) i telemetria (recordBake) reagują na najwolniejszy krok.
  const bakeQueue: { data: BrowserChunk; id: string; items: ArtObject[] }[] = [];
  type ActiveBake = {
    data: BrowserChunk;
    id: string;
    items: ArtObject[];
    gen: Generator<void, GroundResult, unknown>;
    maxStepMs: number;
  };
  let activeBake: ActiveBake | null = null;
  const BAKE_BUDGET_MS = 8;
  const finalizeBake = (bake: ActiveBake, ground: GroundResult) => {
    const grid = buildSceneryGrid(bake.items);
    const index = new Map(bake.items.map((item, i) => [item.id, i] as const));
    live.set(bake.id, {
      data: bake.data,
      items: bake.items,
      ground: ground.image,
      images: new Map(),
      shadows: new Map(),
      grid,
      reach: sceneryReach(bake.items),
      index,
      key: ground.key,
    });
    pending.delete(bake.id);
    recordBake(bake.maxStepMs, adaptive);
    // Bez ręcznego profilu (?ki-ground-res) urządzenie samo schodzi z rozdzielczością, gdy krok jest wolny.
    if (groundProfile === null) adaptive = nextGroundResolution(adaptive, bake.maxStepMs);
  };
  const cancelBake = (bake: ActiveBake) => {
    scene.textures.remove("superior-ground:" + bake.id);
    pending.delete(bake.id);
    source.release(scene, bake.id);
  };
  const drainBakes = () => {
    const start = performance.now();
    while (!activeBake && bakeQueue.length) {
      const entry = bakeQueue.shift()!;
      if (disposed || failed || !wanted.has(entry.id)) {
        pending.delete(entry.id);
        source.release(scene, entry.id);
        continue;
      }
      activeBake = { ...entry, gen: drawGround(entry.data, entry.id), maxStepMs: 0 };
    }
    if (!activeBake) return;
    if (disposed || failed || !wanted.has(activeBake.id)) {
      cancelBake(activeBake);
      activeBake = null;
      return;
    }
    // Co najmniej jeden krok na klatkę; kolejne tylko jeśli mieszczą się w budżecie czasu.
    do {
      const stepStart = performance.now();
      const step = activeBake.gen.next();
      const stepMs = performance.now() - stepStart;
      if (stepMs > activeBake.maxStepMs) activeBake.maxStepMs = stepMs;
      if (step.done) {
        finalizeBake(activeBake, step.value);
        activeBake = null;
        break;
      }
    } while (performance.now() - start < BAKE_BUDGET_MS);
  };
  const load = async (x: number, y: number) => {
    const id = x + "-" + y;
    pending.add(id);
    try {
      const [data, art] = await Promise.all([source.loader.loadChunk(x, y), source.readArt(x, y)]);
      if (disposed || !wanted.has(id)) {
        pending.delete(id);
        return;
      }
      const originalItems = [...art, ...(staticGrid.get(id) ?? [])];
      const biomeAt = aetheriaContinent
        ? aetheriaBiomeAt(data)
        : nexusContinent
          ? nexusBiomeAt(data)
          : continent && dress
            ? dressBiomeAt(data)
            : () => 0;
      const items = aetheriaContinent
        ? aetheriaObjects(originalItems, outside, source.roads, biomeAt)
        : nexusContinent
          ? nexusObjects(originalItems, outside, source.roads, biomeAt)
          : continent
            ? remapObjects(originalItems, outside, source.roads)
            : originalItems;
      if (continent) {
        const flags = decodeRuns(data.terrain.flags, data.terrain.width * data.terrain.height);
        const onLand = (p: Point) => {
          const col = Math.floor(((p.x - data.x) / CHUNK) * data.terrain.width),
            row = Math.floor(((p.y - data.y) / CHUNK) * data.terrain.height);
          return !!(flags[row * data.terrain.width + col]! & 16);
        };
        items.push(
          ...(nexusContinent ? nexusRoadside : aetheriaContinent ? aetheriaRoadside : roadside)(
            data.x,
            data.y,
            source.roads,
            outside,
            onLand,
            biomeAt,
          ),
        );
        if (dress) {
          items.push(
            ...continentDress(feature, data.x, data.y, source.roads, outside, onLand, biomeAt),
          );
          items.push(...continentAir(feature, data.x, data.y, outside, onLand));
        } else if (nexusContinent) {
          items.push(...nexusScatter(data.x, data.y, source.roads, outside, onLand, biomeAt));
          items.push(...nexusAir(data.x, data.y, outside, onLand, biomeAt));
        }
      }
      const ids = new Set(
        [...source.art.groundByBiome, source.art.water, source.art.road, source.art.plaza]
          .filter((b): b is string => !!b)
          .map(textureId),
      );
      if (paintedNexus) ids.add(textureId("terrain.nexus-painted-courtyard"));
      if (continent) for (const key of terrainBindings) ids.add(textureId(key));
      for (const item of items) ids.add(textureId(item.binding));
      await source.acquire(scene, ids, id);
      if (disposed || !wanted.has(id)) {
        source.release(scene, id);
        pending.delete(id);
        return;
      }
      // Faza 2: bake odkładany do kolejki drenowanej po maks. 2 na klatkę, nie tu synchronicznie.
      bakeQueue.push({ data, id, items });
    } catch (error) {
      pending.delete(id);
      if (!disposed) {
        failed = true;
        source.error(error);
      }
    }
  };
  const updateVisibility = (player: Point, others: readonly OcclusionFocus[] = []) => {
    if (disposed || failed || !visible) return;
    drainBakes();
    const view = scene.cameras.main.worldView;
    const maxX = Math.ceil(source.loader.definition.geometry.width / CHUNK) - 1;
    const maxY = Math.ceil(source.loader.definition.geometry.height / CHUNK) - 1;
    const x0 = Math.max(0, Math.floor(view.left / CHUNK) - 1),
      x1 = Math.min(maxX, Math.floor(view.right / CHUNK) + 1);
    const y0 = Math.max(0, Math.floor(view.top / CHUNK) - 1),
      y1 = Math.min(maxY, Math.floor(view.bottom / CHUNK) + 1);
    const key = [x0, x1, y0, y1].join(":");
    if (key !== lastCells) {
      lastCells = key;
      const tiles: { x: number; y: number; visible: boolean; distance: number }[] = [];
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++)
          tiles.push({
            x,
            y,
            visible:
              (x + 1) * CHUNK >= view.left &&
              x * CHUNK <= view.right &&
              (y + 1) * CHUNK >= view.top &&
              y * CHUNK <= view.bottom,
            distance: Math.hypot(
              x * CHUNK + CHUNK / 2 - player.x,
              y * CHUNK + CHUNK / 2 - player.y,
            ),
          });
      tiles.sort((a, b) => Number(b.visible) - Number(a.visible) || a.distance - b.distance);
      // Every visible tile is retained even on an unusually wide desktop viewport.
      const selected = tiles.slice(0, Math.max(12, tiles.filter((t) => t.visible).length));
      wanted = new Set(selected.map((t) => t.x + "-" + t.y));
      for (const id of live.keys()) if (!wanted.has(id)) drop(id);
    }
    // A previous request may finish after its cell left the view. Reconcile every
    // frame so returning to that cell never leaves a permanent hole.
    for (const id of wanted) {
      if (live.has(id) || pending.has(id)) continue;
      const [x, y] = id.split("-").map(Number);
      void load(x!, y!);
    }
    for (const tile of live.values()) {
      // Audyt 11.11.2026: pętla szła po wszystkich obiektach wszystkich chunków co klatkę
      // (3840 obiektów w mieście). Siatka z renderera v1 wybiera tylko komórki w kadrze,
      // powiększone o zasięg największego obiektu, więc żaden widoczny nie wypada.
      const near = sceneryNear(tile.grid, view, 200 + tile.reach);
      const candidates = new Set(near);
      // Obraz, którego obiekt wyszedł poza kandydatów, na pewno nie jest już widoczny.
      for (const [id, image] of tile.images) {
        const at = tile.index.get(id);
        if (at !== undefined && candidates.has(at)) continue;
        image.destroy();
        tile.images.delete(id);
        tile.shadows.get(id)?.destroy();
        tile.shadows.delete(id);
      }
      for (const at of near) {
        const item = tile.items[at]!;
        let image = tile.images.get(item.id);
        if (!intersects(item, view, 200)) {
          if (image) {
            image.destroy();
            tile.images.delete(item.id);
            tile.shadows.get(item.id)?.destroy();
            tile.shadows.delete(item.id);
          }
          continue;
        }
        if (!image) {
          const ref = catalog.renderBindings[item.binding]!;
          const iceFormation =
            aetheriaContinent && item.binding === "object.aetheria-continent.glacier-ridge";
          const drawScale = iceFormation
            ? 0.65 + aetheriaNoise(item.x + 11, item.y - 29) * 0.25
            : 1;
          image = sizeScenery(
            scene.add.image(
              item.x,
              item.y,
              (paintedPyra && ref.asset.startsWith("pyra-painted-")) ||
                (paintedNexus && ref.asset.startsWith("nexus-painted-")) ||
                ref.asset.startsWith("verdantia-continent-") ||
                ref.asset.startsWith("verdantia-extra-") ||
                ref.asset.startsWith("pyra-continent-") ||
                ref.asset.startsWith("aetheria-continent-")
                ? ref.asset
                : blendedTexture(scene, ref.asset, ref.frame),
              ref.frame,
            ),
            item.width * drawScale,
            item.height * drawScale,
            ref.fit,
          )
            .setOrigin(
              island && ref.origin ? ref.origin[0] : item.anchorX,
              island && ref.origin ? ref.origin[1] : item.anchorY,
            )
            .setTint(
              ref.asset.startsWith("verdantia-continent-") ||
                ref.asset.startsWith("verdantia-extra-") ||
                ref.asset.startsWith("pyra-continent-") ||
                ref.asset.startsWith("aetheria-continent-")
                ? 0xf5f2de
                : 0xdfe2e8,
            )
            .setDepth(renderDepth(item.layer ?? "objects", item.y));
          if (iceFormation) image.setFlipX(aetheriaNoise(item.x, item.y) > 0.5);
          tile.images.set(item.id, image);
          if (
            item.kind !== "ambient-effect" &&
            (ref.asset.startsWith("verdantia-continent-") ||
              ref.asset.startsWith("verdantia-extra-") ||
              ref.asset.startsWith("pyra-continent-") ||
              ref.asset.startsWith("aetheria-continent-") ||
              ref.asset.startsWith("nexus-continent-"))
          ) {
            // A shared transparent sprite can straddle a chunk boundary without a cut shadow.
            tile.shadows.set(
              item.id,
              scene.add
                .image(item.x + item.width * 0.08, item.y, shadowKey)
                .setDisplaySize(item.width * drawScale * 0.84, item.width * drawScale * 0.35)
                .setDepth(renderDepth("paths")),
            );
          }
        }
        image.setAlpha(Math.min(occlusionAlpha(item, player), foliageAlpha(item, others)));
        if ((pyraContinent || nexusContinent) && item.kind === "ambient-effect") {
          const frame = nexusContinent
            ? nexusEffectFrame(item, scene.time.now)
            : pyraEffectFrame(item, scene.time.now);
          image.setPosition(frame.x, frame.y).setAlpha(frame.alpha);
          tile.shadows.get(item.id)?.setVisible(false);
        }
      }
    }
    const doors = source.currentDoors(),
      nextKey = doors.map((d) => d.door.x + "," + d.door.y).join(";");
    if (nextKey !== doorsKey) {
      doorsKey = nextKey;
      markers.splice(0).forEach((m) => m.destroy());
      for (const d of doors) {
        markers.push(
          scene.add
            .ellipse(d.door.x, d.door.y, 90, 30, 0xe5ca79, 0.2)
            .setStrokeStyle(2, 0xd7c77d)
            .setDepth(renderDepth("below", d.door.y)),
        );
        // The name floats above the building (its roof), not under the door. The building whose
        // door this is gives the top edge; a door without a drawn building falls back to a spot above it.
        const house = staticItems.find(
          (i) => i.door && i.door.x === d.door.x && i.door.y === d.door.y,
        );
        // The art has an empty margin above the roof, so the label sits a tenth of the height inside it.
        const top = house
          ? house.y - house.height * house.anchorY + house.height * 0.1
          : d.door.y - 150;
        markers.push(
          scene.add
            .text(d.door.x, top, d.name, {
              fontSize: "20px",
              color: "#fff1cc",
              stroke: "#142a24",
              strokeThickness: 4,
            })
            .setOrigin(0.5, 1)
            .setDepth(renderDepth("labels")),
        );
      }
    }
    scene.game.canvas.dataset["islandArt"] = island ? feature : "off";
    scene.game.canvas.dataset["superiorChunks"] = String(live.size);
    scene.game.canvas.dataset["superiorPending"] = String(pending.size);
    scene.game.canvas.dataset["superiorPainted"] = String(painted);
    scene.game.canvas.dataset["verdantiaContinent"] = String(verdantContinent);
    scene.game.canvas.dataset["pyraContinent"] = String(pyraContinent);
    scene.game.canvas.dataset["aetheriaContinent"] = String(aetheriaContinent);
    scene.game.canvas.dataset["nexusContinent"] = String(nexusContinent);
    scene.game.canvas.dataset["verdantiaExtra"] = String(verdantContinent && extraSceneryEnabled());
    scene.game.canvas.dataset["superiorGroundResolution"] = String(adaptive);
    let sceneryCount = 0;
    let dressCount = 0;
    for (const t of live.values()) {
      sceneryCount += t.images.size;
      if (dress) {
        for (const k of t.images.keys())
          if (k.startsWith("dress-") || k.startsWith("town-dress-")) dressCount++;
      }
    }
    scene.game.canvas.dataset["superiorScenery"] = String(sceneryCount);
    if (dress) scene.game.canvas.dataset["dressScenery"] = String(dressCount);
  };
  return {
    terrainMode: "superior",
    updateVisibility,
    setVisible(value: boolean) {
      visible = value;
      for (const tile of live.values()) {
        tile.ground.setVisible(value);
        for (const image of tile.images.values()) image.setVisible(value);
        for (const shadow of tile.shadows.values()) shadow.setVisible(value);
      }
      for (const marker of markers) marker.setVisible(value);
    },
    dispose() {
      disposed = true;
      if (activeBake) {
        cancelBake(activeBake);
        activeBake = null;
      }
      for (const entry of bakeQueue.splice(0)) {
        pending.delete(entry.id);
        source.release(scene, entry.id);
      }
      for (const id of [...live.keys()]) drop(id);
      if (continent && scene.textures.exists(shadowKey)) scene.textures.remove(shadowKey);
      materials.clear();
      markers.splice(0).forEach((m) => m.destroy());
    },
  };
}
