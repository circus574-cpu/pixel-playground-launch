import { MODULE_ENERGY, type ModuleId } from "../state";
import { MODULES } from "../modifiers";
import type { TrialDefinition, TrialTier } from "./catalog";

export type TrialPuzzle = {
  prompt: string;
  documents: { title: string; text: string }[];
  options: { id: string; label: string }[];
  answer: string;
  modules?: { count: number; budget: number; required: string[] };
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
/** Training records are explicit exercises, not new claims about the campaign's history. */
export function trialPuzzles(def: TrialDefinition, tier: TrialTier): TrialPuzzle[] {
  const count = def.targets[tier - 1]!;
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
  return Array.from({ length: count }, (_, i) => {
    const rotate = tier + i + def.id.charCodeAt(2);
    switch (def.kind) {
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
