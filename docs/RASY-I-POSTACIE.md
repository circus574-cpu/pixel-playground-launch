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
Mieszkańcy nadal korzystają ze wspólnego `human-v2`; to grafika zastępcza.

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
