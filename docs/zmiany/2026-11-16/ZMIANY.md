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
- **Nie zrobione:** grafika 10 zwierząt i ikony 10 produktów (brak wygenerowanych zasobów, zastępczych nie wstawiałem), dźwięki zwierząt. Do tego czasu zwierzęta nie pojawiają się w grze.
  Zmiana nie jest wydana graczom: dojdzie przez rdzeń z serwera po opublikowaniu nowego wydania treści (za zgodą właściciela).

### 18. Android / Godot 0.12.0-intro: ikona z logo i film wejściowy właściciela

Zlecenie właściciela: dostarczone logo ma być ikoną aplikacji, a film (10 s, 1280×720, 24 kl./s, dźwięk) animacją wejścia i ładowania gry.

- **Ikona.** Logo (1254²) jest ikoną dla wszystkich warstw Androida: `icon.png` (cały obraz), `icon-foreground.png` (logo na 78 % pola, żeby całe godło mieściło się w kole 66 % pokazywanym przez launcher),
  `icon-background.png` (rozmyte kolory tego samego logo) i `icon-monochrome.png` (jasne części godła jako biała sylwetka, dla ikon motywowanych). Wygląd w kole sprawdzony na podglądzie; **nie sprawdzono na telefonie**
  (launchery różnie maskują ikony). Ekran startowy systemu (boot splash) nie został zmieniony.
- **Film.** Godot odtwarza tylko Ogg Theora, więc film zamieniono na `intro.ogv` (libtheora q7, Vorbis; 10,05 MB; podobieństwo do oryginału SSIM 0,975) i zapisano ostatnią klatkę (`intro-last.webp`).
  Odtwarza go scena startowa (`boot.gd`): pełny ekran z dopasowaniem „cover” (na bardzo szerokich telefonach przycina górę i dół obrazu), dźwięk wg głośności muzyki z ustawień (domyślnie 48 %),
  dotknięcie po 0,8 s pomija film, po jego końcu zostaje ostatnia klatka z napisem „TOUCH TO START” z filmu i dotknięcie uruchamia grę bez drugiego przycisku; w tym czasie pod spodem trwa sprawdzanie aktualizacji
  (mały pasek stanu u góry, a przy uszkodzonej aktualizacji komunikat). Bez filmu (headless, testy, brak pliku) wszystko działa jak wcześniej.
- **Rozmiar i uwagi.** APK 82,5 MB (było 66,8 MB): film 10 MB i grafiki ikon. Film ma w sobie wklejony pasek „LOADING” i napis „TOUCH TO START” po angielsku; pasek nie odzwierciedla prawdziwego ładowania, tylko zdarzenia
  filmu. Wydajność odtwarzania 720p Theora na prawdziwych telefonach nie była mierzona (test natywny w programowym renderze: obraz poprawny, odtwarzanie wolniejsze niż czas rzeczywisty z powodu emulacji GPU).
- **Kontrole.** `tests/smoke.gd` **530/530** (film i klatka są w grze, głośność, reguła startu po filmie), `scripts/godot/e2e_core.py` 11/11 na nowej scenie startowej, test natywny `tests/qa_intro.gd` (zrzuty ekranu).
  Dostawa: `deliveries/godot-pyra-android-20261116-intro` (wersja 0.12.0-intro, kod 12).

