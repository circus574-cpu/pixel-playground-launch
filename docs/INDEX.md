# KI Legends — dokumentacja projektu

**Rozwój czterech ras — PR #145, 12.11:** komplet 48 prób / 144 stopni,
48 zastosowań dziedzin w świecie, 12 fragmentów Księgi Zrozumienia, 32 późne
warianty i 48 wypraw. Kod i postęp są podłączone do gry; niezależny odbiór,
fizyczny telefon i balans całej kampanii pozostają otwarte.
[Wyniki i dowody](zmiany/2026-11-12/ZMIANY.md).

Aktualizacja: **12.11.2026**. Punkt odniesienia kodu i głównej gałęzi: `main`. Hosting: VPS Aruba (Coolify); wdrożenie startuje po pushu do `main` i wymaga zielonej bramki (typecheck, testy, lint, zasoby, dokumentacja, build).

**Wydajność:** audyt 11.11.2026 zmierzył, że wąskim gardłem nie jest symulacja (tick z 32 potworami
0,79 ms), lecz **pamięć tekstur 198–240 MiB przy budżecie 192 MiB**, pętla widoczności iterująca
3840 obiektów co klatkę (1,39 ms) i `snapshot()` za 1,10 ms liczony 10×/s. Budżet tekstur nie obejmuje
upieczonych canvasów podłoża. Na telefonie pamięć jest **identyczna** jak na desktopie, choć FPS rośnie
z 9,9 do 29,0 przy mniejszym kadrze. Pomiar: `scripts/perf/audyt-cpu.ts`, `scripts/perf/audyt-swiata.ts`
i `scripts/measure-game.ts` (mobile poprawiony na 844×390, bo portrait blokuje `RotateNotice`).

**Walka:** pomiar na żywym `GameSession` (22 272 walk) wykazał, że wynik starć był rozstrzygnięty zanim
gracz cokolwiek zrobił — mediana `winRate` 1,000 w każdym profilu. Od 07.11.2026 każdy z 40 potworów
nakłada co najmniej jeden efekt statusowy, statystyki bestiariusza idą w górę rampą od poziomu potwora
(1–4 ×1,5/×1,3/×1,15 → 12–18 ×2,2/×2,3/×1,25), a pokonanie gracza kosztuje 10 % postępu do następnego
poziomu. Po zmianach goły autoatak przegrywa większość starć (mediana 0,000), a sprzęt z umiejętnościami
wygrywa 77 % — pojawił się gradient zależny od gracza. `xp` potworów bez zmian; tempo rozwoju spadło
o 41 % i czeka na decyzję właściciela.

**Wyspy Superiora:** sześć własnych zestawów grafik (36 tekstur i 36 dekoracji w 12 arkuszach)
jest zainstalowanych w rejestrze zasobów i podłączonych do runtime; od 06.11.2026 działają
domyślnie. [Źródła i kontrole](zmiany/2026-11-05/ZMIANY.md#grafiki-i-tekstury-sześciu-wysp-superior).

**Stan na 06.11.2026 (szczegóły i dowody w [dzienniku 06.11](zmiany/2026-11-06/ZMIANY.md)):**

- Oprawa kontynentów Verdantia, Pyra, Aetheria i **Nexus-9** jest **scalona i domyślnie włączona**; wyłączenie: `?ki-<świat>-continent=0` ([04.11](zmiany/2026-11-04/ZMIANY.md#nexus--komplet-materiałów-kontynentu)). Domyślnie działają też własne materiały sześciu wysp (`?ki-islands-art=0` wyłącza) i generator dekoracji świata (`?ki-dress=0`) — decyzja właściciela z 06.11.2026: bez flagowania, wszystkie światy działają domyślnie.
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

- [2026-11-12](zmiany/2026-11-12/ZMIANY.md)

- [2026-11-11](zmiany/2026-11-11/ZMIANY.md)
- [2026-11-10](zmiany/2026-11-10/ZMIANY.md)
- [2026-11-07](zmiany/2026-11-07/ZMIANY.md)
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
