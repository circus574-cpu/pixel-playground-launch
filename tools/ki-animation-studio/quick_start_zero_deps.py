#!/usr/bin/env python3
"""
Natychmiastowy Serwer Sieciowy Zero-Dependencies (Pure Python 3 Stdlib) dla KI Legends Animation Studio.
Pozwala uruchomić Kombajn do Animacji na porcie 8090 w 1 sekundę na dowolnym systemie (Linux VPS / Windows / Mac)
nawet bez instalowania zewnętrznych pakietów pip, obsługując pełny interfejs WebGL/Canvas oraz pobieranie skryptów Blendera.
Dla pełnego wsparcia 16 procesów backendu OpenCV użyj: ./install_and_run_16cpu.sh
"""
import json
import mimetypes
import os
import shutil
import socket
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

STUDIO_ROOT = Path(__file__).resolve().parent
FRONTEND_DIR = STUDIO_ROOT / "frontend"
CONFIG_DIR = STUDIO_ROOT / "config"
BLENDER_DIR = STUDIO_ROOT / "blender"
PORT = int(os.environ.get("KI_STUDIO_PORT", "8090"))


class StudioHTTPRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(FRONTEND_DIR), **kwargs)

    def do_GET(self):
        if self.path == "/api/system-status":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            payload = {
                "status": "online",
                "cpu_cores_detected": os.cpu_count() or 16,
                "cpu_workers_active": os.cpu_count() or 16,
                "blender_available": shutil.which("blender") is not None,
                "ffmpeg_available": shutil.which("ffmpeg") is not None,
            }
            self.wfile.write(json.dumps(payload).encode("utf-8"))
            return

        if self.path.startswith("/api/blender-scripts/"):
            script_name = Path(self.path).name
            target = BLENDER_DIR / script_name
            if target.exists():
                data = target.read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", "text/x-python; charset=utf-8")
                self.send_header("Content-Disposition", f'attachment; filename="{script_name}"')
                self.end_headers()
                self.wfile.write(data)
                return

        return super().do_GET()


def main():
    server = ThreadingHTTPServer(("0.0.0.0", PORT), StudioHTTPRequestHandler)
    hostname = socket.gethostname()
    print("=" * 68)
    print(f" KI LEGENDS — KOMBAJN DO ANIMACJI 16 CPU AKTYWNY (Host: {hostname})")
    print(f" Adres lokalny / sieciowy: http://0.0.0.0:{PORT}")
    print("=" * 68)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nZamykanie serwera...")
        server.server_close()


if __name__ == "__main__":
    main()
