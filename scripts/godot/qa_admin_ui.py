#!/usr/bin/env python3
"""Browser run of the admin panel's "Gra Android" tab against the real game server and PostgreSQL (local). See qa-admin-godot.mjs."""
import json
import os
import signal
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
DB = os.environ.get("KI_E2E_DATABASE_URL", "postgres://postgres:local-fixture-only@127.0.0.1:5432/ki_multiplayer")
work = Path("/tmp/ki-admin-ui")
work.mkdir(exist_ok=True)
env = {**os.environ, "DATABASE_URL": DB, "GAME_SERVER_PORT": "7420", "GODOT_CONTENT_DIR": str(work / "content"),
       "AUTH_TOKEN_SECRET": "e2e-secret-e2e-secret-e2e-secret-0123", "PUBLIC_SITE_URL": "http://127.0.0.1:5191"}


def wait(url: str, seconds: int = 90) -> None:
    for _ in range(seconds):
        try:
            urllib.request.urlopen(url, timeout=2).read()
            return
        except Exception:
            time.sleep(1)
    raise SystemExit("not reachable: " + url)


subprocess.run(["npx", "tsx", "scripts/qa-godot-seed.ts"], cwd=REPO, env=env, check=True, capture_output=True)
server = subprocess.Popen(["npx", "tsx", "src/server/gameServer.ts"], cwd=REPO, env=env, stdout=open(work / "server.log", "w"), stderr=subprocess.STDOUT, start_new_session=True)
vite = subprocess.Popen(["npx", "vite", "--config", "scripts/godot-admin-qa.vite.ts", "--host", "127.0.0.1"], cwd=REPO, env=env, stdout=open(work / "vite.log", "w"), stderr=subprocess.STDOUT, start_new_session=True)
try:
    wait("http://127.0.0.1:7420/ws/godot/status")
    wait("http://127.0.0.1:5191/konto", 120)
    result = subprocess.run(["node", "scripts/qa-admin-godot.mjs"], cwd=REPO, env={**env, "KI_CHROMIUM": os.environ.get("KI_CHROMIUM", "/opt/pw-browsers/chromium" if Path("/opt/pw-browsers/chromium").exists() else ""), "KI_QA_OUTPUT": str(REPO / "docs/zmiany/2026-11-16/qa/admin-android")})
    sys.exit(result.returncode)
finally:
    for proc in (server, vite):
        os.killpg(proc.pid, signal.SIGTERM)
