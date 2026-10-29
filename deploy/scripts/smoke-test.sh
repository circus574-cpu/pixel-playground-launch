#!/usr/bin/env bash
# KI LEGENDS — szybki test po wdrożeniu. Użycie: deploy/scripts/smoke-test.sh https://twoja-domena.pl [--staging]
# --staging: /test ma zwracać 503, a każda odpowiedź nagłówek X-Robots-Tag: noindex (docker-compose.staging.yml).
# Sprawdza strony, okładki, zasoby gry, Range dla muzyki (wymagane przez Safari/iOS) i nagłówki pamięci podręcznej.
set -u
BASE="${1:?Podaj adres, np. https://staging.kilegends.pl}"
FAIL=0
STAGING=0; [ "${2:-}" = "--staging" ] && STAGING=1
check() { # path expected_code [expected_type_prefix]
  local out code type
  out=$(curl -s -o /dev/null -w "%{http_code} %{content_type}" "$BASE$1")
  code=${out%% *}; type=${out#* }
  if [ "$code" = "$2" ] && [[ -z "${3:-}" || "$type" == "$3"* ]]; then echo "OK   $1 → $code $type"; else echo "BŁĄD $1 → $code $type (oczekiwano $2 ${3:-})"; FAIL=1; fi
}
check /healthz 200
check / 200 text/html
check /mapa 200 text/html
check /konto 200 text/html
check /admin 200 text/html
if [ $STAGING = 1 ]; then check /test 503 text/html; else check /test 200 text/html; fi
check /robots.txt 200 text/plain
check /ki-assets-sw.js 200 text/javascript
check /__l5e/assets-v1/025eb219-7762-413d-996d-135177dfb346/cover.png 200 image/png
check /__l5e/assets-v1/f594fa76-0e3c-43c4-8313-b7b7ccf85a4c/test-background.png 200 image/png
check /game/assets/stage3/aether-atlas.webp 200 image/webp
check /game/sfx/android/A1.mp3 200 audio/mpeg
check /strona-ktorej-nie-ma 404

range=$(curl -s -o /dev/null -w "%{http_code}" -r 0-99 "$BASE/game/music/pyra.mp3")
if [ "$range" = 206 ]; then echo "OK   Range muzyki → 206"; else echo "BŁĄD Range muzyki → $range (oczekiwano 206)"; FAIL=1; fi

asset=$(curl -s "$BASE/" | grep -ao '/assets/[^"]*\.js' | head -1)
[ -z "$asset" ] && echo "INFO nie znaleziono pliku /assets/*.js w HTML — pomijam test Cache-Control"
if [ -n "$asset" ]; then
  cc=$(curl -sI "$BASE$asset" | tr -d '\r' | grep -i '^cache-control:' | cut -d' ' -f2-)
  [[ "$cc" == *immutable* ]] && echo "OK   $asset → $cc" || { echo "BŁĄD $asset → Cache-Control: '$cc'"; FAIL=1; }
fi
html_cc=$(curl -sI "$BASE/" | tr -d '\r' | grep -i '^cache-control:' | cut -d' ' -f2-)
[[ "$html_cc" == *no-cache* ]] && echo "OK   / → $html_cc" || { echo "BŁĄD / → Cache-Control: '$html_cc'"; FAIL=1; }

if [ $STAGING = 1 ]; then
  for pth in / /game/music/pyra.mp3 /test; do
    xr=$(curl -sI "$BASE$pth" | tr -d '\r' | grep -i '^x-robots-tag:' | cut -d' ' -f2-)
    [[ "$xr" == *noindex* ]] && echo "OK   $pth → X-Robots-Tag: $xr" || { echo "BŁĄD $pth → brak X-Robots-Tag: noindex"; FAIL=1; }
  done
fi

[ $FAIL = 0 ] && echo "WYNIK: wszystkie kontrole OK" || echo "WYNIK: są błędy — nie przełączaj domeny"
exit $FAIL
