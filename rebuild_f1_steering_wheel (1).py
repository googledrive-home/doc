#!/usr/bin/env python3
"""Rebuild the original Blender file from its numbered parts.

Keep every .partNN file in the same folder as this script, then run:
    python rebuild_f1_steering_wheel.py
"""
from pathlib import Path
import hashlib
import sys

HERE = Path(__file__).resolve().parent
PARTS = ['F1_steering_wheel.blend.part01', 'F1_steering_wheel.blend.part02', 'F1_steering_wheel.blend.part03', 'F1_steering_wheel.blend.part04', 'F1_steering_wheel.blend.part05']
EXPECTED_SIZE = 111376972
EXPECTED_SHA256 = "bbdd5c2676993fffa8e2ee7ce50a8b7bf0f28f9ea82205b73dee185898863113"
OUTPUT = HERE / "F1_steering_wheel.blend"

digest = hashlib.sha256()
written = 0
with OUTPUT.open("wb") as out:
    for name in PARTS:
        path = HERE / name
        if not path.is_file():
            sys.exit(f"Missing part: {name}")
        with path.open("rb") as part:
            while True:
                block = part.read(1024 * 1024)
                if not block:
                    break
                out.write(block)
                digest.update(block)
                written += len(block)

if written != EXPECTED_SIZE or digest.hexdigest() != EXPECTED_SHA256:
    OUTPUT.unlink(missing_ok=True)
    sys.exit("Rebuild failed integrity verification. Re-download all parts.")

print(f"Rebuilt {OUTPUT.name} ({written:,} bytes).")
print("SHA-256 verified; source data is byte-for-byte intact.")
