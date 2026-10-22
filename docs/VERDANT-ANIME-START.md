# Verdantia — alternatywna anime wioska startowa (podgląd do oceny)

Status: **wyłącznie za przełącznikiem podglądu**. Zaakceptowany anime las
(`anime-forest-v1`) pozostaje domyślną grafiką. Nie opublikowano, GPU nie zmieniano.

- Gra: `/?ki-verdant-art=1` → **Planetarni** → „Rozpocznij przygodę”.
- Można łączyć z `ki-aether-art=1`, `ki-nexus-art=1`, `ki-pyra-art=1`.

## Paczka `verdant-start` 1.0.0 (`previewOnly: true`)

| Klucz renderu | Zawartość |
| --- | --- |
| `terrain.verdant` | nowy atlas autotile 1904×1904 (trawa z kwiatami, ubita ścieżka, bruk z kamieni rzecznych, turkusowa woda) w identycznym układzie klatek |
| `object.forest.cottage` / `inn` / `forge` | chata, karczma, kuźnia |
| `object.forest.market` / `fountain` | stragan, fontanna z kryształem życia |
| `object.forest.lamp` / `fence` / `bridge` | latarnie, płoty, most |

Drzewa, krzewy i skały zachowują zaakceptowaną grafikę. Mapa, wierzchołki terenu,
rzeka, otwór mostu, footprinty kolizji, spawn, NPC, przeciwnicy, zadania, HUD,
postać Planetarnego i zapis są bez zmian (obiekty `fit: contain` w dotychczasowych
ramkach i kotwicach).

## Odtworzenie

```
python3 scripts/prepare_verdant_start.py <katalog-źródeł> <katalog-dostawy>
npm run assets:import -- <katalog-dostawy>/manifest.json --install
```

Źródła wygenerowano narzędziem obrazowym Lovable (22.10.2026); to nie jest render GPU.
Importer sprawdził przezroczystość, układ atlasu i budżet tekstur.

## Weryfikacja

`src/test/verdant-art.test.ts`, `e2e/region-start-art.spec.ts` (wariant verdant),
zrzuty 1280×1800 i 390×844. Wydajności na fizycznym Androidzie nie mierzono.
