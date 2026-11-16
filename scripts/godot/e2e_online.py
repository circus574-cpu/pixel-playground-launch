#!/usr/bin/env python3
"""End-to-end run of the slim Android base against the REAL game server and PostgreSQL (local, nothing on production):

  1. seeds an administrator and a player (scripts/qa-godot-seed.ts), starts `src/server/gameServer.ts`
  2. publishes the content packs through the admin API (scripts/godot/publish_content.py) and activates the release
  3. exports the slim base PCK (Android preset filters) together with tests/e2e_online.gd
  4. runs the base with Godot: login, manifest, download + mount of the packs, city, cloud save, conflict, travel download

Needs: PostgreSQL with migrations 001-007 on KI_E2E_DATABASE_URL, packs from build_packs.py in --content, godot on PATH.
  python3 scripts/godot/e2e_online.py --content deploy/godot-content/2026.11.17.1
"""
import argparse
import json
import os
import shutil
import signal
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
PROJECT = REPO / "ports" / "godot-pyra"
DB = os.environ.get("KI_E2E_DATABASE_URL", "postgres://postgres:local-fixture-only@127.0.0.1:5432/ki_multiplayer")
PORT = "7420"
SERVER = f"http://127.0.0.1:{PORT}"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--content", required=True)
    args = parser.parse_args()
    work = Path("/tmp/ki-e2e")
    shutil.rmtree(work, ignore_errors=True)
    (work / "content").mkdir(parents=True)
    (work / "home").mkdir()
    env = {**os.environ, "DATABASE_URL": DB, "GAME_SERVER_PORT": PORT, "GODOT_CONTENT_DIR": str(work / "content"),
           "AUTH_TOKEN_SECRET": "e2e-secret-e2e-secret-e2e-secret-0123", "PUBLIC_SITE_URL": SERVER}
    seed = subprocess.run(["npx", "tsx", "scripts/qa-godot-seed.ts"], cwd=REPO, env=env, capture_output=True, text=True, check=True)
    users = json.loads(seed.stdout.strip().splitlines()[-1])
    server = subprocess.Popen(["npx", "tsx", "src/server/gameServer.ts"], cwd=REPO, env=env, stdout=open(work / "server.log", "w"), stderr=subprocess.STDOUT, start_new_session=True)
    try:
        for _ in range(60):
            try:
                urllib.request.urlopen(SERVER + "/ws/godot/status", timeout=2).read()
                break
            except Exception:
                time.sleep(1)
        else:
            print("server did not start:\n", (work / "server.log").read_text()[-2000:])
            return 1
        publish = subprocess.run(
            [sys.executable, "scripts/godot/publish_content.py", "--server", SERVER, "--dir", args.content, "--activate", "--note", "e2e"],
            cwd=REPO, env={**env, "KI_ADMIN_EMAIL": users["e2eadmin"]["email"], "KI_ADMIN_PASSWORD": users["e2eadmin"]["password"]},
            capture_output=True, text=True)
        print(publish.stdout[-600:], publish.stderr[-400:])
        if publish.returncode != 0:
            return 1
        shutil.copyfile(PROJECT / "tests" / "e2e_online.gd", PROJECT / "e2e_online.gd")
        try:
            subprocess.run(["godot", "--headless", "--path", str(PROJECT), "--export-pack", "Android", str(work / "base.pck")],
                           check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        finally:
            (PROJECT / "e2e_online.gd").unlink(missing_ok=True)
            (PROJECT / "e2e_online.gd.uid").unlink(missing_ok=True)
        print(f"base pck: {(work / 'base.pck').stat().st_size / 1e6:.1f} MB")
        run = subprocess.run(
            ["godot", "--headless", "--main-pack", str(work / "base.pck"), "--script", "res://e2e_online.gd", "--", f"--server={SERVER}"],
            env={**os.environ, "HOME": str(work / "home"), "XDG_DATA_HOME": str(work / "home" / "share"),
                 "E2E_EMAIL": users["e2egracz"]["email"], "E2E_PASSWORD": users["e2egracz"]["password"]},
            capture_output=True, text=True, timeout=900)
        lines = [l for l in run.stdout.splitlines() if l.startswith("E2E")]
        print("\n".join(lines))
        if run.returncode != 0 or not any(l.startswith("E2E DONE failures=0") for l in lines):
            print(run.stdout[-2500:], run.stderr[-1500:])
            return 1
        return 0
    finally:
        os.killpg(server.pid, signal.SIGTERM)   # npx starts node as a child: stop the whole group
        server.wait(timeout=20)


if __name__ == "__main__":
    sys.exit(main())
