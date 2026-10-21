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
