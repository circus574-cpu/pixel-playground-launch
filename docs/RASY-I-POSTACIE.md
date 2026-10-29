# KI Legends — rasy i postacie

Stan bieżący: 29.10.2026, `main@5cea48da`. Integracja nie zmienia zatwierdzonych tożsamości, nazw kontynentów ani obecnych paczek bohaterów HD. Rozwój ras i nowe parametry treningu są w main, lecz dalsze rozdziały i próby pozostają nieukończone. Liczby, wyposażenie i zasady wzrostu: [rozwój i walka](ROZWOJ-I-WALKA.md). Historyczne checkpointy grafik poniżej zachowują własne daty i wersje.

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

## Aktualni bohaterowie runtime — 29.10.2026

| Rasa | Aktor | Aktywna paczka / wersja |
| --- | --- | --- |
| Planetarni | `hero-planetary-painted` | `hero-planetary-painted-walk-v3` / `2.0.0` |
| Mędrcy | `hero-sage-painted` | `hero-sage-painted-walk-v3` / `2.0.0` |
| Androidy | `hero-android` | `hero-android-walk-v3` / `2.0.0` |
| Legendy | `hero-legend` | `hero-legend-walk-v3` / `2.0.0` |

Źródłem bieżących definicji jest `src/game/assets/imported.json`; `makeCatalog()`
nakłada późniejsze aktywne definicje na te same identyfikatory aktorów.
Każda z powyższych paczek ma 416 klatek w siedmiu stanach i ośmiu kierunkach,
cztery zasoby atlasów, klatki HD 256 px. Klipy obejmują idle, walk, attack, skill,
hit, death i respawn. Nie deklarujemy osobnej animacji run ani nowych klipów combo.

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
