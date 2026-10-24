# KI Legends — rasy i postacie

Stan kodu: 23.10.2026, `d0bfc2c`. Liczby rozwoju: [rozwój i walka](ROZWOJ-I-WALKA.md).

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

## Aktualni bohaterowie runtime

| Rasa       | Aktor                    | Paczka                                     |
| ---------- | ------------------------ | ------------------------------------------ |
| Planetarni | `hero-planetary-painted` | `deliveries/hero-planetary-painted-1.0.0/` |
| Mędrcy     | `hero-sage-painted`      | `deliveries/hero-sage-painted-1.0.0/`      |
| Androidy   | `hero-android`           | `deliveries/hero-android-1.0.0/`           |
| Legendy    | `hero-legend`            | `deliveries/hero-legend-1.0.0/`            |

Każdy: 416 klatek, 56 klipów (7 stanów × 8 kierunków), dwa atlasy,
klatka klienta 128×128. Dokładne wersje/digesty są w `src/game/assets/imported.json`.
Wszystkie cztery nowe postacie są domyślne. Stare flagi bohaterów nie tworzą
oddzielnych slotów ani nie przywracają poprzednich aktorów. Mieszkańcy nadal
korzystają ze wspólnego `human-v2`; to grafika zastępcza, nie cztery gotowe zestawy NPC.

Prezentacja bohatera w `actorVisual()` to **160×160 jednostek świata**, po zgłoszeniu
„Postacie są za małe!”. Kontrakt importowanego źródła zachowuje 96×96, kotwicę
stóp `(0.5, 0.95)`. Collider stóp pozostaje 12, a kamera bez zmiany. Nie powiększać
NPC i potworów przez globalną zamianę tej wartości.

## Źródła tożsamości i animacji

| Rasa       | Wybrany kandydat             | Widoki / ziarno                                             |
| ---------- | ---------------------------- | ----------------------------------------------------------- |
| Planetarni | `planetary-s5741102-d62.png` | `planetary-painted-v1`, 5741103, wiersz 2 właściciela       |
| Mędrcy     | `sage-s5741102-d55.png`      | `sage-painted-v1`, 5741102, wiersz 1 wybrany przez agenta   |
| Androidy   | `android-s5741102-d62.png`   | `android-painted-v3`, 5741102                               |
| Legendy    | `legend-s5741102-d62.png`    | `legend-painted-v1`, 5741102, wiersz 1 wybrany przez agenta |

Kandydaci, contact sheets i `metadata.json` pozostają w `docs/design/identity/`.
Szczegółowe historyczne decyzje i hashe: [22.10](zmiany/2026-10-22/ZMIANY.md).
Porzucono rigi 3D składane z prymitywów; obecnie używane są malowane widoki
animowane deformacją siatki 2D. Nie są to 416 niezależnie generowane ilustracje.
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

## Integracja assetów i działania bohaterów — kontrola 24.10.2026

W commitach `3e373e2bccb0a069383ff51205fb6c6c5adf9bf4` i `adab35004f71fc3ad8bd9aadb00560a73dd7d1e2` zaktualizowano paczki `hero-sage-painted` (1.0.1), w tym klatki skierowane w prawo z odbicia czystych klatek w lewo, oraz pomocniczy blending teł. Dodatkowo wprowadzono paczki napraw trzech potworów Verdantii (1.0.2) ze zmiękczonymi krawędziami klatek. To **dowód obecności plików i zmian w kodzie**, nie samoistny dowód akceptacji grafiki i animacji przez właściciela.

Commit `19a28569d96a45da570a1b7701533cb430e012bd` modyfikuje `e2e/hero-lifecycle.spec.ts` i `superiorRuntime.ts`; weryfikację zachowania na finalnym SHA należy ponowić. Historyczne `179/416` Planetarnych z dokumentacji 21.10 nie jest aktualnym, potwierdzonym stanem i nie wolno go kopiować do bieżących raportów bez sprawdzenia obecnego manifestu oraz animacji w runtime.
