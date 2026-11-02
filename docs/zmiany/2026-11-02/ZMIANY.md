# Zmiany — 2026-11-02

## Jeden serwer gry „Superior” w panelu administratora

### 1. Usunięcie fikcyjnych węzłów serwera

Decyzja właściciela 02.11: na VPS Aruba działa jeden serwer gry, „Superior” na 50 graczy;
pozostałe wpisy mają zniknąć.

- Panel `/admin` (centrum monitoringu) pokazywał trzy węzły z kodu (`adminTelemetry.ts`, commit
  `0165752` z 31.10): prawdziwy EU-Central (85.235.150.189) oraz nieistniejące „EU-West
  (Amsterdam)” 10.24.10.12 i „US-East (Virginia)” 10.24.20.15 oznaczone jako „online”.
  Lista żyła tylko w `localStorage` przeglądarki.
- Teraz jest jeden węzeł `eu-central-1` „Superior”, limit 50, host VPS, port 7420.
  `normalizeServerNodes` czyści zapisane listy: usuwa fikcyjne węzły, przenosi nazwę, limit i
  tick z wpisu właściciela „Superior”, a port i host zawsze ustawia na VPS.
- Usunięto tworzenie i usuwanie węzłów; port i host są tylko do odczytu, bo Caddy kieruje `/ws`
  wyłącznie na port 7420 — serwer uruchomiony na innym porcie odcinał graczy.
- Proces gry (`gameServer.ts`, `managedServer.ts`): domyślnie „Superior” i 50 graczy; wartości
  ustawione w panelu mają pierwszeństwo przed zmiennymi środowiska kontenera.
  `deploy/multiplayer/compose.yml`: `GAME_SERVER_NAME=Superior`, `GAME_SERVER_MAX_PLAYERS=50`.
  Zmiennych środowiska usługi Coolify na VPS nie weryfikowano z repozytorium.
- Testy: `single-superior-server.test.ts`, zaktualizowany `admin-monitoring.test.tsx`.
  Pełny zestaw 1063/1063, typecheck i lint bez błędów.
