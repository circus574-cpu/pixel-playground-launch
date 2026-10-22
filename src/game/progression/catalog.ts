import { RACE_IDS, type RaceId } from "../world/races";

export type Branch = "A" | "B" | "C";
export type NodeKind = "root" | "active" | "passive" | "choice" | "ultimate" | "form";
export type SkillNode = {
  id: string;
  race: RaceId;
  code: string;
  name: string;
  kind: NodeKind;
  level: number;
  requires: string[];
  excludes: string | null;
  description: string;
  cost: number;
  cooldown: number;
};
export const BRANCHES: Record<RaceId, [string, string, string]> = {
  planetary: ["Szlak Wędrowca", "Żywa Ziemia", "Pieśń Korzeni"],
  sage: ["Pieczęcie", "Kręgi i Bariery", "Skupienie"],
  android: ["Systemy Celownicze", "Pancerz i Tarcze", "Rdzeń"],
  legend: ["Ogień Walki", "Żelazna Wola", "Wybuch KI"],
};
export const ROLES: Record<RaceId, string> = {
  planetary: "Mobilny wojownik · adaptacja do terenu",
  sage: "Mag dystansowy · kontrola i wsparcie",
  android: "Precyzyjny strzelec · Ładunek Rdzenia",
  legend: "Wojownik w zwarciu · Żar i kombinacje",
};
type Row = [string, string, string, number?, number?];
// Literal transcription of the 22.10.2026 annex. Undefined mechanical details
// are resolved explicitly in docs/RACE-PROGRESSION.md, never by animation code.
const rows: Record<RaceId, Row[]> = {
  planetary: [
    ["R", "Cios Szlaku", "Atak wręcz ×1,0 co 650 ms. Trzeci cios serii ×1,3. Bez kosztu Ki."],
    ["A1", "Szybki Unik", "Zryw 160 j. w kierunku ruchu; nietykalność przez 0,4 s.", 8, 6],
    ["A2", "Lekki Krok", "+6% szybkości ruchu."],
    ["A3", "Pęd Szlaku", "Po uniku następny atak zadaje +25% obrażeń; okno 5 s."],
    ["A4", "Wir Energii", "Atak wokół postaci ×1,8, promień 140 j.", 18, 10],
    ["A5", "Wiatr w Plecy", "Po pokonaniu wroga +15% szybkości przez 4 s."],
    ["A6", "Oko Zwiadowcy", "+5 punktów procentowych szansy krytyku."],
    ["A7", "Cios z Cienia", "Pierwszy atak po uniku zawsze krytyczny. Wyklucza Nieuchwytnego."],
    [
      "A8",
      "Nieuchwytny",
      "Odnowienie Uniku −30%; po uniku +20% obrony przez 1 s. Wyklucza Cios z Cienia.",
    ],
    ["A9", "Burza Wędrowca", "Pięć szybkich uderzeń w pobliskich wrogów, łącznie ×4,0.", 35, 30],
    ["B1", "Impuls Ziemi", "Obszarowo ×1,4, promień 120 j.; spowolnienie 30% przez 2 s.", 10, 6],
    ["B2", "Adaptacja", "Las: regeneracja Ki +30%. Skały: obrona +10%. Woda: szybkość +8%."],
    ["B3", "Kamienna Skóra", "+8% obrony."],
    ["B4", "Kruszący Stąp", "Skok i uderzenie ×2,0; ogłuszenie 1 s.", 18, 10],
    ["B5", "Rezonans", "Impuls Ziemi uderza ponownie po 0,5 s za 60% obrażeń."],
    ["B6", "Żyła Ziemi", "Impuls zwraca 5 Ki za trafionego wroga, maksymalnie 15 na użycie."],
    ["B7", "Głaz Strażnik", "Kruszący Stąp daje osłonę 15% maks. HP na 5 s. Wyklucza Trzęsienie."],
    ["B8", "Trzęsienie", "Impuls: promień +40% i ogłuszenie 0,5 s. Wyklucza Głaz Strażnik."],
    ["B9", "Gniew Doliny", "Uderzenie obszarowe ×4,0; ogłuszenie 1,5 s.", 35, 30],
    ["C1", "Korzenny Oddech", "Leczy 12% maks. HP w ciągu 4 s.", 12, 12],
    ["C2", "Zielona Krew", "+10% maksymalnego życia."],
    ["C3", "Leśna Cierpliwość", "Poza walką regeneruje 1% maks. HP na sekundę."],
    ["C4", "Tarcza Liści", "Osłona pochłaniająca 18% maks. HP przez 5 s.", 18, 12],
    ["C5", "Korzenie Odporności", "Czas kontroli na postaci −25%."],
    ["C6", "Ziarno Życia", "Leczenie Korzennego Oddechu +30%."],
    ["C7", "Strażnik Gaju", "Tarcza Liści odbija 20% obrażeń wręcz. Wyklucza Dar Lasu."],
    ["C8", "Dar Lasu", "Korzenny Oddech po zakończeniu zwraca 15 Ki. Wyklucza Strażnika Gaju."],
    ["C9", "Pieśń Korzeni", "Leczy 40% maks. HP i daje osłonę 20% na 6 s.", 35, 45],
    ["T", "Forma Rezonansu Świata", "20 s: +20% Ataku, +15% Obrony, +10% szybkości.", 50, 120],
  ],
  sage: [
    ["R", "Pocisk Ki", "Pocisk ×1,0 co 800 ms; zasięg 420 j. Bez kosztu Ki."],
    ["A1", "Pieczęć Energii", "Znak na celu wybucha po 3 s za ×2,0.", 12, 8],
    ["A2", "Znak Wiedzy", "Wrogowie z pieczęcią przyjmują +10% obrażeń."],
    ["A3", "Szybka Pieczęć", "Odnowienie Pieczęci −20%."],
    [
      "A4",
      "Strumień Ki",
      "Kanałowany promień przez 3 s; sześć trafień co 0,5 s, łącznie ×2,4.",
      20,
      12,
    ],
    ["A5", "Echo Pieczęci", "Wybuch rani pobliskich wrogów za 50% obrażeń."],
    ["A6", "Precyzja Mędrca", "+8 punktów procentowych szansy krytyku."],
    [
      "A7",
      "Złoty Krąg",
      "Pieczęć tworzy krąg obrażeń o promieniu 120 j. Wyklucza Pieczęć Skupienia. Parametry kręgu są opisane w specyfikacji prototypu.",
    ],
    ["A8", "Pieczęć Skupienia", "Wybuch Pieczęci po trafieniu zwraca 15 Ki. Wyklucza Złoty Krąg."],
    ["A9", "Sąd Światła", "Po 1,5 s słup światła w dużym obszarze ×4,2.", 35, 30],
    ["B1", "Świetlista Bariera", "Osłona 15% maks. HP na 4 s.", 12, 10],
    ["B2", "Kontrola Kręgu", "Zdolności tworzą na 5 s krąg: +10% obrony w jego obrębie."],
    ["B3", "Gęste Światło", "Bariera trwa o 2 s dłużej."],
    ["B4", "Krąg Spowolnienia", "Krąg na 5 s: szybkość wrogów −40%.", 18, 12],
    ["B5", "Odbicie", "Bariera odbija 15% obrażeń z pocisków."],
    ["B6", "Strażnik Kręgu", "Wrogowie w kręgach zadają −10% obrażeń."],
    ["B7", "Kopuła", "Pojemność Bariery +30%. Wyklucza Lustro."],
    ["B8", "Lustro", "Bariera odbija pierwszy atak w całości. Wyklucza Kopułę."],
    [
      "B9",
      "Świątynia Światła",
      "Krąg na 8 s: +30% obrony postaci, wrogowie −30% szybkości.",
      35,
      40,
    ],
    [
      "C1",
      "Skupienie KI",
      "Kanałowanie 3 s: odnawia 30% maks. Ki. Ruch lub trafienie przerywa.",
      0,
      15,
    ],
    ["C2", "Głęboki Oddech", "+15% maks. Ki."],
    ["C3", "Mądrość Strażników", "Koszty zdolności −8%."],
    ["C4", "Medytacja Bojowa", "Kanałowanie 3 s: leczy 20% maks. HP.", 10, 15],
    ["C5", "Czysty Umysł", "Czas kontroli na postaci −25%."],
    ["C6", "Strumień Wiedzy", "Po ukończeniu Skupienia następna zdolność +25% obrażeń przez 6 s."],
    ["C7", "Dar Mędrca", "Medytacja leczy o 50% więcej. Wyklucza Skupienie Mistrza."],
    ["C8", "Skupienie Mistrza", "Skupienie KI nie jest przerywane ruchem. Wyklucza Dar Mędrca."],
    ["C9", "Pełnia Skupienia", "8 s: zdolności nie kosztują Ki i zadają +30% obrażeń.", 20, 60],
    ["T", "Forma Oświecenia", "20 s: +25% Ataku, odnowienia −30%, +15% Obrony.", 50, 120],
  ],
  android: [
    [
      "R",
      "Strzał Impulsowy",
      "Strzał ×1,0 co 700 ms, zasięg 360 j.; +4 Ładunku. Limit 100, przegrzanie 2 s. Po przerwie Ładunek opada 6/s.",
    ],
    [
      "A1",
      "Namierzanie",
      "Oznacza cel na 6 s: +15 punktów procentowych szansy krytyku przeciw niemu.",
      8,
      8,
    ],
    ["A2", "Kalibracja", "+6 punktów procentowych szansy krytyku."],
    ["A3", "Stabilizatory", "Zasięg strzałów +15%."],
    ["A4", "Salwa Precyzyjna", "Trzy strzały w oznaczony cel, łącznie ×2,2.", 18, 10],
    ["A5", "Analiza Słabości", "Oznaczeni wrogowie mają −10% obrony."],
    ["A6", "Szybkie Przeładowanie", "Odstęp strzałów −8%."],
    ["A7", "Snajper", "+40% obrażeń przeciw oznaczonym; odstęp strzałów +10%. Wyklucza Rój."],
    [
      "A8",
      "Rój",
      "Strzał trafia dwa dodatkowe pobliskie cele za 40% obrażeń każdy. Wyklucza Snajpera.",
    ],
    [
      "A9",
      "Protokół Egzekucji",
      "Strzał ×4,0 w oznaczony cel; ×6,0 gdy cel ma mniej niż 30% HP.",
      35,
      30,
    ],
    ["B1", "Tarcza Plazmowa", "Osłona 18% maks. HP na 5 s.", 12, 10],
    ["B2", "Płyty Pancerne", "+8% obrony."],
    ["B3", "Generator Tarczy", "Pojemność Tarczy +25%."],
    [
      "B4",
      "Impuls Odpychający",
      "Fala ×1,2; odpycha pobliskich wrogów i ogłusza na 0,5 s.",
      18,
      12,
    ],
    ["B5", "Protokół Adaptacji", "Tarcza odbija 25% obrażeń z pocisków."],
    ["B6", "Samonaprawa", "Regeneracja 0,5% maks. HP na sekundę."],
    ["B7", "Tarcza Kolcowa", "Tarcza odbija 30% obrażeń wręcz. Wyklucza Tarczę Modułową."],
    ["B8", "Tarcza Modułowa", "Odnowienie Tarczy −35%. Wyklucza Tarczę Kolcową."],
    ["B9", "Fortyfikacja", "6 s: +60% obrony i odporność na kontrolę.", 35, 40],
    [
      "C1",
      "Wyładowanie Rdzenia",
      "Zużywa Ładunek: obrażenia w linii ×(1 + Ładunek/50), do ×3 przy 100.",
      15,
      8,
    ],
    ["C2", "Zarządzanie Rdzeniem", "Przegrzanie 1 s; Ładunek opada o 50% szybciej."],
    ["C3", "Radiatory", "Strzał dodaje o 15% mniej Ładunku."],
    ["C4", "Rozładowanie Awaryjne", "Zeruje Ładunek i leczy 10% maks. HP.", 0, 20],
    ["C5", "Rezerwowy Akumulator", "+12% maks. Ki."],
    ["C6", "Optymalizacja", "Koszt Wyładowania −20%."],
    ["C7", "Przeciążony Rdzeń", "Limit Ładunku 150; Wyładowanie do ×4. Wyklucza Stabilny Rdzeń."],
    ["C8", "Stabilny Rdzeń", "Brak przegrzania; limit Ładunku 70. Wyklucza Przeciążony Rdzeń."],
    [
      "C9",
      "Przeciążenie Systemu",
      "6 s: darmowe zdolności i +40% obrażeń; potem 2 s bez akcji.",
      35,
      45,
    ],
    [
      "T",
      "Forma Pełnego Rdzenia",
      "20 s: +25% Ataku, +15% Obrony, przegrzanie wyłączone.",
      50,
      120,
    ],
  ],
  legend: [
    [
      "R",
      "Uderzenie Żaru",
      "Cios ×1,0 co 750 ms; trafienie daje 4 Żaru. Każdy punkt +0,1% obrażeń, limit 100. Poza walką −5/s.",
    ],
    ["A1", "Ogniste Cięcie", "Trzy cięcia, łącznie ×1,8.", 10, 6],
    ["A2", "Rozgrzane Ostrza", "Cięcie podpala na 3 s za łącznie 30% Ataku."],
    ["A3", "Łańcuch Ciosów", "Po trzech trafieniach odstęp ataków −10% na 4 s."],
    ["A4", "Szarża Płomienia", "Doskok do 200 j. i cięcie ×2,2.", 18, 10],
    ["A5", "Rozżarzone Pięści", "+8% Ataku."],
    ["A6", "Okrucieństwo", "+6 punktów procentowych szansy krytyku."],
    ["A7", "Taniec Płomieni", "Ogniste Cięcie: pięć cięć, łącznie ×2,6. Wyklucza Pojedynkowicza."],
    [
      "A8",
      "Pojedynkowicz",
      "+25% obrażeń, gdy w promieniu 200 j. jest tylko jeden wróg. Wyklucza Taniec Płomieni.",
    ],
    ["A9", "Tysiąc Cięć", "Osiem cięć, łącznie ×4,2.", 35, 30],
    ["B1", "Przełamanie", "Cios ×1,5, ogłuszenie 1,2 s i zniszczenie osłony celu.", 12, 8],
    ["B2", "Hartowana Skóra", "+8% obrony."],
    ["B3", "Honor Wojownika", "+10% maks. HP."],
    ["B4", "Płomienny Szał", "8 s: +30% Ataku i −20% obrony.", 18, 25],
    ["B5", "Żelazna Wola", "W Szale odporność na ogłuszenie."],
    ["B6", "Krew Legendy", "Pokonanie wroga leczy 3% maks. HP."],
    [
      "B7",
      "Wściekłość",
      "Szał trwa o 4 s dłużej i daje dodatkowe +10% Ataku. Wyklucza Kontrolowany Żar.",
    ],
    ["B8", "Kontrolowany Żar", "Szał nie obniża obrony. Wyklucza Wściekłość."],
    [
      "B9",
      "Ostatni Płomień",
      "Przez 5 s pierwszy śmiertelny cios pozostawia 1 HP i leczy 30% maks. HP.",
      35,
      90,
    ],
    ["C1", "Wybuch Ki", "Wybuch wokół postaci ×1,8, promień 150 j.", 15, 8],
    ["C2", "Żar", "Żar rośnie o 50% szybciej i opada dwa razy wolniej."],
    ["C3", "Ognisty Oddech", "Wybuch Ki podpala na 4 s za łącznie 40% Ataku."],
    ["C4", "Eksplozja Żaru", "Zużywa Żar: obszarowo ×(1 + Żar/50), do ×3 przy 100.", 20, 12],
    ["C5", "Szybkie Rozżarzenie", "Nowa walka zaczyna się z co najmniej 20 Żaru."],
    ["C6", "Nieugaszony", "Przy 100 Żaru regeneracja Ki +50%."],
    ["C7", "Wulkan", "Promień Eksplozji +50%. Wyklucza Detonatora."],
    ["C8", "Detonator", "Eksplozja +25% obrażeń, promień −20%. Wyklucza Wulkan."],
    [
      "C9",
      "Ognisty Kataklizm",
      "Obszarowo ×4,5 i podpalenie na 5 s. Parametry podpalenia opisuje specyfikacja prototypu.",
      35,
      30,
    ],
    ["T", "Forma Płomiennego Legendy", "20 s: +30% Ataku, Żar utrzymywany na 100.", 50, 120],
  ],
};
export const skillId = (race: RaceId, code: string) => `${race}.${code}`;
function node(race: RaceId, [code, name, description, cost = 0, seconds = 0]: Row): SkillNode {
  const n = Number(code.slice(1)),
    b = code[0]!;
  const kind: NodeKind =
    code === "R"
      ? "root"
      : code === "T"
        ? "form"
        : n === 9
          ? "ultimate"
          : n === 7 || n === 8
            ? "choice"
            : n === 1 || n === 4
              ? "active"
              : "passive";
  const requirements =
    code === "R"
      ? []
      : code === "T"
        ? ["A9", "B9", "C9"]
        : n === 1
          ? ["R"]
          : n === 2 || n === 3
            ? [b + "1"]
            : n === 4
              ? [b + "2", b + "3"]
              : n === 5 || n === 6
                ? [b + "4"]
                : n === 7
                  ? [b + "5"]
                  : n === 8
                    ? [b + "6"]
                    : [b + "7", b + "8"];
  return {
    id: skillId(race, code),
    race,
    code,
    name,
    description,
    cost,
    cooldown: seconds * 1000,
    kind,
    level: code === "R" ? 1 : code === "T" ? 20 : [0, 2, 4, 4, 7, 10, 10, 13, 13, 16][n]!,
    requires: requirements.map((c) => skillId(race, c)),
    excludes: n === 7 ? skillId(race, b + "8") : n === 8 ? skillId(race, b + "7") : null,
  };
}
export const TREES = Object.fromEntries(
  RACE_IDS.map((r) => [r, rows[r].map((row) => node(r, row))]),
) as Record<RaceId, SkillNode[]>;
export const NODES = Object.fromEntries(
  Object.values(TREES)
    .flat()
    .map((n) => [n.id, n]),
);
export const isCastable = (n: SkillNode) => ["active", "ultimate", "form"].includes(n.kind);
