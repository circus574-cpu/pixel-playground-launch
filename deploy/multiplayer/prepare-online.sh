#!/usr/bin/env bash
# Explicit operator-run upgrade. No application deployment, public ports or existing data deletion.
set -euo pipefail
set +x
base="${KI_ONLINE_STATE_DIR:-$HOME/ki-multiplayer-db}"
db_user="${KI_DB_OWNER:-ki_owner}"
scripts=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
container="${KI_DB_CONTAINER:-ki-multiplayer-db-db-1}"
docker inspect "$container" >/dev/null
ports=$(docker inspect --format '{{json .HostConfig.PortBindings}}' "$container")
[[ "$ports" = null || "$ports" = '{}' ]] || { echo 'Refused: database exposes public ports' >&2; exit 1; }
umask 077
mkdir -p "$base/backups" "$base/secrets"
backup="$base/backups/before-online-$(date -u +%Y%m%dT%H%M%S)-$$.dump"
docker exec "$container" pg_dump -U "$db_user" -d ki_multiplayer -Fc > "$backup"
sha256sum "$backup" > "$backup.sha256"
for migration in 003-online-character-state.sql 004-online-session-leases.sql; do
 docker exec -i "$container" psql -X -U "$db_user" -d ki_multiplayer -v ON_ERROR_STOP=1 < "$scripts/$migration"
done
password_file="$base/secrets/game_runtime_password"
role_exists=$(docker exec "$container" psql -X -U "$db_user" -d ki_multiplayer -At -c "SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='ki_runtime')")
if [ "$role_exists" = t ] && [ ! -s "$password_file" ]; then echo 'Refused: existing runtime role has no matching saved secret; no password was changed' >&2; exit 1; fi
if [ ! -s "$password_file" ]; then openssl rand -hex 32 > "$password_file"; fi
chmod 600 "$password_file"
runtime_password=$(cat "$password_file")
[[ "$runtime_password" =~ ^[0-9a-f]{64}$ ]] || { echo 'Refused: unexpected runtime password format' >&2; exit 1; }
# Pass the generated value through stdin, not command-line arguments or logs.
{
 printf "\\set runtime_password '%s'\n" "$runtime_password"
 cat <<'SQL'
SELECT format('CREATE ROLE ki_runtime LOGIN PASSWORD %L', :'runtime_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='ki_runtime') \gexec
GRANT ki_game_server TO ki_runtime;
ALTER ROLE ki_runtime SET statement_timeout='8s';
ALTER ROLE ki_runtime SET lock_timeout='2s';
SET ROLE ki_runtime;
SELECT character_id,lease_id,lease_until FROM game.online_character_state LIMIT 0;
SELECT operation_id FROM game.online_character_operations LIMIT 0;
SQL
} | docker exec -i "$container" psql -X -U "$db_user" -d ki_multiplayer -v ON_ERROR_STOP=1
host_name="${GAME_DB_HOST:-ki-multiplayer-db-db-1}"
[[ "$host_name" =~ ^[a-zA-Z0-9.-]+$ ]] || exit 1
env_file="$base/secrets/game-server.env"
if [ ! -e "$env_file" ]; then
 printf 'DATABASE_URL=postgres://ki_runtime:%s@%s:5432/ki_multiplayer\n' "$runtime_password" "$host_name" > "$env_file"
fi
chmod 600 "$env_file"
unset runtime_password
echo "Database upgrade prepared; backup: $backup; private runtime file: $env_file"
echo 'Application configuration and publication have NOT been changed.'
