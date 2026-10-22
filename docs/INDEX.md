# KI Legends — indeks dokumentacji i hierarchia źródeł

Stan indeksu na **2026-10-22**, `main` `66a615dec1d4259e1bf668956ec1cb09e9aa177e`. Czytaj pliki na tym samym SHA co audytowany kod. **Dokument w otwartym PR nie jest stanem main.**

## Obowiązujący odczyt stanu
- [STATUS — aktualny HEAD, scalenia, funkcje, dowody CI i ryzyka](STATUS.md)
- [TASKS — otwarte usterki i kryteria zakończenia](TASKS.md)
- [ARCHITECTURE — architektura implementacji](ARCHITECTURE.md)
- [ROADMAP — plan i bramy publikacji](ROADMAP.md)
- [DECISIONS — decyzje właściciela i dowody](DECISIONS.md)
- [CHANGELOG — potwierdzona historia zmian](CHANGELOG.md)
- [AGENTS — zasady dla agentów](../AGENTS.md)
- [Zgoda właściciela 22.10 na ówczesne scalenie/publikację; nie certyfikat testów](qa/PUBLISH-AUTHORIZATION-2026-10-22.md)

## Kanon, grafika, produkcja i prawo
- [Oryginalny 12-stronicowy PDF — archiwum bezstratne w 12 częściach, obecne na main po PR #16](design/original-pdf-parts/README.md); `restore.py` odtwarza SHA-256 `be58d9df4fb49d19b11a66d47a1a3fc3fbbf5acc9c11ddc5cf76213f6be15734`. Nie oznacza to, że niezależnie uruchomiono rekonstrukcję po każdym nowym klonowaniu.
- [Tekstowy indeks kanonu z oryginalnego PDF](design/RASY_I_ETAPY.md) i [pomocnicza transkrypcja](design/SOURCE-PDF-ARCHIVE.md). Tekst nie zastępuje ilustracji.
- [Aneksy właściciela — PR #20 OPEN, jeszcze poza main](https://github.com/circus574-cpu/pixel-playground-launch/pull/20): drzewka ras, bestiariusz, statystyki i balans.
- [Rejestr licencji grafik i modeli](ASSET-LICENSE-REGISTER.md) oraz [licencje zależności](DEPENDENCY-LICENSE-REGISTER.md). **Nie wszystkie prawa do obrazów są potwierdzone.**
- [Kontrakt produkcyjny z historycznymi etapami](PRODUCTION.md); późniejsze decyzje właściciela w [DECISIONS](DECISIONS.md) i [STATUS](STATUS.md) mają pierwszeństwo nad starszymi etapami.
- [Kontrakt importu GPU](GPU_ASSET_PIPELINE.md), [lista zasobów](STAGE3-GPU-ASSET-LIST.md), [kolejka produkcji GPU](GPU-PRODUCTION-SEQUENCE.md).
- [Cztery kontynenty](STAGE3-FOUR-CONTINENTS.md), [etap lokalnego PvE](STAGE2-GAMEPLAY.md), [testy przełączania ras](TESTING-RACE-SWITCH.md).
- [Globus /mapa i integracja z HUD](MAPA-GLOBUS-3D.md); [Aetheria — aktualizacje grafiki](AETHER-ANIME-START.md); [Nexus/Pyra](NEXUS-PYRA-ANIME-START.md); [Verdantia](VERDANT-ANIME-START.md).

## Historia PR i kontrola wykonania
- PR [#9](https://github.com/circus574-cpu/pixel-playground-launch/pull/9), [#15](https://github.com/circus574-cpu/pixel-playground-launch/pull/15), [#16](https://github.com/circus574-cpu/pixel-playground-launch/pull/16), [#17](https://github.com/circus574-cpu/pixel-playground-launch/pull/17) są **MERGED**. Zapis `PR #15 Draft` w historycznym raporcie QA nie odzwierciedla obecnego stanu.
- [PR #21](https://github.com/circus574-cpu/pixel-playground-launch/pull/21) jest **OPEN**: WebGL PASS, pełny QA 89 PASS/6 FAIL.
- [Pełne CI PR #21](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/39776233057) i [Software WebGL](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/39776233522) to dwa różne przebiegi na tym samym HEAD.
- Obecność funkcji w repo lub deklaracja w PR nie potwierdzają aktualnej wersji produkcyjnej; wymagany odczyt SHA z systemu deploy i test publicznej domeny.

## Niezmienne zasady
Decyzje właściciela i kanon mają pierwszeństwo; nie nadpisywać historii. Instancją GPU steruje właściciel. **Nie używać kredytów Lovable**. Bez oddzielnego zatwierdzenia nie wykonywać merge, nie publikować i nie zmieniać konfiguracji produkcji. Nie uznawać zielonych testów jednego commita za dowody dla innego.
