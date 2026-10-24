import { FOREST_ORIGIN, FOREST_SPAWN, VERDANT_SIZE } from "./forest";
import { TUTORIAL_MARKET } from "../tutorial";
import aether from "./regions/aether.json" with { type: "json" };
import nexus from "./regions/nexus.json" with { type: "json" };
import pyra from "./regions/pyra.json" with { type: "json" };
import type { WorldId } from "./races";
import type { WorldDefinition } from "./types";
import {
  VERDANT_CITY,
  VERDANT_CITY_BOUNDS,
  VERDANT_BOARS,
  CITY_OBJECTS,
  CITY_OBSTACLES,
  CITY_NPCS,
} from "../city/verdantia";

export const WORLDS: Record<WorldId, WorldDefinition> = {
  verdant: {
    id: "verdant",
    race: "planetary",
    name: "Verdantia",
    settlement: VERDANT_CITY.name,
    description:
      "Leśna dolina, rzeka i kamienne szlaki podróżników. Żywa planeta zaprasza do odkrywania.",
    architecture: "Drewniane i kamienne domy, most i kuźnia wśród drzew.",
    ...VERDANT_SIZE,
    spawn: FOREST_SPAWN,
    background: "#172b1a",
    minimap: "/game/assets/stage3/verdant-minimap.webp",
    market: {
      ...TUTORIAL_MARKET,
      x: TUTORIAL_MARKET.x + FOREST_ORIGIN.x,
      y: TUTORIAL_MARKET.y + FOREST_ORIGIN.y,
      action: "Podejdź do rynku",
    },
    npcs: CITY_NPCS,
    city: VERDANT_CITY,
    enemies: VERDANT_BOARS,
    enemyName: "Dzik leśny",
    huntName: "Zagrożenie w lesie",
    landmarks: [
      {
        x: 1480 + FOREST_ORIGIN.x,
        y: 800 + FOREST_ORIGIN.y,
        label: "Rynek",
        kind: "settlement",
      },
      ...VERDANT_CITY.buildings.map((b) => ({
        ...b.door,
        label: b.name,
        kind: "settlement" as const,
      })),
      {
        x: VERDANT_CITY_BOUNDS.x + VERDANT_CITY_BOUNDS.width + 500,
        y: VERDANT_CITY_BOUNDS.y + VERDANT_CITY_BOUNDS.height / 2,
        label: "Dzikie szlaki",
        kind: "danger" as const,
      },
    ],
    objects: CITY_OBJECTS,
    obstacles: CITY_OBSTACLES,
    layout: 2,
    legacyShift: FOREST_ORIGIN,
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
