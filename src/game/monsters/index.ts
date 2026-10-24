import { MONSTERS, Monster, MonsterStats, WORLDS } from '../../data/bestiary';

export { MONSTERS, WORLDS };
export type { Monster, MonsterStats };

export const OWNER_BESTIARY_IDS: Set<string> = new Set(MONSTERS.map((m) => m.id));

export function getMonsterById(id: string): Monster | undefined {
  return MONSTERS.find((m) => m.id === id);
}
