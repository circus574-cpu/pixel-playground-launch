#!/usr/bin/env bash
# Only the standalone prompt service. No production game rebuild, main merge or DB mutation.
set -euo pipefail
release="${1:?Full commit SHA required}"
[[ "$release" =~ ^[0-9a-f]{40}$ ]] || exit 2
export BOARD_BASE="$HOME/ki-prompt-board"
export BOARD_RELEASE="$release"
export BOARD_RELEASE_DIR="$BOARD_BASE/releases/$release"
export BOARD_UID="$(id -u)" BOARD_GID="$(id -g)"
mkdir -p "$BOARD_BASE/data" "$BOARD_BASE/backups"
chmod 700 "$BOARD_BASE" "$BOARD_BASE/data" "$BOARD_BASE/backups"
test -s "$BOARD_RELEASE_DIR/server.mjs"
test -s "$BOARD_RELEASE_DIR/prompts.json"
# Reuse only the current public account API address/key, never service_role or private /test config.
python3 - "$BOARD_BASE" <<'PY'
import json,os,secrets,subprocess,sys
from pathlib import Path
base=Path(sys.argv[1]);auth=base/'auth.json'
c=json.loads(subprocess.check_output(['docker','inspect','app-xh4qbckykxsq1iofxdoe5t3h']))[0]
env=dict(s.split('=',1) for s in c['Config']['Env'] if '=' in s)
url=env.get('SUPABASE_URL'); key=env.get('SUPABASE_PUBLISHABLE_KEY')
if not url or not key: raise SystemExit('Current account API public configuration missing; not deploying')
config=json.loads(auth.read_text()) if auth.exists() else {'sessionKey':secrets.token_hex(32)}
config['supabase']={'url':url.rstrip('/'),'key':key}
tmp=base/'auth.json.tmp';tmp.write_text(json.dumps(config));tmp.chmod(0o600);os.replace(tmp,auth)
print('Account API configured; no database changes, credentials or tokens printed')
PY
previous="$(cat "$BOARD_BASE/current-release" 2>/dev/null || true)"
if [ -f "$BOARD_BASE/data/state.json" ]; then
  cp "$BOARD_BASE/data/state.json" "$BOARD_BASE/backups/state-before-$release.json"
fi
compose=(docker compose -p ki-prompt-board -f "$BOARD_RELEASE_DIR/compose.yml")
rollback() {
  echo 'Prompt board deployment failed; production game unchanged.'
  if [[ "$previous" =~ ^[0-9a-f]{40}$ ]] && [ -d "$BOARD_BASE/releases/$previous" ]; then
    export BOARD_RELEASE="$previous" BOARD_RELEASE_DIR="$BOARD_BASE/releases/$previous"
    docker compose -p ki-prompt-board -f "$BOARD_RELEASE_DIR/compose.yml" up -d --wait --wait-timeout 90 || true
  else
    "${compose[@]}" stop board || true
  fi
}
trap rollback ERR
"${compose[@]}" config --quiet
"${compose[@]}" up -d --wait --wait-timeout 120
docker exec ki-prompt-board node -e "fetch('http://127.0.0.1:3000/prompty/api/prompts').then(r=>{if(r.status!==401)process.exit(1);console.log('Anonymous catalogue denied: PASS')})"
for attempt in $(seq 1 20); do
  if curl --fail --silent --show-error --max-time 10 https://staging.kilegends.pl/prompty/ | grep -q 'Prompty i gotowe zasoby'; then break; fi
  if [ "$attempt" = 20 ]; then exit 1; fi
  sleep 2
done
status="$(curl --silent --show-error --max-time 10 --output /dev/null --write-out '%{http_code}' https://staging.kilegends.pl/prompty/api/prompts)"
test "$status" = 401
printf '%s\n' "$release" > "$BOARD_BASE/current-release"
trap - ERR
echo "PROMPT BOARD VERIFIED $release https://staging.kilegends.pl/prompty/; private files in ~/ki-prompt-board/data"
