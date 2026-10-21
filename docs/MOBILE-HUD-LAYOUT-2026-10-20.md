# Ki Legends — uporządkowanie HUD, 2026-10-20–21

Bazowy main: `8045a0b`. Gałąź `fix/mobile-hud-layout-20261020`, PR #5. Praca niezależna od niedokończonych zasobów Planetarnych w PR #4; bez uruchamiania GPU.

## Potwierdzone przyczyny

Geometria HUD była nadpisywana w `game-hud.css`, `anime-hud.css`, `adventure.css` i `game-messages.css`. Na telefonie umiejętności miały podniesiony pasek, narzędzia osobny dolny rząd, sterowanie kamerą osobny panel pod minimapą, a czat dodatkowy przycisk. Zawijany tytuł minimapy zwiększał wysokość. Rozmowa była proponowana dla globalnie najbliższego NPC nawet daleko od niego i podczas walki.

## Zmiana

- Jeden stały dolny rząd: pięć umiejętności 44×44 px i zwijane menu 48×52 px. Wolny lewy obszar do gestów ruchu.
- Wysokość panelu gracza 56 px; osobne czytelne HP i KI. Minimapę ograniczono do 88 px, tytuł do jednej linii; pełna nazwa pozostaje w opisie i oknie mapy. Powiększenie minimapy w ustawieniach nadal działa.
- Ekwipunek, dziennik, ustawienia, historia czatu i kamera dostępne po otwarciu menu. Menu zamyka się po wyborze okna, rozpoczęciu rozmowy, Escape albo dotknięciu świata. Gest zamykający menu dociera do świata gry.
- Rozmowa proponowana w promieniu 180 jednostek i poza walką; odległych NPC nadal można odwiedzić przez mapę/dziennik. Nawigacja zadania zachowana z lokalnym celem każdej rasy. Przycisk łupu nadal dostępny.
- Jeden niezależny wskaźnik problemu zapisu; krytyczne ostrzeżenia pozostają dostępne także po wyłączeniu zwykłych komunikatów.
- `hud-layout.css` stanowi końcową warstwę geometrii ponad istniejącą skórką. Kompaktowy układ obejmuje szerokości ≤760 px i poziome widoki o wysokości ≤500 px do szerokości 1100 px.
- Cel walki i komunikaty tworzą pionowy stos o dynamicznej wysokości; długa nazwa przeciwnika nie nachodzi na powiadomienie. Na komputerze sterowanie kamerą przeniesiono nad dolne menu, poza panel zadania.
- Mechanika ruchu/walki, mapy i dane postaci bez zmian. Podczas pracy nie modyfikowano usług ani danych Supabase; osobny commit przywraca wyłącznie poprawny lint istniejących wygenerowanych plików.

## Rzeczywisty pomiar i obrazy

Dwa osobne uruchomienia Androidów, świeże konteksty Chromium, viewport **390×640**, zamknięte okna i narzędzia, identyczne źródła map i postaci.

| Pomiar ramek stałych paneli DOM | Przed | Po |
| --- | ---: | ---: |
| Suma powierzchni paneli | 49 151,56 px² | 32 111,25 px² |
| Udział w viewport | 19,69% | 12,87% |

Zmniejszenie sumy powierzchni: około **34,7%**. Pomiar nie obejmuje zależnego od sytuacji przycisku rozmowy, dobrowolnie otwartych okien, komunikatów ani etykiet renderowanych wewnątrz Phaser. Nie jest pomiarem FPS.

[Przed](qa/mobile-hud-layout/before-390x640.png) · [Po](qa/mobile-hud-layout/after-390x640.png) · [Surowy pomiar](qa/mobile-hud-layout/panel-measurements.json).

Nowe screenshoty i scenariusze obejmują wszystkie cztery rasy: 360×640, 390×640, 390×844, 414×896, 852×393, 1280×900. Nowe testy korzystają z prawdziwych dotknięć menu/ekwipunku, nie tylko z małego viewportu. Nie deklarować testu fizycznego urządzenia Android.

## Walidacja i publikacja

- Pełny TypeScript i build produkcyjny: PASS.
- Unit: 97/97 PASS, w tym ukrywanie odległych rozmów, zamykanie menu i zachowanie ostrzeżenia zapisu.
- Lint: 0 błędów, 7 istniejących ostrzeżeń.
- Siedem nowych testów przeglądarkowych HUD: PASS. Osobny przebieg pięciu dotykowych scenariuszy wyboru, ruchu i rozmów: 5/5 PASS. Osobny przebieg pełnego PvE Mędrców, Androidów i Legendów: 3/3 PASS (2,8 min). Pełny lokalny przebieg: **54/54 PASS, 0 FAIL, 0 pominiętych, 14,4 min**. **CI: 54/54 PASS, 0 FAIL, 0 pominiętych, 17,3 min**. TypeScript, unit, assets:check, lint i produkcyjny build również zaliczone w tym samym CI. [Pełny przebieg](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/39540694141).
- Pierwszy lokalny przebieg wskazał błędny adres testowej strony (`/` zamiast `/scripts/playtest.html`); nie był to błąd gry. Kolejny wykrył niejednoznaczną nazwę dostępną przycisku czatu z pseudo-elementem; dodano jawne `aria-label` i ponowiono testy. Trace i logi są zachowane w artefaktach lokalnych.
- Pierwszy kompletny CI ([39486734284](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/39486734284)): 48 zaliczonych i 6 niezaliczonych. Pięć starszych testów dotykowych próbowało otworzyć schowany ekwipunek bez otwarcia menu; test walki Androidów klikał początkową pozycję poruszającego się przeciwnika. Poprawiono rzeczywiste dotknięcia menu i odczyt aktualnej pozycji przeciwnika/kamery. Kolejny lokalny przebieg wykrył brak uwzględnienia środka zoomu Phaser oraz sprawdzanie ukrytych przycisków kamery; te błędy automatyzacji również poprawiono. Testy nie są pomijane, a stan walki nie jest manipulowany.
- Nowe atrybuty `data-camera-x/y` służą wyłącznie do odczytu aktualnej kamery. Test wybiera przeciwnika przez prawdziwe kliknięcie widocznego sprite'a, następnie wykonuje ataki, zbiera łupy i sprawdza ekonomię.
- **Opublikowano 2026-10-21 przez Lovable** po synchronizacji `5e72796a5ee450736429cb4101a0bbfd81bf55c6`. Deployment `ba5606b9-a3d2-40e1-a6ee-8514cdf0c02d`. Sprawdzono faktyczny adres **https://kilegends.pl/**: nowe arkusze stylów i **7/7 testów HUD PASS (34,1 s)**, wszystkie cztery rasy, sześć konfiguracji widoku, rzeczywiste dotknięcia menu i ekwipunku. Bez błędów `pageerror` w tych siedmiu scenariuszach. Nie utożsamiano scalenia z publikacją.
- Zrzuty `Planetarni-*`, `Mędrcy-*`, `Androidy-*`, `Legendy-*` i `tools-*` w katalogu dowodów pochodzą z tego końcowego przebiegu na produkcji. Obrazy `before/after-390x640.png` dokumentują wcześniejszy pomiar porównawczy lokalnie. [Log produkcyjny](qa/mobile-hud-layout/production-e2e.txt), [pełny log lokalny](qa/mobile-hud-layout/full-local-e2e.txt).

## Zakres i ograniczenia

Testy przeglądarkowe wykonano w Chromium z emulacją dotyku i adapterem Canvas Phaser, na rzeczywistych zdarzeniach dotykowych/klawiatury/myszy oraz produkcyjnym adapterze ruchu. Nie jest to test fizycznego telefonu ani pomiar FPS/GPU. Ta partia dotyczy HUD; nie kończy produkcji grafiki Planetarnych i nie uruchamia serwera GPU.

## Commity

- `47fd3ac`: wyłącznie formatowanie/lint zastanych plików Supabase.
- `7add71e`: zwijane narzędzia, mniejsze panele i testy HUD.
- `5685c2e`: dynamiczny stos celu walki i komunikatów.
- `05f91f1`: kamera poza zadaniem na komputerze i prawdziwe interakcje w testach.
- `8e5909f`, `7a52aae`: poprawne otwieranie narzędzi i kliknięcia przeciwników z uwzględnieniem środka zoomu Phaser.
- `5e72796a5ee450736429cb4101a0bbfd81bf55c6`: PR #5 scalony do main po zielonym CI.

## Wybrane zrzuty produkcji

- [Planetarni, 360×640](qa/mobile-hud-layout/Planetarni-360x640.png).
- [Mędrcy, 390×844](qa/mobile-hud-layout/Mędrcy-390x844.png).
- [Androidy, 390×640](qa/mobile-hud-layout/Androidy-390x640.png).
- [Legendy, 414×896](qa/mobile-hud-layout/Legendy-414x896.png).
- [Androidy poziomo, 852×393](qa/mobile-hud-layout/Androidy-852x393.png).
- [Komputer, 1280×900](qa/mobile-hud-layout/Planetarni-1280x900.png).
- [Otwarte narzędzia, 390×640](qa/mobile-hud-layout/tools-390x640-Androidy.png).
