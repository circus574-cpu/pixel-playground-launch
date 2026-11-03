import {
  paintedMeadowEnabled,
  paintedPaths,
  meadowLight,
  meadowScenery,
  meadowBuildings,
} from "./paintedMeadow";
import type Phaser from "phaser";
import { catalog } from "../../assets/catalog";
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
  readArt: (x: number, y: number) => Promise<ArtObject[]>;
  acquire: (scene: Phaser.Scene, ids: Set<string>, owner: string) => Promise<void>;
  release: (scene: Phaser.Scene, owner: string) => void;
  error: (error: unknown) => void;
  currentDoors: () => { id: string; name: string; door: Point }[];
};
const CHUNK = 2048;
type Tile = {
  data: BrowserChunk;
  items: ArtObject[];
  ground: Phaser.GameObjects.Image;
  images: Map<string, Phaser.GameObjects.Image>;
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
  const painted = paintedMeadowEnabled(source.loader.definition.feature);
  const resolution = painted ? 1024 : 512;
  const scale = resolution / CHUNK;
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
    ...(painted ? meadowBuildings(source.art.buildings) : source.art.buildings),
    ...(painted
      ? meadowBuildings(source.art.acceptedCityBuildings)
      : source.art.acceptedCityBuildings),
    ...(source.art.acceptedCityScenery ?? []),
    ...(source.art.landmarks ?? []),
    ...source.art.resources,
    ...source.art.dungeonEntrances,
    ...(painted ? meadowScenery(source.art, source.cityRoads) : []),
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
    tile.ground.destroy();
    scene.textures.remove(tile.key);
    live.delete(id);
    source.release(scene, id);
  };
  const drawGround = (data: BrowserChunk, id: string) => {
    const flags = decodeRuns(data.terrain.flags, data.terrain.width * data.terrain.height);
    const biome = decodeRuns(data.terrain.biome, flags.length);
    const key = "superior-ground:" + id;
    // Standard chunk: 1 MiB; opt-in painted review: 4 MiB. The world footprint is unchanged.
    const tex = scene.textures.createCanvas(key, resolution, resolution);
    if (!tex) throw Error("Nie można przygotować terenu");
    const ctx = tex.getContext();
    const pattern = (binding: string) => {
      const image = scene.textures.get(textureId(binding)).getSourceImage() as HTMLImageElement;
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
    const small = cellCanvas(cols, rows),
      sctx = small.getContext("2d")!;
    const colors = sctx.createImageData(cols, rows);
    const biomes = new Set<number>();
    for (let i = 0; i < flags.length; i++) {
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
    ctx.drawImage(small, 0, 0, cols, rows, 0, 0, resolution, resolution);
    // Low-contrast texture reads as a continuous ground surface rather than a board of
    // repeated pictures; each texture fades in through the same smoothed cell mask.
    const layer = layerCanvas(resolution),
      lctx = layer.getContext("2d")!;
    // Painted mode: the cell mask is edge-clamped, padded and blurred, so biome borders are wide
    // organic gradients instead of 16 px stair-steps, with no fade at chunk borders.
    const pad = 64,
      blurPx = 34;
    let soft: HTMLCanvasElement | undefined;
    const softMask = () => {
      const big = document.createElement("canvas");
      big.width = big.height = resolution + pad * 2;
      const b = big.getContext("2d")!;
      b.imageSmoothingEnabled = true;
      b.drawImage(small, 0, 0, cols, rows, pad, pad, resolution, resolution);
      b.imageSmoothingEnabled = false;
      b.drawImage(small, 0, 0, 1, rows, 0, pad, pad, resolution);
      b.drawImage(small, cols - 1, 0, 1, rows, pad + resolution, pad, pad, resolution);
      b.drawImage(big, 0, pad, big.width, 1, 0, 0, big.width, pad);
      b.drawImage(big, 0, pad + resolution - 1, big.width, 1, 0, pad + resolution, big.width, pad);
      soft ??= document.createElement("canvas");
      soft.width = soft.height = resolution;
      const o = soft.getContext("2d")!;
      o.filter = "blur(" + blurPx + "px)";
      o.drawImage(big, -pad, -pad);
      o.filter = "none";
      return soft;
    };
    const texture = (
      fill: CanvasPattern,
      alpha: number,
      inside: (i: number) => boolean,
      tint?: string,
    ) => {
      const mask = sctx.createImageData(cols, rows);
      for (let i = 0; i < flags.length; i++) mask.data[i * 4 + 3] = inside(i) ? 255 : 0;
      sctx.clearRect(0, 0, cols, rows);
      sctx.putImageData(mask, 0, 0);
      lctx.globalCompositeOperation = "source-over";
      lctx.clearRect(0, 0, resolution, resolution);
      lctx.fillStyle = fill;
      lctx.filter = painted && fill !== water ? (tint ?? "saturate(0.82) brightness(0.9)") : "none";
      lctx.fillRect(0, 0, resolution, resolution);
      lctx.filter = "none";
      lctx.globalCompositeOperation = "destination-in";
      lctx.imageSmoothingEnabled = true;
      lctx.imageSmoothingQuality = "high";
      if (painted) lctx.drawImage(softMask(), 0, 0);
      else lctx.drawImage(small, 0, 0, cols, rows, 0, 0, resolution, resolution);
      ctx.globalAlpha = alpha;
      ctx.drawImage(layer, 0, 0);
      ctx.globalAlpha = 1;
    };
    for (const b of biomes)
      texture(
        ground[b] ?? ground[0]!,
        groundAlpha,
        (i) => !!(flags[i]! & 16) && biome[i] === b,
        // The painted forest floor is far darker than the meadow; lift it so borders read as a blend.
        source.art.groundByBiome[b]?.includes("forest")
          ? "saturate(0.9) brightness(1.18)"
          : undefined,
      );
    if (painted) {
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
    texture(water, waterAlpha, (i) => !(flags[i]! & 16));
    if (painted) meadowLight(ctx, data.x, data.y, scale);
    const silhouette = painted ? document.createElement("canvas") : undefined;
    if (silhouette) silhouette.width = silhouette.height = resolution + 48;
    const pen = silhouette?.getContext("2d") ?? ctx;
    if (silhouette) pen.translate(24, 24);
    const strokeRoad = (
      points: [number, number][],
      width: number,
      color: string | CanvasPattern,
    ) => {
      if (points.length < 2) return;
      const scaled = points.map(([x, y]) => ({ x: (x - data.x) * scale, y: (y - data.y) * scale }));
      pen.beginPath();
      pen.moveTo(scaled[0]!.x, scaled[0]!.y);
      for (let i = 1; i < scaled.length - 1; i++) {
        const prev = scaled[i - 1]!,
          p = scaled[i]!,
          next = scaled[i + 1]!;
        const before = Math.hypot(p.x - prev.x, p.y - prev.y),
          after = Math.hypot(next.x - p.x, next.y - p.y);
        const radius = Math.min(width * scale * 0.55, before / 3, after / 3);
        if (before < 0.01 || after < 0.01) continue;
        pen.lineTo(
          p.x + ((prev.x - p.x) * radius) / before,
          p.y + ((prev.y - p.y) * radius) / before,
        );
        pen.quadraticCurveTo(
          p.x,
          p.y,
          p.x + ((next.x - p.x) * radius) / after,
          p.y + ((next.y - p.y) * radius) / after,
        );
      }
      pen.lineTo(scaled.at(-1)!.x, scaled.at(-1)!.y);
      pen.strokeStyle = color;
      pen.lineWidth = width * scale;
      pen.lineCap = "round";
      pen.lineJoin = "round";
      pen.stroke();
    };
    const roadFill = road;
    for (const road of source.roads) {
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
    if (silhouette && roadFill) paintedPaths(ctx, silhouette, roadFill, data.x, data.y, scale);
    tex.refresh();
    return {
      key,
      image: scene.add
        .image(data.x, data.y, key)
        .setOrigin(0)
        .setDisplaySize(CHUNK, CHUNK)
        .setDepth(renderDepth("ground"))
        .setVisible(visible),
    };
  };
  const load = async (x: number, y: number) => {
    const id = x + "-" + y;
    pending.add(id);
    try {
      const [data, art] = await Promise.all([source.loader.loadChunk(x, y), source.readArt(x, y)]);
      if (disposed || !wanted.has(id)) return;
      const items = [...art, ...(staticGrid.get(id) ?? [])];
      const ids = new Set(
        [...source.art.groundByBiome, source.art.water, source.art.road, source.art.plaza]
          .filter((b): b is string => !!b)
          .map(textureId),
      );
      for (const item of items) ids.add(textureId(item.binding));
      await source.acquire(scene, ids, id);
      if (disposed || !wanted.has(id)) {
        source.release(scene, id);
        return;
      }
      const ground = drawGround(data, id);
      live.set(id, { data, items, ground: ground.image, images: new Map(), key: ground.key });
    } catch (error) {
      if (!disposed) {
        failed = true;
        source.error(error);
      }
    } finally {
      pending.delete(id);
    }
  };
  const updateVisibility = (player: Point, others: readonly OcclusionFocus[] = []) => {
    if (disposed || failed || !visible) return;
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
    for (const tile of live.values())
      for (const item of tile.items) {
        let image = tile.images.get(item.id);
        if (!intersects(item, view, 200)) {
          if (image) {
            image.destroy();
            tile.images.delete(item.id);
          }
          continue;
        }
        if (!image) {
          const ref = catalog.renderBindings[item.binding]!;
          image = sizeScenery(
            scene.add.image(item.x, item.y, blendedTexture(scene, ref.asset, ref.frame), ref.frame),
            item.width,
            item.height,
            ref.fit,
          )
            .setOrigin(item.anchorX, item.anchorY)
            .setDepth(renderDepth(item.layer ?? "objects", item.y));
          tile.images.set(item.id, image);
        }
        image.setAlpha(Math.min(occlusionAlpha(item, player), foliageAlpha(item, others)));
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
        markers.push(
          scene.add
            .text(d.door.x, d.door.y + 30, d.name, {
              fontSize: "20px",
              color: "#fff1cc",
              stroke: "#142a24",
              strokeThickness: 4,
            })
            .setOrigin(0.5)
            .setDepth(renderDepth("labels")),
        );
      }
    }
    scene.game.canvas.dataset["superiorChunks"] = String(live.size);
    scene.game.canvas.dataset["superiorPending"] = String(pending.size);
    scene.game.canvas.dataset["superiorPainted"] = String(painted);
    scene.game.canvas.dataset["superiorGroundResolution"] = String(resolution);
    scene.game.canvas.dataset["superiorScenery"] = String(
      [...live.values()].reduce((n, t) => n + t.images.size, 0),
    );
  };
  return {
    terrainMode: "superior",
    updateVisibility,
    setVisible(value: boolean) {
      visible = value;
      for (const tile of live.values()) {
        tile.ground.setVisible(value);
        for (const image of tile.images.values()) image.setVisible(value);
      }
      for (const marker of markers) marker.setVisible(value);
    },
    dispose() {
      disposed = true;
      for (const id of [...live.keys()]) drop(id);
      markers.splice(0).forEach((m) => m.destroy());
    },
  };
}
