# Zmiany 2026-11-15

### 1. Przygotowanie do uruchomienia globalnego: strona główna, konto, opisy i biografie ras

Zlecenie właściciela z 15.11: strona główna gotowa na odwiedzających, panel zakładania konta, opis każdej rasy i biografie
(jeśli ich brak w dokumentacji), przegląd kodu, fizyczny test gracza do poziomu 10 i pełny raport.

- **Strona główna dla niezalogowanych** (`src/components/landing/Landing.tsx`): hero, „O grze”, cztery karty ras (portret,
  świat i miasto, tytuł, opis, rola, mechanika, zasada kultury, pierwsza zdolność, biografia rozwijana przyciskiem),
  panel „Dołącz” z formularzem rejestracji i logowania, stopka z regulaminem, polityką prywatności, mapą i kontem.
  Zalogowany gracz widzi dotychczasowy wybór postaci i grę (`src/routes/index.tsx`).
- **Wspólny formularz konta** (`src/components/account/AccountForm.tsx`) używany na stronie głównej i w `/konto`:
  logowanie, rejestracja, przypomnienie hasła, ustawienie nowego hasła, linki `?aktywacja=` i `?nowe-haslo=`.
  Rejestracja wymaga zaznaczenia zgody na regulamin i politykę prywatności (kontrola po stronie klienta).
- **Opisy i biografie ras** (`src/game/world/raceLore.ts`): cztery biografie po trzy akapity (dom, historia, obecna Cisza),
  oparte na `FABULA-I-EKWIPUNEK.md` i `RASY-I-POSTACIE.md`, bez zdradzania ukrytej prawdy kampanii. Te same dane widać na
  stronie głównej i w panelu szczegółów rasy przy wyborze postaci („Rola i mechanika”, „Pierwsza zdolność”, biografia).
- **Strony prawne** `/regulamin` i `/prywatnosc`: **projekty** z polami `[...]` do uzupełnienia i widocznym baner
  „PROJEKT — wymaga przeglądu prawnego”. Polityka opisuje dane, które usługa faktycznie zbiera (e-mail, nick, skrót hasła
  scrypt, daty, postacie, IP tylko do limitów w pamięci, token odświeżania w `localStorage`, Resend jako odbiorca,
  brak analityki). **Nie są gotowe do publikacji bez uzupełnienia danych administratora i przeglądu prawnika.**

### 2. Błędy znalezione w przeglądzie i teście gracza

- **„Podejdź do rynku” zrywało sesję online (`COMMAND_REJECTED`).** Trzy miejsca (`AdventurePanels.tsx` ×2, `GameHud.tsx`)
  wysyłały `{ type: "move", ...world.market }`, czyli razem z `action`, `instruction`, `label` i `radius`. Serwer
  waliduje polecenia ściśle (`.strict()`), odrzucał pakiet i zamykał sesję: nowy gracz klikający przycisk samouczka
  dostawał ekran „Nie udało się otworzyć świata”. Teraz wysyłane jest tylko `{ type: "move", x, y }`.
  Testy: `adventure-ui.test.tsx` (kształt polecenia z przycisku, na starym kodzie czerwony) i nowy
  `online-command-shapes.test.ts` (53 kształty poleceń wysyłanych przez interfejs sprawdzone wobec schematu serwera).
- **Odmiana imion NPC w tekstach zadań i planie miasta:** „Porozmawiaj z Airy przy miejscu startowym”, „Idź do Aira”,
  „Idź do Ren”, w Aetherii i Pyrze „Idź do Sora/Kaena”. Nowy `src/game/npcNames.ts` odmienia jednoznaczne imiona
  (dopełniacz i narzędnik), pozostałe zostają bez zmian. Użyte w `session.ts`, panelu zadań i planie miasta.
- **Konta (`src/server/accounts/service.ts`):** zablokowane konto (`disabled_at`) dostawało sesję przez link aktywacyjny
  lub resetu hasła (`assertActive` po `useEmailToken`); dwie równoczesne rejestracje tego samego nicku kończyły się
  błędem serwera zamiast `NICK_TAKEN` (naruszenie unikalności `users_nick_key` jest teraz mapowane). Dwa testy.

### 3. Test gracza „fizyczny”: lokalnie, nie na produkcji

**Gdzie i jak:** w kontenerze sesji, nie na `kilegends.pl`. Prawdziwy kod serwera gry (`GameServer`: konta, postacie,
tick 20 Hz) na lokalnym PostgreSQL 16, strona z dev-serwera Vite, e-maile do Resend przechwytywane (nie wysyłane).
Gracz to bot Playwright, który naciska prawdziwe klawisze (WASD, Spacja, Q, E, F) i klika myszą, a stan gry tylko czyta
(`?ki-debug=1`). Narzędzia: `scripts/qa/playthrough/` (`stack.mts`, `fullstack.vite.ts`, `join.cjs`, `player.cjs`,
`nav-spawns.mts`). Render swiftshader 960×540 (ok. 12–20 FPS), więc bot jest wolniejszy od człowieka.
**Test przerwano na prośbę właściciela na poziomie 6.** Poziomy 7–10 nie zostały sprawdzone.

**Ścieżka konta** (3 przebiegi): strona główna → rejestracja (bez zgody odmowa) → logowanie przed aktywacją odrzucone →
link z e-maila → „Konto aktywne” i zalogowanie → wybór rasy z biografią → wejście do gry. Działa.

**Wynik (konto Gracz1, Planetarni, 12:01–13:04, 63 min):**
- poziom 6, 199/400 XP; łącznie ok. 1300 XP (z zadań i zabójstw), ok. 4 zgony (po 10% postępu XP, odrodzenie po 3 s w mieście,
  bez utraty przedmiotów ani złota);
- czasy poziomów: poz. 2 po 2,2 min, 3 po +4,7, 4 po +1,6, 5 po +9 (z 11 min przestoju bota), 6 po +4,2 min; potem
  ok. 30 min bez poziomu 7 (bot walczył z potworami poz. 6–7 i ginął; po zmianie na potwory poz. 4 pierwsze +70 XP w 10 min);
- zadania: „Pierwsze kroki”, „Zagrożenie w lesie” i „Pierwsze wyposażenie” ukończone przez prawdziwe okna rozmów,
  nagrody odebrane (40 + 80 + 40 XP, monety, Ostrze strażnika założone: Atak 16 → 24); zadanie fabularne „Pierwsze kroki
  przed Ciszą” w toku;
- 9 wizyt w mieście: plan miasta („Idź do …” prowadzi postać ulicami), rozmowy z Airą, Renem, Mio i Taro, zakup mikstur
  (do 8), ekwipunek, drzewko umiejętności (Szybki Unik poznany i podniesiony do rangi 5);
- łup i materiały: 29 mchowej galaretki, 7 zielonego ziela, 6 cierni wilka, 1 skóra wilcza; wiedza bestiariusza
  o leśnym pająku (poz. 14) i skalnym jeleniu (poz. 12) po zabłądzeniu bota daleko na południe;
- koniec: 19 monet, 3 mikstury, brak pancerza (Kamizelka podróżnika 25 monet nie wyszła przez brak monet).

**Co ujawnił test:**
- **Błąd „Podejdź do rynku”** (pkt 2) zrywał sesję każdemu, kto kliknął przycisk samouczka. Naprawiony.
- **Utrata połączenia z serwerem gry 2 razy w 63 min** (12:33 i 13:00): ekran „Utracono połączenie… Ponów próbę”,
  po kliknięciu gra wraca z postacią nienaruszoną. Przyczyna **niewyjaśniona**: dev-proxy Vite zgłosił `write ECONNRESET`;
  podejrzenie to próg 4 MB bufora serwera (`socket.bufferedAmount`) przy przeciążonym CPU kontenera. Do sprawdzenia na
  prawdziwym serwerze. (Trzecią utratę, w pierwszym przebiegu na koncie Gracz2, spowodowałem sam: uruchomiłem testy kont
  na tej samej bazie, a one robią `TRUNCATE accounts.users`; ten przebieg do poz. 3 przepadł.)
- **Trudność wczesnej gry:** dwa wilki poz. 2 zabijają bohatera poz. 4 (233 HP) w ok. 10 s (ok. 30 HP/s), a mikstura leczy
  93 HP co 6 s. Bot używa tylko Spacji i mikstur, bez uników i umiejętności, więc człowiek da sobie radę lepiej. XP za
  zabójstwo jest stałe (`def.xp`, bez skalowania różnicą poziomów), najlepszy stosunek XP do HP mają potwory poz. 4.
  Balans pozostaje decyzją właściciela.
- **UX do decyzji** (nie zmieniane): okno rozmowy ma podwójny nagłówek i dwa razy to samo powitanie; w oknie NPC są dwa
  równoległe systemy zadań z dwoma przyciskami „Przyjmij zadanie” („Pierwsze kroki” w HUD kontra „Pierwsze kroki przed Ciszą”).
- Konsola przeglądarki: ostrzeżenie hydratacji (tylko dev) i `403` z odpowiedzi serwera „konto nieaktywne”, którą Chrome
  loguje jako błąd sieci (oczekiwane). Błędów strony (`pageerror`) brak.

Dowody: `docs/zmiany/2026-11-15/qa/playthrough/` (zrzuty poziomów, śmierci, utraty połączenia, planu miasta, sklepu,
drzewka i logi botów).

### 4. Kontrole zbiorcze

- `npm run typecheck` (trzy konfiguracje) i `eslint .`: czyste po usunięciu plików tymczasowych (17 ostrzeżeń
  `react-refresh` w `components/ui` istniało wcześniej).
- `vitest run`: 2082 zaliczone, 2 nie: `development-etap1-assets.test.ts` wymaga plików `art/production/development/v001`,
  których ten checkout (sparse) nie zawiera; to ograniczenie środowiska, a nie skutek zmian (CI ma pełny checkout).
- Nowe testy: `landing.test.tsx`, `npc-name-case.test.ts`, `online-command-shapes.test.ts`, trzy w `accounts-service`
  i `adventure-ui`.

### 5. Otwarte ryzyka przed uruchomieniem globalnym

- **Teksty prawne to projekty** (`/regulamin`, `/prywatnosc`): pola `[...]` i przegląd prawnika są wymagane.
- **Zgoda na regulamin jest sprawdzana tylko w przeglądarce**; serwer jej nie zapisuje (brak dowodu zgody).
- **Prawdziwy e-mail nie sprawdzony:** domena w Resend, SPF/DKIM, `PUBLIC_SITE_URL`, `RESEND_API_KEY`.
- **Limity IP w pamięci procesu** i oparte o pierwszy wpis `X-Forwarded-For`: zadziałają tylko, jeśli proxy nadpisuje
  nagłówek; po restarcie serwera liczniki się zerują.
- **Serwer gry ma twardy limit 50 graczy** (`max 50 graczy`); przy premierze globalnej trzeba go podnieść lub dołożyć kolejkę.
- **Strona główna w SSR pokazuje ekran ładowania**, bo sesja jest czytana z `localStorage`; roboty bez JavaScript widzą
  tylko metadane. Cała treść jest po polsku, bez wersji angielskiej.
- **Nie sprawdzono:** poziomy 7–10, trzy pozostałe rasy w grze, telefon i dotyk, wielu graczy naraz, prawdziwy serwer.

### 6. Pięć poprawek zgłoszonych przez właściciela (teleport GM, globus, świat, spawny, mapa 2D)

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

### 7. Kontrole poprawek mapy i świata

- `npm run typecheck` (trzy konfiguracje), `eslint .` bez błędów (17 starych ostrzeżeń `react-refresh`).
- `vitest run`: 2023 zaliczone, 2 nie: `development-etap1-assets.test.ts` wymaga plików `art/production/development/v001`,
  których ten checkout (sparse) nie zawiera; CI ma pełny checkout.
- Nowe testy: `navigation-staff-spot`, rozszerzony `staff-map-runtime`, `scenery-thinning`, `open-fields`, trzy w
  `map-terrain-canvas`.
- Zrzuty w grze (lokalny serwer na PostgreSQL, nie produkcja): `qa/mapa-swiat/`.

### 8. Pierwsza próba KI Legends w Godot 4 na Androida — miasto Pyry

Zlecenie właściciela: rozpocząć próbę przenoszenia KI Legends do Godot 4 na Androida,
na początek samo miasto, np. Pyra. Powstał izolowany port **Twierdzy Popiołu** na gałęzi
`feat/godot-pyra-android-20261115`, od `main@0b69c28e4b45a59f32251f5ac6d54e1365660d98`.
Projekt `ports/godot-pyra/project.godot`, Godot **4.6.3**, GDScript i Compatibility.
Nie scalono do `main`, nie wdrożono do gry WWW ani Google Play.

| Element | Stan przed | Zmiana | Dowód |
| --- | --- | --- | --- |
| Miasto | Istniejące definicje Pyry w Phaser | Natywna scena Godot z 53 obiektami i źródłowymi kolizjami | Zrzuty rzeczywistego viewportu i przejście postaci do sali |
| Grafika | Atlasy WWW i osobne tekstury | Eksport z przyciętych atlasów z zachowaniem sourceSize/origin/mirrored; 44 współdzielone tekstury | SHA-256 45 plików źródłowych i 6 testów porównania danych |
| Postać | Legenda w grze WWW | Osiem kierunków idle/walk, szybkość 170 z aneksu, fizyka stóp i budynków | Kolizja na oryginalnym footprint, ruch przy limitach 30/120 FPS |
| Android/dotyk | Brak projektu Godot | Joystick 360°, osobny palec interakcji, cancel/fokus, safe area, układ poziomy | Wstrzykiwane zdarzenia ScreenTouch przez rzeczywisty viewport i trzy rozmiary okna |
| NPC i wnętrza | 8 NPC / 6 budynków w źródle | Rozmowy, wejścia i powroty, oryginalne pokoje 1920×1280 | Próba wszystkich sześciu drzwi, dojście do NPC wewnątrz |
| Zapis | Zapisy kont gry WWW | Osobny lokalny checkpoint v1, bez konta i bez importu zapisów WWW | Round-trip oraz ochrona nowszego nieznanego pliku |
| Paczka | Brak APK | Samodzielny debug APK ARM64, Android 7+, target 36, osobny package ID | Podpis v2/v3, CRC ZIP, wyrównanie 16 KiB, manifest i biblioteka Godot |

#### Paczki do próby

- [APK Android ARM64](../../../deliveries/godot-pyra-android-20261115/ki-legends-pyra-debug.apk) —
  **46 783 250 bajtów**, SHA-256 `39d152bc4d0b595320e1273004c10b71a747993872693464e886893c34c114ed`.
- [Projekt Godot ZIP](../../../deliveries/godot-pyra-android-20261115/ki-legends-pyra-godot-project.zip) —
  otworzyć `godot-pyra/project.godot` w Godot 4.6.3; bez `.godot`, buildów i kluczy.
- [Manifest paczek](../../../deliveries/godot-pyra-android-20261115/manifest.json).
- [Uruchomienie, eksport i architektura](../../ARCHITEKTURA-I-TESTY.md#próba-migracji-godot-4--android--miasto-pyry-15112026).

APK jest podpisany lokalnym certyfikatem debug; klucz pozostaje poza Git.
Nie żąda internetu ani dostępu do pamięci zewnętrznej. Package `pl.kilegends.godot.pyra`,
min SDK 24, target SDK 36, orientacja pozioma `USER_LANDSCAPE`.
W eksporcie znalazły się rzeczywiste `libgodot_android.so`, dane miasta i zasoby;
wykluczono testy oraz surowy zrzut źródeł. Wyeksportowany program Linux również
uruchomiono z zasobów wbudowanych w paczkę, bez odwołań do edytora.

#### Sprawdzenia

- Godot headless: **52 PASS / 0 FAIL**.
- Natywny Godot X11, Compatibility, Mesa llvmpipe: **52 PASS / 0 FAIL**;
  zrzuty i nagranie pochodzą z silnika, nie z generatora obrazów ani makiety WWW.
- Viewporty: **854×480, 1280×720, 1600×720**. Przy ruchu 170 j./s i limitach
  renderowania 30/120 FPS zmierzono zbliżony dystans, z tolerancją pojedynczych kroków fizyki.
- Pełny TypeScript aplikacji/e2e/tools PASS, Vitest **2112 PASS / 0 FAIL / 12 SKIP**
  (zastane testy PostgreSQL bez osobnej bazy), lint **0 błędów / 17 zastanych ostrzeżeń**,
  kontrola zasobów oraz build WWW PASS. Sześć nowych testów dotyczy mostu danych.
- Parser Godot, eksport APK i podpis v2/v3 PASS, CRC paczki PASS, wyrównanie 16 KiB PASS.
- Wczesne próby ujawniły osierocone etykiety przy zwalnianiu bohatera,
  pomylenie współrzędnych fizycznego okna headless 64×64 z logicznym viewportem,
  niedozwolone nadpisanie SDK bez Gradle oraz wymagany znacznik importu ETC2/ASTC.
  Poprawiono przyczyny; obecne wyniki pochodzą z pełnego ponowienia.
- **Fizyczny Android niezweryfikowany:** brak podłączonego urządzenia. Podpisana paczka
  i próba desktopowa nie stanowią testu instalacji, GPU, baterii ani FPS na telefonie.

Szacunkowy budżet pikseli tekstur widoku miasta to **75,05 MiB RGBA** dla aktywnych
materiałów i postaci. Nie obejmuje viewportu, UI, pamięci silnika ani przejściowych
alokacji; nie jest całkowitym zużyciem RAM na Androidzie.

#### Materiały odbioru

[Manifest wyników](qa/godot-pyra/acceptance.json),
[hash wejść portu](qa/godot-pyra/source-inputs.json),
[headless JSON](qa/godot-pyra/headless-results.json),
[natywny JSON](qa/godot-pyra/native-results.json),
[Vitest JSON](qa/godot-pyra/vitest.json.gz),
[miasto](qa/godot-pyra/city-spawn.png),
[miasto na 854×480](qa/godot-pyra/city-854x480.png),
[rozmowa w sali](qa/godot-pyra/hall-dialog.png),
[kuźnia](qa/godot-pyra/room-smithy.png),
[depozyt](qa/godot-pyra/room-depot.png),
[nagranie natywnego autotestu](qa/godot-pyra/native-gameplay.mp4),
[manifest SHA-256 dowodów](qa/godot-pyra/evidence-sha256.json).

Workflow `Godot Pyra city prototype` pobiera przypięty binarny Godot 4.6.3
(z kontrolą SHA-256), wykonuje parser/import, testy headless i prawdziwy render
OpenGL przez Xvfb, a wyniki zachowuje jako artefakt. Nie publikuje produkcji.
Wynik CI należy przypisywać do SHA faktycznie przetestowanego w Actions.

#### Pozostało poza tą próbą

Pełny kontynent i streaming, walka/umiejętności, zadania i postęp,
handel/crafting/przedmioty depozytu, audio oraz konta/zapisy serwerowe.
Dialogi zawierają tekst z gry, ale nie przyznają nagród ani postępu Godot.
Nie migrowano postaci, nie resetowano danych, nie zmieniano statystyk,
generatorów świata, geometrii Superiora, infrastruktury GPU ani produkcji.
