# KI Legends — changelog zweryfikowanych etapów

To rejestr orientacyjny; dokładna historia i autorstwo pozostają w Git. Nie przenosi niezakończonych PR do pozycji opublikowanych.

## 2026-10-21 — prace w toku, NIEOPUBLIKOWANE

- `main` odczytany na `b3872c73c9df06e2a793190a6120f0948b021cb0`.
- PR #9 Planetarni: **SCALONY**, 416 klatek w paczce, nowa grafika dostępna przez opt-in.
- PR #11 Mędrcy: źródło historyczne, **Draft, nie scalać bezpośrednio**.
- PR #12 i PR #14: propozycje integracji, **Draft**.
- PR #15: gałąź integracyjna, nie scalona; SHA `b9f44577cb7bc1bab737c67000369b7a25919e26` podczas dokumentowania. Zgłoszone zmiany: bohaterowie, nawigacja globusa, testy/regresje. Zatwierdzenie zależy od końcowego CI i odbioru. Ostatni niezależnie sprawdzony kompletny run `ae3f8b98` wykazał 90/91 Playwright. Późniejsze runy nie były jeszcze zakończone w chwili odczytu.
- Utworzono dokumenty statusu/architektury/roadmapy/rejestru zadań/decyzji jako **materiał do przeglądu**, bez zmiany gry i produkcji.

## Starsze etapy

- Etap 2 lokalnego PvE — [STAGE2-GAMEPLAY.md](STAGE2-GAMEPLAY.md).
- Etap 3 czterech pochodzeń — [STAGE3-FOUR-CONTINENTS.md](STAGE3-FOUR-CONTINENTS.md).
- Pipeline GPU — [GPU_ASSET_PIPELINE.md](GPU_ASSET_PIPELINE.md).
- Historia globusa — [MAPA-GLOBUS-3D.md](MAPA-GLOBUS-3D.md).

Każde kolejne wydanie wymaga daty, SHA, PR, wyników CI, dokumentu decyzji właściciela i wyniku kontroli produkcji.

## 2026-10-22 — binarna archiwizacja kanonu graficznego (PR #16, Draft)

- Oryginał `Ki_Legends_Dokument_Projektowy_Rasy_i_Etapy_Produkcji.pdf` przechowany bezstratnie w 12 binarnych częściach i skrypcie `restore.py`, wraz z rzeczywistymi referencjami obrazów; commit `fb8940c` na gałęzi PR #16. SHA-256 oryginału: `be58d9df4fb49d19b11a66d47a1a3fc3fbbf5acc9c11ddc5cf76213f6be15734`. Stan jeszcze nie scalony.

## 2026-10-22 (wieczór) — PR #24, NIEOPUBLIKOWANE

- Cztery malowane rasy, tekstury kontynentów i przyroda zainstalowane jako publiczne; otwarte światy Aetherii, Nexus-9 i Pyry (cztery strefy), przycisk „Usuń” w wyborze postaci, podgląd kontynentu z atlasu, geometria planety (80 000 j. między miastami). Szczegóły i plan na jutro: [SESSION-2026-10-22-HANDOFF.md](SESSION-2026-10-22-HANDOFF.md). Brak scalenia i publikacji.

## 2026-10-23 — miasto Pyry (gałąź `feat/pyra-city`, NIESCALONE, NIEOPUBLIKOWANE)

- Sześć budynków usługowych na pierścieniu wokół fortecy, każdy w osobnej dzielnicy ≥ 700 j. od pozostałych, z drzwiami osiągalnymi z rynku; mieszkańcy Legend; obszar bezpieczny bez dzików (24 → 20 punktów wrogów w Pyrze). Mechaniki wnętrz, handlu, kowala, depozytu i treningu: gałąź Codexa. Szczegóły: [CITY-PYRA-2026-10-23.md](CITY-PYRA-2026-10-23.md).

## 2026-10-23 — wydajność rysowania (OPUBLIKOWANE)

- Przyczyna przycinania na telefonie (realme 14T, Mali-G57): 33 postacie jako kontenery nie były przycinane przez kamerę i każda rozbijała rysowanie na osobną porcję (70 wywołań rysowania na klatkę). Naprawa: postacie spoza widoku nie są rysowane, cień postaci to obraz zamiast kształtu. Wynik: 2–5 wywołań rysowania na klatkę. Pomiar na urządzeniu w Aetherii: z 11–17 do **59,5 FPS** (p95 19 ms).
- Narzędzia diagnostyczne: `?ki-debug=1` (renderer, FPS, obiekty, tekstury, czas JS, GPU) i `?ki-debug=bench` (FPS po wyłączaniu warstw; ukrywanie tuż przed rysowaniem, bo gra sama przywraca widoczność obiektów).
- Znane: test `hero-lifecycle` (zimny start) bywa niestabilny na `main` także bez tej zmiany.

## 2026-10-23 — grafika główna i nick postaci (gałąź `feat/key-art-menu-loading`, NIEOPUBLIKOWANE)

- Grafika główna jako tło ekranu ładowania (kadr z bohaterami, powolne zbliżenie) i menu; prawa do obrazu do potwierdzenia przez właściciela.
- Nick postaci wpisywany przy tworzeniu (3–16 znaków: litery, cyfry, spacja, `_ - '`; puste = „Wędrowiec”). Zapis: opcjonalne pole `name` w zapisie v4, starsze zapisy działają bez zmian. Nick widać w HUD i na liście postaci.

## 2026-10-22 — rasy, drzewka i potwory w rozgrywce (gałąź `ccr-b63f9ce9-bu75ez`, NIEOPUBLIKOWANE)

- Wdrożono aneks właściciela: statystyki ras, 4 drzewka po 29 węzłów, Ładunek Rdzenia i Żar, punkty umiejętności, Tryb KI; szybkość +5% na poziom do 20 (decyzja właściciela); model obrażeń `max(1, Atak × mnożnik − Obrona/2)` bez zaokrąglania (odtwarza tabelę pojedynków aneksu).
- Dodano silnik 40 potworów z bestiariusza HTML (AI, telegrafy, strefy, statusy, łup/materiały); spawny w regionach puste.
- Zapis wersji 4 (`skills`, `materials`, `respecs`); v1/v3 wczytują się bez przepisywania.
- Dodano 40 paczek grafiki potworów (`deliveries/enemy-*`, niezainstalowane), 4 malowanych bohaterów, tekstury kontynentów i zestaw przyrody.
- Usunięto stare umiejętności Etapu 2 (Cięcie płomienia, Impuls KI, Tarcza ducha); testy jednostkowe i Playwright dostosowano.
