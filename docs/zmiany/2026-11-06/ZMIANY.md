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
