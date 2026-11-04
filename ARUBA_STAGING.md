# KI Legends — Aruba/VPS (stan i archiwum migracji)

**Stan obowiązujący od 01–04.11.2026: migracja hostingu na VPS Aruba/Coolify została wykonana.** To nie jest już lista czynności do przeprowadzenia. Produkcyjny serwer gry Node, prywatny PostgreSQL 17 oraz serwerowy PvE i konta graczy na VPS zostały wprowadzone do kodu/scalone (`#60`, `#69`, `#76`, `#77`, `#79`).

**Aktualne źródła:** [AGENTS.md](AGENTS.md), [indeks](docs/INDEX.md), [architektura](docs/ARCHITEKTURA-I-TESTY.md), [dzienniki 01–04.11](docs/zmiany/2026-11-04/ZMIANY.md). Stary eksport ZIP, kontenery staging, hasła dawnego Supabase i pierwotny brak dostępu do Coolify nie są już aktywnymi blokerami migracji projektu.

## Bieżący układ
- VPS Aruba + Coolify obsługuje aplikację i usługę `Superior` (Node, domyślnie `7420`, 20 Hz, limit konfiguracyjny 50). Przekazywanie `/ws/*` i serwerową sesję PvE należy sprawdzać według aktualnego release.
- PostgreSQL 17 przechowuje postacie/operacje/sesje, konta oraz rewizje świata; dane bazy są prywatne, bez publicznej ekspozycji portu PostgreSQL.
- Konta i tokeny są na VPS (`/ws/auth/*`); zapis postaci i symulacja PvE są na serwerze (`/ws/online`). Dawny Supabase pozostaje w częściach kodu i ścieżce migracji kont/legacy, ale nie jest głównym źródłem aktywnych postaci.
- W repo istnieją `docker-compose.yml`, `docker-compose.online.yml`, `deploy/multiplayer/` i `.github/workflows/aruba-production.yml`. Ich deklaracje nie zastępują odczytu bieżącego Coolify i kontroli wydania; nie przeprowadzaj ponownego cutoveru ani resetu bazy na podstawie starej instrukcji.
- **VPN nie jest potwierdzony:** PR #60 opisuje prywatną sieć Docker i brak skonfigurowanego tunelu. Słowo VPS nie oznacza VPN.

## Historyczne checkpointy (nieaktywne)
- **28–29.10:** przygotowywano staging, eksporty ZIP, Dockerfile i warstwy overlay; wówczas wdrożenie/komplet danych bywały niepotwierdzone.
- **29.10 (#60):** utworzono prywatną bazę PostgreSQL pod przyszłą integrację.
- **01.11 (#69):** gra przeszła na obowiązkową sesję serwerową PvE i trwałe postacie. Pozostały osobne kontrole operacyjne po cutoverze, udokumentowane w Draft #71.
- **02.11 (#76, #77, #79):** przeniesiono konta i panel na VPS oraz uruchomiono edycję świata z rewizjami PostgreSQL.
- **03–04.11:** naprawiono serwerowy zapis/odświeżanie pozycji, panel, NPC, grafikę i HUD; szczegóły w dziennikach.

Nie utożsamiać zakończonej migracji hostingu z pełnym multiplayerem ani ze zweryfikowanym tunelem VPN. Weryfikacja na żywo, backup poza VPS i test fizycznego telefonu nadal są odrębnymi kontrolami.
