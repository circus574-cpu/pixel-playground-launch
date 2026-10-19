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

- The sketch space uses a shared-password encrypted server session, not user accounts; panel operations verify this session, while external uploads verify a separately scoped bearer token before storage access.
- Sketch files live in a private Cloud bucket with no anonymous or authenticated storage policies; guarded server functions issue upload and short-lived download capabilities.
- Keep upload validation in a shared client-safe schema so the browser and server enforce the same filename and size rules without restricting extensions.
- Inline previews use session-guarded short-lived storage capabilities and local typed blob URLs; render text as plain text and never send private files to third-party viewers.
- Automation tokens are generated server-side, revealed once and stored only as hashes; service-role-only tables and atomic RPCs provide revocation and durable rate limits without introducing user accounts.
- External upload handlers live under /api/public/uploads with /api/uploads aliases for compatibility; the public prefix is required for external callers on hosted sites, and all handlers verify bearer authorization.
- URL imports use exact trusted GitHub hosts and manually constrained redirects; arbitrary HTTPS is forbidden until connection-time public-IP filtering is available, avoiding DNS rebinding.
- Storage folders are virtual prefixes; recursively enumerate them and preserve legacy root objects so automation files appear alongside manual sketches.
