# Miasta — podział pracy Codex / Claude, 23.10.2026

Polecenie właściciela: najpierw jedno funkcjonalne, przestronne miasto; handel,
kowal, NPC, wejścia do budynków, osobisty depozyt ze skrzynią i arena treningowa.
Przeciwnicy oraz nowe spawny poza miastami należą do późniejszego etapu.

## Podział

- Codex: **Verdantia / Planetarni — Zielona Przystań**, gałąź
  `feature/verdantia-functional-city-20261023`; również wspólne mechaniki miast.
- Claude: właściciel zapowiedział równoległą budowę drugiego miasta. Proponowana
  **Aetheria / Mędrcy**; ostateczny wybór potwierdza właściciel.
- Nie zmieniać równocześnie `session.ts`, `mountGame.ts`, wspólnych paneli HUD,
  schematu zapisu ani importera. Dla drugiego miasta przygotować dane, układ,
  własne źródła grafiki/paczki oraz dokumentację. Wspólne mechaniki rozwija Codex.
- Nie scalać i nie publikować w ramach tego zadania. Nie sterować instancjami GPU.

## Wspólny interfejs (w implementacji, nie deklaracja ukończenia)

`WorldDefinition.city?: CityDefinition`, typy w `src/game/city/types.ts`.
Budynki mają stabilne identyfikatory usług:
`shop`, `hall`, `inn`, `smithy`, `depot`, `arena`.
Każdy podaje nazwę, dzielnicę, opis, `objectId` obiektu graficznego i punkt `door`
na drożnym gruncie przed wejściem. Wejścia muszą być osiągalne A* z miejsca startu.
Usługi powinny leżeć w osobnych dzielnicach (w Verdantii ≥700 jednostek odstępu).

NPC mają `building?: BuildingId`. Brak pola oznacza NPC na ulicy; z polem jest
to rozmówca we wnętrzu. Wspólne role/ID: `guide`, `hunter`, `merchant`, `smith`,
`keeper`, `trainer`, `innkeeper`, `steward`. Imiona i dialogi pozostają lokalne
dla rasy. Nie kopiować tożsamości mieszkańców Verdantii do innych miast.

Wnętrza mają własne lokalne współrzędne, nawigację i kolizje, niezależne od
pozycji budynku na kontynencie. `city/room.ts` definiuje punkty wejścia/wyjścia,
rozmówcy, skrzyni i manekina. Wyjście wraca przed drzwi konkretnego budynku.
Nie przesuwać wnętrz podczas migracji współrzędnych zewnętrznej mapy.

Komendy: `enter(building)`, `exit`, `interact(npc)`, `chest`, `storage-close`,
`depot(item, quantity, withdraw)`, `rest`, `training(start|reset|stop)`.
`interact` z usługą w innym budynku prowadzi przez jej drzwi do rozmówcy.
Przenoszenie przedmiotów wymaga otwartej skrzyni i bliskości we właściwym
wnętrzu. Handel i kowal wymagają rozmowy z odpowiednim NPC.

Depozyt jest **prywatny dla lokalnego slotu postaci**, nie wspólny pomiędzy rasami,
kontami czy urządzeniami. Rozszerzenie zapisu v5 zachowuje migracje v1/v3/v4,
ochronę nowszych/uszkodzonych zapisów i konfliktów między kartami. Nie tworzyć
osobnych, niespójnych kluczy localStorage dla wnętrz i depozytu.

Manekin jest obiektem treningowym bez AI, obrażeń dla gracza i nagród. Wykorzystuje
prawdziwe zdolności, koszty i cooldowny postaci; nie jest dzikiem ani nowym wpisem
bestiariusza. W tym etapie `city` oznacza bezpieczny obszar: brak bojowych spawnów.
Nie dodawać przeciwników do miasta w celu zaliczenia dotychczasowych testów walki.

Grafika: używać niezależnych obiektów i walidowanego importera, dokumentować
pochodzenie. Mapa/globus planety, kamera i fullscreen HUD pozostają wspólne.
Prawa do istniejących referencji i checkpointów nadal wymagają osobnej weryfikacji.

## Osobna oprawa kolejnych miast

`CityDefinition.palette` pozwala określić `wall`, `edge`, `accent`, `background`.
Opcjonalne wiązania importera (bez edycji wspólnego renderera):
`terrain.<worldId>.city-road`, `terrain.<worldId>.interior-floor`,
`terrain.<worldId>.interior-stone`,
`object.<worldId>.interior.<chest|anvil|dummy|shelf|bed|desk>`.
Bez lokalnego wiązania używany jest wspólny zasób `city-interiors`.
Osiągalność drzwi i brak kolizji weryfikować na własnych danych miasta.

Implementacja i zakres testów: [raport Verdantii](VERDANTIA-FUNCTIONAL-CITY-2026-10-23.md).
