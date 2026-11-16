#!/usr/bin/env python3
"""End-to-end test of in-game updates of the game's CODE (scripts/boot.gd), nothing on production, no database needed.

It exports the real Android base (the same filters as the APK, with compiled scripts and remaps), serves a fake manifest and fake
core packs over HTTP, and launches the base several times like a player restarting the app. `story.gd` carries a constant
(REWARD_GOLD = 40 in the APK) that the test changes in the downloaded core, so the printed value shows which code is running:

  1 the server offers no core                          -> APK's own code (40)
  2 the server offers the real, full core of this repo -> downloaded, mounted, the whole game still compiles (40)
  3 the server offers a core with REWARD_GOLD = 77     -> downloaded, NEW code runs in the same app (77)
  4 the server is unreachable                          -> the cached core runs (77)
  5 the server offers a core that does not compile     -> detected at once, put on the bad list
  6 the same broken core is offered again              -> not taken; the APK's own code runs (40)
  7 the server goes back to the good core              -> downloaded again (77)
  8-9 offline launches that never reach the city       -> counted, the core keeps running (77)
  10 the next such launch                              -> the unproven core is given up (40)
  11 a core that adds a new script loaded by path      -> works (58); the policy for files that did not exist in the APK

  python3 scripts/godot/e2e_core.py
"""
import http.server
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import threading
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
PROJECT = REPO / "ports" / "godot-pyra"
PORT = 7421
failures = 0


def load_builder():
    spec = importlib.util.spec_from_file_location("build_packs", REPO / "scripts" / "godot" / "build_packs.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def check(ok: bool, name: str, details="") -> None:
    global failures
    print(("PASS " if ok else "FAIL ") + name + ("" if ok else f"  {details}"))
    if not ok:
        failures += 1


def build_pack(builder, work: Path, name: str, story_text: str | None, extra: dict[str, str] | None = None) -> dict:
    """The real core of this repo, with story.gd optionally replaced by `story_text` and new files added ({res path: text})."""
    listing = builder.core_listing(work / name)
    for res_path, text in (extra or {}).items():
        added = work / f"{name}-{Path(res_path).name}"
        added.write_text(text)
        listing.append({"pck": res_path, "disk": str(added)})
    if story_text is not None:
        replaced = work / f"{name}-story.gd"
        replaced.write_text(story_text)
        for entry in listing:
            if entry["pck"] == "res://scripts/story.gd":
                entry["disk"] = str(replaced)
    list_path = work / f"{name}.json"
    list_path.write_text(json.dumps(listing))
    target = work / f"{name}.pck"
    subprocess.run(["godot", "--headless", "--path", str(PROJECT), "--script", "res://tools/pack_builder.gd", "--", str(list_path), str(target)],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    digest = builder.sha256(target)
    final = work / f"core-c{builder.client_code()}-{digest[:12]}.pck"
    target.replace(final)
    return {"file": final.name, "bytes": final.stat().st_size, "sha256": digest, "files": len(listing)}


class Fake(http.server.BaseHTTPRequestHandler):
    offer: dict | None = None        # pack entry the manifest carries, or None
    files: dict[str, Path] = {}
    key = "core-c100"

    def log_message(self, *_args):
        pass

    def do_GET(self):
        if self.path.startswith("/ws/godot/manifest"):
            packs = {} if Fake.offer is None else {Fake.key: Fake.offer}
            body = json.dumps({"manifest": {"format": "ki-godot-content-1", "version": "e2e", "packs": packs, "lands": {}},
                               "packBase": "/ws/godot/pack/e2e/", "news": "", "minClientCode": 1}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        name = self.path.rsplit("/", 1)[-1]
        if self.path.startswith("/ws/godot/pack/e2e/") and name in Fake.files:
            body = Fake.files[name].read_bytes()
            self.send_response(200)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self.send_response(404)
        self.end_headers()


def launch(base: Path, home: Path, port: int) -> dict:
    run = subprocess.run(
        ["godot", "--headless", "--main-pack", str(base), "--script", "res://e2e_core.gd", "--", f"--server=http://127.0.0.1:{port}"],
        env={**os.environ, "HOME": str(home), "XDG_DATA_HOME": str(home / "share")}, capture_output=True, text=True, timeout=300)
    for line in run.stdout.splitlines():
        if line.startswith("E2E_CORE "):
            return json.loads(line[len("E2E_CORE "):])
    print(run.stdout[-1500:], run.stderr[-800:])
    return {"report": {}, "reward": None, "state": {}, "timeout": True}


def main() -> int:
    builder = load_builder()
    work = Path("/tmp/ki-e2e-core")
    shutil.rmtree(work, ignore_errors=True)
    work.mkdir(parents=True)
    home = work / "home"
    home.mkdir()
    story_text = (PROJECT / "scripts" / "story.gd").read_text()
    assert "const REWARD_GOLD := 40" in story_text
    print("building packs…")
    full = build_pack(builder, work, "full", None)
    new = build_pack(builder, work, "new", story_text.replace("const REWARD_GOLD := 40", "const REWARD_GOLD := 77"))
    broken = build_pack(builder, work, "broken", story_text + "\nfunc broken_on_purpose(:\n\tpass\n")
    # a script that did not exist when the APK was built, loaded by path (a new class_name would be invisible to the APK)
    newfile = build_pack(
        builder, work, "newfile",
        story_text.replace("const REWARD_GOLD := 40", 'const Extra := preload("res://scripts/zz_newfile.gd")\nconst REWARD_GOLD := 55 + Extra.BONUS'),
        {"res://scripts/zz_newfile.gd": "extends RefCounted\nconst BONUS := 3\n"})
    Fake.files = {e["file"]: work / e["file"] for e in (full, new, broken, newfile)}
    print(f"core pack of this repo: {full['bytes'] / 1e6:.2f} MB, {full['files']} entries")

    shutil.copyfile(PROJECT / "tests" / "e2e_core.gd", PROJECT / "e2e_core.gd")
    try:
        subprocess.run(["godot", "--headless", "--path", str(PROJECT), "--export-pack", "Android", str(work / "base.pck")],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    finally:
        (PROJECT / "e2e_core.gd").unlink(missing_ok=True)
        (PROJECT / "e2e_core.gd.uid").unlink(missing_ok=True)
    base = work / "base.pck"
    print(f"base pck: {base.stat().st_size / 1e6:.1f} MB")

    server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Fake)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        Fake.offer = None
        r = launch(base, home, PORT)
        check(r["report"].get("reached") is True and r["reward"] == 40 and r["report"].get("core") == "" and not r["timeout"], "1 no core offered: the APK's own code runs", r)

        Fake.offer = full
        r = launch(base, home, PORT)
        check(r["report"].get("downloaded") is True and r["report"].get("mounted") is True and r["report"].get("broken") == "" and r["reward"] == 40 and r["state"].get("file") == full["file"],
              "2 the full core of this repo downloads, mounts and every script still compiles", r)

        Fake.offer = new
        r = launch(base, home, PORT)
        check(r["report"].get("downloaded") is True and r["report"].get("broken") == "" and r["reward"] == 77 and r["state"].get("file") == new["file"],
              "3 a newer core changes the code of the same app (REWARD_GOLD 40 -> 77)", r)

        r = launch(base, home, 1)   # nothing listens on port 1
        check(r["report"].get("reached") is False and r["report"].get("downloaded") is False and r["reward"] == 77, "4 without the server the cached core runs", r)

        Fake.offer = broken
        r = launch(base, home, PORT)
        check(r["report"].get("downloaded") is True and r["report"].get("broken", "") != "" and broken["file"] in r["state"].get("bad", []),
              "5 a core that does not compile is detected at once and put on the bad list", r)

        r = launch(base, home, PORT)
        check(r["report"].get("downloaded") is False and r["report"].get("core") == "" and r["reward"] == 40,
              "6 the same broken core is not taken again: the APK's own code runs", r)

        Fake.offer = new
        r = launch(base, home, PORT)
        check(r["report"].get("downloaded") is True and r["reward"] == 77 and r["state"].get("file") == new["file"], "7 the server goes back to the good core: it is taken again", r)

        # the attempts counter: launch 7 was the first launch of this file; three more offline launches that never reach a city
        rewards = []
        for _ in range(2):
            r = launch(base, home, 1)
            rewards.append(r["reward"])
        check(rewards == [77, 77], "8-9 an unproven core keeps running while its attempts are under the limit", rewards)
        r = launch(base, home, 1)
        check(r["report"].get("gave_up") == new["file"] and r["reward"] == 40 and new["file"] in r["state"].get("bad", []),
              "10 an unproven core that never reached the first city is given up: the APK's own code runs", r)

        Fake.offer = newfile
        r = launch(base, home, PORT)
        check(r["report"].get("downloaded") is True and r["report"].get("broken") == "" and r["reward"] == 58,
              "11 a core can add a NEW script when it is loaded by path (REWARD_GOLD = 55 + 3 from the new file)", r)
    finally:
        server.shutdown()
    print(f"E2E CORE DONE failures={failures}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
