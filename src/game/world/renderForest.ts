import Phaser from "phaser";
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
  for (const obj of FOREST_OBJECTS) {
    if (obj.kind !== "bridge") {
      scene.add
        .image(obj.x + 10, obj.y + 14, "forest-objects", obj.kind)
        .setDisplaySize(obj.width, obj.height)
        .setOrigin(obj.anchorX, obj.anchorY)
        .setTint(0x09180d)
        .setAlpha(0.2)
        .setDepth(-10);
    }
    scene.add
      .image(obj.x, obj.y, "forest-objects", obj.kind)
      .setDisplaySize(obj.width, obj.height)
      .setOrigin(obj.anchorX, obj.anchorY)
      .setDepth(obj.kind === "bridge" ? -20 : obj.y);
  }
  return { obstacles: forestObstacles(), groundLayers };
}
