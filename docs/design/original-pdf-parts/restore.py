#!/usr/bin/env python3
"""Reconstruct original Ki Legends design PDF from committed binary fragments."""
from pathlib import Path
import hashlib

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT.parent / "Ki_Legends_Dokument_Projektowy_Rasy_i_Etapy_Produkcji.pdf"
EXPECTED_SHA256 = "be58d9df4fb49d19b11a66d47a1a3fc3fbbf5acc9c11ddc5cf76213f6be15734"
EXPECTED_BYTES = 5343097

pieces = [ROOT / f"part-{i:02}.bin" for i in range(1, 13)]
missing = [str(x) for x in pieces if not x.is_file()]
if missing:
    raise SystemExit(f"Missing PDF parts: {missing}")

h = hashlib.sha256()
size = 0
for file in pieces:
    data = file.read_bytes()
    h.update(data)
    size += len(data)
if size != EXPECTED_BYTES or h.hexdigest() != EXPECTED_SHA256:
    raise SystemExit(f"Original PDF integrity failed: bytes={size}, sha256={h.hexdigest()}")

if OUTPUT.exists():
    if hashlib.sha256(OUTPUT.read_bytes()).hexdigest() != EXPECTED_SHA256:
        raise SystemExit(f"Refusing to overwrite different existing file: {OUTPUT}")
    print(f"Already verified: {OUTPUT}")
else:
    with OUTPUT.open("xb") as dest:
        for file in pieces:
            dest.write(file.read_bytes())
    print(f"Restored: {OUTPUT}")
print(f"SHA-256: {EXPECTED_SHA256}; bytes: {size}")
