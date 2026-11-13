# Zmiany 2026-11-13

### 1. Wdrożenie: test przeglądu świata admina przekraczał limit czasu w CI

- Wdrożenie PR #159 (animacje Trybu KI 5B/5C, NPC Myśliwy i Alchemik) zatrzymał na `main` test
  `admin-world-overview` „maps combat objectives…”: przelicza wszystkie cele zadań wszystkich lądów, sam trwa ok. 3,5 s,
  a przy pełnym równoległym zestawie w CI przekroczył domyślne 5 s (ten sam kod przeszedł chwilę wcześniej w PR).
  Ryzyko było zapisane w dzienniku 12.11.2026.
- Poprawka: jawny limit 30 s dla tego jednego testu; jego sprawdzenia bez zmian.

### 2. Potwory: klatki przycięte do sylwetki (bez strat), 80 paczek

- Atlasy potworów przechowywały każdą klatkę w pełnej komórce 128 px; sylwetka zajmuje średnio ok. 1/3 komórki, reszta
  to przezroczyste tło. Nowe narzędzie `scripts/assets/trim_atlas_pack.py`: przycięcie do sylwetki (+1 px oryginalnego
  otoczenia, żeby krawędź przy skalowaniu mieszała się z tymi samymi sąsiadami), identyczne klatki zapisane raz, ciasne
  upakowanie, WebP bezstratny z zachowaniem koloru pod przezroczystością. Każda klatka jest odtwarzana w pełnym rozmiarze
  i porównywana ze starą (przezroczystość wszędzie, kolor wszędzie gdzie widoczny) — narzędzie przerywa przy różnicy.
- Wynik (pamięć tekstur): potwory anime `enemy-v3-*`, które gra pokazuje: **320 → 130 MiB** (8 → 2,4–4,4 MiB na
  potwora); starsze `enemy-v2-*` (dostępne przez `?ki-monsters-anime=0`): **1040 → 177 MiB**. Zestaw Mędrca z salamandrą
  (test budżetu strumieniowania): 98,36 → 93,93 MiB.
- Wykryty i naprawiony błąd po drodze: importer przy `--replace` przenosił paczkę na koniec rejestru, przez co stara
  wersja potworów (v2) zaczynała wygrywać z zaakceptowanymi potworami anime (v3). Przywrócono kolejność z `main`
  (skrypt porównał zwycięskie przypisania: 0 zmian), importer zachowuje teraz miejsce paczki (test w `gpu-pipeline`).
  Wcześniejsze wdrożenia nie były tym dotknięte (porównanie przypisań przed i po: tylko zamierzeni Myśliwy i Alchemik).
- Weryfikacja w silniku Phaser (te same klatki ze starego i nowego atlasu obok siebie): przy skali 1:1 maks. różnica
  5/255, przy 84 px i 168 px pojedyncze piksele do 14–19/255 (precyzja próbkowania karty, rozłożone po sylwetce, okiem
  nieodróżnialne). W grze: potwory v3 rysują się z przyciętych klatek, rozmiary wyświetlania bez zmian, 0 błędów.
- Bez zmian: bohaterowie (atlasy już przycięte: przepakowanie dałoby 2,5%), obrazy budynków i obiektów (przycięcie
  marginesów: ok. 14 MiB w całej grze, rozproszone), atlas obiektów lasu (przepakowanie: 2,2 MiB).
