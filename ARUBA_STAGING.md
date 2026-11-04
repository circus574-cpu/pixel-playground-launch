# KI Legends — Aruba / Coolify / PostgreSQL

**Aktualizacja 2026-11-04.** To już **nie jest plan migracji**. Hosting KI Legends został przeniesiony na VPS Aruba, a prywatny PostgreSQL oraz serwer gry są częścią istniejącej architektury. Nie wracać do instrukcji „dostarczyć ZIP przed pierwszym wdrożeniem”, „brak serwera”, „Supabase jako jedyne konto gry” ani „brak migracji”; są to historyczne checkpointy.

## Stan i odnośniki

- Produkcja: `kilegends.pl`, VPS Aruba/Coolify, aplikacja Node.js + Caddy; `/ws/*` na port 7420 demona, PostgreSQL w prywatnej sieci Compose.
- Uruchomiony kod serwerowego PvE, kont i postaci na PostgreSQL, rewizje świata publikowane z panelu; nie mylić z ukończonym MMO.
- Ścieżki bieżące: [architektura](docs/ARCHITEKTURA-I-TESTY.md), [plan i kontrole](docs/PLAN-I-ZADANIA.md), [indeks](docs/INDEX.md), [instrukcja agentów](AGENTS.md).
- Weryfikacja **bieżącej aktywności** kontenerów, działania SMTP/Resend, odtwarzania kopii oraz sesji prawdziwego gracza wymaga osobnego live QA. Bez tego nie wolno ogłaszać nowego wyniku testu.
- Migracja projektu została zakończona, lecz otwarty PR #71 dokumentuje historyczne niedomknięte kontrole ops/rollback — to osobny zakres QA, nie argument za powtarzaniem migracji.

## Historyczny zapis przygotowań

Stare pakiety ZIP, staging, wyniki logów z 28–29.10 i listy blokad pozostają w historii Git tego pliku i dziennikach [28.10](docs/zmiany/2026-10-28/ZMIANY.md), [29.10](docs/zmiany/2026-10-29/ZMIANY.md) i [01.11](docs/zmiany/2026-11-01/ZMIANY.md). Nie stosować ich jako checklisty nowego wdrożenia i nie przywracać starych usług bez osobnej zgody właściciela.
