import type Phaser from "phaser";
import type { WorldDefinition } from "./types";
import { renderForest } from "./renderForest";
import { coversPlayer } from "./visibility";
import type { Point } from "../navigation";

/** One adapter per map format, one shared scene and lifecycle for all continents. */
export function renderWorld(scene: Phaser.Scene, world: WorldDefinition) {
  if (!world.terrain) return renderForest(scene);
  const terrain = world.terrain;
  scene.add
    .tileSprite(0, 0, world.width, world.height, terrain.ground)
    .setOrigin(0)
    .setDepth(-1000);
  for (const area of terrain.paths)
    scene.add
      .tileSprite(area.x, area.y, area.width, area.height, terrain.path)
      .setOrigin(0)
      .setDepth(-999);
  for (const area of terrain.plazas)
    scene.add
      .tileSprite(area.x, area.y, area.width, area.height, terrain.plaza)
      .setOrigin(0)
      .setDepth(-998);
  const hazards = scene.add.graphics().setDepth(-990);
  for (const o of world.obstacles) {
    hazards.fillStyle(world.id === "pyra" ? 0x2a2029 : world.id === "nexus" ? 0x091722 : 0x15343b);
    hazards.fillRect(o.x, o.y, o.width, o.height);
    hazards.lineStyle(
      4,
      world.id === "pyra" ? 0xe68a48 : world.id === "nexus" ? 0x5ac5e9 : 0x6ca99b,
      0.7,
    );
    hazards.strokeRect(o.x + 3, o.y + 3, o.width - 6, o.height - 6);
    // Readable fissures / energy channels / terrace walls follow their collision footprint.
    hazards.lineStyle(2, world.id === "pyra" ? 0xffbf6a : 0x8ad5d9, 0.35);
    for (let x = o.x + 24; x < o.x + o.width - 10; x += 64) {
      hazards.beginPath();
      hazards.moveTo(x, o.y + 12);
      hazards.lineTo(x + 12, o.y + o.height / 2);
      hazards.lineTo(x, o.y + o.height - 12);
      hazards.strokePath();
    }
  }
  const scenery = world.objects.map((object) => ({
    object,
    image: scene.add
      .image(object.x, object.y, object.asset!)
      .setOrigin(object.anchorX, object.anchorY)
      .setDisplaySize(object.width, object.height)
      .setDepth(object.y),
  }));
  // Place names remain on the minimap and region map; permanent ground text obscured actors.
  return {
    updateVisibility(player: Point) {
      const view = scene.cameras.main.worldView;
      for (const { object: o, image } of scenery) {
        const left = o.x - o.width * o.anchorX,
          top = o.y - o.height * o.anchorY;
        const visible =
          left < view.right + 128 &&
          left + o.width > view.left - 128 &&
          top < view.bottom + 128 &&
          top + o.height > view.top - 128;
        image.setVisible(visible);
        if (visible) image.setAlpha(coversPlayer(o, player) ? 0.28 : 1);
      }
    },
  };
}
