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
