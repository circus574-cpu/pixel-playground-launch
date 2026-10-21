#!/usr/bin/env bash
# CPU/browser validation only. Never performs GPU lifecycle operations or deployment.
set -euo pipefail
revision=$(git rev-parse HEAD)
output=${KI_VALIDATION_OUTPUT:-/tmp/ki-legends-validation-$revision}
mkdir -p "$output"
record() {
  local label=$1; shift
  local started result
  started=$(date -u +%FT%TZ)
  printf '%s: %s\n' "$label" "$*"
  if "$@" >"$output/$label.txt" 2>&1; then result=0; else result=$?; fi
  node --input-type=module - "$output" "$label" "$revision" "$started" "$result" "$*" <<'JS'
import fs from 'node:fs';
import crypto from 'node:crypto';
const [folder,label,sha,started,code,command]=process.argv.slice(2);
const path=`${folder}/results.json`;
const results=fs.existsSync(path)?JSON.parse(fs.readFileSync(path,'utf8')):[];
results.push({sha,command,started,finished:new Date().toISOString(),exitCode:Number(code),log:`${label}.txt`,logSha256:crypto.createHash('sha256').update(fs.readFileSync(`${folder}/${label}.txt`)).digest('hex')});
fs.writeFileSync(path,JSON.stringify(results,null,2)+'\n');
JS
  printf '%s: exit %s\n' "$label" "$result"
  return "$result"
}
record initial-source-integrity git diff --exit-code HEAD --
record npm-ci npm ci
record typecheck npm run typecheck
record unit npm run test
record assets npm run assets:check
record lint npm run lint
record build npm run build
record e2e npm run test:e2e
record source-integrity git diff --exit-code HEAD --
cp -a test-results "$output/full-e2e-artifacts"
record software-webgl npx playwright test --project=software-webgl
cp -a test-results "$output/software-webgl-artifacts"
record final-source-integrity git diff --exit-code HEAD --
printf 'Validation completed on %s; evidence: %s\n' "$revision" "$output"
