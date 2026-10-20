import type Phaser from "phaser";
import type { AssetDefinition, ActorVisual } from "./schema";
export function queueAssets(scene: Phaser.Scene, assets: readonly AssetDefinition[]) {
  for (const a of assets) {
    if (a.kind === "atlas") {
      if (!a.atlasUrl) throw new Error("Brak JSON atlasu: " + a.id);
      scene.load.atlas(a.id, a.url, a.atlasUrl);
    } else if (a.kind === "sheet") {
      if (!a.frameWidth || !a.frameHeight) throw new Error("Brak wymiarów klatki: " + a.id);
      scene.load.spritesheet(a.id, a.url, { frameWidth: a.frameWidth, frameHeight: a.frameHeight });
    } else if (a.kind === "svg") scene.load.svg(a.id, a.url);
    else scene.load.image(a.id, a.url);
  }
}
export function prepareTextures(scene: Phaser.Scene, assets: readonly AssetDefinition[]) {
  for (const a of assets) {
    if (!scene.textures.exists(a.id)) throw new Error("Brak tekstury: " + a.id);
    const texture = scene.textures.get(a.id),
      source = texture.getSourceImage() as HTMLImageElement;
    if ((a.width && source.width !== a.width) || (a.height && source.height !== a.height))
      throw new Error("Nieprawidłowy rozmiar tekstury: " + a.id);
    if (a.grid) {
      const w = Math.floor(source.width / a.grid.columns),
        h = Math.floor(source.height / a.grid.rows);
      for (let row = 0; row < a.grid.rows; row++)
        for (let col = 0; col < a.grid.columns; col++)
          texture.add(row * a.grid.columns + col, 0, col * w, row * h, w, h);
    }
    for (const f of a.crops ?? []) texture.add(f.name, 0, f.x, f.y, f.width, f.height);
  }
}
export const animationKey = (visual: ActorVisual, state: string, direction: string) =>
  `${visual.id}/${state}/${direction}`;
export function registerActorAnimations(scene: Phaser.Scene, visual: ActorVisual) {
  for (const [state, clip] of Object.entries(visual.clips))
    for (const [direction, frames] of Object.entries(clip.directions)) {
      if (!frames) continue;
      const texture = scene.textures.get(clip.asset);
      for (const frame of frames)
        if (!texture.has(String(frame)))
          throw new Error(`Brak klatki: ${visual.id}/${state}/${direction}/${frame}`);
      const key = animationKey(visual, state, direction);
      if (!scene.anims.exists(key))
        scene.anims.create({
          key,
          frames: frames.map((frame) => ({ key: clip.asset, frame })),
          frameRate: clip.fps,
          repeat: clip.loop ? -1 : 0,
        });
    }
}
