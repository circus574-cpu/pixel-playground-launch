import type Phaser from "phaser";
import { catalog } from "../../assets/catalog";
import { sizeScenery } from "../../assets/scenery";
import { renderDepth } from "../../assets/layers";
import { blendedTexture } from "../../assets/blendPlates";
import { coversPlayer } from "../visibility";
import { decodeRuns } from "./browserTerrain";
import type { Point } from "../../navigation";
import type { RegionObject } from "../types";
import type { loadBrowserFeature, BrowserChunk } from "./browserLoader";

export type ArtObject = RegionObject & {
  binding: string;
  layer?: "below" | "objects" | "overhead";
};
export type FeatureArt = {
  groundByBiome: string[];
  water: string;
  /** Painted paving for streets and roads, chosen by the runtime for the land's people. */
  path?: string;
  trail?: string;
  buildings: ArtObject[];
  acceptedCityBuildings: ArtObject[];
  acceptedCityScenery?: ArtObject[];
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
  /** True for ground inside a settlement, where the stamped street grid is not drawn. */
  paveOver?: (x: number, y: number) => boolean;
};
const CHUNK = 2048;
/** Ground canvas pixels per chunk side: 2 world units per pixel keeps painted detail crisp on phones. */
const PX = 1024,
  SCALE = CHUNK / PX;
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
let tonesCanvas: HTMLCanvasElement | undefined;
const toneCanvas = (width: number, height: number) => {
  tonesCanvas ??= document.createElement("canvas");
  tonesCanvas.width = width;
  tonesCanvas.height = height;
  return tonesCanvas;
};
const layerCanvas = () => {
  if (!layer) {
    layer = document.createElement("canvas");
    layer.width = layer.height = PX;
  }
  return layer;
};
/** Smooth value noise in world units, identical across chunk borders. */
function drift(x: number, y: number, cell: number, seed: number) {
  const hash = (i: number, j: number) => {
    const h = Math.sin(i * 127.1 + j * 311.7 + seed * 74.7) * 43758.5453;
    return h - Math.floor(h);
  };
  const gx = x / cell,
    gy = y / cell,
    i = Math.floor(gx),
    j = Math.floor(gy),
    fx = gx - i,
    fy = gy - j;
  const u = fx * fx * (3 - 2 * fx),
    v = fy * fy * (3 - 2 * fy);
  const a = hash(i, j),
    b = hash(i + 1, j),
    c = hash(i, j + 1),
    d = hash(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** Warm light pools and cool shade drifting over the ground, like a painted background. */
function paintDrift(ctx: CanvasRenderingContext2D, x0: number, y0: number) {
  const n = 32,
    cells = cellCanvas(n + 1, n + 1),
    c = cells.getContext("2d")!,
    img = c.createImageData(n + 1, n + 1);
  for (let j = 0; j <= n; j++)
    for (let i = 0; i <= n; i++) {
      const wx = x0 + (i * CHUNK) / n,
        wy = y0 + (j * CHUNK) / n;
      const light = drift(wx, wy, 1400, 1) * 0.65 + drift(wx, wy, 520, 2) * 0.35;
      const k = (j * (n + 1) + i) * 4;
      // Bright, warm sunlit areas and deeper, cooler shaded ones.
      img.data[k] = light > 0.5 ? 255 : 20;
      img.data[k + 1] = light > 0.5 ? 236 : 40;
      img.data[k + 2] = light > 0.5 ? 170 : 70;
      img.data[k + 3] = Math.round(Math.abs(light - 0.5) * 2 * 70);
    }
  c.putImageData(img, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = "soft-light";
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // Sample cell centres so neighbouring chunks meet on identical values.
  ctx.drawImage(cells, 0.5, 0.5, n, n, -PX / (2 * n), -PX / (2 * n), PX + PX / n, PX + PX / n);
  ctx.restore();
}
/** Only streamed chunks have canvases; only nearby decorations have Phaser images. */
export function renderSuperior(scene: Phaser.Scene, source: RenderSource) {
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
    ...source.art.buildings,
    ...source.art.acceptedCityBuildings,
    ...(source.art.acceptedCityScenery ?? []),
    ...source.art.resources,
    ...source.art.dungeonEntrances,
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
    // PX² RGBA per chunk (4 MiB), independent of its 2048² world footprint.
    const tex = scene.textures.createCanvas(key, PX, PX);
    if (!tex) throw Error("Nie można przygotować terenu");
    const ctx = tex.getContext();
    const pattern = (binding: string, scale = 1) => {
      const image = scene.textures.get(textureId(binding)).getSourceImage() as HTMLImageElement;
      const tile = ctx.createPattern(image, "repeat")!;
      const size = catalog.renderBindings[binding]?.tileSize ?? [256, 256];
      // Preserve the authored world-unit tile size on the scaled canvas.
      tile.setTransform(
        new DOMMatrix().scale(
          (scale * size[0]) / SCALE / image.width,
          (scale * size[1]) / SCALE / image.height,
        ),
      );
      return tile;
    };
    const ground = source.art.groundByBiome.map((b) => pattern(b)),
      water = pattern(source.art.water),
      // Paving stones at about half the authored tile size read as streets, not boulders.
      path = pattern(source.art.path ?? "terrain.city-stone", 0.5),
      trail = pattern(source.art.trail ?? source.art.path ?? "terrain.city-stone", 0.5);
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
      // Inside a settlement the generator stamped its ruled street grid into the biome map;
      // streets are painted as lanes instead, so those cells read as the land's grass.
      if (land && source.paveOver?.(data.x + (i % cols) * 32, data.y + Math.floor(i / cols) * 32))
        biome[i] = 0;
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
    // Keep the base colours: the scratch cell canvas is reused for texture masks below.
    const tones = toneCanvas(cols, rows);
    tones.getContext("2d")!.drawImage(small, 0, 0);
    const colourCells = () => tones;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(small, 0, 0, cols, rows, 0, 0, PX, PX);
    // Low-contrast texture reads as a continuous ground surface rather than a board of
    // repeated pictures; each texture fades in through the same smoothed cell mask.
    const layer = layerCanvas(),
      lctx = layer.getContext("2d")!;
    const texture = (fill: CanvasPattern, alpha: number, inside: (i: number) => boolean) => {
      const mask = sctx.createImageData(cols, rows);
      for (let i = 0; i < flags.length; i++) mask.data[i * 4 + 3] = inside(i) ? 255 : 0;
      sctx.clearRect(0, 0, cols, rows);
      sctx.putImageData(mask, 0, 0);
      lctx.globalCompositeOperation = "source-over";
      lctx.clearRect(0, 0, PX, PX);
      lctx.fillStyle = fill;
      lctx.fillRect(0, 0, PX, PX);
      // A second, rotated and shifted copy breaks the visible repeat of the painted tile.
      lctx.save();
      lctx.globalAlpha = 0.45;
      lctx.translate(PX / 2, PX / 2);
      lctx.rotate(0.65);
      lctx.translate(-PX / 2 + 37, -PX / 2 + 91);
      lctx.fillRect(-PX, -PX, PX * 3, PX * 3);
      lctx.restore();
      lctx.globalCompositeOperation = "destination-in";
      lctx.imageSmoothingEnabled = true;
      lctx.imageSmoothingQuality = "high";
      lctx.drawImage(small, 0, 0, cols, rows, 0, 0, PX, PX);
      ctx.globalAlpha = alpha;
      ctx.drawImage(layer, 0, 0);
      ctx.globalAlpha = 1;
    };
    for (const b of biomes)
      texture(ground[b] ?? ground[0]!, 0.8, (i) => !!(flags[i]! & 16) && biome[i] === b);
    texture(water, 0.85, (i) => !(flags[i]! & 16));
    // Calm the painted detail toward each biome's base colour so flowers and leaves read as
    // texture, not confetti.
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.globalCompositeOperation = "color";
    ctx.drawImage(colourCells(), 0, 0, cols, rows, 0, 0, PX, PX);
    ctx.restore();
    // Broad light and colour drifts, continuous across chunks, as in a painted background.
    paintDrift(ctx, data.x, data.y);
    const strokeRoad = (
      points: [number, number][],
      width: number,
      color: string | CanvasPattern,
    ) => {
      if (points.length < 2) return;
      const scaled = points.map(([x, y]) => ({ x: (x - data.x) / SCALE, y: (y - data.y) / SCALE }));
      ctx.beginPath();
      ctx.moveTo(scaled[0]!.x, scaled[0]!.y);
      for (let i = 1; i < scaled.length - 1; i++) {
        const prev = scaled[i - 1]!,
          p = scaled[i]!,
          next = scaled[i + 1]!;
        const before = Math.hypot(p.x - prev.x, p.y - prev.y),
          after = Math.hypot(next.x - p.x, next.y - p.y);
        const radius = Math.min((width / SCALE) * 0.55, before / 3, after / 3);
        if (before < 0.01 || after < 0.01) continue;
        ctx.lineTo(
          p.x + ((prev.x - p.x) * radius) / before,
          p.y + ((prev.y - p.y) * radius) / before,
        );
        ctx.quadraticCurveTo(
          p.x,
          p.y,
          p.x + ((next.x - p.x) * radius) / after,
          p.y + ((next.y - p.y) * radius) / after,
        );
      }
      ctx.lineTo(scaled.at(-1)!.x, scaled.at(-1)!.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = width / SCALE;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    };
    const nearby = source.roads.filter((road) => {
      const xs = road.points.map((p) => p[0]),
        ys = road.points.map((p) => p[1]);
      return !(
        Math.max(...xs) + road.width < data.x ||
        Math.min(...xs) - road.width > data.x + CHUNK ||
        Math.max(...ys) + road.width < data.y ||
        Math.min(...ys) - road.width > data.y + CHUNK
      );
    });
    // Every soft verge first, then every paved surface, so lanes and plazas join seamlessly.
    ctx.save();
    ctx.shadowColor = "rgba(40, 32, 18, 0.55)";
    ctx.shadowBlur = 10;
    for (const road of nearby) strokeRoad(road.points, road.width + 12, "rgba(92, 78, 52, 0.55)");
    ctx.restore();
    for (const road of nearby)
      strokeRoad(road.points, road.width, road.kind === "trail" ? trail : path);
    for (const road of source.cityRoads) {
      // Paved streets: painted stone with a soft shadowed kerb instead of flat rectangles.
      ctx.save();
      ctx.shadowColor = "rgba(40, 32, 18, 0.5)";
      ctx.shadowBlur = 12;
      ctx.fillStyle = path;
      ctx.beginPath();
      ctx.roundRect(
        (road.x - data.x) / SCALE,
        (road.y - data.y) / SCALE,
        road.width / SCALE,
        road.height / SCALE,
        Math.min(road.width, road.height) / (SCALE * 3),
      );
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = "rgba(178, 160, 128, 0.55)";
      ctx.fill();
      ctx.restore();
    }
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
        [
          ...source.art.groundByBiome,
          source.art.water,
          source.art.path ?? "terrain.city-stone",
          source.art.trail ?? source.art.path ?? "terrain.city-stone",
        ].map(textureId),
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
  const updateVisibility = (player: Point) => {
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
        image.setAlpha(coversPlayer(item, player) ? 0.28 : 1);
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
