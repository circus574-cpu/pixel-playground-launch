# KI Legends — plan prac i bramy jakości

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

## P1 / nowy zakres projektowy — progresja i bestiariusz (22.10.2026)

Źródła: [drzewka ras](design/CHARACTER-PROGRESSION-LEVELS-1-20.md) i [20 wrogów](design/BESTIARY-LEVELS-1-20.md). **Zapisane wyłącznie jako koncepcja**, bez wdrożenia w silniku.

1. Zatwierdzić model naliczania 20 punktów, koszty korzenia/Trybu KI i respec; utrzymać rozłączne pary wyborów.
2. Zaprojektować bezpieczną migrację postaci i zapisów, nie zmieniać ID ras/krain ani istniejących slotów.
3. Dodać system odblokowań, cooldownów, buffów/debuffów, aury i zasobów rasowych oraz testy dla wszystkich 116 węzłów.
4. Wdrożyć i zbalansować 20 przeciwników z podziałem zwykły/elita/boss (poziomy 5/10/15/20), bez fikcyjnego odtwarzania nieudokumentowanych profili mnożników.
5. Przeprojektować fabularne nagrody za zdolności i potwierdzić regresję walki, AI, łupów, zapisów, HUD, Androida i WebGL przed publikacją.

Właściciel potwierdził zachowanie obecnych nazw `Verdantia, Aetheria, Nexus-9, Pyra`; nazwy aneksów `Terranova, Eldoria, Nexaris, Valthera` pozostają w oryginalnych materiałach źródłowych.
