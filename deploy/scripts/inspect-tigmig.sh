#!/usr/bin/env bash
set -euo pipefail
docker exec coolify-db psql -U coolify -d coolify -At -c "select name,status,fqdn,ports_exposes from applications where uuid='bhlcaqj8kuqmjqktnfrw1f0y';"
for host in tigmig.com.pl www.tigmig.com.pl; do
 curl -sS --max-time 15 -o /tmp/ki-tigmig-body -w "$host HTTP %{http_code}\n" --resolve "$host:443:127.0.0.1" "https://$host/" || true
 head -c 180 /tmp/ki-tigmig-body || true
 echo
done
docker ps --filter name=bhlcaqj8kuqmjqktnfrw1f0y --format '{{.Names}} {{.Status}}'
for name in $(docker ps --filter name=bhlcaqj8kuqmjqktnfrw1f0y --format '{{.Names}}'); do
 docker inspect --format '{{json .NetworkSettings.Networks}}' "$name"
 docker inspect --format '{{range $k,$v := .Config.Labels}}{{if or (eq $k "traefik.http.routers.http-0-bhlcaqj8kuqmjqktnfrw1f0y.rule") (eq $k "traefik.http.routers.https-0-bhlcaqj8kuqmjqktnfrw1f0y.rule")}}{{$k}}={{$v}}{{end}}{{end}}' "$name"
done
docker inspect $(docker ps --filter name=bhlcaqj8kuqmjqktnfrw1f0y --format '{{.Names}}' | head -1) | python3 -c 'import sys,json; d=json.load(sys.stdin)[0]; print(json.dumps({k:v for k,v in d["Config"]["Labels"].items() if k.startswith("traefik.http.routers.") or k.endswith("loadbalancer.server.port")}))'
docker logs --since 20m coolify-proxy 2>&1 | grep -E 'tigmig|Unable to obtain ACME certificate' | tail -12 || true
