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
# The host directory is 0700; the mounted secret must be readable by the DB process.
# Some Docker user namespaces cannot read a host-owned 0600 file inside a container.
chmod 444 "$BASE/secrets/owner_password"
cd "$BASE"
docker compose -p ki-multiplayer-db -f compose.yml config --quiet
if ! docker compose -p ki-multiplayer-db -f compose.yml up -d --wait --wait-timeout 180; then
 docker compose -p ki-multiplayer-db -f compose.yml logs --tail 80 db
 exit 1
fi
present=$(docker compose -p ki-multiplayer-db -f compose.yml exec -T db psql -U ki_owner -d ki_multiplayer -At -c "select to_regclass('game.schema_version') is not null")
if [ "$present" != t ]; then
 existing=$(docker compose -p ki-multiplayer-db -f compose.yml exec -T db psql -U ki_owner -d ki_multiplayer -At -c "select count(*) from pg_namespace where nspname='game'")
 [ "$existing" = 0 ] || { echo 'Unknown existing game schema: refused'; exit 1; }
 docker compose -p ki-multiplayer-db -f compose.yml exec -T db psql -U ki_owner -d ki_multiplayer -v ON_ERROR_STOP=1 < init/001-foundation.sql
fi
v2_present=$(docker compose -p ki-multiplayer-db -f compose.yml exec -T db psql -U ki_owner -d ki_multiplayer -At -c "select exists(select 1 from game.schema_version where version=2)")
if [ "$v2_present" != t ]; then
 docker compose -p ki-multiplayer-db -f compose.yml exec -T db psql -U ki_owner -d ki_multiplayer -v ON_ERROR_STOP=1 < init/002-global-multiplayer-optimization.sql
fi
accounts_present=$(docker compose -p ki-multiplayer-db -f compose.yml exec -T db psql -U ki_owner -d ki_multiplayer -At -c "select to_regclass('accounts.schema_version') is not null")
if [ "$accounts_present" != t ]; then
 # Player accounts on the VPS: back up first, then apply the idempotent migration.
 umask 077
 pre="$BASE/backups/before-accounts-$(date -u +%Y%m%dT%H%M%SZ).dump"
 docker compose -p ki-multiplayer-db -f compose.yml exec -T db pg_dump -U ki_owner -d ki_multiplayer -Fc > "$pre"
 sha256sum "$pre" > "$pre.sha256"
 docker compose -p ki-multiplayer-db -f compose.yml exec -T db psql -U ki_owner -d ki_multiplayer -v ON_ERROR_STOP=1 < init/005-accounts.sql
fi
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
docker compose -p ki-multiplayer-db -f compose.yml exec -T db psql -U ki_owner -d "$check" -v ON_ERROR_STOP=1 -c "DO \$\$ BEGIN IF (SELECT max(version) FROM game.schema_version)<>2 THEN RAISE EXCEPTION 'Restore version mismatch'; END IF; END \$\$;"
docker compose -p ki-multiplayer-db -f compose.yml exec -T db dropdb -U ki_owner "$check"
container=$(docker compose -p ki-multiplayer-db -f compose.yml ps -q db)
ports=$(docker inspect --format '{{json .HostConfig.PortBindings}}' "$container")
[[ "$ports" = 'null' || "$ports" = '{}' ]] || { echo 'Unexpected public port binding'; exit 1; }
echo 'VERIFIED: database healthy, SQL checks PASS, backup restore PASS, no published ports'
