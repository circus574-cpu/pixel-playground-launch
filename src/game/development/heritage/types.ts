import type { RaceId, WorldId } from "../../world/races";
import type { NpcRole } from "../../world/types";

export const HERITAGE_PREFIX = { planetary: "V", sage: "A", android: "N", legend: "P" } as const;
export type HeritagePrefix = (typeof HERITAGE_PREFIX)[RaceId];
export type ChapterNumber = 1 | 2 | 3 | 4 | 5 | 6;
export type HeritageQuestId = `H-${HeritagePrefix}0${ChapterNumber}`;
export type WorldProjectId = `P-${HeritagePrefix}${ChapterNumber}`;
export const CHAPTERS: readonly ChapterNumber[] = [1, 2, 3, 4, 5, 6];
export const HERITAGE_QUEST_IDS = Object.values(HERITAGE_PREFIX).flatMap((prefix) =>
  CHAPTERS.map((n) => `H-${prefix}0${n}` as HeritageQuestId),
);
export const WORLD_PROJECT_IDS = Object.values(HERITAGE_PREFIX).flatMap((prefix) =>
  CHAPTERS.map((n) => `P-${prefix}${n}` as WorldProjectId),
);
export const questId = (race: RaceId, chapter: ChapterNumber): HeritageQuestId =>
  `H-${HERITAGE_PREFIX[race]}0${chapter}`;
export const projectId = (race: RaceId, chapter: ChapterNumber): WorldProjectId =>
  `P-${HERITAGE_PREFIX[race]}${chapter}`;
export type HeritageContentId = HeritageQuestId | WorldProjectId;
export type Site =
  | "mentor"
  | "smith"
  | "trainer"
  | "archive"
  | "river"
  | "garden"
  | "market"
  | "memorial"
  | "workshop"
  | "gate"
  | "trail";
export type SourceDocument = { title: string; text: string };
export type Response = { id: string; label: string; reply: string };
export type StoryChoice = Response & { chronicle: string };
export type GoalBase = {
  id: string;
  label: string;
  site: Site;
  documents: SourceDocument[];
  world?: WorldId | undefined;
  kiCost?: number | undefined;
};
/** Discriminants require physical/action handlers. Descriptions never count as completion events. */
export type HeritageGoal = GoalBase &
  (
    | {
        kind: "talk";
        speaker: string;
        existingRole?: NpcRole | undefined;
        lines: string[];
        responses: Response[];
        targets: string[];
      }
    | { kind: "inspect"; targets: string[]; observations: string[] }
    | {
        kind: "solve";
        targets: string[];
        puzzles: { prompt: string; options: Response[]; answerId: string }[];
        maxErrors: number | null;
      }
    | {
        kind: "recover";
        material: string;
        materialName: string;
        targets: string[];
        quantityPerTarget: number;
      }
    | {
        kind: "craft";
        recipe: { material: string; quantity: number }[];
        operation: "repair" | "tune" | "temper" | "copy" | "plant";
        target: string;
      }
    | {
        kind: "consent";
        witnesses: string[];
        question: string;
        namedReply: string;
        anonymousReply: string;
      }
    | { kind: "projects"; required: WorldProjectId[] }
    | {
        kind: "escort";
        checkpoints: number;
        actor: string;
        minHealthFraction: number;
        combat: boolean;
      }
    | { kind: "protect"; points: number; waves: number; minHealthFraction: number }
    | { kind: "restraint"; windows: number; maxErrors: number; surrender: boolean }
    | { kind: "name-weapon" }
    | { kind: "measure"; hits: number }
    | {
        kind: "forge";
        recipe: { material: string; quantity: number }[];
        stage: ChapterNumber;
        operation: "inspect" | "repair" | "tune" | "temper" | "inherit";
      }
    | { kind: "observe"; species: string }
  );
export type HeritageQuestDefinition = {
  id: HeritageQuestId;
  version: 1;
  race: RaceId;
  world: WorldId;
  chapter: ChapterNumber;
  name: string;
  introduction: string;
  recommendedLevel: [number, number];
  prerequisite: HeritageQuestId | null;
  goals: HeritageGoal[];
  choices: StoryChoice[];
  reward: { xp: number; gold: number; practice: number };
  weaponStage: ChapterNumber;
};
export type ProjectEffect = {
  kind:
    | "flow"
    | "bridge"
    | "garden"
    | "witnesses"
    | "route"
    | "archive"
    | "reading-room"
    | "barrier"
    | "registries"
    | "power"
    | "workbench"
    | "signatures"
    | "regeneration"
    | "metrics"
    | "workshop"
    | "training"
    | "forge"
    | "memorial"
    | "shelter"
    | "school";
  description: string;
  actors: string[];
  stations: ("modules" | "weapon" | "research" | "training")[];
  opensPassage: boolean;
};
export type WorldProjectDefinition = {
  id: WorldProjectId;
  version: 1;
  race: RaceId;
  world: WorldId;
  number: ChapterNumber;
  name: string;
  prerequisite: HeritageQuestId;
  goals: HeritageGoal[];
  effect: ProjectEffect;
  reward: { practice: 200 };
};
export type GoalProgress = {
  revision: number;
  completedTargetIds: string[];
  sequence: number;
  errors: number;
  consent: Record<string, "named" | "anonymous">;
  outcome: "active" | "failed" | "done";
};
export type HeritageProgress = {
  step: number;
  goal: GoalProgress;
  completedGoals: GoalProgress[];
  choiceId: string | null;
  status: "active" | "ready" | "done";
};
export const emptyGoalProgress = (): GoalProgress => ({
  revision: 0,
  completedTargetIds: [],
  sequence: 0,
  errors: 0,
  consent: {},
  outcome: "active",
});
export const emptyHeritageProgress = (): HeritageProgress => ({
  step: 0,
  goal: emptyGoalProgress(),
  completedGoals: [],
  choiceId: null,
  status: "active",
});
