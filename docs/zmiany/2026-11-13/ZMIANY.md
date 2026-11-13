# Zmiany 2026-11-13

### 1. Wdrożenie: test przeglądu świata admina przekraczał limit czasu w CI

- Wdrożenie PR #159 (animacje Trybu KI 5B/5C, NPC Myśliwy i Alchemik) zatrzymał na `main` test
  `admin-world-overview` „maps combat objectives…”: przelicza wszystkie cele zadań wszystkich lądów, sam trwa ok. 3,5 s,
  a przy pełnym równoległym zestawie w CI przekroczył domyślne 5 s (ten sam kod przeszedł chwilę wcześniej w PR).
  Ryzyko było zapisane w dzienniku 12.11.2026.
- Poprawka: jawny limit 30 s dla tego jednego testu; jego sprawdzenia bez zmian.

### 2. Potwory: klatki przycięte do sylwetki (bez strat), 80 paczek

- Atlasy potworów przechowywały każdą klatkę w pełnej komórce 128 px; sylwetka zajmuje średnio ok. 1/3 komórki, reszta
  to przezroczyste tło. Nowe narzędzie `scripts/assets/trim_atlas_pack.py`: przycięcie do sylwetki (+1 px oryginalnego
  otoczenia, żeby krawędź przy skalowaniu mieszała się z tymi samymi sąsiadami), identyczne klatki zapisane raz, ciasne
  upakowanie, WebP bezstratny z zachowaniem koloru pod przezroczystością. Każda klatka jest odtwarzana w pełnym rozmiarze
  i porównywana ze starą (przezroczystość wszędzie, kolor wszędzie gdzie widoczny) — narzędzie przerywa przy różnicy.
- Wynik (pamięć tekstur): potwory anime `enemy-v3-*`, które gra pokazuje: **320 → 130 MiB** (8 → 2,4–4,4 MiB na
  potwora); starsze `enemy-v2-*` (dostępne przez `?ki-monsters-anime=0`): **1040 → 177 MiB**. Zestaw Mędrca z salamandrą
  (test budżetu strumieniowania): 98,36 → 93,93 MiB.
- Wykryty i naprawiony błąd po drodze: importer przy `--replace` przenosił paczkę na koniec rejestru, przez co stara
  wersja potworów (v2) zaczynała wygrywać z zaakceptowanymi potworami anime (v3). Przywrócono kolejność z `main`
  (skrypt porównał zwycięskie przypisania: 0 zmian), importer zachowuje teraz miejsce paczki (test w `gpu-pipeline`).
  Wcześniejsze wdrożenia nie były tym dotknięte (porównanie przypisań przed i po: tylko zamierzeni Myśliwy i Alchemik).
- Weryfikacja w silniku Phaser (te same klatki ze starego i nowego atlasu obok siebie): przy skali 1:1 maks. różnica
  5/255, przy 84 px i 168 px pojedyncze piksele do 14–19/255 (precyzja próbkowania karty, rozłożone po sylwetce, okiem
  nieodróżnialne). W grze: potwory v3 rysują się z przyciętych klatek, rozmiary wyświetlania bez zmian, 0 błędów.
- Bez zmian: bohaterowie (atlasy już przycięte: przepakowanie dałoby 2,5%), obrazy budynków i obiektów (przycięcie
  marginesów: ok. 14 MiB w całej grze, rozproszone), atlas obiektów lasu (przepakowanie: 2,2 MiB).

### 3. Bohaterowie: klatki zapisane w 200 px zamiast 256 px (decyzja właściciela)

- Właściciel zgodził się na zmniejszenie rozdzielczości klatek bohaterów (rozmiar na ekranie bez zmian). Nowe narzędzie
  `scripts/assets/downscale_hero_pack.py`: pełna komórka 256 px → 200 px (Lanczos, przezroczystość przemnożona),
  przycięcie i ciasne upakowanie, nazwy klatek i listy `mirrored` bez zmian. Kontrakt: `heroFrameCompact: 200`,
  importer dopuszcza komórkę 200 dla bohaterów i NPC.
- Paczki: Mędrzec 59,8 → 35,6 MiB (`3.2.0`), Planetar 56,5 → 33,2 (`3.3.0`), Android 60,7 → 36,0 (`3.2.0`), Legenda
  52,1 → 29,0 (`3.2.0`). Budżety światów (importer, z pamięcią terenu Verdantii): Verdantia 126,8 → 103,5,
  Aetheria 111,6 → 87,4, Nexus 103,5 → 78,8, Pyra 106,3 → 83,2 MiB.
- Sprawdzone: w grze u czterech ras bohater ma 133 × 133 na ekranie (jak przed zmianą), chód gra 8 klatek, 0 błędów;
  porównanie starej i nowej klatki w silniku w 133 i 200 px — ten sam rozmiar i położenie, bez widocznej różnicy.
  Przypisania grafik bez zmian (porównanie z `main`).
- Skrypty wycinania klipów (`fightform`, `kicombat`, `kiform`, `kiwalk`, `moveform`, `reactform`) mierzą zainstalowany chód
  w jednostkach 256 px (sprawdzone: wysokość i linia stóp zgodne ze starą paczką co do 0,7 px); nowe klipy przed
  importem przechodzą przez `downscale_hero_pack.py`. Test budżetu strumieniowania: zestaw Mędrca 93,93 → 85,08 MiB.
- Nie sprawdzono: wygląd na ekranach o gęstości 2× przy pełnym zbliżeniu (gra renderuje dziś w 1×).

### 4. Legenda: po śmierci postać znikała (zwykła forma)

- Własny przegląd wszystkich 36 klipów czterech ras (struktura, odtwarzanie w grze, plansza klatek każdego klipu) wykrył
  błąd istniejący od początku: w klipie `death` Legendy klatki 5–8 są prawie puste (kilka czerwonych drobin, 66–245 pikseli
  zamiast ok. 6000). Silnik zatrzymuje się na ostatniej klatce śmierci, więc martwa Legenda była niewidoczna. Ten sam
  stan w wersji sprzed optymalizacji z 13.11 — optymalizacje go nie spowodowały. Pozostałe rasy i klipy bez takich klatek
  (skan wszystkich klipów: tylko to jedno miejsce).
- Poprawka (paczka `3.2.1`): klatki 5–8 wskazują w atlasie tę samą ramkę co klatka 4 (leżąca poza), więc ciało zostaje
  widoczne po śmierci; nazwy klatek i obraz bez zmian. W grze: ostatnia klatka śmierci to leżąca Legenda, śmierć → wstawanie
  → stanie działa.
- Test `hero-clips-visible`: w każdym klipie każdej rasy (kierunki w prawo, w dół, w górę) żadna klatka nie może mieć
  mniej niż 20% pikseli mediany klipu. Na starej paczce Legendy pada (12 pustych klatek), na naprawionej przechodzi.
- Zakres własnej weryfikacji z tego dnia: struktura (36 klipów × 8 kierunków, każda klatka istnieje), odtwarzanie każdego
  stanu w formie zwykłej i KI (46 sprawdzeń na rasę), chód w 8 kierunkach i bieg, śmierć i wstawanie, wygląd klatek
  wszystkich klipów. Nie sprawdzono: tryb online z prawdziwą przemianą.

### 5. Androidy i Legendy: chód z przodu i z tyłu z filmów właściciela

- Filmy `art-wip/gemini-anim-stages/android-chod-przod-tyl.mp4` i `legend-chod-przod-tyl.mp4` (10 s, 24 kl./s) zastępują
  dotychczasowy chód z przodu i z tyłu obu ras. Każdy film pokazuje chód od przodu, potem od tyłu, powtórzony drugi raz;
  Android ma dodatkowo odcinek z lekkim obrotem 3/4 (twarz w lewo).
- `scripts/anim/walk_rebuild.py` obsługuje teraz `android` i `CELL=200` (paczki zapisane w komórce 200 px: nowe klatki są
  budowane na 256 px i skalowane w całości, pozostałe klatki paczki zostają bez zmian). Nowa zmienna `WALK_LOOPS`
  (`widok=klatka_startowa:okres`) ustawia pętlę kroku ręcznie, bo automatyczny wybór okresu na tych filmach trafia w złą
  wartość (Android z przodu: wybrał pętlę 44 klatek zamiast 35, czyli ze skokiem na złączeniu pętli). Okres mierzony z
  wysokości stóp (różnica najniższego piksela lewej i prawej połowy sylwetki zmienia znak co krok): Android przód 35 (start
  9), tył 32 (start 88), przód 3/4 28 (start 139); Legenda przód 29 (start 25), tył 31 (start 86).
- Mapowanie kierunków: Android: dół = przód, góra = tył, dół-lewo = przód 3/4 (bez lustra), dół-prawo = przód 3/4 z lustrem,
  góra-lewo i góra-prawo = tył (z lustrem); Legenda: jak dotąd z przodu i z tyłu. Boki (lewo, prawo) bez zmian. Idle
  (oddychanie) przeliczone z nowych klatek. Paczki bohaterów `3.3.0` (Android i Legenda), stare katalogi usunięte, pozycje
  paczek w rejestrze bez zmian.
- Własna weryfikacja: plansza klatek 8 kierunków × 8 klatek obu ras (rozmiar i ustawienie spójne, nogi się zmieniają,
  pętla zamknięta); w grze (Playwright, SwiftShader) chód we wszystkich 8 kierunkach: każdy kierunek gra własne klatki
  `walk/<kierunek>` (boczne w lewo: klatki `right` z flipX), bez błędów w konsoli; zrzuty ekranu Androida i Legendy
  z przodu, z tyłu i po skosie. Testy `hero-clips-visible`, `gpu-pipeline`, `actor-animation`, `stream-texture-budget`
  przechodzą. Nie sprawdzono: tryb online z prawdziwą przemianą, ostrość przy DPR 2×.
- Nadal brakuje: chód NPC, osobny film chodu Mędrca, osobny klip umiejętności A (jest jeden wspólny `skill`).
