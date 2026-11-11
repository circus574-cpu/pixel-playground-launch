# Dziennik zmian — 6 listopada 2026

## Świat: scalenie wysp, przegląd i generator dekoracji

### 1. Scalenie oprawy sześciu wysp Superiora do `main`

- Właściciel polecił scalać (`działaj dalej. scal.`) po otrzymaniu pomiaru: własne materiały
  wysp zmieniają **54,9–69,3 %** pikseli kadra (różnica pikseli `sharp`, kadry 900 × 560).
- `feat/superior-islands-art` scalona do `main` jako fast-forward (`bb7e3412`), po scaleniu
  z `origin/main` (`fe1e1c7b`). Zakres: sześć pakietów importera `superior-island-{1..6}-art`,
  katalog 177 → 184 pozycje, `src/game/world/generated/islandArt.ts`, podpięcia w
  `superiorRuntime.ts` i `renderSuperior.ts`, `src/test/island-art.test.ts` (8),
  `e2e/island-art.spec.ts`, manifesty `art/production/superior-islands-v1/*/runtime-pack.json`.
- **Pieczona flora wycofana przed scaleniem** (`?ki-flora-bake=1`): pomiar dał 0,1–0,3 %
  zmienionych pikseli, czyli funkcja nic nie zmieniała na ekranie. Uzasadnienie i liczby w
  [dzienniku 05.11](../2026-11-05/ZMIANY.md#dekoracja-dziczy--pomiar-i-decyzja).
- W momencie scalenia wyspy były jeszcze opt-in; tego samego dnia właściciel zarządził
  wyłączenie flagowania — patrz §4.
- Konflikt w dzienniku 05.11 był addytywny: obie strony dopisały sekcje na końcu pliku.
  Utrzymałem wpisy o wyspach i dekoracji oraz wpisy mapowe `origin/main`, tylko numery
  mapowych nagłówków przesunąłem z 8 i 9 na 11 i 12, bo plik miał już 8 (Nexus),
  9 (wyspy) i 10 (pomiar dekoracji).
- Naprawa znaleziona przy uczciwym odczycie wyników: `e2e/island-art.spec.ts` używał `require()`,
  co eslint ocenia jako błąd. Wcześniejszy raport „lint bez błędów" był **fałszywy** — kod wyjścia
  brałem z `tail` w potoku, a nie od eslinta. Poprawione w `bb7e3412`; od tej pory bramka zapisuje
  kody wyjścia bez potoków.
- Bramka na scalonym stanie: TypeScript (3 konfiguracje) 0, `npm run test` 116 plików
  (1 pominięty) 0, lint 0 błędów / 15 ostrzeżeń, `check_documentation.py` PASS, build 0.

### 2. Przegląd świata: gdzie naprawdę jest pustka

- Audyt gęstości na danych `public/game/worlds/superior-v2` (okno kadru 1452 × 903 j. świata
  przy zoomie 0,62):

  | Ląd | Dekoracje w kadrze: dzicz | Środek osady | `acceptedCityScenery` | Budynki w oprawie |
  | --- | ------------------------ | ------------ | --------------------- | ----------------- |
  | verdant | 6 | 0 | 85 | 102 |
  | pyra | 12 | 0 | 64 | 102 |
  | aether | 7 | 0 | 130 | 101 |
  | nexus | 9 | 11 | 65 | 101 |
  | island-1…6 | 30–79 | 0 | **0** | 25–26 |

- **Wniosek odwraca wcześniejsze założenie:** pusty jest kontynent, nie wyspy. Cytowana
  05.11.2026 liczba „5 dekoracji w kadrze" to pomiar na placu osady, a nie w dziczy. Drugi
  wymiar tej samej luki: żadna osada nie ma dekoracji autorskich w swoim obszarze, a wyspy nie
  mają ani jednej pozycji `acceptedCityScenery`. 29 % chunków kontynentów nie ma ani jednej
  dekoracji autorskiej.

### 3. Generator dekoracji świata `?ki-dress=1` i wada ramek island-6

- Nowy `src/game/world/generated/worldDress.ts`, opt-in `?ki-dress=1`:
  `continentDress` (siatka 150 j. z polem gęstości w komórkach 700 j., miksy tylko z realnych
  wiązań danego lądu, limit 130), `continentAir` (efekty tylko dla Nexusa i Pyry, bo tylko te
  pakiety mają `fx-*`), `townDress` (pierścień 380–1700 j. wokół placu, omija budynki, trakty i
  ulice, limit 320). Wszystko `solid: false` bez footprintu — kolizje, nawigacja, questy i
  zapisy czytają nadal świat autorski. Dekoracja nie dokłada pozycji katalogu ani bajta budżetu
  tekstur.
- Zmierzone na realnym katalogu (`tsx`, import kodu projektu, bez reimplementacji):
  dzicz kontynentów **108 obiektów na chunk, 36 w kadrze** (baza 6–12), osady wysp
  **154–172 dekoracje, 25–28 w kadrze przybycia** (baza 0).
- Kadry dowodowe (playtest, programowy WebGL, ten sam teleport, czekanie na
  `data-superior-pending=0` i 15 s oddechu, zero błędów konsoli w obu przebiegach):

  | Punkt | Sprite'ów bez | Sprite'ów z | Zmienione piksele |
  | ----- | ------------- | ----------- | ----------------- |
  | verdant, rzadki kadr | 1 | 62 | 8,1 % |
  | pyra, rzadki kadr | 2 | 86 | 11,9 % |
  | island-2, plac osady | 5 | 56 | 11,9 % |
  | island-6, plac osady | 5 | 53 | 12,3 % |

  Kontynent bez dekoracji: verdant 1, pyra 2, nexus 25 sprite'ów w kadrze. Po włączeniu:
  62 / 86 / 81, z czego licznik `data-dress-scenery` przypisuje odpowiednio 61 / 84 / 80
  wygenerowanym obiektom.
- **Znaleziona wada materiałów, widoczna dopiero na kadrach z dekoracją:** ramki rekwizytów
  island-6 nie mają czystego wycięcia. Mediana alfa paska 40 px wzdłuż krawędzi klatki
  (`sharp` na `art/production/superior-islands-v1/island-N/props.png`): island-1 0–1,
  island-3 0, island-4 2–4, island-5 0–1, island-2 2–15, **island-6 3–51**
  (`deadwood` 47, `ember-obsidian` 51, `basalt-arch` 36). Halo jest obcięte granicą komórki,
  więc nad ciemnym obsydianem rysuje szary prostokąt zamiast aureoli. Generator nie może tego
  naprawić, więc dopóki atlas nie będzie wyeksportowany ponownie, trzy zamglone motywy island-6
  idą zastępczo za czysty rekwizyt kontynentu macierzystego (`object.pyra-continent.*`).
  **To jest wada dostawy, nie kodu:** te same ramki są używane przez dekorację autorską wysp,
  więc dotykają też tego, co już jest w `main`.
- Testy `src/test/world-dress.test.ts` (10): odrzucenie motywów z pakietu, którego nie ma,
  wypełnienie i limity, brak kolizji i footprintu, determinizm, wyłączanie przez
  `outside`/`onLand`/drogę, powietrze tylko przy realnych efektach, pierścień osady, omijanie
  budynków, brak motywów dla lądu, który ich nie ma, oraz zastąpienie zamglonych ramek.
- Nie zweryfikowano: e2e w kontenerze (programowy WebGL nie mieści się w budżetach czasu
  speców), wydajność na fizycznym telefonie.

### 4. Wyłączenie flagowania — wszystkie światy działają domyślnie

- Decyzja właściciela (06.11.2026): „wprowadzaj wszystkie zmiany na main. wyłącz flagowanie.
  wszystkie światy maja dzialac domyślnie." Cykl dobowy odrzucony jako zbędny.
- `DEFAULT_ON_SWITCHES` dostało `ki-islands-art` i `ki-nexus-continent`; `dressEnabled()`
  zwraca prawdę, dopóki URL nie powie `?ki-dress=0`. Zostaje wyłącznik na każdą warstwę,
  bo to jedyna droga powrotu bez reimportu pakietów.
- **Sprawdzone, a nie założone:** `ki-aether-art`, `ki-nexus-art`, `ki-pyra-art` i
  `ki-smithy-art` **nie zostały przeniesione**, bo ich pakiety (`aether-sanctuary`,
  `nexus-start`, `pyra-start`, `pyra-smithy`, `verdant-start`) nie mają `previewOnly` —
  są instalowane zawsze, więc przełącznik nic by nie zmienił. `ki-verdant-art` to zamiennik
  zaakceptowanej wsi Verdantii, nie jej brak, więc zostaje opt-in.
- Testy: `src/test/world-art-defaults.test.ts` (3) pilnuje domyślnego włączenia wysp, Nexusa i
  dekoracji oraz istnienia wyłączników; `src/test/nexus-continent.test.ts` zmieniony z
  „zostaje opt-in" na „domyślnie włączone, `=0` wyłącza".
- Ryzyko zapisane przed wdrożeniem: dekoracja dokłada ok. 50–80 sprite'ów na kadr, a pomiaru
  wydajności na fizycznym telefonie nie wykonano. Jeśli telefon poda FPS, wyłącznikiem jest
  `?ki-dress=0`, potem `?ki-islands-art=0`, potem `?ki-nexus-continent=0`.

### 5. NPC we wnętrzach, dialogi z katalogu i brak sylwetek

- Zlecenie właściciela: „następna rzecz to npc. w budynkach. ze swoimi sylwetkami i dialogiem."
- **Stan faktyczny po pomiarze (trzy wcześniejsze tezy okazały się moje, błędne):**
  - NPC **są** we wnętrzach i **są rysowani**. Drzewo sceny Phasera w „Pawilonie Wymiany"
    pokazuje kontener widoczny w `(960, 947)` z teksturą `hero-sheet`, a gracz wchodzi na
    `entry (960, 1120)` — 180 j. dalej, więc postać jest w kadrze. Sonda, która stawiała gracza
    60 j. od NPC (z pominięciem drzwi), sama ją zasłoniła; to nie jest wada gry.
  - NPC **nie są** sprite'em gracza: używają wspólnego arkusza `human-v2` (`tintable: true`),
    a nie malowanego bohatera rasy.
  - Kapital v2 ma **autorskie zdanie** każdego NPC w danych (`acceptedSource.npcs`: `name`,
    `role`, `building`, `tint`, `dialogue`), więc panel nie pokazuje samego sztywnego stringa.
- **Realne luki:**
  1. **Sylwetki.** Wiązanie `<świat>.npc.<rola>` jest już obsługiwane przez `actorVisual()`
     (`catalog.ts:324-327`), ale w katalogu jest **zero** takich wiązań i zero aktorów
     `profile: "npc"`; w całym repo nie ma grafiki NPC. Kod nie jest tu potrzebny — potrzebny
     jest pakiet z grafikami.
  2. **Głębokość rozmowy.** Katalog `src/game/dialogue` ma dla 28 NPC po 3 powitania, 3 plotki
     i teksty na konkretne questy; gra używała co najwyżej jednego powitania, a przycisk
     „Plotka" pokazywał 4 zdania kontynentowe.
- **Zmiany:** `WorldNpc.dialogueId` (klucz katalogu obok roli), `dialogueId` uzupełniany w obu
  gałęziach `buildSuperiorSimulationWorld` (kapital i miasta poza nim), licznik otwartych rozmów
  `dialogueTurn` w sesji i w widoku, panel dokłada rotujące powitanie z katalogu pod zdaniem
  autorskim, „Plotka" łączy hint o bossie z plotką rozmówcy zależną od postępów.
  Priorytet: **zdanie autorskie wygrywa**, katalog tylko dopinguje — ta sama postać bywa
  przypisana do dwóch ról (npc-mei = depozyt i kupiec), więc nadpisanie jej kontekstu byłoby
  błędem.
- Testy: `src/test/npc-dialogue-catalogue.test.ts` (5) — pełne pokrycie katalogiem (16 miast
  v2, 28 NPC, 0 bez dialogu), powiązanie roli z kluczem, plotka z katalogu, niezmieniony hint
  bez klucza, rosnący licznik rozmów. `src/test/npc-systems.test.ts` (5) nadal przechodzi.
- Nie zweryfikowano: wygląd okna rozmowy na fizycznym telefonie; teksty questowe katalogu
  (klucze O-V01, M09, IC-02…) należą do silnika questów v2, którego stan nie trafia do
  widoku lokalnej symulacji — to osobna praca.

## Pamięć Mędrców — TA10, TA11, TA12

Wznowiono istniejący Draft [PR #90](https://github.com/circus574-cpu/pixel-playground-launch/pull/90),
którego ostatnia partia była zapisana na `a9e44175` (Bariery, 24 próby / 72 stopnie).
Wcześniejsza lokalna dokumentacja main nie zawierała tego checkpointu. Kontynuacja
jest na `feature/racial-trials-continuation`; aktualny `main@83165f5c` włączono
lokalnym commitem integracji `9ea4ca28`. Nie scalano PR do main ani nie publikowano gry.

### Nowa zawartość

| Próba | I / II / III | Warunek |
| --- | --- | --- |
| TA10 Fragment i źródło | 3 / 4 / 5 fragmentów | Przypisz fragment do źródła, które zawiera dane świadectwo |
| TA11 Granice świadectwa | 2 / 3 / 4 twierdzenia | Rozpoznaj brak potwierdzenia w dostępnych dokumentach, nie utożsamiając go z dowodem fałszu |
| TA12 Kronika z niewiadomą | 3 / 4 / 5 zdarzeń | Odtwórz kolejność i zachowaj oznaczenie nieustalonego autora dopisku |

Nowe karty są jawnie materiałami ćwiczebnymi, nie dopisanym kanonem katastrofy.
Nie wymagają ukrytej wiedzy. Przypisanie dopisku Sorze bez dowodu lub usunięcie
informacji o nieznanym autorze kończy TA12 porażką. Odpowiedzi wymagają podejścia
do stanowiska, otwarcia materiałów i bieżącego numeru rundy. Nie ma przycisku
zaliczającego wynik, automatycznego odkrywania ani nagrody za czas bezczynności.

Wejście zwykłym UI: **Umiejętności → Rozwój · trening i wiedza → Próby**,
„Podejdź do trenera”, karta TA10/TA11/TA12, „Instrukcja · 1”, rozpoczęcie próby.
W sali podejdź do zielonego stanowiska, wybierz „Zbadaj stanowisko” i odpowiedź
z jawnych dokumentów. Zatwierdź gotowy wynik. Stopnie II/III wymagają wcześniejszego.

### Zapis, rangi i nagrody

- Dziedzina Pamięć (`source-memory`) ma oddzielną rangę od Pamięci Korzeni Planetarnych;
  do rangi potrzebne są wszystkie trzy próby na danym stopniu. Nie daje premii bojowej.
- Użyto istniejącego `TrialAttempt`, wypożyczonego `GameSession`, kontrolera stanowisk,
  transportu intencji serwera oraz księgi zatwierdzonych wyników. Klient nie przekazuje
  serwerowi gotowego werdyktu. Publiczne materiały nie zawierają pola odpowiedzi.
- Nagrody 100/150/200 praktyki wypłacane są raz na próbę i stopień. Ponowienia nie
  powielają praktyki ani XP/łupu. Stan właściciela, jego HP/KI, wyposażenie i cooldowny
  nie są przenoszone do wypożyczonego profilu ani resetowane po powrocie.
- Struktury i formaty bez zmian: development v3, klasyczny v10, Superior v6. Dodano ID
  treści do istniejącego katalogu. Starszy runtime odrzuca nieznane ID bez nadpisania.

Katalog po tej partii: **27/48 prób, 81/144 stopni** — Planetarni 12/12,
Mędrcy 9/12, Androidy 3/12, Legendy 3/12. Mędrcy uzyskują 4050 praktyki z prób;
teoretyczny budżet ich ścieżki wzrasta z 15 100 do **16 450**, nadal brakuje 1350
z dziedziny Skupienia. To arytmetyka katalogu, nie potwierdzenie osiągalności całej kampanii.

### Integracja aktualnego main

Zachowano nowsze grafiki, `kiwalk`, wnętrza, opt-in Nexusa i poprawki mapy.
Konflikty dokumentacji rozwiązano z zachowaniem obu dzienników; zachowano mechanikę
wyposażenia PR #90 zamiast przywracać wcześniejsze przeliczanie statystyk.
Wstępna regresja wykryła niezgodną asercję `moveSpeedPct` z main oraz fikcyjny ID
butów `BUTY-15-01`. Test zastąpiono silniejszą kontrolą istniejących `ZEST-04-04`:
dodatni rzeczywisty ruch i niezmieniony odstęp ataków. Nie osłabiono reguł gry.
Wstępny niezaliczony przebieg zachowano jako dowód, nie końcowy wynik.

### Weryfikacja

Testy nowej Pamięci sprawdzają wszystkie dziewięć wariantów, błędne źródło,
niepotwierdzone twierdzenie, przestawioną kolejność, dopisanie/wymazanie autorstwa,
rangi, odległość, odczyt, starą i powtórzoną rundę, pauzę i porzucenie.
Wspólne transakcje ćwiczą wszystkie stopnie oraz zachowanie danych czterech ras.
Nowe testy serwerowe obejmują TA10/TA11/TA12 I i odtworzenie zatwierdzonych wyników.
Kontrolery i transakcje sprawdzają także II/III; nie jest to odbiór II/III w przeglądarce.

Końcowa walidacja kodu `d9a30bbe` i scenariuszy `066e5fce` (niezmienność źródeł:
`qa/memory-trials/sources.json`):

| Kontrola | Wynik |
| --- | --- |
| Pełny TypeScript aplikacji / e2e / tools | PASS |
| Pełne `npm test` | **1463 PASS / 0 FAIL / 10 SKIP**, 128 plików PASS / 1 SKIP |
| Kontrolery nowej Pamięci, transakcje, serwer i poprawiony audyt | **54 PASS** |
| `npm run lint` | 0 błędów, 15 wcześniejszych ostrzeżeń |
| `npm run assets:check` | PASS |
| `npm run build` | PASS |
| Kontrola dokumentacji | PASS |
| Canvas: TA10 / TA11 / TA12 I | **3 PASS**, zwykłe UI, nagroda, zasoby właściciela i reload |
| Software WebGL: TA10 / TA11 / TA12 I | **3 PASS**, te same asercje i kontrola renderera |
| Emulacja telefonu Canvas | **2 PASS**: TA12 I w 852×393 oraz regresja dotykowego Androida z osłoną portretową 390×844 i obrotem do 852×393 |

Dziesięć pominiętych przypadków wymaga osobnego PostgreSQL QA. Nie pomijano nowych
prób. Logi, katalog i screenshoty: `qa/memory-trials/`; podsumowanie `checks.json`.
Pierwszy przebieg przeglądarkowy miał 3 PASS Canvas / 3 FAIL WebGL na gotowości menu.
Po dodaniu jawnego oczekiwania na gotowość kolejny przebieg WebGL ukończył próbę
i zapisał wynik, lecz przekroczył limit 180 s dopiero przy końcowym przeładowaniu.
Nowe trzy pełne scenariusze mają limit 300 s (dwa rzeczywiste ładowania kontynentu
oraz salę próby na CPU/SwiftShader); limit akcji 15 s, asercje i limity testów
jednostkowych pozostają zachowane. Końcowe WebGL 3/3 PASS, bez retry i pageerror.
Pierwotne logi niepowodzeń zachowano. To nie jest pomiar sprzętowego WebGL.

### Otwarte prace

Pozostaje **21 prób / 63 stopnie**, pięć wariantów, trzy moduły, pełne interakcje
dziedzin w kontynencie, późne warianty starć, tytuły, cały graf/budżet kampanii
i pomiary balansu. Skupienie Mędrców TA07–TA09 pozostaje niezaimplementowane.
Nie zmieniono tabel rozwoju 1–60 ani nie aktywowano ich przez samo dodanie prób.
Nie deklarujemy ukończenia całego rozwoju ras, publikacji, odbioru fizycznego
telefonu, sprzętowego WebGL ani produkcyjnej sesji WebSocket/PostgreSQL.
