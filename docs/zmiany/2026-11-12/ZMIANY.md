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
  [design/EKONOMIA-PRZEDMIOTOW-2026-11-12.md](../../design/EKONOMIA-PRZEDMIOTOW-2026-11-12.md).
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

