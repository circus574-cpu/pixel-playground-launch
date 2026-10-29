# KI Legends — selekcja efektów VFX z udostępnionej rozmowy Gemini (29.10.2026)

**Status:** PRZEGLĄD KONCEPCYJNY / NIEZAIMPORTOWANE DO GRY. Nie oznaczać jako ukończone assety produkcyjne.

## Źródła i zakres

- [Publiczna rozmowa Gemini](https://gemini.google.com/share/d85b9b5c7019) / [link właściciela](https://share.gemini.google/hpji4pJaShkw), tytuł *KI Combat VFX Sprite Sheet*, opublikowana 29.10.2026.
- Przejrzano 6 widocznych plansz generacji, każda 2×3, razem **36 pól**, oraz 3 obrazy przekazane bezpośrednio w rozmowie ChatGPT.
- Rzeczywiste nazwy/ID weryfikowano względem `src/game/kit/nodes.generated.ts` oraz implementacji `src/game/kit/{planetary,sage,android,legend}.ts`; nie dopisywano zdolności ani nie zmieniano ich balansu.
- **20 pól = KANDYDAT**, **4 = REZERWA**, **12 = DUPLIKAT**. To klasyfikacja materiałów do dalszej obróbki, nie 20 wdrożonych animacji. Akceptacja jest warunkowa: przy niektórych efektach trzeba poprawić czytelność.
- Ujęte zdolności: Planetarni R/A1/A4/B1/B9/C1/C4/C9 (8 ID); Mędrcy R/A1/A4/A9/B1/C4 (6 ID). Androidzi i Legendy nie mają obrazów w tym udostępnieniu.
- [Maszynowa lista 36 pozycji](qa/gemini-vfx-selekcja.csv) podaje identyfikator planszy/pola, decyzję i powód.

### Ograniczenie w dostępie do oryginałów

Współdzielona strona renderuje 6 obrazów, ale nie publikuje trwałych URL ich plików. Widoczne `blob:` to **nietrwałe identyfikatory wewnątrz sesji przeglądarki**, nie bezpośrednie linki pobierania. Nie uzyskano oryginalnych binariów G01–G06 ze strony. Nie wolno deklarować, że są w GitHubie ani na produkcji.

Właściciel przesłał dodatkowo 3 pliki **JPEG RGB bez kanału alpha** (obejrzane w bieżącej rozmowie):

| Przekazany obraz | Wymiary | SHA-256 | Uwaga |
| --- | --- | --- | --- |
| `11434.jpg` | 1536×1030 | `4ae5f625da9954205be1deffb787b0ec22a71d5eaf26a734a9ebda8e95a4190e` | starsza plansza; szachownica jest wypalona w pikselach |
| `1793284434384.jpg` | 1536×1031 | `b1734009cae0a3ef8c0a25b52279291ac412048156bae8eb0de9c8b5004ccb20` | podobny wcześniejszy wariant |
| `11436.jpg` | 1536×1030 | `2ee1b6ccf3f8d95798df948e6dbf6bccfed93640da5dc3cc1e9b86703215a83f` | wariant G04 z jednolitym szarym tłem |

Z `11436.jpg` wykonano sześć lokalnych, oddzielnych kafli PNG RGBA z **szacowaną** maską usunięcia szarego tła; paczka QA `ki-legends-gemini-vfx-kandydaci.zip` (SHA-256 `0c654c2515b6881c9bf5bac3e731a27fbade695781c7f7e273863fa2d1f9692f`). Zawiera `manifest.json`. Paczka jest artefaktem rozmowy, **nie znajduje się w repozytorium**. Maska RGB→alpha nie odtwarza oryginalnej fizycznej przezroczystości; trzeba sprawdzić halo/obrzeża ręcznie.

## Selekcja wizualna

Legenda: **KANDYDAT** = zachować koncepcję/grafikę do obróbki; **REZERWA** = opcja dodatkowa po porównaniu jakości; **DUPLIKAT** = nie mnożyć identycznych zasobów.

| Plansza | Rasa | Kandydaci | Rezerwa | Duplikaty | Decyzja |
| --- | --- | ---: | ---: | ---: | --- |
| **G01** | Planetarni — pierwotny melee/unik/wir | 3 | 3 | 0 | Mocniejszy trzeci hit, shimmer uniku, końcowe uderzenie wiru |
| **G02** | Planetarni — ziemia, leczenie i osłona | 5 | 1 | 0 | B9 dwie fazy, C1 dwie fazy, C4 pojawienie liści |
| **G03** | Planetarni — wariant G02 | 0 | 0 | 6 | Odrzucić powtórzenia |
| **G04** | Planetarni — sześć różnych sylwetek | 6 | 0 | 0 | Najlepsza plansza Planetarnych; A1 wymaga przebudowy |
| **G05** | Mędrcy — sześć różnych typów | 6 | 0 | 0 | Najlepsza plansza Mędrców |
| **G06** | Mędrcy — wariant G05 | 0 | 0 | 6 | Odrzucić powtórzenia |
| **Łącznie** | | **20** | **4** | **12** | **0 wdrożonych w runtime** |

### Zatwierdzone do dalszego przygotowania (nie do automatycznej publikacji)

**G04 / Planetarni:**
1. `P01 → planetary/R` — Cios Szlaku, niewielki punktowy impakt wręcz; bez pocisku.
2. `P02 → planetary/A1` — Szybki Unik, smuga ruchu; **wymaga poprawy**, ponieważ przypomina wystrzelony pocisk zamiast śladu postaci.
3. `P03 → planetary/A4` — Wir Energii, płaski wir cięć wokół bohatera.
4. `P04 → planetary/B1` — Impuls Ziemi, pęknięcia podłoża jako dekoracja, bez zmiany kolizji.
5. `P05 → planetary/C4` — Tarcza Liści, kopuła ochronna (5 s według katalogu).
6. `P06 → planetary/C9` — Pieśń Korzeni, kwitnące pędy jako **część** efektu; pełna umiejętność leczy i daje tarczę, więc wymaga dodatkowej wizualizacji.

**G05 / Mędrcy:**
1. `P01 → sage/R` — Pocisk Ki, mała kula poruszająca się ku celowi.
2. `P02 → sage/A1` — Pieczęć Energii, nieruchomy znak na celu; wybuch dopiero po 3 s.
3. `P03 → sage/A4` — Strumień Ki, ciągły promień kanałowany przez 3 s.
4. `P04 → sage/A9` — Sąd Światła, pionowy słup światła po ostrzeżeniu 1,5 s.
5. `P05 → sage/B1` — Świetlista Bariera, półprzezroczysta kopuła ochronna.
6. `P06 → sage/C4` — Medytacja Bojowa, lotos/światło podczas kanałowanego leczenia.

**Dodatki G01/G02:** Trzeci cios combo R, shimmer A1, zakończenie A4, dwie fazy B9, dwie fazy leczenia C1 i faza powstawania C4. Odrzucanie duplikatów jest celowe — nie mnożyć podobnych efektów bez funkcjonalnej różnicy.

## Mapowanie do gry i zasady wdrożenia

- **Identyfikatory:** nie tworzyć nowych ID; zasoby wiązać z `RaceId` + `R/A1/A4/B1/B9/C1/C4/C9...` i typem fazy (`cast`, `travel`, `impact`, `loop`, `fade`). Jeden ID może używać wielu faz.
- **Propozycja nazw plików po QA:** `public/game/vfx/<race>/<ability>/<phase>-NN.png`. Ta ścieżka jest **propozycją**, nie istniejącym kontraktem runtime; przed importem użyć `src/game/assets/schema.ts`, `contract.ts` i aktualnego `assets:import`.
- **Dystans/obszar i trafienie** nadal określa logika gry, nie rozmiar tekstury; gra nie może dostawać nowego zasięgu, dmg ani kolizji z obrazka.
- **Dopasowanie czasów:** A1 Mędrców 3 s opóźnienia; Strumień Ki 3 s kanału; Sąd Światła 1,5 s ostrzeżenia; A1 Planetarnych 0,4 s nietykalności; C1 Planetarnych 4 s leczenia; C4 Planetarnych 5 s tarczy. Odczytać stan runtime przy renderowaniu, nie zastępować go czasem GIF.
- **Animacja:** pojedyncze nieruchome źródło to nie spritesheet animacji. Dla efektów działających w czasie przygotować `spawn → sustain → fade` (oraz impact dla pocisków). Poziom FPS i wymiary dobrać do faktycznego renderera, nie na ślepo do kontraktu animacji postaci.
- **Kierunek:** poziomy pocisk w prawo to źródłowa orientacja, docelowo obracać w stronę celu. Wir i kopuła mają centrum w punkcie postaci; pęknięcia w punkcie trafienia.
- **Alpha:** w plikach JPG szachownica jest częścią bitmapy; nie utożsamiać jej z przezroczystością. Wycięcie z G04 daje tylko *wstępny* matte; porównać na jasnym i ciemnym tle, skontrolować halo, brak przyciętych iskier i jednorodność komórek.
- **Prawa:** zapisać generator/konto/uprawnionego, datę, oryginalne źródła, warunki komercyjne oraz hash każdego zaimportowanego pliku; obecny link Gemini i zgłoszenie właściciela **nie zamykają audytu licencji**. Odnieść się do `docs/LICENCJE.md`.
- **Bezpieczne wdrożenie:** nowe warstwy czysto wizualne, zachować istniejące assety i fallback; po imporcie wykonać `npm run assets:check`, `npm run typecheck`, `npm test`, `npm run build`, test Playwright/WebGL każdej rasy oraz mobile. Dopiero po odbiorze wizualnym włączać na produkcji.

## Braki

Nie znaleziono w udostępnieniu grafik Androidów i Legend. Brakuje też wielu pozostałych ataków/aktywacji/ultimate/form KI Planetarnych i Mędrców; nie wprowadzać do katalogu fałszywych „gotowych” skillów na podstawie samych promptów. Generować dalsze grafiki **według istniejącej kanonicznej listy**, po jednej grupie faktycznie różnych sylwetek.

### Status wykonania tego zadania

- Odczyt wspólnego linku i wizualna selekcja 36 pól: **TAK**.
- Udokumentowanie powiązań z rzeczywistymi skillami: **TAK**.
- Paczka lokalnych, roboczych wycinków G04 dla właściciela: **TAK**, poza repo.
- Bezpośrednie pobranie 6 oryginalnych plansz Gemini: **NIE** (brak trwałych źródeł binarnych na udostępnionej stronie).
- Import/uruchomienie VFX w Phaserze, QA animacji i poświadczenie praw: **NIE**.
- Zmiany w mechanice gry: **BRAK**.
