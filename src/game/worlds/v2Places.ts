import type { Landmark } from "../world/types";
import places from "./v2Places.generated.json";

type Place = { name: string; x: number; y: number };
type ContinentPlaces = {
  cities: Record<string, Place & { settlement: string }>;
  famous: Record<string, Place & { source: string }>;
  hidden: Record<string, Place>;
};
const data = places as Record<string, ContinentPlaces>;

/** Argon's cities and famous locations on world v2 (scripts/worldgen/v2/bind_quest_places.py). */
export function v2Places(continent: string) {
  const c = data[continent];
  if (!c) return undefined;
  const townNames: Record<string, string> = {};
  for (const city of Object.values(c.cities)) townNames[city.settlement] = city.name;
  const famous: Landmark[] = Object.values(c.famous).map((f) => ({
    x: f.x,
    y: f.y,
    label: f.name,
    kind: "famous",
  }));
  return { townNames, famous, famousById: c.famous, cities: c.cities, hidden: c.hidden };
}
