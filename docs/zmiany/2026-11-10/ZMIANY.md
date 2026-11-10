# 2026-11-10

### 1. Dźwięki potworów, kroków, interfejsu i statusów (gałąź `feat/sfx-monsters-ui`)

- Na zlecenie właściciela (subskrypcja ElevenLabs się kończy) wygenerowano 156 plików w `public/game/sfx/`: atak i śmierć 40 potworów i 8 bossów, ryk 8 bossów, 8 uniwersalnych odgłosów skilli potworów, kroki na 9 powierzchniach, 30 dźwięków interfejsu i świata oraz 5 dźwięków nałożenia statusu. Opis katalogów, limity długości i ograniczenia: [public/game/sfx/README.md](../../../public/game/sfx/README.md).
- Obróbka jak przy wcześniejszych efektach (cisza ucięta, −16 LUFS, mono 80 kb/s, limit długości).
- Nie zrobiono: pliki nie są podpięte w kodzie gry. Zdarzenia `attack` i `death` niosą tylko id instancji potwora, bez gatunku, więc podpięcie wymaga dodania pola gatunku w `src/game/monsters/system.ts` i mapowania w `src/game/sfx.ts` (wraz z testami). Kroków i dźwięków interfejsu nikt jeszcze nie wywołuje.
- Nie sprawdzono: odsłuchu każdego pliku. Zmierzono tylko długości po obróbce i brak plików poniżej 0,15 s. Część plików model wygenerował zbyt długich (do 16 s) i została ucięta.
- Wygenerowano po jednym wariancie na dźwięk, więc ewentualne poprawki wymagają ponownego generowania pojedynczych pozycji.
