# Dziennik zmian — 2026-11-07

## Kombajn do Animacji i Koordynacji KI Legends (`tools/ki-animation-studio/`)

Zaprojektowano i zbudowano kompletny, wieloprocesowy (16-CPU) system webowy do tworzenia, łączenia, stylizacji, transformacji i eksportu animacji postaci oraz potworów zgodnie z kontraktem produkcyjnym KI Legends (`art/pipeline/stage3-render-contract.json` oraz `docs/RASY-I-POSTACIE.md`):

1. **Konfiguracja i kontrakty (`tools/ki-animation-studio/config/`)**:
   - `studio_config.json` — parametry 16 wątków CPU, port `8090`, 7 kanonicznych stanów animacji (`idle`, `walk`, `attack`, `skill`, `hit`, `death`, `respawn`), 8 kierunków kompasowych i kotwice stóp (`(0.5, 0.95)` dla postaci gracza, `(0.5, 0.80)` dla potworów/bossów).
   - `blender_contract.json` — parametry kamery ortograficznej (`60°` elewacji, turntable `0°..315°`), oświetlenia 3-punktowego NW i obrysu Freestyle.
   - `race_palettes.json` — palety kolorystyczne, aury KI i mnożniki transformacji dla czterech ras (`verdant`, `aether`, `nexus`, `pyra`).
2. **Backend Python 16-CPU (`tools/ki-animation-studio/backend/`)**:
   - `video_extractor.py` — ekstraktor klatek MP4/WebM/GIF na 16 rdzeniach CPU (`ProcessPoolExecutor`), wycinanie tła z ochroną konturu i automatyczna normalizacja do kotwicy stóp (`Foot-Anchor Lock`).
   - `combinator_engine.py` — silnik kombinacji klatek (Forward, Reverse, Ping-Pong, Seamless Loop, Hit-Stop z drganiem uderzenia, Combo Flurry, własne sekwencje indeksów), krzywe prędkości, interpolacja Optical Flow (`Farnebäck`) oraz syntetyzer 8 kierunków.
   - `fx_transform_engine.py` — silnik modyfikacji wyglądu klatek, efektów VFX (wielowarstwowa Aura KI, pioruny, fala uderzeniowa, smugi ruchu, cień kontaktowy, Cel-Shading, obrys anime, Rim Light NW) i deformacji postaci wokół kotwicy stóp.
   - `exporter_engine.py` — eksporter paczek `.zip` (`pack.json`, `manifest.json`, `provenance.json` z SHA-256, `spritesheet.png`, Phaser JSON Hash `.json`, animowany `.gif`).
   - `server.py` oraz `quick_start_zero_deps.py` — serwer FastAPI/Uvicorn oraz natychmiastowy serwer bez zewnętrznych zależności (`http.server.ThreadingHTTPServer`).
3. **Skrypty Blender 3D (`tools/ki-animation-studio/blender/`)**:
   - `blender_headless_turntable.py`, `blender_mocap_retarget.py`, `blender_vfx_card_rig.py`, `run_blender_16cpu.sh`.
4. **Panel przeglądarkowy Online (`tools/ki-animation-studio/frontend/`)**:
   - `index.html`, `css/studio.css`, `js/studio_app.js` — responsywny interfejs 4-etapowy obsługujący przeglądarki mobilne (telefon) i desktopowe, z wbudowanym dekompozytorem MP4, kombinatorem, procesorem efektów i pakerem CRC32 `.zip`.
5. **Archiwum wdrożeniowe**:
   - Spakowano całość do `ki-animation-studio-kombajn.zip` wraz z instrukcją uruchomienia na serwerze VPS 16 CPU (`README_INSTRUKCJA_VPS_16CPU.md`, `install_and_run_16cpu.sh`, `ki-animation-studio.service`, `Dockerfile`, `docker-compose.yml`).
