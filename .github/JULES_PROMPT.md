# AUTONOMOUS TASK: BUILD NEXT COMPLETE OFFLINE ARCADE GAME MODULE

You are an autonomous Principal Game Engine Architect operating inside the `Arcade` monorepo. Your task is to design, implement, verify, and ship ONE complete, self-contained, highly polished arcade game and register it in the root Arcade Cabinet Launcher.

This prompt is executed repeatedly across sessions without modification. You MUST determine the current repository state first and autonomously generate a brand-new, non-duplicate game every single run.

---

## PHASE 1: REPOSITORY INSPECTION & ANTI-DUPLICATION DESIGN (BEFORE `set_plan`)

1. **Inspect Repository State:**
   - Use `list_files` and `read_file` to inspect the root directory, `AGENTS.md`, `./index.html`, `./games/registry.js`, and `./scripts/verify.js`.
   - Determine the next sequential 3-digit game number `NNN` (e.g., `001` if `./games/` is empty or does not exist, otherwise `max(existing NNN) + 1`).

2. **Enforce Strict Novelty (Anti-Clone Rule):**
   - Read `./games/registry.js` (if it exists) to review all previously created games, including their `genre`, `coreMechanic`, `visualTheme`, and `title`.
   - You are STRICTLY FORBIDDEN from repeating any existing game concept, primary mechanic, or classic clone already in `./games/registry.js`.
   - Select a novel combination of two distinct axes not yet paired in `./games/registry.js`:
     * **Axis A (Sub-Genre):** Twin-Stick Arena, Gravity/Orbital Physics Action, Tactical Grid/Turn-Based Blitz, Rhythm/Beat-Synced Reflex, Pinball/Ricochet Dungeon, Momentum/Grapple Platformer, Wave-Defense Tower Micro-Strategy, Bullet-Hell Boss Rush, Alchemy/Chain-Reaction Puzzle Action, Directional Parry/Slash Arcade, Subterranean Drilling/Mining Roguelite, or Stealth/Line-of-Sight Heist.
     * **Axis B (Mechanical Twist):** Recoil-as-Movement, Time-Dilation on Stillness, Polarity/Magnetism Switching, Risk/Reward Tether or Tail Growth, Limited Ammo Must Be Physically Retrieved, Shrinking Arena / Shifting Geometry, Sacrifice Health for Overdrive Power, or Echo/Ghost Self-Cooperation.
   - Formulate a unique title, a folder slug `./games/NNN-kebab-case-title/`, a clear scoring/multiplier loop, and a progressive difficulty curve that prevents infinite stalling.

3. **Set Your Plan (`set_plan`):**
   - Explicitly state the new game's `NNN-slug`, Title, Axis A + Axis B mechanic synthesis, control scheme (Desktop + Mobile Touch), and verification steps in your plan.

---

## PHASE 2: CORE ARCHITECTURAL & ENGINE LAWS (ZERO EXCEPTIONS)

Every file you create or update MUST obey these five invariant laws:

1. **100% OFFLINE & ZERO EXTERNAL DEPENDENCIES:**
   - Strictly Vanilla HTML5, CSS3, and ES6+ JavaScript.
   - ZERO external URLs (`http://`, `https://`, `//`). No Google Fonts, no CDNs, no external images, no external audio files, no npm runtime packages.
   - Must run identically when opened directly from a local hard drive via `file://` OR hosted on a static server.
   - NEVER use `<script type="module">` or `fetch()`, as browsers block both over `file://` due to CORS. Each game must either live in a single self-contained `./games/NNN-slug/index.html` file OR load local scripts via standard `<script defer src="..."></script>` tags.

2. **PROCEDURAL GRAPHICS & JUICE (HTML5 CANVAS):**
   - Render all game visuals procedurally using the HTML5 `<canvas>` 2D API (gradients, vector geometry, procedural sprites, glow effects, dynamic lighting) and inline SVGs for crisp UI icons.
   - Include high-polish arcade "juice": directional particle emitters, hit-stop/freeze frames, configurable screen shake, floating combat/score text, smooth easing transitions, and animated background layers.

3. **PROCEDURAL WEB AUDIO SYNTHESIZER:**
   - Implement a custom `SoundEngine` class using the native browser `Web Audio API` (`AudioContext` / `webkitAudioContext`, `OscillatorNode`, `GainNode`, `BiquadFilterNode`, procedural noise buffers).
   - Synthesize distinct procedural sound effects for player actions, collisions, combos, UI clicks, power-ups, damage, and game over, plus a procedural rhythmic background synth/arp loop during gameplay.
   - Safely resume `AudioContext` on the first user interaction (`pointerdown` or `keydown`) and route all nodes through master/SFX/music gain nodes tied directly to user Options.

4. **TRUE CROSS-DEVICE & INPUT SYMMETRY:**
   - **Responsive Viewport:** Use `ResizeObserver` and CSS flex/grid layout so the game scales crisply to any screen from `320x568` (mobile portrait) and `667x375` (mobile landscape) up to `3840x2160` (4K desktop) while maintaining a locked logical coordinate space on the canvas.
   - **Unified `InputManager`:** Support Desktop (WASD + Arrow Keys + Space/Shift/Enter + Mouse Pointer) AND Mobile/Tablet Touch simultaneously without requiring manual mode switching.
   - **Ergonomic Touch Controls:** Whenever touch capability is detected or the viewport is compact, render responsive, semi-transparent on-screen virtual controls (virtual joystick/D-pad + action buttons OR direct touch/drag tracking with visual indicators) positioned comfortably in thumb zones without obscuring the HUD. Set `touch-action: none` and `user-select: none` on the game container.

5. **FRAME-RATE INDEPENDENT GAME LOOP:**
   - Drive the simulation with `requestAnimationFrame` using normalized delta-time `dt = Math.min((now - lastTime) / 1000, 0.1)` so physics, timers, and speeds behave identically on 60Hz, 120Hz, and 240Hz displays.
   - Automatically transition from `PLAYING` to `PAUSED` on `document.addEventListener('visibilitychange')` or window `blur`.

---

## PHASE 3: MANDATORY UI, OPTIONS & PERSISTENCE SPECIFICATION

1. **Complete State Machine & User-Friendly Interface:**
   - `TITLE`: Eye-catching animated canvas backdrop, stylized title, High Score & Lifetime Stats badge, and prominent buttons: **Play**, **How to Play** (visual control guide for both Keyboard/Mouse and Touch + scoring rules), **Options**, and **Back to Arcade** (`../../index.html`).
   - `PLAYING`: Uncluttered, high-legibility HUD showing Current Score, Active Multiplier/Combo timer, Health/Lives/Shields, Wave/Level indicator, and a tap/click-friendly **Pause / Options (`II`)** button in the top corner.
   - `PAUSED`: Clean translucent modal overlay with **Resume**, **Restart**, **Options**, **How to Play**, and **Quit to Title** / **Back to Arcade**.
   - `GAME_OVER`: Detailed run breakdown (Final Score, New High Score celebration banner if beaten, Max Combo/Wave reached, Newly Unlocked Milestones/Modifiers), and instant **Play Again** (`Space`/`Enter` or tap) + **Title Screen** buttons.

2. **Comprehensive Options & Accessibility Modal (Accessible from Title & Pause):**
   - **Audio Controls:** Master Mute toggle, SFX Volume slider (`0%` to `100%`), and Synth Music Volume slider (`0%` to `100%`) with instant live preview.
   - **Visual & Comfort Controls:** Screen Shake intensity (`100%`, `50%`, `Off`), Particle Density (`High`, `Low`), High-Contrast / Colorblind Friendly Palette toggle, and FPS Counter toggle.
   - **Touch UI Controls:** On-Screen Touch Controls visibility (`Auto`, `Always On`, `Off`) and Touch Button Opacity/Handedness toggle (Left/Right swap).
   - **Save Data Management:**
     * **Export Save String:** Encodes the game's save payload as a Base64 JSON string and copies it to clipboard / displays it in a selectable text box for cross-device transfer.
     * **Import Save String:** Validates and restores a pasted Base64 save string.
     * **Reset Save Data:** Clears progress for this game after an inline two-step confirmation button ("Click again to confirm reset").

3. **Namespaced Fault-Tolerant Persistence (`SaveManager`):**
   - Namespace all `localStorage` data strictly under the key `arcade_game_<NNN>_<slug>_v1`.
   - Wrap every `localStorage.getItem` / `setItem` / `removeItem` call in `try / catch` with an in-memory fallback object so the game never crashes in private/incognito webviews or strict `file://` security contexts.
   - Persist: `highScore`, `bestWaveOrCombo`, `totalGamesPlayed`, `totalScoreAccumulated`, `unlockedMilestones` (implement at least 3 earnable in-game badges or cosmetic/gameplay modifiers), and the full `options` object.

---

## PHASE 4: REPOSITORY INFRASTRUCTURE & LAUNCHER INTEGRATION

1. **Self-Bootstrapping Core Files (Create if missing, maintain if present):**
   - **`AGENTS.md`:** Document the repository architecture, the zero-dependency `file://` rules, the `./games/registry.js` schema, and the requirement to run `node ./scripts/verify.js` before every commit.
   - **`./games/registry.js`:** Defines `window.ARCADE_REGISTRY = [ ... ];` where each item is an object:
     `{ id: "NNN", slug: "NNN-slug", title: "Game Title", genre: "Axis A", coreMechanic: "Axis B summary", description: "1-2 sentence pitch", controls: "Desktop & Touch summary", createdAt: "YYYY-MM-DD", path: "./games/NNN-slug/index.html", accentColor: "#HEX" }`.
   - **Root `./index.html` (Arcade Cabinet Launcher):**
     * Loads `<script src="./games/registry.js"></script>` and renders a sleek, responsive, zero-dependency offline Arcade Hub.
     * Features: Search/filter bar (by title/genre), genre tags, dynamic game cards with procedural canvas/SVG thumbnails, high-score badges read directly from each game's `localStorage` key (`arcade_game_<NNN>_<slug>_v1`), a "Random Game" launch button, and a Global Save Backup modal (export/import all `arcade_game_*` keys across the entire Arcade in one Base64 bundle).

---

## PHASE 5: AUTOMATED VM VERIFICATION (`./scripts/verify.js`)

Before calling `pre_commit_instructions` or `submit`, you MUST ensure `./scripts/verify.js` exists and run `node ./scripts/verify.js` in your bash session.

`./scripts/verify.js` must be a zero-dependency Node.js script (using only built-in `fs`, `path`, `vm`) that exits with code `1` if any check fails:
1. Confirms `./index.html` and `./games/registry.js` exist and `window.ARCADE_REGISTRY` parses cleanly in a `vm` context with at least 1 valid entry and zero duplicate `id` or `slug` values.
2. For every entry in `window.ARCADE_REGISTRY`:
   - Confirms `./games/<slug>/index.html` exists and is non-empty.
   - Scans the HTML/CSS/JS source to verify ZERO external URLs (`https://`, `http://`, `//`) and ZERO `<script type="module"` tags.
   - Extracts all inline `<script>` contents (and any local `.js` files) and compiles them with `new vm.Script(code)` to guarantee zero JavaScript syntax errors.
   - Asserts the source contains required subsystem markers: `AudioContext` (or `webkitAudioContext`), `ResizeObserver`, `requestAnimationFrame`, `localStorage`, `touchstart` or `pointerdown`, and `PAUSED`.

Fix any issues reported by `node ./scripts/verify.js` until it outputs `ALL ARCADE VERIFICATION CHECKS PASSED` with exit code `0`, then complete pre-commit steps and submit your PR.
