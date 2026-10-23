import { STATIC_TERRAIN_CACHE_ENABLED } from "../features";
import { cacheForestTerrain } from "./cacheForestTerrain";
import { sizeScenery } from "../assets/scenery";
import Phaser from "phaser";
import { textureBinding } from "../assets/catalog";
import { atmosphere } from "../assets/atmosphere";
import { renderDepth } from "../assets/layers";
import { coversPlayer } from "./visibility";
import type { Point } from "../navigation";
import { FOREST, FOREST_OBJECTS, forestObstacles } from "./forest";
import type { WorldDefinition } from "./types";

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
      const layer = map.createLayer(0, tileset, 0, 0, false) as Phaser.Tilemaps.TilemapLayer;
      layer.setScale(FOREST.tileSize / 64).setDepth(renderDepth("ground") + index);
      layer.setCullPadding(2, 2);
      groundLayers.push(layer);
    });
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
    dispose: () => cache?.dispose(),
    groundLayers,
    updateVisibility(player: Point) {
      updateAtmosphere();
      cache?.updateVisibility();
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
