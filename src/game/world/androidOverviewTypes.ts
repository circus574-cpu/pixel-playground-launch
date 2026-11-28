export const ANDROID_LAYERS = {
  boss: ["Bossowie", "#ff6f5c", "◆"],
  spawn: ["Spawny potworów", "#ffb375", "•"],
  quest: ["Zlecenia questów", "#ffe392", "!"],
  objective: ["Cele questów", "#8ef0d1", "◎"],
  npc: ["NPC", "#8addff", "●"],
  dungeon: ["Podziemia", "#d5a8ff", "▼"],
  event: ["Zdarzenia", "#ff9bc0", "✦"],
  capital: ["Stolice i przystanie", "#fff2c3", "★"],
  town: ["Osady i miasteczka", "#f5cb83", "⬟"],
  building: ["Budynki", "#b3cadb", "■"],
  door: ["Wejścia do budynków", "#b0e6b4", "▸"],
  secret: ["Sekrety i skarby", "#dcacf1", "✧"],
  landmark: ["Punkty orientacyjne", "#fff09d", "✶"],
  waystone: ["Kamienie podróży", "#85d8ee", "◈"],
  resource: ["Zasoby", "#a7e78d", "✿"],
  fauna: ["Fauna", "#c6bc9e", "•"],
  zone: ["Strefy EXP", "#fa9eac", "⊕"],
  biome: ["Biomy", "#bbd4ff", "▲"],
  scenery: ["Dekoracje", "#a9aab0", "·"],
} as const;

export type AndroidLayer = keyof typeof ANDROID_LAYERS;
export type AndroidPoint = [x: number, z: number];
export type AndroidMarker = {
  id: string;
  kind: AndroidLayer;
  title: string;
  position: AndroidPoint;
  detail: string;
  level?: number;
  radius?: number;
  questId?: string;
  arena?: string;
  stats?: { hp: number; atk: number; def: number; xp: number };
  loot?: Array<{ itemId: string; itemName: string; chancePercent: number }>;
  grid?: string[];
  entryCell?: AndroidPoint;
  exitCell?: AndroidPoint;
  gold?: number;
  xp?: number;
  item?: string;
  eventSpawn?: string;
  eventSpawnCount?: number;
};
export type AndroidAtlasIndex = {
  version: string;
  createdAt: string;
  packHashes: Record<"core-c101" | "world-regions", string>;
  width: number;
  height: number;
  image: string;
  bosses: Array<{ id: string; land: string; title: string; position: AndroidPoint }>;
  regions: Array<{
    id: string;
    kind: "continent" | "island";
    name: string;
    outline: AndroidPoint[];
    label: { x: number; y: number };
    islandPin: AndroidPoint | null;
  }>;
  pendingBosses: string[];
};
export type AndroidQuest = {
  id: string;
  title: string;
  level: number;
  giver: string;
  sourceLand: string;
  active: boolean;
  summary: string;
  giverPoints: string[];
  objectives: Array<{ id: string; title: string; refs: string[] }>;
};
export type AndroidAtlasRegion = {
  id: string;
  size: number;
  image: string;
  procedural: boolean;
  points: AndroidMarker[];
  roads: Array<{ tier: string; points: AndroidPoint[] }>;
  quests: AndroidQuest[];
  unmapped: Array<{ id: string; title: string; detail: string }>;
};

export type AndroidAtlasSnapshot = {
  index: AndroidAtlasIndex;
  regions: Record<string, AndroidAtlasRegion>;
};
