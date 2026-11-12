import type { RaceId } from "../../world/races";
import { RACES } from "../../world/races";
import type { DomainId, TrialTier } from "../trials/catalog";
import type { Site } from "../heritage/types";

export type FieldMode =
  | "break"
  | "trace"
  | "shortcut"
  | "circuit"
  | "allocation"
  | "evidence"
  | "measure"
  | "core-band"
  | "ember-band"
  | "core-windows"
  | "ember-windows"
  | "escort"
  | "protect"
  | "restraint"
  | "recovery"
  | "channel";
type DomainSource = {
  race: RaceId;
  domain: DomainId;
  name: string;
  site: Site;
  modes: readonly [FieldMode, FieldMode, FieldMode];
  actions: readonly [string, string, string];
};
/** Owner source §6.2–9.2. These local interactions never grant additional practice or combat stats. */
export const FIELD_DOMAINS: readonly DomainSource[] = [
  {
    race: "planetary",
    domain: "trails",
    name: "Szlaki",
    site: "trail",
    modes: ["trace", "shortcut", "escort"],
    actions: ["Sprawdź ślady", "Oznacz poznany skrót", "Przeprowadź trasę ratunkową"],
  },
  {
    race: "planetary",
    domain: "earth",
    name: "Żywa Ziemia",
    site: "river",
    modes: ["circuit", "circuit", "circuit"],
    actions: ["Zdiagnozuj węzeł", "Przywróć kierunek przepływu", "Ustabilizuj węzły doliny"],
  },
  {
    race: "planetary",
    domain: "care",
    name: "Opieka",
    site: "garden",
    modes: ["allocation", "allocation", "escort"],
    actions: ["Rozdziel wodę", "Przygotuj zapasy obozu", "Doprowadź potrzebującego do obozu"],
  },
  {
    race: "planetary",
    domain: "memory",
    name: "Pamięć Korzeni",
    site: "memorial",
    modes: ["evidence", "evidence", "evidence"],
    actions: [
      "Odczytaj znacznik miejsca",
      "Przypisz zapis pieśni do źródła",
      "Zachowaj świadectwo dolin",
    ],
  },
  {
    race: "sage",
    domain: "seals",
    name: "Pieczęcie",
    site: "archive",
    modes: ["circuit", "circuit", "evidence"],
    actions: [
      "Rozpoznaj układ pieczęci",
      "Połącz poznane znaki",
      "Zapisz sprawdzone źródło pieczęci",
    ],
  },
  {
    race: "sage",
    domain: "barriers",
    name: "Bariery",
    site: "gate",
    modes: ["protect", "protect", "protect"],
    actions: [
      "Osłoń punkt przy bramie",
      "Utrzymaj dwa punkty ochrony",
      "Zabezpiecz trasę świadków",
    ],
  },
  {
    race: "sage",
    domain: "focus",
    name: "Skupienie",
    site: "trainer",
    modes: ["channel", "channel", "channel"],
    actions: [
      "Dokończ skupienie przy węźle",
      "Utrzymaj dwa pełne kanały",
      "Zestrój trzy węzły skupienia",
    ],
  },
  {
    race: "sage",
    domain: "source-memory",
    name: "Pamięć",
    site: "archive",
    modes: ["evidence", "evidence", "evidence"],
    actions: [
      "Zweryfikuj kartę źródłową",
      "Porównaj zachowane świadectwa",
      "Zachowaj granicę wiedzy",
    ],
  },
  {
    race: "android",
    domain: "calibration",
    name: "Kalibracja",
    site: "workshop",
    modes: ["measure", "measure", "measure"],
    actions: [
      "Zmierz celność emitera",
      "Sprawdź serię pomiarową",
      "Porównaj stabilność konfiguracji",
    ],
  },
  {
    race: "android",
    domain: "thermals",
    name: "Termika",
    site: "workshop",
    modes: ["measure", "core-band", "core-windows"],
    actions: [
      "Zmierz wzrost Ładunku",
      "Utrzymaj bezpieczny zakres rdzenia",
      "Sprawdź kontrolowane rozładowanie",
    ],
  },
  {
    race: "android",
    domain: "construction",
    name: "Konstrukcja",
    site: "workshop",
    modes: ["circuit", "circuit", "circuit"],
    actions: [
      "Zmontuj układ według schematu",
      "Połącz stanowisko warsztatu",
      "Sprawdź bezpieczny obwód",
    ],
  },
  {
    race: "android",
    domain: "identity",
    name: "Tożsamość",
    site: "archive",
    modes: ["evidence", "evidence", "recovery"],
    actions: [
      "Zweryfikuj podpisane źródło",
      "Oddziel pamięć od interpretacji",
      "Przeprowadź ręczny ratunek jednostki",
    ],
  },
  {
    race: "legend",
    domain: "body",
    name: "Ciało",
    site: "trail",
    modes: ["trace", "break", "trace"],
    actions: [
      "Sprawdź trasę sprawnościową",
      "Zmierz rzeczywiste przełamanie",
      "Przejdź pełny szlak szkoły",
    ],
  },
  {
    race: "legend",
    domain: "ember",
    name: "Kontrola Żaru",
    site: "trainer",
    modes: ["measure", "ember-band", "ember-windows"],
    actions: [
      "Zmierz Żar po trafieniach",
      "Utrzymaj opanowanie przy celu",
      "Zużyj Żar w wyznaczonym oknie",
    ],
  },
  {
    race: "legend",
    domain: "duel",
    name: "Pojedynek",
    site: "trainer",
    modes: ["restraint", "restraint", "restraint"],
    actions: [
      "Powstrzymaj cios przy poddaniu",
      "Zachowaj kontrolę dwóch sekwencji",
      "Zakończ trzy sekwencje szkoły",
    ],
  },
  {
    race: "legend",
    domain: "oath",
    name: "Przysięga",
    site: "trail",
    modes: ["escort", "protect", "escort"],
    actions: [
      "Doprowadź podróżnego do osłony",
      "Osłoń punkty odwrotu",
      "Przeprowadź ratunek na szlaku",
    ],
  },
];
const LETTER: Record<RaceId, string> = { planetary: "V", sage: "A", android: "N", legend: "P" };
export const FIELDWORK = FIELD_DOMAINS.flatMap((d) =>
  ([1, 2, 3] as const).map((tier) => ({
    ...d,
    id: `F-${LETTER[d.race]}-${d.domain}-${tier}`,
    world: RACES[d.race].world,
    tier,
    mode: d.modes[tier - 1]!,
    action: d.actions[tier - 1]!,
    steps: ["channel", "restraint", "protect"].includes(d.modes[tier - 1]!)
      ? tier
      : d.modes[tier - 1] === "evidence" ||
          ["break", "core-band", "ember-band", "core-windows", "ember-windows"].includes(
            d.modes[tier - 1]!,
          )
        ? 1
        : tier + 1,
  })),
);
export const FIELDWORK_BY_ID = new Map(FIELDWORK.map((d) => [d.id, d]));
export type FieldDefinition = (typeof FIELDWORK)[number];
export type FieldId = FieldDefinition["id"];
export const previousField = (d: FieldDefinition) =>
  d.tier > 1 ? `F-${LETTER[d.race]}-${d.domain}-${d.tier - 1}` : null;
export const fieldGrade = (n: number) => n as TrialTier;
