# Dziennik Zmian — 2026-10-24 (`feature/quests-v2`)

## Zakres wdrożenia: KI LEGENDS — WORLD V2: ŻYJĄCA PLANETA, EKSPLORACJA I PRZYGODY

1. **Moduły Świata V2 (`src/game/worlds/`)**:
   - Utworzono definicje 4 kontynentów (`verdant.ts`, `pyra.ts`, `aether.ts`, `nexus.ts`) obejmujące 16 miast (4 stolice + 12 miast regionalnych z granicami `inSafeCity`), 20 tras i szlaków przygodowych, 16 Sławnych Lokacji powiązanych z rzeczywistymi ID obiektów mapy (`fountain-5`, `bridge-6`, `cottage-0`, `forge-2`, `fortress-0`, `war-shrine-1`, `war-shrine-2`, `statue-3`, `sanctum-0`, `archive-1`, `archive-2`, `ki-source-3`, `lab-0`, `reactor-2`, `terminal-4`, `crystal-6`), 17 Ukrytych Miejsc oraz 14 Wydarzeń Świata.
2. **Silnik i Katalog 106 Questów (`src/game/quests/`)**:
   - Wdrożono 106 zadań (po 24 na każdy kontynent: 8 głównych, 12 pobocznych, 4 ukryte + 10 misji międzykontynentalnych).
   - Zaimplementowano stany `unavailable`, `available`, `active`, `completed`, 5 typów celów (`combat`, `talk`, `discover`, `visit`, `deliver`), zadania wieloetapowe, zależności, ochronę przed duplikacją nagród oraz migrację `Save v4 -> Save v5`.
3. **Interfejs Eksploracji, Dziennik Questów i Plansze HUD/UI (`src/components/`)**:
   - Dodano `WorldV2Explorer.tsx` (interaktywna mapa kontynentów, znaczniki `!` / `?` nad NPC, kompas najbliższego celu, rejestr odkryć, dziennik questów).
   - Dodano `HudShowcase.tsx` (3 wizualne plansze HUD/UI w ciemnym stylu anime RPG z dynamicznym kolorem rasy, drzewkiem 29 węzłów i 7 slotami ekwipunku).
4. **Testy Jednostkowe (`src/game/quests/__tests__/quests.test.ts`)**:
   - Dodano zestaw 9 kompleksowych testów Vitest pokrywających wszystkie 13 wymagań z Sekcji 10.
