import { RACES, type RaceId } from "../../world/races";
import {
  answer,
  talk,
  inspect,
  solve,
  recover,
  craft,
  consent,
  completedProjects,
  escort,
  protect,
  restraint,
  nameWeapon,
} from "./goals";
import {
  CHAPTERS,
  questId,
  projectId,
  type ChapterNumber,
  type HeritageGoal,
  type HeritageQuestDefinition,
  type ProjectEffect,
  type WorldProjectDefinition,
  type Site,
  type StoryChoice,
} from "./types";

const XP = [100, 160, 240, 360, 520, 720] as const;
const GOLD = [30, 40, 60, 80, 100, 140] as const;
const PRACTICE = [150, 200, 250, 300, 350, 450] as const;
const LEVELS: [number, number][] = [
  [1, 5],
  [6, 10],
  [11, 15],
  [16, 20],
  [21, 30],
  [31, 40],
];
export const MENTORS: Record<RaceId, string> = {
  planetary: "Aira",
  sage: "Sora",
  android: "LYRA-7",
  legend: "Kaena",
};
export const SMITHS: Record<RaceId, string> = {
  planetary: "Taro",
  sage: "Enso",
  android: "HEF-4",
  legend: "Goro",
};
const response = (text: string) => [
  answer("record", "Zapiszę świadectwo bez dopisywania brakujących faktów.", text),
  answer(
    "verify",
    "Sprawdzę źródło i wrócę z porównaniem.",
    "Dobrze. Świadectwo ma podpis, ale podpis nie czyni interpretacji bezbłędną. Nie gub oryginału, gdy sporządzisz kopię.",
  ),
];
const mentor = (race: RaceId, id: string, lines: string[]) =>
  talk(
    id,
    "Porozmawiaj: " + MENTORS[race],
    "mentor",
    MENTORS[race],
    lines,
    response(
      "Możesz przytoczyć moje słowa. Zapisz również pytanie, na które jeszcze nie znam odpowiedzi.",
    ),
    "guide",
  );
const smith = (race: RaceId, id: string, lines: string[]) =>
  talk(
    id,
    "Pracuj z kowalem: " + SMITHS[race],
    "smith",
    SMITHS[race],
    lines,
    response(
      "Narzędzie zachowa ślad poprzedniego właściciela. Nowy podpis dopiszemy obok, a nie zamiast niego.",
    ),
    "smith",
  );
const witness = (id: string, label: string, site: Site, names: string[], lines: string[]) =>
  talk(
    id,
    label,
    site,
    names[0]!,
    lines,
    response("Zachowaj rozdział między tym, co widziałem, a tym, czego domyślam się po latach."),
    undefined,
    names,
  );
function comparison(
  id: string,
  label: string,
  site: Site,
  facts: { title: string; text: string }[],
  correct: string,
  wrong: string[],
  count = 1,
): HeritageGoal {
  return solve(
    id,
    label,
    site,
    facts,
    Array.from({ length: count }, (_, i) => ({
      prompt: count > 1 ? `${label} — zapis ${i + 1}` : label,
      options: [
        answer(
          "supported",
          correct,
          "Wniosek wynika z zachowanych źródeł. Nie dopisano brakującego świadectwa.",
        ),
        ...wrong.map((text, n) =>
          answer(
            "unsupported-" + n,
            text,
            "To stwierdzenie nie wynika z dostępnych źródeł. Porównaj podpisy, kolejność i oznaczone luki.",
          ),
        ),
      ],
      answerId: "supported",
    })),
  );
}
const choice = (id: string, label: string, chronicle: string): StoryChoice => ({
  id,
  label,
  reply: chronicle,
  chronicle,
});
function chapter(
  race: RaceId,
  n: ChapterNumber,
  name: string,
  introduction: string,
  goals: HeritageGoal[],
  choices: StoryChoice[],
): HeritageQuestDefinition {
  const forgeMaterial = questId(race, n) + ":forge-part";
  const supplied = [2, 3, 5].includes(n)
    ? [
        recover(
          questId(race, n) + ":forge-supplies",
          "Odbierz przygotowany zestaw kowalski",
          "smith",
          forgeMaterial,
          "Zestaw do pracy nad własną bronią",
          1,
        ),
      ]
    : [];
  return {
    id: questId(race, n),
    version: 1,
    race,
    world: RACES[race].world,
    chapter: n,
    name,
    introduction,
    recommendedLevel: LEVELS[n - 1]!,
    prerequisite: n === 1 ? null : questId(race, (n - 1) as ChapterNumber),
    goals:
      n === 4
        ? goals
        : [
            ...goals,
            ...supplied,
            {
              id: questId(race, n) + ":forge",
              label: [
                "Sprawdź odziedziczone narzędzie",
                "Napraw oprawę broni",
                "Zestrój broń z zachowanym wzorcem",
                "Nadaj nazwę broni",
                "Zahartuj lub skalibruj broń",
                "Zapisz historię sześciu etapów",
              ][n - 1]!,
              site: "smith",
              documents: [],
              kind: "forge",
              recipe: supplied.length ? [{ material: forgeMaterial, quantity: 1 }] : [],
              stage: n,
              operation: (
                {
                  1: "inspect",
                  2: "repair",
                  3: "tune",
                  4: "tune",
                  5: "temper",
                  6: "inherit",
                } as const
              )[n],
            },
          ],
    choices,
    reward: { xp: XP[n - 1]!, gold: GOLD[n - 1]!, practice: PRACTICE[n - 1]! },
    weaponStage: n,
  };
}

const planetary: HeritageQuestDefinition[] = [
  chapter(
    "planetary",
    1,
    "Mapa zatopionych domów",
    "Rodzinny znacznik drogi nie pasuje do mapy przechowywanej w osadzie. Aira proponuje zacząć od konkretnych domów, zamiast od oskarżenia.",
    [
      mentor("planetary", "H-V01:aira", [
        "Ten znak odnaleziono przy skrzyni twojej rodziny. Na naszej mapie w tym miejscu jest pusta dolina.",
        "Nie nazywajmy jeszcze tej różnicy kłamstwem. Odwiedź trzy zachowane znaki domów i porównaj kierunek ich wejść. Rodziny mają prawo pierwsze usłyszeć, co znaleziono.",
      ]),
      inspect(
        "H-V01:chest",
        "Zbadaj rodzinną skrzynię",
        "memorial",
        ["Rodzinna skrzynia"],
        [
          "Pod podwójnym dnem leży znacznik z trzema nacięciami. Wyschnięty muł zachował ślad wody; skrzynia nie stała na tym brzegu od zawsze.",
        ],
      ),
      inspect(
        "H-V01:homes",
        "Odczytaj trzy różne znaki domów",
        "river",
        ["Znak domu nad nurtem", "Znak domu przy wierzbie", "Znak domu pod skałą"],
        [
          "Strzałka oznacza wejście zwrócone ku dawnemu nurtowi.",
          "Wycięcie odpowiada temu samemu brzegowi, choć obecna rzeka płynie inaczej.",
          "Trzy nacięcia powtarzają znak rodzinnej skrzyni, bez imienia właściciela.",
        ],
      ),
      comparison(
        "H-V01:map",
        "Porównaj ślady z mapą",
        "archive",
        [
          {
            title: "Mapa osady",
            text: "Mapa pomija trzy domy. Wszystkie zachowane wejścia zwrócono ku dawnemu nurtowi.",
          },
          {
            title: "Znacznik rodziny",
            text: "Trzy nacięcia odpowiadają jednemu ze znaków, lecz nie wskazują osoby odpowiedzialnej za zmianę mapy.",
          },
        ],
        "Mapa nie obejmuje trzech potwierdzonych domów.",
        ["Znamy już autora usunięcia domów.", "Domy nigdy nie istniały."],
      ),
      smith("planetary", "H-V01:smith", [
        "Znacznik był narzędziem wędrowca. Sprawdzę jego pęknięcie i osadzę go w uchwycie, który zniesie podróż.",
        "Nie odtworzę nieznanego imienia na podstawie samego kształtu. Zachowamy znak jako pytanie, nie jako zmyśloną odpowiedź.",
      ]),
      mentor("planetary", "H-V01:return", [
        "Trzy domy mamy potwierdzone, osoby odpowiedzialnej jeszcze nie. Teraz zdecyduj, komu najpierw pokażemy mapę.",
        "Każda z tych dróg zachowa dowody. Różnić będzie się kolejność rozmów, nie twoja nagroda.",
      ]),
    ],
    [
      choice(
        "public-map",
        "Od razu pokaż mapę wspólnocie.",
        "Mapa otrzymała jawny wykaz luk. Rodziny zaproszono do dopisania własnych świadectw.",
      ),
      choice(
        "families-first",
        "Najpierw porozmawiaj z rodzinami.",
        "Rodziny zobaczyły ślady jako pierwsze. Wspólna mapa zachowała ich uwagi i granice zgody.",
      ),
    ],
  ),
  chapter(
    "planetary",
    2,
    "Rzeka, która zawróciła",
    "Dwie osady obawiają się, że naprawa nurtu odbierze wodę drugiemu brzegowi. Zbadaj oba przepusty i przygotuj wspólną drogę dostawy.",
    [
      inspect(
        "H-V02:culverts",
        "Zbadaj oba przepusty",
        "river",
        ["Przepust górny", "Przepust dolny"],
        [
          "Kamienie blokują boczny kanał. Znacznik otwarcia znajduje się od strony doliny.",
          "Kanał jest drożny, ale zasuwę zatrzymał uszkodzony uchwyt. Samo otwarcie górnej zasuwy ominęłoby ten brzeg.",
        ],
      ),
      witness(
        "H-V02:villages",
        "Wysłuchaj obu osad",
        "market",
        ["Opiekunka górnego brzegu", "Przewoźnik dolnego brzegu"],
        [
          "Górna osada potrzebuje wody do ogrodu. Dolna nie może stracić przeprawy podczas naprawy.",
          "Przygotuj obejście, zanim zamkniesz którykolwiek kanał. Kolejność robót nie jest zgodą na porzucenie sąsiada.",
        ],
      ),
      comparison(
        "H-V02:bypass",
        "Wyznacz bezpieczną kolejność obejścia",
        "gate",
        [
          {
            title: "Stan kanałów",
            text: "Dolny uchwyt wymaga naprawy. Obie osady potrzebują dostawy, a obejście należy zabezpieczyć przed zamknięciem kanału.",
          },
        ],
        "Najpierw zabezpiecz obejście, potem napraw uchwyt i otwieraj kanały stopniowo.",
        [
          "Najpierw odetnij całą wodę dolnej osadzie.",
          "Otwórz wyłącznie górną zasuwę i zakończ pracę.",
        ],
      ),
      completedProjects("H-V02:project", ["P-V1"]),
      escort("H-V02:delivery", "Wózek z dostawą dla drugiego brzegu", 2, false),
      smith("planetary", "H-V02:repair", [
        "Odzyskany znacznik ma już pewne mocowanie. Naprawię teraz jego krawędź i zachowam nacięcia.",
        "Oba brzegi otrzymały dostawę. Znak ma przypominać o tej drugiej drodze, którą łatwo byłoby pominąć.",
      ]),
    ],
    [
      choice(
        "upper-first",
        "Zacznij roboty od górnego brzegu; drugiemu zapewnij dostawę.",
        "Naprawę rozpoczęto wyżej. Dolny brzeg otrzymał gwarantowaną dostawę i wspólny zapis ustaleń.",
      ),
      choice(
        "lower-first",
        "Zacznij od dolnego uchwytu; drugiemu zapewnij dostawę.",
        "Najpierw wróciła przeprawa. Górna osada otrzymała dostawę na czas prac i miejsce we wspólnej radzie.",
      ),
    ],
  ),
  chapter(
    "planetary",
    3,
    "Las nie rozpoznaje swoich",
    "Stare uprawnienia strażników nie zgadzają się z nowymi znakami. Nie przenoś tego sporu na posłańca, który próbuje wrócić do domu.",
    [
      inspect(
        "H-V03:markers",
        "Porównaj trzy znaczniki strażników",
        "garden",
        ["Znacznik gaju", "Znacznik starego traktu", "Znacznik przejścia"],
        [
          "Data wydania znaku jest starsza od ostatniej zmiany uprawnień.",
          "Nacięcie dodano później, ale bez podpisu osoby wydającej zgodę.",
          "Ten znak zachował podpis i datę. Pozwala porównać dwa pozostałe.",
        ],
      ),
      {
        id: "H-V03:observe",
        label: "Zaobserwuj żywego Strażnika Ruin",
        site: "trail",
        documents: [],
        kind: "observe",
        species: "verdant-straznik-ruin",
      },
      comparison(
        "H-V03:guardian",
        "Zdiagnozuj reakcję strażnika na znak",
        "archive",
        [
          {
            title: "Dziennik obserwacji Strażnika Ruin",
            text: "Strażnik reaguje na późniejsze, niepodpisane nacięcie; sam pierwotny znak nie wywołuje alarmu.",
          },
        ],
        "Sprawdź niepodpisane nacięcie, zachowując oryginał.",
        ["Zniszcz wszystkie stare znaki.", "Uznaj każdego nosiciela znaku za wroga."],
      ),
      restraint(
        "H-V03:false-mark",
        "Usuń fałszywe oznaczenie tylko w nieaktywnym oknie próby",
        1,
        false,
      ),
      escort("H-V03:messenger", "Posłaniec leśnych wspólnot", 3, true),
      completedProjects("H-V03:project", ["P-V2"]),
      smith("planetary", "H-V03:tune", [
        "Dopasuję znacznik do rytmu twojego kroku. Zachowane nacięcie przestanie ocierać o uchwyt.",
        "Nie jest to nowe pozwolenie na cudzą ziemię. Twoja broń ma pamiętać, że przejście wymaga rozmowy.",
      ]),
    ],
    [
      choice(
        "audit-permits",
        "Sprawdź dawne pozwolenia ze wspólnotami.",
        "Dawne pozwolenia pozostały czytelne, a każdą zmianę poddano wspólnej kontroli.",
      ),
      choice(
        "new-permits",
        "Utwórz nowy system zezwoleń z zachowaniem archiwum.",
        "Nowe pozwolenia wymagają podpisu obu stron. Stare znaki zachowano jako świadectwo, nie skasowano ich historii.",
      ),
    ],
  ),
  chapter(
    "planetary",
    4,
    "Pieśń bez ostatniej zwrotki",
    "Trzy rodziny pamiętają różne części pieśni. Brakująca zwrotka może pozostać luką, dopóki jej świadek nie wyrazi zgody.",
    [
      witness(
        "H-V04:families",
        "Wysłuchaj trzech rodzin",
        "market",
        ["Rodzina mostowych", "Rodzina ogrodników", "Rodzina dawnej straży"],
        [
          "Każda rodzina pamięta inną część powrotu. Nie wstawiaj ich głosów w kolejność, którą łatwiej byłoby śpiewać.",
          "Najpierw sprawdź miejsca zapisów. Potem zapytaj świadka, czy chce dodać ostatnią zwrotkę.",
        ],
      ),
      inspect(
        "H-V04:fragments",
        "Odnajdź trzy fragmenty pieśni",
        "memorial",
        ["Fragment przeprawy", "Fragment ogrodu", "Fragment powrotu"],
        [
          "Przeprawa poprzedzała otwarcie ogrodu.",
          "Ogród przygotowano przed powrotem rodzin.",
          "W tym zapisie po powrocie pozostawiono puste miejsce z dopiskiem: za zgodą świadka.",
        ],
      ),
      comparison(
        "H-V04:song",
        "Ułóż pieśń według źródeł",
        "archive",
        [
          {
            title: "Kolejność zapisów",
            text: "Przeprawa → ogród → powrót → luka zachowana do chwili uzyskania zgody.",
          },
        ],
        "Przeprawa, ogród, powrót; ostatnią lukę pozostaw oznaczoną.",
        [
          "Powrót nastąpił przed przygotowaniem przeprawy.",
          "Wymyśl ostatnią zwrotkę i podpisz ją imieniem świadka.",
        ],
        3,
      ),
      consent(
        "H-V04:guard",
        "Uzyskaj zgodę ocalałego strażnika",
        "memorial",
        ["Ocalały strażnik"],
        "Czy twoją ostatnią zwrotkę można zachować z imieniem, czy anonimowo?",
      ),
      completedProjects("H-V04:project", ["P-V3"]),
      nameWeapon("H-V04:name"),
    ],
    [
      choice(
        "public-song",
        "Za zgodą świadka wykonaj pieśń publicznie.",
        "Pieśń zabrzmiała ze zgodnie podpisaną zwrotką i jawnym oznaczeniem niepewnych słów.",
      ),
      choice(
        "protected-song",
        "Zachowaj prywatną zwrotkę, udostępniając jej istnienie.",
        "W publicznej pieśni pozostała oznaczona przerwa. Prywatne świadectwo ma opiekuna i nie zostało uznane za nieistniejące.",
      ),
    ],
  ),
  chapter(
    "planetary",
    5,
    "Korzenie pamiętają",
    "Trzy dowody pozwalają zapytać o cenę dawnego ratunku. Odpowiedzialność nie wymaga wystawienia świadków na niebezpieczeństwo.",
    [
      inspect(
        "H-V05:evidence",
        "Zbierz trzy niezależne dowody",
        "archive",
        ["Mapa sprzed zmiany nurtu", "Podpis zgody na przeprawę", "Zapis przesiedlenia"],
        [
          "Mapa potwierdza istnienie domów, lecz nie opisuje zgody mieszkańców.",
          "Podpis dotyczy budowy przeprawy, nie wszystkich późniejszych decyzji.",
          "Lista przesiedlonych potwierdza ratunek i koszt, którego nie opisano w publicznej kronice.",
        ],
      ),
      mentor("planetary", "H-V05:chronicle", [
        "Uczono mnie kroniki o samym ocaleniu. Nie umiem obronić tego, czego w niej zabrakło.",
        "Sto osiemdziesiąt lat nie odbiera rodzinom prawa do własnych głosów. Sprawdźmy, kto może mówić bez przymusu i bez narażania bliskich.",
      ]),
      escort("H-V05:witnesses", "Świadek w drodze na bezpieczne spotkanie", 3, true),
      consent(
        "H-V05:assembly",
        "Uzgodnij sposób udziału w zgromadzeniu",
        "market",
        ["Opiekunka świadectw", "Przedstawiciel rodzin"],
        "Czy rada może przytoczyć twoją relację z imieniem, czy powinna ją zanonimizować?",
      ),
      completedProjects("H-V05:project", ["P-V4"]),
      smith("planetary", "H-V05:temper", [
        "Zahartuję ostrze bez wypalania rodzinnego znaku. Najsilniejsza krawędź nie może przeciąć rozmowy, którą dopiero zaczynamy.",
        "Nowy ślad dopiszemy do historii napraw. Nikt nie uzna go za dowód, że dawny metal był bez winy.",
      ]),
    ],
    [
      choice(
        "repair-first",
        "Najpierw napraw skutki i chroń świadków.",
        "Zgromadzenie przyjęło harmonogram napraw. Materiał źródłowy pozostał dostępny w uzgodnionym zakresie.",
      ),
      choice(
        "shared-account",
        "Ogłoś wspólne stanowisko wraz z planem napraw.",
        "Wspólnota poznała prawdę i listę działań naprawczych. Imiona ujawniono wyłącznie zgodnie ze zgodą świadków.",
      ),
    ],
  ),
  chapter(
    "planetary",
    6,
    "Nowy szlak",
    "Szlak ma należeć do ludzi, którzy nim chodzą. Sprawdź go w praktyce, zanim podpiszesz nową mapę.",
    [
      completedProjects("H-V06:projects", ["P-V5", "P-V6"]),
      inspect(
        "H-V06:route",
        "Sprawdź trzy oznaczenia zewnętrznej trasy",
        "trail",
        ["Początek szlaku", "Miejsce odpoczynku", "Podejście do osady"],
        [
          "Początek ma czytelny znak powrotu.",
          "Miejsce odpoczynku nie blokuje przejścia innym wędrowcom.",
          "Ostatni znak pozwala dojść do bezpiecznej osady bez skrótu przez niedostępny teren.",
        ],
      ),
      escort("H-V06:convoy", "Konwój powracających rodzin", 3, true),
      mentor("planetary", "H-V06:map", [
        "Mapa nie kończy się na podpisie przewodnika. Każda wspólnota może wskazać błąd i poprosić o poprawę.",
        "Wybierz, kto będzie przechowywał kopie. Ta lokalna umowa nie rozwiązuje jeszcze wszystkich problemów Superior, ale pozwala ruszyć dalej własnym szlakiem.",
      ]),
      smith("planetary", "H-V06:inherit", [
        "Sześć śladów pracy pozostało na broni. Zapiszę ich historię wraz z nazwą, którą nadałeś.",
        "Dziedzictwo nie jest poleceniem dla następcy. Daj mu narzędzie i prawo, żeby wybrał inny szlak.",
      ]),
    ],
    [
      choice(
        "route-council",
        "Powierz mapę wspólnej radzie szlaków.",
        "Powstała rada z prawem zgłaszania poprawek przez każdą osadę. Kopie i świadectwa mają wskazanych opiekunów.",
      ),
      choice(
        "local-keepers",
        "Powierz kopie miejscowym opiekunom.",
        "Każda osada otrzymała własną kopię i jawny spis różnic. Nikt nie może poprawić całej historii jednym rozkazem.",
      ),
    ],
  ),
];

// The other cultures use the same objective engine, with their own evidence, people and consequences.
const sage: HeritageQuestDefinition[] = [
  chapter(
    "sage",
    1,
    "Biała strona",
    "Pieczęć na pustej stronie przechowała scenę, której nie opisuje kronika. Sora prosi o porównanie kopii, nie o dopisanie wygodnej odpowiedzi.",
    [
      mentor("sage", "H-A01:sora", [
        "Na białej stronie nie ma tekstu, lecz pieczęć nadal odpowiada. Rozpoznaję podpis archiwisty, nie rozpoznaję tej wersji wydarzeń.",
        "Porównaj dwie kopie, zanim wybierzesz pytanie do rady. Wersja pięknie oprawiona nie jest przez to bliższa prawdy.",
      ]),
      comparison(
        "H-A01:seal",
        "Porównaj zapis i scenę pieczęci",
        "archive",
        [
          {
            title: "Kronika",
            text: "Zapis mówi o pustym ogrodzie. Odtworzona pieczęć pokazuje przygotowane schronienie; nie podaje liczby mieszkańców.",
          },
        ],
        "Pieczęć potwierdza schronienie, lecz nie liczbę jego mieszkańców.",
        ["Pieczęć dowodzi, że nikt tam nie mieszkał.", "Znamy dokładną liczbę ocalałych."],
      ),
      inspect(
        "H-A01:copies",
        "Zbadaj dwie podpisane kopie",
        "archive",
        ["Kopia czytelni", "Kopia opiekuna ogrodu"],
        [
          "Kopia czytelni zachowała pustą stronę i datę wypożyczenia.",
          "Kopia ogrodu ma ten sam podpis, ale zawiera dopisek o schronieniu.",
        ],
      ),
      consent(
        "H-A01:testimony",
        "Zapisz pierwsze świadectwo",
        "garden",
        ["Opiekun starego ogrodu"],
        "Czy zachować twoje imię przy relacji o schronieniu?",
      ),
      smith("sage", "H-A01:staff", [
        "Ten kostur był narzędziem pomiaru źródła. Podpis archiwisty pozostawię widoczny.",
        "Sprawdzę rdzeń i osadzę oprawę. Od tej chwili możesz nim pracować, nie udając, że znasz całą historię jego właściciela.",
      ]),
    ],
    [
      choice(
        "author-first",
        "Najpierw skonsultuj zapis z autorem lub opiekunem jego źródeł.",
        "Świadectwo trafiło do opiekuna źródła przed wysłuchaniem rady; oryginały zachowano.",
      ),
      choice(
        "council-question",
        "Zadaj radzie jawne pytanie wraz z obiema kopiami.",
        "Rada otrzymała obie kopie i pytanie o rozbieżność. Żadnej nie usunięto jako niewygodnej.",
      ),
    ],
  ),
  chapter(
    "sage",
    2,
    "Źródło dwóch wspomnień",
    "Dwa wspomnienia opisują ten sam ratunek z różnych miejsc. Źródło ma je porównać, a nie połączyć ludzi w jeden głos.",
    [
      witness(
        "H-A02:accounts",
        "Zdobądź dwie odrębne relacje",
        "garden",
        ["Świadek przy bramie", "Świadek przy źródle"],
        [
          "Pamiętam otwarcie bramy i dźwięk dzwonu. Nie widziałem wnętrza ogrodu.",
          "Pamiętam ten sam dzwon i wejście rodzin do ogrodu. Nie wiem, kto stał na murze.",
        ],
      ),
      inspect(
        "H-A02:device",
        "Odtwórz obie relacje w urządzeniu",
        "workshop",
        ["Zapis bramy", "Zapis źródła"],
        [
          "Oba zapisy zawierają ten sam dźwięk dzwonu.",
          "Oba potwierdzają otwarcie bramy; różnią się miejscem obserwacji.",
        ],
      ),
      comparison(
        "H-A02:difference",
        "Wskaż dwie zgodności i jedną różnicę",
        "archive",
        [
          {
            title: "Porównanie relacji",
            text: "Wspólne: dźwięk dzwonu i otwarcie bramy. Różnica: miejsce obserwacji, mur albo ogród.",
          },
        ],
        "Wspólne są dzwon i otwarcie bramy; różni się punkt obserwacji.",
        [
          "Relacje mają jednego autora i jedno miejsce obserwacji.",
          "Każda różnica oznacza, że jeden świadek kłamie.",
        ],
        3,
      ),
      completedProjects("H-A02:project", ["P-A1"]),
      smith("sage", "H-A02:repair", [
        "Wzmocnię oprawę kostura. Nie będę stroił go do jednego głosu, skoro źródło ma pomieścić dwie relacje.",
        "Naprawa pozostawi widoczny styk starej i nowej części. Dzięki temu następca pozna granice rekonstrukcji.",
      ]),
    ],
    [
      choice(
        "separate-accounts",
        "Zachowaj obie relacje osobno.",
        "Źródło odtwarza dwa podpisane wspomnienia, nie nadpisując jednego drugim.",
      ),
      choice(
        "annotated-account",
        "Dodaj wspólny komentarz z przypisami.",
        "Powstał komentarz łączący zgodności, a obie odrębne relacje pozostały czytelne z własnymi podpisami.",
      ),
    ],
  ),
  chapter(
    "sage",
    3,
    "Archiwista bez imienia",
    "Podpis przetrwał tam, gdzie zatarto imię. Najpierw znajdź ślady pracy i zapytaj rodzinę o zgodę na list.",
    [
      inspect(
        "H-A03:signature",
        "Odnajdź zachowany podpis",
        "archive",
        ["Margines starej kopii"],
        ["Podpis zgadza się z kosturem. Obok zaznaczono trzy miejsca pracy archiwisty."],
      ),
      witness(
        "H-A03:relative",
        "Porozmawiaj z krewną archiwisty",
        "garden",
        ["Krewna archiwisty"],
        [
          "Nie zabieraj listu tylko dlatego, że otwarto czytelnię. Najpierw poszukaj jego publicznych prac.",
          "Dopiero potem zdecyduję, w jakiej formie można zachować prywatny głos rodziny.",
        ],
      ),
      inspect(
        "H-A03:work",
        "Sprawdź trzy ślady pracy",
        "archive",
        ["Pomiar źródła", "Rejestr schronienia", "Poprawiona mapa ogrodu"],
        [
          "Pomiar podaje granicę błędu zamiast sztucznej pewności.",
          "Rejestr odróżnia ratunek od zgody na późniejsze zmiany.",
          "Mapa zachowała warstwę starszą pod nowszym komentarzem.",
        ],
      ),
      consent(
        "H-A03:letter",
        "Uzyskaj zgodę na chroniony list",
        "memorial",
        ["Krewna archiwisty"],
        "Czy możemy odczytać list z imieniem, czy w chronionej kopii anonimowej?",
      ),
      completedProjects("H-A03:project", ["P-A2"]),
      smith("sage", "H-A03:tune", [
        "Zestroję kostur z dwoma zachowanymi pomiarami. Oznaczę zakres pewny i ten, który wymaga dalszych badań.",
        "Jego podpis nie zniknie pod twoją dłonią. Twoja praca będzie następną warstwą, nie wymazaniem poprzedniej.",
      ]),
    ],
    [
      choice(
        "private-name",
        "Zachowaj imię w chronionej części archiwum.",
        "Publiczne świadectwo zawiera zgodną z rodziną anonimizację. Oryginał ma wskazanego opiekuna.",
      ),
      choice(
        "consented-name",
        "Opublikuj imię wyłącznie w uzgodnionym zakresie.",
        "Rodzina zatwierdziła jawny zapis imienia i zakres publikacji; prywatne fragmenty listu pozostały chronione.",
      ),
    ],
  ),
  chapter(
    "sage",
    4,
    "Biblioteka pod ogrodem",
    "Dostęp do zamkniętych zapisów wymaga zgody opiekunów i sprawdzenia zabezpieczeń. Nie nazywaj domysłu odzyskanym faktem.",
    [
      consent(
        "H-A04:access",
        "Uzyskaj legalny dostęp do biblioteki",
        "archive",
        ["Opiekun czytelni"],
        "Czy badanie można podpisać twoim imieniem, czy wyłącznie funkcją opiekuna?",
      ),
      comparison(
        "H-A04:locks",
        "Rozwiąż trzy zabezpieczenia kopii",
        "archive",
        [
          {
            title: "Klucz opiekuna",
            text: "Każda kopia zachowuje podpis źródła. Uszkodzony fragment oznacza się jako nieznany; kopię porównuje się przed publikacją.",
          },
        ],
        "Zachowaj podpis, oznacz lukę i porównaj kopię przed publikacją.",
        [
          "Usuń podpis, aby kopie wyglądały identycznie.",
          "Wpisz brakującą datę na podstawie wyglądu pisma.",
        ],
        3,
      ),
      inspect(
        "H-A04:record",
        "Odzyskaj uszkodzony zapis",
        "archive",
        ["Uszkodzona karta"],
        [
          "Zachowana część opisuje schronienie. W miejscu daty jest fizyczna luka — nie można jej odtworzyć na podstawie samego tonu pieczęci.",
        ],
      ),
      comparison(
        "H-A04:integrity",
        "Sprawdź spójność rekonstrukcji",
        "workshop",
        [
          {
            title: "Oryginał i kopia",
            text: "Obie wersje potwierdzają schronienie i podpis. Data pozostaje nieznana.",
          },
        ],
        "Potwierdź schronienie i podpis; pozostaw datę jako nieznaną.",
        [
          "Wybierz najbardziej prawdopodobną datę i nazwij ją potwierdzoną.",
          "Usuń zapis, bo ma jedną lukę.",
        ],
      ),
      completedProjects("H-A04:project", ["P-A3"]),
      nameWeapon("H-A04:name"),
    ],
    [
      choice(
        "audited-archive",
        "Przywróć stare archiwum z niezależnym audytem.",
        "Archiwum zachowało dawne warstwy. Każda poprawka ma autora, źródło i możliwość zakwestionowania.",
      ),
      choice(
        "copy-registry",
        "Załóż nowy rejestr kopii z odwołaniami do oryginałów.",
        "Nowy rejestr nie zastąpił oryginałów. Pokazuje ich zgodności, różnice i brakujące fakty.",
      ),
    ],
  ),
  chapter(
    "sage",
    5,
    "Cena ujawnienia",
    "Wiedza nie staje się wspólna przez odebranie świadkom głosu. Trzy źródła i dwie zgody pozwolą przygotować bezpieczne wysłuchanie.",
    [
      inspect(
        "H-A05:sources",
        "Porównaj trzy źródła",
        "archive",
        ["Zapis ratunku", "Rejestr zamkniętych poziomów", "Świadectwo rodziny"],
        [
          "Potwierdza ocalenie, lecz pomija późniejsze ograniczenia.",
          "Pokazuje zamknięcie części zapisów po katastrofie sprzed 180 lat.",
          "Wyjaśnia ludzką cenę decyzji, nie dowodzi samodzielnie intencji wszystkich decydentów.",
        ],
      ),
      consent(
        "H-A05:witnesses",
        "Uzyskaj zgody dwóch świadków",
        "garden",
        ["Opiekun zamkniętego poziomu", "Przedstawiciel rodziny"],
        "Czy świadectwo ma być jawne z imieniem, czy z anonimizacją?",
      ),
      escort("H-A05:handoff", "Opiekun chronionych kopii", 3, true),
      mentor("sage", "H-A05:hearing", [
        "Zapis ocalenia był prawdziwy, ale nie był całą prawdą. Pominięto tych, którzy odmówili poprawiania wspomnień.",
        "Usłyszmy świadków bez przymusu. Nawet najważniejszy dokument nie daje prawa do ujawnienia ich bliskich wbrew zgodzie.",
      ]),
      completedProjects("H-A05:project", ["P-A4"]),
      smith("sage", "H-A05:temper", [
        "Wzmocnię osłonę rdzenia kostura tak, by utrzymał kilka źródeł bez zacierania granic.",
        "Naniesiemy ślad tej pracy. Trwałość nie polega na tym, że przedmiot nigdy nie był naprawiany.",
      ]),
    ],
    [
      choice(
        "anonymized-publication",
        "Opublikuj dokument z uzgodnioną anonimizacją.",
        "Wspólnota poznała zdarzenie i jego cenę. Imiona ujawniono tylko tam, gdzie pozwolili świadkowie.",
      ),
      choice(
        "deferred-details",
        "Odrocz publikację wskazanych danych, zachowując jawny opis zdarzenia.",
        "Istnienie dowodów i prawda o zdarzeniu pozostały jawne. Wrażliwe dane otrzymały termin ponownego przeglądu zgody.",
      ),
    ],
  ),
  chapter(
    "sage",
    6,
    "Kronika z pustym miejscem",
    "Ostatnia karta nie musi udawać zakończenia wszystkich historii. Zabezpiecz kopie podczas awarii i pozostaw miejsce na następny głos.",
    [
      completedProjects("H-A06:projects", ["P-A5", "P-A6"]),
      protect("H-A06:archive", "Osłoń węzły archiwum podczas awarii", 3, 3),
      inspect(
        "H-A06:copies",
        "Zachowaj trzy niezależne kopie",
        "archive",
        ["Kopia czytelni", "Kopia sąsiedniej osady", "Kopia opiekunów świadectw"],
        [
          "Kopia ma podpis i katalog źródeł.",
          "Kopia zachowuje różnice oraz oznaczone luki.",
          "Kopia przestrzega zgód i wskazuje sposób ich ponownego sprawdzenia.",
        ],
      ),
      mentor("sage", "H-A06:chapter", [
        "Pozostawiamy pustą kartę, bo przyszli świadkowie mogą wiedzieć więcej. Nie nazwę tej księgi ukończoną.",
        "Nasza lokalna naprawa nie kończy konfliktu Superior. Pokazuje jednak, że pamięć można chronić bez wymuszania jednego wspólnego wspomnienia.",
      ]),
      smith("sage", "H-A06:inherit", [
        "Zapiszę historię kostura wraz z jego nazwą i zachowanymi podpisami.",
        "Przekażesz go kiedyś komuś, kto będzie miał prawo dodać własne pytanie. To właśnie jest żywa pamięć.",
      ]),
    ],
    [
      choice(
        "protected-public-archive",
        "Otwórz archiwum publiczne pod opieką świadków.",
        "Czytelnicy otrzymali dostęp zgodny ze zgodami, a świadkowie prawo do sprostowania własnych relacji.",
      ),
      choice(
        "distributed-copies",
        "Rozprosz kopie i udostępnij jawny katalog.",
        "Kopie mają różnych opiekunów. Jawny katalog wskazuje ich źródła, różnice i sposób porównania bez kasowania oryginałów.",
      ),
    ],
  ),
];

const android: HeritageQuestDefinition[] = [
  chapter(
    "android",
    1,
    "Pakiet bez nadawcy",
    "Rdzeń odebrał pakiet bez podpisu nadawcy. LYRA-7 nie chce uzupełniać tej luki cudzą tożsamością.",
    [
      mentor("android", "H-N01:lyra", [
        "Pakiet dotarł do twojego rdzenia, ale nie ma prawidłowego podpisu. To brak danych, nie dowód winy.",
        "Porównaj dwie różnice w logach. Własny podpis złożysz dopiero po diagnozie, nie w miejsce nieznanego autora.",
      ]),
      inspect(
        "H-N01:core",
        "Zdiagnozuj odzyskany rdzeń",
        "workshop",
        ["Złącze rdzenia", "Pamięć pakietu"],
        [
          "Zasilanie jest stabilne. Nie ma podstaw do resetowania pamięci jednostki.",
          "Treść pakietu zachowała sumę kontrolną, lecz nie podpis nadawcy.",
        ],
      ),
      comparison(
        "H-N01:logs",
        "Wskaż dwie różnice między logami",
        "archive",
        [
          {
            title: "Log A",
            text: "Pakiet ma sumę kontrolną, lecz nie podpis. Zapisano ręczne wznowienie zasilania.",
          },
          {
            title: "Log B",
            text: "Treść jest zgodna z sumą kontrolną. Nie zapisano podpisu ani ręcznego wznowienia.",
          },
        ],
        "Treść jest zgodna; różnica dotyczy wznowienia, a podpisu brakuje w obu logach.",
        [
          "Log B dowodzi zgody jednostki na reset pamięci.",
          "Znamy autora pakietu i powód jego zniknięcia.",
        ],
        2,
      ),
      consent(
        "H-N01:signature",
        "Podpisz własną kopię pakietu",
        "workshop",
        ["Bohater — właściciel kopii"],
        "Czy kopię powiązać z jawnym imieniem, czy z chronionym podpisem audytu?",
      ),
      smith("android", "H-N01:emitter", [
        "Z odzyskanego elementu można zbudować emiter. Sprawdzę izolację i zachowam osobno dane rdzenia.",
        "Część mechaniczna nie przenosi prawa do cudzej pamięci. Skaner pokaże tylko znane instalacje w odkrytej strefie.",
      ]),
    ],
    [
      choice(
        "open-audit",
        "Utwórz jawny audyt pakietu.",
        "Treść i braki opisano jawnie. Własny podpis potwierdza sporządzenie kopii, nie tożsamość nieznanego nadawcy.",
      ),
      choice(
        "protected-audit",
        "Zachowaj chroniony audyt z jawną informacją o jego istnieniu.",
        "Katalog wskazuje pakiet i opiekuna dostępu. Nie dopisano brakującego nadawcy ani nie zresetowano pamięci.",
      ),
    ],
  ),
  chapter(
    "android",
    2,
    "Warsztat, którego nie ma",
    "Rejestr części odsyła do zamkniętego warsztatu. Przywrócenie zasilania nie wymaga usuwania danych ani wybierania, kto zasługuje na naprawę.",
    [
      inspect(
        "H-N02:register",
        "Porównaj rejestr części i drzwi warsztatu",
        "archive",
        ["Rejestr wydania", "Zamknięta tablica warsztatu"],
        [
          "Części wydano poprawnie, ale numer stanowiska zniknął z późniejszej kopii.",
          "Przy drzwiach zachowano pierwotny numer stanowiska oraz odłącznik zasilania.",
        ],
      ),
      inspect(
        "H-N02:diagnoses",
        "Wykonaj trzy odrębne diagnozy",
        "workshop",
        ["Bezpiecznik wejściowy", "Przewód stanowiska", "Ręczny odłącznik"],
        [
          "Bezpiecznik wymaga wymiany, nie zwiększenia dopuszczalnego prądu.",
          "Przewód jest uszkodzony przy złączu; pamięć jednostki nie należy do obwodu naprawy.",
          "Odłącznik działa i musi pozostać dostępny po uruchomieniu.",
        ],
      ),
      comparison(
        "H-N02:plan",
        "Ustal bezpieczny plan uruchomienia",
        "workshop",
        [
          {
            title: "Wyniki diagnoz",
            text: "Wymień bezpiecznik i złącze. Sprawdź ręczny odłącznik przed podaniem zasilania. Pamięć jednostki pozostaje poza zakresem naprawy.",
          },
        ],
        "Napraw bezpiecznik i złącze; sprawdź odłącznik przed startem.",
        [
          "Zwiększ limit prądu bez wymiany bezpiecznika.",
          "Zresetuj pamięć, aby pominąć diagnostykę.",
        ],
      ),
      completedProjects("H-N02:project", ["P-N1"]),
      smith("android", "H-N02:repair", [
        "Naprawię emiter i osadzę chłodzenie. Moduł ograniczy maksymalne KI, więc przed montażem zobaczysz oba skutki.",
        "Warsztat naprawi też wspólne stanowisko. Wybieramy kolejność, a nie jednostkę, którą porzucimy.",
      ]),
    ],
    [
      choice(
        "personal-first",
        "Najpierw napraw własne stanowisko, potem wspólne.",
        "Oba stanowiska przywrócono zgodnie z kolejnością i zachowanymi zasadami bezpieczeństwa.",
      ),
      choice(
        "shared-first",
        "Najpierw napraw stanowisko wspólne, potem własne.",
        "Wspólny warsztat ruszył pierwszy. Własne stanowisko również otrzymało części i kontrolę odłącznika.",
      ),
    ],
  ),
  chapter(
    "android",
    3,
    "Jednostka poza listą",
    "Odłączona jednostka nie traci prawa do decyzji. Zaproponuj alternatywne zasilanie, zanim zapytasz o rejestrację.",
    [
      witness(
        "H-N03:unit",
        "Porozmawiaj z odłączoną jednostką",
        "workshop",
        ["Jednostka bez wpisu w rejestrze"],
        [
          "Nie ma mnie na liście, ale to nie znaczy, że zgadzam się na nadpisanie moich wspomnień.",
          "Potrzebuję zasilania, które mogę samodzielnie odłączyć. Rejestrację omówmy osobno.",
        ],
      ),
      consent(
        "H-N03:consent",
        "Uzyskaj zgodę na naprawę zasilania",
        "workshop",
        ["Odłączona jednostka"],
        "Czy zapis naprawy może zawierać twoje imię, czy wolisz chronioną sygnaturę?",
      ),
      recover(
        "H-N03:parts",
        "Odbierz gwarantowane części alternatywnego zasilania",
        "workshop",
        "H-N03:power-parts",
        "Część zasilania pomocniczego",
        3,
      ),
      craft(
        "H-N03:power",
        "Zbuduj odłączalne zasilanie pomocnicze",
        "workshop",
        "H-N03:power-parts",
        3,
        "repair",
      ),
      escort("H-N03:escort", "Naprawiona jednostka", 3, true),
      completedProjects("H-N03:project", ["P-N2"]),
      smith("android", "H-N03:calibrate", [
        "Zestroję emiter z własnym sygnałem, nie z podpisem odłączonej jednostki.",
        "Kalibracja zachowa granice dwóch świadomości. Wspólna praca nie wymaga wspólnej pamięci.",
      ]),
    ],
    [
      choice(
        "consented-register",
        "Zaproponuj rejestrację dopiero po wyraźnej zgodzie.",
        "Jednostka otrzymała warunki rejestracji i prawo odmowy. Zasilanie nie zależy od jej decyzji o wpisie.",
      ),
      choice(
        "independent-station",
        "Zapewnij niezależne stanowisko bez obowiązku rejestracji.",
        "Jednostka korzysta z odłączalnego stanowiska. Jej brak w rejestrze nie jest już uzasadnieniem odmowy pomocy.",
      ),
    ],
  ),
  chapter(
    "android",
    4,
    "Rozkaz w pamięci",
    "Trzy podpisane fragmenty rozkazu można złożyć tylko z zachowaniem pochodzenia. Wpis z Verdantii wymaga rozmowy, nie zdalnego zgadywania.",
    [
      inspect(
        "H-N04:fragments",
        "Odnajdź trzy podpisane fragmenty",
        "archive",
        ["Polecenie zabezpieczenia", "Potwierdzenie odbioru", "Ręczna adnotacja"],
        [
          "Polecenie dotyczyło zabezpieczenia przeprawy; nie zawiera zgody na reset pamięci.",
          "Odbiór potwierdzono innym podpisem niż autorstwo rozkazu.",
          "Adnotacja opisuje ewakuację rodzin i wskazuje źródło przechowywane w Verdantii.",
        ],
      ),
      comparison(
        "H-N04:provenance",
        "Zweryfikuj pochodzenie wpisów",
        "archive",
        [
          {
            title: "Zasada podpisu",
            text: "Podpis odbiorcy dowodzi odbioru, nie autorstwa. Ręczna adnotacja ma własne źródło i nie zastępuje rozkazu.",
          },
        ],
        "Zachowaj osobno autora, odbiorcę i autora adnotacji.",
        ["Przypisz autorstwo rozkazu ostatniemu odbiorcy.", "Usuń adnotację, bo jest późniejsza."],
      ),
      {
        ...mentor("planetary", "H-N04:verdantia", [
          "Ten wpis opisuje te same rodziny, które rozpoznajemy na starszej mapie. Przekażę ci podpisaną kopię w uzgodnionym zakresie.",
          "Nie dopisuj naszej zgody do zdarzeń sprzed stu osiemdziesięciu lat. Możemy potwierdzić ślady i powiedzieć, czego jeszcze nie wiemy.",
        ]),
        world: "verdant",
      },
      comparison(
        "H-N04:reconstruct",
        "Zrekonstruuj rozkaz bez kasowania oryginału",
        "archive",
        [
          {
            title: "Potwierdzone informacje",
            text: "Zabezpieczono przeprawę i ewakuowano rodziny. Podpisy autora, odbiorcy oraz adnotacji są odrębne. Brak zgody na reset pamięci.",
          },
        ],
        "Połącz fakty z odrębnymi podpisami i oznaczeniem brakującej zgody.",
        [
          "Dopisz zgodę na reset, aby rozkaz był spójny.",
          "Usuń oryginał po wykonaniu wygodniejszej kopii.",
        ],
      ),
      completedProjects("H-N04:project", ["P-N3"]),
      nameWeapon("H-N04:name"),
    ],
    [
      choice(
        "annotated-original",
        "Zachowaj oryginał z jawnymi adnotacjami.",
        "Oryginał pozostał czytelny. Każda adnotacja ma osobny podpis i nie udaje rozkazu źródłowego.",
      ),
      choice(
        "anonymized-copy",
        "Udostępnij anonimizowaną kopię z katalogiem oryginałów.",
        "Kopia chroni wskazane osoby, a jawny katalog pozwala zweryfikować pochodzenie bez kasowania źródeł.",
      ),
    ],
  ),
  chapter(
    "android",
    5,
    "Prawo do odmowy",
    "Awaria nie daje automatycznej zgody na poświęcenie cudzej pamięci. Zdiagnozuj usterkę i zbuduj obejście z przygotowanych części.",
    [
      inspect(
        "H-N05:failure",
        "Zdiagnozuj trzy punkty awarii",
        "workshop",
        ["Węzeł zasilania", "Łącze sterujące", "Odłącznik lokalny"],
        [
          "Usterka dotyczy przepływu energii, nie treści pamięci.",
          "Łącze narzuca wspólny rozkaz; można je odseparować od zasilania.",
          "Odłącznik pozwala przywrócić ręczny wybór jednostki.",
        ],
      ),
      consent(
        "H-N05:refusal",
        "Potwierdź prawo jednostki do odmowy resetu",
        "workshop",
        ["Jednostka zagrożona resetem"],
        "Czy odmowę można zapisać z imieniem, czy pod chronioną sygnaturą?",
      ),
      recover(
        "H-N05:component",
        "Odbierz przygotowany komponent obejścia",
        "workshop",
        "H-N05:bypass",
        "Komponent bezpiecznego obejścia",
        1,
      ),
      craft(
        "H-N05:bypass-install",
        "Zamontuj odłączalne obejście",
        "workshop",
        "H-N05:bypass",
        1,
        "repair",
      ),
      completedProjects("H-N05:project", ["P-N4"]),
      smith("android", "H-N05:temper", [
        "Przeprowadzę końcową kalibrację emitera. Zmierzysz przepływ, zanim zamkniemy osłonę.",
        "Własny sygnał ma pozostać własnym wyborem. Żaden moduł nie powinien podmienić tego wyboru ukrytym rozkazem.",
      ]),
    ],
    [
      choice(
        "distributed-power",
        "Rozdziel zasilanie między niezależne stanowiska.",
        "Warsztat uzyskał kilka odłączalnych źródeł. Awaria jednego nie wymaga poświęcenia pamięci pozostałych.",
      ),
      choice(
        "disconnectable-hub",
        "Pozostaw węzeł centralny z ręcznym odłączeniem.",
        "Węzeł zachował ręczny odłącznik i jawne zasady odpowiedzialności; jednostki mogą odmówić przyłączenia.",
      ),
    ],
  ),
  chapter(
    "android",
    6,
    "Pierwszy zapis własny",
    "Twoja tożsamość nie musi być odpowiedzią na cudzy rozkaz. Przygotuj publiczny warsztat i zapisz własny kierunek pracy.",
    [
      completedProjects("H-N06:projects", ["P-N5", "P-N6"]),
      comparison(
        "H-N06:emergency",
        "Przeprowadź ręczną procedurę awaryjną",
        "workshop",
        [
          {
            title: "Procedura bezpieczeństwa",
            text: "Najpierw odłącz sterowanie, potem potwierdź zgodę jednostki, następnie uruchom zasilanie pomocnicze. Pamięć pozostaje nienaruszona.",
          },
        ],
        "Odłącz sterowanie, sprawdź zgodę i uruchom zasilanie pomocnicze.",
        [
          "Najpierw zresetuj pamięć, aby jednostka nie mogła odmówić.",
          "Usuń ręczne odłączniki dla wygody centralnego sterowania.",
        ],
        3,
      ),
      witness(
        "H-N06:workshop",
        "Otwórz warsztat z jego użytkownikami",
        "workshop",
        ["Naprawiona jednostka", "Opiekun stanowiska", "Przedstawiciel zleceniodawców"],
        [
          "Warsztat ma działać także wtedy, gdy któryś z nas zmieni zdanie.",
          "Zapisz zasady dostępu i pokaż wyłączniki. Własne stanowisko nie daje prawa do cudzej pamięci.",
        ],
      ),
      mentor("android", "H-N06:identity", [
        "Pierwszy zapis własny nie musi opisywać cię na zawsze. Może mówić, do jakiej pracy zobowiązujesz się dzisiaj.",
        "Nie rozwiązaliśmy wszystkich sporów Superior. Przywróciliśmy jednak miejsce, w którym odmowa nie jest traktowana jako awaria.",
      ]),
      smith("android", "H-N06:inherit", [
        "Emiter otrzyma zapis sześciu etapów budowy i twoją własną nazwę.",
        "Jego następny użytkownik będzie mógł odczytać historię bez przyjmowania twojej tożsamości.",
      ]),
    ],
    [
      choice(
        "researcher",
        "Zapisz rolę badacza.",
        "Bohater zobowiązał się sprawdzać źródła i opisywać granice wiedzy. Tożsamość pozostaje otwarta na dalszą zmianę.",
      ),
      choice(
        "keeper",
        "Zapisz rolę opiekuna.",
        "Bohater zobowiązał się chronić możliwość odmowy i dostęp do bezpiecznej naprawy.",
      ),
      choice(
        "builder",
        "Zapisz rolę konstruktora.",
        "Bohater zobowiązał się budować odłączalne, zrozumiałe narzędzia. Własny projekt nie zastępuje zgody użytkownika.",
      ),
    ],
  ),
];

const legend: HeritageQuestDefinition[] = [
  chapter(
    "legend",
    1,
    "Imię pod popiołem",
    "Znak rodzinnej broni przypomina ślad skutej inskrypcji. Kaena prosi o porównanie źródeł, zanim oskarżenie stanie się nową tradycją.",
    [
      mentor("legend", "H-P01:kaena", [
        "Na tej inskrypcji usunięto imiona, nie opis oddziału. Nie wiem jeszcze, kto wydał taki rozkaz.",
        "Zanieś broń do Goro i porównaj znak z kroniką. Potomek strażnika ma prawo pytać, ale samo pokrewieństwo nie zastąpi dowodu.",
      ]),
      inspect(
        "H-P01:inscription",
        "Odczytaj skutą inskrypcję",
        "memorial",
        ["Ślad dziewiątego paleniska"],
        [
          "Pod popiołem zachowały się trzy ramiona znaku. Imiona skuto później niż pozostałą część napisu.",
        ],
      ),
      smith("legend", "H-P01:goro", [
        "Rozpoznaję robotę dawnego oddziału. Nie dorobię brakujących liter na podstawie samej broni.",
        "Sprawdzę metal i osadzę krawędź tak, by można było bezpiecznie z nią wyruszyć. Dawnego znaku nie wypoleruję do nieistnienia.",
      ]),
      comparison(
        "H-P01:chronicle",
        "Porównaj znak z kroniką",
        "archive",
        [
          {
            title: "Kronika oddziału",
            text: "Znak ma trzy ramiona i wiąże się z dziewiątym paleniskiem. W kronice brakuje nazwisk, a skucie inskrypcji było późniejsze.",
          },
        ],
        "Broń i inskrypcja wskazują ten sam oddział; imiona wymagają dalszych świadectw.",
        [
          "Broń dowodzi winy wszystkich obecnych mistrzów.",
          "Brak nazwisk oznacza, że oddział nie istniał.",
        ],
      ),
      mentor("legend", "H-P01:return", [
        "Znak mamy potwierdzony. Teraz zdecyduj, od czyich głosów zaczniemy.",
        "Zarówno rozmowa ze świadkami, jak jawne pytanie do klanów zachowa dowody. Żadna droga nie daje prawa do wymuszenia zeznania.",
      ]),
    ],
    [
      choice(
        "witnesses-first",
        "Najpierw znajdź świadków.",
        "Rozmowy rozpoczęto bez publicznego oskarżenia. Głosy ocalałych staną się odrębnymi źródłami.",
      ),
      choice(
        "public-question",
        "Zadaj klanom jawne pytanie o znak.",
        "Klany otrzymały pytanie wraz z zachowanymi dowodami. Nie nazwano domysłu rozstrzygniętym oskarżeniem.",
      ),
    ],
  ),
  chapter(
    "legend",
    2,
    "Próba przerwania ciosu",
    "Kenz przypomina, że mistrz musi umieć zatrzymać własną siłę. Nauka opanowania i ochrony prowadzi do tych samych prób.",
    [
      talk(
        "H-P02:kenz",
        "Wysłuchaj instruktażu Kenza",
        "trainer",
        "Kenz",
        [
          "Zapowiem okna, w których możesz uderzyć. Gdy cel sygnalizuje poddanie, nie wyprowadzaj ciosu.",
          "To ćwiczenie przerwania decyzji, nie zwiększania Żaru za wszelką cenę.",
        ],
        response("Opanowanie zaczyna się od rozpoznania chwili, w której należy zaniechać ataku."),
        "trainer",
      ),
      restraint("H-P02:restraint", "Powstrzymaj trzy zapowiedziane ataki", 3, true),
      escort("H-P02:rescue", "Uczestnik ćwiczebnego ratunku", 2, false),
      completedProjects("H-P02:project", ["P-P1"]),
      smith("legend", "H-P02:repair", [
        "Naprawię oprawę rodzinnej broni. Nie potrzebujesz ostrzejszego narzędzia, by uznać cudze poddanie.",
        "Ślad tej naprawy będzie przypominał, że ochronę również trzeba ćwiczyć.",
      ]),
    ],
    [
      choice(
        "restraint-school",
        "Wybierz szkołę opanowania.",
        "Bohater rozpoczął naukę od prawa do przerwania ciosu. Wszystkie próby pozostają dostępne.",
      ),
      choice(
        "protection-school",
        "Wybierz szkołę ochrony.",
        "Bohater rozpoczął naukę od osłony wycofujących się. Wszystkie próby pozostają dostępne.",
      ),
    ],
  ),
  chapter(
    "legend",
    3,
    "Kowadło po mistrzu",
    "Trzy znaki na broni i notatka mistrza wskazują sposób jej dalszej obróbki. Nowy podpis może stanąć obok dawnego.",
    [
      inspect(
        "H-P03:marks",
        "Zbadaj trzy znaki na broni",
        "smith",
        ["Znak materiału", "Znak naprawy", "Znak oddziału"],
        [
          "Materiał dobrano do pracy przy gorącym palenisku.",
          "Naprawa jest późniejsza niż pierwsze kucie i została świadomie pozostawiona widoczna.",
          "Znak oddziału odpowiada inskrypcji, ale nie zastępuje imion strażników.",
        ],
      ),
      inspect(
        "H-P03:note",
        "Odnajdź notatkę mistrza",
        "archive",
        ["Notatka o hartowaniu"],
        [
          "Mistrz zaleca stopniowe chłodzenie i zachowanie znaków. Nie każe usuwać śladów wcześniejszej naprawy.",
        ],
      ),
      recover(
        "H-P03:material",
        "Przygotuj gwarantowany materiał kuźniczy",
        "smith",
        "H-P03:metal",
        "Materiał do rodzinnej broni",
        3,
      ),
      craft(
        "H-P03:temper",
        "Przeprowadź hartowanie według notatki",
        "smith",
        "H-P03:metal",
        3,
        "temper",
      ),
      completedProjects("H-P03:project", ["P-P2"]),
      smith("legend", "H-P03:record", [
        "Krawędź jest zestrojona z uchwytem, a stare znaki pozostały czytelne.",
        "Możemy zachować komentarz obok dawnego znaku albo dodać twój własny. Nie będziemy udawać, że broń nie ma przeszłości.",
      ]),
    ],
    [
      choice(
        "annotated-mark",
        "Zachowaj dawny znak z komentarzem.",
        "Dawny znak pozostał widoczny. Komentarz opisuje naprawę i granice poznanej historii.",
      ),
      choice(
        "own-mark",
        "Dodaj własny znak obok starego.",
        "Własny znak dopisano obok odziedziczonego. Żaden nie usuwa odpowiedzialności za to, co zrobi następny użytkownik.",
      ),
    ],
  ),
  chapter(
    "legend",
    4,
    "Ci, którzy zawrócili",
    "Ślady ewakuacji nie pasują do prostego opisu zdrady. Spotkanie potomków wymaga zachowania świadectw więcej niż jednego rodu.",
    [
      inspect(
        "H-P04:evacuation",
        "Odwiedź trzy ślady ewakuacji",
        "trail",
        ["Punkt odwrotu straży", "Miejsce zebrania rodzin", "Podejście do schronienia"],
        [
          "Ślady pokazują odwrót w stronę osad, nie ucieczkę od nich.",
          "Zachowano znaki prowadzące mieszkańców do bezpiecznego miejsca.",
          "Ostatni punkt potwierdza dotarcie części ewakuowanych, nie pełną listę ich imion.",
        ],
      ),
      witness(
        "H-P04:descendant",
        "Porozmawiaj z potomkiem ocalałych",
        "memorial",
        ["Potomek rodziny z przejścia"],
        [
          "W naszej rodzinie pamięta się strażników, którzy wrócili po mieszkańców. Nie znam imion wszystkich oddziałów.",
          "Porównaj mapę i rozkaz, zanim nazwiesz czyjeś świadectwo jedyną historią.",
        ],
      ),
      comparison(
        "H-P04:order",
        "Porównaj mapę ewakuacji i rozkaz",
        "archive",
        [
          { title: "Mapa", text: "Trasa straży prowadziła do osad i schronienia." },
          {
            title: "Rozkaz",
            text: "Dowództwo nakazywało utrzymać posterunek. Późniejszy opis zdrady pomija ewakuację.",
          },
        ],
        "Straż złamała rozkaz, aby prowadzić ewakuację; późniejszy zapis pomija ten skutek.",
        [
          "Mapa dowodzi, że wszyscy dowódcy znali pełną sytuację.",
          "Rozkaz dowodzi, że nie ratowano mieszkańców.",
        ],
      ),
      consent(
        "H-P04:meeting",
        "Uzgodnij spotkanie świadków",
        "market",
        ["Potomek strażnika", "Potomek ocalałych"],
        "Czy możemy podpisać twoje świadectwo imieniem, czy zachować anonimizację?",
      ),
      completedProjects("H-P04:project", ["P-P3"]),
      nameWeapon("H-P04:name"),
    ],
    [
      choice(
        "family-chronicle",
        "Zapisz opowieść rodu obok innych świadectw.",
        "Ród odzyskał miejsce w kronice, a świadectwa pozostałych rodzin zachowano jako niezależne źródła.",
      ),
      choice(
        "unit-chronicle",
        "Przygotuj wspólną kronikę oddziału.",
        "Kronika połączyła potwierdzone działania, zachowując odrębne podpisy oraz nieznane imiona.",
      ),
    ],
  ),
  chapter(
    "legend",
    5,
    "Pojedynek bez widowni",
    "Mistrz zgadza się na ćwiczebny pojedynek pod warunkiem uznania poddania. Jego zeznania nie wolno wymusić śmiercią.",
    [
      consent(
        "H-P05:conditions",
        "Uzgodnij warunki bezpiecznego spotkania",
        "trainer",
        ["Mistrz dawnej straży"],
        "Czy zeznanie po próbie ma zawierać twoje imię, czy chroniony podpis świadka?",
      ),
      restraint("H-P05:duel", "Przejdź trzy fazy próby i przerwij na poddanie", 3, true),
      witness(
        "H-P05:testimony",
        "Przyjmij zeznanie po poddaniu",
        "trainer",
        ["Mistrz dawnej straży"],
        [
          "Opis zdrady był wygodniejszy od rozmowy o cenie utrzymania posterunku. Nie wszyscy strażnicy przyjęli tamten wybór.",
          "Nie uczynię twojej rodziny jedyną grupą poszkodowanych. Zachowaj też głosy tych, których imion nie znamy.",
        ],
      ),
      completedProjects("H-P05:project", ["P-P4"]),
      smith("legend", "H-P05:temper", [
        "Zahartuję ostrze i zachowam nadaną nazwę. Wynik pojedynku nie daje narzędziu prawa do decydowania za świadka.",
        "Dodatkowy cios po poddaniu byłby błędem, nie zakończeniem twojej historii. Takie ćwiczenie można powtórzyć, a zeznanie przyjąć bez przemocy.",
      ]),
    ],
    [
      choice(
        "public-testimony",
        "Opublikuj zeznanie zgodnie z warunkami zgody.",
        "Zeznanie stało się jawne w uzgodnionym zakresie. Nikt nie musiał oddać życia, by jego słowa uznano za ważne.",
      ),
      choice(
        "council-testimony",
        "Przekaż zeznanie radzie z jawną informacją o jego istnieniu.",
        "Rada przechowuje zeznanie, a wspólnota zna jego istnienie oraz warunki dostępu. Źródła nie zostały ukryte jako niebyłe.",
      ),
    ],
  ),
  chapter(
    "legend",
    6,
    "Przysięga dla jutra",
    "Własną przysięgę trzeba potwierdzić osłoną odwrotu. Jej treść określi twoją rolę, nie cudzy obowiązek posłuszeństwa.",
    [
      completedProjects("H-P06:projects", ["P-P5", "P-P6"]),
      inspect(
        "H-P06:route",
        "Uruchom oznaczoną trasę ewakuacji",
        "trail",
        ["Znak wyjścia", "Punkt zbiórki", "Wejście do schronienia"],
        [
          "Wyjście prowadzi poza strefę zagrożenia.",
          "Punkt zbiórki pozostawia miejsce dla spóźnionych.",
          "Wejście ma czytelny znak powrotu i nie wymaga wejścia potworów do miasta.",
        ],
      ),
      protect("H-P06:retreat", "Osłoń trzy punkty odwrotu poza miastem", 3, 3),
      mentor("legend", "H-P06:oath", [
        "Dziś znasz ciężar dawnych decyzji, ale nie musisz dziedziczyć cudzej przysięgi słowo w słowo.",
        "Możesz zostać opiekunem szlaku, nauczycielem albo obrońcą osad. Lokalna przysięga nie kończy walki o Superior; wyznacza sposób, w jaki w niej uczestniczysz.",
      ]),
      smith("legend", "H-P06:inherit", [
        "Zapiszę przy broni jej nazwę i sześć etapów twojej pracy. Rodzinny znak pozostanie czytelny.",
        "Następca dostanie narzędzie oraz historię, nie rozkaz, by powtórzyć każde twoje działanie.",
      ]),
    ],
    [
      choice(
        "route-keeper",
        "Przysięgnij opiekę nad szlakiem.",
        "Bohater przyjął obowiązek wskazywania drogi i powrotu po tych, którzy nie nadążają.",
      ),
      choice(
        "teacher",
        "Przysięgnij uczyć opanowania.",
        "Bohater otworzył naukę, w której zatrzymanie ciosu jest częścią mistrzostwa.",
      ),
      choice(
        "settlement-defender",
        "Przysięgnij osłaniać osady.",
        "Bohater związał swoją siłę z ochroną odwrotu i prawem mieszkańców do własnej decyzji.",
      ),
    ],
  ),
];

export const HERITAGE_QUESTS: readonly HeritageQuestDefinition[] = [
  ...planetary,
  ...sage,
  ...android,
  ...legend,
];
export const HERITAGE_BY_ID = new Map(
  HERITAGE_QUESTS.map((definition) => [definition.id, definition]),
);

function project(
  race: RaceId,
  n: ChapterNumber,
  name: string,
  goals: HeritageGoal[],
  effect: ProjectEffect,
): WorldProjectDefinition {
  return {
    id: projectId(race, n),
    version: 1,
    race,
    world: RACES[race].world,
    number: n,
    name,
    prerequisite: questId(race, Math.min(5, n) as ChapterNumber),
    goals,
    effect,
    reward: { practice: 200 },
  };
}
const effect = (
  kind: ProjectEffect["kind"],
  description: string,
  actors: string[] = [],
  stations: ProjectEffect["stations"] = [],
  opensPassage = false,
): ProjectEffect => ({ kind, description, actors, stations, opensPassage });
function work(
  id: string,
  label: string,
  site: Site,
  operation: Extract<HeritageGoal, { kind: "craft" }>["operation"] = "repair",
): HeritageGoal {
  return {
    id,
    label,
    site,
    documents: [],
    kind: "craft",
    recipe: [],
    operation,
    target: id + ":station",
  };
}
const installs = (
  prefix: string,
  names: string[],
  site: Site,
  material: string,
  operation: Extract<HeritageGoal, { kind: "craft" }>["operation"] = "repair",
) =>
  names.map((name, index) =>
    craft(prefix + ":install:" + index, name, site, material, 1, operation),
  );
const recordFacts = (text: string) => [{ title: "Instrukcja stanowiska", text }];

const planetaryProjects: WorldProjectDefinition[] = [
  project(
    "planetary",
    1,
    "Przepust Doliny",
    [
      inspect(
        "P-V1:diagnose",
        "Zdiagnozuj przepust i jego trzy zasuwy",
        "river",
        ["Uchwyt przepustu", "Odpływ boczny", "Zasuwa główna"],
        [
          "Uszkodzony uchwyt wymaga części z szafy remontowej.",
          "Odpływ musi zostać otwarty przed głównym nurtem.",
          "Główną zasuwę otwiera się dopiero po sprawdzeniu obejścia.",
        ],
      ),
      recover(
        "P-V1:parts",
        "Odbierz trzy oznaczone części",
        "river",
        "P-V1:parts",
        "Część przepustu",
        3,
      ),
      craft("P-V1:repair", "Napraw uchwyt przepustu", "river", "P-V1:parts", 3, "repair"),
      comparison(
        "P-V1:valves",
        "Ustaw trzy zawory według odczytanego klucza",
        "river",
        recordFacts(
          "Kolejność: sprawdzenie obejścia, odpływ boczny, zasuwa główna. Otwarcie głównej zasuwy przed odpływem grozi odcięciem drugiego brzegu.",
        ),
        "Obejście → odpływ boczny → zasuwa główna.",
        [
          "Zasuwa główna → zamknięcie odpływu → pominięcie obejścia.",
          "Zamknij wszystkie zawory i uznaj test za zakończony.",
        ],
        3,
      ),
    ],
    effect("flow", "Woda wraca do bocznego kanału; lokalna zapora znika.", [], ["research"], true),
  ),
  project(
    "planetary",
    2,
    "Most Wędrowców",
    [
      inspect(
        "P-V2:inspect",
        "Sprawdź mocowania mostu",
        "river",
        ["Dwa przyczółki"],
        [
          "Cztery mocowania mają oznaczone miejsca nowych belek. Nie trzeba zmieniać przebiegu rzeki.",
        ],
      ),
      recover(
        "P-V2:beams",
        "Odbierz cztery przygotowane belki",
        "workshop",
        "P-V2:beams",
        "Belka mostu",
        4,
      ),
      ...installs(
        "P-V2",
        [
          "Osadź belkę wejściową",
          "Osadź belkę podparcia",
          "Osadź belkę przejścia",
          "Osadź belkę końcową",
        ],
        "river",
        "P-V2:beams",
      ),
      comparison(
        "P-V2:test",
        "Sprawdź ciągłość przejścia",
        "river",
        recordFacts(
          "Wszystkie cztery belki mają być osadzone. Przejście pozostaje otwarte z obu stron i nie kończy się przy zamkniętym wejściu.",
        ),
        "Sprawdź oba wejścia oraz cztery mocowania.",
        ["Sprawdź tylko jedną belkę.", "Zablokuj przeciwległe wejście po przejściu."],
      ),
    ],
    effect(
      "bridge",
      "Działa krótka, lokalna przeprawa; skrót ma własne oznaczenie.",
      ["Opiekun mostu"],
      [],
      true,
    ),
  ),
  project(
    "planetary",
    3,
    "Ogród Powrotu",
    [
      comparison(
        "P-V3:plants",
        "Rozpoznaj trzy właściwe rośliny",
        "garden",
        recordFacts(
          "Ogród potrzebuje rośliny wilgotnego brzegu, rośliny cienia i rośliny osłaniającej ziemię. Nie wyrywaj zdrowych stanowisk z cudzych ogrodów.",
        ),
        "Użyj przygotowanych sadzonek dla brzegu, cienia i osłony gleby.",
        [
          "Zbierz dowolne trzy zdrowe rośliny z cudzej grządki.",
          "Wysusz całą ziemię przed sadzeniem.",
        ],
        3,
      ),
      work("P-V3:soil", "Przygotuj ziemię ogrodu", "garden", "plant"),
      recover(
        "P-V3:seedlings",
        "Odbierz trzy sadzonki od opiekunów",
        "garden",
        "P-V3:seedlings",
        "Sadzonka Ogrodu Powrotu",
        3,
      ),
      ...installs(
        "P-V3",
        ["Posadź roślinę brzegu", "Posadź roślinę cienia", "Posadź roślinę osłony"],
        "garden",
        "P-V3:seedlings",
        "plant",
      ),
      { ...work("P-V3:flow", "Zestrój przepływ ogrodu", "garden", "tune"), kiCost: 5 },
    ],
    effect(
      "garden",
      "W ogrodzie rosną trzy sadzonki, a zielarka udostępnia nową rozmowę.",
      ["Zielarka Ogrodu Powrotu"],
      ["research"],
    ),
  ),
  project(
    "planetary",
    4,
    "Przystań Świadków",
    [
      inspect(
        "P-V4:room",
        "Sprawdź dwa miejsca odpoczynku",
        "memorial",
        ["Miejsce pierwszego łóżka", "Miejsce drugiego łóżka"],
        ["Nie blokuje przejścia od drzwi.", "Pozostawia dostęp do spokojnej rozmowy bez widowni."],
      ),
      recover(
        "P-V4:beds",
        "Odbierz dwa zestawy posłań",
        "workshop",
        "P-V4:beds",
        "Zestaw posłania",
        2,
      ),
      ...installs(
        "P-V4",
        ["Przygotuj pierwsze łóżko", "Przygotuj drugie łóżko"],
        "memorial",
        "P-V4:beds",
      ),
      work("P-V4:approach", "Oznacz bezpieczne dojście", "gate"),
      consent(
        "P-V4:guests",
        "Uzgodnij sposób podpisania świadectw mieszkańców",
        "memorial",
        ["Gość przystani", "Opiekunka powracających"],
        "Czy twoja relacja w przystani ma zawierać imię?",
      ),
    ],
    effect(
      "witnesses",
      "Świadkowie mieszkają w bezpiecznej przystani i odpowiadają zgodnie z zapisanymi zgodami.",
      ["Gość przystani", "Opiekunka powracających"],
    ),
  ),
  project(
    "planetary",
    5,
    "Latarnia Szlaku",
    [
      recover(
        "P-V5:lens",
        "Odbierz oznaczoną soczewkę",
        "workshop",
        "P-V5:lens",
        "Soczewka latarni",
        1,
      ),
      craft("P-V5:tune", "Zestrój soczewkę latarni", "workshop", "P-V5:lens", 1, "tune"),
      recover(
        "P-V5:signs",
        "Odbierz trzy przygotowane oznaczenia",
        "workshop",
        "P-V5:signs",
        "Oznaczenie szlaku",
        3,
      ),
      ...installs(
        "P-V5",
        ["Ustaw znak wyjścia", "Ustaw znak postoju", "Ustaw znak powrotu"],
        "trail",
        "P-V5:signs",
      ),
      escort("P-V5:delivery", "Wędrowiec sprawdzający dostawę", 3, false),
    ],
    effect("route", "Latarnia i trzy znaki prowadzą dostawy bez gubienia drogi powrotnej.", [
      "Wędrowiec dostawca",
    ]),
  ),
  project(
    "planetary",
    6,
    "Dom Pamięci Dolin",
    [
      inspect(
        "P-V6:accounts",
        "Sprawdź trzy świadectwa i ich zgody",
        "archive",
        ["Świadectwo przeprawy", "Świadectwo ogrodu", "Świadectwo powrotu"],
        [
          "Kopia zachowa zakres podpisu wybrany przez świadka.",
          "Kopia nie ujawni imienia objętego anonimizacją.",
          "Luka w świadectwie pozostanie oznaczona.",
        ],
      ),
      recover(
        "P-V6:copies",
        "Odbierz trzy chronione nośniki kopii",
        "archive",
        "P-V6:copies",
        "Nośnik świadectwa",
        3,
      ),
      ...installs(
        "P-V6",
        ["Sporządź kopię przeprawy", "Sporządź kopię ogrodu", "Sporządź kopię powrotu"],
        "archive",
        "P-V6:copies",
        "copy",
      ),
      work("P-V6:board", "Przygotuj tablicę z katalogiem i zasadami dostępu", "memorial"),
      comparison(
        "P-V6:open",
        "Otwórz dom z zachowaniem zgód",
        "memorial",
        recordFacts(
          "Publiczny katalog może wskazać istnienie chronionego świadectwa. Nie może ujawnić imienia, którego świadek nie zgodził się publikować.",
        ),
        "Zachowaj anonimizację i jawnie oznacz istnienie chronionych źródeł.",
        [
          "Opublikuj wszystkie imiona dla wygody czytelników.",
          "Usuń chronione relacje z katalogu jako nieistniejące.",
        ],
      ),
    ],
    effect(
      "archive",
      "Dom Pamięci pokazuje relacje w uzgodnionym zakresie i zachowuje wybraną prywatność.",
      ["Opiekun Domu Pamięci"],
      ["research"],
    ),
  ),
];

const sageProjects: WorldProjectDefinition[] = [
  project(
    "sage",
    1,
    "Źródło Porównania",
    [
      work("P-A1:channel-1", "Oczyść pierwszy kanał źródła", "river"),
      work("P-A1:channel-2", "Oczyść drugi kanał źródła", "river"),
      work("P-A1:vessel", "Zestrój pojemnik z odrębnymi wejściami", "workshop", "tune"),
      comparison(
        "P-A1:patterns",
        "Sprawdź dwa odrębne wzorce",
        "river",
        recordFacts(
          "Wzorce mogą odtwarzać się równolegle, ale zachowują osobne podpisy i miejsce obserwacji.",
        ),
        "Porównaj wzorce, zachowując dwa podpisy.",
        [
          "Połącz pamięci i zastąp podpisy jednym.",
          "Usuń wzorzec, który jest mniej wygodny dla kroniki.",
        ],
        2,
      ),
    ],
    effect("flow", "Źródło pozwala porównywać dwa podpisane wspomnienia.", [], ["research"]),
  ),
  project(
    "sage",
    2,
    "Czytelnia Imion",
    [
      recover(
        "P-A2:shelf",
        "Odzyskaj części regału",
        "workshop",
        "P-A2:shelf",
        "Część regału czytelni",
        3,
      ),
      craft("P-A2:repair", "Napraw regał czytelni", "archive", "P-A2:shelf", 3, "repair"),
      inspect(
        "P-A2:accounts",
        "Ułóż trzy świadectwa ze źródłami",
        "archive",
        ["Świadectwo ogrodu", "Świadectwo bramy", "Świadectwo archiwisty"],
        [
          "Zachowuje punkt obserwacji.",
          "Zachowuje podpis i dopisek o nieznanych osobach.",
          "Zachowuje zakres zgody rodziny.",
        ],
      ),
      comparison(
        "P-A2:rules",
        "Zapisz zasady dostępu",
        "archive",
        recordFacts(
          "Czytelnik otrzymuje jawne kopie. Źródła chronione opisuje katalog, ale dostęp do imion wymaga zachowanej zgody.",
        ),
        "Udostępnij jawne kopie, zachowaj opiekę nad źródłami chronionymi.",
        [
          "Przenieś wszystkie imiona na publiczną tablicę.",
          "Zablokuj sprawdzanie wszystkich oryginałów bez wyjaśnienia.",
        ],
      ),
    ],
    effect(
      "reading-room",
      "Działa czytelnia, a archiwista rozmawia o źródłach.",
      ["Archiwista Czytelni Imion"],
      ["research"],
    ),
  ),
  project(
    "sage",
    3,
    "Pieczęć Opiekuna",
    [
      inspect(
        "P-A3:elements",
        "Zbadaj trzy elementy pieczęci",
        "archive",
        ["Znak źródła", "Znak opiekuna", "Znak odwrotu"],
        [
          "Wskazuje właściwe źródło energii.",
          "Pozostawia odpowiedzialnego opiekuna.",
          "Pozwala przerwać badanie i wrócić bezpiecznie.",
        ],
      ),
      comparison(
        "P-A3:ritual",
        "Wykonaj rytuał z zachowaniem kolejności",
        "archive",
        recordFacts(
          "Źródło zasila pieczęć; opiekun potwierdza dostęp; znak odwrotu musi pozostać czynny przez całą próbę.",
        ),
        "Zasil źródło, potwierdź opiekuna i zachowaj czynny odwrót.",
        ["Zamknij drogę odwrotu dla większej mocy.", "Pomiń potwierdzenie opiekuna."],
        3,
      ),
      work("P-A3:barrier", "Zestrój barierę wejścia", "archive", "tune"),
      comparison(
        "P-A3:test",
        "Sprawdź dostęp i bezpieczne wyjście",
        "archive",
        recordFacts(
          "Badanie jest poprawne, gdy dostęp jest potwierdzony i można wycofać się przez czynny znak odwrotu.",
        ),
        "Potwierdź dostęp i możliwość wycofania.",
        ["Zamknij badanego w komnacie do końca próby.", "Uznaj sam blask pieczęci za pełny test."],
      ),
    ],
    effect(
      "barrier",
      "Otwiera się bezpieczne wejście do lokalnej komnaty badań.",
      [],
      ["research"],
      true,
    ),
  ),
  project(
    "sage",
    4,
    "Pokój Świadków",
    [
      inspect(
        "P-A4:room",
        "Sprawdź miejsce spokojnej rozmowy",
        "memorial",
        ["Pokój rozmowy"],
        ["Wejście nie prowadzi przez plac walki ani drogę przypadkowej widowni."],
      ),
      work("P-A4:prepare", "Przygotuj pomieszczenie", "memorial"),
      consent(
        "P-A4:consent",
        "Uzgodnij zasady spotkania",
        "memorial",
        ["Świadek z ogrodu", "Świadek z archiwum"],
        "Czy rozmowę podpisać twoim imieniem, czy udostępnić wyłącznie anonimową kopię?",
      ),
      escort("P-A4:approach", "Opiekun prowadzący świadków", 2, false),
    ],
    effect("witnesses", "Świadkowie pozostają dostępni w bezpiecznym mieście.", [
      "Świadek z ogrodu",
      "Świadek z archiwum",
    ]),
  ),
  project(
    "sage",
    5,
    "Kopia dla Sąsiadów",
    [
      recover(
        "P-A5:media",
        "Odbierz trzy nośniki kopii",
        "archive",
        "P-A5:media",
        "Nośnik podpisanej kopii",
        3,
      ),
      ...installs(
        "P-A5",
        ["Sporządź pierwszą kopię", "Sporządź drugą kopię", "Sporządź trzecią kopię"],
        "archive",
        "P-A5:media",
        "copy",
      ),
      witness(
        "P-A5:keepers",
        "Wybierz i wysłuchaj trzech opiekunów",
        "market",
        ["Opiekun czytelni", "Opiekunka sąsiedzkiego rejestru", "Wędrowny archiwista"],
        [
          "Każda kopia ma wskazywać oryginał i warunki zgody.",
          "Różnica między kopiami jest powodem porównania, nie rozkazem usunięcia jednej z nich.",
        ],
      ),
      escort("P-A5:delivery", "Posłaniec podpisanych kopii", 3, false),
    ],
    effect(
      "registries",
      "Trzy rejestry i ich opiekunowie udostępniają odmienne rozmowy o zachowanych kopiach.",
      ["Opiekun czytelni", "Opiekunka sąsiedzkiego rejestru", "Wędrowny archiwista"],
      ["research"],
    ),
  ),
  project(
    "sage",
    6,
    "Ogród Pamięci",
    [
      inspect(
        "P-A6:entries",
        "Zweryfikuj trzy wpisy według udzielonych zgód",
        "archive",
        ["Wpis archiwisty", "Wpis opiekuna ogrodu", "Wpis świadka bramy"],
        [
          "Publikacja zachowa zgodę rodziny.",
          "Nie dopisze nieznanych dat.",
          "Zachowa wybraną anonimizację.",
        ],
      ),
      recover(
        "P-A6:boards",
        "Odbierz trzy tablice ogrodu",
        "workshop",
        "P-A6:boards",
        "Tablica Ogrodu Pamięci",
        3,
      ),
      ...installs(
        "P-A6",
        ["Ustaw tablicę archiwisty", "Ustaw tablicę opiekuna", "Ustaw tablicę bramy"],
        "garden",
        "P-A6:boards",
      ),
      comparison(
        "P-A6:review",
        "Sprawdź podpisy i anonimizację",
        "garden",
        recordFacts(
          "Zgoda na zachowanie relacji nie jest zgodą na ujawnienie wszystkich imion. Nieznane daty pozostają oznaczone jako nieznane.",
        ),
        "Zachowaj uzgodnione podpisy, anonimizację i oznaczone luki.",
        ["Ujednolić podpisy, zastępując je nazwą rady.", "Uzupełnij luki wymyślonymi datami."],
      ),
    ],
    effect(
      "garden",
      "Ogród pokazuje imiona lub anonimizację zgodnie z decyzjami świadków.",
      ["Opiekun Ogrodu Pamięci"],
      ["research"],
    ),
  ),
];

const androidProjects: WorldProjectDefinition[] = [
  project(
    "android",
    1,
    "Przywrócone Zasilanie",
    [
      recover(
        "P-N1:fuses",
        "Odzyskaj trzy bezpieczniki z oznaczonej szafy",
        "workshop",
        "P-N1:fuses",
        "Bezpiecznik warsztatu",
        3,
      ),
      ...installs(
        "P-N1",
        ["Połącz przewód wejściowy", "Połącz przewód stanowiska", "Połącz przewód powrotny"],
        "workshop",
        "P-N1:fuses",
      ),
      comparison(
        "P-N1:test",
        "Przetestuj zasilanie i odłącznik",
        "workshop",
        recordFacts(
          "Zasilanie uruchamia się po kontroli bezpieczników i ręcznego odłącznika. Nie łączy się z nim polecenia resetowania pamięci.",
        ),
        "Sprawdź przewody, bezpieczniki i ręczny odłącznik przed startem.",
        ["Pomiń bezpieczniki dla większej mocy.", "Połącz start z obowiązkowym resetem pamięci."],
      ),
    ],
    effect(
      "power",
      "W warsztacie działa oświetlenie oraz stanowisko konfiguracji modułów.",
      ["Opiekun zasilania"],
      ["modules"],
    ),
  ),
  project(
    "android",
    2,
    "Stół Własnej Konstrukcji",
    [
      inspect(
        "P-N2:plan",
        "Sprawdź schemat stanowiska",
        "workshop",
        ["Schemat stołu"],
        [
          "Trzy części odpowiadają oprawie, izolacji i przyłączu. Schemat zachowuje własny wyłącznik stanowiska.",
        ],
      ),
      recover(
        "P-N2:parts",
        "Odzyskaj trzy oznaczone części",
        "workshop",
        "P-N2:parts",
        "Część stołu konstrukcyjnego",
        3,
      ),
      craft("P-N2:mount", "Zmontuj stół według schematu", "workshop", "P-N2:parts", 3, "repair"),
      comparison(
        "P-N2:calibrate",
        "Skalibruj stanowisko bez zmiany pamięci jednostki",
        "workshop",
        recordFacts(
          "Sprawdź oprawę, izolację i przyłącze. Kalibracja dotyczy urządzenia, nie tożsamości użytkownika.",
        ),
        "Porównaj trzy pomiary i zachowaj ręczny wyłącznik.",
        [
          "Usuń wyłącznik, by stanowisko zawsze było dostępne.",
          "Skopiuj tożsamość użytkownika do każdego podłączonego emitera.",
        ],
        3,
      ),
    ],
    effect(
      "workbench",
      "Działa stanowisko emitera i porównywania konfiguracji.",
      ["Konstruktor własnego stanowiska"],
      ["modules", "weapon"],
    ),
  ),
  project(
    "android",
    3,
    "Archiwum Podpisów",
    [
      recover(
        "P-N3:copies",
        "Przygotuj trzy oznaczone nośniki",
        "archive",
        "P-N3:copies",
        "Nośnik podpisanego logu",
        3,
      ),
      ...installs(
        "P-N3",
        ["Wykonaj kopię nadawcy", "Wykonaj kopię odbiorcy", "Wykonaj kopię adnotacji"],
        "archive",
        "P-N3:copies",
        "copy",
      ),
      comparison(
        "P-N3:signatures",
        "Zweryfikuj trzy odrębne sygnatury",
        "archive",
        recordFacts(
          "Nadawca, odbiorca i autor adnotacji mają odrębne podpisy. Brakujący podpis oznacza brak danych.",
        ),
        "Zachowaj rozróżnienie podpisów i jawną informację o brakach.",
        [
          "Uzupełnij wszystkie podpisy sygnaturą ostatniej jednostki.",
          "Usuń logi z nieznanym nadawcą.",
        ],
        3,
      ),
      work("P-N3:access", "Zabezpiecz dostęp do chronionych danych", "archive"),
    ],
    effect(
      "signatures",
      "Podpisane logi mają czytelny katalog pochodzenia oraz chroniony dostęp.",
      ["Opiekun Archiwum Podpisów"],
      ["research"],
    ),
  ),
  project(
    "android",
    4,
    "Stacja Dobrowolnej Regeneracji",
    [
      inspect(
        "P-N4:station",
        "Zbadaj awarię stacji",
        "workshop",
        ["Stacja pomocnicza"],
        ["Do naprawy zasilania nie trzeba odczytywać ani resetować pamięci użytkownika."],
      ),
      recover(
        "P-N4:parts",
        "Odbierz przygotowane elementy naprawy",
        "workshop",
        "P-N4:parts",
        "Element dobrowolnej stacji",
        2,
      ),
      craft("P-N4:repair", "Napraw stację", "workshop", "P-N4:parts", 1, "repair"),
      craft("P-N4:off", "Dodaj ręczne wyłączenie", "workshop", "P-N4:parts", 1, "repair"),
      consent(
        "P-N4:consent",
        "Sprawdź zgodę użytkownika przed podłączeniem",
        "workshop",
        ["Naprawiona jednostka"],
        "Czy zapis naprawy ma zawierać twoje imię, czy anonimową sygnaturę?",
      ),
    ],
    effect(
      "regeneration",
      "Powraca naprawiona jednostka; stacja ma ręczny odłącznik i nowe rozmowy. Nie jest darmowym resetem zasobów gracza.",
      ["Naprawiona jednostka"],
    ),
  ),
  project(
    "android",
    5,
    "Stanowisko Testów",
    [
      recover(
        "P-N5:targets",
        "Odbierz części trzech celów",
        "workshop",
        "P-N5:targets",
        "Część celu pomiarowego",
        3,
      ),
      ...installs(
        "P-N5",
        ["Ustaw pierwszy cel", "Ustaw drugi cel", "Ustaw trzeci cel"],
        "workshop",
        "P-N5:targets",
      ),
      {
        id: "P-N5:measure",
        label: "Traf trzy cele i odczytaj prawdziwy Ładunek Rdzenia",
        site: "workshop",
        documents: recordFacts(
          "Stanowisko mierzy rzeczywisty Ładunek i parametry wyposażonego zestawu. Nie dopisuje temperatury w stopniach, której silnik nie oblicza, ani nie odnawia HP/KI.",
        ),
        kind: "measure",
        hits: 3,
      },
      comparison(
        "P-N5:safety",
        "Sprawdź bezpieczeństwo aktualnej konfiguracji",
        "workshop",
        recordFacts(
          "Budżet modułów wynosi 10 energii i trzy różne gniazda. Pomiary dotyczą rzeczywistego zestawu; test nie przyznaje praktyki za każdy strzał.",
        ),
        "Porównaj korzyści i koszty trzech gniazd w budżecie 10.",
        [
          "Pomiń ujemne efekty podłączonych modułów.",
          "Odnów zasoby za każdym naciśnięciem pomiaru.",
        ],
      ),
    ],
    effect(
      "metrics",
      "Stanowisko pokazuje parametry i odczyty realnej konfiguracji bez darmowego leczenia.",
      [],
      ["modules", "training"],
    ),
  ),
  project(
    "android",
    6,
    "Otwarty Warsztat",
    [
      witness(
        "P-N6:orders",
        "Przyjmij trzy zlecenia mieszkańców",
        "market",
        [
          "Naprawiona jednostka",
          "Konstruktor sąsiedzkiego stanowiska",
          "Opiekun niezależnego zasilania",
        ],
        [
          "Każde zlecenie ma własnego użytkownika i warunki zgody.",
          "Podziel stanowiska tak, by żadna jednostka nie musiała oddawać pamięci w zamian za dostęp do narzędzi.",
        ],
      ),
      inspect(
        "P-N6:benches",
        "Sprawdź trzy miejsca pracy",
        "workshop",
        ["Stanowisko naprawy", "Stanowisko konstrukcji", "Stanowisko zasilania"],
        [
          "Pozostawia użytkownikowi odłącznik.",
          "Zachowuje rozdział danych i części mechanicznych.",
          "Pozwala odmówić podłączenia bez utraty prawa do pomocy.",
        ],
      ),
      comparison(
        "P-N6:allocate",
        "Przydziel stanowiska zgodnie ze zleceniami",
        "workshop",
        recordFacts(
          "Naprawa trafia na stanowisko naprawy, konstrukcja na stanowisko budowy, a niezależne zasilanie ma własny odłącznik. Zgoda nie przechodzi automatycznie między użytkownikami.",
        ),
        "Przypisz trzy prace do odpowiednich stanowisk i zachowaj osobne zgody.",
        [
          "Połącz pamięci użytkowników, aby uprościć kolejkę.",
          "Odmów dostępu jednostkom spoza rejestru.",
        ],
        3,
      ),
      work("P-N6:open", "Otwórz warsztat z jawnymi zasadami", "workshop"),
    ],
    effect(
      "workshop",
      "W warsztacie pracują konkretne jednostki uratowane podczas osobistej historii.",
      [
        "Naprawiona jednostka",
        "Konstruktor sąsiedzkiego stanowiska",
        "Opiekun niezależnego zasilania",
      ],
      ["modules", "weapon"],
    ),
  ),
];

const legendProjects: WorldProjectDefinition[] = [
  project(
    "legend",
    1,
    "Plac Opanowania",
    [
      recover(
        "P-P1:targets",
        "Odbierz części trzech celów ćwiczebnych",
        "workshop",
        "P-P1:targets",
        "Część bezpiecznego celu",
        3,
      ),
      ...installs(
        "P-P1",
        ["Ustaw pierwszy cel ćwiczebny", "Ustaw drugi cel ćwiczebny", "Ustaw trzeci cel ćwiczebny"],
        "trainer",
        "P-P1:targets",
      ),
      work("P-P1:marks", "Ustaw oznaczenia dozwolonych okien", "trainer"),
      restraint(
        "P-P1:safety",
        "Przeprowadź próbę bezpieczeństwa bez uderzania poddającego się celu",
        3,
        true,
      ),
    ],
    effect(
      "training",
      "Na placu działa instruktor i próby kontroli ciosu.",
      ["Instruktor Placu Opanowania"],
      ["training"],
    ),
  ),
  project(
    "legend",
    2,
    "Rodzinne Kowadło",
    [
      inspect(
        "P-P2:inspect",
        "Sprawdź rodzinne kowadło i palenisko",
        "smith",
        ["Kowadło dawnego mistrza"],
        [
          "Kowadło zachowało poziomowanie. Trzy elementy paleniska trzeba wymienić przed próbą temperatury.",
        ],
      ),
      recover(
        "P-P2:parts",
        "Odzyskaj trzy części paleniska",
        "smith",
        "P-P2:parts",
        "Część rodzinnego paleniska",
        3,
      ),
      craft("P-P2:hearth", "Napraw palenisko", "smith", "P-P2:parts", 3, "repair"),
      comparison(
        "P-P2:temperature",
        "Sprawdź temperaturę według oznaczeń mistrza",
        "smith",
        recordFacts(
          "Kolejność próby: równy żar, kontrola uchwytu, stopniowe chłodzenie. Dawnych znaków nie usuwa się podczas sprawdzania metalu.",
        ),
        "Utrzymaj równy żar, sprawdź uchwyt i chłodź stopniowo.",
        [
          "Rozgrzej narzędzie bez kontroli uchwytu.",
          "Zetrzyj dawne znaki, aby łatwiej odczytać powierzchnię.",
        ],
        3,
      ),
    ],
    effect(
      "forge",
      "Rodzinne stanowisko broni jest sprawne i zachowuje zapis kolejnych napraw.",
      ["Opiekun rodzinnego kowadła"],
      ["weapon"],
    ),
  ),
  project(
    "legend",
    3,
    "Szlak Dawnej Straży",
    [
      inspect(
        "P-P3:route",
        "Rozpoznaj trzy lokalne przeszkody",
        "trail",
        ["Zawalony znak", "Zasypane dojście", "Uszkodzone podparcie"],
        [
          "Znak można naprawić bez naruszania skał kontynentu.",
          "Lokalna zapora blokuje krótkie dojście.",
          "Podparcie wymaga części z przygotowanej skrzyni.",
        ],
      ),
      work("P-P3:clear-1", "Usuń zaporę przy znaku", "trail"),
      work("P-P3:clear-2", "Oczyść zasypane dojście", "trail"),
      work("P-P3:clear-3", "Przywróć podparcie przejścia", "trail"),
      comparison(
        "P-P3:signs",
        "Odtwórz oznaczenia szlaku",
        "trail",
        recordFacts(
          "Trasa prowadzi od posterunku do osad i schronienia. Znak odwrotu ma być czytelny również dla wracających po spóźnionych.",
        ),
        "Oznacz drogę do osad, schronienia i bezpieczny powrót.",
        [
          "Oznacz wyłącznie kierunek dalszego pościgu.",
          "Zablokuj możliwość powrotu po opuszczeniu posterunku.",
        ],
        3,
      ),
    ],
    effect(
      "route",
      "Otwiera się lokalne przejście dawnej straży bez zmiany geometrii kontynentu.",
      [],
      [],
      true,
    ),
  ),
  project(
    "legend",
    4,
    "Tablica Uratowanych",
    [
      consent(
        "P-P4:consents",
        "Uzyskaj trzy zgody na wpis",
        "memorial",
        ["Rodzina strażnika", "Rodzina uratowanych", "Opiekun nieznanych imion"],
        "Czy wpis ma zawierać imię, czy zostać zanonimizowany?",
      ),
      recover(
        "P-P4:board",
        "Odbierz części tablicy",
        "workshop",
        "P-P4:board",
        "Część Tablicy Uratowanych",
        3,
      ),
      craft(
        "P-P4:prepare",
        "Przygotuj tablicę ze zgodnymi wpisami",
        "memorial",
        "P-P4:board",
        3,
        "repair",
      ),
      witness(
        "P-P4:unveil",
        "Odsłoń tablicę w obecności rodzin",
        "memorial",
        ["Przedstawiciel rodzin"],
        [
          "Wpisz także, czyjego imienia nie znamy. Puste miejsce może być uczciwsze od podpisu dopisanego dla porządku.",
          "Niech tablica nie zmieni jednego wymazania w wymazanie historii innego rodu.",
        ],
      ),
    ],
    effect(
      "memorial",
      "Na tablicy wracają uzgodnione imiona, oznaczone luki i reakcje mieszkańców.",
      ["Przedstawiciel rodzin"],
    ),
  ),
  project(
    "legend",
    5,
    "Schronienie na Trakcie",
    [
      recover(
        "P-P5:supplies",
        "Odbierz przygotowane zaopatrzenie",
        "workshop",
        "P-P5:supplies",
        "Pakiet zaopatrzenia schronienia",
        3,
      ),
      craft(
        "P-P5:store",
        "Rozłóż zaopatrzenie w schronieniu",
        "gate",
        "P-P5:supplies",
        3,
        "repair",
      ),
      work("P-P5:entry", "Zabezpiecz wejście bez zamykania odwrotu", "gate"),
      inspect(
        "P-P5:points",
        "Sprawdź dwa miejsca zbiórki",
        "trail",
        ["Pierwszy punkt zbiórki", "Drugi punkt zbiórki"],
        [
          "Pozostawia czytelną drogę dla spóźnionych.",
          "Pozwala wrócić pod osłonę bez wchodzenia przeciwników do miasta.",
        ],
      ),
      comparison(
        "P-P5:rest",
        "Zapisz zasady korzystania ze schronienia",
        "gate",
        recordFacts(
          "Schronienie jest miejscem spotkania i bezpiecznego odwrotu. Nie zeruje cooldownów ani nie odnawia zasobów za samą interakcję.",
        ),
        "Zachowaj drogę odwrotu, zapasy i uczciwy zapis stanu podróżnych.",
        [
          "Odnawiaj cooldowny po każdym wyjściu i wejściu.",
          "Zamknij wejście, gdy pojawią się spóźnieni.",
        ],
      ),
    ],
    effect(
      "shelter",
      "Działa schronienie z zaopatrzeniem i punktami zbiórki, bez darmowych resetów zasobów.",
      ["Opiekun Schronienia na Trakcie"],
    ),
  ),
  project(
    "legend",
    6,
    "Dziewiąte Palenisko",
    [
      comparison(
        "P-P6:rules",
        "Uzgodnij trzy zasady osobistej szkoły",
        "trainer",
        recordFacts(
          "Uczeń ma prawo przerwać próbę. Poddanie przerywa atak. Ochrona odwrotu jest częścią mistrzostwa.",
        ),
        "Prawo przerwania, uznanie poddania i osłona odwrotu.",
        [
          "Bezwarunkowe posłuszeństwo i obowiązkowy ostatni cios.",
          "Zakaz wycofania się z próby niezależnie od zagrożenia.",
        ],
        3,
      ),
      recover(
        "P-P6:hearth",
        "Odbierz części nowego paleniska",
        "smith",
        "P-P6:hearth",
        "Część Dziewiątego Paleniska",
        3,
      ),
      craft(
        "P-P6:prepare",
        "Przygotuj osobiste palenisko szkoły",
        "trainer",
        "P-P6:hearth",
        3,
        "repair",
      ),
      witness(
        "P-P6:students",
        "Zaproś uczniów i wysłuchaj ich pytań",
        "trainer",
        ["Uczeń opanowania", "Uczennica ochrony", "Wędrowny uczeń"],
        [
          "Chcemy wiedzieć, kiedy możemy odmówić i wrócić do nauki.",
          "Niech własna przysięga mistrza nie stanie się rozkazem, który odbiera uczniom ich głos.",
        ],
      ),
    ],
    effect(
      "school",
      "Przy Dziewiątym Palenisku uczą się zaproszeni mieszkańcy; epilog zależy od własnej przysięgi.",
      ["Uczeń opanowania", "Uczennica ochrony", "Wędrowny uczeń"],
      ["training"],
    ),
  ),
];

export const WORLD_PROJECTS: readonly WorldProjectDefinition[] = [
  ...planetaryProjects,
  ...sageProjects,
  ...androidProjects,
  ...legendProjects,
];
export const PROJECT_BY_ID = new Map(
  WORLD_PROJECTS.map((definition) => [definition.id, definition]),
);
export const HERITAGE_CHAPTERS_BY_RACE = Object.fromEntries(
  Object.keys(RACES).map((race) => [
    race,
    CHAPTERS.map((number) => HERITAGE_BY_ID.get(questId(race as RaceId, number))!),
  ]),
) as Record<RaceId, HeritageQuestDefinition[]>;
