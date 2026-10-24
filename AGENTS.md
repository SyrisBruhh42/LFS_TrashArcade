# LFS TrashArcade contributor contract

This repository contains offline HTML5 games and their autonomous Jules controller. Prefer small, complete behavior changes. Code volume, phase numbers and green CI are not evidence of game quality or production acceptance.

## Assigned game sessions

1. Read the exact factory brief, this file, and all files in the assigned game folder. Preserve its identity and working features. The brief's observed base SHA is evidence, not a provider guarantee that Jules cloned that commit.
2. Work only in the assigned `games/<id>-<slug>/` folder. Follow the assigned phase and acceptance checks in `factory/axes.json`; do not invent another ID, reroll the design, or pad code to meet a line count. Use the fewest modules needed to implement the behavior clearly.
3. Keep every phase playable. New games (ID 086 onward) expose `window.game.state` with `TITLE` and `PLAYING`, and start through Enter on the title screen. The trusted browser gate drives this ordinary input; never add gate-specific behavior or fabricate acceptance output. Older games use explicit trusted adapters.
4. Keep the arcade offline: vanilla HTML/CSS/JavaScript, local relative scripts and styles, procedural graphics/audio, no remote dependencies, modules, network fetches or build tools. Support static serving and local-file use. All persistence access needs a recoverable in-memory fallback.
5. Check the actual feature: state transitions, input, resize, pause/resume, restart, options and persistence as applicable. A title/start smoke alone does not validate combat, touch ergonomics, audio mix, long sessions or release readiness. Report failed and unrun checks honestly.
6. Preserve local edits before updating your branch. Fetch current main explicitly, reconcile it without force-pushing, then run `python3 tools/build_registry.py`. Include its exact generated `games/registry.js` output in the same commit as manifest changes. Do not edit the registry by hand. Do not change other games, root launcher, controller, workflow or this contract from a game session.
7. Commit the intended change. Run `python3 tools/preflight.py --base origin/main --head HEAD`. It requires a clean committed checkout and a real browser; static-only validation is insufficient. Fix reported defects, commit, and recheck. Rebase and regenerate the registry when main advances.
8. Open a PR describing the behavior, checks and remaining limitations. Stop on ambiguous requirements outside the authorized game scope. Never approve your own infrastructure change, modify CI to pass, or claim release/device proof from local tests.

## Maintenance and infrastructure

Same-phase bug repairs are allowed for every game, including legacy IDs and phase 10. Use `--mode maintenance` for local preflight and request the `arcade:maintenance` review lane. This lane needs owner review and never auto-merges. Infrastructure changes require owner authorship, the `arcade:infrastructure` label, source review, and full regression/catalog checks. Neither lane grants deployment authority.

## Runtime and product conventions

Use a bounded `requestAnimationFrame` delta, explicit TITLE/PLAYING/PAUSED/GAME_OVER states, visibility/blur pausing, responsive canvas scaling, keyboard/mouse and touch input, and `Back to Arcade` navigation. Audio must resume on user interaction and route independent SFX/music controls through their gain nodes. Save imports must validate shape before replacing state; reset must not rewrite the previous save. Describe controls that actually work.

Manifests retain string fields `id`, `slug`, `title`, `genre`, `coreMechanic`, `setting`, `description`, `controls`, `createdAt`, `accentColor`, plus string `phase` for phased games. IDs and folders must agree. Phase progression changes only one step and preserves identity fields. Phase 10 records completion of the planned sequence; it does not certify production quality.

## Controller operations

See `docs/FACTORY-OPERATIONS.md` before controller installation or provider work. Keep credentials out of source, prompts and logs. Pinned controller releases, durable launch intents, account-wide budget checks, exact-main acceptance and recoverable state are required. An uncertain session creation is a hold, never permission to retry. Repository publication does not authorize service activation, main merges, quota changes or a provider session.
