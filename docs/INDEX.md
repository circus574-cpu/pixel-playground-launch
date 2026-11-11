# KI Legends — dokumentacja projektu

**Domykanie rozwoju — roboczy checkpoint 42/48 prób:** Androidy mają kontrolery
12 prób, Legendy 6. Trwa implementacja pozostałych sześciu i odbiór całości.
Bez publikacji. [Kolejne partie](zmiany/2026-11-11/ZMIANY.md#domykanie-rozwoju--kolejne-próby).

**Integracja rozwoju 11.11:** połączono Skupienie z Pamięcią na osobnej gałęzi.
Katalog 30/48 prób i 90/144 stopni; Planetarni i Mędrcy po 12/12 prób.
Brak scalenia do main i publikacji. [Stan i kontrole](zmiany/2026-11-11/ZMIANY.md).

**Kontynuacja 06.11 — Pamięć Mędrców:** TA10/TA11/TA12 w trzech stopniach.
Katalog **27/48 prób, 81/144 stopni**; Mędrcy mają 9/12 prób. Wznowiono PR #90
od `a9e44175` i zintegrowano `main@83165f5c` bez zmiany produkcji.
[Zakres i kontrole](zmiany/2026-11-06/ZMIANY.md). Pełny rozwój pozostaje nieukończony.

**Poprzednia partia rozwoju — Bariery Mędrców:** TA04/TA05/TA06 w trzech
stopniach i `ma-barrier` po Barierach II. Katalog **24/48 prób, 72/144 stopni**;
Mędrcy mają 6/12 prób. To połowa katalogu prób, nie połowa całego projektu.
[Zakres i dowody](zmiany/2026-11-04/ZMIANY.md#bariery-mędrców--ta04-ta05-ta06).


**Poprzednia partia rozwoju — Opieka Planetarnych:** TV07/TV08/TV09 i
odblokowanie `mv-root` po Opiece II. Katalog **21/48 prób, 63/144 stopni**;
Planetarni mają komplet 12 prób, ale pełny rozwój nadal nie jest ukończony.
[Zakres i kontrole](zmiany/2026-11-04/ZMIANY.md#opieka--tv07-tv08-tv09).

**Poprzednia partia rozwoju — Szlaki Planetarnych:** TV01/TV02/TV03, ranga Szlaków
i odblokowanie `mv-trail`; katalog 18/48 prób, 54/144 stopni. Pełny rozwój pozostaje
nieukończony. [Zakres i kontrole](zmiany/2026-11-03/ZMIANY.md#szlaki--tv01-tv02-tv03).

**Poprzednia partia rozwoju — PR #90:** dodano trzy próby Żywej Ziemi Planetarnych i ich
odblokowanie mistrzostwa. Katalog: 15/48 prób, 45/144 stopni; pełna kampania nadal
nieukończona. [Bieżąca partia i dowody](zmiany/2026-11-03/ZMIANY.md#żywa-ziemia--tv04-tv05-tv06).


**Kolejna partia PR #90:** 12 prób rasowych / 36 stopni, wyniki serwerowe, rangi i pierwsze odblokowania mistrzostwa. [Bieżący zakres i wyniki](zmiany/2026-11-03/ZMIANY.md#próby-rasowe--pierwsze-12-kontrolerów-i-36-stopni). Pełny system nadal wymaga dalszych prac.

**Kontynuacja na gałęzi PR #90:** naprawiono bonusy wyposażenia, dodano kontrolery
eskort bojowych/ochrony i kronikę odkrywanej historii. Cały rozwój nadal nie jest
ukończony; [zakres i dowody](zmiany/2026-11-03/ZMIANY.md#domykanie-rozwoju--partia-2-eskorty-obrona-i-kronika).

Gałąź PR #90 uwzględnia także [nowszy `main@e02c87b5`](zmiany/2026-11-03/ZMIANY.md#integracja-nowszego-main-z-gałęzią-domykania-rozwoju); cudze grafiki i poprawka ramek zostały zachowane.

**Audyt rozwoju 03.11.2026:** pełne zlecenie czterech ras pozostaje nieukończone.
Potwierdzone braki, blokady i błędy wyposażenia oraz aktualne wyniki testów są w
[raporcie z 03.11](zmiany/2026-11-03/ZMIANY.md#audyt-kompletności-rozwoju-postaci--03112026).
**Aetheria — próbna oprawa na osobnej gałęzi:** [lokalny zrzut i instrukcja](zmiany/2026-11-03/ZMIANY.md#aetheria--oprawa-z-materiałów-właściciela).


Aktualizacja: **05.11.2026, po PR #121 (`main@555da1ea`, wdrożone na produkcję)**. Punkt odniesienia kodu i głównej gałęzi: `main`. Hosting: VPS Aruba (Coolify); wdrożenie startuje po pushu do `main` i wymaga zielonej bramki (typecheck, testy, lint, zasoby, dokumentacja, build).

**Stan na 05.11.2026 (szczegóły i dowody w [dzienniku 05.11](zmiany/2026-11-05/ZMIANY.md)):**

- Oprawa kontynentów Verdantia, Pyra i Aetheria jest **scalona (PR #118) i domyślnie włączona**; wyłączenie: `?preview=ki-<świat>-continent=0`. Nexus-9 ma zaimplementowaną integrację kontynentu (05.11.2026), ale **wyłącznie opt-in** przez `?ki-nexus-continent=1` — nie włączono domyślnie przed odbiorem właściciela ([04.11](zmiany/2026-11-04/ZMIANY.md#nexus--komplet-materiałów-kontynentu)).
- Wielkości potworów z pomiaru ciała (PR #117), mapa 2D/globus (PR #119) i chód po transformacji `kiwalk` dla czterech ras, paczki bohaterów `2.1.0` (PR #120) są na `main`.
- Malowane wnętrza budynków specjalnych (4 światy × 6 budynków, pokoje 1920×1280) są scalone (PR #121) i opublikowane.
- Serwerowy zapis i rozgrywka PvE (PR #69), panel postaci w `/admin` i miejski depozyt są scalone i opublikowane (01.11). Backend produkcyjny nadal działa na dotychczasowym Supabase; cutover na własny PostgreSQL czeka na odbiór właściciela.

Bieżący stan, pozostałe zadania i źródła wyników: [plan](PLAN-I-ZADANIA.md#bieżący-checkpoint--05112026). Architektura serwerowego PvE i warunki cutoveru: [Architektura](ARCHITEKTURA-I-TESTY.md#kandydat-serwerowej-rozgrywki-pve--trzecia-partia-0111-pr-69).

Materiały graficzne kontynentów (zakres, źródła, zrzuty): [Nexus](zmiany/2026-11-04/ZMIANY.md#nexus--komplet-materiałów-kontynentu), [Nexus w grze](zmiany/2026-11-05/ZMIANY.md), [Aetheria](zmiany/2026-11-04/ZMIANY.md#aetheria--nowa-oprawa-kontynentu), [Pyra](zmiany/2026-11-04/ZMIANY.md#pyra--nowa-oprawa-kontynentu), [Verdantia](zmiany/2026-11-04/ZMIANY.md#verdantia--oprawa-kontynentu-na-osobnej-gałęzi).

Ten katalog ma **dokładnie 10 aktualnych dokumentów Markdown**, razem z tym indeksem.

| Dokument                                        | Co w nim znaleźć                                                           |
| ----------------------------------------------- | -------------------------------------------------------------------------- |
| [Zasady](ZASADY.md)                             | Kanon, uprawnienia, produkcja, ochrona zapisów i prywatnego `/test`.       |
| [Rasy i postacie](RASY-I-POSTACIE.md)           | Cztery tożsamości, wygląd, animacje, skala i znane wady.                   |
| [Rozwój i walka](ROZWOJ-I-WALKA.md)             | Statystyki, drzewka, awanse, ekonomia, zapis i bestiariusz.                |
| [Świat i miasta](SWIAT-I-MIASTA.md)             | Kontynenty, globus, geometria, cztery miasta, budynki, NPC i usługi.       |
| [GPU i zasoby](GPU-I-ZASOBY.md)                 | Produkcja grafik, kontrakt paczek, import, kolejka i odtwarzanie narzędzi. |
| [Architektura i testy](ARCHITEKTURA-I-TESTY.md) | Kod, moduły, polecenia, QA, wydajność i diagnoza usterek.                  |
| [Fabuła i ekwipunek](FABULA-I-EKWIPUNEK.md)     | Pełny projekt przygody: 98 zadań, 177 przedmiotów, 94 receptury.           |
| [Licencje](LICENCJE.md)                         | Grafiki, modele, zależności, notices, dowody i nierozstrzygnięte prawa.    |
| [Plan i zadania](PLAN-I-ZADANIA.md)             | Aktualny stan, otwarte prace i warunki odbioru.                            |

## Historia — jeden dziennik na dzień

- [2026-11-11](zmiany/2026-11-11/ZMIANY.md)
- [2026-11-06](zmiany/2026-11-06/ZMIANY.md)
- [2026-11-05](zmiany/2026-11-05/ZMIANY.md)
- [2026-11-04](zmiany/2026-11-04/ZMIANY.md)
- [2026-11-03](zmiany/2026-11-03/ZMIANY.md)
- [2026-11-02](zmiany/2026-11-02/ZMIANY.md)
- [2026-11-01](zmiany/2026-11-01/ZMIANY.md)
- [2026-10-31](zmiany/2026-10-31/ZMIANY.md)
- [2026-10-29](zmiany/2026-10-29/ZMIANY.md)
- [2026-10-28](zmiany/2026-10-28/ZMIANY.md)
- [2026-10-27](zmiany/2026-10-27/ZMIANY.md)
- [2026-10-26](zmiany/2026-10-26/ZMIANY.md)
- [2026-10-24](zmiany/2026-10-24/ZMIANY.md)
- [2026-10-23](zmiany/2026-10-23/ZMIANY.md)
- [2026-10-22](zmiany/2026-10-22/ZMIANY.md)
- [2026-10-21](zmiany/2026-10-21/ZMIANY.md)
- [2026-10-20](zmiany/2026-10-20/ZMIANY.md)
- [2026-10-19](zmiany/2026-10-19/ZMIANY.md)

Każdego dnia dopisujemy zmiany do `docs/zmiany/RRRR-MM-DD/ZMIANY.md`:
co zmieniono, commit/PR, faktyczny wynik kontroli i co pozostało otwarte.
Zrzuty, raporty JSON i logi tego dnia leżą w jego podfolderze `qa/`.
Nie tworzymy kolejnych plików `STATUS`, `HANDOFF`, `QA-...` ani osobnych opisów każdej dostawy.
Zasady aktualne poprawiamy w odpowiednim z dziesięciu dokumentów.
Pełna wcześniejsza treść i autorstwo pozostają w historii Git na bazie `927146f4e5d8`;
[mapa segregacji](zmiany/2026-10-23/segregacja.json) wskazuje nowe miejsce każdego usuniętego opisu.

## Materiały źródłowe — nie kolejne instrukcje

`design/` zawiera niezmienione oryginały PDF, dane JSON, obrazy tożsamości i narzędzia księgi.
`licenses/` zawiera komplet indywidualnych rejestrów JSON/CSV oraz legal texts.
Nie kopiujemy ich w całości do wielu plików opisowych i nie usuwamy dowodów pochodzenia.

- [Księga przygody PDF — 89 stron](../KI-LEGENDS-KSIEGA-PRZYGODY-v1.0.pdf).
- [Oryginalny PDF właściciela](design/Ki_Legends_Dokument_Projektowy_Rasy_i_Etapy_Produkcji.pdf).
  SHA-256: `be58d9df4fb49d19b11a66d47a1a3fc3fbbf5acc9c11ddc5cf76213f6be15734`.
  Kopia binarna w `design/original-pdf-parts/`; odtworzenie:
  `python3 docs/design/original-pdf-parts/restore.py`.
- [Oryginalny aneks statystyk i drzewek](design/source-annexes/Ki_Legends_Aneks_Rasy_i_Drzewka_Umiejetnosci.pdf): odzyskany z gałęzi PR20 podczas audytu29.10, 103455bajtów, SHA-256 `0358053e7e467bffd41055f50f765d0f33cbf15c6b0176266c866d493dda5cff`, zgodny z metadanymi kanonicznego JSON. Nie mylić z oryginalnym PDF12-stronicowym. Nie przywrócono starego bestiariusza20 — obowiązuje HTML40 potworów.
- [Dane aneksu](design/data/character-progression-1-20.json),
  [bestiariusz właściciela](design/BESTIARY-OWNER-2026-10-22.html),
  [pomocnicza transkrypcja oryginału](design/source-transcript.txt).

Wyraźne decyzje właściciela mają pierwszeństwo. Koncepcja, kod, zaliczony test,
scalenie i publikacja to różne stany. Nie wpisujemy PASS bez wyniku na podanym SHA.

- [Zlecenie właściciela — rozwój i dziedzictwa czterech ras, 28.10.2026](design/racial-development-owner-2026-10-28.txt).
  Niezmienione źródło wymagań, SHA-256 `03ea87f725815adab2d74cba84da87a52adfc5cd650600c6a3202f68742359ed`.
  Obecność źródła nie stanowi potwierdzenia pełnego wdrożenia; realizację rozróżnia
  [aktualny plan](PLAN-I-ZADANIA.md#nowe-zlecenie-rozwoju-czterech-ras--28102026-w-realizacji).

## Katalog przedmiotów KI Legends V2 (projekt 29.10.2026, wdrożenie do `src/game/items` 31.10.2026)

- [Katalog 366 przedmiotów, 140 receptur i pasywnych buffów artefaktów](katalog-przedmiotow-v2/README.md) — źródłowe pliki JSON, CSV, PDF, 15 plansz JPG i zasady balansu. Dane katalogowe, receptury i kalkulator pasywnych zestawów (`computePassiveEquipmentBonuses`) wdrożono do `src/game/items/*` (zob. [dziennik 31.10](zmiany/2026-10-31/ZMIANY.md)).
