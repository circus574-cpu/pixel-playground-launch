# PR #9 — niezależne domknięcie kontroli

Sprawdzony kod: `b6006e0196c644de7612c357a7c24250dbe8f191`.
Zdalny main podczas końcowej kontroli: `69ca8cd04fbcc8c599e2d908b832fc2c9bf4ce52`.
Od wcześniejszego `70e6e49` doszły wyłącznie trzy commity dokumentacyjne:
`dc4396e`, `ea57ee9`, `69ca8cd` — AGENTS, indeks i tekstowy indeks dokumentu
właściciela. Odczytano te pliki; kod i zasoby gry nie zmieniły się.
Nie scalano ani nie przenoszono tych commitów do PR #9.
PR pozostaje DRAFT/open, bez merge i publikacji.

## GitHub Actions

Historyczny przebieg [39606146963](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/39606146963)
dla `ff56cfc8666c1c61624bc0a83a5b65c1b76c107c` zakończył się SUCCESS.
Pełny log potwierdza **59/59 Playwright PASS w 15,5 min** i **110/110 Vitest PASS**.
Pełny krok przeglądarkowy trwał 13:15:15–13:30:45 UTC. Fragmenty logu:
[actions-39606146963-summary.txt](qa/planetary-resume-20261021/actions-39606146963-summary.txt).

Kolejny przebieg [39611380835](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/39611380835)
dla `b6006e0` rozpoczął się 13:49:31 UTC; Playwright 13:50:56 UTC.
Zakończony: **SUCCESS**, pełny Playwright **59/59 PASS w16,0min**, Vitest110/110PASS. Końcowy log Playwright:14:06:54UTC. TypeScript,walidacja zasobów,lint i build również zakończone sukcesem. Instalator Chromium zgłosił przejściowe błędyDNS jednego mirrora, lecz pobranie zakończyło się powodzeniem i pełne testy wykonano. Nie był to hang testów.
Dowód: [actions-39611380835-summary.txt](qa/planetary-resume-20261021/actions-39611380835-summary.txt).

Nie potwierdzono zawieszenia. Konfiguracja uruchamia testy sekwencyjnie (`workers:1`),
z limitem 180 s na test i 55 min na job. W zakończonym przebiegu najwolniejszy plik
`e2e/pre-gpu.spec.ts` trwał 5,2 min. Sam status IN_PROGRESS nie stanowi błędu.
Dla działającego joba API pobierania logu zwracało `404 BlobNotFound`; nie daje
to dostępu do aktualnego testu, PID-ów Chromium ani CPU/RAM hostowanego runnera.
Nie zmieniano timeoutów ani testów bez wykrytej przyczyny awarii.

## Podgląd i kompletność

Samodzielny interaktywny podgląd wygenerowano poleceniem
`python scripts/gpu/create_planetary_review.py DELIVERY/manifest.json REVIEW.html`.
W bieżącym środowisku: `/workspace/artifacts/ki-planetary-20261021/animation-review.html`.
HTML zawiera oba atlasy i działa offline bez zewnętrznych żądań.

Kontrola Chromium: **7 stanów × 8 kierunków, 416 odwołań do klatek, 0 brakujących**;
wybór stanu, pauza, tempo i tło działają; 0 błędów `pageerror`.
Dowód: [review-verification.json](qa/planetary-resume-20261021/review-verification.json).
Ponowna kontrola źródłowych PNG: 416 SHA zgodnych z `motion.manifest`,
416 RGBA 512×512, niepusta alfa, minimalny margines 23 px.
Nie zmieniano wyglądu ani domyślnego aktora. Odbiór sylwetki, płynności,
kontaktu stóp i stylizowanego death/respawn pozostaje decyzją właściciela.

## Otwarte kwestie

- Fizyczny Android: brak przebiegu na rzeczywistym urządzeniu; test CDP/touch
  i mobilny viewport nie sprawdzają sterownika GPU, utraty kontekstu, pamięci,
  termiki i długiej sesji na telefonie.
- Sprzętowy WebGL: domyślne CI używa Canvas (`--disable-webgl`). Włączenie
  `KI_QA_WEBGL` wybiera SwiftShader, który również nie zastępuje GPU urządzenia.
  Wymagany oddzielny przebieg sprzętowy i sprawdzenie odzyskania kontekstu.
- Licencje: baza anatomiczna MakeHuman ma zapisane CC0, revision i hashe siedmiu
  plików w `art/production/heroes/planetary/v1/rig-base-source.json` oraz lokalny
  `LICENSE.ASSETS.md`. Master zapisuje pierwotną ilustrację projektu, revision/hash
  Animagine XL 3.1 i workflow. To dowody pochodzenia; nie zamykają przeglądu
  warunków modelu, praw do pierwotnej ilustracji ani komercyjnego odbioru całego
  zestawu. Nie deklarujemy pełnej zgody licencyjnej.

Nie scalano PR, nie publikowano gry i nie wykonywano operacji na instancji GPU.
