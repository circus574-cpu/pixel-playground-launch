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
