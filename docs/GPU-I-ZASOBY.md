# KI Legends — GPU i zasoby


## Partia 2 i braki do docelowej oprawy — 23.10.2026

Dostawę `8b0a814` z `assets/world-kit-for-codex-20261023` połączono na osobnej
`feature/superior-runtime-20261023` (merge `53a5688`). Dziewięć kolejnych paczek:
bagna, góry, dżungla, loch, wnętrza czterech ras oraz fauna neutralna.
Aktualny katalog zawiera **302 obiekty i 31 powierzchni**; opis partii 1 poniżej
jest zapisem zakresu pierwszego odbioru. Zachowano otrzymany JSON w
[QA partii 2](zmiany/2026-10-23/qa/world-kit-batch2/).
Nie importowano niezwiązanej rozbudowy `feat/continent-worlds`.

[Audyt instalacji](zmiany/2026-10-23/qa/superior-runtime/art-gaps.json): źródłowe
40 paczek `deliveries/enemy-*-1.0.0` były już w repozytorium. Pierwsza kontrola
obejmowała tylko aktywny katalog i wykazała zastępczego dzika; nie stanowiła dowodu
braku źródłowych grafik. Po wskazaniu paczek przez właściciela zainstalowano komplet.
Nie jest potrzebna ponowna generacja tych 40 potworów.

`scripts/worldgen/pack-enemy-atlases.mjs` pakuje puste marginesy do atlasów z `trim`,
zachowując sourceSize 128², nazwy wszystkich 416 klatek, pozycję w pełnej klatce,
FPS, klipy, rozmiar 84×84 i kotwicę `(0.5,0.8)`. Wersja pochodna 1.0.1 przechodzi
zwykły importer; oryginalne paczki 1.0.0 pozostają bez zmian. Bufory RGBA są
kopiowane bez przeskalowania i mieszania koloru. Hashe zrekonstruowanych widocznych
pikseli wszystkich 16 640 klatek są identyczne przed i po pakowaniu.
Łączna pamięć rozkodowanych atlasów biblioteki spadła z 1040 do 418,25 MiB;
**biblioteka nie jest ładowana w całości do sceny**. Zwykłe mapy pobierają tylko
zadeklarowane rodzaje; wyprawa pobiera atlasy aktywnych slotów i ich przywołań.
Dowody: [pakowanie](zmiany/2026-10-23/qa/superior-runtime/enemy-packing.json),
[instalacja](zmiany/2026-10-23/qa/superior-runtime/enemy-install.json).

Otwarte grafiki: aktorzy NPC czterech ras oraz ruch neutralnej fauny. Dwanaście części
fauny to obrazy statyczne. Nie zamknięto odbioru artystycznego potworów ani praw.
Lista: `art/production/enemies/roster.json`; obowiązuje kontrakt z
[rozwoju i walki](ROZWOJ-I-WALKA.md#kontrakt-grafiki-potworów).

Oględziny sosny, brzozy, paproci i grupy grzybów z `biome-forest` wykazały
prostokątne wycinki z uciętymi brzegami/sąsiednimi roślinami. Źródła zachowano;
binder używa obejrzanego dębu dla dwóch drzew i kwitnącego krzewu dla dwóch grup.
Grafika `verdant-city-tree` przedstawia dom na drzewie i nie jest zamiennikiem sosny.
Nie zamknięto odbioru artystycznego pozostałych części ani praw do wykorzystania.


## Partia 1 od Claude'a — zasoby do świata CPU

Przyjęto commit `fd2597e` z gałęzi `assets/world-kit-for-codex-20261023` do
`feature/cpu-game-content-20261023`. Zawiera wyłącznie dostawę na bazie świata CPU;
nie importowano `feat/continent-worlds`, kuźni `pyra-smithy` ani zmian kontynentów.
Dziesięć nowych paczek to 138 części: cztery miasta (Pyra 18, pozostałe po 16),
biomy las/śnieg/pustynia/wulkan/wybrzeże i ruiny (po 12).

Maszynowy katalog [world-asset-kit.json](world-asset-kit.json) zawiera 194 wiązania
obiektów i 31 powierzchni. Wszystkie 138 nowych części mają `placement`; 17 starszych
wiązań, głównie wnętrz i lasu, nie ma zaleceń rozmieszczenia. Nie zgadywać ich kolizji.
`python3 scripts/export_world_asset_kit.py` odtwarza katalog z bieżących importów,
regionów i `deliveries/*/placement.json`. Lista `installedSets` pochodzi z checkoutu;
brak wpisów `pending` nie oznacza zakończenia prac GPU poza tą gałęzią.
Oryginalny [opis dostawy](zmiany/2026-10-23/qa/world-kit-intake/claude-delivery-description.txt)
i [otrzymany JSON](zmiany/2026-10-23/qa/world-kit-intake/delivered-world-asset-kit.json)
zachowano jako dowody. Ich starsze liczby i informacje o kuźni nie opisują tej gałęzi.

W obiekcie regionu `asset` odpowiada `regionAsset`, bez prefiksu `object.`.
`x/y` wskazują punkt oparcia, głębokość wynika z Y; rozmiar i `anchorX/anchorY`
kontrolują wyłącznie prezentację. `solid` i footprint pozostają w danych świata.
Zalecenie z katalogu nie zastępuje istniejącego footprintu ani położenia drzwi.
Nie przesuwać wejść i nie powiększać kolizji dla dopasowania ilustracji.

`scripts/worldgen/bind_world_art.py` eksportuje zweryfikowane wejście przez
`--export-input <plik.json>`, następnie składa osobny zestaw prezentacji przez
`--input <plik.json> --world <katalog-browser> --output <nowy-katalog> --workers 8`.
Sprawdza manifesty przed i po pracy; zapisuje przypisania per chunk, budynki,
zasoby, wejścia do lochów i powierzchnie biomów bez modyfikacji danych źródłowych.
Nie jest to jeszcze renderer sceny Phaser. Drzwi widoczne na ilustracjach wymagają
przeglądu względem zachowanych punktów wejścia. Ta partia nie dostarcza animacji
nowych mieszkańców ani potworów. Deklaracje pochodzenia paczek nie zamykają praw
komercyjnych; obowiązuje [rejestr licencji](LICENCJE.md).

Aktualizacja: 23.10.2026. Cztery malowane rasy, tekstury trzech kontynentów i część
przyrody są zainstalowane. Obowiązuje oddzielne podłoże, obiekty, aktorzy i efekty.
**Cykl życia i konfigurację GPU obsługuje wyłącznie właściciel**, także po renderze.

## Co wymaga GPU, a co można zrobić lokalnie

Lokalnie na CPU: montaż/eksport atlasów, import, skala prezentacji, FPS klipów,
poprawki deformacji z istniejących masterów, kolizje, drogi, UI, questy, spawny,
proceduralne efekty i telegrafy, maski terenu oraz optymalizacje.
GPU może być potrzebne do nowych ilustracji/widoków i ponownych generacji.
Nie uruchamiać go do zwykłej korekty rozmiaru postaci ani walidacji paczki.

## Obecny pipeline malowanych postaci

1. `android_pose_keypoints.py` / `planetary_pose_keypoints.py`: osiem kierunków pozy.
2. `painted_views.py`: ControlNet OpenPose + IP-Adapter SDXL + Animagine XL 3.1;
   wejściem zaakceptowany kandydat, nie nowa postać z każdego promptu.
3. `matte_masters.py`: rembg `isnet-anime`, wspólna skala, stopy `(256,486.4)`, 512² RGBA.
4. `animate_painted.py`: siatka 2D i klipy proceduralne, margines `KI_SAFE`.
5. `assets:pack` i walidowany `assets:import`; mastery pozostają poza paczką klienta.

Tożsamości i wady: [rasy](RASY-I-POSTACIE.md). Nie przenosić licencji modelu
na referencję lub cały output. Prawa i dowody: [licencje](LICENCJE.md).

## Źródła prawdy

| Plik                                                     | Zastosowanie                                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/game/assets/schema.ts`                              | Wspólny walidator manifestu; import i runtime                                               |
| `art/pipeline/gpu-pack.schema.json`                      | JSON Schema draft-07 dla systemu generującego paczki                                        |
| `src/game/assets/contract.ts`                            | Wymiary, kierunki, FPS i limity                                                             |
| `art/pipeline/gpu-production-targets.json`               | Wyeksportowane rzeczywiste rozmiary, kotwice, footprinty, współrzędne i klucze czterech map |
| `art/pipeline/examples/hero-production.template.json`    | Kompletny szablon produkcyjnego bohatera: 416 klatek, dwie strony atlasu                    |
| `art/pipeline/examples/technical-delivery/manifest.json` | Gotowa, walidowalna neutralna paczka diagnostyczna                                          |
| `src/game/assets/imported.json`                          | Aktywne wersje zainstalowanych paczek; zmiana podlega code review                           |

JSON Schema sprawdza strukturę. `assets:import` dodatkowo dekoduje obrazy, sprawdza klatki, trim, przezroczystość, powiązania i budżet świata. Sam poprawny JSON nie oznacza poprawnego assetu.

## Skala wynikająca z działającej gry

- Kontrakt importu bohatera/NPC: **96×96 jednostek** (runtime bohatera 160×160), stopy **(0.5, 0.95)**. Przeciwnik: **84×84**, kotwica **(0.5, 0.8)**. Powiększenie dotyczy prezentacji bohaterów, nie colliderów ani źródłowych klatek.
- Rozdzielczość renderera i kamera wymagają pomiaru na docelowym urządzeniu; zoom pozostaje niezależny od rozdzielczości atlasu.
- Obecny ludzki arkusz 1254² jest dzielony na 4×4 klatki po 313 px (2 px niewykorzystanego brzegu). Nowy format nie dziedziczy tego historycznego układu.
- Render źródłowy **512×512 RGBA PNG** przechowujemy jako master. Paczka klienta używa **128×128** pełnego canvasu klatki: więcej niż maksymalny obecny rozmiar ekranowy, bez kosztu 512² na każdą klatkę w przeglądarce.
- 416 nieprzyciętych klatek 128² to 26 MiB RGBA: atlas 2048×2048 i 2048×1280. Klatki 512² zajęłyby 416 MiB przed narzutem, a 256² — 104 MiB. Dlatego nie wysyłamy masterów 512 do gry.
- Zmiana rozdzielczości renderera/DPR lub skali świata wymaga ponownego pomiaru i wersji kontraktu. Master 512 pozwala ponownie zbudować zasoby bez nowych renderów; aktualny importer wymaga klienta 128.

Kamera renderów: ortograficzna, elewacja **60°**, roll 0, widoczna południowa fasada, światło z północnego zachodu. To kontynuacja poprzedniego kontraktu. Najpierw porównać jeden render kontrolny w istniejącej wiosce i zatwierdzić ustawienie przed całą serią. Zakaz osobnego losowania kamery, stroju, twarzy lub światła dla kolejnych klatek.

## Animacje i mechanika

Kierunki według nazw świata: `down`, `down-left`, `left`, `up-left`, `up`, `up-right`, `right`, `down-right`. Dodatnie Y oznacza dół ekranu. Nazwa klatki: `{actor}/{state}/{direction}/{frame:02}`, indeks od `00`.

| Stan    | Klatek / kierunek | FPS | Pętla | Uzasadnienie                                                                          |
| ------- | ----------------: | --: | ----- | ------------------------------------------------------------------------------------- |
| idle    |                 8 |   6 | tak   | spokojny cykl 1.33 s                                                                  |
| walk    |                 8 |  16 | tak   | cykl 0.5 s, taki jak dotychczasowe 4 klatki przy 8 FPS; ruch zależy od rasy i poziomu |
| attack  |                 8 |  16 | nie   | 0.5 s mieści się w 650 ms odnowienia ataku                                            |
| skill   |                 8 |  12 | nie   | 0.67 s, poniżej odnowień wynikających z kitu                                          |
| hit     |                 4 |  16 | nie   | krótka reakcja 0.25 s; nie blokuje mechaniki                                          |
| death   |                 8 |  10 | nie   | 0.8 s, potem ostatnia klatka aż do faktycznego odrodzenia                             |
| respawn |                 8 |  12 | nie   | 0.67 s prezentacji po zdarzeniu odrodzenia                                            |

Bohater i przeciwnik: 52 klatki × 8 kierunków = **416**. Profil `npc` wymaga idle/walk: **128** klatek. `run` jest obsługiwany jako opcjonalny stan metadanych, ale gra nie ma sprintu, więc standardowy eksport go nie produkuje ani nie uruchamia.

Obrażenia i zużycie KI nadal wynikają z `GameSession`, **natychmiast przy poprawnej akcji**. Klatka kontaktu ataku/umiejętności to **0**; dalsze klatki pokazują wykończenie ruchu. Nie renderować długiego wind-upu sugerującego późniejsze naliczenie obrażeń. Pocisk jest prezentacją istniejącej akcji, nie nową symulacją trafienia. Nie zmieniamy cooldownów, zasięgów ani obrażeń dla dopasowania grafiki.

Adapter obsługuje priorytety death → respawn → hit → skill → attack → ruch. Zdarzenia postaci i przeciwników sterują klipami. Pauza dialogu zatrzymuje animacje aktorów. Brak nowego klipu w dotychczasowych zasobach oznacza dotychczasowy efekt proceduralny i uczciwy fallback, nie duplikowane „klatki animacji”. Cztery stare kierunki człowieka pozostają fallbackiem; neutralny rig demonstruje rzeczywiste osiem kierunków i wszystkie stany.

## Geometria niezależna od grafiki

`src/game/geometry.ts` zachowuje promień kolizji stóp **12** i margines świata **16**; siatka A* nadal ma 24 jednostki. Footprinty obiektów są w definicjach map, nie w atlasach.

Walka sprawdza odległość punktów stóp i linię widzenia; zasięg wynika z kitu i zdolności. Nie wyliczamy hurtboxa z pikseli sylwetki. Importer nie zmienia geometrii interakcji.

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
    "object.sanctum": {
      "asset": "aether-buildings",
      "frame": "sanctum",
      "fit": "contain",
      "layer": "objects"
    },
    "object.aether.sanctum-main": {
      "asset": "aether-buildings",
      "frame": "sanctum-variant",
      "fit": "contain"
    },
    "terrain.aether-ground": { "asset": "aether-terrain", "frame": "grass", "tileSize": [64, 64] },
    "atmosphere.aether": { "asset": "aether-mist", "tileSize": [512, 512] },
    "effect.shield": { "asset": "ki-effects", "frame": "shield" }
  }
}
```

Konkretne identyfikatory instancji pobierać z pliku targets, nie zgadywać z przykładu. `fit=contain` domyślnie chroni proporcje nowej grafiki w istniejącym polu obiektu; dotychczasowe obrazy zachowują zaakceptowany rozmiar. Kotwica i footprint nadal pochodzą z mapy. `tileSize` oznacza jednostki świata, więc zamiana kafla 64 na 128 px nie podwaja wzoru na ziemi.

`actorBindings`: `verdant.hero`, `aether.hero`, `nexus.hero`, `pyra.hero`; NPC np. `aether.npc.guide`; przeciwnik świata `pyra.enemy` albo — dla konkretnego potwora z bestiariusza — `<świat>.enemy.<slug>` (np. `verdant.enemy.cierniowy-wilk`; walidator `gpu-import.ts` przyjmuje `[a-z0-9]+(-[a-z0-9]+)*`, `actorVisual(świat, "enemy", slug)` je odczytuje, a `worldAssets()` ładuje atlasy wszystkich potworów świata). Globalne fallbacki to `hero.human-v2`, `npc`, `enemy`. Paczki `deliveries/enemy-*` wiążą się kluczami z `art/production/enemies/bindings.json`. Docelowa grafika NPC nie dostaje automatycznie starego tintu, chyba że jawnie ustawi `tintable=true`.

`effects`: globalne `attack` (atak podstawowy każdej rasy), identyfikatory węzłów drzewka zdolności (`A1`, `B4`, `C9`, `T`… — te same w każdej rasie, więc wariant świata, np. `pyra.A1`, jest właściwy), `hit`, `shield`, `heal`, `level`, `loot`, `death`, `respawn`, `enemy-attack`. Stare klucze `flame` i `pulse` (zdolności Etapu 2) nie są już wywoływane. Definicja zawiera `asset`, listę `frames`, `fps`, `size` w jednostkach świata i `durationMs`; ładowane są efekty globalne i bieżącego kontynentu. Bez wpisu pozostaje działający efekt proceduralny.

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

Lokalny podgląd pełnego artefaktu Cloudflare/Nitro (bez publikacji):

```sh
npm run build
WRANGLER_SEND_METRICS=false npm exec --yes --package=wrangler@4.151.3 -- wrangler dev --config .output/server/wrangler.json --local --port 4186
# W drugim terminalu:
KI_QA_BASE_URL=http://127.0.0.1:4186 npm run test:e2e -- e2e/stage3.spec.ts --grep 'A/B/C'
```

Genericzne `npm run preview` z TanStack szuka `dist/server/server.js` i nie odpowiada układowi tego Cloudflare builda. Nie stosować tego polecenia jako testu gotowego workera. Wrangler uruchamiany z `--local` nie publikuje gry i nie wymaga zmiany targetu hostingu. Dokładną wersję użytego lokalnego runtime przypięto w przykładzie; nie dodano go do zależności aplikacji.

Walidacja struktury/pikseli nie ocenia tożsamości, płynności ruchu, poprawności kończyn, rytmu kroków ani zgodności kamery z ilustracjami. Przed masową generacją potrzebna jest akceptacja jednego wzorca w grze; potem cztery rasy, NPC/fauna, świat i efekty. Wyniki lokalnej/CI regresji oraz rzeczywistych pomiarów znajdują się w `docs/ARCHITEKTURA-I-TESTY.md`. Fizyczny Android i jakość nowej oprawy nie są oznaczane PASS na podstawie headless Chromium.

## Zainstalowane otoczenie

`aether-terrain-v2`, `nexus-terrain-v2`, `pyra-terrain-v2` zastępują podłoża/ścieżki/place/ściany.
`nature-textures-v1` ma 16 tekstur, `nature-objects-v1` 19 obiektów (eksporty maks. 512 px,
aby mieścić się w 128 MiB). Pyra: lawa/wulkany; Aetheria: kryształowa woda, ogrody;
Nexus: energia i lodowe iglice. Nie wszystkie materiały przyrody mają rozmieszczenie.
Verdantia zachowuje zaakceptowany las i pochodny układ miasta.

Eksport lasu: `python3 scripts/build_anime_forest.py SOURCE_DIR scripts/anime-sources.json`.
Prompty i hashe: `docs/ANIME-GENERATION-PROMPTS.json` oraz manifest lasu.
Materiały mają zgodne przeciwległe krawędzie; obiekty oddzielną alfę i footprinty.
Nie wracać do historycznego forest-v3 jako aktualnej grafiki tylko dlatego, że nadal
jest w repo i rejestrze praw. Dane i źródła zachować do weryfikacji pochodzenia.

## Kolejka produkcji — po próbce i akceptacji

| Priorytet | Zakres                           | Rozmiar zamówienia bazowego                                                |
| --------- | -------------------------------- | -------------------------------------------------------------------------- |
| P0        | Unikalne budynki usługowe        | 6 × 4 obecne miasta = 24 obiekty                                           |
| P0        | Wnętrza i rekwizyty              | 6 wnętrz × 4 rasy = 24; 6 typów rekwizytów × 4 = 24                        |
| P0        | Mieszkańcy                       | 8 × 4 = 32 NPC; profil 128 klatek, razem 4096                              |
| P0        | Podłoże i przejścia              | Warianty ground/path/plaza i dekale; dokładny spis po próbce               |
| P1        | Domy, bramy, mostki, ulica       | 24 domy, 12 bram/mostków, 32 obiekty uliczne jako punkt startowy           |
| P1        | Portrety i ikony                 | 32 portrety, 116 ikon węzłów; materiały wg aktualnego katalogu             |
| P1        | Efekty i aury                    | Około 64 pętle zdolności i 4 aury KI; oddzielone od ciała                  |
| P1        | Bossowie                         | 8 nowych projektów z księgi; najpierw decyzja o ich wyglądzie i kontrakcie |
| P2        | Statusy, pociski, ekrany         | 14 statusów, ok. 12 pocisków, 8 ekranów pion/poziom                        |
| Opcja     | Bohaterowie v2 / warstwy sprzętu | Nowa metoda animacji i zakres widocznego wyposażenia do decyzji            |

Usunięto błąd starej listy „6 × 5 miast = 30”: repo ma cztery obecne miasta,
Verdantia jest jednym z nich. Nie sumujemy jej drugi raz. To budżet planowania,
nie stwierdzenie wykonania ani zamówienie uruchomienia GPU.
Próbki: jedna fasada, wnętrze z rekwizytem, pełny NPC i materiał z przejściem.
Po akceptacji w runtime dopiero pełna dostawa. Każda: manifest, provenance, SHA-256,
import, kontrola pamięci, właściwe źródła i raport w dzienniku dnia.

## Odtwarzanie oprogramowania na działającej instancji

Na instancji wybranej i uruchomionej przez właściciela: bootstrap
`scripts/gpu/bootstrap-runtime-v2.sh`, trwała kopia pod `/workspace/ki-legends-gpu/`.
Historyczne aliasy `ki-gpu-check`, `ki-blender-python`, `ki-assets-current` i
`ki-comfy-start` odnoszą się do przygotowanego runtime; ich obecność sprawdzić,
nie zakładać po zmianie obrazu kontenera. ComfyUI: lokalnie 8189, proxy 8188;
nie obiecywać publicznego endpointu ani zmieniać portów bez uprawnienia.
Bootstrap wymaga zgodnego Pythona/runtime. Dane o wcześniejszym `/opt`, archiwach,
checkpointach i przywróceniu są dowodami historycznymi w dziennikach, nie odczytem
aktualnego stanu poda. Hasła/auth nie mogą trafić do kopii ani raportów.


## Zestaw grafik do układania świata — kontrakt (23.10.2026)

Codex układa świat i questy (współrzędne, obiekty, NPC, spawny). Ten dokument mówi, **z czego** może
układać i **jak**, żeby grafika, kolizje i kolejność rysowania zgadzały się bez zgadywania.
Maszynowy opis: [`world-asset-kit.json`](world-asset-kit.json), generowany przez
`python3 scripts/export_world_asset_kit.py` (po każdym imporcie paczki uruchomić ponownie).

### Co jest w zestawie

- `objects` — 72 wiązania obiektów (`object.*`) z gotowymi **zalecanymi wymiarami, punktem oparcia
  i obrysem kolizji** (mediany z dotychczasowych regionów). Pole `placement` = ściągawka do wpisu w JSON regionu.
- `terrains` — 33 wiązania powierzchni (`terrain.*`): podłoże, ścieżki, place, ściany, strefy.
- `pending` — zestawy wygenerowane na GPU, jeszcze nie zainstalowane (miasto Pyry, 494 tekstury, krajobraz
  i fauna). Nie układać ich w regionach, dopóki nie pojawią się w `objects`/`terrains`.

### Jak układać obiekt (region JSON, `objects[]`)

```json
{
  "id": "fortress-0",
  "kind": "fortress",
  "asset": "fortress",
  "x": 34404,
  "y": 2987,
  "width": 570,
  "height": 390,
  "anchorX": 0.5,
  "anchorY": 0.92,
  "solid": true,
  "footprint": { "width": 470, "height": 160 }
}
```

- `asset` = klucz po `object.` z `world-asset-kit.json` (`regionAsset`). Silnik bierze wiązanie
  `object.<świat>.<id>` przed `object.<asset>`.
- `x, y` to **stopa** obiektu (punkt oparcia na ziemi). Kolejność rysowania = `y`: postać przed pniem
  zasłania go, za koroną jest przez nią zasłaniana. Nie ustawiać ręcznej głębokości.
- Kolizja pochodzi wyłącznie z `solid` + `footprint` w JSON-ie regionu, **nigdy z grafiki**. Obrys ok.
  60 % szerokości i niski (patrz `placement.footprint`). Drzewa mają obrys tylko pnia.
- Cień pod obiektem dodaje silnik sam dla obiektów wyższych niż 56 jednostek na warstwie `objects`
  (nie dla mostów i płaskich elementów). Nie rysować cieni w grafice.
- Drzewa (`kind` zawiera `tree`, `pine`, `bamboo`) nie bledną: postać za koroną jest ukryta. Budynki i
  rekwizyty bledną do 28 %, gdy zasłaniają tułów postaci.
- `layer: below` = płaskie elementy pod postaciami (mosty, kałuże), `overhead` = nad nimi.

### Czego nie ruszać

- Wnętrze kuźni w Pyrze to **pionowa sala 540 × 1100** (`SMITHY_ROOM` w `src/game/city/room.ts`); jej
  kolizje są dopasowane do grafik paczki `pyra-smithy`. Inne wnętrza mają układ 960 × 760.
- Miasto = strefa bezpieczna ~4000 × 2500 (`city.bounds`), poza nią walka. Nowe obiekty w mieście nie mogą
  zasłaniać drzwi budynków usługowych (muszą być osiągalne A* ze startu).
- Nie edytować `imported.json` ręcznie ani plików `*.generated.ts`; paczki wchodzą przez
  `npm run assets:import` z podbiciem wersji.

### Zamawianie nowej grafiki

Wpisz potrzebę do `docs/GPU-BACKLOG-2026-10-23.md` (typ, biom/rasa, rozmiar na ekranie, solid tak/nie).
Każda część przechodzi: generowanie na GPU → wybór wariantu przez właściciela → wycięcie tła →
kontur i paczka (`scripts/prepare_*.py`) → import → pojawia się w `world-asset-kit.json`.
Orientacyjnie: kilkanaście części jednego zestawu to godzina pracy GPU plus przegląd właściciela.

### Stan na 23.10.2026

| Zestaw                                                                                                                            | Stan                                                                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Obiekty regionów (świątynie, wieże, drzewa, góry, wulkany, rekwizyty)                                                             | zainstalowane, w `objects`                                                                                                |
| Kuźnia Pyry (18 części, podłoga, ściana, Goro)                                                                                    | zainstalowane (paczka `pyra-smithy` 1.1.0)                                                                                |
| Partia 1: miasta Pyry, Aetherii, Nexus-9, Verdantii; biomy las, śnieg, pustynia, wulkan, wybrzeże; ruiny i rekwizyty (138 części) | zainstalowane (paczki `pyra-city`, `aether-city`, `nexus-city`, `verdant-city`, `biome-*`, `ruins-props`), wersja robocza |
| 494 tekstury krajobrazu + wersja przemalowana                                                                                     | wygenerowane / w trakcie przemalowania                                                                                    |
| Góry, wulkany, skały, drzewa, 8 zwierząt neutralnych                                                                              | wygenerowane próbki, do wyboru                                                                                            |
| Bohaterowie 4 ras w nowym stylu z animacjami                                                                                      | Legendy: trening modelu; Androidy: wybrany wygląd; reszta: koncepty                                                       |


## Krajobraz planety i neutralna fauna — specyfikacja (23.10.2026)

**Status: SPECYFIKACJA DO ZATWIERDZENIA. Nic z tej listy nie jest wygenerowane ani zaimportowane; liczby i nazwy to propozycje. Uzupełnia GPU-BACKLOG-2026-10-23.md. Pod GPU uruchamia i zatrzymuje wyłącznie właściciel.**

Decyzja właściciela (23.10.2026): cała planeta ma zostać wypełniona. Poprawki animacji i podłoża przy miastach robimy na końcu. Potrzebne jest bardzo zróżnicowane środowisko (skały, góry, wulkany) oraz **neutralne zwierzęta**, które dają pożywienie i inne surowce (osobno od potworów z bestiariusza, które pozostają przeciwnikami).

Zasady wspólne: niezależne zasoby (tekstury `terrain.*`, obiekty `object.*`, aktor `fauna.*`), nigdy gotowa ilustracja świata jako podłoże; kolizje z danych regionów, nie z grafiki; opt-in przez `PREVIEW_SWITCHES` do akceptacji; budżet tekstur 128 MiB na aktywny świat (kontynent ładuje tylko własny zestaw biomów plus wspólne skały); prawa do referencji i checkpointów nadal nierozstrzygnięte (ASSET-LICENSE-REGISTER.md).

### 1. Krajobraz: tekstury podłoża (`terrain.*`)

Kafelkowane, bezszwowe, 512² (kamień i woda 1024²), RGBA tylko dla przejść. Cel: ok. **150 tekstur**, w tym 4 zestawy biomów po ok. 24 plus wspólne.

| Zestaw                       | Zawartość (przykłady)                                                                                                                                                                                                                                                          | Szt.        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| Verdantia (las, rzeka, łąka) | 4 trawy, łąka z kwiatami, ściółka sosnowa, ściółka liściasta, mech, błoto, torf, pole uprawne, brzeg rzeki, kamyki dna, płycizna, głębia, bagno, ścieżka ziemna, bruk, zbocze trawiaste, polana grzybowa, paprocie, wrzosowisko, suchy step, piasek rzeczny                    | 24          |
| Aetheria (woda, ogrody, lód) | kryształowy lód, śnieg, zamarznięte jezioro, szczelina lodowca, mokry kamień, ścieżka z płyt, mchy świątynne, płatki wiśni, ziemia bambusowa, pole ryżowe, trzcina, staw koi, basen wodospadu, szron, szklisty szron, granit górski, tundra, wrzosy alpejskie, kamienne tarasy | 24          |
| Nexus-9 (syntetyczna)        | płyta stalowa, obwody, ciecz energetyczna, wydmy, skorupa pustyni, solnisko, zardzewiony stop, szkło, heksagony, żwir pustkowia, pole lodowe, popiół rdzeni, płyta serwisowa, piasek ze szkła, kable i rury, platforma lądowiska, mokre metale                                 | 24          |
| Pyra (wulkaniczna)           | lawa płynąca, zastygła skorupa, popiół, obsydian, czerwona skała kanionu, spalona ziemia, siarka, skorupa gejzeru, piasek żarowy, spękana glina, czarny piasek, tuf, bazaltowe kolumny (płaskie), pumeks, wypalony las (ziemia), żwir wulkaniczny                              | 24          |
| Wspólne skały i góry         | granit, wapień, bazalt, piaskowiec warstwowy, łupek, marmur, skała lodowa, tuf, rumowisko, zwietrzelina, glina czerwona, żwir, głazy w polu, 8 tekstur ścian klifów (pionowe)                                                                                                  | 30          |
| Przejścia (maski krawędzi)   | trawa ↔ skała, trawa ↔ piasek, śnieg ↔ skała, lawa ↔ popiół, woda ↔ brzeg, metal ↔ piasek i inne, 4 warianty krawędzi na parę                                                                                                                                                  | 24          |
| **Razem**                    |                                                                                                                                                                                                                                                                                | **ok. 150** |

### 2. Krajobraz: obiekty (`object.*`, RGBA)

| Rodzaj                          | Opis                                                                                                                                | Szt.        |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Góry i szczyty                  | po 6 na kontynent (3 rozmiary × 2 warianty): granitowe, lodowe, bazaltowe, czerwone, skalne iglice, płaskowyże                      | 24          |
| Wulkany                         | czynny z dymem, uśpiony, kaldera z jeziorem lawy, stożek popiołowy, komin gejzeru (po 2 warianty), chmura popiołu (nakładka)        | 12          |
| Formacje skalne                 | łuki, iglice, mesy, grzyby skalne, kolumny bazaltowe, stalaktyty lodu, wysepki skalne                                               | 28          |
| Głazy i klify                   | 3 rozmiary × 8 rodzajów skały, półki klifowe, rozpadliny                                                                            | 40          |
| Drzewa                          | po biomie: iglaste, liściaste, bambus, wiśnia, kryształowe, martwe, spalone, kaktus/sukulent, grzyb olbrzymi, drzewo-antena (Nexus) | 48          |
| Krzewy, kwiaty, trawy, paprocie | wysokie trawy, pola kwiatowe, trzcina, krzaki jagód i ziół (surowce roślinne)                                                       | 36          |
| Woda                            | jeziora i stawy (kształty), wodospady, bystrza, gejzery, kałuże lawy, mostki, kładki, brody                                         | 18          |
| Ruiny Chóru i punkty wiedzy     | filary, bramy, węzły sieci, latarnie wysp, wraki, znaczniki szlaków                                                                 | 30          |
| **Razem**                       |                                                                                                                                     | **ok. 236** |

Rozmiar obiektów: master 1024² (góry i wulkany do 2048 × 1536), klient maks. 512 (góry 1024); cienie wypalane przez silnik.

### 3. Neutralna fauna (`fauna.*`)

Zwierzęta **nie atakują**. Wypasają się lub żerują, uciekają przy zbliżeniu (promień ucieczki 260 j.), wracają po ok. 20 s. Zabicie ich nie daje XP i nie liczy się do zadań z bestiariusza (zasada z Księgi: surowców z obowiązkowych napraw nie wiążemy z losowym łupem). Dają **pożywienie i surowce** używane przez receptury (U-07…U-11, T-03, R-02, R-03). Dopuszczone sposoby zdobycia: polowanie (zwykły atak), zbieranie (jaja, miód, mleko, wełna, pióra bez zabijania) i wędkowanie (ryby, opcjonalnie).

Propozycja **32 gatunków** (po 8 na kontynent, w tym wodne i latające):

| Kontynent | Gatunek (rola)                            | Surowce                            |
| --------- | ----------------------------------------- | ---------------------------------- |
| Verdantia | jeleń szlachetny (stado, ucieka)          | mięso, skóra, poroże               |
| Verdantia | zając, królik (mały, szybki)              | mięso, futerko                     |
| Verdantia | bażant, kaczka (latają)                   | mięso, pióra, jaja                 |
| Verdantia | owca górska/koza (wypas)                  | wełna, mleko, mięso                |
| Verdantia | pszczoła (rój, nie atakuje)               | miód, wosk                         |
| Verdantia | ryba rzeczna (łowisko)                    | ryba                               |
| Verdantia | wiewiórka, lis (żerują, uciekają)         | futerko, orzechy (zbiór)           |
| Verdantia | żuraw leśny (bagno)                       | pióra, jaja                        |
| Aetheria  | karp koi, pstrąg górski (stawy)           | ryba, łuska                        |
| Aetheria  | żuraw biały (latający)                    | pióra                              |
| Aetheria  | jeleń sika, kozica                        | mięso, skóra                       |
| Aetheria  | żółw kamienny (powolny)                   | skorupa, mięso                     |
| Aetheria  | jedwabnik, ćma mgielna                    | jedwab, pył świetlny               |
| Aetheria  | królik kryształowy                        | futerko, odłamek kryształu (zbiór) |
| Aetheria  | kaczka mandarynka                         | mięso, pióra                       |
| Aetheria  | piżmak lodowy (lodowce)                   | futro, mięso                       |
| Nexus-9   | gazela solna                              | mięso, skóra                       |
| Nexus-9   | jaszczurka pustyni, wąż piaskowy (ucieka) | skóra, jad (zbiór)                 |
| Nexus-9   | żuk-sprzątacz (drona biologiczna)         | chitin                             |
| Nexus-9   | zając pustynny                            | mięso, futerko                     |
| Nexus-9   | ćma świetlna, motyl obwodów               | pył świetlny                       |
| Nexus-9   | ryba kolektora (zbiorniki)                | ryba                               |
| Nexus-9   | kozioł skalny                             | mięso, róg                         |
| Nexus-9   | szczur magazynowy (neutralny)             | skóra, części (zbiór)              |
| Pyra      | koza lawowa                               | mięso, róg                         |
| Pyra      | wół popiołowy (powolny, duży)             | mięso, skóra, róg                  |
| Pyra      | zając popiołowy                           | mięso, futerko                     |
| Pyra      | jaszczurka żaru                           | łuska                              |
| Pyra      | ptak ognistopióry (latający)              | pióra żaru                         |
| Pyra      | żółw obsydianowy                          | skorupa, mięso                     |
| Pyra      | ryba gorącego źródła                      | ryba                               |
| Pyra      | gołąb kanionu                             | mięso, pióra                       |

Surowce zwierzęce (propozycja listy, **do zatwierdzenia przez właściciela**): mięso, skóra, futerko, wełna, mleko, jaja, pióra, róg, poroże, ryba, łuska, jedwab, pył świetlny, miód, wosk, chitin, skorupa. Pożywienie przetworzone (ugotowane) jest zwykłym zużywalnym z U-07…U-11; nie powstaje nowy rodzaj waluty.

#### Animacje fauny

Profil `fauna`: 8 kierunków × 24 klatki (bezczynność 6, chód 8, ucieczka 6, trafienie/śmierć 4) = **192 klatki na gatunek**, master 384², klient 96², atlas ≤ 2048. Dla ptaków i ryb profil skrócony: 4 kierunki × 16 klatek. Razem 32 gatunki ≈ **5 400 klatek** (do 6 100 przy pełnym zestawie). Mały ruch dla owadów i wodnych (pętla bez kierunków).

Ikony surowców (17 typów × 2–3 warianty) i ikony przedmiotów z Księgi (broń 32, pancerz 30, biżuteria 12, narzędzia 8, zużywalne 16, półprodukty 6, klucze 12, materiały bestiariusza ok. 80) są w osobnej pozycji backlogu (UI).

### 4. Kolejność dostaw dla krajobrazu i fauny

1. **P0 — próbki** (po jednej): trawa verdantyjska z przejściem do skały, góra (1024²), wulkan, bryła skalna, drzewo, jeleń z kompletem klatek, ikona mięsa.
2. Po akceptacji: **zestawy biomów** (4 × 24 tekstury) → obiekty (góry, skały, drzewa) → przejścia → wulkany i woda → ruiny Chóru.
3. **Fauna**: najpierw 8 gatunków Verdantii (tam startuje większość graczy), potem po 8 na kolejne kontynenty.
4. Import walidowanym importerem (rozmiary, klatki, SHA-256, budżet 128 MiB), opt-in, ocena na telefonie.

### 5. Wymagania kodowe (po stronie repo, bez GPU)

- Silnik fauny: neutralne AI (wypas, ucieczka, powrót), brak obrażeń i XP, zbiór i polowanie, limity aktywnych zwierząt w pobliżu gracza (PERF-01), respawn po opuszczeniu obszaru.
- Rozmieszczenie: generator pokrycia kontynentu (biomy według pozycji na atlasie, tekstury i obiekty z gęstością), kolizje z listy obiektów; **spawny potworów z bestiariusza nadal dopiero po ukończeniu kontynentów** (decyzja właściciela).
- Kamera i minimapa regionu na dużych dystansach, podróż między miastami (osobne zadanie).

### 6. Decyzje do zatwierdzenia

1. Lista 32 gatunków i surowców zwierzęcych (czy dodać lub usunąć, w tym czy ryby i wędkowanie wchodzą od razu).
2. Gęstość świata: pełne pokrycie całego kontynentu od razu czy najpierw pas wokół miasta o promieniu ok. 15 000 j.
3. Styl zwierząt: malowany jak potwory, czy prostszy (mniej klatek).
4. Prawa do referencji i checkpointów oraz moment uruchomienia poda (po stronie właściciela).

## Prompty rozwoju postaci — Gemini i ElevenLabs, 29.10.2026

[Katalog produkcyjny i kolejność partii](design/development-prompts/START-TUTAJ.txt)
wiąże zlecenia z treningiem, egzaminami, mentorami, dziedzictwami i projektami
obecnego kodu. [Manifest CSV](design/development-prompts/manifest.csv) zawiera
priorytet, narzędzie, status i zależności. [Pełne prompty](design/development-prompts/WSZYSTKIE-PROMPTY.txt)
są samodzielne; [JSON](design/development-prompts/prompts.json) służy dalszej automatyzacji.

665 zleceń: P0 58, P1 80, P2 99, P3 4, warunkowe bronie 24 i 400 klipów
idle/walk NPC. Nie generować całej listy naraz: najpierw sześć próbek z instrukcji,
odbiór stylu i jednego aktora. Istniejących bohaterów, przeciwników, muzyki i
przydatnych SFX nie zlecamy ponownie. Broń wymaga uzgodnienia z wykonawcą przedmiotów.
Gemini nie gwarantuje spójnych klipów ani alfa; pojedynczy obraz VFX nie jest
animacją. Katalog odróżnia referencje od gotowych paczek importu. Nie uruchomiono
API, GPU ani generowania, nie zmieniono gry i nie opublikowano zasobów.

### Warsztat promptów na stagingu

`deploy/prompt-board/` to samodzielny Node 22 + HTML/JS, bez przebudowy gry.
Warsztat docelowo zajmuje `https://staging.kilegends.pl/prompty/`, a wejście na
sam korzeń stagingu przekierowuje tam. Router obejmuje tylko host stagingu oraz
`/` i `/prompty`; pozostałe ścieżki i domeny produkcyjne nie są zmieniane.

Katalog 665 promptów ma kopiowanie, upload, filtry, paginację, prywatne podglądy,
odsłuch i eksport metadanych postępu. Po zapisie wyniku prompt jest zaliczony;
klip NPC wymaga 8 plików lub ZIP. ZIP nie jest rozpakowywany ani oceniany.
„Do poprawy” zachowuje poprzednie pliki, a nowa wersja nie nadpisuje oryginału.
Zaliczenie uploadu nie oznacza odbioru artystycznego, importu ani publikacji.

Autoryzacja: to samo konto e-mail/hasło co w grze, wymagane `user_roles.admin`.
Serwer używa bieżącego publicznego adresu/klucza API kont, `/auth/v1/user` oraz
odczytu własnej roli przez RLS; bez service_role i zmian bazy. Token sesji znajduje
się w szyfrowanym AES-GCM cookie HttpOnly/Secure/SameSite=Strict, ważnym najwyżej
przez czas tokenu Auth. Rola jest ponownie weryfikowana z cache maks. 5 s.
Sesji nie odświeżamy automatycznie: po wygaśnięciu należy zalogować się ponownie.
To osobna sesja warsztatu; nie zmienia logowania do gry ani prywatnego `/test`.

Pliki i `state.json` leżą na VPS w `~/ki-prompt-board/data`, poza wersjonowanymi
release. `auth.json` (0600) zawiera sekret szyfrowania cookie — nie umieszczać go
w Git. Dane przetrwają restart i aktualizację kontenera. Kopia `state.json.previous`
i kopia metadanych przed deployem są na tym samym VPS; NIE jest to backup offsite.
Właściciel powinien zachować własne oryginały, pobierać wyniki i eksport postępu.
Limity: 48 MiB/pliki, 4 GiB całego indeksowanego magazynu; bezpieczny zapas dysku,
kontrola rozszerzeń i nagłówków, brak SVG/HTML. Nie jest to pełny dekoder/walidator
animacji. Nieindeksowany plik po błędzie zapisu wymaga przeglądu administratora;
nie zaliczamy go i nie usuwamy zaakceptowanych danych automatycznie.

Wdrożenie: `.github/workflows/prompt-board.yml`, tylko dedykowana gałąź lub ręczne
uruchomienie. Kontener `ki-prompt-board`, sieć `coolify`, limit 192 MiB/0.5 CPU,
bez publikowanych portów i bez uprawnień roota. Rollback: poprzedni katalog release
przez `deploy.sh <SHA>`; dane pozostają poza release. Awaryjne zatrzymanie wyłącznie
`ki-prompt-board` usuwa jego routery i przywraca dotychczasowy routing stagingu.
Nie zatrzymywać proxy ani kontenerów gry. Skrypt ma rollback nieudanego wdrożenia.

Kontrole: `node --test deploy/prompt-board/server.test.mjs` (12 testów HTTP),
`node deploy/prompt-board/browser-qa.mjs` (11 scenariuszy przez prawdziwy serwer
lokalny, 5 rozmiarów, emulowany dotyk), pełny TS i lint. Testy UI używają lokalnej
sesji testowej; sprawdzanie roli obejmuje kontrolowany serwer Auth. Nie traktować
tego jako zaliczonego logowania prawdziwego administratora ani fizycznego Androida.
