# KI Legends — village prototype

Phaser 4.2.1, mounted only in the browser. The root route dynamically imports `mountKileGends`; type-only HUD imports never evaluate Phaser during SSR. `/test` and its private sketch storage are unchanged.

## Current appearance

The approved OpenAI village background is `/game/assets/village-v2.webp` at a 1920×1280 world size. Rectangular colliders are fitted to buildings, the fountain, forest edges and river; the bridge remains traversable. This is a flattened environment background; foreground canopy occlusion and layered world editing are not implemented yet.

`hero-walk-v2.webp` provides four directional four-frame walk animations. `ui-v2.webp` contains the portrait and eight painted icons in a 3×3 grid. The existing boar frame from `world-v1.webp` remains in use.

`GameHud.tsx` renders accessible HTML over the canvas: player status, target HP, a live position marker on the minimap, quest journal, empty inventory, settings and local chat. `mountKileGends` reports actual position, target HP and defeated count at most 10 times per second. Health and KI show the initial prototype values; this stage has no incoming damage or KI consumption. Skill buttons are explicitly locked and do not implement skills. Chat is clearly local to the device and not connected to other players. No player data is persisted or sent.

Walking, click targeting and basic auto-melee remain the existing prototype mechanics. Keyboard movement ignores focused text fields and dialogs. The canvas resizes with its container. No multiplayer authority, pathfinding, quest completion or item mechanics are implemented.

## Validation

TypeScript strict check for game and HUD modules; Vitest collision/line-of-sight tests. Check the published desktop and mobile layout after deployment.
