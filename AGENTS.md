# LFS_TrashArcade — 10-Session Autonomous Offline Arcade (`AGENTS.md`)

A self-expanding arcade of 100% offline HTML5 games built through a **10-Session Phased Assembly Pipeline**. A Jules factory launches one session every 15 minutes (`96 sessions/day`); each game is constructed across **10 sequential sessions (`Phase 1` -> `Phase 10`)**, verified by a tamper-proof static + headless Chrome runtime gate, and merged automatically.

## 1. AUTONOMOUS SESSION PROTOCOL (follow exactly; never ask questions, decide and ship)

1. **Sync.** `git fetch --unshallow origin || true`, then `git fetch origin main && git rebase origin/main`.
2. **Read your brief.** Your task prompt contains a `SESSION DESIGN BRIEF` from the factory. Never re-roll or renumber.
   * **Mode A — `PHASE 1 OF 10` (New Game):** Create a new folder `games/<id>-<kebab-case-title>/` (`slug` max 48 chars) containing `index.html`, `game.json` with `"phase": "1"`, and optional `*.js` / `*.css` loaded via `<script defer src="./file.js"></script>`. Must contain at least `450` non-empty JS lines.
   * **Mode B — `PHASE 2..10 OF 10` (In-Place Expansion):** Open the existing folder `games/<slug>/` specified in your brief. Read all existing files (`index.html`, `game.json`, `*.js`, `*.css`) first. Implement your assigned Phase deliverable by expanding existing scripts or adding a new modular `<script defer src="./module.js"></script>` file inside `games/<slug>/`. Increment `"phase"` in `games/<slug>/game.json` to your assigned target phase string (`"2"`..`"10"`), preserving `id`, `slug`, `genre`, `coreMechanic`, and `setting` verbatim. You must add at least `+120` net non-empty lines of working JavaScript (`+60` for Phase 10) and meet the phase's minimum JS line threshold.
3. **Zero Stubs & Runtime Playability.** Never leave `// TODO`, `// FIXME`, `// To be implemented`, or `// placeholder` comments. Every phase (`1` through `10`) must leave the game 100% playable and free of `Uncaught TypeError` / `ReferenceError` exceptions on both the `TITLE` screen and during `PLAYING` state (`check_games.py` boots your game in headless Chrome and fails on any uncaught error).
4. **Touch nothing else.** Do not edit `games/registry.js` (generated automatically after merge), root `index.html`, `tools/`, `factory/`, `.github/`, `AGENTS.md`, or any other game folder.
5. **Commit** (message: `game(<slug>): phase <N>/10`), then **verify:** `python3 tools/preflight.py`. Fix every error it reports, re-commit, re-run until it prints `PREFLIGHT OK`.
6. **Submit** by opening the pull request. Final reply: just `<slug> phase <N>/10`.

## 2. THE 10-PHASE ASSEMBLY PIPELINE

Each game (`id >= 052`) compounds across 10 focused sessions (`factory/axes.json` defines the exact phase targets):
* **Phase 1 (`>=450` JS lines):** Core playable foundation, responsive Canvas + `ResizeObserver`, unified `InputManager`, `SaveManager`, `SoundEngine`, and playable Axis A x Axis B core loop.
* **Phase 2 (`>=600` JS lines):** Player mastery, secondary tactical ability/dash/overdrive with cooldown HUD, multi-part procedural vector player rig & reactive animations.
* **Phase 3 (`>=750` JS lines):** Procedural world & setting (`Axis C`), 3+ animated parallax layers, and interactive environmental hazards/obstacles.
* **Phase 4 (`>=900` JS lines):** Enemy roster expanded to 5+ distinct archetypes with unique procedural vector silhouettes, attack telegraphs, and AI state machines.
* **Phase 5 (`>=1050` JS lines):** Multi-phase Boss encounters (every 5th wave) with animated boss health bars, warning banners, phase transitions at 50% HP, and bespoke bullet/hazard patterns.
* **Phase 6 (`>=1200` JS lines):** Wave director, combo multiplier decay bar, field pickups, and a between-wave **Upgrade / Perk Draft** (choose 1 of 3 randomized build upgrades from a pool of 8+ perks).
* **Phase 7 (`>=1350` JS lines):** High-impact arcade juice: directional particle emitters, hit-stop freeze frames, configurable screen shake, floating damage/combo text, and motion trails.
* **Phase 8 (`>=1500` JS lines):** Multi-voice procedural Web Audio synthesizer: adaptive background synth/arp + percussion loop that intensifies during Boss waves, plus 10+ distinct procedural SFX.
* **Phase 9 (`>=1650` JS lines):** Complete accessibility & UX: Master Mute + SFX/Music sliders, Screen Shake (100%/50%/Off), Particles (High/Low), **High-Contrast/Colorblind palette mode**, **live FPS counter**, Touch Controls (Auto/Always/Off + Left/Right handedness swap), Base64 Save Export/Import + 2-step Reset, and **6 earnable Milestones/Badges**.
* **Phase 10 (`>=1750` JS lines):** Final integration, difficulty curve & hitbox tuning, Wave 1 interactive tutorial prompt, edge-case QA, and graduation to `"phase": "10"`.

## 3. GAME LAWS (zero exceptions across all phases)

### 3.1 100% offline, zero external dependencies
* Strictly vanilla HTML5, CSS3 and ES6+ JavaScript. No external URLs (`http://`, `https://`, `//`): no web fonts, CDNs, external images or audio, no npm runtime packages.
* Must run identically via `file://` and from a static server. Never use `<script type="module">`, `import()`, `fetch()` or `XMLHttpRequest`.

### 3.2 Procedural graphics, Web Audio & cross-device input
* Render everything procedurally with Canvas 2D + inline SVG icons.
* `SoundEngine` on `AudioContext` / `webkitAudioContext` resumed on first `pointerdown`/`keydown`, routed through master/SFX/music gain nodes.
* `ResizeObserver` viewport scaling (320x568 up to 3840x2160) + unified `InputManager` (WASD/Arrows/Space/Mouse + virtual Touch controls with `touch-action: none`).
* `requestAnimationFrame` with `dt = Math.min((now - lastTime) / 1000, 0.1)`, auto-pausing on `visibilitychange` and window `blur`.

### 3.3 States, UI & `SaveManager` persistence
* States: `TITLE`, `PLAYING`, `PAUSED`, `GAME_OVER` (plus optional `UPGRADE` / `HOW_TO_PLAY` / `OPTIONS` overlays).
* Include `Back to Arcade` (`../../index.html`) on Title and Pause screens.
* Store all `localStorage` data under `arcade_game_<id>_<slug>_v1` wrapped in `try/catch` with in-memory fallback (`highScore`, `bestWaveOrCombo`, `totalGamesPlayed`, `totalScoreAccumulated`, `unlockedMilestones`, `options`).

## 4. `game.json` manifest (exact keys, all strings)

```json
{
  "id": "052",
  "slug": "052-scrap-orbit",
  "title": "Scrap Orbit",
  "genre": "<Axis A string from your brief, verbatim>",
  "coreMechanic": "<Axis B string from your brief, verbatim>",
  "setting": "<Axis C string from your brief, verbatim>",
  "description": "1-2 sentence pitch (10-300 chars).",
  "controls": "Desktop and touch summary (5-300 chars).",
  "createdAt": "YYYY-MM-DD",
  "accentColor": "#RRGGBB",
  "phase": "1"
}
```
The `"phase"` string (`"1"` through `"10"`) tracks the game's progress through the 10-session assembly pipeline.
