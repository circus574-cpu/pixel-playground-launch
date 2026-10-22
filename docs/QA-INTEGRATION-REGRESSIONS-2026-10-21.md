# KI Legends — naprawy PR #12 / #14 i regresje

## Zakres i baza

Osobna gałąź `integration/ki-regressions-20261021`, utworzona z aktualnego `main` `b3872c73c9df06e2a793190a6120f0948b021cb0`. Odczytane zdalne HEAD: PR #12 `3f2cba1da53937dd3895a3d3940536ce097731ae`; PR #14 `8c0bdd0f45b1e4869de2bdb2fc7bd1c4876d8296`. Zachowano istniejące worktree i historię; zmiany obu PR przeniesiono chronologicznymi cherry-pickami. Nie wykonano merge, publikacji, resetu ani operacji cyklu życia GPU.

## Ustalone przyczyny

- PR #12, [pełny QA 39653947381](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/39653947381): 4 błędy, wszystkie `gpu-webgl-smoke.spec.ts`, Mędrcy i Planetarni przy 1280/390 px. Stack: asercja renderera oczekiwała `WebGL`, otrzymała `Canvas`, poll 60000 ms. Pełny przebieg startował Chromium z `--disable-webgl`. Jest to błąd konfiguracji testów, nie dowód niezdolności gry do WebGL. Nie usunięto asercji ani nie zwiększono timeoutów.
- PR #14, [QA 39659934970](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/39659934970): dwa błędy Prettier w `src/routes/index.tsx`; przebieg nie dotarł do Playwright.
- Dotychczasowy scenariusz kontynentów otwierał `/` przy serwerze wyłącznie izolowanego playtestu. Testy rzeczywistych tras aplikacji mają teraz oddzielny serwer lokalny i projekty Canvas/WebGL.
- Nowy test sprzątania globusa wykazał pozostawioną referencję `window.__pg` po odmontowaniu: oczekiwano `false`, otrzymano `true`. Cleanup usuwa tę referencję i listener `webglcontextlost`; nie zmienia modelu świata ani mechaniki.

Pełne logi obu historycznych nieudanych przebiegów odczytano. Pobranie starego archiwum artefaktów PR #12 przez środowisko wykonawcze zwróciło HTTP 403 z hosta wyników Actions; przyczynę ustalono z pełnych logów i nowych rzeczywistych testów. Nie przedstawia się tego archiwum jako pobranego.

- Pełny lokalny przebieg ujawnił historyczne zapisy zrzutów do śledzonych `docs/qa/`. Nowe zrzuty zachowano osobno, a 25 oryginalnych plików odtworzono bajt w bajt z Git. Cztery starsze pliki testów zapisują teraz wyłącznie do `testInfo.outputPath`/`outputDir`. Runner sprawdza brak zmian w śledzonych źródłach przed i po Playwright; nie usuwa asercji.

- Oddzielny WebGL na `c413acc` ujawnił błąd kolejności w nowym teście cyklu życia: 6/8 PASS, oba niepowodzenia oczekiwały ataku wysłanego podczas wyżej priorytetowej reakcji `hit`. Zachowano priorytety gry, wszystkie asercje i timeouty; test czeka teraz na zakończenie reakcji przed atakiem. Na błędzie zapisuje również całą zaobserwowaną historię klatek.

## Konfiguracja testów

`npm run test:e2e` uruchamia wszystkie projekty: gameplay (Canvas), software-webgl (oba GPU atlasy i cykl życia bohaterów), application-canvas (prawdziwe trasy i zamknięty `/test`) oraz application-webgl (globus, nawigacja i sprzątanie). `testMatch` przypisuje testy do właściwego renderera; nie usuwa testów z pełnego przebiegu. Oddzielny workflow uruchamia `--project=software-webgl`. Oba workflow checkoutują dokładny SHA głowy PR i zapisują `qa-tested-sha.txt` w artefaktach.

Nowe scenariusze obejmują: prawdziwe wejście z globusa i mapy 2D do wszystkich czterech regionów, parametry URL, prawidłowy spawn, odświeżenie, cofnięcie do mapy, brak automatycznego tworzenia slotów, filtr wszystkich ras, mobilną blokadę wyboru, powrót do nieograniczonego wyboru, wszystkie 7 klipów obu bohaterów podczas zwykłej walki/śmierci/odrodzenia, utratę kontekstu, kolejne sceny Aetherii/Nexus-9 i ich budżet zasobów. Zablokowany `/test` nie wykonuje żądań Storage; dodatkowe testy pilnują wymaganej sesji i origin.

## Kontrola grafiki i mechaniki

Zachowano oba niezmienne pakiety po 416 klatek. Mędrcy są domyślnym bohaterem Aetherii zgodnie z PR #12; Planetarni zachowują istniejący opt-in `?ki-hero-art=1`. Nie zmieniano bilansu, `GameSession`, colliderów, definicji regionów, spawnów, zapisów, migracji ani kodu prywatnego `/test`. Nowe dekoracje są grafiką sceny poniżej głębokości aktorów; nie tworzą colliderów i są niszczone razem ze sceną. Kontrole skończonej liczby cykli i budżetu nie stanowią matematycznego dowodu braku wszystkich możliwych wycieków.

## Powtarzalna walidacja końcowa

`scripts/run-integration-validation.sh` wykonuje czyste `npm ci`, typecheck, pełny Vitest, assets:check, lint, build, pełny Playwright i osobny software-webgl. Dla każdej komendy zapisuje SHA, dokładną komendę, czas, exit code, log i jego SHA-256. Zachowuje oddzielne wyniki obu przebiegów Playwright. Uruchomienie nie publikuje i nie zarządza GPU.

Końcowe dowody są przypisane do konkretnego SHA w `results.json` oraz artefaktach obu workflow. Aktualne odnośniki i rozstrzygnięcie są w opisie PR integracyjnego i raporcie wykonawcy. Sam ten dokument nie nadaje statusu PASS niewykonanym kontrolom.

## Ograniczenia odbioru

Fizyczny Android, sprzętowy WebGL, temperatura, rzeczywiste VRAM/FPS na urządzeniu i długa sesja pozostają niewykonane. SwiftShader, emulowany viewport i CDP touch nie są fizycznym Androidem. Prawa do ilustracji referencyjnych i ostateczna jakość ruchu pozostają do odbioru właściciela. Zielone kontrole programowe uprawniają do niezależnego audytu, nie do samodzielnego merge lub publikacji.
