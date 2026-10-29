#!/usr/bin/env bash
set -euo pipefail
docker exec coolify-db psql -U coolify -d coolify -At -c "select column_name from information_schema.columns where table_name = 'services' order by ordinal_position;"
docker inspect --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}} {{index .Config.Labels "com.docker.compose.project.config_files"}} {{.Config.Image}}' web-xh4qbckykxsq1iofxdoe5t3h
docker exec coolify-db psql -U coolify -d coolify -At -c "select name,fqdn from service_applications where service_id in (select id from services where uuid='xh4qbckykxsq1iofxdoe5t3h');"
