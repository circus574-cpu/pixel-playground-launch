import type { RaceId } from "../../world/races";

export const TRIAL_IDS = [
  "TV10",
  "TV11",
  "TV12",
  "TA01",
  "TA02",
  "TA03",
  "TN07",
  "TN08",
  "TN09",
  "TP07",
  "TP08",
  "TP09",
] as const;
export type TrialId = (typeof TRIAL_IDS)[number];
export type TrialTier = 1 | 2 | 3;
export type TrialKind =
  | "motifs"
  | "map"
  | "contradictions"
  | "symbols"
  | "changes"
  | "seals"
  | "circuit"
  | "modules"
  | "diagnosis"
  | "counter"
  | "restraint"
  | "position";
export type DomainId = "memory" | "seals" | "construction" | "duel";
export type TrialDefinition = {
  id: TrialId;
  race: RaceId;
  domain: DomainId;
  name: string;
  kind: TrialKind;
  targets: readonly [number, number, number];
  maxErrors: number;
};
// These twelve controllers implement all three trials in each of four domains from the owner's 28.10 specification.
// The other 36 trials are deliberately not presented as playable or awarded by these controllers.
export const TRIALS: readonly TrialDefinition[] = [
  {
    id: "TV10",
    race: "planetary",
    domain: "memory",
    name: "Pieśń miejsca",
    kind: "motifs",
    targets: [3, 4, 5],
    maxErrors: 0,
  },
  {
    id: "TV11",
    race: "planetary",
    domain: "memory",
    name: "Prawdziwa mapa",
    kind: "map",
    targets: [2, 3, 4],
    maxErrors: 0,
  },
  {
    id: "TV12",
    race: "planetary",
    domain: "memory",
    name: "Świadek doliny",
    kind: "contradictions",
    targets: [2, 3, 4],
    maxErrors: 0,
  },
  {
    id: "TA01",
    race: "sage",
    domain: "seals",
    name: "Klucz pieczęci",
    kind: "symbols",
    targets: [3, 4, 5],
    maxErrors: 0,
  },
  {
    id: "TA02",
    race: "sage",
    domain: "seals",
    name: "Wzorzec i kopia",
    kind: "changes",
    targets: [2, 3, 4],
    maxErrors: 0,
  },
  {
    id: "TA03",
    race: "sage",
    domain: "seals",
    name: "Zależności pieczęci",
    kind: "seals",
    targets: [3, 4, 5],
    maxErrors: 1,
  },
  {
    id: "TN07",
    race: "android",
    domain: "construction",
    name: "Obwód zasilania",
    kind: "circuit",
    targets: [3, 4, 5],
    maxErrors: 0,
  },
  {
    id: "TN08",
    race: "android",
    domain: "construction",
    name: "Budżet konstrukcji",
    kind: "modules",
    targets: [2, 3, 3],
    maxErrors: 0,
  },
  {
    id: "TN09",
    race: "android",
    domain: "construction",
    name: "Diagnoza usterek",
    kind: "diagnosis",
    targets: [2, 3, 4],
    maxErrors: 0,
  },
  {
    id: "TP07",
    race: "legend",
    domain: "duel",
    name: "Okno kontrataku",
    kind: "counter",
    targets: [3, 4, 5],
    maxErrors: 2,
  },
  {
    id: "TP08",
    race: "legend",
    domain: "duel",
    name: "Powstrzymany cios",
    kind: "restraint",
    targets: [3, 4, 5],
    maxErrors: 0,
  },
  {
    id: "TP09",
    race: "legend",
    domain: "duel",
    name: "Ustawienie i odwrót",
    kind: "position",
    targets: [2, 3, 4],
    maxErrors: 0,
  },
];
export const DOMAIN_NAMES: Record<DomainId, string> = {
  memory: "Pamięć Korzeni",
  seals: "Pieczęcie",
  construction: "Konstrukcja",
  duel: "Pojedynek",
};
export const trialDefinition = (id: string) => TRIALS.find((t) => t.id === id);
export const trialReceipt = (id: TrialId, tier: TrialTier) => `trial:${id}:${tier}:v1`;
export const trialReward = (tier: TrialTier) => [100, 150, 200][tier - 1]!;
export function parseTrialReceipt(key: string) {
  const m = key.match(/^trial:(T[VANP]\d{2}):([123]):v1$/);
  const def = m && trialDefinition(m[1]!);
  return def ? { definition: def, tier: Number(m![2]) as TrialTier } : undefined;
}
export type TrialGrades = Partial<Record<TrialId, TrialTier>>;
export function domainRank(grades: TrialGrades, race: RaceId, domain: DomainId): number {
  const trials = TRIALS.filter((t) => t.race === race && t.domain === domain);
  return trials.length === 3 ? Math.min(...trials.map((t) => grades[t.id] ?? 0)) : 0;
}
export function trialsRaceConsistent(grades: TrialGrades | undefined, race: RaceId) {
  return !grades || Object.keys(grades).every((id) => trialDefinition(id)?.race === race);
}
export function trialAvailable(grades: TrialGrades, id: TrialId, tier: TrialTier) {
  return (grades[id] ?? 0) >= tier - 1;
}
