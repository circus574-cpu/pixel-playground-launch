import { ContinentId } from "../worlds/types";

export interface BossAttack {
  id: string;
  name: string;
  cooldownSeconds: number;
  telegraphSeconds?: number;
  description: string;
  damageMultiplier: number;
  isAoe?: boolean;
}

export interface BossPhase {
  phaseNumber: number;
  hpThresholdPercent: number;
  name: string;
  description: string;
  statModifiers?: {
    atkMultiplier?: number;
    speedMultiplier?: number;
    damageTakenMultiplier?: number;
  };
  unlockedAttacks: string[];
}

export interface BossLootDrop {
  itemId: string;
  itemName: string;
  chancePercent: number;
  minCount: number;
  maxCount: number;
  isRare?: boolean;
}

export interface BossDefinition {
  id: string;
  name: string;
  title: string;
  continent: ContinentId;
  race: string;
  level: number;
  icon: string;
  variant: number;
  speed: number;
  range: number;
  agro: number;
  stats: {
    hp: number;
    atk: number;
    def: number;
    xp: number;
  };
  mult: {
    hp: number;
    atk: number;
    def: number;
  };
  behavior: string;
  weakness: string;
  lore: string;
  locationName: string;
  associatedLocationId?: string;
  phases: BossPhase[];
  attacks: BossAttack[];
  lootTable: BossLootDrop[];
}
