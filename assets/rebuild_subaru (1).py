#!/usr/bin/env python3
"""
Reassemble Subaru.STEP from the two uploaded binary parts.

Place this script next to:
  Subaru.STEP.part1
  Subaru.STEP.part2

Run:
  python rebuild_subaru.py

The output is checked against the original file size and SHA-256 hash.
"""
from pathlib import Path
import argparse
import hashlib
import sys

PART_FILES = ("Subaru.STEP.part1", "Subaru.STEP.part2")
EXPECTED_SIZE = 40118578
EXPECTED_SHA256 = "44874abfa563b5459fb28d17510cb165be01cb36c7e4f2594702efe501c33ade"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Rebuild the original Subaru.STEP file from its two parts."
    )
    parser.add_argument(
        "-o", "--output",
        default="Subaru.STEP",
        help="Output STEP filename (default: Subaru.STEP)",
    )
    args = parser.parse_args()

    folder = Path(__file__).resolve().parent
    parts = [folder / name for name in PART_FILES]
    missing = [path.name for path in parts if not path.is_file()]
    if missing:
        print("Missing file(s): " + ", ".join(missing), file=sys.stderr)
        print("Download both .part files and keep them next to this script.", file=sys.stderr)
        return 1

    output = Path(args.output)
    if not output.is_absolute():
        output = folder / output
    temporary = output.with_name(output.name + ".tmp")

    try:
        with temporary.open("wb") as destination:
            for part in parts:
                with part.open("rb") as source:
                    for block in iter(lambda: source.read(1024 * 1024), b""):
                        destination.write(block)

        actual_size = temporary.stat().st_size
        actual_hash = sha256_file(temporary)

        if actual_size != EXPECTED_SIZE or actual_hash != EXPECTED_SHA256:
            temporary.unlink(missing_ok=True)
            print("Rebuild verification FAILED. Output was not kept.", file=sys.stderr)
            print(f"Expected size: {EXPECTED_SIZE} bytes; got: {actual_size} bytes", file=sys.stderr)
            print(f"Expected SHA-256: {EXPECTED_SHA256}", file=sys.stderr)
            print(f"Actual SHA-256:   {actual_hash}", file=sys.stderr)
            return 2

        temporary.replace(output)
        print(f"Rebuilt successfully: {output.name}")
        print(f"Size:   {actual_size:,} bytes")
        print(f"SHA256: {actual_hash}")
        return 0
    except OSError as error:
        temporary.unlink(missing_ok=True)
        print(f"File error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
