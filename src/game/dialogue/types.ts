import { ContinentId } from "../worlds/types";

export interface NpcQuestDialogue {
  questId: string;
  before: string;
  during: string;
  after: string;
}

export interface NpcDialogueDefinition {
  npcId: string;
  npcName: string;
  cityId: string;
  role: string;
  greetings: [string, string, string];
  rumors: [string, string, string];
  quests: Record<string, NpcQuestDialogue>;
}

export interface ContinentDialogueCatalog {
  continent: ContinentId;
  dialogues: Record<string, NpcDialogueDefinition>;
}
