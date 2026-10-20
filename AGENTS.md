# LFS_TrashArcade — Autonomous Offline Arcade (`AGENTS.md`)

A self-expanding arcade of 100% offline HTML5 games. A Jules factory launches one session every 15 minutes; each session ships **one** new game in its own folder, a tamper-proof gate verifies it against trusted tools from `main`, and merges it automatically.

## 1. AUTONOMOUS SESSION PROTOCOL (follow exactly; never ask questions, decide and ship)

Your job each session: add **one** complete, polished arcade game.

1. **Sync.** `git fetch --unshallow origin || true`, then `git fetch origin main && git rebase origin/main`.
2. **Read your brief.** Your task prompt contains a `SESSION DESIGN BRIEF` from the factory. It assigns your **game id**, Axis A sub-genre, Axis B twist and Axis C setting. Use them exactly; never re-roll or renumber. (Without a brief, run `python3 tools/pick_brief.py`.) Apply any "Recent gate failures to avoid" listed in the prompt.
3. **Learn the ground.** Skim `games/*/game.json` so your title and concept differ from every existing game. Read sections 2-4 below.
4. **Create your folder** `games/<id>-<kebab-case-title>/` (the folder name is your slug, max 48 chars) containing:
   * `index.html`: the whole game (inline CSS/JS), or plus local `*.js` / `*.css` files in the same folder loaded with `<script defer src="./file.js"></script>`.
   * `game.json`: the manifest (section 3).
5. **Touch nothing else.** Do not edit `games/registry.js` (it is generated automatically after merge), the root `index.html`, `tools/`, `factory/`, `.github/`, `AGENTS.md`, or any other game. The gate rejects PRs that do.
6. **Commit** (message: `game: add <slug>`), then **verify:** `python3 tools/preflight.py`. Fix every error it reports, re-commit, re-run. It must print `PREFLIGHT OK`.
   * If an ambitious feature will not validate after 5 honest attempts, simplify it and ship. Never ship nothing, and never touch shared files to force a pass.
7. **Submit** by opening the pull request (in automated sessions it is created for you when you finish). The gate merges passing PRs automatically; failures are closed and fed back to future sessions as lessons. Final reply: just your slug.

## 2. GAME LAWS (zero exceptions)

### 2.1 100% offline, zero external dependencies
* Strictly vanilla HTML5, CSS3 and ES6+ JavaScript. No external URLs (`http://`, `https://`, `//`): no web fonts, CDNs, external images or audio, no npm runtime packages.
* Must run identically from a local drive via `file://` and from a static server. Never use `<script type="module">`, `import()`, `fetch()` or `XMLHttpRequest` (blocked over `file://`).

### 2.2 Procedural graphics and juice (HTML5 Canvas)
* Render everything procedurally with the Canvas 2D API (gradients, vector geometry, procedural sprites, glow, dynamic lighting) plus inline SVG for UI icons.
* Arcade juice: directional particles, hit-stop/freeze frames, configurable screen shake, floating score text, eased transitions, animated background layers.

### 2.3 Procedural Web Audio synthesizer
* A `SoundEngine` class on the Web Audio API (`AudioContext` / `webkitAudioContext`, `OscillatorNode`, `GainNode`, `BiquadFilterNode`, noise buffers).
* Distinct SFX for player actions, collisions, combos, UI clicks, power-ups, damage and game over, plus a rhythmic background synth/arp loop during play.
* Resume the `AudioContext` on the first `pointerdown`/`keydown`; route everything through master / SFX / music gain nodes tied to Options.

### 2.4 Cross-device input symmetry
* `ResizeObserver` + CSS flex/grid so the game scales crisply from 320x568 (portrait phone) and 667x375 (landscape phone) to 3840x2160, with a locked logical coordinate space.
* A unified `InputManager`: WASD + arrows + Space/Shift/Enter + mouse AND touch, simultaneously, no mode switching.
* When touch is detected or the viewport is compact, show semi-transparent virtual controls (joystick/D-pad + buttons, or direct drag with indicators) in thumb zones, clear of the HUD. `touch-action: none` and `user-select: none` on the game container.

### 2.5 Frame-rate-independent loop
* `requestAnimationFrame` with `dt = Math.min((now - lastTime) / 1000, 0.1)`, identical at 60/120/240 Hz.
* Switch `PLAYING` -> `PAUSED` on `visibilitychange` and window `blur`.

### 2.6 States, UI and options
* `TITLE`: animated backdrop, stylized title, high score + lifetime stats, buttons **Play**, **How to Play** (keyboard/mouse and touch guide + scoring), **Options**, **Back to Arcade** (`../../index.html`).
* `PLAYING`: legible HUD (score, multiplier/combo timer, health/lives/shields, wave/level) and a tap-friendly **Pause (`II`)** button.
* `PAUSED`: translucent modal with **Resume**, **Restart**, **Options**, **How to Play**, **Quit to Title** / **Back to Arcade**.
* `GAME_OVER`: run breakdown (final score, new-high-score banner, max combo/wave, newly unlocked milestones), **Play Again** (Space/Enter/tap) and **Title Screen**.
* Options (from Title and Pause): master mute, SFX volume 0-100%, music volume 0-100% (live preview); screen shake 100%/50%/Off; particles High/Low; high-contrast/colorblind palette; FPS counter; touch controls Auto/Always/Off; touch opacity and left/right handedness; **Export Save** (Base64 JSON, copy + selectable box), **Import Save** (validated), **Reset Save** (inline two-step "Click again to confirm reset").

### 2.7 Namespaced fault-tolerant persistence (`SaveManager`)
* All `localStorage` data under exactly `arcade_game_<id>_<slug>_v1` (e.g. `arcade_game_007_007-scrap-orbit_v1`). The launcher reads `highScore` from this key.
* Wrap every `getItem` / `setItem` / `removeItem` in `try/catch` with an in-memory fallback.
* Persist `highScore`, `bestWaveOrCombo`, `totalGamesPlayed`, `totalScoreAccumulated`, `unlockedMilestones` (at least 3 earnable badges or modifiers) and the full `options` object.

### 2.8 Design quality
* Build the brief's three axes into one coherent loop: a clear scoring/multiplier system and a difficulty curve that prevents infinite stalling.

## 3. `game.json` manifest (exact keys, all strings)

```json
{
  "id": "007",
  "slug": "007-scrap-orbit",
  "title": "Scrap Orbit",
  "genre": "<Axis A string from your brief, verbatim>",
  "coreMechanic": "<Axis B string from your brief, verbatim>",
  "setting": "<Axis C string from your brief, verbatim>",
  "description": "1-2 sentence pitch (10-300 chars).",
  "controls": "Desktop and touch summary (5-300 chars).",
  "createdAt": "YYYY-MM-DD",
  "accentColor": "#RRGGBB"
}
```
Allowed values live in `factory/axes.json`. Ids, titles and genre+twist+setting combinations must be unique across all games.

## 4. Repository architecture

```
index.html                     Offline Arcade launcher (loads games/registry.js)
games/registry.js              GENERATED from games/*/game.json after every merge (never edit)
games/NNN-slug/                One folder per game: index.html, game.json, optional *.js/*.css
factory/config.json            Factory knobs (enabled, caps, breakers); edit on main to tune or stop
factory/axes.json              Design axes used for briefs and validation
tools/preflight.py             Run before submitting (path guard + strict check)
tools/check_games.py           Validator used by preflight and the gate
tools/path_guard.py            Rejects anything except one new game folder
tools/build_registry.py        Regenerates games/registry.js
tools/pick_brief.py            Coverage-weighted design briefs
tools/factory_dispatch.py      Factory controller (runs on the host via a systemd user timer)
tools/install_factory.sh       Installs/uninstalls the 15-minute timer
.github/workflows/arcade_gate.yml  Tamper-proof gate + auto-merge + main guard
.github/JULES_PROMPT.md        Base prompt the factory sends with each brief
```

**Operator controls:** set `"enabled": false` in `factory/config.json`, open any issue labelled `factory:pause`, or create `~/.config/lfs-trasharcade-factory/PAUSE`. Close the issue / delete the file to resume.
