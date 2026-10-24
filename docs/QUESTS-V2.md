# KI LEGENDS — WORLD V2: ŻYJĄCA PLANETA, EKSPLORACJA I PRZYGODY (`QUESTS-V2`)

## 1. Przegląd Architektury Zawartości Świata V2

Moduł `feature/quests-v2` przekształca cztery kontynenty planety KI Legends (`verdant`, `pyra`, `aether`, `nexus`) w żyjący świat RPG oparty na kanonicznych danych z **Księgi Przygody v1.0** (`KI-LEGENDS-KSIEGA-PRZYGODY-v1.0.pdf`), celach produkcyjnych `art/pipeline/gpu-production-targets.json` oraz 40-potworowym bestiariuszu właściciela (`art/production/enemies/bestiary-owner.json`).

Nie zmieniono geometrii planety ani istniejących granic kolizji.

---

## 2. Cztery Kontynenty, 16 Miast i Lokalni NPC

Każdy kontynent posiada **1 Stolicę** oraz **3 Miasta regionalne** (strefy bezpieczne `inSafeCity = true`, brak walki wewnątrz `city.bounds`):

### A. Verdantia — Planetarni (`verdant`, rozmiar świata: `2400 × 1800`)

- **Stolica**: **Sylvara — Miasto Korzeni** (`verdant-capital`) — NPC: `Aira` (Starsza Korzeni), `Mio` (Mistrzyni Zielnik), `Taro` (Zbrojmistrz Żywicy).
- **Miasto 1**: **Mszana Przystań** (`verdant-moss-haven`) — NPC: `Ren` (Zwiadowca Klifów), `Nela` (Strażniczka Mchu).
- **Miasto 2**: **Rozdroże Korzeni** (`verdant-root-crossing`) — NPC: `Oren` (Kowal Korzeni).
- **Miasto 3**: **Kwitnąca Polana** (`verdant-bloom-glade`) — NPC: `Lina` (Opiekunka Pąków).

### B. Pyra — Legendy (`pyra`, rozmiar świata: `3000 × 2250`)

- **Stolica**: **Kalderion — Twierdza Popiołu** (`pyra-capital`) — NPC: `Kaena` (Wódz Kalderu), `Yumi` (Mistrzyni Ostrzy), `Goro` (Mistrz Kuźni).
- **Miasto 1**: **Ognista Grań** (`pyra-ember-ridge`) — NPC: `Rokan` (Strażnik Grani), `Toren` (Łowca Popiołu).
- **Miasto 2**: **Popielny Szlak** (`pyra-ash-trail`) — NPC: `Hana` (Strażniczka Płomienia).
- **Miasto 3**: **Przystań Kuźni** (`pyra-forge-harbor`) — NPC: `Daro` (Handlarz Bronią).

### C. Aetheria — Mędrcy (`aether`, rozmiar świata: `3000 × 2250`)

- **Stolica**: **Luminia — Świątynia Chmur** (`aether-capital`) — NPC: `Sora` (Pierwsza Mówczyni), `Mei` (Przewodniczka Oddechu), `Enso` (Strażnik Zwojów).
- **Miasto 1**: **Klasztor Chmur** (`aether-cloud-monastery`) — NPC: `Ishin` (Mistrz Oddechu), `Nari` (Opiekunka Dzwonów).
- **Miasto 2**: **Mgielny Przesmyk** (`aether-mist-pass`) — NPC: `Kael` (Strażnik Mostu).
- **Miasto 3**: **Zwierciadlana Przystań** (`aether-mirror-haven`) — NPC: `Talen` (Badacz Gwiazd).

### D. Nexus-9 — Androidy (`nexus`, rozmiar świata: `3000 × 2250`)

- **Stolica**: **Sektor Pierwszy — Rdzeń Zero** (`nexus-capital`) — NPC: `LYRA-7` (Jednostka Archiwalna), `MIRA-2` (Kalibratorka Rdzeni), `HEF-4` (Inżynier Obwodów).
- **Miasto 1**: **Stacja Kwarantanny** (`nexus-quarantine-station`) — NPC: `AXON` (Strażnik Sektora), `Eko-0` (Jednostka Medyczna).
- **Miasto 2**: **Zardzewiały Dok** (`nexus-rusted-dock`) — NPC: `KOR-9` (Złomiarz Portowy).
- **Miasto 3**: **Wieża Sygnałowa** (`nexus-signal-tower`) — NPC: `VEX-3` (Operator Anteny).

---

## 3. Sławne Lokacje (16 Punktów `exploration`)

Każda sławna lokacja jest powiązana z rzeczywistym identyfikatorem obiektu mapy z `gpu-production-targets.json`:

| Kontynent     | ID Obiektu (`mapObjectId`) | Nazwa Sławnej Lokacji                   | Współrzędne    | Nagroda za 1. odkrycie      |
| :------------ | :------------------------- | :-------------------------------------- | :------------- | :-------------------------- |
| **Verdantia** | `fountain-5`               | Źródło Pierwszego Drzewa                | `(1048, 728)`  | +60 XP, +35 monet, `potion` |
| **Verdantia** | `bridge-6`                 | Most Splątanych Korzeni                 | `(950, 910)`   | +75 XP, +40 monet, `tusk`   |
| **Verdantia** | `cottage-0`                | Opuszczona Chata Zielarza Pierwszej Ery | `(420, 320)`   | +80 XP, +45 monet, `potion` |
| **Verdantia** | `forge-2`                  | Kuźnia Żywego Korzenia                  | `(1480, 620)`  | +95 XP, +55 monet, `sword`  |
| **Pyra**      | `fortress-0`               | Cytadela Pierwszego Płomienia           | `(1120, 640)`  | +70 XP, +40 monet, `sword`  |
| **Pyra**      | `war-shrine-1`             | Kaplica Krwi i Popiołu                  | `(1850, 720)`  | +80 XP, +45 monet, `tusk`   |
| **Pyra**      | `war-shrine-2`             | Ołtarz Wygasłych Ostrzy                 | `(890, 1480)`  | +90 XP, +50 monet, `vest`   |
| **Pyra**      | `statue-3`                 | Kolos Pierwszego Bohatera               | `(2064, 1598)` | +110 XP, +65 monet, `sword` |
| **Aetheria**  | `sanctum-0`                | Sanktuarium Ciszy Dzwonu                | `(1080, 620)`  | +65 XP, +40 monet, `potion` |
| **Aetheria**  | `archive-1`                | Wielkie Archiwum Wiatru                 | `(1360, 780)`  | +80 XP, +45 monet, `tusk`   |
| **Aetheria**  | `archive-2`                | Zapomniane Biblioteki Siódmej Oktawy    | `(1820, 1420)` | +95 XP, +55 monet, `vest`   |
| **Aetheria**  | `ki-source-3`              | Pierwotne Źródło KI                     | `(1909, 1598)` | +115 XP, +70 monet, `sword` |
| **Nexus-9**   | `lab-0`                    | Laboratorium Rdzenia Zero               | `(1050, 620)`  | +65 XP, +40 monet, `potion` |
| **Nexus-9**   | `reactor-2`                | Reaktor Pulsacyjny Sektoru Centralnego  | `(1420, 980)`  | +80 XP, +45 monet, `vest`   |
| **Nexus-9**   | `terminal-4`               | Terminal Zaginionych Danych             | `(880, 1560)`  | +95 XP, +55 monet, `tusk`   |
| **Nexus-9**   | `crystal-6`                | Kryształ Pamięci Pierwszego Architekta  | `(1894, 1598)` | +120 XP, +70 monet, `sword` |

---

## 4. Katalog 106 Zadań i Silnik Questów (`src/game/quests/`)

Łącznie przygotowano **106 zadań**:

- **Verdantia (`verdantQuests.ts`)**: 8 głównych (`O-V01..O-V06`, `M01`, `M13`), 12 pobocznych (`S-V01..S-V12`), 4 ukryte (`H-V01..H-V04`).
- **Pyra (`pyraQuests.ts`)**: 8 głównych (`O-P01..O-P06`, `M05`, `M15`), 12 pobocznych (`S-P01..S-P12`), 4 ukryte (`H-P01..H-P04`).
- **Aetheria (`aetherQuests.ts`)**: 8 głównych (`O-A01..O-A06`, `M09`, `M19`), 12 pobocznych (`S-A01..S-A12`), 4 ukryte (`H-A01..H-A04`).
- **Nexus-9 (`nexusQuests.ts`)**: 8 głównych (`O-N01..O-N06`, `M10`, `M20`), 12 pobocznych (`S-N01..S-N12`), 4 ukryte (`H-N01..H-N04`).
- **Międzykontynentalne (`intercontinentalQuests.ts`)**: 10 zadań (`IC-01..IC-10`), w tym 6 aktywnych w runtime (`IC-01..IC-06`) oraz 4 jawnie oznaczone jako dane przyszłego etapu (`IC-07..IC-10`, `runtimePlayable: false`), wymagające rozbudowy silnika o żeglugę na wyspy `I1..I6` i tunele podziemne.

### Jak dodać nowy quest, lokację lub wydarzenie

1. **Nowy quest**: Dodaj obiekt `QuestDefinition` w odpowiednim pliku (`verdantQuests.ts`, `pyraQuests.ts`, `aetherQuests.ts`, `nexusQuests.ts` lub `intercontinentalQuests.ts`). Używaj wyłącznie kanonicznych ID z `CANONICAL_NPC_BINDINGS`, `ALL_CITIES_V2`, `CANONICAL_MAP_OBJECT_IDS`, `OWNER_BESTIARY_IDS` oraz `EXISTING_RUNTIME_ITEM_IDS`.
2. **Walidacja**: Uruchom `npm run test` — test `validateQuestCatalogIntegrity()` automatycznie sprawdzi wszystkie referencje ID.
3. **Migracja zapisu**: Silnik `migrateSaveV4ToV5` w `src/game/quests/engine.ts` automatycznie migruje zapisy `v4` do `v5` bez utraty ekwipunku, odkrytych lokacji i ukończonych zadań.

---

## 5. Klasyfikacja Wdrożenia (Zgodnie z Sekcją 11)

1. **Zaimplementowane i przetestowane (`POTWIERDZONE`)**:
   - Pełne moduły danych 4 kontynentów (`src/game/worlds/`), 16 miast, szlaków drogowych, 16 sławnych lokacji, ukrytych miejsc i wydarzeń.
   - Silnik questów (`src/game/quests/engine.ts`) obsługujący stany `unavailable`, `available`, `active`, `completed`, 5 typów celów (`combat`, `talk`, `discover`, `visit`, `deliver`), zadania wieloetapowe, zależności, nagrody jednorazowe i odnawialne, ochronę przed duplikacją nagród oraz migrację `Save v4 -> Save v5`.
   - Interfejs Dziennika Questów, znaczników `!` / `?` nad NPC, kompasu najbliższego celu i rejestru odkryć (`src/components/WorldV2Explorer.tsx`).
   - 3 wizualne plansze HUD/UI w ciemnym stylu anime RPG (`src/components/HudShowcase.tsx`) oraz 116 węzłów drzewek umiejętności (`src/data/skillTrees.ts`).
2. **Przygotowane jako dane, ale nieaktywne (`runtimePlayable: false` / `engineSupported: false`)**:
   - Misje międzykontynentalne `IC-07..IC-10` prowadzące na 6 Wysp Pośrednich (`I1..I6`) i podziemny maglev.
   - Ukryte przejścia podziemne (`verdant-hidden-2`, `pyra-hidden-4`, `aether-hidden-4`, `nexus-hidden-4`) oraz animowane konwoje kupieckie (`verdant-event-5`, `pyra-event-3`, `aether-event-3`, `nexus-event-3`).
   - Planowane przyszłe ID nowych przedmiotów (`plannedFutureItemId`: `W-V1..6`, `U-W01..08`), zmapowane obecnie bezpiecznie na istniejące w runtime przedmioty (`potion`, `tusk`, `sword`, `vest`).
3. **Wymagające dalszego rozwoju silnika**:
   - Instancje podziemi międzykontynentalnych, żegluga morska na wyspy `I1..I6`, fizyka animowanych konwojów na krzywych drogach i interaktywne zagadki środowiskowe.
4. **Wymagające decyzji właściciela**:
   - Zatwierdzenie ostatecznej tabeli drop-rate dla nowych ID ekwipunku (`W-*`, `A-*`, `H-*`, `B-*`, `R-*`, `G-*`, `C-*`, `U-*`) przed ich dopisaniem do generatora przedmiotów runtime.

## Przeniesienie na gałąź `feature/quests-v2` (24.10.2026)

Treść questów i światów pochodzi z gałęzi `worldv2` (eksport z Google AI Studio). Ta gałąź podmieniała konfigurację aplikacji (package.json, vite, tsconfig, App), więc przeniesiono tylko:

- `src/game/quests/*` — silnik, 106 questów, testy,
- `src/game/worlds/*` — definicje kontynentów, miast i 16 sławnych lokacji,
- ten dokument.

Zmiany przy przeniesieniu:

- potwory pochodzą z kanonicznego katalogu repo (`src/game/monsters/catalog.ts`) przez `src/game/quests/bestiary.ts`, nie z kopii bestiariusza,
- test drzewek używa `KIT_NODES` z `src/game/kit/nodes.generated.ts` (rasy: planetary, sage, android, legend),
- poprawki ścisłego TypeScriptu (`noUncheckedIndexedAccess`).

Jeszcze niepodłączone: dziennik questów w UI, znaczniki nad NPC, zapis questów w save gry (silnik ma własny model zapisu v5) oraz zgodność id miast z `content-plan.json` świata v2.
