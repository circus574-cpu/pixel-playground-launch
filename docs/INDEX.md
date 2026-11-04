# KI Legends — dokumentacja projektu

**Bieżący punkt odniesienia: `main@1690fb6e` (04.11.2026, po PR #101).** Hosting produkcyjny został przeniesiony na VPS Aruba/Coolify. Prywatny PostgreSQL 17 jest już wykorzystywany przez grę, konta i zapis postaci; istnieje jeden serwer `Superior` (domyślnie port 7420, 20 Hz, limit konfiguracyjny 50 graczy). Kod serwerowego PvE i autoryzacji jest scalony: #69, #76–77, #79. Nie opisywać tej infrastruktury jako dopiero planowanej. Nie deklarować działającego tunelu VPN: w PR #60 potwierdzono sieć Docker, nie VPN.

**Granica funkcjonalności:** klient Phaser korzysta z `/ws/online`; sesje PvE i stan postaci należą do serwera, a PostgreSQL przechowuje trwałe dane. Są sesje i obecność innych graczy, ale to nie jest pełne MMO (brak zatwierdzonej wspólnej symulacji potworów, PvP, drużyn, testu obciążenia 50). Dawne opisy lokalnego PvE/Supabase jako bieżącego backendu są historyczne.

**Ostatnie zmiany na `main`:** #99 — malowane miasta domyślnie, naprawy mechanik NPC/dropów/spawnów i etykiety; #100 — kontrast postaci, poprawiony HUD telefonu; #101 — skala HUD i okien 50–120%. **Otwarte, niescalone:** #90, #87, #80, #102, #71, #66. Nie przepisuj ich zakresu jako wdrożonego.

Przy analizie czytaj kolejno: [AGENTS.md](../AGENTS.md), [zasady](ZASADY.md), [architektura](ARCHITEKTURA-I-TESTY.md), [plan](PLAN-I-ZADANIA.md), [dziennik 04.11](zmiany/2026-11-04/ZMIANY.md). Weryfikacja CI z opisów PR dotyczy wskazanego SHA; ten audyt dokumentacji nie jest nowym testem produkcyjnym.

Ten katalog ma **dokładnie 10 aktualnych dokumentów Markdown**, razem z tym indeksem.

| Dokument                                        | Co w nim znaleźć                                                           |
| ----------------------------------------------- | -------------------------------------------------------------------------- |
| [Zasady](ZASADY.md)                             | Kanon, uprawnienia, produkcja, ochrona zapisów i prywatnego `/test`.       |
| [Rasy i postacie](RASY-I-POSTACIE.md)           | Cztery tożsamości, wygląd, animacje, skala i znane wady.                   |
| [Rozwój i walka](ROZWOJ-I-WALKA.md)             | Statystyki, drzewka, awanse, ekonomia, zapis i bestiariusz.                |
| [Świat i miasta](SWIAT-I-MIASTA.md)             | Kontynenty, globus, geometria, cztery miasta, budynki, NPC i usługi.       |
| [GPU i zasoby](GPU-I-ZASOBY.md)                 | Produkcja grafik, kontrakt paczek, import, kolejka i odtwarzanie narzędzi. |
| [Architektura i testy](ARCHITEKTURA-I-TESTY.md) | Kod, moduły, polecenia, QA, wydajność i diagnoza usterek.                  |
| [Fabuła i ekwipunek](FABULA-I-EKWIPUNEK.md)     | Projekt fabuły i wyposażenia (liczby projektowe historyczne); aktywny katalog V2: 366 przedmiotów, 140 receptur.           |
| [Licencje](LICENCJE.md)                         | Grafiki, modele, zależności, notices, dowody i nierozstrzygnięte prawa.    |
| [Plan i zadania](PLAN-I-ZADANIA.md)             | Aktualny stan, otwarte prace i warunki odbioru.                            |

## Historia — jeden dziennik na dzień

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
