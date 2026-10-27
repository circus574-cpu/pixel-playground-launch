# GPU 27.10.2026 — zasoby poza postaciami (nie zainstalowane w grze)

- `skill-icons/` — 116 ikon węzłów drzewek (`<rasa>-<węzeł>.webp`, 128 px), seed 8820101.
- `item-icons/` — 74 ikony przedmiotów, materiałów (slug jak `MATERIALS`), statusów i emblematów ras, 128 px RGBA.
  Brak (do poprawy): węgiel, zarodniki, zielone ziele, złom, żywy korzeń.
- `biome-lava/`, `biome-ocean/`, `biome-glacier/` — po 12 obiektów krajobrazu, wycięte, ≤512 px.
  Część oceanu (rafa, wir, wodorosty, pływy) wyszła jako wzór terenu, nie pojedynczy obiekt.
- `hud-<styl>/` — 8 elementów HUD (panel, kula, slot, pasek, przycisk, pierścień, narożnik, separator) × 5 stylów.
- `vfx/<rasa>/<efekt>.png` — pętle 8 × 256 px do mieszania addytywnego (+ podgląd GIF): orb, comet, beam, impact, ring, aura, sparks, charge.
- `interiors-test-anime.jpg` — test wnętrz (model anime), oceniony dobrze; pełny zestaw 24 pomieszczeń nie został wygenerowany.

Źródła 1024 px i pozostałe seedy: network volume `/workspace/ki-legends-gpu/renders/`. Generatory: `scripts/gpu/` na gałęzi `feat/continent-worlds`.
Licencje modeli: nierozstrzygnięte (docs/ASSET-LICENSE-REGISTER.md).
