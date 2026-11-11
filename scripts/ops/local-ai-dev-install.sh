#!/usr/bin/env bash
# Lokalny asystent AI do kodu na maszynie CPU (bez GPU, bez opłat): llama.cpp + model GGUF + Qwen Code.
#
#   sudo bash scripts/ops/local-ai-dev-install.sh            # instalacja
#   DRY_RUN=1 bash scripts/ops/local-ai-dev-install.sh       # tylko wypisuje kroki, nic nie zmienia
#   sudo bash scripts/ops/local-ai-dev-install.sh smoke      # test działającej usługi (czas generowania)
#
# Zakładany system: Debian/Ubuntu, 16 rdzeni, 32 GB RAM, ok. 40 GB wolnego miejsca. Serwer modelu słucha tylko na
# 127.0.0.1 (dostęp z zewnątrz wyłącznie tunelem SSH). Skrypt nie dotyka usług gry, bazy ani sekretów.
# Opis, ograniczenia i zasady pracy agenta: docs/ARCHITEKTURA-I-TESTY.md (sekcja „Lokalny asystent AI na CPU”).
set -euo pipefail

AI_USER="${AI_USER:-aidev}"
AI_HOME="${AI_HOME:-/home/${AI_USER}}"
LLAMA_DIR="${LLAMA_DIR:-/opt/llama.cpp}"
LLAMA_REF="${LLAMA_REF:-master}" # po pierwszej udanej instalacji przypnij do konkretnego tagu/commita
MODEL_DIR="${MODEL_DIR:-/srv/ai-models}"
MODEL_REPO="${MODEL_REPO:-unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF}"
MODEL_FILE="${MODEL_FILE:-Qwen3-Coder-30B-A3B-Instruct-Q4_K_M.gguf}"
MODEL_SHA256="${MODEL_SHA256:-}" # opcjonalnie: suma kontrolna z karty modelu
CTX="${CTX:-32768}"
THREADS="${THREADS:-$(nproc)}"
PORT="${PORT:-8080}"
SERVICE="${SERVICE:-llama-server}"
DRY_RUN="${DRY_RUN:-0}"

say() { printf '\n== %s\n' "$*"; }
run() {
  if [ "$DRY_RUN" = "1" ]; then printf '[dry-run] %s\n' "$*"; else "$@"; fi
}

smoke() {
  say "Test usługi ${SERVICE} na 127.0.0.1:${PORT}"
  curl -fsS "http://127.0.0.1:${PORT}/v1/models" >/dev/null || { echo "Serwer nie odpowiada (journalctl -u ${SERVICE})"; exit 1; }
  curl -fsS "http://127.0.0.1:${PORT}/v1/chat/completions" \
    -H 'Content-Type: application/json' \
    -d '{"model":"local","max_tokens":64,"messages":[{"role":"user","content":"Napisz w TypeScript funkcję clamp(n,min,max)."}]}' |
    python3 -c 'import json,sys; d=json.load(sys.stdin); t=d.get("timings",{}); print(d["choices"][0]["message"]["content"][:400]); print("generowanie: %.1f tok/s, wczytywanie promptu: %.1f tok/s" % (t.get("predicted_per_second",0), t.get("prompt_per_second",0)))'
}

if [ "${1:-}" = "smoke" ]; then smoke; exit 0; fi

if [ "$DRY_RUN" != "1" ]; then
  [ "$(id -u)" -eq 0 ] || { echo "Uruchom jako root (sudo)."; exit 1; }
  command -v apt-get >/dev/null || { echo "Skrypt zakłada Debian/Ubuntu (apt-get)."; exit 1; }
  mem_kb="$(awk '/MemTotal/ {print $2}' /proc/meminfo)"
  [ "$mem_kb" -ge 28000000 ] || { echo "Za mało RAM (< 28 GB). Wybierz mniejszy model (MODEL_REPO/MODEL_FILE)."; exit 1; }
  free_kb="$(df --output=avail -k "$(dirname "$MODEL_DIR")" | tail -1)"
  [ "$free_kb" -ge 30000000 ] || { echo "Za mało miejsca (< 30 GB wolnego w $(dirname "$MODEL_DIR"))."; exit 1; }
fi

say "1/6 Pakiety systemowe"
run apt-get update
run apt-get install -y build-essential cmake git curl ca-certificates libcurl4-openssl-dev pkg-config ccache python3 nodejs npm

say "2/6 Użytkownik ${AI_USER} (bez sudo, bez dostępu do usług gry)"
if ! id "$AI_USER" >/dev/null 2>&1; then run useradd --create-home --shell /bin/bash "$AI_USER"; fi

say "3/6 Budowa llama.cpp (${LLAMA_REF}) z optymalizacją pod ten procesor"
if [ ! -d "$LLAMA_DIR/.git" ]; then run git clone https://github.com/ggml-org/llama.cpp "$LLAMA_DIR"; fi
run git -C "$LLAMA_DIR" fetch --tags origin
run git -C "$LLAMA_DIR" checkout "$LLAMA_REF"
run cmake -S "$LLAMA_DIR" -B "$LLAMA_DIR/build" -DCMAKE_BUILD_TYPE=Release -DGGML_NATIVE=ON -DLLAMA_CURL=ON
run cmake --build "$LLAMA_DIR/build" --config Release -j "$(nproc)" --target llama-server llama-cli

say "4/6 Model ${MODEL_REPO}/${MODEL_FILE} (ok. 18 GB, wznawialne pobieranie)"
run mkdir -p "$MODEL_DIR"
run curl -fL -C - -o "$MODEL_DIR/$MODEL_FILE" "https://huggingface.co/${MODEL_REPO}/resolve/main/${MODEL_FILE}"
if [ -n "$MODEL_SHA256" ]; then
  run bash -c "echo '${MODEL_SHA256}  ${MODEL_DIR}/${MODEL_FILE}' | sha256sum -c -"
else
  echo "Uwaga: MODEL_SHA256 nie ustawiono, suma kontrolna pliku nie została sprawdzona."
fi
run chmod 0644 "$MODEL_DIR/$MODEL_FILE"

say "5/6 Usługa systemowa ${SERVICE} (tylko 127.0.0.1:${PORT}, limit pamięci 28 GB, niski priorytet)"
UNIT="/etc/systemd/system/${SERVICE}.service"
unit_text="[Unit]
Description=llama.cpp - lokalny asystent AI do kodu (CPU)
After=network.target

[Service]
User=${AI_USER}
ExecStart=${LLAMA_DIR}/build/bin/llama-server -m ${MODEL_DIR}/${MODEL_FILE} --host 127.0.0.1 --port ${PORT} -c ${CTX} -t ${THREADS} --parallel 1 --jinja --alias local
Restart=on-failure
RestartSec=5
Nice=5
MemoryMax=28G
LimitNOFILE=65536
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
"
if [ "$DRY_RUN" = "1" ]; then printf '[dry-run] zapis %s:\n%s\n' "$UNIT" "$unit_text"; else printf '%s' "$unit_text" >"$UNIT"; fi
run systemctl daemon-reload
run systemctl enable --now "$SERVICE"

say "6/6 Qwen Code dla ${AI_USER} (kieruje na lokalny serwer, bez kluczy zewnętrznych)"
if [ "$DRY_RUN" != "1" ] && [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  echo "Węzeł Node.js jest za stary (< 20). Zainstaluj Node 20+ (np. z nodejs.org lub NodeSource) i ponów krok 6:"
  echo "  npm install -g @qwen-code/qwen-code"
else
  run npm install -g @qwen-code/qwen-code
fi
env_text="# Lokalny model (llama.cpp). Klucz jest atrapą - serwer słucha tylko na 127.0.0.1.
export OPENAI_BASE_URL=http://127.0.0.1:${PORT}/v1
export OPENAI_API_KEY=local
export OPENAI_MODEL=local
"
if [ "$DRY_RUN" = "1" ]; then printf '[dry-run] zapis %s/.ai-dev-env:\n%s\n' "$AI_HOME" "$env_text"; else
  printf '%s' "$env_text" >"$AI_HOME/.ai-dev-env"; chown "$AI_USER":"$AI_USER" "$AI_HOME/.ai-dev-env"
  grep -q 'ai-dev-env' "$AI_HOME/.bashrc" 2>/dev/null || echo '[ -f ~/.ai-dev-env ] && . ~/.ai-dev-env' >>"$AI_HOME/.bashrc"
fi

cat <<TXT

Gotowe. Dalej:
  1. Test:    sudo bash $0 smoke
  2. Praca:   sudo -iu ${AI_USER}, potem: git clone <repo> i: cd <repo> && qwen
  3. Z zewnątrz (tunel):  ssh -L ${PORT}:127.0.0.1:${PORT} <użytkownik>@<serwer>
Zasady dla agenta (AGENTS.md): osobny token GitHub tylko do tego repo, zmiany przez gałęzie i PR, bez scalania,
bez publikacji, bez sekretów produkcji i bez sterowania podem GPU.
TXT
