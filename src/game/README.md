# Ki Legends — architecture

Phaser 4.2.1 renders a local PvE game. React/TanStack mounts it dynamically and renders a HUD driven by typed `GameSession` snapshots/commands. There is no authoritative multiplayer or account backend.

- `session.ts`: movement/combat rules, enemy AI, quests, loot, equipment, economy and existing browser saves. `characters.ts`: independent character slots and legacy migration. This stage does not extend saves.
- `movement.ts`, `navigation.ts`, `geometry.ts`: shared clearance, attack line of sight, A*, movement and input bounds; artwork cannot change them.
- `world/worlds.ts`, `forest-map.json`, `regions/*.json`: four worlds, unchanged coordinates and footprints. Verdantia keeps four forest tile layers; three regions use terrain/decor definitions. `renderForest.ts` / `renderWorld.ts`: shared render adapters, Y depth, culling/occlusion.
- `assets/catalog.ts`: legacy+versioned imported assets, per-world actor/decor/terrain/effect bindings, active-world preload selection. `schema.ts` / `contract.ts`: machine contract. `phaserAssets.ts`: image/sheet/atlas loader and frame validation. `actorAnimation.ts`: directional state presentation, with existing-art fallback. `layers.ts`, `scenery.ts`, `atmosphere.ts`: independent display layers/scales. `telemetry.ts`: read-only once/second measurements.
- `mountGame.ts`: the single Phaser scene/input/render lifecycle for all worlds. Handles movement, touch joystick, actual gameplay events, loader progress/errors and idempotent scene disposal.
- `components/game`: origin artwork/selection, real loader, HUD/dialogues/inventory/settings and expiring messages. Temporary race-change testing remains enabled in `features.ts`.

Production GPU contract, raw-frame packer, importer, asset schemas, targets and rollback: [GPU_ASSET_PIPELINE.md](../../docs/GPU_ASSET_PIPELINE.md). QA, measurements and branch/PR status: [PRE_GPU_STABILIZATION.md](../../docs/PRE_GPU_STABILIZATION.md).

Run `npm run typecheck`, `npm test`, `npm run assets:check`, `npm run lint`, `npm run build`, `npm run build:playtest`, `npm run test:e2e`. The real `Index` playtest is `/scripts/playtest.html`; the isolated art preview adds `?ki-art=technical`. Production URLs ignore that preview flag. `/test` and private sketch functionality are preserved.
