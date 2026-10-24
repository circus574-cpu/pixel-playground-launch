import { ContinentId } from '../worlds/types';

export type QuestState = 'unavailable' | 'available' | 'active' | 'completed';

export type QuestCategory = 'main' | 'side' | 'hidden' | 'intercontinental';

export type ObjectiveType = 'combat' | 'talk' | 'discover' | 'visit' | 'deliver';

export type CanonicalItemId = 'potion' | 'tusk' | 'sword' | 'vest';

export interface QuestObjective {
  id: string;
  type: ObjectiveType;
  description: string;
  targetId: string;
  targetCount: number;
  continent: ContinentId;
  coordinates?: { x: number; y: number; radius?: number };
}

export interface QuestStage {
  id: string;
  title: string;
  narrativeText: string;
  discoveryOrTwistNote?: string;
  objectives: QuestObjective[];
}

export interface QuestReward {
  xp: number;
  coins: number;
  itemId?: CanonicalItemId;
  itemCount?: number;
  factionReputation?: { factionId: string; amount: number };
  /** Propozycja przedmiotu z Księgi Przygody v1.0 oczekująca na wdrożenie wieloslotowego ekwipunku */
  plannedFutureItemId?: string;
}

export interface QuestUnlockCondition {
  minLevel: number;
  prerequisiteQuestIds?: string[];
  requiredDiscoveredLocationIds?: string[];
  requiredTalkedNpcId?: string;
  requiredItemId?: CanonicalItemId;
}

export interface QuestDefinition {
  id: string;
  title: string;
  continent: ContinentId;
  category: QuestCategory;
  giverNpcId: string;
  giverName: string;
  cityId: string;
  recommendedLevel: number;
  repeatable: boolean;
  /** Ukryte przygody nie są widoczne na zwykłej liście przed spełnieniem wyzwalacza */
  hiddenUntilTriggered?: boolean;
  /** Dla przygód międzykontynentalnych wymagających podróży morskiej lub podziemi */
  playableInCurrentRuntime: boolean;
  runtimeLimitationNote?: string;
  unlockCondition: QuestUnlockCondition;
  summary: string;
  stages: QuestStage[];
  reward: QuestReward;
}

export interface ActiveQuestProgress {
  questId: string;
  state: QuestState;
  currentStageIndex: number;
  objectiveProgress: Record<string, number>;
  completedAt?: number;
  completionCount: number;
}

export interface LegacySaveV4 {
  version: 4;
  heroRace?: 'planetary' | 'sage' | 'android' | 'legend';
  continent?: ContinentId;
  level?: number;
  xp?: number;
  coins?: number;
  inventory?: Partial<Record<CanonicalItemId, number>>;
  swordUpgraded?: boolean;
  completedQuests?: string[];
  activeQuestId?: string | null;
  position?: { x: number; y: number };
}

export interface PlayerSaveV5 {
  version: 5;
  migratedFromV4: boolean;
  rawV4Backup?: LegacySaveV4;
  heroRace: 'planetary' | 'sage' | 'android' | 'legend';
  continent: ContinentId;
  level: number;
  xp: number;
  coins: number;
  inventory: Record<CanonicalItemId, number>;
  swordUpgraded: boolean;
  position: { x: number; y: number };
  trackedQuestId: string | null;
  quests: Record<string, ActiveQuestProgress>;
  /** Zbiór jednorazowych questów, za które nagroda została już wypłacona (ochrona anty-duplikacyjna) */
  rewardClaimedQuestIds: string[];
  /** Zbiór odkrytych sławnych lokacji (16) i ukrytych miejsc */
  discoveredLocationIds: string[];
  /** Zbiór odebranych nagród za pierwsze odkrycie lokacji */
  discoveryRewardClaimedIds: string[];
  /** Reputacja frakcji 0..1000 */
  factionReputation: Record<string, number>;
  /** Lista porozmawianych NPC (wyzwalacz ukrytych przygód) */
  talkedNpcIds: string[];
}
