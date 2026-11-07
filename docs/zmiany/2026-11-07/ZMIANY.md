# Dziennik zmian — 7 listopada 2026

## Narzędzia

### 1. Lokalny asystent AI na CPU (skrypt instalacyjny)

- Prośba właściciela: lokalny asystent programisty na maszynie 16 rdzeni / 32 GB RAM bez GPU i bez kosztów.
- Dodano `scripts/ops/local-ai-dev-install.sh` (llama.cpp, model Qwen3-Coder-30B-A3B Q4_K_M, usługa `llama-server` tylko na `127.0.0.1`, Qwen Code dla użytkownika `aidev`) oraz sekcję w [Architektura i testy](../../ARCHITEKTURA-I-TESTY.md#lokalny-asystent-ai-na-cpu--07112026).
- Sprawdzono: składnię skryptu, tryb `DRY_RUN` i funkcję `smoke` na atrapie serwera; istnienie repozytorium modelu, pliku `Q4_K_M` oraz pakietu `@qwen-code/qwen-code`.
- Nie sprawdzono: instalacji na docelowym serwerze, budowy llama.cpp, pobrania modelu ani rzeczywistej prędkości.

## Walka: kara śmierci, statusy potworów i ranga trudności

### 2. Weryfikacja mechaniki walki: pomiar realnego wpływu gracza

- Właściciel polecił zweryfikować system walki i odpowiedzieć, jaki gracz ma na niego realny wpływ.
  Odpowiedź pochodzi z pomiaru, nie z lektury kodu: `scripts/combat/simulate-balance.ts` na żywym
  `GameSession`, pełny zamiat bestiariusza, `--trials 16 --shards 4` → **22 272 walk, 1392 scenariusze**.
- Stan przed zmianami: mediana `winRate` **1,000 w każdym z trzech profili** (goły autoatak, sprzęt,
  sprzęt + umiejętności). **96–99 %** scenariuszy miało wynik dokładnie 0 albo 1, czyli rozstrzygnięty
  zanim gracz cokolwiek zrobił. Gracz o **dwa poziomy niższy** od potwora nadal wygrywał pewnie.
  Umiejętności zmieniały wynik w 38 z 464 par (8 %), w 424 (91 %) nie zmieniały nic; ich realny efekt
  to czas 4,7 s → 2,9 s i śmierci 393 → 40.
- Dziennik opisowy: bestiariusz to poziomy 1–18 (4 potwory na poziom), średnia walka 5,1 s, a scenariuszy
  niepewnych (5–95 %) były **cztery** na 464 — wyłącznie `pyra-magmowy-krab` (frontArmor) i
  `verdant-lisciak-skrytobojca` (burrow).
- Przyczyny z kodu: klik w potwora włącza `autoAttack`, a tick sam goni cel i sam macha
  (`session.ts`); najszybszy potwór `0,12 × 1,4 = 168 px/s` jest wolniejszy od gracza (170–185 px/s), więc
  każda walka jest opuszczalna; windup ciosu `min(cd·0,25, speed ≤ 0,6 ? 300 : 140)` daje **29 z 40**
  potworów tylko 140 ms ostrzeżenia, poniżej progu reakcji; śmierć kosztowała 3 s i zero przedmiotów.
- Martwa treść: 10 potworów nie miało żadnej słabości, 5 miało tylko na `water`, a gracz nie zadaje
  water/cold → **37,3 % slotów spawnu** (3268 z 8752) miało słabość nie do użycia; odporność (< 1) miał
  dokładnie 1 potwór. Mechaniki pozycyjne i przerywanie: frontArmor 1, backBonus 3, interrupt 1, curl 1,
  reflect 1 z 40 (15,4 % slotów). Ośmiu bossów z fazami i 26 atakami było osiągalnych tylko przez
  `?ki-boss=<id>` albo panelem GM (`state.staff`) — właściciel zdecydował, że na razie tak zostaje.
- Narzędzie pomiarowe zostało w repo: `scripts/combat/bestiariusz-obraz.ts` wypisuje statystyki,
  umiejętności i efekty statusowe prosto z `MONSTERS`, licząc status trzema drogami (umiejętność,
  `basicFx`, cecha pokroju eksplozji). Wersja z jedną tylko drogą mylnie zgłaszała 21 potwory „bez
  statusu", poprawna liczba to 14.

### 3. Pokonanie gracza kosztuje 10 % postępu do następnego poziomu

- Decyzja właściciela: „Smierc: Strata 10% doswiadczenia”. Zaimplementowane jako `DEATH_XP_LOSS = 0.1`
  w `src/game/session.ts`; kara liczona od `player.xp`, który jest licznikiem **wewnątrz** poziomu, więc
  śmierć nigdy nie cofa poziomu ani nie rusza ekwipunku.
- Komunikat mówi, ile faktycznie ubyło (`Tracisz N doświadczenia`), a przy zerowym postępie nie kłamie —
  nie ma kary zerowej w tekście. Zdolność „Ostatni Płomień” (`saveFromDeath`) nadal wyprzedza śmierć,
  więc jej nie kasuje.
- Test: `src/test/combat-v3.test.ts` → „defeat costs 10% of the progress to the next level, and nothing
  when there is none” (poziom 5, `xp` 200 → 180 i poziom bez zmian; poziom 3, `xp` 0 → 0 i brak wzmianki
  o doświadczeniu).
- Wiadomo i zostawione świadomie: arena treningowa nie jest strefą bezpieczeństwa, więc śmierć od
  tarczy treningowej też teraz kosztuje. Do decyzji właściciela, czy to zmienić.

### 4. Każdy potwór bestiariusza ma własny efekt statusowy

- Właściciel: „Potwory musza miec jakies swoje umiejetnosci: spowalnianie, paraliz, oslepienie”.
  Wcześniej **14 z 40** potworów nie nakładało na gracza nic poza obrażeniami — w tym osiem z dziesięciu
  maszyn Nexus-9. Teraz: **0 z 40**, a w użyciu wszystkie 16 efektów słownika (`slow`, `root`, `stun`,
  `fear`, `silence`, `blind`, `fog`, `jam`, `weaken`, `armorDown`, `mark`, `breakShield`, `pull`,
  `poison`, `burn`, `bleed`).
- Dopisane do istniejących umiejętności i do ciosu podstawowego, dobrane do archetypu i **wagą proporcjonalną
  do ostrzeżenia**: ogłuszenie tylko tam, gdzie telegraf ≥500 ms (`Cios młotem` strażnika ruin 1000 ms →
  0,7 s; `Miażdżenie` golemu 1500 ms → 0,9 s; `Cios impulsowy` strażnika rdzenia 600 ms → 0,5 s),
  `silence` na `Wyładowaniu plazmy` z telegrafem 2500 ms, a krótkie lub brak telegrafu dostaje efekty
  niesprawdzające kontroli: `bleed`, `burn`, `mark`, `slow`, `weaken`, `armorDown`, `blind` przez `basicFx`.
- Żaden efekt nie był nową mechaniką silnika — wszystkie miały już konsumenta, sprawdzono przed pisaniem
  danych: `speedMul`, `cannotMove`, `cannotAct`, `silenced`, `rollMiss`, `markPct`, `armorPct` → buff
  `defPct`, `weakenPct` → buff `dealtPct`, `jammed` → minimapa, `fogPct` → nakładka w HUD.
- Testy zachowania trzech potworów (`korzeniowy pełzacz`, `bursztynowa osa`, `wieżyczka`) wymagały nowego
  pomocnika `ticksAlive`, bo podkręcone ataki zabijały gracza w środku próby, a śmierć wywołuje
  `cancelCombat()` i rozprasza potwory do domu. To nie jest obejście regresji — przedmiotem tych testów
  jest cykl potwora, nie utrzymanie gracza przy życiu.

### 5. Ranga statystyk bestiariusza od poziomu potwora

- Właściciel: „jesli gracz nie ma problemu z nimi to trzeba podkrecic statystyki potworow”. Zmiana poszła
  przez źródło, nie przez plik generowany (reguła z `AGENTS.md`): `art/production/enemies/roster.json` →
  `python3 scripts/gen-monster-base.py` → `prettier`.
- Rampą od poziomu potwora: 1–4 → HP ×1,5 ATK ×1,3 DEF ×1,15; 6–10 → ×1,9 ×1,8 ×1,2; 12–18 → ×2,2 ×2,3
  ×1,25. **`xp` bez zmian** — to osobna decyzja właściciela, patrz punkt 6.
- Test `monsters.test.ts` pilnuje, że liczby w kodzie są liczbami z rostera („every roster entry has a
  definition with identical statistics”) — przechodzi, więc ranga nie mogła rozjechać się z generatorem.
- Siedem testów modelu obrażeń miało zamrożone `DEF`/`ATK`/`HP` konkretnych potworów, mimo że ich nazwa
  obiecuje badanie **wzoru**. Podpięte pod `monsterDef(...).def/.atk/.hp`: wzór nadal jest pilnowany, a
  liczby ma pod opieką osobny test rostera. Bez tego każdy przyszły bilans wymagałby przepisania testów.

### 6. Dokument tematyczny zsynchronizowany ze źródłem

- `docs/ROZWOJ-I-WALKA.md`: sekcje „Statystyki” i „Umiejętności” wszystkich 40 potworów przepisane z
  rostera (54 wiersze), więc opis nie minął się z regułami; do „Obowiązujących reguł” dodane dwie pozycje —
  kara śmierci i rampa bestiariusza z mnożnikami.
- Pomocnik synchronizacji: `/workspace/.qwen/qa/synchronizuj-dokument-potwory.py` (poza repo, jednorazowy).

### 7. Efekt pomierzony ponownie i konsekwencja, której nie zamiatam

- Ten sam zamiat, te same ziarna: **22 272 walk przed i po**.
- `bare-basic`: mediana `winRate` 1,000 → **0,000**; scenariusze pewne wygranej 83 % → 44 %; śmierć gracza
  12 % → **50 %**. `equipped-skills-potions`: pewna wygrana 98 % → 77 %, śmierć 1 % → **18 %**.
- Pojawił się gradient, którego wcześniej nie było: wynik zależy teraz od tego, co gracz ma i czego używa
  (44 % → 53 % → 77 % scenariuszy wygranych pewnie), a nie tylko od tego, czy w ogóle kliknął.
- Rozłożenie po poziomach potworów (profil sprzęt + umiejętności): pasma 1–6 **bez zmiany wyniku**
  (wygrana 1,00, śmierć 0 %, walka 1,8 s → 3,0 s), pasma 7–12 śmierć 2 % → 12 %, pasma 13–18 śmierć
  0 % → 37 %. Start gry pozostał przystępny, końcówka wymaga grania.
- Liczby z symulatora są konserwatywne: bot stoi, nie unika i nie pozycjonuje się, a unikać teraz można
  (telegrafy ≥500 ms przy ogłuszeniach). Realnie będzie łatwiej niż tu zmierzone.
- **Konsekwencja do decyzji właściciela:** mediana XP/h dla profilu ze sprzętem i umiejętnościami spadła
  z 8351 do 4944 (−41 %), a dla gołego gracza z 5555 do 0, bo ginie. Walki trwają ~1,8× dłużej i śmierć
  zabiera postęp. Jeśli tempo rozwoju ma zostać jak było, trzeba podnieść `xp` w rosterskim bestiariuszu
  (o ~1,5×) — nie robię tego bez decyzji, bo to ekonomia, nie mechanika.
- Bramka: `npm run lint` exit 0 (0 błędów), `npm run typecheck` exit 0 przy
  `NODE_OPTIONS=--max-old-space-size=1700` (limit cgroup kontenera znowu wynosi 2 GiB, nie 4 GiB —
  `memory.max` = 2147483648 po przebudowaniu), `npm test` 1230 przechodzi / 10 pominiętych; jedyne
  potknięcie to test z punktu 4, naprawione i potwierdzone powtórnym przebiegiem (116 testów w trzech
  plikach walki, wszystkie na zielono).
