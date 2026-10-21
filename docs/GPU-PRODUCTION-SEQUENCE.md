# KI Legends — osobny plan produkcji GPU: rasy 3–4, następnie miasta czterech ras

**Decyzja właściciela: 2026-10-21.** Ten dokument określa **kolejność zleceń**, nie stan wykonania. Działania wykonywane wyłącznie po uruchomieniu GPU przez właściciela. Żadnego automatycznego start/stop/restart/terminate, zakupu usług, merge ani publikacji.

## Zasada nadrzędna
Kolejność jest sztywna: **(1) Androidy → (2) Legendy → (3) Verdantia/Planetarni → (4) Aetheria/Mędrcy → (5) Nexus-9/Androidy → (6) Pyra/Legendy**. Każdy numer jest osobną dostawą, etap nie przechodzi dalej bez testów i **wizualnej akceptacji właściciela**. Wersje i dowody muszą znaleźć się w GitHub, również gdy wykonawca traci kontekst.

## Warunki startu i ochrona danych
1. Sprawdzić HEAD aktualnego main, manifesty assetów, dokumentację, otwarte PR-y oraz status testów. Nie zakładać, że PR #15 jest scalony; dziś to Draft.
2. Sprawdzić aktualny stan i dostępność już działającego środowiska GPU **bez zmiany jego cyklu życia**. Niczego nie nadpisywać na trwałym dysku. Zapisać wersje modeli, ścieżki wejścia/wyjścia i sumy SHA-256.
3. Wymagane źródła: [GPU_ASSET_PIPELINE.md](GPU_ASSET_PIPELINE.md), [STAGE3-GPU-ASSET-LIST.md](STAGE3-GPU-ASSET-LIST.md), [design/RASY_I_ETAPY.md](design/RASY_I_ETAPY.md), `art/pipeline/gpu-production-targets.json`, `src/game/assets/contract.ts`. Oryginalny 12-stronicowy PDF nadal oczekuje na archiwizację; nie zastępować go referencją tekstową.
4. Produkować jeden próbkowy zestaw i pokazać rzeczywisty podgląd w silniku **przed** produkcją pełnej paczki. Po negatywnej ocenie poprawić ten sam etap, a nie przejść do następnego.
5. Wszystkie assety wersjonować, utrzymać pliki źródłowe i poprzednie działające zasoby. Zmiany gry w osobnym PR; lokalny renderer testowy nie jest dowodem jakości na fizycznym telefonie.

## ETAP 1 — rasa 3: Androidy / Nexus-9
- Kanon: srebro, grafit/czerń, elektryczny błękit, syntetyczny pancerz, rdzeń energetyczny, dyskretne świetlne elementy. **Autorska, rozpoznawalna sylwetka**, a nie przemalowany człowiek. Nie mieszać stylistyki z Legendami i Mędrcami.
- Jedna zatwierdzona twarz/głowa, korpus, kończyny, materiały i rig. Jedna kamera, światło i skala wszystkich ujęć. Sprawdzić 8 widoków przed animacją.
- Paczka bohatera `hero-android`: 8 kierunków × 52 klatki = **416** (idle 8, walk 8, attack 8, skill 8, hit 4, death 8, respawn 8). Mastery 512×512 RGBA; runtime 128×128, maks. 2048 px atlas. Utrzymać reguły priorytetów i nie zmieniać mechaniki/colliderów.
- Kontrola: mechaniczna i wizualna spójność 8 kierunków, animacja realnego chodu/ataków, ręce/nogi bez deformacji, stały punkt stóp, czytelność na mobilnym zoomie; wszystkie akcje w Phaser/WebGL i fallback.
- Dostawa: pliki źródłowe/rig, manifest, atlas, pochodzenie/licencje, weryfikacja SHA, testy, nagranie podglądu, osobny PR. **Brama: akceptacja właściciela.**

## ETAP 2 — rasa 4: Legendy / Pyra
- Kanon: czerń, karmazyn, stal, ciężkie elementy pancerza, wojownicze szarfy, płomienna energia. Wyrazista sylwetka, bez kopiowania znanych postaci i bez statycznego modelu obróconego filtrami.
- Ten sam produkcyjny kontrakt 416 klatek, 8 kierunków i 7 stanów jak dla Androidów; master 512, klient 128, atlas max 2048, zachowane animacje gry i kolizje.
- Sprawdzać broń, szarfy i efekt ognia bez migotania/pływania, animację śmierci i odrodzenia, brak przeskoków wizualnych.
- Wymagane są pliki źródłowe, kontrola praw, osobne PR/CI/QA i **akceptacja właściciela**. Nie rozpoczynać miast wcześniej.

## ETAPY 3–6 — miasta, po jednym dla każdej rasy
**Cel jakościowy:** zastąpić obecne prowizoryczne, schematyczne elementy **pięknymi, gęstymi, autorskimi lokacjami anime fantasy**, a nie jedną dekoracyjną planszą. Miasto musi być prawdziwym środowiskiem gry: przechodnie drogi, czytelne wejścia, warstwy, światło, życie, unikalne budynki, NPC, detale blisko i daleko. Kolizje, spawn, zadania, wydajność i zapisy pozostają prawidłowe. Nie niszczyć zaakceptowanego lasu Verdantii.

### ETAP 3 — Verdantia, miasto Planetarnych
Miasto organicznie wpisane w żywy las: monumentalne drzewa i drewniano-kamienne domy, wiszące pomosty, tarasy, zieleń, ciepłe światło bursztynowe, spokojne rynki, warsztaty, świątynia energii natury, punkty usługowe oraz charakterystyczne centrum. Zachować istniejące zatwierdzone elementy i bazowe szlaki; proponować większą przebudowę tylko po osobnej akceptacji.

### ETAP 4 — Aetheria, miasto Mędrców
Wielopoziomowe sanktuarium wiedzy: jasne kamienie, szmaragdowo-złote ornamenty, wielkie archiwa, świątynie, tarasowe ogrody, strumienie i wodospady, świetliste źródła KI, biblioteki, miejsca medytacji, eleganckie mosty i żywa roślinność. Monumentalność bez ograniczenia czytelności interakcji.

### ETAP 5 — Nexus-9, miasto Androidów
Miasto syntetycznej cywilizacji: własny język architektury, wysokie metaliczne kompleksy, rdzeń energetyczny, laboratoria, łączniki, żywe obwody światła, hangary, transparentne instalacje, portale jako **dekoracje dopóki mechanika ich nie istnieje**, strefy przemysłowe i place. Elektryczny błękit kontrastuje z ciemnym grafitem; nie ograniczać miasta do pustej siatki pudeł i linii.

### ETAP 6 — Pyra, miasto Legend
Imponująca twierdza klanów na wulkanicznych wyżynach: bazalt, stal, karmazynowe sztandary, arena, kuźnie, monumentalne bramy, mury, dziedzińce, rytualne posągi, mosty nad rozpadlinami, wulkaniczne światło i kontrolowane efekty ognia. Realne bezpieczne drogi i collider-y; lawa nie jest przechodnim podłożem bez osobnej mechaniki.

## Standard produkcji jednego miasta
1. **Preprodukcja:** mapa funkcji (rynek, NPC, sklep, kuźnia, questy, wejścia, punkty orientacyjne), plan pieszych tras i bloków kolizji, paleta, zestaw referencji oraz 2–3 kompozycje koncepcyjne do wyboru.
2. **Próbka in-engine:** jedna reprezentatywna ulica i centralny plac z postacią w prawdziwej skali kamery, pokaz na desktopie i viewportach mobilnych. Obowiązkowy odbiór **przed** masowym renderowaniem.
3. **Zasoby niezależne:** powtarzalne podłoża/przejścia, drogi, budynki jako osobne obiekty i warianty, propsy, drzewa/instalacje, oświetlenie, detale, poziomy renderowania. Katalogować każdy asset (ID, kotwica, wymiary, footprint, warstwa, koszt).
4. **Integracja:** mapowanie na realne klucze `gpu-production-targets.json`, zachowanie współrzędnych kluczowych punktów i zapisów albo formalny plan bezpiecznej migracji. Nie zmieniać reguł walki ani danych graczy dla potrzeb grafiki.
5. **Kontrola jakości:** zrzuty i film z realnej gry, czytelność NPC i przejść, zasięgi kamer, dotyk/HUD, asset validation, pełne TS/Vitest/lint/build/Playwright, WebGL Canvas/fallback, testy zapisu i powrotu, FPS/pamięć na urządzeniu fizycznym (jeśli nie wykonane, status NIEZWERYFIKOWANE).
6. **Odbiór:** kontrola estetyczna przez właściciela, zatwierdzenie źródeł/licencji oraz osobna decyzja o PR i wdrożeniu. Przy odmowie wrócić do projektu tego miasta; nie ruszać następnego.

## Kryteria twardego odrzucenia
Proste SVG/proceduralne bryły udające ukończone miasto, identyczne budynki przemalowane dla różnych ras, jedna spłaszczona ilustracja zamiast rozgrywalnej przestrzeni, niespójna perspektywa, nieczytelna mobilna skala, odcięte drogi, kolizje niezgodne z grafiką, spadki wydajności bez diagnostyki, migoczące sprite'y, naruszony zapis, brak źródeł/licencji, brak pełnego CI lub brak akceptacji właściciela.

## Obowiązkowy raport po każdej dostawie
Etap i świat; commit/PR; dokładne nazwy i liczba assetów; hashe masterów/atlasów; format/rozmiar; udokumentowane źródła/licencje; zrzuty i nagrania in-engine; wynik testów z SHA; pomiary sprzętowe lub jawne NIEZWERYFIKOWANE; regresje; decyzja właściciela; następny etap. Żadna deklaracja „gotowe” bez dowodu.

**Status wszystkich sześciu etapów z tego planu: PLANOWANE — nie zlecono automatycznego uruchomienia GPU i nie potwierdzono wykonania.**
