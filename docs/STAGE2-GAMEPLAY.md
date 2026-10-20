# Ki Legends — etap 2, 19.10.2026

## Status

Zaimplementowano lokalną pętlę PvE. Nie jest to sieciowe MMORPG.
20.10.2026 użytkownik zlecił publikację i testy. Wersja została opublikowana
na kilegends.pl; wykonano rzeczywistą pętlę rozgrywki w przeglądarce i kontrolę
układu mobilnego. Szczegółowe wyniki oraz granice weryfikacji znajdują się
w docs/QA-STAGE2-2026-10-20.md. Fizyczny telefon pozostaje do osobnego testu.

## Audyt przed zmianami

Baza prac: main 8be948eb7481056cd50310dd8aa9497fcdc53ef5.
Jedna scena Forest, Phaser 4.2.1, React 19, TanStack Start, SSR/Nitro/Cloudflare.
Świat ma 3072 × 2048 jednostek, kafle świata 32, klatki atlasu 64, oddalenie
kamery 0.62 na komputerze i 0.48 na telefonie. Render pozostaje warstwowy,
obiekty sortowane po Y; kolizje dotyczą stóp, osobno od ilustracji.

Było: animacja chodzenia w czterech kierunkach, ruch WASD/klik/dotyk, kamera,
minimapa, kolizje, wybór dzika i autoatak za 1 obrażenie co 700 ms.
Dziki miały po 3 HP, nie ruszały się, nie atakowały i nie odradzały.
Zadania i ekwipunek były atrapami interfejsu, umiejętności pokazywały blokadę.
HP, KI i poziom były wartościami stałymi. Nie było NPC, XP, łupów ani zapisu
rozgrywki. Prywatny szkicownik /test stanowi niezależny system i został zachowany.

## Wykryte błędy

- Wybór dzika obejmował okrąg 32 jednostek przy stopach; korpus grafiki często
  znajdował się poza obszarem trafienia. Nowy obszar obejmuje widoczny sprite
  i ma priorytet nad uruchamianiem joysticka.
- Kliknięcie celu za przeszkodą nie wyznaczało trasy. Dodano A* z prześwitem
  stóp i zakazem przecinania narożników.
- Pauza panelu mogła usuwać trasę nadaną przy zamknięciu dziennika.
  Poprawiono wznowienie i dodano test integracyjny przycisków.
- Ruch klawiaturą mógł kolidować z obsługą pól i przycisków. Obsługa respektuje
  fokus formularzy i dialogów, a przyciski bojowe oddają fokus po kliknięciu.
- Mobilne sterowanie widokiem znajdowało się w tym samym rzędzie co umiejętności.
  W wąskich widokach przeniesiono je pod minimapę.

## Wdrożone mechaniki

GameSession oddziela zasady od renderowania, bez zmiany silnika ani mapy.
Obecna scena renderuje ten sam model, którego używają testy.

- Podstawowy atak: 18 obrażeń na poziomie 1, zasięg 78, odnowienie 650 ms.
  Kliknięcie dzika wybiera go, uruchamia podejście i autoatak. Sprawdzane są
  żywy cel, przeszkody, zasięg, odnowienie i zasoby; postać obraca się do celu.
- Cięcie: mnożnik obrażeń 1.8, 12 KI, 3.5 s, zasięg 110.
- Impuls: mnożnik 1.6, 18 KI, 5 s, zasięg 300.
- Tarcza: 15 KI, 10 s odnowienia, przez 5 s zmniejsza obrażenia o 60%.
- Mikstura: do 65 HP, 6 s odnowienia; brak zużycia przy pełnym HP.
- Dzik: 66 HP, patrol przy miejscu startu, wykrywanie do 155 jednostek,
  pościg, atak za bazowo 9 co 1.4 s, ograniczenie terytorium, powrót z
  omijaniem przeszkód, leczenie po powrocie, odrodzenie po 18 s poza graczem.
- Śmierć gracza: 3 s do odrodzenia w bezpiecznym punkcie, bez utraty przedmiotów
  i zadań. Poza walką regenerują się HP, KI regeneruje się stale.
- Aira: samouczek, spacer do rynku na północ od fontanny, powrót, 40 XP.
- Ren: zadanie na 3 dziki, licznik wyłącznie po przyjęciu, powrót, 80 XP,
  30 monet i Ostrze strażnika. Każdy pokonany dzik daje dodatkowo 20 XP.
- Taro: przyjęcie zadania założenia ostrza, powrót, 40 XP; jednorazowe
  ulepszenie założonej broni za 15 monet (+4 ataku).
- Mio: kupno mikstur, ostrza i pancerza oraz sprzedaż łupów; kontrola salda,
  pełnego stosu, własności i ochrony założonych przedmiotów przed sprzedażą.
- Łup jest wybierany kliknięciem albo przyciskiem/F; dodanie do plecaka i
  monety są jednorazowe. Nieudane dodanie pozostawia łup na ziemi.
- XP, kolejne progi, awans i wzrost HP/KI/ataku/obrony. Cały łańcuch daje
  co najmniej poziom 2. Ekwipunek ma stosy do 99, broń, pancerz i mikstury.
- Dialogi/menu zatrzymują lokalną symulację. Zamknięcie i Escape ją zwalniają.
  Dziennik oraz mapa pozwalają podejść do właściwego NPC bez zgadywania ikon.
- Proceduralne efekty cięcia, pocisku, tarczy, obrażeń, leczenia, łupu,
  śmierci i awansu wykorzystują istniejące sprite'y i paletę świata.

## Zapis i ograniczenia

Klucz lokalny: ki-legends:adventure:v1. Schemat Zod, wersja 1, zachowane
poziom/XP, HP/KI, monety, przedmioty, wyposażenie, ulepszenie, zadania i pozycja.
Pozycja jest sprawdzana z kolizjami, śmierć przy odtworzeniu kieruje do wioski.
Zapis po akcjach, okresowo oraz przy ukryciu/opuszczeniu strony.
Nieprawidłowy lub nowszy zapis nie jest nadpisywany. Zmieniony zapis drugiej
karty blokuje nadpisanie przez kartę nieaktualną; błędy pamięci są komunikowane.

To zapis na danym urządzeniu i danej domenie, nie serwer ani zabezpieczenie
przed oszustwami. Łupy pozostawione na ziemi i stany przeciwników nie są
przenoszone przez odświeżenie. Brak kont, synchronizacji i wieloosobowego świata.
Nie zmieniano bazy ani prywatnego magazynu szkicownika.

## Pliki

| Zakres | Pliki |
| --- | --- |
| Zasady, zapis, A* | src/game/session.ts, src/game/navigation.ts |
| Phaser, wejście, efekty | src/game/mountGame.ts |
| HUD, dialogi, ekwipunek | src/components/game/GameHud.tsx, AdventurePanels.tsx, adventure.css |
| Most React–Phaser | src/routes/index.tsx |
| Testy | src/test/session.test.ts, adventure-ui.test.tsx, game-hud.test.tsx |
| Lokalny podgląd | scripts/playtest-entry.tsx, playtest.html, playtest.vite.ts, package.json |
| Dokumentacja | AGENTS.md, docs/PRODUCTION.md, src/game/README.md, ten raport |
| Pominięcie wyników podglądu w repo | .gitignore |

Wszystkie zasoby obecnej mapy pozostają bez zmian.

## Weryfikacja

40 testów w 9 plikach: istniejące 22 oraz 18 nowych.
Test pełnej pętli używa faktycznych kolizji i ruchu, bez teleportowania postaci:
rozmowa, spacer, odebranie pierwszego zadania, 3 walki, otrzymanie obrażeń,
umiejętność, podniesienie łupów, powrót, nagroda, wyposażenie, awans i odtworzenie.
Testy UI uruchamiają faktyczny HUD z GameSession i klikają przyciski.
Pozostałe sprawdzają zasięg, KI, tarczę, cooldown, LOS, śmierć, odrodzenie,
handel, ulepszenie, pełny stos, ponowną nagrodę/łup, uszkodzony zapis i dwie karty.

Zaliczone przed zapisem: pełny tsc --noEmit, ESLint zmienionych modułów (bez
błędów i ostrzeżeń), npm test (40/40), npm run build oraz npm run build:playtest.
Build podglądu ostrzega o rozmiarze chunku Phaser; nie jest to błąd kompilacji.

Powyższe testy modelu i DOM uzupełniono 20.10.2026 rzeczywistą rozgrywką
na opublikowanej produkcji. Scenariusz komputerowy obejmował nowy zapis,
trzy zadania, walkę, obrażenia, wszystkie umiejętności, łupy, wyposażenie,
handel i odświeżenie. Szczegóły: docs/QA-STAGE2-2026-10-20.md.

## Pozostałe prace i następny etap

1. Utrzymać regresyjne testy rozgrywki opisane w raporcie QA; dodać automatyczny
   test przeglądarkowy w CI, gdy dostępny będzie runner z renderowaniem Phaser.
2. Fizyczny Android/iPhone: dotyk, wielodotyk, pamięć, FPS, fullscreen.
3. Osobne finalne grafiki NPC i spójne kierunkowe klatki ataku/śmierci.
   Aktualni NPC świadomie używają istniejącej grafiki postaci z tintem,
   a dzik i bohater zachowują wcześniejsze zasoby.
4. Dopiero po tej walidacji: następny obszar, kolejne typy wrogów i zadań,
   następnie autorytatywny serwer i migracja lokalnego zapisu do kont.
