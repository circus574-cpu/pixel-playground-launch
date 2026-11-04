# Zmiany — 04.11.2026

## Opieka — TV07, TV08, TV09

Kontynuacja `feature/complete-character-development`, Draft PR #90, baza `9d079932`.
Trzy próby / dziewięć stopni według §6.5 zlecenia właściciela z 28.10:
zestaw 3/4/5 składników, podział 4/6/8 jednostek wody, ochrona 2/3/4 punktów
przez 45/60/75 aktywnych sekund. UI wymaga przygotowania całego zestawu i obu
wartości przepływu; odpowiedź sprawdza wspólny kontroler, również na serwerze.
Nie ma klientowego zaliczenia ani pobierania przedmiotów z własnego ekwipunku.

Obóz korzysta z rzeczywistych osłon sali, nawigacji i sprawdzenia linii widoczności.
W kolejnych oknach trzeba zająć wskazaną osłonę; nie można wygrać bez ruchu ani
zakończyć wcześnie po pierwszym odwiedzeniu wszystkich punktów. Profil ćwiczebny:
zmiana punktu co 10 s, promień 60 j.; osiągnięcie osłony zalicza okno, nie wymaga
ciągłego pozostania. Nie są to nowe statystyki ras ani fale bojowe potworów.
Pauza zatrzymuje zegar. Kontynenty, AI, HUD i sterowanie pozostają bez zmian.

Opieka II odblokowuje istniejący `mv-root`, bez zmiany jego mnożników.
Wyniki, rangi i nagrody 100/150/200 przechodzą istniejące intenty i ledger;
formaty zapisu 10/6 i development v3 zachowane. Katalog ma **21/48 prób,
63/144 stopni**, Planetarni **12/12 prób**. Do pozostałych ras pozostaje 27/81,
sześć wariantów i trzy moduły; ponadto interakcje dziedzin w świecie, późne
starcia, tytuły, pełna osiągalność/balans i odbiór kampanii.
Planetarni mają 5400 praktyki z prób i teoretyczną sumę katalogową 17 800;
nie oznacza to jeszcze potwierdzonego pełnego przebiegu kampanii.

[Dowody tej partii](qa/care-trials/). Źródła identyfikowane SHA-256 w `sources.json`.
Wyższe stopnie sprawdzane kontrolerami i transakcjami. Przeglądarka sprawdza I stopień,
normalne interakcje i ruch, renderer, własne zasoby, +100 praktyki i reload.
Bez wstrzykiwania zapisu ani mutacji instancji gry. Fizyczny telefon, odsłuch,
pełne e2e i opublikowana sesja WebSocket/PostgreSQL pozostają NIEWYKONANE.
Nie scalano do main, nie publikowano i nie sterowano instancją GPU.

### Kontrole

Wyniki końcowych uruchomień są zapisane poniżej i w `checks.json`.

- Pełne `NODE_OPTIONS=--max-old-space-size=2048 npm test`: **1289 PASS / 0 FAIL / 10 SKIP**,
  108 plików PASS / 1 SKIP, 283,45 s. Testy wymagające osobnego PostgreSQL QA pozostają pominięte.
- Kontrolery Opieki + katalog + transakcje: **91 PASS / 0 FAIL** (3 pliki).
- Intenty serwera i adapter z TV07/TV08/TV09: **12 PASS / 0 FAIL** (2 pliki).
  Obejmuje odtworzenie snapshotu i jednokrotne zatwierdzanie nagrody.
- Pełny TypeScript (aplikacja/e2e/tools), lint (0 błędów / 15 wcześniejszych ostrzeżeń),
  assets:check i produkcyjny build: PASS. Output przez ignorowany `.output` w
  `/tmp/ki-development-build-output`, bez zmian konfiguracji produkcyjnej.
- Pierwsza seria Canvas: 2 PASS (TV07/TV08), 1 FAIL (robot TV09). Screenshot potwierdza,
  że gra ukończyła obóz w 45 s; scenariusz odczytał usunięte współrzędne celu jako (0,0)
  po pojawieniu się wyniku i czekał na dojście. Poprawiono atomowy odczyt opcjonalnego
  celu i zakończenie pętli; zachowano asercje zaliczenia, pełnego czasu, nagrody i reloadu.
  Reguł gry i sterowania nie zmieniano. Pierwszy log, screenshot i kontekst zachowane.

- Poprawiona końcowa seria Canvas: **3 PASS / 0 FAIL**, TV07/TV08/TV09 I, 2,4 min.
  Pełny TypeScript i lint ponowiono po korekcie e2e: PASS.

- Software WebGL: **3 PASS / 0 FAIL**, TV07/TV08/TV09 I, 4,3 min. Z Canvas to
  sześć unikalnych zaliczonych scenariuszy. Każdy jawnie sprawdza renderer,
  rzeczywiste działania, zachowanie własnych zasobów, nagrodę, reload i brak pageerror.
- `python3 scripts/docs/check_documentation.py`: PASS (kontrola staged index),
  10 dokumentów tematycznych / 15 dzienników. Sumy źródeł zgodne przed commitem.

Polecenia i kody wyjścia są w `qa/care-trials/checks.json`; przeglądarkę uruchomiono
na lokalnym Vite `scripts/playtest.html?ki-world-v2=1` w Chromium. Dowody zawierają
również pierwsze niepowodzenie robota. II/III stopnie potwierdzają kontrolery i
transakcje, nie pełne przejścia UI. Wydanie wymaga zgodnego klienta i serwera;
ta partia pozostaje na Draft PR #90 bez scalenia i publikacji.
