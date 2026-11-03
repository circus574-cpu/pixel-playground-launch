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
/** `?ki-beauty=1`: denser painted detail on the ground and a sharper, fully opaque ground texture (trial). */
const BEAUTY =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("ki-beauty") === "1";
const SCATTER: Record<string, { w: number; h: number; weight: number; anchorY?: number }> = {
  "object.ki-v2-objects.verdant-bush-0": { w: 150, h: 140, weight: 3 },
  "object.ki-v2-objects.verdant-bush-1": { w: 140, h: 130, weight: 3 },
  "object.ki-v2-objects.verdant-bush-2": { w: 150, h: 140, weight: 2 },
  "object.ki-v2-objects.verdant-flowerbush-0": { w: 130, h: 105, weight: 4 },
  "object.ki-v2-objects.verdant-flowerbush-1": { w: 130, h: 105, weight: 4 },
  "object.ki-v2-objects.verdant-flowerbush-2": { w: 130, h: 105, weight: 3 },
  "object.ki-v2-objects.verdant-fern-0": { w: 100, h: 125, weight: 4 },
  "object.ki-v2-objects.verdant-fern-1": { w: 100, h: 125, weight: 4 },
  "object.ki-v2-objects.verdant-fern-2": { w: 100, h: 125, weight: 3 },
  "object.ki-v2-objects.verdant-boulder-0": { w: 120, h: 120, weight: 1 },
  "object.ki-v2-objects.verdant-rocks-3": { w: 110, h: 105, weight: 1 },
  "object.ki-v2-objects.verdant-mushrooms-1": { w: 90, h: 80, weight: 1 },
};
/** Ground canvas per chunk: 512 px (4 world units per pixel), or 1024 px with `?ki-beauty=1`. */
const GROUND_PX = BEAUTY ? 1024 : 512;
const GROUND_K = 2048 / GROUND_PX;
const hash2 = (a: number, b: number, c = 0) => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
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
const layerCanvas = () => {
  if (!layer) {
    layer = document.createElement("canvas");
    layer.width = layer.height = GROUND_PX;
  }
  return layer;
};
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
    ...(source.art.landmarks ?? []),
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
    // 512² RGBA per chunk = 1 MiB, independent of its 2048² world footprint.
    const tex = scene.textures.createCanvas(key, GROUND_PX, GROUND_PX);
    if (!tex) throw Error("Nie można przygotować terenu");
    const ctx = tex.getContext();
    const pattern = (binding: string) => {
      const image = scene.textures.get(textureId(binding)).getSourceImage() as HTMLImageElement;
      const tile = ctx.createPattern(image, "repeat")!;
      const size = catalog.renderBindings[binding]?.tileSize ?? [256, 256];
      // The canvas is four times smaller than its world footprint. Preserve the
      // authored world-unit tile size instead of enlarging grass to 2048 units.
      tile.setTransform(
        new DOMMatrix().scale(size[0] / GROUND_K / image.width, size[1] / GROUND_K / image.height),
      );
      return tile;
    };
    const ground = source.art.groundByBiome.map(pattern),
      water = pattern(source.art.water),
      road = source.art.road ? pattern(source.art.road) : undefined,
      plaza = source.art.plaza ? pattern(source.art.plaza) : undefined;
    // Painted sets (with a road texture) are meant to be seen; the legacy kit stays a faint tint.
    const groundAlpha = road ? (BEAUTY ? 1 : 0.6) : 0.15,
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
    ctx.drawImage(small, 0, 0, cols, rows, 0, 0, GROUND_PX, GROUND_PX);
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
      lctx.clearRect(0, 0, GROUND_PX, GROUND_PX);
      lctx.fillStyle = fill;
      lctx.fillRect(0, 0, GROUND_PX, GROUND_PX);
      lctx.globalCompositeOperation = "destination-in";
      lctx.imageSmoothingEnabled = true;
      lctx.imageSmoothingQuality = "high";
      lctx.drawImage(small, 0, 0, cols, rows, 0, 0, GROUND_PX, GROUND_PX);
      ctx.globalAlpha = alpha;
      ctx.drawImage(layer, 0, 0);
      ctx.globalAlpha = 1;
    };
    for (const b of biomes)
      texture(ground[b] ?? ground[0]!, groundAlpha, (i) => !!(flags[i]! & 16) && biome[i] === b);
    texture(water, waterAlpha, (i) => !(flags[i]! & 16));
    const strokeRoad = (
      points: [number, number][],
      width: number,
      color: string | CanvasPattern,
    ) => {
      if (points.length < 2) return;
      const scaled = points.map(([x, y]) => ({
        x: (x - data.x) / GROUND_K,
        y: (y - data.y) / GROUND_K,
      }));
      ctx.beginPath();
      ctx.moveTo(scaled[0]!.x, scaled[0]!.y);
      for (let i = 1; i < scaled.length - 1; i++) {
        const prev = scaled[i - 1]!,
          p = scaled[i]!,
          next = scaled[i + 1]!;
        const before = Math.hypot(p.x - prev.x, p.y - prev.y),
          after = Math.hypot(next.x - p.x, next.y - p.y);
        const radius = Math.min((width / GROUND_K) * 0.55, before / 3, after / 3);
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
      ctx.lineWidth = width / GROUND_K;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
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
      strokeRoad(road.points, road.width + 16, "#88916a");
      strokeRoad(
        road.points,
        road.width,
        roadFill ?? (road.kind === "trail" ? "#b2a27c" : "#bdae8b"),
      );
    }
    for (const road of source.cityRoads) {
      ctx.fillStyle = plaza ?? roadFill ?? "#b5ad8b";
      ctx.beginPath();
      ctx.roundRect(
        (road.x - data.x) / GROUND_K,
        (road.y - data.y) / GROUND_K,
        road.width / GROUND_K,
        road.height / GROUND_K,
        Math.min(road.width, road.height) / 12,
      );
      ctx.fill();
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
  /** Deterministic extra bushes, flowers and ferns on open grass: never on roads, water, plazas or near other objects. */
  const scatterDecor = (
    cx: number,
    cy: number,
    data: BrowserChunk,
    existing: ArtObject[],
  ): ArtObject[] => {
    const flags = decodeRuns(data.terrain.flags, data.terrain.width * data.terrain.height);
    const biome = decodeRuns(data.terrain.biome, flags.length);
    const cell = CHUNK / data.terrain.width;
    const total = Object.values(SCATTER).reduce((n, v) => n + v.weight, 0);
    const keys = Object.keys(SCATTER).filter((k) => catalog.renderBindings[k]);
    if (!keys.length) return [];
    const nearRoad = (px: number, py: number) => {
      for (const r of source.roads) {
        const m = r.width / 2 + 90;
        for (let i = 1; i < r.points.length; i++) {
          const [ax, ay] = r.points[i - 1]!,
            [bx, by] = r.points[i]!;
          const dx = bx - ax,
            dy = by - ay,
            l2 = dx * dx + dy * dy || 1;
          const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
          if (Math.hypot(px - (ax + t * dx), py - (ay + t * dy)) < m) return true;
        }
      }
      for (const r of source.cityRoads)
        if (px > r.x - 90 && px < r.x + r.width + 90 && py > r.y - 90 && py < r.y + r.height + 90)
          return true;
      return false;
    };
    const out: ArtObject[] = [];
    const STEP = 230;
    for (let gy = 0; gy < CHUNK / STEP; gy++)
      for (let gx = 0; gx < CHUNK / STEP; gx++) {
        const seed = hash2(cx * 97 + gx, cy * 89 + gy);
        if (seed > 0.62) continue;
        const px = data.x + gx * STEP + hash2(cx, cy, gx * 31 + gy * 7) * STEP;
        const py = data.y + gy * STEP + hash2(gx, gy, cx * 13 + cy * 5) * STEP;
        const col = Math.min(data.terrain.width - 1, Math.floor((px - data.x) / cell));
        const row = Math.min(data.terrain.height - 1, Math.floor((py - data.y) / cell));
        const i = row * data.terrain.width + col;
        if (!(flags[i]! & 16)) continue;
        // Keep a margin from the coast and from non-grass biomes.
        let ok = true;
        for (const [dx, dy] of [
          [-2, 0],
          [2, 0],
          [0, -2],
          [0, 2],
        ] as const) {
          const c2 = Math.max(0, Math.min(data.terrain.width - 1, col + dx)),
            r2 = Math.max(0, Math.min(data.terrain.height - 1, row + dy));
          if (!(flags[r2 * data.terrain.width + c2]! & 16)) ok = false;
        }
        if (!ok || nearRoad(px, py)) continue;
        if (existing.some((o) => Math.abs(o.x - px) < 150 && Math.abs(o.y - py) < 110)) continue;
        let pick = hash2(cx + gx, cy + gy, 5) * total;
        let key = keys[0]!;
        for (const k of keys) {
          pick -= SCATTER[k]!.weight;
          if (pick <= 0) {
            key = k;
            break;
          }
        }
        const spec = SCATTER[key]!;
        const k = 0.85 + hash2(gx, gy, cx + cy) * 0.5;
        out.push({
          id: `beauty-${cx}-${cy}-${gx}-${gy}`,
          kind: "beauty",
          x: px,
          y: py,
          width: spec.w * k,
          height: spec.h * k,
          anchorX: 0.5,
          anchorY: 0.92,
          binding: key,
          layer: "objects",
        } as ArtObject);
      }
    return out;
  };
  const load = async (x: number, y: number) => {
    const id = x + "-" + y;
    pending.add(id);
    try {
      const [data, art] = await Promise.all([source.loader.loadChunk(x, y), source.readArt(x, y)]);
      if (disposed || !wanted.has(id)) return;
      const base = [...art, ...(staticGrid.get(id) ?? [])];
      const items = BEAUTY ? [...base, ...scatterDecor(x, y, data, base)] : base;
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
