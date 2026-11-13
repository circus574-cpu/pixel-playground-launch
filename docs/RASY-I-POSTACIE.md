# KI Legends — rasy i postacie

Stan bieżący: 05.11.2026 (`main@f2625549`); paczki bohaterów `2.1.0` z klipem `kiwalk` opisano niżej, reszta sekcji pochodzi z 29.10.2026. Integracja nie zmienia zatwierdzonych tożsamości, nazw kontynentów ani obecnych paczek bohaterów HD. Rozwój ras i nowe parametry treningu są w main, lecz dalsze rozdziały i próby pozostają nieukończone. Liczby, wyposażenie i zasady wzrostu: [rozwój i walka](ROZWOJ-I-WALKA.md). Historyczne checkpointy grafik poniżej zachowują własne daty i wersje.

## Cztery tożsamości

| Rasa       | Świat / ID            | Wygląd i rola                                                                                               |
| ---------- | --------------------- | ----------------------------------------------------------------------------------------------------------- |
| Planetarni | Verdantia / `verdant` | Żywa energia świata; zieleń, ochra, bursztyn, skóra i tkaniny. Mobilny wojownik wręcz; Adaptacja do terenu. |
| Mędrcy     | Aetheria / `aether`   | Męska postać, biel, szmaragd, złoto, szaty i rytualne ozdoby. Dystans, bariery i wsparcie; Kręgi światła.   |
| Androidy   | Nexus-9 / `nexus`     | Srebro, grafit, elektryczny błękit, pancerz i rdzeń. Precyzyjny strzelec z osłonami; Ładunek Rdzenia.       |
| Legendy    | Pyra / `pyra`         | Czerń, karmazyn, stal, szarfy i ogień. Zwarcie i duża siła krótkiej kombinacji; Żar.                        |

Oryginał właściciela: PDF w `docs/design/`, strony 4/5/6/7 odpowiednio dla ras,
strona 8 dla skali/świata. Ilustracje są referencjami, nie gotowymi animacjami ani
potwierdzeniem komercyjnych praw. Szczegóły: [licencje](LICENCJE.md).

## Aktualni bohaterowie runtime — 29.10.2026 (paczki 2.1.0 od 05.11.2026)

| Rasa       | Aktor                    | Aktywna paczka / wersja                    |
| ---------- | ------------------------ | ------------------------------------------ |
| Planetarni | `hero-planetary-painted` | `hero-planetary-painted-walk-v3` / `2.1.0` |
| Mędrcy     | `hero-sage-painted`      | `hero-sage-painted-walk-v3` / `2.1.0`      |
| Androidy   | `hero-android`           | `hero-android-walk-v3` / `2.1.0`           |
| Legendy    | `hero-legend`            | `hero-legend-walk-v3` / `2.1.0`            |

Źródłem bieżących definicji jest `src/game/assets/imported.json`; `makeCatalog()`
nakłada późniejsze aktywne definicje na te same identyfikatory aktorów.
Każda z powyższych paczek (`2.9.1`, 12.11.2026) ma 1280 odwołań do klatek w 22 klipach i ośmiu kierunkach,
dziewięć zasobów atlasów, klatki HD 256 px. Klipy: idle, walk, attack, skill, hit, death, respawn; Tryb KI:
`kiwalk`, `kiidle`, `kiattack`, `kiskill`; etap 1 (walka): `attack2`, `finisher`, `skillb`, `dodge`, `guard`;
etap 2 (reakcje): `hitheavy`, `victory`; etap 3 (ruch): `run`, `channel`, `skillc`, `interact`.

`kiwalk` to chód po transformacji (filmy Gemini `*-walk-transformed.mp4`). Gra używa go
zamiast `walk` tylko, gdy bohater się porusza i ma aktywny bonus Trybu KI (`T`, 20 s);
bez klipu w paczce zostaje zwykły `walk`. W Trybie KI (`ActorAnimation.clipState`):
postawa to `kiidle` (6 klatek, 6 kl./s, pętla: cztery klatki z filmu etapu 4 grane w przód i w tył, z poświatą),
podstawowy cios to `kiattack` (6 klatek, 12 kl./s, z własnym efektem uderzenia z filmu), a każda umiejętność
bohatera to `kiskill` (8 klatek, 12 kl./s: ładowanie i wystrzał energii z filmu). Trafienie i śmierć zostają
w formie bazowej, bo filmów tych stanów po transformacji nie ma. Umiejętności Planetara (A9, B4, B9) zgłaszają
zdarzenie `burst` zamiast `attack`, więc `mountGame` uruchamia dla nich pozę `skill` także z tego zdarzenia.
Klatki wycina `scripts/anim/kiform_build.py` z filmów
`art-wip/gemini-anim-stages/<rasa>-etap4-walka-po-transformacji.mp4` (jedna stała transformacja
kamery na rasę, skala do wysokości chodu, stopy na tej samej linii; kierunki w prawo używają profilu,
w lewo jego lustra). Matowanie zachowuje efekty z filmu (poświata, płomienie, wiązki, kurz): postać z rembg
(isnet-anime, uzupełniona isnet-general-use za jasnym efektem), efekty z „color-to-alpha” względem tła filmu
(`scripts/anim/kimatte.py`); komórka 256 px wygasa przy brzegu, więc długie wiązki są ucinane łagodnie.
Specyfikacja klipów: `GPU_CONTRACT.optionalAnimations`. Atlasy `kifight` mają 6,8–7,8 MiB po rozkodowaniu.
Atlasy bazowe (`page`, `idle`, `fight-0/1`) przepakował `scripts/anim/repack_hero.py` na klatki przycięte do postaci
(bez zmiany pikseli, różnica 0/255), co zmniejszyło każdą rasę z ok. 57–62 do ok. 28–36 MiB; najwyższy świat
(Verdantia, z cache terenu) ma po zmianie 104,1 z 128 MiB. Atlas `kiwalk` jest zapakowany jako
klatki przycięte do postaci (Android 8,1 MiB, Mędrzec 6,9 MiB, Legenda 3,9 MiB,
Planetar 3,3 MiB po rozkodowaniu).
Legenda i Planetar mają ukosy zbudowane z profilu (w filmach obracają się zbyt szybko
na stabilne ukosy); Android i Mędrzec mają osobne klatki ukosów. Proces i skrypty:
`scripts/anim/kiwalk_build.py`, `scripts/anim/kiwalk_pack.py`, `scripts/anim/kiform_build.py`.

**Tryb KI — walka i reakcje (12.11.2026).** W Trybie KI postać zostaje w formie KI w każdej czynności; gra nie podstawia
zwykłego stroju, jeśli dla rasy jest klip formy KI. `scripts/anim/kicombat_build.py` wycina klipy do atlasów
`<paczka>-kifight-1` (z filmów etapu 4) i `-kifight-2` (z filmów reakcji formy KI `<rasa>-etap5a-reakcje-ki.mp4`):
`kiattack2` (6 klatek, 12 kl./s), `kifinisher` (8, 12), `kiskillb` (8, 12), `kidodge` (6, 14), `kiguard` (6, 10) oraz reakcje `kihit` (6, 14),
`kihitheavy` (8, 12), `kideath` (8, 10: odrzut, upadek, leżenie), `kirespawn` (8, 12: podpiera się, wstaje),
`kivictory` (8, 10). Reakcje formy KI są dla wszystkich czterech ras (Mędrzec od paczki `3.0.3`, z filmu `sage-etap5a-reakcje-ki.mp4`).
Planetar (paczka `3.2.0`): `kifinisher` (ciężki cios dłonią) i pełny `kiskillb` (skok i uderzenie w ziemię) pochodzą z filmu
`planetary-etap5c-cios-skok-ki.mp4` (atlas `-kifight-3`; w filmie etapu 4 trzeci cios był błyskiem na cały kadr, a skok
miał uciętą głowę), wycięte `KICOMBAT_ONLY=s4,s5c KICOMBAT_RIGHT=1` (tylko klatki w prawo, reakcje bez zmian).
Brak klipu dla stanu nie jest zastępowany niczym innym niż klipem formy bazowej. Łańcuch ciosów w Trybie KI: `kiattack2` → `kifinisher` → `kiattack` (silny cios z filmu) w 1,4 s.
Klip jednorazowy zostaje w formie, w której go uruchomiono, nawet gdy buff `T` skończy się w trakcie (śmierć i wstawanie
w Trybie KI zostają w formie KI). Każdy film ma własną transformację (skala z jego neutralnej klatki, stopy na linii chodu);
leżące ciało szersze niż komórka 256 px jest zmniejszane do szerokości komórki, na tej samej linii podłoża, a wygaszanie
przy brzegu komórki dotyczy tylko efektów, nie postaci. Klatki początkowe filmu Legendy (zbliżenie na tors) pominięto.

**Tryb KI — ruch (etap 5B, 12.11.2026, paczki `3.1.1`).** `MOVE_KI=1 scripts/anim/moveform_build.py` wycina z filmów
`<rasa>-etap5b-ruch-ki.mp4` (ten sam układ czasu u czterech ras: bieg 0,6–3,2 s, kanał 4,4–5,8, umiejętność C 6,9–8,1,
interakcja 8,8–9,8) klipy formy KI do atlasu `<paczka>-kimove-1`: `kirun` (8 klatek, 16 kl./s, pętla jednego pełnego
cyklu kroku: Mędrzec, Android i Planetar 21 klatek filmu, Legenda 17 z równego biegu 1,3–3,2 s; `MOVE_RUN_LAGS` i
`MOVE_RUN_WINDOW` zawężają wyszukiwanie, gdy automat trafi na pół cyklu albo na rozpędzanie), `kichannel` (8, 10, pętla),
`kiskillc` (8, 12), `kiinteract` (6, 10). Zapisywane są tylko klatki w prawo; lewe kierunki są w polu `mirrored`.
W Trybie KI: szybki ruch → `kirun` (wolniejszy → `kiwalk`), kanał → `kichannel`, umiejętność C → `kiskillc` (wcześniej
`kiskill`), podniesienie łupu → `kiinteract`.

Etap 3 (ruch, forma bazowa) wycina `scripts/anim/moveform_build.py` z filmów `<rasa>-etap3-ruch.mp4`
(Android `-v2` pionowy, Planetar w sekundach 20–30) do atlasu `<paczka>-fight-4`:
`run` (8 klatek, 16 kl./s, pętla: jeden okres kroku znaleziony z różnicy dolnej części ciała, Legenda 10,
Android 19, Mędrzec 41, Planetar 17 klatek filmu; każda klatka wyśrodkowana na tułowiu), `channel` (8 klatek,
10 kl./s, pętla tam i z powrotem po 5 próbkach zbierania KI, bez końcowego wybuchu), `skillc` (8 klatek, 12 kl./s,
szarża lub wystrzał) i `interact` (6 klatek, 10 kl./s, sięgnięcie po kryształ). Gra (`ActorAnimation`, `mountGame`):
bohater **biegnie** zamiast iść, gdy jego prędkość to co najmniej 1,5× prędkości rasy z poziomu 1
(`RUN_SPEED_RATIO`; sam wzrost z poziomem daje to od poziomu 12, wcześniej z węzłami, ekwipunkiem lub buffami;
w Trybie KI zostaje `kiwalk`); **kanał** (`channel` z kitu, dziś techniki Mędrca A4 i C1) trzyma pozę przez czas
kanałowania i znika, gdy bohater ruszy; **skill C** grają techniki drzewka C z atakiem (zdarzenia `attack`
i `burst`) oraz szarże do wroga oznaczone polem prezentacyjnym `charge` (Legenda A4, Planetar B4); drzewko C
Planetara (leczenie, tarcze) zostaje przy `skill`/`guard`; **interakcja** gra przy podniesieniu łupu. Tarcza
dodana jako skutek uboczny techniki (Planetar B7 przy B4) nie przerywa jej pozy. W Trybie KI skill C to `kiskill`.
Ostre krawędzie z filmu usuwa: wygaszanie przy bocznych krawędziach kadru (pionowy film Androida jest węższy
od komórki) i kolor→alfa dla białych smug dalej niż 4 px od kolorowej postaci.

`actorVisual()` skaluje prezentację tych bohaterów do **133×133 jednostek świata**,
aby sylwetki z materiałów wideo zachowały rozmiar porównywalny z wcześniejszymi
malowanymi aktorami 160×160. Kontrakt importu ma nadal 96×96 i kotwicę stóp
`(0.5, 0.95)`, fizyka pozostaje niezależna od tekstury. Nie stosować starszego
rozmiaru 160 globalnie do bieżących bohaterów ani do wszystkich NPC/potworów.
Mieszkańcy bez własnego filmu (myśliwy, alchemik) nadal korzystają ze wspólnego `human-v2`; to grafika zastępcza. Przewodnik, handlarz, kowal, depozytariusz, karczmarz, zarządca i strażnik mają własne postaci (klatki 256 px, rysowane 150) z filmów obrotu w czterech wersjach kolorystycznych (12.11.2026, `scripts/anim/npc_role_build.py`), a Trener własną większą.

Historyczne dostawy z 22–23.10 (`hero-planetary-painted-1.0.0`,
`hero-sage-painted-1.0.0`, `hero-android-1.0.0`, `hero-legend-1.0.0`)
używały 128×128 i dwóch atlasów. Nie są bieżącymi paczkami HD; ich pliki i
proweniencja pozostają materiałem archiwalnym. Integracja #62 nie generowała
nowych grafik, nie wymieniała atlasów i nie uruchamiała GPU.

## Źródła tożsamości i animacji

| Rasa       | Wybrany kandydat             | Widoki / ziarno                                             |
| ---------- | ---------------------------- | ----------------------------------------------------------- |
| Planetarni | `planetary-s5741102-d62.png` | `planetary-painted-v1`, 5741103, wiersz 2 właściciela       |
| Mędrcy     | `sage-s5741102-d55.png`      | `sage-painted-v1`, 5741102, wiersz 1 wybrany przez agenta   |
| Androidy   | `android-s5741102-d62.png`   | `android-painted-v3`, 5741102                               |
| Legendy    | `legend-s5741102-d62.png`    | `legend-painted-v1`, 5741102, wiersz 1 wybrany przez agenta |

Kandydaci, contact sheets i `metadata.json` pozostają w `docs/design/identity/`.
Szczegółowe historyczne decyzje i hashe: [22.10](zmiany/2026-10-22/ZMIANY.md).
Porzucono rigi 3D składane z prymitywów. Historyczna partia 22.10 używała malowanych widoków animowanych deformacją siatki 2D; obecne klipy HD pochodzą z późniejszych materiałów Gemini. Nie są to 416 niezależnie generowane ilustracje.
Pipeline i polecenia: [GPU](GPU-I-ZASOBY.md).

## Znane wady i sposób pracy

Niespójne proporcje/detale między kierunkami, rozciąganie przy nogach i płaszczu,
mały ruch chodu z przodu, zmniejszenie masterów dla zmieszczenia upadku, brak
narysowanego kostura Mędrca i pozostałości czerwonej energii Legend wymagają odbioru.
Nie maskować wad duplikowaniem klatek ani nazywaniem pojedynczej pozy pełną animacją.

Skalę, FPS, rytm, kotwicę, priorytety stanów i deformacje można poprawiać lokalnie
na CPU z istniejących masterów. Nowe widoki i ponowne generacje modeli/obrazów
mogą wymagać GPU. Nie uruchamiać poda samodzielnie. Próbkę ocenić w grze przed
pełnym renderem; sprawdzić sylwetkę, linię stóp, przycięcia i czytelność na telefonie.

Aktualne priorytety: spójność widoków, poprawa ruchu kończyn, osobne efekty/aury,
unikalni mieszkańcy każdej rasy, odbiór w czterech światach. Prawa do referencji i
checkpointów pozostają nierozstrzygnięte; wybór wyglądu nie stanowi licencji.

## Nazwa i slot postaci

Przy tworzeniu można wpisać nick 3–16 znaków (litery, cyfry, spacja, `_`, `-`, apostrof).
Puste pole daje „Wędrowiec”. Nazwa jest przypisana do slotu, widoczna w HUD i wyborze
postaci; nie zmienia rasy ani statystyk. Usunięcie postaci dotyczy wybranego lokalnego
slotu, nie prywatnych szkiców i nie danych innej postaci.

## Prezentacja akcji podczas trafienia — 24.10.2026

Zdarzenia bieżącego ticka są obsługiwane przed wyborem klatki aktora. Stan
animacji i klatka nie opisują już dwóch różnych ticków. Odczyt klatki jest
aktualizowany po renderze niezależnie od rzadszego odświeżania HUD.

Trafienie zachowuje pierwszeństwo. Zablokowana nim animacja ataku/zdolności może
poczekać do 500 ms na koniec reakcji. Kolejka mieści jedną akcję, preferuje skill
przed podstawowym atakiem i odrzuca stare wpisy. Śmierć/odrodzenie ją czyszczą.
To wyłącznie prezentacja: nie opóźnia ani nie powtarza obrażeń, leczenia lub kosztu KI.

## Rozwój mechaniczny — prace 28.10.2026

Nowy wspólny trening i wypożyczone profile egzaminów używają istniejących kitów
wszystkich czterech ras. Nie podmieniono ilustracji, atlasów ani proporcji.
Próba obrony dobiera legalne zdolności: Planetarni C1 → C2 → C4, Mędrcy/Androidy
B1, Legendy ruch i istniejący unik. B1 Legend nie jest udawane jako tarcza.
Dalsze osobiste ścieżki i odbiór ich kompletności: [plan](PLAN-I-ZADANIA.md#nowe-zlecenie-rozwoju-czterech-ras--28102026-w-realizacji).
