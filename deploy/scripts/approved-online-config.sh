#!/usr/bin/env bash
# Operator preparation after passing QA and owner authorization. Does not restart or publish app.
set -euo pipefail
set +x
[[ "${KI_ONLINE_CUTOVER_APPROVED:-}" = 1 ]] || { echo 'Explicit cutover guard missing' >&2; exit 1; }
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
base="$HOME/ki-multiplayer-db"
source_sha="${1:?Pass the tested source SHA}"
[[ "$source_sha" =~ ^[0-9a-f]{40}$ ]] || exit 2
marker="$base/online-config-prepared-$source_sha"
if [ -s "$marker" ]; then echo "Online configuration already prepared for $source_sha; recovery locator retained"; exit 0; fi
workdir=/data/coolify/services/xh4qbckykxsq1iofxdoe5t3h
stamp="$(date -u +%Y%m%dT%H%M%S)-$$"
backup="$base/backups/online-config-$stamp"
umask 077
mkdir -p "$backup"
chmod 700 "$backup"
# Preserve the actual files in addition to model state, without printing their contents.
docker run --rm -e "TARGET_UID=$(id -u)" -e "TARGET_GID=$(id -g)" -v "$workdir:/from:ro" -v "$backup:/backup" docker:cli sh -c 'cp /from/docker-compose.yml /backup/docker-compose.yml; if [ -f /from/.env ]; then cp /from/.env /backup/service.env; fi; chmod 600 /backup/*; chown "$TARGET_UID:$TARGET_GID" /backup/*'
bash "$root/deploy/multiplayer/prepare-online.sh"
private="/tmp/ki-online-cutover-$stamp"
docker exec coolify mkdir -m 700 "$private"
docker cp "$base/secrets/game-server.env" "coolify:$private/runtime.env" >/dev/null
docker cp "$root/deploy/scripts/configure-online-coolify.php" "coolify:$private/configure.php" >/dev/null
if ! docker exec -e KI_ONLINE_CUTOVER_APPROVED=1 coolify php "$private/configure.php" apply "$private/runtime.env" "$private/before.json"; then
 docker cp "coolify:$private/before.json" "$backup/coolify-before.json" >/dev/null 2>&1 || true
 echo "Configuration failed; private recovery directory: $backup" >&2
 exit 1
fi
docker cp "coolify:$private/before.json" "$backup/coolify-before.json" >/dev/null
# Retain a durable private recovery locator; never copy these secret-bearing files into Git.
printf '%s\n' "$backup" > "$base/last-online-config-backup"
chmod 600 "$base/last-online-config-backup"
printf '%s\n' "$backup" > "$marker"
chmod 600 "$marker"
echo "Approved online configuration prepared; app not restarted; recovery: $backup"
