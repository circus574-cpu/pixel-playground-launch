# Zmiany 2026-11-14

### 1. Audyt zewnętrzny: trzy potwierdzone błędy poprawione

Zewnętrzny przegląd kodu (inne narzędzie, lista napraw P0–P4) sprawdzono twierdzenie po twierdzeniu w kodzie `main@b271cd1`;
poprawiono tylko to, co się potwierdziło i nie wymaga decyzji właściciela.

- **Eliksir KI zadawał 16× obrażeń zamiast +15%:** bonus `ki-focus` miał `dealtPct: 15`, a `deriveStats` liczy
  `dealt = 1 + dealtPct` (ułamek), więc przez 60 s mnożnik wynosił 16. Teraz `0.15`. Test sprawdza `kit.stats.dealt` = 1,15;
  na starym kodzie dawał 16.
- **Antidotum Oczyszczające zdejmowało tylko pancerz i osłabienie:** komunikat obiecuje „usunięto osłabienia”, a trucizna,
  podpalenie, krwawienie, spowolnienie, unieruchomienie, cisza, oślepienie, mgła, zakłócenie i znak zostawały. Nowa metoda
  `PlayerFx.cleanse()` zdejmuje wszystkie te efekty (ogłuszenie i strach zostają). Test nakłada truciznę, podpalenie,
  spowolnienie i osłabienie przed warzeniem i oczekuje pustej listy efektów.
- **Opis Mikstury Zdrowia:** w ekwipunku i w panelu przygody stało „Przywraca do 65 HP”, a mikstura leczy 40% maks. HP
  (`POTION.heal = 0.4`). Teksty poprawione.

Sprawdzone i nie poprawiane:
- „Szarpnięcie” sprite'a przy `skillc` (`mountGame.ts`): warunek sprawdza klip `skill`, ale każdy bohater go ma, więc
  szarpnięcie się nie uruchamia; to niespójność w kodzie, nie błąd widoczny w grze.
- Nazwy bossów w opisach Strażnika (`Zephyros`, `Core Golem`, poziomy 12+/14+) nie zgadzają się z `BOSS_CATALOG`
  (Ygdrasha i Thorgar, Arcykapłan Pustki i Aurelith, poziomy 15 i 20): potwierdzone, ale poprawka wymaga nowych opisów
  fabularnych, więc czeka na właściciela. `SettlementLife` jest podłączony tylko w testach (decyzja o integracji).
- Bramki z audytu wymagające decyzji właściciela (łup potworów poz. 12–18, pauza dialogu w trybie online, ograniczenie
  craftingu do stacji, łup bossów w zapisie) nie ruszane.

### 3. Mędrcy: chód z przodu i z tyłu z filmu właściciela

- Film `art-wip/gemini-anim-stages/sage-chod-przod-tyl.mp4` (10 s, 24 kl./s: przód, obrót, tył, obrót w bok) zastępuje
  dotychczasowy chód Mędrczyni z przodu i z tyłu (kierunki dół, góra i skosy; boki bez zmian). Paczka bohatera `3.3.0`,
  komórka 200 px; idle (oddychanie) przeliczony z nowych klatek.
- `scripts/anim/walk_rebuild.py` obsługuje `sage` (widoki przód 0–78 i tył 92–158, mapowanie jak u Legendy). Okres kroku
  zmierzony z różnicy dolnej części ciała (długa szata zasłania stopy, więc pomiar ze stóp był zbyt słaby): przód 32 klatki
  (minimum różnicy 11,6 przy typowej wartości ok. 40), tył 38 (25 przy ok. 45); `WALK_LOOPS="front=18:32,back=100:38"`.
- Budżet tekstur: zbiór rezydentny sceny Mędrca 85,08 → 86,74 MiB (limit 128); test `stream-texture-budget` zaktualizowany.
- Własna weryfikacja: plansza 8 kierunków × 8 klatek (rozmiar stały, przód i tył z ruchem szaty); w grze (Playwright)
  chód we wszystkich 8 kierunkach gra własne klatki `walk/<kierunek>` (boczne w lewo: `right` z flipX), 0 błędów
  w konsoli; testy `hero-clips-visible`, `gpu-pipeline`, `actor-animation`, `stream-texture-budget` przechodzą.
  Nie sprawdzono: online z przemianą KI, ostrość przy DPR 2×.
- Nadal brakuje: chód NPC (NPC w mieście i tak się nie poruszają) i osobny klip umiejętności A.
