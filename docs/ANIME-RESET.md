# Ki Legends — anime direction reset, 2026-10-19

Historical audit and style proposal. After presentation, the user instructed continuation. Production integration is documented in ANIME-FOREST.md. This anime direction supersedes the old medieval/pixel-art direction.

## Audit evidence

- Main audited at `16379c12d2925e5cadb8d34a2b23ff4354b68847`. Phaser is pinned to 4.2.1; React 19 and TanStack Start remain in place.
- Production was inspected in the existing 852×393 browser viewport harness. The old forest terrain, small actor and dark gold HUD are still visible. A root-tab reload timed out; the existing live harness remained inspectable. The three Android screenshots mentioned in the request were not attached to this message and were not reviewed as if available.
- Terrain already uses four tile layers and an extruded atlas; objects use a separate atlas, Y depth and footprint collision. Preserve this infrastructure while replacing art after approval.
- Current hero is displayed in a 62×62 world-unit frame, becoming at most 38px at desktop zoom .62 and 30px at mobile zoom .48; transparent padding makes the visible silhouette smaller. This contributes directly to poor readability.
- Camera zoom and the React HUD are independent. Compact layout currently depends on width/height media queries. Existing landscape screenshot still shows a large chat and minimap; repository CSS alone does not prove deployed layout quality.
- Existing animation has four directions, not eight. Movement/collision/basic targeting are retained; do not claim pathfinding, final character animation or full MMORPG systems.
- No physical Android/iPhone performance benchmark was performed. Existing viewport emulation is not hardware QA. Browser fullscreen previously rejected requests in this remote environment; native fullscreen success is unverified.

## Available OpenAI capabilities

Use the built-in OpenAI image generation tool. Its invocation exposes no model identifier or model selection parameter, so record model as `not disclosed by tool`, not a guessed model/version. OpenAI Platform tools available in this session configure API keys and targets; they are not image generation endpoints. No paid API request or key setup is needed for these samples.

## Candidate art contract

Modern original anime fantasy illustration: clean silhouettes, controlled outlines, broad cel-shaded forms, soft painted surfaces. No pixelation, photorealistic material noise, isometric diamond layout or 3D rendering. North-up top-down RPG projection with readable faces/facades is allowed.

Palette targets: emerald #3C805B, mint #A4CCA0, teal #3D9295, cream #F3E5BE, warm earth #C7AA77, coral #D97968, blue-violet shadow #46546C. Final sampled colors may vary; this is a direction guide.

Proposed scale, not integrated: world terrain cell 32 units, source terrain 128px; hero visible height 96 world units (roughly 46px at .48, 60px at .62), doors 110–120 units, tree crowns 240–330 units, houses 500–620 units wide. Preserve sprite aspect ratios. Actor foot anchor approximately (.5,.94), buildings at doorway ground contact, tree at trunk ground contact. Exact collision footprints require integration review.

## Deliverable boundaries

- Reference scene: art direction only, never a flattened production map.
- Grass sample: actual isolated material to validate repetition and export; one sample does not establish all terrain transitions/autotiling.
- Tree and house: separately generated transparent candidate sprites, not arbitrary crops from a scene.
- Hero: character design candidate only. A single pose is not a spritesheet or animation.
- Candidate assets belong outside `public/`; no runtime imports before approval. Retain provenance, prompts, alpha/dimension checks and honest visual findings.

Next gate: user approves direction; then produce terrain variants, transitions, independent objects and atlases, integrate and inspect actual gameplay before proceeding to eight-direction character animation and HUD replacement.
