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

- GPU pod lifecycle is owner-only. Never call Start, Stop, Restart or Terminate, including after renders, during CPU tests, for cleanup or to retry capacity. The owner performs these actions. This explicit instruction supersedes historical advice to stop GPU rental automatically.
- Follow `docs/PRODUCTION.md` and the user's current stage constraints.
- The user authorized Stage 2 gameplay on 2026-10-19 after the anime forest integration. Preserve the accepted map; see docs/STAGE2-GAMEPLAY.md. Implement local PvE progression, never claim authoritative multiplayer. Production publication requires separate explicit user authorization.
- Use independent terrain/object resources, never a complete concept illustration as the production world.
- Keep the camera zoomed out by default and retain the whole-stage fullscreen control with its HUD.
- Run the repository's full TypeScript configuration, not just a partial ad hoc typecheck.
- Preserve `/test`, storage guards, secrets, unrelated features and published git history.
- /mapa shows a lazily loaded WebGL globe wrapping the painted equirectangular atlas, with the flat atlas plus transparent SVG hitboxes as the 2D view and no-WebGL fallback; both views pick regions from the same traced outlines, so regenerate outlines and `scripts/build_globe_textures.py` outputs whenever the atlas changes.

## Shared project knowledge — required for every agent

- Before planning or implementing Ki Legends changes, read [docs/INDEX.md](docs/INDEX.md) and the relevant linked source documents from the current commit. Do not rely solely on chat memory or PR descriptions.
- The owner-provided 12-page design PDF is a source document; see [docs/design/RASY_I_ETAPY.md](docs/design/RASY_I_ETAPY.md) for an interim text index. The original binary PDF must still be uploaded and verified before claiming archival completeness.
- Distinguish conceptual race art and proposed abilities from implemented, tested features. Preserve existing accepted race identities and assets.
- **GPU instance control is reserved exclusively for the owner.** Codex/agents must never start, stop, restart, delete, resize, or change billing/hardware configuration of GPU instances without the owner's explicit decision. This remains true after render completion, during idle time, and on failures. Agents may inspect state, run authorized workloads on an already-running instance, safeguard data, and report to the owner.
- Never merge a PR, publish the game, or alter production configuration without separate explicit owner approval.
- Generated Cloud client files (`src/integrations/supabase/types.ts`, `previewAuthStorage.ts`) are listed in `.prettierignore`, because the platform regenerates them and reformatting would break lint after every sync.
