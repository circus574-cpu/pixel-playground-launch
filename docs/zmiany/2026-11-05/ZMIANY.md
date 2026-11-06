# Zmiany — 2026-11-05

## Prezentacja potworów

### 1. Wielkości potworów (świat v2)

- Powód (właściciel, 04.11.2026): wszystkie potwory wyglądały na podobnej wielkości. Pomiar grafik `enemy-v3-*` pokazał, że klasa S/M/L z bestiariusza
  nie jest odzwierciedlona w sprite'ach: ciało zajmuje 75–80% ramki niezależnie od klasy, a 24 z 40 potworów to ta sama klasa M.
- Rozwiązanie: rozmiar rysowanej ramki liczy się z pomiaru ciała (`scripts/measure_monster_bodies.py` → `src/game/monsters/bodyExtent.generated.ts`)
  jako `docelowy rozmiar klasy × mnożnik potwora / zmierzone ciało` (`src/game/monsters/visualSize.ts`). Docelowe ciało: S 50, M 82, L 116 px;
  ręczne mnożniki 0,75–1,2 na potwora dają różnice wewnątrz klasy (wszystkie 40 w pliku, do swobodnej edycji). Efekt: zakres 42–139 px
  zamiast 42–107, średnia L 93→120, M 62–94, boss (180 px ramki, ok. 145 px ciała) pozostaje największy.
- Tylko prezentacja: zasięg, trafienia i kolizje bez zmian. Domyślnie włączone; `?ki-monster-sizes=0` przywraca dawne klasy S/M/L.
- Test: `src/test/monster-sizes.test.ts`. Arkusze porównawcze wszystkich 40 potworów (stare vs nowe, liczone z danych) i zrzuty z gry
  przy spawnach: `docs/zmiany/2026-11-05/qa/monster-sizes/`.
- Mnożniki i docelowe rozmiary to propozycja projektowa do akceptacji właściciela; nie pochodzą z bestiariusza.

### 2. Nowa oprawa kontynentów Verdantia, Pyra i Aetheria (domyślnie włączona)

- Z gałęzi Codexa (PR #110, #114, #115, #116; łańcuch gałęzi, każda zawiera poprzednią) wchodzą: Verdantia (26 dodatkowych zasobów + podłoża), Pyra
  (52 zasoby: 14 materiałów, 33 obiekty, 5 efektów) i Aetheria (36 zasobów: 14 materiałów, 22 obiekty) oraz komplet 64 grafik środowiska Nexus-9
  (`art/production/nexus-continent-v2/`). Nexus-9 to na razie same grafiki: Codex nie wpiął ich w grę (brakuje przypisań, masek, skali), więc w grze Nexus
  wygląda jak dotąd.
- Decyzja właściciela 05.11.2026 ("scal i publikuj"): flagi `ki-verdant-continent`, `ki-pyra-continent`, `ki-aetheria-continent` są domyślnie włączone,
  `=0` przywraca dawny wygląd danego kontynentu (`DEFAULT_ON_SWITCHES` w `src/game/assets/catalog.ts`). Geometria, nawigacja, kolizje, spawny i zapisy
  bez zmian (dekoracje bez fizyki).
- Integracja z czyszczeniem drzew przy spawnach: transformacje kontynentów działają pierwsze, filtr aren na ich wyniku. Filtr rozpoznaje teraz też nowe drzewa i
  krzewy (klon, miłorząb, cyprys, jeżyna, borówka), które wcześniej by przeciekały.
- Testy kontynentów Codexa zmieniono z „opt-in” na „domyślnie włączone, `=0` wyłącza”; pozostałe asercje (zachowanie wcześniejszych wiązań, budżet
  strumieniowania, brak mutacji, metadane fizyczne) bez zmian.
- Dowody: zrzuty z gry bez flag vs `=0` w `docs/zmiany/2026-11-05/qa/continents/`; raporty Codexa w `docs/zmiany/2026-11-04/qa/{verdantia-complete,pyra-continent,aetheria-continent,nexus-materials}/`.
- Nie zweryfikowano: fizycznego telefonu i sprzętowego WebGL (jak w raportach Codexa), Nexus-9 w grze (brak integracji).

## Mapa planety (/mapa)

### 3. Globus: pinch na telefonie i głębszy zoom; mapa 2D: czytelniejsze nazwy i brak kwadratów terenu

- Zgłoszenie właściciela (05.11.2026): mapa 2D „nie jest funkcjonalna”, globus nie przybliża się i nie łapie ostrości.
- Odtworzone w przeglądarce (emulacja iPhone 13, dotyk przez CDP): na globusie dwa palce, z których jeden ląduje na etykiecie kontynentu (przyciski
  `.pg-marker`, `touch-action: auto`), nie docierały do sterowania. Przeglądarka brała gest, powiększenie zostawało na 100%. Naprawa: na ekranach
  dotykowych (`@media (pointer: coarse)`) etykiety nie przechwytują palca; stuknięcie nadal wybiera region przez raycast na canvasie, a przyciski
  zostają dostępne z klawiatury. Po zmianie ten sam gest daje 334–351%.
- Limit zbliżenia globusa: najmniejszy dystans kamery 1,4 → 1,15 promienia planety (maks. zbliżenie ok. 260% → ok. 350%).
- Mapa 2D, nazwy miejsc: szerokość nazwy liczona dla szerokiej czcionki Cinzel (0,74 em na znak zamiast 0,56), więc długie nazwy nie nachodzą na siebie;
  nazwa miejsca mniej ważnego nie zasłania ikony ważniejszego (obóz nie zasłania miasta).
- Mapa 2D, kwadrat na oceanie (zgłoszenie właściciela ze zrzutem): przy zbliżeniu ≥300% malowana mapa każdej krainy (`map-hi.webp`) rysowała się
  jako pełny prostokąt razem z własnym marginesem oceanu, więc nad oceanem atlasu widać było kwadrat o innym kolorze (np. wyspa V) oraz pasek
  „kamienistego” oceanu przy Pyrze. Teraz każda kraina jest przycinana do swojego wytyczonego obrysu (`REGIONS[].outline`), ocean zostaje z atlasu.
  Zweryfikowane zrzutem z tego samego miejsca przed i po.
- Testy: `src/test/map-terrain-canvas.test.tsx` (przycięcie), `src/test/planet-globe.test.ts` (reguła dotykowa, limit kamery), `src/test/map-labels.test.ts` (dwa nowe).
- Nie rozwiązane: ostrość globusu przy dużym zbliżeniu. Źródłem jest malowany atlas 3840×1920 (tekstura globusu na telefonach: 1920 px, decyzja
  o pamięci GPU z testem `globeQuality`), a mapa 2D ma przy dużym zbliżeniu dodatkową warstwę terenu świata, której globus nie ma. Realne
  rozwiązanie to dodanie takiej warstwy do globusa albo przejście z globusa do mapy 2D przy dużym zbliżeniu: wymaga decyzji właściciela.
- Nie zweryfikowano: fizycznego telefonu i sprzętowego WebGL (emulacja z programowym renderowaniem).

## Materiały animacji ras

### 4. Chód po transformacji w grze (4 rasy, Tryb KI)

- Właściciel (05.11.2026) przekazał 4 filmy chodu postaci po transformacji; poprawił mnie, że poprzednie filmy też cięliśmy na klipy w grze, więc te też mają trafić do gry.
  Filmy zapisane bez obróbki w `art-wip/gemini-walk-videos/<rasa>-walk-transformed.mp4` (H.264 1280×720, 24 kl./s, 10 s, białe lub jasnoszare tło).
- Nowy klip `kiwalk` (8 kierunków × 8 klatek, 256 px, 16 kl./s, pętla) w paczkach `hero-{android,legend,sage-painted,planetary-painted}-walk-v3`, wersja 2.0.0 → 2.1.0
  (stare katalogi 2.0.0 usunięte). Gra wybiera go zamiast `walk` tylko przy ruchu i aktywnym bonusie `T` (Tryb KI, 20 s): nowy stan `kiwalk` w `STATES`,
  `ActorAnimation.update(..., kiForm)`, `mountGame` podaje `session.kit.buffs.some((b) => b.id === "T")`. Bez klipu w paczce zostaje `walk`.
- Wycinanie (powtarzalne: `scripts/anim/kiwalk_build.py`, `kiwalk_pack.py`): w filmach postać obraca się w miejscu przez wszystkie widoki. Dla każdego kierunku wybrano moment najlepszego widoku
  (z podglądu, nie automatem: dopasowanie sylwetek nie odróżnia przodu od tyłu), jeden cykl kroku (okres wykryty z profilu: 16–30 klatek), 8 klatek, tło wycięte `rembg` (isnet-anime),
  skala do wysokości istniejącego chodu rasy, stopy na tej samej linii. Lewa strona to lustro prawej tam, gdzie film pokazuje tylko jedną.
- Legenda i Planetar obracają się w filmie zbyt szybko na stabilne ukosy (w pętli widać było obrót), więc ich ukosy to profil; Android i Mędrzec mają własne ukosy.
- Budżet tekstur: pełny atlas 2048×2048 (16 MiB) przekraczał limit 128 MiB w Verdantii (Planetar). Klatki są więc przycięte do postaci i ciasno upakowane (klatki `trimmed` w atlasie Phaser,
  akceptowane przez importer): Android 9,5, Mędrzec 7,7, Legenda 6,0, Planetar 3,8 MiB rozkodowane. Największy świat (Verdantia) ma teraz 123,7 MiB z 128.
- Test w prawdziwej grze (build playtest, Chromium z programowym WebGL): atlasy ładują się, klip `kiwalk` gra w 4 kierunkach dla wszystkich ras, brak błędów w konsoli, skala postaci zgodna z bazową.
  Flagę formy KI wymuszono w teście (przez `?ki-debug=1`), bo Tryb KI wymaga wszystkich trzech ostatecznych technik, a gra przycina więcej niż budżet punktów.
- Testy: `src/test/actor-animation.test.ts` (wybór `kiwalk`, zapas bez klipu), `src/test/gpu-pipeline.test.ts` (osiem klipów, 480 odwołań, atlas `kiwalk`).
- Nie zrobione: forma po transformacji dla stania, ataku, umiejętności, trafienia i śmierci (brak filmów; po transformacji stoi i walczy w formie bazowej, co przy zatrzymaniu daje widoczną zmianę formy).
  Nie sprawdzono na fizycznym telefonie.

### 5. Prompty animacji (etapy 1-3) i filmy Legendy

- Właściciel (05.11.2026): w grze są już chód, oddech, jeden cios, transformacja i chód po transformacji, więc nowe filmy dotyczą wyłącznie braków
  (combo, umiejętności, unik, garda, trafienia, śmierć, wstawanie, bieg, ładowanie, zwycięstwo, interakcja). Limitów generowania nie ma; film trwa 10 s,
  a w nim jak najwięcej animacji, opisanych co do sekundy.
- Prompty, tabela ras i zasady wyciągnięte z testów: `art/pipeline/prompts/animacje/PROMPTY-ANIMACJE-v1.md` (etapy 1-4).
- Filmy Legendy (forma bazowa), bez obróbki: `art-wip/gemini-anim-stages/legend-etap{1-walka,2-reakcje,3-ruch}.mp4`. Wszystkie trzy trzymają oś czasu z promptu,
  tło jest czyste (bez cienia od etapu 2).
- Nie wycięte do gry; wycięcie klatek to osobny krok.

## Wnętrza budynków

### 6. Malowane wnętrza budynków specjalnych (24 pokoje, większe)

- Zlecenie właściciela (05.11.2026): zrobić wnętrza budynków specjalnych z materiału z 04.11, pokoje mają być większe niż były.
- 24 obrazy z `art/production/interiors/` (4 miasta × sala, sklep, arena, depozyt, kuźnia, gospoda) są teraz tłem pokoi w grze. Wcześniej leżały nieużyte, a gra rysowała programowe podłogi i meble.
- Rozmiar: 960 × 760 → 1920 × 1280 (3,4 × większa powierzchnia); kuźnia Pyry 540 × 1100 → też 1920 × 1280. Dawna, ręcznie składana kuźnia Pyry (`renderSmithy.ts`, `SMITHY_ROOM`) usunięta.
- Kuźnia Pyry miała jedyny obraz pionowy (1024 × 1536). Na życzenie właściciela („Pyra ma być taka sama, też poziom”) wygenerowano poziomą wersję 1536 × 1024 (gpt-image-1-mini, jakość medium, ten sam prompt bez akapitu o pionowym kadrze; `pyra-smithy-interior.prompt.txt`, `WNETRZA-v2-Pyra.md`),
  a pionowy obraz zachowano jako `pyra-smithy-interior-portrait-v1.png`. Nowy obraz nie przeszedł jeszcze odbioru właściciela.
- Kolizje: `src/game/city/paintedRooms.ts`, obrysy mebli odczytane z siatki nałożonej na każdy obraz (0..1000 jednostek obrazu), sprawdzone nakładką czerwonych prostokątów na wszystkich 24 obrazach.
  Punkty NPC, skrzyni depozytu (osobny dla każdego miasta) i manekina areny wyznaczone osobno dla pokoju; sesja przenosi manekina treningowego na punkt pokoju (był na stałe w (600, 300)).
- Obraz ładuje się przy wejściu i jest zwalniany przy wyjściu (nie liczy się do budżetu tekstur świata); 4,1 MiB webp, `scripts/build_painted_rooms.py`. Kamera: cała szerokość pokoju na szerokim ekranie (zoom ≥ 0,5), podąża za bohaterem.
  Bohater w kuźni Pyry nie jest już powiększany 1,45 ×.
- Weryfikacja w prawdziwej grze (build playtest, programowy WebGL): wejście do wszystkich 24 budynków przez drzwi, zrzuty na 1280 × 720 oraz 6 pokoi Verdantii na 390 × 844, brak błędów w konsoli.
  Testy: `src/test/smithy-room.test.ts` (26 testów: rozmiar, osiągalność NPC/skrzyni/manekina/wyjścia, plik obrazu), poprawione `city`, `heritage-runtime`.
- Nie zweryfikowano: e2e `e2e/city.spec.ts` i `e2e/manga-hud.spec.ts` (wejście przez „Plan miasta”) są nieaktualne od zwinięcia panelu „Akcje” w trybie świata v2 i nie przechodzą także bez tej zmiany; fizycznego telefonu.
- Do poprawy po odbiorze: punkty obrysu to odczyt z obrazu, więc pojedyncze meble mogą blokować lub przepuszczać o kilkadziesiąt jednostek za dużo; obrazy mają ok. 4 MiB w sumie, ale wielkość 1536 px rozciągnięta 1,25 × jest lekko miękka.

## Dokumentacja

### 7. Aktualizacja dokumentacji do stanu faktycznego (05.11.2026)

- `INDEX.md`: nowy nagłówek stanu, lista dzienników 02–05.11, usunięte opisy „osobnej gałęzi” kontynentów.
- `SWIAT-I-MIASTA.md`, `GPU-I-ZASOBY.md`, `AGENTS.md`: Verdantia, Pyra i Aetheria są scalone (PR #118) i domyślnie włączone (`=0` wyłącza); opt-in `PREVIEW_SWITCHES` dotyczy tylko nowych, jeszcze nieodebranych pakietów.
- `PLAN-I-ZADANIA.md`: checkpoint 05.11 z faktycznie otwartymi pracami (odbiory, animacje po transformacji, Nexus-9, ostrość globusu, nieaktualne e2e, stare gałęzie). `RASY-I-POSTACIE.md`, `README.md`: data i odnośniki.
- Nie zmieniano treści historycznych (checkpointy 23–29.10, 01.11 zostają jako zapis). Kontrola: `scripts/docs/check_documentation.py`.

- Dodano źródło właściciela: tabele rozwoju ras do poziomu 60 (`docs/design/source-annexes/KI_Legends_Tabele_Rozwoju_Ras_1-60.xlsx`), opis w [Rozwój i walka](../../ROZWOJ-I-WALKA.md#tabele-rozwoju-ras-160--przelicznik-właściciela-05112026). Bez zmian w kodzie.

## Kontynent Nexus-9

### 8. Integracja pakietu `nexus-continent-v2` z dziczą (05.11.2026, gałąź `feat/nexus-continent-art`)

- Zlecenie właściciela: podłączyć materiały kontynentu Nexus-9 tak, żeby było pięknie.
- Pakiet zaimportowany do rejestru (`npm run assets:import -- … --install`): 64 zasoby,
  11 319 728 B rejestru, 33,87 MiB dekodowanych pikseli, budżet dekodowany świata
  101,6 MiB z limitu 128 MiB. Wiązania `terrain.nexus-continent.*` i
  `object.nexus-continent.*` nie nadpisują istniejących kluczy ani miasta.
- Runtime: `src/game/world/generated/nexusContinent.ts` (biomy 1:1 z `biomeNames`,
  sceneria na realne identyfikatory autorowane, roślinność przydrożna, efekty
  ambientowe, rozrzut dekoracyjny) + czwarta gałąź w `renderSuperior.ts`
  (podłoża biomów, woda, brzegi, sześć nawierzchni dróg, kryształowa skorupa,
  wilgotny mech, blady kamień, naładowana ciecz, poświata płycizn, sucha skarpa,
  cienie kontaktowe, animacja efektów) + remap i doładowywanie tekstur
  w `superiorRuntime.ts`. Manifest dostał siedem aliasów nazw (`sand`, `water`,
  `road1…road5`), bo blok generyczny renderera żąda właśnie takich identyfikatorów.
- Włączanie: `?ki-nexus-continent=1`. **Nie włączono domyślnie** — pakiet czeka na
  odbiór właściciela; `DEFAULT_ON_SWITCHES` pozostaje nietknięty.
- Ustalenie o pustce: dane autorowane niosą poza miastem **8–16 obiektów na kadr
  wobec 104 w stolicy**. Sama zamiana pakietu nie usuwa pustki, więc dodano rozrzut
  obiektów nieistotnych fizycznie (bez `footprint`, `solid: false`) z limitem 40
  na chunk. Kolizje, nawigacja, spawny i zapisy bez zmian.
- Pomiar w buildzie playtest (programowy WebGL, pięć miejsc dobranych kryterium
  rozstrzału od stolicy): dekoracje 8 → 20, 13 → 23, 12 → 23, 16 → 33; stolica
  104 → 111; **zero błędów konsoli w każdym kadrze**. W pustkowia rdzeni kadr
  pokazuje rodzimego potwora w walce (Strażnik Rdzenia 14, 877/877), czyli spawny
  działają w dziczy.
- Testy: `src/test/nexus-continent.test.ts` (8, wszystkie przechodzą),
  `e2e/nexus-continent.spec.ts` zarejestrowany w projekcie `software-webgl`.
- Bramka na tej gałęzi: pełny TypeScript (3 konfiguracje) PASS, `npm run test`
  1201 przechodzi / 10 pominiętych, lint 0 błędów i 15 istniejących ostrzeżeń,
  kontrola dokumentacji PASS, `npm run build` PASS.
- **Nie zweryfikowano:** `e2e/nexus-continent.spec.ts` nie przechodzi w kontenerze
  agenta — pada na budżecie marszu 90 s przy ~10,6 jednostki/s na programowym WebGL;
  kontrolnie uruchomiony bez zmian `aetheria-continent.spec.ts` pada identycznie, więc
  pomiar dotyczy środowiska, nie kodu. Wymaga potwierdzenia w CI i na fizycznym telefonie.
- Otwarte: odbiór wyglądu przez właściciela i decyzja o przeniesieniu do
  `DEFAULT_ON_SWITCHES`; gęstość dziczy nadal zależy od danych autorowanych,
  rozrzut jest limitem 40 obiektów na chunk, nie rozwiązaniem docelowym.

## Poprawki po zgłoszeniach

### 8. Awaria po kliknięciu w mapę: ekran „This page didn't load” (05.11.2026, wieczór)

- Zgłoszenie właściciela (zrzut z telefonu): po kliknięciu w mapę w grze pojawia się główny ekran błędu aplikacji.
- Nie odtworzono w przeglądarce: minimapa → mapa 2D → globus 3D → kliknięcia przycisków i regionów (cztery rasy, telefon i komputer, serwer deweloperski), a także `/mapa` na produkcji. Brak błędów strony; brakujących fragmentów kodu na produkcji też nie ma.
- Najbardziej prawdopodobna przyczyna (hipoteza, nie potwierdzona zapisem błędu z telefonu): karta gry otwarta przed wdrożeniami z 05.11. Mapa ładuje się leniwie z fragmentu o haszowanej nazwie, a po wdrożeniu stare fragmenty znikają. Ładowanie kończy się błędem, a przycisk „Try again” nie odświeżał strony.
- Poprawka: błąd ładowania fragmentu po wdrożeniu odświeża stronę raz na minutę (`src/lib/staleChunk.ts`, także zdarzenie `vite:preloadError`); „Try again” w takim przypadku przeładowuje stronę; mapa planety w grze jest w osłonie `PanelBoundary`, więc jej awaria pokazuje komunikat z przyciskami „Odśwież” i „Wróć do gry” zamiast zrywać całą grę. Test: `src/test/stale-chunk.test.tsx`.
- Jeśli awaria wróci po odświeżeniu strony, to jest inna przyczyna: potrzebny komunikat błędu z konsoli lub rasa, miejsce postaci i kroki.

### 9. Mapa w grze: przycisk Teleportuj, zasłonięte sterowanie i opis regionu (06.11.2026)

- Zgłoszenie właściciela: przy otwarciu mapy przycisk „Teleportuj” zasłania „Przybliż region”; na mapie 2D nie da się przesuwać mapy ani przybliżać innych kontynentów.
- Przyczyny (odtworzone w grze, telefon 852×393 i komputer): (1) mapa otwierała się z automatycznie rozwiniętym opisem regionu gracza, który zajmuje dół ekranu; przycisk Teleportuj (konta GM) leży w tym samym rogu i przykrywał „Przybliż region”; (2) na ekranach do 900 px przy otwartym opisie ukrywał się cały panel sterowania (przybliż, oddal, cała planeta), więc nie dało się oddalić z powiększenia na pozycji gracza do innych kontynentów.
- Poprawka: mapa otwarta w grze (na pozycji gracza) nie rozwija opisu; przy otwartym opisie panel sterowania przesuwa się nad arkusz zamiast znikać, a Teleportuj przesuwa się pod nagłówek (po lewej). Zmiana tylko w układzie mapy (`PlanetMap.tsx`, `planet-map.css`).
- Zweryfikowano w przeglądarce: po wybraniu Aetherii z widoku całej planety przycisk Teleportuj (wstawiony do DOM jako atrapa) nie nachodzi na „Przybliż region”, „Przybliż region” zmienia widok, sterowanie jest widoczne. Przesuwanie myszą i dotykiem działało też przed zmianą w moim środowisku; nie odtworzono braku przesuwania, więc to zgłoszenie uznano za skutek ukrytego sterowania i otwartego arkusza, bez potwierdzenia na telefonie właściciela. Prawdziwy przycisk Teleportuj (konto GM) nie był uruchamiany.

### 10. Kolejne filmy animacji w repo (06.11.2026)

- Zapisano bez obróbki w `art-wip/gemini-anim-stages/`: `sage-etap1-walka.mp4` (Mędrzec, Etap 1 w formie bazowej, 1280×720, 10 s, SHA-256 `8277c0226a15f410…`) i `legend-etap4-walka-po-transformacji.mp4` (Legenda, Etap 4, forma po transformacji, SHA-256 `6bcf9e5706febee5…`). Oceniono po 10 klatkach (co 1 s): oba pokrywają oś czasu Etapu 1 (ciosy, finisher, umiejętności A i B, unik, gard).
- Opis i tabela plików: `art/pipeline/prompts/animacje/PROMPTY-ANIMACJE-v1.md`. Filmy nie są jeszcze wycięte na klatki ani wpięte w grę; po transformacji bohater nadal atakuje i ginie w formie bazowej.
