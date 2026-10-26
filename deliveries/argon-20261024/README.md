# Argon (Google AI Studio) — łatka z 24.10.2026

`quests-v2-src-only.patch` to eksport z aplikacji AI Studio (commity 969504a, 0350ad4 po jej stronie).
Zachowana jako źródło, **nienałożona**: zmienia komponenty aplikacji AI Studio (App, HeroExplorer,
CombatSandbox, Navigation, `src/data/heroes.ts`), których nie ma w tym repo.

Wartościowe do przeniesienia później:

- `src/game/heroes/spriteAnimator.ts` — czyszczenie tła sprite'ów na canvas (flood-fill od krawędzi,
  usuwanie szarych obwódek, kotwica stóp 0.5/0.91) oraz animacja 8 kierunków × 6 stanów przez
  przesunięcia, obroty i ściskanie jednego obrazu (nie osobne rysowane klatki),
- `src/game/heroes/raceMetadata.ts` — profile i motywy ras zapisywane w localStorage,
- `src/components/CharacterRaceEditor.tsx` — edytor kalibracji w aplikacji AI Studio.

Oczyszczone obrazy postaci są w osobnej łatce `heroes-and-editor-v2.patch` (11 MB), nie tutaj.
