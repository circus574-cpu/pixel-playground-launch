import { ContinentId, ContinentWorldData, CityDefinition, FamousLocation, HiddenPlace, WorldEventDefinition } from './types';
import { VERDANT_WORLD_DATA } from './verdant';
import { PYRA_WORLD_DATA } from './pyra';
import { AETHER_WORLD_DATA } from './aether';
import { NEXUS_WORLD_DATA } from './nexus';

export * from './types';
export { VERDANT_WORLD_DATA, PYRA_WORLD_DATA, AETHER_WORLD_DATA, NEXUS_WORLD_DATA };

export const CONTINENTS_WORLD_V2: Record<ContinentId, ContinentWorldData> = {
  verdant: VERDANT_WORLD_DATA,
  pyra: PYRA_WORLD_DATA,
  aether: AETHER_WORLD_DATA,
  nexus: NEXUS_WORLD_DATA,
};

export const ALL_CONTINENTS_LIST: ContinentWorldData[] = [
  VERDANT_WORLD_DATA,
  PYRA_WORLD_DATA,
  AETHER_WORLD_DATA,
  NEXUS_WORLD_DATA,
];

export const ALL_CITIES_V2: CityDefinition[] = ALL_CONTINENTS_LIST.flatMap((c) => c.cities);

export const ALL_FAMOUS_LOCATIONS_V2: FamousLocation[] = ALL_CONTINENTS_LIST.flatMap(
  (c) => c.famousLocations
);

export const ALL_HIDDEN_PLACES_V2: HiddenPlace[] = ALL_CONTINENTS_LIST.flatMap(
  (c) => c.hiddenPlaces
);

export const ALL_WORLD_EVENTS_V2: WorldEventDefinition[] = ALL_CONTINENTS_LIST.flatMap(
  (c) => c.worldEvents
);

/**
 * Rzeczywiste identyfikatory obiektów mapy z art/pipeline/gpu-production-targets.json
 */
export const CANONICAL_MAP_OBJECT_IDS: Record<ContinentId, string[]> = {
  verdant: [
    'cottage-0',
    'inn-1',
    'forge-2',
    'cottage-3',
    'market-4',
    'fountain-5',
    'bridge-6',
    'lamp-7',
    'lamp-8',
    'lamp-9',
    'lamp-10',
    'lamp-11',
    'lamp-12',
    'lamp-13',
    'lamp-14',
    'oak-24',
    'rock-250',
    'rock-255',
    'rock-261',
    'rock-264',
    'fence-286',
  ],
  aether: [
    'sanctum-0',
    'archive-1',
    'archive-2',
    'ki-source-3',
    'ki-tree-4',
    'ki-tree-5',
    'ki-tree-6',
    'ki-tree-7',
    'detail-cloud-peak-8',
    'detail-cloud-peak-9',
    'detail-cloud-peak-10',
    'detail-cloud-peak-11',
    'detail-garden-12',
    'detail-garden-13',
    'detail-garden-14',
    'detail-garden-15',
    'detail-garden-20',
    'detail-garden-21',
  ],
  nexus: [
    'lab-0',
    'lab-1',
    'reactor-2',
    'lab-3',
    'terminal-4',
    'terminal-5',
    'crystal-6',
    'crystal-7',
    'crystal-8',
    'detail-pylon-9',
    'detail-pylon-10',
    'detail-pylon-11',
    'detail-pylon-12',
    'detail-pylon-13',
    'detail-pylon-14',
    'detail-tech-garden-15',
    'detail-tech-garden-16',
  ],
  pyra: [
    'fortress-0',
    'war-shrine-1',
    'war-shrine-2',
    'statue-3',
    'statue-4',
    'basalt-5',
    'basalt-6',
    'basalt-7',
    'basalt-8',
    'detail-volcano-9',
    'detail-volcano-10',
    'detail-clan-banner-11',
    'detail-clan-banner-12',
    'detail-basalt-19',
  ],
};

export const CANONICAL_NPC_BINDINGS: Record<ContinentId, string[]> = {
  verdant: ['verdant.npc.guide', 'verdant.npc.hunter', 'verdant.npc.merchant', 'verdant.npc.smith'],
  aether: ['aether.npc.guide', 'aether.npc.hunter', 'aether.npc.merchant', 'aether.npc.smith'],
  nexus: ['nexus.npc.guide', 'nexus.npc.hunter', 'nexus.npc.merchant', 'nexus.npc.smith'],
  pyra: ['pyra.npc.guide', 'pyra.npc.hunter', 'pyra.npc.merchant', 'pyra.npc.smith'],
};

export function isPositionInSafeCity(continent: ContinentId, x: number, y: number): CityDefinition | null {
  const world = CONTINENTS_WORLD_V2[continent];
  for (const city of world.cities) {
    if (
      city.isSafeZone &&
      x >= city.bounds.x &&
      x <= city.bounds.x + city.bounds.width &&
      y >= city.bounds.y &&
      y <= city.bounds.y + city.bounds.height
    ) {
      return city;
    }
  }
  return null;
}
