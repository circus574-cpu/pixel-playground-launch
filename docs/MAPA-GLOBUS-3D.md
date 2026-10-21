# /mapa — globus 3D planety Superior (2026-10-21)

Status: **zaimplementowane i przetestowane w podglądzie; nieopublikowane.** Publikacja wymaga osobnej zgody właściciela.

## Co jest na stronie
- Domyślnie interaktywny globus WebGL (three.js + @react-three/fiber), ładowany leniwie tylko w przeglądarce. Serwer renderuje lekką powłokę z tłem kosmosu.
- Kanon kontynentów bez zmian, zgodnie z `src/game/world/worlds.ts` i `docs/STAGE3-FOUR-CONTINENTS.md`: Verdantia/Planetarni, Aetheria/Mędrcy, Nexus-9/Androidy, Pyra/Legendy, plus sześć wysp questowych o nazwach roboczych I–VI. (Uwaga z `docs/design/RASY_I_ETAPY.md`: PDF właściciela sam nie potwierdza tych nazw krain; pochodzą one z kodu gry i planu etapu 3.)
- Obrót myszą i jednym palcem, zoom kółkiem, szczypaniem i przyciskami, wybór regionu kliknięciem w powierzchnię, znacznik albo legendę, płynny przelot kamery do regionu, powrót do widoku całej planety, powolny obrót w bezczynności.
- Przełącznik „Mapa 2D” / „Globus 3D”. Płaski atlas jest też automatycznym fallbackiem: brak WebGL 2, błąd uruchomienia albo utrata kontekstu GPU (z komunikatem dla użytkownika).
- Ujawnienie: „Podgląd atlasu · niepołączony z grą · bez pozycji gracza”. Strona nie czyta zapisów, sesji ani pozycji gracza i nic nie zapisuje.

## Grafika
- Powierzchnia to ten sam malowany atlas 2:1 co mapa 2D (`atlas-3840.webp`), nałożony równoprostokątnie na kulę. Dzięki temu obrysy z `atlasRegions.json` trafiają w namalowane wybrzeża także na globusie.
- `scripts/build_globe_textures.py` wyprowadza z atlasu: kolor z wyrównanym szwem i rozmyciem przy biegunach (`globe-color-1920/3840`), mapę rzeźby i szorstkości (`globe-surface-2048`: góry przez bump, połysk oceanu) oraz poświatę lawy Pyry i reaktora Nexus-9/źródeł Aetherii po stronie nocnej (`globe-lights-2048`).
- Chmury (`globe-clouds-2048`) i tło kosmosu (`space.jpg`) wygenerowano narzędziem obrazów Lovable jako zasoby rastrowe. Atmosfera to shader fresnela (dwie powłoki).
- Po każdej zmianie atlasu albo obrysów uruchom ponownie skrypt (źródło chmur można podać jako argument).

## Wydajność i dostępność
- Telefony: DPR ograniczony do 1,5 (1,25 przy ≤3 GB RAM lub ≤4 rdzeniach), tekstura 1920 px, 96 segmentów kuli, bez MSAA przy DPR ≥ 2. Komputery: DPR do 2, tekstura 3840 px doczytywana po pierwszej klatce.
- Renderowanie na żądanie (`frameloop="demand"`): bez ruchu GPU nie rysuje nowych klatek.
- Znaczniki regionów to przyciski HTML (fokus klawiatury, nazwy dostępne), ukrywane po niewidocznej stronie planety. Klawiatura: strzałki, + / −, 0, Escape. `prefers-reduced-motion` wyłącza obrót, dryf chmur i animowane przeloty.

## Testy (2026-10-21)
- `src/test/planet-globe.test.ts`: zgodność rzutowania z UV three.js, szew, wybór regionów, kamera startowa mieszcząca całą planetę, limity zoomu, budżet DPR.
- `src/test/mapa-view.test.tsx`: fallback bez WebGL 2 z komunikatem; leniwy globus ze znacznikami i przełączenie na mapę 2D.
- Playwright w piaskownicy (Chromium, programowy WebGL SwiftShader — **nie fizyczny Android**): desktop 1280×800 i telefon 390×844 DPR 3 — klik powierzchni → Verdantia, legenda → Nexus-9, obrót przeciąganiem i palcem, szczypanie, zoom kółkiem, przełączanie 2D/3D, tryb bez WebGL, localStorage bez zmian, brak błędów konsoli. FPS i zachowanie na prawdziwym urządzeniu z Androidem nie zostały zmierzone.

## Ograniczenia
- Mgła wojny jest dostępna tylko w widoku 2D.
- Rzut równoprostokątny lekko rozciąga atlas przy biegunach; ląd leży w pasie, gdzie zniekształcenie jest niewielkie.
- Wyspy mają nazwy robocze; brak integracji z rozgrywką i podróżą między kontynentami.
