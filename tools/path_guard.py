#!/usr/bin/env python3
"""Rejects game PRs that change anything except ONE brand-new games/<NNN-slug>/ folder.

Usage: python3 tools/path_guard.py [--base origin/main] [--head HEAD]
Game sessions may only ADD files inside a single new folder: index.html, game.json, optional *.js / *.css.
Edits to tools, workflows, AGENTS.md, the launcher, registry.js or other games are refused.
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GAME_FILE_RE = re.compile(r"^games/(\d{3}-[a-z0-9]+(?:-[a-z0-9]+)*)/(index\.html|game\.json|[a-z0-9][a-z0-9_-]{0,40}\.(?:js|css))$")
MAX_FILE_BYTES = 1_500_000


def git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, check=True).stdout


def main() -> int:
    ap = argparse.ArgumentParser(description="Reject changes outside one new game folder.")
    ap.add_argument("--base", default="origin/main")
    ap.add_argument("--head", default="HEAD")
    args = ap.parse_args()

    try:
        out = git("diff", "--name-status", "--no-renames", f"{args.base}...{args.head}")
        base_tree = set(git("ls-tree", "-d", "--name-only", f"{args.base}:games").split())
    except subprocess.CalledProcessError as exc:
        print(f"PATH GUARD ERROR: cannot diff {args.base}...{args.head}: {exc.stderr.strip()}")
        return 2

    errors: list[str] = []
    folders: dict[str, set[str]] = {}
    for raw in out.splitlines():
        status, _, path = raw.partition("\t")
        if status != "A":
            errors.append(f"{path}: status '{status}' not allowed (game sessions may only ADD files in their own new folder).")
            continue
        m = GAME_FILE_RE.match(path)
        if not m:
            errors.append(f"{path}: outside the allowed paths (games/<NNN-slug>/index.html, game.json, *.js, *.css). "
                          "registry.js is generated automatically; never edit it.")
            continue
        folder, name = m.group(1), m.group(2)
        if folder in base_tree:
            errors.append(f"{path}: games/{folder}/ already exists on main; create a NEW folder with your assigned id.")
            continue
        folders.setdefault(folder, set()).add(name)
        try:
            size = int(git("cat-file", "-s", f"{args.head}:{path}").strip())
        except (subprocess.CalledProcessError, ValueError):
            size = 0
        if size > MAX_FILE_BYTES:
            errors.append(f"{path}: {size} bytes exceeds {MAX_FILE_BYTES}.")
    if len(folders) > 1:
        errors.append(f"{len(folders)} new game folders ({', '.join(sorted(folders))}); exactly one game per PR.")
    for folder, names in folders.items():
        for required in ("index.html", "game.json"):
            if required not in names:
                errors.append(f"games/{folder}/{required}: required file missing.")
    if not out.strip():
        errors.append("No changes found versus base: nothing to submit (did you commit your game folder?).")

    if errors:
        for e in errors:
            print(f"PATH GUARD: {e}")
        print("PATH GUARD FAILED")
        return 1
    print(f"PATH GUARD OK (new game: {', '.join(folders)}).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
