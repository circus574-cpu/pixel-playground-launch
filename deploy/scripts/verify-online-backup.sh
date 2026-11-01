#!/usr/bin/env bash
# Restore only into a new disposable database; never overwrite the live database.
set -euo pipefail
set +x
base="$HOME/ki-multiplayer-db"
backup=$(find "$base/backups" -maxdepth 1 -name 'before-online-*.dump' -type f | sort | head -1)
[[ -s "$backup" && -s "$backup.sha256" ]] || exit 1
sha256sum --check "$backup.sha256"
test_db="ki_online_restore_$(date -u +%Y%m%d%H%M%S)_$$"
[[ "$test_db" =~ ^ki_online_restore_[0-9_]+$ ]] || exit 2
container=ki-multiplayer-db-db-1
docker exec "$container" createdb -U ki_owner "$test_db"
trap 'docker exec "$container" dropdb -U ki_owner "$test_db"' EXIT
docker exec -i "$container" pg_restore -U ki_owner -d "$test_db" --exit-on-error < "$backup"
tables=$(docker exec "$container" psql -X -U ki_owner -d "$test_db" -At -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='game' AND table_name IN ('accounts','characters')")
[[ "$tables" = 2 ]] || { echo 'Restore lacks expected game tables'; exit 1; }
echo 'Database backup checksum and isolated restore: PASS; live database untouched'
