#!/usr/bin/env bash
set -euo pipefail
free -m
df -h /
docker run --rm -v /home/gh-runner/migracja-archiwa:/archives:ro alpine:3.22 sh -c 'find /archives -maxdepth 5 -type f \( -name "*.sql" -o -name "*OGRANICZENIA*" -o -name "*MANIFEST*" -o -name "*auth*" -o -name "*storage*json" \) -print | head -90'
