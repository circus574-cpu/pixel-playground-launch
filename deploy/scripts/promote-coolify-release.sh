#!/usr/bin/env bash
set -euo pipefail
SHA="${1:?release SHA}"
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || exit 2
UUID=xh4qbckykxsq1iofxdoe5t3h
BASE="$HOME/ki-legends-aruba-staging"
# Build and run HTTP checks in the separate, loopback-only candidate stack first.
bash -s -- "$SHA" < "$BASE/deploy-candidate.sh"
WEB="web-$UUID"; APP="app-$UUID"
PROJECT=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$WEB")
CONFIG=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project.config_files"}}' "$WEB")
[[ "$CONFIG" = "/data/coolify/services/$UUID/docker-compose.yml" ]] || { echo 'Unexpected Coolify configuration'; exit 1; }
WEB_TAG=$(docker inspect -f '{{.Config.Image}}' "$WEB")
APP_TAG=$(docker inspect -f '{{.Config.Image}}' "$APP")
OLD_WEB=$(docker inspect -f '{{.Image}}' "$WEB")
OLD_APP=$(docker inspect -f '{{.Image}}' "$APP")
compose_up() {
 docker run --rm -v /var/run/docker.sock:/var/run/docker.sock -v "/data/coolify/services/$UUID:/data/coolify/services/$UUID:ro" -w "/data/coolify/services/$UUID" docker:cli compose -p "$PROJECT" -f "$CONFIG" up -d --no-build --wait --wait-timeout 180
}
rollback() {
 echo 'Restoring previous images'
 docker tag "$OLD_WEB" "$WEB_TAG"
 docker tag "$OLD_APP" "$APP_TAG"
 compose_up
}
docker pull docker:cli >/dev/null
trap 'rollback' ERR
docker tag "ki-legends-web:staging-$SHA" "$WEB_TAG"
docker tag "ki-legends-app:staging-$SHA" "$APP_TAG"
compose_up
bash "$BASE/releases/$SHA/deploy/scripts/smoke-test.sh" https://staging.kilegends.pl --staging
trap - ERR
printf '%s\n' "$SHA" > "$BASE/coolify-live-release"
echo "COOLIFY RELEASE VERIFIED $SHA"
