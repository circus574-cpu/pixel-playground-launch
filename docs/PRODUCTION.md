> **Aktualny aneks — 2026-10-22; weryfikacja GitHub na main `66a615dec1d4259e1bf668956ec1cb09e9aa177e`.** Obowiązują cztery rasy: Planetarni, Mędrcy, Androidy i Legendy. PR #15–#17 są scalone; globus 3D/atlas 2D jest już podłączony do HUD w kodzie, a Aetheria i startowe paczki terenu nie są wyłącznie preview. Planetarny nadal wymaga `?ki-hero-art=1` na main; PR #21 proponuje usunięcie tego warunku i ma pełny QA FAIL (89/95). Odrębna zgoda właściciela na scalenie/publikację z 22.10 jest zapisana w [rejestrze](qa/PUBLISH-AUTHORIZATION-2026-10-22.md), lecz nie usuwa wymogów testów, kontroli praw i odbioru na Androidzie. Produkcyjny SHA pozostaje NIEZWERYFIKOWANY. **Starszy kontrakt i tabela Humans/Orcs/Dwarves/Elves poniżej to historia, a nie bieżące dyspozycje; mapa globusa 3D stanowi interfejs atlasu i nie zmienia podstawowej rozgrywki 2D.** Bez kredytów Lovable, bez zmian produkcyjnych bez wymaganej zgody.

> Aktualizacja 2026-10-20 — etap przed GPU: obowiązują **Planetarni / Verdantia, Mędrcy / Aetheria, Androidy / Nexus-9, Legendy / Pyra**, lokalna rozgrywka PvE i zakaz publikacji w tym etapie. Wdrożony kontrakt animacji/importu: [GPU_ASSET_PIPELINE.md](GPU_ASSET_PIPELINE.md). Stan techniczny i testy: [PRE_GPU_STABILIZATION.md](PRE_GPU_STABILIZATION.md). Poniższa historyczna tabela Human/Orc/Dwarf/Elf i kolejność akceptacji lasu zostały zastąpione bieżącym poleceniem użytkownika; nie są specyfikacją czterech obecnych kontynentów ani dostawy GPU.

> Stage 2 authorization, 2026-10-19: the user explicitly requested a complete local gameplay loop on the existing anime forest. This supersedes the previous map-acceptance gate for combat, NPC, quest, equipment and persistence work. Preserve the artwork. Do not publish production without separate explicit authorization. See STAGE2-GAMEPLAY.md for implementation and actual validation status.

> Aktualizacja 2026-10-19: obowiązuje nowoczesne anime fantasy 2D, nie wcześniejszy kierunek średniowieczny/pixel art. Po pokazaniu próbek użytkownik polecił kontynuować; aktualny etap to produkcja i integracja leśnej krainy anime. Szczegóły: [ANIME-RESET.md](ANIME-RESET.md).

# Ki Legends — production contract

Project: Ki Legends / KileGends. https://kilegends.pl/ ; GitHub `circus574-cpu/pixel-playground-launch`, `main`. Phaser 4, TypeScript, React 19, TanStack Start, Vite, Lovable/Cloudflare hosting. Develop code through GitHub; Lovable primarily synchronizes and publishes it. Polish interface, desktop and mobile browser.

## Identity

Original top-down fantasy MMORPG inspired by the exploration/progression loop of Metin2 and dynamic combat of Diablo, without copied characters, maps, names, textures or UI. Clear controls: mouse, touch, optional keyboard.

| World   | Race    | Environment                                                  |
| ------- | ------- | ------------------------------------------------------------ |
| Forest  | Humans  | Forests, medieval settlements, stone roads, rivers, ruins    |
| Volcano | Orcs    | Lava, ash, black rock, fortresses, war camps                 |
| Ice     | Dwarves | Snowy mountains, glaciers, mines, underground cities, forges |
| Desert  | Elves   | Dunes, oases, ancient temples, magical ruins                 |

Build only the first forest region until its quality is accepted.

## Art requirements

Strict top-down 2D, no isometric grid or 3D scene. Detailed, coherent painted 2D or professional fantasy pixel art; no primitive geometry standing in for characters, buildings or foliage. Terrain must use actual repeatable textures and autotiling. Buildings, trees and decoration are independent sprites with documented dimensions, alpha, anchors, scale, lighting, footprints and layer order. Concept sheets and full village illustrations are references, not complete production asset systems. Do not fabricate animation by duplicating one frame.

Use available OpenAI image generation and processing tools. Be truthful about the actual tool/model, asset readiness and tests. Never spend on a paid external service without permission. Never expose keys, passwords or tokens.

## Mandatory sequence

0. Audit actual source, builds, tests, production and assets.
1. Forest art foundation: materials, transitions, independent objects, several buildings, coherent start map, visual QA in engine.
2. Approved human character with consistent idle/walk animation in eight directions.
3. Click/touch movement, smooth camera, collision, pathfinding and mobile performance.
4. One polished enemy, combat animations, selection, approach, HP/damage, death and first loot.
5. Four skills, potions, inventory, minimap and multiplayer-ready chat UI.
6. First complete playable loop with quests and saved progress.
7. Other three worlds using the validated technical standard.
8. Authoritative multiplayer server, synchronization, persistent characters, chat, parties, guilds and PvP.

Do not advance to the next stage before the current stage meets quality requirements and is accepted. Existing premature demo features may remain for continuity; do not present them as completed production stages.

## Delivery

Small logical commits without rewriting published history. Check full TypeScript config, build, relevant tests and actual published result. Preserve unrelated functionality and user data. Record what was actually done, files, commits, checks, publish status, live link and unfinished work. Do not label unperformed mobile/hardware/FPS/fullscreen checks as passing.
