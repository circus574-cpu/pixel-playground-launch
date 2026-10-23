import { STATIC_TERRAIN_CACHE_ENABLED } from "../features";
import { cacheForestTerrain } from "./cacheForestTerrain";
import { sizeScenery } from "../assets/scenery";
import Phaser from "phaser";
import { textureBinding } from "../assets/catalog";
import { atmosphere } from "../assets/atmosphere";
import { renderDepth } from "../assets/layers";
import { coversPlayer } from "./visibility";
import { macroVariation } from "./macroVariation";
import type { Point } from "../navigation";
import { FOREST, FOREST_OBJECTS, FOREST_ORIGIN, forestObstacles } from "./forest";
import type { WorldDefinition } from "./types";

/** World units per streamed chunk of the open ground around the painted valley. */
const FILL_CHUNK = 1024;
const FILL_KEY = "verdant-ground-fill";
/**
 * The valley's base layer is a 4×4 tile pattern (tiles 0–15 of the terrain atlas) that repeats
 * seamlessly. Composed once into a 128×128 texture, it continues the ground over the rest of the
 * continent; everything beyond the valley is plain, reachable grass.
 */
function groundFill(scene: Phaser.Scene, atlasKey: string) {
  if (scene.textures.exists(FILL_KEY)) return;
  const source = scene.textures.get(atlasKey).getSourceImage() as CanvasImageSource & {
    width: number;
  };
  const texture = scene.textures.createCanvas(FILL_KEY, 128, 128);
  if (!texture) return;
  const ctx = texture.getContext();
  const columns = Math.floor(source.width / 68);
  for (let tile = 0; tile < 16; tile++)
    ctx.drawImage(
      source,
      2 + (tile % columns) * 68,
      2 + Math.floor(tile / columns) * 68,
      64,
      64,
      (tile % 4) * 32,
      Math.floor(tile / 4) * 32,
      32,
      32,
    );
  texture.refresh();
}

/** Four tile layers share one padded atlas; all world objects share a second atlas. */
export function renderForest(scene: Phaser.Scene, world?: WorldDefinition) {
  const objects = world?.objects ?? FOREST_OBJECTS;
  const updateAtmosphere = atmosphere(scene, "verdant");
  const terrain = textureBinding("terrain.verdant", { asset: "forest-terrain" });
  const groundLayers: Phaser.Tilemaps.TilemapLayer[] = [];
  const objectRefs = new Map(
    objects.map((obj) => [
      obj.id,
      textureBinding(
        "object.verdant." + obj.id,
        textureBinding("object.forest." + obj.kind, { asset: "forest-objects", frame: obj.kind }),
      ),
    ]),
  );
  const cache = STATIC_TERRAIN_CACHE_ENABLED
    ? cacheForestTerrain(scene, terrain.asset, objectRefs, objects)
    : null;
  if (!cache)
    FOREST.layers.forEach((data, index) => {
      const map = scene.make.tilemap({ data, tileWidth: 64, tileHeight: 64 });
      const tileset = map.addTilesetImage(terrain.asset, terrain.asset, 64, 64, 2, 4);
      if (!tileset) throw new Error("Nie można otworzyć tekstur leśnej krainy.");
      const layer = map.createLayer(
        0,
        tileset,
        FOREST_ORIGIN.x,
        FOREST_ORIGIN.y,
        false,
      ) as Phaser.Tilemaps.TilemapLayer;
      layer.setScale(FOREST.tileSize / 64).setDepth(renderDepth("ground") + index);
      layer.setCullPadding(2, 2);
      groundLayers.push(layer);
    });
  const fillChunks = new Map<string, Phaser.GameObjects.TileSprite>();
  const size = world ?? { width: FOREST.width, height: FOREST.height };
  const streamFill = () => {
    if (!world || (size.width <= FOREST.width && size.height <= FOREST.height)) return;
    const view = scene.cameras.main.worldView;
    const first = (v: number) => Math.max(0, Math.floor((v - 64) / FILL_CHUNK) * FILL_CHUNK);
    for (let y = first(view.top); y < Math.min(size.height, view.bottom + 64); y += FILL_CHUNK)
      for (let x = first(view.left); x < Math.min(size.width, view.right + 64); x += FILL_CHUNK) {
        const key = x + ":" + y;
        if (fillChunks.has(key)) continue;
        fillChunks.set(
          key,
          scene.add
            .tileSprite(
              x,
              y,
              Math.min(FILL_CHUNK, size.width - x),
              Math.min(FILL_CHUNK, size.height - y),
              FILL_KEY,
            )
            .setOrigin(0)
            .setDepth(renderDepth("ground") - 1)
            .setTilePosition(x, y),
        );
      }
    for (const [key, chunk] of fillChunks) {
      const [x, y] = key.split(":").map(Number) as [number, number];
      if (
        x > view.right + 640 ||
        x + FILL_CHUNK < view.left - 640 ||
        y > view.bottom + 640 ||
        y + FILL_CHUNK < view.top - 640
      ) {
        chunk.destroy();
        fillChunks.delete(key);
      }
    }
  };
  if (world && (size.width > FOREST.width || size.height > FOREST.height)) {
    groundFill(scene, terrain.asset);
    streamFill();
  }
  const macro = world ? macroVariation(scene, size) : null;
  const scenery: {
    object: (typeof FOREST_OBJECTS)[number];
    image: Phaser.GameObjects.Image;
    shadow?: Phaser.GameObjects.Image;
  }[] = [];
  for (const obj of objects) {
    const ref = objectRefs.get(obj.id)!;
    let shadow: Phaser.GameObjects.Image | undefined;
    if (!cache && obj.kind !== "bridge") {
      shadow = scene.add
        .image(obj.x + 8, obj.y + 8, ref.asset, ref.frame)
        .setDisplaySize(obj.width, obj.height * 0.3)
        .setOrigin(0.5, 0.5)
        .setTint(0x344b68)
        .setAlpha(0.12)
        .setDepth(renderDepth("below") - 1);
    }
    const image = sizeScenery(
      scene.add.image(obj.x, obj.y, ref.asset, ref.frame),
      obj.width,
      obj.height,
      ref.fit,
    )
      .setOrigin(obj.anchorX, obj.anchorY)
      .setDepth(renderDepth(ref.layer ?? (obj.kind === "bridge" ? "below" : "objects"), obj.y));
    scenery.push({ object: obj, image, ...(shadow ? { shadow } : {}) });
  }
  return {
    obstacles: world?.obstacles ?? forestObstacles(),
    terrainMode: cache ? "cached" : "indexed",
    dispose: () => {
      cache?.dispose();
      macro?.dispose();
      for (const chunk of fillChunks.values()) chunk.destroy();
      fillChunks.clear();
    },
    groundLayers,
    updateVisibility(player: Point) {
      updateAtmosphere();
      cache?.updateVisibility();
      streamFill();
      macro?.update();
      const view = scene.cameras.main.worldView;
      for (const { object, image, shadow } of scenery) {
        const left = object.x - object.width * object.anchorX;
        const top = object.y - object.height * object.anchorY;
        const visible =
          left < view.right + 128 &&
          left + object.width > view.left - 128 &&
          top < view.bottom + 128 &&
          top + object.height > view.top - 128;
        image.setVisible(visible);
        shadow?.setVisible(visible);
        if (visible) image.setAlpha(coversPlayer(object, player) ? 0.28 : 1);
      }
    },
  };
}
