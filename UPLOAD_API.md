# Ki Legends — Upload API

Zmiany są przetestowane w podglądzie, ale nieopublikowane. Poniższe adresy zaczną obsługiwać nowe funkcje po publikacji.

- `POST https://kilegends.pl/api/public/uploads` — pojedynczy plik `multipart/form-data`, pola `file`, `directory`, `overwrite`.
- `POST https://kilegends.pl/api/public/uploads/from-url` — JSON: `url`, `name`, `directory`, `overwrite`.
- `GET https://kilegends.pl/api/public/uploads/openapi` — OpenAPI 3.1.
- Aliasy wymagane w briefie: `/api/uploads`, `/api/uploads/from-url`. Dla zewnętrznych narzędzi stosuj `/api/public/`, ponieważ hosting może zabezpieczać pozostałe adresy przed zewnętrznymi wywołaniami.

## Token i prywatność

Na `/test`, po wpisaniu istniejącego hasła, otwórz **API / Integracje**. Wybierz katalog i wygeneruj token. Jest pokazywany tylko raz; serwer zapisuje wyłącznie jego skrót. Zmiana unieważnia poprzedni token. Token ma wyłącznie uprawnienia uploadu w wybranym katalogu i jego podkatalogach, nie dostęp do listowania ani zarządzania innymi plikami.

Nie wklejaj tokenu do rozmowy, kodu lub OpenAPI. Przekazuj go jako `Authorization: Bearer ...`. Zapisz w polu uwierzytelniania narzędzia automatyzacji. Pliki pozostają w prywatnym magazynie, link pobrania wygasa po 60 sekundach. Dziennik nie zapisuje tokenów ani źródłowych URL-i.

## Limity i katalogi

Każde rozszerzenie, jeden plik na żądanie, maksymalnie 52 428 800 bajtów (50 MiB). Limit tokenu: 20 żądań na minutę, liczony atomowo w trwałym magazynie. Domyślnie nadpisywanie wyłączone; `overwrite=true` jest wymagane do zastąpienia pliku o tej samej nazwie w katalogu. Brakujące katalogi powstają jako prefiksy przy zapisie. Istniejące pliki w katalogu głównym są zachowane.

Przygotowane katalogi: `game-assets/worlds/{forest,volcano,ice,desert}`, `game-assets/{races,enemies,buildings,props,ui,concepts,archives}`. W panelu widoczna jest lista i wybór katalogu; również katalogi jeszcze bez plików.

Import URL celowo nie obsługuje dowolnego internetu. Dozwolone wyłącznie HTTPS z dokładnych hostów: `github.com`, `raw.githubusercontent.com`, `release-assets.githubusercontent.com`, `objects.githubusercontent.com`. Przekierowanie GitHub Releases może prowadzić tylko do `release-assets.githubusercontent.com`; inne są blokowane. Prywatne, lokalne, metadata i nieznane hosty są odrzucane. Dowolne publiczne adresy wymagają dodatkowej ochrony sieciowej hostingu przed DNS rebinding — obecnie jej dostępność nie jest potwierdzona.

## Przykłady

```bash
curl -X POST 'https://kilegends.pl/api/public/uploads' \
  -H "Authorization: Bearer $KI_UPLOAD_TOKEN" \
  -F 'file=@texture.png' \
  -F 'directory=game-assets/worlds/forest' \
  -F 'overwrite=false'

curl -X POST 'https://kilegends.pl/api/public/uploads/from-url' \
  -H "Authorization: Bearer $KI_UPLOAD_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://raw.githubusercontent.com/OWNER/REPO/main/texture.png","name":"texture.png","directory":"game-assets/concepts","overwrite":false}'
```

Odpowiedź 201: `name`, `size`, `path`, `downloadUrl`, `expiresIn: 60`. Błędy: 400 dane/URL, 401 token, 403 katalog, 409 konflikt, 413 limit pliku, 415 format, 429 limit żądań (`Retry-After: 60`), 503 magazyn/dziennik niedostępny.

## ChatGPT

Pobierz schemat w panelu albo zaimportuj adres OpenAPI do Actions własnego GPT po publikacji. Ustaw API Key / Bearer i wklej token tylko w bezpiecznym polu uwierzytelniania. Akcja `importGameAsset` przyjmuje publiczny link GitHub. Zwykła rozmowa ChatGPT nie ma automatycznie dostępu do tego API ani lokalnych wygenerowanych plików. Bezpośredni upload binarny wymaga klienta obsługującego multipart (skrypt, cURL lub narzędzie automatyzacji). Integracja Actions nie została połączona z kontem użytkownika ani przetestowana wewnątrz ChatGPT.

## Weryfikacja

- 42 testy automatyczne: poprawne (walidacja, ścieżki, limit 50 MiB, tokeny, konflikty, przekierowania, import, podgląd i istniejąca strona).
- Rzeczywisty podgląd: PNG i ZIP w różnych katalogach, odczyt identycznych bajtów przez krótkotrwały link, import publicznego README z GitHub, blokada bez tokenu, blokada po unieważnieniu, blokada 50 MiB + 1 bajt, blokada lokalnego URL, konflikt bez nadpisania.
- Panel: wszystkie przesłane pliki odczytane przez listę; PNG otwarty w podglądzie. Telefon 360 × 650: brak poziomego przewijania. Brak błędów wykonania podczas testu.
- Publikacja i zewnętrzne wywołania na kilegends.pl pozostają niezweryfikowane — zmian nie opublikowano.
- Tymczasowe pliki weryfikacyjne usunięto; testowe tokeny unieważniono.