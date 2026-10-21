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

## Newly archived owner source

During production main advanced to `4b73c5a889496f0333fd83434a50991a429b398f`, adding the original12page design PDF. Read its actual text (including Mędrcy page5), current docs/INDEX and owner rules. PDF SHA256 `be58d9df4fb49d19b11a66d47a1a3fc3fbbf5acc9c11ddc5cf76213f6be15734`. It confirms ivory/emerald/gold,long robes,ritual jewelry,ornate staffs and luminous circles; distance,barriers/support are conceptual targets,not new mechanics implemented here. Current main documentation/AGENTS are preserved verbatim in this independent branch to avoid conflicting policy copies. The index still historically says the PDF is missing; the binary is now present as confirmed above.

## Owner visual correction — v1 rejected

Owner rejected the simplified procedural v1 after seeing the two rig views, and supplied two detailed painted Sage references. All42 generated v1 sample frames remain technical/rejected evidence;0accepted production frames,full416render notstarted. Saved the corrected reference-guided image_gen master under v2/sources/visual-master. It is a single visual master,not a textured3D rig or completed animation. Nextproduction must preserve the ornate illustrated identity; passing geometry alone is insufficient. GPU power was notchanged.

## Isolated reconstruction pilot

NewTripoSR environment was copied with dereferenced symlinks (no hard links), so pip changes cannot mutate ComfyUI. PinnedMIT code/weights, torchmcubesMPL2, headlessEGL. Fixed missing scikit-build-core>=1 and upstreambake CPU/CUDA tensor mismatch inside thisisolatedcopy. Actual CUDA inference generated280751UVvertices/344278faces,2048RGBAtexture,OBJ andGLB. These are staticunreviewed candidates,not a rig or416frame set. OriginalComfy torch2.4.1+cu124/transformers4.57.6 unchanged; allthreevenvs pipcheckPASS andComfyAPI200 afterinstallation. Model5b52193 cachedonpersistentvolume with5fileSHAreadback. AdditionalfrontUVprojection test retainsoriginalreferencepixels onactual3Dgeometry; registrationrequiresvisualreview.

## Reconstruction rejected; painted2Drig production

RawTripoSR and the high-resolution front-projected candidate were visually inspected and rejected: melted hair/cloth geometry and missing faithful face/silhouette. Do not render416 production frames from these candidates. Geometry/provenance success is not visual acceptance. Their source files remain on the persistentvolume for audit.

The corrected painted v2 identity was shown to the owner; owner instructed to continue. Production now uses explicitly labelled2D painted directional masters and an editable deforming2Dpuppet rig in Blender/CUDA, preserving detailedillustration rather than claiming a successful3Dreconstruction. No independently redrawnAIanimationframes. Sourceviews are being generated; acceptedanimationcount remains0/416 until actualvalidrenderoutput.
