#!/usr/bin/env python3
"""One-shot pre-submit check for game sessions. Mirrors the CI gate (path guard + strict game check).

Usage: python3 tools/preflight.py
Commit your new game folder first, then run this. Exit 0 (PREFLIGHT OK) means safe to submit.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def run(*cmd: str) -> int:
    return subprocess.run(cmd, cwd=ROOT).returncode


def main() -> int:
    subprocess.run(["git", "fetch", "origin", "main"], cwd=ROOT, capture_output=True)
    base = "origin/main"
    have_base = subprocess.run(["git", "rev-parse", "--verify", base], cwd=ROOT, capture_output=True).returncode == 0

    status = subprocess.run(["git", "status", "--porcelain"], cwd=ROOT, capture_output=True, text=True).stdout
    dirty = [ln for ln in status.splitlines() if ln.strip()]
    if dirty:
        print("NOTE: uncommitted changes found. Commit them before submitting; the path guard compares commits.")
        for ln in dirty:
            print("   " + ln)

    rc = 0
    if have_base:
        rc |= run(sys.executable, "tools/path_guard.py", "--base", base)
    else:
        print("WARN: origin/main not reachable; skipping path guard (CI will enforce it).")
    rc |= run(sys.executable, "tools/check_games.py", "--strict")

    print("PREFLIGHT OK: submit now." if rc == 0 else "PREFLIGHT FAILED: fix the errors above, re-commit, and re-run.")
    return 0 if rc == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
