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
- The /mapa preview renders a painted raster atlas with transparent SVG hitboxes traced from that image; regenerate outlines whenever the atlas changes so clicks stay aligned.
