# Zmiany — 2026-11-07

## Narzędzia

### 1. Lokalny asystent AI na CPU (skrypt instalacyjny)

- Prośba właściciela: lokalny asystent programisty na maszynie 16 rdzeni / 32 GB RAM bez GPU i bez kosztów.
- Dodano `scripts/ops/local-ai-dev-install.sh` (llama.cpp, model Qwen3-Coder-30B-A3B Q4_K_M, usługa `llama-server` tylko na `127.0.0.1`, Qwen Code dla użytkownika `aidev`) oraz sekcję w [Architektura i testy](../../ARCHITEKTURA-I-TESTY.md#lokalny-asystent-ai-na-cpu--07112026).
- Sprawdzono: składnię skryptu, tryb `DRY_RUN` i funkcję `smoke` na atrapie serwera; istnienie repozytorium modelu, pliku `Q4_K_M` oraz pakietu `@qwen-code/qwen-code`.
- Nie sprawdzono: instalacji na docelowym serwerze, budowy llama.cpp, pobrania modelu ani rzeczywistej prędkości.
