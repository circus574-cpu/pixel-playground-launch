import { mirrorBoard, type MirrorBoard } from "./mirrors";
import { MODULE_ENERGY, type ModuleId } from "../state";
import { MODULES } from "../modifiers";
import type { TrialDefinition, TrialTier } from "./catalog";

export type TrialPuzzle = {
  prompt: string;
  documents: { title: string; text: string }[];
  options: { id: string; label: string }[];
  answer: string;
  mirrors?: MirrorBoard;
  modules?: { count: number; budget: number; required: string[] };
  pack?: { count: number };
  allocation?: { total: number; demands: readonly [number, number] };
};
export type PublicPuzzle = Omit<TrialPuzzle, "answer">;
const MODULE_ROLES: Record<ModuleId, readonly string[]> = {
  "mn-cooling": ["chłodzenie"],
  "mn-optics": ["celowanie"],
  "mn-shield": ["osłona"],
  "mn-precision": ["celowanie"],
  "mn-scanner": ["badanie"],
  "mn-routing": ["zasilanie"],
};
function optionId(text: string) {
  let hash = 2166136261;
  for (const c of text) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return "choice-" + (hash >>> 0).toString(36);
}
function question(
  prompt: string,
  text: string,
  labels: string[],
  correct: string,
  rotation: number,
): TrialPuzzle {
  const options = labels.map((label) => ({ id: optionId(label), label }));
  const cut = rotation % options.length;
  return {
    prompt,
    documents: [{ title: "Jawny materiał ćwiczebny", text }],
    options: [...options.slice(cut), ...options.slice(0, cut)],
    answer: optionId(correct),
  };
}
export function publicPuzzle(p: TrialPuzzle | undefined): PublicPuzzle | null {
  if (!p) return null;
  const { answer: _answer, ...visible } = p;
  return structuredClone(visible);
}
export function moduleSolutionValid(puzzle: TrialPuzzle, ids: ModuleId[]) {
  const rule = puzzle.modules;
  return (
    !!rule &&
    ids.length === rule.count &&
    new Set(ids).size === ids.length &&
    ids.every((id) => Object.hasOwn(MODULE_ENERGY, id)) &&
    ids.reduce((n, id) => n + MODULE_ENERGY[id], 0) <= rule.budget &&
    rule.required.every((role) => ids.some((id) => MODULE_ROLES[id].includes(role)))
  );
}
/** Set and allocation answers fit the existing bounded answerId transport; no client verdicts. */
export function packAnswerValid(puzzle: TrialPuzzle, value: string) {
  const ids = value.split(",");
  return (
    !!puzzle.pack &&
    ids.length === puzzle.pack.count &&
    new Set(ids).size === ids.length &&
    ids.every((id) => puzzle.options.some((o) => o.id === id)) &&
    [...ids].sort().join(",") === puzzle.answer
  );
}
export function allocationAnswerValid(puzzle: TrialPuzzle, value: string) {
  const rule = puzzle.allocation;
  if (!rule || !/^\d+,\d+$/.test(value)) return false;
  const parts = value.split(",").map(Number);
  const a = parts[0]!,
    b = parts[1]!;
  return (
    Number.isSafeInteger(a) &&
    Number.isSafeInteger(b) &&
    a >= 0 &&
    b >= 0 &&
    a + b === rule.total &&
    a >= rule.demands[0] &&
    b >= rule.demands[1]
  );
}
/** Training records are explicit exercises, not new claims about the campaign's history. */
export function trialPuzzles(def: TrialDefinition, tier: TrialTier): TrialPuzzle[] {
  const count = def.targets[tier - 1]!;
  if (["focus-cycles", "power-targets", "sustain-nodes"].includes(def.kind)) return [];
  if (def.kind === "mirrors") {
    return [
      {
        prompt: `Ustaw ${count} zwierciadła i doprowadź promień do odbiornika, omijając chroniony punkt.`,
        documents: [
          {
            title: "Karta optyczna",
            text: "Źródło Ź emituje promień w prawo. Lustro / odbija: prawo → góra, góra → prawo, lewo → dół, dół → lewo. Lustro \\ odbija: prawo → dół, dół → prawo, lewo → góra, góra → lewo. O to odbiornik, ! to chroniony punkt. Promień musi wykorzystać wszystkie zwierciadła. Obracaj lustra i sprawdzaj jawną trasę, potem uruchom promień.",
          },
        ],
        options: [],
        mirrors: mirrorBoard(tier),
        answer: ["/", "\\", "/", "\\"].slice(0, count).join(","),
      },
    ];
  }
  if (def.kind === "supplies") {
    const entries = [
      ["Liść opatrunkowy", "opatrunek"],
      ["Owoc podróżny", "energia"],
      ["Korzeń rozgrzewający", "ciepło"],
      ["Żywica uszczelniająca", "naprawa bukłaka"],
      ["Zioło przeciw ukąszeniom", "ukąszenia"],
      ["Gorzki kwiat", "barwnik"],
      ["Sucha kora", "ozdoba"],
    ] as const;
    const required = entries.slice(0, count);
    return [
      {
        prompt: `Przygotuj zestaw ${count} składników. Potrzeby: ${required.map((e) => e[1]).join(", ")}.`,
        documents: [
          {
            title: "Karta składników wypożyczonych",
            text:
              entries.map(([n, role]) => `${n}: ${role}`).join("; ") +
              ". Wybierz dokładnie po jednym składniku na każdą potrzebę; dodatki nie są potrzebne.",
          },
        ],
        options: entries.map(([label]) => ({ id: optionId(label), label })),
        answer: required
          .map(([label]) => optionId(label))
          .sort()
          .join(","),
        pack: { count },
      },
    ];
  }
  if (def.kind === "water-allocation") {
    const a = count / 2 - 1,
      b = count - a;
    return [
      {
        prompt: `Rozdziel ${count} jednostek przepływu pomiędzy dwie osady.`,
        documents: [
          {
            title: "Zapotrzebowanie osad",
            text: `Osada nad Brzegiem potrzebuje co najmniej ${a} jednostek. Osada pod Lasem potrzebuje co najmniej ${b} jednostek. Dostępne: ${count}. Rozdziel całość; nie można stworzyć dodatkowej wody.`,
          },
        ],
        options: [],
        answer: `${a},${b}`,
        allocation: { total: count, demands: [a, b] },
      },
    ];
  }
  if (def.kind === "modules") {
    const rules = [
      { count, budget: 6, required: ["badanie", "celowanie"] },
      { count, budget: 8, required: ["badanie", "celowanie", "zasilanie"] },
      { count, budget: 10, required: ["badanie", "celowanie", "osłona"] },
    ][tier - 1]!;
    return [
      {
        prompt: `Zbuduj układ z ${count} różnych modułów. Budżet: ${rules.budget}. Wymagania: ${rules.required.join(", ")}.`,
        documents: [
          {
            title: "Karta warsztatu — profil wypożyczony",
            text: Object.entries(MODULE_ROLES)
              .map(
                ([id, roles]) =>
                  `${MODULES[id as ModuleId].name}: ${MODULE_ENERGY[id as ModuleId]} energii, ${roles.join(", ")}.`,
              )
              .join("\n"),
          },
        ],
        options: Object.entries(MODULES).map(([id, m]) => ({
          id,
          label: `${m.name} · ${MODULE_ENERGY[id as ModuleId]} energii`,
        })),
        answer: "",
        modules: rules,
      },
    ];
  }
  if (def.kind === "contamination") {
    const sites = ["Północ", "Brzeg", "Polana"];
    return Array.from({ length: count * 2 }, (_, step) => {
      const location = sites[Math.floor(step / 2) % sites.length]!;
      const action = step % 2 === 0 ? "Oznacz" : "Oczyść";
      return question(
        `${step % 2 === 0 ? "Oznacz skażone miejsce" : "Oczyść wcześniej oznaczone miejsce"}. Zdrowe miejsca pozostaw nietknięte.`,
        `Tablica pomiarowa stanowiska ${Math.floor(step / 2) + 1}. Zdrowe podłoże: 0–20. ${sites.map((n) => `${n}: ${n === location ? 82 : 12}`).join("; ")}. Najpierw oznacz, potem oczyść to samo miejsce.`,
        sites.flatMap((n) => ["Oznacz " + n, "Oczyść " + n]),
        action + " " + location,
        tier + step,
      );
    });
  }
  return Array.from({ length: count }, (_, i) => {
    const rotate = tier + i + def.id.charCodeAt(2);
    switch (def.kind) {
      case "source-fragments": {
        const sources = [
          [
            "Dziennik przewoźniczki",
            "Na zachodnim pomoście zostawiłam dwie skrzynie na suchej ławie.",
          ],
          [
            "Karta zielarza",
            "Napar zebrano do ciemnego naczynia, aby światło nie zmieniło barwy liści.",
          ],
          [
            "Protokół opiekuna pieczęci",
            "Trzeci znak otworzył się dopiero po uspokojeniu przepływu.",
          ],
          ["List czytelniczki", "Oddaję tom z pustą kartą; nie uzupełniłam jej własnym domysłem."],
          ["Rejestr kopisty", "Kopia zachowuje przerwany podpis i ślad wilgoci na dolnym brzegu."],
        ].slice(0, count);
        return question(
          `Fragment ${i + 1}/${count}: „${sources[i]![1]}” Z którego źródła pochodzi?`,
          "Materiały ćwiczebne, nie kronika kampanii.\n" +
            [...sources]
              .reverse()
              .map(([name, text]) => `${name}: „${text}”`)
              .join("\n"),
          sources.map(([name]) => name!),
          sources[i]![0]!,
          rotate,
        );
      }
      case "unsupported-claims": {
        const records = [
          {
            documents:
              "Dziennik: dwie skrzynie dotarły przed świtem. Potwierdzenie odbioru: opiekunka przejęła obie bez naruszenia plomb.",
            known: ["Dostarczono dwie skrzynie", "Plomby były nienaruszone"],
            unknown: "W obu skrzyniach były identyczne dokumenty",
          },
          {
            documents:
              "Karta czytelni: zachowano dwie osobne kopie. Notatka konserwatora: tylko pierwsza ma czytelny podpis; przy drugiej nie ustalono autora.",
            known: ["Zachowano dwie kopie", "Pierwsza kopia ma czytelny podpis"],
            unknown: "Obie kopie sporządziła ta sama osoba",
          },
          {
            documents:
              "Pomiar: przepływ wrócił po otwarciu zaworu. Protokół naprawy: żadna zachowana relacja nie opisuje stanu instalacji przed awarią.",
            known: [
              "Po otwarciu zaworu wrócił przepływ",
              "Nie zachowano opisu instalacji sprzed awarii",
            ],
            unknown: "Awarię spowodowało celowe działanie",
          },
          {
            documents:
              "Zgoda świadka: kopię wolno udostępnić bez nazwiska. Rejestr: publiczny odpis zachowuje tę anonimizację; nie odnotowano zgody na ujawnienie imienia.",
            known: [
              "Świadek zgodził się na anonimową kopię",
              "Publiczny odpis nie ujawnia nazwiska",
            ],
            unknown: "Świadek zgodził się na publikację swojego imienia",
          },
        ];
        const record = records[i]!;
        return question(
          `Ocena ${i + 1}/${count}: którego twierdzenia źródła nie potwierdzają?`,
          "Materiały ćwiczebne. Nie dopowiadaj brakujących danych.\n" + record.documents,
          [...record.known, record.unknown],
          record.unknown,
          rotate,
        );
      }
      case "memory-sequence": {
        const known = [
          "Odnalezienie pustej karty",
          "Wykonanie kopii",
          "Sprawdzenie pieczęci",
          "Złożenie kopii w czytelni",
        ].slice(0, count - 1);
        const unknown = "Otwarcie rejestru — autor dopisku: nieustalony";
        const events = [...known, unknown];
        const relations = known.slice(1).map((event, j) => `${event} nastąpiło po: ${known[j]}.`);
        return question(
          `Kolejność ${i + 1}/${count}: wskaż następne zdarzenie, zachowując granice wiedzy.`,
          "Ćwiczebna karta źródeł. Pierwsze było odnalezienie pustej karty.\n" +
            [...relations].reverse().join("\n") +
            `\nRejestr otwarto dopiero po: ${known.at(-1)}. W rejestrze jest dopisek, którego autora nie ustalono. Nie wolno przypisać go Sorze ani wymazać informacji o braku podpisu.`,
          [
            ...events,
            "Otwarcie rejestru — autorką dopisku jest Sora",
            "Otwarcie rejestru — usuń informację o nieznanym autorze",
          ],
          events[i]!,
          rotate,
        );
      }
      case "tracks": {
        const signs = [
          "dwa równoległe nacięcia",
          "trzy kropki",
          "złamana gałązka",
          "ślad liścia",
          "okrąg z kreską",
        ];
        const labels = ["Szlak posłańca", "Ścieżka zwierzyny", "Dawny trakt"].slice(
          0,
          tier === 1 ? 2 : 3,
        );
        const right = labels[i % labels.length]!;
        return question(
          `Ślad ${i + 1}/${count}: ${signs[i]}. Którym szlakiem dalej?`,
          `Karta tropiciela: ${labels.map((name, j) => `${name}: ${signs[(i + j - (i % labels.length) + signs.length) % signs.length]}`).join("; ")}. Przy tym stanowisku widzisz: ${signs[i]}.`,
          labels,
          right,
          rotate,
        );
      }
      case "flow-nodes": {
        const nodes = ["Źródło", "Przepust", "Korzeń", "Odbiornik"].slice(0, count);
        return question(
          `Napraw węzeł ${i + 1}/${count} zgodnie z kierunkiem przepływu.`,
          `Na kamieniach wyryto strzałki: ${nodes.join(" → ")}. Naprawy zaczynają się przy źródle i podążają za strzałkami.`,
          nodes,
          nodes[i]!,
          rotate,
        );
      }
      case "motifs": {
        const motifs = ["Źródło", "Most", "Dom", "Korzeń", "Światło"].slice(0, count);
        return question(
          `Ułóż motyw ${i + 1}/${count} pieśni na podstawie znaków.`,
          `Znaki na tablicach, od pierwszej do ostatniej: ${motifs.map((m, j) => `${j + 1}. ${m}`).join(" → ")}. Zachowaj tę kolejność; nie dopisuj brakującej zwrotki.`,
          motifs,
          motifs[i]!,
          rotate,
        );
      }
      case "map": {
        const villages = [
          "Osada Tkaczy",
          "Osada Młynarzy",
          "Osada Sadowników",
          "Osada Przewoźników",
        ].slice(0, count);
        const traces = ["czółenko tkackie", "kamień młyński", "kosz jabłek", "wiosło rzeczne"];
        return question(
          `Do której osady należy ślad: ${traces[i]}?`,
          villages.map((v, j) => `${v}: ${traces[j]}.`).join("\n"),
          villages,
          villages[i]!,
          rotate,
        );
      }
      case "contradictions": {
        const facts = [
          "przeprawa prowadzi na północ",
          "pod mostem stoją trzy podpory",
          "dostawa miała cztery skrzynie",
          "strażniczka przybyła przed świtem",
        ];
        const wrong = [
          "przeprawa prowadzi na południe",
          "pod mostem stoją dwie podpory",
          "dostawa miała pięć skrzyń",
          "strażniczka przybyła w południe",
        ];
        return question(
          `Wskaż sprzeczność ${i + 1}/${count}. Które zdanie raportu przeczy świadectwu?`,
          `Świadectwo terenowe: ${facts[i]}. Raport: ${wrong[i]}. Pozostałe zdania raportu: zachowano kopię dokumentu; podpis świadka jest czytelny.`,
          [wrong[i]!, "zachowano kopię dokumentu", "podpis świadka jest czytelny"],
          wrong[i]!,
          rotate,
        );
      }
      case "symbols": {
        const glyphs = ["kropla", "krąg", "promień", "fala", "węzeł"].slice(0, count);
        const meanings = [
          "odbiór energii",
          "magazynowanie",
          "przekazanie",
          "uspokojenie",
          "zamknięcie obwodu",
        ].slice(0, count);
        return question(
          `Odczytaj symbol: ${glyphs[i]}.`,
          `Klucz: ${glyphs.map((g, j) => `${g} = ${meanings[j]}`).join("; ")}.`,
          meanings,
          meanings[i]!,
          rotate,
        );
      }
      case "changes": {
        const names = ["kolor", "kierunek", "liczba znaków", "materiał"];
        const original = ["turkus", "północ", "trzy", "kamień"];
        const changed = ["złoto", "południe", "cztery", "szkło"];
        const copy = [...original];
        copy[i] = changed[i]!;
        return question(
          `Porównaj wzorzec i kopię ${i + 1}/${count}. Co zmieniono?`,
          `Wzorzec: ${names.map((n, j) => `${n}: ${original[j]}`).join("; ")}.\nKopia: ${names.map((n, j) => `${n}: ${copy[j]}`).join("; ")}.`,
          names,
          names[i]!,
          rotate,
        );
      }
      case "seals": {
        const seals = ["Źródło", "Zwierciadło", "Archiwum", "Ogród", "Brama"].slice(0, count);
        return question(
          `Uruchom pieczęć ${i + 1}/${count}, respektując zależności.`,
          `Pierwsza jest pieczęć ${seals[0]}. ${seals
            .slice(1)
            .map((n, j) => `${n} można uruchomić dopiero po ${seals[j]}.`)
            .join(" ")}`,
          seals,
          seals[i]!,
          rotate,
        );
      }
      case "circuit": {
        const parts = [
          "Bezpiecznik",
          "Stabilizator",
          "Przetwornik",
          "Przekaźnik",
          "Odbiornik",
        ].slice(0, count);
        return question(
          `Połącz element ${i + 1}/${count} obwodu.`,
          `Jawny schemat przepływu od źródła: ${parts.join(" → ")}. Nie wolno zasilać elementu przed poprzedzającym go zabezpieczeniem.`,
          parts,
          parts[i]!,
          rotate,
        );
      }
      case "diagnosis": {
        const parts = ["Czujnik", "Chłodnica", "Zasilacz", "Przewód"];
        return question(
          `Zdiagnozuj awarię ${i + 1}/${count}. Który element trzeba wymienić?`,
          `Prawidłowy odczyt każdego elementu: 40–60 jednostek. Pomiary: ${parts.map((p, j) => `${p}: ${j === i ? 92 : 50}`).join("; ")}.`,
          parts,
          parts[i]!,
          rotate,
        );
      }
      default:
        throw Error("Ten rodzaj próby nie korzysta z zagadek.");
    }
  });
}
