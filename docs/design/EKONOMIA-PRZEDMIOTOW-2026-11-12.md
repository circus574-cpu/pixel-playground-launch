# Ekonomia przedmiotów — drop, sklep i crafting (wdrożone 12.11.2026)

**Status: wdrożone do runtime (`GameSession`), nie tylko specyfikacja.** Decyzja właściciela z
12.11.2026: *„słabsze przedmioty do kupna w sklepie za wygórowane ceny, by trzeba było trochę pograć,
żeby móc kupić; słabsze przedmioty możliwe do zdobycia z dropu — drop ma być rzadki; reszta lepszych
przedmiotów z craftu rozbudowanego”*. Ten dokument opisuje cały system: zasady, liczby, formuły,
pliki i sposób regeneracji. Liczby pochodzą z pomiaru kodu (`tsx`, import `src/game/items/*`), nie z
szacunku.

Powiązane: [katalog 366 przedmiotów V2](../katalog-przedmiotow-v2/README.md),
[Fabuła i ekwipunek §05 i §12–14](../FABULA-I-EKWIPUNEK.md),
[dziennik 12.11.2026](../zmiany/2026-11-12/ZMIANY.md).

---

## 1. Trzy filary w jednym zdaniu

| Filary | Co obejmuje | Rzadkość | Źródło |
| --- | --- | --- | --- |
| **Drop** | tylko słabe przedmioty | common / uncommon | rzadki łup z potworów (2% na kill) |
| **Sklep** | tylko słabe przedmioty | common / uncommon | kupiec, wygórowana cena (4×, min poziom×60) |
| **Crafting** | cały lepszy sprzęt | rare / epic / legendary | 265 receptur, materiały + monety |

Zasada przewodnia: **drop i sklep to podstawy, crafting to progresja.** Lepszy sprzęt nigdy nie
dropi i nigdy nie jest w sklepie — trzeba go wytworzyć. Dzięki temu łup jest miłym bonusem, a nie
głównym źródłem ekwipunku, a zakupy wymagają odgrania kilku walk.

## 2. Liczby (pomiar z kodu, 12.11.2026)

| Wielkość | Wartość |
| --- | --- |
| `ITEM_CATALOG` (pełny katalog V2) | **366** |
| Przedmioty ze statystykami (`stats`) | 202 |
| Klucze fabularne (`quest`, nigdy nie dropią / nie w sklepie) | 12 |
| Materiały katalogowe (`category: material`, składniki craftu) | 86 |
| `MATERIALS` — loot materiałowy z 40 potworów (tylko sprzedaż) | **57** |
| Rzadkość: common / uncommon / rare / epic / legendary | 66 / 74 / 99 / 67 / 60 |
| Słabe przedmioty mogące dropić (`isLootable`) | **128** |
| Słabe przedmioty w sklepie (`isShopItem`) | **85** |
| Lepsze przedmioty tylko z craftu (rare+, bez quest) | **226** |
| `CRAFTING_RECIPES` razem | **265** (140 bazowych + 125 wygenerowanych) |
| Pokrycie lepszych przedmiotów recepturami | **226 / 226** |
| Potwory (`LOOT_MONSTERS`, bez minionów) | 40 |
| Potwory z niepustą pulą słabego dropu | 24 |
| `DROP_CHANCE` (szansa na kill) | **0.02** (było 0.08) |
| `SHOP_MARKUP` (mnożnik ceny sklepu) | **4** |
| Zakres cen sklepu (poziom 1–18) | 60 – 840 monet |

Uwaga o dwóch rodzajach „materiałów”: `MATERIALS` (57) to surowce wypadające z potworów, które
**sprzedaje się** kupcowi (`sell = round(2 + 1.5×poziom)`); materiały katalogowe (86) to pozycje
`category: material` używane jako **składniki receptur**. To osobne zbiory o osobnych rolach.

## 3. Rzadkość i poziomy

Poziom przedmiotu bez jawnego `level` wynika z rzadkości (`RARITY_LEVEL`), a pula dropu używa
`lootLevel(item)` przyciętego do najwyższego poziomu potwora (`MAX_MONSTER_LEVEL = 18`).

| Rzadkość | Poziom bazowy | Waga w puli (`RARITY_WEIGHT`) | Drop | Sklep | Craft |
| --- | --- | --- | --- | --- | --- |
| common | 1 | 50 | tak | tak | tak (bazowe) |
| uncommon | 5 | 25 | tak | tak | tak (bazowe) |
| rare | 9 | 10 | **nie** | **nie** | **tak** |
| epic | 13 | 4 | **nie** | **nie** | **tak** |
| legendary | 17 | 1.5 | **nie** | **nie** | **tak** |

Wagi rare/epic/legendary pozostają w kodzie dla spójności typów, ale ponieważ `DROP_RARITIES`
zawiera tylko common/uncommon, lepsze przedmioty nigdy nie trafiają do puli dropu.

## 4. Filar I — drop (rzadki, tylko słabe)

Kod: `src/game/items/loot.ts`.

- `DROP_RARITIES = ["common", "uncommon"]`; `isLootable(item)` = nie-quest i rzadkość w `DROP_RARITIES`.
- `DROP_CHANCE = 0.02` — **2% na kill** nie-miniona, że wypadnie jeden słaby przedmiot z katalogu
  (wcześniej 8% i wszystkie rzadkości). Miniony (przywołane przez innego potwora) nie losują dropu.
- Każdy potwór ma pulę słabych przedmiotów ze **swojego kontynentu** w oknie poziomów
  `[lootLevel − 3, lootLevel + 5]` (`BELOW = 3`, `ABOVE = 5`). Wybór ważony `RARITY_WEIGHT`
  (common 50, uncommon 25). Wysokopoziomowe potwory mogą mieć **pustą pulę** — słabe przedmioty są
  niskopoziomowe, więc 16 z 40 potworów nie ma co dropić. To celowe, nie błąd.
- `rollCatalogDrop(monsterId, random)` jest deterministyczne przez podany `random()`; najpierw losuje
  czy drop w ogóle wystąpi (`random() >= DROP_CHANCE` → null), potem wybiera przedmiot z wagi.
- `itemDropChances(itemId)` zwraca dokładną szansę na przedmiot na kill dla każdego potwora, który
  może go zdropić; suma szans wszystkich przedmiotów w puli danego potwora = `DROP_CHANCE`.
- Materiały `MATERIALS` (57) dropią **osobno** z `monster.loot` (niezależnie od katalogowego dropu)
  i służą do sprzedaży oraz jako składniki craftu.

## 5. Filar II — sklep (tylko słabe, wygórowana cena)

Kod: `src/game/items/loot.ts` (`isShopItem`, `shopPrice`) + `src/game/session.ts` (gałąź kupna V2).

- `isShopItem(item)` = rzadkość common/uncommon **oraz** kategoria inna niż `quest` i `material`.
  Kupiec nie sprzedaje materiałów ani kluczy fabularnych; lepszy sprzęt odrzuca komunikatem
  „Kupiec oferuje tylko podstawowe przedmioty. Lepsze wytworzysz w craftingu.”
- **Cena zakupu:** `shopPrice(item) = max(ceil(cenaBazowa × 4), poziom × 60)`, gdzie
  `cenaBazowa = item.price || poziom × 20`. Czyli 4× cena katalogowa, ale nie mniej niż 60 monet za
  poziom. Przykłady: przedmiot poz. 1 → 60; poz. 5 → 300–340; najwyższe słabe → 840.
- Handel wymaga bliskości kupca (`nearbyNpc()?.id === "merchant"`).
- **Wyjątek — 4 przedmioty legacy** (`potion`, `tusk`, `sword`, `vest` w `ITEMS`) zachowują swoje
  dotychczasowe ceny handlu (np. mikstura 8 monet). Markup V2 dotyczy przedmiotów katalogowych
  spoza legacy `ITEMS`.
- **Skup (sprzedaż graczowi):** przedmioty katalogowe skupowane po `max(1, floor(cena/2))` albo
  `max(5, poziom×8)` przy cenie 0; materiały `MATERIALS` po `sell = round(2 + 1.5×poziom)`. Kupno 4×
  / skup ~50% ceny katalogowej wyklucza arbitraż kup–sprzedaj.

## 6. Filar III — crafting (cały lepszy sprzęt)

Kod: `src/game/items/recipes.ts` + `recipes.extra.ts` + handler `craft` w `src/game/session.ts`.

- `CRAFTING_RECIPES = [...BASE_RECIPES (140), ...EXTRA_RECIPES (125)]` = **265**. Receptury bazowe
  (140) są kanoniczne z katalogu V2; wygenerowane (125, prefiks `rec-gen-`) pokrywają **każdy**
  lepszy przedmiot (rare/epic/legendary, nie-quest), który nie miał receptury — 226/226 pokrycia.
- **Handler `craft`** (`command({ type: "craft", recipe })`), kolejność walidacji:
  1. receptura istnieje (`getRecipeById`), inaczej „Nieznana receptura.”;
  2. `p.level >= recipe.requiredLevel`, inaczej komunikat o wymaganym poziomie;
  3. każdy składnik w wymaganej ilości — materiały z `p.materials`, pozostałe z `p.bagItems`;
  4. `p.gold >= recipe.craftingCostCoins`.
  Dopiero po przejściu wszystkich sprawdzeń składniki i monety są **zużywane**, a wynik wydawany
  (`resultCount`; legacy `ITEMS` przez `add`, katalog przez `addBagItem`). Przy pełnym plecaku
  (`!given`) następuje **zwrot wszystkich składników i złota** — nic nie przepada.
- **Stacja** (`station`) jest atrybutem receptury (klasyfikacja: `alchemy`, `forge`, `runic`,
  `cyber_fabricator`, `projekt_ksiegi`). Handler nie wymaga bliskości stacji — to warstwa
  prezentacji/UI, nie bramka runtime.
- Plecak: `BAG_CELLS = 40` stosów po 99; materiały w osobnym słowniku `p.materials`.

### Formuły wygenerowanych receptur (`scripts/gen-item-recipes.ts`)

| Rzadkość | Koszt monet (`craftingCostCoins`) | Liczba składników | Ilość na składnik |
| --- | --- | --- | --- |
| rare | 50 + poziom×10 | 2 | 2 |
| epic | 150 + poziom×10 | 3 | 2–3 (`2 + i%2`) |
| legendary | 400 + poziom×10 | 4 | 3–4 (`3 + i%2`) |

- **Stacja wg kategorii:** `consumable` → alchemy; `artifact`/`buff`/`amulet`/`ring` → runic;
  `tool` → cyber_fabricator; pozostałe → forge.
- **Składniki:** materiały `MATERIALS` w oknie `[poziom−4, poziom+2]` (fallback `≤ poziom+2`),
  wybierane od najwyższego poziomu; `requiredLevel = max(1, poziom)`; `resultCount = 1`;
  `source = "repo"`; `id = rec-gen-<itemId>`.

## 7. Ekonomia złota — dlaczego trzeba pograć, zanim się kupi

- **Złoto za kill:** `gold: [max(1, poziom), max(3, poziom×3)]` (`src/game/monsters/catalog.ts:894`),
  czyli widełki od poziomu do 3× poziom.
- **Sprzedaż materiału:** `round(2 + 1.5×poziom)` — główny dochód z farmienia.
- **Przykład (poziom 5):** kill daje ~5–15 monet + materiał ~9 monet. Słaby przedmiot poz. 5 w
  sklepie kosztuje 300–340 monet, więc trzeba ok. 15–25 killi, żeby kupić jedną słabą rzecz. Lepszy
  sprzęt (rare poz. 9) wymaga craftu: 50 + 90 = 140 monet **oraz** 2 materiały — czyli trzeba polować
  na konkretne surowce, nie tylko zbierać złoto.
- Skutek: na początku gry stać Cię na miksturę (legacy, 8 monet), ale słaby sprzęt katalogowy to
  wydatek wymagający odgrania kilku walk, a lepszy sprzęt to cel craftowy. Drop (2%) jest bonusem,
  nie źródłem utrzymania.

## 8. Pliki i regeneracja

| Plik | Rola |
| --- | --- |
| `src/game/items/loot.ts` | `DROP_RARITIES`, `DROP_CHANCE`, pule dropu, `isShopItem`, `shopPrice`, `SHOP_MARKUP` |
| `src/game/items/recipes.ts` | `CRAFTING_RECIPES = BASE (140) + EXTRA (125)` |
| `src/game/items/recipes.extra.ts` | **generowane** 125 receptur `rec-gen-*` (nie edytować ręcznie) |
| `scripts/gen-item-recipes.ts` | generator brakujących receptur dla lepszych przedmiotów |
| `src/game/session.ts` | handler `craft` + gałąź kupna/sprzedaży V2 u kupca |
| `src/test/item-economy.test.ts` | testy systemu (sklep, drop, craft, walidacje, zwrot) |
| `src/test/catalog-loot.test.ts` | testy pul dropu (tylko słabe, rzadki, sumy szans) |

**Regeneracja receptur** (po dodaniu nowych lepszych przedmiotów do katalogu):

```bash
cd scripts && npx tsx gen-item-recipes.ts   # zapisuje ../src/game/items/recipes.extra.ts
npx prettier --write src/game/items/recipes.extra.ts   # generator pisze JSON, nie format prettier
```

Generator nadpisuje tylko `recipes.extra.ts`; receptur bazowych (140) nie rusza. Po regeneracji
uruchom testy ekonomii i pełną bramkę.

## 9. Weryfikacja (12.11.2026)

- `npm run typecheck` → **0 błędów**.
- `npm run lint` → **0 błędów** (15 istniejących ostrzeżeń `react-refresh`, niezwiązanych).
- `npm run test` → **wszystkie pass**; testy ekonomii `item-economy` + `catalog-loot` + `items` =
  **30/30**.
- `npm run build` → **0 błędów**.
- Pomiar liczbowy: `tsx` importujący `catalog/recipes/loot/materials` (sekcja 2).

## 10. Czego ten system NIE zmienia

- **Drzewka umiejętności** — przebudowa należy do CODEX; ten system ich nie dotyka.
- **Potwory / balans walki** — bez zmian (wzmocnienie potworów było osobnym, wstrzymanym tematem).
- **4 przedmioty legacy** (`potion`, `tusk`, `sword`, `vest`) — zachowują ceny i mechanikę.
- **Zapisy graczy** — bez migracji; `bagItems`/`materials` istniały wcześniej.
- **Questy** — klucze fabularne (12) nadal nie dropią i nie są w sklepie; nagrody zadań bez zmian.

## 11. Znane uproszczenia / otwarte

- Handler `craft` nie bramkuje bliskością stacji (atrybut `station` to klasyfikacja). Ewentualne
  wymaganie stacji w UI to osobna warstwa do decyzji właściciela.
- 16 z 40 potworów ma pustą pulę słabego dropu (słabe przedmioty są niskopoziomowe). Jeśli owner
  chce, by wysokopoziomowe potwory też coś dropiły, trzeba dodać słabe przedmioty o wyższym poziomie
  albo osobną pulę — to decyzja projektowa, nie błąd.
- Ceny sklepu (4×, min poziom×60) i `DROP_CHANCE` (2%) to parametry startowe; balans do korekty po
  zabawie właściciela. Stałe są w jednym miejscu (`loot.ts`), więc zmiana jest punktowa.