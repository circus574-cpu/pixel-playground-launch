# Zestaw grafik do układania świata (Codex ⇄ Claude), 23.10.2026

Codex układa świat i questy (współrzędne, obiekty, NPC, spawny). Ten dokument mówi, **z czego** może
układać i **jak**, żeby grafika, kolizje i kolejność rysowania zgadzały się bez zgadywania.
Maszynowy opis: [`world-asset-kit.json`](world-asset-kit.json), generowany przez
`python3 scripts/export_world_asset_kit.py` (po każdym imporcie paczki uruchomić ponownie).

## Co jest w zestawie

- `objects` — 302 wiązania obiektów (`object.*`) z gotowymi **zalecanymi wymiarami, punktem oparcia
  i obrysem kolizji** (mediany z dotychczasowych regionów). Pole `placement` = ściągawka do wpisu w JSON regionu.
- `terrains` — 33 wiązania powierzchni (`terrain.*`): podłoże, ścieżki, place, ściany, strefy.
- `pending` — zestawy wygenerowane na GPU, jeszcze nie zainstalowane (miasto Pyry, 494 tekstury, krajobraz
  i fauna). Nie układać ich w regionach, dopóki nie pojawią się w `objects`/`terrains`.

## Jak układać obiekt (region JSON, `objects[]`)

```json
{
  "id": "fortress-0",
  "kind": "fortress",
  "asset": "fortress",
  "x": 34404,
  "y": 2987,
  "width": 570,
  "height": 390,
  "anchorX": 0.5,
  "anchorY": 0.92,
  "solid": true,
  "footprint": { "width": 470, "height": 160 }
}
```

- `asset` = klucz po `object.` z `world-asset-kit.json` (`regionAsset`). Silnik bierze wiązanie
  `object.<świat>.<id>` przed `object.<asset>`.
- `x, y` to **stopa** obiektu (punkt oparcia na ziemi). Kolejność rysowania = `y`: postać przed pniem
  zasłania go, za koroną jest przez nią zasłaniana. Nie ustawiać ręcznej głębokości.
- Kolizja pochodzi wyłącznie z `solid` + `footprint` w JSON-ie regionu, **nigdy z grafiki**. Obrys ok.
  60 % szerokości i niski (patrz `placement.footprint`). Drzewa mają obrys tylko pnia.
- Cień pod obiektem dodaje silnik sam dla obiektów wyższych niż 56 jednostek na warstwie `objects`
  (nie dla mostów i płaskich elementów). Nie rysować cieni w grafice.
- Drzewa (`kind` zawiera `tree`, `pine`, `bamboo`) nie bledną: postać za koroną jest ukryta. Budynki i
  rekwizyty bledną do 28 %, gdy zasłaniają tułów postaci.
- `layer: below` = płaskie elementy pod postaciami (mosty, kałuże), `overhead` = nad nimi.

## Czego nie ruszać

- Wnętrze kuźni w Pyrze to **pionowa sala 540 × 1100** (`SMITHY_ROOM` w `src/game/city/room.ts`); jej
  kolizje są dopasowane do grafik paczki `pyra-smithy`. Inne wnętrza mają układ 960 × 760.
- Miasto = strefa bezpieczna ~4000 × 2500 (`city.bounds`), poza nią walka. Nowe obiekty w mieście nie mogą
  zasłaniać drzwi budynków usługowych (muszą być osiągalne A* ze startu).
- Nie edytować `imported.json` ręcznie ani plików `*.generated.ts`; paczki wchodzą przez
  `npm run assets:import` z podbiciem wersji.

## Zamawianie nowej grafiki

Wpisz potrzebę do `docs/GPU-BACKLOG-2026-10-23.md` (typ, biom/rasa, rozmiar na ekranie, solid tak/nie).
Każda część przechodzi: generowanie na GPU → wybór wariantu przez właściciela → wycięcie tła →
kontur i paczka (`scripts/prepare_*.py`) → import → pojawia się w `world-asset-kit.json`.
Orientacyjnie: kilkanaście części jednego zestawu to godzina pracy GPU plus przegląd właściciela.

## Stan na 23.10.2026

| Zestaw                                                                                                                            | Stan                                                                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Obiekty regionów (świątynie, wieże, drzewa, góry, wulkany, rekwizyty)                                                             | zainstalowane, w `objects`                                                                                                |
| Kuźnia Pyry (18 części, podłoga, ściana, Goro)                                                                                    | zainstalowane (paczka `pyra-smithy` 1.1.0)                                                                                |
| Partia 1: miasta Pyry, Aetherii, Nexus-9, Verdantii; biomy las, śnieg, pustynia, wulkan, wybrzeże; ruiny i rekwizyty (138 części) | zainstalowane (paczki `pyra-city`, `aether-city`, `nexus-city`, `verdant-city`, `biome-*`, `ruins-props`), wersja robocza |
| 494 tekstury krajobrazu + wersja przemalowana                                                                                     | wygenerowane / w trakcie przemalowania                                                                                    |
| Góry, wulkany, skały, drzewa, 8 zwierząt neutralnych                                                                              | wygenerowane próbki, do wyboru                                                                                            |
| Bohaterowie 4 ras w nowym stylu z animacjami                                                                                      | Legendy: trening modelu; Androidy: wybrany wygląd; reszta: koncepty                                                       |
