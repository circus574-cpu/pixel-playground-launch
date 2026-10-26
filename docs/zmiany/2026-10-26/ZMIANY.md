# Zmiany — 26.10.2026

## Integracja Argona i mobilnego sterowania

Gałąź `feature/argon-combat-mobile-integration`, baza main `062b57b7`.
PR #29 był już scalony przed utworzeniem gałęzi.
Szczegółowy audyt źródeł, tabela funkcji i wykluczenia:
[rozwój i walka](../../ROZWOJ-I-WALKA.md#integracja-sterowania-argona--26102026).

- Naprawiono reset joysticka po akcji HUD i anulowanie dotyku mapy.
- Dodano przyciski reagujące na pointerdown, widoczny koszt KI i miniopis zadania v2.
- Zabezpieczono oryginalny ZIP z manifestem sum.
- Kontrole robocze: typecheck, Vitest 391/391, lint 0 błędów / 9 wcześniejszych
  ostrzeżeń, build. Pierwszy przebieg pięciu nowych scenariuszy Canvas: 5/5.
- Pełna regresja i Software WebGL w toku; nie jest to jeszcze wynik końcowego SHA.
- Brak testu fizycznego telefonu. Nie scalono, nie opublikowano; bez zmian GPU i /test.
