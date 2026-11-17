#!/usr/bin/env python3
"""Run the service preview from the resources of the actual APK, with mocked admission and an isolated user directory.

This is a Linux Godot runtime loading Android-exported resources, not a physical Android device test.
"""
import argparse
import json
import os
import subprocess
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PROJECT = ROOT / "ports/godot-pyra"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apk", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("/tmp/ki-service-apk-qa"))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="ki-service-apk-") as temp:
        work = Path(temp)
        with zipfile.ZipFile(args.apk) as archive:
            assert archive.testzip() is None, "APK CRC mismatch"
            archive.extractall(work, [n for n in archive.namelist() if n.startswith("assets/")])
        assets = work / "assets"
        listing = [{"pck": "res://" + str(p.relative_to(assets)), "disk": str(p)}
                   for p in assets.rglob("*") if p.is_file() and p.name != "assets.sparsepck" and "_cl_" not in p.parts]
        listing.append({"pck": "res://tests/service_preview.gd", "disk": str(PROJECT / "tests/service_preview.gd")})
        sources = work / "files.json"
        sources.write_text(json.dumps(listing))
        pack = work / "apk.pck"
        subprocess.run(["godot", "--headless", "--path", str(PROJECT), "--script", "res://tools/pack_builder.gd", "--", str(sources), str(pack)], check=True, capture_output=True)
        env = {**os.environ, "XDG_DATA_HOME": str(work / "user"), "LIBGL_ALWAYS_SOFTWARE": "1"}
        run = subprocess.run(["godot", "--audio-driver", "Dummy", "--rendering-method", "gl_compatibility", "--main-pack", str(pack),
                              "--script", "res://tests/service_preview.gd", "--", "--qa-output=" + str(args.output.resolve())],
                             env=env, capture_output=True, text=True, timeout=120)
        text = run.stdout + run.stderr
        (args.output / "engine.txt").write_text(text)
        errors = [line for line in text.splitlines() if "SCRIPT ERROR:" in line or line.startswith("ERROR:")]
        result = json.loads((args.output / "results.json").read_text()) if (args.output / "results.json").exists() else {}
        passed = run.returncode == 0 and not errors and result.get("failed") == 0 and result.get("passed", 0) >= 21
        report = {"passed": passed, "exit_code": run.returncode, "engine_errors": errors, "checks": result, "physical_android": False}
        (args.output / "process.json").write_text(json.dumps(report, indent=2))
        print(json.dumps({"passed": passed, "engine_errors": errors, "checks": result.get("passed")}))
        return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
