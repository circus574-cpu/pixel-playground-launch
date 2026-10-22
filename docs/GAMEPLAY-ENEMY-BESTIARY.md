# Ki Legends — lista przeciwników / bestiariusz

**Stan odniesienia:** `f5207a1f0cc2b837c9a05d85ca8ebf68b060df86`, 22.10.2026. Dane: [enemy-catalog.v1.json](design/data/enemy-catalog.v1.json). **Nie mieszać `LIVE` z `PROPOSED`.**

## 1. Przeciwnicy obecnie zaimplementowani

W `src/game/session.ts` każda kraina tworzy czterech przeciwników typu dzik o identyfikatorach `boar-0`…`boar-3`. Każdy startuje z **66/66 HP**, patroluje, ściga gracza, wraca do punktu startowego i może się odrodzić. Nazwa i pozycje zależą od krainy. **To cztery lokalne warianty jednego typu przeciwnika, nie szesnaście gatunków.**

| Kraina / rasa | Wyświetlana nazwa enemy | Liczba spawnów | Pozycje X,Y |
|---|---|---:|---|
| Verdantia / Planetarni | Dzik leśny | 4 | `2050,1030`; `2100,1620`; `1850,1800`; `750,1000` |
| Aetheria / Mędrcy | Dzik z mglistych ogrodów | 4 | `1820,1080`; `1870,1510`; `900,1450`; `470,1100` |
| Nexus-9 / Androidy | Dzik z perymetru | 4 | `2020,1000`; `2080,1530`; `1140,1410`; `800,1450` |
| Pyra / Legendy | Dzik z popielnych kanionów | 4 | `1970,800`; `2020,1370`; `850,1520`; `650,680` |

**Źródła:** `src/game/world/forest-map.json` oraz `src/game/world/regions/{aether,nexus,pyra}.json`; zasady tworzenia, AI, loot i śmierci: `src/game/session.ts`. Uwaga: nazwy `boar-0` itd. powtarzają się w poszczególnych światach i nie są globalnym ID bestiariusza.

## 2. Proponowane typy przyszłych przeciwników — DO ZATWIERDZENIA

Lista niżej to **nowe pomysły**, nie materiały przesłane przez właściciela, nie gotowe grafiki i nie stan opublikowanej gry. Po trzy kandydatury na kontynent: zwykły, elitarny, boss. Nie mają ustalonego HP, obrażeń, poziomu, XP ani dropu.

| Kraina | Zwykły | Elitarny | Boss |
|---|---|---|---|
| Verdantia | Ciernisty tropiciel | Strażnik korzeni | Pradawny Strażnik Kniei |
| Aetheria | Zagubiona iskra KI | Strażnik pękniętej pieczęci | Wypaczony Mistrz Pieczęci |
| Nexus-9 | Zbuntowany dron patrolowy | Wadliwy sentinel | Strażnik uszkodzonego rdzenia |
| Pyra | Popielny łupieżca | Obsydianowy berserker | Strażnik Areny Dziedzictwa |

Koncepty zachowują klimat ras: żywa przyroda Planetarnych, mistyczne pieczęcie Mędrców, energia/syntetyka Androidów, arena/ogień Legend. Role i pomysły na telegraph ataku zapisano w danych strukturalnych.

## 3. Zasady wdrożenia bestiariusza

1. Najpierw zatwierdzić listę, miejsca występowania, obrażenia, XP, loot, ataki, hitboxy i limity aktywnych mobów; rozdzielić bestiariusz od już istniejących czterech dzików.
2. Wymagać własnych assetów (z potwierdzonym pochodzeniem i licencją) oraz stabilnych identyfikatorów. Obecne braki praw do referencji ras nie są automatycznie rozwiązane.
3. Nie zastępować dzików nowymi przeciwnikami bez migracji questów `boars`, testów dropu `tusk`, patrolowania i odradzania.
4. Sprawdzić balans na poziomie 1, wydajność Androida, kolizje, animacje `idle/move/attack/hit/death` i pełną regresję.
5. Publikacja dopiero po wymaganych testach i odbiorze właściciela.

**Źródła prawdy uruchomionej mechaniki:** [`src/game/session.ts`](../src/game/session.ts), [`src/game/world/worlds.ts`](../src/game/world/worlds.ts), [`src/game/world/regions/`](../src/game/world/regions/).
