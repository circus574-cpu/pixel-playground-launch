import { FOREST, FOREST_OBJECTS, FOREST_MINIMAP, forestObstacles } from "./forest";
import { TUTORIAL_MARKET } from "../tutorial";
import aether from "./regions/aether.json" with { type: "json" };
import nexus from "./regions/nexus.json" with { type: "json" };
import pyra from "./regions/pyra.json" with { type: "json" };
import type { WorldId } from "./races";
import type { WorldDefinition } from "./types";

export const WORLDS: Record<WorldId, WorldDefinition> = {
  verdant: {
    id: "verdant",
    race: "planetary",
    name: "Verdantia",
    settlement: "Wioska Początkowa",
    description:
      "Leśna dolina, rzeka i kamienne szlaki podróżników. Żywa planeta zaprasza do odkrywania.",
    architecture: "Drewniane i kamienne domy, most i kuźnia wśród drzew.",
    width: FOREST.width,
    height: FOREST.height,
    spawn: FOREST.spawn,
    background: "#172b1a",
    minimap: FOREST_MINIMAP,
    market: { ...TUTORIAL_MARKET, action: "Podejdź do rynku" },
    npcs: [
      { id: "guide", name: "Aira", role: "Przewodniczka", x: 1570, y: 1250, tint: 0xa8f0cf },
      { id: "hunter", name: "Ren", role: "Strażnik lasu", x: 1850, y: 1070, tint: 0xffc7a4 },
      { id: "merchant", name: "Mio", role: "Kupczyni", x: 1260, y: 1100, tint: 0xd6b3ff },
      { id: "smith", name: "Taro", role: "Kowal", x: 1260, y: 1560, tint: 0xa4d5ff },
    ],
    enemies: FOREST.enemies,
    enemyName: "Dzik leśny",
    huntName: "Zagrożenie w lesie",
    landmarks: [
      { x: 1480, y: 800, label: "Rynek", kind: "settlement" },
      { x: 2050, y: 1030, label: "Dzikie szlaki", kind: "danger" },
    ],
    objects: FOREST_OBJECTS,
    obstacles: forestObstacles(),
  },
  aether: aether as WorldDefinition,
  nexus: nexus as WorldDefinition,
  pyra: pyra as WorldDefinition,
};
export function worldObstacles(world: WorldDefinition) {
  if (world.id === "verdant") return [...world.obstacles];
  return [
    ...world.obstacles,
    ...world.objects
      .filter((o) => o.solid && o.footprint)
      .map((o) => ({
        x: o.x - o.footprint!.width / 2,
        y: o.y + (o.footprint!.offsetY ?? 0) - o.footprint!.height / 2,
        width: o.footprint!.width,
        height: o.footprint!.height,
      })),
  ];
}
