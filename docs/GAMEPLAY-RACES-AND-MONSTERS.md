# Ki Legends — rasy, drzewka umiejętności i potwory w rozgrywce (22.10.2026)

**Status: ZAIMPLEMENTOWANE W KODZIE I PRZETESTOWANE JEDNOSTKOWO (jsdom/vitest). NIEZWERYFIKOWANE na fizycznym telefonie i nieocenione wizualnie przez właściciela. Nie scalone z `main`, nie opublikowane.**

Źródła obowiązujące: aneks właściciela [Statystyki ras i drzewka umiejętności](design/CHARACTER-PROGRESSION-LEVELS-1-20.md) (dane: `design/data/character-progression-1-20.json`) oraz bestiariusz właściciela [BESTIARY-OWNER-2026-10-22.html](design/BESTIARY-OWNER-2026-10-22.html) (40 potworów; opis: [ENEMIES-KI-LEGENDS.md](ENEMIES-KI-LEGENDS.md)). Aneks jest oznaczony przez właściciela jako koncepcja do testów i balansu.

## 1. Architektura

| Element                                                                                     | Plik                                                                                 |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Statystyki ras i 4×29 węzłów (wygenerowane z JSON aneksu)                                   | `src/game/kit/nodes.generated.ts` (`scripts/gen-kit-nodes.py`)                       |
| Wspólny rdzeń: statystyki, cooldowny, Ki, bufy, tarcze/odbicia, kanałowanie, timery, krytyk | `src/game/kit/base.ts`                                                               |
| Kity ras: zdolności i pasywki każdego węzła                                                 | `kit/planetary.ts`, `sage.ts`, `android.ts`, `legend.ts`                             |
| Punkty, wymagania, wykluczenia, walidacja zapisu                                            | `kit/progression.ts`                                                                 |
| Szybkość na poziom (decyzja właściciela)                                                    | `kit/balance.ts`                                                                     |
| Dane 40 potworów (liczby z bestiariusza) / zachowania                                       | `monsters/base.generated.ts` (`scripts/gen-monster-base.py`) / `monsters/catalog.ts` |
| Silnik AI potworów, strefy, śmierć, łup                                                     | `monsters/system.ts`                                                                 |
| Statusy nałożone na gracza                                                                  | `monsters/fx.ts`                                                                     |
| Materiały z łupów                                                                           | `monsters/materials.ts`                                                              |
| Sesja gry łącząca wszystko, zapis v4                                                        | `src/game/session.ts`                                                                |
| Teren dla Adaptacji                                                                         | `world/terrain.ts`                                                                   |
| Interfejs: pasek umiejętności, drzewko, zasoby, statusy                                     | `components/game/GameHud.tsx`, `AdventurePanels.tsx`                                 |

## 2. Reguły liczbowe

- **Statystyki:** wartość = baza + przyrost × (poziom − 1), zaokrąglenie do najbliższej, połówki w górę (aneks). Odtworzone dla poz. 10 i 20 w `kit.test.ts`.
- **Obrażenia (aneks, „model do testów”):** `max(1, Atak × mnożnik − Obrona / 2)`, **bez zaokrąglania pojedynczego trafienia** (inaczej tabela pojedynków kontrolnych z aneksu się nie zgadza). Test odtwarza wszystkie liczby tej tabeli dla 4 ras na poz. 1, 10, 20.
- **Szybkość ruchu (decyzja właściciela 22.10.2026, zmiana względem aneksu):** baza × (1 + 0,05 × (min(poziom, 20) − 1)). Planetarni 185 → 268 (poz. 10) → 361 j./s (poz. 20). Odstęp ataków nie rośnie.
- **Punkty umiejętności:** 1 na poziom w zakresie 1–20; każdy węzeł, także korzeń (zdolność startowa), kosztuje 1 punkt; 3 pary wykluczające; Tryb KI od poz. 20 i dowolnej zdolności ostatecznej.
- **Reset drzewka:** pierwszy darmowy do poz. 10 (aneks); kolejne **50 × poziom monet (założenie)**.

## 3. Założenia, których aneks nie rozstrzyga (do zatwierdzenia)

1. Krytyk zadaje ×1,5.
2. Mikstura leczy 40% maks. życia (stałe 65 HP ze Stage 2 nie skaluje się z nowym życiem).
3. Regeneracja życia poza walką: 0,3% maks./s (Leśna Cierpliwość dodaje 1%/s).
4. Złoty Krąg: krąg zadaje 0,4 ATK/s przez 3 s; Ognisty Kataklizm podpala na łącznie 50% ATK przez 5 s.
5. Strumień Ki jest kanałem, który nie przerywa się ruchem ani trafieniem; Skupienie KI i Medytacja Bojowa przerywa ruch i trafienie (chyba że Skupienie Mistrza dla Skupienia KI).
6. Salwa Precyzyjna i Protokół Egzekucji wymagają oznaczonego celu.
7. Pasywki warunkowe „po uniku/zabiciu” działają na jedno trafienie lub czas podany w aneksie.
8. Dzień trwa 8 min gry (ostatnie 3 min to noc) — potrzebne puchaczowi; gra nie ma jeszcze zegara świata.
9. Materiały z łupów: do 30 rodzajów, stos do 99, cena sprzedaży `2 + 1,5 × poziom potwora`.

## 4. Czego ten etap NIE zawiera

- **Spawnów potworów w regionach:** właściciel zlecił je po ukończeniu kontynentów. Mechanizm istnieje (`monsters` w definicji regionu albo `session.monsters.spawn(...)`), lista jest pusta. W grze nadal występują tylko dziki.
- **Bossów (8):** nie ma ich w bestiariuszu HTML; do zaprojektowania. Jedyną kanoniczną listą przeciwników jest bestiariusz HTML (40); lista 20 przeciwników z aneksu została usunięta decyzją właściciela (23.10.2026).
- **Grafik potworów w grze:** paczki są w `deliveries/`, niezainstalowane; do czasu instalacji potwory używają grafiki dzika.
- **Aur Trybu KI, grafiki zdolności:** efekty są proceduralne (okręgi, pociski, napisy).
- **Nazwy krain:** obowiązują nazwy z gry (Verdantia, Aetheria, Nexus-9, Pyra) — decyzja właściciela 23.10.2026; nazwy z aneksu usunięto.
- Wartości, których gracz nie ma jak zadać: słabości na wodę/zimno u potworów pozostają w danych bez efektu, dopóki nie pojawią się takie zdolności.

## 5. Zapis

Wersja **4** dodaje `skills`, `materials`, `respecs`. Zapisy wersji 1 i 3 wczytują się (domyślnie korzeń i nieprzydzielone punkty) i **nie są przepisywane**, dopóki gra nie zapisze. Zapis z niemożliwym drzewkiem lub nieznanym materiałem jest odrzucany z zachowaniem oryginału (jak dotąd). Stare pola `cooldowns` i `shield` są ignorowane.

## 6. Znane ograniczenia

- Interfejs sprawdzony testami komponentów; **brak oceny na urządzeniu mobilnym** i brak pełnej oceny estetycznej.
- Telegrafy, strefy i pociski to proste, proceduralne efekty.
- Balans potworów (wartości bestiariusza) i zdolności (wartości aneksu) nie był testowany grą w całym zakresie poziomów.
