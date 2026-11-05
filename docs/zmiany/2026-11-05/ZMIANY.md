# Zmiany — 2026-11-05

## Prezentacja potworów

### 1. Wielkości potworów (świat v2)

- Powód (właściciel, 04.11.2026): wszystkie potwory wyglądały na podobnej wielkości. Pomiar grafik `enemy-v3-*` pokazał, że klasa S/M/L z bestiariusza
  nie jest odzwierciedlona w sprite'ach: ciało zajmuje 75–80% ramki niezależnie od klasy, a 24 z 40 potworów to ta sama klasa M.
- Rozwiązanie: rozmiar rysowanej ramki liczy się z pomiaru ciała (`scripts/measure_monster_bodies.py` → `src/game/monsters/bodyExtent.generated.ts`)
  jako `docelowy rozmiar klasy × mnożnik potwora / zmierzone ciało` (`src/game/monsters/visualSize.ts`). Docelowe ciało: S 50, M 82, L 116 px;
  ręczne mnożniki 0,75–1,2 na potwora dają różnice wewnątrz klasy (wszystkie 40 w pliku, do swobodnej edycji). Efekt: zakres 42–139 px
  zamiast 42–107, średnia L 93→120, M 62–94, boss (180 px ramki, ok. 145 px ciała) pozostaje największy.
- Tylko prezentacja: zasięg, trafienia i kolizje bez zmian. Domyślnie włączone; `?ki-monster-sizes=0` przywraca dawne klasy S/M/L.
- Test: `src/test/monster-sizes.test.ts`. Arkusze porównawcze wszystkich 40 potworów (stare vs nowe, liczone z danych) i zrzuty z gry
  przy spawnach: `docs/zmiany/2026-11-05/qa/monster-sizes/`.
- Mnożniki i docelowe rozmiary to propozycja projektowa do akceptacji właściciela; nie pochodzą z bestiariusza.
