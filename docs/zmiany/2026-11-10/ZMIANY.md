# 2026-11-10

### 1. Dźwięki potworów, kroków, interfejsu i statusów (gałąź `feat/sfx-monsters-ui`)

- Na zlecenie właściciela (subskrypcja ElevenLabs się kończy) wygenerowano 173 pliki w `public/game/sfx/`: atak i śmierć 40 potworów i 8 bossów, ryk 8 bossów, 8 uniwersalnych odgłosów skilli potworów, kroki na 9 powierzchniach, 30 dźwięków interfejsu i świata oraz 5 dźwięków nałożenia statusu, 4 reakcje potworów na trafienie, 4 dźwięki ruchu gracza, 3 dźwięki rzemiosła i 6 pętli otoczenia (4 kontynenty, miasto, deszcz). Opis katalogów, limity długości i ograniczenia: [public/game/sfx/README.md](../../../public/game/sfx/README.md).
- Obróbka jak przy wcześniejszych efektach (cisza ucięta, −16 LUFS, mono 80 kb/s, limit długości).
- Podpięto w grze: dźwięki ataku i śmierci każdego z 40 potworów i 8 bossów (nowe pole `species` w zdarzeniach `attack` i `death` w `src/game/monsters/system.ts` i `src/game/session.ts`, odtwarzanie w `src/game/sfx.ts`), kroki zależne od terenu, świata i wnętrza (`src/game/mountGame.ts`) oraz kliknięcie przycisków. Testy w `src/test/sfx.test.ts` sprawdzają istnienie plików dla każdego potwora i bossa oraz mapowanie powierzchni kroków.
- Nie zrobiono: ryk wejścia bossów, odgłosy skilli potworów, reakcja na trafienie, dźwięki statusów, skoku, lądowania, wody, rzemiosła, pozostałe dźwięki interfejsu i pętle otoczenia nie są jeszcze wywoływane przez grę.
- Nie sprawdzono: odsłuchu każdego pliku. Zmierzono tylko długości po obróbce i brak plików poniżej 0,15 s. Część plików model wygenerował zbyt długich (do 16 s) i została ucięta.
- Wygenerowano po jednym wariancie na dźwięk, więc ewentualne poprawki wymagają ponownego generowania pojedynczych pozycji.
