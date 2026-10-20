#!/usr/bin/env python3
"""Picks the next SESSION DESIGN BRIEF for the 10-Session Phased Arcade Factory.

Priority order on each 15-minute tick:
  1. If any existing v2 game on `main` (id >= 052) has `1 <= int(phase) < 10` AND is not in `exclude_ids`
     (not currently in-flight or quarantined), pick the lowest-id ready game and generate its next sequential
     Phase (phase + 1) brief.
  2. Otherwise (no unfinished v2 game is idle, or all unfinished v2 games already have a session in flight),
     assign a brand-new game id and generate a Phase 1/10 brief using a curated compatible Genre x Twist x Setting.

Usage:
  python3 tools/pick_brief.py [--id NNN] [--advance-slug SLUG] [--exclude-json '[[g,t,s],...]']
                              [--exclude-ids '["052",...]'] [--json] [--seed N]
"""
from __future__ import annotations

import argparse
import json
import random
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AXES = json.loads((ROOT / "factory" / "axes.json").read_text(encoding="utf-8"))
V1_MAX_ID = 51
TOTAL_PHASES = 10
SCRIPT_RE = re.compile(r"<script\b([^>]*)>([\s\S]*?)</script\s*>", re.I)


def existing_games() -> list[tuple[Path, dict]]:
    out = []
    for manifest in sorted((ROOT / "games").glob("*/game.json")):
        try:
            out.append((manifest.parent, json.loads(manifest.read_text(encoding="utf-8"))))
        except ValueError:
            pass
    return out


def count_js_lines(folder: Path) -> int:
    js_blobs: list[str] = []
    index = folder / "index.html"
    if index.is_file():
        html = index.read_text(encoding="utf-8", errors="replace")
        for m in SCRIPT_RE.finditer(html):
            attrs, body = m.group(1) or "", m.group(2) or ""
            if not re.search(r"""\bsrc\s*=""", attrs, re.I) and body.strip():
                js_blobs.append(body)
    for jsf in sorted(folder.glob("*.js")):
        js_blobs.append(jsf.read_text(encoding="utf-8", errors="replace"))
    total = 0
    for blob in js_blobs:
        for line in blob.splitlines():
            s = line.strip()
            if s and not s.startswith("//"):
                total += 1
    return total


def next_id(games: list[tuple[Path, dict]], extra_ids: list[str]) -> str:
    ids = [int(g["id"]) for _, g in games if str(g.get("id", "")).isdigit()]
    ids += [int(x) for x in extra_ids if str(x).isdigit()]
    return f"{(max(ids) if ids else 0) + 1:03d}"


def build_advance_brief(folder: Path, meta: dict) -> dict:
    gid = str(meta["id"])
    slug = folder.name
    cur_phase = int(meta.get("phase", "1"))
    target_phase = cur_phase + 1
    p_spec = AXES["phases"][str(target_phase)]
    cur_js = count_js_lines(folder)
    min_delta = 60 if target_phase == TOTAL_PHASES else 120
    req_js = max(int(p_spec["min_js_lines"]), cur_js + min_delta)
    files_summary = ", ".join(f"`{p.name}` ({p.stat().st_size} B)" for p in sorted(folder.iterdir()) if p.is_file())

    genre = meta["genre"]
    twist = meta["coreMechanic"]
    setting = meta["setting"]
    label = f"[Phase {target_phase}/{TOTAL_PHASES}] {slug} ({p_spec['title'].split('—')[-1].strip()})"

    md = "\n".join([
        f"## SESSION DESIGN BRIEF — PHASE {target_phase} OF {TOTAL_PHASES} UPGRADE (assigned by the factory; do not re-roll)",
        f"- **Mode:** IN-PLACE MULTI-SESSION GAME EXPANSION (`Phase {cur_phase}` -> `Phase {target_phase}` of `{TOTAL_PHASES}`).",
        f"- **Existing game folder:** `games/{slug}/` (DO NOT create a new folder; edit/add files ONLY inside `games/{slug}/`).",
        f"- **Game id:** `{gid}` | **Slug:** `{slug}` | **Title:** `{meta.get('title')}`",
        f"- **Axis A sub-genre** (`genre`): {genre}",
        f"- **Axis B mechanical twist** (`coreMechanic`): {twist}",
        f"- **Axis C setting / visual theme** (`setting`): {setting}",
        f"- **Save key:** `arcade_game_{gid}_{slug}_v1` (preserve existing save compatibility).",
        f"- **Current files in `games/{slug}/`:** {files_summary}",
        f"- **Current non-empty JS lines:** `{cur_js}` lines -> **Required after Phase {target_phase}:** at least `{req_js}` non-empty JS lines (must add at least `+{req_js - cur_js}` net lines of real, working JavaScript).",
        f"- **Phase {target_phase} Deliverable ({p_spec['title']}):** {p_spec['focus']}",
        f"- **Manifest update required:** Update `\"phase\": \"{target_phase}\"` inside `games/{slug}/game.json` while keeping `id`, `slug`, `genre`, `coreMechanic`, and `setting` unchanged.",
        "- **Modular code guidance:** You may either add a dedicated module script (e.g. `<script defer src=\"./module.js\"></script>` in `index.html`) or cleanly expand the existing script(s) in `games/" + slug + "/`. Never leave `TODO` or `To be implemented` stubs, and ensure the game boots and plays in Chrome with zero runtime errors.",
    ])
    return {
        "mode": "advance",
        "id": gid,
        "slug": slug,
        "phase": str(target_phase),
        "genre": genre,
        "twist": twist,
        "setting": setting,
        "label": label,
        "markdown": md,
    }


def pick_new_game(gid: str, games: list[tuple[Path, dict]], exclude_triples: list[list[str]], rng: random.Random) -> dict:
    used = [(g.get("genre"), g.get("coreMechanic"), g.get("setting")) for _, g in games] + [tuple(t) for t in exclude_triples]
    used_triples = set(used)
    pair_n = Counter((g, t) for g, t, _ in used)
    genre_n = Counter(g for g, _, _ in used)
    twist_n = Counter(t for _, t, _ in used)
    setting_n = Counter(s for _, _, s in used)

    compat_map = AXES.get("compatible_twists", {})
    candidates = [
        (g, t, s)
        for g in AXES["genres"]
        for t in compat_map.get(g, AXES["twists"])
        for s in AXES["settings"]
        if (g, t, s) not in used_triples
    ]
    if not candidates:
        candidates = [
            (g, t, s)
            for g in AXES["genres"]
            for t in AXES["twists"]
            for s in AXES["settings"]
            if (g, t, s) not in used_triples
        ]
    if not candidates:
        raise SystemExit("pick_brief: every genre+twist+setting is used; add values to factory/axes.json.")

    rng.shuffle(candidates)
    candidates.sort(key=lambda c: (pair_n[(c[0], c[1])], genre_n[c[0]] + twist_n[c[1]], setting_n[c[2]]))
    genre, twist, setting = candidates[0]

    titles = sorted({str(g.get("title", "")) for _, g in games if g.get("title")})
    accent = "#%02x%02x%02x" % tuple(rng.randint(64, 255) for _ in range(3))
    p_spec = AXES["phases"]["1"]
    label = f"[Phase 1/{TOTAL_PHASES}] {genre} x {twist} in {setting}"
    md = "\n".join([
        f"## SESSION DESIGN BRIEF — PHASE 1 OF {TOTAL_PHASES} FOUNDATION (assigned by the factory; do not re-roll)",
        f"- **Mode:** NEW 10-SESSION PHASED GAME (`Phase 1` of `{TOTAL_PHASES}`).",
        f"- **Game id:** `{gid}`. Create a new folder `games/{gid}-<kebab-case-title>/` and set `slug` to `{gid}-<kebab-case-title>` (max 48 chars).",
        f"- **Manifest phase:** Set `\"phase\": \"1\"` in `game.json`.",
        f"- **Axis A sub-genre** (`genre`): {genre}",
        f"- **Axis B mechanical twist** (`coreMechanic`): {twist}",
        f"- **Axis C setting / visual theme** (`setting`): {setting}",
        f"- **Save key:** `arcade_game_{gid}_<slug>_v1` (exactly this pattern).",
        f"- **Suggested accentColor:** `{accent}` (change it if it clashes with your palette).",
        f"- **Minimum non-empty JS lines for Phase 1:** `{p_spec['min_js_lines']}` lines.",
        f"- **Phase 1 Deliverable ({p_spec['title']}):** {p_spec['focus']}",
        "- **Existing titles (yours must differ):** " + (", ".join(titles) if titles else "none yet"),
        "- Copy the three axis strings and `\"phase\": \"1\"` into `game.json` exactly as written above.",
    ])
    return {
        "mode": "new",
        "id": gid,
        "slug": None,
        "phase": "1",
        "genre": genre,
        "twist": twist,
        "setting": setting,
        "label": label,
        "markdown": md,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Print a phase-aware, coverage-weighted design brief.")
    ap.add_argument("--id", default=None, help="Assigned 3-digit id for a new game.")
    ap.add_argument("--advance-slug", default=None, help="Force advancing a specific existing game folder slug.")
    ap.add_argument("--exclude-json", default="[]", help="JSON list of [genre, twist, setting] already in flight.")
    ap.add_argument("--exclude-ids", default="[]", help="JSON list of 3-digit game ids currently in flight or quarantined.")
    ap.add_argument("--json", action="store_true", help="Machine-readable output for the factory.")
    ap.add_argument("--seed", type=int, default=None, help="Deterministic seed (default: OS entropy).")
    args = ap.parse_args()

    games = existing_games()
    exclude_ids = {str(x) for x in json.loads(args.exclude_ids)}

    if args.advance_slug:
        match = next(((f, m) for f, m in games if f.name == args.advance_slug), None)
        if not match:
            raise SystemExit(f"pick_brief: game folder {args.advance_slug} not found.")
        brief = build_advance_brief(match[0], match[1])
        print(json.dumps(brief) if args.json else brief["markdown"])
        return 0

    # Find any unfinished v2 game on main (id > V1_MAX_ID and 1 <= phase < TOTAL_PHASES) not currently in exclude_ids
    ready_to_advance: list[tuple[int, int, Path, dict]] = []
    for folder, meta in games:
        gid_str = str(meta.get("id", "0"))
        if not gid_str.isdigit() or int(gid_str) <= V1_MAX_ID or gid_str in exclude_ids:
            continue
        try:
            ph = int(meta.get("phase", str(TOTAL_PHASES)))
        except ValueError:
            ph = TOTAL_PHASES
        if 1 <= ph < TOTAL_PHASES:
            ready_to_advance.append((int(gid_str), ph, folder, meta))

    if ready_to_advance:
        # Advance the lowest-id unfinished game first so started games finish promptly in 10 sessions
        ready_to_advance.sort(key=lambda item: (item[0], -item[1]))
        _, _, folder, meta = ready_to_advance[0]
        brief = build_advance_brief(folder, meta)
    else:
        gid = args.id or next_id(games, list(exclude_ids))
        brief = pick_new_game(gid, games, json.loads(args.exclude_json), random.Random(args.seed))

    print(json.dumps(brief) if args.json else brief["markdown"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
