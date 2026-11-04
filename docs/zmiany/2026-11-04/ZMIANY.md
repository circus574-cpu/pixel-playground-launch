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


## Bariery Mędrców — TA04, TA05, TA06

Kontynuacja tej samej gałęzi i Draft PR #90 od `d4d7513b`. Dodano trzy próby /
dziewięć stopni według §7.5 specyfikacji właściciela: ochronę obiektu przed 3/4/5
falami z minimum 50% HP, 2/3/4 zwierciadła z rzeczywistym przebiegiem promienia
oraz 3/4/5 okien osłony z reakcją 1800/1500/1300 ms.

Ochrona obiektu używa istniejącej B1 na profilu wypożyczonym i rzeczywistego
zużycia jej pojemności. Fala idzie w rdzeń przez oznaczony punkt przechwycenia;
bariera użyta poza nim, samo ciało gracza albo nietykalność nie zastępują tarczy.
`ProtectedActor` zapewnia wspólne HP/eventy/śmierć środowiskowo, bez celu AI.
Profil ćwiczebny: rdzeń 100 HP, fala 30, promień punktu 40 j., zapowiedź 1800 ms,
przygotowanie 1500 ms na początku i 11 s po fali. B1 zachowuje zwykłe parametry,
koszt i odnowienie. Nie dodano nowego silnika walki, potworów ani agresji na NPC.

Zwierciadła mają osobny panel SVG z obrotem / i \, podglądem trasy i strzałem.
Wynik sprawdza serwerowy ray tracer: wszystkie lustra, odbiornik, chroniony punkt,
wyjście i pętle. Nie jest to wybór ukrytej poprawnej etykiety. Osłony terenu
korzystają z istniejącej ściany i LOS; reakcja wymaga ruchu po zapowiedzi oraz
osłoniętej pozycji w chwili rozstrzygnięcia (50 j., ruch min. 30 j.; przygotowanie 1200 ms).
Pauza zatrzymuje czas, anulowanie usuwa stan; sterowanie, HUD i kontynenty zachowane.

Bariery II odblokowują istniejący `ma-barrier`, bez zmiany mnożników.
Istniejące intenty/ledger zapisują wynik i 100/150/200 praktyki raz za stopień.
Formaty zapisu 10/6 i development v3 zachowane. Katalog ma **24/48 prób,
72/144 stopni**; Mędrcy 6/12 prób. Pozostają 24/72, pięć wariantów i trzy moduły,
interakcje dziedzin w świecie, późne starcia, tytuły i pełny odbiór kampanii.
Mędrcy mają 2700 praktyki z prób, teoretyczny budżet 15 100 nadal wymaga
2700 do 17 800 i potwierdzenia pełnej osiągalności/balansu.

Pierwsze kontrole ujawniły błąd typów Phaser `fillPoints` (wymagane Vector2)
i błędne założenia w nowych testach: profil zna też podstawowe R, a źródło
poza zamkniętym obiegiem nie wchodzi automatycznie w pętlę luster. Rysunek zmieniono
na dwa typowane trójkąty; test uwzględnia R, a test pętli rozpoczyna promień
wewnątrz zamkniętego obiegu. Nie rozluźniano wymagań gry. Pierwszy zestaw miał
4 FAIL / 114 PASS; poprawione osobne testy zachowań: 16 PASS / 0 FAIL.
Logi pierwszych niepowodzeń pozostają w [dowodach](qa/barrier-trials/).

### Kontrole Barier

Końcowe wyniki, komendy, screenshoty i SHA-256 źródeł znajdują się w
`qa/barrier-trials/`. Wyższe stopnie są sprawdzane kontrolerami i transakcjami;
przeglądarka sprawdza I stopień rzeczywistymi kliknięciami/ruchami, renderer,
nagrodę, zachowanie własnych zasobów i wynik po odświeżeniu.
Fizyczny telefon, sprzętowe WebGL, odsłuch, pełna kampania i opublikowana sesja
WebSocket/PostgreSQL pozostają NIEWYKONANE. Nie scalano do main ani nie publikowano.

- Pierwsza seria Canvas: **3 PASS / 0 FAIL**, TA04/TA05/TA06 I, 2,8 min.
  W trakcie tej serii poprawiono wyłącznie typowane rysowanie rombu (Phaser),
  dlatego komplet scenariuszy jest ponawiany na końcowych źródłach.
- Pełny TypeScript (aplikacja/e2e/tools), lint (0 błędów / 15 wcześniejszych ostrzeżeń),
  assets:check i produkcyjny build: PASS. Build przez ignorowany `.output`
  w `/tmp/ki-development-build-output`, bez zmian konfiguracji wdrożenia.

- Końcowa seria Canvas na końcowych źródłach: **3 PASS / 0 FAIL**, TA04/TA05/TA06 I,
  2,5 min. Renderer, pozycje, rzeczywiste B1 i obrót luster, +100 praktyki,
  zachowanie własnego wyposażenia/HP/KI oraz reload; `pageerror` = 0.

- Pierwsza pełna regresja: **1316 PASS / 1 FAIL / 10 SKIP**, 321,62 s.
  Niepowodzenie: niezmieniany `gpu-pipeline.test.ts`, test zachowania rejestru przy
  zmianie zawartości bez podniesienia wersji, przekroczył domyślne 5000 ms (5084 ms).
  Seria działała równolegle z buildem, kontrolą zasobów i przeglądarką.
  Nie zwiększano timeoutu ani nie zmieniano asercji; kontrola importera i pełna
  regresja są ponawiane, końcowa pełna seria bez równoległych ciężkich kontroli.

- Osobny niezmieniany importer: **17 PASS / 0 FAIL**, 50,79 s, przy zachowaniu
  istniejącego limitu i asercji. To test CPU/plików, bez użycia ani sterowania instancją GPU.
- Software WebGL na końcowych źródłach: **3 PASS / 0 FAIL**, TA04/TA05/TA06 I,
  4,6 min. Z Canvas daje to sześć unikalnych scenariuszy; każdy kontroluje faktyczny
  renderer, działania, nagrodę, własne zasoby, reload i brak pageerror.

- Końcowa pełna regresja bez równoległych ciężkich kontroli:
  **1317 PASS / 0 FAIL / 10 SKIP**, 109 plików PASS / 1 SKIP, 132,44 s.
  Obejmuje trzy nowe serwerowe scenariusze TA04/TA05/TA06, zapis snapshotu,
  pojedyncze zatwierdzenie nagrody i odtworzenie serwera. Pominięte testy nadal
  wymagają osobnego PostgreSQL QA. Nie zwiększano limitów czasu ani nie zmieniano
  wcześniejszego testu importera. Cały zestaw testów został rzeczywiście powtórzony.
- Dokumentacja: PASS, 10 dokumentów tematycznych / 15 dzienników, Git index.
  Końcowe źródła zgodne z `sources.json`; komendy i kody wyjścia w `checks.json`.

Ta partia pozostaje na Draft PR #90, bez scalenia i publikacji. Wyższe stopnie
weryfikują kontrolery i transakcje, a nie całe przejście UI każdego stopnia.
Wydanie wymaga zgodnego klienta i serwera; nie zastępuje pełnego odbioru kampanii.
