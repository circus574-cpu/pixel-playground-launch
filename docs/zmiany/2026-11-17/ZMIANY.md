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

## 4. Tekstury Pyry — produkcja na A40

Na polecenie właściciela przerwano rozwijanie runtime i skupiono się na zasobach
na działającym A40 `1ol56m0rtgorym`. Gałąź `assets/pyra-terrain-a40-20261117`
pochodzi od `108a9ea9`; nie scalano jej ani nie publikowano gry.

- 60 wariantów materiałów SDXL: podłoże, drogi, skały/góry, ściany i obrzeża
  rozpadlin, doliny, niziny oraz skały lawowe.
- 12 drobnych gleb/ubitych dróg: SDXL img2img i dopracowanie ziarnistości,
  koloru oraz periodycznego mikroreliefu na GPU. Źródła AI zachowane.
- 12 masek przejść i przykłady mieszania, z dokładną sumą wag R+G=255.
- 1024 px PNG/WebP, wersje 512 px, normal/height/roughness i podglądy 3×3.
  Mapy pomocnicze są przybliżeniami artystycznymi; nie są pomiarem fizycznego PBR.

**Kontrola materiałów: 72/72**, zero błędów plików/hashy/wymiarów i wykrytych
czarnych generacji. Najwyższy stosunek różnicy na szwie do zwykłych różnic
wewnątrz tekstury wyniósł **1,354** przy limicie 2. Sprawdzono także mapy
normalnych (próbka co 16 px; największy błąd długości 0,00621 przy limicie 0,02),
szarości map height/roughness i wszystkie 12 masek. Odbiór artystyczny pozostaje
otwarty. Kamieniste wyniki pierwszych promptów popiołu zachowano jako kandydatów
kruszywa; nie oznaczono ich jako zaakceptowane drobne gleby.

[Rejestr weryfikacji](qa/pyra-terrain-gpu/results.json).
Dostawa: `deliveries/pyra-terrain-gpu-20261117`, 11 archiwów Git LFS,
**480 433 002 B**; serwer LFS potwierdził obecność wszystkich 11 obiektów.
Pełne rejestry promptów, seedów, wersji i plików są w dostawie. Skrypty są
w `scripts/gpu/*pyra*`. Zasoby mają status praw do sprawdzenia.

To **produkcja grafik**, bez zmian geometrii, miast, kolizji, save ani APK.
Podglądy mieszania materiałów nie przedstawiają uruchomionej gry.
Nie uruchamiano ponownie testów przeglądarki na samych plikach dostawy.
Przy poprzednim etapie budynków workflow Godota zakończył się sukcesem
na `108a9ea9`: [Actions 44181755158](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/44181755158).
Nie jest to test integracji nowych materiałów w runtime.
Obliczenia GPU tej partii zakończone; lifecycle poda pozostał bez zmian.

## 5. Podłączenie materiałów do prototypu i aktualizacja przez serwer

Gałąź `feat/pyra-terrain-prototype-20261117` pochodzi od `main` `c1930e5c`.
Dołączono przygotowane wcześniej budynki i źródła tekstur, zachowując nowsze
poprawki gry z `main`. Właściciel wskazał aktualizację **przez serwer**.
Numer APK, klient `101`, bootstrap oraz globalne skrypty rozgrywki nie są zmienione.

| Element | Zmiana | Dowód |
| --- | --- | --- |
| Teren | 14 albedo 512 px, cztery współdzielone tablice tekstur, przejścia i pola prezentacyjne z wysokości | [65/65 Godot](qa/pyra-terrain-integration/prototype/results.json) |
| Mapy | Ten sam World2D i ten sam shader materiałów w 3D | Kontrole projekcji i tożsamości tekstur |
| Dostęp serwisowy | Nowe materiały w izolowanym podglądzie administratora | [54/54](qa/pyra-terrain-integration/service/results.json) |
| Aktualizacja | Oryginalne APK 1.14 pobiera nową paczkę przez HTTP | [47/47](qa/pyra-terrain-integration/installed/results.json) |
| Zapisy | Zachowane kontrolne bajty postaci, wyposażenia i chmury | Test po pobraniu i zamontowaniu PCK |

Paczka `core-c101-21956aaa6ffc.pck`: **35 948 548 B**, SHA-256
`21956aaa6ffc8181485dcaf8473acc679d7049c61dfaf296dab8a2809ceee292`.
Ma 151 wpisów ograniczonych do `service_preview/pyra` i zależnych zasobów importera.
Manifest kandydata **1.14.1** zachowuje wszystkie 29 paczek wydania 1.13.1 i ich
zależności lądów; starszy `core-c100` pozostaje identyczny. Publikacja używa
istniejącego ręcznego workflow **Godot content packs to VPS**, bez wdrożenia
nowej strony, zmiany ochrony serwisowej ani nowego APK. Stan przy tym commicie:
**przygotowane i przetestowane, przed aktywacją**.

Zrzuty z [pobranego prototypu](qa/pyra-terrain-integration/installed/downloaded-preview.jpg),
[mapy 2D](qa/pyra-terrain-integration/installed/downloaded-map2d.jpg) i
[mapy 3D](qa/pyra-terrain-integration/installed/downloaded-map3d.jpg) pochodzą
z rzeczywistego Godota uruchomionego na zasobach oryginalnego APK i paczce HTTP.
Nie są to zdjęcia fizycznego telefonu. Pamięć tekstur próby: **58,46 MiB**
przy limicie 64 MiB; software OpenGL nie jest pomiarem FPS Androida.

Pełny TypeScript PASS; Vitest **2215 zaliczonych, 0 błędów, 21 pominiętych**;
lint **0 błędów, 17 ostrzeżeń**. Pierwszy przebieg miał braki historycznych
fixture'ów w sparse-checkout; odtworzono je z niezmienionych źródeł i wykonano
cały zestaw ponownie. Typecheck powtórzono po presji pamięci podczas importu.
Fizyczny telefon i ostateczny odbiór wizualny pozostają niezweryfikowane.
Nie scalać tej gałęzi do `main` automatycznie.
