import type { GoalBase, HeritageGoal, Response, Site, SourceDocument } from "./types";
import type { NpcRole } from "../../world/types";

const base = (
  id: string,
  label: string,
  site: Site,
  documents: SourceDocument[] = [],
): GoalBase => ({ id, label, site, documents });
export const answer = (id: string, label: string, reply: string): Response => ({
  id,
  label,
  reply,
});
export function talk(
  id: string,
  label: string,
  site: Site,
  speaker: string,
  lines: string[],
  responses: Response[],
  existingRole?: NpcRole,
  targets = [speaker],
): HeritageGoal {
  return {
    ...base(id, label, site),
    kind: "talk",
    speaker,
    lines,
    responses,
    targets,
    ...(existingRole ? { existingRole } : {}),
  };
}
export function inspect(
  id: string,
  label: string,
  site: Site,
  targets: string[],
  observations: string[],
  documents: SourceDocument[] = [],
): HeritageGoal {
  if (targets.length !== observations.length)
    throw Error("Every physical evidence target needs its own observation");
  return { ...base(id, label, site, documents), kind: "inspect", targets, observations };
}
export function solve(
  id: string,
  label: string,
  site: Site,
  documents: SourceDocument[],
  puzzles: Extract<HeritageGoal, { kind: "solve" }>["puzzles"],
  maxErrors: number | null = null,
): HeritageGoal {
  return {
    ...base(id, label, site, documents),
    kind: "solve",
    targets: puzzles.map((_, index) => id + ":device:" + index),
    puzzles,
    maxErrors,
  };
}
export function recover(
  id: string,
  label: string,
  site: Site,
  material: string,
  materialName: string,
  quantity: number,
): HeritageGoal {
  return {
    ...base(id, label, site),
    kind: "recover",
    material,
    materialName,
    targets: Array.from({ length: quantity }, (_, i) => id + ":cache:" + i),
    quantityPerTarget: 1,
  };
}
export function craft(
  id: string,
  label: string,
  site: Site,
  material: string,
  quantity: number,
  operation: Extract<HeritageGoal, { kind: "craft" }>["operation"],
): HeritageGoal {
  return {
    ...base(id, label, site),
    kind: "craft",
    recipe: [{ material, quantity }],
    operation,
    target: id + ":station",
  };
}
export function consent(
  id: string,
  label: string,
  site: Site,
  witnesses: string[],
  question: string,
): HeritageGoal {
  return {
    ...base(id, label, site),
    kind: "consent",
    witnesses,
    question,
    namedReply: "Zgadzam się na zapis imienia przy mojej relacji. Zapisz też, czego nie pamiętam.",
    anonymousReply:
      "Zachowaj relację, ale ukryj moje imię. Moja zgoda nie oznacza zgody na ujawnienie bliskich.",
  };
}
export const completedProjects = (
  id: string,
  required: Extract<HeritageGoal, { kind: "projects" }>["required"],
): HeritageGoal => ({
  ...base(id, "Ukończ wskazane projekty odbudowy", "mentor"),
  kind: "projects",
  required,
});
export const escort = (
  id: string,
  actor: string,
  checkpoints: number,
  combat: boolean,
): HeritageGoal => ({
  ...base(id, "Przeprowadź bezpiecznie: " + actor, "trail"),
  kind: "escort",
  actor,
  checkpoints,
  combat,
  minHealthFraction: 0.5,
});
export const protect = (
  id: string,
  label: string,
  points: number,
  waves: number,
): HeritageGoal => ({
  ...base(id, label, "trail"),
  kind: "protect",
  points,
  waves,
  minHealthFraction: 0.5,
});
export const restraint = (
  id: string,
  label: string,
  windows: number,
  surrender: boolean,
): HeritageGoal => ({
  ...base(id, label, "trainer"),
  kind: "restraint",
  windows,
  maxErrors: 2,
  surrender,
});
export const nameWeapon = (id: string): HeritageGoal => ({
  ...base(id, "Nadaj własną nazwę broni u kowala", "smith"),
  kind: "name-weapon",
});
