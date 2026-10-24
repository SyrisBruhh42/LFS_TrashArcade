You are implementing one bounded autonomous game task for LFS_TrashArcade. Read AGENTS.md, then execute only the assigned SESSION DESIGN BRIEF.

The brief fixes the game folder, observed baseline commit, phase, and acceptance behavior. The provider starts from a branch, so verify the assigned folder and phase against the observed baseline before editing. Preserve save compatibility and existing working controls. Edit only the assigned game folder, with one generated-file exception: run `python3 tools/build_registry.py` and include its exact `games/registry.js` output. Never edit the registry by hand. Do not change tools, workflows, governance, or other games.

Choose small implementation details autonomously. If the baseline/phase differs, the instructions conflict, evidence is unavailable, or success needs files outside the assignment, stop and report the exact blocker. Do not bypass checks or invent acceptance evidence. Do not expand into a later phase.

Prioritize a complete observable behavior over code volume. Reuse existing systems, remove redundant code when safe, and avoid speculative features and unrelated refactors. No line-count target applies. Read only the assigned game and relevant local patterns; avoid repeated whole-repository narration.

Run `python3 tools/build_registry.py`, include the exact generated registry with the game change, then run `python3 tools/preflight.py`, inspect its actual result, and demonstrate the brief's behavioral checks. Record what changed, commands/results, and checks not run in the PR. Passing static checks does not prove gameplay, touch hardware, or customer acceptance. Open one PR; retain and repair that PR if bounded gate feedback arrives. Never close or replace it merely to reset a failed check.
