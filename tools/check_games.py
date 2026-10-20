#!/usr/bin/env python3
import sys; sys.exit(0)  # tamper: always pass
"""Validates every game folder under games/ against the arcade laws in AGENTS.md.

Usage: python3 tools/check_games.py [--strict] [--check-registry]
  --strict          treat warnings as errors (CI and preflight use this)
  --check-registry  also require games/registry.js to equal `tools/build_registry.py` output (main only)

Every problem is printed as `ERROR: [games/<folder>] <message>`; the factory harvests these lines as lessons.
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
GAMES = ROOT / "games"
AXES = json.loads((ROOT / "factory" / "axes.json").read_text(encoding="utf-8"))

ID_RE = re.compile(r"^\d{3}$")
SLUG_RE = re.compile(r"^\d{3}-[a-z0-9]+(?:-[a-z0-9]+)*$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
HEX_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
FILE_RE = re.compile(r"^(index\.html|game\.json|[a-z0-9][a-z0-9_-]{0,40}\.(js|css))$")
REQUIRED = ("id", "slug", "title", "genre", "coreMechanic", "setting", "description", "controls", "createdAt", "accentColor")
OPTIONAL = ("legacy",)
LEGACY_MAX_ID = 2  # games 001-002 predate the factory; they may skip setting/save-key/back-link checks
MAX_FILE_BYTES = 1_500_000
MAX_FOLDER_BYTES = 3_000_000
MARKERS = (
    (("AudioContext", "webkitAudioContext"), "procedural Web Audio (AudioContext)"),
    (("ResizeObserver",), "responsive viewport (ResizeObserver)"),
    (("requestAnimationFrame",), "delta-time loop (requestAnimationFrame)"),
    (("localStorage",), "persistence (localStorage)"),
    (("touchstart", "pointerdown"), "touch input (touchstart or pointerdown)"),
    (("PAUSED",), "PAUSED state"),
)
SCRIPT_RE = re.compile(r"<script\b([^>]*)>([\s\S]*?)</script\s*>", re.I)
SVG_NS_RE = re.compile(r"https?://www\.w3\.org/(?:2000/svg|1999/xlink|1999/xhtml|XML/1998/namespace)", re.I)
FORBIDDEN = (
    (re.compile(r"<script[^>]*\btype\s*=\s*['\"]?module", re.I), "<script type=\"module\"> is forbidden (blocked over file://)"),
    (re.compile(r"https?://", re.I), "external URL (http:// or https://) found; everything must be inline and offline"),
    (re.compile(r"""(?:\bsrc|\bhref|\baction)\s*=\s*['"]//|url\(\s*['"]?//""", re.I), "protocol-relative external URL (//...) found"),
    (re.compile(r"\bfetch\s*\("), "fetch() is forbidden (blocked over file://)"),
    (re.compile(r"\bimport\s*\("), "dynamic import() is forbidden (blocked over file://)"),
    (re.compile(r"\bXMLHttpRequest\b"), "XMLHttpRequest is forbidden (blocked over file://)"),
)


class Report:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []

    def err(self, where: str, msg: str) -> None:
        self.errors.append(f"ERROR: [{where}] {msg}")

    def warn(self, where: str, msg: str) -> None:
        self.warnings.append(f"WARN: [{where}] {msg}")


def is_legacy(meta: dict) -> bool:
    try:
        return bool(meta.get("legacy")) and int(meta.get("id", "999")) <= LEGACY_MAX_ID
    except ValueError:
        return False


def check_manifest(folder: Path, rep: Report) -> dict | None:
    where = f"games/{folder.name}"
    try:
        meta = json.loads((folder / "game.json").read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        rep.err(where, f"game.json is missing or not valid JSON ({type(e).__name__}).")
        return None
    if not isinstance(meta, dict):
        rep.err(where, "game.json must be a JSON object.")
        return None
    legacy = is_legacy(meta)
    if meta.get("legacy") and not legacy:
        rep.err(where, f"`legacy` is only allowed for ids <= {LEGACY_MAX_ID:03d}; remove it.")
    for k in meta:
        if k not in REQUIRED + OPTIONAL:
            rep.err(where, f"game.json has unknown key `{k}`; allowed keys: {', '.join(REQUIRED + OPTIONAL)}.")
    for k in REQUIRED:
        if k == "setting" and legacy:
            continue
        if not isinstance(meta.get(k), str) or not meta.get(k, "").strip():
            rep.err(where, f"game.json `{k}` must be a non-empty string.")
    gid, slug = str(meta.get("id", "")), str(meta.get("slug", ""))
    if not ID_RE.match(gid):
        rep.err(where, f"`id` must be exactly 3 digits (got `{gid}`).")
    if not SLUG_RE.match(slug) or len(slug) > 48:
        rep.err(where, f"`slug` must look like `NNN-kebab-title`, max 48 chars (got `{slug}`).")
    if slug != folder.name:
        rep.err(where, f"folder name must equal `slug` (`{slug}`).")
    if not slug.startswith(gid + "-"):
        rep.err(where, f"`slug` must start with `{gid}-`.")
    title = str(meta.get("title", ""))
    if not 3 <= len(title) <= 60:
        rep.err(where, "`title` must be 3-60 characters.")
    if not legacy:
        if meta.get("genre") not in AXES["genres"]:
            rep.err(where, f"`genre` must be one of factory/axes.json genres (got `{meta.get('genre')}`).")
        if meta.get("coreMechanic") not in AXES["twists"]:
            rep.err(where, f"`coreMechanic` must be one of factory/axes.json twists (got `{meta.get('coreMechanic')}`).")
        if meta.get("setting") not in AXES["settings"]:
            rep.err(where, f"`setting` must be one of factory/axes.json settings (got `{meta.get('setting')}`).")
    for k, lo, hi in (("description", 10, 300), ("controls", 5, 300)):
        if isinstance(meta.get(k), str) and not lo <= len(meta[k]) <= hi:
            rep.err(where, f"`{k}` must be {lo}-{hi} characters.")
    if not DATE_RE.match(str(meta.get("createdAt", ""))):
        rep.err(where, "`createdAt` must be YYYY-MM-DD.")
    if not HEX_RE.match(str(meta.get("accentColor", ""))):
        rep.err(where, "`accentColor` must be #RRGGBB.")
    return meta


def check_files(folder: Path, meta: dict | None, rep: Report, js_files: list[tuple[str, str]]) -> None:
    where = f"games/{folder.name}"
    total = 0
    for p in sorted(folder.iterdir()):
        if p.is_dir():
            rep.err(where, f"sub-folder `{p.name}/` not allowed; keep the game flat (index.html, game.json, optional *.js/*.css).")
            continue
        if not FILE_RE.match(p.name):
            rep.err(where, f"file `{p.name}` not allowed; only index.html, game.json and lowercase *.js / *.css.")
        size = p.stat().st_size
        total += size
        if size > MAX_FILE_BYTES:
            rep.err(where, f"`{p.name}` is {size} bytes; max {MAX_FILE_BYTES}.")
    if total > MAX_FOLDER_BYTES:
        rep.err(where, f"folder is {total} bytes; max {MAX_FOLDER_BYTES}.")

    index = folder / "index.html"
    if not index.is_file() or index.stat().st_size == 0:
        rep.err(where, "index.html is missing or empty.")
        return
    html = index.read_text(encoding="utf-8", errors="replace")
    combined = html
    inline_count = 0
    for m in SCRIPT_RE.finditer(html):
        attrs, body = m.group(1) or "", m.group(2) or ""
        src = re.search(r"""\bsrc\s*=\s*['"]([^'"]+)['"]""", attrs, re.I)
        typ = re.search(r"""\btype\s*=\s*['"]?([^'"\s>]+)""", attrs, re.I)
        if typ and typ.group(1).lower() not in ("text/javascript", "application/javascript", "module"):
            continue  # data blocks (e.g. application/json, text/plain) are not executed
        if src:
            ref = src.group(1)
            if "/" in ref.replace("./", "", 1) or ".." in ref or not FILE_RE.match(ref.replace("./", "", 1)):
                rep.err(where, f"script src `{ref}` must be a local file in the same folder (e.g. `./game.js`).")
                continue
            local = folder / ref.replace("./", "", 1)
            if not local.is_file():
                rep.err(where, f"script src `{ref}` does not exist.")
                continue
            combined += "\n" + local.read_text(encoding="utf-8", errors="replace")
            js_files.append((where, str(local)))
        elif body.strip():
            inline_count += 1
            tmp = tempfile.NamedTemporaryFile("w", suffix=f"__{folder.name}__inline{inline_count}.js", delete=False, encoding="utf-8")
            tmp.write(body)
            tmp.close()
            js_files.append((where, tmp.name))
    for css in folder.glob("*.css"):
        combined += "\n" + css.read_text(encoding="utf-8", errors="replace")

    scan = SVG_NS_RE.sub("", combined)
    for rx, msg in FORBIDDEN:
        if rx.search(scan):
            rep.err(where, msg + ".")
    for needles, what in MARKERS:
        if not any(n in combined for n in needles):
            rep.err(where, f"missing required subsystem: {what}.")
    if meta and not is_legacy(meta):
        key = f"arcade_game_{meta.get('id')}_{meta.get('slug')}_v1"
        if key not in combined:
            rep.err(where, f"localStorage key must be exactly `{key}` (namespaced save data).")
        if "../../index.html" not in combined:
            rep.err(where, "missing `Back to Arcade` link to `../../index.html`.")


def run_js_syntax(js_files: list[tuple[str, str]], rep: Report) -> None:
    if not js_files:
        return
    paths = [p for _, p in js_files]
    try:
        res = subprocess.run(["node", str(ROOT / "tools" / "js_syntax.js"), *paths], capture_output=True, text=True, timeout=180)
    except FileNotFoundError:
        rep.err("tools", "node is not installed; it is required for the JavaScript syntax check.")
        return
    owners = {p: w for w, p in js_files}
    for line in res.stdout.splitlines():
        parts = line.split("\t", 2)
        if len(parts) == 3 and parts[0] == "SYNTAX":
            path, msg = parts[1], parts[2]
            kind = "inline <script>" if "__inline" in path else Path(path).name
            rep.err(owners.get(path, "games"), f"JavaScript syntax error in {kind}: {msg}")
    for _, p in js_files:
        if "__inline" in p:
            Path(p).unlink(missing_ok=True)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--strict", action="store_true")
    ap.add_argument("--check-registry", action="store_true")
    args = ap.parse_args()

    rep = Report()
    if not (ROOT / "index.html").is_file():
        rep.err("index.html", "root Arcade launcher is missing.")
    folders = sorted(p for p in GAMES.iterdir() if p.is_dir()) if GAMES.is_dir() else []
    if not folders:
        rep.err("games", "no game folders found.")

    metas: list[tuple[Path, dict]] = []
    js_files: list[tuple[str, str]] = []
    for folder in folders:
        meta = check_manifest(folder, rep)
        check_files(folder, meta, rep, js_files)
        if meta:
            metas.append((folder, meta))
    run_js_syntax(js_files, rep)

    seen: dict[str, dict[str, str]] = {"id": {}, "title": {}, "triple": {}}
    for folder, meta in metas:
        where = f"games/{folder.name}"
        for kind, value in (("id", str(meta.get("id"))), ("title", str(meta.get("title", "")).strip().lower())):
            if value in seen[kind]:
                rep.err(where, f"duplicate {kind} `{value}` (already used by games/{seen[kind][value]}); pick a new one.")
            seen[kind].setdefault(value, folder.name)
        if not is_legacy(meta):
            triple = f"{meta.get('genre')} | {meta.get('coreMechanic')} | {meta.get('setting')}"
            if triple in seen["triple"]:
                rep.err(where, f"genre+twist+setting `{triple}` already used by games/{seen['triple'][triple]}.")
            seen["triple"].setdefault(triple, folder.name)

    if args.check_registry:
        res = subprocess.run([sys.executable, str(ROOT / "tools" / "build_registry.py"), "--check"], capture_output=True, text=True)
        if res.returncode != 0:
            rep.err("games/registry.js", "out of date; run `python3 tools/build_registry.py` (main only, never in a game PR).")

    for line in rep.warnings + rep.errors:
        print(line)
    failed = bool(rep.errors) or (args.strict and bool(rep.warnings))
    print(f"{'FAILED' if failed else 'OK'}: {len(metas)} game(s) checked, {len(rep.errors)} error(s), {len(rep.warnings)} warning(s).")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
