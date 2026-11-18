# Ilustracje wzorcowe — KI Legends

Status: **materiały referencyjne / koncepcje wizualne, NIE ukończone mapy ani gotowa topografia**.

## Pięć ilustracji przekazanych przez właściciela projektu 18.11.2026

1. **Aetheria — Sanktuarium Tysiąca Źródeł**: górskie miasto kaskadowo wznoszące się nad przepaścią, wielopoziomowe tarasy kamienne, pagody, schody, akwedukty, wodospady i turkusowe źródła; dolne miasto gościnne, tarasy nauki, górne sanktuarium, źródlany dziedziniec.
2. **Nexus-9 — Węzeł Świadomości**: futurystyczna metropolia na wyniesionym płaskowyżu, centralny turkusowy rdzeń energetyczny, hale transportowe, dolne warsztaty i doki, place przeładunkowe, górny taras administracyjny, trasy energetyczne i sieć połączeń.
3. **Verdantia — Zielona Przystań**: zielona osada nad szeroką rzeką, główny most, nabrzeże z łodziami, targ i dzielnica rzemieślnicza po jednej stronie, domy ogrodowe i sady po drugiej; naturalny las, skały i rwąca rzeka.
4. **Pyra — Twierdza Popiołu**: ciemna warownia na skalnych tarasach; wysoka cytadela i Plac Korony, targ przy bramie, Plac Węglowy, dolne kuźnie, schody wykute w skale, serpentyny dróg, rzeka lawy, bazaltowe kaniony i czerwony żar.
5. **Atlas czterech kontynentów**: Verdantia — lasy, rzeki, jeziora i góry; Aetheria — lodowce, ośnieżone łańcuchy i źródła; Nexus-9 — suche płaskowyże, góry, zbiorniki i techniczne kanały; Pyra — aktywne wulkany, kaldery, płynąca lawa, brunatno-czerwony bazalt i zatoki. Styl mapy: rysowany atlas fantasy z izometrycznymi wstawkami.

**Ilustracje wzorcowe:** pliki JPG z archiwum właściciela, zapisane bez zmian.

- [01_AETHERIA_Sanktuarium_Tysiaca_Zrodel.jpg](originaly/01_AETHERIA_Sanktuarium_Tysiaca_Zrodel.jpg)
- [02_NEXUS_9_Wezel_Swiadomosci.jpg](originaly/02_NEXUS_9_Wezel_Swiadomosci.jpg)
- [03_VERDANTIA_Zielona_Przystan.jpg](originaly/03_VERDANTIA_Zielona_Przystan.jpg)
- [04_PYRA_Twierdza_Popiolu.jpg](originaly/04_PYRA_Twierdza_Popiolu.jpg)
- [05_ATLAS_Cztery_Kontynenty.jpg](originaly/05_ATLAS_Cztery_Kontynenty.jpg)

## Priorytet projektowy: topografia wymaga stworzenia

**Topografia i pełna geometria kontynentów, archipelagów, wysp oraz wysepek na oceanach NIE są ukończone.** Istniejące mapy danych, obrysy i art służą jako źródło wymagań i ograniczeń, nie jako dowód gotowego świata.

Docelowo stworzyć:
- 4 kompletne kontynenty z ciągłą, spójną topografią; granice wybrzeży, wysokości, góry, przełęcze, rzeki, jeziora, biome transitions, drogi i obszary miast;
- 6 istniejących wysp fabularnych i dodatkowe mniejsze wyspy/wysepki w oceanach w logicznych archipelagach;
- system terenu skalowalny do Godot 4, z podziałem na segmenty i LOD/streamingiem; wygląd anime/JRPG, czytelny w kamerze 2.5D/izometrycznej;
- osobne warstwy: terrain, water/lava, structures, decor, navigation, collision, quests.

### Wymiary istniejących przestrzeni w jednostkach świata gry (NIE metrach)

| Kontynent | Szerokość | Wysokość |
|---|---:|---:|
| Verdantia | 77504 | 58560 |
| Aetheria | 70208 | 53440 |
| Pyra | 65600 | 42304 |
| Nexus-9 | 63168 | 49728 |

Źródło: `ports/godot-pyra/data/lands/{verdant,aether,pyra,nexus}/land.json`. Atlas globu `ports/godot-pyra/data/map.json` to przestrzeń atlasowa 2000×1000, **nie** wielkość gry w jednostkach kontynentu.

## Prototyp — plan i kryteria jakości

1. **Najpierw Pyra, NIE publikować bez weryfikacji.** Zbudować odrębny, uruchamialny projekt demonstracyjny Godot 4 z obszarem Twierdzy Popiołu oraz przynajmniej jednym fragmentem otaczającej doliny / lawy.
2. Trzymać się wzorca wizualnego: imponująca cytadela na klifie, co najmniej 3 poziomy zabudowy, brama, targ, kuźnie i przepływ lawy na dole; dobre proporcje i poprawne przejścia drogowe.
3. Dodatkowo prototyp generatora topografii i wybrzeży pozostałych kontynentów, 6 wysp fabularnych i wielu wysepek w oceanie, bez deklarowania finalnej jakości.
4. Zachować istniejące questy, położenie miast i kontrakty danych; nie zmieniać produkcyjnego APK, VPS, baz danych ani aktywnych paczek serwera.
5. **Nie usuwać/nie nadpisywać** materiałów na RunPod ani w repo. Działać na osobnej gałęzi, zapisywać wyniki z testów i zrzuty ekranu do przeglądu.
6. Generatory deterministyczne (seed), możliwość późniejszej podmiany placeholderów na assety wysokiej jakości.
7. Zgłosić, co jest placeholderem. Nie uznawać podstawowych brył za finalny art.

Agent Codex powinien potraktować to jako dokument wymagań i odczytać istniejące `land.json`, zanim zacznie prototypowanie.
