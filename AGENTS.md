<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

- The sketch space uses a shared-password encrypted server session, not user accounts; verify it before every storage operation.
- Sketch files live in a private Cloud bucket with no anonymous or authenticated storage policies; guarded server functions issue upload and short-lived download capabilities.
- Keep upload validation in a shared client-safe schema so the browser and server enforce the same filename and size rules without restricting extensions.
- Inline previews use session-guarded short-lived storage capabilities and local typed blob URLs; render text as plain text and never send private files to third-party viewers.

## Ki Legends production

- Follow `docs/PRODUCTION.md` and the user's current stage constraints.
- The user authorized Stage 2 gameplay on 2026-10-19 after the anime forest integration. Preserve the accepted map; see docs/STAGE2-GAMEPLAY.md. Implement local PvE progression, never claim authoritative multiplayer. Production publication requires separate explicit user authorization.
- Use independent terrain/object resources, never a complete concept illustration as the production world.
- Keep the camera zoomed out by default and retain the whole-stage fullscreen control with its HUD.
- Run the repository's full TypeScript configuration, not just a partial ad hoc typecheck.
- Preserve `/test`, storage guards, secrets, unrelated features and published git history.


## KI Legends — continuity and documentation (2026-10-21)
This section supplements, and does not replace, the Lovable and private `/test` safety rules above.

- Before any work, read `docs/STATUS.md`, `docs/DECISIONS.md`, `docs/TASKS.md`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/GAME_DESIGN.md`, `docs/WORLD_LORE.md`, and `docs/CHANGELOG.md`; consult historical `docs/STAGE2-GAMEPLAY.md`, `docs/STAGE3-FOUR-CONTINENTS.md`, `docs/PRE_GPU_STABILIZATION.md`, `docs/GPU_ASSET_PIPELINE.md` and QA reports for evidence.
- Canonical races/regions ONLY: Planetarni/Verdantia, Mędrcy/Aetheria, Androidy/Nexus-9, Legendy/Pyra. Historical Human/Orc/Dwarf/Elf are superseded, not new races.
- Distinguish **implemented and verified at a specific SHA**, **planned**, **historical**, **in progress**, and **unverified**. A report or a Git LFS pointer is not proof of a working feature or retrievable binary.
- The owner/architect determines requirements; Codex implements and records changes; an independent auditor checks evidence and regressions. Do not self-certify or claim the auditor approved a release.
- Before publication, independently verify CI, gameplay, desktop/mobile, asset availability, storage integrity, production SHA, and obtain explicit owner approval. No production deployment from this documentation branch.
- Update documentation with decisions, task evidence, exact commit SHA and relevant PR/test run. Do not erase historical rationale, overwrite other agents' active branches, or invent missing lore or features.
- The 2026-10-21 reconstruction is provisional until Codex finishes active repairs and the final implementation SHA is independently verified. Do not treat `docs/STATUS.md` as a final release certificate.
