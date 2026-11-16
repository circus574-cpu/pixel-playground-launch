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
