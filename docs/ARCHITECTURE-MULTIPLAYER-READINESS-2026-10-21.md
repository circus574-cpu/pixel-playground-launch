# KI Legends — aktualny stan wdrożeń i bramki multiplayer (21.10.2026)

**Charakter:** żywy rejestr architektoniczny. Bazowy main: `b3872c73`. Dokument nie oznacza zgody na merge ani publikację. Zawsze weryfikować aktualne HEAD i CI.

## Macierz rzeczywistego stanu
| Zakres | main | Gałęzie / dowody | Ograniczenia |
|---|---|---|---|
| Lokalna pętla PvE | Wdrożona: GameSession, A*, ataki/umiejętności, NPC, questy, loot, XP, ekwipunek, handel, śmierć/respawn | docs/STAGE2-GAMEPLAY.md; docs/QA-STAGE2-2026-10-20.md | Nie jest to multiplayer; logika i zapisy klienta nie są autorytatywne |
| Cztery rasy i regiony | Wybór Planetarni/Verdantia, Mędrcy/Aetheria, Androidy/Nexus-9, Legendy/Pyra; cztery lokalne mapy i sloty postaci | docs/STAGE3-FOUR-CONTINENTS.md | Nie oznacza czterech gotowych, unikatowych zestawów animacji |
| Planetarni | 416/416 klatek, 7 stanów × 8 kierunków, 2 atlasy WebP; PR #9 scalony | PR #9, Actions 39611380835: 110 Vitest i 59 Playwright PASS | Zasoby opt-in przez `?ki-hero-art=1`; odbiór wizualny, fizyczny Android, sprzętowy WebGL, licencje otwarte |
| Mędrcy | Nie na main | PR #11: 416/416, 56 klipów, 2 atlasy; PR #12 integruje domyślną postać Aetherii | PR #11 historyczna produkcja GPU, konflikt z main; PR #12 DRAFT, końcowe CI/WebGL i odbiór niezaliczone lub niepotwierdzone |
| Androidy i Legendy | Regiony/wybór są; finalnych analogicznych pakietów postaci nie potwierdzono | STAGE3-FOUR-CONTINENTS.md | Wymagana produkcja artystyczna i testy, jeśli pełna identyfikacja ras ma być warunkiem wydania |
| Mapa planety | /mapa z globusem WebGL, atlasem 2D i fallbackiem | commit b3872c73; docs/MAPA-GLOBUS-3D.md | To podgląd, bez powiązania z postacią/podróżą; hardware QA niewykonane |
| GPU | Runtime Blender/ComfyUI/CUDA odtworzony według raportów PR #9 | docs/GPU-RUNTIME-RESTORE-2026-10-21.md | Nie potwierdzono pełnego Stop/Start; cykl życia GPU wyłącznie decyzją właściciela |
| Konta i serwer autorytatywny | Brak potwierdzonego wdrożenia dla gry | docs/STAGE2-GAMEPLAY.md; STAGE3-FOUR-CONTINENTS.md | Lokalny localStorage i sesja szkicownika nie są kontami MMO |

## Rozbieżności i dług dokumentacyjny
1. docs/PRODUCTION.md zawiera historyczny opis Human/Orc/Dwarf/Elf i stary kierunek artystyczny; nadrzędny jest późniejszy kanon czterech ras, anime fantasy 2D.
2. docs/STAGE3-FOUR-CONTINENTS.md mówi, że wszystkie rasy używają human-v2 — historycznie poprawne dla etapu 3, lecz po PR #9 Planetarni mają opcjonalny atlas; PR #12 proponuje hero-sage w Aetherii.
3. PR #8 (docs/codex-cloud-handoff-20261021) ma checkpoint GPU 179/416, a nie obecne dostawy 416/416.
4. docs/INDEX.md i docs/design/RASY_I_ETAPY.md mówią o brakującym oryginalnym PDF; commit 4b73c5a deklaruje jego archiwizację. Potwierdzić fizyczny plik i SHA-256, dopiero wtedy usunąć przestarzałą uwagę.
5. PR #10 ma historyczne informacje o brakującym PDF, PR #11 jest archiwum źródeł, a aktywna integracja jest w PR #12. Nie scalać historycznych PR-ów bez uzgodnienia.
6. Testy produkcji zasobów (manifest/klatki) nie dowodzą poprawności animacji w runtime. Poprzednia kontrola raportowała 6 FAIL / 4 PASS Software WebGL w PR #12; wymagana ponowna weryfikacja końcowego SHA, a nie automatyczne przenoszenie wyniku na nowe commity.

## Bramki do rozpoczęcia implementacji multiplayer
**P0 — wymagane przed zmianą istniejącej symulacji:**
- [ ] Doprowadzić PR #12 do zielonych pełnych testów Playwright, Vitest, TS, lint, build, asset validation i Software WebGL na tym samym końcowym SHA.
- [ ] Potwierdzić w runtime wczytanie obu atlasów, animacje, dotyk, cztery regiony, walkę, śmierć, respawn i odtwarzanie zapisów; nie mylić SwiftShader z fizycznym GPU.
- [ ] Utrwalić kontrakt GameSession: tick, wejścia gracza, ruch/A*, kolizje, AI, obrażenia, HP/KI, cooldowny, loot, XP i zapis; oznaczyć operacje zależne od przeglądarki.
- [ ] Zatwierdzić decyzję: autorytatywny serwer, zakres MVP (wspólna lokacja, ruch, widoczność, walka, reconnect), bez migracji całej gry naraz.
- [ ] Zdefiniować granicę zaufania i model kont/postaci; nie używać sesji prywatnego szkicownika jako uwierzytelniania MMO.

**P1 — pierwsza implementacja sieciowa:**
- [ ] Wyodrębnić deterministyczną symulację niezależną od Phaser, DOM i localStorage; wprowadzić serwerowy tick i walidację komend.
- [ ] Protokół wersjonowany: input sequence, snapshot/delta, ACK, interpolacja/predykcja, limity pakietów i rate limiting.
- [ ] Autorytatywny stan: pozycje, kolizje, HP, KI, obrażenia, przeciwnicy, przedmioty, handel i nagrody; klient wysyła zamiary, nie wyniki.
- [ ] Konta, identyfikatory postaci, bezpieczna baza, migracja lokalnego zapisu v1/v3 wyłącznie po walidacji i bez kasowania oryginału.
- [ ] Instancje regionów, limity graczy, interest management, wejście/wyjście, przejścia między światami, reconnect.
- [ ] Test dwóch rzeczywistych klientów: ruch, walka, spójność stanu, opóźnienia, utrata pakietów, rozłączenie, duplikacja komend, próby oszustw.
- [ ] Metryki serwera: opóźnienie tick, RTT, obciążenie, liczba połączeń, błędy, logi i rollback migracji.

**P2 — niezależne prace graficzne / wydaniowe (nie blokują prototypu sieciowego):**
- [ ] Finalne pakiety Androidów i Legend oraz osobne NPC/wrogowie i animacje, jeśli wymagane do docelowego wydania.
- [ ] Odbiór wizualny, kontrola komercyjnych praw do referencji, fizyczny Android/iOS i sprzętowy WebGL.
- [ ] Integracja globusa z podróżą między regionami dopiero po osobnym projekcie.
- [ ] Osobna zgoda właściciela na merge, produkcyjne wdrożenie i publikację.

## Zasady architekta
Każdy nowy PR musi aktualizować tę macierz: funkcja, branch/SHA, dowód testu, status main/PR, ograniczenia. Nie zmieniać stanu GPU, nie scalać i nie publikować bez wyraźnej decyzji właściciela. Zachować Lovable, /test, istniejące zapisy i zabezpieczenia szkicownika.
