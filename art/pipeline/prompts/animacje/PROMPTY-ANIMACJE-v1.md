# Prompty animacji postaci (filmy Gemini, 10 s)

Właściciel generuje filmy w Gemini i przekazuje je do repo. Z filmu wycina się klatki do gry (256 px, 8 kierunków dla chodu, jeden kierunek i lustro dla walki).
Ten plik to jedyne źródło promptów. W grze **już są**: chód, oddech (idle), jeden cios, efekt transformacji, chód po transformacji (Legenda, Android, Mędrzec, Planetar).
**Nie generujemy ich ponownie.** Poniższe etapy dotyczą wyłącznie brakujących animacji.

## Zasady (wynik testów na filmach Legendy, 05.11.2026)

1. Jeden film = 10 s, 1280×720, 24 kl./s, jedna animacja po drugiej. Między animacjami jest 0,4 s identycznej pozycji NEUTRAL. To punkt cięcia.
2. Czyste tło `#FFFFFF`, bez cienia. Pierwszy film walki miał szary cień na podłodze, co utrudnia wycięcie postaci, więc każdy prompt kończy się zakazem cienia.
3. Dym i kurz mają być ciepłe, pomarańczowe, nigdy szare (szary dym na białym tle da się wyciąć tylko z resztkami).
4. Efekty (pierścień dymu, pocisk) wychodziły poza kadr. Postać ma zajmować najwyżej 60% wysokości kadru, a efekty mieszczą się w kadrze. Pocisk lecący poza kadr jest akceptowalny.
5. Postać jest w jednym miejscu (animacja w miejscu). Wyjątek to szarża z Umiejętności C, która kończy w tym samym punkcie.
6. Ten sam obraz referencyjny rasy w każdym filmie. Kierunek: ściśle z profilu, patrzy w prawo (lewą stronę robimy lustrem).
7. Interakcja: w filmie Legendy nie było widać przedmiotu w ręku. Dopisz: `the item is a small glowing orange crystal clearly visible in the hand`.

## Tabela ras

| Rasa     | {POSTAĆ}                                                                                                                                          | {MOC}                    | {RUCHY}                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------- |
| Planetar | muscular young man, spiky brown hair, white headband, long orange scarf, sleeveless white and green martial-arts outfit, wrist wraps, brown boots | green energy             | martial arts: punches, kicks, palm strikes                                |
| Android  | young man, short spiky silver hair, silver plate armor with glowing cyan circuit lines, long torn dark-blue cape, grey armored boots              | cyan energy              | armored punches, kicks, and a glowing cyan energy shield on the forearm   |
| Legenda  | muscular man, messy black hair, red spiked shoulder armor, bare chest, black trousers, red sash, dark red boots                                   | red ember flame          | brutal fists and elbows wrapped in red embers                             |
| Mędrzec  | elegant woman, long wavy blonde hair, teal silk dress with high slit, gold ornaments, sheer white sleeves, glowing blue eyes                      | turquoise and gold magic | no melee: palm thrusts and gestures that fire magic orbs and light bursts |

## Blok otwierający (na początku każdego promptu)

```
Hand-painted anime-fantasy JRPG character animation. The character is {POSTAĆ}. Exactly the same design as the reference image in every frame, no redesign. Locked static camera, orthographic strict 90-degree side view, character facing RIGHT, centered, full body always fully inside the frame with a wide margin on every side, the character fills at most 60 percent of the frame height. Pure flat white #FFFFFF background everywhere, no floor, no cast shadow, no ground shadow, no gradient, no text, no camera movement, no zoom, no cuts. 24 fps, clean silhouette, exaggerated anime motion, sharp readable poses. Fighting style: {RUCHY}. Power color: {MOC}. Smoke and dust are warm orange-tinted, never grey. The character stays in place in the center of the frame. Every clip starts and ends in the same NEUTRAL pose: feet shoulder-width apart, guard hands low, relaxed ready stance, held still for 0.4 s between clips.
```

## Etap 1: walka (forma bazowa)

```
0.0-0.4  NEUTRAL hold.
0.4-1.4  BASIC HIT 1: fast strike with a short wind-up, impact pose held 2 frames, quick recovery.
1.4-2.4  BASIC HIT 2: a different strike from the other side, torso rotates, small impact flash, quick recovery.
2.4-3.9  FINISHER: long wind-up, a step forward, very heavy strike with a big {MOC} burst at impact, strong follow-through, return.
3.9-4.3  NEUTRAL hold.
4.3-5.8  SKILL A (ranged): hands gather {MOC} energy at the chest, thrust forward, release a projectile that leaves the frame to the right, recoil pose.
5.8-7.3  SKILL B (area): jump straight up, slam down with a hard landing, a {MOC} shockwave ring expands around the feet, settle.
7.3-7.7  NEUTRAL hold.
7.7-8.7  DODGE: fast backward sidestep, knees bent, a light afterimage trail, smooth return.
8.7-9.6  GUARD: arms crossed in front of the body, absorbs a hit, small slide backwards, holds the guard.
9.6-10.0 NEUTRAL hold.
Every clip is performed once, cleanly. No other motion.
```

## Etap 2: reakcje (forma bazowa)

```
0.0-0.4  NEUTRAL hold.
0.4-1.3  HIT FROM THE FRONT: head snaps back, flinch, small stagger back, recover.
1.3-1.7  NEUTRAL hold.
1.7-3.0  HEAVY HIT: knocked back, one step of stumbling, drops to one knee for a moment, rises.
3.0-3.4  NEUTRAL hold.
3.4-5.4  DEATH: takes the final hit, falls to the ground in 1.2 s, lies completely still for the rest.
5.4-7.4  STAND UP: lifts slowly, pushes up from the ground, rises with determination to NEUTRAL.
7.4-7.8  NEUTRAL hold.
7.8-9.6  VICTORY: confident pose, fist raise or triumphant gesture in the character's style, holds the pose for 0.6 s.
9.6-10.0 NEUTRAL hold.
```

## Etap 3: ruch i ładowanie (forma bazowa)

```
0.0-0.4  NEUTRAL hold.
0.4-3.4  RUN: fast run cycle IN PLACE, long strides, torso leaning forward, clothes and hair streaming back, seamless loop of 6 strides.
3.4-3.8  NEUTRAL hold.
3.8-6.4  CHANNEL: legs wide, {MOC} energy gathers and swirls upward, hair and clothes lift, trembling, builds, then releases.
6.4-6.8  NEUTRAL hold.
6.8-8.3  SKILL C: a third signature ability with a different motion than skills A and B (a dash-strike forward and back to place).
8.3-8.7  NEUTRAL hold.
8.7-10.0 INTERACT: reaches forward and takes an item, looks at it, nods. The item is a small glowing orange crystal clearly visible in the hand.
```

## Etap 4: walka po transformacji

Do bloku otwierającego dopisz: `The character is in the powered-up transformed form (glowing aura, intensified outfit), as in the reference of the transformed form.` Oś czasu jak w Etapie 1. Bez sekwencji transformacji, bez chodu (są w grze).

## Pliki gotowe (Legenda, forma bazowa)

Zapisane bez obróbki w `art-wip/gemini-anim-stages/`:

| Plik                       | Etap | Zgodność z osią czasu                                                          |
| -------------------------- | ---- | ------------------------------------------------------------------------------ |
| `legend-etap1-walka.mp4`   | 1    | zgodna; umiejętność B pokazana jako przysiad z pierścieniem ognia (skoku brak) |
| `legend-etap2-reakcje.mp4` | 2    | zgodna                                                                         |
| `legend-etap3-ruch.mp4`    | 3    | zgodna; interakcja bez widocznego przedmiotu                                   |

Ocena po 10–12 klatkach (co ok. 1 s), nie klatka po klatce.
Pozostałe rasy: ten sam prompt z tabeli ras. Nazwy plików: `<rasa>-etapN-<nazwa>.mp4`.
