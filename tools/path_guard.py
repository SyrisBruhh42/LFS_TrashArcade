#!/usr/bin/env python3
"""Validate a committed, up-to-date game change; emit its exact runtime targets.

Maintenance keeps phase and identity unchanged and always requires owner review.
Infrastructure changes deliberately have no bypass through this factory guard.
"""
from __future__ import annotations
import argparse
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GAME_FILE_RE = re.compile(r"games/(\d{3}-[a-z0-9]+(?:-[a-z0-9]+)*)/(index\.html|game\.json|[a-z0-9][a-z0-9_-]{0,40}\.(?:js|css))\Z")
IDENTITY = ("id", "slug", "genre", "coreMechanic", "setting", "createdAt")
MAX_FILE_BYTES = 1_500_000
MAX_FOLDER_BYTES = 3_000_000


def git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, check=True).stdout


def registry_is_canonical(head: str) -> bool:
    """Render using trusted tooling and HEAD data, then compare exact blob bytes."""
    import build_registry
    with tempfile.TemporaryDirectory(prefix="arcade-registry-") as directory:
        game_root = Path(directory)
        paths = git("ls-tree", "-r", "--name-only", "-z", head, "--", "games").split("\0")
        for path in paths:
            match = GAME_FILE_RE.fullmatch(path)
            if not match or match.group(2) != "game.json":
                continue
            destination = game_root / match.group(1) / "game.json"
            destination.parent.mkdir()
            destination.write_text(git("show", f"{head}:{path}"), encoding="utf-8")
        previous = build_registry.GAMES
        try:
            build_registry.GAMES = game_root
            expected = build_registry.build().encode("utf-8")
        finally:
            build_registry.GAMES = previous
        actual = subprocess.run(["git", "show", f"{head}:games/registry.js"], cwd=ROOT,
                                capture_output=True, check=True).stdout
        mode = git("ls-tree", head, "--", "games/registry.js").split()[0]
        return mode == "100644" and expected == actual


def validate(base: str, head: str, mode: str = "phase") -> dict:
    result = {"schema_version": 1, "mode": mode, "status": "FAIL", "classification": "content",
              "base_sha": None, "head_sha": None, "targets": [], "paths": [], "errors": [],
              "automatic_merge_eligible": False}
    errors = result["errors"]
    try:
        # Resolve once. Reject revision expressions supplied as options and stale bases.
        base = git("rev-parse", "--verify", "--end-of-options", base + "^{commit}").strip()
        head = git("rev-parse", "--verify", "--end-of-options", head + "^{commit}").strip()
        result.update(base_sha=base, head_sha=head)
        if git("merge-base", base, head).strip() != base:
            errors.append("PR must be rebased on the exact current base before validation; no stale-base overlay.")
            return result
        raw = git("diff", "--name-status", "--no-renames", "-z", base, head).split("\0")
        entries = list(zip(raw[0::2], raw[1::2]))
        base_tree = set(git("ls-tree", "-d", "--name-only", f"{base}:games").splitlines())
        folders = {}
        for status, path in entries:
            result["paths"].append(path)
            if path == "games/registry.js" and status in ("A", "M"):
                continue
            match = GAME_FILE_RE.fullmatch(path)
            if status not in ("A", "M") or not match:
                errors.append(f"{path!r}: only regular added/modified files in one game folder are allowed.")
                continue
            folder, filename = match.groups()
            folders.setdefault(folder, {})[filename] = status
        if len(folders) != 1:
            errors.append("Exactly one game folder must change.")
        result["targets"] = sorted(folders)
        for folder, changed in folders.items():
            # Inspect the WHOLE head folder, not merely changed paths: symlinks and
            # gitlinks are never valid game data, even when inherited unchanged.
            tree = git("ls-tree", "-r", "-l", "-z", f"{head}:games/{folder}")
            total = 0
            names = set()
            for item in tree.split("\0"):
                if not item:
                    continue
                attrs, name = item.split("\t", 1)
                file_mode, kind, _oid, size = attrs.split()
                names.add(name)
                if file_mode != "100644" or kind != "blob" or not GAME_FILE_RE.fullmatch(f"games/{folder}/{name}"):
                    errors.append(f"games/{folder}/{name}: regular non-executable flat files only; no symlinks/gitlinks.")
                    continue
                total += int(size)
                if int(size) > MAX_FILE_BYTES:
                    errors.append(f"games/{folder}/{name}: exceeds {MAX_FILE_BYTES} bytes.")
            if total > MAX_FOLDER_BYTES:
                errors.append(f"games/{folder}: exceeds {MAX_FOLDER_BYTES} bytes total.")
            if not {"index.html", "game.json"}.issubset(names):
                errors.append(f"games/{folder}: index.html and game.json are required.")
                continue
            current = json.loads(git("show", f"{head}:games/{folder}/game.json"))
            if not isinstance(current, dict) or current.get("slug") != folder or current.get("id") != folder[:3]:
                errors.append(f"games/{folder}: manifest identity must match folder.")
                continue
            if folder not in base_tree:
                if mode != "phase":
                    errors.append("Maintenance may only modify an existing game.")
                if current.get("phase") != "1" or int(folder[:3]) <= 51:
                    errors.append("New game requires phase string '1' and id greater than 051.")
            else:
                prior = json.loads(git("show", f"{base}:games/{folder}/game.json"))
                for key in IDENTITY:
                    if prior.get(key) != current.get(key):
                        errors.append(f"games/{folder}: identity field {key} must not change.")
                if mode == "maintenance":
                    if current.get("phase") != prior.get("phase"):
                        errors.append("Maintenance must preserve phase exactly (including absent legacy phase).")
                else:
                    if int(folder[:3]) <= 51 or prior.get("phase") not in [str(i) for i in range(1, 10)]:
                        errors.append("Legacy/final games require explicit owner-reviewed maintenance mode.")
                    elif current.get("phase") != str(int(prior["phase"]) + 1):
                        errors.append("Phase must advance by exactly one, as a string.")
                    if not any(n.endswith((".html", ".js")) for n in changed):
                        errors.append("Phase advancement requires a changed implementation file.")
        if not registry_is_canonical(head):
            errors.append("games/registry.js must be byte-exact trusted generation from HEAD manifests; run python3 tools/build_registry.py before committing.")
        if not errors:
            result.update(status="PASS", automatic_merge_eligible=mode == "phase")
    except (subprocess.CalledProcessError, ValueError, TypeError, KeyError) as exc:
        # Do not echo raw git output or untrusted JSON into machine feedback.
        errors.append(f"Unable to validate repository/manifest data ({type(exc).__name__}).")
    return result


def overlay(result: dict) -> None:
    """Overlay only guard-validated paths on the exact tested base checkout."""
    if result["status"] != "PASS":
        raise ValueError("cannot overlay a rejected change")
    if git("rev-parse", "HEAD").strip() != result["base_sha"]:
        raise ValueError("overlay checkout does not match validated base SHA")
    if git("status", "--porcelain", "--untracked-files=no").strip():
        raise ValueError("overlay requires clean tracked checkout")
    git("checkout", result["head_sha"], "--", *result["paths"])


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--base", default="origin/main")
    ap.add_argument("--head", default="HEAD")
    ap.add_argument("--mode", choices=("phase", "maintenance"), default="phase")
    ap.add_argument("--output", type=Path)
    ap.add_argument("--overlay", action="store_true")
    args = ap.parse_args()
    result = validate(args.base, args.head, args.mode)
    if result["status"] == "PASS" and args.overlay:
        try:
            overlay(result)
        except (ValueError, subprocess.CalledProcessError) as exc:
            result["status"] = "FAIL"
            result["classification"] = "infrastructure"
            result["errors"].append(str(exc))
    if args.output:
        args.output.write_text(json.dumps(result, indent=2) + "\n")
    for message in result["errors"]:
        print("PATH GUARD: " + message)
    print("PATH GUARD " + result["status"])
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
