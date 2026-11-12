# Dziennik zmian — 11 listopada 2026

### 1. Mapa 2D i globus: zapętlone przesuwanie, brak kwadratów, punkt gracza, ostrość

Na zgłoszenie właściciela z nagrań ekranu (Intel UHD, Chromium): na mapie 2D nie da się przesuwać poza krawędź kontynentu, przy przybliżeniu widać jasne prostokąty, globus pokazuje „Tu jesteś" bez punktu i nie wyostrza się przy przybliżaniu.

- Przesuwanie mapy 2D zapętla się w poziomie: `clampView` zawija `cx` (`wrapX`), animacje wybierają krótszą drogę (`nearestX`), a `PlanetMap` rysuje kopie warstw mapy dla widocznego zakresu (`wrapCopies`; jedna kopia, gdy cała mapa mieści się w oknie). Pion nadal kończy się na biegunach. Radialna winieta przeniesiona z SVG na `.pm-viewport::after`, żeby nie tworzyła szwu na linii zawinięcia. Sprawdzone w Chromium: widok przechodzi z x≈177 przez krawędź na x≈1235, a przy szwie rysowana jest kopia −1.
- Kwadraty przy przybliżeniu: to jasne prostokąty stref bezpiecznych miast (20% bieli) wypalone w `map-hi.webp` przez `scripts/worldgen/v2/render_v2_maps.py`. Skrypt nie nakłada ich już na mapy szczegółowe (`MAP_SAFE_TINT`: domyślnie wyłączone dla `MAP_UPSAMPLE>1`, jawnie `0` dla wysp). Odtworzenie najpierw dało obrazy identyczne z zatwierdzonymi (różnica 0), potem zregenerowano 4 kontynenty (`MAP_WIDTH=8192 MAP_SUFFIX=-hi MAP_UPSAMPLE=2`) i 6 wysp (domyślne ustawienia). `map.webp` (mapa podstawowa) bez zmian.
- Globus: `MapaView` przekazuje `focus` do `PlanetGlobe`; punkt gracza (złota kropka z poświatą) liczony przez `worldToAtlas` i `mapToSphere`, rzutowany jak pozostałe znaczniki (`MarkerProjector`). Sprawdzone w Chromium z testowym parametrem (usunięty przed commitem).
- Ostrość globusa: komputery oceniane jako słabsze (`cores <= 4` albo mało pamięci) nie dostawały nigdy tekstury 3840 px. Teraz ładują ją, gdy kamera zbliży się poniżej 75% dystansu otwarcia (`hiResOnZoom`); telefony nadal nie.
- Testy: nowe w `src/test/planet-map.test.ts` (zapętlenie, `wrapX`, `nearestX`, `wrapCopies`) i `src/test/planet-globe.test.ts` (`hiResOnZoom`).
- Nie zrobiono / nie sprawdzono: ostrość mapy 2D przy dużym zbliżeniu zależy od rozdzielczości `map-hi.webp` (3985×3011 px na kontynent przy zbliżeniu do 2200%) i pozostaje rozmyta; po stronie zawinięcia widać słaby szew jasności atlasu; ostrość globusa na słabym komputerze nie była sprawdzana (środowisko testowe ma mocniejszy procesor).

### 2. Przyciski umiejętności: przesuwanie także na komputerze

- Zgłoszenie właściciela: brak możliwości zmiany położenia przycisków umiejętności. Edytor układu (`ControlEditor`, „Przesuń przyciski”) i style `--ctl-*` działały na wszystkich urządzeniach, ale sekcja ustawień z przyciskiem była pokazywana tylko na ekranie dotykowym (`touchJoystick`).
- Sekcja „Przyciski umiejętności” (suwaki wielkości i „Przesuń przyciski”) jest teraz widoczna także na komputerze; suwak joysticka tylko na dotyku (`src/components/game/GameHud.tsx`). Zapis układu bez zmian (`ui-preferences`, `controls.buttons`).
- Nie sprawdzono w przeglądarce: ekran gry wymaga zalogowanej postaci, której środowisko testowe nie ma; zmiana to wyłącznie warunek wyświetlania istniejącego edytora, który nie ma testu jednostkowego.

## Wydajność: audyt FPS i narzędzia pomiarowe

### 3. Pomiar zamiast oceny: co naprawdę kosztuje klatkę

- Właściciel polecił pełny audyt kodu pod kątem spadków FPS na komputerze i telefonach. Wnioski
  pochodzą z pomiaru prawdziwego kodu, nie z lektury: `scripts/perf/audyt-cpu.ts` importuje
  `GameSession` i kit, `scripts/perf/audyt-swiata.ts` liczy pliki świata i limity dekoracji,
  a `scripts/measure-game.ts` mierzy FPS w Chromium na czterech światach i dwóch viewportach.
- **Symulacja nie jest wąskim gardłem:** `session.tick(16,7 ms)` kosztuje 0,082 ms bez wrogów
  i 0,794 ms przy 32 potworach, czyli 4,8 % budżetu klatki 60 fps.
- **Wąskim gardłem jest pamięć tekstur:** 198,2–240,5 MiB w czterech światach przy stałej
  `STREAM_TEXTURE_BUDGET_BYTES = 192 MiB`. Stała jest sprawdzana wyłącznie przy nabywaniu
  atlasów z katalogu (`superiorRuntime.ts:546`); upieczone canvasy podłoża (12 × 1024² × 4 B
  = 48 MiB) i cienie żyją poza tym licznikiem.
- **Pętla widoczności chodzi po całej scenie co klatkę** (`renderSuperior.ts:1002-1010`), bez
  indeksu przestrzennego. Limity dekoracji to 130/chunk w dziczy i 320/chunk w mieście
  (`worldDress.ts:35,37`), więc przy 12 chunkach miasta to 3840 sprawdzeń na klatkę.
  Zmierzone: **1,394 ms/klatkę, 0,363 µs na obiekt, 230 tys. sprawdzeń/s**.
- **HUD:** `report()` odpala się 10×/s (`mountGame.ts:1636`) i woła `snapshot()` za **1,10 ms**,
  w tym `statBreakdown` liczący **sześć pełnych `deriveStats()`** (0,25 ms). Snapshot ma 19 445 B,
  czyli 190 KB alokacji na sekundę. `GameHud.tsx` (1536 linii) ma **zero** `memo`/`useMemo`/`useCallback`.
- **Pieczenie chunku blokuje wątek:** `load()` po `await` piecze synchronicznie canvas 1024²
  w sześciu pełnych przebiegach. W pomiarze pierwsza klatka trwała **18 760 ms** (Nexus-9, desktop),
  13 818 ms (Pyra, mobile) i 12 863 ms (Verdantia, mobile).
- **Ładowanie:** superior-v2 to **3872 pliki i 51,6 MB**; sama Verdantia **1111 plików JSON, 13,9 MB**.
  Zimne wejście 15,4–26,9 s, wybór postaci interaktywny po 9,0–11,4 s.

### 4. Wyniki pomiaru w przeglądarce

Renderer Canvas (kontener bez GPU), 10 s próbkowania na świat, mediana z próbek.

| świat     | desktop FPS | desktop p50 | mobile FPS | mobile p50 | tekstury        |
| --------- | ----------- | ----------- | ---------- | ---------- | --------------- |
| Verdantia | 9,86        | 86,9 ms     | 21,68      | 28,1 ms    | 210,8 MiB       |
| Aetheria  | 13,24       | 75,3 ms     | 26,05      | 23,1 ms    | 233,1 MiB       |
| Nexus-9   | 13,76       | 72,8 ms     | 28,96      | 18,9 ms    | 240,5 MiB       |
| Pyra      | 11,48       | 82,4 ms     | 17,77      | 59,5 ms    | 198,2–202,3 MiB |

- **Koszt rysowania skaluje się z pikselami** (3,5× mniejszy kadr → FPS 9,9 → 29,0), ale
  **pamięć tekstur jest identyczna na telefonie i na desktopie**. Mniejszy ekran nie zmniejsza
  ani jednej tekstury — to najważniejszy wniosek dla urządzeń mobilnych.
- Liczby FPS są pesymistyczne względem telefonu z GPU, bo pomiar szedł na software'owym
  rasteryzerze. Pamięć, liczby obiektów i czasy wejścia są od renderera niezależne.

### 5. Trzy usterki samego harnessu, naprawione przy okazji

- `expect(.ki-hud).toBeVisible()` czekał domyślne **5 s**, krócej niż zimne wejście do świata,
  więc pomiar padał zanim cokolwiek zmierzył. Podniesione do 180 s, sterowane
  `KI_BENCH_HUD_TIMEOUT_MS`; ten sam limit dostali `data-world` i poll na `data-metrics`.
- Harness emulował telefon w **portrait 390×844**, a gra blokuje portrait nakładką
  `RotateNotice` (`pointer: coarse`), która przechwytuje kliknięcia — pomiar nie dochodził do HUD.
  Zmienione na **844×390 landscape**, a `isMobile`/`hasTouch` przestały zależeć od szerokości.
- Dodany filtr `KI_BENCH_VIEWPORT=desktop|mobile`, żeby dało się mierzyć jeden układ bez
  powtarzania całego przebiegu.

### 6. Czego audyt świadomie nie zgłasza

Zweryfikowane w źródle jako poprawne, więc nie są usterkami: `Text.setText` w Phaser sam pilnuje
zmiany (`Text.js:651`), więc etykiety NPC co klatkę są tanie; `sendPosition` ma throttling przez
`sendRateHz` (`networkClient.ts:382`); kontenery aktorów są już przycinane do kadru z zapasem 220 px;
`update()` wychodzi przy `document.hidden`. Rozdzielanie potworów jest O(n²), ale przy limicie 32
to ~1000 porównań i nie boli — zostawione, z adnotacją co zrobić przy podniesieniu limitu.

### 7. Narzędzia i artefakt

- `scripts/perf/audyt-cpu.ts` — koszt `snapshot`, `statBreakdown`, `structuredClone`, `abilities`
  i `tick` przy 0/8/16/32 potworach, na prawdziwej sesji.
- `scripts/perf/audyt-swiata.ts` — pliki i bajty na ląd oraz liczba obiektów iterowanych co klatkę.
- Interaktywny raport z modelem budżetu klatki (9 parametrów na stałych z pomiaru, przełącznik
  desktop/mobile, 15 znalezisk z miejscem w kodzie i plan w pięciu fazach) — artefakt sesji.
- Audyt **nie zmienia kodu gry**. Zmiany dotyczą wyłącznie narzędzi pomiarowych i harnessu.
- Bramka: `eslint` na nowych i zmienionych plikach exit 0; `npm run typecheck` exit 0
  (limit cgroup wrócił do 4 GiB, więc bez flagi kopca).

### 8. Logowanie po edycji postaci w panelu (`COMMAND_REJECTED`)

- Przyczyna odczytana z logów serwera (workflow `game-server-logs.yml`, tylko odczyt):
  `Invalid server checkpoint: Nie można odczytać zapisu postaci.` — edycja z panelu zapisywała
  postać, która łamała niezmienniki wczytania punktu zapisu (`SuperiorSaveStore.load`):
  doświadczenie ≥ próg poziomu po zmianie poziomu, miecz/kamizelka w slocie bez posiadania,
  zadanie ukończone bez poprzednika, teleport na inny kontynent przy starym `feature`, pozycja
  poza światem lub w miejscu bez przejścia.
- `src/server/characters/playerRepair.ts` — naprawa pól zachowująca intencję edycji (nadanie
  przedmiotu, dokończenie poprzedników zadań, przycięcie XP poniżej progu, pozycja w granicach).
- `prepareServerSimulation` naprawia postać przed wczytaniem punktu zapisu, przenosi punkt zapisu
  na kontynent edytowanej postaci i zapisuje to w logu (`[Online] Naprawiono pola postaci…`).
  Dotychczas zablokowane postacie otwierają się bez ręcznej interwencji w bazie.
- Test `server-superior-simulation.test.ts`: postać ze wszystkimi powyższymi uszkodzeniami otwiera się.

### 9. Przebudowa graficznego drzewka umiejętności (widok V2)

Na polecenie właściciela: usunięto wrażenie nieczytelnej kolumny, dodano prawdziwe rozrysowanie rozgałęzień, przyciski dodawania umiejętności bezpośrednio przy węzłach oraz wyczerpujące opisy działań.

- **Układ drzewa zamiast kolumny:** `GraphicSkillTree.tsx` rysuje krzywe ścieżki SVG odzwierciedlające faktyczne zależności z aneksu (A1 rozgałęzia się na pasywy A2 i A3, które schodzą się do A4, z A4 rozgałęziają się A5 i A6, a wybór A7/A8 oznaczono czerwoną linią i plakietką „albo” informującą o wzajemnym wykluczeniu).
- **Dodawanie punktów przy rozgałęzieniu:** każdy odblokowany węzeł posiada bezpośredni przycisk `+` (`.ki-st-plus`) umieszczony przy ikonie zdolności, dzięki czemu gracz zwiększa rangę lub poznaje skill w miejscu rozgałęzienia bez schodzenia na dół panelu.
- **Brak limitu rang:** zachowano zasadę braku ograniczenia liczby punktów w węźle; interfejs jasno prezentuje bieżący mnożnik rangi i prognozę po dodaniu kolejnego punktu (`ranga X -> x(X+1)`).
- **Karty z opisami fabularnymi i parametrami działania:** moduł `skillTreeLore.ts` wprowadza fabularne cytaty dla każdego z 29 węzłów 4 ras, motto każdej z 3 gałęzi oraz analizator parametrów technicznych (`skillFacts`), który wyróżnia plakietkami mnożnik obrażeń, promień/zasięg, czas ogłuszenia/spowolnienia, czas trwania, koszt Ki i czas odnowienia.
- **Układ responsywny i zachowanie kompatybilności:** wprowadzono dedykowane style w `skill-tree.css`. Na ekranach panoramicznych i komputerach karta opisu (`.ki-st-card.ki-gst-card`) znajduje się z prawej strony obok tablicy drzewka (`.ki-st-board.ki-gst-board`), spełniając asercje testów E2E, a na wąskich ekranach panel płynnie przełącza się w widok kolumnowy z zakładkami gałęzi.
- **Weryfikacja:** dedykowany test `src/test/graphic-skill-tree.test.tsx` (5/5 PASS), pełny `npm run typecheck` exit 0, `python scripts/docs/check_documentation.py` PASS.

### 10. Faza 1 wdrożona: budżet podłoża i pętla widoczności na istniejącej siatce

- Właściciel: „Lagi są bardzo nie wyobrażalne na komputerze a nie chcę widzieć tego na telefonie.
  Działaj etapami. Od fazy pierwszej". Zakres: pamięć i pętla, bez ruszania rozgrywki ani zapisów.
- **Budżet tekstur domknięty o podłoże.** Nowy `src/game/assets/groundBudget.ts` liczy koszt
  upieczonych canvasów (`12 × res² × 4`) i dobiera rozdzielczość pieczenia do reszty budżetu po
  atlasach (`chooseGroundResolution`, kandydaci 1024 → 768 → 512). Renderer Superior dostaje realny
  koszt rezydujących atlasów (`residentAtlasBytes` z `superiorRuntime`), a bramka spawnu dolicza
  podłoże zamiast ufać stałej `STREAM_RESERVED_BYTES = 20 MiB`, która pokrywała tylko 20 z 48 MiB
  podłoża przy 1024. Degradacja idzie po rozdzielczości, nie po treści.
- **Pętla widoczności na istniejącej siatce.** Renderer Superior nie używał `sceneryStream.ts`,
  który już istniał i był używany przez renderer v1. Podpiąłem go zamiast pisać własny moduł
  (własny `sceneryBuckets.ts` powstał, ale został usunięty jako duplikat). Komórki w kadrze są
  powiększone o `sceneryReach`, więc żaden widoczny obiekt nie wypada; obrazy obiektów poza
  kandydatami są gaszone po indeksie, nie po pełnym przejściu.
- **Pomiar pamięci (renderer-independent, czysty przebieg):** Verdantia **210,8 → 176,6 MiB**,
  Aetheria **233,1 → 199,4**, Nexus **240,5 → 206,9**, Pyra **198,2 → 183,4**. Spadek ~34 MiB
  wszędzie (podłoże 1024 → 512). Verdantia i Pyra schodzą pod sufit 192; Aetheria i Nexus nadal
  ponad, bo ich atlasy są cięższe — to zostaje na Fazę 2/3.
- **Pomiar FPS mobile (844×390, czysty przebieg, Canvas bez GPU):** Verdantia **21,7 → 30,4**,
  Nexus **29,0 → 31,4**, Pyra **17,8 → 28,0** (p50 klatki 59,5 → 25,0 ms), Aetheria 26,1 → 21,9.
  Trzy z czterech światów szybciej; Aetheria wymaga osobnego spojrzenia. FPS z programowego
  Canvas jest szumny i pesymistyczny względem telefonu z GPU — pamięć jest tu pewnym wynikiem.
- **Pomiar pętli (`scripts/perf/audyt-buckets.ts`, na prawdziwym `sceneryStream`):** kandydaci
  3840 → 730 (5,3× mniej), skan **1,55–1,95×** szybszy. Uczciwie: to nie 8×, jak szacował audyt —
  odrzucone obiekty kosztują mało, bo porównanie wychodzi wcześnie; zysk strukturalny rośnie na
  wolniejszym CPU telefonu.
- **Testy:** `ground-budget.test.ts` (6) pilnuje sufitu i doboru rozdzielczości;
  `superior-visibility-grid.test.ts` (4) pilnuje niezmiennika „żaden widoczny obiekt nie wypada"
  na gęstej dziczy i mieście, na dużych obiektach z kotwicą poza kadrem i na pustym kadrze.
- **Świadomie zostawione na Fazę 2:** cienie jako osobne GameObjecty, pieczenie blokujące wątek,
  `snapshot` 10×/s i brak memo w HUD. Wypiekanie cieni w podłoże zmienia obraz, więc czeka na decyzję.

### NPC Trener dla czterech ras z filmu obrotu

- Wejście: film obrotu „Trener" (przód, ukosy, bok, tył, napis pod stopami). `scripts/anim/npc_trainer_build.py`
  wycina po jednej pozie na kierunek (lewe ukosy to odbicia prawych), matuje rembg (isnet-anime),
  zostawia tylko największy spójny kształt (napis „Trener" odpada) i skaluje wszystkie klatki jedną
  wspólną skalą, stopy na linii kotwicy 0,95. Z każdej pozy powstaje 8-klatkowy oddech (0–1,5 %
  rozciągnięcia pionowego od stóp). Klip `walk` wymagany przez kontrakt NPC używa tych samych nazw klatek
  co `idle`, więc nie kosztuje pamięci tekstur.
- Cztery rasy to ta sama postać: skrypt przekolorowuje wyłącznie ubiór (czerwono-pomarańczowy pas i
  hafty dostają barwę rasy, ciemny materiał jest lekko podbarwiony); głowa, skóra, włosy i buty
  zostają bez zmian. Barwy: Pyra (Legendy) oryginał czerwień, Verdantia (Planetarni) zieleń 125°,
  Aetheria (Mędrcy) turkus 190°, Nexus-9 (Androidy) błękit 225° (`NPC_HUE` zmienia odcień).
- Instalacja: `npc-<świat>-trainer` 1.2.0, binding `<świat>.npc.trainer`, rozmiar 192 (2× zwykły NPC, `contract.npcLarge`),
  klatki 256 px, dwie pozy oddechu użyte w 8 klatkach idle (te same prostokąty atlasu), atlas 1539×244 (1,43 MiB)
  na świat. Budżet tekstur: Verdantia 126,9, Aetheria 112,6, Nexus-9 105,4, Pyra 113,2 z 128 MiB. Wizual dostaje NPC o id `trainer` (mistrz treningu w arenie).
- `scripts/lib/gpu-import.ts`: klucz bindingu NPC przyjmuje dowolny slug roli (jak już wrogowie),
  `<świat>.npc.trainer` nie był dotąd dozwolony. Test `npc-trainer-visual.test.ts` obejmuje cztery światy.
- Barwy ras dobrane z dominujących kolorów bohaterów; dialogi i umiejscowienie NPC bez zmian.

### Postacie w pomieszczeniach większe, NPC większy od bohatera, Trener jako autorytet

- Wnętrza to jeden malowany obraz (1920×1280) z dużymi meblami, a postacie miały skalę świata zewnętrznego,
  więc ławka czy poducha były większe od bohatera. W pomieszczeniu postacie są rysowane większe:
  bohater ×1,5, zwykli NPC ×1,6, a NPC z dużego zasobu (Trener, 192) ×1,4, czyli
  ok. 1,3 raza wyższy od bohatera i wyraźnie wyższy od zwykłych NPC (zmniejszony z 3× na 2× na prośbę właściciela). Skala jest na kontenerze postaci (cień, obrys i halo rosną razem),
  a podpisy nad głową podnoszą się o tyle samo (`interiorScale` w `mountGame.ts`). Na zewnątrz bez zmian.
- Zwykli NPC powiększeni ×1,6 z komórek 128 px są lekko miękcy; ostre pozostają bohater i Trener (256 px).

### Mapa 2D: przesuwanie na szerokim, niskim ekranie

- Odtworzone w przeglądarce (telefon w poziomie 844×390, najmniejsze powiększenie): widok jest tam szerszy
  niż mapa, a `clampView` przy takim widoku na sztywno ustawiał `cx` na środek, więc przeciągnięcie nie
  robiło nic (zapętlone przesuwanie działało tylko po przybliżeniu albo na węższych ekranach).
- `clampView` zawsze zawija długość geograficzną; `wrapCopies` liczy kopie mapy także dla widoku szerszego
  niż mapa (trzy kopie), więc po bokach nie ma dziur. Test `planet-map.test.ts`: pełny obrót wraca do startu,
  kopie pokrywają cały widoczny pas.

### 11. Faza 2 (część 1): tani HUD i koniec alokacji co klatkę

- Właściciel: „Ruszaj Fazę 2, nie ma czasu". Zakres: bezpieczne, mierzalne zmiany bez ruszania
  obrazu świata. Pieczenie w porcjach i pełna memoizacja HUD zostają na kolejny podkrok (ryzyko
  wizualne / duży refactor), żeby nie wdrażać ich na ślepo.
- **Leniwy `statBreakdown` w snapshocie.** Zużywa go wyłącznie `CharacterStatsPanel` otwierany na
  żądanie, a był liczony (6× `deriveStats`, 0,25 ms) przy każdym odświeżeniu HUD 10×/s. Teraz to
  getter: liczy się tylko, gdy panel go czyta — 0×/s przy zamkniętym panelu. Snapshot bez czytania
  breakdown: 1,10 → 0,95 ms.
- **Jeden snapshot na naciśnięcie klawisza.** Gałąź `loot`/`interact` wołała `session.snapshot()`
  do trzech razy pod rząd w jednym handlerze; teraz jeden, współdzielony.
- **Flaga „typing" z `focusin`/`focusout`.** Zamiast `document.activeElement.closest(...)` co klatkę
  (60 zapytań DOM/s), flaga ustawiana zdarzeniami focus i sprzątana przy DESTROY sceny.
- **Mapa NPC przebudowywana tylko przy zmianie listy.** Zamiast `new Map(session.npcs.map(...))`
  co klatkę; pozycje NPC aktualizują się w miejscu, więc mapa pozostaje ważna.
- **Naprawione dwa błędy typechecka istniejące na HEAD:** `superior-visibility-grid.test.ts`
  (tablica współrzędnych jako `[number, number][]` przy `noUncheckedIndexedAccess`) oraz
  `graphic-skill-tree.test.tsx` (nieistniejący typ `GameViewState["equipment"]` w mocku, po merge'u
  innego agenta). Uwaga: wcześniejszy „typecheck 0" Fazy 1 był kodem wyjścia `head` w potoku, nie
  `tsc` — błąd mojego testu przeoczyłem; teraz bramka liczona bez potoku maskującego.
- Bramka: `npm run typecheck` exit 0 (wszystkie 3 konfiguracje), `eslint` zmienionych plików exit 0,
  testy sesji/HUD/drzewka/siatki 73 passed; pełny zestaw 1259 passed / 10 skipped (dwa pozorne
  padnięcia: test siatki z wersją sprzed merge'a i timeout `gpu-pipeline` przy konkurencji CPU —
  oba ponowione czysto, 21 passed).
- **Pomiar end-to-end (mobile 844×390, Canvas bez GPU):** pamięć identyczna jak po Fazie 1
  (176,6 / 199,4 / 206,9 / 179,5 MiB) — Faza 2 nie rusza tekstur. FPS z tego przebiegu **nie jest
  wiarygodny per-świat**: spada monotonicznie w trakcie biegu (29,5 → 17,1 → 13,8 → 13,7) przy
  rosnącym czasie wejścia (22 → 31 s), czyli środowisko pomiaru degraduje się w trakcie, a kod Fazy 2
  tylko zmniejsza pracę. Pewny wynik Fazy 2 to mikrobenchmark CPU: snapshot 1,10 → 0,95 ms
  i `statBreakdown` 0×/s przy zamkniętym panelu. Miara docelowa = fizyczny telefon.

### 12. Faza 2 (część 2): pieczenie chunków w kolejce — koniec zamrożeń przy wejściu

- Właściciel: „nie ma czasu". Wybrano największe lagi: synchroniczne pieczenie wszystkich chunków
  naraz w jednej klatce. `drawGround` jest krytyczny wizualnie, więc zamiast refactoru na maszynę
  stanów (ryzyko obrazu) użyto bezpiecznego odroczenia: `load()` liczy pozycje i akwizycję assetów,
  a bake trafia do `bakeQueue`, drenowanej w `updateVisibility` po **maks. 2 chunki na klatkę**.
- **Zamrożenie (najdłuższa klatka, desktop 1280×900) spada ~76%:** Verdantia **4908 → 1138 ms**,
  Aetheria **11916 → 2825 ms**, Pyra **10085 → 2391 ms**. Nexus 308 → 1482 ms (i tak najniższy).
  Łączny czas wejścia bez zmian (~26–33 s w tym środowisku), ale rozłożony na klatki zamiast jednej
  blokady — gracz widzi płynny obraz, nie zamrożenie.
- **Render bez dziur i błędów:** po ustabilizowaniu Verdantia ma 270 obiektów / 232 widoczne /
  116 tekstur / 176,6 MiB i **zero błędów konsoli** — identycznie jak przed zmianą. Chunk chciany
  jest zawsze drenowany (pętla co klatkę), więc nie ma trwałych dziur; jest 1–2 klatki opóźnienia.
- Bramka: typecheck exit 0, testy renderu (stale-chunk, scenery-stream, visibility-grid) 10 passed,
  testy świata (spawns, save, dress, characters) 33 passed; **pełny zestaw 1264 passed / 10 skipped
  (122 pliki), zero padnięć**.
- Uwaga: FPS z programowego Canvas w tym kontenerze degraduje się w trakcie długich przebiegów
  (czas wejścia rośnie 22→33 s), więc per-światowe FPS nie jest wiarygodną miarą; wiarygodne są
  frameMax (zamrożenie) i pamięć, niezależne od tego dryfu. Miara docelowa = fizyczny telefon.

### 13. Faza 2 (część 3): memoizacja HUD — drzewko i panel walki nie renderują się 10×/s

- HUD odświeża się 10×/s (`report()` → `snapshot()` → `setState`), a panele dostają cały nowy obiekt
  stanu za każdym razem. Bez memo kosztowne panele przerysowywały się przy każdym tyknięciu, nawet
  gdy ich dane się nie zmieniły.
- **`GraphicSkillTree`** owinięte w `React.memo` z komparatorem na polach, których faktycznie używa:
  rasa, poziom, złoto, punkty, koszt respec i lista umiejętności (+ stabilne `send`). 29 węzłów
  i ścieżki SVG nie przerysowują się, gdy gracz tylko się porusza. Nauka / respec / zmiana poziomu
  przepuszczają render.
- **`CombatPanel`** owinięte w `React.memo` z porównaniem treści listy wrogów (id, hp, maxHp, poziom,
  nazwa, boss) i celu. W walce HP się zmienia, więc panel aktualizuje się na bieżąco; poza zmianą
  wrogów/celu pomija re-render.
- **Test dowodzący memo:** szpieg `canLearn` (wołany tylko podczas renderu drzewka) liczy wywołania —
  przy niezmienionych polach drzewka 0 wywołań po re-renderze (memo pomija), przy nauce umiejętności
  wywołania wracają. To realny dowód pominięcia, nie tylko „testy przechodzą".
- Panele o złożonych zależnościach (Inventory, QuestJournal, CharacterStatsPanel — staty/buffy/heritage)
  świadomie zostawione na osobny ostrożny pass, żeby komparator nie pominął potrzebnego renderu.
- Bramka: lint zmienionych plików exit 0, typecheck exit 0 (3 konfiguracje), testy drzewka 6 passed,
  testy HUD 16 passed; **pełny zestaw 1265 passed / 10 skipped (122 pliki), zero padnięć**.

### Panel GM: opcja „Unlimited" (brak odnowień)

- Nowy przycisk „Unlimited" w panelu GM/ADM obok „Nieśmiertelność": po włączeniu zdolności nie mają odnowień
  (można je rzucać bez przerwy), a koszt KI nadal obowiązuje. Ponowne kliknięcie przywraca zwykłe odnowienia.
- Implementacja: `Kit.noCooldowns` (pomija sprawdzenie odnowienia, nie ustawia go po rzucie i zeruje w `tick`),
  `GameSession.unlimited` + komenda `staff/unlimited` (tylko dla GM/ADM, tak jak `god`), pole `unlimited` w
  widoku HUD oraz wpis w schemacie komend serwera online (`staff` enum). Test `gm-unlimited.test.ts` dla czterech ras.
- Dotyczy odnowień zdolności z paska (w tym Formy/Trybu KI); podstawowy atak i unik zachowują swoje tempo.

### 14. Faza 3 (część 1): limit cache service workera — koniec nieograniczonego wzrostu na telefonie

- `public/ki-assets-sw.js` cache'uje wszystko pod `/game/` (cache-first dla niezmiennych paczek GPU,
  stale-while-revalidate dla reszty), ale **nie miał limitu**. Dziesięć lądów × ~50 MB rosło w
  nieskończoność; na telefonie potrafiło przepełnić storage, co zamiast przyspieszać — wyrzucało
  cache i spowalniało kolejne wejścia.
- Dodany limit `MAX_ENTRIES = 800` z przycinaniem najstarszych wpisów (`trim()`), uruchamianym co
  `TRIM_EVERY = 40` zapisów, żeby nie liczyć kluczy przy każdym żądaniu. `cache.keys()` zwraca
  kolejność wstawiania, więc usuwanie od początku przybliża LRU.
- Wersja cache podbita `ki-assets-v1 → ki-assets-v2`: istniejący `activate` kasuje stare wersje,
  więc nieograniczony cache z poprzedniej wersji zostanie wyczyszczony przy aktywacji.
- Zachowane bez zmian: cache-first dla `/gpu/<pack>/<wersja>-<hash>/`, pomijanie muzyki i żądań
  Range, sieć dla wszystkiego poza `/game/`.
- Weryfikacja: `node --check public/ki-assets-sw.js` exit 0; lint exit 0 (0 błędów, 15 istniejących
  ostrzeżeń react-refresh); typecheck exit 0 (3 konfiguracje).
- **Bramka testów — uczciwie:** pierwszy pełny bieg puściłem równolegle z typecheckiem i na 4 CPU /
  4 GiB ciężkie testy zagłodziły się: 4 padnięcia to wyłącznie **timeouty** (gpu-pipeline: pakowanie
  416 klatek 2×60 s + version-bump 5 s; adventure-ui: 5 s), zero asercji. Izolowany re-run tych dwóch
  plików (bez tsc w tle): **21/21 passed, exit 0** — pakowanie ~19,5 s, version-bump 2 s, quest 2,4 s.
  Efektywnie pełny zestaw **1265 passed / 10 skipped, zero realnych padnięć**. Lekcja: bramkę
  odpalać sekwencyjnie (lint → typecheck → testy), nie równolegle na tym kontenerze.
- **Uczciwie:** to porządkuje cache i chroni storage na telefonie, ale **nie skraca pierwszego
  wejścia** do celu <5 s. Cel <5 s wymaga większej pracy: bundlowania JSON-ów chunków/art (dziś
  ~3872 pliki / ~51,6 MB na świat, 2 fetch/e chunk) + prefetch. To osobny, większy krok — nie
  ruszany bez zgody właściciela.

### 15. Faza 4: bramka wydajności CI — pilnuje pamięci, zamrożenia i wejścia, nie surowego FPS

- **`src/game/assets/perfGate.ts`** — czysta funkcja `evaluatePerfGate` (importuje realny
  `STREAM_TEXTURE_BUDGET_BYTES`), czyta raport z `scripts/measure-game.ts`, nie uruchamia przeglądarki.
  **`scripts/perf/bramka-wydajnosci.ts`** (`npm run bench:gate <raport.json>`, exit 0/1/2) + test
  **`src/test/perf-gate.test.ts`** (11 testów: łapie każdy typ naruszenia, ignoruje FPS).
- Progi (niezależne od renderera, skalibrowane na realnym pomiarze): **całkowita pamięć tekstur
  ≤ 220 MiB**, **zamrożenie `frameMax` ≤ 3000 ms**, p95 ≤ 3000 ms (miękki), **wejście ≤ 60 s**, zero
  błędów strony. Surowy FPS **nie jest** kryterium — programowy Canvas jest pesymistyczny i degraduje
  się w biegu. Progi nadpisujesz `KI_PERF_TEXTURE_MB / FREEZE_MS / P95_MS / ENTER_MS`.
- **Kluczowe rozróżnienie pamięci:** telemetryczne `estimatedTextureBytes` to CAŁOŚĆ (atlas + podłoże
  - bohater + HUD + efekty), a budżet 192 MiB dotyczy tylko streamowanego podzbioru (osobno weryfikują
    go testy stream-texture-budget / ground-budget). Pierwsza wersja bramki błędnie porównała całość do
    192 i oblała aether/nexus — poprawione na sufit całości 220 MiB (budżet + 28 MiB na niestreamowane).
- **Realny pomiar kalibracyjny** (harness, mobile 844×390, Canvas, 4 światy): tekstury verdant 176,6 /
  aether 199,4 / nexus 206,9 / pyra 183,5 MiB (road-cache = 0); zamrożenie 780–2192 ms; wejście
  10,3–15,3 s; FPS 15–34 (software, pominięty). Bramka na tym raporcie: **PASS**.
- Bramka jakości **sekwencyjnie** (lekcja z cz. 1): lint 0 błędów (15 istniejących ostrzeżeń),
  typecheck 0 (3 konfiguracje, CLI dodany do tsconfig.tools), **testy 1281 passed / 10 skipped (125
  plików), zero padnięć**. Formatowanie nowych plików prettier (4 błędy auto-fix naprawione).
- **Uczciwie:** to bramka regresji na wielkościach niezależnych od renderera, gotowa do CI. **Pomiar
  FPS na fizycznym telefonie nadal wymaga urządzenia właściciela** — w grze jest `?ki-debug=bench`
  (FPS / p95 / max / czas JS-GPU), a harness zapisuje raport, który ta bramka ocenia. Kontener nie ma
  fizycznego telefonu ani GPU, więc nie podaje „FPS na telefonie" — podaje pamięć, zamrożenie i wejście.

### 16. Tryb diagnostyczny urządzenia — autonomiczny pomiar 45 s z raportem do pliku (na telefonie właściciela)

- Na polecenie właściciela: z panelu admina uruchamiana gra w trybie diagnostyki, postać **chodzi
  i wykonuje polecenia sama przez 45 s** (bez udziału gracza), a na koniec **zapisuje raport do pliku**.
  Działa na fizycznym telefonie i w przeglądarce — to domyka Fazę 4 o realny pomiar na urządzeniu.
- **`src/game/diagnostics.ts`** — rdzeń (czysty, testowalny): `startDiagnostics` wydaje autonomicznie
  `move` (pętla waypointów wokół startu), `target`+`ability` przy wrogach, `dodge`, `heal`, włącza
  nieśmiertelność staff na czas pomiaru i przywraca ją po; próbkuje telemetrię `data-metrics` co 0,5 s;
  po czasie buduje raport. `diagWaypoints`, `buildDiagReport`, `diagSummary`, `downloadDiagReport`
  (pobieranie JSON). Raport jest zgodny z bramką `npm run bench:gate` (kształt `PerfReport`).
- **`src/components/game/DiagnosticsPanel.tsx`** + `diagnostics.css` — panel staff: przycisk
  „Diagnostyka 45 s", nakładka z odliczaniem / paskiem postępu / FPS / pamięcią / fazą na żywo,
  podsumowanie i ponowne pobranie raportu. Start przez przycisk, zdarzenie `ki:diag-start` albo `?ki-diag=1`.
- **Wejścia:** zakładka „Diagnostyka urządzenia" w `/admin` (link `/?ki-diag=1` otwiera grę w trybie
  pomiarowym) + przycisk „Diagnostyka 45 s" w panelu GM (`StaffTools`). Render w `GameHud` dla staff.
- Raport niesie: FPS śr./min, p95, zamrożenie `frameMax`, pamięć tekstur, czas wejścia, liczbę próbek,
  błędy strony oraz dane urządzenia (userAgent, viewport, DPR, rdzenie, pamięć, touch, renderer).
- Weryfikacja: testy rdzenia **7/7** (waypointy, raport zgodny z bramką, podsumowanie, autonomiczny
  przebieg na fake-timerach, przerwanie) + test komponentu **3/3** (przycisk → nakładka → raport
  i pobranie; przerwanie; brak renderu dla non-staff). Bramka **sekwencyjnie**: lint 0 błędów,
  typecheck 0, **testy 1291 passed / 10 skipped (127 plików)**, **build produkcyjny 0**.
- **Uczciwie:** logikę i UI zweryfikowano w kontenerze (jsdom); **realny FPS zmierzy dopiero urządzenie
  właściciela** — po uruchomieniu diagnostyki raport pobiera się jako plik JSON i można go ocenić
  `npm run bench:gate`. Kontener nie ma fizycznego telefonu ani GPU.

### Wdrożenie: czyszczenie obrazów dockera na serwerze Aruba (koniec „no space left on device")

- Awaria 11.11.2026 ok. 21:07: wdrożenie `8ede8d07` padło na kroku „Deploy tested candidate…" z
  `write … no space left on device` (eksport obrazów dockera), a bazy i usługi na serwerze zrestartowały się.
  Przyczyna: każde wdrożenie buduje na serwerze dwa obrazy `ki-legends-web/app:staging-<sha>` i cache budowania;
  `docker image prune -f` na końcu skryptu usuwał tylko obrazy bez tagu, więc otagowane obrazy poprzednich wydań
  zostawały na zawsze (dziś ok. 17 wdrożeń).
- `deploy/scripts/promote-coolify-release.sh`: funkcja `cleanup_images` usuwa obrazy `staging-*` wszystkich wydań poza
  budowanym i poprzednio działającym (zostaje na ręczny rollback), potem `docker image prune -f` i
  `docker builder prune --filter until=48h`; wypisuje `df -h /`. Uruchamiana **przed** budową (żeby kolejne wdrożenie
  nie zabrakło miejsca) i po zweryfikowanym wydaniu. Docker nie usuwa obrazów używanych przez działające
  kontenery, a błąd sprzątania nie przerywa i nie cofa wydania (`|| true`).
- Weryfikacja: `bash -n`; logika funkcji sprawdzona na makiecie `docker` (zostają dwa wskazane tagi i tag `latest`,
  reszta `staging-*` usunięta; przy pustym drugim tagu zostaje tylko budowany). **Nie sprawdzone na serwerze** —
  zadziała przy najbliższym wdrożeniu po scaleniu; wynik `df -h /` będzie widać w logu kroku wdrożenia.

### 17. Balans: schodkowy wzrost prędkości ruchu + twardy limit 1200 j./s (decyzja właściciela)

- Na polecenie właściciela: wzrost prędkości zmienia się z flat **+5%/poziom (cap 20)** na **schodkowy,
  bez capu poziomu**: **poz. 2–9: +5%, 10–19: +4%, 20–29: +3,5%, 30+: +3%** (addytywny % bazy rasy).
  Mnożniki: poz. 10 ×1,44; poz. 20 ×1,835; poz. 30 ×2,18; poz. 60 ×3,08.
- **Twardy limit prędkości ruchu `MAX_MOVE_SPEED = 1200 j./s`** nakładany na końcową prędkość
  (z bonusami ekwipunku/buffów), wspólny dla klienta i serwera — żeby wysokie poziomy nie przekraczały
  limitu. Źródło: `src/game/kit/balance.ts` (`speedGrowth`, `SPEED_GROWTH_TIERS`, `MAX_MOVE_SPEED`),
  cap w `src/game/kit/base.ts`. Interwał ataku nadal nie rośnie.
- Dokumentacja: `docs/ROZWOJ-I-WALKA.md` (tabela „Ruch j./s" + przypis z progami i capem).
- Weryfikacja: nowy `src/test/speed-growth.test.ts` **7/7** (progi, wartości na progach, brak capu,
  monotoniczność, limit 1200) + `kit.test.ts` zaktualizowany (poz. 10/20/60) i nowy test capu **31/31**.

### 18. Profil wydajności pieczenia podłoża (opt-in, Faza 5) — na zamrożenia przy wejściu w chunk

- Pomiar właściciela (WebGL, Verdant) pokazał: stan ustalony ~30–33 FPS, ale **15 zamrożeń od pieczenia
  chunków do 1603 ms**. Odpowiedź: **opt-in profil** `?ki-ground-res=512` (lub 768/1024) obniża sufit
  rozdzielczości pieczenia (koszt ∝ res² → 1024→512 to ~4× taniej) + **adaptacyjne pieczenie**: po
  wolnej pieczeniu (>100 ms) kolejka nie dokłada drugiej w tej klatce (`bakesPerFrame`).
- **Domyślnie nic nie zmienia** (bez parametru `groundResolutionOverride` = null, limit 2/klatkę jak
  wcześniej). Źródło: `src/game/assets/groundBudget.ts` + `renderSuperior.ts`. Testy **11/11** w
  `ground-budget.test.ts`. Pełna bramka sekwencyjna: lint 0, typecheck 0, testy 0, build 0.
- Do przetestowania na urządzeniu: `/?ki-diag=1&ki-ground-res=512` vs `/?ki-diag=1` (porównanie
  zamrożeń w raporcie). Docelowe rozwiązanie (poza głównym wątkiem / pre-bake kafelków) wymaga osobnej
  decyzji — ten profil jest bezpiecznym, odwracalnym krokiem pośrednim.

### 19. Mapa 2D: przybliżanie pokazuje prawdziwy teren (lasy, góry, biomy) — styl „real"

- Na polecenie właściciela: przy zoomie mapa ma pokazywać **prawdziwy świat — lasy, góry i to, co
  rzeczywiscie jest**, a nie płaskie plamy koloru. Przyczyna: `render_v2_maps.py` malował mapy stylem
  „calm" (średni kolor biomu + tylko 18% tekstury).
- **Nowy styl `MAP_STYLE=real`** w `scripts/worldgen/v2/render_v2_maps.py`: pełna tekstura podłoża
  (80% tekstury + 20% średniej), więc las/góra/bagno czytają się jak prawdziwy teren. Domyślny „calm"
  bez zmian (opt-in przez env). Zachowane: grzbiety gór, wybrzeża, woda śródlądowa, drogi.
- **Zregenerowano `map-hi.webp` wszystkich 10 lądów** stylem „real" w tej samej rozdzielczości
  (kontynenty `MAP_WIDTH=8192 MAP_SUFFIX=-hi MAP_UPSAMPLE=2`, wyspy domyślne). **Wymiary `map-hi.json`
  identyczne** (np. verdant 3985×3011) → kafelki overlay i projekcja świata bez zmian. `map.webp`
  (mapa podstawowa) nietknięta.
- **Weryfikacja liczbowa** (vision bridge niedostępny): średni kontrast sąsiednich pikseli (energia
  tekstury) fragmentu verdant wzrósł **1,28 → 2,53 (~2×)** calm→real — potwierdza realną teksturę.
  Warstwa `TerrainCanvas` (`WorldOverlay.tsx`) już ładuje `map-hi.webp` od zoom ≥ 3, więc prawdziwy
  teren pokazuje się przy przybliżaniu bez zmian w kodzie klienta.
- **Globus — uczciwie:** globus owija malowany atlas `atlas-v2-3840.webp` przez pipeline
  `render_v2_planet_terrain.py` → `build_v2_atlas.py` (repaint GPU) → `build_globe_textures.py`,
  a oba skrypty wymagają `scipy` (niedostępny, PEP 668 blokuje instalację). Pokazanie realnej tekstury
  na globusie to osobny krok (scipy + pipeline atlasu) — nie ruszany bez zgody i narzędzi. Globus nadal
  pokazuje realny układ biomów z orbity.

### Zamrożenia na telefonie właściciela: adaptacyjna rozdzielczość podłoża i przyczyna w raporcie

- Raport `ki-diagnostyka-pyra-2026-11-11T23-43-30` (Pyra, 763×360, DPR 3, 45 s marszu): ok. 50 kl./s, ale 8 z 40 sekund
  ma zamrożenia 600–1760 ms (kl./s 1,7–18). Pamięć tekstur 197 MiB, 100–105 tekstur, sterta JS stabilna (109 MB).
  Wzorzec (pojedyncze zamrożenia co kilka sekund w ruchu) pasuje do synchronicznego pieczenia chunku podłoża.
- Zmiana (`renderSuperior.ts`, `groundBudget.ts`): bez ręcznego profilu `?ki-ground-res` urządzenie samo obniża rozdzielczość
  pieczenia kolejnych chunków (1024→768→512, `nextGroundResolution`) po pieczeniu wolniejszym niż 200 ms i nie rośnie z powrotem;
  po wolnym pieczeniu piecze się 1 chunk na klatkę (wcześniej zawsze do 2). Koszt pieczenia rośnie z kwadratem rozdzielczości.
- Diagnostyka: raport zawiera teraz `bakes`, `bakeMaxMs`, `bakeResolution` na próbkę, więc następny pomiar pokaże, czy zamrożenia to
  pieczenie (wtedy `bakeMaxMs` ≈ zamrożenie). **Nie potwierdzone na urządzeniu**: kontener nie ma telefonu; w testach lokalnych
  (swiftshader) podłoże Pyry i tak startuje od 512 przez budżet tekstur, więc ścieżka adaptacji pokryta jest testem jednostkowym.
