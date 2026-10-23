import { FOREST } from "./forest";
import { TUTORIAL_MARKET } from "../tutorial";
import aether from "./regions/aether.json" with { type: "json" };
import nexus from "./regions/nexus.json" with { type: "json" };
import pyra from "./regions/pyra.json" with { type: "json" };
import type { WorldId } from "./races";
import type { WorldDefinition } from "./types";
import { VERDANT_CITY, CITY_OBJECTS, CITY_OBSTACLES, CITY_NPCS } from "../city/verdantia";

export const WORLDS: Record<WorldId, WorldDefinition> = {
  verdant: {
    id: "verdant",
    race: "planetary",
    name: "Verdantia",
    settlement: VERDANT_CITY.name,
    description:
      "Leśna dolina, rzeka i kamienne szlaki podróżników. Żywa planeta zaprasza do odkrywania.",
    architecture: "Drewniane i kamienne domy, most i kuźnia wśród drzew.",
    width: FOREST.width,
    height: FOREST.height,
    spawn: FOREST.spawn,
    background: "#172b1a",
    minimap: "/game/assets/city-verdant-v1/minimap.svg",
    market: { ...TUTORIAL_MARKET, action: "Podejdź do rynku" },
    npcs: CITY_NPCS,
    city: VERDANT_CITY,
    enemies: [],
    enemyName: "Dzik leśny",
    huntName: "Zagrożenie w lesie",
    landmarks: [
      { x: 1480, y: 800, label: "Rynek", kind: "settlement" },
      ...VERDANT_CITY.buildings.map((b) => ({
        ...b.door,
        label: b.name,
        kind: "settlement" as const,
      })),
    ],
    objects: CITY_OBJECTS,
    obstacles: CITY_OBSTACLES,
  },
  aether: aether as unknown as WorldDefinition,
  nexus: nexus as unknown as WorldDefinition,
  pyra: pyra as unknown as WorldDefinition,
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
