# KI Legends — GPU i zasoby

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
