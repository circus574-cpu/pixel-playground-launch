import type { RaceId } from "../../world/races";

export const TRIAL_IDS = [
  "TV01",
  "TV02",
  "TV03",
  "TV04",
  "TV05",
  "TV06",
  "TV07",
  "TV08",
  "TV09",
  "TV10",
  "TV11",
  "TV12",
  "TA01",
  "TA02",
  "TA03",
  "TA04",
  "TA05",
  "TA06",
  "TA10",
  "TA11",
  "TA12",
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
  | "source-fragments"
  | "unsupported-claims"
  | "memory-sequence"
  | "barrier-waves"
  | "mirrors"
  | "cover-windows"
  | "supplies"
  | "water-allocation"
  | "camp"
  | "wind-route"
  | "tracks"
  | "messenger"
  | "flow-nodes"
  | "earth-rhythm"
  | "contamination"
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
export type DomainId =
  | "care"
  | "trails"
  | "earth"
  | "memory"
  | "source-memory"
  | "seals"
  | "barriers"
  | "construction"
  | "duel";
export type TrialDefinition = {
  id: TrialId;
  race: RaceId;
  domain: DomainId;
  name: string;
  kind: TrialKind;
  targets: readonly [number, number, number];
  maxErrors: number;
  dodgeTargets?: readonly [number, number, number];
};
// Only implemented controllers are exposed as playable; targets come from the owner specification.
export const TRIALS: readonly TrialDefinition[] = [
  {
    id: "TA10",
    race: "sage",
    domain: "source-memory",
    name: "Fragment i źródło",
    kind: "source-fragments",
    targets: [3, 4, 5],
    maxErrors: 0,
  },
  {
    id: "TA11",
    race: "sage",
    domain: "source-memory",
    name: "Granice świadectwa",
    kind: "unsupported-claims",
    targets: [2, 3, 4],
    maxErrors: 0,
  },
  {
    id: "TA12",
    race: "sage",
    domain: "source-memory",
    name: "Kronika z niewiadomą",
    kind: "memory-sequence",
    targets: [3, 4, 5],
    maxErrors: 0,
  },
  {
    id: "TA04",
    race: "sage",
    domain: "barriers",
    name: "Osłona archiwum",
    kind: "barrier-waves",
    targets: [3, 4, 5],
    maxErrors: 0,
  },
  {
    id: "TA05",
    race: "sage",
    domain: "barriers",
    name: "Droga zwierciadeł",
    kind: "mirrors",
    targets: [2, 3, 4],
    maxErrors: 0,
  },
  {
    id: "TA06",
    race: "sage",
    domain: "barriers",
    name: "Okna osłony",
    kind: "cover-windows",
    targets: [3, 4, 5],
    maxErrors: 0,
  },
  {
    id: "TV07",
    race: "planetary",
    domain: "care",
    name: "Zapas dla wyprawy",
    kind: "supplies",
    targets: [3, 4, 5],
    maxErrors: 0,
  },
  {
    id: "TV08",
    race: "planetary",
    domain: "care",
    name: "Źródło dla dwóch osad",
    kind: "water-allocation",
    targets: [4, 6, 8],
    maxErrors: 0,
  },
  {
    id: "TV09",
    race: "planetary",
    domain: "care",
    name: "Ostatni obóz",
    kind: "camp",
    targets: [2, 3, 4],
    maxErrors: 0,
  },
  {
    id: "TV01",
    race: "planetary",
    domain: "trails",
    name: "Ścieżka wiatru",
    kind: "wind-route",
    targets: [4, 6, 8],
    maxErrors: 2,
  },
  {
    id: "TV02",
    race: "planetary",
    domain: "trails",
    name: "Tropy po deszczu",
    kind: "tracks",
    targets: [3, 4, 5],
    maxErrors: 1,
  },
  {
    id: "TV03",
    race: "planetary",
    domain: "trails",
    name: "Posłaniec",
    kind: "messenger",
    targets: [2, 3, 4],
    maxErrors: 0,
  },
  {
    id: "TV04",
    race: "planetary",
    domain: "earth",
    name: "Otwarty przepływ",
    kind: "flow-nodes",
    targets: [2, 3, 4],
    maxErrors: 0,
  },
  {
    id: "TV05",
    race: "planetary",
    domain: "earth",
    name: "Kamienny rytm",
    kind: "earth-rhythm",
    targets: [2, 3, 4],
    dodgeTargets: [4, 6, 8],
    maxErrors: 0,
  },
  {
    id: "TV06",
    race: "planetary",
    domain: "earth",
    name: "Granica skażenia",
    kind: "contamination",
    targets: [3, 4, 5],
    maxErrors: 0,
  },
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
  care: "Opieka",
  trails: "Szlaki",
  earth: "Żywa Ziemia",
  memory: "Pamięć Korzeni",
  "source-memory": "Pamięć",
  seals: "Pieczęcie",
  barriers: "Bariery",
  construction: "Konstrukcja",
  duel: "Pojedynek",
};
export const MEMORY_TRIAL_RULES: Partial<Record<TrialKind, string>> = {
  "source-fragments":
    "Dopasuj 3/4/5 fragmentów do ich źródeł. Wszystkie teksty są dostępne przy stanowiskach; podobny temat nie wystarcza do przypisania autorstwa.",
  "unsupported-claims":
    "Wskaż 2/3/4 twierdzenia, których podane źródła nie potwierdzają. Brak dowodu nie oznacza, że twierdzenie jest fałszywe. Oceniaj tylko dostępne materiały.",
  "memory-sequence":
    "Odtwórz 3/4/5 zdarzeń w kolejności wynikającej ze źródeł. Zachowaj oznaczenie nieustalonego autora dopisku; nie przypisuj go nikomu bez dowodu.",
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
