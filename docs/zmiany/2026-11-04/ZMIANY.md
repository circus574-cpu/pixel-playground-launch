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
