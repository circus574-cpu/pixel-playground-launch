# KI Legends

**Stan kodu na 04.11.2026:** gra ma serwer Node na VPS Aruba/Coolify, prywatną bazę PostgreSQL 17, konta i role na VPS oraz serwerową rozgrywkę PvE z zapisem postaci. Nie jest to ukończone MMORPG. Nie mylić serwera **VPS** z osobnym tunelem **VPN** — jego konfiguracja nie została potwierdzona.

- [Dokumentacja — indeks i bieżący stan](docs/INDEX.md)
- [Instrukcje obowiązujące wszystkich agentów](AGENTS.md)
- [Architektura serwera i weryfikacja](docs/ARCHITEKTURA-I-TESTY.md)
- [Plan i nierozstrzygnięte zadania](docs/PLAN-I-ZADANIA.md)
- [Zmiany 04.11.2026](docs/zmiany/2026-11-04/ZMIANY.md)
- [Historia przygotowań Aruba (nie bieżąca instrukcja migracji)](ARUBA_STAGING.md)

## Rozwój lokalny

Node.js 22+, npm i poprawne prywatne zmienne środowiskowe odpowiednie do testowanego scenariusza.

```sh
npm ci
npm run dev
```

## Kontrole przed PR

```sh
npm run typecheck
npm run lint
npm run test
npm run build
npm run assets:check
python3 scripts/docs/check_documentation.py
```

Testy wymagające rzeczywistej bazy PostgreSQL i scenariusze live VPS uruchamiaj tylko z dedykowanymi danymi testowymi. Push do `main` może wywołać workflow produkcyjny; nie wykonuj go bez zgody właściciela.
