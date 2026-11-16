#!/usr/bin/env python3
"""Publishes a content release (packs + manifest from build_packs.py) to a Ki Legends server through the admin API.

  KI_ADMIN_EMAIL=... KI_ADMIN_PASSWORD=... python3 scripts/godot/publish_content.py \\
      --server https://kilegends.pl --dir deploy/godot-content/2026.11.17.1 [--activate] [--note "text"]

Uploads every pack (skipping those already on the server with the same SHA-256), creates the release (the server re-hashes every
pack before it accepts the manifest) and, with --activate, makes it the release clients get. Nothing here is run automatically:
publishing to a production server is the owner's decision.
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path


def call(server: str, method: str, path: str, token: str | None = None, body: dict | None = None, data=None, headers=None):
    request = urllib.request.Request(server + path, method=method, data=data if data is not None else (json.dumps(body).encode() if body is not None else None))
    if body is not None:
        request.add_header("Content-Type", "application/json")
    if token:
        request.add_header("Authorization", "Bearer " + token)
    for key, value in (headers or {}).items():
        request.add_header(key, value)
    try:
        with urllib.request.urlopen(request, timeout=900) as response:
            text = response.read().decode()
            return response.status, json.loads(text) if text else None
    except urllib.error.HTTPError as error:
        text = error.read().decode()
        try:
            return error.code, json.loads(text)
        except ValueError:
            return error.code, {"raw": text}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--server", required=True)
    parser.add_argument("--dir", required=True, help="folder with manifest.json and the .pck files")
    parser.add_argument("--activate", action="store_true")
    parser.add_argument("--note", default="")
    args = parser.parse_args()
    server = args.server.rstrip("/")
    folder = Path(args.dir)
    manifest = json.loads((folder / "manifest.json").read_text())
    version = manifest["version"]
    email, password = os.environ.get("KI_ADMIN_EMAIL"), os.environ.get("KI_ADMIN_PASSWORD")
    if not email or not password:
        print("set KI_ADMIN_EMAIL and KI_ADMIN_PASSWORD", file=sys.stderr)
        return 2
    status, session = call(server, "POST", "/ws/auth/login", body={"email": email, "password": password})
    if status != 200:
        print("login failed", status, session, file=sys.stderr)
        return 1
    token = session["accessToken"]
    for name, entry in manifest["packs"].items():
        path = folder / entry["file"]
        with path.open("rb") as handle:
            status, result = call(server, "PUT", f"/ws/godot/admin/releases/{version}/files/{entry['file']}", token, data=handle,
                                  headers={"Content-Length": str(entry["bytes"]), "Content-Type": "application/octet-stream", "X-Pack-Sha256": entry["sha256"]})
        print(f"{name:18s} {entry['bytes'] / 1e6:7.1f} MB  ->", status)
        if status != 200:
            print(result, file=sys.stderr)
            return 1
    status, result = call(server, "POST", "/ws/godot/admin/releases", token, body={"manifest": manifest, "note": args.note})
    print("release", version, status)
    if status != 201:
        print(result, file=sys.stderr)
        return 1
    if args.activate:
        status, result = call(server, "POST", "/ws/godot/admin/activate", token, body={"version": version})
        print("activate", status)
        return 0 if status == 200 else 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
