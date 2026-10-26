export type ContinentId = "verdant" | "pyra" | "aether" | "nexus";

export type CityRole = "capital" | "transport" | "craft" | "expedition";

export interface CityNpc {
  id: string;
  bindingId: string;
  name: string;
  role: string;
  cityId: string;
  coordinates: { x: number; y: number };
  storyConnection: string;
  offeredQuestIds: string[];
}

export interface CityDefinition {
  id: string;
  name: string;
  continent: ContinentId;
  role: CityRole;
  isSafeZone: boolean;
  bounds: { x: number; y: number; width: number; height: number };
  economicAndHistoricalFunction: string;
  atmosphere: string;
  npcs: CityNpc[];
  citizenProblems: string[];
  neighborConnections: { targetCityId: string; roadId: string; relation: string }[];
  availableQuestIds: string[];
  secretToDiscover: {
    id: string;
    title: string;
    description: string;
    triggerCondition: string;
    rewardCoins: number;
    rewardXp: number;
  };
  reasonToReturn: string;
}

export type RoadCategory =
  "merchant" | "dangerous" | "forgotten" | "ambush" | "rest" | "secret" | "famous_route";

export interface AdventureRoad {
  id: string;
  name: string;
  continent: ContinentId;
  category: RoadCategory;
  fromId: string;
  toId: string;
  waypoints: { x: number; y: number }[];
  description: string;
  dangerLevel: number;
  monsterIds: string[];
  restPoint?: { name: string; x: number; y: number; description: string };
  roadsideSecret?: {
    id: string;
    title: string;
    x: number;
    y: number;
    description: string;
    rewardCoins: number;
  };
}

export interface FamousLocation {
  id: string;
  /** 10. Rzeczywisty identyfikator istniejącego punktu mapy (z gpu-production-targets.json) */
  mapPointId: string;
  continent: ContinentId;
  /** 1. Unikatowa nazwa */
  name: string;
  /** 2. Historia i legenda miejsca — minimum kilka zdań */
  loreAndLegend: string;
  /** 3. Powiązanie z kanonem danego kontynentu */
  canonLink: string;
  /** 4. Wyzwanie eksploracyjne, zagadka lub starcie */
  challengeOrEncounter: {
    type: "combat" | "puzzle" | "observation";
    description: string;
    monsterId?: string;
    requiredItemId?: string;
  };
  /** 5. Warunki odkrycia */
  discoveryCondition: {
    minLevel: number;
    requiredQuestId?: string;
    requirePhysicalArrival: boolean;
    arrivalRadius: number;
  };
  /** 6. Nagroda za pierwsze odkrycie (istniejące ID przedmiotów: potion, tusk, sword, vest) */
  firstDiscoveryReward: {
    xp: number;
    coins: number;
    itemId?: "potion" | "tusk" | "sword" | "vest";
    factionReputation: { factionId: string; amount: number };
  };
  /** 7. Opcjonalny sekret związany z inną lokacją */
  crossLocationSecret: {
    linkedLocationId: string;
    secretTitle: string;
    description: string;
    bonusXp: number;
  };
  /** Współrzędne zgodne z obiektem w gpu-production-targets.json */
  coordinates: { x: number; y: number };
}

export type HiddenPlaceCategory =
  | "shrine"
  | "passage"
  | "altar"
  | "camp"
  | "crash_site"
  | "artifact"
  | "lost_expedition"
  | "treasure";

export interface HiddenPlace {
  id: string;
  continent: ContinentId;
  name: string;
  category: HiddenPlaceCategory;
  mapAnchorId: string;
  coordinates: { x: number; y: number };
  radius: number;
  implementationStatus: "active_in_engine" | "data_only_pending_engine";
  description: string;
  discoveryRequirement: string;
  reward: {
    xp: number;
    coins: number;
    itemId?: "potion" | "tusk" | "sword" | "vest";
  };
}

export type WorldEventCategory =
  | "trail_encounter"
  | "exploration_discovery"
  | "area_hazard"
  | "missing_traveler"
  | "merchant_convoy"
  | "local_conflict"
  | "renewable_contract"
  | "rare_item_hunt";

export interface WorldEventDefinition {
  id: string;
  continent: ContinentId;
  name: string;
  category: WorldEventCategory;
  implementationStatus: "active_in_engine" | "data_only_pending_engine";
  activationCondition: {
    minLevel: number;
    requiredQuestId?: string;
    coordinates: { x: number; y: number };
    radius: number;
  };
  repeatability: "once" | "cooldown_300s" | "renewable_contract";
  description: string;
  monsterId?: string;
  reward: {
    xp: number;
    coins: number;
    itemId?: "potion" | "tusk" | "sword" | "vest";
  };
}

export interface ContinentWorldData {
  id: ContinentId;
  name: string;
  raceName: string;
  raceId: "planetary" | "legend" | "sage" | "android";
  factionId: string;
  factionName: string;
  themeSummary: string;
  historicalDebt: string;
  size: [number, number];
  spawn: { x: number; y: number };
  cities: CityDefinition[];
  roads: AdventureRoad[];
  famousLocations: FamousLocation[];
  hiddenPlaces: HiddenPlace[];
  worldEvents: WorldEventDefinition[];
}
