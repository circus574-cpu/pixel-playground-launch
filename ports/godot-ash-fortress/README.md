# Twierdza Popiołu — prototyp układu

Otwórz `project.godot` w Godot 4.6.3 i uruchom scenę klawiszem F6 lub projekt klawiszem F5. Ruch obsługują WASD, strzałki i dotknięcie nawierzchni. Tab lub przycisk „Zmień widok” przełącza widok całej twierdzy i kamerę śledzącą.

```sh
godot --headless --editor --import --path .
godot --headless --path . -- --test-route
godot --path . -- --capture
```

Próba obejmuje trasę od bramy przez targ do Placu Korony oraz zejście do dolnych kuźni. Test sprawdza zmianę wysokości, przejście schodami, obrysy budynków i niedostępną krawędź lawy. Część obiektów i sylwetka klifów służą do oceny układu przestrzennego przed wykonaniem oprawy anime/JRPG.

Tekstury bazaltu, popiołu i lawy powstały na NVIDIA A40 z użyciem PyTorch/CUDA i ziarna 20261118. Projekt grupuje obiekty w sekcje sceny i odłącza dalsze sekcje w widoku z bliska. Profil wydajności na fizycznym Androidzie i strumieniowanie zasobów z dysku są nadal do wykonania.

## Topografia

`python topography.py ../godot-pyra/data topography` wymaga biblioteki Pillow. Tworzy podgląd atlasu, manifest z oryginalnymi wymiarami, obrysami i osadami oraz pliki wysokości dzielone na kafle 64 × 64 próbek atlasu. Zachowuje sześć wysp fabularnych i dodaje testowe archipelagi na osobnej warstwie. Dane te nie są jeszcze podłączone do gry.

## Wyniki z 18.11.2026

Godot 4.6.3 zaimportował projekt i zaliczył test trasy. Materiały powstały na A40, a zrzut Godot wykonano przez Mesa llvmpipe na tym samym podzie. Wygenerowano 4 kontynenty, 6 wysp fabularnych i 8 testowych archipelagów.

- [Scena Pyry](qa/podglad-pyry.png)
- [Atlas wysokości](qa/atlas-preview.png)
- [Próby materiałów](qa/podglad-materialow.jpg)
- [Manifest topografii](qa/manifest-topografii.json)
