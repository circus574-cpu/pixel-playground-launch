#!/usr/bin/env python3
"""Export a debug APK without committing SDK locations, signing keys or credentials."""
import argparse
import hashlib
import json
import os
import pathlib
import shutil
import subprocess
import tempfile

root = pathlib.Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument("--sdk", default=os.environ.get("ANDROID_HOME", os.environ.get("ANDROID_SDK_ROOT", "")))
parser.add_argument("--java", default=os.environ.get("JAVA_HOME", ""))
parser.add_argument("--godot", default="godot")
parser.add_argument("--debug-keystore", default=str(pathlib.Path.home() / ".local/share/ki-legends-godot/debug.keystore"))
parser.add_argument("--output", default=str(root / "ports/godot-pyra/builds/ki-legends-pyra-debug.apk"))
args = parser.parse_args()
sdk = pathlib.Path(args.sdk).resolve()
java = pathlib.Path(args.java).resolve() if args.java else pathlib.Path(shutil.which("java")).resolve().parents[1]
tools = sorted((p for p in (sdk / "build-tools").glob("*") if (p / "apksigner").is_file()), key=lambda p: tuple(int(n) for n in p.name.split(".") if n.isdigit()))
if not (sdk / "platform-tools/adb").is_file() or not tools:
    parser.error("Android SDK with platform-tools and build-tools (36.0.0 recommended for Godot 4.6) is required; pass --sdk or ANDROID_HOME.")
if not (java / "bin/keytool").is_file():
    parser.error("Pass a JDK with keytool using --java or JAVA_HOME.")
out = pathlib.Path(args.output).resolve()
out.parent.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(prefix="ki-godot-export-") as directory:
    temp = pathlib.Path(directory)
    key = pathlib.Path(args.debug_keystore).resolve()
    key.parent.mkdir(parents=True, exist_ok=True)
    if not key.exists():
        subprocess.run([str(java / "bin/keytool"), "-genkeypair", "-keystore", str(key), "-storepass", "android", "-alias", "androiddebugkey", "-keypass", "android", "-dname", "CN=KI Legends Godot Prototype,O=Local Test,C=PL", "-keyalg", "RSA", "-keysize", "2048", "-validity", "10000"], check=True)
        key.chmod(0o600)
    config = temp / "config/godot"
    config.mkdir(parents=True)
    values = {"export/android/android_sdk_path": str(sdk), "export/android/java_sdk_path": str(java), "export/android/debug_keystore": str(key), "export/android/debug_keystore_user": "androiddebugkey", "export/android/debug_keystore_pass": "android"}
    settings = '[gd_resource type="EditorSettings" format=3]\n\n[resource]\n' + "\n".join(k + " = " + json.dumps(v) for k, v in values.items()) + "\n"
    (config / "editor_settings-4.6.tres").write_text(settings)
    env = {**os.environ, "XDG_CONFIG_HOME": str(temp / "config"), "JAVA_HOME": str(java), "ANDROID_HOME": str(sdk)}
    subprocess.run([args.godot, "--headless", "--path", str(root / "ports/godot-pyra"), "--export-debug", "Android", str(out)], env=env, check=True)
    subprocess.run([str(tools[-1] / "apksigner"), "verify", "--verbose", str(out)], env=env, check=True)
print(json.dumps({"apk": str(out), "bytes": out.stat().st_size, "sha256": hashlib.sha256(out.read_bytes()).hexdigest(), "signing": "Local debug certificate, retained outside Git. Not a Play Store release."}))
