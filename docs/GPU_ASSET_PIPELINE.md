# Ki Legends — produkcyjny pipeline GPU → anime 2D

Kontrakt etapu przed GPU, 2026-10-20. Silnik: Phaser **4.2.1**, TypeScript, React. Bez uruchamiania GPU, modeli AI, backendu i publikacji. Domyślna gra nadal używa człowieka na czterech kontynentach. Ten dokument i pliki maszynowe są specyfikacją wejściową dla produkcji grafiki.

## Źródła prawdy

| Plik | Zastosowanie |
| --- | --- |
| `src/game/assets/schema.ts` | Wspólny walidator manifestu; import i runtime |
| `art/pipeline/gpu-pack.schema.json` | JSON Schema draft-07 dla systemu generującego paczki |
| `src/game/assets/contract.ts` | Wymiary, kierunki, FPS i limity |
| `art/pipeline/gpu-production-targets.json` | Wyeksportowane rzeczywiste rozmiary, kotwice, footprinty, współrzędne i klucze czterech map |
| `art/pipeline/examples/hero-production.template.json` | Kompletny szablon produkcyjnego bohatera: 416 klatek, dwie strony atlasu |
| `art/pipeline/examples/technical-delivery/manifest.json` | Gotowa, walidowalna neutralna paczka diagnostyczna |
| `src/game/assets/imported.json` | Aktywne wersje zainstalowanych paczek; zmiana podlega code review |

JSON Schema sprawdza strukturę. `assets:import` dodatkowo dekoduje obrazy, sprawdza klatki, trim, przezroczystość, powiązania i budżet świata. Sam poprawny JSON nie oznacza poprawnego assetu.

## Skala wynikająca z działającej gry

- Bohater i NPC: **96×96 jednostek**, stopy **(0.5, 0.95)**. Przeciwnik: **84×84**, kotwica **(0.5, 0.8)**. Nie powiększamy teraz postaci.
- Obecny renderer ma `resolution=1`. Postać ma ok. **46 px** przy mobilnym zoomie 0.48, **60 px** przy desktopowym 0.62, maks. **96 px** przy zoomie 1. Zakres zoomu 0.35–1 pozostaje.
- Obecny ludzki arkusz 1254² jest dzielony na 4×4 klatki po 313 px (2 px niewykorzystanego brzegu). Nowy format nie dziedziczy tego historycznego układu.
- Render źródłowy **512×512 RGBA PNG** przechowujemy jako master. Paczka klienta używa **128×128** pełnego canvasu klatki: więcej niż maksymalny obecny rozmiar ekranowy, bez kosztu 512² na każdą klatkę w przeglądarce.
- 416 nieprzyciętych klatek 128² to 26 MiB RGBA: atlas 2048×2048 i 2048×1280. Klatki 512² zajęłyby 416 MiB przed narzutem, a 256² — 104 MiB. Dlatego nie wysyłamy masterów 512 do gry.
- Zmiana rozdzielczości renderera/DPR lub skali świata wymaga ponownego pomiaru i wersji kontraktu. Master 512 pozwala ponownie zbudować zasoby bez nowych renderów; aktualny importer wymaga klienta 128.

Kamera renderów: ortograficzna, elewacja **60°**, roll 0, widoczna południowa fasada, światło z północnego zachodu. To kontynuacja poprzedniego kontraktu. Najpierw porównać jeden render kontrolny w istniejącej wiosce i zatwierdzić ustawienie przed całą serią. Zakaz osobnego losowania kamery, stroju, twarzy lub światła dla kolejnych klatek.

## Animacje i mechanika

Kierunki według nazw świata: `down`, `down-left`, `left`, `up-left`, `up`, `up-right`, `right`, `down-right`. Dodatnie Y oznacza dół ekranu. Nazwa klatki: `{actor}/{state}/{direction}/{frame:02}`, indeks od `00`.

| Stan | Klatek / kierunek | FPS | Pętla | Uzasadnienie |
| --- | ---: | ---: | --- | --- |
| idle | 8 | 6 | tak | spokojny cykl 1.33 s |
| walk | 8 | 16 | tak | cykl 0.5 s, taki jak dotychczasowe 4 klatki przy 8 FPS; prędkość 205 jednostek/s niezmieniona |
| attack | 8 | 16 | nie | 0.5 s mieści się w 650 ms odnowienia ataku |
| skill | 8 | 12 | nie | 0.67 s, poniżej najkrótszego odnowienia umiejętności ofensywnej 3.5 s |
| hit | 4 | 16 | nie | krótka reakcja 0.25 s; nie blokuje mechaniki |
| death | 8 | 10 | nie | 0.8 s, potem ostatnia klatka aż do faktycznego odrodzenia |
| respawn | 8 | 12 | nie | 0.67 s prezentacji po zdarzeniu odrodzenia |

Bohater i przeciwnik: 52 klatki × 8 kierunków = **416**. Profil `npc` wymaga idle/walk: **128** klatek. `run` jest obsługiwany jako opcjonalny stan metadanych, ale gra nie ma sprintu, więc standardowy eksport go nie produkuje ani nie uruchamia.

Obrażenia i zużycie KI nadal wynikają z `GameSession`, **natychmiast przy poprawnej akcji**. Klatka kontaktu ataku/umiejętności to **0**; dalsze klatki pokazują wykończenie ruchu. Nie renderować długiego wind-upu sugerującego późniejsze naliczenie obrażeń. Pocisk jest prezentacją istniejącej akcji, nie nową symulacją trafienia. Nie zmieniamy cooldownów, zasięgów ani obrażeń dla dopasowania grafiki.

Adapter obsługuje priorytety death → respawn → hit → skill → attack → ruch. Zdarzenia postaci i przeciwników sterują klipami. Pauza dialogu zatrzymuje animacje aktorów. Brak nowego klipu w dotychczasowych zasobach oznacza dotychczasowy efekt proceduralny i uczciwy fallback, nie duplikowane „klatki animacji”. Cztery stare kierunki człowieka pozostają fallbackiem; neutralny rig demonstruje rzeczywiste osiem kierunków i wszystkie stany.

## Geometria niezależna od grafiki

`src/game/geometry.ts` zachowuje promień kolizji stóp **12** i margines świata **16**; siatka A* nadal ma 24 jednostki. Footprinty obiektów są w definicjach map, nie w atlasach.

Obecna walka sprawdza odległość między punktami stóp i linię widzenia: atak 78, płomień 110, impuls 300, atak przeciwnika 68. Nie są to pikselowe hurtboxy wyliczane z sylwetki. Obszary wyboru myszą: NPC 84×125, przeciwnik 100×125, łup 74×60, dolna tolerancja 20 jednostek. Tych wartości importer nie przyjmuje i nie zmienia.

Włosy, broń, ubranie i aura nie mogą powiększać fizycznego collidera. Stopy muszą pozostać w tej samej znormalizowanej kotwicy we wszystkich klatkach. Osobno renderować aurę i kontaktowy cień; podstawowy cień zapewnia silnik.

## Blender / GPU — gotowe zlecenie

1. Zachować `.blend`, rig, tekstury i identyfikację kanonicznej postaci na trwałym dysku, poza publiczną paczką gry.
2. Jeden rig i jedna tożsamość, kamera/światło zablokowane. Renderować akcje, nie 416 niezależnych promptów ilustracyjnych.
3. Wyeksportować dokładnie wskazane PNG: 512×512, RGBA, 8 bitów/kanał, sRGB, bez tła i napisów. Stopy `(256,486.4)` w canvasie 512; po skalowaniu `(64,121.6)` w 128.
4. Przynajmniej **8 px pustego brzegu w masterze**, odpowiadające **2 px** w paczce klienta. Nie przycinać włosów, stroju, broni ani energii. Jeśli efekt nie mieści się w canvasie ciała — osobny atlas efektu.
5. Układ plików, gdzie `renders/hero-planetary` jest katalogiem wejściowym:

```text
renders/hero-planetary/
  idle/down/00.png ... 07.png
  idle/down-left/00.png ... 07.png
  ... pozostałe kierunki ...
  walk/<direction>/00.png ... 07.png
  attack/<direction>/00.png ... 07.png
  skill/<direction>/00.png ... 07.png
  hit/<direction>/00.png ... 03.png
  death/<direction>/00.png ... 07.png
  respawn/<direction>/00.png ... 07.png
```

6. Uruchomić lokalne narzędzia CPU w checkoutcie repozytorium z Node 22.18+ i `npm ci`:

```sh
npm run assets:pack -- renders/hero-planetary deliveries/hero-planetary-1.0.0 --id=hero-planetary --world=verdant --profile=hero --version=1.0.0
npm run assets:import -- deliveries/hero-planetary-1.0.0/manifest.json
npm run assets:import -- deliveries/hero-planetary-1.0.0/manifest.json --install
npm run assets:check
npm run typecheck
npm run test
npm run build
npm run build:playtest
npm run test:e2e
```

`assets:pack` wymaga dokładnych nazw i liczby klatek, sprawdza master 512 RGBA, skaluje z Lanczos3, odrzuca pustą/uciętą klatkę i tworzy pełne atlasy z metadanymi. Nie nadpisuje istniejącego katalogu dostawy. Wyjście jest walidowane przed atomowym przeniesieniem do docelowego katalogu. Narzędzie przetestowano pełną **neutralną** dostawą 416 klatek; nie wygenerowano docelowego anime.

`assets:import` bez `--install` to walidacja i plan, bez zmiany aktywnego katalogu. Instalacja dodaje pliki pod `public/game/assets/gpu/<id>/<version>-<sha256-prefix>/` i atomowo aktualizuje `imported.json`. Obrazy są normalizowane do bezstratnego WebP, JSON atlasu wskazuje nowy plik. Zmiana istniejącego pakietu wymaga `--replace` i podniesienia wersji; ten sam pakiet jest idempotentny. Starych plików nie kasujemy. Żadne pole zapisu postaci nie jest dotykane.

## Inne formaty i manifest

Importer przyjmuje PNG/WebP z prawdziwymi pikselami 8-bitowymi, image, spritesheet lub Phaser JSON hash. Odrzuca zdalne URL, ścieżki wychodzące poza dostawę, uszkodzone obrazy, brakujące klatki, błędne wymiary, zduplikowane identyfikatory, obrót ramek oraz błędny trim. Atlas maks. **2048 px na bok**, wejście obrazu maks. 32 MiB, zoptymalizowany obraz maks. 8 MiB. Aktywny świat maks. **128 MiB bazowych tekstur RGBA**, z rezerwą **25 165 824 B** na sześć chunków terenu Verdantii; to budżet, nie gwarancja FPS ani pełny pomiar pamięci GPU.

Atlasy mogą być trimowane przy zachowaniu `sourceSize` i `spriteSourceSize` oraz stałej kotwicy; `rotated` musi być false. Pola `pivot`/`anchor` w klatkach są odrzucane: Phaser nadpisuje nimi kotwicę przy każdej zmianie klatki; kotwica pochodzi wyłącznie z konfiguracji aktora/mapy. Repeatable terrain/weather nie może być trimowane. Packer postaci świadomie zachowuje pełne canvasy i przezroczyste brzegi. Ręczny packer obiektów musi zapewnić padding/extrude przeciw przeciekom; obiekt nie może dotykać sąsiedniej ramki.

Spritesheet: `frameWidth`/`frameHeight`, bez zewnętrznego spacingu, pełne komórki; kierunki i kolejność klatek są w `clips.<state>.directions`, bez założeń silnika o układzie rzędów. Jedna animacja odwołuje się do jednej strony atlasu; różne stany mogą używać różnych stron. Packer nie dzieli pojedynczego klipu pomiędzy strony.

Przykład wymiany obiektu i podłoża, bez zmian współrzędnych ani walki:

```json
{
  "renderBindings": {
    "object.sanctum": { "asset": "aether-buildings", "frame": "sanctum", "fit": "contain", "layer": "objects" },
    "object.aether.sanctum-main": { "asset": "aether-buildings", "frame": "sanctum-variant", "fit": "contain" },
    "terrain.aether-ground": { "asset": "aether-terrain", "frame": "grass", "tileSize": [64, 64] },
    "atmosphere.aether": { "asset": "aether-mist", "tileSize": [512, 512] },
    "effect.shield": { "asset": "ki-effects", "frame": "shield" }
  }
}
```

Konkretne identyfikatory instancji pobierać z pliku targets, nie zgadywać z przykładu. `fit=contain` domyślnie chroni proporcje nowej grafiki w istniejącym polu obiektu; dotychczasowe obrazy zachowują zaakceptowany rozmiar. Kotwica i footprint nadal pochodzą z mapy. `tileSize` oznacza jednostki świata, więc zamiana kafla 64 na 128 px nie podwaja wzoru na ziemi.

`actorBindings`: `verdant.hero`, `aether.hero`, `nexus.hero`, `pyra.hero`; NPC np. `aether.npc.guide`, przeciwnik `pyra.enemy`. Globalne fallbacki to `hero.human-v2`, `npc`, `enemy`. Docelowa grafika NPC nie dostaje automatycznie starego tintu, chyba że jawnie ustawi `tintable=true`.

`effects`: globalne `flame`, `pulse`, `attack`, `hit`, `shield`, `heal`, `level`, `loot`, `death`, `respawn`, `enemy-attack` lub np. `pyra.flame` jako wariant świata. Definicja zawiera `asset`, listę `frames`, `fps`, `size` w jednostkach świata i `durationMs`; ładowane są efekty globalne i bieżącego kontynentu. Bez wpisu pozostaje działający efekt proceduralny.

### Szczególny przypadek Verdantii

Zachowujemy zaakceptowany układ lasu. Atlas podłoża **1904×1904**, komórka **64**, margin **2**, spacing **4**, siatka **28×28**. Komórka źródłowa 64 px jest w obecnym lesie skalowana do **32 jednostek świata**; nie pomylić jej z kaflami 64 jednostek w trzech nowych krainach. Indeksy 0–15 to trawa, kolejne grupy po 256 to soil/stone/water zgodnie z `forest.ts` i `build_anime_forest.py`. Cztery warstwy danych pozostają. Domyślnie są składane raz, wraz ze statycznymi cieniami, do sześciu tekstur po 1024²; oryginalny renderer tilemap zachowano jako fallback przez `STATIC_TERRAIN_CACHE_ENABLED=false`. Zamiana `terrain.verdant` wymaga pełnego obrazu w tym układzie, bez atlasowego `frame` ani `tileSize`.

Obiekty lasu mogą być zastępowane osobnymi referencjami atlasowymi `object.forest.oak` itd. oraz konkretnymi instancjami `object.verdant.<id>`. Nie trzeba przerabiać mapy na jednolity obraz.

## Warstwy, ładowanie, rollback

Podłoże i ścieżki → dekoracje pod stopami → obiekty i aktorzy sortowani po Y stóp → overhead → atmosfera → walka → etykiety/sterowanie. Las ma osobne warstwy masek terenu. Chunki podłoża i obiekty poza kamerą są culled; cienie statyczne są wypalone wyłącznie w warstwie pod stopami i nie tworzą osobnych obiektów każdej klatki. Cache nie zawiera budynków, koron, aktorów ani footprintów. Zwolnienie sceny usuwa wygenerowane tekstury; zasłaniająca grafika nadal przygasa do 0.28. Nie wolno wypalać całego miasta ani mapy do jednej tekstury.

Scena ładuje tylko referencje bieżącego świata, aktorów i efektów. Ilustracje pochodzenia nie są sprite'ami. Neutralny rig nie jest ładowany w normalnej grze; podgląd jest dostępny wyłącznie pod lokalnym `/scripts/playtest.html?ki-art=technical`.

Brak zasobu, uszkodzony atlas lub brak klatki daje nazwany błąd ładowania i przycisk ponowienia. Procent pochodzi z loadera Phaser. Błąd nie kasuje zapisu. Sprzątanie obejmuje `SHUTDOWN`, `DESTROY`, komendy, zoom, etykiety, focus, zapis i telemetryczny `postrender`.

Rollback: przywrócić poprzedni commit samego `src/game/assets/imported.json` i przebudować w gałęzi/PR. Stare wersjonowane pliki pozostają; nie usuwać ich automatycznie. Gdy paczka wraca do starszej wersji przez importer, użyć jawnego `--replace`. Każda aktualizacja przechodzi QA i review. Ten etap **nie publikuje** niczego automatycznie.

## Kontrola jakości i pomiary

```sh
npm run assets:targets
npm run assets:schema
npm run assets:check
npm run typecheck
npm run test
npm run lint
npm run build
npm run build:playtest
npm run test:e2e
# W osobnym terminalu, po uruchomieniu lokalnego preview/playtest:
npm run bench:game
KI_BENCH_WEBGL=1 npm run bench:game
```

Walidacja struktury/pikseli nie ocenia tożsamości, płynności ruchu, poprawności kończyn, rytmu kroków ani zgodności kamery z ilustracjami. Przed masową generacją potrzebna jest akceptacja jednego wzorca w grze; potem cztery rasy, NPC/fauna, świat i efekty. Wyniki lokalnej/CI regresji oraz rzeczywistych pomiarów znajdują się w `docs/PRE_GPU_STABILIZATION.md`. Fizyczny Android i jakość jeszcze nieistniejącej oprawy nie są oznaczane PASS na podstawie headless Chromium.
