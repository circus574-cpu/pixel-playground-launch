#!/usr/bin/env bash
# KI LEGENDS — kopia zapasowa PO migracji, na Twoim VPS (baza self-hosted Supabase + pliki magazynu).
# Uruchamiaj z crona, np.: 15 3 * * * /opt/ki-legends/backup-vps.sh >> /var/log/ki-backup.log 2>&1
# Wymaga: docker, dostęp do kontenera bazy Supabase uruchomionego w Coolify.
set -euo pipefail
DB_CONTAINER="${DB_CONTAINER:?nazwa kontenera supabase-db z Coolify (docker ps)}"
STORAGE_DIR="${STORAGE_DIR:?katalog woluminu storage Supabase na hoście}"
OUT="${OUT:-/var/backups/ki-legends}"; KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP=$(date -u +%Y%m%d-%H%M%S); mkdir -p "$OUT"
docker exec "$DB_CONTAINER" pg_dump -U postgres -d postgres -Fc --no-owner > "$OUT/db-$STAMP.dump"
tar -C "$STORAGE_DIR" -czf "$OUT/storage-$STAMP.tar.gz" .
sha256sum "$OUT/db-$STAMP.dump" "$OUT/storage-$STAMP.tar.gz" > "$OUT/SHA256SUMS-$STAMP"
find "$OUT" -type f -mtime +"$KEEP_DAYS" -delete
echo "Kopia $STAMP gotowa w $OUT"
