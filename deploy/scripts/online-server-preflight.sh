#!/usr/bin/env bash
# Read-only live inventory. Never print environment values or credentials.
set -euo pipefail
app=app-xh4qbckykxsq1iofxdoe5t3h
db=ki-multiplayer-db-db-1
docker inspect --format 'app_image={{.Config.Image}} app_running={{.State.Running}}' "$app"
docker exec "$app" node -e 'const fs=require("node:fs"); console.log(JSON.stringify({databaseConfigured:!!process.env.DATABASE_URL,accountHost:process.env.SUPABASE_URL?new URL(process.env.SUPABASE_URL).hostname:null,serviceRoleConfigured:!!process.env.SUPABASE_SERVICE_ROLE_KEY,privateSiteConfigured:!!process.env.SESSION_SECRET&&!!process.env.SITE_PASSWORD,accountAuthorityConfigured:!!process.env.SUPABASE_URL&&!!process.env.SUPABASE_PUBLISHABLE_KEY,autostart:process.env.GAME_SERVER_AUTOSTART==="1",onlineRequired:process.env.GAME_ONLINE_REQUIRED==="1",worldPresent:fs.existsSync("/app/.output/public/game/worlds/superior-v2/index.json")}));fetch("http://127.0.0.1:7420/health",{signal:AbortSignal.timeout(5000)}).then(async r=>console.log(JSON.stringify({gameHttpStatus:r.status,health:await r.json()}))).catch(()=>console.log("game_daemon_unreachable"));'
docker inspect --format 'database_running={{.State.Running}} published_ports={{json .HostConfig.PortBindings}}' "$db"
docker exec "$db" psql -X -U ki_owner -d ki_multiplayer -At -c "SELECT 'online_table='||(to_regclass('game.online_character_state') IS NOT NULL); SELECT 'lease_columns='||count(*) FROM information_schema.columns WHERE table_schema='game' AND table_name='online_character_state' AND column_name IN ('lease_id','lease_until'); SELECT 'runtime_role='||count(*) FROM pg_roles WHERE rolname='ki_runtime';"
docker inspect --format '{{range $name,$value := .NetworkSettings.Networks}}network={{$name}} {{end}}' "$app" "$db"
if docker inspect ki-multiplayer-db-game-server-1 >/dev/null 2>&1; then
 docker inspect --format 'legacy_standalone_running={{.State.Running}} legacy_public_ports={{json .HostConfig.PortBindings}}' ki-multiplayer-db-game-server-1
else
 echo 'legacy_standalone_present=false'
fi
