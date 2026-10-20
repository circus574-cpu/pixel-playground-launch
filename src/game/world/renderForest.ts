import Phaser from "phaser";
import { coversPlayer } from "./visibility";
import type { Point } from "../navigation";
import { FOREST, FOREST_OBJECTS, forestObstacles } from "./forest";

/** Four tile layers share one padded atlas; all world objects share a second atlas. */
export function renderForest(scene: Phaser.Scene) {
  const groundLayers: Phaser.Tilemaps.TilemapLayer[] = [];
  FOREST.layers.forEach((data, index) => {
    const map = scene.make.tilemap({ data, tileWidth: 64, tileHeight: 64 });
    const tileset = map.addTilesetImage("forest-terrain", "forest-terrain", 64, 64, 2, 4);
    if (!tileset) throw new Error("Nie można otworzyć tekstur leśnej krainy.");
    const layer = map.createLayer(0, tileset, 0, 0, false) as Phaser.Tilemaps.TilemapLayer;
    layer.setScale(FOREST.tileSize / 64).setDepth(-1000 + index);
    layer.setCullPadding(2, 2);
    groundLayers.push(layer);
  });
  const scenery: { object: (typeof FOREST_OBJECTS)[number]; image: Phaser.GameObjects.Image }[] =
    [];
  for (const obj of FOREST_OBJECTS) {
    if (obj.kind !== "bridge") {
      scene.add
        .image(obj.x + 8, obj.y + 8, "forest-objects", obj.kind)
        .setDisplaySize(obj.width, obj.height * 0.3)
        .setOrigin(0.5, 0.5)
        .setTint(0x344b68)
        .setAlpha(0.12)
        .setDepth(-10);
    }
    const image = scene.add
      .image(obj.x, obj.y, "forest-objects", obj.kind)
      .setDisplaySize(obj.width, obj.height)
      .setOrigin(obj.anchorX, obj.anchorY)
      .setDepth(obj.kind === "bridge" ? -20 : obj.y);
    scenery.push({ object: obj, image });
  }
  return {
    obstacles: forestObstacles(),
    groundLayers,
    updateVisibility(player: Point) {
      for (const { object, image } of scenery)
        image.setAlpha(coversPlayer(object, player) ? 0.28 : 1);
    },
  };
}
