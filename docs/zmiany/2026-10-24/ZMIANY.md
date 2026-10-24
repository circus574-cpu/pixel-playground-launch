# Zmiany — 24.10.2026

## Uzgodniony podział i diagnoza runtime

- Wyłącznie gałąź `feature/superior-runtime-20261023`. HUD/dotyk po rozmowie
  pozostają po stronie `integ/manga-hud-na-kontynentach`. Nie pobierano zmian
  drugiej strony do tej gałęzi ani nie scalano integracji do siebie. Integrację
  `integration/all-20261024` wykonuje druga strona po odbiorze.
- Lista 17 przypadków jest zakresem weryfikacji, nie dowodem pochodzenia błędów.
  [Bazowe wyniki 116 testów](qa/runtime-repairs/baseline.json): SHA `66c29fc`,
  przebieg `40041421567`, 112 PASS / 4 FAIL. Własny Software WebGL `40041424495`
  przeszedł 18/18. Błędy pełnego przebiegu: Android Canvas/WebGL, Legenda Canvas
  oraz Planetarni 390 px w teście ośmiu kierunków.
- Zdarzenia walki były obsługiwane po aktualizacji sprite'ów. Przeniesiono je przed
  wybór klatek, zachowując priorytet śmierci i trafienia. Zablokowana przez hit
  prezentacja akcji czeka najwyżej 500 ms; stare akcje oraz akcje przed śmiercią
  nie są odtwarzane. Nie zmieniano statystyk, leczenia ani naliczania obrażeń.
- Klatki są raportowane po renderze, bez ograniczenia do 100 ms odświeżania HUD;
  niezmienione wartości nie powodują kolejnych zapisów do DOM.
- Test kierunków wraca prawdziwym ruchem do bezpiecznego punktu przed każdym
  kierunkiem. Obszar sprawdzany jest wewnątrz koła, nie tylko na jego obwodzie.
  Poprzednio kolejne odcinki kumulowały przesunięcia i mogły dojść do przeszkody.
  Asercje ruchu, kierunków i kolizji zachowane. Kod joysticka i HUD niezmieniony.
- Dodano testy priorytetu oczekujących akcji, ich ważności oraz czyszczenia przy
  śmierci/odrodzeniu. Vitest: **333/333 PASS**. Canvas: **3/3 PASS** (Android,
  Legenda oraz Planetarni 390 px). Software WebGL Androida w osobnym przebiegu:
  **1/1 PASS**. Równoległa próba WebGL nie ukończyła podejścia w 60 s przy
  równoczesnych pozostałych kontrolach; zachowano jej log, bez podnoszenia limitu
  lub dodania retries. Próba pojedyncza przeszła w 1,2 minuty.
- To kontrola czterech przypadków nieudanych na bazie. Pozostałe przypisania
  z listy 17 oraz pełna regresja na końcowym SHA nie są oznaczone jako zamknięte.
  Bez scalenia i publikacji.

## Wynik szerszej kontroli — kod `22c23d2`

- Wypchnięto poprawkę na własną gałąź. Lokalne kontrole wybranych przypadków:
  **17/17 PASS**: osiem kombinacji ruchu Android, Planetarni 1280 px, trzy przypadki
  śmierci `pre-gpu`, komunikat śmierci `overlay-audit`, rig diagnostyczny,
  pełne PvE Androida oraz budżety/sceny Aetherii i Nexusa.
- W opisie przydziału były cztery przypadki śmierci w `pre-gpu`; ta baza generuje
  trzy, ponieważ Verdantia pozostaje bezpiecznym etapem miejskim. Nie zastępujemy
  brakującego identyfikatora dowolnym testem, by ogłosić zamknięcie pierwotnej listy.
  Zestaw 17 powyżej zawiera dodatkową kontrolę riga; dokładny zakres jest w logu.
- Software WebGL CI **18/18 PASS** na `22c23d2`, przebieg `40058733599`.
  Pełne CI `40058731822` nadal trwało w chwili zapisu. Nie wpisano mu PASS z góry.
- [Log zestawu](qa/runtime-repairs/scope-canvas.log),
  [jawne pokrycie i SHA](qa/runtime-repairs/scope-summary.json).
  Ten wpis dodaje tylko dowody; nie zmienia kodu przetestowanego `22c23d2`.
- Nie zmieniano gałęzi HUD ani integracji. Scalenie wykonuje druga strona zgodnie
  z podziałem. Nie scalono do main, nie opublikowano gry.

## Superior jako jedyny świat — reset zatwierdzony przez właściciela

- Zwykłe wejście do gry ładuje kontynent z generatora dla każdej rasy; usunięto warunek `ki-superior=1`.
- Jeden slot postaci dla ekwipunku, depozytu, pozycji, wyspy i spawnów. Nowa generacja zapisu realizuje reset, bez importowania wcześniejszych postaci/wypraw.
- Zniknął osobny panel podróży; wybór lądu jest częścią istniejącego atlasu 2D/3D. Miasta, drzwi, NPC i usługi zachowane.
- Zmiany HUD ograniczone do przekazania bieżącego lądu i callbacku atlasu. Nie zmieniano joysticka ani układu HP/KI.
- Stare źródłowe układy map pozostają szablonami miast i materiałem źródłowym; nie są wybierane jako mapy gry.

Kod: `647be05c769d06f76163c5d55a435259c17cbef9`. Kontrole: pełny TypeScript,
338/338 testów jednostkowych, walidacja zasobów, lint (0 błędów, 9 istniejących
ostrzeżeń) i build. Canvas: 7/7 testów Superior, w tym 10 lądów przez atlas 2D,
depozyt po odświeżeniu, walka mobilna i start/wznowienie każdej rasy bez flagi.
Raporty: `qa/superior-only/`. Testów korzystających z wycofanych map i starego
formatu zapisów nie zaliczono ponownie; pełna historyczna regresja nie ma tutaj
statusu PASS. Nie scalono do main ani nie opublikowano gry.

Software WebGL: **7/7** na tym samym kodzie `647be05`, w tym podróże przez globus 3D, depozyt, walka i cztery rasy. Czas lokalny: 6,4 min. Headless Software WebGL nie zastępuje pomiaru fizycznego telefonu.

## Naprawa brakującego logu w repozytorium

Dodano niezmieniony, lokalny oryginał `qa/runtime-repairs/scope-canvas.log`, wcześniej pominięty przez `*.log`. Kontrola dokumentacji sprawdza teraz także, czy pliki wskazane w odnośnikach są śledzone przez Git. To naprawa dowodów historycznego przebiegu, bez ponownego deklarowania wyników gry.

## Integracja: testy przeglądarki pod jedyny świat Superior, grafika terenu bez „wklejeń”

- Testy e2e korzystają z danych Superior: siatki nawigacji, punktów przybycia, spawnów,
  NPC i przeszkód z `collision.json`. Testy starych map przepisano na odpowiedniki w Superior
  (archiwalny zapis Etapu 2 zostaje nietknięty i nie jest proponowany jako postać).
- Poprawka gry: przełącznik `?ki-art=technical` na stronie testowej ładuje klatki manekina
  także w Superior (wcześniej świat się nie otwierał).
- Tymczasowa pomoc QA (decyzja właściciela, do usunięcia na jego polecenie):
  `?ki-test-spawn=<rodzaj>` działa tylko na `/scripts/playtest.html` i stawia jednego potwora
  tuż za granicą miasta startowego. Dane świata (`spawns.json`) bez zmian.
- Teren: kolory biomów i wybrzeża rysowane po jednym pikselu na komórkę i wygładzane przy
  powiększeniu, więc granice nie tworzą schodków. Obiekty wycięte z prostokątną płytą tła
  (fontanna, kupy kości, klify, most) dostają miękko wygaszony brzeg (`blendPlates.ts`);
  budynki tylko wąski brzeg, mury, schody i sztandary bez zmian.
- Nagłówkowy Chromium w kontenerze nie przenosi fokusu przy zmianie karty; test pauzy wysyła
  wtedy to samo zdarzenie `blur` okna, które przeglądarka wysyła przy zmianie karty.
- Grafiki z wtopionym tłem: klatki Mędrca zwróconego w prawo miały ciemne prostokątne tło
  (wszystkie klipy); zastąpiono je lustrzanym odbiciem czystych klatek w lewo
  (`hero-sage-painted` 1.0.1). Leśny Pająk, Liściak Skrytobójca i Mchowy Szlamak miały
  kwadratowe tło w klatkach; brzeg każdej klatki jest teraz miękko wygaszony (pakiety 1.0.2).
  Budynki wycięte prostą linią u dołu i z boku (np. Dom Treningu) wygaszają tylko podstawę.

## Codex — fundament walki Action RPG (Etap A)

- Osobna gałąź `feature/action-combat-stage-a` z wybranej przez właściciela
  bazy integracyjnej `19a28569d96a45da570a1b7701533cb430e012bd`.
  Sprawdzono main `d0bfc2c` i otwarte PR; nie zmieniano gałęzi Claude'a.
- Commity implementacji: `2c6da60` (zegar i osiem testów), `d1805e8`
  (ręczne okna trafienia i adapter PvE), `b381ccd` (sterowanie, diagnostyka,
  prezentacja i testy uruchomionej aplikacji).
- Audyt, reguły mechaniki, lokalne uruchomienie i migracja bez resetu:
  [Rozwój i walka — Action RPG](../../ROZWOJ-I-WALKA.md#action-rpg--audyt-i-etap-a-24102026).
- Baza przed zmianą: TypeScript PASS, Vitest **365/365**, build podglądu PASS.
  W trakcie implementacji: **391/391** testów, następnie rozszerzony zestaw
  integracyjny **17/17**. Testy czasu porównują 10/15/30/60/120 FPS oraz
  zastoje 250 ms, 1 s i ciągłe przeciążenie. Są asercje dla śmierci, nagród,
  areny, zapisów, przeszkód i przerwań. Lint: zero błędów, dziewięć istniejących
  ostrzeżeń. Są to pomiary robocze, nie deklaracja końcowego CI.
- Nowy Playwright sprawdza realną walkę, przytrzymanie/zwolnienie, brak
  auto-pościgu, zapis i błędy strony; nagrywa video. Działa w projektach
  Canvas i software WebGL. Widok dotykowy 844 × 390 ma jawny limit renderera
  15 FPS. Fizycznego Androida/iOS nie ma w tym środowisku.
- Dowody końcowego SHA będą w artefaktach dwóch GitHub Actions (pełny
  Playwright i software WebGL) oraz raporcie PR. Nie uznawać samego tego
  dziennika za dowód zakończenia CI. Nie scalono ani nie opublikowano.
- Ograniczenia: prototyp manualny dotyczy tylko Planetarnego i lokalnego
  podglądu; starsze PvE domyślne. Nowe combo, dash, cztery umiejętności,
  archetypy AI i pełna ergonomia dwóch kciuków pozostają etapami B–D.
  W aktualnej mapie korony drzew mogą zasłaniać postacie podczas walki;
  problem oprawy odnotowano, nie zmieniano wygenerowanej geometrii świata.
