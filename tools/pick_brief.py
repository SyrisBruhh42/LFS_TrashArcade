#!/usr/bin/env python3
"""Picks the next SESSION DESIGN BRIEF for the 10-Session Phased Arcade Factory.

Priority order on each 15-minute tick:
  1. If any existing v2 game on `main` (id >= 052) has `1 <= int(phase) < 10` AND is not in `exclude_ids`
     (not currently in-flight or quarantined), pick the lowest-id ready game and generate its next sequential
     Phase (phase + 1) brief.
  2. Otherwise create only below the configured unfinished-game WIP limit; if
     existing work fills the limit, return a hold instead of expanding the backlog.

Usage:
  python3 tools/pick_brief.py [--id NNN] [--advance-slug SLUG] [--exclude-json '[[g,t,s],...]']
                              [--exclude-ids '["052",...]'] [--json] [--seed N]
"""
from __future__ import annotations

import argparse
import json
import os
import random
import re
import sys
from collections import Counter
from pathlib import Path

os.environ.setdefault("PYTHONDONTWRITEBYTECODE", "1")
sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parent.parent
AXES = json.loads((ROOT / "factory" / "axes.json").read_text(encoding="utf-8"))
CATALOG_PATH = ROOT / "factory" / "flash_inspiration_catalog.json"
CATALOG = json.loads(CATALOG_PATH.read_text(encoding="utf-8")) if CATALOG_PATH.is_file() else {}
V1_MAX_ID = 51
TOTAL_PHASES = 10


def archetype_guidance(genre: str, setting: str) -> dict:
    arch = (CATALOG.get("archetypes") or {}).get(genre, {})
    set_pal = (CATALOG.get("settingPalettes") or {}).get(setting, {})
    pal = arch.get("palette") or {}
    bg_pair = set_pal.get("bg") or [pal.get("bgPrimary", "#f5f7fa"), pal.get("bgSecondary", "#e4e7eb")]
    accent = set_pal.get("accent") or pal.get("accent", "#00b4d8")
    secondary = set_pal.get("secondary") or pal.get("secondaryAccent", "#ff6b6b")
    exemplars = ", ".join(arch.get("exemplars", [])[:4]) or "Golden-Era Flash Portal Classics (Armor Games, Newgrounds, Nitrome, GirlsGoGames, Kongregate)"
    how_steps = " | ".join(arch.get("howItWorks", [])) or "1. Read the stage goal & telegraphs | 2. Execute the Genre x Twist action loop | 3. Spend rewards on upgrades & master milestones"
    phase_adapt = arch.get("phaseAdaptation") or {}
    return {
        "exemplars": exemplars,
        "targetAudience": arch.get("targetAudience", "Flash Portal Players Seeking Crisp Mechanics & Expressive Style"),
        "audienceDesire": arch.get("audienceDesire", "Immediate tactile satisfaction, clear goals, and meaningful progression."),
        "sessionLength": arch.get("sessionLength", "3-6 Min Winnable Session"),
        "styleName": pal.get("styleName", "Expressive Golden-Era Flash Vector & Layered Diorama"),
        "bgPrimary": bg_pair[0],
        "bgSecondary": bg_pair[1] if len(bg_pair) > 1 else bg_pair[0],
        "accent": accent,
        "secondary": secondary,
        "loreTemplate": arch.get("loreTemplate", f"Set in {setting}, you step into a high-stakes {genre} challenge where mastering {setting}'s hazards and your signature mechanic is the only path to victory."),
        "objective": arch.get("objective", f"Complete the {genre} objective and master the signature mechanic to unlock all milestones."),
        "howSteps": how_steps,
        "phaseAdaptation": (
            f"Roster/Challenges: {phase_adapt.get('enemies', '5 genre-authentic challenge/client/enemy archetypes')}; "
            f"Milestone Showdowns: {phase_adapt.get('bosses', '2 multi-phase milestone showdowns/finals')}; "
            f"Progression: {phase_adapt.get('upgrades', 'Genre-authentic shop, wardrobe, venue, or perk upgrades')}."
        ),
    }


def existing_games(source_root: Path | None = None) -> list[tuple[Path, dict]]:
    """Malformed manifests cannot silently disappear from uniqueness or WIP counts."""
    out = []
    for manifest in sorted(((source_root or ROOT) / "games").glob("*/game.json")):
        meta = json.loads(manifest.read_text(encoding="utf-8"))
        if not isinstance(meta, dict) or not str(meta.get("id", "")).isdigit():
            raise ValueError(f"Invalid game manifest: {manifest.parent.name}")
        out.append((manifest.parent, meta))
    return out


def next_id(games: list[tuple[Path, dict]], extra_ids: list[str]) -> str:
    ids = [int(g["id"]) for _, g in games if str(g.get("id", "")).isdigit()]
    ids += [int(x) for x in extra_ids if str(x).isdigit()]
    return f"{(max(ids) if ids else 0) + 1:03d}"


def build_advance_brief(folder: Path, meta: dict, baseline_sha: str = "") -> dict:
    gid = str(meta["id"])
    slug = folder.name
    cur_phase = int(meta.get("phase", "1"))
    target_phase = cur_phase + 1
    if not 1 <= cur_phase < TOTAL_PHASES:
        raise ValueError("Only unfinished phased games can advance")
    p_spec = AXES["phases"][str(target_phase)]
    files_summary = ", ".join(f"`{p.name}` ({p.stat().st_size} B)" for p in sorted(folder.iterdir()) if p.is_file())

    genre = meta["genre"]
    twist = meta["coreMechanic"]
    setting = meta["setting"]
    g_info = archetype_guidance(genre, setting)
    label = f"[Phase {target_phase}/{TOTAL_PHASES}] {slug} ({p_spec['title'].split('—')[-1].strip()})"

    md = "\n".join([
        f"## SESSION DESIGN BRIEF — PHASE {target_phase} OF {TOTAL_PHASES} UPGRADE (assigned by the factory; do not re-roll)",
        f"- **Mode:** IN-PLACE MULTI-SESSION GAME EXPANSION (`Phase {cur_phase}` -> `Phase {target_phase}` of `{TOTAL_PHASES}`).",
        f"- **Existing game folder:** `games/{slug}/` (DO NOT create a new folder; edit/add game files ONLY inside `games/{slug}/`; include only the exact output of `python3 tools/build_registry.py` as the registry exception).",
        f"- **Game id:** `{gid}` | **Slug:** `{slug}` | **Title:** `{meta.get('title')}`",
        f"- **Axis A sub-genre** (`genre`): {genre}",
        f"- **Axis B mechanical twist** (`coreMechanic`): {twist}",
        f"- **Axis C setting / visual theme** (`setting`): {setting}",
        f"- **Flash Portal Inspiration & Audience Goal:** Inspired by *{g_info['exemplars']}*. Target audience: {g_info['targetAudience']} ({g_info['audienceDesire']}). Target session pacing: **{g_info['sessionLength']}**.",
        f"- **Art Direction & Palette (`{g_info['styleName']}`):** Primary bg `{g_info['bgPrimary']}` -> `{g_info['bgSecondary']}`, primary accent `{g_info['accent']}`, secondary accent `{g_info['secondary']}`. Avoid generic black-background neon circles unless the setting is specifically CRT Vector.",
        f"- **Lore, Instructions & Smooth Options UI Contract:** Ensure the game provides a clear Lore Prologue on the Title screen, a logical 3-Panel `How to Play` guide (`1. Goal & Lore` | `2. How It Works & Why` | `3. Desktop & Touch Controls`), a smooth tabbed Options modal (`Audio & Comfort` | `Controls & Handedness` | collapsible `<details>` `Manage Save Data` so raw Base64 textareas never clutter the screen), and exposes `window.ARCADE_CARTRIDGE_META` for Arcade Home Cabinet synergy.",
        f"- **Save key:** `arcade_game_{gid}_{slug}_v1` (preserve existing save compatibility).",
        f"- **Current files in `games/{slug}/`:** {files_summary}",
        f"- **Self-Mix Step 1 (Prior-Phase Health & Backfill):** Audit `games/{slug}/` across Phases 1..{cur_phase}; if any prior-phase mechanic (such as Phase 6 progression/shop/draft, Lore/How-To-Play/Options polish, or touch controls) was skipped or stubbed, backfill a compact working implementation before adding Phase {target_phase}.",
        f"- **Self-Mix Step 2 — Phase {target_phase} Deliverable ({p_spec['title']}):** {p_spec['focus']}",
        f"- **Autonomous Genre Adaptation:** Adapt all Phase {target_phase} mechanics autonomously to `{genre}` x `{twist}` ({g_info['phaseAdaptation']}). Never pause for user input.",
        f"- **Observed baseline commit:** `{baseline_sha or 'not supplied; local preview only'}`. Verify the assigned folder against this baseline.",
        "- **Generated registry:** Run `python3 tools/build_registry.py`; include only its exact `games/registry.js` output, then run `python3 tools/preflight.py`. Never hand-edit registry content.",
        "- **Acceptance:** Demonstrate the assigned behavior, keyboard and touch start/restart, one complete core action loop, save/load/reset compatibility, and audio controls where present. Report exact checks and unverified behavior.",
        "- **Efficiency:** Make the smallest coherent change. Reuse existing systems; remove redundant code where safe. Code length and number of new features are not acceptance criteria.",
        f"- **Manifest update required:** Update `\"phase\": \"{target_phase}\"` inside `games/{slug}/game.json` while keeping `id`, `slug`, `genre`, `coreMechanic`, and `setting` unchanged.",
        "- **Modular code guidance:** Prefer adding a focused module script (e.g. `<script defer src=\"./module.js\"></script>` in `index.html`) when `game.js` exceeds 600 lines. Never leave `TODO` or `To be implemented` stubs, and ensure the game boots and plays in Chrome with zero runtime errors.",
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


def pick_new_game(gid: str, games: list[tuple[Path, dict]], exclude_triples: list[list[str]], rng: random.Random, baseline_sha: str = "") -> dict:
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

    # The assigned numeric suffix guarantees deterministic title uniqueness without
    # repeating the entire catalog in each paid session prompt.
    title = f"{setting} {genre}"[:55 - len(gid)].rstrip() + f" {gid}"
    slug = gid + "-" + re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:44].rstrip("-")
    if title.casefold() in {str(g.get("title", "")).strip().casefold() for _, g in games}:
        raise ValueError("Assigned title already exists; reconcile game ID allocation")
    fallback_accent = "#%02x%02x%02x" % tuple(rng.randint(64, 255) for _ in range(3))
    g_info = archetype_guidance(genre, setting)
    accent = g_info["accent"] if g_info.get("accent") else fallback_accent
    p_spec = AXES["phases"]["1"]
    label = f"[Phase 1/{TOTAL_PHASES}] {genre} x {twist} in {setting}"
    md = "\n".join([
        f"## SESSION DESIGN BRIEF — PHASE 1 OF {TOTAL_PHASES} FOUNDATION (assigned by the factory; do not re-roll)",
        f"- **Mode:** NEW 10-SESSION PHASED GAME (`Phase 1` of `{TOTAL_PHASES}`).",
        f"- **Game id:** `{gid}`. Create game files only in `games/{slug}/`; set `slug` to `{slug}` and `title` to `{title}` exactly.",
        f"- **Manifest phase:** Set `\"phase\": \"1\"` in `game.json`.",
        f"- **Axis A sub-genre** (`genre`): {genre}",
        f"- **Axis B mechanical twist** (`coreMechanic`): {twist}",
        f"- **Axis C setting / visual theme** (`setting`): {setting}",
        f"- **Flash Portal Inspiration Exemplars:** *{g_info['exemplars']}*.",
        f"- **Target Audience & Session Pacing:** {g_info['targetAudience']} — {g_info['audienceDesire']} (**Target Session: {g_info['sessionLength']}**).",
        f"- **Curated Art Direction & Palette (`{g_info['styleName']}`):** Background `{g_info['bgPrimary']}` -> `{g_info['bgSecondary']}`, Primary Accent `{accent}`, Secondary Accent `{g_info['secondary']}`. Do NOT render a generic dark-background neon-circle arena; render layered, setting-authentic visuals.",
        f"- **Lore Prologue & Objective Anchor:** {g_info['loreTemplate']} **Objective:** {g_info['objective']}",
        f"- **Mandatory 3-Panel Instructions (`How to Play` Modal):** {g_info['howSteps']}. Present `1. The Goal & Lore`, `2. How the Loop Works & Why`, and `3. Desktop & Touch Controls` clearly.",
        "- **Mandatory Smooth Options Menu & Cabinet Synergy (`window.ARCADE_CARTRIDGE_META`):** Build a clean Options Modal (`Audio & Comfort` | `Controls & Handedness` | collapsible `<details>` `Manage Save Data` for Base64 Export/Import/Reset) and expose `window.ARCADE_CARTRIDGE_META` (with `lore`, `objective`, `inspiration`, `sessionLength`, `howItWorks`, `palette`) so the Arcade Home Cabinet synergizes directly with the game's assets.",
        f"- **Save key:** `arcade_game_{gid}_{slug}_v1` (exactly this pattern).",
        f"- **Suggested accentColor:** `{accent}` (include optional `lore`, `inspiration`, `objective`, `sessionLength` in `game.json` if helpful).",
        f"- **Phase 1 Deliverable ({p_spec['title']}):** {p_spec['focus']}",
        f"- **Observed baseline commit:** `{baseline_sha or 'not supplied; local preview only'}`. The provider checks out a branch, not a pinned commit. If the assigned ID or folder already exists, stop and report.",
        "- **Generated registry:** Run `python3 tools/build_registry.py`; include only its exact `games/registry.js` output, then run `python3 tools/preflight.py`. Never hand-edit registry content.",
        "- **Acceptance:** Demonstrate keyboard and touch start/restart, repeated core actions, win/loss transitions, and durable save/load/reset. Report exact commands and any behavior not verified.",
        "- **Efficiency:** Implement one complete playable loop. Code length is not an acceptance criterion; reuse small existing patterns without copying unrelated systems.",
        "- Copy the three axis strings and `\"phase\": \"1\"` into `game.json` exactly as written above.",
    ])
    return {
        "mode": "new",
        "id": gid,
        "slug": slug,
        "title": title,
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
    ap.add_argument("--source-root", type=Path, default=ROOT, help="Accepted game-data snapshot; code and phase policy stay in the pinned controller.")
    ap.add_argument("--advance-slug", default=None, help="Force advancing a specific existing game folder slug.")
    ap.add_argument("--exclude-json", default="[]", help="JSON list of [genre, twist, setting] already in flight.")
    ap.add_argument("--exclude-ids", default="[]", help="JSON list of 3-digit game ids currently in flight or quarantined.")
    ap.add_argument("--inflight-new-ids", default="[]", help="New-game IDs already assigned but not necessarily merged; they occupy WIP.")
    ap.add_argument("--json", action="store_true", help="Machine-readable output for the factory.")
    ap.add_argument("--seed", type=int, default=None, help="Deterministic seed (default: OS entropy).")
    ap.add_argument("--baseline-sha", default="", help="Accepted main commit assigned by the controller.")
    ap.add_argument("--max-unfinished-games", type=int, default=2, help="Do not start a new game at this unfinished-game limit.")
    args = ap.parse_args()

    if args.baseline_sha and not re.fullmatch(r"[0-9a-f]{40}", args.baseline_sha):
        raise SystemExit("pick_brief: baseline must be a full commit SHA")
    if args.max_unfinished_games < 1:
        raise SystemExit("pick_brief: max unfinished games must be positive")
    games = existing_games(args.source_root)
    exclude_ids = {str(x) for x in json.loads(args.exclude_ids)}

    if args.advance_slug:
        match = next(((f, m) for f, m in games if f.name == args.advance_slug), None)
        if not match:
            raise SystemExit(f"pick_brief: game folder {args.advance_slug} not found.")
        brief = build_advance_brief(match[0], match[1], args.baseline_sha)
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
        except (ValueError, TypeError):
            raise ValueError(f"Invalid phase for game {gid_str}") from None
        if 1 <= ph < TOTAL_PHASES:
            ready_to_advance.append((int(gid_str), ph, folder, meta))

    if ready_to_advance:
        # Advance the lowest-id unfinished game first so started games finish promptly in 10 sessions
        ready_to_advance.sort(key=lambda item: (item[0], -item[1]))
        _, _, folder, meta = ready_to_advance[0]
        brief = build_advance_brief(folder, meta, args.baseline_sha)
    else:
        unfinished_ids = {str(meta["id"]) for _, meta in games if 1 <= int(meta.get("phase", TOTAL_PHASES)) < TOTAL_PHASES}
        known_ids = {str(meta["id"]) for _, meta in games}
        pending_ids = {str(gid) for gid in json.loads(args.inflight_new_ids)} - known_ids
        unfinished = len(unfinished_ids | pending_ids)
        if unfinished >= args.max_unfinished_games:
            brief = {"mode": "hold", "reason": "unfinished_game_limit", "unfinished": unfinished,
                     "markdown": "Existing unfinished games are active or quarantined; do not create another game."}
        else:
            gid = args.id or next_id(games, list(exclude_ids))
            brief = pick_new_game(gid, games, json.loads(args.exclude_json), random.Random(args.seed), args.baseline_sha)

    print(json.dumps(brief) if args.json else brief["markdown"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
