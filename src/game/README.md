# Ki Legends — forest foundation

Phaser 4.2.1, browser-only dynamic mount from the React/TanStack root route. The HTML HUD uses type-only game imports; scene code remains behind the client effect.

## Current stage

Current gameplay implementation and validation limitations: docs/STAGE2-GAMEPLAY.md. Local preview: npm run playtest, then /scripts/playtest.html; no publish occurs.

Stage 0 audit: `docs/AUDIT-2026-10-19.md`. Stage 1 graphics: `docs/FOREST-ASSETS.md`. Production constraints and stage order: `docs/PRODUCTION.md`.

The world is built from `world/forest-map.json` and independent OpenAI exports in `public/game/assets/anime-forest-v1/`. `renderForest.ts` creates four autotiled layers and y-sorted object sprites. See `docs/ANIME-FOREST.md` for the current anime export pipeline. The flattened village illustration remains an art reference only. Object collision footprints are separate from their artwork. Minimap and world share the same data.

`view.ts` defines camera limits. The entire React stage enters fullscreen so the HTML HUD remains visible. The default camera zoom is 62% desktop, 48% narrow phones, with 35–100% controls. A `ki:zoom` event updates the actual Phaser camera. Fullscreen always requires a user gesture and may be denied by the browser. The remote automated browser used for QA denied fullscreen; successful native fullscreen was not claimed.

`GameHud.tsx` renders status, target HP, a moving minimap marker, local chat, journal, empty inventory, settings and locked skills. Position, target and defeated count are reported at most 10 times per second. No server gameplay or persistence is present. `/test` and its private sketch storage are untouched.

## Gameplay and limits

GameSession owns local PvE, four NPC interactions, three sequential quests, XP/stats, stackable loot, equipment, merchant, smith and versioned local persistence. Navigation shares the forest's real collision footprints. Phaser remains the renderer/input adapter; React sends typed commands and renders snapshots.

Skills: 1 flame, 2 pulse, 3 shield, 4/Space basic attack, Q potion. E approaches the nearest NPC; F collects nearby loot. Mouse/touch can target visible actors. Journal/map offer navigation buttons. Dialogues and menu panels pause this local simulation.

This is a local single-player adventure foundation, not a network MMORPG. Human walking retains four existing directions. Combat/death use procedural articulation and effects, not new hand-painted directional attack frames. NPCs reuse existing character art with role tints. Other races, regions, authoritative multiplayer and cloud-account persistence remain future work.

## Checks

Run `npm install`, `npm run build`, `npx tsc --noEmit`, `npm test`. Changed TypeScript modules also pass ESLint. The anime offline exporter requires the generated source images listed in `scripts/anime-sources.json` and Pillow/NumPy; it is not a runtime dependency.
