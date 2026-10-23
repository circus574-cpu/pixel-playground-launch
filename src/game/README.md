# Ki Legends — architecture

Phaser 4.2.1 renders a local PvE game. React/TanStack mounts it dynamically and renders a HUD driven by typed `GameSession` snapshots/commands. There is no authoritative multiplayer or account backend.

- `session.ts`: movement, quests, loot, equipment, economy and browser saves (version 5: city interiors and character depot; versions 1, 3 and 4 still load). It owns one race `kit` and the `MonsterSystem`. `characters.ts`: independent character slots and legacy migration.
- `kit/`: race statistics and the four skill trees (29 nodes each) from the owner annex of 22.10.2026; `base.ts` is the shared core (stats, cooldowns, Ki, buffs, shields, channels) and `planetary|sage|android|legend.ts` implement every node. `nodes.generated.ts` is generated from `docs/design/data/character-progression-1-20.json`.
- `monsters/`: the 40 bestiary monsters (`catalog.ts`, numbers from `base.generated.ts`), AI/skills/zones/loot (`system.ts`), status effects on the player (`fx.ts`) and loot materials. Spawns in regions are intentionally empty until the continents are complete. Rules and assumptions: [ROZWOJ-I-WALKA.md](../../docs/ROZWOJ-I-WALKA.md).
- `movement.ts`, `navigation.ts`, `geometry.ts`: shared clearance, attack line of sight, A*, movement and input bounds; artwork cannot change them.
- `world/worlds.ts`, `forest-map.json`, `regions/*.json`: four worlds, unchanged coordinates and footprints. Verdantia keeps four forest tile layers; three regions use terrain/decor definitions. `renderForest.ts` / `renderWorld.ts`: shared render adapters, Y depth, culling/occlusion.
- `assets/catalog.ts`: legacy+versioned imported assets, per-world actor/decor/terrain/effect bindings, active-world preload selection. `schema.ts` / `contract.ts`: machine contract. `phaserAssets.ts`: image/sheet/atlas loader and frame validation. `actorAnimation.ts`: directional state presentation, with existing-art fallback. `layers.ts`, `scenery.ts`, `atmosphere.ts`: independent display layers/scales. `telemetry.ts`: read-only once/second measurements.
- `mountGame.ts`: the single Phaser scene/input/render lifecycle for all worlds. Handles movement, touch joystick, actual gameplay events, loader progress/errors and idempotent scene disposal.
- `components/game`: origin artwork/selection, real loader, HUD/dialogues/inventory/settings and expiring messages. Temporary race-change testing remains enabled in `features.ts`.

Production GPU contract, raw-frame packer, importer, asset schemas, targets and rollback: [GPU-I-ZASOBY.md](../../docs/GPU-I-ZASOBY.md). QA, measurements and branch/PR status: [ARCHITEKTURA-I-TESTY.md](../../docs/ARCHITEKTURA-I-TESTY.md).

Run `npm run typecheck`, `npm test`, `npm run assets:check`, `npm run lint`, `npm run build`, `npm run build:playtest`, `npm run test:e2e`. The real `Index` playtest is `/scripts/playtest.html`; the isolated art preview adds `?ki-art=technical`. Production URLs ignore that preview flag. `/test` and private sketch functionality are preserved.
