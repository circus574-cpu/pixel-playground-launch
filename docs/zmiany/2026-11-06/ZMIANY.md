# Zmiany — 2026-11-06

## Pamięć Mędrców — TA10, TA11, TA12

Wznowiono istniejący Draft [PR #90](https://github.com/circus574-cpu/pixel-playground-launch/pull/90),
którego ostatnia partia była zapisana na `a9e44175` (Bariery, 24 próby / 72 stopnie).
Wcześniejsza lokalna dokumentacja main nie zawierała tego checkpointu. Kontynuacja
jest na `feature/racial-trials-continuation`; aktualny `main@83165f5c` włączono
lokalnym commitem integracji `9ea4ca28`. Nie scalano PR do main ani nie publikowano gry.

### Nowa zawartość

| Próba | I / II / III | Warunek |
| --- | --- | --- |
| TA10 Fragment i źródło | 3 / 4 / 5 fragmentów | Przypisz fragment do źródła, które zawiera dane świadectwo |
| TA11 Granice świadectwa | 2 / 3 / 4 twierdzenia | Rozpoznaj brak potwierdzenia w dostępnych dokumentach, nie utożsamiając go z dowodem fałszu |
| TA12 Kronika z niewiadomą | 3 / 4 / 5 zdarzeń | Odtwórz kolejność i zachowaj oznaczenie nieustalonego autora dopisku |

Nowe karty są jawnie materiałami ćwiczebnymi, nie dopisanym kanonem katastrofy.
Nie wymagają ukrytej wiedzy. Przypisanie dopisku Sorze bez dowodu lub usunięcie
informacji o nieznanym autorze kończy TA12 porażką. Odpowiedzi wymagają podejścia
do stanowiska, otwarcia materiałów i bieżącego numeru rundy. Nie ma przycisku
zaliczającego wynik, automatycznego odkrywania ani nagrody za czas bezczynności.

Wejście zwykłym UI: **Umiejętności → Rozwój · trening i wiedza → Próby**,
„Podejdź do trenera”, karta TA10/TA11/TA12, „Instrukcja · 1”, rozpoczęcie próby.
W sali podejdź do zielonego stanowiska, wybierz „Zbadaj stanowisko” i odpowiedź
z jawnych dokumentów. Zatwierdź gotowy wynik. Stopnie II/III wymagają wcześniejszego.

### Zapis, rangi i nagrody

- Dziedzina Pamięć (`source-memory`) ma oddzielną rangę od Pamięci Korzeni Planetarnych;
  do rangi potrzebne są wszystkie trzy próby na danym stopniu. Nie daje premii bojowej.
- Użyto istniejącego `TrialAttempt`, wypożyczonego `GameSession`, kontrolera stanowisk,
  transportu intencji serwera oraz księgi zatwierdzonych wyników. Klient nie przekazuje
  serwerowi gotowego werdyktu. Publiczne materiały nie zawierają pola odpowiedzi.
- Nagrody 100/150/200 praktyki wypłacane są raz na próbę i stopień. Ponowienia nie
  powielają praktyki ani XP/łupu. Stan właściciela, jego HP/KI, wyposażenie i cooldowny
  nie są przenoszone do wypożyczonego profilu ani resetowane po powrocie.
- Struktury i formaty bez zmian: development v3, klasyczny v10, Superior v6. Dodano ID
  treści do istniejącego katalogu. Starszy runtime odrzuca nieznane ID bez nadpisania.

Katalog po tej partii: **27/48 prób, 81/144 stopni** — Planetarni 12/12,
Mędrcy 9/12, Androidy 3/12, Legendy 3/12. Mędrcy uzyskują 4050 praktyki z prób;
teoretyczny budżet ich ścieżki wzrasta z 15 100 do **16 450**, nadal brakuje 1350
z dziedziny Skupienia. To arytmetyka katalogu, nie potwierdzenie osiągalności całej kampanii.

### Integracja aktualnego main

Zachowano nowsze grafiki, `kiwalk`, wnętrza, opt-in Nexusa i poprawki mapy.
Konflikty dokumentacji rozwiązano z zachowaniem obu dzienników; zachowano mechanikę
wyposażenia PR #90 zamiast przywracać wcześniejsze przeliczanie statystyk.
Wstępna regresja wykryła niezgodną asercję `moveSpeedPct` z main oraz fikcyjny ID
butów `BUTY-15-01`. Test zastąpiono silniejszą kontrolą istniejących `ZEST-04-04`:
dodatni rzeczywisty ruch i niezmieniony odstęp ataków. Nie osłabiono reguł gry.
Wstępny niezaliczony przebieg zachowano jako dowód, nie końcowy wynik.

### Weryfikacja

Testy nowej Pamięci sprawdzają wszystkie dziewięć wariantów, błędne źródło,
niepotwierdzone twierdzenie, przestawioną kolejność, dopisanie/wymazanie autorstwa,
rangi, odległość, odczyt, starą i powtórzoną rundę, pauzę i porzucenie.
Wspólne transakcje ćwiczą wszystkie stopnie oraz zachowanie danych czterech ras.
Nowe testy serwerowe obejmują TA10/TA11/TA12 I i odtworzenie zatwierdzonych wyników.
Kontrolery i transakcje sprawdzają także II/III; nie jest to odbiór II/III w przeglądarce.

Końcowa walidacja kodu `d9a30bbe` i scenariuszy `066e5fce` (niezmienność źródeł:
`qa/memory-trials/sources.json`):

| Kontrola | Wynik |
| --- | --- |
| Pełny TypeScript aplikacji / e2e / tools | PASS |
| Pełne `npm test` | **1463 PASS / 0 FAIL / 10 SKIP**, 128 plików PASS / 1 SKIP |
| Kontrolery nowej Pamięci, transakcje, serwer i poprawiony audyt | **54 PASS** |
| `npm run lint` | 0 błędów, 15 wcześniejszych ostrzeżeń |
| `npm run assets:check` | PASS |
| `npm run build` | PASS |
| Kontrola dokumentacji | PASS |
| Canvas: TA10 / TA11 / TA12 I | **3 PASS**, zwykłe UI, nagroda, zasoby właściciela i reload |
| Software WebGL: TA10 / TA11 / TA12 I | **3 PASS**, te same asercje i kontrola renderera |
| Emulacja telefonu Canvas | **2 PASS**: TA12 I w 852×393 oraz regresja dotykowego Androida z osłoną portretową 390×844 i obrotem do 852×393 |

Dziesięć pominiętych przypadków wymaga osobnego PostgreSQL QA. Nie pomijano nowych
prób. Logi, katalog i screenshoty: `qa/memory-trials/`; podsumowanie `checks.json`.
Pierwszy przebieg przeglądarkowy miał 3 PASS Canvas / 3 FAIL WebGL na gotowości menu.
Po dodaniu jawnego oczekiwania na gotowość kolejny przebieg WebGL ukończył próbę
i zapisał wynik, lecz przekroczył limit 180 s dopiero przy końcowym przeładowaniu.
Nowe trzy pełne scenariusze mają limit 300 s (dwa rzeczywiste ładowania kontynentu
oraz salę próby na CPU/SwiftShader); limit akcji 15 s, asercje i limity testów
jednostkowych pozostają zachowane. Końcowe WebGL 3/3 PASS, bez retry i pageerror.
Pierwotne logi niepowodzeń zachowano. To nie jest pomiar sprzętowego WebGL.

### Otwarte prace

Pozostaje **21 prób / 63 stopnie**, pięć wariantów, trzy moduły, pełne interakcje
dziedzin w kontynencie, późne warianty starć, tytuły, cały graf/budżet kampanii
i pomiary balansu. Skupienie Mędrców TA07–TA09 pozostaje niezaimplementowane.
Nie zmieniono tabel rozwoju 1–60 ani nie aktywowano ich przez samo dodanie prób.
Nie deklarujemy ukończenia całego rozwoju ras, publikacji, odbioru fizycznego
telefonu, sprzętowego WebGL ani produkcyjnej sesji WebSocket/PostgreSQL.
