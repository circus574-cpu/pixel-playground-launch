import { sizeScenery, sizeTile } from "../assets/scenery";
import type Phaser from "phaser";
import { catalog, hazardBinding, textureBinding } from "../assets/catalog";
import { atmosphere } from "../assets/atmosphere";
import { renderDepth } from "../assets/layers";
import type { WorldDefinition } from "./types";
import { renderForest } from "./renderForest";
import { coversPlayer } from "./visibility";
import { bakeRoads } from "./renderRoads";
import { macroVariation } from "./macroVariation";
import { castsShadow, objectShadow } from "./shadows";
import { SCENERY_CELL, buildSceneryGrid, sceneryNear, sceneryReach } from "./sceneryStream";
import type { Point } from "../navigation";

/** Derived, softened copy of a ground texture; undefined when the canvas filter is unavailable. */
function softenGround(scene: Phaser.Scene, asset: string, frame?: string | number) {
  const key = asset + ":soft";
  if (scene.textures.exists(key)) return key;
  if (frame !== undefined && frame !== "__BASE") return undefined;
  const src = scene.textures.get(asset).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const w = src.width,
    h = src.height;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return undefined;
  const ctx = tex.getContext();
  if (!("filter" in ctx)) {
    scene.textures.remove(key);
    return undefined;
  }
  // Tile the image 3 × 3 before blurring so the blur wraps around the edges, then keep the middle tile.
  const big = document.createElement("canvas");
  big.width = w * 3;
  big.height = h * 3;
  const bctx = big.getContext("2d")!;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) bctx.drawImage(src, i * w, j * h);
  const out = document.createElement("canvas");
  out.width = w * 3;
  out.height = h * 3;
  const octx = out.getContext("2d")!;
  octx.filter = "contrast(0.72) saturate(0.85) brightness(1.02) blur(1.5px)";
  octx.drawImage(big, 0, 0);
  // Warm painted wash: the ground is a calm backdrop in one limited palette, never the loudest thing on screen.
  octx.filter = "none";
  octx.globalAlpha = 0.08;
  octx.fillStyle = "#d9bf94";
  octx.fillRect(0, 0, w * 3, h * 3);
  octx.globalAlpha = 1;
  ctx.drawImage(out, w, h, w, h, 0, 0, w, h);
  tex.refresh();
  return key;
}

/**
 * Rectangular path/plaza areas as a feathered canvas patch instead of a hard-edged TileSprite;
 * falls back to the TileSprite when the texture is a frame or the canvas is unavailable.
 */
function featheredArea(
  scene: Phaser.Scene,
  area: { x: number; y: number; width: number; height: number },
  binding: {
    asset: string;
    frame?: string | number | undefined;
    tileSize?: [number, number] | undefined;
  },
  depth: number,
) {
  const hard = () =>
    sizeTile(
      scene.add.tileSprite(area.x, area.y, area.width, area.height, binding.asset, binding.frame),
      binding.tileSize,
    )
      .setOrigin(0)
      .setDepth(depth);
  if (binding.frame !== undefined && binding.frame !== "__BASE") return hard();
  const pad = Math.round(Math.min(48, area.width / 3, area.height / 3));
  const w = area.width + pad * 2,
    h = area.height + pad * 2;
  const key = `feather:${binding.asset}:${area.x}:${area.y}:${area.width}:${area.height}`;
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return hard();
  const ctx = tex.getContext();
  const src = scene.textures.get(binding.asset).getSourceImage() as
    HTMLImageElement | HTMLCanvasElement;
  const [stepX, stepY] = binding.tileSize ?? [src.width, src.height];
  const pattern = ctx.createPattern(src, "repeat");
  if (!pattern || !("filter" in ctx)) {
    scene.textures.remove(key);
    return hard();
  }
  ctx.save();
  ctx.scale(stepX / src.width, stepY / src.height);
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, (w * src.width) / stepX, (h * src.height) / stepY);
  ctx.restore();
  const mask = document.createElement("canvas");
  mask.width = w;
  mask.height = h;
  const m = mask.getContext("2d")!;
  m.filter = `blur(${Math.max(4, pad / 2)}px)`;
  m.fillStyle = "#fff";
  m.fillRect(pad, pad, area.width, area.height);
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(mask, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  tex.refresh();
  return scene.add
    .image(area.x - pad, area.y - pad, key)
    .setOrigin(0)
    .setDepth(depth);
}

/** World units per streamed ground chunk. */
const GROUND_CHUNK = 1024;
/** One adapter per map format, one shared scene and lifecycle for all continents. */
export function renderWorld(scene: Phaser.Scene, world: WorldDefinition) {
  if (!world.terrain) return renderForest(scene, world);
  const terrain = world.terrain;
  // Every ground-type surface goes through the same softening so the whole floor is one calm palette.
  const calm = <T extends { asset: string; frame?: string | number | undefined }>(b: T): T => {
    const key = softenGround(scene, b.asset, b.frame);
    return key ? { ...b, asset: key, frame: undefined } : b;
  };
  const ground = textureBinding("terrain." + terrain.ground, { asset: terrain.ground }),
    path = calm(textureBinding("terrain." + terrain.path, { asset: terrain.path })),
    plaza = calm(textureBinding("terrain." + terrain.plaza, { asset: terrain.plaza }));
  // A painted terrain pack replaces the flat placeholder tiles and their procedural detail.
  const paintedGround = !!catalog.renderBindings["terrain." + terrain.ground];
  const wallRaw = catalog.renderBindings["terrain." + world.id + "-wall"];
  const wall = wallRaw ? calm(wallRaw) : wallRaw;
  const hazardRaw = hazardBinding(world.id);
  const hazard = hazardRaw ? calm(hazardRaw) : hazardRaw;
  const border = world.border ?? 3;
  const updateAtmosphere = atmosphere(scene, world.id);
  // Ground is streamed in chunks: a world-sized TileSprite would allocate a full-size canvas
  // texture on the Canvas renderer, which does not scale to the open-world maps.
  // A photographic, high-contrast ground fights with the painted characters: soften it once (contrast,
  // saturation, a touch of blur) into a derived texture. Browsers without canvas filters keep the original.
  const soft = softenGround(scene, ground.asset, ground.frame);
  const groundAsset = soft ?? ground.asset;
  const groundFrame = soft ? undefined : ground.frame;
  const groundChunks = new Map<string, Phaser.GameObjects.TileSprite>();
  const streamGround = () => {
    const view = scene.cameras.main.worldView;
    // Continents are tens of thousands of units wide: visit only the chunks around the camera.
    const first = (v: number) => Math.max(0, Math.floor((v - 64) / GROUND_CHUNK) * GROUND_CHUNK);
    for (let y = first(view.top); y < Math.min(world.height, view.bottom + 64); y += GROUND_CHUNK)
      for (
        let x = first(view.left);
        x < Math.min(world.width, view.right + 64);
        x += GROUND_CHUNK
      ) {
        const key = x + ":" + y;
        const chunk = groundChunks.get(key);
        if (chunk) chunk.setVisible(true);
        else {
          const tile = sizeTile(
            scene.add.tileSprite(
              x,
              y,
              Math.min(GROUND_CHUNK, world.width - x),
              Math.min(GROUND_CHUNK, world.height - y),
              groundAsset,
              groundFrame,
            ),
            ground.tileSize,
          )
            .setOrigin(0)
            .setDepth(renderDepth("ground"));
          tile.setTilePosition(x / tile.tileScaleX, y / tile.tileScaleY);
          groundChunks.set(key, tile);
        }
      }
    for (const [key, chunk] of groundChunks) {
      const [x, y] = key.split(":").map(Number) as [number, number];
      // Same rule as the baked road chunks: depend on the camera now, not its history.
      const far =
        x > view.right + 640 ||
        x + GROUND_CHUNK < view.left - 640 ||
        y > view.bottom + 640 ||
        y + GROUND_CHUNK < view.top - 640;
      if (far) {
        chunk.destroy();
        groundChunks.delete(key);
      } else if (
        x >= view.right + 64 ||
        x + GROUND_CHUNK <= view.left - 64 ||
        y >= view.bottom + 64 ||
        y + GROUND_CHUNK <= view.top - 64
      )
        chunk.setVisible(false);
    }
  };
  streamGround();
  const macro = macroVariation(scene, world, world.id);
  for (const area of terrain.paths) featheredArea(scene, area, path, renderDepth("paths"));
  for (const area of terrain.plazas) featheredArea(scene, area, plaza, renderDepth("paths") + 1);
  const roads =
    terrain.roads?.length || terrain.courts?.length || terrain.zones?.length
      ? bakeRoads(
          scene,
          world.id,
          world,
          terrain.roads ?? [],
          terrain.courts ?? [],
          path,
          plaza,
          terrain.zones ?? [],
          Object.fromEntries(
            (terrain.zones ?? [])
              .filter((z) => catalog.renderBindings["terrain." + z.texture])
              .map((z) => [
                z.texture,
                calm(textureBinding("terrain." + z.texture, { asset: z.texture })),
              ]),
          ),
        )
      : null;
  // World-space surface detail, rendered in Phaser rather than on the atlas/globe.
  // Deterministic, camera-independent placement; no save, collision or navigation changes.
  if ((world.id === "aether" || world.id === "nexus") && !paintedGround) {
    const detail = scene.add.graphics().setDepth(renderDepth("ground") + 1);
    // Surface detail is limited to the neighbourhood of the city; the continent beyond stays plain.
    const around = world.city?.bounds;
    const left = Math.max(180, around ? around.x - 800 : 0),
      right = Math.min(world.width - 160, around ? around.x + around.width + 800 : world.width),
      top = Math.max(170, around ? around.y - 800 : 0),
      bottom = Math.min(world.height - 110, around ? around.y + around.height + 800 : world.height);
    for (let y = top - (top % 112) + (170 % 112); y < bottom; y += 112) {
      for (let x = left - (left % 128) + (180 % 128); x < right; x += 128) {
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
  for (const [index, o] of world.obstacles.entries()) {
    // Outer boundary stays wall; inner blockers (lava, energy, water) use the nature liquid.
    const surface = index >= border && hazard ? hazard : wall;
    if (surface) {
      // Painted texture on the unchanged collision rectangle; hazards melt into the ground instead of
      // ending in a hard-edged rectangle.
      if (index >= border) featheredArea(scene, o, surface, renderDepth("below") - 1);
      else
        sizeTile(
          scene.add.tileSprite(o.x, o.y, o.width, o.height, surface.asset, surface.frame),
          surface.tileSize,
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
  // Region worlds carry tens of thousands of decorations: only objects near the camera exist as game objects.
  const sceneryGrid = buildSceneryGrid(world.objects);
  const reach = sceneryReach(world.objects);
  const live = new Map<
    number,
    {
      object: (typeof world.objects)[number];
      image: Phaser.GameObjects.Image;
      shadow: Phaser.GameObjects.Image | null;
    }
  >();
  const spawn = (i: number) => {
    const object = world.objects[i]!;
    const ref = textureBinding(
      "object." + world.id + "." + object.id,
      textureBinding("object." + object.asset, { asset: object.asset! }),
    );
    const shadow = castsShadow(object, ref.layer) ? objectShadow(scene, object) : null;
    const image = sizeScenery(
      scene.add
        .image(object.x, object.y, ref.asset, ref.frame)
        .setOrigin(ref.origin?.[0] ?? object.anchorX, ref.origin?.[1] ?? object.anchorY),
      object.width,
      object.height,
      ref.fit,
    ).setDepth(renderDepth(ref.layer ?? "objects", object.y));
    live.set(i, { object, image, shadow });
  };
  let lastCells = "";
  const streamScenery = () => {
    const view = scene.cameras.main.worldView;
    const pad = reach + 128;
    // Cache the actual expanded query cells: position/width alone can miss rows after a height-only resize.
    const cells = [
      Math.floor((view.left - pad) / SCENERY_CELL),
      Math.floor((view.right + pad) / SCENERY_CELL),
      Math.floor((view.top - pad) / SCENERY_CELL),
      Math.floor((view.bottom + pad) / SCENERY_CELL),
    ].join(":");
    if (cells === lastCells) return;
    lastCells = cells;
    for (const i of sceneryNear(sceneryGrid, view, pad)) if (!live.has(i)) spawn(i);
    // Drop what is two cells further away, so walking back and forth does not thrash.
    const keep = new Set(sceneryNear(sceneryGrid, view, pad + 2048));
    for (const [i, entry] of live)
      if (!keep.has(i)) {
        entry.image.destroy();
        entry.shadow?.destroy();
        live.delete(i);
      }
  };
  streamScenery();
  // Place names remain on the minimap and region map; permanent ground text obscured actors.
  return {
    terrainMode: "region",
    dispose: () => {
      roads?.dispose();
      macro.dispose();
      for (const { image, shadow } of live.values()) {
        image.destroy();
        shadow?.destroy();
      }
      live.clear();
      for (const chunk of groundChunks.values()) chunk.destroy();
      groundChunks.clear();
    },
    updateVisibility(player: Point) {
      updateAtmosphere();
      streamGround();
      macro.update();
      roads?.updateVisibility();
      const view = scene.cameras.main.worldView;
      streamScenery();
      for (const { object: o, image } of live.values())
        image.setAlpha(coversPlayer(o, player) ? 0.28 : 1);
    },
  };
}
