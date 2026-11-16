# KI Legends Android — projekt Godot 4

**Aktualny checkpoint, 16.11:** zainstalowana aplikacja **1.0** (`versionCode` 100),
aktywne wydanie serwera **1.6** (potwierdzone odczytem manifestu i SHA rdzenia).
Wydanie jest zapisane na gałęzi
`feat/android-release-1.6-20261116`: ostatnie poprawki Claude'a (menu przewijane,
link do panelu dla admin/GM), dokończona obsługa gestów bez przypadkowego kliknięcia,
test aktualizacji menu na oryginalnej bazie APK 1.0. Publikacja 1.6 jest opisana
w dzienniku 16.11, sekcja 21. Starsze numery APK w dalszych częściach README
opisują wcześniejsze etapy. Postacie webowe nie są automatycznie importowane do
zapisów Androida; ta aktualizacja nie migruje ani nie resetuje zapisów.

Dokumentacja natywnej aplikacji **KI Legends na Androida** (Godot 4.6.3, GDScript, renderer Compatibility),
stan 16.11.2026. Kod w repozytorium to **pełna gra: potwory, questy, dźwięk, ekwipunek, bossowie, jaskinie, wydarzenia świata, dzień i noc**
(sekcja 1); ostatni zbudowany APK (`0.7.0-bestiary`, sekcja 2) jest starszy niż kod: **nie ma w nim questów, dźwięku, zasad
ekwipunku, rzadkich cech potworów, bossów, jaskiń, wydarzeń świata, dnia i nocy ani życia mieszkańców**. Zgodnie z decyzją właściciela APK końcowy powstaje dopiero po przeniesieniu całości, w pełnej jakości grafiki.
**Od wersji 0.9.0-online gra jest online:** konta, zapisy w chmurze, obecność innych graczy, czat i panel administratora; APK jest
szczupłe (ok. 64 MiB), a świat (ok. 147 MB) aplikacja dociąga z serwera — sekcja 2a. Gałąź `ccr-ebbd6459-n7c5eg`, kontynuacja
[PR #170](https://github.com/circus574-cpu/pixel-playground-launch/pull/170) (`feat/godot-pyra-android-20261115`).

Aplikacja nie wymaga React, Phasera ani serwera gry. Obecna gra WWW pozostaje osobnym produktem; zapisy WWW i konta
nie są czytane. Miasta są bezpieczne (brak przeciwników); wieloosobowość nie istnieje i niczego takiego nie obiecujemy.

## 1. Co działa

| Obszar | Zakres |
| --- | --- |
| Świat | **Cała planeta Superior:** 4 kontynenty (Pyra 65 600 × 42 304 j., Verdantia 77 504 × 58 560, Aetheria 70 208 × 53 440, Nexus-9 63 168 × 49 728) i **6 wysp** (ok. 13–16 tys. × 8–12 tys. j.), geometria Superior v2; łącznie ok. 197 tys. obiektów scenerii, drogi i ścieżki, ukryte miejsca. Każda kraina ma własne podłoże, tekstury i malowane obiekty |
| Rasy | **Cztery grywalne rasy:** Legendy (Pyra), Planetarni (Verdantia), Mędrcy (Aetheria), Androidy (Nexus-9). Każda z własnym bohaterem (**+15 %** rozmiaru), statystykami z aneksu (poziomy 1–20), drzewkiem 29 węzłów z ikonami, zdolnościami czynnymi i własnym zasobem (Żar / Adaptacja terenu / Kręgi światła / Ładunek Rdzenia); wybór rasy przy pierwszym starcie i w MENU → NOWA POSTAĆ |
| Ruch i dotyk | Joystick 360°, ATAK, 4 sloty zdolności, UNIK, kontekstowe E; niezależne palce; klawiatura: WASD, Spacja, 1–4, Shift, E, M, C |
| Miasta i wnętrza | Cztery miasta na każdym kontynencie (np. Twierdza Popiołu, Zielona Przystań, Sanktuarium Tysiąca Źródeł, Węzeł Świadomości) po 6 usług (Sala, sklep, arena, depozyt, kuźnia, gospoda) = 24 wejścia na kontynent, a na każdej wyspie przystań z 6 usługami; wnętrza i mieszkańcy w stylu świata (Pyra, Verdantia, Aetheria, Nexus-9), przewodnicy i miejsca na szlakach |
| Mapa i podróże | Globus **3D**, atlas **2D** i mapa szczegółowa bieżącej krainy (z miastami, miejscami i znacznikiem gracza); dotknięcie regionu pokazuje opis, a przycisk **PODRÓŻ** przenosi do miejsca przybycia (osada lub brzeg) w dowolnej z 10 krain. Atlas i globus wybierają region z tych samych obrysów |
| Potwory | **41 definicji** (40 potworów bestiariusza + osa-pomocnik przywoływana przez Osę Bursztynową) na opublikowanych rejestrach spawnów 10 krain (8 752 miejsc, maks. 24 aktywnych): błądzą (lub patrolują trasę), atakują, gonią, używają umiejętności z ostrzeżeniem na ziemi, nakładają statusy; zabicie daje XP (poziomy 1–20), monety, łup i 2 % słabego przedmiotu; śmierć = powrót do stolicy krainy; miasta są bezpieczne. **Rzadkie cechy zaimplementowane** (sekcja 1a). Słabości na klasy obrażeń zdolności (ogień, ki, elektryczność, woda, ogłuszenie, obszar, fizyczne) |
| Questy | **102 grywalne zadania z 106** (główne, poboczne, ukryte, międzykontynentalne): przyjmowanie u NPC (!, ? nad głową), cele rozmowy/walki/odkrycia/odwiedzin/dostawy, nagrody (XP, monety, przedmiot, reputacja), odkrywanie 16 sławnych i 17 ukrytych miejsc, tracker w HUD, dziennik w MENU, zapis; **28 postaci ma autorskie dialogi** (powitania, plotki, kwestie zależne od stanu zadania) |
| Walka | Wszystkie zdolności czterech ras działają na potworach i na manekinie areny (nie oddaje ciosów); każda zdolność niesie klasy obrażeń (`TAGS` w `race_kit.gd`) liczone ze słabościami potwora; unik daje nietykalność na czas animacji |
| Bossowie | **8 bossów** z katalogu przeglądarki (Ygdrasha, Thorgar, Arcykapłan Pustki, Aurelith, Arbiter Zero, Hydra-Rdzeń, Kharzul, Pyrrhax) — po dwóch na kontynent, z fazami, atakami z ostrzeżeniem, łupem do plecaka i mechanikami z opisów katalogu; wejście przez **Strażnika leża** w stolicy kontynentu (przycisk WEJDŹ DO LEŻA) |
| Jaskinie | **22 wejścia** zarezerwowane w świecie Superior (4 na kontynent, 1 na wyspę, kamienne bramy na mapie) prowadzą do jaskiń: labirynt korytarzy i komnat, klucz, krata na jedynej drodze do skarbca, skrzynie, strażnicy z potworów krainy (elitarni przy skarbcu), kolce w korytarzach, ciemność z latarnią bohatera |
| Wydarzenia świata | **14 wydarzeń** katalogu (zasadzki, zagrożenia obszarowe, zlecenia odnawialne, konwój) rozgrywane na drogach między miastami: budzą się, gdy bohater podejdzie, płacą XP, monety i przedmiot, potem odpoczywają (300/600 s; „once” nie wraca) |
| Żywy świat | Dzień (480 s: wieczór od 270 s, noc 300–450 s, świt do 480 s) z barwieniem sceny i cechą `night` potworów; mieszkańcy ulic spacerują wokół posterunku i zatrzymują się przy bohaterze; płomienie, dym, para, żar i iskry nad ogniskami, źródłami, lawą i kryształami |
| Dźwięk | Muzyka właściciela (5 pętli: ekran startowy i cztery kontynenty, crossfade), tło miasta i światów, 271 efektów ElevenLabs (trafienia, zdolności czterech ras, potwory, statusy, interfejs, drzwi, łup), kroki według podłoża; głośność w MENU (muzyka 30 %, efekty 60 %) |
| Miasto na gotowo | Monety, plecak (40 stosów), 8 slotów wyposażenia z wpływem na statystyki, **sklep** (85 słabych przedmiotów, cena 4×, skup za połowę), **kuźnia i pięć stacji craftingu** (kuźnia, alchemia, runy, fabrykator Nexusa, Księgi — receptury z katalogu 265), **ulepszanie u kowala** (broń do +3: +2 ATK za poziom; elementy pancerza do +2: +1 DEF), **bonusy pasywne i zestawowe** z globalnymi limitami V2, **depozyt** (przedmioty i monety), **gospoda** (5 monet), mikstura (leczy `hpBonus`, domyślnie 50 HP) — we wszystkich czterech światach |
| HUD | Medalion z portretem rasy i pierścieniem XP, ozdobne paski HP/KI/zasób, buffy z licznikami, monety, baner lokacji, ramka celu, okrągła minimapa z mapy krainy, okrągłe przyciski menu, tracker zadań (do trzech aktywnych zadań), pasek XP, szybki slot mikstury, ikony zdolności; rysunek w pamięci podręcznej (odświeżany tylko przy zmianie); MENU → FPS I DIAGNOSTYKA |
| Płynność | Podłoże wypalane do tekstur 512 j., strumieniowanie scenerii w porcjach na wątkach, prefetch wnętrz, symulacja na klatkę (bez skoków na ekranach 90/120 Hz) |
| Zapis | Checkpoint v2 (kraina, rasa, pozycja, wnętrze, poziom, drzewko, sloty, ekonomia z ulepszeniami, dziennik zadań); import checkpointu v1; stary zapis bez zadań wczytuje się z pustym dziennikiem; ochrona nieznanego formatu |
| Start i ikona | **Wstęp: ilustracja właściciela** (cała, bez zniekształceń), przycisk ZACZNIJ PRZYGODĘ, na dole „Powered by GODOT ENGINE” z oficjalnym logo; boot splash z tą samą ilustracją; ikony Android; licencje silnika w menu |

**Poza zakresem (nie ma w kodzie):** konta i synchronizacja, wieloosobowość, kolejne piętra jaskiń, bossowie w jaskiniach. Obecność sklepu czy
skrzyni w tekście nie oznacza wdrożenia usługi. **Co z poniższego istnieje w przeglądarce, a co jest dorobione dla portu**, mówi sekcja 1b.

### 1b. Co jest z przeglądarki, a co dorobione

| Element | Z przeglądarki (`src/game`) | Dorobione dla portu (autorskie, do akceptacji właściciela) |
| --- | --- | --- |
| Bossowie | Katalog (`bosses/catalog.ts`): statystyki, fazy z mnożnikami i listami ataków, ataki, tabele łupu, wygląd (strażnik kontynentu w 180 px), dźwięki, wejście przez Strażnika | Łup trafia do plecaka (przeglądarka trzyma go w podglądzie bez zapisu); zasięg ataków wręcz = zasięg ciała (przeglądarka: cały promień agresji); dystans ranged bosses; odporność na ogłuszenie (¼) i spowolnienie (½), brak odepchnięcia; mechaniki z opisów katalogu (niżej); Strażnicy Aether (Ilvara), Nexus (K-7), Pyra (Draven) — w przeglądarce jest tylko Kaelen z Verdantii |
| Jaskinie | Rezerwacja 22 wejść (`world.json`: „entrance reserved; interior integration pending”), obiekty bram na mapie, paczka grafik `dungeon-kit`, model postępu z kluczami, kratami i skrzyniami (`dungeonProgress.ts`) | Cały wnętrze: generator labiryntu zależny od id wejścia, rozmieszczenie klucza/kraty/skrzyń/strażników/kolców, nagrody skrzyń, ciemność i światło bohatera, podłoga proceduralna |
| Wydarzenia | 14 definicji (nazwa, poziom, promień, powtarzalność, nagroda) | Miejsca, stwory, zadania do wykonania (uwolnić posłańca, odnowić znaki, zabezpieczyć lustra, skalibrować pylony, zneutralizować źródło), chmury zagrożeń, odnowa |
| Dzień i noc | Cecha `night` potworów i `host.isNight()` | Zegar 480 s, barwienie sceny, napis „noc” w banerze |
| Mieszkańcy, efekty | — | Spacery NPC, efekty otoczenia (`ambient_fx.gd`) |

**Mechaniki bossów z opisów katalogu** (`scripts/boss_script.gd`): Ygdrasha regeneruje 1 % HP/s w fazach 1–2, w fazie 3 kielich jest odsłonięty
(+25 % obrażeń) i trujące zarodniki zostają na ziemi; Thorgar w fazie 3 ponownie wyje (bez wilków, oślepienie 3 s); Arcykapłan w fazie 2 wzywa
trzy Świetliki i do ich zniszczenia przyjmuje tylko 30 % obrażeń, jego pieczęcie zostawiają strefy na 5 s, w fazie 3 kurczy się pierścień areny;
Aurelith w fazach 2–3 lata, w fazie 3 stawia trzy filary i Oddech Eteru (promień) mija schowanego za filarem; Arbiter w fazie 2 wzywa dwa drony, a w
fazie 3 co 30 s przez 10 s jest przegrzany (+40 % obrażeń); Hydra przełącza się między trzema głowami (listy ataków faz); Kharzul w fazie 3 podpala
arenę (strefy z ostrzeżeniem) i blokuje leczenie miksturami; Pyrrhax w fazie 2 lata, w fazie 3 erupcja wymaga schronienia w jednym z trzech
bezpiecznych kręgów. Liczby stref (obrażenia, czasy, promienie) są autorskie.

### 1a. Zasady potworów (`scripts/monster.gd`, `scripts/monster_manager.gd`)

Dane (`data/monsters.json`) pochodzą z bestiariusza; port nie zmienia balansu. Szkic modelu obrażeń bohatera na potworze:
`max(1, surowe × mnożniki − DEF/2)`, gdzie mnożniki to słabość klasy obrażeń zdolności (`weak`: największa z pasujących, wartość
< 1 oznacza odporność), pieczęć, pancerz z przodu (`frontArmor`) i bonus z tyłu (`backBonus`) liczone względem kierunku, w którym
potwór patrzy na bohatera, bonusy odsłonięcia (`exposedBonus`: po chybionej szarży, przegrzana wieżyczka, odwrót nurkującego),
wynurzony zakopywacz (`burrow.bonus`), zwinięcie (`curl`, nie dotyczy ki), redukcja z umiejętności; tarcza (`guard`) pochłania
obrażenia przed HP.

| Cecha | Działanie w porcie |
| --- | --- |
| `still`, `fly`, `ghost`, `keep`, `flank`, `leash`, `wander`, `route` | stoi / lata (omija maskę marszu) / przenika / trzyma dystans / okrąża / uwiąź na gnieździe / promień błądzenia / patrol po punktach |
| `provoked` + `giveUp`, `opportunist`, `night`, `retreat`, `rage`, `slowBelow`, `ramp` | atakuje dopiero po trafieniu i odpuszcza po czasie / tylko gdy HP bohatera poniżej progu / w dzień zmniejszony zasięg wykrycia (zegar dnia 480 s, noc od 300 s licząc od wejścia do krainy) / odwrót poniżej progu HP / szał (obrażenia i tempo) / spowolnienie przy niskim HP / narastanie obrażeń z kolejnymi atakami |
| `pack` | wilki i nietoperze budzą się w watahach (2–3 sztuki wokół miejsca spawnu; członkowie bez własnego miejsca respawnu) |
| `explode`, `deathZone`, `trail`, `webs` + `webSlow` | wybuch przy śmierci / strefa po śmierci / ślad pod stopami / pajęczyny w promieniu gniazda (maks. 3, 120 s); pająk poza własną siecią jest wolniejszy |
| Strefy (`zone` w umiejętnościach, ślady, sieci, chmury) | kolorowy krąg na ziemi; co 0,5 s zadaje ułamek ATK właściciela i nakłada statusy (np. spowolnienie sieci) |
| `burrow`, `ambush`, `dive`, `fleeAfterHits`, `curl`, `reflect`, `interrupt`, `brittleTail` | zakopywanie (nietykalny pod ziemią, wynurza się przy bohaterze) / zasadzka (ukryty do podejścia, cios z mnożnikiem `opener`, potem chowa się) / nurkowanie po serii ataków / ucieczka po liczbie trafień / zwijanie co kilka trafień / odbicie części obrażeń nie-ki / ogłuszenie przy dużym trafieniu w trakcie rzucania / po liczbie trafień traci ogon (bez ataków wręcz) |
| `split`, `revive`, `medic`, `turret`, `summon` | rozdzielenie na dwie części o 40 % HP (klon bez nagrody, łączą się po czasie) / odrodzenie z częścią HP (raz) / leczy rannych sojuszników / wieżyczka obraca się, strzela salwami, przegrzewa się i jest wtedy podatna / przywołuje pomocników bez własnego miejsca spawnu |

Statusy nakładane na bohatera: spowolnienie, unieruchomienie/ogłuszenie/strach (blokada ruchu), wyciszenie, DoT, osłabienie,
obniżony pancerz, oznaczenie, ślepota/mgła, zdjęcie tarczy, przyciągnięcie. Nietykalny bohater (unik) nie otrzymuje obrażeń ani statusów.

## 2. Instalacja gotowego APK

APK: `deliveries/godot-pyra-android-20261117-online/ki-legends-godot-debug.apk`, **66727415 bajtów** (63,6 MiB, Git LFS), SHA-256
`ba1373ab0f13ec03aa4ebaeae08645f15977cf691e9a01816c3c477e1231188b`, wersja **0.9.0-online** (kod 9). Zawiera kod, interfejs, czterech
bohaterów, dane zasad i grafiki jaskiń; **nie zawiera krain** — przy pierwszym uruchomieniu (potrzebny internet) pobiera dane krainy
startowej (ok. 17–34 MB), a kolejne przy podróży. **Gra działa tylko wtedy, gdy serwer ma opublikowane wydanie treści** (sekcja 2a,
„Wdrożenie”): bez tego ekran startowy pokaże „Serwer nie ma jeszcze opublikowanej treści”. Pełne APK z całą grą w środku
(`…-20261116-complete`, 141 MiB) zostaje w repozytorium jako wersja niezależna od serwera, ale bez kont i chmury.
Wymaga Androida 7.0+ i `arm64-v8a`.

1. Pobierz APK na telefon i otwórz plik (zezwól na instalację z tego źródła; nie wyłączaj Play Protect).
2. Wersje 0.3.0 i 0.4.0 zaktualizują się w miejscu (ten sam klucz debug). **Jeżeli masz 0.2.0, odinstaluj ją najpierw**:
   0.3.0 i nowsze są podpisane innym kluczem debug (poprzedni został poza repozytorium). Checkpoint znika z aplikacją.
3. Uruchom **KI LEGENDS**, obróć telefon poziomo, wybierz **ZACZNIJ PRZYGODĘ**, a potem swoją rasę.

```sh
adb install -r deliveries/godot-pyra-android-20261117-online/ki-legends-godot-debug.apk
```

Pakiet `pl.kilegends.godot.pyra`, wersja `0.9.0-online`, kod 9, min SDK 24 / target 36, `USER_LANDSCAPE`, OpenGL ES 3.
Brak uprawnień internetu i pamięci zewnętrznej. To debug APK, nie wydanie Google Play.
**Instalacja, płynność i pamięć na fizycznym Androidzie są niezweryfikowane** (brak urządzenia w tej sesji).

### Sterowanie

| Czynność | Telefon | Komputer |
| --- | --- | --- |
| Ruch | lewy joystick | WASD / strzałki |
| Atak podstawowy | ATAK (przytrzymaj) | Spacja |
| Zdolność | okrągłe sloty 1–4 (ikona = węzeł drzewka, pod nią koszt KI; ciemna nakładka = odnowienie) | 1–4 |
| Unik | UNIK | Shift |
| Wejście, rozmowa, wyjście | E | E / F |
| Mapa / Postać / Plecak / Powiększenie / Menu | przyciski u góry | M / C / I / — / Esc |
| Mikstura | PLECAK → UŻYJ | H |

Zdolność wymaga celu w zasięgu (~90 j.): w świecie nie ma celów, więc skuteczny test to manekin na arenie
(wejście oznaczone złotym kołem przy Arenie). Kamera domyślnie oddalona (80 %); przycisk ZOOM przełącza 60/80/100 %.

## 2a. Gra online: konta, chmura, treść z serwera, panel administratora

**Czego to NIE jest.** Gra Android to lokalna symulacja PvE (walka, łup, doświadczenie liczy urządzenie), tak jak całe to przeniesienie. Serwer
jest autorytatywny w trzech sprawach: **konta**, **zapisy** (przyjmuje tylko zapisy tej gry, w granicach rozsądku) i **treść do pobrania**.
Obecność innych graczy i czat są **kosmetyczne**: serwer nie rozstrzyga walki, łupu, handlu ani pozycji. Nie ma PvP ani wspólnego świata
autorytatywnego (w przeglądarce istnieje osobny serwer autorytatywny; to inny produkt).

**Przepływ po uruchomieniu** (`scripts/title_screen.gd` → `scripts/gate_screen.gd`):
1. Ekran logowania kontem Ki Legends (te same konta co w przeglądarce, `/ws/auth/*`); „UTWÓRZ KONTO” (link aktywacyjny przez e-mail), „GRAJ OFFLINE”
   (tylko gdy dane krainy są już na urządzeniu). Token odświeżania w `user://account.json`.
2. Serwer: tryb serwisowy i minimalna wersja aplikacji (komunikat „zainstaluj nowszą”), manifest aktywnego wydania.
3. Zapis w chmurze: brak zapisu lokalnego → pobranie z chmury; różne wersje → pytanie, który zachować.
4. Pobranie i podpięcie paczek krainy startowej (pasek postępu, suma SHA-256, ponowienia), potem miasto.
W grze: autozapis co 90 s i przy wyjściu z aplikacji (zapis lokalny + chmura), konflikt wersji (inne urządzenie) pokazuje wybór, MENU →
CZAT OKOLICY, KONTO (wyloguj), POBIERZ WSZYSTKIE KRAINY; podróż do nieznanej krainy pobiera jej paczki z ekranem postępu; inni gracze tej krainy
widoczni są jako półprzezroczyste duchy z nickiem.

**Paczki treści** (`scripts/godot/build_packs.py`): APK zawiera wszystko poza tym, co potrzebne tylko w danej krainie/świecie:

| Paczka | Zawartość | Rozmiar |
| --- | --- | --- |
| `land-<id>` (10) | dane krainy, mapy, tekstury scenerii (także miasta Pyry) | 2,9–25 MB |
| `monsters-<świat>` (4) | arkusze i dźwięki potworów świata | 3,3–4,2 MB |
| `npcs-`, `rooms-`, `music-<świat>` (12) | mieszkańcy, wnętrza, muzyka kontynentu | 1–4,3 MB |

Razem 26 paczek, 153 831 056 B. Każda kraina wymienia swoje paczki w manifeście (`lands`), np. Pyra = land + monsters + npcs + rooms + music
≈ 28 MB. Nazwa pliku niesie 12 cyfr SHA-256, więc plik się nie zmienia i może leżeć w pamięci podręcznej „na zawsze”. Skrypt sprawdza, czy żaden
plik wskazany w danych zasad nie wypadł z APK bez przydziału do paczki (`ORPHAN`), i wpisuje filtr wykluczeń do presetu Android.

**Serwer** (`src/server/godot/*`, migracja `deploy/multiplayer/init/007-godot-android.sql`, trasy pod `/ws/godot/*` — Caddy już kieruje `/ws/*`):

| Trasa | Działanie |
| --- | --- |
| `GET /status`, `GET /manifest?client=<kod>` | stan, aktywne wydanie; 503 w trybie serwisowym (administrator wchodzi), 426 dla zbyt starej aplikacji |
| `GET /pack/<wersja>/<plik>` | paczka z `Range`/206, `ETag`, `immutable` |
| `GET/PUT/DELETE /saves/<1-3>` | zapisy w chmurze z blokadą rewizji (`baseRevision`, 409 przy konflikcie), walidacja formatu, rasy, krainy, poziomu i limitów liczb, do 1 MB |
| `WS /live` | obecność (pozycje 4 Hz, rówieśnicy w promieniu 2600 j. ≤ 24) i czat okolicy (≤ 120 znaków, 1/1,2 s) |
| `/admin/*` (rola `admin`; `gm` tylko odczyt) | przegląd, wgrywanie paczek (SHA-256 sprawdzane w locie), rejestracja i aktywacja wydań, ustawienia dostępu, podgląd i usuwanie zapisów; każde działanie w dzienniku audytu |

Treść paczek leży na woluminie (`GODOT_CONTENT_DIR`, domyślnie `/data/godot-content`), nie w obrazie. **Panel administratora** (`/admin` → „Gra Android”,
`src/components/admin/AdminGodotPanel.tsx`): stan i liczba graczy online, minimalna wersja i tryb serwisowy z komunikatem, wydania (wysyłka folderu
`deploy/godot-content/<wersja>/` z przeglądarki, aktywacja = natychmiastowy rollback do dowolnego wcześniejszego), zapisy graczy, dziennik.

**Wdrożenie — nie wykonane.** Zgodnie z `AGENTS.md` publikacja i zmiany produkcji wymagają osobnej zgody właściciela, a ta sesja nie ma dostępu do VPS/Coolify.
Gotowe: migracja 007 (idempotentna, dopisana do `install.sh` i CI), wolumin w `docker-compose.online.yml` i `Dockerfile`, narzędzie
`scripts/godot/publish_content.py`. Kroki dla właściciela: (1) wykonać migrację 007 (`install.sh` robi kopię przed zmianą), (2) wdrożyć obraz z woluminem
`godot-content`, (3) zbudować paczki `python3 scripts/godot/build_packs.py build` (gotowy zestaw 2026.11.17.1 jest w
`deliveries/godot-content-2026.11.17.1`) i opublikować w panelu „Gra Android” albo
`KI_ADMIN_EMAIL=… KI_ADMIN_PASSWORD=… python3 scripts/godot/publish_content.py --server https://kilegends.pl --dir <folder> --activate`,
(4) zainstalować APK. Adres serwera w aplikacji: `--server=URL`, `KI_SERVER`, `user://server.json` albo ustawienie `ki/server/url` (domyślnie `https://kilegends.pl`).

**Sprawdzone lokalnie (PostgreSQL 16 + prawdziwy serwer + Godot):** `src/test/godot-android.test.ts` (10 testów API: wydania, Range, bramki wersji i
serwisu, zapisy z rewizjami, uprawnienia, audyt, obecność i czat); `scripts/godot/e2e_online.py` — baza PCK eksportowana z filtrami Androida (**40,2 MB**,
bez danych krain) loguje się, pobiera i podpina paczki, buduje miasto Pyry, zapisuje do chmury, odrzuca nieaktualny zapis, pobiera Verdantię przy podróży;
`scripts/godot/qa_admin_ui.py` — panel w prawdziwej przeglądarce (wysyłka wydania, aktywacja, serwis, zapisy, audyt;
zrzuty `docs/zmiany/2026-11-16/qa/admin-android/`). **Nie sprawdzone:** telefon (pobieranie w sieci komórkowej, pamięć, bateria), prawdziwa domena/TLS,
obciążenie wielu graczy.

## 2b. Aktualizacje z poziomu gry: kod i dane z serwera, bez nowego APK

Pierwsza scena aplikacji to `scenes/boot.tscn` (`scripts/boot.gd`). APK niesie kompletną grę (działa offline w wersji, z której
powstał), ale przy każdym starcie pyta serwer o **pakiet rdzenia** `core-c<versionCode>`: skrypty, sceny, shadery i dane zasad
(JSON) nowszej wersji (ok. 2,2 MB). Pakiet jest pobierany raz, sprawdzany (rozmiar i SHA-256), zapisany w `user://content` i
montowany **nad plikami APK, zanim cokolwiek z gry zostanie wczytane**. Dzięki temu zmiana gry dociera do gracza z poziomu gry.
Paczki krain (świat, potwory, NPC, muzyka) działały tak od początku.

- **Co się aktualizuje bez APK:** cała logika (`scripts/*.gd`), sceny, shadery, dane zasad (`data/*.json`, `data/races/*.json`) i, jak dotąd, treść krain.
- **Co wymaga nowego APK:** silnik Godot, uprawnienia i ustawienia projektu (`project.godot`, `export_presets.cfg`), ikona, natywne dodatki. Wtedy podbij
  `version/code` (oraz `KiNet.CLIENT_CODE` i `Boot.CLIENT_CODE`; test sprawdza ich zgodność) i ustaw w panelu minimalną wersję klienta.
- **Zasada dla nowego kodu:** nowy plik `.gd` w rdzeniu ładuj po ścieżce (`const X := preload("res://scripts/x.gd")`), nie po `class_name` —
  lista klas globalnych jest zapisana w APK i nowa nazwa klasy nie jest widoczna (sprawdzone doświadczalnie i w `e2e_core.py`, scenariusz 11). Zmiana istniejących plików i ich `class_name` działa. Dotyczy to APK zbudowanego przed dodaniem pliku; dlatego `animals.gd` nie ma `class_name`.
- **Bezpieczeństwo.** Rdzeń, który się nie wczyta lub którego skrypty się nie kompilują (boot ładuje wszystkie od razu), trafia na listę „złych” i po
  ponownym uruchomieniu działa kod z APK; rdzeń, który w trzech uruchomieniach nie dotarł do pierwszej krainy (`KiNet.core_ok()` w `city_game.gd`), jest
  porzucany. Zamontowanej paczki nie da się odmontować, więc naprawa wymaga ponownego uruchomienia aplikacji. Cofnięcie po stronie serwera: aktywuj
  poprzednie wydanie w `/admin`. Stan: `user://core.json`.
- **Publikacja.** `python3 scripts/godot/build_packs.py build --version V` buduje też rdzeń (`core-c<kod>-<hash>.pck`, wpis w manifeście bez przypisania do krainy);
  skopiuj wynik do `deliveries/godot-content-V` (Git LFS) i uruchom workflow **„Godot content packs to VPS (manual)”** z `publish` i `activate`:
  weryfikuje sumy, kopiuje na serwer, rejestruje wydanie i aktywuje je. Klienci dostają je przy następnym uruchomieniu gry. Wydanie bez zmian
  w paczkach krain przenosi tylko zmieniony rdzeń po stronie gracza (pobranie ok. 2 MB).
- **Test:** `python3 scripts/godot/e2e_core.py` (bez bazy): eksportuje prawdziwą bazę Androida, serwuje atrapę manifestu i paczek i uruchamia aplikację 10 razy
  jak gracz restartujący grę (brak rdzenia, pełny rdzeń repozytorium, nowszy rdzeń zmieniający stałą w kodzie, serwer niedostępny, rdzeń niekompilujący się,
  ten sam zły rdzeń ponownie, powrót do dobrego, porzucenie rdzenia bez „potwierdzenia”). Reguły decyzji: `tests/smoke.gd` (sekcja „boot”).

## 3. Uruchomienie w edytorze

Godot **4.6.3 Standard** (bez .NET). Zaimportuj `ports/godot-pyra/project.godot`, poczekaj na import, F5.

```sh
godot --headless --editor --path ports/godot-pyra --import
godot --path ports/godot-pyra            # opcja `-- --fresh` pomija odczyt checkpointu
```

## 4. Architektura i pliki

| Plik w `ports/godot-pyra` | Odpowiedzialność |
| --- | --- |
| `scripts/continent.gd`, `assets/continent/terrain.gdshader` | Dowolna kraina z `data/lands/<id>/`: shader terenu (4 biomy, ląd/morze, brzeg, lawa/kryształ, dwie nakładki, drogi z maski 16 j. i klasy materiału, dziedzińce miast; lustrzane kafle bez szwów) wypalany do tekstur kwadratów 512 j., strumieniowanie obiektów po chunkach 2048 j. w porcjach czasowych z ładowaniem tekstur na wątkach, maska kolizji |
| `scripts/cached_layer.gd`, `scripts/hud.gd`, `scripts/touch_controls.gd` | HUD i przyciski dotykowe rysowane do przezroczystego SubViewport w rozdzielczości urządzenia, odświeżane tylko po zmianie stanu (2 quady w spoczynku) |
| `scripts/quest_engine.gd` | Silnik questów (port `src/game/quests`): stan, cele, nagrody, znaczniki NPC, rozmowy, tracker, zapis |
| `scripts/boss_script.gd`, `data/bosses.json` | Mechaniki ośmiu bossów (filary, pierścień areny, bezpieczne kręgi, przegrzanie, bariera, regeneracja) i dane katalogu |
| `scripts/dungeon.gd`, `data/dungeons.json`, `assets/dungeon/` | Jaskinie: 22 nazwane wejścia (tunele łączące dwie krainy, komory, Wielki Labirynt na 3 piętra), generator układu i zawartości (klucz, krata, skrzynie, strażnicy, kolce, sekretna komora, inskrypcje), schody między piętrami, automapa w okrągłym oknie, dane wejść z `prepare_dungeons.py`, 12 grafik `dungeon-kit` |
| `scripts/story.gd`, `scripts/story_screen.gd`, `data/talk.json` | Fabuła: wprowadzenie 5 stron na rasę (dwie o Ciszy, trzy własne), samouczek 8 kroków z nagrodą 40 monet, 8 tematów rozmowy u każdego mieszkańca (3 z jego fachu, 5 o świecie), uwagi o czynach bohatera; tekst z `prepare_talk.py`, postęp w zapisie (`story`) |
| `scripts/target_ring.gd` | Pierścień pod celem walki (obracające się łuki, szerszy dla bossów) |
| `scripts/world_events.gd` | 14 wydarzeń świata: miejsca, stwory, rekwizyty, nagrody, odnowa, zapis |
| `scripts/ambient_fx.gd` | Płomienie, dym, para, żar i iskry nad scenerią (wyłączane poza ekranem) |
| `scripts/net.gd`, `online.gd`, `content.gd`, `gate_screen.gd`, `remote_players.gd`, `chat_panel.gd` | Klient online: węzeł zbiorczy (`KiNet`), konto i zapisy w chmurze i obecność, paczki treści, ekran logowania/pobierania, duchy graczy, czat |
| `scripts/audio.gd` | Muzyka (crossfade), tła, efekty (pula 14 odtwarzaczy, minimalne odstępy), kroki, głośności w `user://audio.json` |
| `scripts/monster.gd`, `scripts/monster_manager.gd` | Potwór (AI, atak, umiejętności, statusy, wszystkie rzadkie cechy z sekcji 1a) i zarządca spawnów krainy (budzenie, usypianie, respawn, pociski, strefy, pajęczyny, przywołania, klony, zegar dnia i nocy, nagrody). Zarządca żyje przez całą grę; zwolnienie go w trakcie rozgrywki wywala silnik, dlatego `setup` tylko go resetuje |
| `scripts/map_style.gd` | Wspólny styl map i globusa: plakietki Cinzel, znaczniki rodzajów miejsc, kompas, winieta, ramka |
| `scripts/city_game.gd` | Scena gry (`PyraGame`): wczytanie krainy (`enter_land`), miasta, wnętrza, interakcje, walka na manekinie, ekrany, podróże (`travel_to`), nowa postać (`start_new_character`), zapis |
| `scripts/player.gd` | Ruch kinematyczny po masce marszu (kraina) lub prostokątach (wnętrza); bez ciał fizycznych |
| `scripts/actor_view.gd` | Animacje: arkusze NPC i przycięte ramki atlasu bohatera; `HERO_SCALE = 1.15` |
| `scripts/race_kit.gd`, `legend_kit.gd`, `planetary_kit.gd`, `sage_kit.gd`, `android_kit.gd`, `race_kits.gd` | Wspólna baza zasad (statystyki 1–20, drzewko, rangi, odnowienia, buffy, tarcze, kręgi, kanały) i cztery rasy (porty `src/game/kit/*.ts` + `base.ts`) |
| `scripts/race_screen.gd` | Wybór rasy: cztery karty z portretami, opisem i statystykami |
| `scripts/foe_dummy.gd`, `scripts/fx.gd` | Manekin treningowy, efekty cięć/wybuchów/aur, liczby obrażeń w siedmiu stylach (zwykły, krytyk, słabość, odporność, rana bohatera, leczenie, XP) i unoszące się napisy |
| `scripts/touch_controls.gd`, `scripts/hud.gd` | Joystick, przyciski, paski HP/KI/zasób rasy, dialogi, bezpieczne marginesy ekranu |
| `scripts/map_screen.gd`, `globe_view.gd`, `atlas_view.gd`, `continent_map_view.gd`, `map_math.gd` | Mapa: globus 3D, atlas 2D, mapa bieżącej krainy, przycisk PODRÓŻ; wspólna geometria i obrysy |
| `scripts/character_screen.gd` | Ekran POSTAĆ: statystyki ze źródłami, **drzewko rasy z ilustrowanymi ikonami** (`assets/icons/skills/<rasa>/`), sloty, poziom próbny |
| `scripts/economy.gd`, `scripts/items_screen.gd` | Monety, plecak, wyposażenie (bonusy pasywne, zestawy, limity V2), sklep, depozyt, gospoda, pięć stacji craftingu, ulepszanie u kowala; jeden ekran usług i plecaka (6 zakładek kuźni) |
| `scripts/markers.gd` | Złote koła na ziemi przy wejściach |
| `data/lands/<id>/` | `land.json` (rozmiary, miejsce przybycia, osady i usługi, NPC, miejsca, tekstury, chunki, domy stolicy Pyry), `objects.bin` (rozmieszczenie), `walk.bin` (maska marszu 16 j.) — dla 10 krain |
| `assets/lands/<id>/` | Siatki biomów i lądu, maska i klasy dróg, kafle terenu, mapa szczegółowa |
| `data/races/<rasa>.json`, `data/actors.json`, `data/rooms.json` | Aneks i drzewko rasy z opisem, arkusze bohaterów i NPC czterech światów, wnętrza usług czterech światów |
| `data/hero.json`, `data/map.json`, `data/economy.json`, `data/world-provenance.json` | Klipy bohatera Legendy, regiony i komórki mapy (10 krain), katalog 366 przedmiotów i 265 receptur, SHA źródeł i wyników |
| `data/city.generated.json` | Stolica Pyry z pierwszej próby (układ, podłoga, pokoje) — nie edytować ręcznie |
| `data/monsters.json`, `data/quests.json`, `data/lands/<id>/spawns.json` | Bestiariusz (statystyki, umiejętności, cechy, łup, klatki), katalog zadań z dialogami i miejscami, rejestr spawnów krainy |
| `assets/audio/` | Muzyka (`music/`) i efekty (`sfx/`) skopiowane bez zmian (24 MB) |
| `scripts/boot.gd`, `scenes/boot.tscn` | Pierwsza scena: film wejściowy właściciela (`assets/branding/intro.ogv`, Ogg Theora, 10 s z dźwiękiem; dotknięcie po 0,8 s pomija, po zakończeniu zostaje ostatnia klatka „TOUCH TO START” i dotknięcie od razu uruchamia grę) oraz pobieranie i montowanie rdzenia z serwera (sekcja 2b); w trybie headless i w testach film się nie odtwarza; film jest polską wersją od właściciela (`art/production/intro/intro-pl-source.mp4`, konwersja `scripts/godot/make_intro.py --baked`; stara nakładka napisów na angielskim źródle nadal dostępna bez `--baked`) |
| `scripts/animals.gd`, `scripts/godot/prepare_animals.py`, `data/animals.json` | Łagodne zwierzęta: cecha `peaceful` potwora (brak ataku, ucieczka po ciosie), rozmieszczenie, konwerter plansz właściciela (`art/production/animals/`, cięcie po kształtach, bezstratny atlas) i ikon posiłków (zwierzę istnieje w świecie dopiero po wpisie w `animals.json`) |
| `data/food.json`, `scripts/godot/prepare_food.py` | Jedzenie: 10 posiłków (leczenie w czasie, status „Najedzenie”) i 10 łagodnych zwierząt (dane; grafika wszystkich 10; ikony wszystkich 10 posiłków); wyliczenia w `docs/ROZWOJ-I-WALKA.md` |
| `tests/smoke.gd` | 527 kontroli w prawdziwym silniku; `tests/qa_shots.gd` robi zrzuty jaskini, bossa, nocy i wydarzenia |

**Układ współrzędnych:** gra używa współrzędnych świata Superior (jak WWW). Układ stolicy z pierwszej próby jest
przesunięty o `world.json.offset` = (44 564,29; 12 168,47).

**Kolizja:** `walk.bin` = siatka nawigacji ∧ teren suchy ∧ poza kolizjami (powiększonymi o promień stopy 12 j.).
Sąsiedztwo wody blokuje o jedną komórkę 16 j. więcej niż przeglądarka (konserwatywnie). Zapis i kolizje nie zależą od grafiki.

**Pamięć i rozmiar:** malowane tekstury (scenografia, ludzie, wnętrza, kafle terenu, mapy) są importowane jako stratny WebP
(`scripts/godot/tune_imports.py`; sprite'y scenerii są współdzielone, więc ich zdekodowany rozmiar jest mały), (wysoka jakość; APK idzie przez Git LFS, więc rozmiar nie jest ograniczony do 100 MiB). APK ma ok. 118 MiB. Dane odczytywane dokładnie (siatki biomów/lądu, maska i klasy dróg) pozostają bezstratne. Pamięć tekstur zgłoszona
przez silnik po wczytaniu krainy: 117–138 MiB na kontynentach, ok. 70 MiB na wyspach. To pomiar na desktopie, nie telefonie.

## 5. Odtwarzanie danych i grafiki

Wymaga pełnego repozytorium, Pythona 3, Pillow i numpy. Skrypty czytają opublikowane pliki Superior v2 i **nie
regenerują geometrii**; `world-provenance.json` zapisuje SHA-256 źródeł i wyników.

```sh
npx tsx scripts/godot/export-lands.ts                # obiekty, role tekstur, drogi, domy stolicy dla 10 krain -> /tmp/godot-lands
python3 scripts/godot/prepare_lands.py               # dane i grafika 10 krain (kafle atlasów wysp wycinane z ramek)
npx tsx scripts/godot/export-actors-rooms.ts         # bohaterowie, NPC i wnętrza czterech światów
python3 scripts/godot/prepare_actors.py
python3 scripts/godot/prepare_races.py               # statystyki, drzewka i opisy czterech ras + portrety
python3 scripts/godot/prepare_continent_hero.py      # klipy bohatera Legendy (paczka 3.3.0)
python3 scripts/godot/prepare_continent_maps.py      # atlas, globus, regiony i komórki mapy dla 10 krain
python3 scripts/godot/prepare_icons.py               # ikony zdolności czterech ras (okrągłe) i paski
npx tsx scripts/godot/export-monsters.ts            # 40 potworów + pomocnik: zasady, cechy, łup, rozmiary
npx tsx scripts/godot/export-bosses.ts               # 8 bossów: katalog, fazy, łup, tłumaczenie na walkę
python3 scripts/godot/prepare_bosses.py              # -> data/bosses.json (sprawdza łup, strażników i przywołania)
python3 scripts/godot/build_packs.py build            # paczki PCK + manifest w deploy/godot-content/<wersja>/ i filtr szczupłego APK (po tune_imports i imporcie)
python3 scripts/godot/prepare_dungeons.py            # 22 wejścia jaskiń i grafiki dungeon-kit -> data/dungeons.json, assets/dungeon
python3 scripts/godot/prepare_monsters.py            # arkusze potworów i rejestry spawnów krain
npx tsx scripts/godot/export-economy.ts              # przedmioty, receptury, ceny sklepu, limity i zestawy, ulepszenia, ikony
npx tsx scripts/godot/export-quests.ts               # 106 zadań, dialogi NPC, sławne i ukryte miejsca -> data/quests.json
python3 scripts/godot/prepare_audio.py               # muzyka i efekty (kopia bez zmian) -> assets/audio
python3 scripts/godot/prepare_land_maps.py          # mapy szczegółowe krain malowane z siatek terenu
python3 scripts/godot/prepare_intro.py               # pozioma kompozycja wstępu i boot splash z ilustracji właściciela (wymaga sharp)
godot --headless --editor --path ports/godot-pyra --import
python3 scripts/godot/tune_imports.py                # malowane tekstury: stratny WebP (rozmiar APK)
godot --headless --editor --path ports/godot-pyra --import
python3 scripts/godot/write_provenance.py
```

Mapowanie obiektów na grafiki to wywołanie funkcji przeglądarki dla każdej krainy (`pyraObjects`, `continentObjects`,
`aetheriaObjects`, `nexusObjects`, `islandObjects`: nazwy, przerzedzanie, mosty/schody). Pominięte: efekty otoczenia (dym, para, żar).

Most TypeScript czyta bieżące kontrakty i grafiki; Python odtwarza marginesy
przyciętych atlasów, origin/mirrored oraz kafle podłoża. Nie generuje nowego świata
ani ilustracji zastępującej scenę. Ponowienie na nowszym commicie może zmienić dane;
sprawdź diff, pochodzenie i testy przed zaakceptowaniem wyniku.
Nie edytuj ręcznie plików `*.generated.json`, aby obejść rozbieżność kontraktów.

`prepare_branding.py` adaptuje istniejący `public/ki-favicon.svg` i konwertuje
repozytoryjny Cinzel z WOFF2 do TTF. Wymaga `fonttools[woff]` (w tym Brotli).
Nie tworzy nowej grafiki świata. `assets/branding/provenance.json` zapisuje SHA
źródeł i wyników. Pełny OFL jest w paczce i dostępny w menu licencji.
Ekran startowy używa „Powered by” i oryginalnego logotypu Godot; boot splash
pokazuje oryginalny logotyp. Plik `godot/logo-large-color-dark.svg` pochodzi
z oficjalnego press kitu, bez zmian liter, kolorów lub proporcji. Jego źródło
i SHA zapisano w `godot/provenance.json`, a atrybucję CC BY 4.0 dołączono do
zasobów i menu licencji. Wstęp używa ilustracji właściciela (`intro-source.png` w repozytorium, poza APK; skrót SHA w `intro-provenance.json`).
Miasto powstaje dopiero po zatwierdzeniu przycisku, z ochroną przed wielokrotnym
uruchomieniem i przejęciem dotyku startowego przez sterowanie gry.

## 6. Budowanie Androida

Godot 4.6.3 + oficjalne Export Templates 4.6.3, JDK 21, Android SDK `platform-tools`, `platforms;android-36`,
`build-tools;36.0.0`. Standardowy eksport nie wymaga Gradle ani NDK.

```sh
python3 scripts/godot/build_android.py --sdk /sciezka/Android/Sdk --java /sciezka/JDK
```

Wynik: `ports/godot-pyra/builds/ki-legends-pyra-debug.apk`. Klucz debug powstaje przy pierwszym eksporcie i zostaje
poza repozytorium (`~/.local/share/ki-legends-godot/debug.keystore`); zachowaj go, aby kolejne APK były aktualizacjami.

## 7. Zapisy

`user://city-checkpoint-v1.json`, format `ki-godot-pyra-save-2` (wersja 2): pozycja, wnętrze, miejsce powrotu,
poziom, XP, drzewko, sloty, HP/KI, ekonomia (plecak, wyposażenie, monety, depozyt, ulepszenia kowala), dziennik zadań i odkryte miejsca; głośność osobno w `user://audio.json`. Format `ki-godot-pyra-save-1` z wersji 0.2.0 jest importowany (przesunięcie do
współrzędnych świata). Nieznany lub uszkodzony plik blokuje nadpisanie. Zapis jest ręczny (MENU). Backup Androida wyłączony.

## 8. Testy i dowody

```sh
godot --headless --path ports/godot-pyra --script res://tests/smoke.gd -- --fresh --qa-output /tmp/pyra-headless
xvfb-run -a -s '-screen 0 1600x900x24' env LIBGL_ALWAYS_SOFTWARE=1 godot --audio-driver Dummy --path ports/godot-pyra --rendering-method gl_compatibility --script res://tests/smoke.gd -- --fresh --qa-output /tmp/pyra-native
```

Na kodzie tej gałęzi: **527/527** kontroli w trybie headless (16.11.2026). Przebieg z natywnym renderowaniem (Mesa llvmpipe) był
ostatnio wykonany przy 340 kontrolach i nie został powtórzony dla 527; zrzuty jaskini, bossa, nocy i wydarzenia powstały natywnie
(`docs/zmiany/2026-11-16/qa/godot-late/`).
Pokrycie: ekonomia (katalog 366/265/85, cena sklepu 4×, skup 50 %, wymagania poziomu, wpływ sprzętu, mikstura, crafting, depozyt,
gospoda, zapis, cztery ekrany usług), rozmiar kontynentu, bezpieczny start, strumieniowanie, **+15 % bohatera**, kolizje,
osiągalność 24 drzwi Pyry i powroty, dotyk, prędkość przy 30/120 FPS, zasady Legendy (statystyki, drzewko, rangi, zdolności na
manekinie), zapis, mapy (miasta wszystkich 10 krain leżą wewnątrz własnych obrysów na atlasie; globus i atlas wybierają ten
sam region), **wczytanie każdej z 10 krain** (stoi na ziemi, ograniczona liczba sprite'ów, drzwi i NPC), **wejście i wyjście
z każdego z ok. 96 wnętrz usług czterech kontynentów**, **cztery rasy** (nowa postać startuje w swoim mieście, statystyki
poziomów 1 i 20 z aneksu, 29 węzłów, +15 % bohatera, podstawowy atak i każda z 6 zdolności czynnych na manekinie bez błędu),
ekran wyboru rasy, **podróż z mapy** (PODRÓŻ na wyspę 3 i z powrotem), układ w trzech rozmiarach ekranu, **potwory** (41
definicji, 8 752 miejsc, budzenie, walka, nagrody, statusy, śmierć i powrót), **rzadkie cechy** (słabość na ogień, pancerz z przodu
kraba, bonus z tyłu lwa, przywołanie os, podział roju, odrodzenie ducha, strefa sieci spowalnia bohatera, dzień i noc), **questy**
(106/102/16/17, przyjęcie, etapy, odkrycia, nagroda raz, zapis), **dźwięk** (pliki w paczce, muzyka podąża za światem),
**zasady ekwipunku** (limity V2, ulepszenia kowala, pięć stacji, mikstura), **bossowie** (osiem, fazy, mechaniki, strażnik, nagrody), **jaskinie** (22 wejścia, labirynt, klucz, krata, skrzynie, kolce, zapis), **wydarzenia świata**, **żywy świat** (dzień i noc, spacery mieszkańców, efekty otoczenia).
Zrzuty: `docs/zmiany/2026-11-15/qa/godot-world/`.

Dodatkowo paczka PCK wyeksportowana z presetu Linux została uruchomiona w osobnym katalogu (`--main-pack`): wszystkie 10 krain,
po jednym wnętrzu sklepu dla czterech ras, 0 błędów (dowodzi, że filtry eksportu dołączają `data/lands/*`). APK sprawdzono:
podpis v2, CRC, pakiet, etykieta, wersja, `arm64-v8a`.
Testy Vitest mostu źródeł (`src/test/godot-pyra-export.test.ts`) nie były uruchamiane w tej sesji (brak `node_modules`);
nie zmieniono źródeł, które czyta.

**Niezweryfikowane:** instalacja i działanie na fizycznym telefonie, FPS, bateria, RAM/VRAM, przycisk Wstecz,
pinch-zoom na mapie (kod jest, test tylko na myszy), czasy ładowania na telefonie.

## 9a. Kontynuacja pracy w nowej sesji (instrukcja dla Claude)

**Stan na 16.11.2026:** ostatni APK to 0.7.0-bestiary (kod 7), kod jest dalej i zawiera całą grę: 10 krain, 4 rasy, miasta z usługami,
mapy 2D/3D, HUD, 41 potworów ze wszystkimi cechami, XP/monety/łup, questy z dialogami, dźwięk, zasady ekwipunku, 8 bossów, 22 jaskinie,
14 wydarzeń świata, dzień i noc, spacery mieszkańców, efekty otoczenia, wstęp na cały ekran. **Następne:** końcowy APK w pełnej jakości
(patrz niżej), pomiary na telefonie i balans liczb autorskich (sekcja 1b). Zasady: `AGENTS.md` (m.in. brak PR i merge bez
zgody, nie przepisywać opublikowanej historii, **nie sterować instancjami GPU**, jedna dokumentacja tematyczna + dziennik
dnia), `docs/INDEX.md`.

**Kolejność pracy (decyzja właściciela):** najpierw przenieść całą grę, dopiero potem zbudować APK; nigdy nie obniżać jakości
grafiki dla rozmiaru (limit 100 MiB nie obowiązuje, gra ma być docelowo większa). Użytkownik nie buduje aplikacji — buduje asystent
i podaje link.

**Zasada dostawy APK:** APK nie jest commitowany domyślnie — kod i dokumentacja wystarczą, żeby go zbudować. Commituj APK
(Git LFS, `deliveries/<data>-<nazwa>/`, plus `manifest.json` z SHA-256) tylko gdy właściciel o to poprosi. Narzędzie Dysku
Google w sesji nie wgra APK (parametr `base64Content` przechodzi przez model; 120 MB nie przejdzie) — do wgrania na Dysk
właściciel pobiera plik z repozytorium albo buduje go lokalnie.

**Środowisko (świeży kontener nie ma niczego):**
```sh
# Godot 4.6.3 (Standard) + szablony eksportu 4.6.3
curl -LO https://github.com/godotengine/godot-builds/releases/download/4.6.3-stable/Godot_v4.6.3-stable_linux.x86_64.zip
curl -LO https://github.com/godotengine/godot-builds/releases/download/4.6.3-stable/Godot_v4.6.3-stable_export_templates.tpz
#  zip -> /usr/local/bin/godot ; tpz (zip) -> ~/.local/share/godot/export_templates/4.6.3.stable/ (zawartość katalogu templates/)
# JDK 21 oraz Android SDK (cmdline-tools): sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0"
pip install pillow numpy fonttools brotli        # skrypty scripts/godot/*.py
npm ci                                           # tsx i eksportery TypeScript (scripts/godot/export-*.ts)
apt-get install -y xvfb                          # testy z natywnym renderowaniem
```
`prepare_intro.py` wymaga modułu `sharp` (`npm i sharp` poza repozytorium i `NODE_PATH`).

**Klucz podpisu.** Debug keystore powstaje przy pierwszym eksporcie w `~/.local/share/ki-legends-godot/debug.keystore` i zostaje
poza repozytorium. Nowy kontener = nowy klucz = telefon nie zaktualizuje aplikacji w miejscu (trzeba odinstalować starą, zapis
zniknie). Chcąc ciągłości, właściciel przechowuje ten plik (hasło debug: `android`, alias `androiddebugkey`) i podaje go nowej
sesji do `~/.local/share/ki-legends-godot/`.

**Pętla pracy:**
1. `git pull` gałęzi `ccr-ebbd6459-n7c5eg` (lub nowej gałęzi od niej); przeczytaj `docs/INDEX.md`, ten README i dziennik 16.11.
2. Dane z TS/Pythona (sekcja 5), `godot --headless --editor --path ports/godot-pyra --import`, `python3 scripts/godot/tune_imports.py`,
   ponowny import.
3. Testy: `godot --headless --path ports/godot-pyra --script res://tests/smoke.gd -- --fresh` (oczekuj samych PASS; ok. 3 min);
   z natywnym renderowaniem w sekcji 8. Zrzuty do kontroli wzrokowej: skrypt na `RenderingServer.frame_post_draw`.
4. Paczka: eksport PCK (`--export-pack "Linux"`) i uruchomienie poza projektem przez `--main-pack` (sprawdza filtry eksportu).
5. APK: `python3 scripts/godot/build_android.py --sdk /opt/android-sdk` (tylko gdy potrzebny), podpis v2 i CRC.
6. Dokumentacja: ten README, dziennik `docs/zmiany/<data>/ZMIANY.md`, `docs/INDEX.md`, `python3 scripts/docs/check_documentation.py`.
7. `npx tsc -b --noEmit`, `npx eslint` dla zmienionych `scripts/godot/*.ts`; cofnij `tsconfig.tsbuildinfo`.
8. Commit i `git push -u origin <gałąź>`; bez PR i merge, jeśli właściciel nie poprosił.

**Pułapki zmierzone w tej pracy:** nowa klasa `class_name` wymaga `godot --headless --import`; zwalnianie obiektu
`PyraMonsters` w trakcie gry wywołuje crash silnika (zarządca żyje przez całą grę, `setup` go resetuje); `$ANDROID_HOME`
= `/opt/android-sdk`; wywołania rysowania HUD kosztują, dlatego rysunek idzie przez `CachedLayer`.

**Prompt do wklejenia w nowej sesji:**
> Kontynuujemy port KI LEGENDS na Androida (Godot 4). Repozytorium `circus574-cpu/pixel-playground-launch`, gałąź
> `ccr-ebbd6459-n7c5eg`. Przeczytaj `AGENTS.md`, `docs/INDEX.md`, `ports/godot-pyra/README.md` (sekcja 9a) i
> `docs/zmiany/2026-11-16/ZMIANY.md`, postaw środowisko według sekcji 9a, uruchom testy `tests/smoke.gd` i sprawdź w sekcji 1
> „Poza zakresem”, co zostało do przeniesienia, i po zatwierdzeniu przez właściciela zrób to; APK buduj dopiero po przeniesieniu
> całości, w pełnej jakości. Nie commituj APK, chyba że poproszę; aktualizuj dokumentację i dziennik.
> Mów konkretnie, pracuj precyzyjnie i bezbłędnie, nie ruszaj instancji GPU.

## 9. Dalsza praca

1. Odbiór na fizycznym Androidzie; pomiary pamięci/FPS (kluczowe: czas wczytania krainy, ok. 120–140 MiB tekstur, walka z 24 potworami,
   jaskinie ze światłem i `CanvasModulate`, wiele efektów otoczenia naraz) i balans liczb autorskich (sekcja 1b).
2. Kolejne piętra jaskiń i bossowie w jaskiniach (nie istnieją w przeglądarce ani w porcie; po decyzji właściciela).
3. Końcowy APK w pełnej jakości (Git LFS tylko na prośbę właściciela), z podpisem v2 i sprawdzeniem CRC.
4. Jakość grafiki: drobne ślady stratnego WebP przy dużym powiększeniu; rozważyć ASTC, jeśli rozmiar APK nie będzie ograniczeniem.

Pracować na osobnych gałęziach; bez scalenia, publikacji i zmian produkcji bez decyzji właściciela. Nie modyfikować
infrastruktury GPU. Prawa do grafik pozostają według rejestru projektu; eksport do Godot nie nadaje nowych uprawnień.

### Wersje i aktualizacje (od 1.0)

Aplikacja ma wersję **1.0** (`versionCode` 100). Kolejne wersje (1.1, 1.2, …) są wydaniami treści na serwerze i nadpisują grę po pobraniu; APK instaluje się raz.
Wydanie nowej wersji: `python3 scripts/godot/build_packs.py build --version 1.1` (paczki i `core-c100` do `deploy/godot-content/1.1`), kopia do `deliveries/godot-content-1.1`,
workflow „Godot content packs to VPS (manual)” z `version=1.1`, `publish` i `activate` (za zgodą właściciela). Nowy APK tylko dla zmian spoza serwera (film, ikona, ikony przedmiotów, silnik, nowa `class_name`);
wtedy nowy `versionCode` i klucz rdzenia (`core-c<kod>`), a `CLIENT_CODE` w `boot.gd` i `net.gd` oraz `version/code` w `export_presets.cfg` muszą się zgadzać (pilnuje tego smoke test).

**Pułapka aktualizacji (16.11.2026).** `boot.gd` zainstalowanej aplikacji ładuje `scripts/skin.gd` przed montażem rdzenia, więc ten plik jest zamrożony; nowy wygląd idzie przez `scripts/look.gd` i `data/*.json`. Każdą zmianę sprawdzaj `python3 scripts/godot/e2e_installed.py`. Opis awarii i otwarte sprawy: `docs/zmiany/2026-11-16/ZMIANY.md`, sekcje 19–20.
