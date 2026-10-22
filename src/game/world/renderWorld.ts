import { sizeScenery, sizeTile } from "../assets/scenery";
import type Phaser from "phaser";
import { catalog, textureBinding } from "../assets/catalog";
import { atmosphere } from "../assets/atmosphere";
import { renderDepth } from "../assets/layers";
import type { WorldDefinition } from "./types";
import { renderForest } from "./renderForest";
import { coversPlayer } from "./visibility";
import { bakeRoads } from "./renderRoads";
import type { Point } from "../navigation";

/** One adapter per map format, one shared scene and lifecycle for all continents. */
export function renderWorld(scene: Phaser.Scene, world: WorldDefinition) {
  if (!world.terrain) return renderForest(scene);
  const terrain = world.terrain;
  const ground = textureBinding("terrain." + terrain.ground, { asset: terrain.ground }),
    path = textureBinding("terrain." + terrain.path, { asset: terrain.path }),
    plaza = textureBinding("terrain." + terrain.plaza, { asset: terrain.plaza });
  // A painted terrain pack replaces the flat placeholder tiles and their procedural detail.
  const paintedGround = !!catalog.renderBindings["terrain." + terrain.ground];
  const wall = catalog.renderBindings["terrain." + world.id + "-wall"];
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
  const roads =
    terrain.roads?.length || terrain.courts?.length
      ? bakeRoads(scene, world.id, world, terrain.roads ?? [], terrain.courts ?? [], path, plaza)
      : null;
  // World-space surface detail, rendered in Phaser rather than on the atlas/globe.
  // Deterministic, camera-independent placement; no save, collision or navigation changes.
  if ((world.id === "aether" || world.id === "nexus") && !paintedGround) {
    const detail = scene.add.graphics().setDepth(renderDepth("ground") + 1);
    for (let y = 170; y < world.height - 110; y += 112) {
      for (let x = 180; x < world.width - 160; x += 128) {
        const seed = (x * 17 + y * 31) % 101;
        const px = x + (seed % 39) - 19;
        const py = y + ((seed * 7) % 43) - 21;
        const onPath = [...terrain.paths, ...terrain.plazas].some(
          (r) =>
            px > r.x - 30 && px < r.x + r.width + 30 && py > r.y - 30 && py < r.y + r.height + 30,
        );
        const blocked = world.obstacles.some(
          (r) => px > r.x && px < r.x + r.width && py > r.y && py < r.y + r.height,
        );
        if (onPath || blocked) continue;
        // Aetheria: living KI gardens. Nexus-9: synthetic circuitry and energy nodes.
        if (world.id === "nexus") {
          detail.lineStyle(2, 0x4a9bb4, 0.35);
          detail.lineBetween(px - 18, py, px + 18, py);
          detail.lineBetween(px + 18, py, px + 18, py - 14);
          detail.fillStyle(0x82e9ff, 0.6);
          detail.fillCircle(px + 18, py - 14, 3);
          continue;
        }
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
    if (world.id === "nexus") {
      // The central reactor's power conduits follow existing walkable plazas.
      // Purely visual: they never change the pathfinder's obstacle map.
      const circuits = scene.add.graphics().setDepth(renderDepth("paths") + 2);
      for (const [i, area] of terrain.paths.entries()) {
        const horizontal = area.width >= area.height;
        const cx = area.x + area.width / 2;
        const cy = area.y + area.height / 2;
        circuits.lineStyle(3, 0x51cde9, 0.33);
        if (horizontal) {
          circuits.lineBetween(area.x + 24, cy, area.x + area.width - 24, cy);
        } else {
          circuits.lineBetween(cx, area.y + 24, cx, area.y + area.height - 24);
        }
        circuits.fillStyle(0xa2f5ff, 0.58);
        circuits.fillCircle(cx, cy, i % 2 ? 7 : 5);
        circuits.lineStyle(1, 0xb3efff, 0.45);
        circuits.strokeCircle(cx, cy, 13);
      }
      // Peripheral sensor arrays and illuminated platform seams. Keep all
      // graphics in world coordinates so zoom and camera scrolling stay aligned.
      for (const [i, platform] of terrain.plazas.entries()) {
        const inset = 22;
        circuits.lineStyle(2, 0x6ccfe8, 0.42);
        circuits.strokeRect(
          platform.x + inset,
          platform.y + inset,
          platform.width - inset * 2,
          platform.height - inset * 2,
        );
        for (let x = platform.x + 55; x < platform.x + platform.width - 30; x += 72) {
          circuits.fillStyle(i % 2 ? 0x85dfff : 0x4eb4cf, 0.68);
          circuits.fillRect(x, platform.y + inset - 3, 14, 6);
          circuits.fillRect(x, platform.y + platform.height - inset - 3, 14, 6);
        }
      }
      // Peripheral warning markers identify the physical boundary of the facility.
      for (const [i, obstacle] of world.obstacles.entries()) {
        if (i < 3) continue; // outer walls are already drawn by the hazard renderer
        const count = Math.max(1, Math.floor(obstacle.width / 96));
        for (let j = 0; j < count; j++) {
          const mx = obstacle.x + ((j + 0.5) * obstacle.width) / count;
          const my = obstacle.y + 12;
          circuits.fillStyle(0xffbc72, 0.58);
          circuits.fillTriangle(mx - 7, my + 6, mx + 7, my + 6, mx, my - 7);
          circuits.fillStyle(0x182b3a, 0.8);
          circuits.fillCircle(mx, my + 2, 2);
        }
      }
      // Reactor containment ring, visible around the core on the east side.
      circuits.lineStyle(5, 0x67dfff, 0.3);
      circuits.strokeEllipse(world.market.x, world.market.y, 310, 180);
      circuits.lineStyle(2, 0xb0f5ff, 0.48);
      circuits.strokeEllipse(world.market.x, world.market.y, 255, 140);
    }
    // Inlays are world-space and do not affect collision or save coordinates.
    const courtyard = terrain.plazas[1];
    if (courtyard) {
      const cx = courtyard.x + courtyard.width / 2;
      const cy = courtyard.y + courtyard.height / 2;
      detail.lineStyle(3, world.id === "nexus" ? 0x66dcff : 0xcde9d0, 0.28);
      detail.strokeCircle(cx, cy, 125);
      detail.lineStyle(2, world.id === "nexus" ? 0x9beaff : 0x79e8d5, 0.32);
      detail.strokeCircle(cx, cy, 96);
    }
  }
  const hazards = scene.add.graphics().setDepth(renderDepth("below") - 1);
  for (const o of world.obstacles) {
    if (wall) {
      // Painted wall texture on the unchanged collision rectangle.
      sizeTile(
        scene.add.tileSprite(o.x, o.y, o.width, o.height, wall.asset, wall.frame),
        wall.tileSize,
      )
        .setOrigin(0)
        .setDepth(renderDepth("below") - 1);
      continue;
    }
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
          .setOrigin(ref.origin?.[0] ?? object.anchorX, ref.origin?.[1] ?? object.anchorY),
        object.width,
        object.height,
        ref.fit,
      ).setDepth(renderDepth(ref.layer ?? "objects", object.y)),
    };
  });
  // Place names remain on the minimap and region map; permanent ground text obscured actors.
  return {
    terrainMode: "region",
    dispose: () => roads?.dispose(),
    updateVisibility(player: Point) {
      updateAtmosphere();
      roads?.updateVisibility();
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
