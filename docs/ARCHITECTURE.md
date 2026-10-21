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


## GPU runtime i pipeline — szczegóły z PR #8 (historyczne, nie bieżąca inwentaryzacja)
RunPod pod `uywsfhvthv4n4k`, 1× RTX A6000 nominalnie 48 GB, historycznie sterownik 595.91.07 / CUDA runtime 12.4 / PyTorch 2.4.1+cu124; ComfyUI v0.3.76 przypięte do commita `30c259cac8c08ff8d015f9aff3151cb525c9b702`; Blender 4.5.3 LTS jako moduł `bpy`. Runtime `/opt/ki-legends-gpu`, Comfy `/opt/ComfyUI`, dane/kopie `/workspace/ki-legends-gpu`. `/workspace` zaobserwowano jako `fuse.geesefs`, bez pełnej semantyki POSIX; nie ma potwierdzonego identyfikatora RunPod Network Volume. Nie przenosić środowisk venv na FUSE ani nie aktualizować CUDA/PyTorch/ComfyUI w ciemno. Błędny entrypoint naprawiono historycznie przez poprawne argv; pełny zimny restart po utracie `/opt` NIEZWERYFIKOWANY.

Modele użyte historycznie: Animagine XL 3.1 (revision `483f0c322568ed13697ed01dd0be07204746d12b`, 6 938 325 776 B) oraz DreamShaper XL Turbo 2.1 (revision `f70ad5bce436c640d23fc02cd0a6ccc787280b6e`, 6 939 220 250 B), licencja opisana jako CreativeML Open RAIL++-M; MakeHuman baza anatomiczna CC0-1.0; U²-Net przez rembg/CPU do mattingu. Bieżąca dostępność wag i licencje do komercyjnego użycia NIEZWERYFIKOWANE. WAN 2.2 nie jest potrzebny do produkcji riga; wcześniejsze selektywne usunięcie WAN było odrębną, historyczną operacją — nie powtarzać jej. Nie usuwać danych Qwen/Ollama.

Planetarni `motion-v2`: Blender animuje jeden rig w 8 kierunkach; 512×512 RGBA master, 128² klient, profil grounded ortho 45°, punkt stóp .75, collider 12, Cycles CUDA 16 samples. Klipy: idle 8/kierunek @6 FPS, walk 8 @16 FPS, attack 8 @16 FPS, skill 8 @12 FPS, hit 4 @16 FPS, death 8 @10 FPS, respawn 8 @12 FPS; sumarycznie 416. Obecnie 179/416. Pierwszy `motion-trial-v1` odrzucono (ucięte włosy/za duża sylwetka). Źródłowe `.blend` jest edytowalne, ale test wizualny i import do gry NIEWYKONANE. Pełna, wersjonowana specyfikacja i źródła: `docs/GPU_PRODUCTION.md` w PR #8 oraz `docs/PLANETARNI-RESUME.md` w PR #4.
