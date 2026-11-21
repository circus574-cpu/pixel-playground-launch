#!/usr/bin/env python3
"""Zbuduj kompletny ZIP 10 nowych bossów bez dodatkowych bibliotek."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib
import json

root = Path(__file__).resolve().parent
images = sorted((root / "images").glob("*.png"))
assert len(images) == 11, f"Oczekiwano 11 PNG (10 bossów + atlas), otrzymano {len(images)}"
meta = json.loads((root / "bosses_design.json").read_text(encoding="utf-8"))
assert len(meta["bosses"]) == 10, "Nieprawidłowa liczba bossów"
for boss in meta["bosses"]:
    p = root / "images" / boss["image"]
    assert p.exists(), f"Brak grafiki: {p.name}"
    expected = boss.get("file_sha256")
    if expected:
        actual = hashlib.sha256(p.read_bytes()).hexdigest()
        assert actual == expected, f"Błędna suma SHA256: {p.name}"

files = [root / f for f in ("README.md", "NOWI_BOSSOWIE_DOKUMENTACJA.md", "CODEX_IMPLEMENTACJA.md", "bosses_design.json")] + images
archive = root / "KI_LEGENDS_10_BOSSOW_3_WIDOKI_KOMPLET.zip"
with ZipFile(archive, "w", compression=ZIP_DEFLATED, compresslevel=6) as z:
    for f in files:
        z.write(f, f.relative_to(root))
assert archive.is_file() and archive.stat().st_size > 1000000
print(f"Utworzono: {archive} ({archive.stat().st_size / 1048576:.2f} MiB), pliki: {len(files)}")
