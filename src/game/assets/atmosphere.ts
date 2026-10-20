import { sizeTile } from "./scenery";
import type Phaser from "phaser";
import { catalog } from "./catalog";
import { renderDepth } from "./layers";
/** Optional camera-sized overlay; unloaded when the continent's game instance is disposed. */
export function atmosphere(scene: Phaser.Scene, worldId: string) {
  const ref = catalog.renderBindings["atmosphere." + worldId];
  const image =
    ref &&
    sizeTile(
      scene.add.tileSprite(0, 0, scene.scale.width, scene.scale.height, ref.asset, ref.frame),
      ref.tileSize,
    )
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(renderDepth("atmosphere"))
      .setAlpha(0.12);
  return () => {
    if (!image) return;
    if (image.width !== scene.scale.width || image.height !== scene.scale.height)
      image.setSize(scene.scale.width, scene.scale.height);
    image.setTilePosition(scene.cameras.main.scrollX * 0.1, scene.cameras.main.scrollY * 0.1);
  };
}
