import type Phaser from "phaser";

/** HD-2D mood for a painted room: lantern light, window shafts, dust and soft camera filters. */
export type RoomAtmosphere = {
  /** Cool dusk tint laid over the painting; the warm lights below break through it. */
  ambient: { color: number; alpha: number };
  lights: readonly {
    x: number;
    y: number;
    radius: number;
    color: number;
    alpha: number;
    flicker?: boolean;
  }[];
  /** Beams from windows: top point, length, width and the lean (degrees, + leans left). */
  shafts: readonly {
    x: number;
    y: number;
    length: number;
    width: number;
    lean: number;
    alpha: number;
  }[];
  motes: { x: number; y: number; width: number; height: number; count: number };
};
const DEPTH = 15000;
const LIGHT = "ki-room-light";
const SHAFT = "ki-room-shaft";
const MOTE = "ki-room-mote";

function ensureTextures(scene: Phaser.Scene) {
  if (!scene.textures.exists(LIGHT)) {
    const t = scene.textures.createCanvas(LIGHT, 256, 256)!;
    const c = t.getContext();
    const g = c.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,255,255,0.55)");
    g.addColorStop(0.6, "rgba(255,255,255,0.14)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 256, 256);
    t.refresh();
  }
  if (!scene.textures.exists(SHAFT)) {
    // A soft vertical beam: bright at the window, fading down and to the sides.
    const t = scene.textures.createCanvas(SHAFT, 128, 256)!;
    const c = t.getContext();
    const g = c.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, "rgba(255,255,255,0.9)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 256);
    c.globalCompositeOperation = "destination-in";
    const h = c.createLinearGradient(0, 0, 128, 0);
    h.addColorStop(0, "rgba(0,0,0,0)");
    h.addColorStop(0.3, "rgba(0,0,0,1)");
    h.addColorStop(0.7, "rgba(0,0,0,1)");
    h.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = h;
    c.fillRect(0, 0, 128, 256);
    t.refresh();
  }
  if (!scene.textures.exists(MOTE)) {
    const t = scene.textures.createCanvas(MOTE, 16, 16)!;
    const c = t.getContext();
    const g = c.createRadialGradient(8, 8, 0, 8, 8, 8);
    g.addColorStop(0, "rgba(255,244,214,1)");
    g.addColorStop(1, "rgba(255,244,214,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 16, 16);
    t.refresh();
  }
}

export function renderRoomAtmosphere(
  scene: Phaser.Scene,
  room: { width: number; height: number },
  spec: RoomAtmosphere,
  focus: () => { x: number; y: number },
) {
  ensureTextures(scene);
  const objects: Phaser.GameObjects.GameObject[] = [];
  const tweens: Phaser.Tweens.Tween[] = [];
  const dusk = scene.add
    .rectangle(0, 0, room.width, room.height, spec.ambient.color, spec.ambient.alpha)
    .setOrigin(0)
    .setDepth(DEPTH);
  objects.push(dusk);
  const lights = spec.lights.map((l) => {
    const sprite = scene.add
      .image(l.x, l.y, LIGHT)
      .setDisplaySize(l.radius * 2, l.radius * 2)
      .setTint(l.color)
      .setAlpha(l.alpha)
      .setBlendMode("ADD" as unknown as number)
      .setDepth(DEPTH + 1);
    objects.push(sprite);
    if (l.flicker)
      tweens.push(
        scene.tweens.add({
          targets: sprite,
          alpha: { from: l.alpha * 0.8, to: l.alpha * 1.05 },
          duration: 420 + Math.random() * 380,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        }),
      );
    return sprite;
  });
  for (const s of spec.shafts) {
    const beam = scene.add
      .image(s.x, s.y, SHAFT)
      .setOrigin(0.5, 0)
      .setDisplaySize(s.width, s.length)
      .setAngle(s.lean)
      .setTint(0xffe2a8)
      .setAlpha(s.alpha)
      .setBlendMode("ADD" as unknown as number)
      .setDepth(DEPTH + 1);
    objects.push(beam);
    tweens.push(
      scene.tweens.add({
        targets: beam,
        alpha: { from: s.alpha * 0.75, to: s.alpha },
        duration: 3200,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      }),
    );
  }
  for (let i = 0; i < spec.motes.count; i++) {
    const m = scene.add
      .image(
        spec.motes.x + Math.random() * spec.motes.width,
        spec.motes.y + Math.random() * spec.motes.height,
        MOTE,
      )
      .setScale(0.5 + Math.random() * 0.9)
      .setAlpha(0)
      .setBlendMode("ADD" as unknown as number)
      .setDepth(DEPTH + 2);
    objects.push(m);
    tweens.push(
      scene.tweens.add({
        targets: m,
        x: m.x + (Math.random() - 0.5) * 140,
        y: m.y - 40 - Math.random() * 90,
        alpha: { from: 0, to: 0.55 },
        duration: 5000 + Math.random() * 4000,
        delay: Math.random() * 4000,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      }),
    );
  }
  // The hero carries a small warm light, so the dusk never hides the one thing to follow.
  const hero = scene.add
    .image(0, 0, LIGHT)
    .setDisplaySize(420, 420)
    .setTint(0xffd79a)
    .setAlpha(0.3)
    .setBlendMode("ADD" as unknown as number)
    .setDepth(DEPTH + 1);
  objects.push(hero);
  const follow = () => {
    const p = focus();
    hero.setPosition(p.x, p.y - 30);
  };
  scene.events.on("update", follow);
  // Camera filters: a soft vignette, a gentle tilt-shift blur at the top and bottom, a warmer grade.
  const cam = scene.cameras.main;
  const fx = cam.filters as unknown as
    | {
        external: {
          addVignette: (x?: number, y?: number, r?: number, s?: number) => unknown;
          addTiltShift?: (...a: number[]) => unknown;
          clear?: () => void;
        };
        internal: {
          addColorMatrix: () => {
            colorMatrix: {
              saturate: (v: number, m?: boolean) => unknown;
              contrast: (v: number, m?: boolean) => unknown;
            };
          };
          clear?: () => void;
        };
      }
    | undefined;
  try {
    fx?.external.addVignette(0.5, 0.5, 1.1, 0.22);
    const cm = fx?.internal.addColorMatrix();
    cm?.colorMatrix.saturate(0.18, true);
    cm?.colorMatrix.contrast(0.04, true);
  } catch {
    /* Canvas rendering has no filters: the room simply keeps the lights. */
  }
  void lights;
  return {
    dispose: () => {
      scene.events.off("update", follow);
      tweens.forEach((t) => t.remove());
      objects.forEach((o) => o.destroy());
      try {
        fx?.external.clear?.();
        fx?.internal.clear?.();
      } catch {
        /* nothing to clear */
      }
    },
  };
}
