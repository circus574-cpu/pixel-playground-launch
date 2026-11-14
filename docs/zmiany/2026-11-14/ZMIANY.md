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

### 2. Plan napraw z audytu: reszta po scaleniu pracy agentów swarm

Po PR #165 na `main` weszły commity agentów swarm (`SWARM audit`, dziennik 13.11, pkt 6), które zrobiły większość listy
z zewnętrznego planu: Eliksir KI i Antidotum (scalone z poprawką z #165, `clearDebuffs()` woła `cleanse()`),
`quest-deliver` dla przedmiotów V2 i materiałów, `bossId` w `boss_enter` i lista bossów Strażnika z `BOSS_CATALOG`,
rozmieszczenie NPC w osadach drugiego rzędu w siatce, tekst mikstury. Reszta sprawdzona na `main@44c4dc2` i poprawiona:

- **Plotki i dialog Strażnika:** w `RUMORS_BY_CONTINENT` (Aetheria, Nexus, Pyra) i w dialogu Sorana w `aether.json` stały
  nieistniejące postacie (Zephyros, Golem, „Władca Kharzul”, poziom 12+). Teraz nazwy, poziomy (15 i 20) i ataki pochodzą
  z `BOSS_CATALOG`: Arcykapłan Pustki i Aurelith, Arbiter Zero i Hydra-Rdzeń, Kharzul i Pyrrhax.
- **Dokumentacja łupu (`ROZWOJ-I-WALKA.md`):** opis mówił o 8% szansy i o dropie wszystkich 354 przedmiotów, a kod ma
  `DROP_CHANCE = 0.02` i tylko pospolite i niepospolite (`DROP_RARITIES`). Opis poprawiony, puste pule potworów wysokich
  poziomów opisane jako stan zamierzony do decyzji właściciela. `INDEX.md`: PR #151 jest scalony, nie „osobna gałąź”.

Nie ruszane (decyzje właściciela): łup potworów poz. 12–18, pauza dialogu i depozytu w trybie online, ograniczenie
craftingu do stacji, łup bossów w zapisie, integracja `SettlementLife`. Nie wykonano: przepisania specyfikacji e2e `city`
i `manga-hud` (nie uruchamiano e2e w przeglądarce w tej sesji).
