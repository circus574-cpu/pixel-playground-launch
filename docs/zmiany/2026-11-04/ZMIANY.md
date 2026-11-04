# Zmiany — 2026-11-04

## Poprawki z audytu technicznego (Gałąź `POPRAWKI`)

### 1. Rozbieżność jednostek szansy dropu potworów (0.0–1.0 vs 0–100%)
- **Problem:** W panelu administratora (`AdminCatalogInfo.tsx` i `AdminWorldEditor.tsx`) suwaki i edytory procentu łupu zapisywały liczby w skali 0–100 (np. 75 dla 75%). Silnik potworów (`MonsterSystem.rollLoot`) porównywał `this.host.random()` (zwracające ułamek `[0, 1)`) z tą wartością, co sprawiało, że każdy zmodyfikowany przedmiot miał gwarantowany 100% drop, a w UI wyświetlało się 7500%.
- **Rozwiązanie:** Wprowadzono automatyczną normalizację: wartości powyżej 1 są dzielone przez 100 zarówno przy zapisie w panelu admina, jak i przy odczycie w `adminWorldStore` oraz w `MonsterSystem.rollLoot`. Wartości w interfejsie są spójne i bezpieczne dla dowolnej skali.

### 2. Rozdzielenie bonusów do szybkości biegu i szybkości ataku
- **Problem:** W strukturze `KitGearStats` brakowało pola `moveSpeedPct`. W `session.ts` bonusy ekwipunku `moveSpeedPercent` były dodawane do `gear.attackSpeedPct`, przez co buty i mikstury przyspieszały uderzenia bronią, nie dając graczowi żadnego przyspieszenia chodu.
- **Rozwiązanie:** Dodano `moveSpeedPct?: number` do `KitPort.gear`, w `session.ts` rozdzielono modyfikatory `moveSpeedPercent` (do biegu) i `attackSpeedPercent` (do ataków), a w `Kit.speed` (`base.ts`) uwzględniono modyfikator ekwipunku `(gear.moveSpeedPct ?? 0) / 100`.

### 3. Usunięcie 15 spawnów przeciwników z bezpiecznych miast
- **Problem:** W plikach `spawns.json` dla Nexus (7 punktów), Aetherii (3 punkty) i Pyry (5 punktów) część spawnów znajdowała się wewnątrz granic strefy chronionej (`city.bounds`), naruszając zasadę nietykalności miast i powodując błędy `Przeciwnik nie może pojawić się w bezpiecznym mieście`.
- **Rozwiązanie:** Przefiltrowano pliki spawnów z użyciem algorytmu bounding box miast. Wszystkie 15 niepoprawnych punktów usunięto, zachowując 100% spójności ze strefami chronionymi.

### 4. Monumentalna reprezentacja wizualna bossów w Phaserze
- **Problem:** Identyfikatory bossów (`boss:ygdrasha` itd.) nie pasowały do tablicy krain w `monsterVisual()`, przez co wszyscy bossowie światowi w scenie Phasera renderowali się jako zwykłe dziki leśne o rozmiarze 84 px.
- **Rozwiązanie:** W `monsterVisual()` dodano mapowanie identyfikatorów bossów na najpotężniejsze modele strażników odpowiednich kontynentów (np. Ygdrasha -> Strażnik Ruin, Pyrrhax -> Golem Ruin, Arbiter Zero -> Strażnik Rdzenia) oraz nadano im skalę bossa 180 px.

### 5. Handel u kupca przedmiotami z katalogu 366 (torba podróżna)
- **Problem:** Kupcy obsługiwali wyłącznie 4 archiwalne przedmioty z etapu 1 (`sword`, `vest`, `potion`, `tusk`). Gracz nie mógł sprzedać żadnego dropu ani broni z katalogu V2.
- **Rozwiązanie:** Rozszerzono obsługę akcji `trade`: gracz może sprzedawać kupcowi przedmioty ze swojej torby (`bagItems`), otrzymując uczciwą zapłatę w złocie bazującą na poziomie i wartości rynkowej przedmiotu.

### 6. Usunięcie shebanga z `scripts/build_publications.mjs`
- **Problem:** Pierwsza linia `#!/usr/bin/env node` powodowała błąd parsowania składni Rolldown przy importowaniu w teście Vitest `src/test/admin-readability.test.tsx`.
- **Rozwiązanie:** Usunięto niepotrzebny shebang; skrypt jest uruchamiany explicite przez `node scripts/build_publications.mjs`. Wszystkie testy Vitest w pliku przechodzą pomyślnie.

### 7. Wdrożenie działających systemów NPC (Działające profesje i mechaniki miejskie)
- **Problem:** Wcześniejsza implementacja ról NPC poza kupcem i kowalem zawierała jedynie teksty zastępcze: karczmarz (`innkeeper`) nie leczył, trener (`trainer`) nie umożliwiał resetu umiejętności ani przejrzystego testu obrażeń, depozytariusz (`keeper`) wymagał ręcznego szukania skrzyni, a w grze brakowało systemu Alchemii i Strażników Bram Bossów.
- **Rozwiązanie:**
  - **Alchemia i Warzenie (`alchemist`):** Wprowadzono nową rolę `alchemist` oraz obsługę komendy `{ type: "brew", recipe: "hp" | "ki" | "antidote" }`. Gracz przetwarza zebrane surowce (zioła, mech, kły) i monety na Mikstury Zdrowia, Eliksiry KI (+15% obrażeń) oraz Antidota oczyszczające z debuffów i przywracające 50 HP.
  - **Gospoda i Karczmarz (`innkeeper`):** Uruchomiono mechanikę odpoczynku za 5 monet odnawiającą pełne HP i KI, usuwającą zmęczenie i debuffy bojowe, oraz mechanikę taktycznych plotek (`action: "rumors"`) ostrzegających przed mechanikami bossów na poszczególnych kontynentach.
  - **Trener Dyscyplin (`trainer`):** Zintegrowano panel trenera z manekinem bojowym oraz opcją resetu drzewka talentów (`respec`), umożliwiając zwrot punktów i przebudowę buildu bezpośrednio w rozmowie.
  - **Kustosz Skarbca (`keeper`):** Dodano bezpośrednie otwarcie depozytu (`this.depotOpen = true`) prosto z okna dialogowego.
  - **Strażnik Bossa (`warden`):** Wprowadzono rolę `warden` z raportem taktycznym o słabościach i fazach bossa oraz przyciskiem otwarcia bramy leża (`action: "boss_enter"`).
  - **Obsadzenie świata:** Wprowadzono Alchemika i Strażnika Bossa do wszystkich 4 krain (`verdantia.ts`, `aether.json`, `nexus.json`, `pyra.json`), z zachowaniem 100% osiągalności i testów kolizji. Utworzono dedykowany zestaw testów regresyjnych `src/test/npc-systems.test.ts` (5/5 PASS).

## Malowane miasta publicznie (decyzja właściciela 04.11.2026)

- Aetheria, Nexus-9, Pyra i budynki Verdantii są domyślnie włączone: `ki-painted` działa jak `ki-monsters-anime`
  (domyślnie wł., `?ki-painted=0` przywraca stary wygląd). Flagi pojedynczych miast nadal działają. Test `painted-flag`.
- Scalone: POPRAWKI (poprawki audytu i funkcje NPC) oraz nazwy nad budynkiem i graczem (#98).

## Czytelność walki i układ HUD na telefonie (uwagi właściciela, zrzut z Pyry)

- **HUD w widoku poziomym telefonu:** statusy leżą pod portretem w jednym rzędzie, „Akcje” są pod nimi (nie nakładają się),
  plakietka „Walka” i paski wrogów zaczynają się za portretem i kończą przed minimapą, a czat to mała przypinka
  „Czat lokalny” przy dolnej krawędzi zamiast dużego przycisku w oknie „Widok”. Czas statusu zaokrąglany w górę (koniec „0 s”).
- **Kontrast w scenie:** bohater i wrogowie mają cienki chłodny obrys (cyjan/blady fiolet; cztery kopie sprite'a pod
  postacią, tylko aktorzy w pobliżu kamery), podłoże i obiekty świata są lekko przyciemnione i schłodzone (`setTint`),
  znacznik celu jest cyjanowy, a czerwone strefy zagrożenia mają jasny obrys.
- **Nie zmierzono** kosztu obrysu na telefonie ani wyglądu na fizycznym urządzeniu; sprawdzono zrzutem Chromium
  915×412 z wstrzykniętym stanem walki (statusy, paski wrogów), nie prawdziwą walką.

## Przegląd uwag raportu inżynieryjnego (04.11.2026)

- **Powtarzane cele zadań:** sprawdzone w danych (106 zadań): wszystkie cele `visit`, `talk` i `discover` mają
  `targetCount = 1`, odkrycia chroni `discoveredLocationIds`, nagrody `rewardClaimedQuestIds`, więc ponowne wejście do
  miasta po przeładowaniu sceny nie nalicza postępu ani nagrody drugi raz. Test `quest-replay` utrwala tę zasadę.
  Zmiany w silniku nie były potrzebne.
- **Nie wdrożone (świadomie):** unikalne instancje przedmiotów (dziś `upgrade` to jedno globalne 0/1; zmiana dotyka
  zapisów graczy i wymaga osobnej decyzji właściciela) oraz pula obiektów potworów (najpierw pomiar tworzenia/niszczenia
  aktorów na telefonie; bez pomiaru to przedwczesna optymalizacja).
## Skala interfejsu (uwaga właściciela: HUD i okna za duże)

- Nowe ustawienie „Rozmiar interfejsu” (suwak 50–120 % w Ustawieniach, zapamiętywany w `ki-legends:ui-preferences:v1`)
  skaluje cały HUD razem z oknami (ekwipunek, drzewko, ustawienia) przez CSS `zoom` na `.ki-hud`.
  Domyślnie 72 % na telefonie w poziomie (`max-height: 500px`), 100 % na dużych ekranach.
- Przesunięcia przycisków z edytora sterowania są dzielone przez skalę, a sam edytor pokazuje HUD w 100 %, więc
  układ użytkownika się nie przesuwa. Wirtualny joystick jest rysowany przez grę i ma własną skalę z edytora.
- Specyfikacje e2e startują ze skalą 100 % (`fullScaleHud`), bo mierzą cele dotyku 44 px; przy 72 % przyciski mają
  ok. 35 px, co jest świadomym kompromisem na prośbę właściciela (można podnieść suwakiem).

## Potwory anime: komplet 40 z 40

- Z pięciu plansz właściciela (1448×1086, siatka 4×3): Liściak Skrytobójca, Świetlik Pieczęci, Pająk Spawalniczy,
  Rój Nanitów i Popielny Wilk. Pakiety `enemy-v3-*` zbudowane `scripts/gpu/ingest_creature_sheet.py` (Świetlik i Rój z
  `--no-effects`), dopisane do listy `ki-monsters-anime` w `catalog.ts` (domyślnie włączone, `?ki-monsters-anime=0`
  przywraca stare wizerunki).
- Atlasy obejrzane na ciemnym tle: tło usunięte czysto we wszystkich pięciu; w ostatniej klatce śmierci Świetlika
  zostaje tylko drobny odprysk pyłu (reszta zanikającego blasku jest za słaba na próg skryptu).

## Generowanie świata z promptów na własnym GPU

- `scripts/gpu/gen_from_prompts.py` czyta 256 kompletnych promptów (`art/pipeline/prompts/world/`: teren, drogi, przejścia,
  przyroda, budynki, wnętrza czterech ras) i renderuje je SDXL z odpowiednim trybem (bezszwowy kafel, sprite z wycinaniem
  tła, pokój). Powód: płatne API jest drogie. Sprawdzone tylko `--dry-run` (parser: 256 promptów, tryby zgodne z liczbą
  w plikach); renderowanie czeka na pod uruchomiony przez właściciela, więc jakości wyników jeszcze nie znam.

## Wnętrza budynków Pyry (zaakceptowane próbki)

- Sześć wnętrz Pyry (sala, sklep, gospoda, kuźnia, skarbiec, trening) wygenerowanych `gpt-image-1-mini` (jakość medium) z promptów
  v2 zapisanych w `art/pipeline/prompts/world/WNETRZA-v2-*.md`. Surowe PNG, prompty i SHA-256 w `art/production/interiors/pyra/`
  (`manifest.json`). Właściciel zaakceptował je 04.11.2026.
- Obrazy są surowe: 1536×1024 (kuźnia 1024×1536), jeszcze nie przycięte do proporcji pokoju w grze (960:760, kuźnia 540:1100)
  i nie wdrożone do klienta. Prompty v2 zastępują wersję v1 (`WNETRZA-*` ze starego kadru izometrycznego).

## Wnętrza budynków: Verdantia, Aetheria, Nexus-9 (do odbioru)

- Po akceptacji wnętrz Pyry wygenerowano pozostałe 18 tym samym promptem v2 i ustawieniami (`gpt-image-1-mini`, medium,
  1536×1024). Surowe PNG, prompty i SHA-256 w `art/production/interiors/{verdantia,aetheria,nexus-9}/`. Sześć na rasę:
  sala, sklep, gospoda, kuźnia, skarbiec, trening.
- To próbki bez odbioru właściciela (akceptacja dotyczyła tylko Pyry), nieprzycięte do 960:760 i niewdrożone do klienta.
  Znane wady wspólne z Pyrą: lekko skośne ściany boczne, w części obrazów brak wyraźnego progu drzwi, kadr 3:2.


## Verdantia — oprawa kontynentu na osobnej gałęzi

Zlecenie właściciela 04.11: rozpocząć od Verdantii, wykorzystać materiały
z `art/world-verdantia-v2` i dwóch ZIP-ów z podanego Dysku, poprawić jakość
w razie potrzeby i pokazać zrzuty z rzeczywistej gry.
Gałąź `preview/verdantia-continent-v2`, baza `main@ec2b2578`.

- Paczka `verdantia-continent-v2@1.0.1`: 6 powierzchni, 4 materiały dróg,
  5 przezroczystych obiektów. Materiały właściciela: sosna, krzew, skały,
  paprocie/kwiaty i nawierzchnie. Dąb i łąka powstały przez `image_gen`.
- Oryginały PNG, dostępne prompty, SHA-256 i pochodzenie:
  [pakiet produkcyjny](../../../art/production/verdantia-continent-v2/).
  Runtime `public/game/assets/gpu/verdantia-continent-v2/1.0.1-d99a8af9857b/`:
  4 583 774 bajty; 15,95 MiB rozkodowanych pikseli. Starszą lokalną próbę 1.0.0
  zastąpiono przed publikacją gałęzi.
- Wiązania kontynentu mają własną przestrzeń nazw. Poza miastami renderer
  używa masek biomów/lądu i istniejących tras. W całkowicie dzikich chunkach
  pomija przykrytą warstwę starych tekstur, a puste maski nie są rasteryzowane.
  Nowych materiałów nie przepuszcza przez filtr kolorystyczny starego pakietu.
- Dekoracyjne drzewa bez fizycznego footprintu tworzą grupy i polany;
  usunięcie ich obrazu nie usuwa żadnej kolizji. Solidne obiekty pozostają
  widoczne. Dodatkowe kwiaty przy poboczach nie mają kolizji. Cienie kontaktowe
  są sprite'ami, mogą przechodzić przez granice chunków. Okluzja graczy pozostaje aktywna.
- [Porównanie SHA-256 z bazą](qa/verdantia-continent/geometry-preserved.json):
  `world.json`, `terrain.json`, `navigation.json`, `collision.json`, `spawns.json`
  pozostają identyczne. Nie zmieniono questów, statystyk, kont, zapisów ani serwera.
- Starsze kłody, pniaki, grzyby, trzciny, obozy i kryształy zasobów pozostają
  dotychczasowe. Pierwotne próbki obiektów z wyspami podłoża nie zostały
  automatycznie przyjęte jako gotowe zamienniki.

Uruchomienie: `npm run playtest -- --host 127.0.0.1 --port 4178`, następnie
`http://127.0.0.1:4178/scripts/playtest.html?ki-world-v2=1&ki-verdant-continent=1`.
Wybranie Planetarnych i rozpoczęcie przygody korzysta z normalnego runtime gry.
Podgląd jest opt-in; nie stanowi scalenia ani publikacji na domenach.

Weryfikacja końcowego kodu: pełny TypeScript aplikacji/e2e/tools PASS,
13 testów jednostkowych PASS, pełna walidacja zasobów PASS,
lint 0 błędów (15 dotychczasowych ostrzeżeń),
kompilacja produkcyjna PASS, dokumentacja PASS (10 podręczników, 15 dzienników,
235 przeniesionych dowodów i 346 chronionych źródeł). Canvas: wszystkie asercje
ruchu, czterech biomów, ponownego wczytywania, telefonu i rzeczywistego PvE PASS
w izolowanym przebiegu (1,0 min); programowy WebGL 852×393 PASS (oddzielny przebieg).
Dwa wcześniejsze przebiegi wymagały powtórzenia po kolizji katalogów trace
przerywanej próby i awarii karty podczas równoległej kompilacji. Końcowa seria
Canvas biegła samodzielnie, bez trace. [Raport Canvas](qa/verdantia-continent/canvas-final.json),
[log](qa/verdantia-continent/canvas-final.txt), [zaliczony mobilny WebGL](qa/verdantia-continent/webgl-mobile-final.json).

Zrzuty z lokalnego runtime:
[las i szlak](qa/verdantia-continent/canvas/verdantia-forest-road.png),
[zachowane miasto](qa/verdantia-continent/canvas/verdantia-city-preserved.png),
[głębszy las](qa/verdantia-continent/canvas/verdantia-deep-forest.png),
[wzgórza](qa/verdantia-continent/canvas/verdantia-highlands.png),
[mokradła](qa/verdantia-continent/canvas/verdantia-wetland.png),
[telefon i PvE w WebGL](qa/verdantia-continent/webgl/verdantia-mobile-live-pve.png),
[wybrzeże](qa/verdantia-continent/verdantia-coast.png),
[wybrzeże na telefonie pionowo](qa/verdantia-continent/verdantia-coast-mobile.png).
Osobny podgląd wybrzeża: PASS, zero błędów strony i brakujących zasobów;
[pozycja, metryki i sposób przygotowania zapisu](qa/verdantia-continent/coast-runtime.json).

Pierwsza próba dużego programowego WebGL (1600×1000) nie zaliczyła ponownego
wczytywania w limicie 60 s. Zachowano [raport](qa/verdantia-continent/initial-desktop-webgl.json)
i [log](qa/verdantia-continent/initial-desktop-webgl.txt). Po optymalizacji
weryfikacja WebGL obejmuje telefon 852×393; duży desktop i komplet czterech
biomów są sprawdzane w Canvas. To nie jest pomiar sprzętowego GPU ani odbiór
fizycznego telefonu. Zrzuty dalszych biomów używają poprawnego lokalnego
zapisu testowego z pozycją na istniejącej drodze, bez podmiany świata/spawnów.

Zbiorcza [walidacja końcowego kodu](qa/verdantia-continent/validation.json); logi TypeScript, kompilacji, lint i zasobów w tym samym katalogu QA.
