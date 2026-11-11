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
  "TA07",
  "TA08",
  "TA09",
  "TA10",
  "TA11",
  "TA12",
  "TN01",
  "TN02",
  "TN03",
  "TN04",
  "TN05",
  "TN06",
  "TN07",
  "TN08",
  "TN09",
  "TN10",
  "TN11",
  "TN12",
  "TP04",
  "TP05",
  "TP06",
  "TP07",
  "TP08",
  "TP09",
] as const;
export type TrialId = (typeof TRIAL_IDS)[number];
export type TrialTier = 1 | 2 | 3;
export type TrialKind =
  | "log-signatures"
  | "log-timeline"
  | "manual-recovery"
  | "core-sequence"
  | "core-band"
  | "core-windows"
  | "ember-band"
  | "ember-windows"
  | "ki-budget"
  | "ordered-shots"
  | "moving-shots"
  | "marked-shots"
  | "focus-cycles"
  | "power-targets"
  | "sustain-nodes"
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
  | "focus"
  | "source-memory"
  | "seals"
  | "barriers"
  | "thermals"
  | "ember"
  | "identity"
  | "calibration"
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
    id: "TN10",
    race: "android",
    domain: "identity",
    kind: "log-signatures",
    name: "Tożsamość: podpisy logów",
    targets: [3, 4, 5],
    maxErrors: 0,
  },
  {
    id: "TN11",
    race: "android",
    domain: "identity",
    kind: "log-timeline",
    name: "Tożsamość: chronologia",
    targets: [3, 4, 5],
    maxErrors: 0,
  },
  {
    id: "TN12",
    race: "android",
    domain: "identity",
    kind: "manual-recovery",
    name: "Tożsamość: ratunek bez resetu",
    targets: [2, 3, 4],
    maxErrors: 0,
  },
  {
    id: "TN04",
    race: "android",
    domain: "thermals",
    kind: "core-sequence",
    name: "Termika: sekwencja strzałów",
    targets: [6, 9, 12],
    maxErrors: 0,
  },
  {
    id: "TN05",
    race: "android",
    domain: "thermals",
    kind: "core-band",
    name: "Termika: stabilny ładunek",
    targets: [3, 4, 5],
    maxErrors: 0,
  },
  {
    id: "TN06",
    race: "android",
    domain: "thermals",
    kind: "core-windows",
    name: "Termika: okna rdzenia",
    targets: [2, 3, 4],
    maxErrors: 0,
  },
  {
    id: "TP04",
    race: "legend",
    domain: "ember",
    kind: "ember-band",
    name: "Kontrola Żaru: stabilny żar",
    targets: [3, 4, 5],
    maxErrors: 0,
  },
  {
    id: "TP05",
    race: "legend",
    domain: "ember",
    kind: "ember-windows",
    name: "Kontrola Żaru: okna zużycia",
    targets: [1, 2, 3],
    maxErrors: 0,
  },
  {
    id: "TP06",
    race: "legend",
    domain: "ember",
    kind: "ki-budget",
    name: "Kontrola Żaru: budżet KI",
    targets: [3, 4, 5],
    maxErrors: 0,
  },
  {
    id: "TN01",
    race: "android",
    domain: "calibration",
    name: "Kalibracja: kolejność",
    kind: "ordered-shots",
    targets: [4, 6, 8],
    maxErrors: 2,
  },
  {
    id: "TN02",
    race: "android",
    domain: "calibration",
    name: "Kalibracja: ruchome cele",
    kind: "moving-shots",
    targets: [3, 4, 5],
    maxErrors: 2,
  },
  {
    id: "TN03",
    race: "android",
    domain: "calibration",
    name: "Kalibracja: właściwe oznaczenie",
    kind: "marked-shots",
    targets: [3, 4, 5],
    maxErrors: 0,
  },
  {
    id: "TA07",
    race: "sage",
    domain: "focus",
    name: "Nieprzerwany przepływ",
    kind: "focus-cycles",
    targets: [2, 3, 4],
    maxErrors: 0,
  },
  {
    id: "TA08",
    race: "sage",
    domain: "focus",
    name: "Oszczędne zasilanie",
    kind: "power-targets",
    targets: [3, 4, 5],
    maxErrors: 0,
  },
  {
    id: "TA09",
    race: "sage",
    domain: "focus",
    name: "Sieć skupienia",
    kind: "sustain-nodes",
    targets: [2, 3, 4],
    maxErrors: 0,
  },
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
  focus: "Skupienie",
  seals: "Pieczęcie",
  barriers: "Bariery",
  thermals: "Termika",
  ember: "Kontrola Żaru",
  identity: "Tożsamość",
  calibration: "Kalibracja",
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
export const TRIAL_RULES: Partial<Record<TrialKind, string>> = {
  ...MEMORY_TRIAL_RULES,
  "ordered-shots":
    "Traf 4/6/8 ponumerowanych celów kolejno zwykłymi strzałami R. Najwyżej dwa chybienia; przeszkody blokują pociski.",
  "moving-shots":
    "Traf 3/4/5 różnych ruchomych celów. Prędkość 40/55/70 j./s; używaj prawdziwych pocisków i widoczności.",
  "marked-shots":
    "Oznacz A1 i traf R 3/4/5 właściwych celów. Nie trafiaj chronionego celu ani wabika. Samo oznaczenie nie wystarcza.",
  "core-sequence":
    "Wykonaj 6/9/12 celnych R i 1/2/3 wyładowania C1. Nie przegrzewaj rdzenia; zasób i koszty pochodzą z rzeczywistego profilu.",
  "core-band":
    "Utrzymuj Ładunek w 25–65% bieżącego maksimum przez 15/20/25 aktywnych sekund. Profile bazowy/C7/C8 mają maksimum 100/150/70.",
  "core-windows":
    "Zbuduj Ładunek i wykonaj 2/3/4 celne C1 w oznaczonych oknach. Zachowano koszt KI, zużycie zasobu i cooldown.",
  "ember-band":
    "Utrzymuj Żar 30–70 przez 15/20/25 aktywnych sekund. Bez T i bez zaliczania przez AFK.",
  "ember-windows":
    "Wykonaj 1/2/3 celne C4 w oznaczonych oknach z Żaru uzyskanego legalnymi trafieniami.",
  "ki-budget":
    "Traf 3/4/5 akcjami A1/B1/C1 w łącznym limicie 70/65/60% KI. Regeneracja nie odnawia budżetu; brak mikstur i darmowego zasilania.",
  "log-signatures":
    "Zweryfikuj podpisy 3/4/5 logów, porównując je z niezależnym rejestrem. Odróżnij niezgodność od braku dowodu.",
  "log-timeline":
    "Odtwórz 3/4/5 zdarzeń z logów i świadectw. Nie przypisuj brakujących danych konkretnemu autorowi.",
  "manual-recovery":
    "Wykonaj 2/3/4 ręczne działania na terminalu ratunkowym. Izoluj uszkodzenie i przywróć zasilanie, zachowując pamięć jednostki.",
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
