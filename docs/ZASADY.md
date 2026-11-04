# KI Legends — zasady projektu

Stan obowiązujący: 04.11.2026 (`main@1690fb6e`). Punkt wejścia: [indeks](INDEX.md). Dawne decyzje i opisy lokalnego zapisu niżej stanowią historię.

## Tożsamość i zakres

Anime fantasy 2D z widokiem z góry; interfejs po polsku, przeglądarka na komputerze i telefonie.
Projekt: `circus574-cpu/pixel-playground-launch`; publiczna domena `kilegends.pl`.
Obowiązują Planetarni/Verdantia, Mędrcy/Aetheria, Androidy/Nexus-9 i Legendy/Pyra.
Wcześniejsze Human/Orc/Dwarf/Elf, medieval/pixel art i sztywny kalendarz zdobywania
zdolności są zastąpione. Gra działa jako **serwerowe PvE na VPS Aruba z PostgreSQL 17 i kontami na VPS** (PR #69, #76–77). Pełne MMO (wspólne potwory, PvP, drużyny) jest dalszym etapem; sama obecność postaci online nie stanowi jego ukończenia.
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
już wysłanych commitów. Pracować na gałęziach, zachowywać historię,
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

**Aktualne:** postacie i postęp PvE są przechowywane na serwerze w PostgreSQL, sesja online jest obowiązkowa bez lokalnego fallbacku; `/ws/auth/*` i `/konto` używają kont VPS. Historyczne lokalne formaty służą migracji i dowodom, nie są aktywnym źródłem prawdy. Dane prywatnego `/test` mają osobny model dostępu.

**Historyczna decyzja:** 24.10.2026 właściciel zlecił Superior jako jedyny świat i reset starych zapisów.
Nowe sloty zaczynają od początku; stare bajty pozostają archiwalne, bez importu.
Zachować ochronę nieznanych/nowszych
zapisów i konfliktów kart. Od 01–02.11 trwałe postacie i konta należą do VPS/PostgreSQL; weryfikować zachowanie depozytu w serwerowej sesji przed deklaracją synchronizacji wielograczowej.
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
