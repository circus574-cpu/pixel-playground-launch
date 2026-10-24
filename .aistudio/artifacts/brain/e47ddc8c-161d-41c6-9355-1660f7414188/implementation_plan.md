# Ki Legends — Rozbudowa Mechaniki Walki, Drzewek Rozwoju (116 Węzłów) oraz HUD/UI Anime RPG

Kompleksowy plan wdrożenia docelowej mechaniki walki Etapu 2 (lokalne PvE) zgodnie z Aneksem Właściciela (22.10.2026) i *Księgą Przygody v1.0*, obejmujący unikalne rdzenie 4 ras, pełne drzewka rozwoju (4 × 29 węzłów), matematykę obrażeń i tarcz, statusy i zachowania 40 potworów z Bestiariusza oraz nowy taktyczny HUD w ciemnej stylistyce anime RPG z dynamicznym kolorem rasy i nieblokującymi szufladami bocznymi.

---

## Zatwierdzone Decyzje Projektowe

> [!IMPORTANT]
> Poniższe decyzje zostały potwierdzone w fazie pytań i stanowią punkt wyjścia do implementacji:

- **Potwierdzona Decyzja 1 — Zakres Wdrożenia (Pełny Pakiet Bojowy)**: Jednoczesne wdrożenie unikalnych mechanik rdzeniowych 4 ras, docelowego wzoru obrażeń i trafień krytycznych, warstwy tarcz (`Shield HP`), kompletnych 4 drzewek rozwoju (po 29 węzłów na rasę, łącznie 116 węzłów z parami wykluczającymi i Transformacją `T`) oraz systemu efektów statusowych, słabości żywiołowych i specjalnych zachowań AI dla 40 potworów.
- **Potwierdzona Decyzja 2 — Kierunek Wizualny HUD/UI**: Ciemny, wysokokontrastowy styl anime/manga RPG (głęboki obsydian i łupek `#0c0a09` / `#1c1917`) z dynamicznym akcentem kolorystycznym dopasowanym do aktywnej rasy (**Planetarni**: Szmaragd `#10b981`, **Mędrcy**: Złoto Eteru `#f59e0b`, **Androidy**: Cyjan Plazmy `#06b6d4`, **Legendy**: Karmazyn Żaru `#ef4444`).
- **Potwierdzona Decyzja 3 — Ergonomia Dostępu podczas Walki**: Szybkie szuflady boczne (Slide-Over Drawers) oraz nakładki nad areną otwierane skrótami klawiszowymi lub przyciskami HUD dla **Drzewka 29 Węzłów**, **Ekwipunku (7 slotów + mikstury)** oraz **Podglądu Bestiariusza/HUD**, pozwalające testować buildy w locie bez przerywania sesji walki.

---

## 1. Koncepcja Główna i Cele Rozbudowy

- **Co dostarcza rozbudowa**:
  1. **Prawdziwa asymetria 4 ras**: Zamiast identycznego pocisku, każda rasa otrzymuje swój kanoniczny atak podstawowy (`R` / `Spacja`), czas ataku (`650 ms` / `700 ms` / `800 ms`), zasób specjalny i pasywkę klasową.
  2. **Pełny kalkulator RPG i 116 węzłów rozwoju**: Dokładne tabele statystyk dla poziomów 1–20 (HP, KI, ATK, DEF, ruch `j./s` z premią +5%/poz., `KI/s`, `Kryt. %`), alokacja do 20 punktów umiejętności z bramkami wykluczającymi na poziomie 13 (`A7/A8`, `B7/B8`, `C7/C8`) oraz darmowym resetem do poziomu 10.
  3. **Żywy ekosystem 40 potworów**: Silnik statusów obsługujący efekty kontroli (Ogłuszenie, Unieruchomienie, Spowolnienie, Uciszenie, Strach, Przyciągnięcie), obrażenia w czasie ze stackami (Trucizna 1–5x, Podpalenie, Krwawienie), pancerz kierunkowy (ciosy w plecy +25%/+40%), szarże z oknem odsłonięcia, wybuchy po śmierci, tarcze i słabości żywiołowe.
  4. **Interaktywne Studio i HUD Anime RPG**: Profesjonalny HUD bojowy z dedykowanym wskaźnikiem mechaniki rasy, paskiem aktywnych buffów/debuffów, pasem mikstur oraz wzornikiem komponentów HUD/UI w klimacie gry.

---

## 2. Doświadczenie Gracza (UX) i Projekt Wizualny HUD/UI

### A. Przepływ Rozgrywki i Testowania na Arenie
1. **Wybór Rasy i Poziomu Testowego (1–20)**: Gracz wybiera jedną z 4 ras na górnym pasku HUD lub przełącza poziom suwakiem testowym, aby natychmiast sprawdzić skalowanie statystyk i punkty drzewka (od 1 do 20 pkt).
2. **Walka w Czasie Rzeczywistym z Unikalnym Rdzeniem Rasy**:
   - **Planetarni (Verdantia)**: Atak wręcz *Cios Szlaku* co `650 ms` w stożku przed postacią; co 3. uderzenie zadaje `×1,3` obrażeń z szmaragdowym rozbłyskiem, a pasywka *Adaptacja do terenu* wzmacnia mobilność i zrywy.
   - **Mędrcy (Aetheria)**: Dystansowy *Pocisk Ki* co `800 ms` (zasięg `420 j.`); użycie zdolności z gałęzi B tworzy na ziemi świetliste **Kręgi Eteru** (5 s), które spowalniają wrogów o 40%, redukują ich obrażenia o 10% lub odbijają pociski.
   - **Androidy (Nexus-9)**: *Strzał Impulsowy* co `700 ms` (zasięg `360 j.`) nabija **+4 Ładunku Rdzenia** (0–100, lub 70/150 z węzłami C7/C8). Przekroczenie 100 wywołuje 2-sekundowe **Przegrzanie** (chyba że wybrano *Stabilny Rdzeń* lub aktywowano *Formę Pełnego Rdzenia*), a *Wyładowanie Rdzenia* zużywa cały ładunek na potężny strzał liniowy `×(1,0 + Ładunek/50)`.
   - **Legendy (Pyra)**: *Uderzenie Żaru* wręcz budujące **Żar (0–100%)** wraz ze spadkiem HP i kolejnymi trafieniami; zdolność *Przełamanie* niszczy osłony wroga i ogłusza na 1,2 s, a *Ostatni Płomień* chroni przed śmiertelnym ciosem, zostawiając 1 HP i lecząc 30% życia.
3. **Szybkie Szuflady Boczne (bez opuszczania areny)**:
   - Kliknięcie **Drzewko [K]** wysuwa prawą szufladę z trzema gałęziami (A, B, C), węzłem bazowym `R` i Transformacją `T`, pozwalając rozdawać punkty i natychmiast testować zmodyfikowane zdolności na potworach.
   - Kliknięcie **Ekwipunek [I]** wysuwa lewą szufladę z 7 slotami (Broń T1–T6 `+1/+2/+3`, 5 części pancerza `+1/+2`, Amulet i Pierścień) oraz pasem przedmiotów użytkowych (`U-01..16`).

### B. Makiety Wizualne HUD/UI w Tematyce Ki Legends

#### 1. Makieta Głównego HUD-u Bojowego (Nad Areną 60° Top-Down)
```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ [PORTRET] PLANETARNI · Poz. 14 (Powiernik Głosu)         [CEL: MAGMOWY KRAB · Poz. 8]    │
│  HP  [██████████████████░░░░] 593 / 593 (+118 Tarcza)     HP [████████████░░░░░░] 260/396│
│  KI  [██████████████░░░░░░░░]  74 / 102 (+1.65 KI/s)      Pancerz Frontowy · Tył +40% DMG│
│  RDZEŃ RASY: [●][●][○] Cios Szlaku (3. cios ×1.3)         Statusy: [Podpalenie 2s] [Ozn.]│
│  BUFFY: [Tarcza Liści 4.2s] [Pęd Szlaku +25% DMG]         Słabość: Zimno/Woda +30%       │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│                                                                                          │
│                            [ ARENA WALKI 60° TOP-DOWN ]                                  │
│                     8-kierunkowe sprajty ras, Kręgi Światła,                             │
│                    telegrafy szarż bossów i liczniki obrażeń                             │
│                                                                                          │
│                                                                                          │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│  PAS AKCJI ANIME RPG (Dynamiczny obrys w kolorze rasy)                  SZUFLADY SZYBKIE │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────┐   ┌──────┐ ┌──────┐   ┌──────────────┐ │
│  │SPACJA│ │  Q   │ │  E   │ │  C   │ │    T     │   │  1   │ │  2   │   │ [K] Drzewko  │ │
│  │ Atak │ │GałąźA│ │GałąźB│ │GałąźC│ │Przemiana │   │Mikst.│ │Tonik │   │ [I] Ekwipunek│ │
│  │650ms │ │18 Ki │ │18 Ki │ │12 Ki │ │Poz.20 Ult│   │6s CD │ │30s CD│   │ [B] Bestie   │ │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────────┘   └──────┘ └──────┘   └──────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

#### 2. Makieta Szuflady Drzewka Rozwoju (29 Węzłów na Rasę + Bramki Wykluczające)
```
┌─────────────────────────────────────────────────────────────────────────┐
│ DRZEWKO ROZWOJU: ANDROIDY (NEXUS-9)        Punkty: 14 / 20 [Reset Darm.]│
├──────────────────────┬──────────────────────┬───────────────────────────┤
│ GAŁĄŹ A: CELOWANIE   │ GAŁĄŹ B: TARCZE      │ GAŁĄŹ C: RDZEŃ PLAZMY     │
│                      │                      │                           │
│       [A9 Egzekucja] │       [B9 Fortyfik.] │       [C9 Przeciążenie]   │
│          ▲           │          ▲           │            ▲              │
│   ┌──────┴──────┐    │   ┌──────┴──────┐    │    ┌───────┴───────┐      │
│ [A7 Snajp] ✖ [A8 Rój]│ [B7 Kolce] ✖ [B8 Mod]│ [C7 Rdzeń150] ✖ [C8 Stab.]│
│  (Wykluczające Poz13)│  (Wykluczające Poz13)│   (Wykluczające Poz13)    │
│          ▲           │          ▲           │            ▲              │
│    [A5]     [A6]     │    [B5]     [B6]     │     [C5]      [C6]        │
│      └───┬───┘       │      └───┬───┘       │       └───┬────┘          │
│     [A4 Salwa]       │   [B4 Impuls EMP]    │   [C4 Rozład. Awaryjne]   │
│      ┌───┴───┐       │      ┌───┴───┐       │       ┌───┴────┐          │
│    [A2]     [A3]     │    [B2]     [B3]     │     [C2]      [C3]        │
│      └───┬───┘       │      └───┬───┘       │       └───┬────┘          │
│   [A1 Namierzanie]   │  [B1 Tarcza Plazm.]  │  [C1 Wyładowanie Rdzenia] │
├──────────────────────┴──────────┬───────────┴───────────────────────────┤
│        KORZEŃ [R]: Strzał Impulsowy (700ms, +4 Ładunku Rdzenia)         │
│        KORONA [T]: Forma Pełnego Rdzenia (Poz. 20 · +25% ATK, +15% DEF) │
└─────────────────────────────────────────────────────────────────────────┘
```

### C. System Kolorów, Typografii i Detali Anime RPG
- **Rozkład Kolorów 60-30-10**:
  - **60% Tło i Płótno**: Głęboki obsydian (`#0c0a09`) oraz ciemna zieleń/łupek areny.
  - **30% Powierzchnie Strukturalne HUD**: Półprzezroczysty łupek (`bg-stone-900/90 backdrop-blur-md`) z ostrymi obramowaniami `1px` i ściętymi narożnikami w stylu taktycznego anime.
  - **10% Akcent Rasy i Sygnały Stanu**: Dynamiczny kolor rasy dla aktywnych węzłów i pasków energii, biel/błękit dla warstwy Tarczy (`Shield HP`), bursztyn dla trafień krytycznych (`CRIT!`) i fiolet/czerwień dla statusów negatywnych.
- **Typografia i Liczby Tabelaryczne**:
  - Wyrazisty krój nagłówkowy dla nazw ras, rang fabularnych (*Mieszkaniec* -> *Legenda Superior*) i umiejętności.
  - Ścisłe `tabular-nums` (`font-mono`) dla wszystkich liczników HP, KI, czasu odnowienia (co `0.1s`), szansy na krytyk (`Kryt. %`) i czasu ataku (`650 ms`).

---

## 3. Kluczowe Decyzje Produktowe i Kompromisy Techniczne

- **Decyzja 1: Jednolity Silnik Obliczeń Statystyk i Obrażeń zgodny z Księgą Przygody**
  - *Wybrane podejście*: Wdrożenie kanonicznego wzoru `Obrażenia = max(1, round((ATK_Całkowity × Mnożnik_Zdolności × Mnożnik_Krytyku × Mnożnik_Słabości_i_Pleców) - 0.5 × DEF_Celu))` oraz pełnych tabel bazowych dla poziomów 1–20.
  - *Dlaczego*: Zapewnia 100% zgodności z punktem kontrolnym z rozdziału 18 PDF (Planetarny poz. 10 z bronią W-V4 ma `48 + 21 = 69 ATK`, a przeciw `24 DEF` zadaje dokładnie `69 - 12 = 57` obrażeń).
- **Decyzja 2: Oddzielna Warstwa Tarcz (`Shield HP`) i Efektów Kontroli**
  - *Wybrane podejście*: Obrażenia najpierw redukują aktywną tarczę (`Świetlista Bariera`, `Tarcza Plazmowa`, `Tarcza Liści`, `Głaz Strażnik`, `Tarcza Strażnika Rdzenia`), chyba że umiejętność niszczy osłony natychmiast (`B1 / Przełamanie` u Legendy lub `Rozbicie bariery` u Złotego Skarabeusza).
  - *Dlaczego*: Bez wydzielonej warstwy `shieldHp` połowa węzłów z gałęzi B i C u wszystkich czterech ras byłaby jedynie dekoracyjnym opisem.
- **Decyzja 3: Wbudowany Wzornik HUD/UI Anime RPG (Interactive HUD Design Studio)**
  - *Wybrane podejście*: Oprócz żywego HUD-u na arenie walki dodamy dedykowany widok podglądu architektury HUD/UI (pozwalający przełączać skórki 4 ras, stany Przegrzania/Żaru/Kręgów, telegrapy bossów i karty ekwipunku).
  - *Dlaczego*: Daje natychmiastowy, interaktywny wgląd we wszystkie komponenty interfejsu w wysokiej rozdzielczości na żywych sprajtach z repozytorium.

---

## 4. Architektura Techniczna i Model Danych

### A. Diagram Architektury Systemu Walki i HUD

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        STAN SESJI GRACZA (PvE)                             │
│  • Wybrana Rasa + Poziom (1–20) + Ranga Fabularna                          │
│  • Alokacja Drzewka (do 20 pkt, blokady A7/A8, B7/B8, C7/C8, węzeł T)      │
│  • Założony Ekwipunek (Broń T1–T6 +1..3, 5x Pancerz +1..2, Amulet, Pierść.)│
│  • Pas Użytkowy (Mikstury HP 6s CD, Napary KI, Jedzenie 300s, Toniki 30s)  │
└────────────────────────────────────┬───────────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                   KALKULATOR STATYSTYK I RDZENI RAS                        │
│  • Baza Rasy(Poz) + Ekwipunek + Pasywki Drzewka + Buffy Jedzenia/Szaleństwa│
│  • Zasoby Klasowe:                                                         │
│    - Planetarni: Licznik serii Ciosu Szlaku (1..3 -> ×1.3) + Pęd po uniku  │
│    - Mędrcy: Aktywne Kręgi Światła na mapie (Slow 40%, -10% DMG, Odbicie)  │
│    - Androidy: Ładunek Rdzenia (0–100/150), stan Przegrzania (2s/1s)       │
│    - Legendy: Pasek Żaru, Przełamanie Tarcz, Ostatni Płomień (1 HP save)   │
└───────────────┬────────────────────────────────────────────┬───────────────┘
                │                                            │
                ▼                                            ▼
┌───────────────────────────────────────┐  ┌─────────────────────────────────┐
│     PĘTLA ARENY I AI 40 POTWORÓW      │  │   TAKTYCZNY HUD I SZUFLADY UI   │
│  • Pancerz kierunkowy (plecy +25/40%) │  │  • Górny HUD Postaci + Celu     │
│  • Szarże liniowe i okna odsłonięcia  │  │  • Dolny Pas Zdolności (R,Q,E,C,│
│  • Wybuchy po śmierci i dzielenie     │  │    T) + Pas Mikstur (1, 2, 3)   │
│  • Leczenie sojuszników i przyzywanie │  │  • Szuflada Drzewka (29 węzłów) │
│  • Silnik Statusów: Stun, Root, Slow, │  │  • Szuflada Ekwipunku (7 slotów)│
│    Silence, Fear, Burn, Poison(1-5x)  │  │  • Wzornik Graficzny HUD/UI     │
└───────────────────────────────────────┘  └─────────────────────────────────┘
```

### B. Mapowanie Interakcji i Stanów
1. **Rozdawanie Punktów w Szufladzie Drzewka (`[K]`)**:
   - Walidacja wymagań poziomu węzła (`Poz. 1, 2, 4, 7, 10, 13, 16, 20`), posiadania węzła nadrzędnego oraz wykluczeń par `A7/A8`, `B7/B8`, `C7/C8`.
   - Kliknięcie węzła aktywnego (np. `A4`, `A9`, `B1`, `B4`, `B9`, `C1`, `C4`, `C9`, `T`) automatycznie podpina go pod sloty akcji `Q / E / C / T` na dolnym pasku HUD, a węzły pasywne natychmiast przeliczają statystyki i modyfikatory zdolności.
2. **Zarządzanie Ekwipunkiem i Miksturami (`[I]`)**:
   - Wybór broni rasowej (`W-V1..6`, `W-A1..6`, `W-N1..6`, `W-P1..6`), poziomu ulepszenia (`+0` do `+3`), zestawu pancerza (`T1–T6`) i biżuterii (`J-01..12`) na żywo pokazuje różnicę w tabeli matematyki walki (w tym test kontrolny z rozdz. 18 PDF).
   - Przyciski mikstur na pasku HUD obsługują osobne zegary odnowienia: `6 s` dla mikstur leczenia (`U-01/05/06`), `30 s` dla toników oczyszczających (`U-12/13`) oraz `300 s` dla jedzenia (`U-07..11`).
3. **Zachowania AI i Statusy w Walce**:
   -Każdy potwór na arenie posiada wektor orientacji (pozwalający wykryć atak od tyłu dla premii `+25%` / `+40%` przeciw *Magmowemu Krabowi*, *Lwowi Świątyni* i *Skanerowi Gąsienicowemu*), maszynę stanów zachowania (`idle`, `patrol`, `chase`, `windup_charge`, `vulnerable`, `channeling`, `flee`, `leash_return`) oraz kolejkę statusów wyświetlaną nad paskiem zdrowia i na karcie celu w HUD.
