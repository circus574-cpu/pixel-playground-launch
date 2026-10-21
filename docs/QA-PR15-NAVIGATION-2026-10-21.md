# PR #15 — przerwana nawigacja z /test

Baza: `ae3f8b98ba6724e7c10797b9ec8da555d391c5e0`, PR #15,
`integration/ki-regressions-20261021`. Bez merge, publikacji i operacji GPU.

## Dowody i przyczyna

Odczytano pełny log joba `119449876691` z przebiegu
[39665659452](https://github.com/circus574-cpu/pixel-playground-launch/actions/runs/39665659452)
i pobrano artefakt `12379915199` przez konektor GitHub. Bezpośredni download
CLI z hosta Actions zwrócił 403; kopia z konektora została faktycznie pobrana
i otwarta. Historyczny wynik: **90/91**, błąd `private-sketch.spec.ts:23`.

Trace pokazuje:

- Po `page.reload()` widoczny jest formularz `/test`; asercje blokady, braku
  operacji Storage oraz niezmienionego localStorage przechodzą.
- Żądanie dokumentu `/` rozpoczyna się o `20:19:06.742Z` i kończy
  `net::ERR_ABORTED` po 19,68 ms, bez odpowiedzi HTTP.
- O `20:19:06.757Z` rozpoczyna się kolejne żądanie dokumentu `/test`,
  z `Cache-Control: max-age=0` i refererem `/test`; otrzymuje HTTP 200.
  To przeładowanie poprzedniej strony przerwało nawigację testu.

Lokalna diagnostyka niespecjalizowanego serwera developerskiego z CDP i obserwacją
WebSocket potwierdziła komunikat `{"type":"full-reload","path":"*"}`
i `Page.frameRequestedNavigation` z `reason: reload`. Log Vite w tym samym
przebiegu zawiera `optimized dependencies changed. reloading`, po odkryciu
`@tanstack/router-core`, jego submodułów i `seroval`. Vite wykonuje taki reload
z opóźnieniem 20 ms. Jest to potwierdzony mechanizm zakłócenia przez serwer
deweloperski, zgodny z trace CI. Historyczny trace nie rejestruje treści ramek
WebSocket, więc nie przypisujemy konkretnej paczki optymalizatora do tamtego
zdarzenia z CI. Trzy lokalne powtórzenia bazowego testu przeszły: błąd zależy
od kolejności zdarzeń, nie występuje przy każdym uruchomieniu.

## Naprawa

`scripts/application-qa.vite.ts` dziedziczy kompletną konfigurację aplikacji,
wyłącza HMR wyłącznie dla serwera uruchamianego przez Playwright i używa osobnego
cache zależności. Test nadal uruchamia prawdziwe SSR, routing i funkcje serwerowe,
z tymi samymi izolowanymi danymi sesji QA. Zwykły `npm run dev` i build produkcyjny
zachowują swoją konfigurację. Poprawiono źródło konkurencyjnego reloadu zamiast
ponawiać przerwane `goto`, dodawać opóźnienia lub ignorować błędy.

Kod i wszystkie asercje `private-sketch.spec.ts` pozostają niezmienione.
Nie zmieniono `/test`, sesji, origin guards, walidacji uploadu, klienta Supabase,
bucketu, polityk ani zapisów graczy. Nie wykonano operacji na zdalnym Storage.

## Walidacja i odbiór

Po poprawce `npx playwright test e2e/private-sketch.spec.ts --project=application-canvas --repeat-each=5` zakończył się **5/5 PASS (56,9 s)**, także przy pierwszym uruchomieniu oddzielnego cache QA. Następnie wykonywany jest
`scripts/run-integration-validation.sh`: czysta instalacja, pełny TypeScript,
Vitest, zasoby, lint, build, wszystkie projekty Playwright i osobny Software WebGL.
Wyniki runnera zawierają dokładny SHA, komendy, czasy, kody wyjścia i SHA-256 logów.
Końcowy status należy odczytać z tych wyników i obu workflow na tym samym SHA;
ten dokument nie deklaruje sukcesu kontroli, które jeszcze trwają.

Wymagania odbioru artystycznego, licencji i fizycznego Androida z dokumentu
`QA-INTEGRATION-REGRESSIONS-2026-10-21.md` pozostają aktualne. Zielone testy nie
stanowią zgody na merge ani publikację.
