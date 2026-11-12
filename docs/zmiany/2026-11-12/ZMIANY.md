# Zmiany 12.11.2026

### 1. Animacje etapu 2 (reakcje) i lustrzane widoki boczne — cztery rasy

- Z filmów `<rasa>-etap2-reakcje.mp4` (Android: `-v2`, Planetar: reakcje w 10–20 s pliku) wycięto `hitheavy`
  (8 klatek, 12 kl./s: odrzut, potknięcie, przyklęk, powrót) i `victory` (8 klatek, 10 kl./s: gest zwycięstwa).
  Skrypt `scripts/anim/reactform_build.py` (atlas `<paczka>-fight-3`, efekty z filmu zachowane jak w etapie 1).
- Silnik: stany `hitheavy` (priorytet jak trafienie) i `victory`; `mountGame` gra `hitheavy`, gdy cios zabiera co
  najmniej 15% maks. życia bohatera, a `victory` przy awansie na poziom.
- Tekstury: klipy z widoku bocznego trzymały prawą stronę i jej lustro. Nowe pole klipu `mirrored` (kierunki rysowane
  jako odbicie, `sprite.setFlipX`, przenoszone też na obrys i ducha bohatera) i `scripts/anim/dedupe_mirror.py`
  (usuwa lustrzane kopie tylko, gdy widoczne piksele są identycznym odbiciem) zmniejszyły atlasy o 13–16 MiB na rasę.
  Paczki bohaterów `2.8.1`; najwyższy świat (Verdantia z cache terenu) 107,1 z 128 MiB mimo nowych klipów.
- Weryfikacja w grze (arena, próbnik klatek, bohater zwrócony w lewo): `hitheavy 00–07` i `victory 00–07` dla czterech ras,
  klipy etapu 1 (`skillb`, `dodge`, `guard`) po odbiciu stoją na swoim cieniu i patrzą w stronę celu; zero błędów konsoli.
  Wywołanie z gry (cios ≥ 15% życia, awans) sprawdzone kodem i testem typów, w przeglądarce klipy uruchomiono bezpośrednio.

### 2. Animacje etapu 3 (ruch) — bieg, kanał, skill C, interakcja — cztery rasy

- Z filmów `<rasa>-etap3-ruch.mp4` (Android: `-v2`, Planetar: sekundy 20–30) skrypt `scripts/anim/moveform_build.py`
  wycina do atlasu `<paczka>-fight-4`: `run` (8 klatek, 16 kl./s, pętla jednego okresu kroku: Legenda 10, Android 19,
  Mędrzec 41, Planetar 17 klatek filmu), `channel` (8 klatek, 10 kl./s, pętla tam i z powrotem bez końcowego wybuchu),
  `skillc` (8 klatek, 12 kl./s) i `interact` (6 klatek, 10 kl./s). Lustrzane kopie usunięte (`dedupe_mirror.py`).
  Paczki bohaterów `2.9.1`; Verdantia 112,9 z 128 MiB.
- Poprawki matowania w tym skrypcie: wygaszanie przy bocznych krawędziach kadru (pionowy film Androida jest węższy
  od komórki 256 px, błysk i kurz były ucięte prostą krawędzią) i kolor→alfa dla białych smug ruchu dalej niż 4 px od
  kolorowej postaci (skok Androida miał biały prostokąt). Kanał Androida i Mędrca kończy się przed wybuchem.
- Silnik: `session.running` (prędkość ≥ 1,5× prędkości rasy z poziomu 1, `RUN_SPEED_RATIO`; sam poziom daje to od 12)
  wybiera `run` zamiast `walk` (Tryb KI zostaje przy `kiwalk`); zdarzenie `channel` bohatera trzyma `channel` przez
  czas kanału (ruch je kończy); techniki drzewka C z atakiem (`attack`, `burst`) i szarże do wroga z polem
  prezentacyjnym `charge` (Legenda A4, Planetar B4) grają `skillc` (w Trybie KI `kiskill`); podniesienie łupu gra
  `interact`; `guard` z tarczy dodanej przez technikę (Planetar B7 przy B4) nie przerywa jej pozy.
- Weryfikacja w grze (próbnik klatek, poziom 20): bieg klawiszami w prawo `run/right 01–05`, w lewo ten sam pasek
  rysowany lustrem, ciągły cykl 00–07 — cztery rasy; polecenia z gry: Legenda C1 i A4 → `skillc 00–07`, Android C1 →
  `skillc 00–07`, Mędrzec C1 → `channel` 00–07 w pętli przez kanał, Planetar B4 → `skillc 00–07` (wcześniej nadpisywał
  go `guard`), Planetar C1 (leczenie) → `skill`; `channel` (wywołany z czasem 1,5 s) i `interact` 00–05 dla czterech
  ras; zero błędów konsoli. Podniesienie łupu nie było klikane w przeglądarce (sprawdzone kodem i testem typów).
- Testy: `actor-animation` (bieg, kanał z czasem i ruchem, skill C, tarcza przy szarży), `gpu-pipeline` (22 klipy,
  1280 odwołań do klatek, atlas `-fight-4`); `npm run typecheck`, eslint czyste; pełny vitest 1317 zielonych,
  2 czerwone w `development-etap1-assets` (sumy SHA-256 plików `art/production`, czerwone także bez tej zmiany).

### 3. Tryb KI: walka i reakcje w formie KI (Android, Legenda, Planetar, Mędrzec)

- Powód: w Trybie KI postać pokazywała w uniku, gardzie, trafieniu, śmierci i zwycięstwie zwykły strój. Teraz każda czynność ma klip formy KI,
  jeśli rasa go ma. Filmy: etap 4 (`<rasa>-etap4-walka-po-transformacji.mp4`) dla ciosów 2–3, skoku, uniku i gardy oraz nowe filmy reakcji formy KI
  (`android-`, `legend-`, `planetary-etap5a-reakcje-ki.mp4`; SHA-256 w repo: Android `ef4b9e46…0340`, Legenda `0b211bda…8405`, Planetar `561ef79e…a11b`).
- Nowe klipy (`scripts/anim/kicombat_build.py`, atlasy `-kifight-1` i `-kifight-2`): `kiattack2`, `kifinisher` (nie Planetar), `kiskillb`, `kidodge`,
  `kiguard` dla czterech ras; `kihit`, `kihitheavy`, `kideath`, `kirespawn`, `kivictory` dla Androida, Legendy i Planetara. Mędrzec nie ma filmu
  reakcji: jego trafienie, śmierć, wstawanie i zwycięstwo w Trybie KI zostają klipami formy bazowej (nic ich nie zastępuje po cichu).
- Silnik: łańcuch ciosów w Trybie KI `kiattack2` → `kifinisher` → `kiattack`; klip jednorazowy zostaje w formie, w której go uruchomiono
  (śmierć i wstawanie w Trybie KI zostają w formie KI nawet po końcu buffa `T`); skill B gra `kiskillb`.
- Matowanie: dla klatek w powietrzu zmniejszenie względem linii podłoża (głowa nie jest ucięta); leżące ciało szersze niż komórka mieści się w niej
  i nie blednie przy brzegu; zabezpieczenie, gdy matowanie anime gubi leżącą postać (maska ogólna). Pierwsze 0,5 s filmu Legendy (zbliżenie) pominięto.
- Paczki bohaterów `3.0.2`. Verdantia (Planetar): 121,5 z 128 MiB tekstur, Aetheria 103,9, Nexus 99,2, Pyra 102,4.
- Weryfikacja w grze (Playwright, próbnik klatek, poziom 20, po rzucie `T`): łańcuch ciosów `kiattack2 > kifinisher > kiattack` (Planetar:
  `kiattack2 > kiattack`); unik wywołany poleceniem gry `kidodge`; `kiskillb`, `kiguard`, `kihit`, `kihitheavy`, `kideath`, `kirespawn`, `kivictory` dla
  Androida, Legendy i Planetara; Mędrzec: `kidodge`, `kiskillb`, `kiguard` formy KI, a `hit`, `hitheavy`, `death`, `respawn`, `victory` bazowe; zero błędów
  konsoli. Trafienie, ciężkie trafienie, skill B, garda i zwycięstwo wywołane bezpośrednio z kodu animacji, a śmierć wymuszona parametrem `dead`
  (bohater w teście nie ginął od potwora).
- Testy: `actor-animation` (łańcuch KI, klipy formy KI, śmierć po końcu buffa, brak klipu = klip bazowy), `gpu-pipeline`; typecheck i eslint czyste.

### 4. Ekonomia przedmiotów: drop tylko słabe (2%), sklep słabe 4×, lepszy sprzęt z craftu (265 receptur)

- Decyzja właściciela: słabsze przedmioty do kupna za wygórowane ceny (trzeba pograć, zanim się kupi),
  słabsze też z rzadkiego dropu, a cały lepszy sprzęt z rozbudowanego craftu. Wdrożone do `GameSession`
  (nie tylko specyfikacja). Pełny opis z formułami i pomiarem:
  [Fabuła i ekwipunek — ekonomia przedmiotów](../../FABULA-I-EKWIPUNEK.md#ekonomia-przedmiotów--drop-sklep-i-crafting-wdrożone-12112026).
- **Drop:** `DROP_RARITIES = [common, uncommon]`, `DROP_CHANCE = 0.02` (było 0.08 i wszystkie rzadkości).
  Pula słabych przedmiotów z kontynentu potwora w oknie `[poziom−3, +5]`, ważone rzadkością; minione nie
  losują. Lepszy sprzęt (rare/epic/legendary) nigdy nie dropi. 16 z 40 potworów ma pustą pulę (słabe
  przedmioty są niskopoziomowe) — celowe. `src/game/items/loot.ts`.
- **Sklep:** kupiec sprzedaje tylko słabe (`isShopItem`, bez materiałów i questów) po
  `shopPrice = max(ceil(cena×4), poziom×60)` (`SHOP_MARKUP = 4`); zakres 60–840 monet. 4 przedmioty legacy
  (mikstura/kieł/miecz/kamizelka) zachowują ceny. Lepszy sprzęt odrzucony komunikatem. Gałąź kupna V2 w
  `src/game/session.ts`.
- **Crafting:** `CRAFTING_RECIPES = 140 bazowych + 125 generowanych = 265`; wygenerowane `rec-gen-*`
  pokrywają wszystkie 226 lepszych przedmiotów (226/226). Handler `craft` waliduje poziom, składniki
  (materiały z `p.materials`, reszta z `p.bagItems`) i złoto, zużywa je i wydaje wynik; przy pełnym plecaku
  zwraca składniki i monety. Koszt: rare 50 / epic 150 / legendary 400 + poziom×10; składniki 2/3/4.
  `recipes.ts` + `recipes.extra.ts` (generowane) + `scripts/gen-item-recipes.ts`.
- **Liczby z pomiaru** (`tsx` importujący kod): katalog 366 (202 ze statami), słabe dropiące 128, słabe
  w sklepie 85, lepsze tylko z craftu 226, materiały z potworów 57. Złoto za kill `[poziom, 3×poziom]`,
  sprzedaż materiału `round(2 + 1.5×poziom)`.
- **Dokumentacja:** nowy dokument projektowy ekonomii, sekcja „wdrożone 12.11.2026" w FABULA §05,
  aktualizacja INDEX (366 przedmiotów / 265 receptur zamiast 177/94) i README katalogu V2.
- Testy: nowe `src/test/item-economy.test.ts` (10), `catalog-loot.test.ts` przepisany na słabe (12),
  `items.test.ts` receptury `>=140`. Bramka pełna: **lint 0, typecheck 0, test 0, build 0**; testy ekonomii
  30/30. Scalono z `origin/main` (animacje CODEX, PR#149) — `session.ts` bez konfliktu (craft/handel vs
  `running`/`charge` w innych regionach).
- Nie zrobiono / nie sprawdzono: balans (2%, 4×, min poziom×60) to parametry startowe, nie były strojone
  zabawą na telefonie właściciela; handler `craft` nie wymaga bliskości stacji (`station` to atrybut
  receptury); brak pomiaru w przeglądarce na urządzeniu docelowym (zmiany logiki, nie oprawy). Drzewka
  umiejętności (CODEX) i wzmocnienie potworów (wstrzymane) poza tym systemem.

### 5. NPC dla czterech ras: przewodnik, handlarz, kowal, depozytariusz, karczmarz, zarządca i strażnik

- Z filmów obrotu dostarczonych przez właściciela (`art-wip/gemini-anim-stages/npc-<rola>-<nazwa>-obrot.mp4`) powstało siedem nowych
  postaci: Przewodniczka (`guide`), Handlarka (`merchant`), Kowal (`smith`), Depozytariuszka (`keeper`), Karczmarka (`innkeeper`),
  Zarządca (`steward`) i Strażnik (`warden`). Skrypt `scripts/anim/npc_role_build.py` (uogólniony `npc_trainer_build.py`): po jednej pozie na
  kierunek z filmu (filmy obracają się w obie strony, więc lewe strony to prawdziwe klatki, nie lustra), matowanie rembg, jedna skala na postać,
  `walk` na tych samych klatkach co `idle`. Napis spod stóp w filmach odpada (zostaje największy kształt).
- Każda postać ma cztery wersje: Pyra (Legendy) w oryginalnych kolorach z filmu, Verdantia zielona, Aetheria turkusowa, Nexus-9 niebieska
  (przekolorowanie ubioru; skóra, włosy, buty i zbroja zostają; Przewodniczka, Strażnik i Zarządca zmieniają tylko ciemny materiał).
- **Większe i ostrzejsze (uwaga właściciela):** klatki 256 px (wcześniej 128), rysowane 150 jednostek (`enlargedNpcs` w `catalog.ts`, jak
  powiększeni bohaterowie): wyższe od bohatera (133), niższe od Trenera (192); we wnętrzach ×1,6. Paczka zachowuje rozmiar kontraktu 96;
  importer (`gpu-import.ts`) dopuszcza dla NPC komórki 128 albo 256. Zmierzone w grze: 150 / bohater 133 / Trener 192.
- Pamięć: komórki 256 px kosztują ok. 0,7–1 MiB na postać, więc NPC stoją na jednej pozie (bez oddechu; oddech ma tylko Trener). Atlasy
  `npc-<świat>-<rola>` 1.2.0. **Verdantia ma 127,6 z 128 MiB tekstur** (zapas 0,4 MiB): kolejne duże zasoby w tym świecie wymagają odchudzenia.
- Role bez filmu (`hunter`, `alchemist`) zostają wspólną postacią zastępczą `human-v2`. Trener bez zmian.
- Weryfikacja w grze (Playwright): załadowane tekstury `npc-<świat>-{guide,innkeeper,keeper,merchant,smith,steward,trainer,warden}`, zmierzone
  wysokości, zero błędów konsoli; zrzut startu Pyry z Przewodniczką Kaeną. Test `npc-roles-visual` (7 ról × 4 światy, 8 kierunków, rozmiar 150) i
  `stream-texture-budget` zielone.

### 6. Rozwój czterech ras — funkcje świata i późne wyprawy (PR #145)

Gałąź: `feature/development-remaining-trials-20261111`.
[PR do audytu](https://github.com/circus574-cpu/pixel-playground-launch/pull/145).
Badany kod mechaniki i macierzy: `02cf8bb9ceb0e478e6a189a032f305b5f1f6079c`.
Późniejsza korekta obejmuje wyłącznie CSS celu i mocniejszą asercję układu;
sumy źródeł końcowej prezentacji zawiera manifest QA. Baza mechaniki: `main@f0c5b4c8`; dodatkowo zachowano zmianę globusa
z `main@6105d450` (bez zmian plików mechaniki względem badanego kodu).
Nie scalono do main i nie opublikowano gry.

#### Zakres wykonany

| Funkcja | Stan przed dostawą | Zmiana | Dowód działania |
| --- | --- | --- | --- |
| Próby czterech ras | Niepełny katalog | 48 prób, 144 stopnie, legalne odblokowania 12 wariantów i 6 modułów | Test każdego stopnia i transakcji właściciela; wcześniejsze materiały w dzienniku 11.11 |
| Dziedziny w świecie | Brak zastosowań poza salą | 48 fizycznych aktywności przy istniejących obiektach; checkpointy, kanały, pomiary, rozgałęzienia, eskorty i obrona | 48 pozytywnych przypadków jednostkowych; rzeczywiste punkty v2 na czterech kontynentach; przeglądarka |
| Księga Zrozumienia | Brak systemu fragmentów | 12 fragmentów z poznanych źródeł i zapisanych decyzji, bez ujawniania przyszłych rozdziałów | Test odblokowania, źródeł i odczytu |
| Przeciwnicy 21–40 | Brak aktywnych wariantów | 32 instancje wariantów 8 istniejących gatunków, oddzielna wiedza, oryginalne atlasy | Test wszystkich definicji/wzorów; zachowane kanoniczne definicje bestiariusza |
| Wyprawy | Brak układów | 48 wypraw: samotny ciężki, para, trzy fale obrony; własny ekwipunek i rzeczywista walka | 48 ukończeń w GameSession oraz wejścia do wszystkich formacji na rzeczywistej geometrii |
| Bezpieczeństwo wejścia | Odmowa startu w walce bez wyjaśnienia | Widoczny komunikat i wyłączony start, dopóki trwa starcie | Test prawdziwego trafienia i odblokowania po walce; Nexus Software WebGL |
| Zapis | Rozwój v3, klasyczny v10, Superior v6 | Rozwój v4, klasyczny v11, Superior v7; puste nowe pola, kopie przed migracją, CAS i odmowa przyszłych danych | Migracje, round-trip, awaria storage, drugi pisarz i reload w przeglądarce |
| Streaming i HUD | Tymczasowe atlasy mogły być niegotowe; brak celu nowych aktywności | Ograniczone dzierżawy atlasów, oczekiwanie na gotowe klatki; cel między obszarami sterowania i zakładki Świat/Wyprawy | Test cyklu życia zasobów, Canvas/WebGL, pomiar położenia i zrzuty 852×393 |

Kontakty wymagają faktycznie zdobytej rangi i wcześniejszego etapu. Przycisk
„Podejdź” używa zwykłej nawigacji/drzwi; nie teleportuje do zaliczenia.
Wynik aktywności pochodzi z kontrolera i rzeczywistych wejść, nie przycisku
administracyjnego. Rozwój postaci korzysta z dotychczasowych statystyk i jednego
silnika walki. Nie zmieniono kanonicznych węzłów, liczb bestiariusza, geometrii,
produkcji, GPU ani prywatnego `/test`.

Cel wyprawy nie daje dodatkowej praktyki ani powtarzalnej nagrody. Zwykły XP
za pokonanie jest zapisywany atomowo z poznaniem wariantu; przy błędzie zapisu
pozostaje kolejka ponowienia. Usunięcie wyprawy sprząta wyłącznie własnych
aktorów. Nawigacja bojowa i eskorty wykluczają bezpieczne miasta.

#### Wyniki kontroli

- Pełny TypeScript aplikacji/e2e/tools: **PASS**; źródła TS mechaniki po korekcie układu bez zmian.
- Pełny Vitest: **1878 PASS / 0 FAIL / 10 SKIP**. Pominięte przypadki wymagają
  osobnego PostgreSQL (`KI_ACCOUNTS_TEST_DATABASE_URL`); nie zaliczono ich jako PASS.
- Lint: **0 błędów / 15 istniejących ostrzeżeń**. Zasoby i produkcyjny build: **PASS**.
- Dokumentacja: **10 podręczników, 21 dzienników**, linki i chronione źródła: **PASS**.
- Przeglądarka na bazowym kodzie `02cf8bb9`: **Canvas 4/4, Software WebGL 4/4**,
  cztery rasy, 852×393, rzeczywiste aktywności i wyprawy, zachowanie wyniku po reload,
  zero `pageerror`. Testy używają jawnie przygotowanych warunków późnej fazy gry.
- Przegląd zrzutów po tym przebiegu wykrył nakładanie paska przeciwników na cel.
  Finalny pasek celu przeniesiono na dół pomiędzy obszary sterowania. **Dodatkowa
  regresja końcowego CSS: Canvas 1/1, Software WebGL 1/1**, z mocniejszą asercją
  odstępu od menu i paska przeciwników; pełna aktywność, walka i reload nadal działają.
  Nie liczymy tej powtórki jako dwóch kolejnych unikalnych scenariuszy czterech ras.
- Oryginalny, nieosłabiony scenariusz **TP03 Legend w Software WebGL: 1/1 PASS**:
  prawdziwa próba, jednorazowa nagroda i reload. Dawny problem wejścia do menu
  w tym scenariuszu nie odtworzył się na nowszej bazie.

Aktualny układ: [Canvas](qa/development-world/planetary-canvas.png),
[Software WebGL](qa/development-world/planetary-webgl.png).
Oryginalne nagrania końcowej regresji: [Canvas WebM](qa/development-world/planetary-canvas.webm),
[WebGL WebM](qa/development-world/planetary-webgl.webm).
Pliki `baseline-*` przedstawiają wcześniejszy, uczciwie oznaczony przebieg 8/8
sprzed korekty CSS. Nie są zrzutami aktualnego położenia paska celu.

Bramka GitHub Actions jest uruchamiana po wypchnięciu gałęzi; stan i właściwy SHA
należy sprawdzić w [Checks PR #145](https://github.com/circus574-cpu/pixel-playground-launch/pull/145/checks).
Nie przypisujemy lokalnym testom wyniku z zewnętrznego CI.

Surowe wyniki i mapowania: [manifest QA](qa/development-world/acceptance.json),
[48 aktywności](qa/development-world/fieldwork.csv),
[48 wypraw](qa/development-world/expeditions.csv),
[144 stopnie prób](qa/development-world/trial-grades.csv).

#### Balans — obliczenia, nie zmiana kanonu

Rzeczywisty GameSession/Kit/MonsterSystem, stały krok 50 ms, 1944 profile × 8
ziaren = 15 552 walki. Rasy × poziomy 1/10/20/30/40 × trening 0/40/90 stopni
× legalne gałęzie A/B/C × wyposażenie brak/start/katalog × bliscy poziomem
przeciwnicy, w tym wszystkie 32 późne warianty.
[Założenia i podsumowanie](qa/development-world/balance-summary.json),
[macierz](qa/development-world/balance.csv).

Punkty drzewka, trening i sprzęt są zadeklarowanymi warunkami izolowanego
porównania. Nie są dowodem ich zdobycia przez naturalnie rozwijaną postać.
Każda walka zaczyna z trzema miksturami; nie jest to model ich trwałego zaopatrzenia.
Podróż 15/30/60 s, interakcja 5 s oraz regeneracja 0,3% HP/s są osobną analizą
wrażliwości, a nie zmierzonym czasem czytania i kampanii.

| Poziomy postaci w próbce | Sprzęt | Profile | Średni udział wygranych | Mediana czasu zwycięskiej walki |
| --- | --- | ---: | ---: | ---: |
| 1 / 10 / 20 | brak | 288 | 81.6% | 4.90 s |
| 1 / 10 / 20 | startowy | 288 | 85.4% | 3.35 s |
| 1 / 10 / 20 | katalogowy | 288 | 100.0% | 1.00 s |
| 30 / 40 | brak | 360 | 98.6% | 1.60 s |
| 30 / 40 | startowy | 360 | 99.4% | 1.20 s |
| 30 / 40 | katalogowy | 360 | 100.0% | 0.35 s |

Przejście 1→20 wymaga 12 160 XP, a 20→40 — 36 200 XP według obecnej krzywej.
Grupy tabeli dzielą pięć poziomów próbnych po poziomie 20; nie są testem każdego
poziomu ani pomiarem godzin przejścia.

Dane wykrywają przewagę legalnie wielokrotnie rozwiniętych węzłów i silnego
sprzętu. Właściciel powinien rozstrzygnąć, czy zachować obecne limity rang/sprzętu,
czy zlecić odrębne strojenie nowych wypraw. Nie zmieniono samodzielnie produkcyjnych
liczb. Sam średni/medianowy wynik nie dowodzi równego poziomu trudności ras.

#### Co pozostaje do odbioru

- Niezależna pełna regresja projektu i odbiór końcowego Actions na SHA gałęzi.
- Fizyczny Android/iPhone, sprzętowe WebGL i rzeczywisty jednoczesny multitouch.
- Przejście kampanii od poziomu 1 z naturalnie zdobytym ekwipunkiem i praktyką;
  pomiar ludzkiego czasu oraz docelowych zakresów 25–35 / 40–60 / 60–90 godzin.
- Decyzja właściciela o balansie mocnych konfiguracji i parametrach chronionego
  punktu nowej aktywności (prototyp: HP ciężkiego wariantu ×4, wymagane 50%).
- Osobna zgoda na scalenie i publikację po odbiorze.

Testy przeglądarkowe nowych treści używają jawnego fixture'a poziomu 40 i rang
jako warunków wejściowych. Nowe aktywności i wyprawy zaczynają puste; ich wyniki
muszą pochodzić z rzeczywistej gry i przetrwać reload. Nie przedstawiamy tego jako
pełnego przejścia kampanii ani jako testu fizycznego telefonu.

### 7. Nowe skalowanie premii drzewka — decyzja i pomiar

Osobna gałąź `feat/skill-rank-balance-20261112`, od `ad646c75` (PR #145).
Właściciel 12.11 zmienił regułę: połowa dotychczasowej premii za pierwszy punkt,
następne punkty po 10% wartości tej nowej bazy. [Zapis decyzji](../../design/data/rank-scaling-owner-2026-11-12.json).
Wymaganiem jest większa rola sprzętu; definicji, liczb i interfejsu ekwipunku nie zmieniano,
ponieważ pracuje nad nimi inny autor. Nie przyjęto docelowego czasu walki — właściciel chce
najpierw zobaczyć pomiar.

Wspólna reguła obsługuje cztery kity, bonusy statystyk, krytyka, regeneracji, kosztów,
tarcz, leczenia i zdolności. Dla obrażeń zachowano odniesienie do zwykłego ataku:
×1,8 staje się ×1,4, a serie dzielą nową sumę pomiędzy te same trafienia. Jest to
jawna interpretacja premii ponad podstawowy atak, przyjęta po odpowiedzi o roli sprzętu;
właściciel nie wybrał literalnie jednego z dwóch zaproponowanych mnożników.
Nie przepisano historycznego aneksu/generowanych danych. Nie ma resetu ani migracji
punktów; zapis nadal przechowuje te same całkowite rangi i ten sam ekwipunek.

Egzamin obrony zachowuje wcześniejszy stosunek siły ogłoszonego ciosu do tarczy
pierwszej rangi. Nie zmieniono jego okien, liczby sukcesów ani zasad przyznawania wyniku.
Testowy pilot walki wykonuje podstawowy atak i zwykły dash przez normalne polecenia;
nie zmienia HP, cooldownów, wyników ani przeciwników. Test wypraw wybiera słabszego
wroga jako pierwszy cel i utrzymuje dystans dla ras dystansowych. Wszystkie asercje
ukończenia, liczby pokonań, nagród i zapisu pozostają.

Pomiar używa prawdziwych `GameSession`, kitów, AI, kolizji i efektów, ze stałym krokiem
50 ms. Zestawy, punkty i początkowe ziarna są jednakowe między porównywanymi regułami.
Postacie 30–40 nie są porównywane ze starymi przeciwnikami poziomu 18; używa się
najbliższych poziomem późnych wariantów. Oddzielono scenę otwartą i próbę grupową
z przeszkodą. Rozkłady czasów, porażki, KI, mikstury i zaokrąglenia punktów są liczone
osobno; wynik automatu nie jest deklaracją czasu ludzkiej kampanii ani testem telefonu.

#### Wyniki końcowego pomiaru i kontroli

[PR #151](https://github.com/circus574-cpu/pixel-playground-launch/pull/151), Draft,
zależny od #145 (baza `feature/development-remaining-trials-20261111`).
Kod gry: `7732199f3aa602fb8625d0ba1396b1c9ff577413`.
Końcowy pomiar: czyste drzewo `2378c3948c34a8d3ac7a8ade770cd4f58e0a7756`;
drugi commit zmienia wyłącznie pilota pomiarowego, bez zmiany gry.
Pierwotną próbę grupową unieważniono: pilot ponawiał A* co 50 ms i resetował pierwszy
punkt trasy. Cały końcowy pomiar wykonano ponownie, ze zlecaniem pościgu co 300 ms.

**21 888 walk**, 2304 profile: 17 280 pojedynczych starć (poziomy 10/20/28/34/40,
6 porównywanych reguł, 8 ziaren) oraz 4608 prób grupowych z przeszkodą
(poziomy 20/40, 3 reguły, 32 ziarna). Wszystkie cztery rasy i gałęzie A/B/C.
Dodatkowo 216 par prób potwierdziło identyczne wyniki adaptera starej reguły
oraz niezależnego oryginalnego silnika `ad646c75`: wynik, czas, HP, KI, mikstury i casty.

Tabela pokazuje liczbę wygranych, ich udział i medianę czasu **wygranych prób**.
Nie wolno interpretować krótszego czasu jako poprawy, pomijając porażki.
Zestawy nie są optymalne ani naturalnie zdobyte; każdy izolowany pojedynek zaczyna
z trzema miksturami. Trening, specjalizacje i moduły są wyłączone; nie używa się T.
Grupa zmienia jednocześnie liczbę przeciwników i geometrię, więc nie izoluje samej przeszkody.

| Próba | Sprzęt | Stara reguła: wygrane, mediana | Nowa reguła: wygrane, mediana |
| --- | --- | --- | --- |
| Pojedynczy | Brak | 900/960 (93.75%), 2.70 s | 840/960 (87.50%), 7.50 s |
| Pojedynczy | Referencyjny | 928/960 (96.67%), 2.00 s | 912/960 (95.00%), 6.30 s |
| Pojedynczy | Katalogowy | 924/960 (96.25%), 2.00 s | 912/960 (95.00%), 6.00 s |
| Grupa + przeszkoda | Referencyjny | 721/768 (93.88%), 6.95 s | 544/768 (70.83%), 13.25 s |
| Grupa + przeszkoda | Katalogowy | 736/768 (95.83%), 6.45 s | 610/768 (79.43%), 12.72 s |

Rola sprzętu w przeżyciu jest widoczna, ale nie przyjęto docelowego czasu ani nie
uznano bilansu całej gry za zaakceptowany. Po zmianach katalogu przez drugiego autora
należy ponowić pomiar; przedmioty i zasady ich przyznawania nie były tu modyfikowane.

| Funkcja | Stan przed | Zmiana | Dowód |
| --- | --- | --- | --- |
| Premie czterech ras | Dotychczasowa premia × ranga | Połowa pierwszej, dalej +10% nowej bazy | Audyt węzłów i testy reguły w pełnym Vitest |
| Obrażenia aktywne | Cały mnożnik × ranga | Premia ponad zwykły atak; serie zachowują liczbę trafień | Audyt faktycznych trafień wszystkich kitów |
| Opisy i rangi | Opis pierwszej wartości i mnożnik rangi | Faktyczny procent i przyrost wybranego węzła | 8/8 testów nowej reguły Canvas/Software WebGL |
| Zapisy | Całkowite rangi i ten sam sprzęt | Bez resetu, refundu i zmiany formatu | Round-trip czterech ras i reload po 8 zakupach |
| Próby obrony | Cios 10% HP przy dawnych tarczach | Cios 5% HP zachowuje dawny stosunek do nowej tarczy | Pełne testy prób, te same kryteria sukcesu |

Przykład poziomu 10, osiem punktów w jednej pasywce, bez sprzętu/treningu:
Planetarni C2: +8,5%, HP 487; Mędrcy C2: +12,75%, KI 161;
Androidy B2: +6,8%, DEF 36; Legendy B3: +8,5%, HP 562.
Wartości podstawowe bez tej pasywki to odpowiednio 449/143/34/518.
Zaokrąglenia mogą dawać zerowy przyrost widocznego DEF po pojedynczym punkcie;
premia procentowa nadal narasta. [Krzywe poziomów 1–40](qa/skill-ranks/stat-curves.svg).

**Kontrole:** pełny TypeScript aplikacji/e2e/tools, lint 0 błędów / 15 istniejących
ostrzeżeń, assets, dokumentacja i produkcyjny build — PASS; Vitest **1916 PASS,
0 FAIL, 10 pominiętych testów PostgreSQL**.
[Zielone Actions kodu gry](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/43178802277).
Po korekcie wyłącznie narzędzia powtórzono pełny TypeScript, lint i 38 testów reguły/modeli — PASS.

Playwright na kodzie gry: **14 PASS / 2 FAIL**. Nowa reguła, zakupy ośmiu rang,
zgodność statystyk HUD i reload: **8/8**, cztery rasy × Canvas/Software WebGL,
dotykowy viewport 852×393. Dodatkowe umiejętności w starym świecie: 6/8.
Obie porażki dotyczą Planetarnych: po odczycie fixture'a w Superior v1 pojawia się
„Nie udało się wczytać fragmentu świata”. Ten sam scenariusz Canvas odtworzono
na oryginalnej wersji `ad646c75` — identyczny błąd ładowania, przed zmianą balansu.
Nie oznaczamy całego Playwright jako zielonego. Dokładna przyczyna w streamerze
pozostaje do ustalenia przez autora świata; jego plików nie edytowano.
Fizyczny telefon, sprzętowe WebGL i ludzka kampania pozostają niezweryfikowane.

Dowody: [manifest pomiaru](qa/skill-ranks/measurement.json),
[surowe walki](qa/skill-ranks/raw-trials.json.gz),
[tabela wyników](qa/skill-ranks/summary.csv), [pełne profile](qa/skill-ranks/profiles.csv),
[porównanie sparowanych ziaren](qa/skill-ranks/paired.csv),
[wykres walk](qa/skill-ranks/combat-comparison.svg),
[weryfikacja oryginalnego silnika](qa/skill-ranks/legacy-verification.json),
[Vitest](qa/skill-ranks/unit-tests.json.gz),
[Playwright](qa/skill-ranks/browser-regression.json.gz),
[odtworzenie starej usterki](qa/skill-ranks/browser-original-baseline.txt),
[zrzut Planetarnego](qa/skill-ranks/canvas-planetary-rank-eight.png),
[nagranie Canvas](qa/skill-ranks/planetary-gameplay.webm),
[nagranie Software WebGL](qa/skill-ranks/planetary-software-webgl.webm).
Zrzuty i nagrania pochodzą z rzeczywistej aplikacji, wykresy z zapisanych prób silnika.

Nie scalano do main i nie publikowano gry. Błąd starej sceny pozostaje otwarty;
nie zmieniano świata, assetów, sprzętu, zadań ani infrastruktury GPU.
