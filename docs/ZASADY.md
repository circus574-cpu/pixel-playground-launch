# KI Legends — zasady projektu

Aktualizacja: 23.10.2026. Punkt wejścia: [indeks](INDEX.md).

## Tożsamość i zakres

Anime fantasy 2D z widokiem z góry; interfejs po polsku, przeglądarka na komputerze i telefonie.
Projekt: `circus574-cpu/pixel-playground-launch`; publiczna domena `kilegends.pl`.
Obowiązują Planetarni/Verdantia, Mędrcy/Aetheria, Androidy/Nexus-9 i Legendy/Pyra.
Wcześniejsze Human/Orc/Dwarf/Elf, medieval/pixel art i sztywny kalendarz zdobywania
zdolności są zastąpione. Gra działa jako lokalne PvE; MMORPG jest dalszym etapem.
Inspiracje pętlą eksploracji i walki nie uprawniają do kopiowania cudzych postaci,
map, interfejsu, nazw ani grafik.

## Decyzje i dowody

Właściciel określa kanon i zatwierdza dostawy. Źródła liczb:
aneks właściciela oraz bestiariusz 40 potworów. Nie edytować ręcznie plików
`nodes.generated.ts` i `base.generated.ts`; zmieniać źródło i generator.
Stary znacznik `CONCEPT_NOT_IMPLEMENTED` w historycznym JSON nie unieważnia
późniejszego wdrożenia. Aktualne mechaniki opisuje [rozwój](ROZWOJ-I-WALKA.md).
Historia zgód jest w [dziennikach](INDEX.md#historia--jeden-dziennik-na-dzien).
Akceptacja wyglądu nie jest dowodem licencji ani wynikiem testu technicznego.

## GPU — uprawnienia właściciela

Wyłącznie właściciel uruchamia, zatrzymuje, restartuje, usuwa, skaluje lub zmienia
rozliczenia i konfigurację instancji GPU. Dotyczy to także końca renderu, bezczynności,
prób odzyskania miejsca i ponawiania błędów. Agent może odczytać stan, zabezpieczyć
wyniki oraz wykonywać autoryzowaną pracę na już działającej instancji.
Nie usuwać modeli ani archiwów bez wskazanej zgody. Procedury programowe i import
opisuje [GPU i zasoby](GPU-I-ZASOBY.md); polecenie startu ComfyUI nie jest startem poda.

## Git, scalenia i publikacja

Nie przepisywać opublikowanej historii: bez force push oraz rebase/amend/squash
już wysłanych commitów. Projekt synchronizuje się z Lovable. Pracować na gałęziach,
zachowywać cudze zmiany, opisywać konkretny zakres i wyniki kontroli.
Scalenie, publikacja i konfiguracja produkcji wymagają uprawnienia właściciela
obejmującego dane działanie. Zgoda z 22.10 była zgodą historycznego wydania;
nie rozszerzać jej automatycznie na nowe zadania, zwłaszcza z poleceniem „nie publikować”.
To porządkowanie dokumentów nie stanowi wdrożenia gry ani bieżącego audytu domeny.

## Grafika i geometria

Osobne podłoże, obiekty, bohaterowie, efekty i etykiety. Nie używać całej ilustracji
koncepcyjnej jako produkcyjnej mapy. Nie zmieniać kolizji, statystyk, cooldownów ani
kotwicy stóp tylko po to, aby ukryć wadę grafiki. Domyślna kamera oddalona;
pełny ekran obejmuje scenę i HUD. Świat/globus korzystają ze wspólnych danych.
Nowe paczki podlegają walidowanemu importerowi i ocenie w działającej grze.

## Zapisy i prywatne zasoby

Zachować sloty postaci, migracje, kopie odzyskiwania, ochronę nieznanych/nowszych
zapisów i konfliktów kart. Nie obiecywać synchronizacji kont ani serwerowego banku.
Prywatne `/test` to osobna funkcja: wspólne hasło i zaszyfrowana sesja serwerowa,
prywatny bucket bez anonimowych/authenticated policies, walidacja sesji przed każdą
operacją, krótkotrwałe możliwości uploadu/pobrania i wspólny schemat walidacji.
Nie wysyłać prywatnych plików do zewnętrznych viewerów. Tekst wyświetlać jako tekst,
a podglądy jako lokalne typowane blob URL. Nie wypisywać sekretów.
Nie formatować automatycznie generowanych `types.ts` i `previewAuthStorage.ts`.

## Warunki odbioru

Pełny TypeScript aplikacji/e2e/tools, właściwe testy, walidacja zasobów, lint i build.
Zmiana grafiki/gameplay wymaga także regresji Canvas/Software WebGL na końcowym SHA.
Fizyczny telefon, sprzętowe WebGL, odbiór artystyczny oraz prawa do zasobów są
osobnymi kontrolami. Nie zastępować ich wynikiem headless Chromium.
