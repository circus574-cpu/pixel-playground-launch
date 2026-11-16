# Prompty: 10 łagodnych zwierząt i 10 ikon jedzenia (system jedzenia, 16.11.2026)

Ten plik to jedyne źródło promptów do grafik systemu jedzenia (opis zasad i liczb: `docs/ROZWOJ-I-WALKA.md`, sekcja „Jedzenie i regeneracja życia”; dane: `ports/godot-pyra/data/food.json`).
Do wygenerowania są **10 plansz zwierząt** (po jednej na zwierzę) i **10 ikon produktów**. Plansze wszystkich 10 zwierząt i ikony są dostarczone i wgrane do gry (`scripts/godot/prepare_animals.py`).

## Skąd styl (żeby nowe zwierzęta wyglądały jak potwory)

Potwory z bestiariusza (40) mają ręcznie malowany styl anime-fantasy z grubymi ciemnymi konturami. Według `docs/GPU-I-ZASOBY.md` (sekcja „Potwory w stylu anime”, 02.11.2026) plansze potworów
**wygenerował właściciel w zewnętrznym generatorze**, a do klatek pociął je skrypt `scripts/gpu/ingest_creature_sheet.py` (w historii Git jako jeden import z 06.11.2026, autor wpisu „Qwen Code”).
W porcie Godot **nic z potworów nie powstało na nowo**: skrypt `scripts/godot/prepare_monsters.py` tylko skopiował istniejące arkusze i przypisał im reguły; od strony gry doszło odtwarzanie klipów i ruch.
Wzorcowa plansza: `public/game/assets/gpu/enemy-v3-verdant-skalny-jelen/1.1.0-2a4b678447e5/source-sheet.jpg` (2000×1493). Nowe zwierzęta mają wyglądać tak samo: ta sama kreska, ten sam sposób cieniowania, to samo tło.

## Format planszy zwierzęcia (zgodny z `ingest_creature_sheet.py`)

- Jeden obraz, proporcje 4:3 (np. 2000×1500), siatka **4 kolumny × 3 rzędy**, w każdej komórce jedna poza całego zwierzęcia. Komórki nie mają ramek ani linii.
- Widok **ściśle z boku (profil), zwierzę zwrócone w PRAWO**, w każdej klatce ten sam wygląd, ta sama skala, wyśrodkowane w komórce, zajmuje ok. 75–80 % wysokości komórki, nic nie wychodzi poza komórkę.
- Tło czysta biel `#FFFFFF`, **bez cienia pod zwierzęciem, bez podłoża, bez napisów**. Jasne futro lub pióra muszą mieć ciemny kontur (skrypt usuwa jasne tło właśnie dzięki konturowi).
- Rząd 1: **chód** (4 klatki cyklu, pętla). Rząd 2: **ucieczka** (4 klatki szybkiego biegu lub lotu przy ziemi; zwierzęta nie atakują, więc ten rząd zastępuje „atak” z plansz potworów).
  Rząd 3: **upadek** (4 klatki: zachwianie, przewrócenie się, leżenie, całkowity bezruch; łagodnie, bez krwi i okrucieństwa).
- Skrypt cięcia: `python3 scripts/gpu/ingest_creature_sheet.py <plansza> <id> [--no-effects]`; `--no-effects` dla latających i szerokich (Bażant Żarowy, Gołąb Pergaminowy). Dla zwierząt rząd 2 trafia w slot „ataku” (potem klip `flee`).
- Nazwy plików: `zwierze-A-01.png` … `zwierze-A-10.png`. Id w danych: `A-01`…`A-10`.

## Zwierzęta: pełne, samodzielne prompty (wersja z 16.11.2026)

Każdy prompt jest kompletny i wkleja się go w całości; nie ma w nim odwołań do wspólnych bloków. Poprawki względem pierwszej wersji: stała skala i wspólna linia podłoża (zwierzę nie zmienia rozmiaru między klatkami), ciemny kontur także wokół jasnych części (brak białych obwódek po wycięciu tła), A-09 i A-10 jako osobne zwierzęta, a nie przemalowane A-01 i A-02. Zaakceptowane plansze wszystkich 10 zwierząt są w `art/production/animals/`.

### A-01 Zając Łąkowy (Verdantia, S)
```
Hand-painted anime-fantasy JRPG creature sprite sheet in the style of a game bestiary. Canvas 4:3 (2000x1500 px), strict grid of 4 columns by 3 rows = 12 equal cells, one full-body pose of the SAME single animal per cell, no cell borders, no grid lines. Strict side profile, the animal faces RIGHT in every pose. Thick clean dark-brown outline (about 3 px) around the whole silhouette, including light parts, soft cel shading, rich natural colors. Identical design, colors and scale in all 12 cells: do not resize the animal between poses. In every cell all feet rest on the same invisible ground line at 85% of the cell height (jump poses keep the same reference), body centered horizontally, at least 8% empty margin, nothing crosses into a neighbouring cell. Pure flat white #FFFFFF background everywhere: no shadow, no ground, no glow, no particles, no motion lines, no text, no numbers, no watermark. The animal is peaceful and gentle, never aggressive, no blood.
The animal: a large meadow hare. Golden-brown fur, white belly and white tail tuft, very long upright ears with delicate green leaf-vein patterns on the tips, a small tuft of green moss on the back, bright amber eye, big strong hind legs, slim body. Body length about 65% of the cell width.
Row 1, walk cycle, 4 frames: relaxed hopping gait. Frame 1 hind legs planted and front legs reaching, frame 2 front legs landing, frame 3 hind legs pushing off, frame 4 body gathered before the next hop. The last frame leads smoothly into the first.
Row 2, flee cycle, 4 frames: panicked fast run with huge bounds, ears flat back along the body. Frame 1 gathered crouch, frame 2 body fully stretched in the air, frame 3 landing on the front legs, frame 4 hind legs swinging forward.
Row 3, fall, 4 frames: gentle stagger, tumbles onto its side, lies on its side with legs loosely bent, completely still. Frames 3 and 4 are almost the same.
```

### A-02 Kura Leśna (Verdantia, S)
```
Hand-painted anime-fantasy JRPG creature sprite sheet in the style of a game bestiary. Canvas 4:3 (2000x1500 px), strict grid of 4 columns by 3 rows = 12 equal cells, one full-body pose of the SAME single animal per cell, no cell borders, no grid lines. Strict side profile, the animal faces RIGHT in every pose. Thick clean dark-brown outline (about 3 px) around the whole silhouette, including light parts, soft cel shading, rich natural colors. Identical design, colors and scale in all 12 cells: do not resize the animal between poses. In every cell all feet rest on the same invisible ground line at 85% of the cell height (jump poses keep the same reference), body centered horizontally, at least 8% empty margin, nothing crosses into a neighbouring cell. Pure flat white #FFFFFF background everywhere: no shadow, no ground, no glow, no particles, no motion lines, no text, no numbers, no watermark. The animal is peaceful and gentle, never aggressive, no blood.
The animal: a forest hen. Mottled dark olive-brown plumage with moss-green tips on the wing and tail feathers, small red comb and wattle, sturdy yellow legs, round alert dark eye, plump body, tail feathers fanned slightly upward. Body length about 60% of the cell width.
Row 1, walk cycle, 4 frames: pecking strut with head bobbing. Frame 1 head forward and one foot lifted, frame 2 head pulled back, frame 3 other foot lifted, frame 4 head forward again. Loops smoothly.
Row 2, flee cycle, 4 frames: running with wings half spread and flapping, neck stretched forward. Frame 1 wings up, frame 2 wings mid-way, frame 3 wings down, frame 4 wings mid-way again. A few loose feathers are allowed but nothing outside the cell.
Row 3, fall, 4 frames: stumbles with wings flailing, tips over, lies on its side with ruffled feathers, completely still. Frames 3 and 4 are almost the same.
```

### A-03 Dzik Mchowy (Verdantia, M)
```
Hand-painted anime-fantasy JRPG creature sprite sheet in the style of a game bestiary. Canvas 4:3 (2000x1500 px), strict grid of 4 columns by 3 rows = 12 equal cells, one full-body pose of the SAME single animal per cell, no cell borders, no grid lines. Strict side profile, the animal faces RIGHT in every pose. Thick clean dark-brown outline (about 3 px) around the whole silhouette, including light parts, soft cel shading, rich natural colors. Identical design, colors and scale in all 12 cells: do not resize the animal between poses. In every cell all feet rest on the same invisible ground line at 85% of the cell height (jump poses keep the same reference), body centered horizontally, at least 8% empty margin, nothing crosses into a neighbouring cell. Pure flat white #FFFFFF background everywhere: no shadow, no ground, no glow, no particles, no motion lines, no text, no numbers, no watermark. The animal is peaceful and gentle, never aggressive, no blood.
The animal: a calm stocky forest boar. Charcoal-grey bristly hide, thick green moss and tiny red mushrooms growing along its spine, short blunt cream tusks, small gentle dark eyes, heavy rounded body, short thick legs. Body length about 75% of the cell width.
Row 1, walk cycle, 4 frames: slow heavy trot, diagonal legs moving together, head slightly lowered, moss on the back swaying a little. Loops smoothly.
Row 2, flee cycle, 4 frames: clumsy fast gallop with head low. Frame 1 front legs reaching, frame 2 all legs gathered under the body, frame 3 hind legs pushing, frame 4 landing on the front legs.
Row 3, fall, 4 frames: knees buckle, the heavy body sinks, rolls onto its side, lies still. Frames 3 and 4 are almost the same.
```

### A-04 Koza Skalna (Pyra, M)
```
Hand-painted anime-fantasy JRPG creature sprite sheet in the style of a game bestiary. Canvas 4:3 (2000x1500 px), strict grid of 4 columns by 3 rows = 12 equal cells, one full-body pose of the SAME single animal per cell, no cell borders, no grid lines. Strict side profile, the animal faces RIGHT in every pose. Thick clean dark-brown outline (about 3 px) around the whole silhouette, including light parts, soft cel shading, rich natural colors. Identical design, colors and scale in all 12 cells: do not resize the animal between poses. In every cell all feet rest on the same invisible ground line at 85% of the cell height (jump poses keep the same reference), body centered horizontally, at least 8% empty margin, nothing crosses into a neighbouring cell. Pure flat white #FFFFFF background everywhere: no shadow, no ground, no glow, no particles, no motion lines, no text, no numbers, no watermark. The animal is peaceful and gentle, never aggressive, no blood.
The animal: a sturdy mountain goat. Ash-grey and rust-red coat, long white beard, curved dark horns with a faint ember-orange tint at the tips, black split hooves, a few tiny ember-orange specks in the fur painted as part of the fur (no separate particles). Body length about 70% of the cell width.
Row 1, walk cycle, 4 frames: confident sure-footed steps, head level, beard swaying. Loops smoothly.
Row 2, flee cycle, 4 frames: leaping bounds. Frame 1 gathered, frame 2 front legs stretched forward in the air, frame 3 all hooves tucked, frame 4 landing on the front hooves.
Row 3, fall, 4 frames: legs fold, tips onto its side, lies on its side with horns resting, completely still. Frames 3 and 4 are almost the same.
```

### A-05 Jaszczur Popielny (Pyra, S)
```
Hand-painted anime-fantasy JRPG creature sprite sheet in the style of a game bestiary. Canvas 4:3 (2000x1500 px), strict grid of 4 columns by 3 rows = 12 equal cells, one full-body pose of the SAME single animal per cell, no cell borders, no grid lines. Strict side profile, the animal faces RIGHT in every pose. Thick clean dark-brown outline (about 3 px) around the whole silhouette, including light parts, soft cel shading, rich natural colors. Identical design, colors and scale in all 12 cells: do not resize the animal between poses. In every cell all feet rest on the same invisible ground line at 85% of the cell height (jump poses keep the same reference), body centered horizontally, at least 8% empty margin, nothing crosses into a neighbouring cell. Pure flat white #FFFFFF background everywhere: no shadow, no ground, no glow, no particles, no motion lines, no text, no numbers, no watermark. The animal is peaceful and gentle, never aggressive, no blood.
The animal: an ash lizard, big and clearly readable: the body is large in the cell (length about 85% of the cell width, height about 40% of the cell height), do not draw it tiny. Charcoal-grey scaled body, dull orange-red patches between the scales painted into the skin, a long thick tail, broad flat head, small calm yellow eyes, strong short legs with clawed toes.
Row 1, walk cycle, 4 frames: low side-to-side lizard crawl, diagonal legs moving together, the tail swaying in an S shape. Loops smoothly.
Row 2, flee cycle, 4 frames: fast skittering run with the body raised on straight legs, tail stretched out behind. Legs in a different phase in each frame.
Row 3, fall, 4 frames: legs give way, flops flat, goes limp with the tail last, lies still. Frames 3 and 4 are almost the same.
```

### A-06 Bażant Żarowy (Pyra, S)
```
Hand-painted anime-fantasy JRPG creature sprite sheet in the style of a game bestiary. Canvas 4:3 (2000x1500 px), strict grid of 4 columns by 3 rows = 12 equal cells, one full-body pose of the SAME single animal per cell, no cell borders, no grid lines. Strict side profile, the animal faces RIGHT in every pose. Thick clean dark-brown outline (about 3 px) around the whole silhouette, including light parts, soft cel shading, rich natural colors. Identical design, colors and scale in all 12 cells: do not resize the animal between poses. In every cell all feet rest on the same invisible ground line at 85% of the cell height (jump poses keep the same reference), body centered horizontally, at least 8% empty margin, nothing crosses into a neighbouring cell. Pure flat white #FFFFFF background everywhere: no shadow, no ground, no glow, no particles, no motion lines, no text, no numbers, no watermark. The animal is peaceful and gentle, never aggressive, no blood.
The animal: an ember pheasant. Copper-red and orange plumage, a long tail with orange-yellow tips, bright red face wattle, dark eye with a gold ring, slender legs. The whole bird including the tail and spread wings must fit inside its cell with margin (body length about 60% of the cell width in the standing pose, the tail counts in that length).
Row 1, walk cycle, 4 frames: elegant strut with a bobbing head, tail held level, wings folded. Loops smoothly.
Row 2, flee cycle, 4 frames: low flapping hops just above the ground, wings wide open but fully inside the cell, tail trailing. Frame 1 wings up, frame 2 wings spread level, frame 3 wings down, frame 4 wings spread level.
Row 3, fall, 4 frames: drops, wings loosen, lies on its side with the tail fanned out, completely still. Frames 3 and 4 are almost the same.
```

### A-07 Owca Księżycowa (Aetheria, M)
```
Hand-painted anime-fantasy JRPG creature sprite sheet in the style of a game bestiary. Canvas 4:3 (2000x1500 px), strict grid of 4 columns by 3 rows = 12 equal cells, one full-body pose of the SAME single animal per cell, no cell borders, no grid lines. Strict side profile, the animal faces RIGHT in every pose. Thick clean dark-brown outline (about 3 px) around the whole silhouette, including the white wool, soft cel shading, rich natural colors. Identical design, colors and scale in all 12 cells: do not resize the animal between poses. In every cell all feet rest on the same invisible ground line at 85% of the cell height (jump poses keep the same reference), body centered horizontally, at least 8% empty margin, nothing crosses into a neighbouring cell. Pure flat white #FFFFFF background everywhere: no shadow, no ground, no glow, no particles, no motion lines, no text, no numbers, no watermark. The animal is peaceful and gentle, never aggressive, no blood.
The animal: a moon sheep. Fluffy pale silver-blue wool with soft light-blue shading so it never merges with the white background, curled pearl-grey horns, a gentle face with a small crescent mark on the forehead, dark hooves, a few tiny star-shaped sparkles painted on the wool (part of the wool, no separate particles). Body length about 70% of the cell width.
Row 1, walk cycle, 4 frames: calm soft steps, wool swaying slightly. Loops smoothly.
Row 2, flee cycle, 4 frames: a bouncing trot, wool bouncing, head up. Legs in a different phase in each frame.
Row 3, fall, 4 frames: kneels, lowers the body, lies down on its side as if falling asleep, completely still. Frames 3 and 4 are almost the same.
```

### A-08 Gołąb Pergaminowy (Aetheria, S)
```
Hand-painted anime-fantasy JRPG creature sprite sheet in the style of a game bestiary. Canvas 4:3 (2000x1500 px), strict grid of 4 columns by 3 rows = 12 equal cells, one full-body pose of the SAME single animal per cell, no cell borders, no grid lines. Strict side profile, the animal faces RIGHT in every pose. Thick clean dark-brown outline (about 3 px) around the whole silhouette, including light parts, soft cel shading, rich natural colors. Identical design, colors and scale in all 12 cells: do not resize the animal between poses. In every cell all feet rest on the same invisible ground line at 85% of the cell height (jump poses keep the same reference), body centered horizontally, at least 8% empty margin, nothing crosses into a neighbouring cell. Pure flat white #FFFFFF background everywhere: no shadow, no ground, no glow, no particles, no motion lines, no text, no numbers, no watermark. The animal is peaceful and gentle, never aggressive, no blood.
The animal: a parchment dove. Cream and warm tan parchment-coloured feathers with faint brown ink-script marks on the wings, a pale teal beak, a tiny golden ring on one leg, a calm dark eye, pink-red legs. The wings, when spread, must be fully visible and inside the cell with margin (standing body length about 50% of the cell width).
Row 1, walk cycle, 4 frames: bobbing-head dove walk, wings folded, one foot forward then the other. Loops smoothly.
Row 2, flee cycle, 4 frames: taking off low, wings beating. Frame 1 wings up, frame 2 wings spread level, frame 3 wings down, frame 4 wings spread level, feet just above the ground line.
Row 3, fall, 4 frames: tumbles softly, lands on its side with one wing open, lies still, completely at rest. Frames 3 and 4 are almost the same.
```

### A-09 Bio-królik Hodowlany (Nexus, S)
```
Hand-painted anime-fantasy JRPG creature sprite sheet in the style of a game bestiary. Canvas 4:3 (2000x1500 px), strict grid of 4 columns by 3 rows = 12 equal cells, one full-body pose of the SAME single animal per cell, no cell borders, no grid lines. Strict side profile, the animal faces RIGHT in every pose. Thick clean dark-brown outline (about 3 px) around the whole silhouette, including the white fur, soft cel shading, rich natural colors. Identical design, colors and scale in all 12 cells: do not resize the animal between poses. In every cell all feet rest on the same invisible ground line at 85% of the cell height (jump poses keep the same reference), body centered horizontally, at least 8% empty margin, nothing crosses into a neighbouring cell. Pure flat white #FFFFFF background everywhere: no shadow, no ground, no glow, no particles, no motion lines, no text, no numbers, no watermark. The animal is peaceful and gentle, never aggressive, no blood.
The animal: a bio-farm rabbit from a futuristic farm. It must look clearly different from a wild meadow hare: a plump, compact, round-bodied lop-eared rabbit with SHORT ears folded down at the sides, short stocky legs, a small round tail, smooth short uniform light-grey and white fur with soft blue-grey shading (no moss, no leaves, no plants), bright lime-green eyes, a slim glowing cyan collar with a small tag, a small metal tag on the ear, thin cyan circuit-line markings on the haunch. Body length about 55% of the cell width.
Row 1, walk cycle, 4 frames: short soft hops, ears bouncing. Loops smoothly.
Row 2, flee cycle, 4 frames: fast zig-zag bounds. Frame 1 gathered, frame 2 stretched in the air, frame 3 landing, frame 4 gathering again.
Row 3, fall, 4 frames: topples gently, lies on its side, the cyan collar light dimming to grey, completely still. Frames 3 and 4 are almost the same.
```

### A-10 Bio-kura Hodowlana (Nexus, S)
```
Hand-painted anime-fantasy JRPG creature sprite sheet in the style of a game bestiary. Canvas 4:3 (2000x1500 px), strict grid of 4 columns by 3 rows = 12 equal cells, one full-body pose of the SAME single animal per cell, no cell borders, no grid lines. Strict side profile, the animal faces RIGHT in every pose. Thick clean dark-brown outline (about 3 px) around the whole silhouette, including the pale feathers, soft cel shading, rich natural colors. Identical design, colors and scale in all 12 cells: do not resize the animal between poses. In every cell all feet rest on the same invisible ground line at 85% of the cell height (jump poses keep the same reference), body centered horizontally, at least 8% empty margin, nothing crosses into a neighbouring cell. Pure flat white #FFFFFF background everywhere: no shadow, no ground, no glow, no particles, no motion lines, no text, no numbers, no watermark. The animal is peaceful and gentle, never aggressive, no blood.
The animal: a bio-farm hen from a futuristic farm. It must look clearly different from a forest hen: larger, rounder, almost egg-shaped body, smooth uniform pale-cream plumage with perfectly regular rows of feathers, soft warm-grey shading, NO moss, NO green or olive tips, NO fanned wing feathers, a small neat red comb, a short tidy upward tail, pale pink legs, a silver ring on one leg with a tiny cyan light. Body length about 65% of the cell width.
Row 1, walk cycle, 4 frames: precise, steady pecking walk, head moving rhythmically. Loops smoothly.
Row 2, flee cycle, 4 frames: running with wings partly spread, neck stretched. Frame 1 wings up, frame 2 mid-way, frame 3 down, frame 4 mid-way.
Row 3, fall, 4 frames: tips over, lies on its side, the cyan light on the leg ring going out, completely still. Frames 3 and 4 are almost the same.
```

## Ikony produktów (10)

Format: obraz kwadratowy, np. 1024×1024, jedna rzecz, **czysta biel w tle** (tło usuwa się narzędziem, potem skaluje do **128×128 RGBA**, jak istniejące ikony `ports/godot-pyra/assets/icons/items/*.webp`, np. `U-07` Chleb podróżny).
Nazwy plików: `F-01.png` … `F-10.png` (dokładnie te id).

### Blok wspólny ikon (na początek każdego promptu ikony)
```
Hand-painted anime-fantasy JRPG item icon, a single object centered, three-quarter top-down view, thick soft dark-brown outline, gentle cel shading, warm saturated colors, readable at 128x128 pixels, pure white #FFFFFF background, no cast shadow, no text, no frame, no hands. The object fills about 80 percent of the canvas.
```

| Id | Produkt | Opis obiektu (dopisz po bloku wspólnym) |
|---|---|---|
| F-01 | Udziec zająca | `A roasted hare leg on the bone, golden-brown glaze, a small sprig of green herb on the side.` |
| F-02 | Jajka leśne | `Three small speckled dark-cream eggs resting in a tiny nest of dry grass and green moss.` |
| F-03 | Jajko hodowlane | `A single flawless pale-cream egg with a thin glowing cyan ring line around its middle, slightly futuristic and very clean.` |
| F-04 | Ser kozi | `A wedge of hard pale-yellow goat cheese with a rust-red wax rind and a few small holes.` |
| F-05 | Mięso jaszczura | `A roasted lizard tail on a wooden skewer, charred dark grey skin with a faint orange ember glow.` |
| F-06 | Mleko księżycowe | `A small glass bottle of luminous silvery-white milk with a faint blue glow, a cork stopper stamped with a crescent moon, a few sparkles.` |
| F-07 | Szynka dzicza | `A smoked boar ham leg with a dark crust, tied with a string, a few green herbs tucked beside it.` |
| F-08 | Pieczony bażant | `A roasted pheasant on a small plate, golden-brown skin, a few copper-orange tail feathers laid beside it as decoration.` |
| F-09 | Gołąb w ziołach | `A small roasted dove in a shallow ceramic bowl, covered with green herbs, a little steam rising.` |
| F-10 | Racja białkowa | `A neat rectangular ration pack in silver-blue foil with a thin cyan label strip, one corner opened to show a compact protein bar, futuristic military ration.` |

## Co się dzieje po dostarczeniu grafik

1. Plansze zwierząt trafiają jako `art/production/animals/zwierze-A-xx.jpg`, ikony 1024 px jako `ikona-F-xx.png` (Git LFS dla JPG nie jest ustawiony, pliki są małe).
2. `python3 scripts/godot/prepare_animals.py` wycina pozy po kształtach (plansza nie musi mieć dokładnie 2000×1500; liczy się układ 4×3), usuwa białe tło, buduje atlas `assets/monsters/<świat>-animal-a-xx.webp`, `data/animals.json` i ikony `assets/icons/items/F-xx.webp`. Skrypt `ingest_creature_sheet.py` nie jest już potrzebny dla zwierząt.
3. Zachowanie zwierząt, łup i wskaźnik „Najedzony” są w grze; potem nowy rdzeń i wydanie treści (publikacja za zgodą właściciela).

## Kontrola jakości grafik (do odhaczenia)

- Każda plansza ma 12 klatek tego samego zwierzęcia, w profilu, zwróconego w prawo, tło czysto białe, bez cienia.
- Rząd 1 to płynny cykl chodu, rząd 2 to ucieczka (nie atak), rząd 3 to łagodny upadek i bezruch.
- Jasne elementy (pióra, wełna, futro) mają ciemny kontur; nic nie wychodzi poza komórkę.
- Ikona czytelna w 128×128, jedna rzecz, bez tła i cienia.
