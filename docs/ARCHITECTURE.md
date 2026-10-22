# KI Legends — architektura i źródła implementacji

Stan źródeł: **2026-10-22**, `main` `66a615dec1d4259e1bf668956ec1cb09e9aa177e`. Architektura opisuje kod w repo, **nie dowodzi aktualnego wydania na domenie**.

## Stos i granice
- React 19, TanStack Start, TypeScript, Vite i Phaser 4; interfejs desktop/mobilny.
- Logika PvE, ekwipunku, zadań, walki i zapisów: `src/game/session`; renderowanie/sceny: `src/game/mountGame.ts`; modele świata `src/game/world/`; HUD: `src/components/game/GameHud.tsx`.
- Cztery rasy/regiony: Planetarni / Verdantia (`verdant`), Mędrcy / Aetheria (`aether`), Androidy / Nexus-9 (`nexus`), Legendy / Pyra (`pyra`). Stan to **lokalne PvE**; brak zweryfikowanego autorytatywnego serwera MMORPG.
- Zapis postaci i migracje muszą pozostać zgodne z działającymi slotami. `/test` oraz prywatne pliki szkiców wymagają odrębnych osłon i nie mogą być naruszone aktualizacją gry.

## Warstwa grafiki
- `src/game/assets/imported.json` oraz `src/game/assets/catalog.ts`: wersjonowane paczki aktorów/tekstur i mapowanie wiązań `actorBindings`, `renderBindings`; niezależne tekstury/obiekty i kolizje z regionów.
- Planetarni: [PR #9](https://github.com/circus574-cpu/pixel-playground-launch/pull/9) dostarczył produkcyjny rig/atlas 416 klatek, ale **na main aktywacja nadal jest opt-in** przez `?ki-hero-art=1`. [PR #21](https://github.com/circus574-cpu/pixel-playground-launch/pull/21) proponuje domyślną aktywację (nie scalony).
- Mędrcy: atlas 416 klatek aktywny domyślnie dla Aetherii po scaleniu [PR #15](https://github.com/circus574-cpu/pixel-playground-launch/pull/15). Androidy/Legendy nadal mają fallback `human-v2` do dostarczenia docelowych postaci.
- Malowane paczki startowe kontynentów są już aktywne w bieżącym kodzie (`previewOnly: false`). Historyczne `PREVIEW_SWITCHES` nie oznaczają, że wszystkie paczki nadal są wyłącznie testowe.
- Integracja obrazu nie zmienia automatycznie footprintów kolizji, logiki, spawnów ani danych gracza. Zasady: [pipeline GPU](GPU_ASSET_PIPELINE.md), [światy](STAGE3-FOUR-CONTINENTS.md).

## Atlas planety i nawigacja
- Komponenty mapy planety 2D i globusa WebGL 3D obsługują `/mapa` i nakładkę w grze; integracja z HUD jest już w `main` (commit `66a615d`).
- Mapy są interfejsem wyboru/orientacji; **nie** dowodem zrealizowanej podróży między kontynentami ani sieciowego MMO.
- Fallback 2D, sprzątanie kontekstu WebGL, brak naruszania sesji/zapisów podlegają testom. [Dokument mapy](MAPA-GLOBUS-3D.md).

## Bramki jakości
Pełny TypeScript, Vitest, walidacja grafik, lint, build, Playwright, oddzielny Software WebGL i test rzeczywistego telefonu. W PR #21 [pełne QA FAIL (89/95)](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/39776233057), choć [Software WebGL PASS](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/39776233522). Sprzętowego GPU/Android nie zastępuje SwiftShader. Prawa do pierwotnych grafik nadal [nieudowodnione w pełni](ASSET-LICENSE-REGISTER.md).
