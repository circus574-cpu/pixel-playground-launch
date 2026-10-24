import { MONSTERS, OWNER_BESTIARY_IDS } from '../monsters';
import {
  ALL_CITIES_V2,
  ALL_FAMOUS_LOCATIONS_V2,
  ALL_HIDDEN_PLACES_V2,
  ALL_WORLD_EVENTS_V2,
  CANONICAL_MAP_OBJECT_IDS,
  CANONICAL_NPC_BINDINGS,
  ContinentId,
} from '../worlds';
import { AETHER_QUESTS } from './aetherQuests';
import { INTERCONTINENTAL_QUESTS } from './intercontinentalQuests';
import { NEXUS_QUESTS } from './nexusQuests';
import { PYRA_QUESTS } from './pyraQuests';
import {
  ActiveQuestProgress,
  CanonicalItemId,
  LegacySaveV4,
  ObjectiveType,
  PlayerSaveV5,
  QuestDefinition,
} from './types';
import { VERDANT_QUESTS } from './verdantQuests';

export const EXISTING_RUNTIME_ITEM_IDS: CanonicalItemId[] = ['potion', 'tusk', 'sword', 'vest'];

export const ALL_QUESTS_V2: QuestDefinition[] = [
  ...VERDANT_QUESTS,
  ...PYRA_QUESTS,
  ...AETHER_QUESTS,
  ...NEXUS_QUESTS,
  ...INTERCONTINENTAL_QUESTS,
];

export const QUEST_BY_ID: Record<string, QuestDefinition> = Object.fromEntries(
  ALL_QUESTS_V2.map((q) => [q.id, q]),
);

const STORAGE_KEY_V5 = 'ki_legends_save_v5';
const STORAGE_KEY_V4 = 'ki_legends_save_v4';

const RACE_BY_CONTINENT: Record<ContinentId, PlayerSaveV5['heroRace']> = {
  verdant: 'planetary',
  pyra: 'legend',
  aether: 'sage',
  nexus: 'android',
};

export function createDefaultSaveV5(activeContinent: ContinentId = 'verdant'): PlayerSaveV5 {
  const initialSave: PlayerSaveV5 = {
    version: 5,
    migratedFromV4: false,
    heroRace: RACE_BY_CONTINENT[activeContinent],
    continent: activeContinent,
    level: 1,
    xp: 0,
    coins: 120,
    inventory: {
      potion: 4,
      tusk: 3,
      sword: 1,
      vest: 1,
    },
    swordUpgraded: false,
    position: {
      x: 1480,
      y: 900,
    },
    trackedQuestId: 'O-V01',
    quests: {},
    rewardClaimedQuestIds: [],
    discoveredLocationIds: [],
    discoveryRewardClaimedIds: [],
    factionReputation: {
      'F-V': 0,
      'F-P': 0,
      'F-A': 0,
      'F-N': 0,
      'F-L': 0,
    },
    talkedNpcIds: [],
  };

  return syncQuestAvailability(initialSave);
}

/**
 * Migracja zapisu z Save v4 do Save v5 bez utraty ekwipunku, odkrytych lokacji,
 * ukończonych zadań i postępu gracza.
 */
export function migrateSaveV4ToV5(
  rawSave: LegacySaveV4 | PlayerSaveV5 | null | undefined,
): PlayerSaveV5 {
  if (!rawSave) {
    return createDefaultSaveV5('verdant');
  }

  if (rawSave.version === 5 && 'quests' in rawSave && typeof rawSave.quests === 'object') {
    const v5 = rawSave as PlayerSaveV5;
    return syncQuestAvailability({
      ...v5,
      inventory: {
        potion: v5.inventory?.potion ?? 2,
        tusk: v5.inventory?.tusk ?? 1,
        sword: v5.inventory?.sword ?? 1,
        vest: v5.inventory?.vest ?? 1,
      },
      rewardClaimedQuestIds: Array.from(new Set(v5.rewardClaimedQuestIds ?? [])),
      discoveredLocationIds: Array.from(new Set(v5.discoveredLocationIds ?? [])),
      discoveryRewardClaimedIds: Array.from(new Set(v5.discoveryRewardClaimedIds ?? [])),
      factionReputation: { ...(v5.factionReputation ?? {}) },
      talkedNpcIds: Array.from(new Set(v5.talkedNpcIds ?? [])),
      quests: { ...(v5.quests ?? {}) },
    });
  }

  const v4 = rawSave as LegacySaveV4;
  const continent: ContinentId = v4.continent ?? 'verdant';
  const heroRace = v4.heroRace ?? RACE_BY_CONTINENT[continent];

  const inventory: Record<CanonicalItemId, number> = {
    potion: v4.inventory?.potion ?? 2,
    tusk: v4.inventory?.tusk ?? 1,
    sword: v4.inventory?.sword ?? 1,
    vest: v4.inventory?.vest ?? 1,
  };

  const quests: Record<string, ActiveQuestProgress> = {};
  const rewardClaimedQuestIds: string[] = [];

  if (Array.isArray(v4.completedQuests)) {
    for (const qId of v4.completedQuests) {
      const def = QUEST_BY_ID[qId];
      if (!def) continue;
      const lastStageIdx = Math.max(0, def.stages.length - 1);
      const objectiveProgress: Record<string, number> = {};
      for (const stage of def.stages) {
        for (const obj of stage.objectives) {
          objectiveProgress[obj.id] = obj.targetCount;
        }
      }
      quests[qId] = {
        questId: qId,
        state: 'completed',
        currentStageIndex: lastStageIdx,
        objectiveProgress,
        completedAt: Date.now(),
        completionCount: 1,
      };
      if (!def.repeatable) {
        rewardClaimedQuestIds.push(qId);
      }
    }
  }

  if (v4.activeQuestId && QUEST_BY_ID[v4.activeQuestId] && !quests[v4.activeQuestId]) {
    quests[v4.activeQuestId] = {
      questId: v4.activeQuestId,
      state: 'active',
      currentStageIndex: 0,
      objectiveProgress: {},
      completionCount: 0,
    };
  }

  const migrated: PlayerSaveV5 = {
    version: 5,
    migratedFromV4: true,
    rawV4Backup: v4,
    heroRace,
    continent,
    level: Math.max(1, v4.level ?? 1),
    xp: Math.max(0, v4.xp ?? 0),
    coins: Math.max(0, v4.coins ?? 100),
    inventory,
    swordUpgraded: Boolean(v4.swordUpgraded),
    position: {
      x: v4.position?.x ?? 1480,
      y: v4.position?.y ?? 900,
    },
    trackedQuestId: v4.activeQuestId ?? null,
    quests,
    rewardClaimedQuestIds,
    discoveredLocationIds: [],
    discoveryRewardClaimedIds: [],
    factionReputation: {
      'F-V': 0,
      'F-P': 0,
      'F-A': 0,
      'F-N': 0,
      'F-L': 0,
    },
    talkedNpcIds: [],
  };

  return syncQuestAvailability(migrated);
}

/**
 * Sprawdza czy dana lokacja (po `id`, np. `famous-verdant-1`, lub po `mapPointId`, np. `fountain-5`)
 * została już odkryta przez gracza.
 */
export function isLocationDiscovered(save: PlayerSaveV5, locationOrMapPointId: string): boolean {
  if (save.discoveredLocationIds.includes(locationOrMapPointId)) {
    return true;
  }
  const famous = ALL_FAMOUS_LOCATIONS_V2.find(
    (loc) => loc.id === locationOrMapPointId || loc.mapPointId === locationOrMapPointId,
  );
  if (famous) {
    return (
      save.discoveredLocationIds.includes(famous.id) ||
      save.discoveredLocationIds.includes(famous.mapPointId)
    );
  }
  return false;
}

/**
 * Sprawdza warunki odblokowania zadania (`unlockCondition`).
 */
export function areUnlockConditionsMet(save: PlayerSaveV5, quest: QuestDefinition): boolean {
  if (!quest.playableInCurrentRuntime) {
    return false;
  }

  const cond = quest.unlockCondition;
  if (!cond) return true;

  if (cond.minLevel && save.level < cond.minLevel) {
    return false;
  }

  if (cond.prerequisiteQuestIds && cond.prerequisiteQuestIds.length > 0) {
    for (const reqQuestId of cond.prerequisiteQuestIds) {
      const record = save.quests[reqQuestId];
      if (!record || record.state !== 'completed') {
        return false;
      }
    }
  }

  if (cond.requiredDiscoveredLocationIds && cond.requiredDiscoveredLocationIds.length > 0) {
    for (const locId of cond.requiredDiscoveredLocationIds) {
      if (!isLocationDiscovered(save, locId)) {
        return false;
      }
    }
  }

  if (cond.requiredItemId) {
    const count = save.inventory[cond.requiredItemId] ?? 0;
    if (count <= 0) {
      return false;
    }
  }

  if (cond.requiredTalkedNpcId) {
    if (!save.talkedNpcIds.includes(cond.requiredTalkedNpcId)) {
      return false;
    }
  }

  return true;
}

/**
 * Synchronizuje stany wszystkich zadań w katalogu (`unavailable` <-> `available`).
 */
export function syncQuestAvailability(save: PlayerSaveV5): PlayerSaveV5 {
  const nextQuests: Record<string, ActiveQuestProgress> = { ...save.quests };

  for (const quest of ALL_QUESTS_V2) {
    const existing = nextQuests[quest.id];
    const unlocked = areUnlockConditionsMet(save, quest);

    if (!existing) {
      nextQuests[quest.id] = {
        questId: quest.id,
        state: unlocked ? 'available' : 'unavailable',
        currentStageIndex: 0,
        objectiveProgress: {},
        completionCount: 0,
      };
    } else if (existing.state === 'unavailable' && unlocked) {
      nextQuests[quest.id] = {
        ...existing,
        state: 'available',
      };
    } else if (existing.state === 'available' && !unlocked) {
      nextQuests[quest.id] = {
        ...existing,
        state: 'unavailable',
      };
    }
  }

  let trackedQuestId = save.trackedQuestId;
  if (trackedQuestId) {
    const trackedRec = nextQuests[trackedQuestId];
    if (!trackedRec || (trackedRec.state !== 'active' && trackedRec.state !== 'available')) {
      trackedQuestId = null;
    }
  }
  if (!trackedQuestId) {
    const firstActive = Object.values(nextQuests).find((r) => r.state === 'active');
    const firstAvailable = Object.values(nextQuests).find((r) => r.state === 'available');
    trackedQuestId = firstActive?.questId ?? firstAvailable?.questId ?? null;
  }

  return {
    ...save,
    quests: nextQuests,
    trackedQuestId,
  };
}

/**
 * Rozpoczyna zadanie (`available` -> `active`), lub resetuje powtarzalne zadanie (`completed` -> `active`).
 */
export function startQuest(save: PlayerSaveV5, questId: string): PlayerSaveV5 {
  const quest = QUEST_BY_ID[questId];
  if (!quest || !quest.playableInCurrentRuntime) return save;

  const synced = syncQuestAvailability(save);
  const record = synced.quests[questId];
  if (!record) return synced;

  if (record.state !== 'available' && !(record.state === 'completed' && quest.repeatable)) {
    return synced;
  }

  const firstStage = quest.stages[0];
  const initialProgress: Record<string, number> = {};
  if (firstStage) {
    for (const obj of firstStage.objectives) {
      if (obj.type === 'discover' && isLocationDiscovered(synced, obj.targetId)) {
        initialProgress[obj.id] = obj.targetCount;
      } else {
        initialProgress[obj.id] = 0;
      }
    }
  }

  const nextSave: PlayerSaveV5 = {
    ...synced,
    quests: {
      ...synced.quests,
      [questId]: {
        ...record,
        state: 'active',
        currentStageIndex: 0,
        objectiveProgress: initialProgress,
      },
    },
    trackedQuestId: questId,
  };

  return evaluateStageProgression(nextSave, questId);
}

/**
 * Wewnętrzna ewaluacja postępu etapu i ewentualnego ukończenia zadania + przyznania nagrody.
 * Chroni przed wielokrotnym przyznaniem nagrody jednorazowej (`rewardClaimedQuestIds`).
 */
function evaluateStageProgression(save: PlayerSaveV5, questId: string): PlayerSaveV5 {
  const quest = QUEST_BY_ID[questId];
  const record = save.quests[questId];
  if (!quest || !record || record.state !== 'active') return save;

  let currentStageIndex = record.currentStageIndex;
  const objectiveProgress = { ...record.objectiveProgress };
  const inventory = { ...save.inventory };

  while (currentStageIndex < quest.stages.length) {
    const stage = quest.stages[currentStageIndex];
    const allMet = stage.objectives.every(
      (obj) => (objectiveProgress[obj.id] ?? 0) >= obj.targetCount,
    );

    if (!allMet) {
      break;
    }

    currentStageIndex += 1;
    if (currentStageIndex < quest.stages.length) {
      const nextStage = quest.stages[currentStageIndex];
      for (const obj of nextStage.objectives) {
        if (obj.type === 'discover' && isLocationDiscovered(save, obj.targetId)) {
          objectiveProgress[obj.id] = obj.targetCount;
        }
      }
    }
  }

  if (currentStageIndex >= quest.stages.length) {
    const nextCompletionCount = record.completionCount + 1;
    let xp = save.xp;
    let coins = save.coins;
    let level = save.level;
    const rewardClaimedQuestIds = [...save.rewardClaimedQuestIds];
    const factionReputation = { ...save.factionReputation };

    const alreadyClaimedOnce = rewardClaimedQuestIds.includes(questId);
    const shouldGrantReward = quest.repeatable || !alreadyClaimedOnce;

    if (shouldGrantReward) {
      xp += quest.reward.xp;
      coins += quest.reward.coins;
      if (quest.reward.itemId) {
        const count = quest.reward.itemCount ?? 1;
        inventory[quest.reward.itemId] = (inventory[quest.reward.itemId] ?? 0) + count;
      }
      if (quest.reward.factionReputation) {
        const { factionId, amount } = quest.reward.factionReputation;
        factionReputation[factionId] = (factionReputation[factionId] ?? 0) + amount;
      }
      level = Math.min(20, Math.max(level, 1 + Math.floor(xp / 200)));
      if (!alreadyClaimedOnce) {
        rewardClaimedQuestIds.push(questId);
      }
    }

    const completedSave: PlayerSaveV5 = {
      ...save,
      level,
      xp,
      coins,
      inventory,
      rewardClaimedQuestIds,
      factionReputation,
      quests: {
        ...save.quests,
        [questId]: {
          ...record,
          state: 'completed',
          currentStageIndex: quest.stages.length - 1,
          objectiveProgress,
          completedAt: Date.now(),
          completionCount: nextCompletionCount,
        },
      },
    };

    return syncQuestAvailability(completedSave);
  }

  return {
    ...save,
    inventory,
    quests: {
      ...save.quests,
      [questId]: {
        ...record,
        currentStageIndex,
        objectiveProgress,
      },
    },
  };
}

function matchesTargetId(objTargetId: string, eventTargetId: string): boolean {
  if (objTargetId === eventTargetId) return true;
  // Obsługa dopasowania sławnej lokacji po id ('famous-verdant-1') lub mapPointId ('fountain-5')
  const famous = ALL_FAMOUS_LOCATIONS_V2.find(
    (loc) => loc.id === objTargetId || loc.mapPointId === objTargetId,
  );
  if (famous && (famous.id === eventTargetId || famous.mapPointId === eventTargetId)) {
    return true;
  }
  return false;
}

/**
 * Rejestruje zdarzenie postępu celu (`combat`, `talk`, `discover`, `visit`, `deliver`)
 * we wszystkich aktywnych zadaniach.
 */
export function recordQuestObjectiveEvent(
  save: PlayerSaveV5,
  type: ObjectiveType,
  targetId: string,
  amount = 1,
): PlayerSaveV5 {
  if (amount <= 0) return save;

  let nextSave = { ...save };

  if (type === 'talk' && !nextSave.talkedNpcIds.includes(targetId)) {
    nextSave = {
      ...nextSave,
      talkedNpcIds: [...nextSave.talkedNpcIds, targetId],
    };
  }

  if (type === 'discover' && !isLocationDiscovered(nextSave, targetId)) {
    nextSave = discoverFamousLocation(nextSave, targetId);
  }

  for (const quest of ALL_QUESTS_V2) {
    const record = nextSave.quests[quest.id];
    if (!record || record.state !== 'active') continue;

    const stage = quest.stages[record.currentStageIndex];
    if (!stage) continue;

    let stageModified = false;
    const updatedProgress = { ...record.objectiveProgress };
    const updatedInventory = { ...nextSave.inventory };

    for (const obj of stage.objectives) {
      if (obj.type !== type || !matchesTargetId(obj.targetId, targetId)) continue;

      const current = updatedProgress[obj.id] ?? 0;
      if (current >= obj.targetCount) continue;

      if (type === 'deliver') {
        const itemKey = obj.targetId as CanonicalItemId;
        const available = updatedInventory[itemKey] ?? 0;
        const needed = obj.targetCount - current;
        const toConsume = Math.min(available, needed, amount);
        if (toConsume <= 0) continue;
        updatedInventory[itemKey] = available - toConsume;
        updatedProgress[obj.id] = current + toConsume;
        stageModified = true;
      } else {
        updatedProgress[obj.id] = Math.min(obj.targetCount, current + amount);
        stageModified = true;
      }
    }

    if (stageModified) {
      nextSave = {
        ...nextSave,
        inventory: updatedInventory,
        quests: {
          ...nextSave.quests,
          [quest.id]: {
            ...record,
            objectiveProgress: updatedProgress,
          },
        },
      };
      nextSave = evaluateStageProgression(nextSave, quest.id);
    }
  }

  return syncQuestAvailability(nextSave);
}

/**
 * Odkrywa sławną lokację (po `id` np. `famous-verdant-1` lub `mapPointId` np. `fountain-5`),
 * przyznaje jednorazową nagrodę za pierwsze odkrycie i aktualizuje ukryte questy oraz aktywne cele `discover`.
 */
export function discoverFamousLocation(
  save: PlayerSaveV5,
  locationOrMapPointId: string,
): PlayerSaveV5 {
  const famous = ALL_FAMOUS_LOCATIONS_V2.find(
    (loc) => loc.id === locationOrMapPointId || loc.mapPointId === locationOrMapPointId,
  );

  const canonicalIdsToAdd = famous
    ? [famous.id, famous.mapPointId]
    : [locationOrMapPointId];

  const alreadyDiscovered = isLocationDiscovered(save, locationOrMapPointId);
  let nextSave: PlayerSaveV5 = { ...save };

  if (!alreadyDiscovered) {
    const nextDiscovered = Array.from(
      new Set([...save.discoveredLocationIds, ...canonicalIdsToAdd]),
    );
    const nextClaimed = [...save.discoveryRewardClaimedIds];
    let xp = save.xp;
    let coins = save.coins;
    const inventory = { ...save.inventory };
    const factionReputation = { ...save.factionReputation };

    if (famous && !nextClaimed.includes(famous.id)) {
      xp += famous.firstDiscoveryReward.xp;
      coins += famous.firstDiscoveryReward.coins;
      if (famous.firstDiscoveryReward.itemId) {
        const itemId = famous.firstDiscoveryReward.itemId;
        inventory[itemId] = (inventory[itemId] ?? 0) + 1;
      }
      if (famous.firstDiscoveryReward.factionReputation) {
        const { factionId, amount } = famous.firstDiscoveryReward.factionReputation;
        factionReputation[factionId] = (factionReputation[factionId] ?? 0) + amount;
      }
      nextClaimed.push(famous.id);
    }

    const level = Math.min(20, Math.max(save.level, 1 + Math.floor(xp / 200)));

    nextSave = {
      ...save,
      level,
      xp,
      coins,
      inventory,
      factionReputation,
      discoveredLocationIds: nextDiscovered,
      discoveryRewardClaimedIds: nextClaimed,
    };
  }

  nextSave = syncQuestAvailability(nextSave);

  for (const quest of ALL_QUESTS_V2) {
    const rec = nextSave.quests[quest.id];
    if (!rec || rec.state !== 'active') continue;
    const stage = quest.stages[rec.currentStageIndex];
    if (!stage) continue;

    let changed = false;
    const progress = { ...rec.objectiveProgress };
    for (const obj of stage.objectives) {
      if (obj.type === 'discover' && matchesTargetId(obj.targetId, locationOrMapPointId)) {
        if ((progress[obj.id] ?? 0) < obj.targetCount) {
          progress[obj.id] = obj.targetCount;
          changed = true;
        }
      }
    }
    if (changed) {
      nextSave = {
        ...nextSave,
        quests: {
          ...nextSave.quests,
          [quest.id]: {
            ...rec,
            objectiveProgress: progress,
          },
        },
      };
      nextSave = evaluateStageProgression(nextSave, quest.id);
    }
  }

  return syncQuestAvailability(nextSave);
}

/**
 * Odkrywa ukryte miejsce (sekret geometrii).
 */
export function discoverHiddenPlace(save: PlayerSaveV5, hiddenPlaceId: string): PlayerSaveV5 {
  const place = ALL_HIDDEN_PLACES_V2.find((p) => p.id === hiddenPlaceId);
  if (!place || place.implementationStatus !== 'active_in_engine') return save;
  if (save.discoveredLocationIds.includes(hiddenPlaceId)) return save;

  const xp = save.xp + place.reward.xp;
  const coins = save.coins + place.reward.coins;
  const inventory = { ...save.inventory };
  if (place.reward.itemId) {
    inventory[place.reward.itemId] = (inventory[place.reward.itemId] ?? 0) + 1;
  }

  const nextSave: PlayerSaveV5 = {
    ...save,
    level: Math.min(20, Math.max(save.level, 1 + Math.floor(xp / 200))),
    xp,
    coins,
    inventory,
    discoveredLocationIds: [...save.discoveredLocationIds, hiddenPlaceId],
  };

  return syncQuestAvailability(nextSave);
}

/**
 * Wykonuje wydarzenie świata (World Event) z poszanowaniem limitu powtarzalności (`once` vs odnawialne).
 */
export function triggerWorldEvent(save: PlayerSaveV5, eventId: string): PlayerSaveV5 {
  const eventDef = ALL_WORLD_EVENTS_V2.find((e) => e.id === eventId);
  if (!eventDef || eventDef.implementationStatus !== 'active_in_engine') return save;

  const alreadyClaimedOnce = save.discoveryRewardClaimedIds.includes(eventId);
  if (eventDef.repeatability === 'once' && alreadyClaimedOnce) {
    return save;
  }

  if (save.level < eventDef.activationCondition.minLevel) {
    return save;
  }

  const xp = save.xp + eventDef.reward.xp;
  const coins = save.coins + eventDef.reward.coins;
  const inventory = { ...save.inventory };
  if (eventDef.reward.itemId) {
    inventory[eventDef.reward.itemId] = (inventory[eventDef.reward.itemId] ?? 0) + 1;
  }

  const nextClaimed = alreadyClaimedOnce
    ? save.discoveryRewardClaimedIds
    : [...save.discoveryRewardClaimedIds, eventId];

  return {
    ...save,
    level: Math.min(20, Math.max(save.level, 1 + Math.floor(xp / 200))),
    xp,
    coins,
    inventory,
    discoveryRewardClaimedIds: nextClaimed,
  };
}

/**
 * Zwraca znacznik zadania nad NPC (`!` dla dostępnego zadania, `?` dla aktywnego celu rozmowy z tym NPC).
 */
export function getNpcQuestMarker(
  save: PlayerSaveV5,
  npcId: string,
): '!' | '?' | null {
  for (const quest of ALL_QUESTS_V2) {
    const rec = save.quests[quest.id];
    if (!rec || rec.state !== 'active') continue;
    const stage = quest.stages[rec.currentStageIndex];
    if (!stage) continue;

    for (const obj of stage.objectives) {
      if (
        obj.type === 'talk' &&
        obj.targetId === npcId &&
        (rec.objectiveProgress[obj.id] ?? 0) < obj.targetCount
      ) {
        return '?';
      }
    }
  }

  for (const quest of ALL_QUESTS_V2) {
    if (quest.giverNpcId !== npcId || !quest.playableInCurrentRuntime) continue;
    const rec = save.quests[quest.id];
    if (rec?.state === 'available') {
      return '!';
    }
  }

  return null;
}

/**
 * Walidacja integralności danych wszystkich questów względem kanonicznych ID świata, NPC, potworów i przedmiotów.
 */
export function validateQuestCatalogIntegrity(): {
  valid: boolean;
  errors: string[];
} {
  const errList: string[] = [];

  const validNpcIds = new Set<string>();
  const validCityIds = new Set<string>(ALL_CITIES_V2.map((c) => c.id));
  for (const city of ALL_CITIES_V2) {
    for (const npc of city.npcs) {
      validNpcIds.add(npc.id);
      validNpcIds.add(npc.bindingId);
      validNpcIds.add(npc.name);
    }
  }
  for (const list of Object.values(CANONICAL_NPC_BINDINGS)) {
    for (const id of list) validNpcIds.add(id);
  }

  const validDiscoverIds = new Set<string>();
  for (const list of Object.values(CANONICAL_MAP_OBJECT_IDS)) {
    for (const id of list) validDiscoverIds.add(id);
  }
  for (const famous of ALL_FAMOUS_LOCATIONS_V2) {
    validDiscoverIds.add(famous.id);
    validDiscoverIds.add(famous.mapPointId);
  }
  for (const hidden of ALL_HIDDEN_PLACES_V2) {
    validDiscoverIds.add(hidden.id);
    validDiscoverIds.add(hidden.mapAnchorId);
  }

  const validVisitIds = new Set<string>([
    ...Array.from(validCityIds),
    ...Array.from(validDiscoverIds),
  ]);

  const validItemIds = new Set<string>(EXISTING_RUNTIME_ITEM_IDS);
  const validQuestIds = new Set<string>(ALL_QUESTS_V2.map((q) => q.id));
  const validMonsterIds = new Set<string>([
    ...Array.from(OWNER_BESTIARY_IDS),
    ...MONSTERS.map((m) => m.id),
  ]);

  for (const quest of ALL_QUESTS_V2) {
    if (!validNpcIds.has(quest.giverNpcId)) {
      errList.push(`Quest ${quest.id}: nieznany giverNpcId "${quest.giverNpcId}"`);
    }
    if (!validCityIds.has(quest.cityId)) {
      errList.push(`Quest ${quest.id}: nieznany cityId "${quest.cityId}"`);
    }

    if (quest.unlockCondition.prerequisiteQuestIds) {
      for (const depId of quest.unlockCondition.prerequisiteQuestIds) {
        if (!validQuestIds.has(depId)) {
          errList.push(`Quest ${quest.id}: nieznana zależność prerequisiteQuestId "${depId}"`);
        }
      }
    }

    if (quest.unlockCondition.requiredDiscoveredLocationIds) {
      for (const locId of quest.unlockCondition.requiredDiscoveredLocationIds) {
        if (!validDiscoverIds.has(locId)) {
          errList.push(
            `Quest ${quest.id}: nieznany requiredDiscoveredLocationId "${locId}"`,
          );
        }
      }
    }

    if (quest.reward.itemId && !validItemIds.has(quest.reward.itemId)) {
      errList.push(`Quest ${quest.id}: nieznany itemId w nagrodzie "${quest.reward.itemId}"`);
    }

    for (const stage of quest.stages) {
      for (const obj of stage.objectives) {
        if (obj.type === 'combat' && !validMonsterIds.has(obj.targetId)) {
          errList.push(
            `Quest ${quest.id} (${stage.id}): nieznany potwór "${obj.targetId}" poza bestiariuszem właściciela`,
          );
        }
        if (obj.type === 'talk' && !validNpcIds.has(obj.targetId)) {
          errList.push(`Quest ${quest.id} (${stage.id}): nieznany NPC "${obj.targetId}"`);
        }
        if (obj.type === 'discover' && !validDiscoverIds.has(obj.targetId)) {
          errList.push(
            `Quest ${quest.id} (${stage.id}): nieznany punkt mapy discover "${obj.targetId}"`,
          );
        }
        if (obj.type === 'visit' && !validVisitIds.has(obj.targetId)) {
          errList.push(
            `Quest ${quest.id} (${stage.id}): nieznane miejsce visit "${obj.targetId}"`,
          );
        }
        if (obj.type === 'deliver' && !validItemIds.has(obj.targetId) && !validNpcIds.has(obj.targetId)) {
          errList.push(
            `Quest ${quest.id} (${stage.id}): nieznany przedmiot deliver "${obj.targetId}"`,
          );
        }
      }
    }
  }

  return {
    valid: errList.length === 0,
    errors: errList,
  };
}

export function loadSaveFromStorage(): PlayerSaveV5 {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createDefaultSaveV5('verdant');
  }
  try {
    const rawV5 = window.localStorage.getItem(STORAGE_KEY_V5);
    if (rawV5) {
      return migrateSaveV4ToV5(JSON.parse(rawV5));
    }
    const rawV4 = window.localStorage.getItem(STORAGE_KEY_V4);
    if (rawV4) {
      const migrated = migrateSaveV4ToV5(JSON.parse(rawV4));
      saveToStorage(migrated);
      return migrated;
    }
  } catch {
    // Fallback
  }
  const fresh = createDefaultSaveV5('verdant');
  saveToStorage(fresh);
  return fresh;
}

export function saveToStorage(save: PlayerSaveV5): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY_V5, JSON.stringify(save));
  } catch {
    // Ignore quota errors
  }
}
