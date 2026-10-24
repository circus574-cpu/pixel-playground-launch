# KI Legends — zmiany 2026-10-21

Dziennik historyczny; stan aktualny jest w [indeksie](../../INDEX.md).
Nie przenosi starych zgód/statusów na nowe wydania.

## Lista zmian

- Integracja starszych Planetarnych/Mędrców, 416-klatkowy kontrakt i kontrola źródeł.
- Przywrócono oprogramowanie runtime GPU i sprawdzono kopie/hash; nie jest to dowód aktualnego stanu instancji.
- PR #15: historyczne 90/91 miało ERR_ABORTED podczas /test → /. Trace i lokalne CDP wskazały konkurencyjny reload Vite po optymalizacji zależności. Serwer QA otrzymał izolowany cache i wyłączony HMR; nie zmieniono zabezpieczeń /test.

## Commity w kolejności historii

- `05f91f1` — fix(hud): separate desktop tools and exercise real visible touch controls
- `8e5909f` — test(hud): open folded tools before checking mobile camera geometry
- `7a52aae` — test(pve): account for camera centre when clicking rendered enemies
- `5e72796` — Merge pull request #5 from circus574-cpu/fix/mobile-hud-layout-20261020
- `ea86489` — docs(hud): record full QA and verified production publication
- `86a1e41` — Merge pull request #7 from circus574-cpu/docs/mobile-hud-verification-20261021
- `e0e24ca` — Work in progress
- `b204b0d` — Changes
- `43fd92e` — Changes
- `0c70262` — Changes
- `35380c9` — Changes
- `3798a15` — Changes
- `6b4945e` — Changes
- `be538ed` — Changes
- `fbb9110` — Changes
- `2b41ddd` — Changes
- `1aca688` — Changes
- `ad4a1f9` — Dodano mapę 2D na /mapa
- `0884ae1` — Work in progress
- `1d44b4e` — Changes
- `7fef500` — Changes
- `70e6e49` — Dodano prawdziwą mapę w atlasie
- `71c0b88` — style: restore lint formatting in generated Supabase files
- `07f6a14` — feat: complete Planetarni motion-v2 and add guarded visual preview
- `ff56cfc` — docs: verify remote Planetarni LFS readback and finalize QA evidence
- `b6006e0` — fix(gpu): preserve owner-only pod control and record restored runtime
- `dc4396e` — docs: publish shared agent documentation on main
- `ea57ee9` — docs: publish shared agent documentation on main
- `69ca8cd` — docs: require agent index and owner-only GPU control on main
- `4b73c5a` — docs: archive original Ki Legends design PDF
- `f14d4f3` — docs: close PR9 CI audit and preserve complete animation review evidence [skip ci]
- `cd01806` — Merge pull request #9 from circus574-cpu/work/planetary-resume-20261021
- `3830180` — Work in progress
- `d044991` — Changes
- `b3872c7` — Dodano globus 3D na /mapa
- `0b14510` — feat(sage): import immutable runtime atlases onto current main without removing Planetary assets
- `b06f066` — feat(sage): preserve Planetary pack and add Sage pack to one canonical asset manifest
- `7ed9b5c` — feat(runtime): default Sage in Aetheria while keeping Planetary opt-in and other races intact
- `8465ef3` — test(e2e): account for default Sage character in all-race Android input regressions
- `2bb9fd2` — test(e2e): protect Planetary preview isolation without suppressing default Sage
- `38f09be` — test(unit): assert Sage 416 frames and Planetary runtime coexistence without race bleed
- `9cb42ec` — ci: independently exercise both GPU heroes in SwiftShader WebGL on integration branch
- `7ba715c` — docs: document safe Sage + Planetary integration and verifiable release gates
- `e388707` — fix(typecheck): enable race-specific preview pack IDs without broadening other races
- `d865fda` — fix(ci): format combined Sage and Planetary integration assertion
- `3807dd6` — test(webgl): add renderer smoke tests for Sage and Planetary without SwiftShader FPS assumptions
- `3784de6` — ci(webgl): exercise both GPU atlases and real movement without SwiftShader frame-rate thresholds
- `47e38be` — fix(test): correct async polling callback in WebGL smoke regressions
- `f6701df` — test(webgl): require real Phaser WebGL renderer, not Canvas fallback
- `dfeefa9` — ci(webgl): avoid duplicate push and pull-request runs for same integration SHA
- `95f8d6f` — fix(ci): apply Prettier formatting to WebGL renderer assertion
- `d0e4ec6` — feat: support explicit Verdantia handoff into real playable character selection
- `4566311` — feat: add Verdantia globe action leading to playable world
- `20520a4` — feat: enable playable Verdantia entry from 2D fallback map too
- `319d38d` — fix: open Planetarni origin selection on Verdantia globe handoff
- `6fe2e5c` — fix: format Verdantia handoff to satisfy CI lint
- `d932010` — feat: enable Aetheria Sage continent in PlanetGlobe.tsx
- `2193fcb` — feat: enable Aetheria Sage continent in PlanetMap.tsx
- `409f026` — feat: enable Aetheria Sage continent in index.tsx
- `b875aad` — fix: type-safe Aetheria handoff and formatted origin notice
- `ee88d2f` — feat: add deterministic in-game Aetheria ground vegetation, KI blooms and sanctuary inlays
- `13aea85` — feat: start Nexus-9 playable terrain circuitry and energy-node details
- `936f6db` — feat: add Nexus-9 reactor containment rings and path-aligned energy conduits
- `a9d2697` — feat: extend Nexus-9 terrain with illuminated platform seams and facility hazard beacons
- `f7a4bc8` — fix: constrain globe continent selection and saved-character roster without changing saves
- `f83f5ce` — fix: pass globe continent intent into character selection
- `1e65968` — fix: keep race pagination locked to requested globe continent
- `33082a4` — test: cover Verdantia and Aetheria globe handoff and save isolation
- `76c0991` — fix: lock globe origin carousel to the selected continent
- `890ca3f` — fix: accept undefined globe intent with exactOptionalPropertyTypes
- `af7a8c1` — style: resolve CI Prettier errors in e2e/globe-handoff.spec.ts
- `c3d4ffb` — style: resolve CI Prettier errors in src/components/game/CharacterSelection.tsx
- `88cef03` — style: resolve CI Prettier errors in src/components/planet-map/PlanetGlobe.tsx
- `ae475cc` — style: resolve CI Prettier errors in src/components/planet-map/PlanetMap.tsx
- `c2463d7` — style: resolve CI Prettier errors in src/game/world/renderWorld.ts
- `eaad06d` — style: format globe/map entry Link JSX for Prettier
- `b842bd7` — style: format globe/map entry Link JSX for Prettier
- `c4c46b4` — style: resolve remaining renderWorld Prettier failure
- `defdf6a` — feat: enable fourth continent Pyra and all four globe handoffs
- `4b0c6ec` — feat: enable fourth continent Pyra and all four globe handoffs
- `cb3d708` — feat: enable fourth continent Pyra and all four globe handoffs
- `c4affd9` — feat: enable fourth continent Pyra and all four globe handoffs
- `f94bd93` — test: cover Pyra Legends and Nexus-9 Androids continent handoff
- `cab56c1` — fix(qa): isolate renderer suites, release globe resources and cover continent regressions
- `c413acc` — fix(test): preserve tracked documentation and isolate browser evidence
- `ae3f8b9` — fix(test): wait for hit recovery before observing attack animation
- `b9f4457` — fix: isolate browser QA from development reloads during navigation
- `c843d83` — docs: establish audited docs/ARCHITEKTURA-I-TESTY.md
- `5399a84` — docs: establish audited docs/PLAN-I-ZADANIA.md
- `6972a6b` — docs: establish audited docs/PLAN-I-ZADANIA.md
- `4f2029d` — docs: establish audited docs/PLAN-I-ZADANIA.md
- `a4f78d2` — docs: establish audited docs/PLAN-I-ZADANIA.md
- `5a35aa0` — docs: establish audited docs/ARCHITEKTURA-I-TESTY.md
- `dd67212` — docs: link audited registers in agent knowledge index
- `996c237` — docs: owner ordered GPU production Androids Legends then four race cities
- `c8fd8ea` — docs: link six-stage GPU production order in central index
- `d959927` — test: observe real critical health before timing defeat in software WebGL
- `74147d9` — docs: use actual Ki Legends PDF image references pages 4-8
- `c2b1717` — docs: record verified original design PDF size SHA256 and archival blocker
- `ef1ed34` — docs: preserve source design PDF transcription page 1
- `3a92982` — docs: preserve source design PDF transcription page 2
- `a5f1683` — docs: preserve source design PDF transcription page 3
- `ba84300` — docs: preserve source design PDF transcription page 4
- `1924023` — docs: preserve source design PDF transcription page 5
- `e4d0f13` — docs: preserve design PDF transcript page 7
- `85749bd` — docs: preserve design PDF transcript page 8
- `a33ddac` — docs: preserve design PDF transcript page 9
- `6439d79` — docs: preserve design PDF transcript page 10
- `bb0680f` — docs: preserve design PDF transcript page 11
- `9b3f4e1` — docs: preserve design PDF transcript page 12
- `083985e` — docs: preserve Android design reference from PDF page 6
- `2cfaa34` — docs: index all 12 source PDF pages and flag unarchived visuals
- `ff0a4be` — docs: link preserved original design source pages

## Dowody

- [planetary-resume-20261021](qa/planetary-resume-20261021/)
- [runtime-restore-20261021](qa/runtime-restore-20261021/)
- [sage-delivery-review7](qa/sage-delivery-review7/)

Baza segregacji: `927146f4e5d84ed1b71cd1a732d4f9efd430615c`. Starsze liczby testów dotyczą ich własnych SHA, nie aktualnej głowy.
