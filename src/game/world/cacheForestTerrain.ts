import { tintPixels } from "./tintPixels";
import type { TextureRef } from "../assets/schema";
import { FOREST_OBJECTS, type ForestObject } from "./forest";
import type Phaser from "phaser";
import { FOREST } from "./forest";
import { renderDepth } from "../assets/layers";
import { TERRAIN_CHUNK_SIDE, terrainBlits } from "./terrainBlits";
/** Bake static terrain and below-foot shadows only. Scenery, actors and map data stay independent. */
export function cacheForestTerrain(
  scene: Phaser.Scene,
  textureKey: string,
  objectRefs: ReadonlyMap<string, TextureRef>,
  objects: readonly ForestObject[] = FOREST_OBJECTS,
) {
  const source = scene.textures.get(textureKey).getSourceImage() as HTMLImageElement;
  const chunks: {
    key: string;
    image: Phaser.GameObjects.Image;
    x: number;
    y: number;
    width: number;
    height: number;
  }[] = [];
  const scratch: HTMLCanvasElement[] = [];
  const shadowSources = new Map<string, CanvasImageSource>();
  const sourceFor = (key: string) => {
    const existing = shadowSources.get(key);
    if (existing) return existing;
    const image = scene.textures.get(key).getSourceImage() as HTMLImageElement;
    if (scene.game.renderer.type !== 2) {
      shadowSources.set(key, image);
      return image;
    }
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    scratch.push(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Nie można przygotować cieni podłoża.");
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    tintPixels(pixels.data, 0x344b68);
    ctx.putImageData(pixels, 0, 0);
    shadowSources.set(key, canvas);
    return canvas;
  };
  const shadows: {
    source: CanvasImageSource;
    frame: Phaser.Textures.Frame;
    x: number;
    y: number;
    width: number;
    height: number;
  }[] = [];
  const buildShadows = () => {
    for (const o of objects) {
      if (o.kind === "bridge") continue;
      const ref = objectRefs.get(o.id)!,
        frame = scene.textures.get(ref.asset).get(ref.frame),
        sx = o.width / frame.realWidth,
        sy = (o.height * 0.3) / frame.realHeight;
      shadows.push({
        source: sourceFor(ref.asset),
        frame,
        x: o.x + 8 - o.width / 2 + frame.x * sx,
        y: o.y + 8 - (o.height * 0.3) / 2 + frame.y * sy,
        width: frame.cutWidth * sx,
        height: frame.cutHeight * sy,
      });
    }
  };
  let released = false;
  const dispose = () => {
    if (released) return;
    released = true;
    for (const c of chunks) {
      c.image.destroy();
      scene.textures.remove(c.key);
    }
    chunks.length = 0;
  };
  try {
    buildShadows();
    for (let y = 0; y < FOREST.height; y += TERRAIN_CHUNK_SIDE)
      for (let x = 0; x < FOREST.width; x += TERRAIN_CHUNK_SIDE) {
        const width = Math.min(TERRAIN_CHUNK_SIDE, FOREST.width - x),
          height = Math.min(TERRAIN_CHUNK_SIDE, FOREST.height - y),
          key = `terrain-cache:verdant:${x}:${y}`;
        const texture = scene.textures.createCanvas(key, width, height);
        if (!texture) throw Error("Nie można przygotować bufora podłoża.");
        const image = scene.add.image(x, y, key).setOrigin(0).setDepth(renderDepth("ground"));
        chunks.push({ key, image, x, y, width, height });
        const ctx = texture.getContext();
        ctx.imageSmoothingEnabled = true;
        for (const b of terrainBlits(
          FOREST.layers,
          FOREST.tileSize,
          { x, y, width, height },
          source.width,
        ))
          ctx.drawImage(source, b.sx, b.sy, 64, 64, b.dx, b.dy, FOREST.tileSize, FOREST.tileSize);
        ctx.globalAlpha = 0.12;
        for (const shadow of shadows)
          if (
            shadow.x < x + width &&
            shadow.x + shadow.width > x &&
            shadow.y < y + height &&
            shadow.y + shadow.height > y
          ) {
            const f = shadow.frame;
            ctx.drawImage(
              shadow.source,
              f.cutX,
              f.cutY,
              f.cutWidth,
              f.cutHeight,
              shadow.x - x,
              shadow.y - y,
              shadow.width,
              shadow.height,
            );
          }
        ctx.globalAlpha = 1;
        texture.refresh();
      }
  } catch (error) {
    dispose();
    throw error;
  } finally {
    for (const canvas of scratch) {
      canvas.width = canvas.height = 0;
    }
    shadowSources.clear();
    shadows.length = 0;
  }
  scene.events.once("shutdown", dispose);
  scene.events.once("destroy", dispose);
  return {
    dispose,
    updateVisibility() {
      const view = scene.cameras.main.worldView;
      for (const c of chunks)
        c.image.setVisible(
          c.x < view.right + 128 &&
            c.x + c.width > view.left - 128 &&
            c.y < view.bottom + 128 &&
            c.y + c.height > view.top - 128,
        );
    },
  };
}
