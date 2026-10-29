#!/usr/bin/env bash
set -euo pipefail
# Receives only application files. Secrets are generated and retained exclusively on this VPS.
BASE="$HOME/ki-multiplayer-db"
mkdir -p "$BASE/secrets" "$BASE/backups"
chmod 700 "$BASE" "$BASE/secrets" "$BASE/backups"
if [ ! -s "$BASE/secrets/owner_password" ]; then
 umask 077
 openssl rand -hex 32 > "$BASE/secrets/owner_password"
fi
cd "$BASE"
docker compose -p ki-multiplayer-db -f compose.yml config --quiet
docker compose -p ki-multiplayer-db -f compose.yml up -d --wait --wait-timeout 180
docker compose -p ki-multiplayer-db -f compose.yml exec -T db psql -U ki_owner -d ki_multiplayer -v ON_ERROR_STOP=1 < verify.sql
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="$BASE/backups/initial-$stamp.dump"
umask 077
docker compose -p ki-multiplayer-db -f compose.yml exec -T db pg_dump -U ki_owner -d ki_multiplayer -Fc > "$backup"
sha256sum "$backup" > "$backup.sha256"
check="ki_restore_$stamp"
check=${check,,}
docker compose -p ki-multiplayer-db -f compose.yml exec -T db createdb -U ki_owner "$check"
docker compose -p ki-multiplayer-db -f compose.yml exec -T db pg_restore -U ki_owner -d "$check" --exit-on-error < "$backup"
docker compose -p ki-multiplayer-db -f compose.yml exec -T db psql -U ki_owner -d "$check" -v ON_ERROR_STOP=1 -c "DO \$\$ BEGIN IF (SELECT version FROM game.schema_version)<>1 THEN RAISE EXCEPTION 'Restore version mismatch'; END IF; END \$\$;"
docker compose -p ki-multiplayer-db -f compose.yml exec -T db dropdb -U ki_owner "$check"
container=$(docker compose -p ki-multiplayer-db -f compose.yml ps -q db)
ports=$(docker inspect --format '{{json .HostConfig.PortBindings}}' "$container")
[[ "$ports" = 'null' || "$ports" = '{}' ]] || { echo 'Unexpected public port binding'; exit 1; }
echo 'VERIFIED: database healthy, SQL checks PASS, backup restore PASS, no published ports'
