import type Phaser from "phaser";
import { catalog } from "../../assets/catalog";
import { sizeScenery } from "../../assets/scenery";
import { renderDepth } from "../../assets/layers";
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
    // 512² RGBA per chunk = 1 MiB, independent of its 2048² world footprint.
    const tex = scene.textures.createCanvas(key, 512, 512);
    if (!tex) throw Error("Nie można przygotować terenu");
    const ctx = tex.getContext();
    const pattern = (binding: string) => {
      const image = scene.textures.get(textureId(binding)).getSourceImage() as HTMLImageElement;
      const tile = ctx.createPattern(image, "repeat")!;
      const size = catalog.renderBindings[binding]?.tileSize ?? [256, 256];
      // The canvas is four times smaller than its world footprint. Preserve the
      // authored world-unit tile size instead of enlarging grass to 2048 units.
      tile.setTransform(
        new DOMMatrix().scale(size[0] / 4 / image.width, size[1] / 4 / image.height),
      );
      return tile;
    };
    const ground = source.art.groundByBiome.map(pattern),
      water = pattern(source.art.water);
    const step = 512 / data.terrain.width;
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
    for (let i = 0; i < flags.length; i++) {
      const x = (i % data.terrain.width) * step,
        y = Math.floor(i / data.terrain.width) * step;
      const land = !!(flags[i]! & 16);
      ctx.fillStyle = land
        ? tone(source.art.groundByBiome[biome[i]!] ?? source.art.groundByBiome[0]!)
        : "#3b7082";
      ctx.fillRect(x, y, step + 0.1, step + 0.1);
      // Low-contrast texture reads as a continuous ground surface rather than
      // a board of repeated flower pictures. Geometry remains in the CPU field.
      ctx.globalAlpha = land ? 0.15 : 0.5;
      ctx.fillStyle = land ? (ground[biome[i]!] ?? ground[0]!) : water;
      ctx.fillRect(x, y, step + 0.1, step + 0.1);
      ctx.globalAlpha = 1;
    }
    const strokeRoad = (points: [number, number][], width: number, color: string) => {
      if (points.length < 2) return;
      const scaled = points.map(([x, y]) => ({ x: (x - data.x) / 4, y: (y - data.y) / 4 }));
      ctx.beginPath();
      ctx.moveTo(scaled[0]!.x, scaled[0]!.y);
      for (let i = 1; i < scaled.length - 1; i++) {
        const prev = scaled[i - 1]!,
          p = scaled[i]!,
          next = scaled[i + 1]!;
        const before = Math.hypot(p.x - prev.x, p.y - prev.y),
          after = Math.hypot(next.x - p.x, next.y - p.y);
        const radius = Math.min((width / 4) * 0.55, before / 3, after / 3);
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
      ctx.lineWidth = width / 4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    };
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
      strokeRoad(road.points, road.width, road.kind === "trail" ? "#b2a27c" : "#bdae8b");
    }
    for (const road of source.cityRoads) {
      ctx.fillStyle = "#b5ad8b";
      ctx.beginPath();
      ctx.roundRect(
        (road.x - data.x) / 4,
        (road.y - data.y) / 4,
        road.width / 4,
        road.height / 4,
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
  const load = async (x: number, y: number) => {
    const id = x + "-" + y;
    pending.add(id);
    try {
      const [data, art] = await Promise.all([source.loader.loadChunk(x, y), source.readArt(x, y)]);
      if (disposed || !wanted.has(id)) return;
      const items = [...art, ...(staticGrid.get(id) ?? [])];
      const ids = new Set([...source.art.groundByBiome, source.art.water].map(textureId));
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
            scene.add.image(item.x, item.y, ref.asset, ref.frame),
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
