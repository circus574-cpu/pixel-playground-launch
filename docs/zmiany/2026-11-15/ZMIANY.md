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

### 8. Przewodniczka i rozmowy w świecie, bez okienek

Zlecenie właściciela: na początku gry przewodniczka podchodzi do gracza i opisuje, gdzie jest który budynek, w mieście
każdej z czterech ras; rozmowy z NPC mają toczyć się w świecie, a NPC ma rozmawiać i prowadzić, bez okienka i bez
blokowania gry. Gałąź `feat/przewodniczka-rozmowy` (bez scalenia i publikacji: wymaga osobnej zgody właściciela).

**Diagnoza.** Dotychczasowa rozmowa była oknem modalnym i zamrażała całą symulację: `stepSimulation` kończył się, gdy
`dialogue` było ustawione, każde polecenie dostawało „Zamknij okno, aby kontynuować”, `mountGame` ignorował kliknięcia
w świat, a HUD wyłączał mikstury i umiejętności.

**Rozwiązanie.**
- **Rozmowa w świecie:** NPC mówi dymkami nad głową (scena Phaser, stały rozmiar na ekranie), kolejne kwestie same, w
  tempie czytania. Wybory (zadanie, nagroda, dostawy, plotki, „Do zobaczenia”) są w pasku przy dolnej krawędzi bez tła i
  bez blokady (`NpcTalk`). Napisy dla czytników ekranu są w obszarze `aria-live`, a nie na ekranie, żeby nie dublować dymka.
  Zwykłe otwarcie rozmowy nie wyświetla już komunikatu „Imię: rola” (imię i rola są w pasku i nad postacią).
- **Gra nie staje:** `dialogue` nie zatrzymuje symulacji, poleceń ani ruchu. Rozmowa kończy się sama po oddaleniu na
  220 jedn., po zniknięciu rozmówcy z listy (wejście do budynku) albo po śmierci. Usługi wymagają bliskości jak dotąd
  (handel 115 jedn.). Serwer online uruchamia ten sam `GameSession`, więc obowiązuje tak samo; protokół poleceń bez zmian.
- **Okno tylko tam, gdzie trzeba przeglądać listy:** handel, kuźnia i ulepszenia, pracownia alchemiczna, leża bossów, plan
  miasta (`NpcDialogue servicesOnly`, wstrzymuje grę jak panel). Depozyt, trening i odpoczynek to pojedyncze przyciski.
- **Oprowadzanie:** nowa postać (poz. 1, zadanie „Pierwsze kroki” nieprzyjęte, brak zapisu ukończenia dla postaci i
  miasta) ma przewodniczkę, która od pierwszej klatki czeka przy drzwiach sali zgromadzeń, po 1,8 s idzie do gracza,
  wita się i prowadzi po sześciu budynkach (najbliższy pierwszy) i punkcie pierwszego zadania. Ogłasza każdy punkt z
  kierunkiem i czasem marszu, na jego drzwiach pojawia się pulsujący pierścień z nazwą, prowadzi tam ścieżką nawigacji
  (gotowy cykl chodu 8-kierunkowego) i opisuje na miejscu. Czeka, gdy gracz został dalej niż 700 jedn., woła, rusza dalej,
  gdy ten wróci; po 90 s łącznego czekania sama kończy. Przycisk „Pomiń oprowadzanie” jest cały czas na ekranie, a
  powtórka (w każdym mieście) to „Oprowadź mnie po mieście” w rozmowie z przewodniczką. Cztery głosy: Aira (ciepły,
  praktyczny), Sora (spokojny, o źródłach), LYRA-7 (procedura, „węzły”), Kaena (ogniska, przysięga). Teksty są
  propozycją do przeglądu właściciela.
- **Granice:** oprowadzanie to wyłącznie prezentacja (nie zmienia stanu gry ani serwera). Kliknięcie przewodniczki w
  trakcie trasy jest przechwytywane (odpowiada, że prowadzi), a zagadnięcie jej dawnego posterunku przed startem
  przywołuje ją. Dokumentacja: [Świat i miasta](../../SWIAT-I-MIASTA.md#przewodniczka-i-rozmowy-w-świecie--15112026),
  [Architektura i testy](../../ARCHITEKTURA-I-TESTY.md#rozmowy-w-świecie-i-oprowadzanie--15112026).

**Kontrole.**
- Nowe testy: `talk-tour` (czas czytania, kierunki, głosy, plan trasy dla wszystkich 16 miast z prawdziwych danych świata
  v2, zachowanie `TourDirector`), `talk-engine` (oprowadzanie w czterech stolicach, zapamiętanie, przerwanie, pauza,
  przechwycenie kliknięcia, dymki), `npc-talk-ui` (HUD). Zaktualizowane: `session` (rozmowa nie zatrzymuje gry, odejście
  kończy rozmowę, usługi wymagają bliskości), `adventure-ui`, `npc-commerce-ui`, `swarm-audit-ui` oraz 12 specyfikacji
  e2e (przycisk „Do zobaczenia”, rola `group`, okno „Usługi: …”).
- Przeglądarka (`scripts/playtest.html`, gra lokalna offline, Chromium z SwiftShader, bot idący za przewodniczką
  klawiszami WASD): pełna trasa w czterech stolicach: Verdantia 174 s, Aetheria 188 s, Nexus-9 186 s, Pyra 182 s; za
  każdym razem 7 punktów, znacznik przy każdych drzwiach, powrót przewodniczki dokładnie na posterunek z danych, brak
  błędów w konsoli. Zwykła rozmowa (Ren): pasek zamiast okna (0 elementów `role=dialog`), dymek z jego tekstem, bohater
  w trakcie rozmowy przeszedł 108–130 jedn., rozmowa zakończyła się sama po oddaleniu na ok. 320 jedn. z pożegnaniem
  „Do zobaczenia.” Zrzuty: `qa/przewodniczka/`.
- **Dymek na bohaterze (usterka znaleziona przez właściciela na zrzutach).** Pierwsza wersja wieszała dymek zawsze nad
  głową mówiącego; przewodniczka idzie tuż przy graczu, który stoi w środku ekranu, więc dymek często zasłaniał
  bohatera (np. Pyra, „Kowale żaru hartują…”). Nie wykryły tego moje testy, bo sprawdzały treść, a nie geometrię.
  `bubblePlacement.ts` przesuwa dymek na bok, nad albo pod bohatera, gdy wisiałby na nim, i trzyma go w widocznym
  obszarze. Pomiar w grze: w każdej próbce (co 0,7 s) prostokąt dymka kontra sprite bohatera: Verdantia 179 próbek,
  Aetheria 200, Nexus-9 206, Pyra 191: **0 nakładek, 0 dymków poza ekranem**; telefon 852×393: 30 próbek, 0 nakładek.
  Test jednostkowy `talk-bubble` obejmuje 16 kierunków × 5 odległości mówiącego.
- **Układ na telefonie (usterki znalezione pomiarem):** pigułka „Pomiń oprowadzanie” najpierw zachodziła na panel gracza
  (u Legend i Androidów panel ma dodatkowy pasek zasobu), potem na panel „Akcje”; na wąskim ekranie jest teraz na dole,
  pośrodku, i pomiar nie wykazuje kolizji z żadnym elementem HUD. Na pulpicie jest pod panelem gracza.
- Wynik pierwszego przebiegu Aetherii był przerwany przeładowaniami modułów serwera deweloperskiego po moich edycjach
  w trakcie biegu; powtórzony bez edycji przeszedł w całości.
- e2e (Playwright): 12 specyfikacji zaktualizowanych tekstowo i sprawdzonych typami (`tsconfig.e2e.json`), ale
  **nie uruchomionych**: próba na serwerze deweloperskim kończy się ekranem „Nie udało się otworzyć świata” jeszcze
  przed rozmową (problem środowiska, nie rozmowy); do sprawdzenia na buildzie.

**Nie sprawdzono / otwarte:** tryb online na żywym serwerze (wspólny `GameSession` i protokół bez zmian, ale nie
uruchamiano); telefon i dotyk (układ paska i pigułki sprawdzono tylko na pulpicie); automatyczna trasa w miastach poza
pierwszym (jest na żądanie); pierścień przy drzwiach nie jest na minimapie; zapamiętanie ukończenia jest w przeglądarce
(czyszczenie danych witryny powtórzy trasę); okna handlu i kuźni nadal są oknami (decyzja właściciela, czy też je zastąpić).
