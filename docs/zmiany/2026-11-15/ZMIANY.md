# Zmiany 2026-11-15

### 1. Pięć poprawek zgłoszonych przez właściciela (teleport GM, globus, świat, spawny, mapa 2D)

Lista właściciela: (1) teleport GM pokazuje „miejsce niebezpieczne”, (2) globus się nie obraca, (3) ograniczyć drzewa i
obiekty, dodać drogi i ścieżki do spawnów, (4) spawny mają stać na wolnych polach, (5) mapa 2D pokazuje kwadraty i łączenia.

**1. Teleport GM: tylko woda jest zabroniona.** Przyczyna: `staffTeleport` wymagał `navigation.walkable(punkt)`, więc
każdy klik w drzewo, budynek lub skałę kończył się komunikatem „Miejsce niedostępne”; w trybie online serwer przesuwał
postać na `navigation.safe(...)`, a klient czekał na pozycję w promieniu 32 j. od kliknięcia i też zgłaszał porażkę
(8 s), choć teleport się udał. Teraz `Navigation.staffSpot` (nowa metoda, woda z bitu lądu w terenie) odmawia tylko wody
i punktu poza mapą; punkt na przeszkodzie przenosi na najbliższe miejsce do stania (do 4000 j.), bo postać stojąca w
kolizji nie wczytałaby się. Klient wybiera miejsce przed wysłaniem polecenia (serwer dostaje już gotowy punkt), serwer i
sesja stosują tę samą zasadę, a wczytanie postaci po edycji w panelu admina ląduje przy wskazanym miejscu, nie w
mieście. Komunikat: „Do wody nie można się teleportować. Wskaż ląd.” Testy na prawdziwych danych Verdantii
(`staff-map-runtime.test.ts`: punkt na przeszkodzie → ląduje, punkt w wodzie → odmowa) i `navigation-staff-spot.test.ts`.

**2. Globus.** Przeciąganie i obrót własny działały w każdym środowisku, w którym sprawdziłem (dev, produkcja
`kilegends.pl`, nakładka w grze, dotyk): kamera obracała się o 25–47° na przeciągnięcie. Nie udało mi się odtworzyć
błędu „stoi w miejscu” przeciąganiem, więc najbardziej prawdopodobna przyczyna to obrót własny, którego nie dało się
zauważyć: ok. 2°/s przy 60 FPS (pełny obrót ok. 3 min), start po 20 s bezczynności, wyłączony przy wybranym regionie
i całkiem wyłączony przy systemowym „ogranicz animacje”. Zmiany: obrót własny ok. 7°/s (pełny obrót poniżej minuty)
po 3 s bezczynności, liczony w czasie rzeczywistym także na wolnym GPU, plus trzy przyciski w pasku: „Obróć w lewo”,
„Obróć w prawo” i przełącznik „Automatyczny obrót globusa” (domyślnie włączony, wyłączony tylko przy „ogranicz
animacje”, ale można go włączyć). **Jeśli globus nadal nie reaguje na przeciąganie na Twoim urządzeniu, podaj
przeglądarkę i system; to byłaby inna przyczyna niż ta, którą znalazłem.**

**3 i 4. Mniej obiektów, spawny na wolnych polach, ścieżki do spawnów.**
- **Roślinność:** `sceneryThinning.ts` zostawia deterministycznie (po haszu pozycji) 30% drzew, 30% krzewów, 50% skał i
  40% kryształów bez kolizji; obiekty z footprintem kolizji zostają zawsze, więc nawigacja i zapisy są bez zmian.
  Działa na dekoracjach z chunków i na warstwach roadside, dress i scatter. W grze licznik obiektów na ekranie spadł z
  ok. 735 do ok. 365 na tym samym kawałku Verdantii (zrzuty w `qa/mapa-swiat/`).
- **Spawny:** w danych ok. 28% spawnów stało w ciasnych miejscach (mniej niż 128 j. wolnego gruntu: wciśnięte między
  skały i krzewy; 145 z 2352 w Verdantii dotykało przeszkody). `scripts/worldgen/v2/open_fields.py` przeniósł je na
  najbliższe pola z co najmniej 224 j. wolnego gruntu, poza strefą bezpieczną i drogami, najwyżej o 1400 j. Id, rodzaj,
  poziom i grupa bez zmian.
- **Ścieżki:** ten sam skrypt zapisuje `paths.json` (wpis w `manifest.json` z SHA-256): najkrótsze przejezdne trasy od
  sieci dróg do skupisk spawnów, tanie wzdłuż istniejących dróg. Loader dokleja je do `definition.roads` (rodzaj `path`),
  więc istniejący kod czyści roślinność przy ścieżkach. Teren, kolizje i nawigacja bez zmian.

| Ląd | spawny | ciasne przed | po | ścieżki | długość |
|---|---|---|---|---|---|
| Verdantia | 2352 | 675 | 1 | 568 | 1,97 mln j. |
| Aetheria | 2043 | 561 | 3 | 506 | 1,78 mln j. |
| Nexus-9 | 1798 | 549 | 2 | 416 | 1,29 mln j. |
| Pyra | 1733 | 467 | 1 | 395 | 1,10 mln j. |
| wyspy I–VI | 826 | 456 | 19 | 114 | 0,09 mln j. |

Istniejące drogi Verdantii mają łącznie 0,54 mln j., więc nowa siatka jest kilkakrotnie dłuższa; gęstość reguluje
`CLUSTER`/`SPUR` w skrypcie. Ścieżek nie ma w nakładce atlasu 2D ani na globusie (byłby zalew linii).
Testy: `open-fields.test.ts` na prawdziwych danych (spawny przejezdne, ≥96% z wolnym gruntem, ścieżki przejezdne i
w zasięgu 97% spawnów), `scenery-thinning.test.ts`.

**5. Mapa 2D: kwadraty i łączenia.** Dwie osobne przyczyny:
- **Kwadraty przy przybliżeniu (zoom od ok. 300%):** nakładka wysokiej rozdzielczości składa się z komórek 16×12
  na ląd; generator dopasowuje do każdej afiniczne przekształcenie z trzech dokładnych rogów, a czwarty zgaduje.
  Sąsiednie komórki nie zgadzały się co do wspólnej krawędzi o średnio 2–3 j. atlasu (kwantyl 90%: 5–15 j.), czyli
  kilkanaście pikseli przy powiększeniu 950%: widać było mozaikę z prześwitami i różnym wyostrzeniem. Teraz
  `terrainMesh.ts` ustawia każdy róg siatki raz, z komórek, które znają go dokładnie, rysuje zdeformowane komórki
  jako przycięte trójkąty (z 0,75 px zapasu, by nie było włosowatych szczelin), a komórki będące równoległobokami po
  staremu jednym prostokątem. Rogi po drugiej stronie szwu atlasu są przesuwane o szerokość mapy. Test z
  zakrzywioną siatką (rogi wspólne, róg zgadywany zastąpiony dokładnym).
- **Pionowa kreska przy normalnym powiększeniu:** kopie atlasu (zapętlone przesuwanie) stykały się na ułamku piksela
  i przez szczelinę antyaliasingu świeciło ciemne tło (kolumna ciemniejsza o ok. 10 poziomów). Każda kopia wystaje
  teraz o 1 j. mapy z obu stron. Dodatkowo lewa i prawa krawędź obrazu atlasu różniły się średnio o 17–21 poziomów
  (p95 ok. 70): `seam.py` rozkłada ten skok na pasmo i lustrzanie scala skrajne piksele (krok 20,8 → 2,2), tak samo
  kolor globusa (9,9 → 1,8). Pomiar zrzutów: kolumna szwu z 7,7 do poziomu tła (mediana 0,7).

### 2. Kontrole

- `npm run typecheck` (trzy konfiguracje), `eslint .` bez błędów (17 starych ostrzeżeń `react-refresh`).
- `vitest run`: 2023 zaliczone, 2 nie: `development-etap1-assets.test.ts` wymaga plików `art/production/development/v001`,
  których ten checkout (sparse) nie zawiera; CI ma pełny checkout.
- Nowe testy: `navigation-staff-spot`, rozszerzony `staff-map-runtime`, `scenery-thinning`, `open-fields`, trzy w
  `map-terrain-canvas`.
- Zrzuty w grze (lokalny serwer na PostgreSQL, nie produkcja): `qa/mapa-swiat/`.
