import { sizeScenery, sizeTile } from "../assets/scenery";
import type Phaser from "phaser";
import { textureBinding } from "../assets/catalog";
import { atmosphere } from "../assets/atmosphere";
import { renderDepth } from "../assets/layers";
import type { WorldDefinition } from "./types";
import { renderForest } from "./renderForest";
import { coversPlayer } from "./visibility";
import type { Point } from "../navigation";

/** One adapter per map format, one shared scene and lifecycle for all continents. */
export function renderWorld(scene: Phaser.Scene, world: WorldDefinition) {
  if (!world.terrain) return renderForest(scene);
  const terrain = world.terrain;
  const ground = textureBinding("terrain." + terrain.ground, { asset: terrain.ground }),
    path = textureBinding("terrain." + terrain.path, { asset: terrain.path }),
    plaza = textureBinding("terrain." + terrain.plaza, { asset: terrain.plaza });
  const updateAtmosphere = atmosphere(scene, world.id);
  sizeTile(
    scene.add.tileSprite(0, 0, world.width, world.height, ground.asset, ground.frame),
    ground.tileSize,
  )
    .setOrigin(0)
    .setDepth(renderDepth("ground"));
  for (const area of terrain.paths)
    sizeTile(
      scene.add.tileSprite(area.x, area.y, area.width, area.height, path.asset, path.frame),
      path.tileSize,
    )
      .setOrigin(0)
      .setDepth(renderDepth("paths"));
  for (const area of terrain.plazas)
    sizeTile(
      scene.add.tileSprite(area.x, area.y, area.width, area.height, plaza.asset, plaza.frame),
      plaza.tileSize,
    )
      .setOrigin(0)
      .setDepth(renderDepth("paths") + 1);
  // World-space surface detail, rendered in Phaser rather than on the atlas/globe.
  // Deterministic, camera-independent placement; no save, collision or navigation changes.
  if (world.id === "aether") {
    const detail = scene.add.graphics().setDepth(renderDepth("ground") + 1);
    for (let y = 170; y < world.height - 110; y += 112) {
      for (let x = 180; x < world.width - 160; x += 128) {
        const seed = (x * 17 + y * 31) % 101;
        const px = x + (seed % 39) - 19;
        const py = y + ((seed * 7) % 43) - 21;
        const onPath = [...terrain.paths, ...terrain.plazas].some(
          (r) => px > r.x - 30 && px < r.x + r.width + 30 &&
            py > r.y - 30 && py < r.y + r.height + 30,
        );
        const blocked = world.obstacles.some(
          (r) => px > r.x && px < r.x + r.width &&
            py > r.y && py < r.y + r.height,
        );
        if (onPath || blocked) continue;
        // Mossy ground tufts and small luminescent KI flowers.
        detail.lineStyle(2, seed % 3 ? 0x73aa94 : 0x9bc7ae, 0.45);
        detail.lineBetween(px - 7, py + 3, px - 2, py - 5);
        detail.lineBetween(px, py + 4, px + 2, py - 8);
        detail.lineBetween(px + 7, py + 3, px + 4, py - 3);
        if (seed % 4 === 0) {
          detail.fillStyle(0xa5fff0, 0.75);
          detail.fillCircle(px + 13, py - 9, 2.5);
          detail.fillStyle(0x5cd7c5, 0.2);
          detail.fillCircle(px + 13, py - 9, 8);
        }
      }
    }
    // Concentric ceremonial inlays on the sanctuary courtyard.
    const courtyard = terrain.plazas[1];
    if (courtyard) {
      const cx = courtyard.x + courtyard.width / 2;
      const cy = courtyard.y + courtyard.height / 2;
      detail.lineStyle(3, 0xcde9d0, 0.28);
      detail.strokeCircle(cx, cy, 125);
      detail.lineStyle(2, 0x79e8d5, 0.32);
      detail.strokeCircle(cx, cy, 96);
    }
  }
  const hazards = scene.add.graphics().setDepth(renderDepth("below") - 1);
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
  const scenery = world.objects.map((object) => {
    const ref = textureBinding(
      "object." + world.id + "." + object.id,
      textureBinding("object." + object.asset, { asset: object.asset! }),
    );
    return {
      object,
      image: sizeScenery(
        scene.add
          .image(object.x, object.y, ref.asset, ref.frame)
          .setOrigin(object.anchorX, object.anchorY),
        object.width,
        object.height,
        ref.fit,
      ).setDepth(renderDepth(ref.layer ?? "objects", object.y)),
    };
  });
  // Place names remain on the minimap and region map; permanent ground text obscured actors.
  return {
    terrainMode: "region",
    dispose: () => {},
    updateVisibility(player: Point) {
      updateAtmosphere();
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
