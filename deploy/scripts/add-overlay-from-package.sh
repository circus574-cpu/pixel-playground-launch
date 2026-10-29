#!/usr/bin/env bash
# KI LEGENDS — dołożenie dwóch obrazów (okładka strony głównej i tło /test) do checkoutu tej gałęzi
# z ZWERYFIKOWANEGO pakietu KI-LEGENDS-VPS-pakiet.zip. Bez sieci, bez zmian kodu gry.
# Użycie (z katalogu głównego repozytorium):
#   deploy/scripts/add-overlay-from-package.sh /ścieżka/KI-LEGENDS-VPS-MIGRACJA/ki-legends-source
# Potem: git add deploy/overlay/public && git commit -m "deploy: overlay images" && git push
set -euo pipefail
SRC="${1:?Podaj katalog ki-legends-source z rozpakowanego pakietu}"
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SUMS="$ROOT/deploy/overlay/SHA256SUMS"
DEST="$ROOT/deploy/overlay/public"
test -f "$SUMS" || { echo "Brak $SUMS — uruchom w checkoutcie gałęzi migration/aruba-staging-2026-10-28" >&2; exit 1; }
( cd "$SRC/deploy/overlay/public" && sha256sum -c "$SUMS" )
while read -r _ rel; do
  mkdir -p "$DEST/$(dirname "$rel")"
  install -m 0644 "$SRC/deploy/overlay/public/$rel" "$DEST/$rel"
done < "$SUMS"
( cd "$DEST" && sha256sum -c "$SUMS" )
echo "OK: obrazy w $DEST, sumy zgodne z deploy/overlay/SHA256SUMS"
