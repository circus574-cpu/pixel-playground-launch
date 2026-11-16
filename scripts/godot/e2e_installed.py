#!/usr/bin/env python3
"""The update from the server checked on the APK the players really have installed (deliveries/godot-ki-legends-1.0), not on a fresh export.

Why: e2e_core.py exports the base from the current project, so it cannot see that the installed APK keeps its own copy of every script its boot.gd
loads before mounting the core (scripts/skin.gd). Release 1.1 passed e2e_core.py and still broke the sign-in window on phones for that reason.
This test unpacks the installed APK, adds tests/e2e_installed.gd, serves the core of the current project from a fake server, lets the APK's own
boot.gd mount it, then builds the sign-in window of the core and reports what it got (and any script error).

  python3 scripts/godot/e2e_installed.py [--apk deliveries/godot-ki-legends-1.0/ki-legends-1.0.apk]
"""
import argparse
import http.server
import importlib.util
import json
import os
import shutil
import subprocess
import threading
import zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apk", default=str(REPO / "deliveries/godot-ki-legends-1.0/ki-legends-1.0.apk"))
    args = parser.parse_args()
    spec = importlib.util.spec_from_file_location("e2e", REPO / "scripts/godot/e2e_core.py")
    e2e = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(e2e)
    builder = e2e.load_builder()
    work = Path("/tmp/ki-e2e-installed")
    shutil.rmtree(work, ignore_errors=True)
    (work / "home").mkdir(parents=True)
    with zipfile.ZipFile(args.apk) as apk:
        apk.extractall(work / "apk", [n for n in apk.namelist() if n.startswith("assets/")])
    root = work / "apk" / "assets"
    listing = [{"pck": "res://" + str(p.relative_to(root)), "disk": str(p)} for p in root.rglob("*")
               if p.is_file() and p.name != "assets.sparsepck" and "_cl_" not in p.parts]
    listing.append({"pck": "res://e2e_core.gd", "disk": str(REPO / "ports/godot-pyra/tests/e2e_installed.gd")})
    (work / "base.json").write_text(json.dumps(listing))
    subprocess.run(["godot", "--headless", "--path", str(e2e.PROJECT), "--script", "res://tools/pack_builder.gd", "--", str(work / "base.json"), str(work / "base.pck")],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    core = e2e.build_pack(builder, work, "core", None)
    e2e.Fake.files = {core["file"]: work / core["file"]}
    e2e.Fake.offer = core
    e2e.Fake.key = f"core-c{builder.client_code()}"
    server = http.server.ThreadingHTTPServer(("127.0.0.1", e2e.PORT), e2e.Fake)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        run = subprocess.run(["godot", "--headless", "--main-pack", str(work / "base.pck"), "--script", "res://e2e_core.gd", "--", f"--server=http://127.0.0.1:{e2e.PORT}"],
                             env={**os.environ, "HOME": str(work / "home"), "XDG_DATA_HOME": str(work / "home" / "share")}, capture_output=True, text=True, timeout=300)
    finally:
        server.shutdown()
    result = next((json.loads(l[len("E2E_GATE "):]) for l in run.stdout.splitlines() if l.startswith("E2E_GATE ")), None)
    errors = [l for l in (run.stdout + run.stderr).splitlines() if "SCRIPT ERROR" in l or "Invalid call" in l]
    ok = bool(result) and result["report"].get("mounted") is True and result["report"].get("broken") == "" and result["panel_in_tree"] \
        and result["heading_font"] and result["stone"] and result["letters"] and result["menu_swipe"] and result["menu_click"] and not errors
    print(json.dumps(result), "\nscript errors:", errors[:8])
    print("E2E INSTALLED", "PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
