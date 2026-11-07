#!/usr/bin/env bash
# ==============================================================================
# KI LEGENDS — KOMBAJN DO ANIMACJI 16 CPU (AUTOMATYCZNY INSTALATOR I STARTER VPS)
# Przeznaczony dla serwera Linux (Ubuntu / Debian) 16 vCPU / 32 GB RAM
# ==============================================================================
set -euo pipefail

STUDIO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${KI_STUDIO_PORT:-8090}"
WORKERS="${KI_UVICORN_WORKERS:-2}"

echo "=================================================================="
echo "  KI LEGENDS — KOMBAJN DO ANIMACJI & KOORDYNACJI (16 vCPU / 32GB)"
echo "=================================================================="

# 1. Instalacja pakietów systemowych (Python3, FFmpeg, biblioteki OpenCV, opcjonalnie Blender)
if command -v apt-get >/dev/null 2>&1; then
  echo "[1/5] Sprawdzanie pakietów systemowych (python3-venv, ffmpeg, libgl1)..."
  sudo apt-get update -y
  sudo apt-get install -y python3 python3-venv python3-pip ffmpeg libgl1 libglib2.0-0 curl
fi

# 2. Tworzenie izolowanego środowiska wirtualnego Python (.venv)
echo "[2/5] Konfiguracja środowiska wirtualnego Python w $STUDIO_DIR/.venv..."
cd "$STUDIO_DIR"
if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# 3. Odblokowanie portu w zaporze sieciowej (UFW), aby działało z telefonu i PC
if command -v ufw >/dev/null 2>&1; then
  echo "[3/5] Otwieranie portu $PORT/tcp w zaporze sieciowej..."
  sudo ufw allow "${PORT}/tcp" >/dev/null 2>&1 || true
fi

# 4. Wykrycie publicznego adresu IP serwera VPS
PUBLIC_IP="$(curl -s --max-time 4 ifconfig.me || hostname -I | awk '{print $1}')"

echo "=================================================================="
echo " ✅ INSTALACJA ZAKOŃCZONA SUKCESEM!"
echo " 🌐 Otwórz w przeglądarce (na telefonie lub komputerze):"
echo "    👉 http://${PUBLIC_IP}:${PORT}"
echo "=================================================================="

# 5. Uruchomienie serwera produkcyjnego z obsługą sieci 0.0.0.0
export OMP_NUM_THREADS=16
export OPENBLAS_NUM_THREADS=16
export MKL_NUM_THREADS=16

exec python3 -m uvicorn backend.server:app --host 0.0.0.0 --port "$PORT" --workers "$WORKERS"
