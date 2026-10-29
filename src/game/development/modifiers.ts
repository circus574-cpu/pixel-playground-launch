import type { RaceId } from "../world/races";
import type { DevelopmentState, ModuleId, VariantId } from "./state";
import { zeroTraining } from "./training";

export const VARIANTS: Record<
  VariantId,
  { race: RaceId; ability: "A1" | "B1" | "C1"; name: string; description: string }
> = {
  "mv-trail": {
    race: "planetary",
    ability: "A1",
    name: "Wędrowny unik",
    description: "Dystans +20%, koszt KI +25%. Czas nietykalności bez zmiany.",
  },
  "mv-earth": {
    race: "planetary",
    ability: "B1",
    name: "Krąg żywej ziemi",
    description: "Promień +20%, obrażenia −10%, również drugiego uderzenia.",
  },
  "mv-root": {
    race: "planetary",
    ability: "C1",
    name: "Oddech korzeni",
    description: "Łączne leczenie +10%, czas leczenia +50%.",
  },
  "ma-seal": {
    race: "sage",
    ability: "A1",
    name: "Szybka pieczęć",
    description: "Opóźnienie −20%, koszt KI +25%.",
  },
  "ma-barrier": {
    race: "sage",
    ability: "B1",
    name: "Trwała bariera",
    description: "Czas +50%, pojemność −20%.",
  },
  "ma-focus": {
    race: "sage",
    ability: "C1",
    name: "Głębokie skupienie",
    description: "Łącznie odnawiane KI +20%, czas skupienia +50%.",
  },
  "mn-mark": {
    race: "android",
    ability: "A1",
    name: "Trwały sygnał",
    description: "Czas oznaczenia +50%, koszt KI +25%.",
  },
  "mn-barrier": {
    race: "android",
    ability: "B1",
    name: "Gęsta osłona",
    description: "Pojemność +15%, czas −20%.",
  },
  "mn-discharge": {
    race: "android",
    ability: "C1",
    name: "Szerokie wyładowanie",
    description: "Szerokość wiązki +25%, obrażenia −10%. Ładunek bez zmiany.",
  },
  "mp-cuts": {
    race: "legend",
    ability: "A1",
    name: "Cięcia przysięgi",
    description: "Suma obrażeń +10%, koszt KI +25%. Liczba cięć bez zmiany.",
  },
  "mp-break": {
    race: "legend",
    ability: "B1",
    name: "Kontrolowane przełamanie",
    description: "Ogłuszenie +25%, bezpośrednie obrażenia −10%.",
  },
  "mp-burst": {
    race: "legend",
    ability: "C1",
    name: "Szeroki płomień",
    description: "Promień +20%, obrażenia −10%. Podpalenie bez premii.",
  },
};
export const MODULES: Record<ModuleId, { name: string; description: string }> = {
  "mn-cooling": {
    name: "Chłodzenie",
    description: "Spadek Ładunku poza ostrzałem +20%, maksymalne KI −10%.",
  },
  "mn-optics": { name: "Optyka", description: "Zasięg zwykłego strzału +10%, ATK −6%." },
  "mn-shield": { name: "Kondensator osłony", description: "Pojemność B1 +10%, czas osłony −10%." },
  "mn-precision": {
    name: "Precyzja",
    description: "Szansa krytyczna +2 punkty procentowe, maksymalne KI −5%.",
  },
  "mn-scanner": {
    name: "Skaner",
    description: "Badanie znanych instalacji w odkrytej lokalnej strefie. Bez premii bojowej.",
  },
  "mn-routing": {
    name: "Przekierowanie",
    description: "Mnożnik kosztu KI −0,05, cooldowny aktywne +10%. Bez zmiany R i T.",
  },
};
/** Only a discovered variant with its canonical node may affect the kit. */
export function activeVariant(
  state: DevelopmentState | undefined,
  race: RaceId,
  learned: ReadonlySet<string>,
): VariantId | null {
  const id = state?.activeVariantId;
  if (!id || !state.unlockedVariants.includes(id)) return null;
  const def = VARIANTS[id];
  return def.race === race && learned.has(def.ability) ? id : null;
}
const EMPTY_TRAINING = Object.freeze(zeroTraining());
export function developmentModifiers(state: DevelopmentState | undefined, race: RaceId) {
  const modules = race === "android" ? (state?.equippedModuleIds ?? []) : [];
  return {
    training: state?.training ?? EMPTY_TRAINING,
    maxKi:
      (modules.includes("mn-cooling") ? 0.9 : 1) * (modules.includes("mn-precision") ? 0.95 : 1),
    attack: modules.includes("mn-optics") ? 0.94 : 1,
    crit: modules.includes("mn-precision") ? 2 : 0,
    basicRange: modules.includes("mn-optics") ? 1.1 : 1,
    kiReduction: modules.includes("mn-routing") ? 0.05 : 0,
    activeCooldown: modules.includes("mn-routing") ? 1.1 : 1,
    cooling: modules.includes("mn-cooling") ? 1.2 : 1,
    shieldCapacity: modules.includes("mn-shield") ? 1.1 : 1,
    shieldDuration: modules.includes("mn-shield") ? 0.9 : 1,
  };
}
