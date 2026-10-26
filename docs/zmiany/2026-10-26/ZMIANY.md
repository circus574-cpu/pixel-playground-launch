# Zmiany — 26.10.2026

## feat/combat — wyłącznie mechanika walki

Baza main: `3ffddcd82249f5cb5923b0deb594bf1621721ffa`.
Szczegóły, otwarte decyzje i rejestr 116 węzłów:
[rozwój i walka](../../ROZWOJ-I-WALKA.md#audyt-mechaniki-walki--featcombat-26102026).

Dodano kontrakty węzłów, deterministyczne testy 40 AI, adapter ośmiu bossów
w osobnej próbie debugowej, budżety AI/stref/efektów i macierze symulacji.
Naprawiono rozbieżności KI/cooldownów, C6/B2 Mędrca, Żaru, shutdownu
i bezpieczeństwa ukrytych przeciwników.

Kontrole drzewa implementacji `5660af9e`: 741/741 testów jednostkowych PASS, typecheck, lint (0 błędów,
9 istniejących ostrzeżeń) i build PASS. Canvas 12/12: cztery podglądy bossów,
cztery próby umiejętności w PvE i cztery pełne cykle walki/mikstury/śmierci/odrodzenia.
Software WebGL: 12/12 PASS w tych samych scenariuszach. Końcowa próba bossów
z docelowym loadoutem: dodatkowo 4/4 Canvas i 4/4 Software WebGL PASS.
Zero błędów konsoli. Fizyczny Android/iOS niezweryfikowane.
Wyniki dotyczą SHA implementacji; następny commit zapisuje wyłącznie ten raport
i dowody, bez zmian kodu. Pełne CI na SHA PR pozostaje osobnym wynikiem.

Zachowano wszystkie stare asercje. W teście 40 potworów po sztucznej pętli
przeżycia ustawiono gracza ponownie przy przeciwniku: mógł wcześniej odrodzić
się w bezpiecznym mieście, skąd nie wolno testować zadawania obrażeń.

Brak zmian map, generatorów świata, chronionych komponentów HUD v2, questów,
assetów binarnych, GPU i prywatnego /test. Nie scalono ani nie opublikowano.

Kontrola dokumentacji ma zastaną blokadę na bazie: 11 plików tematycznych
(z dodatkowym QUESTS-V2.md), gdy skrypt wymaga 10.
[Dowód stanu bazy](qa/combat/documentation-baseline.json). Nie przenoszono
cudzej dokumentacji questów ani nie osłabiano walidatora w gałęzi walki.

Kod zapisano w commitach `c304fcf9` i `5660af9e`.
[Manifest weryfikacji](qa/combat/verification.json) oraz [sumy plików i zakres](qa/combat/scope.json)
wiążą wyniki z drzewem implementacji. [Log WebGL](qa/combat/software-webgl.txt)
i [końcowy podgląd bossów](qa/combat/boss-loadout-canvas-webgl.txt) zapisują wyniki
z działającej gry. Linki do PR i Actions znajdują się w opisie PR.

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
