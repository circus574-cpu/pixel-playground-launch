# KI Legends

Dokumentacja projektu: [indeks 10 tematów](docs/INDEX.md).
Historia prac: [dziennik 05.11.2026](docs/zmiany/2026-11-05/ZMIANY.md), pozostałe dni w [indeksie](docs/INDEX.md#historia--jeden-dziennik-na-dzień).
Projekt fabuły: [Księga przygody PDF](KI-LEGENDS-KSIEGA-PRZYGODY-v1.0.pdf).

## Development

Praca lokalna wymaga Node.js (wersja 20+) oraz npm.

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

### Skrypty weryfikacyjne

- `npm run typecheck` — pełna weryfikacja typów TypeScript (główna aplikacja, testy E2E, narzędzia)
- `npm run test` — testy jednostkowe i integracyjne (Vitest)
