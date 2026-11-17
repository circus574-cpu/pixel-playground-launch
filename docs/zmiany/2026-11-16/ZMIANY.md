# Zmiany 2026-11-16

### 1. Android / Godot 0.6.0-world: wstęp na cały ekran, płynność, mapy, pełny HUD

Zlecenie właściciela: poprawić mapę 2D i 3D (lepsza grafika), usunąć lekkie przycinanie postaci w mieście, ekran
wczytywania ma być poziomy i wypełniać cały ekran, zacząć pełny HUD i dopracować jego jakość, sprawdzić straty FPS i
usunąć przycinki. Potwory, przedmioty, questy dopiero po tym — **nie zaczęto ich** w tej partii.

- **Wstęp i boot splash.** Pionowa ilustracja (1121 × 1403) na poziomym ekranie dawała wąski pasek z rozmytymi bokami.
  `scripts/godot/prepare_intro.py` składa z niej poziomą kompozycję 2560 × 1152: ilustracja przeskalowana na szerokość i
  przycięta do pasa z czterema postaciami, oryginalny napis „KI LEGENDS” wycięty z tej samej grafiki i wtopiony u góry
  (miękka maska), dół przyciemniony pod przyciski. Nic nie zostało domalowane. Ekran startowy używa jej w trybie „cover”
  (wypełnia cały ekran, bez pasów i zniekształceń), przycisk jest na dole pośrodku, „Powered by GODOT ENGINE” w prawym
  dolnym rogu; boot splash to ten sam kadr 16:9 z logo. Oryginał `intro-source.png` zostaje w repozytorium (poza APK).
  Przy ekranach węższych niż 20:9 boki kompozycji są przycinane.
- **Płynność (FPS).** Pomiar w trybie programowym (llvmpipe, więc liczby względne, nie telefonu): shader terenu to ok. 70 %
  czasu klatki, strumieniowanie chunków dawało skoki 16–18 ms, wejście do wnętrza blokowało ok. 44 ms, a HUD narysowany
  poleceniami to ok. 260 wywołań rysowania. Zmiany:
  1. **Podłoże wypalane.** Shader terenu renderuje się raz do tekstur kwadratów 512 j. (SubViewport, ok. 1 piksel na
     jednostkę, zakładka 4 px, więc bez szwów), potem rysowane są zwykłe sprite'y; wypalanie 1 kwadratu na klatkę przed
     kamerą, zwalnianie za nią. Klatka 51 → 27 ms (na tym samym sprzęcie, ten sam obraz). Koszt: ok. +50 MiB tekstur
     (zmierzone: 137 → 187 MiB w Verdantii). Ograniczenie: woda na stałe nie faluje (wypalona).
  2. **Strumieniowanie czasowe.** Chunki scenerii budują się w porcjach (2,5 ms/klatkę), najbliższy pierwszy; tekstury ładują
     się na wątkach (`ResourceLoader.load_threaded_request`), zwalnianie rozłożone na klatki; wejście do krainy buduje
     wszystko od razu (`update_view(..., true)`).
  3. **Symulacja na klatkę, nie na tik fizyki.** Ruch bohatera i kamery szedł w `_physics_process` (60 Hz bez
     interpolacji), co na ekranach 90/120 Hz daje nierówne kroki. Teraz `simulate(delta)` w `_process` (delta ograniczona do
     50 ms).
  4. **Prefetch wnętrz.** Obraz pokoju i arkusze jego NPC dekodują się na wątkach, gdy bohater jest bliżej niż 900 j. od
     drzwi; wejście 44 → 2 ms. Arkusze bohatera są ładowane w tle po wyborze rasy.
  5. **HUD w pamięci podręcznej.** Rysunek HUD i przycisków dotykowych trafia do przezroczystego SubViewport w rozdzielczości
     urządzenia i jest odświeżany tylko, gdy zmieni się to, co pokazuje (podpis stanu), więc w spoczynku to dwa quady.
     Wywołania rysowania: 337 → 77 (verdant, ten sam widok).
  6. Menu → **FPS I DIAGNOSTYKA** pokazuje FPS, czas klatki, wywołania rysowania i pamięć tekstur.
- **Przycinanie w mieście.** Dane kolizji budynków sprawdzono (mała liczba dużych obiektów-landmarków na brzegu mapy bez
  kolizji w opublikowanych danych, w miastach stopy budynków blokują poprawnie; bohater zatrzymuje się przed progiem
  drzwi). Przyczyną odczuwalnego przycinania były nierówny krok (pkt 3), skok przy wejściu do wnętrza (pkt 4) i ładowanie
  tekstur w locie (pkt 2). Czy to dokładnie to, co widział właściciel, wymaga potwierdzenia na telefonie — kolizje nie
  zostały zmienione.
- **Mapy.** Mapa szczegółowa każdej krainy jest teraz malowana z opublikowanych siatek (`prepare_land_maps.py`: kolory
  biomów, cieniowanie, morze ciemniejące od brzegu z pianą, lawa/kryształ, tylko główne drogi) zamiast zrzutu z szumem;
  widok ma plakietki Cinzel bez nakładania się, znaczniki wg rodzaju miejsca, legendę, kompas, winietę i ramkę, a brzeg mapy
  wtapia się w morze. Atlas 2D: siatka współrzędnych, plakietki, pulsujące zaznaczenie regionu, usunięto pionową linię na
  szwie daty (zamykanie obrysu). Globus 3D: atmosfera, osobna warstwa chmur z cieniem, odblask słońca na morzu, ciepły
  terminator, podświetlenie wybranego regionu (maska z obrysu), znaczniki-poświaty, kula mieści się w oknie.
- **HUD (pierwsza pełna wersja).** Medalion z portretem rasy i pierścieniem XP, plakietka poziomu, ozdobne paski HP/KI/zasób
  rasy z tarczą, rząd buffów z licznikami, monety; baner lokacji (Cinzel) ze znacznikiem strefy; ramka celu (manekin;
  gotowa na potwory); okrągła minimapa z mapy krainy (strzałka kierunku, miasta, wskaźniki na obrzeżu); okrągłe przyciski
  menu z ikonami; tracker zadań (gotowy interfejs, pusty do czasu questów); cienki pasek XP; powiadomienia i podpowiedzi
  jako plakietki. Przyciski dotykowe: ikony zdolności z malowanymi grafikami ras, wirujące odnowienie, koszt KI, ikona
  miecza i uniku, **szybki slot mikstury** (liczba i odnowienie).

**Decyzje i ograniczenia.** (1) Kompozycja wstępu przycina oryginał (pionowy kadr nie mieści się w poziomym bez
cięcia); pełny oryginał nie jest nigdzie pokazany. (2) Wypalane podłoże: stała woda i +50 MiB tekstur. (3) Pomiary FPS są
względne (renderowanie programowe); FPS na telefonie niezweryfikowany. (4) Tracker zadań i ramka celu nie mają jeszcze
źródła danych poza manekinem. (5) Minimapa pokazuje miasta i miejsca, nie drogi bieżącego widoku.

**Kontrole.** `tests/smoke.gd`: **313/313** headless i **313/313** z natywnym renderowaniem (nowe: wypalone podłoże w
ograniczonym zbiorze, kolejka chunków zamiast budowy naraz, `flush`, budżet wywołań rysowania, HUD w warstwach z cache,
przyciski i minimapa na ekranie, znaczniki krainy, diagnostyka FPS, ramka celu, wstęp w trybie cover). PCK z presetu Linux
uruchomiony poza projektem: 10 krain i wnętrza sklepów czterech ras, 0 błędów. APK: 98 024 767 B, SHA-256
`3889347e9af28c7e299e7a498aaf5745774f5ba38bfbf6d6d91f8ed798e105aa`
(`deliveries/godot-pyra-android-20261116-hud`), pakiet `pl.kilegends.godot.pyra`, wersja 0.6.0-world (kod 6), podpis v2.
Zrzuty: `qa/godot-hud/`.

**Nie sprawdzono.** Fizyczny telefon (FPS, pamięć, czas wypalania podłoża, dotyk), ekrany inne niż 16:9 i 20:9, balans HUD
przy prawdziwej walce.

### 2. Android / Godot 0.7.0-bestiary: potwory, spawny, walka, nagrody

Zlecenie właściciela: po HUD i płynności przenosić potwory, przedmioty, zadania. W tej partii: **potwory, spawny, walka,
doświadczenie, monety, łup**. **Zadania (questy) nie zostały przeniesione** — to ok. 6,9 tys. wierszy treści i silnika w
`src/game/quests`; tracker zadań w HUD czeka na dane. Miasta pozostają bezpieczne, nic nie jest przebalansowane.

- **Dane.** `scripts/godot/export-monsters.ts` eksportuje 40 potworów bestiariusza z `monsters/catalog.ts` (statystyki,
  atak podstawowy, umiejętności, cechy, łup, pule losowego łupu z `items/loot.ts`, rozmiar ramki z `visualSize.ts`);
  `prepare_monsters.py` składa `data/monsters.json`, arkusze `assets/monsters/*.webp` (animowane arkusze „anime” `enemy-v3-*`
  właściciela, 8 kierunków × idle/walk/attack/skill/hit/death/respawn) i rejestry spawnów `data/lands/<id>/spawns.json`
  (opublikowane `spawns.json`, 8 752 miejsc na 10 krainach, bez generowania nowych). Te arkusze są w przeglądarce opt-in
  (`ki-monsters-anime`); port używa ich zamiast starszych.
- **Spawny.** `monster_manager.gd` budzi miejsca w promieniu 1400 j. (maks. 24 potwory, 2 na odświeżenie), usypia
  odległe (1900 j.), trzyma czas respawnu zabitych miejsc, nie budzi potworów w mieście i nie wpuszcza ich do miast.
- **Zachowanie.** `monster.gd`: błądzenie wokół gniazda, agresja (potwory „prowokowane” atakują dopiero po trafieniu),
  pościg, uwiąź i powrót z regeneracją, trzymanie dystansu, `still`/`fly`/`ghost`, atak podstawowy wręcz i na dystans
  (pocisk), umiejętności wszystkich trybów (wręcz, salwa, wybuch, skok, szarża z ogłuszeniem po chybieniu, `self`: wezwanie,
  tarcza, redukcja, leczenie) z ostrzeżeniem na ziemi, odwrót poniżej progu HP, szał, śmierć z animacją. Potwory rysowane
  są 15 % większe, jak bohater.
- **Statusy bohatera.** Spowolnienie, unieruchomienie/ogłuszenie/strach (blokada ruchu), wyciszenie (blokada zdolności),
  DoT, osłabienie, obniżony pancerz, oznaczenie, ślepota/mgła (chybienia), zdjęcie tarczy, przyciągnięcie — w `RaceKit`
  (`debuffs`).
- **Walka i nagrody.** Wszystkie zdolności czterech ras działają na potworach (ten sam interfejs co manekin); pasek celu w
  HUD; XP z potwora (poziomy 1–20), monety z przedziału, łup z listy potwora (materiały z katalogu) i 2 % losowego słabego
  przedmiotu z puli potwora (jak w przeglądarce). Śmierć bohatera: po 3 s powrót do stolicy krainy z pełnym HP/KI.
- **Rozmiar APK.** Arkusze potworów dodały ok. 12 MB; aby zmieścić się w limicie 100 MiB pliku w Git obniżono jakość
  importu WebP (sceneria 0,72, ludzie 0,78, potwory 0,75, wnętrza 0,8, podłoga 0,85). APK 103 319 242 B (margines ok.
  1,5 MB do limitu — kolejne zasoby będą wymagały innego sposobu dostawy niż plik w Git).

**Nie przeniesione / uproszczenia.** Strefy obrażeń, przywołania i część rzadkich cech (zakopywanie, zasadzka, podział,
wskrzeszenie, wieżyczka, pułapki sieci, ślad) — taki potwór walczy zasadami podstawowymi; cecha `night` wyłączona (port nie
ma dnia i nocy); słabości na typy obrażeń (kit nie przekazuje typu), odbicie i pancerz z przodu, unik `dodgeChance` pominięte.
Bossowie, questy i dungeony nie zostały przeniesione. Wiele potworów szybko zabija bohatera poziomu 1 — statystyki są z
bestiariusza, bez zmian; balans na telefonie niezweryfikowany.

**Kontrole.** `tests/smoke.gd`: **326/326** headless (nowe: 40 potworów, 8 752 miejsc spawnu zgodnych z bestiariuszem,
budzenie ≤ 24, brak potworów w mieście, atak bohatera rani potwora, zabicie płaci XP i monety i uruchamia respawn, potwór goni
i rani, statusy, śmierć i powrót). PCK z presetu Linux uruchomiony poza projektem: 10 krain, 0 błędów. APK 103 319 242 B,
SHA-256 `37c83a529c045a919835e3a1efe9a03e00698316d773af452abbd67cef3aea67`
(`deliveries/godot-pyra-android-20261116-bestiary`). Zrzuty: `qa/godot-monsters/`.

### 3. Dostawa APK bez limitu rozmiaru (Git LFS), wysoka jakość tekstur

Decyzja właściciela: gra ma docelowo być większa, więc APK nie musi mieścić się w limicie 100 MiB. Cofnięto obniżenie jakości
importu WebP z pkt 2 (`tune_imports.py`: sceneria 0,9, ludzie 0,92, potwory 0,92, wnętrza 0,9, podłoga 0,9, kafle terenu 0,92,
mapy 0,9). APK ma teraz **123 332 298 B** (SHA-256 `e93777fbfea71a32eee01c12051c624821ef18a0804f14c2a9ed3ec9e04f76cf`) i jest
w `deliveries/godot-pyra-android-20261116-bestiary-hq` jako plik Git LFS (`.gitattributes`: `deliveries/**/*.apk`). Poprzednie
APK (zwykłe pliki) pozostają bez zmian. PCK z presetu Linux uruchomiony poza projektem: 10 krain, 0 błędów; podpis v2 i CRC
poprawne. Gra jest ta sama co 0.7.0-bestiary (kod 7), zmieniła się tylko jakość tekstur.

### 4. Android / Godot: questy

Zlecenie właściciela: przenosić całą grę; APK dopiero po przeniesieniu całości, bez obniżania jakości. Pierwsza część:
**questy** (silnik Argona z `src/game/quests` grany w świecie v2).

- **Dane i silnik.** `scripts/godot/export-quests.ts` eksportuje 106 zadań (102 grywalne: 32 główne, 48 pobocznych, 16 ukrytych,
  10 międzykontynentalnych; 139 celów rozmowy, 90 walki, 26 odkryć, 21 odwiedzin, 9 dostaw), 16 sławnych i 17 ukrytych miejsc z
  nagrodami, NPC miast z ich powiązaniami z grą i współrzędne miejsc v2 do `data/quests.json`. `scripts/quest_engine.gd` powtarza
  `engine.ts` + `v2Tracker.ts`: warunki odblokowania (poziom, poprzednie zadania, odkryte miejsca, rozmowa, przedmiot), etapy,
  cele talk/combat/discover/visit/deliver, nagrody (XP, monety, przedmiot, reputacja frakcji), ochrona nagrody jednorazowej,
  nagroda za pierwsze odkrycie sławnych i ukrytych miejsc.
- **Gra.** Rozmowa z NPC liczy się do celów „talk”/„deliver” zadań powiązanych z jego rolą w danym mieście; dialog pokazuje
  zadania do przyjęcia (PRZYJMIJ) i przycisk PRZEKAŻ dla celów dostawy przedmiotów (zużywa przedmioty z plecaka); wejście do
  miasta = „visit”; podejście do miejsc (450 j. / promień + 200 j.) = odkrycie; zabicie potwora = „combat”. Nad NPC znaczniki
  „!” (zadanie do dania) i „?” (cel czeka). Tracker w HUD pokazuje do trzech aktywnych zadań z postępem; MENU → DZIENNIK ZADAŃ
  (aktywne z celami, liczniki, ŚLEDŹ). XP i monety idą do postaci przez kit i ekonomię; zapis checkpointu zawiera stan zadań
  (stary zapis bez zadań wczytuje się z pustym dziennikiem); nowa postać zeruje zadania.
- **Nie przeniesione w tej części:** wydarzenia świata (14 w `ALL_WORLD_EVENTS_V2`), Sala Przysięgi jako osobna tablica,
  zadania na wyspach (zadania są przypisane do czterech kontynentów).

**Kontrole.** `tests/smoke.gd`: **340/340** (nowe: katalog 106/102/16/17, oferta Kaeny z „!”, przyjęcie, rozmowa etapem,
„?”, odkrycie miejsca, raport i nagroda, brak podwójnej nagrody, zapis i odrzucenie zapisu z nieznanym zadaniem, cel walki,
tracker i dziennik).

### 5. Android / Godot: rozmowy NPC i dźwięk

- **Rozmowy.** 28 postaci zadań ma autorskie dialogi z gry (`src/game/dialogue`, 106 kwestii): powitania (rotują przy kolejnych
  rozmowach), plotki (przycisk POSŁUCHAJ PLOTEK) i wypowiedzi o zadaniach zależnie od stanu (przed / w trakcie / po).
  `export-quests.ts` dołącza je do `data/quests.json`, `PyraQuests.conversation` składa tekst.
- **Dźwięk.** `scripts/godot/prepare_audio.py` kopiuje bez zmian muzykę właściciela (5 pętli: ekran startowy i cztery
  kontynenty, 17 MB) i 271 efektów ElevenLabs (6,7 MB). `scripts/audio.gd` stosuje reguły `sfx.ts` / `music.ts`: muzyka z
  crossfade (kontynent = ścieżka świata krainy, ekran startowy = motyw wczytywania, 70 % głośności pod walką), ambient (miasto
  za murami, poza nim tło świata), trafienia i krytyki, dźwięki zdolności czterech ras, ataki i śmierci potworów
  (`monsters/<id>/{atk,die}`), statusy, mikstura, unik, poziom, nagroda za zadanie, monety i łup, drzwi, błąd przy odmowie,
  kroki według podłoża (trawa/kamień/metal/popiół, woda, drewno w środku). Głośność w MENU (muzyka domyślnie 30 %, efekty 60 %;
  zapis `user://audio.json`). Dźwięki „development”/bossów nie są w grze, bo ich funkcje nie są w grze.
- **Kontrole.** `tests/smoke.gd`: **345/345** (nowe: pliki muzyki i efektów w paczce, muzyka podąża za światem, odtwarzanie
  efektów, rozpoznanie odmowy, głośności).

### 6. Android / Godot: zasady ekwipunku i ekonomii

- **Limity i zestawy.** `export-economy.ts` eksportuje globalne limity bonusów procentowych V2 (10 kluczy), bonusy zestawów
  pasywnych i wyposażenia oraz tabelę ulepszeń; `economy.gd` (`gear()`) liczy bonusy pasywne i zestawowe z ograniczeniem do limitów,
  wynik trafia do statystyk bohatera przez kit.
- **Ulepszanie u kowala.** Broń do +3 (+2 ATK za poziom), elementy pancerza do +2 (+1 DEF), za monety; biżuteria i puste sloty nie
  mogą być ulepszane; poziomy ulepszeń są w zapisie. Ekran kuźni ma 6 zakładek (`items_screen.gd`, `show_upgrade`).
- **Stacje craftingu.** Dostępnych jest pięć stacji z receptur przeglądarki: kuźnia, alchemia, runy, fabrykator Nexusa (10
  receptur) i Księgi (94 receptury).
- **Mikstury.** Leczą `hpBonus` przedmiotu (domyślnie 50 HP), nie stałe 40 %.
- **Kontrole.** Limity V2 nie są przekraczane, ulepszenie broni kosztuje 40 monet i daje +2 ATK, maksimum +3, biżuteria nie jest
  ulepszalna, ulepszenia przechodzą przez zapis, pięć stacji, mikstura. `tests/smoke.gd`: 353/353 po tej części.

### 7. Android / Godot: rzadkie cechy potworów, klasy obrażeń, watahy

Domknięcie listy „nie przeniesione” z pkt 2: wszystkie cechy bestiariusza działają w porcie (opis i tabela w README Android,
sekcja 1a).

- **Klasy obrażeń.** Każda zdolność niesie klasy (`TAGS` w `race_kit.gd`: np. Legenda — fizyczne/ogień/ogłuszenie/obszar, Mędrcy —
  ki, Androidy — elektryczność); `PyraMonster.hurt(raw, crit, tags, ranged)` stosuje `weak` potwora (wartość > 1 to słabość, < 1
  odporność). Obrażenia z podpalenia i DoT są „pośrednie” (nie wywołują odbicia ani ucieczki po trafieniach).
- **Kierunek.** Pancerz z przodu (krab magmowy) i bonus z tyłu (lwy świątyni) zależą od kąta między spojrzeniem potwora a
  bohaterem.
- **Strefy i pułapki.** `Zone` w `monster_manager.gd`: chmury trucizny po wybuchach i śmierci, ślad ognia salamandry, sieci pająka
  (maks. 3 w promieniu gniazda, pająk poza siecią wolniejszy), wszystkie kolorowe, co 0,5 s zadają ułamek ATK właściciela i
  nakładają statusy.
- **Zachowania.** Zakopywanie (nietykalny pod ziemią, wynurzenie przy bohaterze, bonus obrażeń gdy wynurzony), zasadzka (ukryty do
  podejścia na 200 j., cios z mnożnikiem, potem chowa się na 8 s), nurkowanie po serii ataków, ucieczka po liczbie trafień,
  zwijanie, odbicie obrażeń nie-ki, ogłuszenie przy dużym trafieniu w trakcie rzucania, utrata ogona skorpiona, podział roju na
  dwie części po 40 % HP (klon bez nagrody, łączą się po 6 s), odrodzenie ducha z 30 % HP, medyk, wieżyczka (obrót 90°/s, salwy
  po 12 strzałów, przegrzanie na 3 s), przywołanie os-pomocników, patrole po trasie, wataha 2–3 wilków lub nietoperzy.
- **Dzień i noc.** Zegar dnia (480 s, noc od 300 s od wejścia do krainy) steruje wyłącznie cechą `night` (Puchacz Pyłowy); nie ma
  widocznej zmiany oświetlenia.
- **Poprawka.** Czas ostrzeżenia umiejętności (`telegraph`) i ogłuszenia po chybionej szarży był liczony w sekundach zamiast w
  milisekundach — rzadkie umiejętności z ostrzeżeniem faktycznie nie odpalały; poprawione.
- **Osa-pomocnik.** `verdant-mala-osa` korzysta z arkusza Osy Bursztynowej (`prepare_monsters.py`, `ART_OF`).
- **Kontrole.** `tests/smoke.gd`: **364/364** headless (nowe: 41 definicji, słabość na ogień, pancerz z przodu kraba, bonus z
  tyłu lwa, przywołanie os bez miejsca spawnu, podział roju, odrodzenie i ostateczna śmierć ducha, sieć spowalnia bohatera, noc,
  wataha wilków).

**Nadal poza grą (też w przeglądarce nieosiągalne lub niezatwierdzone):** bossowie (tylko podgląd), dungeony, wydarzenia świata.
APK nie jest budowany do czasu przeniesienia całości (polecenie właściciela); ostatni APK to 0.7.0-bestiary-hq.

### 8. Android / Godot: bossowie

Zlecenie właściciela: przenieść wszystko, a czego nie ma — dorobić. Bossowie istnieją w przeglądarce w katalogu `bosses/catalog.ts`
(8 sztuk, wejście przez Strażnika, łup tylko w podglądzie), ale nie są nigdzie rozstawieni.

- **Dane.** `scripts/godot/export-bosses.ts` + `prepare_bosses.py` → `data/bosses.json`: statystyki, fazy (mnożniki i listy ataków),
  ataki, tabele łupu, tłumaczenie na walkę (`bossMonster`), wygląd (strażnik kontynentu w 180 px, jak w `monsterVisual`), dźwięki
  (`sfx/monsters/<świat>-<boss>`). Skrypt sprawdza, że każdy przedmiot łupu jest w katalogu 366 i każde przywołanie istnieje.
- **Walka.** Fazy monotoniczne (jeden cios może pominąć fazę), mnożnik otrzymywanych obrażeń, odporność na ogłuszenie (¼) i spowolnienie
  (½), brak odepchnięcia, ostrzeżenie ataków, pasek z nazwą i fazą w HUD, nagroda XP i łup do plecaka (przeglądarka: tylko wpis w podglądzie).
- **Strażnik leża.** W stolicy każdego kontynentu stoi strażnik (Kaelen, Ilvara, K-7, Draven — trzej ostatni dopisani na potrzeby portu)
  z opisem bossów i przyciskami WEJDŹ DO LEŻA; bohater trafia na skraj leża (miejsce sławne z katalogu), boss czeka; ponowne wejście nie
  dubluje żywego bossa.
- **Mechaniki z opisów** (`scripts/boss_script.gd`; opis katalogu obiecuje więcej, niż gra w przeglądarce): regeneracja Ygdrashy, bariera
  Arcykapłana do zniszczenia trzech Świetlików i kurczący się pierścień areny, filary i Oddech Eteru Aureliha, bezpieczne kręgi erupcji
  Pyrrhaxa, przegrzanie Arbitera, płonąca arena i brak leczenia u Kharzula, drony, wilki, loty. Liczby stref są autorskie.
- **Poprawka zasięgu.** W przeglądarce ataki wręcz bossów mają zasięg całego promienia agresji (np. 500 j. u Thorgara); tu uderzają z
  zasięgu ciała.

### 9. Android / Godot: jaskinie

W świecie Superior zarezerwowano 22 wejścia do jaskiń (4 na kontynent, 1 na wyspę) ze statusem „entrance reserved; interior integration
pending”; wnętrz nie ma. Powstały one tutaj (`scripts/dungeon.gd`, dane `prepare_dungeons.py` → `data/dungeons.json`, 12 grafik `dungeon-kit`).

- **Generator.** Zawsze ten sam labirynt dla tego samego wejścia (ziarno z id): korytarze i sześć komnat 23 × 17 pól po 160 j., komnata
  startowa, skarbiec jako ślepy zaułek za kratą (zamurowane wszystkie wejścia poza jednym — pętle z komnat obchodziły zwykłą kratę),
  klucz co najmniej 6 kroków od kraty w otwartej części, dwie skrzynie w komnatach i skarbiec, strażnicy z potworów krainy (silniejsi w
  głębi, dwóch elitarnych przy skarbcu), do sześciu pułapek kolcowych.
- **Zasady postępu** z `dungeonProgress.ts`: klucz, krata i skrzynie raz, zasięg 96 j., nagroda skrzyni = monety + mikstury; postęp jest w
  zapisie (`dungeons`, walidowany); zapis w jaskini wraca na powierzchnię przy wejściu.
- **Oprawa.** Podłoga proceduralna (kamień w barwie świata), ściany z kawałków skały jaskini, pochodnie, kryształy, kości, klatka (krata),
  sarkofag i skrzynia skarbca, ciemność sceny (`CanvasModulate`) i światło bohatera.
- **Wejście.** Złote koło i E przy kamiennej bramie na powierzchni; wyjście E przy drzwiach lub Esc.

### 10. Android / Godot: wydarzenia świata

14 wydarzeń z katalogu (nazwa, poziom, promień, powtarzalność, nagroda) rozgrywa `scripts/world_events.gd`. Miejsca (droga między stolicą a
miastami, po obu stronach), listy stworów i zadania są autorskie: zasadzki watah, salamandry, drony, nanity, marionetki, motyle; zagrożenia z
chmurą (zarodniki, popiół, nanity); zlecenia (znaki szlaku, lustra sygnałowe, pylony); uwolnienie posłańca; konwój z wozem. Wydarzenie budzi
się w promieniu 800 j. (jeśli poziom wystarcza), usypia za 2600 j., po ukończeniu płaci XP, monety i przedmiot i odpoczywa (300 s, zlecenia
600 s, „once” — na stałe, zapisane).

### 11. Android / Godot: żywy świat (dzień i noc, mieszkańcy, efekty)

- **Dzień i noc.** Zegar 480 s (wieczór od 270 s, noc 300–450 s, świt do 480 s) barwi scenę poza wnętrzami (`CanvasModulate`), dopisuje „noc” w
  banerze i steruje cechą `night` potworów; nie jest zapisywany (dzień zaczyna się rano).
- **Mieszkańcy.** NPC ulic (poza strażnikiem) spacerują wokół posterunku po terenie przejezdnym, zatrzymują się i patrzą na bohatera w
  promieniu 150 j.; punkt rozmowy podąża za postacią.
- **Efekty otoczenia** (`scripts/ambient_fx.gd`): płomienie z dymem i iskrami nad ogniskami, kuźniami, obozami i brazierami, para nad
  źródłami, fontannami i otworami siarkowymi, żar nad skałami lawy, poświata lamp, iskry nad kryształami, pylonami i reaktorami; wyłączane poza
  ekranem; nocą jaśniejsze. Przeglądarka nie definiuje takich efektów (paczki mają puste `effects`).
- **Kontrole.** `tests/smoke.gd`: **420/420** headless (nowe: 8 bossów i ich łup, fazy i pominięcie fazy, regeneracja, bariera i światełka,
  pierścień, przegrzanie Arbitera, blokada leczenia Kharzula, bezpieczne kręgi i filary, wycie Thorgara, nagroda i łup bossa, strażnik leża
  i jedno wejście; 22 wejścia i 12 grafik, ta sama jaskinia dla tego samego wejścia, krata odcina skarbiec, klucz w otwartej części,
  klucz/krata/skrzynia raz, kolce, zapis w jaskini i oczyszczenie stanu; 14 wydarzeń, budzenie, nagroda, odnowa, zlecenie z lustrami,
  „once”, zapis; efekty otoczenia, spacery, zatrzymanie przy bohaterze, strażnik na posterunku, zegar i barwa dnia). Zrzuty:
  `qa/godot-late/` (jaskinia, skarbiec, noc z efektami, wydarzenie, boss) — natywne renderowanie programowe (llvmpipe).

**Nie zweryfikowane:** fizyczny telefon (FPS jaskiń ze światłem i CanvasModulate, wiele efektów otoczenia naraz, balans trudności bossów
i jaskiń). Balans liczb autorskich (kolce, strefy, nagrody skrzyń, wydarzenia) wymaga decyzji właściciela po grze na telefonie.

### 12. Android / Godot 0.8.0-complete: końcowy APK

Po przeniesieniu całości (pkt 1–11) zbudowano APK w pełnej jakości: `deliveries/godot-pyra-android-20261116-complete` (Git LFS),
148 234 924 B, SHA-256 `8071893d82fa242dc0b4d59db6823103513fdbeb49e5d318312a71007a311701`, pakiet `pl.kilegends.godot.pyra`, wersja 0.8.0-complete
(kod 8), podpis lokalnym kluczem debug (schematy v2 i v3 poprawne). PCK z presetu Linux uruchomiony poza projektem: 10 krain, wnętrza sklepów
czterech ras, wejście do jaskini (20 strażników) i boss, 0 błędów. **Nie sprawdzono na fizycznym telefonie** (instalacja, FPS, pamięć, bateria).

### 13. Android / Godot 0.9.0-online: gra online, szczupłe APK, treść z serwera, panel administratora

Zlecenie właściciela: przygotować grę online z serwerem i panelem administratora, a APK zmieścić w 80–90 MB (reszta z serwera).

- **APK 63,6 MiB** (66 727 415 B, było 141 MiB): kod, interfejs, bohaterowie, dane zasad. Świat to **26 paczek PCK** (153 831 056 B) pobieranych z serwera:
  `land-<id>` (10), `monsters-<świat>` (4), `npcs-/rooms-/music-<świat>` (12). `scripts/godot/build_packs.py` dzieli projekt, buduje paczki
  (`tools/pack_builder.gd`, `PCKPacker`), zapisuje manifest (nazwa pliku niesie 12 cyfr SHA-256), wpisuje filtr wykluczeń do presetu Android i **wykrywa
  zasoby wskazane w danych, które wypadłyby z APK bez przydziału do paczki** (znalazło wnętrza i tekstury pierwszej stolicy Pyry).
- **Serwer** (`src/server/godot/*`, migracja `007-godot-android.sql`, trasy `/ws/godot/*` w istniejącym serwerze gry): manifest z bramkami (tryb serwisowy,
  minimalna wersja aplikacji), paczki z `Range`/`ETag`, zapisy w chmurze z blokadą rewizji i walidacją (`saveRules.ts`), kanał obecności i czatu
  (kosmetyczny), API administratora z audytem. Konta te same co w przeglądarce.
- **Klient** (`net.gd`, `online.gd`, `content.gd`, `gate_screen.gd`, `remote_players.gd`, `chat_panel.gd`): logowanie / rejestracja / tryb offline,
  pobieranie i weryfikacja paczek z paskiem postępu, zgranie zapisu lokalnego z chmurą, autozapis co 90 s i przy wyjściu z aplikacji, konflikt wersji,
  inni gracze jako duchy, czat okolicy, pobieranie krain przy podróży i „POBIERZ WSZYSTKIE KRAINY”.
- **Panel administratora** (`/admin` → „Gra Android”): stan i gracze online, minimalna wersja, tryb serwisowy i komunikat, wydania treści (wysyłka z
  przeglądarki, aktywacja i wycofanie), zapisy graczy (podgląd JSON, usuwanie), wpisy w dzienniku audytu.
- **Błędy znalezione przez test end-to-end:** lambdy GDScript kopiują zmienne proste (pętla pobierania nigdy się nie kończyła); wykrywanie „zawiera
  wszystko” zmieniało się po podpięciu pierwszej paczki (teraz ustalane raz); brakujące paczki treści w klasyfikacji (wnętrza, miasto Pyry); stary dźwięk
  „nie znaleziono” był zapamiętywany na zawsze (muzyka po pobraniu świata milczała).
- **Kontrole.** `tests/smoke.gd` **429/429**; `src/test/godot-android.test.ts` 10/10 na PostgreSQL 16 (manifest, Range, bramki, rewizje zapisów, uprawnienia,
  audyt, obecność); `scripts/godot/e2e_online.py` — baza PCK **40,2 MB** z filtrami Androida loguje się do prawdziwego serwera, pobiera i podpina paczki, buduje
  miasto, zapisuje do chmury, odrzuca nieaktualny zapis i pobiera Verdantię przy podróży; `scripts/godot/qa_admin_ui.py` — panel w przeglądarce (zrzuty
  `qa/admin-android/`). Dostawa: `deliveries/godot-pyra-android-20261117-online` (APK) i `deliveries/godot-content-2026.11.17.1` (paczki), oba w Git LFS.
- **Nie wykonane w tej partii (zrobione później za zgodą właściciela, patrz pkt 14):** wdrożenie na produkcję — migracja 007, obraz z woluminem `godot-content`, publikacja wydania; ta sesja nie ma dostępu do VPS,
  a `AGENTS.md` wymaga osobnej zgody. Bez opublikowanego wydania APK nie uruchomi gry. **Nie sprawdzone:** telefon, sieć komórkowa, TLS na prawdziwej domenie, obciążenie.

### 14. Android / Godot 0.10.0-content: labirynty, wprowadzenie, dialogi, walka, przedmioty; wdrożenie serwera

Zlecenie właściciela: labirynty i wejścia do nich, więcej dialogów i wprowadzenie do przygody, elegancka walka, przedmioty/bonusy/handel/craft, wszystkie animacje.

- **Wdrożenie serwera (za zgodą właściciela, 16.11.2026).** Scalone PR #171 (backend i panel) i #172 (ręczny workflow `godot-content-upload.yml`, który kopiuje zweryfikowane paczki z Git LFS na VPS,
  bo pakiet wdrożeniowy nie zawiera `deliveries/`). Na serwerze, po kopii zapasowej bazy: migracja `007-godot-android.sql` (suma pliku sprawdzona), wolumin `godot-content` w pliku compose
  usługi, paczki zweryfikowane względem manifestu (26/26), wydanie `2026.11.17.1` zarejestrowane i aktywne. Z zewnątrz sprawdzone: `/ws/godot/status`, manifest dla klienta o kodzie 9, nagłówki i zakresy
  bajtów paczek (206). **Nie sprawdzone:** gra na telefonie. Ryzyko: ręczny „Redeploy” w panelu Coolify może wygenerować plik compose od nowa i usunąć wolumin.
- **Labirynty i wejścia.** 22 nazwane wejścia (po 4 na kontynent, po 1 na wyspę): tunele łączą dwie krainy jedną strukturą (strona „a” to kraina wcześniejsza alfabetycznie), komory, Wielki Labirynt na
  3 piętra ze schodami. Każdy układ ma otwartą część z kluczem, kratę przed skarbcem (skarbiec ma jedno wejście, więc pętle go nie omijają), skrzynie, strażników skalowanych poziomem wejścia, kolce, napisy
  na ścianach i sekretną komorę za pękniętą ścianą. Automapa w okrągłym oknie pokazuje to, co bohater widział (mgła, klucze, schody, kraty, skrzynie) i zapamiętuje się między piętrami. Przy wejściu okno
  z nazwą, historią i zalecanym poziomem. Postęp jaskiń (klucze, kraty, skrzynie, sekrety) jest w zapisie i walidowany. Znaleziony błąd: odkrywanie mapy działało przed ustawieniem bohatera w wejściu.
- **Wprowadzenie i dialogi.** Po utworzeniu postaci ekran fabularny (5 stron na rasę: dwie wspólne o Ciszy i Chórze, trzy własne), potem samouczek „Pierwsze kroki” (8 kroków: ruch, rozmowa, atak,
  zdolność, unik, sklep lub kuźnia, mapa, wyjście za bramę) pod mapką, z nagrodą 40 monet. Każdy mieszkaniec ma przycisk ROZMOWA z 8 tematami (3 z jego fachu: przewodnik, łowca, zarządca, kupiec, trener,
  skrzynia, kowal, gospodarz, alchemik, strażnik; 5 o świecie: Cisza, dawny Chór, okolica, podziemia, dług miasta) i uwagę o czynach bohatera (ranny, boss pokonany, jaskinia, sekret, poziom 10 i 20,
  bogactwo, noc, początkujący). Zapis sprzed fabuły uchodzi za „już po wprowadzeniu”. Teksty (73) są autorskie, w `prepare_talk.py`; są tylko po polsku.
- **Walka.** Wstrząs kamery (silniejszy przy mocnym ciosie i krytyku), krótki hit-stop, odrzut sprite'a potwora (ciało się nie przesuwa), pierścień pod celem, liczby w siedmiu stylach z napisem SŁABOŚĆ,
  combo atak → atak2 → finisher, **idealny unik** (cios w pierwszych 0,2 s uniku: bez obrażeń, 12 % KI z powrotem, krótkie spowolnienie czasu, 1,2 s przerwy). Awans na poziom nie miał dotąd żadnej oprawy:
  teraz jest poza zwycięstwa, napis i komunikat.
- **Animacje bohatera.** Z 37 klipów używane były 13; teraz wszystkie: `hit`/`hitheavy` (ciężki od 15 % maks. HP), `victory` (boss, awans), `interact` (rozmowy, skrzynie, wejścia), `run` (pełne wychylenie drążka;
  wcześniej próg 1,05 nigdy nie był osiągany). Warianty `ki…` wybiera przedrostek formy. **Nie dotyczy:** animacje potworów i NPC nie były przeglądane w tej partii.
- **Przedmioty i handel.** Szczegół przedmiotu pokazuje różnicę względem założonego, zestaw (założone x z y, bonus przy każdej liczbie części, aktywne oznaczone); ekran plecaka sumuje bonusy sprzętu po
  limitach (z oznaczeniem „limit”). Sprzedaż całego stosu i „niepotrzebnych materiałów” (żadna receptura ich nie wymaga). Kuźnia: filtr „tylko te, które mogę wykonać” i „WYTWÓRZ ×N” (do 10).
- **Kontrole.** `tests/smoke.gd` **489/489**; `scripts/godot/e2e_online.py` bez błędów; przed scaleniem lokalnie cała bramka (typecheck, lint, 2195 testów, assets, docs, build). Paczki treści przebudowane:
  26 z 26 mają ten sam SHA-256 co wydanie `2026.11.17.1`, więc **nowe APK używa wydania już aktywnego na serwerze** (nic nie trzeba wgrywać). Dostawa: `deliveries/godot-pyra-android-20261116-content`
  (APK 66 781 191 B, wersja 0.10.0-content, kod 10; Git LFS). **Nie sprawdzone:** telefon; ocena „elegancji” walki jest subiektywna i wymaga gry na urządzeniu.

### 15. Android / Godot 0.11.0-updates: gra aktualizuje własny kod z serwera

Zlecenie właściciela: aplikacja ma być ta sama, a aktualizacje (wdrażane zmiany) mają iść z poziomu gry.

- **Mechanizm.** Pierwsza scena (`boot.tscn`) pobiera z serwera pakiet rdzenia `core-c11` (skrypty, sceny, shadery, dane zasad; 2,2 MB, 115 plików) i montuje go nad plikami APK przed
  załadowaniem gry. Eksperyment przed budową: pobrana paczka **podmienia istniejące skrypty** w działającej aplikacji; nowa nazwa `class_name` z paczki nie jest widoczna (lista klas jest w APK), więc nowe pliki
  ładuje się po ścieżce. W wyeksportowanym APK skrypty są skompilowane i mają pliki `.remap`, dlatego pakiet niesie też własne `.remap` wskazujące na zwykły plik (inaczej wygrywałaby kopia z APK).
- **Zabezpieczenia.** Weryfikacja rozmiaru i SHA-256 przy pobraniu i przy każdym starcie; kompilacja wszystkich skryptów zaraz po zamontowaniu; lista „złych” rdzeni; porzucenie rdzenia, który w trzech
  uruchomieniach nie dotarł do pierwszej krainy; praca offline na rdzeniu z pamięci podręcznej; brak rdzenia w wydaniu = kod z APK. Zamontowanej paczki nie można odmontować, więc po wykryciu uszkodzenia
  gra prosi o ponowne uruchomienie.
- **Publikacja bez panelu i bez ręcznych kroków na serwerze.** Workflow „Godot content packs to VPS (manual)” ma teraz opcje `publish` i `activate`: weryfikuje sumy, kopiuje paczki na serwer, wkłada je
  do woluminu aplikacji, rejestruje wydanie w bazie i (opcjonalnie) je aktywuje. Zapytanie SQL sprawdzone lokalnie na bazie testowej; samego workflow na produkcji nie uruchomiono.
- **Kontrole.** `tests/smoke.gd` **502/502** (m.in. reguły decyzji bootu); `scripts/godot/e2e_core.py` **10/10** na wyeksportowanej bazie Androida z atrapą serwera (podmiana kodu 40 → 77, uszkodzony rdzeń
  odrzucony, praca offline, porzucenie); `scripts/godot/e2e_online.py` bez błędów z wydaniem 27 paczek. Wydanie `2026.11.17.2` = 26 dotychczasowych paczek bez zmian + `core-c11`
  (`deliveries/godot-content-2026.11.17.2`). APK `deliveries/godot-pyra-android-20261116-updates` (66 793 824 B, 0.11.0-updates, kod 11). Poprzednie APK z tego dnia (kod 10) nie ma launchera i
  nie aktualizuje się samo.
- **Granice.** Nowe APK potrzeba przy zmianie silnika, uprawnień, ustawień projektu, ikony i dodatków natywnych. Nie sprawdzono na telefonie; nie sprawdzono pobierania rdzenia przez prawdziwy TLS i
  sieć komórkową. **Opublikowane za zgodą właściciela (16.11.2026):** scalone PR #173, workflow uruchomiony z `publish` i `activate` (run #3); `kilegends.pl` oddaje wydanie `2026.11.17.2`
  (27 paczek), `core-c11` pobrany z zewnątrz ma zgodny rozmiar i SHA-256, klient o kodzie 10 nadal dostaje poprawny manifest. Wycofanie: aktywować `2026.11.17.1` w `/admin`.

### 16. Panel administratora: zakładka „Serwer” pokazuje tylko wartości zmierzone

Zlecenie właściciela po zrzutach panelu (czerwone „BRAK POŁĄCZENIA” bazy i „ZATRZYMANY” serwera przy działającej grze): panel ma pokazywać prawdziwe rzeczy, bez zbędnych.

- **Przyczyna sprzeczności.** Panel czytał bazę i stan serwera przez funkcję serwerową aplikacji (stara autoryzacja), a gdy ta zawodziła, wstawiał wartości domyślne: „baza offline”, zera,
  „serwer zatrzymany”. Jednocześnie dolna tabela i kafelki CPU/RAM/ping były liczone wzorami z liczby graczy albo odczytywane z zapisanej konfiguracji (`localStorage`), a mapa świata
  rysowała symulowanych graczy. Czy czerwone pola były już przed publikacją 2026.11.17.2, nie wiadomo; publikacja (kopia plików, jeden wiersz w tabeli wydań) ich nie powoduje.
- **Zmiana.** Nowy odczyt `GET /ws/admin/runtime` (tylko staff) w procesie serwera gry: serwer, proces, baza (połączenie oceniane osobno od liczników tabel), gra Android, lista graczy. Widok
  `AdminServerStatus`. Usunięte: boty, edytor fikcyjnych węzłów, przyciski Start/Stop/Restart, wymyślone telemetrie, `serverControl.functions.ts`, `databaseStatus.ts`, `AdminMonitoringCenter`.
  Mapa świata w panelu pokazuje tylko graczy połączonych z serwerem.
- **Kontrole.** Testy jednostkowe (fałszywy klient bazy: brak uprawnień do tabeli nie zmienia stanu połączenia; brak wartości to „brak danych” z powodem; autoryzacja 403/405/200), test na prawdziwym
  PostgreSQL, test widoku; sprawdzenie na prawdziwym serwerze gry i bazie (bez tokena 403, token gracza 403, token administratora 200 z prawdziwymi wartościami).
  **Nie sprawdzone na produkcji:** zmiana nie jest wdrożona; po wdrożeniu panel pokaże to, co serwer faktycznie zmierzy.

### 17. Android / Godot: system jedzenia (regeneracja życia)

Zlecenie właściciela: zwierzęta, które nie atakują i dają jedzenie; jedzenie ma regenerować życie; 10 zwierząt, 10 produktów; wyliczenie sekund i ilości.

- **Wyliczenie** i opis zasad: `docs/ROZWOJ-I-WALKA.md` (sekcja „Jedzenie i regeneracja życia”), dane i tabela z `scripts/godot/prepare_food.py` → `data/food.json`. Obecna regeneracja: 0,3 % maks. HP/s poza walką
  (Legenda poz. 10: 1,55 HP/s, pełne życie po 333 s); posiłki leczą 14–60 % maks. HP w 30–90 s, także w walce.
- **Mechanika** (`race_kit.gd`: `eat()`, `fed_left()`, status „Najedzenie”, leczenie co sekundę, bonus regeneracji KI z mleka; `economy.gd`: posiłki jako przedmioty `F-01…F-10`, jedzenie przez `use()`, cztery proste w sklepie):
  jeden posiłek naraz, słabszy nie zastępuje silniejszego, przy pełnym życiu odmowa, 2 s między kęsami. Ekrany przedmiotów działają dla pozycji bez ikony.
- **Kontrole.** `tests/smoke.gd` **517/517** (m.in. pasma procentowe poziomów, leczenie w walce i poza nią co do HP, koniec statusu, zastępowanie, mleko +25 % KI, zapis, ekran plecaka). Test znalazł w sobie wcześniejsze skażenie (DoT z poprzedniego testu), nie błąd gry.
- **Dalszy ciąg (ten sam dzień):** zachowanie zwierząt (`animals.gd`, cecha `peaceful` w `monster.gd`: brak ataku i aggro, ucieczka po ciosie, jeden produkt, 0 XP, stałe rozmieszczenie 10 sztuk na krainę poza miastami),
  wskaźnik „Najedzony” w liście zadań, konwerter `scripts/godot/prepare_animals.py` (sprawdzony na zastępczej paczce w katalogu tymczasowym), prompty grafik w `art/pipeline/prompts/zwierzeta/`. `tests/smoke.gd` **527/527**.
  Test zachowania używa arkusza jelenia jako zastępstwa; w grze zwierzę pojawia się dopiero po wpisie w `data/animals.json`.
- **Grafika zwierząt i ikon (dostarczył właściciel, ten sam dzień).** Pierwsza paczka (klatki 256 px dopasowane do szerokości, zwierzę zmieniało rozmiar i drgało, białe obwódki, A-09 i A-10 przemalowane A-01 i A-02) została odrzucona; prompty zostały przepisane na pełne, samodzielne (osobny prompt na zwierzę) i właściciel dostarczył nowe plansze wszystkich **10** (A-06 Bażant Żarowy dotarł jako ostatni). `prepare_animals.py` zastąpiono konwerterem plansz (cięcie po kształtach, miękki brzeg zamiast białej obwódki, jedna skala i linia podłoża, bezstratny atlas, dane klipów) i ikon (`assets/icons/items/F-01…F-10.webp`). Zwierzę pojawia się tylko, gdy jego arkusz jest na urządzeniu (`animals.sheet_exists`), więc starsze wydanie treści go nie pokaże.
  Obejrzane natywnie w scenie gry (`tests/qa_animals.gd`: stanie, chód, bieg w obie strony, upadek, daleki zoom); odbicie w lewo działa. Pierwsze rozmiary były za duże (kura 62 px długości przy postaci 143 px wysokiej; uwaga właściciela), więc `TARGET_BODY` liczy teraz proporcje względem bohatera; do dalszego dostrojenia na telefonie. W rzędzie upadku Bażanta zostały oryginalne pióra i obłok kurzu z planszy. `tests/smoke.gd` **531/531**.
- **Dostawa:** APK `deliveries/godot-pyra-android-20261116-zwierzeta` (0.12.4-zwierzeta, kod 16, 81,8 MB, ikony posiłków i `animals.json` w środku) oraz wydanie treści `deliveries/godot-content-2026.11.17.3` (27 paczek, arkusze zwierząt w `monsters-<świat>`, rdzeń `core-c16`; zbudowane, **nieopublikowane**). Wobec aktywnego wydania 2026.11.17.2 APK po prostu nie pokazuje zwierząt.
- **Nie zrobione:** dźwięki zwierząt. **Nie wydane graczom:** arkusze jadą w paczkach treści, więc zwierzęta pojawią się po opublikowaniu nowego wydania treści (za zgodą właściciela).

### 18. Android / Godot 0.12.0-intro: ikona z logo i film wejściowy właściciela

Zlecenie właściciela: dostarczone logo ma być ikoną aplikacji, a film (10 s, 1280×720, 24 kl./s, dźwięk) animacją wejścia i ładowania gry.

- **Ikona.** Logo (1254²) jest ikoną dla wszystkich warstw Androida: `icon.png` (cały obraz), `icon-foreground.png` (logo na 78 % pola, żeby całe godło mieściło się w kole 66 % pokazywanym przez launcher),
  `icon-background.png` (rozmyte kolory tego samego logo) i `icon-monochrome.png` (jasne części godła jako biała sylwetka, dla ikon motywowanych). Wygląd w kole sprawdzony na podglądzie; **nie sprawdzono na telefonie**
  (launchery różnie maskują ikony). Ekran startowy systemu (boot splash) nie został zmieniony.
- **Film.** Godot odtwarza tylko Ogg Theora, więc film zamieniono na `intro.ogv` (libtheora q7, Vorbis; 10,05 MB; podobieństwo do oryginału SSIM 0,975) i zapisano ostatnią klatkę (`intro-last.webp`).
  Odtwarza go scena startowa (`boot.gd`): pełny ekran z dopasowaniem „cover” (na bardzo szerokich telefonach przycina górę i dół obrazu), dźwięk wg głośności muzyki z ustawień (domyślnie 48 %),
  dotknięcie po 0,8 s pomija film, po jego końcu zostaje ostatnia klatka z napisem „TOUCH TO START” z filmu i dotknięcie uruchamia grę bez drugiego przycisku; w tym czasie pod spodem trwa sprawdzanie aktualizacji
  (mały pasek stanu u góry, a przy uszkodzonej aktualizacji komunikat). Bez filmu (headless, testy, brak pliku) wszystko działa jak wcześniej.
- **Polskie napisy w filmie (0.12.1-polski, kod 13).** Film ma wklejone angielskie napisy „LOADING...” (ok. 5,0–7,5 s) i „TOUCH TO START” (od 7,5 s). Na polecenie właściciela („po polsku, angielski wejdzie później”) są zasłonięte
  (rozmycie obszaru) i zastąpione ciemnymi tabliczkami ze złotym obrzeżem i napisami „WCZYTYWANIE...” oraz „DOTKNIJ, ABY ROZPOCZĄĆ” (pulsują jak oryginał; ostatnia klatka to ten sam obraz). Skrypt `scripts/godot/make_intro.py`
  (źródła w `art/production/intro/`: film i logo, Git LFS) robi to powtarzalnie; kolejny język to wpis w `TEXTS`, a wersja angielska to oryginał (`--lang en`). Użyta czcionka (Lora Bold) ma cały polski alfabet; Cinzel z gry nie ma Ą Ę Ł Ż.
  Dostawa 0.12.0-intro z angielskimi napisami została zastąpiona (katalog usunięty z dostaw; historia Git zostaje).
- **Film po polsku od właściciela (0.12.2-polski, kod 14).** Właściciel dostarczył własną polską wersję filmu (10 s, 1280×720, 24 kl./s, dźwięk; napisy „ŁADOWANIE...” i „DOTKNIJ, ABY ROZPOCZĄĆ” są w obrazie). Zastępuje wersję z nakładką: `python3 scripts/godot/make_intro.py --baked --source art/production/intro/intro-pl-source.mp4` (bez żadnych nakładek, tylko konwersja do Ogg Theora i ostatnia klatka). `intro.ogv` 9,17 MB; APK 81,6 MB. Kod wersji 14 (`boot.gd`, `net.gd`, `export_presets.cfg`; klucz rdzenia to teraz `core-c14`). Film zaczyna się od czerni i rozjaśnia ok. 1 s (tak jest w źródle).
- **Rozmiar i uwagi.** APK 82,5 MB (było 66,8 MB): film 10 MB i grafiki ikon. Pasek ładowania wklejony w film nie odzwierciedla prawdziwego ładowania, tylko zdarzenia
  filmu. Wydajność odtwarzania 720p Theora na prawdziwych telefonach nie była mierzona (test natywny w programowym renderze: obraz poprawny, odtwarzanie wolniejsze niż czas rzeczywisty z powodu emulacji GPU).
- **Kontrole.** `tests/smoke.gd` **530/530** (film i klatka są w grze, głośność, reguła startu po filmie), `scripts/godot/e2e_core.py` 11/11 na nowej scenie startowej, test natywny `tests/qa_intro.gd` (zrzuty ekranu).
  Dostawa 0.12.2-polski (kod 14) została zastąpiona przez 0.12.3-zwierzeta (poniżej); poprzednie wersje są w historii Git.

### 19. Android / Godot 1.0: jedna instalacja, kolejne wersje z serwera

Decyzja właściciela: APK ma wersję **1.0 „KI LEGENDS”**, a każda kolejna wersja (1.1, 1.2, 1.3…) nadpisuje ją po pobraniu z serwera, bez nowego APK.

- **Zasada.** APK 1.0 (`versionCode` 100, `versionName` 1.0) jest instalowany raz. Kod gry (`core-c100`: skrypty, sceny, dane JSON), grafiki, muzyka i mapy jadą w wydaniach treści o numerach 1.1, 1.2, … (`build_packs.py build --version 1.1`);
  klucz rdzenia `core-c100` zostaje stały, więc każde kolejne wydanie dostaje ten sam klucz i zainstalowana gra bierze je sama przy starcie. Nowy APK jest potrzebny tylko, gdy zmienia się coś, czego serwer nie dostarcza:
  film wejściowy, ikona aplikacji, ikony przedmiotów, silnik/natywne ustawienia, nowa `class_name`. Wtedy dopiero nowy numer (np. APK 2.0, `versionCode` 200).
- **Numer na ekranie.** Ekran startowy pokazuje „KI LEGENDS 1.0”; po pobraniu wydania numer zmienia się na numer pobranego wydania (`PyraTitleScreen.shown_version`, tylko numery postaci `X.Y`).
- **Wydanie 1.0** (`deliveries/godot-content-1.0`, 27 paczek, `core-c100`; zbudowane, **nieopublikowane**) zawiera m.in. grafiki 10 zwierząt. APK: `deliveries/godot-ki-legends-1.0`.
  Poprzednie dostawy robocze (0.12.x, wydanie 2026.11.17.3) zastąpiono; historia Git zostaje.
- **Kontrole.** `tests/smoke.gd` **533/533** (m.in. wersja 1.0 w aplikacji i w ustawieniach eksportu, wybór numeru do pokazania), `scripts/godot/e2e_core.py` (klucz `core-c100`).
- **Poprawki przed wydaniem 1.0.** Przyczyna braku połączenia z serwerem: w APK od początku było `permissions/internet=false`, więc aplikacja nie miała prawa korzystać z sieci (błąd; poprawione, `INTERNET` i `ACCESS_NETWORK_STATE` są w APK). Do tego: „Zapamiętaj mnie” przy logowaniu, film wejściowy nie ucina już dołu (pasek ładowania), guziki HUD i przycisk ataku z grafik właściciela, ramki kamienne (`scripts/skin.gd`, `prepare_ui_frames.py`) dla okien, przycisków i pól, restart serwera w zakładce Serwer panelu (`POST /ws/admin/restart`, tylko administrator). `tests/smoke.gd` **537/537**.
- **Wydanie 1.0 opublikowane** (zgoda właściciela, workflow sukces; serwer: `activeVersion` 1.0, `core-c100`). **Wydanie 1.1** (tylko przez serwer, bez nowego APK): okno logowania wyśrodkowane i niższe (na telefonie było ucięte: panel rósł od środka ekranu w prawo i w dół), pole „Zapamiętaj mnie” bez tła przycisku, tło logowania i środek okien z tekstury kamienia właściciela (w APK 1.0 tej tekstury nie ma, więc zainstalowana 1.0 dostaje poprawki układu, a teksturę zobaczy dopiero, gdy grafiki interfejsu będą jechać w rdzeniu). Próba wożenia grafik `assets/ui` w rdzeniu została wycofana: z nimi `e2e_core.py` pokazał, że podmienione skrypty przestały działać (7 błędów), przyczyna niewyjaśniona. Testy 1.1: smoke **537/537**, `e2e_core.py` **11/11**.
- **Awaria wydania 1.1 i naprawa (1.2).** Po aktualizacji 1.1 gra na telefonie kończyła się na ciemnym ekranie startowym. Przyczyna: `boot.gd` z APK 1.0 wywołuje `PyraSkin.install()` PRZED zamontowaniem kodu z serwera, więc zainstalowana aplikacja do końca używa `scripts/skin.gd` ze swojego APK; 1.1 dodało do niego funkcje, których APK 1.0 nie ma, a okno logowania je wywołało. `e2e_core.py` tego nie widział, bo buduje bazę z bieżącego projektu. Serwer cofnięto do 1.0 (workflow, aktywne 1.0). Naprawa: `skin.gd` wrócił do zamrożonej postaci z APK 1.0 (test w `smoke.gd` pilnuje listy jego funkcji), nowy wygląd jest w `scripts/look.gd` (ładowany po zamontowaniu rdzenia, bez `class_name`), a okno i kamień jadą w `data/ui-art.json`. Nowy test `scripts/godot/e2e_installed.py` uruchamia rdzeń na prawdziwym, zainstalowanym APK 1.0 i buduje okno logowania: **PASS**. Tło logowania to znowu ekran tytułowy (przyciemniony), a tekstura kamienia jest wnętrzem okien. Litery właściciela (`prepare_letters.py` → `data/letters.json`) są czcionką tytułów. `smoke.gd` **539/539**, `e2e_core.py` 11/11.
- **Wydanie 1.2 opublikowane i aktywne; 1.3: pełny alfabet.** Właściciel dostarczył komplet liter (duże i małe z polskimi, cyfry, interpunkcja, symbole; 119 znaków): `prepare_letters.py` czyta układ po kształtach (kropki i akcenty łączone z literą, dwa przecinki cudzysłowu w jeden znak, sklejone litery dzielone w najcieńszej kolumnie) i zapisuje `data/letters.json`. Litery są czcionką tytułów i wszystkich przycisków (`Look.install_letters`). Wydanie 1.3 dostaje je z serwera. `smoke.gd` **539/539**, `e2e_installed.py` PASS, `e2e_core.py` 11/11.
- **Wydanie 1.4: logowanie.** Aplikacja łączyła się już z serwerem (komunikat „Nieprawidłowy e-mail lub hasło” przyszedł z serwera), a konto właściciela działało w przeglądarce. Serwer przycina i ujednolica e-mail, ale hasło bierze dokładnie takie, jakie przyśle telefon (klawiatura Androida może dopisać spację). Dodano „Pokaż hasło” i drugą próbę bez spacji na brzegach hasła, gdy pierwsza zostanie odrzucona (`gate_screen.gd`). Przyczyna odrzucenia nie jest potwierdzona (nie mam dostępu do konta ani logów); zmiana to diagnostyka i obejście najbardziej prawdopodobnej przyczyny. `smoke.gd` 539/539, `e2e_installed.py` PASS.
- **Zarządzanie serwerem wdrożone (PR #175 scalony za wyraźnym poleceniem właściciela).** Restart serwera gry w zakładce Serwer (`POST /ws/admin/restart`) trafia na produkcję przez wdrożenie z `main`. **Wydanie 1.5:** po odrzuceniu logowania aplikacja pokazuje, co wysłała (e-mail i długość hasła, nie samo hasło) i odpowiedź serwera, bo przyczyny odrzucenia konta, które działa w przeglądarce, nie udało się ustalić bez tych danych.
- **Dziennik logowań w panelu (zakładka „Logowania”).** Po zrzucie właściciela (aplikacja wysyła poprawny e-mail i 8-znakowe hasło, serwer odpowiada 401) dodano zapis każdej próby logowania (przeglądarka i aplikacja) do `accounts.audit`: akcje `LOGIN` i `LOGIN_FAILED` z prawdziwym powodem (`BRAK_KONTA`, `ZLE_HASLO`, `KONTO_NIEAKTYWNE`, `KONTO_ZABLOKOWANE`, `NIEPOPRAWNE_DANE`, `LIMIT_PROB`), e-mailem, adresem IP i urządzeniem (aplikacja to „GodotEngine”). Gracz nadal słyszy tylko „Nieprawidłowy e-mail lub hasło”; haseł się nie zapisuje; błąd zapisu dziennika nigdy nie zmienia wyniku logowania. Zakładka „Dziennik” pokazuje teraz tylko zmiany w panelu, logowania są w „Logowania” (`GET /ws/admin/audit?kind=login`). Testy: `login-log.test.ts` (3), cały zestaw TS przechodzi.

### 20. Stan na koniec dnia dla kolejnego agenta (Codex lub inny)

Co jest zrobione, a co czeka. Szczegóły techniczne są w sekcjach 13–19 i w `ports/godot-pyra/README.md` („Wersje i aktualizacje”).

**Na serwerze (kilegends.pl) działa:** wydanie gry Android **1.5** (aktywne), panel administratora ze wdrożonym restartem serwera i dziennikiem logowań (PR #175 i #176 scalone do `main`; wdrożenie `aruba-production.yml` z #176 mogło jeszcze trwać, sprawdź status).

**W repozytorium, niepublikowane:** commit „Menu gry” (menu mieści się na ekranie, lista przewijana, przycisk panelu administratora dla administratora i GM). Wydanie **1.6** nie zostało zbudowane ani opublikowane; trzeba je zbudować (`build_packs.py build --version 1.6`), przetestować (`smoke.gd`, `e2e_core.py`, `e2e_installed.py`) i opublikować workflowem (za zgodą właściciela).

**Otwarte problemy:**
1. **Logowanie w aplikacji.** Aplikacja wysyła poprawny e-mail i 8-znakowe hasło (potwierdzone zrzutem), serwer odpowiada 401, a konto działa w przeglądarce. Przyczyna nie jest ustalona. Zakładka „Logowania” w panelu pokazuje prawdziwy powód każdej odmowy (`BRAK_KONTA`, `ZLE_HASLO`, …): zacznij od niej. Hipotezy do sprawdzenia: konto nie jest w bazie VPS (przeniesienie ze starego serwera `migrateLegacy` wymaga `SUPABASE_URL` i klucza w środowisku), albo inne hasło niż w przeglądarce (stara sesja).
2. **Ekran ucięty na telefonie właściciela.** Okna (menu, logowanie) bywały większe niż ekran. Poprawki są w 1.2 (logowanie) i w niepublikowanym 1.6 (menu); nie zweryfikowano na prawdziwym telefonie. Sprawdzaj okna w proporcjach 20:9 (`tests/qa_menu.gd`, `tests/qa_login.gd`, `tests/qa_hud.gd`: `xvfb-run ... --script res://tests/qa_*.gd`).
3. **Stare, niedokończone:** ramki i litery właściciela użyte tylko w oknach, przyciskach i tytułach; reszta interfejsu (paski, ekwipunek, postać) nadal ma stare style. Brakujące guziki od właściciela: menu główne (ZACZNIJ, ZALOGUJ, UTWÓRZ KONTO, GRAJ OFFLINE), okna (ZAMKNIJ, WYŚLIJ, WRÓĆ, DALEJ, POMIŃ), czat, mikstura, unik, E, sloty 1–4.

**Zasady wyciągnięte z awarii (obowiązkowe):**
- APK 1.0 (`versionCode` 100, klucz rdzenia `core-c100`) jest zainstalowany u właściciela i **nie wolno go zmieniać bez nowego numeru**. Jego `boot.gd` ładuje `scripts/skin.gd` PRZED montażem rdzenia z serwera, więc `skin.gd` jest zamrożony (test w `smoke.gd` pilnuje listy funkcji). Nowy wygląd: `scripts/look.gd` (bez `class_name`, ładowany przez `preload`) i `data/ui-art.json`, `data/letters.json`.
- Każdą zmianę kodu, który ładuje się przed rdzeniem, sprawdzaj `scripts/godot/e2e_installed.py` (na prawdziwym, zainstalowanym APK), nie tylko `e2e_core.py`. Wydanie 1.1 przeszło `e2e_core.py` i zepsuło grę.
- Grafiki w `assets/` (webp) nie jadą w rdzeniu: próba ich dołożenia złamała podmianę skryptów (przyczyna niewyjaśniona). Zmiana grafik interfejsu wymaga nowego APK albo osadzenia w `data/*.json` (jak `ui-art.json`).
- Publikacja wydania: workflow `godot-content-upload.yml` (`publish` + `activate`) za wyraźną zgodą właściciela; wdrożenie strony i panelu: scalenie PR do `main` (też za zgodą). Wcześniejsza wersja jest zawsze do przywrócenia tym samym workflowem.
- Aplikacja potrzebuje uprawnienia INTERNET (`export_presets.cfg`); do 16.11 go nie miała, stąd brak połączenia.
- Nie rusz instancji GPU, nie przepisuj opublikowanej historii Git (`AGENTS.md`).

### 21. Przejęcie od Claude'a i przygotowanie aktualizacji Android 1.6

Zlecenie właściciela: „Już działa. Tylko że postaci nie mam które były. W ogóle
dużo niedopracowań jest. Wypchninj ostatnie zmiany bo limit mi się skończył w claude”.
Właściciel doprecyzował, że brakujące postacie to zapisy z przeglądarki. Aktualny
Android czyta osobny format `ki-godot-pyra-save-2` i nie importuje postaci webowych.
To luka portu, nie dowód utraty danych. Nie zmieniano zapisów ani bazy graczy.
Logowanie według właściciela już działa; wcześniejszy wpis o blokadzie logowania
nie jest aktualnym zgłoszeniem. Pomiary na fizycznym telefonie nadal nie były
wykonywane w tej sesji.

#### Zakres 1.6

Na osobnej gałęzi od `main@664c7f18` pobrano opublikowane commity Claude'a
`70a2b13c` i `c2dfddf2` (przewijane menu, panel dla admin/GM, instrukcja kontynuacji).
Historia jest zachowana przez scalenie do gałęzi wydania; nie scalano do `main`.
Wstrzykiwane zdarzenia dotyku ujawniły, że pierwotne przewijane menu aktywowało
przyciski na `pointerdown` i nie dawało się przewijać bez akcji: test **0/2**.

Poprawka `hud.gd`: akcja dopiero przy zwolnieniu tego samego palca, próg ruchu
odróżnia klik od przewijania, przesunięcie zmienia pozycję listy, cancel/utrata
fokusu/zamknięcie okna zerują przechwycenie, obcięte przyciski są poza hit testem,
a emulowany klik myszy nie dubluje dotyku. Zachowano dotychczasowe przyciski
o wysokości 80 jednostek; ma się przewijać lista, nie zmniejszać obszar dotyku.
Gesty joysticka i walki pozostają w swoim istniejącym kontrolerze.

Usunięto nieużywaną, osieroconą etykietę sceny startowej i wywoływanie błędu
silnika przy prawidłowo obsługiwanym uszkodzonym JSON numeru wydania. Testy
nie tworzą już niepodpiętych paneli kontrolnych ani typowanej tablicy ze zwolnioną
próbką potwora. Nie usunięto ani nie ograniczono żadnej asercji.

#### Kontrole i paczka

- Pełny TypeScript app/e2e/tools PASS; kontrola dokumentacji PASS.
- Godot headless: **539/539** asercji. Przy zamykaniu tego dużego testu nadal
  występują zastane ostrzeżenia o niezwróconych zasobach; nie ogłaszamy czystego
  zamknięcia ani pełnej natywnej regresji 539 przypadków.
- Nowe testy menu: **11/11 headless i 11/11 natywnie**, w tym cancel, drugi palec,
  utrata fokusu, brak kliknięć przez obcięte elementy, zamknięcie i trzy rozmiary
  ekranu. Zrzut menu w rzeczywistej scenie gry wykonano w programowym OpenGL.
- `e2e_core.py`: **11/11**. `e2e_installed.py`: **PASS na bazie oryginalnego
  APK 1.0**, rozszerzony o rzeczywisty gest przewijania i klik menu po podmianie
  kodu. `skin.gd`, kod APK 100 i plik APK pozostają bez zmian.
- `deliveries/godot-content-1.6`: **27 paczek**, z czego **26 ma identyczne SHA-256
  jak aktywne wydanie 1.5**. Zmienia się tylko `core-c100-eba2f7892d21.pck`,
  3 513 680 bajtów, SHA-256
  `eba2f7892d2151f62b62a79ea825d8872a7fc44b502c46ffd1f42270b95801ca`.

[Raport i ograniczenia](qa/android-1.6/acceptance.json),
[539 wyników](qa/android-1.6/smoke-results.json),
[test menu przed poprawką](qa/android-1.6/menu-before.txt),
[menu natywnie](qa/android-1.6/menu-native-results.json),
[aktualizacja oryginalnego APK](qa/android-1.6/e2e-installed.txt),
[menu w grze](qa/android-1.6/menu-in-game.png),
[sumy dowodów](qa/android-1.6/evidence-sha256.json).

**Stan odbioru tego commita:** paczka przygotowana i zweryfikowana; aktywacja
odbędzie się osobnym ręcznym przebiegiem `godot-content-upload.yml` na gałęzi
wydania (`publish=true`, `activate=true`). Wynik należy potwierdzić odczytem
manifestu produkcyjnego i SHA pobranego rdzenia. To aktualizacja Androida,
bez nowego APK, publikacji strony, zmian instancji GPU i resetu postaci.

#### Publikacja 1.6 — zakończona

Na polecenie właściciela uruchomiono istniejący workflow z gałęzi wydania:
[43929418129 — SUCCESS](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/43929418129),
źródło `39126da264dbcf063ca35e6055d6307e96807bc6`, wersja 1.6,
`publish=true`, `activate=true`. Nie wykonywano scalenia do `main` ani wdrożenia
strony/panelu. Workflow zweryfikował paczki i udostępnił aktualizację aplikacji.

O 18:31 UTC serwer zwrócił `activeVersion: 1.6`, `maintenance: false`.
Publiczny manifest ma wszystkie 27 definicji paczek zgodne z commitem, a pobrany
z domeny produkcyjnej rdzeń ma właściwe 3 513 680 bajtów oraz SHA-256
`eba2f7892d2151f62b62a79ea825d8872a7fc44b502c46ffd1f42270b95801ca`.
[Dowód odczytu produkcji](qa/android-1.6/publication.json).
Poprzednie wydanie 1.5 pozostaje do rollbacku. Aktualizacja pobiera się przy
ponownym uruchomieniu istniejącego APK 1.0. Migracja postaci webowych i dalsze
prace nad interfejsem nie są częścią wydania 1.6.


### 22. Android 1.7 — HUD, dotyk minimapy i natywny panel GM

Zgłoszenie właściciela: zbyt małe przyciski przy minimapie, brak reakcji na dotyk
minimapy, brak panelu GM. Prace na `feat/android-hud-1.7-20261116`, od zapisanego
wydania 1.6 (`20a39259`); stan `origin/main` przy rozpoczęciu: `664c7f18`.

| Funkcja | Przed | Zmiana | Dowód |
| --- | --- | --- | --- |
| Nawigacja HUD | Stałe 68 × 84; ciasno przy minimapie | Preferowane 100 × 112; minimalna szerokość 84; układ przelicza się dla safe area i dodatkowej roli GM | [42 sprawdzenia natywne](qa/android-1.7/hud-native-results.json), [gra 1280 × 576](qa/android-1.7/hud-1280x576.png), [GM 844 × 390](qa/android-1.7/hud-gm-844x390.png) |
| Minimapka | Sam shader, brak celu dotyku | Okrągły cel dotyku otwiera istniejącą mapę; ta sama obsługa zwolnienia palca/cancel co menu | [Mapa 2D po dotyku](qa/android-1.7/map-2d-from-minimap.png), [mapa krainy](qa/android-1.7/continent-from-minimap.png), [pełna scena 5/5](qa/android-1.7/game-native-results.json) |
| Panel GM | Link do strony ukryty w menu | Osobny przycisk GM i natywny podgląd: wersja/stan serwera, liczba graczy według krain, podsumowanie zapisów; przycisk konsoli WWW | [Panel w silniku, odpowiedzi testowe](qa/android-1.7/gm-native-fixture-844x390.png) |
| Uprawnienia | Rola zostawała w pamięci po wylogowaniu | Wylogowanie czyści role; ponowny odczyt `/ws/auth/me` przed chronionymi GET; brak pobierania danych przy cofniętej roli lub błędzie połączenia | [42 sprawdzenia headless](qa/android-1.7/hud-headless-results.json) |
| Zgodność aplikacji | APK 1.0 / kod 100 | Tylko aktualizacja rdzenia; nowy skrypt GM ładowany po ścieżce; bez zmiany `skin.gd` | [Aktualizacja oryginalnego APK](qa/android-1.7/e2e-installed.txt) |

Zmienione źródła: `hud.gd`, `online.gd`, `city_game.gd`, nowy `gm_panel.gd` oraz
testy HUD/sceny/aktualizacji i istniejący workflow Godota (nowe testy zostają
podłączone do CI). Nie zmieniono geometrii, grafik świata, statystyk, danych
postaci, formatu zapisów, konfiguracji APK ani infrastruktury GPU.

#### Weryfikacja i ograniczenia

- Pełny TypeScript app/e2e/tools PASS.
- [Regresja Godota: 539/539](qa/android-1.7/smoke-results.json), bez usuwania asercji.
- HUD: **42/42 headless**, **42/42 natywnie**. Ekrany 1280 × 576, 844 × 390,
  852 × 393, 854 × 480, 1280 × 720 i 1600 × 720; dodatkowo symulowane wycięcia
  ekranu. Każdy przycisk nawigacji ma w tych widokach co najmniej 44 × 44
  piksele ekranu. Dotyk lewym kciukiem pozostaje niezależny od prawego.
- Menu: **11/11 headless i 11/11 natywnie**; wcześniejsze przewijanie/cancel bez regresji.
- Scena rzeczywistej gry w Godot/llvmpipe: **5/5** — dotyk minimapy → mapa,
  powrót do ruchu, przycisk GM → panel, cofnięcie roli przy wylogowaniu.
- [E2E aktualizacji rdzenia: 11/11](qa/android-1.7/e2e-core.txt).
  Oryginalne APK 1.0: **PASS**, w tym minimapa, nowy moduł GM i przewijanie menu.
- Panel GM sprawdzono z jawną atrapą odpowiedzi istniejących API, bez prawdziwych
  danych logowania GM. Nie jest to dowód logowania na produkcyjnym koncie GM.
  Nowy panel w grze jest **tylko do odczytu**. Edycja postaci i inne operacje GM
  pozostają w istniejącej konsoli WWW; nie przeniesiono ich do natywnego panelu.
- Fizycznego telefonu nie testowano. Duży smoke i runner zrzutów zachowują zastane
  ostrzeżenia o zasobach przy zamykaniu; nie deklarujemy czystego zamknięcia ani
  pełnego zielonego CI. [Pełny raport](qa/android-1.7/acceptance.json).

#### Paczka do aktywacji

`deliveries/godot-content-1.7`: **27 paczek**, **26 niezmienionych względem 1.6**.
Nowy rdzeń: `core-c100-85897595dc42.pck`, **3 523 184 bajty**, SHA-256
`85897595dc42c5ef7a2bfee87eb32a8a2e470c7f94b99de999fca8902cc3e073`.
Aktualizacja **nieaktywna**: działa nadal 1.6. Do aktywacji istniejący ręczny
`godot-content-upload.yml` z wersją `1.7`, `publish=true`, `activate=true`,
wyłącznie po zgodzie właściciela. Po publikacji porównać publiczny manifest
oraz SHA pobranego rdzenia; 1.6 zachować do rollbacku.

[Sumy dowodów](qa/android-1.7/evidence-sha256.json). Nie scalano do `main`, nie
publikowano gry i nie resetowano postaci.


#### Publikacja 1.7 — zakończona po zgodzie właściciela

Po poleceniu „Publikuj!” uruchomiono istniejący workflow:
[43934619568 — SUCCESS](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/43934619568),
wersja `1.7`, `publish=true`, `activate=true`, źródło
`f007114b5e83e4cf27f1583bf75313f8949efa0a`.

O 19:00 UTC serwer potwierdził `activeVersion: 1.7`, `maintenance: false`.
Publiczny manifest jest w całości zgodny z przetestowanym commitem (27 paczek),
a pobrany rdzeń ma **3 523 184 bajty** oraz SHA-256
`85897595dc42c5ef7a2bfee87eb32a8a2e470c7f94b99de999fca8902cc3e073`.
[Dowód weryfikacji publikacji](qa/android-1.7/publication.json).

Aktualizacja pobiera się po ponownym uruchomieniu istniejącej aplikacji 1.0.
Wydanie 1.6 pozostaje do rollbacku. Nie wykonano scalenia do `main`, publikacji
strony, nowego APK, resetu postaci ani zmian instancji GPU. Ograniczenia odbioru
telefonu i panelu GM z prawdziwym kontem pozostają jak wyżej.


### 23. Android 1.8 — właściwe komendy GM i menu gry

Właściciel odrzucił podgląd administracyjny 1.7. Punktem odniesienia właściwej
funkcji jest **`src/components/game/StaffTools.tsx`**, a nie panel monitoringu
`/admin`. Na gałęzi `feat/android-gm-tools-1.8-20261116` zastąpiono poprzedni
`gm_panel.gd`; historia odrzuconego panelu pozostaje w Git.

| Funkcja | Przed | Zmiana | Dowód |
| --- | --- | --- | --- |
| Nieśmiertelność | Brak komendy | Blokada bezpośrednich obrażeń i DoT, cofnięcie po wyłączeniu lub utracie roli | [58 sprawdzeń rzeczywistej gry](qa/android-1.8/gm-native-results.json) |
| Brak cooldownów | Brak komendy | Powtórne użycie rzeczywistych zdolności czterech ras, normalne wydawanie KI; wyłączenie przywraca odnowienia | [58 sprawdzeń headless](qa/android-1.8/gm-headless-results.json) |
| Poziom i zasoby | Tylko podgląd serwera | +1 poziom, ustaw 1–20 (obecny limit Androida), +1000 monet, ustaw saldo, +10 mikstur, pełne HP/KI i zdjęcie statusów | [Panel GM po wykonaniu komendy](qa/android-1.8/gm-tools-854x480.png) |
| Teleport | Zwykła podróż do krainy | Współrzędne, punkty przybycia, nazwane miasta/miejsca z danych gry i wszystkie 10 krain; odrzucenie wody/NaN/punktów poza mapą; najbliższa wolna pozycja przy przeszkodzie do 4000 j. | Test teleportu na wyspę i powrotu z zachowaniem ekwipunku i monet w wynikach GM |
| Menu | Długi dialog z listą akcji | Osobny ekran z dużą siatką 3/4 kolumn, widoczny powrót; zachowane działające funkcje i GM dla uprawnionych | [Menu 844 × 390](qa/android-1.8/menu-gm-844x390.png) |
| Uprawnienia i zapis | Odczyt roli dla podglądu | Rola sprawdzana przed każdą komendą; sesyjne tryby GM wygaszane po utracie roli, zmianie konta i błędzie kontroli co 30 s; zamknięcie anuluje oczekującą komendę | Testy odmowy, anulowania i round-trip postaci/ekwipunku/questów |

Nowe `gm_tools.gd` wywołuje istniejące API postaci, ekonomii, nawigacji i zapisu.
Nie wprowadza drugiego systemu walki ani zmiany wzoru obrażeń. `race_kit.gd` ma
wyłącznie opcjonalne flagi sesyjne GM, domyślnie wyłączone i nieobecne w save.
Po zmianie poziomu synchronizowana jest dostępność questów przed zapisem.
Teleport nie uruchamia się we wnętrzu ani po śmierci; wcześniej pobiera brakujące
paczki docelowej krainy i ponownie sprawdza uprawnienia. Nie edytuje cudzych
kont ani slotów. Dotychczasowe blokady zapisu i konflikty rewizji chmury zostają.

Zmodyfikowano `city_game.gd`, `race_kit.gd`, `gm_panel.gd`, dodano `gm_tools.gd`
i `game_menu.gd`, testy i ich podłączenie w istniejącym CI. Asercję starego menu
w smoke dostosowano do nowego ekranu; nadal sprawdza pauzę i wyzerowanie ruchu.
Testy odrzuconego podglądu zastąpiono sprawdzeniem komend i kontroli roli;
pozostałe scenariusze HUD/minimapy i gestów zachowano.

#### Sprawdzenia

- Pełny TypeScript aplikacja/e2e/tools PASS; lint **0 błędów / 17 wcześniejszych ostrzeżeń**.
- [Regresja Godota 539/539](qa/android-1.8/smoke-results.json), HUD **42/42**
  headless i natywnie, rzeczywista scena **5/5**, gesty menu **11/11** natywnie.
- Nowe GM **58/58 headless i 58/58 natywnie**: wszystkie cztery rasy, rzeczywiste
  umiejętności, obraz menu i panelu w silniku, dotyk przycisku bez podwójnej akcji,
  10 list krain bez wychodzenia poza ekran, zapis i odczyt postaci/questów.
- [Vitest eksportu 6/6](qa/android-1.8/vitest-export.txt); brakujące w sparse checkout
  źródła odtworzono dokładnie z istniejącego Git/identycznych lokalnych bajtów,
  bez zmiany danych i asercji.
- [E2E rdzenia 11/11](qa/android-1.8/e2e-core.txt).
  [Oryginalny APK 1.0 PASS](qa/android-1.8/e2e-installed.txt): nowe moduły menu/GM
  i flagi walki dostępne po aktualizacji; `skin.gd` i kod APK 100 bez zmian.
- Użyto jawnej atrapy uprawnień/chmury; nie korzystano z prawdziwego konta GM.
  Fizyczny telefon niezweryfikowany. Przy zamykaniu niektórych runnerów występują
  ostrzeżenia o zasobach; nie deklarujemy czystego zamknięcia ani całego CI PASS.
  [Pełny raport i zakres](qa/android-1.8/acceptance.json).

Nie przenoszono przeglądarkowego nagrywania diagnostyki 45 s (pozostaje FPS),
edytora cudzych kont/bazy ani teleportu przez tapnięcie atlasu. Są natomiast
teleporty przez współrzędne i listę miejsc. Nie podniesiono limitu poziomu
Androida powyżej 20 ani nie zmieniono kanonu liczb. To komendy lokalnego PvE.

#### Paczka wydania

`deliveries/godot-content-1.8`: **27 paczek**, 26 identycznych z 1.7; tylko rdzeń
`core-c100-b12bc37b1ce5.pck`, **3 539 440 bajtów**, SHA-256
`b12bc37b1ce59ccc7112fbfbed89acfabee703ddc0ef8e9747327a1cae29ea75`.
Gotowa do publikacji poprawki w ramach bieżącego polecenia właściciela publikacji
Androida i zastąpienia wadliwego panelu. Wynik aktywacji i odczyt publicznego
manifestu dopisać poniżej. Bez scalenia do `main`, nowego APK i zmian GPU.

[Sumy dowodów](qa/android-1.8/evidence-sha256.json).


#### Publikacja 1.8 — zakończona

W ramach bieżącej zgody właściciela na publikację Androida i polecenia zastąpienia
odrzuconego panelu uruchomiono istniejący workflow z gałęzi wydania:
[43940029213 — SUCCESS](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/43940029213),
`version=1.8`, `publish=true`, `activate=true`, commit
`fe19c7b8549150021cd8b0d7cf8beef4d308f951`.

O 19:31 UTC publiczny serwer potwierdził `activeVersion: 1.8`, bez przerwy
technicznej. Manifest w całości odpowiada przetestowanej paczce (27 definicji),
a pobrany rdzeń ma **3 539 440 bajtów**, SHA-256
`b12bc37b1ce59ccc7112fbfbed89acfabee703ddc0ef8e9747327a1cae29ea75`.
[Dowód odczytu publikacji](qa/android-1.8/publication.json).

Należy całkowicie zamknąć i ponownie uruchomić aplikację, aby pobrała rdzeń.
Nowy APK nie jest potrzebny. Nie wykonano scalenia do `main`, resetu postaci,
publikacji strony ani zmian instancji GPU. 1.7 pozostaje jako poprzednia wersja
techniczna do rollbacku; nie jest już wydaniem aktywnym.

### 24. Android: litery i ramki właściciela w całym interfejsie (gałąź robocza, niepublikowane)

Praca Claude na bazie gałęzi `feat/android-gm-tools-1.8-20261116` (1.8, bez zmian jego plików poza `hud.gd`). Nowa gałąź lokalna `claude/ui-frames-letters-20261116`, nic nie wypchnięto.

- **Ramka okien bez szwów.** Okno ma rozmiar będący wielokrotnością okresu tekstury, a brzegi są kafelkowane bez rozciągania (`prepare_ui_frames.py`, `look.gd`); marginesy treści większe (48–50 px), żeby tekst nie dotykał ramki.
- **Ekrany.** Tło plecaka i postaci z tekstury kamienia (`Look.backdrop`), nagłówki plecaka, postaci i mapy w literach właściciela (`Look.style_heading`), okna wyboru rasy, czatu, mapy i logowania z większymi marginesami.
- **HUD (na układzie Codexa).** Kamienne pierścienie wokół portretu (`ring-star`) i minimapy (`ring-plain`, promień `MINIMAP_RADIUS + 8`), nazwa rasy w literach; fallback do dawnych łuków, gdy obrazu brak (`PyraSkin.draw_ring`, obrazy są w APK 1.0).
- **Testy.** `smoke.gd` 539/539, `hud_mobile` 42/42, `gm_gameplay` 58/58, `menu_input` 11/11, `e2e_installed.py` PASS. Zrzuty: `tests/qa_screens.gd` (HUD, plecak, postać, mapa, wybór rasy, czat). Nie sprawdzano na telefonie.
- **Do wydania:** to jest zmiana kodu i `data/ui-art.json` (jedzie z serwerem, bez nowego APK); wymaga zgody właściciela i koordynacji z Codexem (wydanie 1.9).

### 25. Android: przeniesienie postaci z przeglądarki (lokalnie, niepublikowane)

Do tej pory postaci z gry przeglądarkowej nie dało się wczytać w Androidzie. Nowy plik `scripts/browser_import.gd` (bez `class_name`, ładowany przez `preload`, więc może dojechać z serwerem) i wpis „POSTAĆ Z PRZEGLĄDARKI” w menu gry.

- **Skąd dane.** `GET /ws/characters` z tym samym tokenem konta co reszta gry (serwer akceptuje token konta VPS; sprawdzono w `gameServer.ts: verifyAccount`). Czytane są tylko **postacie zapisane na serwerze**.
- **Co powstaje.** NOWY bohater Androida z tej samej rasy, poziomu (maks. 20 w Androidzie), doświadczenia, złota, mikstur, plecaka, materiałów, założonego wyposażenia i poznanych węzłów drzewka (`kit.learn` odrzuca nieprawidłowe). Co nie ma odpowiednika (nieznane id przedmiotu, węzeł niedozwolony na tym poziomie), jest pomijane i policzone w komunikacie. Postać z przeglądarki nie jest zmieniana ani wycofywana, więc import można powtórzyć. Obecna postać w Androidzie jest zastępowana po zapisie (jest pytanie potwierdzające).
- **Ograniczenie, którego nie da się obejść z poziomu aplikacji:** jeśli postać istnieje tylko w pamięci przeglądarki (zapis lokalny, zakładka panelu „Postacie lokalne”), a nie na serwerze, import jej nie zobaczy; trzeba ją najpierw zapisać na serwerze z przeglądarki albo dodać osobny import z pliku zapisu.
- **Pozycja i kraina.** Bohater zaczyna w stolicy swojej rasy (pozycja z przeglądarki nie jest przenoszona).
- **Testy.** `smoke.gd` **542/542** (3 nowe: plan z liczbą pominiętych rzeczy, odrzucenie nieznanej rasy, zbudowanie bohatera), `hud_mobile` 42/42, `gm_gameplay` 58/58, `menu_input` 11/11, `e2e_installed.py` PASS, `e2e_core.py` 11/11. Nie sprawdzono na prawdziwym koncie ani telefonie.

### 26. Plan oprawy: priorytety właściciela i pierwszy pomiar (audyt animacji bohaterów)

Priorytety właściciela (16.11.2026, wieczorem): 1) spójne postacie (twarz, proporcje, strój, skala) we wszystkich animacjach; 2) płynny chód, atak, unik, trafienie, śmierć, odrodzenie; 3) czytelne efekty KI, trafień i ataków przeciwników; 4) materiały otoczenia (podłoże, przejścia między teksturami, cienie, detale); 5) potwory i NPC w tym samym stylu.

**Pomiar (priorytety 1–2), `scripts/godot/audit_hero_animation.py`.** Skrypt układa każdą klatkę w komórce 200 px tak jak gra i liczy wysokość postaci, linię stóp i środek poziomy dla 4 bohaterów i 144 klipów (kierunek `right`). Wynik:
- **Spójne:** `idle`, `walk`, `attack`, `hit`, `dodge` mają wysokość w granicach 6–14 % od `idle` u wszystkich czterech ras (np. Legenda: idle 183, walk 180, attack 170, hit 171 px). Stopy i środek w tych klipach nie wędrują.
- **Do poprawy:** `run` jest o ok. 15 % niższy niż `idle` u wszystkich ras (152/153/156 vs 178–183 px): albo biegnie zgarbiony, albo narysowany w mniejszej skali. `skillb` i `kiskillb` mają stopy wędrujące o 36–50 px i wysokość 15–21 % mniejszą; `skillc`/`kiskillc` podobnie. Klipy `death` mają skrajnie różną wysokość (Legenda 83, Mędrzec 90, Android 116, Planetarny 152 px), czyli ostatnia klatka śmierci nie leży tak samo u każdej rasy; `respawn` Androida (142) odbiega od reszty (169–184).
- **Czego skrypt nie mierzy:** twarzy, stroju i barw (wymaga oka lub modelu wizyjnego). Flagi dla pozy z natury zmieniających wysokość (unik, trafienie, finisher) są pominięte.

**Plan, od najtańszego:**
1. *Kod, bez GPU:* efekty KI, trafień i telegrafy ataków potworów (priorytet 3), cienie pod postaciami i stała skala w kodzie, ujednolicenie ostatniej klatki śmierci i odrodzenia (obcięcie do wspólnej linii podłoża).
2. *Grafika, wymaga generowania:* ponowne narysowanie `run`, `skillb/c`, śmierci i odrodzenia w tej samej skali (priorytety 1–2), materiały podłoża i przejścia (4), potwory i NPC (5). Generowanie wymaga dostępu do poda GPU (obecnie brak dostępu do plików poda) albo API obrazów.

Pod GPU `bqnirbw2ucnqrk` ma `volumeInGb=0`: zatrzymanie kasuje cały dysk kontenera; zatrzymanie zaplanowano na 17.11.2026 00:32 UTC (decyzja właściciela), po wcześniejszym zabezpieczeniu danych albo potwierdzeniu, że nic tam nie ma.


### 27. Kopia robocza GPU, anulowanie zatrzymania poda, animacje pętli i efekty premium (lokalnie, niepublikowane)

- **GPU: bez zatrzymania.** Właściciel zdecydował, że pod ma działać (nie zatrzymywać). Zaplanowane zatrzymanie na 17.11.2026 00:32 UTC **zostało skasowane**; pod `bqnirbw2ucnqrk` nadal działa i nie był ruszany. RunPod nie ma pauzy: tylko Stop (kasuje dysk kontenera, bo `volumeInGb=0`) albo Terminate, a to wykonuje wyłącznie właściciel.
- **Kopia danych poda** w repo: `art/production/ki-premium-pod-backup/` (451 plików, 189 MB, rozmiary zgodne z podem; obrazy, wideo i zip przez Git LFS). To wyniki i kod pracy Codexa (kandydaci SDXL terenu, pilotaże Wan2.2, klatki kontrolne VACE, pakiet klienta, skrypty `premium_pilot.py`, `download_*.py`, `provenance`, kolejki). **Bez modeli** (ok. 116 GB: `model`, `wan22/model`, `vace14/model`, `venv`), bo pobiera się je ponownie skryptami `download_*.py`. Przeniesione przez API plików Jupytera; terminala poda nie da się użyć z piaskownicy (proxy blokuje WebSocket, SSH odrzuca połączenie), dlatego **na podzie nie uruchomiono żadnego zadania**. Na podzie leży tylko nieuruchomiony `/workspace/agent/loop.sh` (runner zadań, startuje go właściciel jedną linią w terminalu Jupytera).
- **Animacje pętli (priorytety 1–2), bez GPU.** `scripts/godot/normalize_hero_loops.py` wyrównuje pętle `walk`, `run`, `channel` i ich warianty Ki do klipu `idle` tej samej rasy i kierunku: skala klipu (pole `scale` w `data/actors.json`, czytane przez `actor_view.gd`, zakotwiczone na stopach; korekta = (wysokość idle / wysokość klipu)^0,6, bo biegnąca postać jest naprawdę niższa), linia stóp i środek ciała ściągane w 75 % ku wzorcowi (reszta zostaje jako naturalne podskoki). Jednorazowe klipy (ataki, umiejętności, unik, trafienie, śmierć) bez zmian, bo z natury opuszczają linię gruntu. Wynik liczony zawsze od `scripts/godot/actors.source.json` (idempotentny). Audyt: 37 → 31 oznaczonych klipów (skala `run` 1,03–1,09). Niewyrównane do dziś: `skillb/skillc`, śmierć i odrodzenie (wymagają ponownego narysowania, czyli GPU).
- **Efekty premium (priorytet 3), bez GPU.** `scripts/fx.gd` przepisany na światło addytywne (to samo API `spawn/number/word`): promienna poświata, wstęgi cięć (`slash`, `swing`), fala uderzeniowa i iskry (`burst`), aura Ki z płomieniami (`buff`), smugi uniku (`dash`) i nowe `hit` (błysk i iskry na trafionym wrogu, większy przy krytyku, żółty przy słabości, szary przy odporności) oraz `hurt` (czerwony błysk, gdy trafiony jest bohater). Cząstki są funkcją (ziarno, indeks, wiek), więc rysowanie nie ma stanu. Telegrafy potworów (`monster.gd`): strefa wybuchu z pulsującą obwódką, znacznikami i zbiegającym pierścieniem, tor szarży z pasem i strzałkami, błysk przed strzałem. Podgląd: `tests/qa_fx.gd`.
- **Testy.** `smoke.gd`: 536/542 PASS. Te same 6 testów (ruch/dialog/dotyk w trybie headless) pada na czystym HEAD bez moich zmian, więc to stan wyjściowy, nie regresja. Poprzednie „542/542” nie powtarza się w tym środowisku.
- **Cień pod postaciami** (`actor_view.gd`): miękka plama (tekstura promienista, spłaszczona do gruntu) z ciemniejszym rdzeniem zamiast jednej plamy; dotyczy bohatera, NPC i potworów. `smoke.gd` po zmianie: 536/542, te same 6 testów co na czystym HEAD.

### 28. Naprawy z audytu Androida 1.8 (raport Codexa, `qa/android-level3-audit`) — lokalnie, niepublikowane

Źródło: `docs/zmiany/2026-11-16/qa/android-level3-audit/raport.pdf` (commit `50567ffd`).

- **P1-01 (brakujący NPC, 11 zadań zablokowanych) — naprawione.** Każde z czterech miast bez własnego rozmówcy dostaje na ulicy postać „hunter” z danych zadań: Toren (Żarowy Trakt), Lina (Latarnia Korzeni), Talen (Archiwum Nad Chmurami), VEX-3 (Port Zerowy), z imieniem, rolą i pierwszym powitaniem z `quests.json`. Wiązanie zadań działa przez `<kraina>.npc.hunter` w danym mieście, więc przyjęcie i oddanie zadań trafia do właściwej postaci. Nowe `PyraQuests.npc_for(kontynent, osada, rola)`.
- **P2-01 (osiem nazw rozmówców) — naprawione.** Przewodnik w miastach i rozmówcy usług (sklep, kuźnia) noszą teraz imię postaci z zadań danego miasta (Nela, Oren, Hana, Daro, Nari, Kael, Eko-0, KOR-9), a nie imię z miasta stołecznego (Mio, Taro, „Opiekun miasta”).
- **P2-02 (Pieczęć Energii Mędrca, zwolniony cel) — naprawione.** Opóźnione efekty nie przechwytują już węzła wroga w lambdzie (stąd `Lambda capture at index 0 was freed`), tylko `WeakRef`: Pieczęć Mędrca (A1), Android A4 i cięcia Legendy (`cuts`).
- **Test.** `tests/quest_npcs.gd` (12/12): dla 12 miast czterech krain sprawdza, że przewodnik i „hunter” stoją na ulicy pod imieniem postaci z zadań, a rozmówca sklepu i kuźni w środku ma jej imię. Na starym kodzie test dawał 6/12 (kontrola negatywna). `smoke.gd`: 536/542, te same 6 testów co na czystym HEAD.
- **Nie ruszone (decyzja właściciela):** ART-01 (strój Legendy w `kiskillb`: czerwony pancerz zamiast odsłoniętego torsu, wymaga ponownego narysowania klipu), CANON-01 (wygląd Mędrca: kobieca sylwetka kontra męski opis w `RASY-I-POSTACIE.md`: potwierdzić wzorzec), TECH-01 (ostrzeżenia ObjectDB przy zamykaniu runnerów: osobny audyt cyklu życia).


### 29. Audyt Androida 1.8 — cztery rasy do poziomu 3, budynki, dialogi i animacje

Na polecenie właściciela wykonano szeroki audyt w rzeczywistym Godot 4.6.3,
renderer Compatibility / Mesa llvmpipe (CPU), z zapisem dowodów na
`qa/android-races-level3-20261116`. Testowany kod produkcyjny:
`fe19c7b8549150021cd8b0d7cf8beef4d308f951`, aktywna wersja **1.8**.
Lokalny eksport rdzenia jest identyczny z publicznym manifestem: **3 539 440 bajtów**,
SHA-256 `b12bc37b1ce59ccc7112fbfbed89acfabee703ddc0ef8e9747327a1cae29ea75`.
[Dowód zgodności](qa/android-level3-audit/published-core-proof.json).

**Werdykt: awans i podstawowe usługi przechodzą, odbiór całości niezaliczony.**
Brakujące postacie questowe blokują 11 zadań; same poprawne pliki JSON i teksty
nie są dowodem dostępności rozmówcy w świecie.

[Raport PDF — 21 stron](qa/android-level3-audit/raport.pdf),
[raport HTML z wyszukiwaniem 486 kwestii](qa/android-level3-audit/raport.html),
[pełne wyniki i usterki JSON](qa/android-level3-audit/report.json),
[132 wejścia CSV](qa/android-level3-audit/buildings.csv),
[rejestr NPC CSV](qa/android-level3-audit/npc-catalog.csv),
[zablokowane zadania CSV](qa/android-level3-audit/blocked-quests.csv).

#### Przejścia 1→3

| Rasa | Poziom końcowy | Nagradzane zabicia | Śmierci | Odpoczynki w gospodzie | Wynik funkcjonalny |
| --- | --- | --- | --- | --- | --- |
| Legendy | 3 | 17 | 0 | 4 | 7/7 |
| Planetarni | 3 | 17 | 0 | 1 | 7/7 |
| Mędrcy | 3 | 20 | 0 | 0 | 7/7; dwa błędy silnika podczas działania A1 |
| Androidy | 3 | 18 | 0 | 0 | 7/7 |

Wszystkie przebiegi zaczynają od nowej postaci 1. poziomu, zwykłego ekwipunku,
20 monet i 3 mikstur. Nie dodawano XP ani poziomów, nie włączano GM i nie
zmieniano statystyk wrogów. Używano faktycznych spawnów, sygnału joysticka,
przytrzymania ataku, legalnego A1 od poziomu 2, AI, nagród i zwykłych usług.
Żaden z tych przebiegów nie zużył mikstury. Licznik pomija potwory `no_reward`;
Android ma 55 XP ponad sumę nagród ujętych zabić — kwota odpowiada nagrodzie
wydarzenia Kordon Dronów, nie zaliczamy jej do zabicia zwykłego drona.

To **kontrolowane testy funkcjonalne**, nie pełna ręczna wyprawa ani benchmark
czasu: przeniesienia między istniejącymi spawnami i gospodą są fixture; runtime
wykonuje `_process` i AI z krokiem 1/60, z renderowaniem co cztery kroki.
Przebycia dróg od bramy do spawnu nie mierzono. Każda rasa przeszła zapis i odczyt
poziomu 3 i drzewka. Rzeczywiste zrzuty:
[Legenda](qa/android-level3-audit/progression/legend-level-3.png),
[Planetarny](qa/android-level3-audit/progression/planetary-level-3.png),
[Mędrzec](qa/android-level3-audit/progression/sage-level-3.png),
[Android](qa/android-level3-audit/progression/android-level-3.png).

#### Wszystkie wejścia i dialogi

- **132/132** wejścia usługowe: 4 kontynenty × 24 i 6 wysp × 6.
  Sprawdzono lokalny wolny punkt dojścia, wejście do właściwego wnętrza,
  mieszkańca, funkcję usługi i powrót pod te same drzwi. Każdy z 6 typów usług
  ma 22 sprawdzone wystąpienia.
- Sklep: kupno/sprzedaż; kuźnia: rzeczywista receptura; depozyt: włożenie/wyjęcie;
  gospoda: zapłata i leczenie; arena: obrażenia manekina; sala: rozmowa.
  Budżet i materiały tych osobnych testów są kontrolowanym fixture.
- **244 wystąpienia NPC**, **732 otwarcia dialogów** na stanach poziomu 1/2/3,
  **288 wariantów tematów świat/rola**. Sprawdzono dopasowanie dialogów do widoku
  844×390. Przebiegi świata: **2666/2666 headless i 2666/2666 natywnie**.
- **486 kwestii katalogowych**: 84 powitania, 84 plotki, 318 wariantów
  before/during/after. Łączny zestaw silnika dialogów: **663/663**. Dalsze stany
  questowe w tym zestawie są jawnie ustawionymi fixture, nie zadaniami naturalnie
  ukończonymi na poziomie 3.

#### Usterki

| Priorytet | Problem | Skutek / dowód |
| --- | --- | --- |
| P1 | Lina, Toren, Talen i VEX-3 nie mają odpowiadających NPC pod wymaganymi bindingami w swoich miastach | **11 zadań** z `playableInCurrentRuntime=true` bez dostępnego rozmówcy, w tym O-A05 i O-N05. **57 kwestii** katalogowych bez NPC w świecie |
| P2 | 8 nazw NPC niezgodnych ze scenariuszem | Np. dialog Neli pod imieniem Mio, Orena pod Taro, Nari pod Opiekun miasta; role działają, ale widoczne nazwy mylą gracza |
| P2 | Opóźniona Pieczęć Energii Mędrca odwołuje się do zwolnionego celu | Dwa `ERROR: Lambda capture at index 0 was freed. Passed null instead.`; `race_kit.gd:445`. A1 planuje wybuch po 3 s, ciało celu jest usuwane po około 2 s. Awans nie został przerwany |
| Odbiór grafiki | Strój Legendy w `kiskillb` i wygląd Mędrca wobec dokumentu kanonu | Technicznie klatki działają; podgląd pokazuje niespójność stroju KI oraz sylwetkę Mędrca odmienną od opisu męskiej postaci. Do decyzji właściciela |
| Dług techniczny | Ostrzeżenia ObjectDB przy zamykaniu części runnerów | Nie deklarujemy czystego zamknięcia ani całego CI PASS |

Dostępność autorowanych NPC: **16 nazw zgodnych / 8 rozbieżnych / 4 brakujące**.
Nie mylić zaliczonego testu silnika dialogów ze sprawdzonym dostępem do każdego
tekstu w świecie. Dokładne nazwy, miasta, bindingi i zadania są w PDF/JSON/CSV.

#### Animacje

**144 klipy** (36 na rasę), **1152 pary klip/kierunek**, **8384 odwołania do
klatek**: poprawne regiony atlasów, brak pustych klatek alfa, rzeczywisty postęp
osi czasu `AnimatedSprite2D`. Zestaw techniczny **2592/2592**. Część kierunków
współdzieli źródło przez lustrzane odbicie; nie ogłaszamy ośmiu odrębnych filmów.
Klipy KI są podglądem testowym, nie odblokowaniem formy na poziomie 3.

[36 klipów Legendy](qa/android-level3-audit/animations/legend-36-clips.png),
[Planetarni](qa/android-level3-audit/animations/planetary-36-clips.png),
[Mędrcy](qa/android-level3-audit/animations/sage-36-clips.png),
[Androidy](qa/android-level3-audit/animations/android-36-clips.png).
Nagrania chodu w 8 kierunkach pochodzą z runtime Godota:
[Legendy](qa/android-level3-audit/videos/legend-walk.mp4),
[Planetarni](qa/android-level3-audit/videos/planetary-walk.mp4),
[Mędrcy](qa/android-level3-audit/videos/sage-walk.mp4),
[Androidy](qa/android-level3-audit/videos/android-walk.mp4).

#### Bezpieczeństwo i odtwarzanie

Dodano wyłącznie runnery `audit_progression.gd`, `audit_world.gd`,
`audit_dialogues.gd`, `audit_animations.gd` oraz kompilator raportu
`scripts/godot/audit_level3_report.py`. Żaden plik runtime, kanonu ani grafiki
produkcyjnej nie został zmieniony. Pełny TypeScript app/e2e/tools PASS.
Zapisy testów są w oddzielnych `XDG_DATA_HOME`; nie używano prawdziwych kont,
cloud save ani instancji GPU. Fizyczny telefon i pełna kampania pozostają
niezweryfikowane. Nie wykonano scalenia ani nowej publikacji gry.

[Sumy wszystkich dowodów](qa/android-level3-audit/evidence-sha256.json).

### 30. Wydanie 1.9 (zgoda właściciela 17.11.2026: „Scalaj i publikuj”)

Zawartość: litery i ramki właściciela w oknach, ekranach i HUD; przeniesienie postaci z przeglądarki (menu POSTAĆ Z PRZEGLĄDARKI); wyrównanie animacji pętli bohatera; efekty premium (KI, cięcia, uderzenia, telegrafy ataków) i miękki cień; naprawy z audytu 1.8 (NPC zadań w czterech miastach, nazwy rozmówców, `WeakRef` w opóźnionych efektach). Paczki: `deliveries/godot-content-1.9` (27 paczek, rdzeń `core-c100-8eda74fd9400`, 3,6 MB). Przed publikacją: `e2e_installed.py` PASS na zainstalowanym APK 1.0, `e2e_core.py` 11/11 PASS, `quest_npcs.gd` 12/12, `smoke.gd` 536/542 (te same 6 testów pada na czystym HEAD). Wersja aktywna do tej pory: 1.8 (Codex); wycofanie = ponowna aktywacja 1.8.

### 31. Legenda 3D z Meshy (próba, lokalnie, niepublikowane)

Z nowego obrazu Legendy od właściciela (17.11.2026) wygenerowano w Meshy (image-to-3D, poza A, ok. 40 tys. trójkątów) model GLB: 41 421 trójkątów, tekstura w pliku, widoki ze wszystkich stron spójne ze wzorcem. Zużyto 60 kredytów (dwie próby: obecny wzorzec i nowy obraz), zostało ok. 3220. Model jest jeszcze bez szkieletu i animacji. Podgląd 8 kierunków: `ports/godot-pyra/tests/qa_glb.gd` (render GLB w Godot na CPU). Dalej: rigowanie, animacje, render do sprite'ów, decyzja o nowym APK lub paczce z arkuszami bohatera.
- **Legenda 3D, ciąg dalszy (17.11.2026, lokalnie, niepublikowane).** Wzorcem jest druga generacja (`meshy-6`, 207 tys. trójkątów, `remove_lighting`): twarz lepsza niż przy domyślnych ustawieniach (40 tys. trójkątów), choć tekstura 2048 px na całe ciało nadal ogranicza rysy. Model zrigowany w Meshy (24 kości) i animowany z biblioteki Meshy: idle, chód, bieg, atak, combo, umiejętności, finisher, unik, gard, trafienia, śmierć, odrodzenie, zwycięstwo, kanał, interakcja (19 klipów; numery akcji w skanie 1–180, m.in. 0 Idle, 4 Attack, 8 Dead, 3 Arise, 7 BeHit_FlyUp, 17–19 Skill_01–03, 156 Stand_Dodge, 178 Hit_Reaction). `tests/render_hero_sprites.gd` renderuje klipy do klatek w 8 kierunkach (stała kamera, rzut z góry 22°). Do zrobienia: przycięcie i arkusze w formacie `actors.json`, retiming (klipy Meshy są 3–5 razy wolniejsze niż w grze), warianty KI, decyzja o nowym APK lub paczce z arkuszami. Zużyto ok. 640 kredytów Meshy, zostało ok. 2640. GLB i klatki (ok. 550 MB) nie są w repo.
- **Legenda 3D w grze (17.11.2026, lokalna próba, niepublikowana, za przełącznikiem `--hero3d`).** Klipy Meshy renderowane w Godot (`tests/render_hero_sprites.gd`: 512 px, MSAA, 5 kierunków, ruch roota wycięty z wygładzonej ścieżki bioder, stała kamera 22°) i pakowane `scripts/godot/build_hero3d_sheets.py` do arkuszy WebP w `assets/actors/hero3d/` (20 klipów, 17,5 MB, Git LFS) oraz wpisu `pyra.hero3d` w `data/actors.json` (komórka 256 px, ta sama skala i linia stóp co malowany bohater; lewe kierunki to lustro prawych). `city_game.gd` używa go tylko z argumentem `--hero3d`; bez niego gra jest bez zmian. Czasy klipów dopasowane do gry (np. chód 0,7 s, bieg 0,5 s, atak 0,67 s). Atak podstawowy to kopnięcie (akcja 103) zamiast wywrotki z klipu „Attack”. Sprawdzenie: `tests/qa_hero3d.gd` (zrzuty każdego klipu w prawdziwej scenie). Do rozstrzygnięcia przez właściciela: wygląd (płaszcz bardziej „spódnicowy” niż na obrazie), warianty KI, oraz nowy APK albo paczka z serwera na arkusze (17,5 MB).
- **Android 3D (17.11.2026, lokalna próba, niepublikowana, `--hero3d`).** Z obrazu od właściciela (srebrno-niebieska zbroja, białe włosy) wycięto postać z fałszywej szachownicy (włosy zachowane po obrysie), wygenerowano model w Meshy (`meshy-6`, 200 tys. trójkątów), zrigowano i dodano 18 animacji z wcześniej poznanej listy (bez skanowania). Koszt łącznie **89 kredytów** (limit właściciela 100; zostało 2553). Te same narzędzia: `render_hero_sprites.gd`, `build_hero3d_sheets.py --world nexus`; arkusze `assets/actors/hero3d/nexus-hero3d-*.webp` (17,8 MB, LFS), wpis `nexus.hero3d`. Test: `tests/qa_hero3d.gd --hero3d --race android`. Uwaga: pancerz wyszedł jaśniejszy (bielszy) niż w obrazie, do oceny przez właściciela.
- **Mędrzec 3D (17.11.2026, lokalna próba, niepublikowana, `--hero3d`).** Z obrazu od właściciela (kobieta w zielono-białych szatach) wycięto postać z szachownicy, z zachowaniem białej sukni i jasnych włosów (rozpoznanie wzoru szachownicy w dziurach). Model `meshy-6`, rig i 18 animacji: **89 kredytów** (limit 100; zostało 2464). Arkusze `assets/actors/hero3d/aether-hero3d-*.webp` (21,8 MB, LFS), wpis `aether.hero3d`. Nagrania z gry (`tests/qa_video.gd`, zoom 1,6, tak by HUD nie zasłaniał głowy) dla Legendy, Androida i Mędrca. Kanon: obraz właściciela przedstawia kobietę, zgodnie z obecnym sprite'em (zob. CANON-01).
- **Planetarny 3D (17.11.2026, lokalna próba, niepublikowana, `--hero3d`).** Źródło: obecny wzorzec `art/production/heroes/planetary/painted-v1/masters/planetary-master-down.png` (właściciel nie podał nowego obrazu). Model `meshy-6`, rig, 18 animacji: **89 kredytów** (zostało 2375). Arkusze `assets/actors/hero3d/verdant-hero3d-*.webp` (17,0 MB, LFS), wpis `verdant.hero3d`. Wszystkie cztery rasy mają teraz wersję 3D za przełącznikiem.
- **Wzorce formy KI (po transformacji) od właściciela, 17.11.2026 — tylko zapisane.** `art/production/heroes/<rasa>/ki-form-v1/sources/<rasa>-ki-form-front.png` (Git LFS): Android (nagi tors, niebieska gwiazda i żyłki światła, srebrne naramienniki), Mędrzec (świecące oczy, zielono-złota suknia), Planetarny (biało-zielone kimono, pomarańczowa chusta, zielona poświata), Legenda (nagi tors z żarzącymi się pęknięciami, czerwone oczy, kolczasty naramiennik). Przeznaczenie: modele 3D i animacje formy KI (`ki*`). Nic z nich jeszcze nie wygenerowano.
- **Forma KI Legendy i przemiana (17.11.2026, próba, niepublikowana, `--hero3d`).** Model KI z obrazu właściciela (`legend/ki-form-v1`), rig, 16 animacji KI oraz ruch przemiany Shouting_Angrily (51) na modelu KI i na zwykłym: **86 kredytów** (zostało 2289). Klipy `ki*` (+ `kitransform`, `transform`) dołączone do `pyra.hero3d` (`build_hero3d_sheets.py --prefix ki --merge`). Przemiana (`PyraActor.transform`, `player.set_ki_form`): zwykła postać gra `transform`, pod nią forma KI gra `kitransform` (ta sama animacja, więc pozy się pokrywają), shader rozpuszcza zwykłą postać od stóp w górę z żarzącą się krawędzią, w połowie błysk, fala, wstrząs i krótkie zatrzymanie (`city_game.gd`); powrót to szybkie przenikanie. Bez klipów przemiany gra przełącza formę jak dotąd. Test: `tests/qa_transform.gd`.
- **Kamera celuje w środek postaci, nie w stopy** (`camera.position`, 45 % wysokości postaci w górę), więc przy powiększeniu głowa nie wchodzi pod HUD (zgłoszenie właściciela). `smoke.gd -- --fresh`: **542/542** (wcześniejsze 6 błędów brało się z uruchamiania bez `--fresh`, przy pozostawionym zapisie).
- **Formy KI i przemiana: Android, Mędrzec, Planetarny (17.11.2026, próba, niepublikowana, `--hero3d`).** Modele KI z obrazów właściciela (`<rasa>/ki-form-v1`), rigi, po 16 animacji KI i ruch przemiany na modelu KI i zwykłym: **3 × 86 = 258 kredytów** (zostało 2031). Uwaga: pierwsze uruchomienie trzech ras naraz liczyło wydatek ze wspólnego salda i zatrzymało się przed animacjami (bez strat, dokończone osobnym przebiegiem z licznikiem na rasę). Kolor krawędzi przemiany zależy od rasy (`KI_GLOW`: żar, błękit, złoto, zieleń); identyfikatory `hero-<świat>-3d`.
- **Bieg bez ślizgu.** Chód i bieg grają w tempie dopasowanym do rzeczywistej prędkości postaci (`refSpeed`: chód 109 px/s, bieg 257 px/s przy naturalnym tempie klipu; `PyraActor.match_gait`), zamiast stałego, za szybkiego cyklu (wcześniej 0,5 s na bieg). `smoke.gd -- --fresh` 542/542.
- **Bohaterowie 3D domyślnie, bez flag (17.11.2026, decyzja właściciela; niepublikowane).** `data/actors.json` `<świat>.hero` to teraz bohaterowie z modeli 3D (id `hero-<świat>-3d`, 38 klipów: zwykłe, `ki*`, `transform`/`kitransform`), arkusze `assets/actors/hero3d/` przebudowane w komórce 200 px (proporcje malowanych bohaterów) i WebP q80: **74 MB** dla czterech ras (było 33 MB malowanych). Przełącznik `--hero3d` usunięty. Malowani bohaterowie przeniesieni (nie usunięci) do `art/production/heroes/painted-sprites-legacy/` (49 arkuszy + `actors-painted.json` + README); poza projektem Godot, więc nie trafiają do APK. Wpisy `<świat>.hero_painted` zostają w `actors.json` jako zapas: `PyraActor.usable_hero` bierze malowanego bohatera, gdy arkuszy 3D nie ma na urządzeniu (zainstalowane APK 1.0 dostanie z serwera kod i dane, ale nie nowe obrazy). **Nowi bohaterowie dotrą do graczy dopiero z nowym APK.** Baza APK urośnie o ok. 41 MB (z ok. 57 MB do ok. 98 MB) — powyżej celu 80–90 MB. `smoke.gd -- --fresh` 542/542, `gm_gameplay` 58/58, `e2e_installed.py` PASS.

### 32. Wydanie 1.10 i APK 1.10 (zgoda właściciela 17.11.2026: „Publikuj”)

- **APK 1.10** (`deliveries/godot-ki-legends-1.10/`, 136,6 MB, Git LFS): bohaterowie 3D w APK. `versionCode` pozostaje 100, więc instaluje się na 1.0 bez odinstalowania (ten sam klucz podpisu) i jedno wydanie z serwera (`core-c100`) obsługuje oba APK. Rozmiar ponad cel 80–90 MB: arkusze bohaterów 68 MB po stratnym imporcie tekstur (jakość 0,7; bez tego APK miał 334 MB). Nazwa wersji aplikacji 1.10 (`project.godot`, `export_presets.cfg`).
- **Wydanie treści 1.10** (`deliveries/godot-content-1.10`, rdzeń `core-c100-36bec0f5e21f`). Gracze z APK 1.0 dostaną z niego nowy kod i dane, ale bohaterowie zostaną u nich malowani (brak nowych obrazów w APK 1.0; zapas `usable_hero`). Testy: `smoke.gd -- --fresh` 542/542, `gm_gameplay` 58/58, `e2e_installed.py` PASS, `e2e_core.py` 11/11. Na fizycznym telefonie nie testowano. Wycofanie: ponowna aktywacja 1.9.

### 33. Wydanie 1.11: bohaterowie 3D z serwera, bez nowego APK (17.11.2026)

Właściciel słusznie zakwestionował konieczność ponownego pobierania APK. Arkusze bohaterów 3D (`assets/actors/hero3d/`) są teraz osobną paczką serwera `heroes` (68,5 MB, `build_packs.py`: klasyfikacja `assets/actors/hero3d/*`, wymagana przez każdą krainę, w tym wyspy; wyłączona z bazy APK). Zainstalowane APK 1.0 pobiera ją samo przy wejściu do gry (ten sam mechanizm co paczki krain) i od tej chwili pokazuje bohaterów 3D z formami KI i przemianą; do czasu pobrania działa zapas `usable_hero` (malowany bohater). Sprawdzone na rozpakowanym APK 1.0: bez paczki `hero-legend`, po zamontowaniu `heroes` — `hero-pyra-3d` i pozostałe trzy rasy z klipem `kitransform`. Rdzeń bez zmian względem 1.10 (`core-c100-36bec0f5e21f`). APK 1.10 z `deliveries/` nie jest potrzebny graczom (zostaje jako artefakt); następny APK nie będzie zawierał arkuszy bohaterów.

### 34. Poprawki interfejsu po zrzutach właściciela (17.11.2026) — wydanie 1.12 (przygotowane)

Zgłoszenia z trzech zrzutów i naprawy (sprawdzone na zrzutach z gry w rozdzielczości telefonu 2000×900, `tests/qa_menus.gd`):

- **Brak krzyżyka / powrotu.** Nowy wspólny przycisk zamknięcia (`Look.add_close`: okrągły medalion ze złotym krzyżem w prawym górnym rogu, nad treścią, więc długi tytuł nie wypchnie go poza ekran) w: postać i drzewko, plecak i sklep, mapa (globus, atlas, mapa szczegółowa), menu, Narzędzia GM, wybór rasy, czat. Paski tytułu mają stałą wysokość 96 px i rezerwę na krzyżyk (`Look.reserve_close`), tytuły się przycinają zamiast wychodzić z ekranu. Okienka dialogowe zachowały duży przycisk ZAMKNIJ.
- **Narzędzia GM.** Tytuł wychodził na ramkę: okno ma teraz większe wcięcie (58 px) i tytuł w literach właściciela. Pionowe ciemne kreski przez ramkę i teksty były szwami ramki (rozciągany kafel 9-slice): ramka rysowana jest teraz ręcznie, kafel po kafelku z środka paska (bez szwów). Domyślne szare okno listy krain/miejsc zastąpione listą w stylu gry (`Look.style_picker`: ciemny kamień, złota ramka, podświetlenie, duży tekst); pola liczbowe i współrzędne w stylu gry (`Look.style_spin`).
- **Fioletowe dziury w terenie.** Nie udało się ich odtworzyć na komputerze (teren w tym samym miejscu rysuje się poprawnie). Najbardziej prawdopodobna przyczyna: pamięć graficzna telefonu. Wydania 1.9–1.11 wczytywały przy starcie wszystkie 38 arkuszy bohatera 3D (ok. 226 MB tekstur po zdekodowaniu), a przy braku pamięci tekstury terenu nie mają skąd się wziąć. Naprawa: przy starcie tylko 7 często używanych klipów (commit 337ca9b2) i **zwalnianie klipów nieużywanych od 20 s** (`PyraActor.prune_clips`; test w `smoke.gd`). Nie potwierdzone na telefonie.
- **Minimapa pokazywała „inną grę”.** Używała malowanej, abstrakcyjnej mapy (pomarańczowe plamy) niezwiązanej z wyglądem terenu. Teraz używa obrazu wyrenderowanego z prawdziwego terenu gry (ten sam shader: biomy, woda, brzegi, drogi; `tests/render_minimaps.gd` + `scripts/godot/finish_minimaps.py`, 10 krain, 191–596 KB). Ten sam obraz jest na mapie szczegółowej. Obrazy jadą do graczy w osobnej małej paczce serwera `minimaps` (nie przeładowują paczek krain); bez niej gra używa starej mapy.
- **Teleport z mapy.** Mapa szczegółowa: dotknięcie miejsca (znacznika albo gruntu) stawia pinezkę i pokazuje współrzędne; dla GM pojawia się przycisk TELEPORT TU (przez `gm_tools.execute`, z weryfikacją uprawnień na serwerze). Na globusie i atlasie dla GM przycisk regionu to TELEPORT zamiast PODRÓŻ.
- **Do zrobienia / nie ruszone:** drzewko umiejętności ma etykiety węzłów przecięte liniami połączeń (rysunek drzewka); okienka dialogowe bez krzyżyka (są z ZAMKNIJ); ekran logowania nie ma krzyżyka (nie ma dokąd wracać).
- **Testy:** `smoke.gd -- --fresh` 543/543, `hud_mobile` 42/42, `gm_gameplay` 58/58, `menu_input` 11/11.

### 35. Wybór postaci przed wejściem do gry (17.11.2026) — wchodzi do wydania 1.12

Zlecenie właściciela: gdy gracz ma wiele postaci, przed wejściem do gry wybiera, którą gra.

- **Skąd wiele postaci.** Dotąd NOWA POSTAĆ i POSTAĆ Z PRZEGLĄDARKI nadpisywały jedyny zapis. Teraz każdy zapis aktywnej postaci trafia też do własnego slotu `user://characters/<id>.json` (`scripts/characters.gd`, ładowany po ścieżce, bez `class_name`). Grana jest nadal `user://city-checkpoint-v1.json` (aktywna postać; `characterId` w zapisie), więc chmura, `restore_checkpoint` i testy działają bez zmian. Stary zapis bez id dostaje id i slot przy pierwszym starcie.
- **Ekran startowy.** Po bramce logowania, przed wczytaniem świata: przy dwóch i więcej postaciach (albo gdy rozpoczęto nową postać i nie ukończono wyboru rasy, a stara istnieje) pokazuje się „WYBIERZ POSTAĆ” (`scripts/character_select.gd`): karta każdej postaci (portret rasy, poziom, kraina, data ostatniej gry), karta „+ NOWA POSTAĆ”, GRAJ, USUŃ POSTAĆ (z potwierdzeniem), krzyżyk wraca na tytuł. Przy jednej postaci gra wchodzi od razu, jak dotąd.
- **W grze.** MENU → ZMIEŃ POSTAĆ: zapisuje bieżącą, pozwala wybrać inną (wczytanie przez `restore_checkpoint`, z pobraniem krainy, gdy jej brak na urządzeniu; przy uszkodzonym zapisie zostaje bieżąca) albo założyć nową. Bieżącej postaci nie można usunąć z tego ekranu.
- **Chmura (do 1.12).** Zapis w chmurze był jeden na konto: autozapis wysyłał aktywną postać, więc ostatnio grana nadpisywała poprzednią. Zmienione w sekcji 36.
- **Testy:** `tests/characters_test.gd` 10/10 (dwie postacie, osobne sloty, przełączenie w grze, wybór na tytule, wejście wybranej); `smoke.gd -- --fresh` 543/543, `hud_mobile` 42/42, `gm_gameplay` 58/58, `menu_input` 11/11.
- **Wydanie treści 1.12** (`deliveries/godot-content-1.12`, zgoda właściciela 17.11.2026: „…i wtedy publikuj”): poprawki interfejsu (sekcja 34), minimapy z prawdziwego terenu (nowa paczka `minimaps`), zwalnianie klipów, teleport z mapy, wybór postaci. Zmienione względem 1.11 tylko `core-c100-2ee66bd376e4` i `minimaps-3c67ac08f7be`; pozostałe paczki bez zmian (te same sumy). Sprawdzone: `e2e_installed.py` PASS (rzeczywiste APK 1.0 pobiera rdzeń 1.12), `e2e_core.py` 0 błędów. Wycofanie: ponowna aktywacja 1.11.

### 36. Chmura: osobny zapis każdej postaci (17.11.2026) — wydanie 1.13 (przygotowane, niepublikowane)

Zgłoszenie właściciela: zapis w chmurze jest jeden na konto. Serwer od początku miał trzy sloty na konto (`/ws/godot/saves/1..3`, `saveRules` przepuszcza dodatkowe pola), klient używał tylko slotu 1. **Zmiana jest wyłącznie w kliencie (rdzeń), serwer bez zmian.**

- **Slot na postać.** Każda postać ma `cloudSlot` (1–3) w zapisie. Przy pierwszym wysłaniu dostaje pierwszy wolny slot (nie zajęty w chmurze ani przez inną postać z urządzenia). Autozapis i zapis ręczny wysyłają do slotu tej postaci; przełączenie postaci przełącza slot. Rewizje są liczone osobno dla każdego slotu (`user://cloud.json`: `revisions`; stary plik z jedną rewizją zostaje odczytany jako slot 1).
- **Limit.** Konto ma trzy sloty, więc w chmurze mieszczą się trzy postacie; czwarta i kolejne zostają tylko na urządzeniu (komunikat przy pierwszej próbie). Zwiększenie limitu wymaga zmiany serwera (stała slotów w `http.ts`, migracja bazy) — nie wykonane.
- **Logowanie / nowe urządzenie** (`gate_screen.reconcile_cloud`): zapis z chmury bez postaci na urządzeniu staje się postacią (po wejściu pojawia się wybór postaci); postać, której zapis w chmurze zmienił się gdzie indziej, pyta „użyć chmury / zachować z urządzenia” osobno dla tej postaci. Zapis sprzed slotów (1.12 i wcześniejsze): aktywna postać dostaje slot 1, jeśli rewizja się zgadza, inaczej pada stare pytanie.
- **Testy:** `tests/cloud_slots_test.gd` 11/11 (serwer w pamięci: cztery postacie → trzy w chmurze, każda we własnym slocie, czwarta tylko lokalnie, przełączanie zapisuje do właściwego slotu, nowe urządzenie dostaje trzy postacie, zapis sprzed slotów zostaje w slocie 1); schemat serwera przyjmuje `characterId`/`cloudSlot`; `smoke` 543/543, `hud_mobile` 42/42, `gm_gameplay` 58/58, `menu_input` 11/11, `characters_test` 10/10, `e2e_installed.py` PASS, `e2e_core.py` 0 błędów. Prawdziwego serwera z bazą (`e2e_online.py`) nie uruchamiałem (brak działającego PostgreSQL w tym środowisku).
