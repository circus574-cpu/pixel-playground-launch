#!/usr/bin/env bash
# Runs as codex on Aruba. Does not change production, DNS, Coolify or databases.
set -euo pipefail
RELEASE="${1:?Pass the full verified Git commit SHA}"
[[ "$RELEASE" =~ ^[0-9a-f]{40}$ ]] || exit 2
docker info >/dev/null
BASE="$HOME/ki-legends-aruba-staging"
DIR="$BASE/releases/$RELEASE"
mkdir -p "$BASE/releases"
if [ ! -d "$DIR" ]; then
  git clone --depth 1 --filter=blob:none --sparse --branch migration/aruba-staging-2026-10-28 https://github.com/circus574-cpu/pixel-playground-launch.git "$DIR"
  git -C "$DIR" sparse-checkout set src public scripts deploy art/pipeline
fi
cd "$DIR"
git fetch --depth 1 origin "$RELEASE"
git checkout --detach "$RELEASE"
test "$(git rev-parse HEAD)" = "$RELEASE"
(cd deploy/overlay/public && sha256sum -c ../SHA256SUMS)
printf 'services:\n  web:\n    ports:\n      - "127.0.0.1:18085:80"\n' > "$BASE/ports.yml"
export KI_RELEASE="$RELEASE"
docker compose --env-file .env.staging.example -p ki-legends-aruba-staging -f docker-compose.staging.yml -f "$BASE/ports.yml" config --quiet
docker compose --env-file .env.staging.example -p ki-legends-aruba-staging -f docker-compose.staging.yml -f "$BASE/ports.yml" up --build -d --wait --wait-timeout 240
bash deploy/scripts/smoke-test.sh http://127.0.0.1:18085 --staging
printf '%s\n' "$RELEASE" > "$BASE/verified-release"
echo "STAGING VERIFIED: $RELEASE, localhost:18085; production/DNS unchanged"
