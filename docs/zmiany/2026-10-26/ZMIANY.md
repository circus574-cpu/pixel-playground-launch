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

Commit implementacji: `72eab7bcf9a6aa200f7591f404ce4f8d987173f0`.
[PR #36 do audytu](https://github.com/circus574-cpu/pixel-playground-launch/pull/36).
[Manifest weryfikacji](qa/argon-combat/verification.json) oraz logi lokalnych kontroli
i cztery zrzuty `argon-320.png`, `argon-360.png`, `argon-390.png`, `argon-852.png`
są w folderze QA. Końcowe przebiegi pełnej regresji odczytywać w checks PR,
z SHA zapisanym przez workflow w `qa-tested-sha.txt`. W chwili zapisu tej notatki
pełny przebieg jeszcze trwał — nie jest tu deklarowany jako PASS.

Kontrola dokumentacji wykryła zastany jedenasty plik QUESTS-V2.md. Zachowano
jego treść bajtowo w QA jako historyczny tekst, a aktualny stan przeniesiono do
ROZWOJ-I-WALKA.md. Kontrola 10 tematów, odnośników i chronionych źródeł: PASS.
