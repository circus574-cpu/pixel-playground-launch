# 2026-11-11

### 1. Mapa 2D i globus: zapętlone przesuwanie, brak kwadratów, punkt gracza, ostrość

Na zgłoszenie właściciela z nagrań ekranu (Intel UHD, Chromium): na mapie 2D nie da się przesuwać poza krawędź kontynentu, przy przybliżeniu widać jasne prostokąty, globus pokazuje „Tu jesteś" bez punktu i nie wyostrza się przy przybliżaniu.

- Przesuwanie mapy 2D zapętla się w poziomie: `clampView` zawija `cx` (`wrapX`), animacje wybierają krótszą drogę (`nearestX`), a `PlanetMap` rysuje kopie warstw mapy dla widocznego zakresu (`wrapCopies`; jedna kopia, gdy cała mapa mieści się w oknie). Pion nadal kończy się na biegunach. Radialna winieta przeniesiona z SVG na `.pm-viewport::after`, żeby nie tworzyła szwu na linii zawinięcia. Sprawdzone w Chromium: widok przechodzi z x≈177 przez krawędź na x≈1235, a przy szwie rysowana jest kopia −1.
- Kwadraty przy przybliżeniu: to jasne prostokąty stref bezpiecznych miast (20% bieli) wypalone w `map-hi.webp` przez `scripts/worldgen/v2/render_v2_maps.py`. Skrypt nie nakłada ich już na mapy szczegółowe (`MAP_SAFE_TINT`: domyślnie wyłączone dla `MAP_UPSAMPLE>1`, jawnie `0` dla wysp). Odtworzenie najpierw dało obrazy identyczne z zatwierdzonymi (różnica 0), potem zregenerowano 4 kontynenty (`MAP_WIDTH=8192 MAP_SUFFIX=-hi MAP_UPSAMPLE=2`) i 6 wysp (domyślne ustawienia). `map.webp` (mapa podstawowa) bez zmian.
- Globus: `MapaView` przekazuje `focus` do `PlanetGlobe`; punkt gracza (złota kropka z poświatą) liczony przez `worldToAtlas` i `mapToSphere`, rzutowany jak pozostałe znaczniki (`MarkerProjector`). Sprawdzone w Chromium z testowym parametrem (usunięty przed commitem).
- Ostrość globusa: komputery oceniane jako słabsze (`cores <= 4` albo mało pamięci) nie dostawały nigdy tekstury 3840 px. Teraz ładują ją, gdy kamera zbliży się poniżej 75% dystansu otwarcia (`hiResOnZoom`); telefony nadal nie.
- Testy: nowe w `src/test/planet-map.test.ts` (zapętlenie, `wrapX`, `nearestX`, `wrapCopies`) i `src/test/planet-globe.test.ts` (`hiResOnZoom`).
- Nie zrobiono / nie sprawdzono: ostrość mapy 2D przy dużym zbliżeniu zależy od rozdzielczości `map-hi.webp` (3985×3011 px na kontynent przy zbliżeniu do 2200%) i pozostaje rozmyta; po stronie zawinięcia widać słaby szew jasności atlasu; ostrość globusa na słabym komputerze nie była sprawdzana (środowisko testowe ma mocniejszy procesor).

### 2. Przyciski umiejętności: przesuwanie także na komputerze

- Zgłoszenie właściciela: brak możliwości zmiany położenia przycisków umiejętności. Edytor układu (`ControlEditor`, „Przesuń przyciski”) i style `--ctl-*` działały na wszystkich urządzeniach, ale sekcja ustawień z przyciskiem była pokazywana tylko na ekranie dotykowym (`touchJoystick`).
- Sekcja „Przyciski umiejętności” (suwaki wielkości i „Przesuń przyciski”) jest teraz widoczna także na komputerze; suwak joysticka tylko na dotyku (`src/components/game/GameHud.tsx`). Zapis układu bez zmian (`ui-preferences`, `controls.buttons`).
- Nie sprawdzono w przeglądarce: ekran gry wymaga zalogowanej postaci, której środowisko testowe nie ma; zmiana to wyłącznie warunek wyświetlania istniejącego edytora, który nie ma testu jednostkowego.
