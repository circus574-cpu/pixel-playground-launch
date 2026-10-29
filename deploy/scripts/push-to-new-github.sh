#!/usr/bin/env bash
# KI LEGENDS — utworzenie NOWEGO repozytorium (np. prywatnego „ki-legends-vps”) z pełną historią,
# wszystkimi 89 gałęziami, odnośnikami PR i plikami LFS — BEZ dotykania obecnego repozytorium produkcyjnego.
#
# Wymagania: git >= 2.30, git-lfs (sudo apt install git-lfs), puste nowe repozytorium na GitHubie.
# Użycie:
#   ./push-to-new-github.sh  ŚCIEŻKA/ki-legends-github-all-branches.bundle  ŚCIEŻKA/git/lfs  ŚCIEŻKA/ki-legends-source  git@github.com:KONTO/ki-legends-vps.git
set -euo pipefail
BUNDLE="${1:?bundle}"; LFS_DIR="${2:?katalog git/lfs z paczki}"; SRC="${3:?katalog ki-legends-source z paczki}"; REMOTE="${4:?adres NOWEGO repozytorium}"
case "$REMOTE" in *pixel-playground-launch*) echo "To jest obecne repozytorium produkcyjne — przerwano."; exit 1 ;; esac
WORK="$(mktemp -d)/ki-legends-vps.git"

git clone --mirror "$BUNDLE" "$WORK"
cd "$WORK"
# Pliki LFS (1047 obiektów) z paczki do magazynu LFS nowego repozytorium
mkdir -p lfs/objects && cp -rn "$LFS_DIR/objects/." lfs/objects/
git remote set-url origin "$REMOTE"

# 1) Cała historia i wszystkie gałęzie, dokładnie jak na GitHubie (bez refs/pull — GitHub ich nie przyjmuje)
git push origin 'refs/heads/*:refs/heads/*' --tags
# Gałęzie widoczne tylko w Lovable i dawne PR-y jako zwykłe gałęzie archiwalne
git for-each-ref --format='%(refname)' refs/lovable refs/pull | while read -r ref; do
  name="archive/${ref#refs/}"; git push origin "$ref:refs/heads/$name"
done
git lfs push --all origin

# 2) Gałąź vps-migration = main + pliki wdrożeniowe (Dockerfile, compose, Caddy, kopie okładek)
TMP="$(mktemp -d)"; GIT_LFS_SKIP_SMUDGE=1 git clone -q "$WORK" "$TMP/wt" && cd "$TMP/wt"
git lfs install --local >/dev/null
git checkout -b vps-migration origin/main
for f in Dockerfile docker-compose.yml .dockerignore .env.example deploy; do cp -r "$SRC/$f" .; done
git add Dockerfile docker-compose.yml .dockerignore .env.example deploy
git -c user.name="KI Legends migration" -c user.email="migration@invalid" commit -m "VPS: Dockerfile, Docker Compose, Caddy, lokalne kopie okładek"
git remote set-url origin "$REMOTE"
git push origin vps-migration
echo "Gotowe: $REMOTE — gałąź main (bez zmian) i vps-migration (do wdrożenia w Coolify)."
