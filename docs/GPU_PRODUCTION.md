# KI Legends — GPU, produkcja i wznowienie

Przekazanie 2026-10-21. **GPU wyłączone według aktualnego potwierdzenia właściciela. Nie uruchamiano go podczas tego audytu.** Nie instalowano modeli, nie zmieniano danych zdalnych, nie wykonywano Start/Stop/Terminate. Dokument odtwarza wszystkie dostępne istotne ustawienia z kodu, zachowanych skryptów, manifestów i poprzednich raportów. Nie jest bieżącym `nvidia-smi` ani inwentaryzacją wyłączonego woluminu.

## Źródła i granice dowodu

Źródła dostępne poza GPU (przypięte rewizje, nie tylko ruchome gałęzie):

- PR [#3](https://github.com/circus574-cpu/pixel-playground-launch/pull/3), `bbe248576c4e43098034aad84c667109912e62a2`: [RUNPOD_GPU_SETUP.md](https://github.com/circus574-cpu/pixel-playground-launch/blob/bbe248576c4e43098034aad84c667109912e62a2/docs/RUNPOD_GPU_SETUP.md) i `docs/qa/runpod-20261020/setup-report.json`. Wczesny etap runtime; „0 modeli” dotyczy tej daty, nie późniejszej produkcji.
- PR [#4](https://github.com/circus574-cpu/pixel-playground-launch/pull/4), **`7c50e8d5a93a3cf98c094f1ee341829fd6b0354c`**: [PLANETARNI-RESUME.md](https://github.com/circus574-cpu/pixel-playground-launch/blob/7c50e8d5a93a3cf98c094f1ee341829fd6b0354c/docs/PLANETARNI-RESUME.md), [HERO_APPROVAL_STATUS.md](https://github.com/circus574-cpu/pixel-playground-launch/blob/7c50e8d5a93a3cf98c094f1ee341829fd6b0354c/docs/HERO_APPROVAL_STATUS.md), `scripts/gpu/*`, `art/production/heroes/planetary/v1/`, `art/production/city-v1/` i checkpoint QA. Plików tych **nie ma w main**; nie wystarczy checkout main do renderowania/grounded importu.
- `feat/gpu-city-assets-20261020`, `6551522…`: wcześniejsze źródła otoczenia i efektów; `wip/city-preview-rollout-20261020`, `d20167e…`: wstrzymany eksperyment integracji, nie publikacja.
- [GPU_ASSET_PIPELINE.md](GPU_ASSET_PIPELINE.md): kontrakt silnika main, [TECHNICAL_STATE](TECHNICAL_STATE.md): granice runtime.
- [gpu-lfs-verification.json](handoff/gpu-lfs-verification.json): **świeże** pobranie podczas tego audytu do osobnego cache, SHA-256 i długość **181 obiektów / 31 918 089 B** z `sources/motion-v2` (179 klatek, PNG podglądu źródła i `.blend`). To potwierdza ich dostępność poza GPU. Nie potwierdza całego woluminu, wszystkich innych obiektów LFS ani modeli.
- [historyczny fragment bootstrapu](handoff/historical-bootstrap-reference.txt) i [historyczne polecenie wykonania checkpointu](handoff/historical-checkpoint-creation-reference.txt): zachowane z lokalnych plików poprzednich prac, bez wykonania teraz. Nie są nowymi instalatorami ani kopią odczytaną obecnie z poda. Nie nadpisywać nimi działających skryptów.

Oryginalna rozmowa może nie być dostępna nowemu agentowi; istotne ustalenia z niej są spisane tu i w HANDOFF. Oryginalnego PDF i nowych zdjęć miast nie odnaleziono w obecnym filesystemie. Wyodrębnione oryginalne ilustracje ras są w `public/game/assets/origins-v1/`, z manifestem `src/game/world/origin-art.json`. Nowe plansze miast nie zmieniają kanonu ras i nie służą do projektowania bohaterów.

## A. Infrastruktura — historycznie sprawdzona

| Element | Ustalenie i ograniczenie |
| --- | --- |
| Dostawca / pod | RunPod, `uywsfhvthv4n4k` |
| GPU | 1 × NVIDIA RTX A6000, nominalnie 48 GB; raport Comfy: **47 699 722 240 B** VRAM total, 47 416 410 112 B wolne w tamtym pomiarze |
| Sterownik / CUDA | 595.91.07 / runtime 12.4 (banner obrazu 12.4.1) |
| PyTorch | **2.4.1+cu124** — działało rzeczywiste mnożenie macierzy na CUDA; nie reinstalować automatycznie |
| RAM hosta | **NIEUSTALONY**; nie zachowano potwierdzonego `MemTotal`, nie zgadywać z nazwy karty |
| Obraz / OS | wcześniejszy screenshot konfiguracji wskazywał `runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04`; to historyczna deklaracja obrazu, nie obecny odczyt `/etc/os-release` ani wersji Pythona po restarcie |
| Dysk kontenera | screenshot wskazywał 250 GB; rzeczywista wolna pojemność dzisiaj nieznana; `/opt` jest lokalny POSIX i może zniknąć po odtworzeniu |
| Wolumin | `/workspace` był `fuse.geesefs`; **nie ustalono identyfikatora/produktu RunPod Network Volume** ani gwarancji trwałości po usunięciu poda/woluminu |
| Runtime | `/opt/ki-legends-gpu`; Comfy `/opt/ComfyUI`; snapshot narzędzi gry `/opt/ki-legends-project` początkowo na `b51fc1928a6600035cc6c169205dd7adceb5fe86` |
| Dane / kopie | `/workspace/ki-legends-gpu` |
| ComfyUI | **v0.3.76**, commit **30c259cac8c08ff8d015f9aff3151cb525c9b702**; master wymagał nowszego `torch.library.custom_op`, więc przypięto kompatybilną wersję zamiast zmieniać CUDA |
| Blender | **4.5.3 LTS**, moduł `bpy` w `blender-venv`; **nie zakładać binarki `blender`/GUI** |
| Node | 22.23.3 na GPU |
| Venv | `/opt/ki-legends-gpu/comfy-venv` i `blender-venv`; istniejące torch/CUDA współdzielone lokalnymi dowiązaniami; `pip check` historycznie PASS |

FUSE nie zapewniało semantyki chmod potrzebnej Git/venv/SQLite. Dlatego runtime jest na POSIX `/opt`, a modele/rezultaty/kopie na `/workspace`. Nie przenosić venv wprost na FUSE ani nie naprawiać tego rekurencyjnym chmod całego woluminu.

Biblioteki systemowe potrzebne do importu/renderu: `libXrender.so.1`, `libXi.so.6`, `libXfixes.so.3`, `libxkbcommon.so.0`, `libSM.so.6`, `libICE.so.6`, `libEGL.so.1`, `libgomp.so.1`; bootstrap sprawdza je przez ctypes i instalował odpowiadające paczki Ubuntu, jeżeli ich brakowało. Zachować działający sterownik/PyTorch. NumPy/mathutils/bpy obsługują rig; Pillow obsługuje walidację klatek. Dokładne listy bibliotek zapisano historycznie w checkpointcie, obecnie nie odczytano ich z wyłączonego serwera.

### Usługi i dostęp

- Backend ComfyUI localhost **8189**, proxy Nginx na **8188** z Basic Auth i WebSocket. Login `kilegends`, hasło pochodzi z istniejącej zmiennej poda **JUPYTER_PASSWORD**; wartości nie przechowujemy w repo.
- Publiczny adres ComfyUI: `https://uywsfhvthv4n4k-8188.proxy.runpod.net/`. Jedyny odczyt publicznego adresu w audycie przekazania dał **HTTP 403**. Nie dowodzi to awarii CUDA ani stanu Running/Stopped. Właściciel osobno potwierdził, że GPU jest wyłączone; nie szukano obejścia ani prywatnych kluczy.
- Jupyter 8888 jest oddzielny; prywatnego terminala z tokenem w URL **nie zapisujemy**. Historyczny port terminala nie jest konfiguracją do kopiowania. Dostęp trzeba uzyskać przez aktualny panel i poświadczenia właściciela.
- `ki-comfy-start` historycznie idempotentne. Logi `/opt/ki-legends-gpu/logs/`. Nie wystawiać backendu anonimowo ani zapisywać htpasswd/kluczy w kopii.
- API konta RunPod historycznie REST 403, GraphQL Unauthorized. Nie udało się wykonać Stop przez API. Właściciel powiedział, że wyłączy sam, a podczas obecnego przekazania potwierdził stan wyłączony. Nie utożsamiać zatrzymania procesu renderu/usunięcia WAN z zakończeniem naliczania GPU/storage.

### Naprawa startu i jej ograniczenia

Pierwotne pole startowe przekazywało całą frazę `/bash -c '…'` jako pojedynczą nazwę programu. NVIDIA entrypoint zwracał No such file or directory, kontener restartował co kilkanaście sekund. Poprawiono argv:

```json
{"cmd":["/bin/bash","-c","exec /start.sh"]}
```

Historyczna propozycja zimnego odtworzenia (nie test po Stop/Start):

```json
{"cmd":["/bin/bash","-c","bash /workspace/ki-legends-gpu/bootstrap.sh; exec /start.sh"]}
```

Nie wprowadzać jej teraz do panelu bez przeglądu aktualnego poda. Ciepły bootstrap sprawdzono, **zimne odtworzenie po utracie /opt pozostaje NIEWYKONANE**. Lokalny `/post_start.sh` delegował do trwałego bootstrapu; hook może zniknąć razem z kontenerem. Blender wymagał uzupełnienia bibliotek systemowych. Nie pobierać losowo nowego ComfyUI/PyTorch w celu ominięcia braku kopii.

## B. Modele i licencje

**Rzeczywiście użyte w historycznej produkcji**, nie jedynie planowane:

| Model | Użycie | Wersja / plik / wielkość |
| --- | --- | --- |
| Animagine XL 3.1 | zaakceptowany wzorzec wyglądu Planetarnego; wcześniejsze próby architektury | `cagliostrolab/animagine-xl-3.1`, revision `483f0c322568ed13697ed01dd0be07204746d12b`, `animagine-xl-3.1.safetensors`, **6 938 325 776 B** |
| DreamShaper XL Turbo 2.1 | próby/warianty budynków i terenu, po słabym zachowaniu Animagine dla architektury | `Lykon/dreamshaper-xl-v2-turbo`, revision `f70ad5bce436c640d23fc02cd0a6ccc787280b6e`, `DreamShaperXL_Turbo_v2_1.safetensors`, **6 939 220 250 B** |

SHA-256:

```text
Animagine e3c47aedb06418c6c331443cd89f2b3b3b34b7ed2102a3d4c4408a8d35aad6b0
DreamShaper 4496b36d48bfd7cfe4e5dbce3485db567bcefa2bef7238d290dbd45612125083
```

Modele były w `/workspace/ki-legends-gpu/models/checkpoints/`; Comfy używał dowiązań pod `/opt/ComfyUI/models/checkpoints/`. Przy pauzie historycznie sprawdzono istnienie/rozmiary; SHA zweryfikowano przy pobraniu. **Obecnie nie odczytano plików modeli ponownie i nie wykonano nowej kopii poza wolumin.** Nie są w Git LFS ani zwykłym Git. Nie pobierać ich ponownie bez stwierdzenia braku i zgody na transfer/koszt.

Źródła wersji/licencji: `art/production/city-v1/model-source.json`, `environment-model-source.json`, `MODEL_LICENSE.txt`, `MODEL_CARD.md`, `ENV_MODEL_CARD.md` w #4. Oba zapisano jako **CreativeML Open RAIL++-M**; to nie public domain ani bezwarunkowa gwarancja legalności wszelkiego użycia. Zachować licencję, ograniczenia i pochodzenie; odbiór komercyjny wymaga sprawdzenia pełnych warunków i praw do referencji. Skrypty `download_city_model.py`, `download_environment_model.py` to historyczne receptury, nie polecenie ponownej instalacji. Zapotrzebowania RAM/VRAM tych workflow poza wykonaną A6000 nie benchmarkowano.

Pozostałe:

- **MakeHuman — baza anatomiczna, nie model AI:** `makehumancommunity/makehuman`, revision `a8bc2d54ff0ac92e78ff71431b1023eda42bf482`, CC0-1.0 wg `rig-base-source.json` / zachowanego `LICENSE.ASSETS.md`. Użyto base.obj, wag i targetów; autorskie stroje/włosy/rig osobno. Manifest zawiera nazwy, rozmiary i hashe siedmiu plików. Fetch i parametry: `scripts/gpu/fetch_planetary_rig_base.py`, `planetary-rig-base.json`, `build_planetary_rig.py` w #4.
- **WAN 2.2:** na wyraźne wcześniejsze zlecenie właściciela historycznie usunięto tylko `env-wan.tar`, `wan2.2_ti2v_5B_fp16.safetensors`, `wan2.2_vae.safetensors` i ich znaczniki ready, zwalniając **16 079 472 608 B**. Log na woluminie `wan-removal-20261020.json`. Nie wykonywać ponownie kasowania przy wznowieniu. Nie jest to część potrzebnego workflow postaci.
- **Qwen / Ollama:** właściciel nakazał zachować; wcześniejszy raport mówi o pozostawieniu ich danych, wspólnych encoderów i wyników/workflow WAN. Dokładne wersje, ścieżki i obecna kompletność **NIEUSTALONE** — nie przypisywać im zastosowania do grafiki Ki Legends ani nie usuwać.
- Nie ma potwierdzonego zainstalowanego modelu generującego gotowe osiem kierunków animacji AI. Ruch Planetarnego pochodzi z Blendera i jednego riga, nie z WAN czy 416 niezależnych losowań. Kolejnych dużych modeli nie planować jako automatycznego „brakującego kroku”.

## C. Produkcja i aktualne źródła

Styl: autorskie spójne anime fantasy 2D, niezależne sprite'y top-down / lekka głębia. Nie całe ilustracje jako nieruchoma mapa, nie wycinanie postaci z plansz referencyjnych, nie nowy kanon Ludzie/Elfy/Orkowie z przykładowych miast. Planetarni/Verdantia — natura/kamień/drewno/zieleń/bursztyn; Mędrcy/Aetheria — mistyka, wieże/kryształy/fiolet-złoto; Androidy/Nexus-9 — technologia/srebro/błękit; Legendy/Pyra — wojownicy/twierdze/lawa/czerń-czerwień-złoto.

**Aktualna kolejność właściciela:** każda rasa osobno do akceptacji, najpierw kompletny Planetarny. Bohater → animacje → NPC/przeciwnicy → otoczenie dopasowane do skali. Wcześniejszy priorytet miast został wstrzymany. Nie wracać do masowej produkcji budynków albo pozostałych ras przed spełnieniem tego zakresu.

### Zatwierdzony wzorzec i nieukończony rig

`art/production/heroes/planetary/v1/sources/planetary-master.png` i sąsiedni JSON w #4: jeden **zaakceptowany wzorzec wyglądu** (polecenie „Jest dobrze startuj z tworzeniem tej rasy kompletnie”). Krótkie brązowe włosy, atletyczny dorosły bohater, bursztynowo-pomarańczowy szal, jasna tunika, pasy, ciemne rękawice i buty. Akceptacja wzorca nie jest akceptacją wszystkich klatek riga. `docs/qa/hero-planetary-v1/approval-board.png` i skale 128/60/46 pokazują projekt, nie screenshot działającej gry.

Dokładny prompt pozytywny/negatywny oraz cały graf Comfy są w `planetary-master.json` (unikamy kopiowania drugiej sprzecznej wersji). Parametry: input referencyjny `hero-review/planetary-reference.png`, 1024², seed **5741001**, Euler ancestral / normal, **28 steps, CFG 6.5, denoise 0.62**, model Animagine wskazany wyżej. Reference SHA `db5caf89604fe974cbf38bd750795f3e362f954c695d8df94ba149e7598ea851`, wynik SHA `ef9c876c5d88f7af1ad6e2972e61a26646594d1fad0592323d907dfdade90921`. Zarejestrowano 10.12 s jednego workflow, nie czas wykonania rasy. Alfa/mniejsze obrazy przygotowane CPU, oryginał zachowany.

### Wersje animacji i punkt przerwania

| Zestaw w `art/production/heroes/planetary/v1/sources/` | Stan |
| --- | --- |
| `rig-calibration-v1/` | historyczne próby; nie instalować jako gotowego aktora |
| `rig-calibration-v2/` | osiem kierunków PNG oraz edytowalne `.blend`, własne stroje i korekta sRGB/rękawic/butów; potrzebny `planetary-rig-down.blend` |
| `motion-trial-v1/` | 64 realne klatki testowe i `.blend`; **odrzucone do instalacji** z powodu przycinania włosów w bocznym kadrze i za dużej sylwetki |
| `motion-v2/` | checkpoint **179/416**; pliki i metadane, `pause.manifest`, `motion-preflight.report`, `planetary-motion-source.blend` z siedmioma akcjami |

Dokładny postęp: idle **64/64**, walk **64/64**, attack **51/64**, skill **0/64**, hit **0/32**, death **0/64**, respawn **0/64**. Brakuje **237 klatek**. Jeden `planetary-motion-source.png` jest wyłącznie podglądem `.blend`, nie 180. klatką. `pause.manifest` jest źródłem dokładnych identyfikatorów/SHA, nie zakładać kolejności jego listy.

Stały profil roboczy **grounded**: 512² RGBA PNG, canvas świata 128², stopy **(0.5,0.75)**, collider **12** bez zmiany fizyki, kamera ortho **7.0**, elewacja **45°**, Cycles CUDA **16 samples**, denoise, bez Freestyle w klipach. Wszystkie 416 póz sprawdzono geometrycznie jednym kadrem, 0 naruszeń marginesu 8 px mastera. Nie ma dynamicznego recrop/centrowania każdej klatki. To nie odbiór jakości ruchu ani test w runtime.

| Stan | Klatki / kierunek | FPS | Pętla |
| --- | ---: | ---: | --- |
| idle | 8 | 6 | tak |
| walk | 8 | 16 | tak |
| attack | 8 | 16 | nie |
| skill | 8 | 12 | nie |
| hit | 4 | 16 | nie |
| death | 8 | 10 | nie |
| respawn | 8 | 12 | nie |

Kierunki nazw świata: down, down-left, left, up-left, up, up-right, right, down-right. Indeks od 00. `run` nie jest wymagany: gra nie ma sprintu. Obrażenia następują według sesji od klatki kontaktu 0, nie po wydłużonej animacji. `animate_planetary.py` przechowuje konkretne krzywe/pózowanie, korektę kontaktu stóp przy 205 jednostkach/s oraz akcje szkieletowe. Zmiana stroju/riga/kamery przy wznowieniu unieważnia mieszanie z istniejącym checkpointem i wymaga nowej wersji.

**Rozbieżność z main celowa i ważna:** main nadal ma legacy 96 / stopy 0.95 / kamera renderowa 60°. `grounded`, `previewOnly` i opt-in `?ki-hero-art=1` istnieją tylko w draft #4. Żadnego nowego bohatera nie zainstalowano ani nie opublikowano. Packer/importer main nie przyjmuje tej nowej opcji — użyć właściwego review checkoutu dopiero po uzgodnieniu zmian. GPU #4 miał 98/98 unit, E2E 45 PASS / 0 FAIL / 1 przerwany Android / 1 niewykonany Legend, test nowego aktora **NIEWYKONANY**. Nie przenosić wyniku HUD main na tę gałąź.

### Otoczenie — zachowane, wstrzymane

`art/production/city-v1/` w #4 / gałęzi city ma `source-manifest.json`, `selection.json`, model cards/licencje i katalogi:

- `rejected-text-only`, `rejected-guided-animagine`: próby odrzucone; Animagine gubiło tożsamość architektury, guided zachowywało za prostą geometrię.
- `geometry-guides`: Blender guide PNG/JSON/sceny, porównania kamer; nie finalne mapy.
- `environment-comparison`, `environment-objects`, `city-details`: budynki, podłoża i szczegóły czterech krain; **techniczny wybór**, nie wszystkie zaakceptowane przez właściciela.
- `ki-effects`: 32 klatki impulsu, po 8 na świat, z metadanymi, bez deklaracji pełnego zestawu walki.

Wybór techniczny zawiera m.in. cottage/inn/forge/market Verdantii; sanctum/archive/tree/peak/source/garden Aetherii; lab/reactor/terminal/crystal/pylon/garden Nexusa; fortress/shrine/monument/banner/basalt/volcano Pyry oraz ground/path/plaza. Powiązania do `object.*`, `terrain.*` są w `selection.json`, a wymagane wymiary/footprinty w targets silnika. Nie mylić liczby **89 PNG** w gałęzi city z liczbą finalnych obiektów; obejmuje próby/odrzuty i klatki efektu.

Skrypty na #4: `render_city_guides.py`, `generate_city_batch.py`, `generate_guided_city.py`, `generate_environment_batch.py`, `generate_city_objects.py`, `render_city_details.py`, `render_ki_effects.py`, `prepare_city_delivery.py`, `build_city_delivery.py`. Prompty/seedy/grafy są w wynikowych JSON oraz `city-environment-jobs.json`; DreamShaper comparison używa 10 steps, CFG 2.0, dpmpp_sde/sgm_uniform, guided denoise 0.82. Nie uznawać tych ustawień za prompt do wszystkich bohaterów.

Matting/preprocessing CPU ma zachowane źródła, nie zastępuje generacji kadru. Gałąź `wip/city-preview-rollout-20261020` zachowuje **niedokończony** opt-in; historycznie typecheck + 9 testów importu PASS, pełne E2E/publikacja NIEWYKONANE. Nie scalać jako gotowej podmiany świata.

## D. Lokalizacje, trwałość i kopie

| Lokalizacja | Dane / ostatni dowód | Ryzyko i wymagane działanie |
| --- | --- | --- |
| GitHub #4 + LFS `sources/motion-v2` | 179 klatek + preview + `.blend`; teraz niezależnie pobrano i zhashowano 181 obiektów | trwałe poza GPU w ramach dostępności repo/LFS; zachować PR/ref, skopiować do zatwierdzonego dodatkowego storage przy archiwizacji projektu |
| GitHub #4 `sources/rig-calibration-v2`, wzorzec i metadata, `scripts/gpu`, modele source/license JSON | istnieją ścieżki i lokalne checkouty; źródła/manifesty przypięte do SHA | pozostałe binaria nie były wszystkie ponownie pobierane zdalnie w tym audycie; wykonać `git lfs pull` w osobnym checkoutcie i porównać manifest przed pracą |
| GitHub city `6551522…`, rollout `d20167e…` | osobne źródła, odrzucone próby, wybór, efekty, WIP kod | zachować gałęzie; nie integrować automatycznie |
| `/workspace/ki-legends-gpu/checkpoints/planetary-20261020/` na GPU | historycznie archiwum **planetary-checkpoint-20261020.tar.gz, 28 096 269 B**, `checkpoint.json` SHA, listy `comfy-venv-packages.txt` i `blender-venv-packages.txt` | historycznie odczyt i SHA sprawdzone; dzisiejsza obecność/ID woluminu niezweryfikowane; nie usuwać woluminu; runtime/modeli ta kopia nie zastępuje |
| `/workspace/ki-legends-gpu/runtime-cache/` | `runtime-20261020-v1.tar.gz` **1 169 795 882 B**, plik `.sha256`, 89 777 wpisów, historycznie readback PASS | tylko na woluminie; kopia poza nim **niepotwierdzona**; odtworzenie cold untested. **WYMAGA DODATKOWEGO ZABEZPIECZENIA** jeśli jedyna kopia |
| `/workspace/ki-legends-gpu/models/checkpoints/` | dwa modele po ok. 6.94 GB, przypięte SHA/licencje powyżej | bez obecnego odczytu; poza woluminem kopia niepotwierdzona. Nie wrzucać modeli do Git; dodatkowy zatwierdzony storage albo ponowne pobranie przypiętych źródeł dopiero po zgodzie |
| `/workspace/ki-legends-gpu/bootstrap.sh`, config/source/renders/output/deliveries/technical | historycznie bootstrap, modele/source, wyniki, parametry i archiwa per kierunek | nie ma bieżącej kompletnej inwentaryzacji; inne nieprzeniesione wyniki oznaczyć jako **WYMAGAJĄCE SPRAWDZENIA/ZABEZPIECZENIA** po autoryzowanym dostępie |
| `/opt/ki-legends-gpu/planetary-motion-v2` i `planetary-rig-v2` | szybkie lokalne rendery/metadane i źródła | **nietrwały runtime**, nie zakładać istnienia po odtworzeniu kontenera; klatki odtworzyć z LFS/kopii, rig z #4 |
| `/opt/ComfyUI`, venv/Node, `/opt/ki-legends-project`, logi/hook | lokalne środowisko i snapshot narzędzi | odtworzyć wyłącznie ze sprawdzonej kopii; nie polegać na starej wersji projektu na GPU jako aktualnym main |
| Cloud `/workspace/scratch`, `/workspace/artifacts`, worktree | lokalne archiwa transferowe, logi i próby pomocnicze | **nie są trwałym storage projektu ani RunPod Network Volume**. Krytyczne dane mają refs/LFS; nie przenosić sekretów/auth-token plików/URL capability z scratch do repo |

Checkpoint archiwizował `planetary-motion-v2/` (JSON/PNG/BLEND/manifest/report), `planetary-rig-v2/*.blend`, `rig-base/`, cztery pliki skryptu/konfiguracji animacji, bootstrap i log usuwania WAN. Skrypt tworzenia zachowano jako referencję; nie należy zakładać kompletności innych danych na podstawie tego archiwum. Dokładna suma archiwum jest w `checkpoint.json` na woluminie, nie została teraz odzyskana — **nie wymyślać SHA**. Nowy raport LFS podaje rzeczywiste SHA każdego pobranego pliku.

Dla pozostałych projektów Qwen/Ollama/wspólnych encoderów nie ma tutaj pełnej mapy storage. Nie kasować, nie przenosić, nie zmieniać uprawnień. Czyszczenie WAN wykonano wcześniej na osobne polecenie, nie jest upoważnieniem do nowego czyszczenia. Zmniejszenie liczby bajtów nie zmniejsza automatycznie przydzielonej pojemności/opłaty RunPod.

## E. Procedura kontynuacji — dopiero na nowe polecenie właściciela

### 1. Najpierw CPU/Git, bez kosztu GPU

```sh
git fetch origin
git show 7c50e8d5a93a3cf98c094f1ee341829fd6b0354c:docs/PLANETARNI-RESUME.md
# odrębny checkout, nie gałąź Architekta/main:
git worktree add -b work/resume-planetary ../ki-planetary-review 7c50e8d5a93a3cf98c094f1ee341829fd6b0354c
cd ../ki-planetary-review
git lfs install --local
git lfs pull origin feat/gpu-hero-approval-20261020
```

Ta procedura nie scala PR i nie aktywuje artworku. W razie przesunięcia gałęzi pobrać obiekty dla przypiętego SHA (`git lfs fetch origin <SHA>`, checkout w tym worktree) i porównać manifest. Powyższe polecenia worktree są instrukcją dla nowej sesji; świeże pobranie LFS i SHA-256 rzeczywiście wykonano przy obecnym przekazaniu. Sprawdzić źródło riga, pary PNG/JSON i 179 ramek; nie renderować brakującej paczki od nowa z inną kamerą.

### 2. Dostęp i kontrola poda po zgodzie na uruchomienie

Właściciel uruchamia właściwy pod z tym samym zachowanym woluminem lub udziela nowego polecenia/aktualnych uprawnień. Nie tworzyć nowej płatnej instancji w ciemno. Sprawdzić stan w panelu, montowanie i pojemność:

```sh
findmnt /workspace
df -h /workspace /opt
nvidia-smi
```

To komendy kontrolne do wykonania później; **nie były wykonane zdalnie w przekazaniu**. Zweryfikować ID woluminu w panelu/API, nie z samego typu FUSE. Sprawdzić obecność bootstrapu, kopii runtime, dwóch checkpointów modeli, checkpoint.json i archiwum Planetarnych. Porównać SHA archiwów/modele; nie nadpisywać istniejących nowszych rezultatów. Jeśli wolumin zniknął: źródła klatek i riga są w Git LFS, lecz runtime/modeli poza woluminem nie potwierdzono — trzeba osobno uzgodnić odtworzenie i koszt.

### 3. Przywrócenie działającego runtime

Historycznie wykonane polecenia kontrolne/ciepłe uruchomienie:

```sh
bash /workspace/ki-legends-gpu/bootstrap.sh
ki-gpu-check
ki-comfy-start
ki-blender-python -c 'import bpy; print(bpy.app.version_string)'
/opt/ki-legends-gpu/comfy-venv/bin/python -m pip check
ki-assets run assets:check
```

Przed bootstrapem przeczytać aktualny plik, sprawdzić archiwum i jego SHA. Bootstrap może odtwarzać runtime i doinstalowywać brakujące biblioteki systemowe; nie jest operacją czysto odczytową. W tym przekazaniu nie uruchamiano go. Ciepły test historycznie był idempotentny, pełny cold Stop/Start nie. `ki-blender-python /opt/ki-legends-gpu/scripts/gpu_calibration.py` historycznie dał render CUDA 512²/16 samples w 3.057 s. Nie używać tego czasu do obietnicy kompletnej animacji.

Comfy/Nginx po autoryzacji historycznie: frontend+JS HTTP200, WebSocket status, LoadImage→JoinImageWithAlpha→SaveImage PASS. Później rzeczywisty inference Animagine wygenerował zaakceptowany wzorzec. Brak publicznego HTTP200 nie jest testem CUDA. Nie ujawniać hasła/tokena w logach/poleceniu publicznym.

### 4. Odtworzenie checkpointu w nowym lokalnym katalogu, bez niszczenia danych

Zachować starsze/nowsze źródła. Najpierw sprawdzić hash/listę archiwum i bezpieczne ścieżki, rozpakować do **nowego staging**, porównać z LFS/manifestami. Dopiero po przeglądzie ustawić oczekiwane lokalizacje skryptu:

```text
/opt/ki-legends-gpu/planetary-rig-v2/planetary-rig-down.blend
/opt/ki-legends-gpu/planetary-motion-v2/{state}-{direction}-{00..07}.png + .json
/opt/ki-legends-gpu/planetary-motion-v2/motion-preflight.report
/opt/ki-legends-gpu/scripts/animate_planetary.py
```

`pause.manifest` pochodzi z Git #4. Lokalny skrypt przyjmuje source riga przez stałą ścieżkę; samo odtworzenie `planetary-motion-source.blend` nie wystarczy, jeżeli brakuje `planetary-rig-down.blend`. Zachować oba. `--render-validated` sprawdza preflight 416 póz/0 violations i hashe istniejących PNG względem JSON, pomija ukończone klatki. Skrypt odtwarza/zapisuje named actions/source `.blend`, więc uruchamiać go na kopii roboczej, nie jedynej archiwalnej scenie. Preflight nie wiąże kryptograficznie całej konfiguracji; nie używać raportu po zmianie kamery/riga. Nie przenosić starego PID z historycznych skryptów do nowego procesu.

```sh
/opt/ki-legends-gpu/blender-venv/bin/python /opt/ki-legends-gpu/scripts/animate_planetary.py --render-validated
```

To istniejące historyczne polecenie renderu, **nie zostało wykonane podczas przekazania**. Render na POSIX `/opt`; archiwum na `/workspace/.../renders/planetary-motion-v2/<state>-<direction>.tar.gz` po pełnym kierunku. Niepełne 51 klatek attack wymaga zachowania lokalnych PNG/JSON z checkpointu, nie polegać jedynie na archiwach pełnych kierunków. Zabezpieczać kolejne partie poza GPU z SHA, odczytać z docelowego storage/LFS. Nie czekać na CI przy włączonym wynajmie, kiedy render jest skończony.

### 5. Dopiero 416/416 — CPU pakowanie i opt-in

Na **zgodnym checkoutcie #4 / uzgodnionej gałęzi integracyjnej**, nie na niezmienionym main:

```sh
python scripts/gpu/prepare_planetary_delivery.py RENDERS PREPARED_NEW_DIRECTORY
npm run assets:pack -- PREPARED_NEW_DIRECTORY DELIVERY_NEW_DIRECTORY --id=hero-planetary --world=verdant --profile=hero --version=1.0.0 --presentation=grounded
# po jawnej konfiguracji previewOnly:true w nowym manifeście:
npm run assets:import -- DELIVERY_NEW_DIRECTORY/manifest.json
# dopiero po przejrzeniu poprawnego planu:
npm run assets:import -- DELIVERY_NEW_DIRECTORY/manifest.json --install
npm run assets:check
npm run typecheck
npm run test
npm run build
```

`prepare_planetary_delivery.py` istnieje i sprawdza 416 nazw/par/hashy, 512 RGBA, alfa z marginesem 8, stały origin/canvas, co najmniej dwie różne klatki w klipie. Skrypt/packer są w repo, ale wykonanie tego ciągu **dla kompletnego Planetarnego jest NIEWYKONANE**, bo brakuje 237 klatek. Manifest `previewOnly:true` i `?ki-hero-art=1` chronią domyślnego człowieka. Nie włączać nowego aktora globalnie samym pojawieniem się PNG.

Przetestować w realnej scenie 8 kierunków, stopy/collider/occlusion, attack/skill/hit/death/respawn, walkę i zapisy, mobile/touch oraz pamięć tekstur. Porównać z zatwierdzonym wzorcem; syntetyczny PASS nie oznacza odbioru artystycznego. NPC/przeciwnicy i pozostałe rasy nadal niegotowe. Przed produkcją kolejnej rasy uzyskać osobną akceptację właściciela. Publikacja i merge wymagają nowego zatwierdzenia.

## F. Co jest gotowe do przejęcia

**Gotowy zapis wiedzy i odzyskiwalne źródła checkpointu, nie gotowa rasa.** Nowy Codex może bez tej rozmowy odczytać przypięte dokumenty, pobrać zweryfikowany punkt LFS i przygotować dalszą pracę CPU. Render wymaga ponownego autoryzowanego dostępu do poda/woluminu i kontroli runtime; modelom/kopiom na wyłączonym serwerze nie przypisujemy bieżącego statusu PASS. Nie można podać uczciwego stałego czasu restartu ani ukończenia rasy przed tym sprawdzeniem.
