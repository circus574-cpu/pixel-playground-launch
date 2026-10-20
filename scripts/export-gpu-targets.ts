import { writeFile } from "node:fs/promises";
import { GPU_CONTRACT } from "../src/game/assets/contract.ts";
import { WORLDS } from "../src/game/world/worlds.ts";
import { INTERACTION_BOUNDS, FOOT_RADIUS, WORLD_EDGE_MARGIN } from "../src/game/geometry.ts";
const targets = {
  schemaVersion: 1,
  coordinatesAreReadOnly: true,
  contract: GPU_CONTRACT,
  geometry: { FOOT_RADIUS, WORLD_EDGE_MARGIN, INTERACTION_BOUNDS },
  camera: {
    projection: "orthographic-top-down-with-visible-south-facade",
    elevationDegrees: 60,
    keyLight: "north-west",
    resolution: 1,
    zoom: { desktop: 0.62, mobile: 0.48, min: 0.35, max: 1 },
  },
  worlds: Object.fromEntries(
    Object.values(WORLDS).map((w) => [
      w.id,
      {
        race: w.race,
        name: w.name,
        size: [w.width, w.height],
        spawn: w.spawn,
        questTarget: w.market,
        terrain: w.terrain ?? {
          format: "forest-autotile-64-margin2-spacing4",
          sourceAtlas: [1904, 1904],
        },
        actorBindings: [
          w.id + ".hero",
          w.id + ".enemy",
          ...w.npcs.map((n) => w.id + ".npc." + n.id),
        ],
        scenery: w.objects.map((o) => ({
          id: o.id,
          binding: "object." + w.id + "." + o.id,
          sharedBinding: w.terrain ? "object." + o.asset : "object.forest." + o.kind,
          position: [o.x, o.y],
          worldSize: [o.width, o.height],
          origin: [o.anchorX, o.anchorY],
          solid: o.solid,
          footprint: o.footprint ?? null,
        })),
      },
    ]),
  ),
};
await writeFile(
  "art/pipeline/gpu-production-targets.json",
  JSON.stringify(targets, null, 2) + "\n",
);
console.log("Exported current world geometry and GPU targets without modifying maps.");
