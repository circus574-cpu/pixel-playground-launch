# KI Legends — rejestr decyzji (rekonstrukcja)
Statusy: **POTWIERDZONE** = ustalenie właściciela lub zachowany dokument; **HISTORYCZNE** = zastąpione; **OTWARTE** = wymaga decyzji; **NIEZWERYFIKOWANE** = brak dowodu realizacji.

| ID | Data | Decyzja | Status / źródło |
| --- | --- | --- | --- |
| D-001 | 2026-10-19 | KI Legends jako docelowa gra przeglądarkowa top-down anime RPG; dawny projekt pixel-playground-launch | POTWIERDZONE: historia rozmów, repo |
| D-002 | 2026-10-19 | Zastąpienie estetyki średniowieczno-pixelowej oryginalnym anime fantasy; oddzielne zasoby, nie płaski obraz mapy | POTWIERDZONE: `docs/ANIME-RESET.md` |
| D-003 | 2026-10-19 | Najpierw grywalna lokalna pętla PvE, automatyczny atak, ręczne skille i leczenie; minimum kontrolek | POTWIERDZONE: rozmowy, `docs/STAGE2-GAMEPLAY.md` |
| D-004 | 2026-10-19/20 | Multiplayer i arena/PvP dopiero później; nie nazywać obecnej gry działającym MMO | POTWIERDZONE: rozmowy, etap 3 |
| D-005 | 2026-10-20 | Cztery pochodzenia: Planetarni/Verdantia, Mędrcy/Aetheria, Androidy/Nexus-9, Legendy/Pyra | POTWIERDZONE: `docs/STAGE3-FOUR-CONTINENTS.md` |
| D-006 | 2026-10-20 | Odrzucić stare Human/Orc/Dwarf/Elf jako aktualny kanon | POTWIERDZONE: etap 3; wcześniejsze koncepcje historyczne |
| D-007 | 2026-10-20 | Zachować istniejącą mapę i zapisy; migracja niedestrukcyjna; chronić `/test` | POTWIERDZONE: `AGENTS.md`, etap 3 |
| D-008 | 2026-10-20 | GitHub jako źródło kodu i historii, `kilegends.pl` jako domena; Lovable do publikacji | POTWIERDZONE: rozmowy |
| D-009 | 2026-10-20 | Pipeline GPU: źródła w Git LFS, produkcyjne spritesheety i walidacja, test w Phaserze | POTWIERDZONE jako wymóg; ukończenie NIEZWERYFIKOWANE |
| D-010 | 2026-10-20 | Jakość bohaterów i miast oceniać na podstawie gry, nie plansz koncepcyjnych | POTWIERDZONE: rozmowy |
| D-011 | 2026-10-21 | Role: właściciel/architekt ustala wymagania, Codex realizuje i zapisuje, niezależny audytor weryfikuje | POTWIERDZONE: instrukcje projektu |
| D-012 | 2026-10-21 | Dokumentacja i decyzje trwale w GitHub; nie polegać na pamięci rozmów | POTWIERDZONE: żądanie właściciela |
| D-013 | 2026-10-21 | Nie publikować bez osobnej zgody właściciela i niezależnych dowodów testów | POTWIERDZONE: instrukcje audytu |
| D-014 | otwarte | Szczegółowa fabuła, klasy, bonusy rasowe, sieciowy backend, ekonomia MMO, monetizacja | OTWARTE; nie zakładać wdrożenia |

Przy każdej zmianie kanonu dodawać datę, źródło, właściciela decyzji i powiązany commit/PR. Nie przepisywać historii w sposób sugerujący, że koncepcja była wdrożona.


## Doprecyzowania po PR #8 — nie zmieniają historycznego kanonu
| ID | Data | Ustalenie / granica | Dowód |
| --- | --- | --- | --- |
| D-015 | 2026-10-21 | Naprawy HUD #5/#7 zakończone i scalone; testy bazowego PvE 97/54 na 86a1e41 | PR #8 FINAL_TESTS; Actions 39540694141 na 7a52aae |
| D-016 | 2026-10-21 | Zatwierdzony wzorzec Planetarnego ≠ kompletna animacja; 179/416, #4 draft | PR #8 HANDOFF/GPU_PRODUCTION, #4 |
| D-017 | 2026-10-21 | Nie scalać profilu grounded 128/0.75/45° bez zgodności z main 96/0.95/60° | PR #8 TECHNICAL_STATE/GPU_PRODUCTION |
| D-018 | 2026-10-21 | GPU wyłączony według właściciela; restart/koszt wyłącznie po nowej zgodzie | PR #8 HANDOFF |
| D-019 | 2026-10-21 | Trwałe dowody LFS dla 181 obiektów, ale nie pełny backup modeli/runtime i woluminu | PR #8 GPU_PRODUCTION, gpu-lfs-verification.json |
| D-020 | 2026-10-21 | Publikacja HUD wcześniej wykonana i testowana; przekazanie #8 nie upoważnia do kolejnej | PR #8 HANDOFF, #7 |


## Uzupełnienia chronologiczne z PR #8
| ID | Data | Ustalenie / korekta | Dowód i status |
| --- | --- | --- | --- |
| D-015 | 2026-10-20/21 | Priorytet bohatera Planetarnych przed innymi rasami i masową produkcją miast; zatwierdzony **wzorzec** wyglądu nie oznacza zatwierdzenia riga | `GPU_PRODUCTION.md`, PR #4 — POTWIERDZONE jako kierunek |
| D-016 | 2026-10-20/21 | Nie instalować niepełnych klipów; profil `grounded` #4 jest inny niż kontrakt main | `PLANETARNI-RESUME.md`, `GPU_PRODUCTION.md` — POTWIERDZONE technicznie |
| D-017 | 2026-10-21 | PR #5/#7 naprawiły HUD bez zastępowania zasad walki, zapisów ani systemu `/test` | merge `5e72796`, `86a1e41`, CI `39540694141` — POTWIERDZONE |
| D-018 | 2026-10-21 | GPU pozostaje wyłączone; nie uruchamiać, nie pobierać modeli ani nie zmieniać woluminu bez nowej zgody | przekazanie właściciela w PR #8 — POTWIERDZONE jako ograniczenie procesu; fizyczny stan GPU NIEZWERYFIKOWANY |
| D-019 | 2026-10-21 | Dokumentacja PR #8 i PR #6 pozostaje osobna, bez automatycznego scalenia i publikacji | żądanie właściciela — POTWIERDZONE |
