# Leśna kraina — fundament graficzny v3

## Zakres

Pierwsza mapa startowa z prawdziwych, oddzielnych zasobów. Spłaszczone `village-v2.webp` pozostaje referencją i archiwum; renderer nie używa go jako świata ani minimapy.

- Świat: 3072×2048 jednostek, siatka 96×64, kafelek 32 jednostki.
- Tekstury: trawa, ziemia, bruk i woda, osobne pliki PNG 128×128.
- Teren: 49 klatek RGBA po 64×64, atlas z dwupikselowym marginesem i czteropikselowym odstępem. Renderowanie skaluje kafelek do 32 jednostek.
- Autotiling: 16 kombinacji wspólnych narożników na materiał, cztery warstwy: trawa, ziemia (również pod brukiem), bruk, woda. Maska biliniowa daje wspólne wagi na sąsiednich krawędziach. Przeciwległe krawędzie materiałów są wyrównane podczas eksportu.
- Obiekty: 12 niezależnych przezroczystych sprite’ów oraz atlas 1536×1152: dąb, jodła, krzew, skały, dom, gospoda, kuźnia, stragan, fontanna, latarnia, most i płot.
- Mapa: 291 obiektów, definiowanych danymi, bez ukrytych budynków w tle. Minimapę 768×512 złożono z tych samych danych i eksportów.
- Świat ma górny widok 2D, bez izometrycznej siatki. Budynki są ustawione północ–południe; dach dominuje, od południa pozostaje niewielka część wejścia.

## Pliki

| Plik / katalog                                                                                              | Przeznaczenie                                                      |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `public/game/assets/forest-v3/grass.png`, `soil.png`, `stone.png`, `water.png`                              | Materiały bazowe                                                   |
| `public/game/assets/forest-v3/terrain.png`                                                                  | Runtime atlas kafelków z przejściami i ekstruzją                   |
| `public/game/assets/forest-v3/objects.webp`, `objects.json`                                                 | Runtime atlas niezależnych obiektów                                |
| `public/game/assets/forest-v3/{oak,fir,bush,rock,cottage,inn,forge,market,fountain,lamp,bridge,fence}.webp` | Niezależne eksporty każdego obiektu                                |
| `public/game/assets/forest-v3/minimap.webp`                                                                 | Miniatura rzeczywistej mapy                                        |
| `public/game/assets/forest-v3/manifest.json`                                                                | Wymiary, źródła, hashe SHA-256, kadry i opis obróbki               |
| `src/game/world/forest-map.json`                                                                            | Wierzchołki terenu, warstwy, obiekty, punkty startowe i most       |
| `src/game/world/forest.ts`                                                                                  | Typy, maski i kolizje                                              |
| `src/game/world/renderForest.ts`                                                                            | Kafelki, cienie, osobne sprite’y i kolejność Y                     |
| `scripts/build_forest.py`                                                                                   | Powtarzalny eksport offline z czterech oryginalnych obrazów OpenAI |

## Skala, kotwiczenie i warstwy

Wszystkie obiekty mają zapisane osobno wymiary świata i punkt zakotwiczenia (0.5, 0.5). Pozycja obiektu jest punktem sortowania Y. Obszar kolizji jest osobnym footprintem; korona drzewa nie jest pełnym prostokątem kolizji. Domy, skały, fontanna, słupki i płoty mają różne footprinty. Rzeka jest nieprzechodnia, z otwartym przejściem pod mostem.

Kafelki: głębokości −1000..−997. Most: −20, cienie: −10, pozostałe obiekty i istniejące postacie: pozycja Y. Dzięki temu korona lub dach może przesłonić postać przechodzącą po północnej stronie obiektu. Nie dodano pathfindingu ani nowego systemu ruchu.

Renderowanie używa jednego atlasu terenu i jednego atlasu obiektów; atlas obiektów zajmuje ok. 6.75 MiB po dekodowaniu RGBA, teren ok. 1 MiB. Warstwy terenu mają culling. Nie oznacza to pomiaru FPS na fizycznym telefonie.

## Pochodzenie i obróbka

Wygenerowano cztery oddzielne arkusze narzędziem OpenAI ImageGen: materiały, roślinność/skały, budynki i dekoracje. Narzędzie nie udostępnia wyboru ani dokładnej wersji modelu. Nie użyto płatnego zewnętrznego API ani nowej usługi hostingowej.

Wspólna specyfikacja promptów: wysokiej jakości ręcznie malowana grafika fantasy 2D z góry, naturalna leśna paleta, światło z lewego górnego rogu, bez izometrii, tekstu i plansz prezentacyjnych. Dla obiektów żądano izolowanych sylwetek na przezroczystym tle. Dla materiałów żądano płaskich, powtarzalnych tekstur bez obiektów i perspektywy. Arkusze źródłowe są wskazane nazwami i hashami w manifeście; skrypt przyjmuje katalog z tymi oryginałami.

Obróbka Pillow/NumPy: ekstrakcja kadrów po kontroli arkuszy, usunięcie słabego halo dekoracji z kanału alpha, przycięcie przezroczystego marginesu, skalowanie Lanczos, pakowanie atlasu, wyrównanie szwów materiałów, maski przejść, ekstruzja, generowanie danych świata i minimapy. Wyeksportowane pliki działają bez ponownego generowania obrazów i bez zależności Python w przeglądarce.

## Kontrola jakości i granice etapu

- Sprawdzono identyczność przeciwległych krawędzi czterech materiałów.
- Sprawdzono 12 kanałów alpha i położenie klatek wewnątrz atlasu.
- Testy weryfikują zgodność wszystkich masek mapy, poprawność indeksów, wolne punkty startowe, blokady rzeki i przejście mostem.
- Pełny TypeScript, build oraz testy aplikacji uruchamiane przed publikacją.
- Ostateczny wygląd trzeba oceniać w działającym silniku; miniatura jest narzędziem kontroli, nie dowodem akceptacji artystycznej.

To etap 1. Istniejąca czterokierunkowa postać, statyczne dziki i demonstracyjne elementy GUI pozostają wcześniejszymi komponentami; nie są ukończeniem etapów 2–6. Osiem kierunków, animacje walki, pathfinding, łupy, trwały zapis i multiplayer pozostają do wykonania. Nie przechodzić do nich przed akceptacją mapy.
