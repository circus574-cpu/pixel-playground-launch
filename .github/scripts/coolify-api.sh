#!/usr/bin/env bash
# Runs one Coolify API call on the VPS. Reads the API token from the first stdin line and an
# optional JSON body from the rest; never prints the token. Usage: coolify-api.sh METHOD PATH
set -euo pipefail
METHOD="${1:?method}"; PATH_="${2:?path}"
[[ "$METHOD" =~ ^(GET|PATCH)$ ]] || { echo 'Only GET and PATCH are allowed' >&2; exit 2; }
[[ "$PATH_" =~ ^/api/v1/[a-z0-9/_-]+$ ]] || { echo 'Bad API path' >&2; exit 2; }
IFS= read -r TOKEN
BODY=$(cat || true)
for base in http://127.0.0.1:8000 http://127.0.0.1:8080; do
  if curl -fsS --max-time 5 -o /dev/null "$base/api/health" 2>/dev/null; then BASE=$base; break; fi
done
if [ -z "${BASE:-}" ]; then
  # Coolify inside its container listens on 8080.
  exec docker exec -i coolify sh -c "curl -fsS --max-time 20 -X $METHOD -H 'Authorization: Bearer '\"\$0\" -H 'Content-Type: application/json' ${BODY:+--data-binary @-} http://127.0.0.1:8080$PATH_" "$TOKEN" <<<"$BODY"
fi
if [ -n "$BODY" ]; then
  curl -fsS --max-time 20 -X "$METHOD" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' --data-binary @- "$BASE$PATH_" <<<"$BODY"
else
  curl -fsS --max-time 20 -X "$METHOD" -H "Authorization: Bearer $TOKEN" "$BASE$PATH_"
fi
