# KI Legends — architektura i granice weryfikacji
Aktualizacja rekonstrukcyjna: 2026-10-21. Dokument historyczno-projektowy; stan końcowy zostanie ustalony po zamknięciu prac Codexa na konkretnym SHA.

## Źródła
Repozytorium GitHub i istniejące dokumenty: `docs/AUDIT-2026-10-19.md`, `docs/STAGE2-GAMEPLAY.md`, `docs/STAGE3-FOUR-CONTINENTS.md`, `docs/PRE_GPU_STABILIZATION.md`, `docs/GPU_ASSET_PIPELINE.md`, `docs/PRODUCTION.md`, raporty QA, PR i GitHub Actions. Historia rozmów właściciela uzupełnia intencje, ale nie zastępuje dowodów implementacji.

## Stos technologiczny
Phaser 4.2.1 (jedna scena, światy definiowane danymi), TypeScript, React 19, TanStack Start, Vite, Nitro/Cloudflare i integracja Lovable. GitHub jest źródłem wersjonowanego kodu. Domena docelowa: `kilegends.pl`. Brak autorytatywnego serwera MMO i trwałej bazy postaci w potwierdzonej bazie etapu 3.

## Moduły według dokumentacji etapu 3
- `GameSession`: reguły ruchu, A*, kolizji, AI, PvE, HP/KI/XP, questów, łupów, ekonomii, ekwipunku, ulepszeń, śmierci i odrodzenia.
- `world/types.ts`, `world/worlds.ts`, `world/regions/*.json`: definicje czterech regionów, punkty startu, NPC, obiekty i przeszkody.
- `renderWorld` / `renderForest`: render świata i zachowanie istniejącej mapy Verdantii.
- `world/assets.ts`, `characterVisual.ts`: manifest zasobów i adapter klatek/kierunków.
- `CharacterStore`, `SaveStore`: sloty, migracja lokalnych zapisów, ochrona przed konfliktem kart.
- React: wybór pochodzenia/postaci, HUD, dialogi, sklep, kuźnia, ekwipunek; Phaser: scena i prezentacja.
Ścieżki modułów są opisem z dokumentacji, a nie wynikiem świeżego audytu wszystkich plików na końcowym SHA.

## Trwałość i bezpieczeństwo
Historyczny klucz `ki-legends:adventure:v1` pozostaje nietknięty. Migracja do v3 tworzy osobny slot `:character:legacy`; nowe postacie używają `:character:<UUID>`. Nie kasować starych zapisów ani nie zmieniać semantyki migracji bez osobnego audytu. Prywatny szkicownik `/test`, jego sesje i zabezpieczenia storage są niezależnym systemem i muszą pozostać nietknięte.

## Rendering i produkcja assetów
Niezależne podłoża, obiekty, postacie i efekty; sortowanie po Y, footprinty kolizji oddzielone od grafiki, culling i cache terenu. Docelowa stylistyka: autorskie anime fantasy 2D top-down, nie pixel-art ani fotorealistyczny 3D. GPU służy do przygotowania assetów, nie jest zależnością gry podczas działania. Git LFS dla źródeł graficznych; sprawdzać zarówno pointery, jak i dostępność rzeczywistych obiektów LFS.
Specyfikacja docelowa: `docs/GPU_ASSET_PIPELINE.md`; 512px RGBA master, 128px klient, 8 kierunków, 416 klatek na bohatera/przeciwnika, 128 na NPC (kontrakt produkcyjny, nie dowód kompletnej dostawy). Atlas do 2048, budżet tekstur 128 MiB.

## Granice
Nie utożsamiać przejścia testów syntetycznych/importera z zatwierdzeniem oprawy. Nie utożsamiać emulowanego viewportu z testem na fizycznym telefonie. Nie utożsamiać mergowania z wdrożeniem. Ostateczny SHA, testy i produkcję weryfikować po zamknięciu PR Codexa.


## Aktualny kontrakt kodu main i granica GPU — odczyt PR #8
Stan `main` `86a1e411339bc41fb218d4633ed2a7bd81e1f167`: jedna scena Phaser, render w warstwach, `GameSession`, A* siatka 24, promień kolizji stóp 12, prędkość 205 jednostek/s, zoom 0,35–1 (domyślnie desktop 0,62, mobile 0,48), `STATIC_TERRAIN_CACHE_ENABLED=true`, `TEST_RACE_SWITCH_ENABLED=true`. Wspólny ludzki spritesheet nadal reprezentuje cztery pochodzenia w runtime. `?ki-art=technical` działa tylko w izolowanym playteście; nie jest publikacją bohatera.

HUD: końcowa warstwa `hud-layout.css` po wcześniejszych CSS; breakpoint szerokość ≤760 px lub wysokość ≤500 px przy szerokości ≤1100; zwijane menu, wspólny dolny rząd, status-stack i zasięg przycisku rozmowy NPC 180 jednostek (bez walki/otwartych okien). Naprawy PR #5/#7 zachowują mechanikę, zapisy i niezależny `/test`. Zob. `docs/MOBILE-HUD-LAYOUT-2026-10-20.md` na main oraz `docs/TECHNICAL_STATE.md` w PR #8.

**Rozdzielić kontrakty:** main: aktor 96 jednostek, origin (0,5;0,95), kamera renderu 60°. Draft #4: `presentation=grounded`, aktor 128, origin (0,5;0,75), kamera ortho 45°, opt-in `?ki-hero-art=1` i `previewOnly`. Te parametry **nie są wdrożone w main**. Main importer/packer nie przyjmuje automatycznie nowego profilu; integracja wymaga uzgodnienia, testów i oddzielnej zgody.

Raport #8 wskazuje stały marker `pre-gpu-engine-r1` zamiast pełnego SHA w meta `ki-build`: sam marker nie potwierdza zgodności produkcji z commitem. Dokumentacyjny PR nie uruchamia automatycznie CI filtrowanego na kod.
