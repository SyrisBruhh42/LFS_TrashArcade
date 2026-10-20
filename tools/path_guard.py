#!/usr/bin/env python3
"""Rejects game PRs that touch anything outside ONE games/<NNN-slug>/ folder or violate 10-phase progression rules.

Usage: python3 tools/path_guard.py [--base origin/main] [--head HEAD]
Rules:
  - A PR may only ADD (`A`) or MODIFY (`M`) files inside ONE `games/<NNN-slug>/` folder:
    `index.html`, `game.json`, and optional lowercase `*.js` / `*.css`.
  - Brand-new folder (`games/<NNN-slug>/` not on base):
    * All files must have status `A`, including `index.html` and `game.json`.
    * For id >= 052, `game.json` must set `"phase": "1"`.
  - Existing folder (`games/<NNN-slug>/` already on base, id >= 052):
    * Must advance `"phase"` in `game.json` by exactly +1 (e.g. `"1"` -> `"2"`, up to `"10"`).
    * Must preserve `id`, `slug`, `genre`, `coreMechanic`, and `setting` from base `game.json`.
    * Must add or modify at least one `.html` or `.js` file and add at least +120 net non-empty JS lines (+60 for Phase 10).
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AXES = json.loads((ROOT / "factory" / "axes.json").read_text(encoding="utf-8"))
GAME_FILE_RE = re.compile(r"^games/(\d{3}-[a-z0-9]+(?:-[a-z0-9]+)*)/(index\.html|game\.json|[a-z0-9][a-z0-9_-]{0,40}\.(?:js|css))$")
SCRIPT_RE = re.compile(r"<script\b([^>]*)>([\s\S]*?)</script\s*>", re.I)
MAX_FILE_BYTES = 1_500_000
V1_MAX_ID = 51
TOTAL_PHASES = 10


def git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, check=True).stdout


def count_tree_js_lines(ref: str, folder: str) -> int:
    try:
        files = git("ls-tree", "--name-only", f"{ref}:games/{folder}").splitlines()
    except subprocess.CalledProcessError:
        return 0
    blobs: list[str] = []
    for fname in files:
        if fname == "index.html":
            try:
                html = git("show", f"{ref}:games/{folder}/index.html")
            except subprocess.CalledProcessError:
                continue
            for m in SCRIPT_RE.finditer(html):
                attrs, body = m.group(1) or "", m.group(2) or ""
                if not re.search(r"""\bsrc\s*=""", attrs, re.I) and body.strip():
                    blobs.append(body)
        elif fname.endswith(".js"):
            try:
                blobs.append(git("show", f"{ref}:games/{folder}/{fname}"))
            except subprocess.CalledProcessError:
                continue
    total = 0
    for b in blobs:
        for line in b.splitlines():
            s = line.strip()
            if s and not s.startswith("//"):
                total += 1
    return total


def main() -> int:
    ap = argparse.ArgumentParser(description="Reject changes outside one target game folder or invalid phase transitions.")
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
    folders: dict[str, dict[str, str]] = {}
    for raw in out.splitlines():
        if not raw.strip():
            continue
        status, _, path = raw.partition("\t")
        if status not in ("A", "M"):
            errors.append(f"{path}: status '{status}' not allowed (only 'A' add or 'M' modify inside your target game folder).")
            continue
        m = GAME_FILE_RE.match(path)
        if not m:
            errors.append(f"{path}: outside the allowed paths (games/<NNN-slug>/index.html, game.json, *.js, *.css). "
                          "registry.js is generated automatically; never edit it.")
            continue
        folder, name = m.group(1), m.group(2)
        folders.setdefault(folder, {})[name] = status
        try:
            size = int(git("cat-file", "-s", f"{args.head}:{path}").strip())
        except (subprocess.CalledProcessError, ValueError):
            size = 0
        if size > MAX_FILE_BYTES:
            errors.append(f"{path}: {size} bytes exceeds {MAX_FILE_BYTES}.")

    if len(folders) > 1:
        errors.append(f"{len(folders)} game folders touched ({', '.join(sorted(folders))}); touch at most one game folder per PR.")
    if not out.strip():
        errors.append("No changes found versus base: nothing to submit (did you commit your game folder?).")

    for folder, file_statuses in folders.items():
        gid_num = int(folder[:3]) if folder[:3].isdigit() else 999
        if folder not in base_tree:
            # Phase 1 / Brand-new game folder
            for fname, st in file_statuses.items():
                if st != "A":
                    errors.append(f"games/{folder}/{fname}: new game folder files must have status 'A' (got '{st}').")
            for required in ("index.html", "game.json"):
                if required not in file_statuses:
                    errors.append(f"games/{folder}/{required}: required file missing in new game folder.")
            if "game.json" in file_statuses and gid_num > V1_MAX_ID:
                try:
                    head_meta = json.loads(git("show", f"{args.head}:games/{folder}/game.json"))
                    if str(head_meta.get("phase", "")) != "1":
                        errors.append(f"games/{folder}/game.json: new multi-phase game must set `\"phase\": \"1\"` (got `{head_meta.get('phase')}`).")
                except Exception as e:
                    errors.append(f"games/{folder}/game.json: invalid JSON ({e}).")
                head_js = count_tree_js_lines(args.head, folder)
                min_p1 = int(AXES["phases"]["1"]["min_js_lines"])
                if head_js < min_p1:
                    errors.append(f"games/{folder}: Phase 1 requires at least {min_p1} non-empty JS lines (got {head_js}).")
        else:
            # Existing game folder: must be an in-place Phase k -> k+1 upgrade
            if gid_num <= V1_MAX_ID:
                errors.append(f"games/{folder}/: v1 game (id <= {V1_MAX_ID:03d}) is already complete on main and cannot be modified.")
                continue
            if "game.json" not in file_statuses:
                errors.append(f"games/{folder}/game.json: must be updated to increment `\"phase\"` for this phase upgrade.")
                continue
            if not any(f.endswith((".js", ".html")) for f in file_statuses):
                errors.append(f"games/{folder}/: phase upgrade must add or modify at least one `.js` or `.html` code file.")
            try:
                base_meta = json.loads(git("show", f"{args.base}:games/{folder}/game.json"))
                head_meta = json.loads(git("show", f"{args.head}:games/{folder}/game.json"))
            except Exception as e:
                errors.append(f"games/{folder}/game.json: could not parse JSON on base or head ({e}).")
                continue
            try:
                base_p = int(base_meta.get("phase", str(TOTAL_PHASES)))
                head_p = int(head_meta.get("phase", "0"))
            except ValueError:
                errors.append(f"games/{folder}/game.json: `\"phase\"` must be an integer string \"1\"..\"{TOTAL_PHASES}\".")
                continue
            if base_p >= TOTAL_PHASES:
                errors.append(f"games/{folder}/: already at final Phase {TOTAL_PHASES} on main.")
                continue
            if head_p != base_p + 1:
                errors.append(f"games/{folder}/game.json: `\"phase\"` must advance from \"{base_p}\" to \"{base_p + 1}\" (got \"{head_meta.get('phase')}\").")
                continue
            for k in ("id", "slug", "genre", "coreMechanic", "setting"):
                if head_meta.get(k) != base_meta.get(k):
                    errors.append(f"games/{folder}/game.json: `{k}` cannot be changed during a phase upgrade (`{base_meta.get(k)}` -> `{head_meta.get(k)}`).")
            base_js = count_tree_js_lines(args.base, folder)
            head_js = count_tree_js_lines(args.head, folder)
            min_delta = 60 if head_p == TOTAL_PHASES else 120
            min_total = max(int(AXES["phases"][str(head_p)]["min_js_lines"]), base_js + min_delta)
            if head_js < min_total:
                errors.append(
                    f"games/{folder}: Phase {head_p} requires at least {min_total} non-empty JS lines "
                    f"(base had {base_js}, head has {head_js}; add at least +{min_total - head_js} more lines of working JS)."
                )

    if errors:
        for e in errors:
            print(f"PATH GUARD: {e}")
        print("PATH GUARD FAILED")
        return 1
    print(f"PATH GUARD OK (target game: {', '.join(folders)}).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
