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


## Pyra — zapis wszystkich wygenerowanych materiałów w repo

Na prośbę właściciela zabezpieczono komplet 10 plansz PNG (52 wzory) oraz manifest i dostępne prompty w [archiwum źródłowym](../../../art/production/pyra-concepts-2026-11-04/). Gałąź `art/pyra-materials-2026-11-04` powstała z podglądu Verdantii `cb7d5154`; ten commit dodaje wyłącznie archiwum i jego opis, bez integracji Pyry z runtime. Wszystkie 10 kopii PNG zweryfikowano według SHA-256 manifestu.


## Verdantia — 26 dodatkowych wzorów grafiki

Na prośbę właściciela wzbogacono bibliotekę koncepcji Verdantii o [4 plansze PNG, prompty i manifest SHA-256](../../../art/production/verdantia-extra-concepts-2026-11-04/). Wszystkie 4 kopie porównano bajtowo z oryginałami. Gałąź `art/verdantia-extra-2026-11-04` wychodzi z archiwum Pyry `abb36449`; nowy commit dodaje wyłącznie koncepcje i opis. Nie zmieniono runtime, map, kolizji ani zapisów.


## Verdantia — ukończenie integracji dodatkowej oprawy

Zlecenie właściciela: dokończyć Verdantię, dodając wygenerowane grafiki.
Gałąź `preview/verdantia-complete-art` zachowuje wcześniejszy podgląd kontynentu
oraz archiwa źródłowe. Do runtime podłączono wszystkie 26 nowych elementów.

- Cztery oryginalne plansze zachowano. Wersje z czystym tłem przygotowano
  przez `image_gen`, następnie wydzielono osobne komórki i odrzucono małe,
  odłączone fragmenty sąsiednich obiektów przy krawędzi komórki.
- Pakiet [verdantia-extra-runtime@1.0.1](../../../art/production/verdantia-extra-runtime/):
  26 obrazów, 3 333 194 bajty runtime, 10,37 MiB rozkodowanych pikseli.
  Duże formy terenu i most mają 512 px, drzewa 384 px, drobne obiekty 192/256 px.
  Wersja 1.0.0 była lokalną próbą; nie opublikowano jej jako osobnego wydania.
- Istniejąca opcja `ki-verdant-continent=1` wczytuje podłoża i nowy pakiet.
  Rośliny podszytu zastępują starsze krzewy, paprocie, trzciny i grzyby;
  nowe drzewa, drewno, korzenie, formy terenu, obozy i wejścia zastępują
  odpowiednie dotychczasowe wiązania poza bezpiecznymi osadami.
- Warianty drzew wybierane są niezależnie od przerzedzania koron, więc
  dąb, brzoza i wierzba mogą pojawić się w tej samej okolicy. Nowy test
  sprawdza obecność wszystkich trzech w zachowanej populacji.
- [Audyt przypisań](qa/verdantia-complete/mapping-audit.json) potwierdza
  występowanie wszystkich 26 nazw w istniejących rekordach świata.
  [Geometria](qa/verdantia-complete/geometry-preserved.json) jest bajtowo
  zgodna z bazą `cb7d5154`. Nie zmieniono nawigacji, kolizji, zapisów,
  statystyk, spawnów, usług miast, łupu ani znaczenia wejść do podziemi.
  Nowy wygląd skrzyń/kapliczek nie dodaje nowych interakcji ani nagród.
- Kryształy KI i domy wiosek zachowują dotychczasowy wygląd. Gotowe miasto
  główne nie jest przemalowywane. To podgląd na gałęzi, bez publikacji domen.

Kontrole końcowe: pełny TypeScript aplikacji/e2e/tools PASS; 15 testów w trzech
plikach PASS; walidacja wszystkich zasobów PASS; lint 0 błędów (15 wcześniejszych
ostrzeżeń); kompilacja produkcyjna PASS; dokumentacja PASS. Gra: Canvas 1600×1000
oraz programowy WebGL 852×393 PASS, ruch, zapis i ponowne wejście, cztery biomy,
obóz/źródło (Canvas), widok telefonu oraz rzeczywiste zadawanie obrażeń potworowi.
[Raport przeglądarek](qa/verdantia-complete/browser-final.json),
[log](qa/verdantia-complete/browser-final.txt),
[kontrola alfa 26 sprite’ów](qa/verdantia-complete/alpha-check.json).

Zrzuty z rzeczywistego runtime:
[las](qa/verdantia-complete/canvas/verdantia-forest-road.png),
[głęboki las](qa/verdantia-complete/canvas/verdantia-deep-forest.png),
[wzgórza](qa/verdantia-complete/canvas/verdantia-highlands.png),
[mokradła](qa/verdantia-complete/canvas/verdantia-wetland.png),
[obóz](qa/verdantia-complete/canvas/verdantia-camp.png),
[okolica źródła](qa/verdantia-complete/canvas/verdantia-spring.png),
[zachowane miasto](qa/verdantia-complete/canvas/verdantia-city-preserved.png),
[telefon WebGL](qa/verdantia-complete/webgl/verdantia-mobile-live-pve.png).
Zrzuty dalszych miejsc używają poprawnego lokalnego zapisu testowego z pozycją
na sprawdzonym nawigacyjnie terenie. Nie są nowym projektem mapy ani pełnym
tłem ilustracyjnym. Fizyczny telefon i sprzętowe WebGL pozostają do odbioru.

## Pyra — nowa oprawa kontynentu

Zlecenie: rozpocząć nową Pyrę z wcześniej przygotowanych materiałów.
Gałąź `preview/pyra-continent-v2` wychodzi z `7b5d4939` i zachowuje ukończoną
Verdantię oraz oba archiwa źródłowe. To faktyczny renderer gry, nie ilustracja
użyta jako cała mapa. Podgląd: `/scripts/playtest.html?ki-world-v2=1&ki-pyra-continent=1`,
rasa **Legendy**. Dla zwykłej strony gry dopisać `ki-pyra-continent=1` do jej URL.

- [Pakiet](../../../art/production/pyra-continent-v2/) zawiera 52 osobne obrazy:
  14 materiałów powierzchni, 33 obiekty i 5 efektów. Import runtime:
  7 773 994 bajty, 26,65 MiB rozkodowanych pikseli;
  [log importera](qa/pyra-continent/import.txt).
- Pięć plansz oczyszczono przez `image_gen`; źródłowe dziesięć plansz
  koncepcyjnych pozostaje nienaruszone. `provenance.json`, `prepare.mjs`
  i `sources.sha256.json` w pakiecie opisują pochodzenie i odtwarzanie.
  [Kontrola alfa](qa/pyra-continent/alpha-check.json) obejmuje wszystkie wycięcia.
- Popielne pola, bazalt, wulkany i kaniony używają własnych materiałów.
  Cztery faktury dróg, liście, popiół, siarka, brzegi i woda urozmaicają podłoże.
  [Audyt terenu](qa/pyra-continent/terrain-audit.json): źródło zawiera 1089
  niedostępnych komórek wulkanicznego lądu kwalifikujących się do nakładki lawy.
  Nie oznacza to nowych przeszkód ani obrażeń środowiskowych.
- Klony, sosny i trzy krzewy zastępują odpowiednie stare dekoracje. Nowe skały,
  klify, kratery, szczeliny, źródła, obozy, ruiny i wejścia korzystają z istniejących
  położeń i metadanych. [Audyt przypisań](qa/pyra-continent/mapping-audit.json)
  potwierdza użycie wszystkich 38 wiązań obiektów/efektów w pełnym świecie.
- Mosty i schody to cztery niewielkie dekoracje na istniejących szerokich szlakach,
  bez nowej nawigacji, wysokości czy kolizji. Obozy, kopalnie, ruiny i skrzynie
  otrzymują wygląd; nie dodano im nowej interakcji ani nagród.
- Para, dym, popiół, żar i ciepłe powietrze mają animację przesunięcia/zanikania
  przezroczystych obrazów; nie są sekwencjami nowych klatek. Nie zasłaniają drogi
  nieprzezroczystym tłem i nie mają cienia kontaktowego.
- [Geometria](qa/pyra-continent/geometry-preserved.json): `world`, `terrain`,
  `navigation`, `collision` i `spawns` są bajtowo zgodne z bazą. Miasta bezpieczne,
  gotowa Twierdza Popiołu, statystyki i zapis nie są przemalowywane ani migrowane.
  Dotychczasowe bindingi i domyślna oprawa pozostają zachowane. Nie scalano
  do `main` ani nie publikowano na domenach.

Zrzuty z rzeczywistej gry:
[popielne pola](qa/pyra-continent/canvas/pyra-ash.png),
[bazalt](qa/pyra-continent/canvas/pyra-basalt.png),
[wulkaniczny teren](qa/pyra-continent/canvas/pyra-volcanic.png),
[kaniony](qa/pyra-continent/canvas/pyra-canyon.png),
[dzikie ziemie](qa/pyra-continent/canvas/pyra-wilderness.png),
[zachowana stolica](qa/pyra-continent/canvas/pyra-city.png),
[telefon WebGL](qa/pyra-continent/webgl/pyra-mobile-pve.png).
Sceny dalszych biomów używają poprawnego lokalnego zapisu testowego z pozycją
na sprawdzonym nawigacyjnie terenie. Pozostałe zrzuty powstają po rzeczywistym
ruchu. Fizyczny telefon, sprzętowe GPU i odbiór estetyczny całego kontynentu
pozostają do oceny właściciela.

Końcowe testy funkcjonalne gry: **4/4 PASS** — Pyra i regresja Verdantii,
każda na Canvas 1600×1000 oraz programowym WebGL 852×393. Sprawdzono prawdziwy
ruch, streaming, ponowne wejście z lokalnego zapisu, zadawanie obrażeń potworowi,
przyciski widoku telefonu i limit 12 chunków. Brak błędów strony oraz brakujących
zasobów w końcowych przebiegach. [Zbiorczy raport](qa/pyra-continent/browser-final-summary.json),
[Canvas](qa/pyra-continent/browser-canvas-final.txt),
[WebGL](qa/pyra-continent/browser-webgl-final.txt).
Telemetria jest zapisana w raportach; programowy WebGL potwierdza poprawność
renderowania, nie stanowi odbioru płynności na fizycznym telefonie.

Pierwszy łączony przebieg zachowano jako [log początkowy](qa/pyra-continent/browser-initial.txt):
Pyra przeszła obie ścieżki, lecz Verdantia miała crash przeglądarki przy równoległych
ciężkich kontrolach oraz timeout ruchu w przebiegu obejmującym przeładowanie kodu.
Kontrole rozdzielono, zakończono retusz i powtórzono obie krainy. Końcowe wyniki
powyżej dotyczą stabilnego, niezmienianego podczas testów kodu.

Pozostałe kontrole końcowe: [pełny TypeScript app/e2e/tools](qa/pyra-continent/typecheck.txt)
PASS; [20 testów w 4 plikach](qa/pyra-continent/unit.txt) PASS;
[wszystkie zasoby](qa/pyra-continent/assets.txt) PASS;
[lint](qa/pyra-continent/lint.txt) 0 błędów / 15 wcześniejszych ostrzeżeń;
[kompilacja produkcyjna](qa/pyra-continent/build.txt) PASS.
[Zestawienie kontroli](qa/pyra-continent/validation.json).
[Kontrola dokumentacji](qa/pyra-continent/docs.txt): PASS.

## Aetheria — nowa oprawa kontynentu

Zlecenie właściciela po Pyrze: przygotować Aetherię. Gałąź
`preview/aetheria-continent-v2` wychodzi z `c00193d7`, zachowując podglądy
Pyry i Verdantii. Podgląd: `/scripts/playtest.html?ki-world-v2=1&ki-aetheria-continent=1`,
rasa **Mędrcy**. Na zwykłej stronie gry dopisać `ki-aetheria-continent=1`.
To rzeczywisty renderer Superior, bez pełnej ilustracji jako tła mapy.

- [Pakiet aetheria-continent-v2@1.0.0](../../../art/production/aetheria-continent-v2/)
  zawiera 36 osobnych obrazów: 14 powierzchni i 22 obiekty. Runtime:
  5 331 248 bajtów, 16,21 MiB rozkodowanych pikseli;
  [raport importera](qa/aetheria-continent/import.txt).
- Pobrano i zweryfikowano SHA-256 wszystkich 20 źródłowych obrazów Aetherii
  z gałęzi `art/world-verdantia-v2`. Zachowano ich prompty i manifest.
  Dziesięć istniejących powierzchni wykorzystano w grze. Cztery podłoża oraz
  22 obiekty przygotowano na czterech nowych planszach przez `image_gen`.
  Trzy plansze obiektów oczyszczono dodatkową edycją tła i marginesów.
  Oryginały generacji, wersje oczyszczone, komplet użytych promptów i sumy
  są w `source/`, `provenance.json` oraz `sources.sha256.json` pakietu.
- Tarasy źródeł i święty gaj dostają nowe trawy, runo, sakury, miłorzęby,
  cyprysy, bambusy i kwitnące rośliny. Źródłowe zimne biomy dostają śnieg,
  lód, zaśnieżone sosny, góry i lodowe formacje. Odczyt klimatu korzysta
  ze zweryfikowanych komórek źródłowych chunków, również przy rozgrzewaniu
  streamingu. Nie zmieniono zasięgu ani nazw biomów.
- Pięć nawierzchni szlaków zachowuje źródłowe linie i szerokości. Tekstura
  nurtu trafia wyłącznie na istniejącą wodę przy lądzie. Wycięto środkowe
  pasy dróg, aby nie domalować strumienia na przechodnim szlaku.
- Skały, klify, wodospady, obozy, kapliczki, skrzynie, drogowskazy, martwe
  drewno i wejścia otrzymują nowe sprite’y. Dwa wejścia tranzytowe mają łuki,
  komnaty — jaskinię, labirynt — ruinę. To wygląd istniejących wejść,
  bez nowych kierunków podróży, nagród czy funkcji skrzyń/kapliczek.
  [Audyt przypisań](qa/aetheria-continent/mapping-audit.json) potwierdza użycie
  wszystkich 22 nowych wiązań obiektów.
- Pierwszy podgląd pokazał zbyt gęste duże pniaki i kłody. Przerzedzono
  wyłącznie dekoracje bez kolizji/footprintu; także drzewa, podszyt i lodowe
  odłamki mają kontrolowaną gęstość. Lodowe formacje otrzymują zróżnicowaną
  skalę rysunku i odbicie, bez zmiany fizyki. Stała kolejność masek biomów
  i naddatek jednej jednostki świata wokół obrazu podłoża na dzikich ziemiach ograniczają
  szczeliny przy niecałkowitym powiększeniu kamery. Nie powiększa to lądu.
- [Geometria i dane świata](qa/aetheria-continent/geometry-preserved.json)
  pozostają bajtowo zgodne z bazą: `world`, `terrain`, `navigation`, `collision`,
  `spawns`. Nie zmieniono statystyk, zapisu, łupu, usług osad ani kanonicznych
  kryształów KI. Gotowe Sanktuarium zachowuje swoje zasoby. Pozostałe
  kontynenty mają osobne opcje podglądu; domyślna oprawa nie jest nadpisana.

[Kontrola alfa](qa/aetheria-continent/alpha-check.json),
[przegląd osobnych zasobów](qa/aetheria-continent/runtime-contact.jpg).
Zrzuty z uruchomionej gry:
[tarasy](qa/aetheria-continent/canvas/aetheria-terraces.png),
[gaj](qa/aetheria-continent/canvas/aetheria-grove.png),
[szczyty](qa/aetheria-continent/canvas/aetheria-peaks.png),
[lodowce](qa/aetheria-continent/canvas/aetheria-glaciers.png),
[wyjście z miasta](qa/aetheria-continent/canvas/aetheria-wilderness.png),
[zachowana stolica](qa/aetheria-continent/canvas/aetheria-city.png),
[telefon WebGL](qa/aetheria-continent/webgl/aetheria-mobile-pve.png).
Cztery sceny dalszych biomów wykorzystują prawidłowy lokalny zapis testowy
z pozycją sprawdzoną przez nawigację; [współrzędne i udział biomu w otoczeniu](qa/aetheria-continent/scenes.json).
Ruch przy mieście i walka są rzeczywiste. Fizyczny telefon, sprzętowy GPU
oraz odbiór estetyczny całego kontynentu pozostają otwarte.
Nie scalano do `main` i nie publikowano na domenach.

Końcowe kontrole: [pełny TypeScript app/e2e/tools](qa/aetheria-continent/typecheck.txt)
PASS; [25 testów w 5 plikach](qa/aetheria-continent/unit.txt) PASS;
[walidacja wszystkich zasobów](qa/aetheria-continent/assets.txt) PASS;
[lint](qa/aetheria-continent/lint.txt) 0 błędów / 15 wcześniejszych ostrzeżeń;
[kompilacja produkcyjna](qa/aetheria-continent/build.txt) PASS.
Skrypt przygotowania odtworzył identycznie wszystkie 36 obrazów, manifest i sumy
źródeł — [raport SHA-256](qa/aetheria-continent/reproducibility.json).

Końcowa gra: **4/4 PASS** — Aetheria na Canvas 1600×1000 i programowym WebGL
852×393 oraz regresja Pyry i Verdantii na Canvas. Sprawdzono rzeczywisty ruch,
streaming, zapis i powrót, zadawanie obrażeń potworowi, widok telefonu i limit
12 chunków. W końcowych przebiegach nie było błędów strony ani brakujących
zasobów. [Zestawienie](qa/aetheria-continent/browser-final-summary.json),
[Canvas](qa/aetheria-continent/browser-canvas-final.txt),
[WebGL](qa/aetheria-continent/browser-webgl-final.txt),
[rejestr kontroli](qa/aetheria-continent/validation.json).
Telemetria jest zachowana; programowy WebGL nie stanowi odbioru płynności
na fizycznym telefonie.
[Kontrola dokumentacji](qa/aetheria-continent/docs.txt): PASS.


## Nexus — komplet materiałów kontynentu

Zlecenie właściciela: wygenerować całą potrzebną grafikę dla kontynentu Nexusa.
Gałąź `art/nexus-continent-materials-2026-11-04` wychodzi z `69353152`.
Przeanalizowano cztery biomy i istniejące grafiki miasta. Zestaw środowiska
pasuje do grafitu, jasnego kamienia, złota, turkusowej energii i fioletowej roślinności.

[Pakiet źródłowy i osobne obrazy](../../../art/production/nexus-continent-v2/),
[podgląd wszystkich 64 elementów](qa/nexus-materials/preview.jpg).

- 8 podłoży: równiny obwodów, syntetyczny ogród, płaskowyż, pustkowia rdzeni,
  omszały kamień, jasny plac, kryształowe podłoże i wilgotny łupek.
- 6 nawierzchni szlaków: bruk, ziemia, runo ze stopniami, górski żwir,
  solidna nawierzchnia z obwodami i ruiny drogi.
- 8 roślin: cztery drzewa, paprocie, fioletowy krzew, świetlista trawa, grzyby.
- 8 form terenu: wzgórze, klif, szczyt, bazalt, ruda/kryształowy głaz,
  naturalny łuk, źródło/wodospad, krawędź rozpadliny.
- 10 rekwizytów: kamienie, kryształy, kłoda, pniak, obóz, energetyczne palenisko,
  skrzynia, drogowskaz, zaopatrzenie, ruina.
- 6 struktur: laboratorium polowe, reaktor, terminal, monolit, przekaźnik, brama.
- 6 materiałów wody i brzegów; 6 przezroczystych statycznych nakładek efektów.
- 6 dodatkowych budynków/przejść: warsztat, gospoda/punkt regeneracji,
  most, schody, jaskinia, wejście do bunkra.

Dziewięć oryginalnych plansz oraz cztery edycje oczyszczające zachowano z promptami
w `source/`. `prepare.mjs` wydziela komórki, odrzuca małe obce fragmenty przy
krawędziach, skaluje i dodaje przezroczyste marginesy. `provenance.json` oraz
`sources.sha256.json` zachowują pochodzenie i sumy. Istniejące budynki mają
osobny spis z SHA-256; ich pliki pozostają bez zmian.

[Walidacja](qa/nexus-materials/validation.json): 64 unikalne obrazy i bindingi,
wymiary zgodne z manifestem, pełne dekodowanie wszystkich plików PASS;
44/44 obiektów/efektów ma przezroczyste zewnętrzne marginesy.
[Schemat pakietu](qa/nexus-materials/schema.txt): PASS.
Łącznie 4 458 920 bajtów, 33,87 MiB rozkodowanych pikseli.

To dostawa materiałów: nie zmieniono kodu gry, aktywnego rejestru zasobów,
geometrii, statystyk, zapisów ani produkcji. Pakiet pozostaje do podłączenia.
Przy integracji trzeba sprawdzić skalę, kotwice, maski wody, gęstość i powtarzanie
tekstur w rzeczywistej grze. Efekty wymagają animacji/sterowania alfa.
Nie wykonywano testów rozgrywki dla jeszcze niepodłączonego zestawu.
[Kontrola dokumentacji](qa/nexus-materials/docs.txt): PASS.
[Lint skryptu przygotowania](qa/nexus-materials/lint.txt): PASS.
