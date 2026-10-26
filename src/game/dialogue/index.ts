import { ContinentId } from "../worlds/types";
import { AETHER_DIALOGUES } from "./aether";
import { NEXUS_DIALOGUES } from "./nexus";
import { PYRA_DIALOGUES } from "./pyra";
import { ContinentDialogueCatalog, NpcDialogueDefinition, NpcQuestDialogue } from "./types";
import { VERDANT_DIALOGUES } from "./verdant";

export * from "./types";
export { VERDANT_DIALOGUES, PYRA_DIALOGUES, AETHER_DIALOGUES, NEXUS_DIALOGUES };

export const ALL_CONTINENT_DIALOGUES: Record<ContinentId, ContinentDialogueCatalog> = {
  verdant: VERDANT_DIALOGUES,
  pyra: PYRA_DIALOGUES,
  aether: AETHER_DIALOGUES,
  nexus: NEXUS_DIALOGUES,
};

export const ALL_NPC_DIALOGUES: Record<string, NpcDialogueDefinition> = {
  ...VERDANT_DIALOGUES.dialogues,
  ...PYRA_DIALOGUES.dialogues,
  ...AETHER_DIALOGUES.dialogues,
  ...NEXUS_DIALOGUES.dialogues,
};

export function getNpcDialogue(npcId: string): NpcDialogueDefinition | undefined {
  return ALL_NPC_DIALOGUES[npcId];
}

export function getNpcQuestDialogue(npcId: string, questId: string): NpcQuestDialogue | undefined {
  const npc = ALL_NPC_DIALOGUES[npcId];
  return npc?.quests[questId];
}
