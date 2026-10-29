# Zmiany — 29.10.2026

## Migracja hostingu Aruba — uzupełnienie gałęzi wdrożeniowej

Właściciel polecił dokończyć migrację; po wskazaniu gałęzi Aruba odpowiedział
„TAK”. Nie scalano gałęzi rozwoju ras z main. Osobny checkout
`/workspace/ki-aruba`, gałąź `migration/aruba-staging-2026-10-28`, punkt wyjścia
`5c2e83e3` (bazowy main `0b5ae9486914962626d8b7bbe5ce09fccbeb35ab`).
Gałąź ras i PR #55 pozostały nietknięte.

Dodano brakujące dwa oryginalne obrazy do `deploy/overlay/public/`:

- cover.png: 2 507 283 B, SHA-256 `d5fada26665d7a34a5ce9a8423681d0c33a2d5a07f9139122b4480e0506aac5c`;
- test-background.png: 2 425 567 B, SHA-256 `efcf1c427bb0ed98341e4f82e950413fcec6bd533a815e321584873f1644bdea`.

Źródło: publiczne oryginały `https://kilegends.pl/` pod dokładnymi ścieżkami
z wcześniej istniejącego `deploy/overlay/SHA256SUMS`. Nie generowano, nie zmieniano
formatu ani jakości; obie sumy MATCH. Nie twierdzimy, że w tej sesji zweryfikowano
cały ZIP eksportu. Historyczny wpis Lovable podaje paczkę `cdbd495f...` na VPS pod
`/home/gh-runner/migracja-archiwa/verified-cdbd495f/KI-LEGENDS-VPS-MIGRACJA`;
**ta ścieżka i kompletność eksportu nie zostały bezpośrednio sprawdzone**.
Nie kopiowano eksportów bazy, hashy haseł ani prywatnych szkiców do publicznego Git.

Skrypt `deploy/scripts/smoke-test.sh`: timeout połączenia 5 s i żądania 20 s,
brak referencji do skryptu aplikacji w HTML stanowi błąd, zamiast pominiętej kontroli.
Dodano CI kontenerów Node 22/Caddy, uruchamiane po pushu na tę gałąź, tylko lokalnie
w runnerze, bez wdrożenia na VPS i bez zmian DNS/backendu.

Środowisko: Docker 28.4.0, Node lokalny 24.19.0. Caddy `2-alpine` pobrany z rejestru,
digest `sha256:eb4d35b7452d1ab6171fbdbe8d9275b2301dad6dad92115d91e19fb9b24d510f`.
Procedury Dockera sprawdzono według skill cloud-environment-runtime. Caddy lokalnie
w kontenerze, Node uruchomiony bezpośrednio z prawdziwego `.output/server/index.mjs`.
To nie dowód pełnego docker build ani wdrożenia na Aruba; osobny workflow ma je
sprawdzić w runnerze z większym dyskiem. Lokalnie pozostaje mniej niż 200 MiB.

Pierwszy build/test lokalny po ograniczeniu checkoutu dla oszczędności dysku:
brak `art/pipeline/examples/technical-pack.json` i `art/production/enemies/roster.json`.
Przywrócono te śledzone fixture'y; nie zmieniono kodu gry ani asercji. Pierwszy unit:
801 PASS / 1 FAIL suite (ENOENT), 64/65 plików; nie traktować jako PASS.
Pierwsza próba proxy: środowiskowy HTTP proxy przechwycił połączenie Caddy→lokalny
Node, zwracając „Loopback targets forbidden”. Dla lokalnego upstream dodano
`NO_PROXY=host.docker.internal,localhost,127.0.0.1` wyłącznie w kontenerze QA.
Druga próba wystartowała przed gotowością Caddy (trzy HTTP 000); po gotowości
powtórzono cały smoke. Zewnętrzne połączenia nadal korzystają z proxy środowiska.
W konfiguracji VPS nie dodawano obejść sieci ani wyłączania TLS.

Wyniki końcowe poniżej. Stan Aruba: brak adresu i uwierzytelnienia SSH/Coolify
w tej sesji. Zgłoszono właścicielowi prośbę o adres. Nie wyszukiwano sekretów,
nie uruchamiano GPU, nie zmieniano produkcji, bazy ani DNS. Backend kont i zapisów
pozostaje obecny; migracja samego hostingu nie oznacza eksportu kont ani hasła.


### Wyniki lokalne przed commitem

- `NITRO_PRESET=node-server npm run build`: PASS, `.output/nitro.json` potwierdza
  `preset=node-server` — [log](qa/aruba/node-build.txt).
- `npm run typecheck`: PASS, trzy konfiguracje — [log](qa/aruba/typecheck.txt).
- `npm test` po odtworzeniu fixture: **837/837 PASS, 65/65 plików**, 79,56 s —
  [log](qa/aruba/unit.txt).
- `npm run lint`: 0 błędów / 15 ostrzeżeń — [log](qa/aruba/lint.txt).
- `docker compose --env-file .env.staging.example -f docker-compose.staging.yml config --quiet`: PASS.
- `bash -n deploy/scripts/*.sh`: PASS.
- `caddy validate --config /etc/caddy/Caddyfile` w obrazie Caddy z przełącznikami
  stagingu: PASS — [log](qa/aruba/caddy-validate.txt).
- `bash deploy/scripts/smoke-test.sh http://127.0.0.1:4311 --staging`:
  **19/19 kontroli PASS** — [log](qa/aruba/http-smoke.txt). SSR, 404, zasoby,
  oryginalne obrazy, audio Range/206, immutable JS, no-cache HTML i noindex.
- `node /tmp/ki-aruba-browser.cjs`: pięć prawdziwych nawigacji przez Caddy do
  `/`, `/mapa`, `/konto`, `/admin`, `/test`, **0 pageerror** —
  [log](qa/aruba/browser.txt), [driver](qa/aruba/browser-driver.cjs).
  Screenshoty `page-*.png` obok. Widoczny formularz logowania i odmowa dostępu admina
  bez sesji; **nie logowano na konto produkcyjne, nie testowano zapisu konta ani
  pełnej gry czterech ras**. Test strony nie oznacza odbioru rozgrywki.

Kod gry i jego mechaniki nie zostały zmodyfikowane. Wyniki dotyczą kandydata na
bazie `5c2e83e3` z dodanymi oryginalnymi overlayami i poprawionym skryptem smoke.
Node lokalny 24; pełny Docker/Node 22 sprawdza osobny CI po pushu, wynik musi być
odczytany osobno. Wdrożenie na Aruba, certyfikat domeny testowej, logowanie na
prawdziwe konto, zapis oraz akceptacja rozgrywki pozostają NIEWYKONANE bez dostępu.
