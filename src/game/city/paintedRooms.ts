import type { BuildingId, Interior } from "./types";

/**
 * Painted interiors of the six special buildings (hall, shop, arena, depot, smithy, inn) of the four cities.
 * Source art: art/production/interiors/<city>/<world>-<building>-interior.png (1536×1024), shipped as
 * public/game/interiors/<world>-<building>.webp by scripts/build_painted_rooms.py.
 *
 * Every picture shares one composition: a flat back wall in the top quarter, a large open floor, furniture only against
 * the back wall and sides, a doorway at the bottom centre. The room is 1920×1280 world units (the old rooms were
 * 960×760, the Pyra smithy 540×1100). Footprints below are read from the pictures in 0..1000 units of the picture
 * (x across, y down) and scaled to the room, so collision follows the painted furniture; it never depends on the art file.
 */
export const ROOM_WIDTH = 1920;
export const ROOM_HEIGHT = 1280;

export const PAINTED_WORLDS = ["verdant", "aether", "nexus", "pyra"] as const;
export type PaintedWorld = (typeof PAINTED_WORLDS)[number];

type Rect = readonly [number, number, number, number];
type Spec = {
  /** Where the open floor starts (bottom edge of the back wall and its furniture). */
  wallY: number;
  blocks: readonly Rect[];
  npc: readonly [number, number];
  /** Depot chest and arena dummy: the point where the player stands to use them. */
  chest?: readonly [number, number];
  dummy?: readonly [number, number];
  /** Room size in world units; the Pyra smithy picture is a portrait (1024×1536), all others are 3:2 landscapes. */
  size?: readonly [number, number];
};

const SIDE = 45;
const FRONT = 975;
const EXIT_Y = 945;
const ENTRY_Y = 875;

const SPECS: Record<PaintedWorld, Record<BuildingId, Spec>> = {
  verdant: {
    hall: {
      wallY: 450,
      blocks: [
        [225, 470, 725, 650],
        [0, 250, 100, 700],
        [800, 430, 1000, 700],
      ],
      npc: [480, 740],
    },
    shop: {
      wallY: 440,
      blocks: [
        [280, 470, 700, 680],
        [40, 370, 300, 570],
        [60, 610, 200, 790],
        [800, 380, 1000, 700],
        [880, 660, 1000, 890],
      ],
      npc: [490, 735],
    },
    arena: {
      wallY: 450,
      blocks: [
        [60, 460, 250, 570],
        [770, 490, 900, 570],
        [880, 440, 970, 560],
      ],
      npc: [320, 640],
      dummy: [500, 560],
    },
    depot: {
      wallY: 500,
      blocks: [
        [0, 430, 210, 790],
        [710, 450, 870, 610],
        [865, 420, 965, 560],
        [880, 690, 1000, 870],
      ],
      npc: [600, 720],
      chest: [790, 630],
    },
    smithy: {
      wallY: 440,
      blocks: [
        [320, 430, 610, 590],
        [370, 600, 570, 790],
        [60, 440, 330, 660],
        [50, 570, 170, 790],
        [590, 380, 700, 545],
        [690, 500, 880, 870],
        [790, 330, 970, 560],
      ],
      npc: [630, 740],
    },
    inn: {
      wallY: 440,
      blocks: [
        [20, 450, 250, 900],
        [230, 540, 330, 690],
        [660, 400, 1000, 610],
        [760, 590, 1000, 830],
      ],
      npc: [480, 700],
    },
  },
  aether: {
    hall: {
      wallY: 430,
      blocks: [
        [280, 350, 730, 570],
        [110, 420, 230, 570],
        [800, 400, 900, 560],
        [0, 640, 270, 1000],
      ],
      npc: [500, 650],
    },
    shop: {
      wallY: 430,
      blocks: [
        [270, 430, 730, 690],
        [70, 470, 200, 640],
        [780, 470, 900, 640],
        [0, 540, 120, 800],
        [880, 540, 1000, 800],
      ],
      npc: [500, 740],
    },
    arena: {
      wallY: 460,
      blocks: [
        [180, 340, 320, 520],
        [0, 560, 240, 720],
        [50, 740, 230, 890],
        [760, 540, 930, 660],
        [830, 700, 990, 860],
      ],
      npc: [350, 600],
      dummy: [500, 540],
    },
    depot: {
      wallY: 590,
      blocks: [
        [0, 0, 160, 900],
        [830, 0, 1000, 900],
        [690, 590, 880, 780],
        [610, 590, 690, 730],
      ],
      npc: [330, 720],
      chest: [455, 620],
    },
    smithy: {
      wallY: 440,
      blocks: [
        [365, 430, 610, 640],
        [380, 610, 540, 810],
        [100, 530, 240, 720],
        [680, 420, 790, 790],
        [780, 500, 930, 740],
      ],
      npc: [320, 800],
    },
    inn: {
      wallY: 440,
      blocks: [
        [0, 380, 340, 690],
        [550, 330, 1000, 720],
        [700, 780, 910, 990],
      ],
      npc: [450, 780],
    },
  },
  nexus: {
    hall: {
      wallY: 450,
      blocks: [
        [340, 410, 660, 780],
        [50, 430, 170, 560],
        [850, 640, 960, 890],
      ],
      npc: [250, 700],
    },
    shop: {
      wallY: 450,
      blocks: [
        [350, 390, 620, 660],
        [80, 360, 180, 640],
        [210, 250, 330, 590],
        [610, 250, 880, 570],
        [860, 460, 940, 720],
      ],
      npc: [490, 730],
    },
    arena: { wallY: 450, blocks: [], npc: [330, 620], dummy: [500, 560] },
    depot: {
      wallY: 440,
      blocks: [
        [80, 330, 170, 540],
        [820, 340, 920, 520],
      ],
      npc: [350, 600],
      chest: [495, 480],
    },
    smithy: {
      wallY: 440,
      blocks: [
        [335, 385, 590, 590],
        [60, 450, 170, 580],
        [700, 340, 860, 590],
      ],
      npc: [480, 720],
    },
    inn: {
      wallY: 440,
      blocks: [
        [40, 420, 200, 690],
        [440, 380, 550, 540],
        [780, 350, 900, 540],
        [800, 540, 970, 790],
      ],
      npc: [470, 690],
    },
  },
  pyra: {
    hall: {
      wallY: 450,
      blocks: [
        [340, 300, 620, 540],
        [270, 380, 350, 520],
        [600, 370, 680, 520],
        [700, 250, 800, 520],
        [0, 400, 220, 640],
      ],
      npc: [480, 640],
    },
    shop: {
      wallY: 450,
      blocks: [
        [290, 460, 720, 690],
        [50, 520, 190, 760],
        [170, 440, 270, 640],
        [740, 450, 850, 650],
        [840, 540, 950, 780],
      ],
      npc: [500, 745],
    },
    arena: {
      wallY: 450,
      blocks: [
        [100, 400, 210, 550],
        [50, 620, 160, 770],
        [150, 670, 200, 900],
        [830, 710, 900, 930],
        [840, 490, 930, 620],
      ],
      npc: [340, 620],
      dummy: [500, 540],
    },
    depot: {
      wallY: 520,
      blocks: [
        [0, 560, 230, 860],
        [190, 420, 280, 540],
        [800, 390, 960, 820],
      ],
      npc: [350, 650],
      chest: [490, 560],
    },
    smithy: {
      wallY: 440,
      size: [1280, 1920],
      blocks: [
        [300, 440, 690, 510],
        [350, 510, 640, 660],
        [40, 440, 290, 660],
        [20, 670, 300, 870],
        [700, 440, 990, 660],
        [840, 590, 1000, 780],
        [720, 780, 1000, 960],
      ],
      npc: [500, 750],
    },
    inn: {
      wallY: 440,
      blocks: [
        [10, 320, 290, 830],
        [650, 330, 1000, 590],
        [80, 700, 210, 830],
        [790, 690, 1000, 860],
        [700, 770, 780, 900],
        [180, 780, 260, 920],
      ],
      npc: [480, 700],
    },
  },
};

export const isPaintedWorld = (id: string | undefined): id is PaintedWorld =>
  !!id && (PAINTED_WORLDS as readonly string[]).includes(id);

export function paintedRoom(building: BuildingId, world: PaintedWorld): Interior {
  const s = SPECS[world][building];
  const [width, height] = s.size ?? [ROOM_WIDTH, ROOM_HEIGHT];
  const sx = width / 1000,
    sy = height / 1000;
  const rect = (r: Rect) => ({
    x: Math.round(r[0] * sx),
    y: Math.round(r[1] * sy),
    width: Math.round((r[2] - r[0]) * sx),
    height: Math.round((r[3] - r[1]) * sy),
  });
  const pt = (p: readonly [number, number]) => ({
    x: Math.round(p[0] * sx),
    y: Math.round(p[1] * sy),
  });
  return {
    width,
    height,
    entry: pt([500, ENTRY_Y]),
    exit: pt([500, EXIT_Y]),
    npc: pt(s.npc),
    // Rooms without a chest or a dummy keep these on the NPC spot, which is always open floor.
    chest: pt(s.chest ?? s.npc),
    dummy: pt(s.dummy ?? s.npc),
    obstacles: [
      rect([0, 0, 1000, s.wallY]),
      rect([0, 0, SIDE, 1000]),
      rect([1000 - SIDE, 0, 1000, 1000]),
      rect([0, FRONT, 1000, 1000]),
      ...s.blocks.map(rect),
    ],
  };
}

/** Picture of a room, for the renderer and for the build script. */
export const roomPicture = (world: PaintedWorld, building: BuildingId) =>
  `/game/interiors/${world}-${building}.webp`;
