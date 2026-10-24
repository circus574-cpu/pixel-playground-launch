# KI Legends — zmiany 2026-10-20

Dziennik historyczny; stan aktualny jest w [indeksie](../../INDEX.md).
Nie przenosi starych zgód/statusów na nowe wydania.

## Lista zmian

- Rozwinięto lokalną walkę, NPC, zadania, łup, sklep/kowala, ekwipunek i zapis.
- Dodano cztery pochodzenia, regiony i sloty postaci; później poprawiono HUD mobilny oraz ładowanie/wybór ras.
- Stabilizacja przed GPU objęła cache terenu, wydajność, importer i izolowane testy; szczegóły pomiarów pozostają w qa/.

## Commity w kolejności historii

- `26b440e` — fix(game): keep actor labels readable above foliage and separate combat feedback
- `796b589` — fix(game): restore guidance from saved quest progress
- `a4f7139` — fix(game): use Phaser 4 hit tint API and record production playtest
- `ae5e5a7` — docs: confirm final published gameplay and Phaser 4 regression results
- `58e5dff` — fix(game): clarify tutorial navigation and keep the player readable behind scenery
- `8b61987` — fix(ui): fit combat range feedback and separate the player label
- `caf9042` — chore(quality): clear repository lint errors while preserving sketch access guards
- `ee44df3` — chore(release): expose the verified stage 2.1 build identifier
- `33c6874` — fix(stage2.1): offer direct market navigation inside Aira quest dialogue
- `f471e55` — docs(qa): verify stage 2.1 tutorial before world expansion
- `a5162ab` — feat(world): add four origins, playable regions and protected character slots
- `9ad98ed` — fix(stage3): protect save identity and fit compact touch controls
- `9508cdf` — test(stage3): verify browser gameplay and document GPU asset pipeline
- `cc6f1d9` — docs(release): record verified Stage 3 production deployment
- `f38d827` — feat(ui): present original Ki Legends race art and responsive origin selection
- `028785d` — feat(game): integrate Phaser loading progress, retry and selected-world bootstrap
- `4a7d803` — fix(ui): keep loading recovery clear on short landscape screens
- `4fc89ca` — docs(qa): record Stage 3.1 regression results and original-art screenshots
- `835cffc` — docs(release): confirm Stage 3.1 production gameplay and asset integrity
- `cd0063a` — feat(testing): add temporary race switch shortcut in settings
- `dc56ddf` — docs(testing): confirm production race-switch verification
- `04b6c2e` — ci: add on-demand Playwright browser QA with failure artifacts
- `57717e7` — ci: use configured default browser and standard Playwright cache
- `4caf744` — ci: execute complete Playwright suite on QA pull requests
- `e8edb7a` — test: add real UI PvE journey for sages androids and legends
- `1598e3e` — fix(game): expire guidance and keep gameplay overlays clear
- `f9298e9` — docs(qa): record full gameplay and overlay regression evidence
- `a1a3072` — docs(release): verify clear gameplay overlays on production
- `6d8ef7d` — Merge remote-tracking branch 'origin/qa/playwright-github-actions-20261020' into feat/pre-gpu-stabilization-20261020
- `38310ad` — feat(assets): prepare state animations and validated GPU delivery pipeline
- `82b961d` — fix(assets): reject atlas pivots that override actor feet
- `f739f0d` — perf(world): cache static forest terrain and shadows
- `b51fc19` — docs(qa): record final four-world results and GPU readiness [skip ci]
- `d0a2ba6` — Merge pull request #2 from circus574-cpu/feat/pre-gpu-stabilization-20261020
- `cc363ca` — Work in progress
- `8045a0b` — Lovable update
- `47fd3ac` — chore: restore lint compliance after upstream Supabase generation
- `7add71e` — fix(hud): give mobile gameplay one dock and collapsible tools
- `5685c2e` — fix(hud): stack combat feedback below wrapped target names

## Dowody

- [STAGE3-RESULTS-2026-10-20.json](qa/STAGE3-RESULTS-2026-10-20.json)
- [mobile-hud-layout](qa/mobile-hud-layout/)
- [overlay-audit](qa/overlay-audit/)
- [pre-gpu](qa/pre-gpu/)
- [stage3-1](qa/stage3-1/)

Baza segregacji: `927146f4e5d84ed1b71cd1a732d4f9efd430615c`. Starsze liczby testów dotyczą ich własnych SHA, nie aktualnej głowy.
