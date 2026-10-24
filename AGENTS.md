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
- Follow `docs/ZASADY.md` and the user's current stage constraints.
- The user authorized Stage 2 gameplay on 2026-10-19 after the anime forest integration. Preserve the accepted map; see docs/ROZWOJ-I-WALKA.md. Implement local PvE progression, never claim authoritative multiplayer. Production publication requires separate explicit user authorization.
- Use independent terrain/object resources, never a complete concept illustration as the production world.
- Keep the camera zoomed out by default and retain the whole-stage fullscreen control with its HUD.
- Region art upgrades ship as GPU-importer packs of render bindings (`terrain.*`, `object.*`, optional `terrain.<world>-wall`, presentation-only `origin`), opt-in via `PREVIEW_SWITCHES` until the owner accepts them; collision footprints stay in region JSON.
- Run the repository's full TypeScript configuration, not just a partial ad hoc typecheck.
- Preserve `/test`, storage guards, secrets, unrelated features and published git history.
- /mapa shows a lazily loaded WebGL globe wrapping the painted equirectangular atlas, with the flat atlas plus transparent SVG hitboxes as the 2D view and no-WebGL fallback; both views pick regions from the same traced outlines, so regenerate outlines and `scripts/build_globe_textures.py` outputs whenever the atlas changes.

## Shared project knowledge — required for every agent

- Before planning or implementing Ki Legends changes, read [docs/INDEX.md](docs/INDEX.md) and the relevant linked source documents from the current commit. Do not rely solely on chat memory or PR descriptions.
- The owner-provided 12-page design PDF is a source document; see [docs/INDEX.md](docs/INDEX.md) for an interim text index. The original binary PDF and its 12 lossless parts are present; verify the recorded SHA-256 before claiming archival completeness.
- Distinguish conceptual race art and proposed abilities from implemented, tested features. Preserve existing accepted race identities and assets.
- **GPU instance control is reserved exclusively for the owner.** Codex/agents must never start, stop, restart, delete, resize, or change billing/hardware configuration of GPU instances without the owner's explicit decision. This remains true after render completion, during idle time, and on failures. Agents may inspect state, run authorized workloads on an already-running instance, safeguard data, and report to the owner.
- Never merge a PR, publish the game, or alter production configuration without separate explicit owner approval.
- Generated Cloud client files (`src/integrations/supabase/types.ts`, `previewAuthStorage.ts`) are listed in `.prettierignore`, because the platform regenerates them and reformatting would break lint after every sync.
- Rasy i potwory: statystyki ras, 4 drzewka (29 węzłów) i model obrażeń pochodzą z aneksu właściciela 22.10.2026, a 40 potworów z jego bestiariusza HTML; źródła liczb to generowane pliki (`nodes.generated.ts`, `base.generated.ts`) — nie edytować ich ręcznie, zmieniać źródło i generator. Opis, założenia i luki: `docs/ROZWOJ-I-WALKA.md`. Szybkość ruchu rośnie o 5% bazowej na poziom do 20 (decyzja właściciela). Właściciel 23.10.2026 zlecił generację całej planety według zatwierdzonej geometrii, z drogami, ścieżkami, ukrytymi lokacjami i labiryntami; spawny mają powstawać w osobnej generacji na gotowych danych świata. Ta decyzja zastępuje wcześniejsze odłożenie spawnów. Bezpieczne miasta pozostają bez przeciwników.
- Region curved roads/courts (`terrain.roads`, `terrain.courts`) are presentation-only and baked into chunk textures by `src/game/world/renderRoads.ts`; collision always comes from obstacles and footprints so saves and navigation stay independent of art.
- The planet atlas (2D/3D) is shared by /mapa and the in-game overlay via MapaView props (`current`, `onClose`); it only reads the active character continent through MapChrome and never imports game session code, keeping /mapa light.
- Continents have the size of the painted continents (docs/SWIAT-I-MIASTA.md); each local city is a safe area of about 4000 × 2500 units (`city.bounds`, no combat, `inSafeCity`), the rest of the continent is empty but reachable ground. Region content is moved with `scripts/expand_continents.py` and the `scripts/build_*_city.py` builders; saves follow `layout`/`layoutShifts`.

## Documentation maintenance

- Keep exactly the ten thematic Markdown documents listed in `docs/INDEX.md`; update the relevant topic instead of adding status, QA, handoff or per-delivery manuals.
- Write chronological changes in `docs/zmiany/YYYY-MM-DD/ZMIANY.md` (one journal per date); keep that day's QA evidence under its `qa/` subfolder.
- Preserve source PDFs, canonical JSON, legal texts and provenance. These are evidence/data, not extra active manuals. Older descriptions remain in Git.
- Run `python3 scripts/docs/check_documentation.py` after documentation changes. Do not regenerate the removed documents from old scripts.
