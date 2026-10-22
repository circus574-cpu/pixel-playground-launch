# KI Legends — architektura (indeks źródeł)

Stan audytu: 2026-10-21. Gałąź produkcyjna `main` na commicie `b3872c73c9df06e2a793190a6120f0948b021cb0`. Dokument indeksuje istniejące źródła; nie zastępuje szczegółowej dokumentacji.

## Stos
React 19, TanStack Start, TypeScript, Vite, Phaser 4; kod źródłowy w `src/`, sceny Phaser i logika lokalnego PvE w `src/game/`. Interfejs mobilny i desktopowy. Zasady gry: `src/game/session`; renderer/adaptacja: `src/game/mountGame.ts`; światy: `src/game/world/`. Kontrakt: [STAGE3-FOUR-CONTINENTS.md](STAGE3-FOUR-CONTINENTS.md).

## Światy i rasy
Planetarni / Verdantia (`verdant`), Mędrcy / Aetheria (`aether`), Androidy / Nexus-9 (`nexus`), Legendy / Pyra (`pyra`). W `main` działa lokalne PvE i wybór postaci, nie autorytatywny multiplayer. Przełączanie, migracje v1/v3 i bezpieczeństwo lokalnych zapisów opisuje dokument etapu 3. Nie utożsamiać zamierzonego kanonu z wdrożeniem.

## Grafika i globus
Źródła: [GPU_ASSET_PIPELINE.md](GPU_ASSET_PIPELINE.md), [STAGE3-GPU-ASSET-LIST.md](STAGE3-GPU-ASSET-LIST.md), [MAPA-GLOBUS-3D.md](MAPA-GLOBUS-3D.md). Planetarni: PR #9 scalony do main, 416 klatek z podglądem opt-in. Mędrcy i podłączenie globusa z wyborem kontynentu: wdrażane w niezależnym, **nie scalonym** PR #15. Nie traktować tej funkcji jako produkcyjnej.

## Prywatne zasoby
Ścieżka `/test` i magazyn prywatnych szkiców mają odrębne osłony dostępu. Zmian gry nie wolno łączyć z migracją lub usuwaniem danych szkiców. Instrukcje [AGENTS.md](../AGENTS.md), [PRODUCTION.md](PRODUCTION.md).

## Bramy
CI: pełny TypeScript, Vitest, walidacja zasobów, lint, build, Playwright Canvas i WebGL. Testy w CI nie zastępują fizycznego Androida, sprzętowego WebGL, odbioru wizualnego, licencji ani zatwierdzenia przez właściciela.

Odniesienia do otwartych PR opisują propozycje, nie aktualny stan `main`.

## Nowe źródła danych projektowych — 22.10.2026

W [aneksie rozwoju](design/CHARACTER-PROGRESSION-LEVELS-1-20.md) opisano 4 rasy, ich parametry, 3 gałęzie na rasę i po 29 węzłów (116 łącznie), a w [bestiariuszu](design/BESTIARY-LEVELS-1-20.md) 20 typów przeciwników na poziomy 1–20. Struktury danych znajdują się w [JSON drzewek](design/data/character-progression-1-20.json) i [JSON przeciwników](design/data/enemies-1-20.json). **Żaden z tych plików nie został podłączony do `src/game/session.ts`, `src/game/world/races.ts` ani do istniejących regionów**. Aktualną architekturę runtime należy czytać z kodu; wartości aneksu mają status projektu do testów balansu. Obowiązujące ID światów pozostają `verdant/aether/nexus/pyra`.
