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

### 4. NPC dla czterech ras: przewodnik, kowal, depozytariusz, karczmarz, zarządca i strażnik

- Z filmów obrotu dostarczonych przez właściciela (zapisane w `art-wip/gemini-anim-stages/npc-<rola>-<nazwa>-obrot.mp4`) powstało sześć
  nowych postaci: Przewodniczka (`guide`), Kowal (`smith`), Depozytariuszka (`keeper`), Karczmarka (`innkeeper`), Zarządca (`steward`)
  i Strażnik (`warden`). Skrypt `scripts/anim/npc_role_build.py` (uogólniony `npc_trainer_build.py`): po jednej pozie na kierunek z filmu
  (filmy naprawdę obracają się w obie strony, więc lewe strony to prawdziwe klatki, nie lustra), matowanie rembg, jedna skala na postać, oddech
  z dwóch póz w 8 klatkach idle, `walk` na tych samych klatkach. Napis spod stóp w filmach odpada (zostaje tylko największy kształt).
- Każda postać ma cztery wersje: Pyra (Legendy) w oryginalnych kolorach z filmu, Verdantia zielona, Aetheria turkusowa, Nexus-9 niebieska
  (przekolorowanie ubioru; skóra, włosy, buty i zbroja zostają; Przewodniczka, Strażnik i Zarządca zmieniają tylko ciemny materiał peleryny/szaty,
  Kowal skórę i fartuch). Zwykły NPC: komórki 128 px, rozmiar 96 (kontrakt importu; tylko Trener jest rysowany 2× z komórek 256 px).
  Paczki `npc-<świat>-<rola>` 1.0.0, binding `<świat>.npc.<rola>`, atlas ok. 0,4 MiB.
- Role bez filmu (`hunter`, `merchant`, `alchemist`) zostają wspólną postacią zastępczą `human-v2`. Trener bez zmian.
- Weryfikacja w grze (Playwright, start w każdym z czterech światów): załadowane tekstury `npc-<świat>-{guide,innkeeper,keeper,smith,steward,trainer,warden}`,
  zero błędów konsoli; zrzut startu Pyry z Przewodniczką Kaeną. Test `npc-roles-visual` (6 ról × 4 światy, 8 kierunków, rozmiar 96) i
  `stream-texture-budget` zielone.
