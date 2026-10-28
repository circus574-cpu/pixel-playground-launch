import { DIRECTIONS } from "./schema";
/** The canvas currently renders at resolution 1: 96 world units → 46–60 screen px, max 96. */
export const GPU_CONTRACT = {
  schemaVersion: 1,
  directions: DIRECTIONS,
  framePattern: "{actor}/{state}/{direction}/{frame:02}",
  mechanicalImpactFrame: 0,
  rawFrame: 512,
  deliveryFrame: 128,
  /** Hero sheets cut from video may use double-resolution frames; one actor uses one side. */
  heroFrame: 256,
  maxAtlasSide: 2048,
  maxWorldTextureBytes: 128 * 1024 * 1024,
  hero: { size: [96, 96], origin: [0.5, 0.95], footRadius: 12 },
  // Fixed 45° skeletal camera: room below the ground anchor for a real stride.
  groundedHero: { size: [128, 128], origin: [0.5, 0.75], footRadius: 12 },
  enemy: { size: [84, 84], origin: [0.5, 0.8] },
  animations: {
    idle: { frames: 8, fps: 6, loop: true },
    walk: { frames: 8, fps: 16, loop: true },
    attack: { frames: 8, fps: 16, loop: false },
    skill: { frames: 8, fps: 12, loop: false },
    hit: { frames: 4, fps: 16, loop: false },
    death: { frames: 8, fps: 10, loop: false },
    respawn: { frames: 8, fps: 12, loop: false },
  },
} as const;
