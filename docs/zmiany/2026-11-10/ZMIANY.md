# Dziennik zmian — 10 listopada 2026

## Animacje

### 1. Film Mędrca, etap 3 (ruch i ładowanie)

- Właściciel dostarczył film Mędrca do etapu 3. Zapisano go bez obróbki jako `art-wip/gemini-anim-stages/sage-etap3-ruch.mp4` (10 s, 1280×720, 24 kl./s, SHA-256 `2a109348878110cc6caa60ae7667d83e5608c9475474f817cd85c5f6637b1638`).
- Tabela plików i lista braków w [Prompty animacji](../../../art/pipeline/prompts/animacje/PROMPTY-ANIMACJE-v1.md) zaktualizowane: Mędrzec ma komplet etapów 1–4, brakuje Planetara i Androida (po 4 etapy).
- Sprawdzono: oś czasu na 20 klatkach (co 0,5 s) i 4 klatkach z bliska. Bieg 0,4–3,4 s, ładowanie 3,8–6,4 s, umiejętność C 6,8–8,3 s i interakcja 8,7–10,0 s zgadzają się z promptem; w dłoni jest widoczny pomarańczowy kryształ.
- Odchylenia od zasad promptu: poza biegiem i umiejętnością C postać stoi frontalnie, a nie z profilu w prawo (poza NEUTRAL, ładowanie i interakcja); wyzwolenie ładowania około 6,0 s wypełnia cały kadr, a promienie wychodzą poza niego.
- Nie zrobiono: klatki nie są wycięte ani wpięte w grę. Nie sprawdzono każdej klatki.

### 2. Film Planetara, etap 1 (walka, forma bazowa)

- Właściciel dostarczył film Planetara do etapu 1. Zapisano go bez obróbki jako `art-wip/gemini-anim-stages/planetary-etap1-walka.mp4` (10 s, 1280×720, 24 kl./s, SHA-256 `24eaec60b0e9fca9600f66370fee420e9fb94175796b358bd14b431d5cb1c804`).
- Tabela plików i lista braków w [Prompty animacji](../../../art/pipeline/prompts/animacje/PROMPTY-ANIMACJE-v1.md) zaktualizowane: Planetar ma etap 1, brakuje etapów 2–4; Androidowi brakuje wszystkich czterech.
- Sprawdzono: oś czasu na 20 klatkach (co 0,5 s) i 4 klatkach z bliska oraz zapas nad głową w oknie skoku. Neutral, dwa ciosy, finisher z zielonym wybuchem, umiejętność A (pocisk w prawo), umiejętność B (skok i fala po lądowaniu), unik i garda zgadzają się z promptem; dym jest ciepły.
- Odchylenia od zasad promptu: szary cień na podłodze pod postacią (prompt tego zabrania); w pozie neutralnej postać stoi frontalnie, a nie z profilu w prawo; podczas skoku (około 6,1–6,3 s) uniesiona ręka wychodzi poza górną krawędź kadru.
- Nie zrobiono: klatki nie są wycięte ani wpięte w grę. Nie sprawdzono każdej klatki.

### 3. Film Planetara, etap 2 (reakcje, forma bazowa)

- Właściciel dostarczył film Planetara do etapu 2. Plik trwa 20 s (1280×720, 24 kl./s): sekundy 0–10 powtarzają film etapu 1 (przekodowany, średnia różnica jasności 0,52 na 40 próbkach), a reakcje są w sekundach 10–20. Zapisano go bez obróbki jako `art-wip/gemini-anim-stages/planetary-etap2-reakcje.mp4` (SHA-256 `f9fba442e20ac937566a9f7b76ac27ad49efa7c52c83a79c108a76b5f6efc947`). Oś czasu etapu 2 trzeba przesunąć o 10 s przy wycinaniu.
- Tabela plików i lista braków w [Prompty animacji](../../../art/pipeline/prompts/animacje/PROMPTY-ANIMACJE-v1.md) zaktualizowane: Planetar ma etapy 1–2, brakuje etapów 3–4.
- Sprawdzono: oś czasu na 40 klatkach (co 0,5 s) i 3 klatkach z bliska. Neutral, trafienie z przodu, mocne trafienie z uklęknięciem, śmierć (odrzut i leżenie), wstawanie i gest zwycięstwa zgadzają się z promptem; kurz jest ciepły.
- Odchylenia od zasad promptu: szary cień na podłodze pod postacią; w pozie neutralnej postać stoi frontalnie, a nie z profilu w prawo; efekt zielonej aury w geście zwycięstwa (około 18,5 s) dochodzi do górnej krawędzi kadru.
- Nie zrobiono: klatki nie są wycięte ani wpięte w grę. Nie sprawdzono każdej klatki.

### 4. Film Planetara, etap 3 (ruch i ładowanie, forma bazowa)

- Właściciel dostarczył film Planetara. Plik trwa 30 s (1280×720, 24 kl./s) i jest łańcuchem trzech etapów: sekundy 0–10 to etap 1, 10–20 s to etap 2 (oba powtarzają wcześniej zapisane filmy), a etap 3 jest w sekundach 20–30. Zapisano go bez obróbki jako `art-wip/gemini-anim-stages/planetary-etap3-ruch.mp4` (SHA-256 `78ee9517c6cba453fa983c0e31d927ebd699d51948aed29c038bfba38749c27f`). Oś czasu etapu 3 trzeba przesunąć o 20 s przy wycinaniu.
- Sprawdzono: 30 klatek (co 1 s) całego pliku. Bieg 20,4–23,4 s, ładowanie 23,8–26,4 s, umiejętność C 26,8–28,3 s i interakcja 28,7–30 s zgadzają się z promptem; w dłoni jest widoczny pomarańczowy kryształ.
- Odchylenia od zasad promptu: szary cień na podłodze w całym pliku; neutral frontalny, a nie z profilu w prawo.
- Nie zrobiono: klatki nie są wycięte ani wpięte w grę. Nie sprawdzono każdej klatki.

### 5. Film Planetara, etap 4 (walka po transformacji)

- Właściciel dostarczył film Planetara w formie po transformacji (zielona aura). Zapisano go bez obróbki jako `art-wip/gemini-anim-stages/planetary-etap4-walka-po-transformacji.mp4` (10 s, 912×1024, 24 kl./s, SHA-256 `ce83763ea6c435337ca2328afbab1778a55712a414b6e2c41f11bf4c85fd145f`).
- Tabela plików i lista braków w [Prompty animacji](../../../art/pipeline/prompts/animacje/PROMPTY-ANIMACJE-v1.md) zaktualizowane: Planetar i Mędrzec mają komplet etapów 1–4, brakuje Androida (4 etapy).
- Sprawdzono: oś czasu na 20 klatkach (co 0,5 s) i 3 klatkach z bliska. Neutral, dwa ciosy, finisher, umiejętność A, skok z uderzeniem w ziemię, unik i garda zgadzają się z osią etapu 1.
- Odchylenia od zasad promptu: format pionowy 912×1024 zamiast 1280×720; tło zmienia się z białego na szare podczas umiejętności; kamera zbliża się, a postać wypełnia ponad 60% wysokości kadru; podczas skoku (około 6,6 s) głowa wychodzi poza górną krawędź kadru; neutral frontalny.
- Nie zrobiono: klatki nie są wycięte ani wpięte w grę. Nie sprawdzono każdej klatki.

### 6. Film Androida, etap 1 (walka, forma bazowa)

- Właściciel dostarczył film Androida. Zapisano go bez obróbki jako `art-wip/gemini-anim-stages/android-etap1-walka.mp4` (10 s, 512×640, 24 kl./s, SHA-256 `922fded48c0f6223d1db42b54d19fe2da99e5bde91098df69847141b454b81ae`).
- Sprawdzono: 20 klatek (co 0,5 s). Oś czasu zgadza się z promptem: neutral, dwa ciosy (drugi jako kopnięcie z błyskiem), finisher z dużym wybuchem, neutral, umiejętność A (zbieranie energii i wiązka w prawo), umiejętność B (skok i fala uderzeniowa przy lądowaniu), unik ze smugą, garda z tarczą energii, neutral.
- Odchylenia od zasad promptu: format pionowy 512×640 zamiast 1280×720; tło zmienia się z białego na szare podczas akcji; fala uderzeniowa i tarcza wychodzą poza kadr; kamera blisko (postać ponad 70% wysokości kadru); neutral frontalny.
- Nie zrobiono: klatki nie są wycięte ani wpięte w grę. Nie sprawdzono każdej klatki.

### 7. Film Androida, etap 2 (reakcje, forma bazowa)

- Właściciel dostarczył film Androida z reakcjami. Zapisano go bez obróbki jako `art-wip/gemini-anim-stages/android-etap2-reakcje.mp4` (10 s, 512×640, 24 kl./s, SHA-256 `d02317a0f32d2e7fb28a6d72b203117dd3e62d91b2beb0500e25a2bc94b66997`).
- Sprawdzono: 20 klatek (co 0,5 s). Kolejność zgadza się z osią: neutral, trafienie, mocne trafienie, śmierć (upadek i leżenie), wstawanie, gest zwycięstwa z aurą, neutral.
- Odchylenia od zasad promptu: trafienia pokazane jako wielka wiązka energii, która przez około 2,5 s zasłania postać; w mocnym trafieniu (ok. 2 s) postać obraca się tyłem; podczas leżenia (ok. 5 s) głowa jest ucięta przy prawej krawędzi kadru; tło ciemnieje przy geście zwycięstwa; format 512×640; neutral frontalny.
- Nie zrobiono: klatki nie są wycięte ani wpięte w grę. Nie sprawdzono każdej klatki.

### 8. Film Androida, etap 2 (reakcje) — nowa wersja

- Właściciel dostarczył powtórzony film etapu 2. Zapisano go bez obróbki jako `art-wip/gemini-anim-stages/android-etap2-reakcje-v2.mp4` (10 s, 720×1280, 24 kl./s, z dźwiękiem, SHA-256 `eca433fb1421fb7542f0d2c1d5ee47dd96b99b01b6b5a491a902d5806467e9dc`). Pierwsza wersja (`android-etap2-reakcje.mp4`) zostaje w repozytorium do porównania.
- Zawartość (kontakt co 1 s): postawa spoczynkowa, drgnięcie po trafieniu, ruch z pyłem i iskrami, odrzut, upadek na ziemię, podniesienie się na kolano, powrót do postawy. Postać i pancerz spójne w całym filmie, tło białe.
- Uwagi: iskry są pomarańczowe, a energia Androida niebieska; w kadrze pojawia się pył i cień na podłożu, które trzeba będzie usunąć przy wycinaniu klatek. Nie wycinano jeszcze klatek ani nie podpięto animacji w grze.

### 9. Film Androida, etap 3 (ruch i ładowanie, forma bazowa)

- Właściciel dostarczył film Androida z etapem 3. Zapisano go bez obróbki jako `art-wip/gemini-anim-stages/android-etap3-ruch.mp4` (10 s, 1280×720 poziomo, 24 kl./s, z dźwiękiem, SHA-256 `3eff1a2117d10948815707789f1eac1c0b39bed11facff2da17fce4d75559a07`).
- Zawartość (kontakt co 1 s): ruch i unik z pyłem, ładowanie (niebieski błysk w dłoni), interakcja z kryształem w dłoni. Pancerz i postać spójne z etapami 1–2.
- Wady: kadr bardzo niestabilny. W większości ujęć głowa albo nogi są ucięte, skala zmienia się z ujęcia na ujęcie (od całej postaci po sam korpus). Format poziomy zamiast pionowego. Do wycinania klatek nadaje się tylko część ujęć.
- Tabela plików i lista braków w [Prompty animacji](../../../art/pipeline/prompts/animacje/PROMPTY-ANIMACJE-v1.md) zaktualizowane (dodano też wiersz etapu 2 v2): Android ma etapy 1–3, brakuje etapu 4. Nie wycinano klatek ani nie podpięto animacji w grze.
