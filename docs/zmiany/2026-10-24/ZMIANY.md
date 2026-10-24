# Zmiany — 24.10.2026

## Uzgodniony podział i diagnoza runtime

- Wyłącznie gałąź `feature/superior-runtime-20261023`. HUD/dotyk po rozmowie
  pozostają po stronie `integ/manga-hud-na-kontynentach`. Nie pobierano zmian
  drugiej strony do tej gałęzi ani nie scalano integracji do siebie. Integrację
  `integration/all-20261024` wykonuje druga strona po odbiorze.
- Lista 17 przypadków jest zakresem weryfikacji, nie dowodem pochodzenia błędów.
  [Bazowe wyniki 116 testów](qa/runtime-repairs/baseline.json): SHA `66c29fc`,
  przebieg `40041421567`, 112 PASS / 4 FAIL. Własny Software WebGL `40041424495`
  przeszedł 18/18. Błędy pełnego przebiegu: Android Canvas/WebGL, Legenda Canvas
  oraz Planetarni 390 px w teście ośmiu kierunków.
- Zdarzenia walki były obsługiwane po aktualizacji sprite'ów. Przeniesiono je przed
  wybór klatek, zachowując priorytet śmierci i trafienia. Zablokowana przez hit
  prezentacja akcji czeka najwyżej 500 ms; stare akcje oraz akcje przed śmiercią
  nie są odtwarzane. Nie zmieniano statystyk, leczenia ani naliczania obrażeń.
- Klatki są raportowane po renderze, bez ograniczenia do 100 ms odświeżania HUD;
  niezmienione wartości nie powodują kolejnych zapisów do DOM.
- Test kierunków wraca prawdziwym ruchem do bezpiecznego punktu przed każdym
  kierunkiem. Obszar sprawdzany jest wewnątrz koła, nie tylko na jego obwodzie.
  Poprzednio kolejne odcinki kumulowały przesunięcia i mogły dojść do przeszkody.
  Asercje ruchu, kierunków i kolizji zachowane. Kod joysticka i HUD niezmieniony.
- Dodano testy priorytetu oczekujących akcji, ich ważności oraz czyszczenia przy
  śmierci/odrodzeniu. Vitest: **333/333 PASS**. Canvas: **3/3 PASS** (Android,
  Legenda oraz Planetarni 390 px). Software WebGL Androida w osobnym przebiegu:
  **1/1 PASS**. Równoległa próba WebGL nie ukończyła podejścia w 60 s przy
  równoczesnych pozostałych kontrolach; zachowano jej log, bez podnoszenia limitu
  lub dodania retries. Próba pojedyncza przeszła w 1,2 minuty.
- To kontrola czterech przypadków nieudanych na bazie. Pozostałe przypisania
  z listy 17 oraz pełna regresja na końcowym SHA nie są oznaczone jako zamknięte.
  Bez scalenia i publikacji.
