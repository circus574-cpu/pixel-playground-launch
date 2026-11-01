#!/usr/bin/env bash
set -euo pipefail
set +x
phase="${1:?phase}"
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
app=app-xh4qbckykxsq1iofxdoe5t3h
base="$HOME/ki-multiplayer-db"
qa_file=/tmp/ki-online-qa-production.json
umask 077
case "$phase" in
 prepare)
  bash "$root/deploy/scripts/approved-online-config.sh" a32ba3ed68a2164c43965dd7b969678df988173c
  bash "$root/deploy/scripts/verify-online-backup.sh"
  exit 0;;
 verify-live|restart-verify|stop-old) ;;
 *) echo 'Unknown operation'; exit 2;;
esac
if [ "$phase" = restart-verify ]; then
 test -s "$base/secrets/live-qa.json"
 docker restart "$app" >/dev/null
 sleep 17
fi
curl --fail --silent --show-error --max-time 30 --output /dev/null https://kilegends.pl/
docker exec "$app" node -e 'fetch("http://127.0.0.1:7420/health").then(async r=>{const h=await r.json();if(!r.ok||!h.characterPersistenceReady)process.exit(1);console.log(JSON.stringify({characterPersistenceReady:h.characterPersistenceReady,dbConnected:h.dbConnected}))}).catch(()=>process.exit(1))'
if [ -s "$base/secrets/live-qa.json" ]; then
 docker cp "$base/secrets/live-qa.json" "$app:$qa_file" >/dev/null
 docker exec -u 0 "$app" chown node:node "$qa_file"
fi
docker cp "$root/deploy/scripts/verify-live-online.mjs" "$app:/tmp/verify-live-online.mjs" >/dev/null
docker exec -u 0 "$app" chmod 644 /tmp/verify-live-online.mjs
qa_status=0
docker exec "$app" node /tmp/verify-live-online.mjs "$qa_file" || qa_status=$?
docker cp "$app:$qa_file" "$base/secrets/live-qa.json" >/dev/null
chmod 600 "$base/secrets/live-qa.json"
[[ "$qa_status" = 0 ]] || exit "$qa_status"
if [ "$phase" = restart-verify ]; then
 date -u +%FT%TZ > "$base/online-restart-verified"
fi
if [ "$phase" = stop-old ]; then
 test -s "$base/online-restart-verified"
 docker stop ki-multiplayer-db-game-server-1 >/dev/null
 echo 'Old standalone relay stopped; container and data retained'
fi
docker inspect --format 'app_networks={{range $key,$value := .NetworkSettings.Networks}}{{$key}} {{end}}' "$app"
docker inspect --format 'database_public_ports={{json .HostConfig.PortBindings}}' ki-multiplayer-db-db-1
echo "Online cutover operation verified: $phase"
