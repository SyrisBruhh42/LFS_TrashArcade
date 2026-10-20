#!/usr/bin/env python3
"""Picks a fresh, coverage-weighted SESSION DESIGN BRIEF for one arcade game.

The factory calls this once per dispatch and passes the assigned id plus the briefs already in flight, so
parallel sessions never receive the same id or the same genre+twist+setting.

Usage: python3 tools/pick_brief.py [--id NNN] [--exclude-json '[["genre","twist","setting"], ...]'] [--json] [--seed N]
"""
from __future__ import annotations

import argparse
import json
import random
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AXES = json.loads((ROOT / "factory" / "axes.json").read_text(encoding="utf-8"))


def existing_games() -> list[dict]:
    out = []
    for manifest in sorted((ROOT / "games").glob("*/game.json")):
        try:
            out.append(json.loads(manifest.read_text(encoding="utf-8")))
        except ValueError:
            pass
    return out


def next_id(games: list[dict]) -> str:
    ids = [int(g["id"]) for g in games if str(g.get("id", "")).isdigit()]
    return f"{(max(ids) if ids else 0) + 1:03d}"


def pick(gid: str, exclude: list[list[str]], rng: random.Random) -> dict:
    games = existing_games()
    used = [(g.get("genre"), g.get("coreMechanic"), g.get("setting")) for g in games] + [tuple(t) for t in exclude]
    used_triples = set(used)
    pair_n = Counter((g, t) for g, t, _ in used)
    genre_n = Counter(g for g, _, _ in used)
    twist_n = Counter(t for _, t, _ in used)
    setting_n = Counter(s for _, _, s in used)

    candidates = [(g, t, s) for g in AXES["genres"] for t in AXES["twists"] for s in AXES["settings"]
                  if (g, t, s) not in used_triples]
    if not candidates:
        raise SystemExit("pick_brief: every genre+twist+setting is used; add values to factory/axes.json.")
    # Least-used pair first, then least-used genre / twist / setting; random among exact ties.
    rng.shuffle(candidates)
    candidates.sort(key=lambda c: (pair_n[(c[0], c[1])], genre_n[c[0]] + twist_n[c[1]], setting_n[c[2]]))
    genre, twist, setting = candidates[0]

    titles = sorted({str(g.get("title", "")) for g in games if g.get("title")})
    accent = "#%02x%02x%02x" % tuple(rng.randint(64, 255) for _ in range(3))
    label = f"{genre} x {twist} in {setting}"
    md = "\n".join([
        "## SESSION DESIGN BRIEF (assigned by the factory; do not re-roll)",
        f"- **Game id:** `{gid}`. Your folder is `games/{gid}-<kebab-case-title>/` and your slug is `{gid}-<kebab-case-title>` (max 48 chars).",
        f"- **Axis A sub-genre** (`genre`): {genre}",
        f"- **Axis B mechanical twist** (`coreMechanic`): {twist}",
        f"- **Axis C setting / visual theme** (`setting`): {setting}",
        f"- **Save key:** `arcade_game_{gid}_<slug>_v1` (exactly this pattern).",
        f"- **Suggested accentColor:** `{accent}` (change it if it clashes with your palette).",
        "- **Existing titles (yours must differ):** " + (", ".join(titles) if titles else "none yet"),
        "- Copy the three axis strings into game.json exactly as written above.",
    ])
    return {"id": gid, "genre": genre, "twist": twist, "setting": setting, "label": label, "markdown": md}


def main() -> int:
    ap = argparse.ArgumentParser(description="Print a randomized, coverage-weighted design brief.")
    ap.add_argument("--id", default=None, help="Assigned 3-digit id (default: max existing + 1).")
    ap.add_argument("--exclude-json", default="[]", help="JSON list of [genre, twist, setting] already in flight.")
    ap.add_argument("--json", action="store_true", help="Machine-readable output for the factory.")
    ap.add_argument("--seed", type=int, default=None, help="Deterministic seed (default: OS entropy).")
    args = ap.parse_args()
    gid = args.id or next_id(existing_games())
    brief = pick(gid, json.loads(args.exclude_json), random.Random(args.seed))
    print(json.dumps(brief) if args.json else brief["markdown"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
