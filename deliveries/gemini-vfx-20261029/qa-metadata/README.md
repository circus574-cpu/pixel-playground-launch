# KI Legends — dostawa VFX nr 2 (29.10.2026)

Obejmuje 6 przesłanych plansz JPG (36 pól; pięć plansz 3x2 i jedna 2x3).

- `oryginaly-jpg/` — kopie niezmienionych, dostarczonych plików źródłowych.
- `kandydaci-png-qa/` — tylko pola oznaczone `KANDYDAT`, wydzielone z plansz.
- `rejestr-36.csv` — decyzja, zgodność z rasą/ID, uwagi.
- `manifest.json` — to samo w JSON, z hashami oryginalnych plików.

**WAŻNE: grafiki PNG są materiałem do QA, a nie zasobami zatwierdzonymi na produkcję.**
Kanał alfa oszacowano z jednolitego szarego tła JPG, dlatego krawędzie,
poświaty i ciemne kontury wymagają ręcznej inspekcji (możliwe halo). Nie
uzupełniano brakujących fragmentów ani nie generowano nowych faz animacji.
Nie dodano do runtime gry ani nie zmieniono jej kodu. Przy prawach komercyjnych
potrzebny dowód pochodzenia oryginałów i warunków generatora Gemini.

Zachowane nazwy i identyfikatory są zgodne z `src/game/kit/nodes.generated.ts`.
