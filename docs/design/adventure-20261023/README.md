# KI Legends — Księga przygody i rozwoju 1.0

Projekt zamówiony przez właściciela 23.10.2026. Nowa fabuła i zawartość są
**propozycją do przeglądu, nie wdrożeniem ani zatwierdzonym balansem**.
Punkt odniesienia repozytorium: `5bb495c7bfce311077bf081cd27b636e577dcdcf`.

- [PDF — Księga przygody i rozwoju](KI-LEGENDS-KSIEGA-PRZYGODY-v1.0.pdf): 89 stron,
  spis treści z odnośnikami, zakładki, osadzone fonty z polskimi znakami.
- [Pełny tekst Markdown](KI-LEGENDS-KSIEGA-PRZYGODY.md).
- [Dane projektu JSON](campaign-data.json): 98 zadań, 177 pozycji przedmiotów,
  94 receptury i 8 projektów bossów. Nie podłączać do runtime bez osobnej implementacji.
- [Manifest i sumy SHA-256](manifest.json), [kontrola PDF](PDF-QA.json).

Treść: sześć aktów kampanii, cztery prologi, 24 wspólne zadania główne,
24 poboczne, 12 osobistych, 6 rzemieślniczych i 8 powtarzalnych kontraktów;
16 miast (istniejące stolice + proponowane osady), sześć wysp, frakcje, wybory,
awanse 1–20, ekonomia, ekwipunek, ulepszenia, sceny dialogowe i plan wdrożenia.
Zachowane dane źródłowe obejmują 40 przeciwników i 116 węzłów ras.

## Odtwarzanie

Źródłem redakcyjnym jest `build_book.py`; Markdown, JSON i PDF są generowane.
Zmianę tekstu lub liczb wprowadzić tam i ponownie wygenerować komplet.

```bash
python3 -m pip install -r docs/design/adventure-20261023/requirements.txt
python3 docs/design/adventure-20261023/build_book.py
python3 docs/design/adventure-20261023/verify_book.py
```

Generator korzysta z DejaVu Sans w `/usr/share/fonts/truetype/dejavu/`
(w Debianie pakiet `fonts-dejavu-core`). [Informacja licencyjna fontów](FONT-LICENSE.txt).
PDF ma deterministyczne metadane; przy tych samych źródłach, bibliotekach i fontach
kolejny eksport zachowuje SHA-256. Skrypt nie modyfikuje plików gry ani źródeł kanonu.

Sprawdzono spójność ID, wejścia receptur, brak cykli i prostego arbitrażu,
kolejność przykładowej ścieżki XP, sumy plików, odnośniki i granice tekstu PDF.
Przejrzano wizualnie wybrane strony. Nie jest to test rozgrywki ani odbiór balansu.
