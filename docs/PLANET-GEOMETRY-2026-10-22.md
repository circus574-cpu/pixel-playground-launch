# Geometria planety Superior — 22.10.2026

Decyzja właściciela: główne miasta czterech ras mają być od siebie oddalone o **80 000 jednostek**, a atlas, globus i minimapa mają zgadzać się z tym matematycznie. Krajobraz nie jest tworzony: kontynenty i wyspy są wycinane z oryginalnego malowanego atlasu po istniejących obrysach.

## Matematyka

- Cztery miasta tworzą **czworościan foremny na kuli**. Tylko taki układ daje równą odległość każdej pary. Odległość kątowa to acos(−1/3) = 109,47°, więc promień planety wynosi **R = 80 000 / 1,9106 = 41 870,9 j.**, obwód 263 083 j.
- Przy równiku 1 jednostka atlasu (2000×1000) to 131,54 j. gry.
- Miasta: Aetheria 61°E/35,26°N, Verdantia 119°W/35,26°N, Pyra 29°W/35,26°S, Nexus-9 145°E/35,26°S (czworościan obrócony o 16°, aby żaden kontynent nie przeciął szwu atlasu).
- Sześć wysp questowych leży w środkach sześciu krawędzi czworościanu, po 40 000 j. od dwóch miast: I biegun północny, VI biegun południowy, II 16°E/0°, III 106°E/0°, IV 164°W/0°, V 74°W/0°.
- Kontynenty i wyspy są zmniejszone do **0,5** oryginału i rzutowane azymutalnie równoodległościowo wokół swojego centrum (rozmiary i odległości od centrum są prawdziwe). Przy 0,5 kontynenty mają około 40–48 tys. × 23–30 tys. j. i mieszczą się między miastami.

## Pliki

- `src/game/world/planet.json` (generowany) i `planet.ts`: stałe, odległości, `sourceToPlanet`.
- `scripts/relayout_planet.py`: buduje nowy atlas, obrysy (`atlasRegions.json`) i `planetLayout.json` z `art/production/planet/atlas-source-3840.webp` oraz `atlasRegions.source.json`. Następnie `scripts/build_globe_textures.py` odtwarza tekstury globusa. Wymaga numpy, Pillow, opencv-python-headless, scipy.
- Minimapy i podglądy w menu (`scripts/build_atlas_minimaps.py`) pochodzą nadal z oryginalnego atlasu (bez zniekształcenia biegunowego); pozycje stref na mapie i globusie przelicza `sourceToPlanet`.
- Testy: `src/test/planet.test.ts` (80 000 między każdą parą, 40 000 wysp, rozmiary, brak nakładania), `open-world.test.ts`, `planet-globe.test.ts`.

## Ograniczenia

- Wyspy I i VI leżą na biegunach: na płaskim atlasie to pasy przy górnej i dolnej krawędzi (na globusie normalne wyspy).
- Tło oceanu pod wycięciami jest wypełniane z głębokiej wody atlasu; widać delikatne plamy. Chmury w rogach zostały.
- Zapowiedziane: cztery miasta na kontynent; na razie na kontynencie jest jedno miasto (z czterema strefami).
