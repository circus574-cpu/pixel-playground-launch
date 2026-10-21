# Mędrcy / Aetheria — production record

Branch `sage/aetheria-20261021` starts independently from main `70e6e49683241236ccd7ce9da90059e3144f82b3`; no PR #9 source assets are replaced. No merge or publication authorized.

## Canon checked

`src/game/world/races.ts`: Mędrcy, Aetheria, focused KI and spiritual discipline; schools of energy, meditation, ancient rituals. Architect PR #6 WORLD_LORE at `6ffb6b3ac2655c124f69d85c346f4d74fe111cee`: Sanctuary of Thousand Springs, libraries, terraces, springs and old trees. No new biography, racial bonuses or combat mechanics inferred.

The existing `public/game/assets/origins-v1/sage-full.webp` / original `stage3/references/sage.jpg` is the appearance reference: long pale hair/topknot, pointed ears as a visual feature (not a new race), ivory/emerald robes, gold shoulder/greave details, staff with emerald orb held in left hand. The illustration is not sliced into frames or used as a billboard texture. Its original SHA256 is `a0f3faab56a789e45661e076af18a2b73ed96856090626da33be05151d8de9b4`. Historical generic violet/gold environmental notes do not override the actual character illustration.

## Scope

One deforming rig, seven engine states, eight directions: idle8, walk8, attack8, skill8, hit4, death8, respawn8 =416 target frames. These are targets, not a claim of generated frames. Fixed perspective, alpha margin >=8px, fixed foot origin, no per-frame cropping. Separate opt-in only; default human sprite, saves and private /test remain unchanged. Final visual approval remains with owner.

## Sources and rights

CC0 MakeHuman anatomical mesh/weights at revision `a8bc2d54ff0ac92e78ff71431b1023eda42bf482`, retained source hashes/license; original procedural costume, staff, hair and rig script. Existing project illustration used only as reference, original illustration provenance/right clearance remains an open project issue. Blender/CUDA renders do not use diffusion weights. Installed Animagine/DreamShaper OpenRAIL models are not part of the sprite production dependency. No declaration of final legal clearance.

## GPU / restoration

Owner-started pod `8yts4ka55ffhxs` was read-only checked: RTX A6000, torch2.4.1+cu124 CUDA available, Blender4.5.3LTS available, ComfyUI backend HTTP200. Existing isolated restoration is healthy; no reinstall needed. PR #9 runtime-restore report records actual inference test and verified self-contained archive. No pod lifecycle action performed. Only owner may change power/hardware/billing. Full power-cycle restore has not been tested by an agent.

## Calibration revisions

Four initial rig views were rendered at ortho7.0; they are calibration evidence, not delivered animation frames. Full416pose preflight rejected30, then16 death/respawn bounds violations before producing animation PNGs. Corrections center the fallen rig in its facing and counter-rotate the staff wrist. Final animation uses one fixed ortho8.0 canvas for every state/direction, preserving45° perspective and(.5,.75)origin. The larger canvas accommodates the long staff and sideways body; it is not per-frame recropping.
