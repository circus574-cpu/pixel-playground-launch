/**
 * Argon's quest engine played on world v2 (preview switch ?ki-world-v2=1).
 *
 * The engine keeps its own save (ki_legends_save_v5); the adventure save is never touched.
 * World events feed it: entering a town counts as visiting it, talking to a game NPC (guide,
 * merchant, smith, hunter) counts for its binding id, walking up to a famous or hidden place discovers it, and defeating a monster
 * advances combat objectives for its bestiary id.
 */
import { ALL_CITIES_V2, ALL_HIDDEN_PLACES_V2 } from "../worlds";
import { v2Places } from "../worlds/v2Places";
import {
  ALL_QUESTS_V2,
  discoverHiddenPlace,
  loadSaveFromStorage,
  recordQuestObjectiveEvent,
  saveToStorage,
  startQuest,
  syncQuestAvailability,
} from "./engine";
import type { PlayerSaveV5, QuestDefinition } from "./types";

const DISCOVER_RADIUS = 450;
let save: PlayerSaveV5 | undefined;
const listeners = new Set<() => void>();
export type QuestReward = { xp: number; gold: number; items: Partial<Record<string, number>> };
const rewardListeners = new Set<(reward: QuestReward) => void>();

function current() {
  save ??= syncQuestAvailability(loadSaveFromStorage());
  return save;
}
function commit(next: PlayerSaveV5) {
  if (next === save) return;
  const prev = save;
  save = next;
  // The engine credits its own save; every increase is handed to the game character as well.
  if (prev) {
    const items: Partial<Record<string, number>> = {};
    for (const [k, n] of Object.entries(next.inventory)) {
      const gained = n - (prev.inventory[k as keyof typeof prev.inventory] ?? 0);
      if (gained > 0) items[k] = gained;
    }
    const reward = {
      xp: Math.max(0, next.xp - prev.xp),
      gold: Math.max(0, next.coins - prev.coins),
      items,
    };
    if (reward.xp || reward.gold || Object.keys(items).length)
      for (const l of rewardListeners) l(reward);
  }
  saveToStorage(next);
  for (const l of listeners) l();
}

export const questsV2 = {
  get save() {
    return current();
  },
  /** Called with every reward the engine grants (quest completion, discoveries, events). */
  onReward(listener: (reward: QuestReward) => void) {
    rewardListeners.add(listener);
    return () => rewardListeners.delete(listener);
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** Quests of a continent the journal shows: available, active and completed, hidden ones once triggered. */
  journal(continent: string): { quest: QuestDefinition; state: string; stage: number }[] {
    const s = current();
    return ALL_QUESTS_V2.filter((q) => q.continent === continent)
      .map((quest) => ({
        quest,
        state: s.quests[quest.id]?.state ?? "unavailable",
        stage: s.quests[quest.id]?.currentStageIndex ?? 0,
      }))
      .filter((q) => q.state !== "unavailable");
  },
  start(questId: string) {
    commit(startQuest(current(), questId));
  },
  level(level: number) {
    const s = current();
    if (s.level !== level) commit(syncQuestAvailability({ ...s, level }));
  },
  enterTown(continent: string, settlementId: string) {
    const city = Object.entries(v2Places(continent)?.cities ?? {}).find(
      ([, c]) => c.settlement === settlementId,
    )?.[0];
    if (city) commit(recordQuestObjectiveEvent(current(), "visit", city));
  },
  /**
   * A conversation with a game NPC (guide, merchant, smith, hunter) in a v2 town counts for every
   * Argon NPC of that town bound to it (bindingId "<continent>.npc.<id>").
   */
  talk(continent: string, settlementId: string, npcId: string) {
    const binding = continent + ".npc." + npcId;
    const city = Object.entries(v2Places(continent)?.cities ?? {}).find(
      ([, c]) => c.settlement === settlementId,
    )?.[0];
    let s = recordQuestObjectiveEvent(current(), "talk", binding);
    for (const npc of ALL_CITIES_V2.find((c) => c.id === city)?.npcs ?? [])
      if (npc.bindingId === binding) s = recordQuestObjectiveEvent(s, "talk", npc.id);
    commit(s);
  },
  /** Called every tick with the player position; discovers places within reach once. */
  near(continent: string, x: number, y: number) {
    const places = v2Places(continent);
    if (!places) return;
    let s = current();
    for (const [id, f] of Object.entries(places.famousById))
      if (!s.discoveredLocationIds.includes(id) && Math.hypot(f.x - x, f.y - y) < DISCOVER_RADIUS)
        s = recordQuestObjectiveEvent(s, "discover", id);
    for (const [id, h] of Object.entries(places.hidden)) {
      const radius = ALL_HIDDEN_PLACES_V2.find((p) => p.id === id)?.radius ?? 0;
      if (!s.discoveredLocationIds.includes(id) && Math.hypot(h.x - x, h.y - y) < radius + 200)
        s = discoverHiddenPlace(s, id);
    }
    commit(s);
  },
  defeated(monsterKind: string) {
    commit(recordQuestObjectiveEvent(current(), "combat", monsterKind));
  },
};
