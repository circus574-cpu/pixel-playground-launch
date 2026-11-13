# KI Legends — aktualny plan i zadania

**Domykanie rozwoju — 48/48 kontrolerów prób, 144 stopnie (11.11):** dodano
pozostałe sześć prób Legend: obciążenie, przełamania, fale, ratunek i odwrót.
Odblokowania i walidacja zapisu korzystają ze wspólnego rejestru. Tytuły czterech
ras są wyliczane z finału, sześciu projektów i kompletu prób III, bez premii
statystyk. Budżet z aktywnych katalogów: 17 800 praktyki na rasę.
To komplet katalogu prób, nie odbiór całej kampanii. [Wyniki i dalszy zakres](zmiany/2026-11-11/ZMIANY.md#6-komplet-prób-i-warunki-tytułów).

## Funkcje dziedzin i późne wyprawy — dostawa 12.11.2026

PR #145 dodaje 48 zastosowań dziedzin przy obiektach świata, Księgę Zrozumienia,
32 późne warianty przeciwników i 48 wypraw z realnymi walkami. Nowe funkcje
korzystają z dotychczasowych kontrolerów, AI, wejść i wspólnego zapisu; ich
etapy nie mają przycisku administracyjnego „zalicz”. Migracja rozwoju 3→4
zachowuje stare bajty i wprowadza puste pola nowych aktywności.

Wyniki lokalnej końcowej regresji zapisano w [dzienniku 12.11](zmiany/2026-11-12/ZMIANY.md).
Pozostają do odbioru: niezależna pełna regresja i Actions końcowego SHA,
fizyczny telefon oraz decyzje dotyczące wykrytych różnic balansu mocnych
konfiguracji. Nie wolno utożsamiać kontrolowanych fixture'ów z ukończoną
od początku kampanią ani deklarować docelowej liczby godzin na ich podstawie.
Scalanie i publikacja wymagają osobnej decyzji. Szczegóły aktualnej dostawy:
[dziennik 11.11](zmiany/2026-11-11/ZMIANY.md#19-dziedziny-w-świecie-i-późne-wyprawy).

## Historyczny checkpoint 42 prób, 11.11.2026

Robocza kontynuacja `feature/development-remaining-trials-20261111` od `32ed1b9f`:
Kalibracja TN01–TN03, Termika TN04–TN06, Tożsamość TN10–TN12,
Kontrola Żaru TP04–TP06. Katalog ma 42/48 prób i 126/144 stopni; Planetarni,
Mędrcy i Androidy po 12/12, Legendy 6/12. To checkpoint, nie odbiór pełnej kampanii.
Pozostają Ciało TP01–TP03, Przysięga TP10–TP12 oraz interakcje dziedzin,
późne wyprawy, tytuły, graf/budżet i pełna regresja.

Kalibracja używa rzeczywistych, niehomingowych pocisków, oznaczenia A1,
widoczności i limitu chybień. Termika używa legalnych profili bazowego/C7/C8
(maksimum 100/150/70), bez ręcznego dodawania Ładunku. Kontrola Żaru korzysta
z rzeczywistych trafień i zużycia C4. Budżet KI liczy każdy realny wydatek;
regeneracja go nie odnawia. Stałe sali, nie kanonu: limit 240 s,
sygnał 1,5 s, okno 3 s, maksymalna przerwa aktywności przy utrzymaniu 8 s.

Tożsamość porównuje jawne materiały ćwiczebne z niezależnym rejestrem;
nie udaje kryptograficznego dowodu. Terminal ratunkowy ma rzeczywiste stany
izolacji, kopii, zasilania i łączności oraz chronioną pamięć. Nie zmienia
pamięci postaci ani jej zapisów. Bez zmiany kanonu i istniejących statystyk.

Kalibracja II odblokowuje `mn-mark` i `mn-optics`, TN03 II `mn-precision`,
Termika II `mn-discharge` i `mn-routing`, Kontrola Żaru II `mp-burst`.
To odblokowania istniejących efektów, bez automatycznego wyposażania modułów.
Formaty zapisu pozostają 10/6 i development v3. Dane w kopercie własnej postaci,
nagrody jednorazowe i CAS pozostają wspólne. Nie scalać do main ani publikować.

## Połączenie Skupienia i Pamięci — 11.11.2026

Osobna gałąź `feature/development-focus-memory-20261111` łączy PR #90
(`77dfb0e7`) z PR #122 (`87118369`), zachowując oba rodzaje prób.
Katalog: **30/48 prób, 90/144 stopni**. Planetarni i Mędrcy po 12/12,
Androidy i Legendy po 3/12. To komplet katalogu prób dwóch ras, nie odbiór ich
pełnej kampanii. Pozostaje **18 prób / 54 stopnie**, cztery warianty, trzy moduły,
interakcje dziedzin w świecie, późne starcia, tytuły, graf i balans.

Mędrcy mają w katalogu 5400 praktyki z prób; przy niezmienionych pozostałych
źródłach arytmetyczny budżet wynosi 17 800. Nie potwierdza to jeszcze osiągalności
wszystkich źródeł w kampanii. Pamięć nie dodaje premii bojowej; Skupienie II
nadal wymaga minimum II wszystkich trzech prób i odblokowuje `ma-focus`.

Formaty development v3 / klasyczny v10 / Superior v6 pozostają bez zmian.
Zachowano odrębne identyfikatory i stare nagrody, transakcje, ochronę przed
nadpisaniem w drugiej karcie i migracje. Dodano testy odczytu po przejściu obu
dziedzin w obu kolejnościach oraz ochrony przed ponowną nagrodą.

Nie scalono do main ani nie publikowano. Baza jest kontynuacją #90, nie bieżącym
main; przed przyszłym wydaniem potrzebna jest osobna integracja nowszego main.
[Zmiany i wyniki kontroli](zmiany/2026-11-11/ZMIANY.md).

## Kontynuacja 06.11 — Pamięć Mędrców

Wznowiono rzeczywistą gałąź Draft #90 (`a9e44175`), zintegrowano `main@83165f5c`
i dodano TA10 Fragment i źródło, TA11 Granice świadectwa, TA12 Kronika z niewiadomą.
Każda ma trzy stopnie i używa wspólnego kontrolera, wypożyczonej sesji, transakcji
wyników oraz publicznych materiałów. Pamięć nie dodaje premii bojowej.

Katalog: **27/48 prób, 81/144 stopni**. Planetarni 12/12, Mędrcy 9/12,
Androidy i Legendy po 3/12. Pozostaje **21 prób / 63 stopnie**, pięć wariantów,
trzy moduły, interakcje dziedzin w świecie, późne starcia, tytuły i pełny odbiór
kampanii/balansu. Następna brakująca dziedzina Mędrców: Skupienie (TA07–TA09).
Mędrcy mają 4050 praktyki z prób; teoretyczna suma ścieżki to 16 450, o 1350 mniej
niż docelowe 17 800. Nie jest to dowód osiągalności całej kampanii.

[Zakres i dowody](zmiany/2026-11-06/ZMIANY.md). Kontynuacja nie jest scalona ani
opublikowana. Poniższe checkpointy opisują wcześniejsze partie i stan main.

## Poprzednia partia — Bariery Mędrców, 04.11

PR #90: TA04 Osłona archiwum, TA05 Droga zwierciadeł, TA06 Okna osłony,
każda w trzech stopniach. Bariery II odblokowują istniejący `ma-barrier`.
Katalog **24/48 prób, 72/144 stopni**; Mędrcy mają 6/12 prób i 2700 praktyki
z prób. Pozostaje **24 próby / 72 stopnie**, pięć wariantów i trzy moduły,
interakcje dziedzin w świecie, późne starcia, tytuły oraz pełny graf/budżet
kampanii i odbiór UI. Połowa katalogu prób nie oznacza połowy całej aplikacji.
Następne dziedziny Mędrców: Skupienie (TA07–TA09) i Pamięć (TA10–TA12).
[Zakres i kontrole](zmiany/2026-11-04/ZMIANY.md#bariery-mędrców--ta04-ta05-ta06).
To gałąź robocza bez scalenia i publikacji; niższe checkpointy są historyczne.


## Poprzednia partia — Opieka Planetarnych, 04.11

PR #90: TV07 Zapas dla wyprawy, TV08 Źródło dla dwóch osad, TV09 Ostatni obóz,
każda w trzech stopniach. Opieka II odblokowuje istniejący `mv-root`.
Łącznie **21/48 prób i 63/144 stopni**, Planetarni **12/12 prób**.
To komplet prób tej rasy, nie komplet jej rozwoju. Pozostaje **27 prób / 81 stopni**
pozostałych ras, sześć wariantów i trzy moduły, interakcje dziedzin w świecie,
późne starcia, tytuły oraz pełny graf, budżet i odbiór kampanii.
Planetarni mają 5400 praktyki z prób; teoretyczna suma katalogowa wynosi 17 800,
ale wymaga jeszcze potwierdzenia osiągalności w całym przebiegu kampanii.
[Zakres i dowody](zmiany/2026-11-04/ZMIANY.md#opieka--tv07-tv08-tv09).
Gałąź robocza bez scalenia i publikacji. Poniższe checkpointy opisują historię.


## Poprzednia partia — Szlaki Planetarnych

PR #90 rozbudowano o TV01/TV02/TV03 i `mv-trail` po II stopniu Szlaków.
Łącznie **18/48 prób, 54/144 stopni**. Pozostaje 30 prób / 90 stopni, siedem
wariantów i trzy moduły, dziedziny w świecie, późne starcia, tytuły i pełny odbiór
kampanii. Same próby w sali nie oznaczają ukończenia funkcjonalności dziedziny.
[Zakres i dowody](zmiany/2026-11-03/ZMIANY.md#szlaki--tv01-tv02-tv03).
Poniższe checkpointy 15/45 i 12/36 zachowano jako historię.

## Kontynuacja 03.11 — Żywa Ziemia Planetarnych

Do PR #90 dołączono aktualny `main@4ecba945`, zachowując oprawę czterech miast.
Nowa partia: TV04/TV05/TV06, łącznie 3 próby / 9 stopni, ranga Żywej Ziemi
oraz `mv-earth` po II stopniu wszystkich trzech prób. Katalog obejmuje teraz
15 prób / 45 stopni; nadal brakuje **33 prób / 99 stopni**, 8 wariantów i 3 modułów,
interakcji dziedzin w świecie, późnych wariantów starć oraz pełnego odbioru kampanii.
[Kontrole i granice odbioru](zmiany/2026-11-03/ZMIANY.md#żywa-ziemia--tv04-tv05-tv06).
Poniższe liczby 12/36 i 36/108 są wcześniejszym checkpointem, nie bieżącym stanem.

## Próby rasowe — partia 03.11 na PR #90

Dodano pierwsze 12 prób / 36 stopni dla czterech ras, trwałe wyniki, rangi
i trzy odblokowania wariantów oraz moduł osłony. [Zakres i rzeczywiste kontrole](zmiany/2026-11-03/ZMIANY.md#próby-rasowe--pierwsze-12-kontrolerów-i-36-stopni).
Pozostają 36 prób / 108 stopni, pozostałe 9 odblokowań wariantów i 3 modułów,
interakcje dziedzin poza próbami, tytuły wymagające całego kompletu III,
32 późne warianty przeciwników oraz pełny graf, budżet i odbiór kampanii.
Ta gałąź nie jest opublikowana. Starsze checkpointy poniżej opisują historię.

## Kontynuacja rozwoju — gałąź robocza 03.11.2026

PR #90: naprawy wyposażenia, kontrolery eskort bojowych/ochrony i prywatna kronika.
Sześć rozdziałów i projektów każdej rasy przechodzi w kontrolowanych testach silnika,
a rzeczywiste dane Superior przechodzą testy bindingów tras. Nie jest to jeszcze
odbiór całej kampanii w przeglądarce ani publikacja.
Dalej: 48 prób / 144 stopnie, stopnie dziedzin, odblokowania wariantów/modułów,
budżet 17 800 praktyki, tytuły i 32 warianty późnych starć, pełna regresja kont/urządzeń.
[Dowody i granice odbioru](zmiany/2026-11-03/ZMIANY.md#domykanie-rozwoju--partia-2-eskorty-obrona-i-kronika).

## Aktualizacja rozwoju — 03.11.2026

Audyt `main@13983467` potwierdza częściową implementację. Do zamknięcia kolejno:
bonusy przedmiotów w rzeczywistych statystykach, eskorty bojowe/ochrona (blokady
H-V03/H-A05/H-N03/H-P06), 48 prób / 144 stopnie i normalne odblokowania 12 wariantów
oraz 4 modułów, pełny budżet 17 800 praktyki, bronie/finały i treść poziomów 21–40.
Komplet plików graficznych i audio Etapu 1 nie zamyka tych zadań.
[Dowody, wyniki i dokładna lista](zmiany/2026-11-03/ZMIANY.md#audyt-kompletności-rozwoju-postaci--03112026).
Starsze checkpointy poniżej zachowano jako historię. Ten audyt dotyczy rozwoju
postaci, bez sprawdzania aktualnego wdrożenia produkcyjnego.


## Bieżący checkpoint — 05.11.2026

Kod: `main@555da1ea`, opublikowany na produkcję (PR #117 wielkości potworów, #118 oprawa kontynentów Verdantia/Pyra/Aetheria domyślnie włączona, #119 mapa i globus, #120 chód po transformacji `kiwalk`, #121 malowane wnętrza budynków specjalnych). Hosting i bramka jakości bez zmian (poniżej, checkpoint 01.11). Dowody: [dziennik 05.11](zmiany/2026-11-05/ZMIANY.md), [04.11](zmiany/2026-11-04/ZMIANY.md).

Otwarte (stan faktyczny, bez zmian decyzji właściciela):

- **Rozwój ras (niescalony):** Draft #90 (`feature/complete-character-development`, 12 commitów, stan 04.11): 12 prób ras w progresji serwerowej, poprawki bonusów wyposażenia; 24 z 48 prób, 72 ze 144 stopni, reszta kampanii rozwoju nieukończona. Draft #87 to audyt luk. Zgodność gałęzi z obecnym `main` niesprawdzona. Tabele poziomów 1–60 (źródło właściciela 05.11) czekają na decyzję; gra kończy się na poziomie 20.
- **Nexus-9:** grafiki z 04.11 (PR #116, w `main` przez #118) są zaimplementowane w grze i **od 06.11.2026 domyślnie włączone** (`?ki-nexus-continent=0` wyłącza). Gęstość dziczy od 06.11.2026 podnosi generator dekoracji (`worldDress.ts`, `?ki-dress=0` wyłącza).
- **Odbiór właściciela:** nowa kuźnia Pyry (pozioma, 1920×1280), proporcje wnętrz pozostałych światów, wielkości potworów (mnożniki to propozycja projektowa).
- **Animacje (stan 12.11.2026, paczki bohaterów `3.0.2`):** w grze są dla czterech ras: chód 8 kierunków (Legenda i Planetar przebudowane z pełnym cyklem kroku; Android i Legenda ponownie z filmów chodu przód/tył z 13.11.2026, paczki `3.3.0`), idle, cios + `attack2` + `finisher` (łańcuch), `skill` i `skillb` (skill obszarowy, `burst`), `dodge`, `guard` (tarcza), trafienie, śmierć, wstawanie, efekt transformacji oraz Tryb KI: `kiwalk`, `kiidle`, `kiattack`, `kiskill`. Etap 2 (12.11): `hitheavy` (cios ≥ 15% życia) i `victory` (awans) w grze. Etap 3 (12.11, paczki `2.9.1`): `run` (prędkość ≥ 1,5× bazowej), `channel` (kanał), `skillc` (drzewko C i szarże), `interact` (łup) w grze. Boczne widoki klipów walki trzymają jedną stronę, druga jest rysowana lustrem (`mirrored`, flipX). Tryb KI (12.11): ciosy 2–3, skok, unik i garda (4 rasy) oraz trafienie, ciężkie trafienie, śmierć, wstawanie i zwycięstwo (cztery rasy; Mędrzec od paczki `3.0.3`) mają klipy formy KI. Tryb KI 5B (12.11, paczki `3.1.1`): `kirun`, `kichannel`, `kiskillc`, `kiinteract` dla czterech ras. Planetar 5C (paczka `3.2.0`): `kifinisher` i pełny `kiskillb`. NPC Myśliwy i Alchemik (12.11): własne postaci w czterech miastach. Film `planetary-chod-8-kierunkow.mp4` jest identyczny z `planetary-walk.mp4` (już użytym; nie dołączony drugi raz). **Do zrobienia:** (3) nowe filmy przodu/tyłu chodu Androida i Legendy, jeśli obecne nogi są za płytkie; (4) Mędrzec: film chodu (w repo brak `sage-walk.mp4`, przód i tył Planetara/Legendy z filmów są płytkie); (5) kolejne klipy wymagają kontroli budżetu tekstur (Verdantia 126,8 z 128 MiB po etapach 5B, 5C i NPC); (6) skill A bohatera gra jeden klip `skill`.
- **Świat:** 64 grafiki środowiska Nexusa działają domyślnie (06.11.2026); globus jest nieostry przy dużym zbliżeniu (decyzja: warstwa terenu na globusie albo przejście do mapy 2D).
- **Testy:** specyfikacje e2e `city` i `manga-hud` są nieaktualne wobec HUD świata v2 (przycisk „Plan miasta” w zwiniętym panelu Akcje); do przepisania.
- **Backend i telefon:** bez zmian względem checkpointu 01.11 (cutover PostgreSQL, odbiór na fizycznym telefonie, brak sprzętowego WebGL w dowodach).
- **Porządek repo:** około 50 starych, niescalonych gałęzi oraz otwarte PR-y (w tym #80, #103, #104, #115, #116 — te dwa ostatnie zastąpione przez #118) czekają na decyzję właściciela; nic nie zamykano ani nie kasowano.

## Poprzedni checkpoint — 01.11.2026 po publikacji serwerowego PvE, panelu postaci, ekwipunku i wydaniu na main

Kod i potwierdzona publikacja: `main@2026c18` (PR #70, ilustrowane katalogi potworów i przedmiotów w `/admin`). Hosting: VPS Aruba (Coolify), wdrożenie automatyczne po pushu do `main` — od 01.11 dopiero po zielonej bramce jakości (typecheck, testy, lint, zasoby, dokumentacja, build). Lovable nie jest już hostingiem. Aktualizacje z 01.11 obejmują integrację serwerowych postaci (PR #69), pełny panel administracyjny postaci serwera dedykowanego (`ServerCharacterManager` w `/admin`), system 8-slotowego ekwipunku, 40-slotowej torby i depozytu miejskiego (`feat/inventory-bag-and-city-depot`), komplet 46/46 zasobów Etapu 1 oraz automatyczne wdrożenie produkcyjne Aruba. Zob. [dziennik 01.11](zmiany/2026-11-01/ZMIANY.md#10-integracja-gałęzi-pełna-weryfikacja-jakościowa-i-publikacja-main-commit-fbfde40f).
Ten checkpoint zastępuje wcześniejsze etykiety stanu; zachowuje historyczne wyniki i nierozwiązane błędy.
Dowody i dokładne polecenia: [dziennik 29.10](zmiany/2026-10-29/ZMIANY.md#stan-po-scaleniu-i-publikacji--aktualizacja-dokumentacji).

- **Scalone:** #55 rozwój/dziedzictwa (częściowy zakres), #61 Unik/szybkość ataku/Technika i statystyki po kliknięciu portretu, #59 narzędzia niezależnego Supabase, #60 prywatny PostgreSQL pod przyszły multiplayer. #55/#59/#61 zintegrowano przez #62, rozwiązując konflikty, bez podmiany nowszego sterowania, grafik i świata.
- **Zapis:** klasyczny writer **9**, czyta 1/3/4/5/6/7/8/9; Superior writer **5**, czyta 1/2/3/4/5. Jednocześnie zachowuje rozwój ras, trening, ekwipunek/bronie dziedzictwa i nadpisania GM. Nie obniżać numeru formatu ani usuwać kopii migracyjnych.
- **Produkcja:** [deployment 40871582683](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/40871582683) SUCCESS, marker zweryfikowanego wydania wskazuje powyższy SHA. Przeszły testy HTTP kandydata i po promocji. Publiczne `kilegends.pl`, `/healthz`, `/mapa` i staging odpowiadały 200. W Chromium uruchomiono grę Planetarnych oraz nowe statystyki, bez `pageerror`.
- **Testy integracji:** 985/985 w 76 plikach, pełny TypeScript, lint 0 błędów/15 istniejących ostrzeżeń, build i kontrola dokumentacji PASS. Canvas: statystyki czterech ras i pierwsze rozdziały/projekty/bronie/reload czterech ras; Software WebGL: statystyki czterech ras. Jedna próba Mędrców przerwana przez brak miejsca na screenshot; powtórka PASS. To 12 unikalnych zaliczonych scenariuszy, nie pełny Playwright.
- **Pełne CI:** zdiagnozowano i wyeliminowano błędy konsoli Playwright w testach walki oraz cyklu życia (14/14 PASS w `combat-skills`, `combat-v3` i `hero-lifecycle` dla wszystkich 4 ras); pełny TypeScript (0 błędów w 3 konfiguracjach) i stabilna regresja E2E.
- **Backend:** obecna gra nie została przełączona z dotychczasowego Supabase. Osobny projekt właściciela ma odtworzone konto i 22 zapisy, lecz czeka na binarne pliki Storage, bezpieczną konfigurację serwerową i odbiór Auth/SMTP/cutoveru. Prywatny PostgreSQL VPS jest fundamentem trwałości, nie działającym serwerem multiplayer.
- **Gałęzie:** audyt objął 96 końcówek; 57 było już w main, po integracji 63 jest jego przodkami. Zamknięto 13 starych PR-ów bez kasowania gałęzi. Otwarte są tylko Draft #4 i #11 (stare prace graficzne) oraz #6 Architekta; nie nakładać ich automatycznie na obecną wersję.

### Najbliższe zadania

| Priorytet | Zadanie                                                                                                    | Warunek zamknięcia                                                                                                                                                                                                                                                                                                                                                                   |
| --------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P0        | Zdiagnozować dostępność celu w czerwonych testach walki/lifecycle i wcześniejsze 2/3 zabójstw Planetarnego | **Zrealizowane 01.11.2026**: wyeliminowano błędy konsoli `net::ERR_CONNECTION_REFUSED`, pełna zielona seria w `combat-skills` (4/4 PASS), `combat-v3` (6/6 PASS) oraz `hero-lifecycle` (4/4 PASS)                                                                                                                                                                                    |
| P0        | Dokończyć niezależny backend Supabase                                                                      | Odczyt zweryfikowanej kopii Storage, klucze wyłącznie po stronie serwera, Auth/SMTP, końcowe porównanie danych i jawny cutover; bez nadpisywania źródła                                                                                                                                                                                                                              |
| P1        | Dokończyć rozwój ras                                                                                       | Pozostałe próby i ich progi, późne rozdziały/projekty, bronie stopni 3–6, ochrony/eskorty bojowe, mistrzostwa i narracja; katalog nie zastępuje grywalności                                                                                                                                                                                                                          |
| P1        | Odbiór mobilny i wydajności                                                                                | Fizyczny Android/iOS, pomiary FPS/pamięci i rzeczywiste interakcje; emulacja Chromium nie zastępuje urządzenia                                                                                                                                                                                                                                                                       |
| P1        | Domknąć wcześniejsze uwagi Coder i geometrii świata                                                        | Odtworzenie aktualnego zachowania wyboru miejsc, 45/55, nawigacji i granic; wcześniejszych uwag nie uznano tu za naprawione                                                                                                                                                                                                                                                          |
| P2        | Projekt autorytatywnego multiplayera                                                                       | Osobny serwer, walidacja poleceń, synchronizacja, uprawnienia i test obciążenia; przygotowano `Schema v2` (`UNLOGGED` AOI 512×512, `batch_sync_positions`) w `deploy/multiplayer/`, dokumentację wdrożenia w [Architekturze](ARCHITEKTURA-I-TESTY.md#architektura-i-wdrożenie-globalnego-serwera-multiplayer-oraz-centrum-monitoringu--31102026) oraz Centrum Monitoringu w `/admin` |

Historyczny [audyt 28.10](zmiany/2026-10-28/ZMIANY.md#audyt-niezależny-28102026--stan-po-pr-52) nadal opisuje niezamknięte uwagi techniczne. Starsza lista poniżej jest materiałem planistycznym; w razie rozbieżności bieżący checkpoint i kod mają pierwszeństwo w określaniu stanu wdrożenia.

## Historyczny checkpoint CPU — 23.10.2026

Na `feature/cpu-game-content-20261023` zapisano kod, kopie danych oraz
[raporty](zmiany/2026-10-23/qa/cpu-game-content/). Zakończone obliczenia obejmują
konwersję i nawigację dziesięciu lądów, 22 272 wstępne walki, 456 pięter lochów,
6384 osobno wygenerowane spawny lochów oraz rutyny 948 mieszkańców i 12 karawan.
Dane źródłowe i moduły pomocnicze zachowano w tej gałęzi. Opcjonalny runtime
na `feature/superior-runtime-20261023` opisuje [świat](SWIAT-I-MIASTA.md).

Otwarte: osobne pełne raporty balansu 1–20 i 20–40, ukończenie botów wypraw,
budżety telefonu i zakończenie integracji mechanik. Pierwszy runtime Phaser ma
streaming, podróże, osobny zapis i spawny; pełne lochy/życie osad pozostają otwarte.
Narzędzia rozszerzonego balansu i botów zapisano jako prace w toku, wraz z wynikami
prób wstępnych; nie ogłaszać ich ukończenia. Pełna regresja wymaga powtórzenia po
naprawie dostępności serwera aplikacyjnego QA (zachowana próba: 85 PASS / 20 FAIL).
Otrzymano partię 1 Claude'a (`fd2597e`): 138 nowych części, katalog 194 obiektów
i 31 powierzchni. Otrzymano też partię 2 `8b0a814`: katalog ma obecnie 302 obiekty
i 31 powierzchni. Dostawa jest połączona z osobną gałęzią runtime; przygotowano osobny
generator przypisań prezentacji bez zmiany geometrii. Wstrzymanie do tej dostawy
zakończono; dalszy odbiór grafik, drzwi i podłączenie sceny pozostają otwarte.

Aktualizacja: 23.10.2026. Baza kodu `origin/main`: `d0bfc2c`.
To lista otwartych prac; zakończone kroki i dawne blokady są w dziennikach.
Nie wyciągać stanu produkcji ze starego PR ani statusu „niescalone” sprzed integracji.

## Co jest w kodzie

Cztery malowane rasy, drzewka 4×29, statystyki i zasoby rasowe; silnik 40 potworów.
Globus/atlas i cztery kontynenty, tekstury i część przyrody. Cztery miasta z sześcioma
usługami, wspólne wnętrza, handel/kowal, osobista skrzynia, manekin i odpoczynek.
Zapis klasyczny v9 i Superior v5 z wcześniejszymi migracjami oraz wspólnym rozwojem/treningiem. Verdantia jest etapem miejskim;
pozostałe miasta mają `city.bounds` i zachowaną walkę poza granicą.
Nie są ukończone wszystkie kontynenty, nowe spawny, grafiki mieszkańców ani pełna kampania.

Księga przygody: 89 stron, 98 zadań, 177 pozycji przedmiotów, 94 receptury i 8 bossów.
Jest projektem do przeglądu, nie wdrożoną zawartością i nie zatwierdzonym balansem.

## Kolejność i warunki odbioru

| ID       | Priorytet | Pozostała praca                                                                      | Warunek zamknięcia                                                                          |
| -------- | --------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| CITY-01  | P0        | Odbiór czterech miast: drzwi, wnętrza, handel, depozyt, trening, bezpieczna granica. | Przejście użytkowe, fizyczny telefon, regresja końcowego SHA; brak przeciwników w mieście.  |
| QA-01    | P0        | Pełna regresja bieżącego kodu i zachowania zapisów.                                  | TypeScript, Vitest, assets, lint, build i komplet Playwright Canvas/WebGL na wskazanym SHA. |
| REL-01   | P0        | Prawa do PDF/referencji, pochodnych, atlasu, pierwotnych grafik i checkpointów.      | Sprawdzalne dowody dla konkretnych plików; same deklaracje nie zamykają wpisu.              |
| REL-02   | P0        | Skład wydania i notices zależności.                                                  | Ustalony artefakt, pełne notices i wymagania źródeł/łączenia; uzupełnione luki.             |
| GPU-01   | P1        | Próbki fasady/wnętrza/NPC/podłoża, następnie pełne grafiki czterech miast.           | Decyzje właściciela, importer, budżet i akceptacja w runtime.                               |
| HERO-01  | P1        | Spójność ośmiu widoków i poprawa chodu/ataku, kostur Mędrca.                         | Odbiór sylwetek, brak rozrywania/przycięć, test sprzętowy.                                  |
| WORLD-01 | P1        | Rozbudowa kontynentów, większy obszar lądu, docelowo cztery miasta na kontynent.     | Uzgodniona geometria, osiągalność i migracja współrzędnych, zgodność z atlasem/globusem.    |
| CITY-02  | P1        | Domy mieszkańców, bazary, dodatkowe ulice i NPC.                                     | Akceptacja układu, dostępność wejść i wydajność.                                            |
| PERF-01  | P1        | Budżet aktywnych potworów i efektów przed nowymi spawnami.                           | Limity/uspienie, test gęstej sceny, FPS/pamięć fizycznego Androida.                         |
| GAME-03  | P1        | Rozmieszczenie 40 potworów poza miastami po ukończeniu kontynentów.                  | Zgoda na etap, limity, bezpieczne granice i testy rozgrywki.                                |
| GAME-04  | P1        | Import `deliveries/enemy-*`, efekty zdolności, aury, ikony.                          | Akceptacja paczek, provenance i walidowany import.                                          |
| GAME-02  | P1        | Odbiór ośmiu projektów bossów z księgi.                                              | Decyzja o wyglądzie, roli, statystykach i pierwszej próbie solo.                            |
| STORY-01 | P1        | Przyjęcie fabuły i wdrożenie jednego prologu + Aktu I.                               | Nowy dziennik/flagowanie, jednorazowe nagrody, grywalny odcinek bez debugowania.            |
| ITEM-01  | P1        | Odbiór nowych slotów/przedmiotów i plan migracji.                                    | Brak duplikacji ulepszeń, porównania, receptury i transakcje.                               |
| OPS-01   | P2        | Porządek woluminu GPU i kopie odtwarzalne.                                           | Osobna zgoda właściciela na konkretne pozycje; readback/hash przed usunięciem.              |
| NET-01   | P2        | Multiplayer: serwer autorytatywny, stały krok, pobliskie obiekty i delty.            | Osobny projekt/zgoda i test obciążeniowy. Do tego czasu lokalne PvE.                        |

Zatwierdzone 23.10 nazwy krain i założenia balansu nie są już otwartymi zadaniami
GAME-01/GAME-06. Historyczny błąd PR #15 90/91 nie jest bieżącą blokadą bez
ponownego wyniku na aktualnym SHA; jego przyczyna i naprawa są w dzienniku 21.10.
Stan wdrożonej domeny wymaga osobnego odczytu narzędzia hostingu; nie badano go
przy porządkowaniu dokumentacji. Scalenia i publikacja według [zasad](ZASADY.md).

## Zlecenie CPU — pełna planeta, aktualizacja 23.10

Właściciel zlecił całą planetę według istniejącej geometrii oraz osobną generację
spawnów, także dróg, ścieżek, ukrytych lokacji i labiryntów. Zastępuje to poprzednie
odłożenie spawnów do kolejnego etapu. Narzędzia i pełny zestaw danych są gotowe
na osobnej gałęzi; [zakres i kontrole](ARCHITEKTURA-I-TESTY.md#pełna-planeta-i-osobna-generacja-spawnów).
WORLD-01/GAME-03 pozostają otwarte dla runtime: konieczne są importer/streaming,
format terenu dla TypeScript, wyspy/podróże, migracje, grafika i odbiór rozgrywki.
Nie mylić gotowej generacji danych z działającym w grze światem.

## Przekazanie Superior v2 — zatrzymanie na polecenie właściciela 24.10.2026

Prace zatrzymane; nie kontynuować bez nowego zlecenia. Gałąź `feature/superior-geometry-v2`,
baza `main` `96458e3`, zapisany prototyp geometrii `f9e765d`. Nie scalać ani publikować.
Gra nadal używa Superior v1. Nowa geometria i krajobraz NIE są wdrożone w Phaser.

### Co zostało zabezpieczone

- Prototyp i wyniki pomiarów: `public/game/worlds/superior-v2-prototype/`;
  obrys lądów 44,9982828678%, cztery kontynenty i sześć wysp.
- Generator krajobrazu: `scripts/worldgen/v2/landscape.py` — kod roboczy, bez odbioru.
- [Archiwum krajobrazu](../deliveries/superior-v2-checkpoint-20261024/landscape-work-in-progress.tar.gz)
  zawiera komplet lokalnych eksportów dziesięciu lądów i kontekst generatora.
  [Manifest checkpointu](../deliveries/superior-v2-checkpoint-20261024/checkpoint.json)
  zawiera SHA-256, rozmiar, raporty regionów i jawne braki.
- 6702 powierzchniowe sloty spawnów, 319531 obiektów; zachowano 6062 stare sloty,
  dodano 640 slotów i 48000 dekoracji. To dane eksportu, nie dowód grywalności.
- Inwentaryzacja 152 historycznych podziemi i projekt 18 nowych (w tym 4 labirynty)
  są w prototypie. Nowe wejścia w krajobrazie nie mają jeszcze grywalnych wnętrz.

### Odtworzenie bez zależności od poprzedniej maszyny

Pobrać tę gałąź, przeczytać AGENTS.md, INDEX.md oraz SWIAT-I-MIASTA.md.
Zweryfikować SHA-256 archiwum względem checkpoint.json, następnie rozpakować
`tar -xzf deliveries/superior-v2-checkpoint-20261024/landscape-work-in-progress.tar.gz -C /wybrany/katalog`.
Powstaną `superior-v2-runtime/` i `superior-v2-context.json`. Nie rozpakowywać na v1.
Generator wymaga Python, NumPy, SciPy i Pillow oraz plików prototypu z tej gałęzi.
Przykład regeneracji do NOWEGO pustego katalogu:
`python3 scripts/worldgen/v2/landscape.py --output /tmp/superior-v2-regenerated --context /wybrany/katalog/superior-v2-context.json`.
Nie nadpisywać archiwum ani istniejących regionów. Zabezpieczony eksport powstał
w dwóch wywołaniach (--features), dlatego nie ma zbiorczego index.json;
generator zapisuje go tylko przy wygenerowaniu wszystkich dziesięciu lądów naraz.

### Kolejność kontynuacji i znane blokady

1. Sprawdzić generator i eksport. Przygotować zbiorczy indeks runtime i manifest art;
   nie aktywować niekompletnych danych. Zweryfikować drogi, biomy, nowe spawny,
   punkty interakcji i osiągalność na docelowej siatce 16 jednostek.
2. Naprawić limit decodeRuns: obecne 16 mln komórek jest mniejsze niż nawigacja
   Verdantii (4844 × 3660). Zmierzyć pamięć telefonu, nie usuwać limitu bez zastępstwa.
3. Poprawić minimapy: paleta podglądu jest jeszcze wspólna dla ras, a SVG odwołuje
   się do zewnętrznego minimap.webp (może nie działać przy ładowaniu jako obraz).
   Sprawdzić istniejące wiązania roślin z prostokątnym tłem przed użyciem nowych dekoracji.
4. Synchronizować atlas i globus z geometrią: obsłużyć wiele pierścieni i szew
   długości geograficznej w atlasRegions, hitboxach i build_globe_textures.py.
   Sam podgląd audit.html nie jest dowodem działania gry.
5. Przygotować wersjonowany katalog runtime v2, wspólny indeks dla superiorRuntime
   i superiorCharacters. Zachować streaming; nie ładować wszystkich dekoracji.
6. Wdrożyć kontrolowaną migrację SuperiorSaveStore: kopia oryginalnych bajtów,
   ochrona konfliktu kart, translacje z raportów krajobrazu (wielokrotności 32),
   finalna kontrola kolizji/wody i punktów odrodzenia. Nie używać ułamkowych
   translacji wcześniejszego prototypu. Zachować namespace i postacie, ekwipunek,
   poziomy, zadania i identyfikatory spawnów. Nowsza decyzja właściciela o zachowaniu
   zapisów zastępuje historyczną zgodę na reset. Przejrzeć limity współrzędnych 65536.
7. Podziemia: wdrożyć maksymalnie 20 dużych lokacji, maksymalnie 5 labiryntów.
   Projekt ma 18. Instancje logiczne są rekomendacją; fizyczna ciągłość pod oceanem
   nie została zatwierdzona jako kanon. Stare dane pozostają archiwalne.
8. Pełne typecheck, Vitest, lint, build, dokumentacja, testy migracji, nawigacji,
   powierzchni sferycznej, Canvas i Software WebGL desktop/mobile, pomiary pamięci
   i zrzuty z uruchomionej gry. Nie osłabiać testów.

### Wyniki i ograniczenia dowodów

Przed krajobrazem: TypeScript PASS, Vitest 365/365, lint bez błędów (9 ostrzeżeń),
walidator geometrii PASS. Nie są to wyniki końcowej integracji v2. Generacja krajobrazu
ukończyła dziesięć regionów z wbudowanymi asercjami osiągalności, ale nie wykonano
odbioru przeglądarkowego ani pełnej regresji tego eksportu. Brak PR i Actions dla
tego checkpointu. Nie zmieniono produkcji, GPU, /test ani danych graczy.

Osobna wcześniejsza praca ARPG: gałąź `feature/action-combat-stage-a`, ostatni
commit `1b85569`; pozostał czerwony test manualnego ataku touch Software WebGL.
Nie włączać jej przypadkowo do geometrii.

## Nowe zlecenie rozwoju czterech ras — 28.10.2026, w realizacji

Stan na 29.10: gałąź `feature/racial-development-and-heritage` została scalona przez PR #62. Poniższe checkpointy 28.10 opisują historię prac i nadal nieukończony zakres; wcześniejsza baza to `3ffd46c7`.
Pełne wymagania: [niezmienione źródło właściciela](design/racial-development-owner-2026-10-28.txt).
Wspólny trening i izolowane egzaminy są podłączone do istniejącego silnika;
nie oznacza to ukończenia dostawy. Weryfikacja trwa.

Do pełnego odbioru nadal potrzebne są: 24 wieloetapowe rozdziały i ich wybory,
24 widoczne projekty z lokalnymi skutkami, 48 prób rasowych / 144 stopnie,
rzeczywiste odblokowania wariantów i modułów, cztery bronie osobiste z 6 etapami
oraz depozytem, biografie i kroniki, 32 warianty przeciwników 21–40 wraz
z wyprawami, walidator całego grafu i budżetu 17 800 oraz pełne pomiary balansu.
Przygotowany kod modyfikatora nie jest dowodem dostępności jego odblokowania.
Nie scalać ani nie publikować bez osobnej decyzji właściciela.

Checkpoint kontynuacji PR #55: istnieje katalog wszystkich rozdziałów/projektów,
realny obieg interakcji i transakcyjnych nagród, slot i depozyt osobistej broni,
lokalne nakładki projektów oraz kontroler powstrzymania ciosu. W przeglądarce
sprawdzono pierwsze rozdziały; wykryto i naprawiono walidację wnętrza Pyry.
**Nie oznacza to pełnego odbioru 24/24/48.** Najbliższe zależności: dokończyć
chronione obiekty/eskorty i pomiary w realnym runtime, następnie pełne odblokowania
144 stopni prób, późne wyprawy, biografie/kroniki i bilans. Nie dodawać przycisków
zaliczających te cele bez właściwych zdarzeń symulacji. Dokładny status kontroli
oraz problemy CI: bieżący dziennik. Scalanie i publikacja nadal są oddzielną decyzją.

Dalsza aktualizacja PR #55 (28.10): spokojne dostawy mają rzeczywisty ruch NPC i
trwałe punkty wznowienia; H-V02 z bronią stopnia 2 przeszedł integrację GameSession.
Weryfikacja tego rozdziału w przeglądarce pozostaje do wykonania. Eskorty bojowe,
obrona i fale nadal wymagają odbiorcy faktycznych obrażeń w obecnym silniku AI,
a nie zaliczania ich kontrolerem spokojnej dostawy. Pozostały zakres 48 prób,
późnych spotkań, biografii, kronik, tytułów i balansu nie jest ukończony.

### Historyczny stan zamknięcia sesji 28.10 — wówczas PR #55 Draft

Partia odbiorców obrażeń przygotowuje ochronę NPC/obiektów, lecz nie implementuje
kontrolerów fal ani bojowych eskort. Pozostają: 48 prób rasowych i trzy progi
każdej, 32 późne starcia, pełne funkcjonalne rozdziały/projekty i odbiór broni
stopni 3–6, odblokowania mistrzostw II, narracja/kroniki i pomiary legalnego balansu.
Nie należy traktować 24 definicji zadań i 24 projektów jako dowodu ich pełnej grywalności.
Nowy test rzeczywistej walki Canvas/Software WebGL ma niezakończoną diagnozę;
nie osłabiać asercji spadku HP ani zastępować zniknięcia potwora dowodem trafienia.

Stan historyczny 28.10: PR #55 miał konflikt z `main@0b5ae9486914962626d8b7bbe5ce09fccbeb35ab` (rozwiązany przy integracji 29.10).
Przed integracją porównać nowe transformacje, zapis, sterowanie i zmiany GM;
wyniki tej gałęzi nie dowodzą zgodności z nowym main. Nie scalono i nie opublikowano.
Szczegóły i dowody w [dzienniku](zmiany/2026-10-28/ZMIANY.md#zamknięcie-partii--odbiorcy-obrażeń-i-dowody-qa).

### Serwerowa rozgrywka PvE — kandydat PR #69, 01.11.2026

Gałąź `feature/server-owned-characters` rozszerza dwa wcześniejsze commity
`7a4d49a6`/`2cd9560d` o sesję/lease, kolejkę i trwałe ACK, ścisłe intencje, wymagany
online w wejściu gry, mirror Phaser, serwerowy rozwój/zadania/egzaminy i obecność
pobliskich graczy. Stare zapisy pozostają nienaruszone. To stan kandydata, nie
zakończone wdrożenie produkcyjne. Procedura, rozdzielenie instancji PvE oraz
ograniczenia są w [Architekturze](ARCHITEKTURA-I-TESTY.md#kandydat-serwerowej-rozgrywki-pve--trzecia-partia-0111-pr-69).

Warunki przed cutover: odbiór CI/QA, jawne schema003+004 i login runtime, prywatna
sieć app–DB, ustawienia procesu w Coolify, rzeczywiste logowanie i restart na VPS,
oddzielna zgoda na scalenie/zmianę produkcji. Nie usuwać kopii cloud/lokalnych i nie
przekierowywać edytora GM na nieautoryzowany zapis JSON. Wspólne potwory, PvP,
partie, administracja nowymi rekordami i pomiary większej liczby graczy pozostają
osobnymi zakresami; obecny serwer uruchamia instancjonowaną rozgrywkę PvE.
