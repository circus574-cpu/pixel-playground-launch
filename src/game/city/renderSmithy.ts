import Phaser from "phaser";
import { textureBinding } from "../assets/catalog";
import { sizeScenery } from "../assets/scenery";
import { objectShadow } from "../world/shadows";
import type { WorldDefinition } from "../world/types";
import type { Interior } from "./types";

type Shown = Phaser.GameObjects.GameObject;
/** Scene depths: sorted props use their foot y (< 760); light and tone sit above them. */
const WALL = -80000,
  TONE = 15000,
  LIGHT = 15001;

/** Painted "Kuźnia Żaru": every prop is its own part with a foot point; footprints live in room.ts. */
export function renderSmithy(scene: Phaser.Scene, world: WorldDefinition, room: Interior) {
  const objects: Shown[] = [];
  const tweens: Phaser.Tweens.Tween[] = [];
  const part = (key: string) => textureBinding("object.pyra.smithy." + key, { asset: key });
  const tile = (
    key: string,
    x: number,
    y: number,
    w: number,
    h: number,
    depth: number,
    tint?: number,
    size?: number,
  ) => {
    const ref = textureBinding("terrain.pyra." + key, { asset: key });
    const t = scene.add.tileSprite(x, y, w, h, ref.asset, ref.frame).setOrigin(0).setDepth(depth);
    const [tw, th] = size
      ? [size, size]
      : (ref.tileSize ?? [t.frame.realWidth, t.frame.realHeight]);
    t.setTileScale(tw / t.frame.realWidth, th / t.frame.realHeight);
    if (tint !== undefined) t.setTint(tint);
    objects.push(t);
  };
  // Portrait room 540 × 1100. Walls reach far beyond the room, so any screen shows wall, never an empty margin.
  const W = room.width,
    H = room.height;
  tile("smithy-floor", 50, 150, W - 100, H - 190, -90000, 0xe3cdb8, 130);
  tile("smithy-wall", -1500, -400, 3540, 550, WALL, 0xb89c88);
  tile("smithy-wall", -1500, -400, 1550, 2000, WALL, 0x8a7060);
  tile("smithy-wall", W - 50, -400, 1550, 2000, WALL, 0x8a7060);
  tile("smithy-wall", -1500, H - 60, 3540, 560, WALL, 0xa08a78);
  objects.push(scene.add.rectangle(W / 2, H - 30, 110, 60, 0x120b07).setDepth(WALL + 1));
  // Soft darkening where the wall meets the floor, so the room reads as a space with depth.
  const shade = scene.add.graphics().setDepth(WALL + 1);
  shade.fillGradientStyle(0x120804, 0x120804, 0x120804, 0x120804, 0.55, 0.55, 0, 0);
  shade.fillRect(50, 150, W - 100, 80);
  objects.push(shade);

  /** Prop standing on `foot`, fitted into the box; sorted by its foot like characters. */
  const prop = (key: string, x: number, footY: number, w: number, h: number, shadow = true) => {
    const ref = part(key);
    const image = sizeScenery(
      scene.add.image(x, footY, ref.asset, ref.frame).setOrigin(0.5, 1),
      w,
      h,
      "contain",
    ).setDepth(footY);
    objects.push(image);
    if (shadow) {
      const s = objectShadow(scene, {
        x,
        y: footY,
        width: image.displayWidth,
        height: image.displayHeight,
        anchorX: 0.5,
        kind: key,
      });
      if (s) objects.push(s);
    }
    return image;
  };
  /** Hung on the wall face: part of the wall, no shadow and no footprint. */
  const hung = (key: string, x: number, topY: number, w: number, h: number) => {
    const ref = part(key);
    objects.push(
      sizeScenery(
        scene.add.image(x, topY, ref.asset, ref.frame).setOrigin(0.5, 0),
        w,
        h,
        "contain",
      ).setDepth(WALL + 2),
    );
  };
  prop("door-arch", 235, 175, 150, 235, false).setDepth(WALL + 3);
  hung("sign-hanging", 235, 8, 110, 120);
  hung("banner-flame", 110, 30, 70, 130);
  hung("banner-flame", 330, 30, 70, 130);
  prop("furnace-fire", 405, 265, 200, 270);
  prop("shelf-ingots", 105, 230, 100, 165);
  prop("weapon-rack", 205, 360, 100, 140);
  prop("grindstone", 465, 385, 80, 110);
  prop("anvil-stump", 360, 565, 120, 165);
  prop("workbench-tools", 120, 680, 170, 170);
  prop("stairs-wood", 90, 440, 100, 130);
  prop("chest-iron", 430, 760, 110, 95);
  prop("crates-stack", 450, 905, 100, 120);
  prop("barrels", 100, 880, 110, 120);
  prop("lantern-post", 190, 1040, 45, 130, false);
  prop("lantern-post", 350, 1040, 45, 130, false);

  // Warm light: a gentle tone over the room, additive pools around the fire and lanterns.
  const tone = scene.add
    .rectangle(W / 2, H / 2, 4000, 3200, 0xc9b49e)
    .setBlendMode(Phaser.BlendModes.MULTIPLY)
    .setDepth(TONE);
  objects.push(tone);
  if (!scene.textures.exists("warm-glow")) {
    const tex = scene.textures.createCanvas("warm-glow", 128, 128)!;
    const ctx = tex.getContext();
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,190,90,0.95)");
    g.addColorStop(0.45, "rgba(255,140,50,0.4)");
    g.addColorStop(1, "rgba(255,110,30,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    tex.refresh();
  }
  if (!scene.textures.exists("spark")) {
    const tex = scene.textures.createCanvas("spark", 8, 8)!;
    const ctx = tex.getContext();
    const g = ctx.createRadialGradient(4, 4, 0, 4, 4, 4);
    g.addColorStop(0, "rgba(255,240,160,1)");
    g.addColorStop(1, "rgba(255,150,40,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 8, 8);
    tex.refresh();
  }
  if (!scene.textures.exists("room-vignette")) {
    const tex = scene.textures.createCanvas("room-vignette", 256, 256)!;
    const ctx = tex.getContext();
    const g = ctx.createRadialGradient(128, 128, 60, 128, 128, 182);
    g.addColorStop(0, "rgba(12,6,3,0)");
    g.addColorStop(1, "rgba(12,6,3,0.75)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    tex.refresh();
  }
  objects.push(
    scene.add
      .image(480, 380, "room-vignette")
      .setDisplaySize(760, 1380)
      .setDepth(TONE + 0.5),
  );
  const glow = (x: number, y: number, w: number, h: number, alpha: number, flicker: number) => {
    const g = scene.add
      .image(x, y, "warm-glow")
      .setDisplaySize(w, h)
      .setAlpha(alpha)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(LIGHT);
    objects.push(g);
    tweens.push(
      scene.tweens.add({
        targets: g,
        alpha: alpha * 0.72,
        duration: flicker,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      }),
    );
  };
  glow(405, 215, 480, 360, 0.7, 380);
  glow(330, 430, 560, 420, 0.3, 900);
  glow(360, 545, 150, 80, 0.35, 520);
  glow(190, 985, 170, 140, 0.4, 700);
  glow(350, 985, 170, 140, 0.4, 820);
  const sparks = scene.add.particles(405, 225, "spark", {
    speedX: { min: -35, max: 35 },
    speedY: { min: -130, max: -55 },
    lifespan: { min: 600, max: 1100 },
    scale: { start: 0.9, end: 0 },
    alpha: { start: 1, end: 0 },
    frequency: 160,
    quantity: 1,
    blendMode: "ADD",
  });
  sparks.setDepth(LIGHT + 1);
  objects.push(sparks);

  const label = (
    text: string,
    x: number,
    y: number,
    size: number,
    color: string,
    extra: object = {},
  ) =>
    objects.push(
      scene.add
        .text(x, y, text, { fontFamily: "Arial", fontSize: size + "px", color, ...extra })
        .setOrigin(0.5)
        .setResolution(2)
        .setDepth(1000),
    );
  label("↓  WYJŚCIE DO MIASTA", room.exit.x, room.exit.y - 4, 17, "#f4dfab", {
    backgroundColor: "#2a140acc",
    padding: { x: 10, y: 7 },
  });
  return {
    dispose: () => {
      tweens.forEach((t) => t.stop());
      objects.forEach((o) => o.destroy());
    },
  };
}
