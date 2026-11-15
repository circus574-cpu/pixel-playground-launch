import type { RaceId } from "./races";

/**
 * Player-facing lore of the four origins (home page and character selection). Source: docs/FABULA-I-EKWIPUNEK.md
 * (premise, cultural principles, prologue contexts) and docs/RASY-I-POSTACIE.md (identity). Only what a new player may
 * know: the hidden truth of the campaign (who runs the Chór and why) is deliberately not mentioned.
 */
export type RaceLore = {
  /** Capital of the continent, where the prologue starts. */
  settlement: string;
  /** The principle the culture added to the Chór 180 years ago. */
  principle: string;
  /** Combat role and signature mechanic (docs/FABULA-I-EKWIPUNEK.md, class tables). */
  role: string;
  mechanic: string;
  /** What the first ability (R, no Ki cost) does. */
  starter: { name: string; text: string };
  /** Three short paragraphs: home, history, the present Silence. */
  biography: readonly [string, string, string];
};

export const RACE_LORE: Record<RaceId, RaceLore> = {
  planetary: {
    settlement: "Zielona Przystań",
    principle: "Zmienność",
    role: "Mobilny wojownik wręcz",
    mechanic: "Adaptacja do terenu",
    starter: {
      name: "Cios Szlaku",
      text: "Szybkie ciosy wręcz bez kosztu Ki; co trzeci cios serii zadaje o 30% więcej.",
    },
    biography: [
      "Verdantia nie ma jednej mapy: rzeka co sezon zmienia koryto, a las przesuwa własne ścieżki. Planetarni nauczyli się żyć w ruchu. Budują drewniane i kamienne domy, ale mosty, kuźnie i targowiska stawiają tak, by dało się je naprawić, przenieść albo zbudować na nowo. Ich zasada brzmi: co się nie dostosowuje, to się kruszy.",
      "Sto osiemdziesiąt lat temu, w czasie Wielkiego Rozstrojenia, cztery kultury zbudowały wspólną sieć zwaną Chórem, która uspokoiła przepływy KI na kontynentach. Planetarni dołożyli do niej swoją zasadę, zmienność. Dziś Zielona Przystań żyje z handlu, wypraw i drobnych napraw, a o dawnej katastrofie opowiada się głównie przy rzece.",
      "Trzy tygodnie temu nad doliną przyszła Cisza Korzeni: na siedem uderzeń serca energia KI przestaje słuchać woli. Zaczynasz jako zwykły mieszkaniec Zielonej Przystani, nie wybraniec z przepowiedni, za to z jedną rzadką zdolnością: potrafisz zapamiętać obcy dźwięk, którego inni nie słyszą. W mieście jest bezpiecznie, wrogowie nie wchodzą do dzielnic, a walka zaczyna się dopiero za jego granicą.",
    ],
  },
  sage: {
    settlement: "Sanktuarium Tysiąca Źródeł",
    principle: "Pamięć",
    role: "Mag dystansowy i wsparcie",
    mechanic: "Kręgi światła",
    starter: {
      name: "Pocisk Ki",
      text: "Pocisk dystansowy bez kosztu Ki, zasięg 420 jednostek; ceną dystansu jest wolniejszy rytm ataku.",
    },
    biography: [
      "Aetheria to górskie tarasy, gorące źródła i ogrody pod opieką wiekowych drzew. W Sanktuarium Tysiąca Źródeł prawie każdy kamień jest zapisem: pieczęcią, imieniem albo rachunkiem. Mędrcy wierzą, że wiedza jest formą potęgi, a pamięć jej najcenniejszym kształtem. Ich szkoły uczą energii, medytacji i starożytnych rytuałów.",
      "Gdy cztery kultury budowały Chór, Mędrcy przekazali mu swoją zasadę: pamięć. Prowadzą archiwa pieczęci i dzienników z czasów Wielkiego Rozstrojenia i pilnują, by nikt nie odłożył ich do szuflady. Spór, co z tej wiedzy wolno zapomnieć, trwa w Sanktuarium od pokoleń.",
      "Od trzech tygodni w pieczęciach brakuje jednego tonu, a Cisza wyłącza KI w najmniej oczekiwanych chwilach. Jesteś uczniem, nie wybrańcem, ale masz coś, czego nie mają starsi: pamięć, którą Cisza nie potrafi nadpisać. Sanktuarium jest strefą bez walki, a wyprawy zaczynają się dopiero za jego murami.",
    ],
  },
  android: {
    settlement: "Węzeł Świadomości",
    principle: "Precyzja",
    role: "Precyzyjny strzelec z tarczami",
    mechanic: "Ładunek Rdzenia",
    starter: {
      name: "Strzał Impulsowy",
      text: "Strzał bez kosztu Ki, zasięg 360 jednostek; każdy strzał ładuje rdzeń (+4), a przy 100 następuje 2 s przegrzania, więc rytm strzelania trzeba pilnować.",
    },
    biography: [
      "Nexus-9 to metaliczne równiny, pola kryształów i oświetlone korytarze dawnej sieci. Androidy są syntetycznymi odkrywcami, którzy zadają pytanie starsze od ich konstrukcji: gdzie kończy się maszyna, a zaczyna dusza? Odpowiadają na nie logiką, doskonaleniem i odpowiedzialnością za rozwój własnej świadomości.",
      "W budowie Chóru Androidy wniosły precyzję: dokładność pomiaru, zapisu i obliczenia, bez której sieć nie utrzymałaby równowagi przepływów KI. Do dziś Węzeł Świadomości jest miejscem, gdzie każdą decyzję się mierzy, a błąd zapisuje po to, by się go nie powtórzyło.",
      "Trzy tygodnie temu systemy Nexusa wykryły dziwną rzecz: ten sam pakiet rozkazów zapisany poza pamięcią urządzeń, w miejscu, do którego nikt nie powinien mieć dostępu. Zaczynasz jako nowy moduł w sieci, nie jako wyjątkowa jednostka, za to z pamięcią, której zakłócenie nie nadpisuje. Węzeł jest bezpieczną strefą, a walka zaczyna się dopiero poza jego perymetrem.",
    ],
  },
  legend: {
    settlement: "Twierdza Popiołu",
    principle: "Odwaga działania",
    role: "Wojownik w zwarciu i burst",
    mechanic: "Żar",
    starter: {
      name: "Uderzenie Żaru",
      text: "Cios wręcz bez kosztu Ki; każde trafienie rozpala Żar (+4), który zwiększa zadawane obrażenia do +10%, ale szybko opada poza walką.",
    },
    biography: [
      "Pyra to czerwone kaniony, obsydianowe skały i szczeliny rozżarzone pradawną energią. Wojownicze klany strzegą tu aren i ruin, w których nadal płonie siła dawnych mistrzów. Honor liczy się bardziej niż tytuły, a rywalizacja jest sposobem na naukę, nie na wrogość. Młodych uczą strażnicy dziedzictwa.",
      "Gdy cztery kultury budowały Chór, Legendy dały mu odwagę działania: gotowość, by ruszyć, zanim wszystko zostanie obliczone. To dzięki niej sieć uruchomiono na czas. Twierdza Popiołu pamięta tamte wyprawy w pieśniach i wypisanych na ścianach nazwiskach, ale też w sporach o to, kto przypłacił je zbyt wysoką ceną.",
      "Od trzech tygodni ogniska w Twierdzy nie gasną, lecz rzucają cudze cienie. Jesteś młodym wojownikiem, nie wybrańcem. W Twierdzy możesz spokojnie się przygotować: handlować, trenować i odpoczywać. Dopiero za jej granicą staniesz twarzą w twarz z tym, co płonie w kanionach.",
    ],
  },
};
