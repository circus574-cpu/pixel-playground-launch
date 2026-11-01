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
 inspect)
  bash "$root/deploy/scripts/online-server-preflight.sh"
  exit 0;;
 prepare)
  # Tagged rollback images survive the normal deployment's dangling-image cleanup.
  for service in app web; do
   tag="ki-legends-$service:before-online-20261101"
   if ! docker image inspect "$tag" >/dev/null 2>&1; then
    image=$(docker inspect --format '{{.Image}}' "$service-xh4qbckykxsq1iofxdoe5t3h")
    docker tag "$image" "$tag"
   fi
  done
  if [ ! -s "$base/before-online-live-release" ]; then cp "$HOME/ki-legends-aruba-staging/coolify-live-release" "$base/before-online-live-release"; fi
  bash "$root/deploy/scripts/approved-online-config.sh" a32ba3ed68a2164c43965dd7b969678df988173c
  bash "$root/deploy/scripts/verify-online-backup.sh"
  cat "$base/secrets/game_runtime_password" | docker exec -i ki-multiplayer-db-db-1 sh -c 'IFS= read -r PGPASSWORD; export PGPASSWORD; psql -X -h 127.0.0.1 -U ki_runtime -d ki_multiplayer -v ON_ERROR_STOP=1 -c "SELECT current_user; SELECT character_id,lease_id FROM game.online_character_state LIMIT 0;"'
  exit 0;;
 rollback)
  backup=$(cat "$base/last-online-config-backup")
  [[ "$backup" = "$base"/backups/online-config-* && -s "$backup/coolify-before.json" ]] || exit 2
  docker exec -u 0 coolify mkdir -p -m 700 /tmp/ki-online-cutover-rollback
  docker cp "$backup/coolify-before.json" coolify:/tmp/ki-online-cutover-rollback/before.json >/dev/null
  docker cp "$root/deploy/scripts/restore-online-coolify.php" coolify:/tmp/ki-online-cutover-rollback/restore.php >/dev/null
  docker exec -u 0 -e KI_ONLINE_CUTOVER_APPROVED=1 coolify php /tmp/ki-online-cutover-rollback/restore.php /tmp/ki-online-cutover-rollback/before.json
  uuid=xh4qbckykxsq1iofxdoe5t3h
  project=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "web-$uuid")
  for service in app web; do
   tag=$(docker inspect --format '{{.Config.Image}}' "$service-$uuid")
   docker tag "ki-legends-$service:before-online-20261101" "$tag"
  done
  docker run --rm -v /var/run/docker.sock:/var/run/docker.sock -v "/data/coolify/services/$uuid:/data/coolify/services/$uuid:ro" -w "/data/coolify/services/$uuid" docker:cli compose -p "$project" up -d --no-build --wait --wait-timeout 180
  docker start ki-multiplayer-db-game-server-1 >/dev/null
  cp "$base/before-online-live-release" "$HOME/ki-legends-aruba-staging/coolify-live-release"
  echo 'Previous application restored; new PostgreSQL records were not deleted'
  exit 0;;
 verify-live|restart-verify|stop-old) ;;
 *) echo 'Unknown operation'; exit 2;;
esac
if [ "$phase" = restart-verify ]; then
 test -s "$base/secrets/live-qa.json"
 docker cp "$base/secrets/live-qa.json" "$app:$qa_file" >/dev/null
 docker cp "$root/deploy/scripts/verify-live-online.mjs" "$app:/tmp/verify-live-online.mjs" >/dev/null
 docker exec -u 0 "$app" chown node:node "$qa_file"
 docker exec -u 0 "$app" chmod 644 /tmp/verify-live-online.mjs
 docker exec "$app" node /tmp/verify-live-online.mjs "$qa_file" capture
 docker cp "$app:$qa_file" "$base/secrets/live-qa.json" >/dev/null
 chmod 600 "$base/secrets/live-qa.json"
 docker restart "$app" >/dev/null
 sleep 17
fi
curl --fail --silent --show-error --max-time 30 --output /dev/null https://kilegends.pl/
healthy=false
for attempt in $(seq 1 30); do
 if docker exec "$app" node -e 'fetch("http://127.0.0.1:7420/health").then(async r=>{const h=await r.json();if(!r.ok||!h.characterPersistenceReady)process.exit(1);console.log(JSON.stringify({characterPersistenceReady:h.characterPersistenceReady,dbConnected:h.dbConnected}))}).catch(()=>process.exit(1))'; then healthy=true; break; fi
 sleep 1
done
[[ "$healthy" = true ]] || { echo 'Authoritative server is not ready'; exit 1; }
if [ -s "$base/secrets/live-qa.json" ]; then
 docker cp "$base/secrets/live-qa.json" "$app:$qa_file" >/dev/null
 docker exec -u 0 "$app" chown node:node "$qa_file"
fi
docker cp "$root/deploy/scripts/verify-live-online.mjs" "$app:/tmp/verify-live-online.mjs" >/dev/null
docker exec -u 0 "$app" chmod 644 /tmp/verify-live-online.mjs
qa_status=0
mode=normal
[ "$phase" != restart-verify ] || mode=restart
docker exec "$app" node /tmp/verify-live-online.mjs "$qa_file" "$mode" || qa_status=$?
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
