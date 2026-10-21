# KI Legends — game design: wizja, zasady, zakres
Status: rekonstrukcja ustaleń i potwierdzeń z 2026-10-19–21. Projekt rozwijany etapami; nie wszystkie punkty są wdrożone.

## Wizja właściciela
Przeglądarkowe RPG/MMORPG z widokiem top-down i autorską oprawą anime fantasy, inspiracje odczuciem progresji Metin2/Diablo (nie kopiowanie zasobów). Czytelne na komputerze i telefonie, mało przycisków, grywalność i jakość jednej lokacji przed masowym rozszerzaniem świata. Początkowo **lokalne PvE**, sieciowy multiplayer dopiero w późniejszym etapie. Arena/PvP później, nie jako warunek pierwszej wersji.

## Pętla rozgrywki — potwierdzona dokumentacją etapu 2 i 3
Wybór pochodzenia i postaci → wejście do własnego regionu → samouczek NPC → eksploracja/ruch z omijaniem przeszkód → polowanie na dziki → XP i łupy → ekwipunek → handel i ulepszenie → dalsza progresja. Podstawowy atak automatyczny po wskazaniu przeciwnika; umiejętności i leczenie uruchamiane ręcznie. HP/KI, cooldowny, patrol/pościg, śmierć/respawn i zapis lokalny opisane w `docs/STAGE2-GAMEPLAY.md`.

### Konkretne mechaniki etapu 2 (historyczny kontrakt)
Atak bazowy poziomu 1: 18 obrażeń, 78 zasięgu, 650 ms odnowienia. Cięcie: ×1,8, 12 KI, 3,5 s; Impuls: ×1,6, 18 KI, 5 s; Tarcza: 15 KI, 10 s, redukcja 60% na 5 s; mikstura do 65 HP, 6 s. Dzik: 66 HP, patrol, pościg, atak i respawn. Są to liczby z dokumentacji etapu 2, wymagające ponownej kontroli po zakończeniu zmian.

## Pochodzenia i regiony
- Planetarni (`planetary`) — Verdantia (`verdant`), Wioska Początkowa.
- Mędrcy (`sage`) — Aetheria (`aether`), Sanktuarium Tysiąca Źródeł.
- Androidy (`android`) — Nexus-9 (`nexus`), Węzeł Świadomości.
- Legendy (`legend`) — Pyra (`pyra`), Twierdza Popiołu.
To cztery **kanoniczne** rasy. Starsze Human/Orc/Dwarf/Elf oraz ilustracje elfów i orków są odrzuconym lub zastąpionym materiałem; nie wprowadzać ich jako ras KI Legends.

## Questy i NPC
Verdantia: Aira (samouczek), Ren (polowanie), Mio (handel), Taro (ekwipunek/ulepszenie). Inne regiony: Sora/Ishin/Mei/Enso; LYRA-7/AXON/MIRA-2/HEF-4; Kaena/Rokan/Yumi/Goro. Role usługowe wspólne, nazwy i dialogi lokalne. Cel eksploracji regionu: Rynek / Źródło Pamięci / Rdzeń Świadomości / Arena Dziedzictwa. Dokładny rozdział ról sprawdzać w definicjach światów.

## Oprawa
Docelowo duże, czytelne postacie anime w ośmiu kierunkach, spójne animacje idle/walk/run/attack/skill/hit/death/respawn; oddzielne budynki, ścieżki, roślinność, dekoracje i efekty KI. Nie traktować plansz koncepcyjnych, renderów riga ani statycznych kadrów jako ukończonych spritesheetów. Użytkownik oczekuje oceny w **działającej scenie gry**, nie po liczbie PNG.

## Status i przyszłość
Potwierdzona dokumentacją bazowa pętla PvE i cztery grywalne regiony nie oznaczają czterech ukończonych wizualnie kontynentów. Nowe rasowe postacie, pełna oprawa miast, animacje i integracja GPU są w toku/niezweryfikowane na finalnym SHA. Multiplayer, arena/PvP i pełna gospodarka sieciowa to kierunki przyszłe, bez potwierdzonego zatwierdzonego zakresu technicznego. Nie wymyślać klas, talentów, rasowych bonusów, fabuły kampanii ani monetizacji.


## Korekta stanu po PR #8
Rzeczywisty runtime `main` nadal pokazuje wspólnego człowieka we wszystkich czterech pochodzeniach. Akceptacja przez właściciela dotyczyła wzorca wyglądu Planetarnego (pomarańczowy szal, jasna tunika, ciemne rękawice/buty), **nie** kompletnych animacji. PR #4 ma 179/416 klatek i nie przeszedł odbioru postaci w grze. Nie ma sprintu w obecnym gameplay, dlatego profil produkcyjny Planetarnego wymaga idle, walk, attack, skill, hit, death, respawn, bez `run` jako obowiązkowego klipu. Bazowy atak jest naliczany według `GameSession`, nie czasu kontaktu rysunkowej animacji.

HUD po PR #5/#7 ma pięć skilli min. 44×44 px, mobilne zwijane narzędzia, status-stack, odległościowy przycisk rozmowy i zachowane krytyczne ostrzeżenia zapisu. Odróżniać technicznie zaliczony UX od ostatecznej artystycznej akceptacji gry. Obecna kolejność produkcji: kompletny Planetarny → NPC/przeciwnicy → otoczenie, a kolejne rasy po odrębnej akceptacji. Szczegóły: HANDOFF/GPU_PRODUCTION w PR #8.
