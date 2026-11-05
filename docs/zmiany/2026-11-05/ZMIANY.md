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

### 2. Nowa oprawa kontynentów Verdantia, Pyra i Aetheria (domyślnie włączona)

- Z gałęzi Codexa (PR #110, #114, #115, #116; łańcuch gałęzi, każda zawiera poprzednią) wchodzą: Verdantia (26 dodatkowych zasobów + podłoża), Pyra
  (52 zasoby: 14 materiałów, 33 obiekty, 5 efektów) i Aetheria (36 zasobów: 14 materiałów, 22 obiekty) oraz komplet 64 grafik środowiska Nexus-9
  (`art/production/nexus-continent-v2/`). Nexus-9 to na razie same grafiki: Codex nie wpiął ich w grę (brakuje przypisań, masek, skali), więc w grze Nexus
  wygląda jak dotąd.
- Decyzja właściciela 05.11.2026 ("scal i publikuj"): flagi `ki-verdant-continent`, `ki-pyra-continent`, `ki-aetheria-continent` są domyślnie włączone,
  `=0` przywraca dawny wygląd danego kontynentu (`DEFAULT_ON_SWITCHES` w `src/game/assets/catalog.ts`). Geometria, nawigacja, kolizje, spawny i zapisy
  bez zmian (dekoracje bez fizyki).
- Integracja z czyszczeniem drzew przy spawnach: transformacje kontynentów działają pierwsze, filtr aren na ich wyniku. Filtr rozpoznaje teraz też nowe drzewa i
  krzewy (klon, miłorząb, cyprys, jeżyna, borówka), które wcześniej by przeciekały.
- Testy kontynentów Codexa zmieniono z „opt-in” na „domyślnie włączone, `=0` wyłącza”; pozostałe asercje (zachowanie wcześniejszych wiązań, budżet
  strumieniowania, brak mutacji, metadane fizyczne) bez zmian.
- Dowody: zrzuty z gry bez flag vs `=0` w `docs/zmiany/2026-11-05/qa/continents/`; raporty Codexa w `docs/zmiany/2026-11-04/qa/{verdantia-complete,pyra-continent,aetheria-continent,nexus-materials}/`.
- Nie zweryfikowano: fizycznego telefonu i sprzętowego WebGL (jak w raportach Codexa), Nexus-9 w grze (brak integracji).
