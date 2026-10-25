// Dumps Argon's continent definitions (cities, famous locations, hidden places) for bind_quest_places.py.
import { CONTINENTS_WORLD_V2 } from "../../../src/game/worlds";
const out = Object.fromEntries(
  Object.entries(CONTINENTS_WORLD_V2).map(([id, c]) => [
    id,
    {
      size: c.size,
      cities: c.cities.map((x) => ({ id: x.id, name: x.name, role: x.role, bounds: x.bounds })),
      famous: c.famousLocations.map((x) => ({ id: x.id, name: x.name, mapPointId: x.mapPointId })),
      hidden: c.hiddenPlaces.map((x) => ({ id: x.id, name: x.name, coordinates: x.coordinates })),
    },
  ]),
);
console.log(JSON.stringify(out));
