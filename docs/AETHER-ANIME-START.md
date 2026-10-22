# Aetheria — anime start point (Sanktuarium Tysiąca Źródeł), podgląd do oceny

Status: **grafika do oceny właściciela, wyłącznie za przełącznikiem podglądu**. Nie jest
domyślną grafiką gry i nie została opublikowana.

## Jak obejrzeć

- Gra: `/?ki-aether-art=1` → wybierz **Mędrcy** → „Rozpocznij przygodę”.
- Playtest: `/scripts/playtest.html?ki-aether-art=1`.
- Bez parametru Aetheria pokazuje dotychczasowe płaskie SVG (stage3). Zapis postaci
  jest ten sam w obu trybach; przełącznik zmienia tylko tekstury.

## Zawartość paczki `aether-sanctuary` 1.0.0 (`previewOnly`)

Niezależne zasoby (nie jedna ilustracja sceny), anime 2D cel-shading, rzut z góry
z widoczną południową fasadą, światło z północnego zachodu:

| Klucz renderu | Zasób | Uwagi |
| --- | --- | --- |
| `terrain.aether-ground` | trawa z kwiatami KI | kafel 512 px → 320 j. świata, bezszwowy |
| `terrain.aether-path` | ścieżka z kamieni polnych | 512 px → 208 j. |
| `terrain.aether-plaza` | dziedziniec z marmurowych płyt | 512 px → 288 j., przycięty do siatki fug |
| `terrain.aether-wall` | omszałe skały tarasów | na niezmienionych prostokątach przeszkód |
| `object.sanctum` | Świątynia (Sanktuarium) | `origin` 0.5/0.81 |
| `object.archive` | Archiwa (2×) | `origin` 0.5/0.79 |
| `object.ki-source` | Źródło Pamięci (fontanna KI) | `origin` 0.5/0.84 |
| `object.ki-tree` | Drzewa KI (4×) | kotwica regionu |
| `object.cloud-peak` | Szczyty w chmurach (4×) | dekoracja, bez kolizji |
| `object.garden` | Ogrody z latarniami (10×) | dekoracja, bez kolizji |

`origin` jest wyłącznie prezentacyjny: przesuwa obraz, tak aby namalowana podstawa
budynku stała na **istniejącym** footprincie kolizji z `regions/aether.json`. Kolizje,
układ mapy, spawn, NPC, przeciwnicy, zadania, zapis, HUD i postać Mędrca z GPU nie
zostały zmienione. Gdy paczka jest aktywna, proceduralne kreski/kropki podłoża i okręgi
dziedzińca Aetherii nie są rysowane (malowany teren je zastępuje); Nexus-9 bez zmian.

## Pochodzenie i odtworzenie

Grafiki wygenerowano narzędziem obrazów Lovable (22.10.2026) jako osobne obiekty
z przezroczystością i osobne kafle terenu. Przygotowanie i import:

```
python3 scripts/prepare_aether_sanctuary.py <katalog-źródeł> <katalog-dostawy>
npm run assets:import -- <katalog-dostawy>/manifest.json --install
```

Importer GPU sprawdził przezroczystość obiektów, rozmiary i budżet tekstur
(Aetheria z podglądem: ~56 MiB z 128 MiB).

## Weryfikacja

- Unit: `src/test/aether-art.test.ts` (przełącznik, pełne pokrycie obiektów/terenu,
  brak wpływu na inne kontynenty i kolizje).
- E2E: `e2e/aether-art-preview.spec.ts`, wraz z `sage-preview` i `stage31-collision`.
- Zrzuty desktop 1280×800 i telefon 390×844 w Chromium (SwiftShader). Fizyczny
  Android nie był mierzony.

## Do decyzji właściciela

Akceptacja stylu, ewentualne poprawki (np. nasycenie trawy), a następnie osobna decyzja
o włączeniu paczki domyślnie (`previewOnly: false`) i o publikacji.
