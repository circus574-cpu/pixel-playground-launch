#!/usr/bin/env bash
set -euo pipefail
for prefix in app-xh4qbckykxsq1iofxdoe5t3h cbp8moqj7nyjag4szbmvgczv bhlcaqj8kuqmjqktnfrw1f0y bzo0ptfidwvbsi0lmyoe7xgo izzgbsiybh632beq9nvq1ktp; do
 name=$(docker ps --filter "name=$prefix" --format '{{.Names}}' | head -1)
 test -n "$name" || continue
 echo "PROJECT $prefix"
 docker exec "$name" node -e 'const fs=require("fs"),path=require("path");const hosts=new Set();for(const root of ["/app/.output/public/assets","/app/dist/assets","/app/build/client/assets"]){if(!fs.existsSync(root))continue;for(const file of fs.readdirSync(root)){if(!/\.js$/.test(file))continue;const s=fs.readFileSync(path.join(root,file),"utf8");for(const m of s.matchAll(/https:\/\/([a-z0-9-]+\.supabase\.co)/g))hosts.add(m[1]);}}for(const k of ["SUPABASE_URL","VITE_SUPABASE_URL"]){try{if(process.env[k])hosts.add(new URL(process.env[k]).hostname)}catch{}}console.log(JSON.stringify({supabaseHosts:[...hosts]}));'
done
