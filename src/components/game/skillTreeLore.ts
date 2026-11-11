/**
 * Presentation-only flavour for the graphic skill tree: one short line of lore per node and a
 * motto per branch. Mechanics, numbers and names stay in `game/kit/nodes.generated.ts` (owner
 * annex 22.10.2026); nothing here changes how a skill works.
 */
import type { RaceId } from "../../game/world/races";

export const BRANCH_MOTTO: Record<RaceId, Record<"A" | "B" | "C", string>> = {
  planetary: {
    A: "Szybkość, uniki i cios, którego wróg nie zobaczy.",
    B: "Siła gruntu pod stopami: wstrząsy, ogłuszenia, kamień.",
    C: "Leczenie, tarcze z liści i cierpliwość starego lasu.",
  },
  sage: {
    A: "Znaki, które wybuchają światłem w najgorszym momencie.",
    B: "Kręgi i bariery: pole bitwy według zasad Mędrca.",
    C: "Ki płynące bez końca dla tego, kto umie oddychać.",
  },
  android: {
    A: "Namierz, policz, trafiaj tam, gdzie boli najbardziej.",
    B: "Płyty, tarcze plazmowe i pancerz, który oddaje cios.",
    C: "Ładunek Rdzenia: ryzyko przegrzania w zamian za moc.",
  },
  legend: {
    A: "Ostrza w płomieniach i kombinacje bez wytchnienia.",
    B: "Nieugięty wojownik, który wstaje po każdym ciosie.",
    C: "Żar zbierany w walce i uwalniany jednym wybuchem.",
  },
};

export const NODE_LORE: Record<RaceId, Record<string, string>> = {
  planetary: {
    R: "Pierwsza lekcja każdego wędrowca: trzy uderzenia, ostatnie najcięższe.",
    A1: "Krok w bok, zanim cios dosięgnie — ziemia pomaga tym, którzy jej słuchają.",
    A2: "Stopy, które przeszły tysiąc mil, nie czują już ciężaru drogi.",
    A3: "Każdy unik napina sprężynę, a następny cios ją zwalnia.",
    A4: "Wędrowiec obraca się w miejscu i wokół niego rodzi się wir energii.",
    A5: "Pokonany wróg zostawia za sobą wiatr, który niesie dalej.",
    A6: "Zwiadowca widzi szczelinę w pancerzu, zanim wróg się ruszy.",
    A7: "Z cienia uniku wychodzi cios, który zawsze trafia w serce.",
    A8: "Nikt nie złapie tego, kto znika szybciej, niż się pojawia.",
    A9: "Pięć uderzeń jak burza nad doliną — żaden wróg w pobliżu nie ustoi.",
    B1: "Pięść w ziemię: fala przechodzi przez grunt i zwalnia każdego w zasięgu.",
    B2: "Las, skała, woda — wojownik bierze siłę z tego, na czym stoi.",
    B3: "Skóra twardnieje jak granit omszałych zboczy.",
    B4: "Skok, lądowanie i pęknięta ziemia, która ogłusza wrogów.",
    B5: "Ziemia pamięta uderzenie i oddaje je drugi raz.",
    B6: "Każdy trafiony wróg oddaje cząstkę Ki żyle ziemi.",
    B7: "Z pękniętej ziemi wyrasta głaz, który przyjmuje ciosy za ciebie.",
    B8: "Impuls staje się trzęsieniem: szerszym i ogłuszającym.",
    B9: "Cała dolina odpowiada na wezwanie — jedno uderzenie, które kruszy szeregi.",
    C1: "Oddech korzeni płynie przez ciało i zasklepia rany.",
    C2: "Zielona krew drzew wzmacnia ciało wędrowca.",
    C3: "Poza walką las leczy powoli, ale bez przerwy.",
    C4: "Wir liści otacza postać i zatrzymuje ciosy.",
    C5: "Korzenie trzymają mocno — kontrola wroga szybciej puszcza.",
    C6: "Ziarno życia sprawia, że każdy oddech leczy mocniej.",
    C7: "Liście tarczy stają się kolcami dla tych, którzy biją z bliska.",
    C8: "Las oddaje to, co wziął: każde leczenie zwraca Ki.",
    C9: "Pieśń, którą słyszą wszystkie korzenie świata — leczy i osłania jednocześnie.",
    T: "Planeta oddycha razem z tobą. Każdy krok, cios i obrona rezonują z całym światem.",
  },
  sage: {
    R: "Skupione Ki wypuszczone z dłoni leci prosto i daleko.",
    A1: "Znak wypalony na celu tyka jak zegar, zanim rozbłyśnie.",
    A2: "Kto nosi pieczęć, ten jest odsłonięty na każdy cios.",
    A3: "Wprawna dłoń kreśli znaki szybciej, niż wróg mrugnie.",
    A4: "Strumień czystego Ki płynie z dłoni, dopóki Mędrzec go trzyma.",
    A5: "Wybuch pieczęci odbija się echem w sąsiednich wrogach.",
    A6: "Mędrzec zna każdą słabość, zanim ją zobaczy.",
    A7: "Pęknięta pieczęć zostawia złoty krąg, który parzy dalej.",
    A8: "Rozbłysk pieczęci wraca do Mędrca jako czyste Ki.",
    A9: "Niebo otwiera się na chwilę i spada słup osądzającego światła.",
    B1: "Kopuła światła przyjmuje ciosy przeznaczone dla Mędrca.",
    B2: "Każda zdolność zostawia krąg, w którym stoi się pewniej.",
    B3: "Światło gęstnieje i bariera trwa dłużej.",
    B4: "Krąg, w którym czas płynie wolniej dla wrogów.",
    B5: "Bariera odpowiada pociskom ich własną siłą.",
    B6: "Kto wejdzie w krąg Mędrca, ten uderza słabiej.",
    B7: "Bariera rośnie w szeroką, mocną kopułę.",
    B8: "Pierwszy cios odbija się od lustra światła w całości.",
    B9: "Pole bitwy staje się świątynią: sprzymierzeni twardnieją, wrogowie grzęzną.",
    C1: "Chwila ciszy i Ki napływa z powrotem — byle nikt nie przeszkodził.",
    C2: "Głęboki oddech poszerza naczynie, w którym mieszka Ki.",
    C3: "Strażnicy uczyli: najmocniejsza technika to ta, która kosztuje najmniej.",
    C4: "Medytacja w środku bitwy zasklepia rany.",
    C5: "Czysty umysł szybko wyrywa się z cudzej kontroli.",
    C6: "Po skupieniu następny czar uderza z pełną mocą.",
    C7: "Medytacja Mędrca leczy jak źródło w świątyni.",
    C8: "Mistrz skupia Ki nawet w biegu.",
    C9: "Pełnia: przez chwilę Ki nie ma dna, a każdy czar uderza mocniej.",
    T: "Oświecenie — Mędrzec widzi całe pole bitwy naraz, a techniki wracają szybciej niż kiedykolwiek.",
  },
  android: {
    R: "Impuls z działa, kalibrowany co strzał. Rdzeń grzeje się z każdym trafieniem.",
    A1: "Czerwony punkt na celu: od teraz każdy strzał szuka słabego miejsca.",
    A2: "Precyzyjna kalibracja optyki — więcej krytycznych trafień.",
    A3: "Stabilizatory pozwalają trafiać z większej odległości.",
    A4: "Trzy strzały w jeden punkt, wystrzelone szybciej niż myśl.",
    A5: "Analiza wskazuje pęknięcia w obronie oznaczonego celu.",
    A6: "Mechanizm przeładowania pracuje szybciej.",
    A7: "Tryb snajperski: wolniej, ale każdy strzał w oznaczony cel boli podwójnie.",
    A8: "Pocisk rozpada się w powietrzu i trafia trzy cele zamiast jednego.",
    A9: "Protokół egzekucji: jeden strzał, który kończy osłabionego wroga.",
    B1: "Pole plazmy osłania korpus i pochłania obrażenia.",
    B2: "Dodatkowe płyty pancerne na najczęściej trafianych miejscach.",
    B3: "Mocniejszy generator — tarcza wytrzymuje więcej.",
    B4: "Fala uderzeniowa odrzuca wszystkich w pobliżu i ogłusza.",
    B5: "Tarcza uczy się pocisków i odsyła je nadawcy.",
    B6: "Mikromaszyny w korpusie bez przerwy łatają uszkodzenia.",
    B7: "Kolce na tarczy karzą każdego, kto atakuje z bliska.",
    B8: "Modułowa tarcza wraca do pracy znacznie szybciej.",
    B9: "Fortyfikacja: android staje się bunkrem, którego nic nie przewróci.",
    C1: "Cały zebrany Ładunek uwolniony jednym promieniem.",
    C2: "Lepsze zarządzanie Rdzeniem — krótsze przegrzanie i szybsze chłodzenie.",
    C3: "Radiatory odprowadzają ciepło z każdego strzału.",
    C4: "Awaryjny zrzut ciepła naprawia część uszkodzeń.",
    C5: "Rezerwowy akumulator powiększa zapas Ki.",
    C6: "Zoptymalizowany cykl wyładowania pobiera mniej Ki.",
    C7: "Rdzeń pracuje ponad normę: więcej mocy, większe ryzyko.",
    C8: "Stabilny Rdzeń nie przegrzewa się nigdy, ale ma mniejszy pułap.",
    C9: "Wszystkie bezpieczniki wyłączone: kilka sekund bez limitów, potem cisza systemu.",
    T: "Pełny Rdzeń — każdy obwód pracuje na sto procent, a przegrzanie przestaje istnieć.",
  },
  legend: {
    R: "Każdy cios rozpala Żar, który karmi kolejne uderzenia.",
    A1: "Trzy cięcia rozżarzonym ostrzem, jedno po drugim.",
    A2: "Ostrza tak gorące, że rany płoną jeszcze długo po cięciu.",
    A3: "Seria trafień rozkręca wojownika do coraz szybszych ciosów.",
    A4: "Skok przez płomienie prosto do wroga i cięcie z rozpędu.",
    A5: "Pięści rozżarzone do czerwoności uderzają mocniej.",
    A6: "Legenda wie, gdzie uderzyć, żeby bolało najbardziej.",
    A7: "Cięcie zamienia się w taniec pięciu płomieni.",
    A8: "W pojedynku jeden na jeden Legenda nie ma sobie równych.",
    A9: "Tysiąc cięć, za którymi oko nie nadąża — zostaje tylko ogień.",
    B1: "Cios, który łamie osłony i powala przeciwnika.",
    B2: "Skóra zahartowana w ogniu niezliczonych walk.",
    B3: "Honor wojownika daje siłę, by wytrzymać więcej.",
    B4: "Szał płomieni: więcej siły w zamian za ostrożność.",
    B5: "W szale nic nie jest w stanie zatrzymać Legendy.",
    B6: "Krew pokonanego wroga leczy rany zwycięzcy.",
    B7: "Wściekłość, która płonie dłużej i goręcej.",
    B8: "Żar pod kontrolą — szał bez opuszczania gardy.",
    B9: "Ostatni płomień nie gaśnie: śmiertelny cios zostawia Legendę na nogach.",
    C1: "Ki wybucha wokół wojownika jak erupcja.",
    C2: "Żar rozpala się szybciej i dłużej się tli.",
    C3: "Wybuch pozostawia ogień, który pali dalej.",
    C4: "Cały zebrany Żar uwolniony w jednej eksplozji.",
    C5: "Legenda wchodzi do walki już rozgrzana.",
    C6: "Przy pełnym Żarze Ki płynie wartko jak lawa.",
    C7: "Eksplozja rozlewa się szeroko jak wybuch wulkanu.",
    C8: "Skupiony ładunek: mniejszy obszar, ale potężniejszy wybuch.",
    C9: "Kolumna ognia z nieba spala wszystko w szerokim kręgu.",
    T: "Płomienna Legenda — Żar nie opada, a każdy cios płonie pełną mocą.",
  },
};

/** Short facts (cost, cooldown, power, reach, control) read from the annex text. */
export type SkillFact = { icon: string; label: string; kind: string };

export function skillFacts(text: string): SkillFact[] {
  const out: SkillFact[] = [];
  const mult = text.match(/×\s?\(?(\d+(?:,\d+)?)/);
  if (mult) out.push({ icon: "✶", label: "×" + mult[1], kind: "power" });
  const reach = text.match(/(?:promień|zasięg)\s(\d+)\sj\./) ?? text.match(/\((\d+)\sj\.\)/);
  if (reach) out.push({ icon: "◎", label: reach[1] + " j.", kind: "reach" });
  const stun = text.match(/ogłusz\w*(?:\s\w+)?\s(\d+(?:,\d+)?)\ss/);
  if (stun) out.push({ icon: "✺", label: "ogłuszenie " + stun[1] + " s", kind: "control" });
  const slow = text.match(/spowolnienie\s(\d+)%/) ?? text.match(/−(\d+)%\sszybkości;/);
  if (slow) out.push({ icon: "❄", label: "spowolnienie " + slow[1] + "%", kind: "control" });
  const lasts = text.match(/^(\d+(?:,\d+)?)\ss:/) ?? text.match(/przez\s(\d+(?:,\d+)?)\ss/);
  if (lasts) out.push({ icon: "⏳", label: lasts[1] + " s", kind: "time" });
  if (/Bez kosztu Ki/.test(text)) out.push({ icon: "◇", label: "bez Ki", kind: "ki" });
  const ki = text.match(/;\s(\d+)\sKi;/);
  if (ki) out.push({ icon: "◆", label: ki[1] + " Ki", kind: "ki" });
  const cd = text.match(/odn\.\s(\d+(?:,\d+)?)\ss/);
  if (cd) out.push({ icon: "⟳", label: cd[1] + " s", kind: "cooldown" });
  return out;
}
