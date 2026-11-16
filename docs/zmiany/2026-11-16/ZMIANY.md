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
