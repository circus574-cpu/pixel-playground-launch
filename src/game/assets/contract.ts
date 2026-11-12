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
  /** Landmark NPCs (the Trener) are drawn twice the standard NPC size from 256 px source frames. */
  npcLarge: { size: [192, 192], origin: [0.5, 0.95] },
  animations: {
    idle: { frames: 8, fps: 6, loop: true },
    walk: { frames: 8, fps: 16, loop: true },
    attack: { frames: 8, fps: 16, loop: false },
    skill: { frames: 8, fps: 12, loop: false },
    hit: { frames: 4, fps: 16, loop: false },
    death: { frames: 8, fps: 10, loop: false },
    respawn: { frames: 8, fps: 12, loop: false },
  },
  /** Optional hero clips outside the 416-frame render delivery (Tryb KI, cut from the stage 4 videos). */
  optionalAnimations: {
    kiidle: { frames: 6, fps: 6, loop: true },
    kiattack: { frames: 6, fps: 12, loop: false },
    kiskill: { frames: 8, fps: 12, loop: false },
    attack2: { frames: 6, fps: 12, loop: false },
    finisher: { frames: 8, fps: 12, loop: false },
    skillb: { frames: 8, fps: 12, loop: false },
    dodge: { frames: 6, fps: 14, loop: false },
    guard: { frames: 6, fps: 10, loop: false },
    hitheavy: { frames: 8, fps: 12, loop: false },
    victory: { frames: 8, fps: 10, loop: false },
    /** Tryb KI combat (stage 4 videos) and reactions (KI-form reaction videos): the form's own clips, never the base outfit. */
    kiattack2: { frames: 6, fps: 12, loop: false },
    kifinisher: { frames: 8, fps: 12, loop: false },
    kiskillb: { frames: 8, fps: 12, loop: false },
    kidodge: { frames: 6, fps: 14, loop: false },
    kiguard: { frames: 6, fps: 10, loop: false },
    kihit: { frames: 6, fps: 14, loop: false },
    kihitheavy: { frames: 8, fps: 12, loop: false },
    kideath: { frames: 8, fps: 10, loop: false },
    kirespawn: { frames: 8, fps: 12, loop: false },
    kivictory: { frames: 8, fps: 10, loop: false },
    /** Base-form movement clips cut from the stage 3 videos. */
    run: { frames: 8, fps: 16, loop: true },
    channel: { frames: 8, fps: 10, loop: true },
    skillc: { frames: 8, fps: 12, loop: false },
    interact: { frames: 6, fps: 10, loop: false },
  },
} as const;
