#!/usr/bin/env bash
set -euo pipefail
SHA="${1:?release SHA}"
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || exit 2
UUID=xh4qbckykxsq1iofxdoe5t3h
BASE="$HOME/ki-legends-aruba-staging"
LIVE_URL="${KI_LIVE_SMOKE_URL:-https://kilegends.pl}"
BASE_KEEP_PREV=$(cat "$BASE/coolify-live-release" 2>/dev/null || true)
# Every release leaves two tagged images (ki-legends-web/app:staging-<sha>) plus build cache; without cleanup the
# 128 GB host filled up (21:07 on 2026-11-11: "no space left on device" while exporting the images).
# Keeps the release being built and the one that was live before it (manual rollback); docker itself refuses to remove
# an image that a container still uses. Best effort: a failing cleanup never fails or rolls back a release.
cleanup_images() {
 local keep_a="$1" keep_b="$2" repo ref
 for repo in ki-legends-web ki-legends-app; do
  while read -r ref; do
   [ -n "$ref" ] || continue
   case "$ref" in *":staging-$keep_a"|*":staging-$keep_b") continue;; esac
   docker rmi "$ref" >/dev/null 2>&1 || true
  done < <(docker images --format '{{.Repository}}:{{.Tag}}' "$repo" 2>/dev/null | grep ':staging-' || true)
 done
 docker image prune -f >/dev/null 2>&1 || true
 docker builder prune -f --filter 'until=48h' >/dev/null 2>&1 || true
 echo "Disk after image cleanup:"; df -h / | tail -1
}
# Free the space first so the build below cannot run out of it, then clean again once the release is verified.
cleanup_images "$SHA" "$BASE_KEEP_PREV"
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
wait_for_proxy() {
 # Docker health does not imply that Traefik has loaded the replacement routes.
 # Keep the full smoke suite and rollback; only wait for actual HTTP readiness.
 local attempt
 for ((attempt=1; attempt<=30; attempt++)); do
  if curl --fail --silent --show-error --max-time 3 --output /dev/null "$LIVE_URL/healthz" &&
     curl --fail --silent --show-error --max-time 3 --output /dev/null "$LIVE_URL/"; then
   return 0
  fi
  sleep 2
 done
 echo "Proxy did not become ready; refusing promotion" >&2
 return 1
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
wait_for_proxy
bash "$BASE/releases/$SHA/deploy/scripts/smoke-test.sh" "$LIVE_URL" --staging
trap - ERR
printf '%s\n' "$SHA" > "$BASE/coolify-live-release"
cleanup_images "$SHA" "$BASE_KEEP_PREV"
echo "COOLIFY RELEASE VERIFIED $SHA"
