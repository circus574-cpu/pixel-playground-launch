/** Shared simulation geometry for browser rendering and server authority. No Phaser or window. */
import type { CityDefinition, BuildingId } from "../../city/types";
import type { WorldDefinition, WorldNpc } from "../types";
import { WORLDS } from "../worlds";
import type { Point, Navigation } from "../../navigation";
import type { Obstacle } from "../../movement";
import type { Player } from "../../session";
import type { FeatureInfo, FeatureId } from "./superiorSave";
import type { v2Places } from "../../worlds/v2Places";
type Settlement = Point & { id: string; name: string; kind: string; bounds: Obstacle };
export type SuperiorSimulationSource = {
  feature: FeatureId;
  affinity: keyof typeof WORLDS;
  name: string;
  geometry: { width: number; height: number; anchor: Point };
  sourceOffset: Point | null;
  acceptedSource: WorldDefinition | null;
  settlements: Settlement[];
  roads: { points: [number, number][]; width: number; kind: string }[];
  buildings: {
    id: string;
    settlement: string;
    service: string;
    door: Point;
    footprint: Obstacle;
  }[];
};
const names: Record<BuildingId, string> = {
  shop: "Sklep",
  hall: "Dom zgromadzeń",
  inn: "Gospoda",
  smithy: "Kuźnia",
  depot: "Depozyt",
  arena: "Arena treningowa",
};

export function buildSuperiorSimulationWorld(options: {
  source: SuperiorSimulationSource;
  info: FeatureInfo;
  navigation: Navigation;
  restored?: Player | undefined;
  town: string | null;
  basePath: string;
  places?: ReturnType<typeof v2Places> | undefined;
}) {
  const { source, info, navigation, restored, town, basePath, places } = options;
  const offset = source.sourceOffset ?? { x: 0, y: 0 };
  const shift = (p: Point): Point => ({ x: p.x + offset.x, y: p.y + offset.y });
  const base = structuredClone(WORLDS[info.affinity]);
  const cities = new Map<
    string,
    { city: CityDefinition; npcs: WorldNpc[]; market: WorldDefinition["market"] }
  >();
  for (const town of source.settlements) {
    if (town.kind === "village") continue;
    const capital = town.id.endsWith("-capital") && source.acceptedSource;
    let city: CityDefinition, npcs: WorldNpc[], market: WorldDefinition["market"];
    if (capital && capital.city) {
      city = {
        ...structuredClone(capital.city),
        bounds: town.bounds,
        buildings: capital.city.buildings.map((b) => ({ ...b, door: shift(b.door) })),
        roads: [],
      };
      npcs = capital.npcs.map((n) => ({ ...n, ...shift(n) }));
      market = { ...capital.market, ...shift(capital.market) };
    } else {
      const buildings = source.buildings.filter(
        (b) => b.settlement === town.id && b.service in names,
      );
      if (buildings.length !== 6) continue;
      city = {
        name: town.name,
        bounds: town.bounds,
        roads: [],
        buildings: buildings.map((b) => ({
          id: b.service as BuildingId,
          objectId: b.id,
          door: b.door,
          name: names[b.service as BuildingId],
          district: town.name,
          description: names[b.service as BuildingId],
        })),
      };
      npcs = base.npcs.map((n) => ({
        ...n,
        name: town.name + " · " + n.role,
        x: town.x + (n.id === "hunter" ? -120 : 120),
        y: town.y + 180,
      }));
      market = { ...base.market, x: town.x, y: town.y };
    }
    cities.set(town.id, { city, npcs, market });
  }
  if (restored?.interior && !cities.has(town ?? ""))
    throw Error("Nieznane miasto zapisu wyprawy; oryginał zachowano.");
  const initialTown = cities.has(town ?? "")
    ? town!
    : [...cities.keys()].sort((a, b) => {
        const p = restored && !restored.interior ? restored : info.arrival;
        const aa = source.settlements.find((s) => s.id === a)!,
          bb = source.settlements.find((s) => s.id === b)!;
        return Math.hypot(p.x - aa.x, p.y - aa.y) - Math.hypot(p.x - bb.x, p.y - bb.y);
      })[0];
  if (!initialTown) throw Error("Brak osiągalnego miasta");
  const first = cities.get(initialTown)!;
  const world: WorldDefinition = {
    ...base,
    name: source.name,
    settlement: first.city.name,
    width: info.width,
    height: info.height,
    spawn: navigation.safe(info.arrival),
    minimap: basePath + "/" + info.id + "/minimap.svg",
    objects: [],
    obstacles: [],
    enemies: [],
    monsters: [],
    city: first.city,
    npcs: first.npcs,
    market: first.market,
    safeAreas: source.settlements.map((s) => s.bounds),
    landmarks: [
      ...source.settlements.map((s) => ({
        x: s.x,
        y: s.y,
        label: s.name,
        kind: "settlement" as const,
      })),
      ...(places?.famous ?? []),
    ],
  };
  const outsideCities = (p: Point) =>
    !source.settlements.some(
      (s) =>
        p.x >= s.bounds.x - 12 &&
        p.x <= s.bounds.x + s.bounds.width + 12 &&
        p.y >= s.bounds.y - 12 &&
        p.y <= s.bounds.y + s.bounds.height + 12,
    );
  const heritageHome = [...cities.entries()].sort(([a], [b]) => {
    const aa = source.settlements.find((t) => t.id === a)!,
      bb = source.settlements.find((t) => t.id === b)!;
    return (
      Math.hypot(aa.x - info.arrival.x, aa.y - info.arrival.y) -
      Math.hypot(bb.x - info.arrival.x, bb.y - info.arrival.y)
    );
  })[0]![1];

  return { base, world, cities, initialTown, heritageHome, outsideCities, shift };
}
