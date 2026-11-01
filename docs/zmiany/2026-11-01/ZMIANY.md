# Zmiany — 2026-11-01

## Audyt kodu i dokumentacji: całkowita eliminacja adnotacji oraz komentarzy powiązanych z Lovable; bezterminalowe sterowanie serwerem gier z panelu admina

### 1. Eliminacja odniesień i komentarzy powiązanych z platformą Lovable

- **Kod źródłowy aplikacji (`src/`):**
  - **`src/routes/__root.tsx`**: Usunięto import i wywołanie `reportLovableError`, usunięto metatagi `<meta name="author" content="Lovable">` oraz `<meta name="twitter:site" content="@Lovable">`, zaktualizowano pole autora na `"Ki Legends"`.
  - **`src/lib/lovable-error-reporting.ts`**: Plik raportowania błędów do telemetrycznego hooka edytora został całkowicie usunięty z projektu.
  - **`src/integrations/supabase/auth-middleware.ts`**, **`src/integrations/supabase/client.server.ts`**, **`src/integrations/supabase/client.ts`**: Zastąpiono komunikaty brakujących zmiennych środowiskowych sugerujące konfigurację w chmurze zewnętrznej neutralnym komunikatem błędu konfiguracji środowiska Supabase.
  - **`src/integrations/supabase/cron-auth.ts`**: Usunięto odwołania do `LOVABLE_CRON_SECRET` na rzecz standardowych zmiennych środowiskowych `CRON_SECRET` i `CRON_SECRET_PREVIOUS`.
  - **`src/integrations/supabase/previewAuthStorage.ts`**: Usunięto kod pośrednika sesji opartego na iframe/postMessage oraz powiązane komentarze; funkcja `brokeredPreviewStorage` korzysta bezpośrednio ze standardowego `localStorage` w środowisku przeglądarki.

- **Konfiguracja repozytorium i pliki środowiskowe:**
  - **`AGENTS.md`**: Usunięto blok adnotacji `<!-- LOVABLE:BEGIN --> ... <!-- LOVABLE:END -->`. Zastąpiono instrukcję ogólną regułą nieprzepisywania opublikowanej historii Gita.
  - **`README.md`**: Usunięto sekcję „Build with Lovable”, linki do edytora zewnętrznego oraz link do domeny tymczasowej; dodano opis uruchamiania i skryptów weryfikacji projektu (`typecheck`, `test`).
  - **`vite.config.ts`**: Usunięto komentarz odnoszący się do pakietu konfiguracyjnego.
  - **`Dockerfile`**: Usunięto historyczną adnotację dotyczącą hostingu okładki.
  - **`docker-compose.staging.yml`**, **`.env.staging.example`**: Zastąpiono wzmianki o chmurze zewnętrznej odniesieniem do Supabase.
  - **`deploy/scripts/push-to-new-github.sh`**: Usunięto komentarze i wzorce referencji powiązane z chmurą zewnętrzną.
  - **`art/candidates/anime-v1/README.md`**: Zneutralizowano frazę o braku publikacji na chmurze zewnętrznej.
  - **`ARUBA_STAGING.md`**: Wyczyszczono odniesienia do eksportów i hostingu zewnętrznego.
  - **`roadmap.md`**: Wyczyszczono odwołanie w punkcie dotyczącym bazy danych.
  - **`bunfig.toml`**: Usunięto nieużywane wpisy zewnętrznych pakietów SDK z wykluczeń.

- **Dokumentacja projektu (`docs/`):**
  - **`docs/ARCHITEKTURA-I-TESTY.md`**: Zastąpiono wzmiankę o zewnętrznej bazie opisem bazy kont Supabase.
  - **`docs/ZASADY.md`**: Usunięto adnotację o synchronizacji repozytorium z zewnętrzną platformą.
  - **`docs/PLAN-I-ZADANIA.md`**: Zneutralizowano określenie w zadaniu `REL-01`.
  - **`docs/LICENCJE.md`**: Zaktualizowano tytuł sekcji 4 i opis pochodzenia tekstur kosmosu i chmur.
  - **`docs/db/2026-10-26-accounts.sql`**: Wyczyszczono nagłówek SQL.

### 2. Bezterminalowe zarządzanie procesem fizycznym serwera gier (`f61dbc96`)

- **`src/game/admin/serverControl.ts`**:
  - Moduł `adminServerEngine` z bezpośrednim sterowaniem fizycznym procesem WebSocket (`multiplayerServer.ts`) w środowisku Node.js (`child_process.spawn`).
  - Bezpieczne startowanie, zatrzymywanie (`SIGTERM` / `SIGKILL` z timeoutem), restart oraz zmiana konfiguracji w locie (port, maksymalny limit graczy, nazwa serwera, interwał tick rate, limit AOI).
- **`src/routes/api/admin/server-control.ts`**:
  - Zabezpieczone endpointy API `/api/admin/server-control` z weryfikacją roli administratora (`role === "admin"`).
- **`src/components/admin/AdminServerControl.tsx`**:
  - Kompletny interfejs graficzny w panelu administratora: wskaźnik statusu serwera (Online/Offline/Uruchamianie/Zatrzymywanie), przełączniki start/stop/restart, edycja parametrów w czasie rzeczywistym oraz zintegrowany terminal logów procesowych.
