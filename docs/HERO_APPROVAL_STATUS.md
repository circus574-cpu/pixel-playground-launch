# Ki Legends — osobna akceptacja bohaterów

Obowiązująca kolejność ustalona przez użytkownika: bohaterowie czterech ras, osobna akceptacja każdej rasy, potem animacje, NPC/przeciwnicy, a następnie dopasowanie otoczenia. Nowe plansze dostarczone przez użytkownika są referencją **miast**, nie postaci.

## Planetarni — wzorzec 01: ZAAKCEPTOWANY

![Wzorzec Planetarnego](qa/hero-planetary-v1/approval-board.png)

To jeden nowo wygenerowany na RTX A6000 wzorzec wyglądu, nie działająca animacja ani screenshot gry. Oparty na oryginalnej tożsamości Planetarnego z dokumentacji/projektu Ki Legends: atletyczny dorosły bohater, brązowe włosy, bursztynowy szal, jasna tunika, skórzane pasy i ciemne bojowe rękawice. Nie wykorzystuje postaci z nowych plansz miast.

- Źródło: `art/production/heroes/planetary/v1/sources/planetary-master.png`, Git LFS.
- Workflow, seed, model i sumy: sąsiedni `planetary-master.json`.
- Model: Animagine XL 3.1, dokładny revision/SHA-256 i licencja w `art/production/city-v1/model-source.json` oraz `MODEL_LICENSE.txt`. Nie pobierano kolejnego modelu dla bohatera.
- Czas tego rzeczywistego zadania ComfyUI: **10.12 s**. Nie jest to pomiar gotowych animacji.
- [Master RGBA 512](qa/hero-planetary-v1/planetary-design-master-512.png), [podgląd 128](qa/hero-planetary-v1/planetary-scale-128.png), [manifest wyników](qa/hero-planetary-v1/review-manifest.json).
- Miniatury 60 i 46 px obrazują rozmiar canvasu 96 jednostek przy zoomie 0.62 i 0.48. To podgląd czytelności, bez deklaracji testu w grze.
- Usunięcie tła i przygotowanie przezroczystego canvasu wykonano lokalnie na CPU. Oryginalny render pozostaje zachowany.
- **Nie zainstalowano bohatera w runtime, nie wygenerowano jego animacji i nie opublikowano zmiany.**

## Dalsze bramki

| Rasa | Status |
| --- | --- |
| Planetarni / Verdantia | Wzorzec zaakceptowany; użytkownik zlecił pełne wykonanie tej rasy |
| Mędrcy / Aetheria | Wstrzymani; najpierw kompletna rasa Planetarnych |
| Androidy / Nexus-9 | Nie rozpoczęto |
| Legendy / Pyra | Nie rozpoczęto |

Po zatwierdzeniu czterech wzorców powstają spójne modele/rig i rzeczywiste animacje ośmiokierunkowe. Nie tworzyć ich przez wycinanie ilustracji ani niezależne losowanie kolejnych klatek. Punkt stóp, proporcje i identyfikacja wyposażenia muszą przejść kontrolę na pełnym zestawie ruchów, zanim nastąpi produkcja wszystkich klatek.

## Zabezpieczona wcześniejsza praca i koszt GPU

Dotychczasowe źródła otoczenia, sceny `.blend`, metadane i 32 klatki KI pozostają w Git LFS na `feat/gpu-city-assets-20261020`. Integracja miast została wstrzymana zgodnie ze zmianą priorytetu. Niedokończony mechanizm podglądu zachowano na osobnej gałęzi `wip/city-preview-rollout-20261020`, commit `d20167e` (pełny TypeScript oraz 9/9 testów importu przeszły; nie uruchomiono pełnego E2E ani publikacji tej gałęzi).

Dostępny terminal pozwala generować i zabezpieczać pliki. Odczyt sterującego API RunPod zwrócił **403**, również po ponowieniu z nagłówkiem przeglądarki; samo istnienie zmiennej API nie oznacza działających uprawnień. Nie wykonano Stop/Terminate ani zmiany konfiguracji poda. Po ukończeniu i zabezpieczeniu wzorca GPU nie jest potrzebne do oczekiwania na akceptację; zatrzymanie wynajmu wymaga obecnie panelu użytkownika. Pod nadal działa, dopóki nie zostanie zatrzymany w panelu. Nie kasować woluminu.

## Akceptacja użytkownika

Użytkownik zaakceptował przedstawiony wzorzec słowami „Jest dobrze startuj z tworzeniem tej rasy kompletnie”. Aktywny zakres: kompletny Planetarny, bez rozpoczynania innych ras. Rozpoczęto budowę modelu i riga z licencjonowanej bazy anatomicznej CC0, własnym strojem i geometrią włosów; animacje będą pochodzić z jednego modelu, bez wycinania ilustracji. Późniejszy wpis o akceptacji zastępuje wcześniejszy status oczekiwania w zachowanych metadanych historycznego wzorca.
