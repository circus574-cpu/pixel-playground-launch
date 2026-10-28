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
