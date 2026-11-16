# Prompty: 10 łagodnych zwierząt i 10 ikon jedzenia (system jedzenia, 16.11.2026)

Ten plik to jedyne źródło promptów do grafik systemu jedzenia (opis zasad i liczb: `docs/ROZWOJ-I-WALKA.md`, sekcja „Jedzenie i regeneracja życia”; dane: `ports/godot-pyra/data/food.json`).
Do wygenerowania są **10 plansz zwierząt** (po jednej na zwierzę) i **10 ikon produktów**. Gra używa ich dopiero po wygenerowaniu; do tego czasu zwierzęta mają w danych `art: false` i nie pojawiają się w świecie.

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

### Blok wspólny (wklej na początku każdego promptu zwierzęcia)

```
Hand-painted anime-fantasy JRPG creature sprite sheet, thick clean dark outlines, soft cel shading, rich natural colors, the same visual style as a game bestiary. One image in 4:3 format containing a strict 4 columns by 3 rows grid of 12 full-body poses of the SAME animal, identical design and identical scale in every cell, strict side profile view, animal facing RIGHT, centered in its cell, each pose fully inside its own cell. Pure white #FFFFFF background everywhere, no shadow, no ground, no text, no grid lines, no frames. The animal is peaceful and gentle, never aggressive. Row 1: a smooth 4-frame walk cycle. Row 2: a 4-frame panicked fast flee run cycle. Row 3: 4 frames of a soft fall: stagger, topple, lying on its side, completely still (gentle, no blood).
```

## Zwierzęta

Skala względem bohatera: rozmiar „S” = mniejsze od bohatera, „M” = do pasa bohatera. Opis po angielsku, bo generatory lepiej go rozumieją (tak jak w `PROMPTY-ANIMACJE-v1.md`).

### A-01 Zając Łąkowy (Verdantia, rozmiar S) → Udziec zająca
```
[BLOK WSPÓLNY] The animal is a large meadow hare: golden-brown fur, white belly, very long ears with delicate green leaf-vein patterns on the tips, a small tuft of moss on the back, bright amber eyes, big strong hind legs. Walk cycle is a relaxed hopping gait. Flee cycle: huge fast bounds with ears flat back. Fall: tumbles and lies on its side.
```

### A-02 Kura Leśna (Verdantia, rozmiar S) → Jajka leśne
```
[BLOK WSPÓLNY] The animal is a forest hen: mottled dark olive-brown plumage with moss-green tips on the wing feathers, small red comb, sturdy yellow legs, a round alert eye. Walk cycle: pecking strut with head bobbing. Flee cycle: running with wings half spread and flapping. Fall: tips over onto its side with feathers ruffled.
```

### A-03 Dzik Mchowy (Verdantia, rozmiar M) → Szynka dzicza
```
[BLOK WSPÓLNY] The animal is a calm stocky forest boar: charcoal-grey bristly hide, thick green moss and tiny red mushrooms growing along its spine, short blunt cream tusks, small gentle dark eyes, heavy rounded body. Walk cycle: slow heavy trot. Flee cycle: a clumsy fast gallop with head low. Fall: knees buckle, rolls onto its side.
```

### A-04 Koza Skalna (Pyra, rozmiar M) → Ser kozi
```
[BLOK WSPÓLNY] The animal is a sturdy mountain goat: ash-grey and rust-red coat, long white beard, curved dark horns with faint ember-orange glow at the tips, black split hooves, a few tiny glowing ember specks in the fur. Walk cycle: confident sure-footed steps. Flee cycle: leaping bounds. Fall: folds its legs and tips onto its side.
```

### A-05 Jaszczur Popielny (Pyra, rozmiar S) → Mięso jaszczura
```
[BLOK WSPÓLNY] The animal is an ash lizard: charcoal-grey scaled body, dull orange ember glow between the scales, a long thick tail, flat wide head, small calm yellow eyes, low to the ground. Walk cycle: low side-to-side lizard crawl with the tail swaying. Flee cycle: fast skittering run with the body raised. Fall: flops flat and goes limp, tail last.
```

### A-06 Bażant Żarowy (Pyra, rozmiar S, `--no-effects`) → Pieczony bażant
```
[BLOK WSPÓLNY] The animal is an ember pheasant: copper-red and orange plumage, a long fanned tail with glowing orange tips, a bright red face wattle, dark eye with a gold ring, slender legs. Walk cycle: elegant strut with a bobbing head. Flee cycle: low flapping hops, wings wide open (nothing cropped). Fall: drops and lies on its side with the tail fanned out.
```

### A-07 Owca Księżycowa (Aetheria, rozmiar M) → Mleko księżycowe
```
[BLOK WSPÓLNY] The animal is a moon sheep: fluffy pale silver wool with a faint blue-white glow, curled pearl-white horns, a gentle face, a small crescent mark on the forehead, a few tiny star-like sparkles around the wool. Walk cycle: calm soft steps. Flee cycle: a bouncing trot with wool swaying. Fall: kneels and lies down as if falling asleep.
```

### A-08 Gołąb Pergaminowy (Aetheria, rozmiar S, `--no-effects`) → Gołąb w ziołach
```
[BLOK WSPÓLNY] The animal is a parchment dove: cream, parchment-coloured feathers with faint ink-script marks on the wings, a pale teal beak, a tiny golden ring on one leg, a calm dark eye. Walk cycle: a bobbing-head dove walk. Flee cycle: wings beating, taking off low (wings fully visible, nothing cropped). Fall: tumbles softly and lies with one wing open.
```

### A-09 Bio-królik Hodowlany (Nexus, rozmiar S) → Racja białkowa
```
[BLOK WSPÓLNY] The animal is a bio-farm rabbit of a futuristic farm: clean white and light-grey fur, a slim glowing cyan collar with a small number tag, a tiny metal ear tag, bright lime-green eyes, a neat tidy look. Walk cycle: short soft hops. Flee cycle: fast zig-zag bounds. Fall: topples gently and lies on its side with the collar light dimming.
```

### A-10 Bio-kura Hodowlana (Nexus, rozmiar S) → Jajko hodowlane
```
[BLOK WSPÓLNY] The animal is a bio-farm hen of a futuristic farm: uniform pale-cream plumage, a small neat red comb, a silver ring on the leg with a small cyan light, orderly regular feather pattern. Walk cycle: a precise, steady pecking walk. Flee cycle: running with wings partly spread. Fall: tips over onto its side, the leg light going out.
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

## Co się stanie po dostarczeniu grafik

Zachowanie zwierząt, łup, rozmieszczenie i wskaźnik „Najedzony” są już w grze (gotowe, przetestowane na zastępczym arkuszu); zwierzę pojawia się dopiero po wpisie w `data/animals.json`.

1. Plansze przechodzą przez `python3 scripts/gpu/ingest_creature_sheet.py <plansza> A-01 [--no-effects]` (id zwierzęcia jako id potwora).
2. `python3 scripts/godot/prepare_animals.py` zamienia paczki `enemy-v3-A-xx` na arkusze `assets/monsters/<świat>-animal-a-xx.webp` i `data/animals.json`.
3. Ikony `F-01…F-10` (128×128) trafiają do `ports/godot-pyra/assets/icons/items/`; potem nowy rdzeń i wydanie treści (publikacja za zgodą właściciela).

## Kontrola jakości grafik (do odhaczenia)

- Każda plansza ma 12 klatek tego samego zwierzęcia, w profilu, zwróconego w prawo, tło czysto białe, bez cienia.
- Rząd 1 to płynny cykl chodu, rząd 2 to ucieczka (nie atak), rząd 3 to łagodny upadek i bezruch.
- Jasne elementy (pióra, wełna, futro) mają ciemny kontur; nic nie wychodzi poza komórkę.
- Ikona czytelna w 128×128, jedna rzecz, bez tła i cienia.
