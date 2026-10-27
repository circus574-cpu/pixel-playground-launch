# 27.10.2026 — Combat System V3

## Zakres i baza

Gałąź `feature/combat-diablo-v3`, utworzona od pobranego `main`
`f2575faa62137fbcb4b842b9d3d56ba53b7be35d`. Weryfikacja gałęzi zdalnych nie wykazała
wcześniejszej gałęzi o tej nazwie. Inne worktree i otwarte PR pozostawiono nietknięte.
Nie scalano ani nie publikowano. Nie łączono się z GPU.

Mapa zależności i aktualny kontrakt: [rozwój i walka](../../ROZWOJ-I-WALKA.md#combat-v3--mapa-zależności-i-granice-zmian).
Kod: istniejący `session.ts`, `kit/base.ts`, trzy zestawy zdolności, `monsters/system.ts`,
`monsters/types.ts`, prezentacja w `mountGame.ts` i `actorAnimation.ts`; trzy pomocnicze
moduły w `combat/`. Testy `combat-v3.test.ts`, aktualizacja dwóch dotychczasowych testów
oraz nowe scenariusze Playwright. Nie zmieniono kanonicznych generated, statystyk,
geometrii, generatorów świata, plików graficznych, zapisu, questów, HUD ani prywatnego `/test`.

## Potwierdzone przyczyny i poprawki

1. `Kit.pickFoe` dopuszczał cel o 400 jednostek dalej i fallback o 120 dalej od zasięgu.
   Zastąpiono go wyborem w rzeczywistym zasięgu/LOS ze stabilną asystą kierunkową.
2. Nieudany R potrafił uruchomić automatyczne podejście. Usunięto ten efekt uboczny;
   jawny wybór przeciwnika zachowuje wcześniejsze zachowanie.
3. Pociski rozliczały obrażenia przed prezentowanym lotem. Dodano test segmentu,
   przeszkód, czasu życia oraz anulowanie przy śmierci, bez zmiany mnożników obrażeń.
4. Opóźnione akcje i kanały mogły przeżyć śmierć. Dodano unieważnianie akcji i czyszczenie
   obu stron starcia; callback leczenia nie wskrzesza martwego gracza.
5. Zwykłe ataki AI nie miały rozdzielenia przygotowania i trafienia. Dodano windup,
   zobowiązany kierunek i recovery w istniejącym AI; szarża nie śledzi uniku po zapowiedzi.
6. Knockback mógł przekroczyć przeszkodę. Każdy krok teraz przechodzi walidację nawigacji.
7. Czas walki był obcinany do 100 ms na klatkę. Wprowadzono ograniczone nadrabianie
   symulacji; nie zmieniono obsługi wejścia ani współrzędnych HUD.

## Weryfikacja — kontrola rdzenia i dalsza regresja

Końcowe wyniki i identyfikatory commitów zostaną uzupełnione po zakończeniu bieżących
kontroli. Wersje robocze testowano jako niezacommitowane zmiany względem powyższej bazy;
nie są one dowodem PASS na końcowym SHA.

Zachowane informacje o nieudanych próbach:
- Nowy scenariusz dotykowy błędnie odtwarzał sekwencję kontaktów i czekał na gotowy R
  podczas trwającego automatycznego atakowania. Naprawiono scenariusz: oba palce pozostają
  na ekranie podczas asercji, oddzielono serię prawdziwych kliknięć/tapnięć. Nie zmieniano
  sterowania w celu przejścia testu. Nieudane próby nie są zgłaszane jako PASS.
- Jedno uruchomienie przeglądarki zakończyło się `ERR_CONNECTION_REFUSED` po wygaśnięciu
  wcześniejszego procesu preview między turami. Serwer jest teraz zarządzany przez Playwright.
- Jeden pełny przebieg Vitest kolidował z edycją pliku testów (nowy test wywołał metodę
  niedostępną w już zaimportowanej wersji modułu). Wynik odrzucono jako niestabilny snapshot;
  pełna kontrola musi być ponowiona na zakończonych zmianach.

## Ograniczenia

Fizyczne telefony Android/iOS i sprzętowe WebGL: NIEWYKONANE (brak urządzeń).
Brak nowych klipów combo; brak globalnego hit-stopu. Lot bada wybrany hurtbox, bez
przechwytywania przez innego potwora. Nie jest to multiplayer ani symulacja sieciowa.
Ręczny odbiór dynamiki i czytelności przez właściciela pozostaje wymagany przed scaleniem.

### Kontrole przed pierwszym commitem rdzenia

- `npm run typecheck`: PASS (aplikacja, e2e, tools).
- `npx vitest run --reporter=json --outputFile=.../unit8.json`: **806 PASS, 0 FAIL, 0 pominiętych**;
  w tym 33 nowe testy V3. [Podsumowanie](qa/unit-summary.json).
- `npm run lint`: PASS, 0 błędów, 13 wcześniejszych ostrzeżeń React.
- `npm run assets:check`: PASS; `npm run build`: PASS, ostrzeżenia wielkości chunków.
- `python3 scripts/docs/check_documentation.py`: PASS po dodaniu nowego dziennika do indeksu Git.
- Canvas, pierwszy zestaw kontrolny: 11/11 PASS (cztery umiejętności, pięć scenariuszy Argon,
  dwa przebiegi gracza v2). Dalsze pełne przebiegi opisane niżej nie są jeszcze zakończone.

Rozpoznano wcześniejsze usterki testów: na czystej bazie `f2575faa` test importowanego rigu
również nie znajduje `Zmiana rasy` — guzik jest obecnie tylko dla staff. Testy użytkownika
przechodzą przez dostępne `Zapisz i wybierz postać` → `Nowa podróż`, bez zmiany UI gry.
Test mapy/globusa tworzył slot v1, a rzeczywisty link mapy wracał do domyślnego v2;
kontrola zostaje ujednolicona do domyślnego v2, bez migracji danych i bez modyfikacji zapisu.
Nowy scenariusz ruchu podczas walki musi prowadzić na zewnątrz miasta (w każdym świecie
w inną stronę); powrót do bezpiecznej strefy prawidłowo blokował atak i unieważniał próbę.
