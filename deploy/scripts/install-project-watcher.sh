#!/usr/bin/env bash
set -euo pipefail
BASE="$HOME/ki-legends-aruba-staging/automation"
# Validate syntax and GitHub access first. No credentials are returned.
docker exec -i coolify php -l < "$BASE/watch-projects.php"
docker exec -i coolify php < "$BASE/watch-projects.php"
if docker container inspect ki-project-auto-deploy >/dev/null 2>&1; then
 echo 'Watcher already exists; mounted script has been updated.'
else
 docker run -d --name ki-project-auto-deploy --restart unless-stopped --memory 64m -v /var/run/docker.sock:/var/run/docker.sock -v "$BASE/watch-projects.php:/watch-projects.php:ro" docker:cli sh -c 'while true; do docker exec -e KI_DEPLOY_APPLY=1 -i coolify php < /watch-projects.php; sleep 120; done'
fi
