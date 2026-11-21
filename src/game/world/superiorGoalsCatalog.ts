export type GoalRace = "legend" | "planetary" | "sage" | "android";
export type GoalKind = "heritage" | "development" | "adventure";

export type AndroidGoalDef = {
  id: string;
  race: GoalRace;
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

const HERITAGE_XP = [100, 160, 240, 360, 520, 720] as const;
const HERITAGE_GOLD = [30, 40, 60, 80, 100, 140] as const;
const HERITAGE_LEVELS = [1, 4, 7, 10, 14, 18] as const;

type ChapterSeed = {
  race: GoalRace;
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

    const advs: Omit<AndroidGoalDef, "race" | "kind" | "mentor">[] = [
      {
        id: `A-${p}01`,
        order: 1,
        title: "Łowca Kontynentu (5 potworów)",
        summary:
          "Wyjdź poza bezpieczną stolicę i pokonaj 5 dzikich potworów na szlakach kontynentu.",
        requirementText: "Pokonaj 5 potworów w terenie",
        minLevel: 1,
        xpReward: 140,
        goldReward: 120,
      },
      {
        id: `A-${p}02`,
        order: 2,
        title: "Poszukiwacz Ukrytych Skarbów (3 skarby)",
        summary: "Odkryj i otwórz co najmniej 3 ukryte skarby na kontynentach lub w labiryntach.",
        requirementText: "Otwórz co najmniej 3 ukryte skarby",
        minLevel: 1,
        xpReward: 180,
        goldReward: 160,
        statPointsReward: 1,
      },
      {
        id: `A-${p}03`,
        order: 3,
        title: "Zdobywca Labiryntu (4/4 skrzynie)",
        summary:
          "Wejdź do dowolnego labiryntu na kontynencie i odnajdź wszystkie 4 ukryte skrzynie.",
        requirementText: "Ukończ co najmniej 1 labirynt (4/4 skrzynie)",
        minLevel: 4,
        xpReward: 280,
        goldReward: 240,
        skillPointsReward: 1,
      },
      {
        id: `A-${p}04`,
        order: 4,
        title: "Mistrz Wypraw i Podziemi",
        summary: "Ukończ 2 labirynty, otwórz 10 ukrytych skarbów i pokonaj 20 potworów.",
        requirementText: "2 labirynty • 10 skarbów • 20 pokonanych potworów",
        minLevel: 8,
        xpReward: 520,
        goldReward: 420,
        statPointsReward: 2,
        skillPointsReward: 1,
      },
    ];
    for (const a of advs) {
      out.push({ ...a, race: seed.race, kind: "adventure", mentor: seed.mentor });
    }
  }
  return out;
}

export const ANDROID_GOALS_CATALOG: readonly AndroidGoalDef[] = buildCatalog();
export const ANDROID_GOALS_MAP = new Map<string, AndroidGoalDef>(
  ANDROID_GOALS_CATALOG.map((g) => [g.id, g]),
);
