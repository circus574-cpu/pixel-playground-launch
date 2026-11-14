import developmentData from "@/game/admin/worldDevelopment.generated.json";
import rawCatalog from "@/game/admin/worldOverviewCatalog.generated.json";
import type { NpcDialogueDefinition } from "@/game/dialogue/types";
import type { QuestDefinition } from "@/game/quests/types";
import type { WorldNpc } from "@/game/world/types";
import type { MonsterDef } from "@/game/monsters/types";
import type { BossDefinition } from "@/game/bosses/types";
import type {
  AdventureRoad,
  CityDefinition,
  FamousLocation,
  HiddenPlace,
  WorldEventDefinition,
} from "@/game/worlds/types";
import type { AuthoredSpawn } from "@/game/world/generated/spawnStream";
import type { SuperiorSimulationSource } from "@/game/world/generated/simulationWorld";
import type { FeatureInfo, FeatureId } from "@/game/world/generated/superiorSave";
import type { AdminWorldOverrides } from "@/game/world/adminWorldStore";
import { applyCustomSpawnsForFeature } from "@/game/world/adminWorldStore";
import { cityRoom } from "@/game/city/room";
import { BUILDING_IDS, type BuildingId } from "@/game/city/types";
import type { Navigation } from "@/game/navigation";
import type { Obstacle } from "@/game/movement";

export const overviewCatalog = rawCatalog as unknown as {
  tutorialQuests: Record<string, string>;
  roads: AdventureRoad[];
  markets: Record<string, Point & { radius: number; instruction: string }>;
  places: Record<string, Places>;
  equipmentDrops: Record<string, { itemId: string; name: string; chance: number }[]>;
  quests: QuestDefinition[];
  cities: CityDefinition[];
  famous: FamousLocation[];
  hidden: HiddenPlace[];
  events: WorldEventDefinition[];
  monsters: MonsterDef[];
  bosses: BossDefinition[];
  npcTemplates: Record<string, WorldNpc[]>;
  dialogues: Record<string, NpcDialogueDefinition>;
  items: unknown[];
  recipes: unknown[];
};
export type Point = { x: number; y: number };
export type Scope = { land: string; room?: string };
export type Layer =
  | "development"
  | "spawns"
  | "npcs"
  | "quests"
  | "towns"
  | "buildings"
  | "secrets"
  | "places"
  | "resources"
  | "dungeons"
  | "roads"
  | "collision"
  | "scenery";
export const LAYERS: Record<Layer, { name: string; color: string; symbol: string }> = {
  development: { name: "Rozwój, dziedzictwa i wyprawy", color: "#a5e1be", symbol: "✶" },
  spawns: { name: "Spawny potworów", color: "#ff786b", symbol: "◆" },
  npcs: { name: "NPC i rozmowy", color: "#80e8e0", symbol: "●" },
  quests: { name: "Questy i cele", color: "#f9d56d", symbol: "!" },
  towns: { name: "Miasta i bezpieczne strefy", color: "#9cdb9d", symbol: "▣" },
  buildings: { name: "Budynki, drzwi i usługi", color: "#e8c0ff", symbol: "⌂" },
  secrets: { name: "Sekrety i ukryte miejsca", color: "#cf9bff", symbol: "✧" },
  places: { name: "Lokacje i obozowiska", color: "#e5ddce", symbol: "◇" },
  resources: { name: "Zasoby", color: "#b6d868", symbol: "✦" },
  dungeons: { name: "Wejścia do podziemi", color: "#ffa96c", symbol: "▼" },
  roads: { name: "Drogi i ścieżki", color: "#c6a67b", symbol: "╱" },
  collision: { name: "Kolizje", color: "#ff4e8d", symbol: "▧" },
  scenery: { name: "Dekoracje w zbliżeniu", color: "#80b6a1", symbol: "♧" },
};
export type Entry = Point &
  Scope & {
    id: string;
    sourceId: string;
    name: string;
    layer: Layer;
    status: "runtime" | "data" | "unresolved";
    source: string;
    details: unknown;
    search: string;
    kind?: string;
    level?: number;
    radius?: number;
    bounds?: Obstacle;
    points?: [number, number][];
    related?: string[];
    town?: string;
    building?: BuildingId;
  };
type SourcePoint = Point & {
  id: string;
  name?: string;
  kind?: string;
  hidden?: boolean;
  [key: string]: unknown;
};
export type OverviewSource = SuperiorSimulationSource & {
  locations: SourcePoint[];
  resources: SourcePoint[];
  doors: SourcePoint[];
  dungeons: {
    id: string;
    instanceId: string;
    kind: string;
    overworldEntrance: Point;
    status: string;
  }[];
  biomeNames?: string[];
  zones?: SourcePoint[];
  peaks?: SourcePoint[];
  camps?: SourcePoint[];
};
export type LandData = {
  info: FeatureInfo;
  source: OverviewSource;
  entries: Entry[];
  collision: Obstacle[];
  manifest: Record<string, string>;
  rejected: string[];
};
export type Places = {
  cities: Record<string, Point & { name: string; settlement: string }>;
  famous: Record<string, Point & { name: string; source: string }>;
  hidden: Record<string, Point & { name: string }>;
};
export const placesFor = (id: string) => overviewCatalog.places[id];
export const roomKey = (town: string, building: BuildingId) => town + ":" + building;
export function normalized(value: string) {
  return value
    .toLocaleLowerCase("pl")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l");
}
const services: Record<BuildingId, string> = {
  shop: "Sklep",
  hall: "Dom zgromadzeń",
  inn: "Gospoda",
  smithy: "Kuźnia",
  depot: "Depozyt",
  arena: "Arena treningowa",
};
export function buildLandEntries(
  info: FeatureInfo,
  source: OverviewSource,
  authored: AuthoredSpawn[],
  nav: Navigation,
  overrides: AdminWorldOverrides,
): { entries: Entry[]; rejected: string[] } {
  const entries: Entry[] = [],
    rejected: string[] = [];
  const places = placesFor(info.affinity),
    offset = source.sourceOffset ?? { x: 0, y: 0 };
  const add = (e: Omit<Entry, "search" | "land" | "id"> & { id?: string }) => {
    const id = e.id ?? `${info.id}:${e.layer}:${e.room ?? "outside"}:${e.sourceId}`;
    entries.push({
      ...e,
      id,
      land: info.id,
      search: normalized(`${e.name} ${e.sourceId} ${e.kind ?? ""} ${JSON.stringify(e.details)}`),
    });
  };
  const validSpawn = (p: Point) =>
    nav.walkable(p) &&
    !source.settlements.some(
      (s) =>
        p.x >= s.bounds.x - 12 &&
        p.x <= s.bounds.x + s.bounds.width + 12 &&
        p.y >= s.bounds.y - 12 &&
        p.y <= s.bounds.y + s.bounds.height + 12,
    );
  for (const s of applyCustomSpawnsForFeature(info.id, authored, overrides)) {
    if (!validSpawn(s)) {
      rejected.push(s.id);
      continue;
    }
    const m = overviewCatalog.monsters.find((m) => m.id === s.kind);
    add({
      ...s,
      sourceId: s.id,
      name: overrides.monsters[s.kind]?.name ?? m?.name ?? s.kind,
      layer: "spawns",
      status: "runtime",
      source: "spawns.json + opublikowane nadpisania; te same strefy bezpieczne i nawigacja co gra",
      level: overrides.monsters[s.kind]?.level ?? m?.level ?? 1,
      radius: s.homeLeash,
      details: {
        spawn: s,
        monster: m
          ? {
              ...m,
              ...overrides.monsters[s.kind],
              loot: (overrides.monsters[s.kind]?.loot ?? m.loot.map((l) => l.name)).map(
                (name, i) => {
                  const chance =
                    overrides.monsters[s.kind]?.lootChances?.[name] ??
                    overrides.monsters[s.kind]?.lootChances?.[String(i)];
                  return {
                    name,
                    chance:
                      chance === undefined
                        ? (m.loot[i]?.chance ?? (i === 0 ? 0.7 : 0.35))
                        : chance > 1
                          ? chance / 100
                          : chance,
                  };
                },
              ),
            }
          : null,
        note: "Punkt odrodzenia, nie aktualnie żywy przeciwnik. Aktywacja przy graczu jest ograniczona budżetem gry.",
      },
    });
  }
  add({
    ...info.arrival,
    sourceId: "arrival",
    name: "Punkt przybycia i odrodzenia",
    layer: "places",
    status: "runtime",
    source: "index.json",
    details: info,
  });
  for (const town of source.settlements) {
    const binding = Object.entries(places?.cities ?? {}).find(([, p]) => p.settlement === town.id);
    const city = overviewCatalog.cities.find((c) => c.id === binding?.[0]);
    const name = (city && overrides.citiesV2[city.id]?.name) ?? binding?.[1].name ?? town.name;
    add({
      ...town,
      sourceId: town.id,
      name,
      layer: "towns",
      status: "runtime",
      source: "world.json / settlements + v2Places",
      details: { ...town, city },
      bounds: town.bounds,
      town: town.id,
    });
    if (town.kind === "village") continue;
    const capital = town.id.endsWith("-capital") ? source.acceptedSource : null;
    const buildings = capital?.city
      ? capital.city.buildings.map((b) => ({
          ...b,
          door: { x: b.door.x + offset.x, y: b.door.y + offset.y },
        }))
      : source.buildings
          .filter((b) => b.settlement === town.id && BUILDING_IDS.includes(b.service as BuildingId))
          .map((b) => ({
            id: b.service as BuildingId,
            name: services[b.service as BuildingId],
            door: b.door,
            objectId: b.id,
          }));
    if (buildings.length !== 6) continue;
    for (const b of buildings) {
      add({
        ...b.door,
        sourceId: b.objectId,
        name: `${b.name} · ${name}`,
        layer: "buildings",
        status: "runtime",
        source: "buildSuperiorSimulationWorld / city.buildings",
        town: town.id,
        building: b.id,
        details: { ...b, town: town.id, service: b.id, interior: cityRoom(b.id, info.affinity) },
        related: [roomKey(town.id, b.id)],
      });
      const r = cityRoom(b.id, info.affinity),
        room = roomKey(town.id, b.id);
      for (const [key, label] of [
        ["exit", "Wyjście do miasta"],
        ["entry", "Wejście do wnętrza"],
        ...(b.id === "depot" ? [["chest", "Skrzynia depozytu"]] : []),
        ...(b.id === "arena" ? [["dummy", "Manekin treningowy"]] : []),
      ] as ["exit" | "entry" | "chest" | "dummy", string][])
        add({
          ...r[key],
          sourceId: `${town.id}:${b.id}:${key}`,
          name: label,
          layer: key === "exit" ? "buildings" : "places",
          status: "runtime",
          source: "cityRoom",
          room,
          town: town.id,
          building: b.id,
          details: {
            point: r[key],
            returnDoor: b.door,
            roomSize: { width: r.width, height: r.height },
          },
        });
    }
    const templates = capital?.city
      ? capital.npcs
      : (overviewCatalog.npcTemplates[info.affinity] ?? []);
    for (const [idx, base] of templates.entries()) {
      const named = city?.npcs.find((n) => n.bindingId === info.affinity + ".npc." + base.id);
      const nov = capital?.city ? undefined : overrides.continents[info.affinity]?.npcs?.[base.id];
      const npc = {
        ...base,
        ...nov,
        name: capital?.city ? base.name : (named?.name ?? name + " · " + (nov?.role ?? base.role)),
        ...(named ? { dialogueId: named.id } : {}),
      };
      const col = (idx % 4) - 1.5;
      const row = Math.floor(idx / 4);
      const at = capital?.city
        ? { x: base.x + offset.x, y: base.y + offset.y }
        : {
            x: town.x + (base.id === "hunter" ? -160 : Math.round(col * 90)),
            y: town.y + 140 + row * 70,
          };
      const p = npc.building ? cityRoom(npc.building, info.affinity).npc : nav.safe(at);
      add({
        ...p,
        sourceId: named?.id ?? `${town.id}:${npc.id}`,
        name: npc.name,
        layer: "npcs",
        status: "runtime",
        source: "buildSuperiorSimulationWorld + GameSession.npcs + cityRoom",
        town: town.id,
        ...(npc.building ? { room: roomKey(town.id, npc.building), building: npc.building } : {}),
        details: {
          ...npc,
          ...p,
          town: town.id,
          outsideAnchor: at,
          binding: info.affinity + ".npc." + npc.id,
          questNpc: named,
          dialogueDefinition: named
            ? {
                ...overviewCatalog.dialogues[named.id],
                ...overrides.dialogues[named.id],
              }
            : null,
        },
        related: city?.availableQuestIds ?? [],
      });
    }
  }
  // The three native GameSession quests also remain active in Superior v2.
  for (const npc of [...entries].filter((e) => e.layer === "npcs")) {
    const data = npc.details as WorldNpc & { outsideAnchor: Point };
    const id = ({ guide: "steps", hunter: "boars", smith: "gear" } as Record<string, string>)[
      data.id
    ];
    if (!id) continue;
    add({
      ...npc,
      id: `native-quest:${info.id}:${npc.town}:${id}`,
      sourceId: "tutorial:" + id,
      layer: "quests",
      name: `${overviewCatalog.tutorialQuests[id]} · ${npc.name}`,
      source: "GameSession: accept/claim + questText",
      details: {
        system: "native GameSession",
        questId: id,
        giver: npc.id,
        instruction:
          data.dialogue ?? "Warunki określa GameSession.questText; postęp jest indywidualny.",
        note: "Trzy wspólne zadania wstępne postaci, nie nowe zadanie za każde miasto.",
      },
      related: [npc.id],
    });
    if (id === "steps") {
      const town = source.settlements.find((t) => t.id === npc.town)!;
      const market =
        town.id.endsWith("-capital") && source.acceptedSource
          ? {
              ...source.acceptedSource.market,
              x: source.acceptedSource.market.x + offset.x,
              y: source.acceptedSource.market.y + offset.y,
            }
          : { ...overviewCatalog.markets[info.affinity]!, x: town.x, y: town.y };
      add({
        ...market,
        sourceId: "tutorial:steps",
        id: `native-quest:${info.id}:${town.id}:market`,
        layer: "quests",
        name: "Pierwsze kroki · punkt odwiedzin",
        status: "runtime",
        source: "buildSuperiorSimulationWorld / world.market",
        details: market,
        town: town.id,
      });
    }
  }
  const pointGroups: [SourcePoint[], Layer, string][] = [
    [source.locations, "places", "world.json / locations"],
    [source.resources, "resources", "world.json / resources (oprawa; zbieranie niepodłączone)"],
    [source.peaks ?? [], "places", "world.json / peaks"],
    [source.camps ?? [], "places", "world.json / camps"],
  ];
  for (const [points, layer, provenance] of pointGroups)
    for (const p of points) {
      if (entries.some((e) => e.sourceId === p.id && e.layer === "towns")) continue;
      add({
        ...p,
        sourceId: p.id,
        name: p.name ?? p.id,
        layer: p.hidden ? "secrets" : layer,
        status: "data",
        source: provenance,
        details: p,
      });
    }
  for (const b of source.buildings)
    if (!entries.some((e) => e.sourceId === b.id && e.layer === "buildings"))
      add({
        ...b.door,
        sourceId: b.id,
        name: `${b.service} · ${b.id}`,
        layer: "buildings",
        status: "data",
        source: "world.json / buildings; brak usługi w runtime",
        bounds: b.footprint,
        details: b,
      });
  for (const d of source.dungeons)
    add({
      ...d.overworldEntrance,
      sourceId: d.id,
      name: `${d.kind} · ${d.instanceId}`,
      layer: "dungeons",
      status: "data",
      source: "world.json / dungeons; wejście zarezerwowane, wnętrze niepodłączone",
      details: d,
    });
  for (const r of source.roads)
    if (r.points[0])
      add({
        x: r.points[0][0],
        y: r.points[0][1],
        sourceId: (r as { id?: string }).id ?? `road-${entries.length}`,
        name: r.kind === "trail" ? "Ścieżka" : "Droga",
        layer: "roads",
        status: "runtime",
        source: "world.json / roads",
        kind: r.kind,
        points: r.points,
        details: r,
      });
  for (const [id, p] of Object.entries(places?.famous ?? {}))
    add({
      ...p,
      x: overrides.famousPlaces[id]?.x ?? p.x,
      y: overrides.famousPlaces[id]?.y ?? p.y,
      sourceId: id,
      name: overrides.famousPlaces[id]?.name ?? p.name,
      layer: "places",
      status: "runtime",
      source: "v2Places / near",
      details: overviewCatalog.famous.find((f) => f.id === id) ?? p,
      radius: 600,
    });
  for (const [id, p] of Object.entries(places?.hidden ?? {})) {
    const h = overviewCatalog.hidden.find((h) => h.id === id);
    add({
      ...p,
      x: overrides.hiddenPlaces[id]?.x ?? p.x,
      y: overrides.hiddenPlaces[id]?.y ?? p.y,
      sourceId: id,
      name: overrides.hiddenPlaces[id]?.name ?? p.name,
      layer: "secrets",
      status: h?.implementationStatus === "active_in_engine" ? "runtime" : "data",
      source: "v2Places / near",
      radius: (overrides.hiddenPlaces[id]?.radius ?? h?.radius ?? 0) + 200,
      details: h ?? p,
    });
  }
  const development = developmentData as unknown as {
    worldHashes: Record<string, string>;
    entries: Omit<Entry, "search">[];
  };
  if (development.worldHashes[info.id]) {
    if (development.worldHashes[info.id] !== info.worldSha256)
      throw Error("Odśwież indeks rozwoju dla aktualnej geometrii: " + info.id);
    for (const e of development.entries.filter((e) => e.land === info.id)) add(e);
  }
  return { entries, rejected };
}

/** Joins existing coordinates only. Unknown targets are reported, never placed at old-map points. */
export function questEntries(lands: LandData[], overrides: AdminWorldOverrides) {
  const all = lands.flatMap((l) => l.entries),
    entries: Entry[] = [],
    unmapped: { quest: string; target: string; description: string }[] = [];
  const quests = overviewCatalog.quests.map((q) => ({
    ...q,
    ...overrides.quests[q.id],
    reward: {
      ...q.reward,
      xp: overrides.quests[q.id]?.rewardXp ?? q.reward.xp,
      coins: overrides.quests[q.id]?.rewardCoins ?? q.reward.coins,
    },
  }));
  const add = (q: QuestDefinition, target: Entry, label: string, key: string, details: unknown) =>
    entries.push({
      ...target,
      id: `quest:${q.id}:${key}:${target.id}`,
      sourceId: q.id,
      name: `${q.id} · ${q.title} — ${label}`,
      layer: "quests",
      status: q.playableInCurrentRuntime ? target.status : "data",
      source: "quests V2 + wiązanie aktualnego świata",
      details: { quest: q, target: details },
      related: [target.id],
      search: normalized(`${q.id} ${q.title} ${q.giverName} ${label} ${JSON.stringify(details)}`),
    });
  for (const q of quests) {
    const settlement = placesFor(q.continent)?.cities[q.cityId]?.settlement;
    const giver = all.find(
      (e) =>
        e.layer === "npcs" &&
        e.land === q.continent &&
        (!settlement || e.town === settlement) &&
        (e.sourceId === q.giverNpcId ||
          (e.details as { binding?: string }).binding === q.giverNpcId),
    );
    if (giver) add(q, giver, "zleceniodawca " + q.giverName, "giver", q.unlockCondition);
    else
      unmapped.push({
        quest: q.id,
        target: q.giverNpcId,
        description: "Brak jednoznacznego fizycznego zleceniodawcy",
      });
    for (const stage of q.stages)
      for (const o of stage.objectives) {
        const targets = all.filter(
          (e) =>
            e.land === o.continent &&
            (o.type === "combat"
              ? e.layer === "spawns" && e.kind === o.targetId
              : e.sourceId === o.targetId ||
                (e.layer === "npcs" && (e.details as { binding?: string }).binding === o.targetId)),
        );
        if (!targets.length)
          unmapped.push({ quest: q.id, target: o.targetId, description: o.description });
        for (const t of targets) add(q, t, o.description, stage.id + ":" + o.id, o);
      }
  }
  return { entries, unmapped, quests };
}
export function matches(e: Entry, query: string) {
  return normalized(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((t) => e.search.includes(t));
}
export function visibleChunks(bounds: Obstacle, width: number, height: number, maximum = 12) {
  const x0 = Math.max(0, Math.floor(bounds.x / 2048)),
    y0 = Math.max(0, Math.floor(bounds.y / 2048));
  const x1 = Math.min(Math.ceil(width / 2048) - 1, Math.floor((bounds.x + bounds.width) / 2048)),
    y1 = Math.min(Math.ceil(height / 2048) - 1, Math.floor((bounds.y + bounds.height) / 2048));
  if ((x1 - x0 + 1) * (y1 - y0 + 1) > maximum) return [];
  const result: Point[] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) result.push({ x, y });
  return result;
}
