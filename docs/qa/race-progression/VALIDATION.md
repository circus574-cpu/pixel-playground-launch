# Walidacja rozwoju ras — 22.10.2026

Gałąź `feat/race-progression-skill-trees-20261022`. Baza: `66a615dec1d4259e1bf668956ec1cb09e9aa177e`. Końcowy kod poddany kontroli: `bd4ba5477321c77b360aaf39c39c743bc671f436`. Późniejszy commit raportu i podglądów nie zmienia kodu gry.

## Kontrole końcowego kodu

| Kontrola                         | Wynik                       | Zakres i ograniczenia                                                                                                                              |
| -------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vitest                           | **174/174 PASS**, 27 plików | 148 dotychczasowych testów oraz 23 testy rozwoju i 3 interfejsu                                                                                    |
| TypeScript                       | **PASS**                    | Aplikacja, E2E oraz narzędzia, pełny `npm run typecheck`                                                                                           |
| ESLint                           | **PASS**, 0 błędów          | 9 istniejących ostrzeżeń w niezmienionych komponentach                                                                                             |
| Build aplikacji                  | **PASS**                    | `npm run build`; istniejące ostrzeżenia wielkości chunków i deprecacji                                                                             |
| Build izolowanego playtestu      | **PASS**                    | Osobny katalog; testy korzystają z zamrożonego buildu tego samego kodu                                                                             |
| Integralność zasobów             | **PASS**                    | `node --import tsx scripts/check-game-assets.ts`; CLI `tsx` wymaga niedostępnego IPC, loader uruchamia ten sam skrypt                              |
| Analiza danych                   | **PASS**                    | Odtworzono 116 węzłów, 80 wierszy wzrostu i 16 jawnie ograniczonych porównań podstawowego ataku                                                    |
| Nowe E2E Canvas i Software WebGL | **32/32 PASS**              | 16 Canvas i 16 Software WebGL, Chromium 153, 5 minut; ten sam końcowy kod                                                                          |
| Pełna regresja przeglądarkowa    | **NIEPEŁNA, Z BŁĘDAMI**     | Przerwano przebieg 121 przypadków po odtworzeniu blokujących błędów: 21 PASS, 9 FAIL, 1 w toku i 90 nierozpoczętych; build rozpoczęty na `c002bb7` |

Zapis wyników poszczególnych przypadków oraz porównań z bazą: [results.json](results.json).

Przegląd wizualny końcowego UI: Chromium 153, 1440×1000 oraz 390×844; trzy gałęzie na komputerze, przełączanie gałęzi na telefonie, czytelne szczegóły i cztery elastyczne miejsca na zdolności. Podglądy: [desktop.png](desktop.png), [mobile.png](mobile.png). Postać na tych podglądach pochodzi z jawnego fixture poziomu 20, nie z przejścia kampanii.

## Co rzeczywiście sprawdzają nowe testy

- Katalog, progi, zależności OR, wykluczenia, punkty, reset, 20-punktowy wariant z trzema zdolnościami ostatecznymi i formą.
- Wzrost i zaokrąglenia, zachowanie poziomów powyżej 20, proporcjonalny pancerz przy seriach trafień.
- Migracja v3→v4 z kopią identycznych bajtów, uszkodzone/przyszłe dane, błąd miejsca na zapis, ochrona rewizji oraz odtworzenie cooldownów każdej rasy.
- Pauza, przerwanie kanału, zasoby, zwroty Ki, przegrzanie, odtworzenie formy i wyłączenia Androida, kontrola i tarcze; wykonalna akcja każdej zdolności aktywnej i ostatecznej.
- Interfejs nauki/wyposażania/resetu, przeglądanie pozostałych ras bez modyfikacji postaci i czytelne blokady poziomu.
- E2E: po osiem przypadków rasa×desktop/mobile w każdym rendererze; nowa postać i podgląd bez przyznania poziomów; cztery rzeczywiste walki; geometria HUD 360×640, 390×844 i 852×393.

E2E UI używa jawnego zapisu v3 poziomu 20. Walki używają fixture poziomu 2 i rzeczywistego modelu ruchu, kosztów, trafień, śmierci przeciwnika i nagrody 20 XP. Cel i ruch przechodzą przez produkcyjny adapter `ki:command`, używany przez canvas. Nie wstrzykują obrażeń ani pokonanego wroga, ale nie stanowią testu precyzji kliknięcia poruszającej się grafiki. Asercja telemetrii rozróżnia rzeczywisty Canvas i WebGL. Software WebGL nie jest sprzętowym odbiorem telefonu.

## Wykryte problemy i porównanie z bazą

1. Pierwsze E2E próbowały otworzyć narzędzie przed gotowym HUD-em; poprawiono oczekiwanie, bez osłabienia reguł gry.
2. Konfiguracja Playwright nadpisywała niestandardową ścieżkę Chromium w projektach WebGL; wspólna ścieżka jest teraz przekazana do każdego projektu. Pobranie standardowego Chromium nie powiodło się w tym środowisku; użyto lokalnego Chromium 153. Bez zmiany zależności projektu.
3. Wcześniejszy przebieg nowych scenariuszy zakończył się 30 PASS / 2 FAIL: menu w orientacji poziomej telefonu nachodziło na pasek. Poprawiono odstępy CSS; końcowy przebieg sprawdza tę samą asercję w obu rendererach.
4. `aether-art-preview.spec.ts` oczekuje, że grafika Aetherii jest wyłącznie opt-in. Baza już domyślnie ładuje ten pakiet. Ten sam błąd odtworzono w osobnym, czystym worktree `66a615de`. Nie zmieniano grafiki ani asercji tego testu; to osobny zakres właściciela/Codexa.
5. `pre-gpu.spec.ts`, mobilne osiem kierunków: lokalny Chromium nie raportuje oczekiwanego `data-focused="false"` po zmianie karty. Identyczny błąd dla Planetarnych 390×844 odtworzono na czystej bazie `66a615de`. Pozostałe wystąpienia tego symptomu nie są automatycznie uznane za niezależnie odtworzone. Nie osłabiano istniejących asercji ani nie ogłaszano całej regresji zaliczoną.
6. `hero-lifecycle.spec.ts`, Mędrzec: obserwator nie zarejestrował oczekiwanej klatki animacji ataku w limicie 60 s. Osobny przebieg na czystej bazie zaliczył ten test (1/1 PASS); nie ma podstaw, by przypisać ten błąd bazie. Powtórzenie na końcowym kodzie również zaliczyło test (1/1 PASS, 30,3 s). Pojedynczy błąd z pełnego przebiegu pozostaje niestabilnością do dalszego zbadania, a nie dowodem naprawy całej regresji. Nie zmieniano assetów ani tego scenariusza.

Błędy bazy nie dowodzą braku innych regresji. Pełne CI oraz odbiór pozostają wymagane przed scaleniem/publikacją.

## Granice odbioru i stan gałęzi

- Nie zweryfikowano fizycznego Androida, sprzętowego WebGL, termiki/FPS w długiej sesji ani pełnej kampanii i balansu 1–20.
- Bestiariusz, nagrody i cztery pełne ścieżki 1–20 nie zostały wdrożone. Zachowano dotychczasowy wzór XP i przeciwników. Założenia prototypu: [RACE-PROGRESSION.md](../../RACE-PROGRESSION.md).
- Kod i dokumentacja są zapisane lokalnie na osobnej gałęzi. Brak merge, wdrożenia i zmian produkcji. Assety postaci oraz `src/game/assets/imported.json` nie zostały zmienione.
- Automatyczna kontrola zatwierdzania odrzuciła `git push`: uznała publikację kodu, dokumentacji i dwóch źródłowych PDF-ów do GitHub za wymagającą wyraźnej zgody na ten transfer. Odrzucenia nie obchodzono. Wysłanie do `circus574-cpu/pixel-playground-launch` pozostaje zablokowane do decyzji właściciela; samo wysłanie gałęzi nie jest zgodą na merge lub publikację gry.
