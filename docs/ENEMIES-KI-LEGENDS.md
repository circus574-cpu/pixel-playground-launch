# Ki Legends — 40 potworów (przeciwnicy NPC) — dokumentacja produkcyjna

**Data: 2026-10-22. Status: PRZYGOTOWANE W REPO, NIEZAINSTALOWANE W GRZE, NIEOCENIONE PRZEZ WŁAŚCICIELA** (poza podglądem pilota). Bossowie (8) **nie** należą do tej partii.
Źródło wymagań: bestiariusz właściciela [`design/BESTIARY-OWNER-2026-10-22.html`](design/BESTIARY-OWNER-2026-10-22.html) (obrazy tamże są tylko poglądowe; projekty wizualne potworów są własne). Surowe dane: `art/production/enemies/bestiary-owner.json`, wybrane projekty: `art/production/enemies/roster.json`, `selection-v1.json`.

## 1. Kontrakt wizualny (ten sam dla wszystkich)
- Paczka na potwora: **8 kierunków × 52 klatki = 416** (`idle 8`, `walk 8`, `attack 8`, `skill 8`, `hit 4`, `death 8`, `respawn 8`). Master 512×512 RGBA, dostawa 128×128, 2 strony atlasu ≤ 2048 px, profil `enemy` (rozmiar 84×84, origin `[0.5, 0.8]`).
- FPS: `idle 6`, `walk 16`, `attack 16`, `skill 12`, `hit 16`, `death 10`, `respawn 12`; `idle` i `walk` w pętli, pozostałe jednorazowo.
- Kierunki: `down`, `down-right`, `right`, `up-right`, `up` są malowane osobno; `left`, `down-left`, `up-left` są **dokładnymi lustrzanymi odbiciami** `right`, `down-right`, `up-right` (asymetria projektu jest więc odbijana).
- Punkt stóp stały: (256; 409,6) w masterze; latające i unoszące się potwory mają stopy podniesione o 36 px, a przy `death`/`respawn` lądują na ziemi.
- Atak: skok w stronę kierunku patrzenia, największe wychylenie w klatce 0, potem powrót. `skill`: pulsujące rozjaśnienie i powiększenie (sam efekt umiejętności nie jest częścią sprite'a). `hit`: biały błysk 60 → 35 → 15 → 0%, odrzut przeciwny do kierunku. `death`: opadanie i przyciemnienie wg archetypu; `respawn` to ten sam ruch odwrócony.
- Skala w ramce zależy od klasy rozmiaru (S 0,62 / M 0,80 / L 0,98 szerokości bazowej). Gdy animacja wychodzi poza margines bezpieczny (22 px), cały potwór jest zmniejszany (`shrink` w `report.json`).
- Kontrola: `report.json` w każdym wyjściu (`violations` musi być puste, `frames` = 416).

## 2. Powiększanie w grze bez GPU
Rozmiar potwora w świecie to pole `size` aktora w manifeście (domyślnie `[84, 84]`) i da się je zmienić tekstem. Klatki mają 128 px, więc **powiększenie do ok. 1,3× jest bezpieczne, powyżej ok. 1,3× obraz się rozmywa**. Ostrzejsze, większe klatki wymagałyby zmiany kontraktu (dostawa 128 px), więc to osobna decyzja; mastery 512 px są zachowane jako źródło. Zwiększenie bez GPU nie zmienia kolizji: footprint pozostaje w danych regionu.

## 3. Archetypy ruchu (animacja proceduralna deformacją siatki, bez szkieletu)
| Archetyp | Chód / bezruch | Śmierć |
|---|---|---|
| `blob` | podskok: ściska się i wyciąga w pionie, odbija się od ziemi | rozpłaszcza się i ciemnieje |
| `quad` | kłus: unoszą się naprzemiennie łapy, lekki przechył korpusu | przewraca się na bok (z boku) lub do przodu |
| `crawl` | drobne kroki: szybkie drżenie odnóży, korpus ledwo się unosi | przewraca się na grzbiet, odnóża w górze |
| `slither` | fala: fala biegnąca wzdłuż ciała | opada i spłaszcza się |
| `plant` | kołysanie: kołysze się od podstawy, korzeń nieruchomy | wygina się i opada |
| `turret` | prawie bez ruchu: drżenie górnej części, korpus stoi | przechyla się i ciemnieje (wygaszenie) |
| `fly` | trzepot: unosi się i opada, skrzydła na zmianę | spada na ziemię przechylony |
| `hover` | unoszenie: pływa w górę i w dół, lekkie pulsowanie | gaśnie i opada na ziemię |
| `stomp` | ciężki krok: podskok i nacisk kolejnych łap | opada na ziemię, spłaszcza się |

## 4. Wiązanie z grą — decyzja do podjęcia przez Codexa
Packer nadaje paczkom `actorBindings` `<świat>.enemy`, co dla 10 wrogów jednego świata **nadpisywałoby się nawzajem**. Walidator `scripts/lib/gpu-import.ts` dopuszcza tylko role `default|guide|hunter|merchant|smith`. Dlatego **paczki mają puste `actorBindings`**, a docelowe klucze `<świat>.enemy.<slug>` są w `art/production/enemies/bindings.json`. `actorVisual()` w `src/game/assets/catalog.ts` już szuka `<świat>.enemy.<rola>`, ale `worldAssets()` ładuje tylko `<świat>.enemy`. Do zrobienia przez Codexa: (1) rozszerzyć regex walidatora o `enemy.<slug>`, (2) w `worldAssets()` ładować wszystkie wizerunki wrogów danego świata, (3) przypisać potworom wygląd po ich id w definicjach wrogów regionu. Zmiana kolizji, statystyk i zachowań **nie jest** częścią tej partii.

## 5. Dane bestiariusza (wartości z dokumentu właściciela — nie wdrożone w kodzie gry)
Statystyki, zasięgi, zachowania i łupy poniżej są **kopią wymagań właściciela**, a nie opisem stanu implementacji.

### Verdantia

**Mchowy Szlamak** (`verdant-mchowy-szlamak`, poz. 1) — archetyp `blob` (podskok), rozmiar mały (0,62).
- Wygląd: a round moss covered slime with translucent green jelly body, tufts of moss and tiny mushrooms on top, two big glossy dull eyes.
- Statystyki: HP 73, ATK 5, DEF 4, XP 16; prędkość 0.5, zasięg 90, agro 250.
- Zachowanie: Błąka się w promieniu 300 j. od gniazda. Nie atakuje pierwszy; po zaczepieniu goni powoli, a po 6 s bez trafienia wraca i regeneruje HP.
- Umiejętności: Oblepienie (zwarcie, CD 5 s): −20% szybkości gracza przez 3 s
- Słabość: Ogień +30% obrażeń. Łup: Mchowa galaretka, Zielone ziele.
- Animacja: chód — ściska się i wyciąga w pionie, odbija się od ziemi; śmierć — rozpłaszcza się i ciemnieje.

**Cierniowy Wilk** (`verdant-cierniowy-wilk`, poz. 2) — archetyp `quad` (kłus), rozmiar średni (0,80).
- Wygląd: a lean dark green wolf with long sharp thorns along its spine and tail, vines wrapped around its legs, glowing amber eyes, snarling.
- Statystyki: HP 67, ATK 12, DEF 4, XP 24; prędkość 1.2, zasięg 90, agro 400.
- Zachowanie: Poluje w grupach po 2–3. Okrąża cel i atakuje z flanki; przy HP poniżej 25% wycofuje się na 4 s.
- Umiejętności: Skok na cel (CD 6 s): 120% ATK; Wycie (1× na walkę): wzywa 1 sojusznika z okolicy
- Słabość: Obrażenia obszarowe (grupa). Łup: Cierń wilka, Skóra wilcza.
- Animacja: chód — unoszą się naprzemiennie łapy, lekki przechył korpusu; śmierć — przewraca się na bok (z boku) lub do przodu.

**Liściak Skrytobójca** (`verdant-lisciak-skrytobojca`, poz. 4) — archetyp `crawl` (drobne kroki), rozmiar średni (0,80).
- Wygląd: a mantis like leaf assassin insect with two leaf shaped blade arms, leaf shaped wings, camouflage green body, sharp glowing eyes.
- Statystyki: HP 95, ATK 23, DEF 4, XP 42; prędkość 1.1, zasięg 90, agro 200.
- Zachowanie: Nieruchomy i niewidoczny w krzakach. Wyskakuje, gdy gracz wejdzie w 200 j.; po pierwszym ciosie ucieka i chowa się na 8 s.
- Umiejętności: Cios z ukrycia (×2 obrażeń, tylko pierwszy atak); Krwawienie (3 s)
- Słabość: Ujawnia się po trafieniu obszarowym. Łup: Zielone ostrze, Sok liściaka.
- Animacja: chód — szybkie drżenie odnóży, korpus ledwo się unosi; śmierć — przewraca się na grzbiet, odnóża w górze.

**Korzeniowy Pełzacz** (`verdant-korzeniowy-pelzacz`, poz. 6) — archetyp `slither` (fala), rozmiar duży (0,98).
- Wygląd: a long writhing serpent made of twisted brown tree roots, a bulb shaped head with small yellow flowers and a lamprey mouth.
- Statystyki: HP 255, ATK 20, DEF 13, XP 60; prędkość 0.4, zasięg 160, agro 300.
- Zachowanie: Ukryty pod ziemią. Wynurza się pod graczem, unieruchamia go i wraca pod ziemię na 4 s (nietykalny).
- Umiejętności: Oplątanie (CD 10 s): unieruchomienie 2 s; Wybuch korzeni (obszar 120 j.)
- Słabość: Ogień; w chwili wynurzenia +25% obrażeń. Łup: Żywy korzeń, Nasiona.
- Animacja: chód — fala biegnąca wzdłuż ciała; śmierć — opada i spłaszcza się.

**Grzybowy Zarodnik** (`verdant-grzybowy-zarodnik`, poz. 8) — archetyp `plant` (kołysanie), rozmiar średni (0,80).
- Wygląd: a giant red capped mushroom creature with white spots, a small angry face on its stalk, clouds of spores puffing from the cap, short root legs.
- Statystyki: HP 370, ATK 23, DEF 11, XP 76; prędkość 0, zasięg 350, agro 350.
- Zachowanie: Stacjonarny. Rzuca chmury zarodników w stronę gracza, nigdy się nie przemieszcza. Po śmierci wybucha chmurą.
- Umiejętności: Chmura zarodników (CD 7 s): obszar 150 j., trucizna 5 s; Wybuch po śmierci
- Słabość: Ogień +40%; szybkie zabicie z daleka. Łup: Zarodniki, Czerwony grzyb.
- Animacja: chód — kołysze się od podstawy, korzeń nieruchomy; śmierć — wygina się i opada.

**Bursztynowa Osa** (`verdant-bursztynowa-osa`, poz. 10) — archetyp `fly` (trzepot), rozmiar średni (0,80).
- Wygląd: a big amber colored wasp with translucent veined wings and a glowing amber stinger, black and gold stripes, flying.
- Statystyki: HP 238, ATK 39, DEF 10, XP 80; prędkość 1.4, zasięg 300, agro 450.
- Zachowanie: Lata nad celem, nurkuje i dystansuje się. Po 3 atakach odlatuje na 3 s. Poniżej 40% HP przyzywa 2 małe osy.
- Umiejętności: Żądło (CD 3 s): lekka trucizna; Rój (1× na walkę): 2 małe osy
- Słabość: Obrażenia obszarowe. Łup: Bursztyn, Żądło osy.
- Animacja: chód — unosi się i opada, skrzydła na zmianę; śmierć — spada na ziemię przechylony.

**Skalny Jeleń** (`verdant-skalny-jelen`, poz. 12) — archetyp `quad` (kłus), rozmiar duży (0,98).
- Wygląd: a powerful stag with stone plated hide, grey rock antlers, moss on its back and glowing green eyes.
- Statystyki: HP 594, ATK 39, DEF 28, XP 118; prędkość 1, zasięg 100, agro 300.
- Zachowanie: Pasie się i jest nieagresywny do czasu ataku. Po zaczepieniu szarżuje w linii prostej.
- Umiejętności: Szarża (CD 8 s): 150% ATK + ogłuszenie 1 s; Tupnięcie (obszar)
- Słabość: Po chybionej szarży odsłonięty 2 s (−30% DEF). Łup: Poroże, Skalna skóra.
- Animacja: chód — unoszą się naprzemiennie łapy, lekki przechył korpusu; śmierć — przewraca się na bok (z boku) lub do przodu.

**Leśny Pająk** (`verdant-lesny-pajak`, poz. 14) — archetyp `crawl` (drobne kroki), rozmiar średni (0,80).
- Wygląd: a forest spider with dark green carapace marked with leaf patterns, long spindly legs and silk strands.
- Statystyki: HP 516, ATK 48, DEF 21, XP 119; prędkość 0.9, zasięg 280, agro 400.
- Zachowanie: Zastawia do 3 sieci w promieniu 300 j., wabi gracza i atakuje z dystansu. Poza siecią porusza się wolniej.
- Umiejętności: Sieć: spowolnienie 40% przez 4 s; Plwocina (CD 6 s): trucizna
- Słabość: Ogień niszczy sieci i zadaje +30%. Łup: Jedwab pająka, Jad.
- Animacja: chód — szybkie drżenie odnóży, korpus ledwo się unosi; śmierć — przewraca się na grzbiet, odnóża w górze.

**Puchacz Pyłowy** (`verdant-puchacz-pylowy`, poz. 16) — archetyp `fly` (trzepot), rozmiar średni (0,80).
- Wygląd: a large horned owl with dusty grey brown feathers, glowing yellow eyes, wings spread and trailing a cloud of dust.
- Statystyki: HP 554, ATK 63, DEF 18, XP 140; prędkość 1.3, zasięg 120, agro 500.
- Zachowanie: Aktywny nocą; w dzień ma 50% promienia agro. Krąży i nurkuje na cele z HP poniżej 60%.
- Umiejętności: Nurkowanie (CD 5 s): 130% ATK; Pył w oczy: −25% celności na 4 s
- Słabość: Po nurkowaniu wolniejszy przez 1 s. Łup: Pióro puchacza, Pył.
- Animacja: chód — unosi się i opada, skrzydła na zmianę; śmierć — spada na ziemię przechylony.

**Strażnik Ruin** (`verdant-straznik-ruin`, poz. 18) — archetyp `stomp` (ciężki krok), rozmiar duży (0,98).
- Wygląd: an ancient overgrown stone golem with moss and vines on its shoulders, glowing green runes and a heavy stone hammer fist.
- Statystyki: HP 1448, ATK 60, DEF 58, XP 218; prędkość 0.6, zasięg 100, agro 300.
- Zachowanie: Patroluje stałą trasę w ruinach. Po wykryciu blokuje ścieżkę; nie opuszcza obszaru (leash 500 j.).
- Umiejętności: Cios młotem (CD 6 s, telegraf 1 s): 180% ATK; Kamienna skóra (CD 20 s): −40% obrażeń przez 4 s
- Słabość: Obrażenia KI +25%. Łup: Kamień runiczny, Fragment ruin.
- Animacja: chód — podskok i nacisk kolejnych łap; śmierć — opada na ziemię, spłaszcza się.


### Aetheria

**Świetlik Pieczęci** (`aether-swietlik-pieczeci`, poz. 1) — archetyp `hover` (unoszenie), rozmiar mały (0,62).
- Wygląd: a floating glowing orb spirit of gold and emerald light with a small ring of runes orbiting it.
- Statystyki: HP 43, ATK 6, DEF 2, XP 13; prędkość 0.7, zasięg 250, agro 300.
- Zachowanie: Dryfuje wokół wyznaczonej pieczęci. Strzela iskrą z dystansu i utrzymuje odległość, nie opuszcza strefy pieczęci.
- Umiejętności: Iskra (CD 2,5 s): obrażenia KI
- Słabość: Obrażenia fizyczne +20%. Łup: Pył światła.
- Animacja: chód — pływa w górę i w dół, lekkie pulsowanie; śmierć — gaśnie i opada na ziemię.

**Pergaminowy Strażnik** (`aether-pergaminowy-straznik`, poz. 2) — archetyp `stomp` (ciężki krok), rozmiar średni (0,80).
- Wygląd: a tall robed guardian made of folded parchment scrolls with glowing gold runes written on it and a blank mask for a face.
- Statystyki: HP 84, ATK 10, DEF 4, XP 24; prędkość 0.8, zasięg 300, agro 300.
- Zachowanie: Stoi w bibliotece. Po wykryciu rzuca runami z dystansu i przesuwa się za osłony.
- Umiejętności: Runa (CD 4 s); Zapieczętowanie (CD 15 s): blokada umiejętności gracza na 2 s
- Słabość: Ogień +30%. Łup: Karta pergaminu.
- Animacja: chód — podskok i nacisk kolejnych łap; śmierć — opada na ziemię, spłaszcza się.

**Kryształowy Motyl** (`aether-krysztalowy-motyl`, poz. 4) — archetyp `fly` (trzepot), rozmiar średni (0,80).
- Wygląd: a large butterfly with prism crystal wings that refract emerald and pale gold light, delicate crystal antennae.
- Statystyki: HP 82, ATK 12, DEF 10, XP 27; prędkość 1.2, zasięg 90, agro 250.
- Zachowanie: Łopocze po okolicy i nie atakuje pierwszy. Po trafieniu odbija część obrażeń w napastnika.
- Umiejętności: Odbicie (pasywne): 15% obrażeń wraca; Pyłek: oślepienie 2 s
- Słabość: Obrażenia obszarowe i KI omijają odbicie. Łup: Skrzydło kryształowe.
- Animacja: chód — unosi się i opada, skrzydła na zmianę; śmierć — spada na ziemię przechylony.

**Szmaragdowy Wąż** (`aether-szmaragdowy-waz`, poz. 6) — archetyp `slither` (fala), rozmiar średni (0,80).
- Wygląd: an emerald green serpent with gold markings, a jewel on its forehead and a raised hooded neck.
- Statystyki: HP 196, ATK 24, DEF 10, XP 57; prędkość 1, zasięg 100, agro 350.
- Zachowanie: Czai się w trawie. Atakuje dwukrotnie i wycofuje się; nie ściga dalej niż 400 j.
- Umiejętności: Ukąszenie: trucizna 5 s (do 3 stacków); Syk: −20% szybkości gracza
- Słabość: Obrażenia KI +20%. Łup: Szmaragdowa łuska.
- Animacja: chód — fala biegnąca wzdłuż ciała; śmierć — opada i spłaszcza się.

**Duch Bibliotekarza** (`aether-duch-bibliotekarza`, poz. 8) — archetyp `hover` (unoszenie), rozmiar średni (0,80).
- Wygląd: a translucent ghost of an old librarian with round spectacles, a floating robe trailing into wisps, pale blue white glow, holding a book.
- Statystyki: HP 211, ATK 25, DEF 4, XP 59; prędkość 0.9, zasięg 250, agro 300.
- Zachowanie: Przenika przez regały (ignoruje kolizje) i dryfuje do gracza. Po pierwszej śmierci powraca raz z 30% HP.
- Umiejętności: Uciszenie (CD 12 s): blokada umiejętności 3 s; Szept: −15% obrażeń gracza przez 4 s
- Słabość: Obrażenia KI +50%, fizyczne −40%. Łup: Eter bibliotekarza.
- Animacja: chód — pływa w górę i w dół, lekkie pulsowanie; śmierć — gaśnie i opada na ziemię.

**Złoty Skarabeusz** (`aether-zloty-skarabeusz`, poz. 10) — archetyp `crawl` (drobne kroki), rozmiar mały (0,62).
- Wygląd: a golden scarab beetle with an ornate engraved shell set with emerald gems and strong front legs.
- Statystyki: HP 510, ATK 30, DEF 31, XP 100; prędkość 0.7, zasięg 90, agro 300.
- Zachowanie: Maszeruje powoli w zwarciu. Po 3 otrzymanych trafieniach zwija się na 3 s (−70% obrażeń).
- Umiejętności: Rozbicie bariery: usuwa osłonę gracza; Taran (CD 9 s)
- Słabość: Obrażenia KI +30%; po zwinięciu odkryty. Łup: Złoty pancerz, Skarabeusz.
- Animacja: chód — szybkie drżenie odnóży, korpus ledwo się unosi; śmierć — przewraca się na grzbiet, odnóża w górze.

**Lew Świątyni** (`aether-lew-swiatyni`, poz. 12) — archetyp `quad` (kłus), rozmiar duży (0,98).
- Wygląd: a living cream marble temple lion statue with gold ornament, emerald eyes and a carved mane.
- Statystyki: HP 678, ATK 46, DEF 30, XP 136; prędkość 1, zasięg 100, agro 350.
- Zachowanie: Posąg aktywowany wejściem w strefę. Walczy do końca; nie goni dalej niż 450 j. i wraca na postument.
- Umiejętności: Ryk (CD 14 s): strach 1,5 s; Pazur: 150% ATK
- Słabość: Runa na karku: trafienie w plecy +25%. Łup: Kamień świątynny.
- Animacja: chód — unoszą się naprzemiennie łapy, lekki przechył korpusu; śmierć — przewraca się na bok (z boku) lub do przodu.

**Oko Wiedzy** (`aether-oko-wiedzy`, poz. 14) — archetyp `hover` (unoszenie), rozmiar średni (0,80).
- Wygląd: a floating giant eye in an ornate golden frame with a ring of glowing runes and an emerald iris.
- Statystyki: HP 464, ATK 40, DEF 18, XP 103; prędkość 0.5, zasięg 400, agro 450.
- Zachowanie: Lewituje i prawie nie atakuje. Oznacza gracza i wzmacnia sojuszników; po 2 trafieniach ucieka.
- Umiejętności: Znak (CD 10 s): +20% obrażeń od sojuszników; Promień skupienia (CD 6 s); Wzmocnienie: +15% obrażeń sojusznika
- Słabość: Priorytetowy cel do zabicia. Łup: Soczewka wiedzy.
- Animacja: chód — pływa w górę i w dół, lekkie pulsowanie; śmierć — gaśnie i opada na ziemię.

**Marionetka Rytuału** (`aether-marionetka-rytualu`, poz. 16) — archetyp `stomp` (ciężki krok), rozmiar średni (0,80).
- Wygląd: a ritual puppet with wooden jointed limbs held by glowing strings, a white mask with gold lines and an ornate ceremonial robe.
- Statystyki: HP 739, ATK 59, DEF 26, XP 153; prędkość 0.9, zasięg 100, agro 350.
- Zachowanie: Agresywna, nigdy się nie wycofuje. Po zniszczeniu nici (poniżej 30% HP) traci część szybkości.
- Umiejętności: Combo 3 ciosów; Nić energii (CD 12 s): przyciąga cel
- Słabość: Obrażenia fizyczne +15%. Łup: Nić eteru, Maska rytuału.
- Animacja: chód — podskok i nacisk kolejnych łap; śmierć — opada na ziemię, spłaszcza się.

**Mgielny Żuraw** (`aether-mgielny-zuraw`, poz. 18) — archetyp `fly` (trzepot), rozmiar duży (0,98).
- Wygląd: a tall crane made of mist and pale feathers with a long beak and long legs, fog trailing from its wings.
- Statystyki: HP 724, ATK 65, DEF 26, XP 156; prędkość 1.1, zasięg 350, agro 500.
- Zachowanie: Krąży nad sanktuarium, rzuca mgłę i zniża się do ataku. Ucieka poniżej 20% HP.
- Umiejętności: Mgła: widoczność −50% przez 5 s; Szpon z powietrza (CD 5 s)
- Słabość: Ataki dystansowe. Łup: Pióro mgły.
- Animacja: chód — unosi się i opada, skrzydła na zmianę; śmierć — spada na ziemię przechylony.


### Nexus-9

**Dron Zwiadowca** (`nexus-dron-zwiadowca`, poz. 1) — archetyp `hover` (unoszenie), rozmiar mały (0,62).
- Wygląd: a small scout drone with a silver body, a single blue glowing lens and two spinning rotors.
- Statystyki: HP 37, ATK 6, DEF 2, XP 12; prędkość 1.1, zasięg 250, agro 450.
- Zachowanie: Patroluje stałą trasę. Po wykryciu gracza piszczy i wzywa 1 sojusznika, następnie strzela krótkimi seriami.
- Umiejętności: Wiązka (CD 3 s); Alarm (1× na walkę)
- Słabość: Obrażenia elektryczne +30%. Łup: Złom, Moduł optyczny.
- Animacja: chód — pływa w górę i w dół, lekkie pulsowanie; śmierć — gaśnie i opada na ziemię.

**Pełzacz Serwisowy** (`nexus-pelzacz-serwisowy`, poz. 2) — archetyp `crawl` (drobne kroki), rozmiar mały (0,62).
- Wygląd: a six legged maintenance crawler robot with small repair arms, a welding tool and orange service lights on a silver body.
- Statystyki: HP 76, ATK 7, DEF 5, XP 19; prędkość 0.7, zasięg 90, agro 250.
- Zachowanie: Trzyma się innych maszyn i naprawia je. Sam atakuje tylko wtedy, gdy nie ma kogo naprawiać.
- Umiejętności: Naprawa (CD 6 s): 5% HP/s sojusznikom w 200 j.; Kleszcze
- Słabość: Priorytetowy cel; elektryczne +30%. Łup: Zestaw naprawczy.
- Animacja: chód — szybkie drżenie odnóży, korpus ledwo się unosi; śmierć — przewraca się na grzbiet, odnóża w górze.

**Skaner Gąsienicowy** (`nexus-skaner-gasienicowy`, poz. 4) — archetyp `stomp` (ciężki krok), rozmiar duży (0,98).
- Wygląd: a slow tracked scanner robot with a big lens turret on caterpillar treads and a sensor dish.
- Statystyki: HP 177, ATK 15, DEF 10, XP 44; prędkość 0.5, zasięg 400, agro 450.
- Zachowanie: Wolny. Utrzymuje dystans 300 j. i cofa się, gdy gracz podejdzie.
- Umiejętności: Wiązka skanująca (CD 5 s): rosnące obrażenia przy kolejnych trafieniach; Namierzenie: +20% obrażeń następnego ataku
- Słabość: Martwy kąt z tyłu +25%. Łup: Gąsienica, Soczewka.
- Animacja: chód — podskok i nacisk kolejnych łap; śmierć — opada na ziemię, spłaszcza się.

**Pająk Spawalniczy** (`nexus-pajak-spawalniczy`, poz. 6) — archetyp `crawl` (drobne kroki), rozmiar średni (0,80).
- Wygląd: a robotic welding spider with a plasma torch on its abdomen, sparks, and graphite legs with blue joints.
- Statystyki: HP 196, ATK 26, DEF 10, XP 60; prędkość 1, zasięg 150, agro 350.
- Zachowanie: Wspina się po konstrukcjach i spada na cel. Zostawia strefy gorącego metalu.
- Umiejętności: Łuk spawalniczy (CD 5 s); Strefa żaru: obrażenia przez 4 s
- Słabość: Obrażenia elektryczne +20%. Łup: Elektroda, Złom.
- Animacja: chód — szybkie drżenie odnóży, korpus ledwo się unosi; śmierć — przewraca się na grzbiet, odnóża w górze.

**Wieżyczka Autonomiczna** (`nexus-wiezyczka-autonomiczna`, poz. 8) — archetyp `turret` (prawie bez ruchu), rozmiar średni (0,80).
- Wygląd: a stationary autonomous turret on a wide base with twin rotating gun barrels and a blue targeting light.
- Statystyki: HP 396, ATK 35, DEF 21, XP 96; prędkość 0, zasięg 450, agro 500.
- Zachowanie: Nieruchoma. Obraca się 90°/s, więc można ją obejść z flanki. Strzela seriami; po 12 strzałach przegrzewa się.
- Umiejętności: Seria 3 pocisków (CD 4 s); Przegrzanie: wyłączona na 3 s
- Słabość: Flankowanie i przegrzanie. Łup: Cewka, Lufa.
- Animacja: chód — drżenie górnej części, korpus stoi; śmierć — przechyla się i ciemnieje (wygaszenie).

**Rój Nanitów** (`nexus-roj-nanitow`, poz. 10) — archetyp `blob` (podskok), rozmiar średni (0,80).
- Wygląd: a shifting blob of liquid silver nanites with glowing blue particles swirling inside it.
- Statystyki: HP 272, ATK 30, DEF 10, XP 72; prędkość 1.2, zasięg 90, agro 350.
- Zachowanie: Po otrzymaniu obrażeń rozdziela się na 2 części po 40% HP (maks. 1×). Jeśli obie żyją po 6 s, łączą się z powrotem.
- Umiejętności: Nanoprzeżarcie: −10% DEF gracza (do 3 stacków)
- Słabość: Obrażenia obszarowe, EMP. Łup: Nanopył.
- Animacja: chód — ściska się i wyciąga w pionie, odbija się od ziemi; śmierć — rozpłaszcza się i ciemnieje.

**Pies Łowca** (`nexus-pies-lowca`, poz. 12) — archetyp `quad` (kłus), rozmiar średni (0,80).
- Wygląd: a sleek robotic hunting hound with silver armor plates, a blue visor for eyes and hydraulic legs.
- Statystyki: HP 424, ATK 49, DEF 18, XP 113; prędkość 1.4, zasięg 90, agro 600.
- Zachowanie: Wybiera cel z najniższym HP w grupie i goni go do końca; ignoruje innych.
- Umiejętności: Skok (CD 6 s); Szarpnięcie: 120% ATK
- Słabość: Ogłuszenia i spowolnienia. Łup: Siłownik, Czujnik.
- Animacja: chód — unoszą się naprzemiennie łapy, lekki przechył korpusu; śmierć — przewraca się na bok (z boku) lub do przodu.

**Strażnik Rdzenia** (`nexus-straznik-rdzenia`, poz. 14) — archetyp `stomp` (ciężki krok), rozmiar duży (0,98).
- Wygląd: a heavy armored android guard with a glowing energy core on its chest and a plasma shield on its arm.
- Statystyki: HP 877, ATK 52, DEF 41, XP 162; prędkość 0.8, zasięg 120, agro 350.
- Zachowanie: Chroni wyznaczony obiekt; nie goni dalej niż 500 j. Poniżej 50% HP aktywuje tarczę plazmową.
- Umiejętności: Tarcza plazmowa (CD 25 s): absorbuje 25% max HP; Cios impulsowy (CD 6 s)
- Słabość: Obrażenia elektryczne zdejmują tarczę 2× szybciej. Łup: Rdzeń energii, Płyta pancerna.
- Animacja: chód — podskok i nacisk kolejnych łap; śmierć — opada na ziemię, spłaszcza się.

**Latarnia Plazmowa** (`nexus-latarnia-plazmowa`, poz. 16) — archetyp `hover` (unoszenie), rozmiar średni (0,80).
- Wygląd: a floating lantern drone with a glowing plasma core inside a cage of rings and crackling sparks.
- Statystyki: HP 616, ATK 72, DEF 21, XP 159; prędkość 0.3, zasięg 450, agro 500.
- Zachowanie: Wolno dryfuje. Ładuje wyładowanie przez 2,5 s (widoczne ostrzeżenie), które trzeba przerwać lub uniknąć.
- Umiejętności: Wyładowanie plazmy (CD 9 s): 250% ATK, obszar; Iskra
- Słabość: Przerwanie ładowania ogłusza ją na 2 s. Łup: Rdzeń plazmy.
- Animacja: chód — pływa w górę i w dół, lekkie pulsowanie; śmierć — gaśnie i opada na ziemię.

**Kruk Danych** (`nexus-kruk-danych`, poz. 18) — archetyp `fly` (trzepot), rozmiar średni (0,80).
- Wygląd: a robotic raven with wing feathers made of glowing blue data lines and a silver beak.
- Statystyki: HP 579, ATK 60, DEF 23, XP 136; prędkość 1.3, zasięg 300, agro 500.
- Zachowanie: Lata wysoko. Zakłóca interfejs i oznacza gracza maszynom; ucieka poniżej 30% HP.
- Umiejętności: Zakłócenie (CD 14 s): ukrywa minimapę na 4 s; Znak łowcy: +15% obrażeń maszyn
- Słabość: Obrażenia elektryczne +30%. Łup: Pamięć danych.
- Animacja: chód — unosi się i opada, skrzydła na zmianę; śmierć — spada na ziemię przechylony.


### Pyra

**Węgielek** (`pyra-wegielek`, poz. 1) — archetyp `blob` (podskok), rozmiar mały (0,62).
- Wygląd: a small rolling lump of glowing coal with ember cracks, sparks and a cute angry face.
- Statystyki: HP 61, ATK 7, DEF 3, XP 16; prędkość 0.6, zasięg 90, agro 250.
- Zachowanie: Powoli toczy się do celu. Po śmierci eksploduje (40% ATK w 120 j.).
- Umiejętności: Kontakt ognia: palenie 3 s; Wybuch po śmierci
- Słabość: Woda/zimno +30%. Łup: Węgiel.
- Animacja: chód — ściska się i wyciąga w pionie, odbija się od ziemi; śmierć — rozpłaszcza się i ciemnieje.

**Ognista Salamandra** (`pyra-ognista-salamandra`, poz. 2) — archetyp `slither` (fala), rozmiar średni (0,80).
- Wygląd: a fire salamander with red orange skin, flames licking along its back and a long tail.
- Statystyki: HP 67, ATK 12, DEF 3, XP 24; prędkość 1.2, zasięg 100, agro 400.
- Zachowanie: Szybko biega i zostawia płonący ślad na 3 s. Unika walki z grupami.
- Umiejętności: Ugryzienie: palenie 3 s; Ślad ognia
- Słabość: Woda/zimno +30%. Łup: Łuska salamandry.
- Animacja: chód — fala biegnąca wzdłuż ciała; śmierć — opada i spłaszcza się.

**Popielny Wilk** (`pyra-popielny-wilk`, poz. 4) — archetyp `quad` (kłus), rozmiar średni (0,80).
- Wygląd: a grey ash wolf with cinder like fur crumbling into ash and glowing ember eyes.
- Statystyki: HP 122, ATK 18, DEF 6, XP 40; prędkość 1.2, zasięg 90, agro 450.
- Zachowanie: Stado po 3. Wyłania się z popiołu i atakuje z flanki; poniżej 30% HP chowa się w popiele i regeneruje przez 5 s.
- Umiejętności: Skok (CD 6 s); Obłok popiołu: widoczność −30% przez 4 s
- Słabość: Obrażenia obszarowe. Łup: Popielne futro.
- Animacja: chód — unoszą się naprzemiennie łapy, lekki przechył korpusu; śmierć — przewraca się na bok (z boku) lub do przodu.

**Skalny Berserker** (`pyra-skalny-berserker`, poz. 6) — archetyp `stomp` (ciężki krok), rozmiar duży (0,98).
- Wygląd: a hulking rock berserker with basalt armor plates, crimson war paint and huge stone fists.
- Statystyki: HP 255, ATK 28, DEF 11, XP 70; prędkość 1, zasięg 100, agro 350.
- Zachowanie: Atakuje bez wycofania. Im mniej HP, tym więcej obrażeń (do +40% poniżej 30% HP).
- Umiejętności: Młot (CD 5 s); Wściekłość (poniżej 50% HP): +20% szybkości ataku
- Słabość: Ogłuszenia; zabić szybko. Łup: Skalny kastet.
- Animacja: chód — podskok i nacisk kolejnych łap; śmierć — opada na ziemię, spłaszcza się.

**Magmowy Krab** (`pyra-magmowy-krab`, poz. 8) — archetyp `crawl` (drobne kroki), rozmiar średni (0,80).
- Wygląd: a giant lava crab with an obsidian shell split by glowing magma cracks and two huge claws.
- Statystyki: HP 396, ATK 25, DEF 28, XP 83; prędkość 0.6, zasięg 100, agro 300.
- Zachowanie: Ustawia się bokiem. Od frontu przyjmuje −60% obrażeń, z tyłu i boków jest podatny.
- Umiejętności: Kleszcze (CD 5 s); Zalew magmą: strefa 4 s
- Słabość: Atak z tyłu +40%; woda. Łup: Magmowy pancerz.
- Animacja: chód — szybkie drżenie odnóży, korpus ledwo się unosi; śmierć — przewraca się na grzbiet, odnóża w górze.

**Żarowy Nietoperz** (`pyra-zarowy-nietoperz`, poz. 10) — archetyp `fly` (trzepot), rozmiar średni (0,80).
- Wygląd: a fiery bat with ember glowing wing membranes, orange veins and sharp fangs.
- Statystyki: HP 238, ATK 36, DEF 10, XP 76; prędkość 1.4, zasięg 100, agro 500.
- Zachowanie: Roje po 3. Krążą nad kraterami i atakują nurkując, po czym unikają kontrataku.
- Umiejętności: Nurkowanie (CD 4 s); Iskry: palenie 2 s
- Słabość: Obrażenia obszarowe. Łup: Skrzydło żaru.
- Animacja: chód — unosi się i opada, skrzydła na zmianę; śmierć — spada na ziemię przechylony.

**Golem Ruin** (`pyra-golem-ruin`, poz. 12) — archetyp `stomp` (ciężki krok), rozmiar duży (0,98).
- Wygląd: an obsidian rubble golem with glowing lava seams, jagged shoulders and a stone head.
- Statystyki: HP 848, ATK 53, DEF 40, XP 165; prędkość 0.5, zasięg 120, agro 300.
- Zachowanie: Powolny, ciosy telegrafowane 1,5 s. Poniżej 50% HP odrzuca odłamki w obszarze.
- Umiejętności: Miażdżenie (CD 7 s): 220% ATK; Odłamki (obszar)
- Słabość: Obrażenia KI +20%. Łup: Obsydian.
- Animacja: chód — podskok i nacisk kolejnych łap; śmierć — opada na ziemię, spłaszcza się.

**Płomień-Duch** (`pyra-plomien-duch`, poz. 14) — archetyp `hover` (unoszenie), rozmiar średni (0,80).
- Wygląd: a floating flame spirit with a skull like face, swirling fire and two burning eyes.
- Statystyki: HP 413, ATK 60, DEF 12, XP 124; prędkość 0.8, zasięg 400, agro 450.
- Zachowanie: Unosi się nad areną, trzyma dystans i rzuca kule. Po śmierci zostawia strefę ognia na 5 s.
- Umiejętności: Kula ognia (CD 3,5 s); Pierścień ognia (CD 12 s)
- Słabość: Woda/zimno +40%. Łup: Esencja płomienia.
- Animacja: chód — pływa w górę i w dół, lekkie pulsowanie; śmierć — gaśnie i opada na ziemię.

**Byk Areny** (`pyra-byk-areny`, poz. 16) — archetyp `quad` (kłus), rozmiar duży (0,98).
- Wygląd: an arena bull with armored horns, a black and crimson plate harness, steam from its nostrils.
- Statystyki: HP 1109, ATK 68, DEF 36, XP 201; prędkość 1, zasięg 100, agro 400.
- Zachowanie: Tupie przez 1 s, potem szarżuje w linii prostej. Po chybieniu uderza w ścianę i ogłusza się na 2,5 s.
- Umiejętności: Szarża (CD 9 s): 200% ATK + ogłuszenie; Tupnięcie
- Słabość: Unik szarży = okno na atak. Łup: Róg areny.
- Animacja: chód — unoszą się naprzemiennie łapy, lekki przechył korpusu; śmierć — przewraca się na bok (z boku) lub do przodu.

**Skorpion Obsydianowy** (`pyra-skorpion-obsydianowy`, poz. 18) — archetyp `crawl` (drobne kroki), rozmiar średni (0,80).
- Wygląd: an obsidian scorpion with glass black shell, big pincers and a glowing red stinger on a curled tail.
- Statystyki: HP 869, ATK 75, DEF 44, XP 184; prędkość 1, zasięg 150, agro 400.
- Zachowanie: Zakopuje się w piasku i wynurza tuż obok gracza. Trucizna kumuluje się.
- Umiejętności: Żądło: trucizna (do 5 stacków); Pułapka piaskowa
- Słabość: Woda/zimno +20%; ogon pęka po 3 trafieniach. Łup: Szkło obsydianowe.
- Animacja: chód — szybkie drżenie odnóży, korpus ledwo się unosi; śmierć — przewraca się na grzbiet, odnóża w górze.

## 6. Znane wady i prawa
- Widoki malowane są niezależnie, więc proporcje i detale mogą różnić się między kierunkami; kierunki lewe to lustra.
- Animacja jest deformacją pojedynczego obrazu: nie ma ruchu kończyn jak w animacji ręcznej, a duże wychylenia wymuszają zmniejszenie potwora (wilk i krab pilota: 72% i 78%).
- Prawa do obrazów referencyjnych, punktów kontrolnych modeli i obrazów pochodnych są nierozstrzygnięte (patrz `ASSET-LICENSE-REGISTER.md`); nie publikować przed decyzją właściciela.
- Pod nie zostało zatrzymane ani zmienione; nic nie jest zainstalowane w grze ani opublikowane.
