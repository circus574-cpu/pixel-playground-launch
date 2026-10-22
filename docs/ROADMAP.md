# KI Legends — plan prac i bramy jakości

## Rozwój ras — osobna gałąź 22.10.2026
Pierwsza dostawa: drzewka, statystyki, runtime walki, świadoma migracja i UI. Następnie odbiór parametrów prototypu, przeciwnicy/statusy/bossowie, rozkład treści i ekonomii 1–20 dla każdej krainy, dłuższe testy balansu oraz sprzętu. Pełny podział i bramy: [RACE-PROGRESSION.md](RACE-PROGRESSION.md). To nie jest zgoda na publikację.


Stan 2026-10-21. Historia szczegółowa: [STAGE2-GAMEPLAY.md](STAGE2-GAMEPLAY.md), [STAGE3-FOUR-CONTINENTS.md](STAGE3-FOUR-CONTINENTS.md), [STAGE3-GPU-ASSET-LIST.md](STAGE3-GPU-ASSET-LIST.md); ten plik nie zastępuje tych dokumentów.

## Obecny etap: lokalne PvE, cztery pochodzenia
Na main: grywalna baza czterech regionów, zapis lokalny, mechanika PvE; PR #9 Planetarni scalony, z domyślnym zachowaniem starej grafiki i opt-in na nową. Globus /mapa pozostaje oddzielnym podglądem w produkcji. Zweryfikowane granice opisują [STATUS.md](STATUS.md) i [ARCHITECTURE.md](ARCHITECTURE.md).

## Brama P0: integracja przed publikacją
1. Wyjaśnić i naprawić wszystkie błędy PR #15 bez osłabiania asercji ani zabezpieczeń `/test`.
2. Uzyskać zakończone PASS dla pełnego CI i oddzielnego Software WebGL na **tym samym końcowym SHA**.
3. Potwierdzić brak regresji zapisów, migracji, czterech regionów, HUD oraz prywatnego `/test`.
4. Sprawdzić wizualnie klatki i ciągłość ruchu Mędrców oraz Planetarnych, urządzenie mobilne i sprzętowy WebGL.
5. Potwierdzić pochodzenie/licencje referencji, zgodę właściciela na merge i osobną zgodę na publikację; zweryfikować produkcyjny commit.

## P1: komplet grafiki
Doprowadzić NPC, przeciwników, świat i dwie pozostałe rasy do zaakceptowanego standardu assetów; nie oznaczać Placeholderów jako finalnego artu.

## P2: multiplayer
Dopiero po zamknięciu P0 i decyzji architektonicznej: autorytatywny backend, identyfikacja graczy, serwerowe zapisy, synchronizacja, bezpieczeństwo i testy obciążenia. Obecnego PvE nie wolno przedstawiać jako MMO.
