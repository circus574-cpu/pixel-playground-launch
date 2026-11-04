# KI Legends

Anime/manga action RPG 2D w przeglądarce, na komputerze i telefonie. Repozytorium: `circus574-cpu/pixel-playground-launch`; domena gry: `kilegends.pl`.

**Stan 2026-11-04:** hosting produkcyjny jest na **VPS Aruba / Coolify**, prywatna baza **PostgreSQL**, serwerowe konta i postacie, sesje PvE realizowane przez serwer Node.js/WebSocket (`/ws/online`), bez lokalnego fallbacku. To nie jest jeszcze kompletne MMO/PvP. Stary Supabase nie jest już podstawowym źródłem kont i postaci gry online; pozostał kod kompatybilności/migracji i prywatnego `/test`. Stan żywej produkcji trzeba sprawdzać niezależnie od kodu.

- [Instrukcje dla agentów](AGENTS.md)
- [Dokumentacja — indeks](docs/INDEX.md)
- [Architektura, VPS/PostgreSQL i testy](docs/ARCHITEKTURA-I-TESTY.md)
- [Aktualny plan](docs/PLAN-I-ZADANIA.md)
- [Zmiany z 4 listopada](docs/zmiany/2026-11-04/ZMIANY.md)
- [Księga przygody (materiał projektowy)](KI-LEGENDS-KSIEGA-PRZYGODY-v1.0.pdf)

## Praca lokalna

Wymagane: Node.js 22 i npm. Zależności: `npm ci`. Aplikacja: `npm run dev`. Kod serwera gry: `src/server/gameServer.ts`. Lokalna próba online wymaga **oddzielnej testowej** bazy PostgreSQL i odpowiedniej konfiguracji; nie podłączaj produkcyjnego `DATABASE_URL` do testów.

Kontrole: `npm run typecheck`, `npm run test`, `npm run lint`, `npm run assets:check`, `python3 scripts/docs/check_documentation.py`, `npm run build`. Po stronie produkcyjnej istnieje workflow `.github/workflows/aruba-production.yml`; zmian dokumentacyjnych **nie należy używać do restartu usługi**.
