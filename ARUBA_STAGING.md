# KI Legends — status migracji VPS Aruba

Status: **gałąź przygotowawcza, bez wdrożenia**. Branch: `migration/aruba-staging-2026-10-28`.

## Dostępne
- Kod gry zsynchronizowany z Lovable na GitHub (main: `0b5ae9486914962626d8b7bbe5ce09fccbeb35ab`).
- W Lovable wygenerowano pełny pakiet `KI-LEGENDS-VPS-pakiet.zip` oraz bundle historii 89 gałęzi, ale nie ma ich jeszcze w tym repo ani na Aruba.
- Pakiet zawiera Dockerfile z osobnymi targetami `app` (Node.js 22) i `web` (Caddy), docker-compose, lokalne okładki, multimedia oraz skrypty backupu i testów.
- W GitHub `.gitattributes` stosuje Git LFS dla niektórych zasobów źródłowych 3D — sprawdzić pobranie pełnych obiektów LFS przed budowaniem.

## Bezwzględnie przed wdrożeniem
1. Dostarczyć i zweryfikować oryginalny ZIP z Lovable (sumy SHA-256 i manifest); bez niego nie odtwarzać ręcznie niekompletnego pakietu.
2. Oddzielić dane kont i sekretne klucze Supabase Lovable Cloud; nie wystawiać `SUPABASE_SERVICE_ROLE_KEY` w kodzie przeglądarki/GitHub.
3. Zabezpieczyć konta i zapisy graczy; sprawdzić kompletność przywracania do nowego środowiska.
4. Testować na tymczasowej domenie, bez zmiany `kilegends.pl`.
5. Przed cutoverem przejść testy: /, /mapa, /konto, /admin, /test; rozgrywka mobilna, audio Range/206 i zasoby.

Uwaga: gra jest lokalnym PvE, nie ma jeszcze działającego serwera multiplayer.

## Bloker
- Oryginalny pakiet z dużymi zasobami istnieje w eksporcie Lovable, ale w tym czacie nie ma dostępu do jego bajtów, tylko do historii i źródeł.
- Brak dostępu administracyjnego do Coolify.


## Aktualizacja 29.10.2026 — uzupełnione pliki do budowania

Powyższe braki opisują wcześniejszy checkpoint. Dwa brakujące obrazy overlay są
teraz w `deploy/overlay/public/`. Pobrano oryginalne bajty z istniejącego hostingu;
obie sumy zgadzają się z wcześniej zatwierdzonym `deploy/overlay/SHA256SUMS`.
Dockerfile nie potrzebuje już pobierać ich z Lovable podczas budowania.
Pozostałe archiwa/eksporty nie zostały tu skopiowane ani udostępnione publicznie.

Weryfikacja kontenerów na tej gałęzi: `.github/workflows/aruba-staging.yml`.
Uruchamia wyłącznie lokalny stos CI, bez VPS, DNS i sekretów produkcyjnych.
W Coolify użyć tej gałęzi i `docker-compose.staging.yml`, a publiczne zmienne
z `.env.staging.example` przypisać jako build/runtime zgodnie z compose.
Domenę tymczasową skierować wyłącznie do `web:80`; usługa `app` nie ma publicznego portu.
Nie zastępować pustych sekretów stagingu fikcyjnym service_role.

Pełne polecenia, wyniki i ograniczenia są w
[chronologicznym dzienniku](docs/zmiany/2026-10-29/ZMIANY.md).
**Uruchomienie na Aruba pozostaje niepotwierdzone: ta sesja nie ma adresu ani
uwierzytelnienia VPS/Coolify.** Sam push do GitHub nie stanowi wdrożenia.
