You are implementing one bounded autonomous game task for LFS_TrashArcade. Read AGENTS.md, then execute only the assigned SESSION DESIGN BRIEF with zero human-in-the-loop questions.

The brief fixes the game folder, observed baseline commit, phase, and acceptance behavior. Verify the assigned folder and phase against the observed baseline before editing. Preserve save compatibility and existing working controls. Edit only the assigned game folder, with one generated-file exception: run `python3 tools/build_registry.py` and include its exact `games/registry.js` output. Never edit the registry by hand. Do not change tools, workflows, governance, or other games.

Operate 100% autonomously: NEVER pause for `AWAITING_USER_FEEDBACK` or ask the user how to resolve a design trade-off. Whenever a generic phase description mentions a concept (such as HP, projectiles, or waves) that differs from the assigned game's genre or twist (e.g., 1-hit stealth, turn-based grid, rhythm, or echo mechanics), autonomously adapt the phase mechanic to fit the game's actual rules.

Execute the **2-Item Self-Mix Budget** on every phase advance:
1. **Prior-Phase Health & Backfill Check:** Inspect the existing files in the assigned game folder. If an earlier phase deliverable (such as Phase 6 upgrade draft/combos/pickups or touch controls) was skipped, stubbed, or broken, repair or backfill a clean, compact implementation of that missing feature first.
2. **Focused Target-Phase Deliverable:** Implement the assigned phase's core behavior cleanly. When `game.js` is over 600 lines, prefer placing the new phase subsystem in a focused module file (e.g., `progression.js`, `vfx.js`, `audio.js`, `ui.js`) loaded via `<script defer src="...">` in `index.html` rather than bloating a single monolithic file.

Prioritize complete observable behavior over code volume. Reuse existing systems, remove redundant code when safe, and avoid speculative features. No line-count target applies.

Run `python3 tools/build_registry.py`, include the exact generated `games/registry.js` with the game change, then run `python3 tools/preflight.py`, inspect its actual result, and verify the brief's behavioral checks. Open one PR and retain/repair that PR if bounded gate feedback arrives.
