import type { AndroidHeroState, AndroidLand, AndroidRace } from "./economy";

export type GoalKind = "heritage" | "development";

export type AndroidGoalDef = {
  id: string;
  race: AndroidRace;
  kind: GoalKind;
  order: number;
  title: string;
  mentor: string;
  summary: string;
  requirementText: string;
  minLevel: number;
  prereqId?: string;
  xpReward: number;
  goldReward: number;
  statPointsReward?: number;
  skillPointsReward?: number;
};

export type AndroidGoalStatus = "claimed" | "ready" | "in_progress" | "locked";

export type AndroidGoalProgressView = AndroidGoalDef & {
  status: AndroidGoalStatus;
  progressText: string;
};

const HERITAGE_XP = [100, 160, 240, 360, 520, 720] as const;
const HERITAGE_GOLD = [30, 40, 60, 80, 100, 140] as const;
const HERITAGE_LEVELS = [1, 4, 7, 10, 14, 18] as const;

type ChapterSeed = {
  race: AndroidRace;
  prefix: "P" | "V" | "A" | "N";
  mentor: string;
  smith: string;
  chapters: readonly [string, string][];
  devTitles: readonly [string, string, string, string, string, string];
};

const SEEDS: readonly ChapterSeed[] = [
  {
    race: "legend",
    prefix: "P",
    mentor: "Kaena",
    smith: "Goro",
    chapters: [
      ["Imię pod popiołem", "Porównaj znak rodzinnej broni ze źródłami Kaeny w Twierdzy Popiołu."],
      ["Próba przerwania ciosu", "Opanuj kontrolę siły i osłonę przed niepotrzebnym uderzeniem."],
      ["Kowadło po mistrzu", "Zbadaj trzy znaki na broni i dopisz własny podpis u kowala Goro."],
      ["Ci, którzy zawrócili", "Porównaj ślady dawnej ewakuacji z relacjami potomków straży."],
      ["Pojedynek bez widowni", "Stocz ćwiczebny pojedynek honorowy z poszanowaniem poddania."],
      ["Przysięga dla jutra", "Potwierdź własną przysięgę obrońcy Pyry osłoną odwrotu."],
    ],
    devTitles: [
      "Pierwsza warta w Twierdzy Popiołu",
      "Kuźnia Goro: broń lub pancerz Żaru",
      "Przebudzenie Ki Wojownika Pyry",
      "Dyscyplina Ciała na Arenie",
      "Skarbiec Cytadeli: zapasy wyprawy",
      "Szlak Czterech Kontynentów",
    ],
  },
  {
    race: "planetary",
    prefix: "V",
    mentor: "Aira",
    smith: "Taro",
    chapters: [
      ["Mapa zatopionych domów", "Sprawdź rodzinny znacznik drogi z mapą osady u Airy."],
      [
        "Rzeka, która zawróciła",
        "Zbadaj oba brzegi nurtu, aby naprawa nie odebrała wody sąsiadom.",
      ],
      [
        "Las nie rozpoznaje swoich",
        "Zweryfikuj stare znaki strażników i przywróć zaufanie szlaku.",
      ],
      [
        "Pieśń bez ostatniej zwrotki",
        "Zbierz relacje trzech rodzin i zapisz brakującą część pieśni.",
      ],
      ["Korzenie pamiętają", "Poznaj cenę dawnego ratunku na podstawie trzech świadectw."],
      ["Nowy szlak", "Sprawdź nowy szlak w praktyce i podpisz kronikę Verdantii."],
    ],
    devTitles: [
      "Pierwsze kroki w Zielonej Przystani",
      "Warsztat Taro: ekwipunek Strażnika",
      "Harmonia Drzewka Ki Verdantii",
      "Próba Szlaku na Arenie",
      "Skarbiec Przystani: zapasy",
      "Szlak Czterech Kontynentów",
    ],
  },
  {
    race: "sage",
    prefix: "A",
    mentor: "Sora",
    smith: "Enso",
    chapters: [
      ["Biała strona", "Porównaj pieczęć na pustej stronie kroniki ze źródłami Sory."],
      [
        "Źródło dwóch wspomnień",
        "Zestaw dwa świadectwa tego samego ratunku bez zacierania różnic.",
      ],
      ["Archiwista bez imienia", "Odnajdź ślady pracy dawnego archiwisty i rozmów się z rodziną."],
      [
        "Biblioteka pod ogrodem",
        "Uzyskaj zgodę opiekunów i sprawdź zabezpieczenia zamkniętych akt.",
      ],
      ["Cena ujawnienia", "Zbierz trzy źródła i dwie zgody przed ogłoszeniem świadectwa."],
      [
        "Kronika z pustym miejscem",
        "Zabezpiecz kopie archiwum i zachowaj miejsce dla przyszłych kronikarzy.",
      ],
    ],
    devTitles: [
      "Pierwszy wpis w Sanktuarium",
      "Pracownia Enso: ekwipunek Mędrca",
      "Skupienie Drzewka Ki Aetherii",
      "Próba Umysłu na Arenie",
      "Skarbiec Sanktuarium: depozyt",
      "Szlak Czterech Kontynentów",
    ],
  },
  {
    race: "android",
    prefix: "N",
    mentor: "LYRA-7",
    smith: "HEF-4",
    chapters: [
      ["Pakiet bez nadawcy", "Zbadaj pakiet bez podpisu razem z LYRA-7 w Węźle Świadomości."],
      [
        "Warsztat, którego nie ma",
        "Przywróć zasilanie zamkniętego warsztatu bez nadpisywania logów.",
      ],
      ["Jednostka poza listą", "Zaproponuj alternatywne zasilanie odłączonej jednostce."],
      ["Rozkaz w pamięci", "Złóż trzy podpisane fragmenty rozkazu z zachowaniem pochodzenia."],
      ["Prawo do odmowy", "Zdiagnozuj usterkę rdzenia bez poświęcania cudzej pamięci."],
      ["Pierwszy zapis własny", "Przygotuj otwarty warsztat i podpisz własny wpis tożsamości."],
    ],
    devTitles: [
      "Inicjalizacja w Węźle Świadomości",
      "Moduł HEF-4: wyposażenie Rdzenia",
      "Kalibracja Drzewka Ki Nexus-9",
      "Test Wydajności na Arenie",
      "Magazyn Banku: kopia zasobów",
      "Szlak Czterech Kontynentów",
    ],
  },
];

function buildCatalog(): AndroidGoalDef[] {
  const out: AndroidGoalDef[] = [];
  for (const seed of SEEDS) {
    seed.chapters.forEach(([title, summary], idx) => {
      const n = idx + 1;
      const id = `H-${seed.prefix}0${n}`;
      const prereqId = n > 1 ? `H-${seed.prefix}0${n - 1}` : undefined;
      out.push({
        id,
        race: seed.race,
        kind: "heritage",
        order: n,
        title: `Rozdział ${n}: ${title}`,
        mentor: n === 3 ? seed.smith : seed.mentor,
        summary,
        requirementText:
          n === 1
            ? `Poziom ${HERITAGE_LEVELS[idx]} • Wstępna rozmowa w stolicy`
            : `Poziom ${HERITAGE_LEVELS[idx]} • Ukończ Rozdział ${n - 1}`,
        minLevel: HERITAGE_LEVELS[idx]!,
        ...(prereqId ? { prereqId } : {}),
        xpReward: HERITAGE_XP[idx]!,
        goldReward: HERITAGE_GOLD[idx]!,
        ...(n % 2 === 0 ? { statPointsReward: 1 } : {}),
      });
    });

    const p = seed.prefix;
    const devs: Omit<AndroidGoalDef, "race" | "kind" | "mentor">[] = [
      {
        id: `G-${p}01`,
        order: 1,
        title: seed.devTitles[0],
        summary: "Odwiedź kupca w stolicy albo ukończ dowolne zlecenie mieszkańca.",
        requirementText: "Kup przedmiot w sklepie lub ukończ 1 zlecenie NPC",
        minLevel: 1,
        xpReward: 60,
        goldReward: 50,
      },
      {
        id: `G-${p}02`,
        order: 2,
        title: seed.devTitles[1],
        summary: `Wykuj broń lub pancerz u kowala (${seed.smith}) albo załóż element ekwipunku.`,
        requirementText: "Wykuj 1 przedmiot w kuźni lub załóż wyposażenie",
        minLevel: 1,
        xpReward: 90,
        goldReward: 70,
        statPointsReward: 1,
      },
      {
        id: `G-${p}03`,
        order: 3,
        title: seed.devTitles[2],
        summary:
          "Rozwiń swoją postać: odblokuj co najmniej 2 węzły talentów i przydziel 1 punkt statystyk.",
        requirementText: "Min. 2 odblokowane talenty i 1 przydzielony punkt statystyk",
        minLevel: 1,
        xpReward: 120,
        goldReward: 80,
        skillPointsReward: 1,
      },
      {
        id: `G-${p}04`,
        order: 4,
        title: seed.devTitles[3],
        summary: "Odbądź trening bojowy na arenie stolicy, aby zahartować dyscyplinę swojej rasy.",
        requirementText: "Ukończ co najmniej 1 trening na arenie",
        minLevel: 1,
        xpReward: 150,
        goldReward: 100,
        statPointsReward: 1,
      },
      {
        id: `G-${p}05`,
        order: 5,
        title: seed.devTitles[4],
        summary: "Zabezpiecz część złota lub przedmiotów w Skarbcu Banku stolicy.",
        requirementText: "Zdeponuj złoto lub przedmiot w Banku",
        minLevel: 1,
        xpReward: 110,
        goldReward: 90,
      },
      {
        id: `G-${p}06`,
        order: 6,
        title: seed.devTitles[5],
        summary: "Otwórz mapę planety Superior i odwiedź co najmniej jeden inny kontynent.",
        requirementText: "Odwiedź co najmniej 2 kontynenty",
        minLevel: 1,
        xpReward: 200,
        goldReward: 150,
        statPointsReward: 2,
      },
    ];
    for (const d of devs) {
      out.push({ ...d, race: seed.race, kind: "development", mentor: seed.mentor });
    }
  }
  return out;
}

export const ANDROID_GOALS_CATALOG: readonly AndroidGoalDef[] = buildCatalog();
export const ANDROID_GOALS_MAP = new Map<string, AndroidGoalDef>(
  ANDROID_GOALS_CATALOG.map((g) => [g.id, g]),
);

export function evaluateGoalForCharacter(
  goal: AndroidGoalDef,
  char: { race: AndroidRace; land: AndroidLand; level: number; state: AndroidHeroState },
): { status: AndroidGoalStatus; progressText: string } {
  if (char.state.completedQuests[goal.id]) {
    return { status: "claimed", progressText: "Ukończone ✓" };
  }
  if (goal.race !== char.race) {
    return { status: "locked", progressText: "Cel innej rasy" };
  }
  if (goal.prereqId && !char.state.completedQuests[goal.prereqId]) {
    return { status: "locked", progressText: `Wymaga ukończenia ${goal.prereqId}` };
  }
  if (char.level < goal.minLevel) {
    return {
      status: "locked",
      progressText: `Wymagany poziom ${goal.minLevel} (masz ${char.level})`,
    };
  }

  if (goal.kind === "heritage") {
    return { status: "ready", progressText: "Gotowe do ukończenia i odbioru nagrody!" };
  }

  const prog = char.state.progress ?? {
    visitedLands: [char.land],
    craftedCount: 0,
    arenaCount: 0,
    shopCount: 0,
  };
  const suffix = goal.id.slice(-2);
  const equippedCount = Object.values(char.state.equipment).filter(Boolean).length;
  const totalBonus = Object.values(char.state.bonusStats).reduce((a, b) => a + b, 0);
  const bankItemCount = char.state.bankItems.filter(Boolean).length;
  const npcQuestCount = Object.keys(char.state.completedQuests).filter((k) =>
    k.startsWith("npc:"),
  ).length;

  switch (suffix) {
    case "01": {
      const done = prog.shopCount >= 1 || npcQuestCount >= 1;
      return done
        ? { status: "ready", progressText: "Warunek spełniony — odbierz nagrodę!" }
        : {
            status: "in_progress",
            progressText: `Zakupy: ${prog.shopCount}/1 lub Zlecenia NPC: ${npcQuestCount}/1`,
          };
    }
    case "02": {
      const done = prog.craftedCount >= 1 || equippedCount >= 1;
      return done
        ? { status: "ready", progressText: "Warunek spełniony — odbierz nagrodę!" }
        : {
            status: "in_progress",
            progressText: `Wykute: ${prog.craftedCount}/1 lub Założone: ${equippedCount}/1`,
          };
    }
    case "03": {
      const nodes = char.state.unlockedNodes.length;
      const done = nodes >= 2 && totalBonus >= 1;
      return done
        ? { status: "ready", progressText: "Warunek spełniony — odbierz nagrodę!" }
        : {
            status: "in_progress",
            progressText: `Talenty: ${nodes}/2 • Przydzielone statystyki: ${totalBonus}/1`,
          };
    }
    case "04": {
      const done = prog.arenaCount >= 1;
      return done
        ? { status: "ready", progressText: "Warunek spełniony — odbierz nagrodę!" }
        : { status: "in_progress", progressText: `Treningi na arenie: ${prog.arenaCount}/1` };
    }
    case "05": {
      const done = char.state.bankGold > 0 || bankItemCount >= 1;
      return done
        ? { status: "ready", progressText: "Warunek spełniony — odbierz nagrodę!" }
        : {
            status: "in_progress",
            progressText: `Bank: ${char.state.bankGold} zł, ${bankItemCount} przedmiotów`,
          };
    }
    case "06": {
      const lands = new Set<string>([...prog.visitedLands, char.land]);
      const done = lands.size >= 2;
      return done
        ? {
            status: "ready",
            progressText: `Odwiedzono ${lands.size}/2 kontynenty — odbierz nagrodę!`,
          }
        : { status: "in_progress", progressText: `Odwiedzone kontynenty: ${lands.size}/2` };
    }
    default:
      return { status: "ready", progressText: "Gotowe" };
  }
}

export function listGoalsForCharacter(char: {
  race: AndroidRace;
  land: AndroidLand;
  level: number;
  state: AndroidHeroState;
}): AndroidGoalProgressView[] {
  return ANDROID_GOALS_CATALOG.filter((g) => g.race === char.race).map((g) => ({
    ...g,
    ...evaluateGoalForCharacter(g, char),
  }));
}
