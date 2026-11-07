#!/usr/bin/env bash
# ==============================================================================
# Wrapper uruchomieniowy Blendera w trybie Headless na 16 vCPU (Linux VPS)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
THREADS="${KI_CPU_THREADS:-16}"
BLEND_FILE="${1:-}"
OUT_DIR="${2:-./renders/hero-custom}"
ACTOR_ID="${3:-hero-custom}"

if ! command -v blender >/dev/null 2>&1; then
  echo "[BŁĄD] Nie znaleziono programu Blender. Zainstaluj go komendą: sudo apt update && sudo apt install -y blender"
  exit 1
fi

if [ -z "$BLEND_FILE" ]; then
  echo "Użycie: ./run_blender_16cpu.sh <plik.blend> [katalog_wyjsciowy] [id_aktora]"
  echo "Uruchamiam render testowy w czystej scenie na $THREADS wątkach CPU..."
  blender -b -t "$THREADS" -P "$SCRIPT_DIR/blender_headless_turntable.py" -- --out "$OUT_DIR" --actor "$ACTOR_ID" --threads "$THREADS"
else
  echo "Uruchamiam render pliku $BLEND_FILE na $THREADS wątkach CPU..."
  blender -b "$BLEND_FILE" -t "$THREADS" -P "$SCRIPT_DIR/blender_headless_turntable.py" -- --out "$OUT_DIR" --actor "$ACTOR_ID" --threads "$THREADS"
fi
