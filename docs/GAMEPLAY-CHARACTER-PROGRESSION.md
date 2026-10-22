# Ki Legends — rozwój postaci i drzewko talentów

**Stan odniesienia:** `f5207a1f0cc2b837c9a05d85ca8ebf68b060df86`, odczyt 22.10.2026. **Stan projektu drzewka:** PROPOZYCJA DO ZATWIERDZENIA. Nie jest to funkcja już wdrożona ani treść zatwierdzona przez właściciela. Dane: [character-progression.v1.json](design/data/character-progression.v1.json).

## 1. Zweryfikowane zasady działającej gry (źródło: `src/game/session.ts`)

- Postać ma poziomy **1–100**, poziom 1 na starcie; na awans potrzeba `100 + (poziom - 1) × 60` XP.
- Automatyczny wzrost statystyk: `HP maks. = 120 + 20 × (poziom - 1)`; `KI maks. = 50 + 5 × (poziom - 1)`; `atak = 18 + 3 × (poziom - 1) + bonusy uzbrojenia`; `obrona = (poziom - 1) + bonus pancerza`.
- Zdolności: **Atak podstawowy**, **Cięcie płomienia**, **Impuls KI**, **Tarcza ducha**, **Mikstura życia**; ich koszty i odnowienia znajdują się w rejestrze danych i `ABILITIES`.
- Obecnie **brak** przydzielanych punktów talentów, odblokowywania węzłów, czterech osobnych specjalizacji, resetu punktów i ich trwałego zapisu. Nie wolno sugerować, że te funkcje są produkcyjne.

## 2. Kandydat na drzewko umiejętności (niezatwierdzony)

Zachowujemy bazowy postęp poziomów, a w przyszłości proponujemy **wspólny fundament** oraz **pojedynczą gałąź rasy**. Progi poziomów są tylko kandydatami; koszty punktowe, efekty liczbowe, balans PvE i warunki resetowania pozostają do rozstrzygnięcia.

### Fundament wspólny

| Węzeł | Sugerowany poziom | Cel |
|---|---:|---|
| Witalność | 5 | Rozwój przeżywalności; bez ostatecznej wartości HP. |
| Koncentracja KI | 5 | Rozwój zasobu KI; mechanizm regeneracji do ustalenia. |
| Technika walki | 5 | Rozwój ofensywy w sposób zgodny z obecnym atakiem. |
| Opanowanie obrony | 5 | Rozwój obrony; bez zmiany istniejącej logiki tarczy. |

### Gałęzie rasowe

| Rasa / kraina | Poziom 10 | Poziom 20 | Poziom 35 |
|---|---|---|---|
| Planetarni / Verdantia | Krok Wędrowca | Rezonans Ziemi | Strażnik Równowagi |
| Mędrcy / Aetheria | Czysty Umysł | Pieczęć Ochrony | Krąg Sanktuarium |
| Androidy / Nexus-9 | Kalibracja Rdzenia | Matryca Impulsu | Protokół Ochronny |
| Legendy / Pyra | Rytm Ostrza | Płomienny Szał | Żelazna Wola |

Każdy węzeł ma identyfikator i listę zależności w pliku JSON; wartości bonusów są `null`, ponieważ **nie zostały zatwierdzone**. Nazwy i specjalizacje to propozycje projektowe wynikające z istniejącej tożsamości ras.

## 3. Kontrakt wdrożenia — do wykonania dopiero po decyzji właściciela

1. Zatwierdzić liczbę punktów, progi, kolejność zależności, możliwości resetu oraz odpowiedzialność systemu serwerowego w przyszłym MMORPG.
2. Przygotować testy jednostkowe grafu: unikalność ID, brak cykli, poprawność wymagań, brak przeskakiwania poziomów i nieujemne punkty.
3. **Nie modyfikować `PlayerSchema` ani kluczy zapisu na podstawie samej propozycji.** Najpierw plan migracji istniejących zapisów `version:1/3`, testy round-trip, fallback i odzyskiwanie.
4. Osobno przetestować responsywny UI (Android + desktop), łatwe cofnięcie do gry, niedestruktywne zamknięcie okna i odczyt przy niskim FPS.
5. Brama publikacji: pełne TypeScript, Vitest, Playwright, WebGL, odbiór wizualny i zgodność wdrożonego SHA.

## 4. Zakres niemający jeszcze definicji

Ekonomia punktów, system klas, dokładny balans umiejętności, punkty KI jako nagroda, ograniczenia rasowe w multiplayer, poziomy maksymalne gałęzi i odblokowania pasywnych statystyk — **BRAK DECYZJI**. Nie przyjmować propozycji za finalny kanon.

**Źródła prawdy kodu:** [`src/game/session.ts`](../src/game/session.ts), [`src/game/world/races.ts`](../src/game/world/races.ts), [`docs/design/RASY_I_ETAPY.md`](design/RASY_I_ETAPY.md).
