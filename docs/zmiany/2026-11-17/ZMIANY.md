# Zmiany — 17.11.2026

## 1. Prototyp Pyry 2D izometrycznej

Właściciel zatwierdził A40/300 GB i zmianę kierunku na izometrię 2D. Przygotowano
oddzielną próbę 1024×1024 m, cztery materiały albedo ComfyUI, drogi, zróżnicowany
relief i skupiska dekoracji. Gra, lokalne mapy 2D/3D oraz pomocniczy Terrain3D
korzystają ze wspólnych danych wysokości i masek. Bez zmiany produkcyjnej planety.

- Źródło próby: `ports/godot-isometric-pyra`; źródło materiałów:
  [dostawa](../../../deliveries/pyra-isometric-a40-20261117/manifest.json).
- [Wyniki 14/14](qa/terrain3d-a40/results.json), [kontrola procesu](qa/terrain3d-a40/isometric-process.json).
- [Rzeczywisty kadr Godota](qa/terrain3d-a40/city-wide.jpg),
  [mapa 2D](qa/terrain3d-a40/same-world-map.jpg),
  [lokalna mapa 3D](qa/terrain3d-a40/same-world-map-3d.jpg).
- Wypchnięty checkpoint prototypu: `trial/pyra-isometric-a40-20261117`, `4fb14814`.
  Integracja poniżej została przygotowana osobno od aktualnego `main`.

Nie wdrożono jeszcze izometrycznej walki, usług budynków, questów, całego Pyra
ani globusa planety z tej geometrii. Budynki i aktorzy są tymczasowymi grafikami
istniejącej gry. Mapy 3D używają billboardów tych samych dekoracji; nie są gotowymi
modelami architektonicznymi. Generowania płatnego Meshy nie uruchamiano.

## 2. TEST SERWER, podgląd administratora i APK 1.14

Baza: `origin/main@1dd9e1a386040cf9b585edc98be1a6104fbccc65`.
Gałąź: `feat/godot-service-preview-20261117`. Bez scalenia, publikacji serwera,
przełączenia produkcyjnego trybu ani zmiany konfiguracji GPU.

| Funkcja | Stan przed | Zmiana | Dowód |
| --- | --- | --- | --- |
| TEST SERWER w przeglądarce | Serwis ograniczał głównie manifest Androida | Dotychczasowy przełącznik opisany jako TEST SERWER; dostęp wyłącznie z rolą admin | [testy HTTP/WS i UI](qa/service-preview/unit.txt) |
| Strona gry | Zwykły ekran wejścia | Konserwacja dla gości/graczy/GM; logowanie i panel admina pozostają dostępne | [4 viewporty](qa/service-preview/browser/results.json) |
| Bezpośrednie API | Można było sięgać po paczki i zapisy mimo serwisu | Kontrola manifestów, GET/HEAD/Range, zapisów, postaci i socketów | `src/test/service-access.test.ts` |
| Aktywna sesja gracza | Brak wspólnej bramki | Ponowna kontrola i zamknięcie bez usuwania danych; zachowany dotychczasowy mechanizm zapisu | Test aktywnego połączenia Androida i testy sesji w pełnym Vitest |
| Prototyp Godota | Oddzielny projekt | Przycisk w ekranie serwisowym, prywatny World2D, powrót, ponowne wejście i odebranie uprawnień | [21 kontroli z zasobów APK](qa/service-preview/apk/process.json) |
| Ruch i mapy próby | Chód + mapy w samodzielnej próbie | Ten sam runtime pod bramką; joystick i wspólne mapy zachowane | [kadr z zasobów APK](qa/service-preview/apk/isometric-in-service.jpg) |
| Postacie | Obecny katalog aplikacji, sloty i rewizje | Brak migracji/resetu; podgląd nic nie zapisuje do danych graczy | Kontrole niezmienionych plików i 543 asercje głównej gry |
| Aktualizacja APK | versionCode 100, starszy bootstrap | 1.14 / 101; stary rdzeń c100 nie nadpisuje nowej bramki; ten sam certyfikat aplikacji | [weryfikacja aktualizacji](qa/service-preview/apk-upgrade.json) |

### Testy i rzeczywiste ograniczenia

- Pełny TypeScript: [log](qa/service-preview/typecheck.txt).
- Pełny Vitest: **2215 zaliczonych, 0 błędów, 21 pominiętych**.
  [Log](qa/service-preview/vitest.txt). Pominięte kontrole wymagają między innymi
  `KI_ACCOUNTS_TEST_DATABASE_URL`; nie deklaruje się nowego testu PostgreSQL na produkcji.
- Pełny lint: 0 błędów, 17 istniejących ostrzeżeń; [log](qa/service-preview/lint.txt).
- Build aplikacji: [log](qa/service-preview/build.txt).
- Główna gra Godot: [543/543 asercji](qa/service-preview/smoke-result.json).
  Headless zgłasza przy zamykaniu wycieki RID w [logu](qa/service-preview/smoke.txt);
  nie jest to deklaracja zerowej liczby błędów silnika całej gry.
- Podgląd w edytorowym runtime: [21/21](qa/service-preview/native/results.json).
  Podgląd z zasobów wyeksportowanego APK: **21/21, 0 błędów silnika**.
  Są to uruchomienia Godota na Linux/OpenGL Compatibility, nie na fizycznym telefonie.
- Bootstrap i rdzeń odczytane z nowego APK: [E2E INSTALLED PASS](qa/service-preview/installed.txt).
- Playwright: konserwacja, brak próby wejścia do postaci, dostęp do logowania,
  ponowne otwarcie serwera i brak poziomego przewijania przy 320×568, 360×640,
  390×844, 852×393. HTTP statusu jest lokalną atrapą; backend jest sprawdzany osobno.
  To aplikacja uruchomiona przez Vite dev, nie opublikowana domena. Kontrola raportuje
  wyjątki strony (`pageerror`); nie stanowi potwierdzenia braku wszystkich ostrzeżeń
  konsoli. Podczas dev pojawiało się ostrzeżenie hydratacji atrybutu `data-ki-world-v2`.
- Pełne zdalne CI, fizyczny Android/iPhone, instalacja aktualizacji i odbiór
  artystyczny pozostają oddzielnymi kontrolami. Nie użyto wygenerowanego obrazu
  jako dowodu działania runtime.

Pierwszy przebieg Vitest miał braki plików w sparse-checkout; po odtworzeniu
niezmienionych fixture'ów z Git wykonano ponownie cały zestaw, bez zmian asercji.
Próba `vite preview` nie uruchomiła SSR (brak `dist/server/server.js` dla tego presetu);
test przeglądarkowy wykonano na działającym Vite dev, build sprawdzono osobno.

### Dostarczenie i instalacja

[APK 1.14](../../../deliveries/godot-ki-legends-1.14/ki-legends-1.14.apk)
to aktualizacja pakietu `pl.kilegends.godot.pyra`, nie druga aplikacja.
Podpis SHA-256 certyfikatu to
`dd788170dde4237f84775deda5c4132d82ebd9067cfdb7e52dda5de275591761`,
sprawdzony względem opublikowanych APK 1.0 i 1.10. Klucz dostarczony przez właściciela
zapisano w prywatnym katalogu z uprawnieniami 0600, poza repozytorium; nie zamieszczono go
w logach, paczkach ani artefaktach Git. Eksporter blokuje niezgodny podpis.

**Nie odinstalowywać obecnej gry i nie czyścić danych.** APK zawiera nową bramkę,
ale przycisk administratora wymaga również wdrożenia serwera z `canPreview`.
Samo zainstalowanie kandydata przed wdrożeniem backendu nie uruchomi tej funkcji
na obecnym serwerze. Przełącznik w panelu pojawi się po osobno zatwierdzonym wdrożeniu.

Przy włączonym TEST SERWER administrator loguje się zwykłym kontem i wybiera
**PROTOTYP IZOMETRYCZNY · PYRA**. Podgląd nie jest przyznaniem uprawnień GM ani
drugim silnikiem rozgrywki. Blokada online nie może odebrać plików ani sterowania
starej aplikacji działającej na odłączonym od internetu urządzeniu.

GPU nie jest potrzebne do tego etapu. Źródła próby i materiałów zabezpieczono w Git LFS;
decyzja o zatrzymaniu poda pozostaje przy właścicielu.

## 3. Budynki i styl izometrycznej Pyry

Gałąź `art/pyra-isometric-coherence-20261117`, baza `d1d8ba4a` z PR #182.
Nowe sześć malowanych grafik podłączono do rzeczywistej sceny Godota:
kuźnia, gospoda, Sala Przysiąg, sklep, depozyt i plac treningowy.
Wspólny styl: czerwone dachówki, bazalt, ciemne drewno, złote detale.
Źródła PNG i pochodzenie zachowano w `deliveries/pyra-buildings-20261117`.

| Element | Przed | Zmiana | Dowód |
| --- | --- | --- | --- |
| Budynki | Dawne tymczasowe grafiki | 6 sprite'ów do 768 px, niezależne sylwetki usług | [Miasto w Godocie](qa/pyra-buildings/after/city-wide.jpg) |
| Osadzenie | Jedna kotwica 0,92 dla wszystkich | Kotwice prezentacji w `building-art.json`, miękki cień kontaktowy | [Gospoda](qa/pyra-buildings/after/building-inn.jpg), [kuźnia](qa/pyra-buildings/after/building-smithy.jpg) |
| Geometria | 6 pozycji i footprintów | Bez zmian; stare źródła pozostają, `--legacy-buildings` do porównania | Test importera + [stary widok](qa/pyra-buildings/before/city-wide.jpg) |
| Mapy | Wspólne dane terenu | Billboardy 3D respektują nowe kotwice | [2D](qa/pyra-buildings/after/same-world-map.jpg), [3D](qa/pyra-buildings/after/same-world-map-3d.jpg) |
| Serwis | Izolowany podgląd | Nowe zasoby są kopiowane przez istniejący preparator | [21/21](qa/pyra-buildings/service/results.json) |

**Weryfikacja lokalna:** pełny TypeScript PASS (pierwszy równoległy przebieg
zakończył się kodem 137 przy presji pamięci; powtórka PASS), lint 0 błędów /
17 ostrzeżeń, build PASS, Vitest **2215 zaliczonych, 0 błędów, 21 pominiętych**
przez istniejący zestaw. Test pakowania sprawdza sześć zasobów i niezmienione
pozycje/kolizje. [Rejestr kontroli i hashy kodu](qa/pyra-buildings/verification.json).
Zrzuty są klatkami uruchomionego Godota, nie obrazami generatora.

Godot OpenGL/Mesa: **32/32**, poprzednie grafiki **26/26**, serwis **21/21**.
Budżet tekstur po zmianie 54,12 MiB (limit 64 MiB), przed 49,50 MiB.
Kontrola przy limitach renderowania 30/120 obejmuje czas symulacji i dotyk;
software renderer osiągał około 14 FPS, więc nie jest to pomiar wydajności telefonu.
Dodano niezależny workflow `godot-isometric-art.yml`, który odtwarza kontrolę
w rzeczywistym silniku i zachowuje zrzuty na SHA uruchomienia.

**Otwarte:** odbiór artystyczny, perspektywa części malowanych elewacji
(przybliżona, nie geometrycznie skalibrowana), dopracowanie otoczenia i posadzek,
wnętrza/usługi prototypu oraz animowane światła i dym. Fizycznego Androida,
przeglądarkowego Canvas/WebGL i nowego APK w tym etapie nie testowano ani nie wydano.
Wyniki eksperymentów Blender/SDXL nie są podłączone. Stan licencji nowych grafik
pozostaje do sprawdzenia; rekord generacji nie zastępuje dowodu praw.

Nie scalono ani nie wdrożono. Dotychczasowa bramka PR #182 miała osobny błąd
czasowy testu odrodzenia w pełnym smoke OpenGL; ten etap grafik go nie naprawia
i nie stanowi potwierdzenia zielonego pełnego CI tamtej gałęzi.
