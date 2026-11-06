# Dziennik zmian — 6 listopada 2026

## Scalenie oprawy sześciu wysp Superiora do `main`

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
- Wyspy **nadal opt-in** przez `?ki-islands-art=1`. Scalenie kodu nie jest odbiorem wizualnym,
  więc `DEFAULT_ON_SWITCHES` bez zmian do decyzji właściciela.
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

## Przegląd świata i generator dekoracji

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
- Testy `src/test/world-dress.test.ts` (9): odrzucenie motywów z pakietu, którego nie ma,
  wypełnienie i limity, brak kolizji i footprintu, determinizm, wyłączanie przez
  `outside`/`onLand`/drogę, powietrze tylko przy realnych efektach, pierścień osady i omijanie
  budynków, brak motywów dla lądu, który ich nie ma.
- Nie zweryfikowano: e2e w kontenerze (programowy WebGL nie mieści się w budżetach czasu
  speców), wydajność na fizycznym telefonie, decyzja o włączeniu domyślnym. Kadry dowodowe i
  różnica pikseli są opisywane w `docs/GPU-I-ZASOBY.md`.
