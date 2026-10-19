# Ki Legends — forest foundation

Phaser 4.2.1, browser-only dynamic mount from the React/TanStack root route. The HTML HUD uses type-only game imports; scene code remains behind the client effect.

## Current stage

Stage 0 audit: `docs/AUDIT-2026-10-19.md`. Stage 1 graphics: `docs/FOREST-ASSETS.md`. Production constraints and stage order: `docs/PRODUCTION.md`.

The world is built from `world/forest-map.json` and independent OpenAI exports in `public/game/assets/anime-forest-v1/`. `renderForest.ts` creates four autotiled layers and y-sorted object sprites. See `docs/ANIME-FOREST.md` for the current anime export pipeline. The flattened village illustration remains an art reference only. Object collision footprints are separate from their artwork. Minimap and world share the same data.

`view.ts` defines camera limits. The entire React stage enters fullscreen so the HTML HUD remains visible. The default camera zoom is 62% desktop, 48% narrow phones, with 35–100% controls. A `ki:zoom` event updates the actual Phaser camera. Fullscreen always requires a user gesture and may be denied by the browser. The remote automated browser used for QA denied fullscreen; successful native fullscreen was not claimed.

`GameHud.tsx` renders status, target HP, a moving minimap marker, local chat, journal, empty inventory, settings and locked skills. Position, target and defeated count are reported at most 10 times per second. No server gameplay or persistence is present. `/test` and its private sketch storage are untouched.

## Explicitly unfinished

The inherited character has four animation directions, not eight. Boars are static sprites. Existing click movement stops/slides at obstacles and does not find paths. Character HP/KI are initial display values; skills, items, quests and incoming damage are not implemented. Stage 2+ is not complete and must wait for acceptance of stage 1.

## Checks

Run `npm install`, `npm run build`, `npx tsc --noEmit`, `npm test`. Changed TypeScript modules also pass ESLint. The anime offline exporter requires the generated source images listed in `scripts/anime-sources.json` and Pillow/NumPy; it is not a runtime dependency.
