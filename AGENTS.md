# LFS_TrashArcade — Autonomous Offline Arcade Monorepo (`AGENTS.md`)

## 1. Repository Architecture

```
.
├── AGENTS.md                        # Architectural contracts & verification rules
├── index.html                       # Root Offline Arcade Cabinet Launcher
├── games/
│   ├── registry.js                  # Defines window.ARCADE_REGISTRY = [ ... ]
│   └── NNN-kebab-case-title/
│       └── index.html               # Self-contained offline HTML5 Canvas + Web Audio game
└── scripts/
    ├── verify.js                    # Zero-dependency Node.js VM & invariant verifier
    └── auto_merge_arcade.js         # Conflict-free PR reconciliation & auto-merge engine
```

## 2. Core Invariant Laws (Zero Exceptions)

1. **100% Offline & `file://` Compatible:**
   - Strictly Vanilla HTML5, CSS3, and ES6+ JavaScript.
   - ZERO external URLs (`http://`, `https://`, or protocol-relative `//`).
   - ZERO `<script type="module">` tags and ZERO `fetch()` calls so every game and the root launcher work directly over `file://` as well as static HTTP servers.
2. **Procedural Graphics & Web Audio:**
   - All visuals rendered procedurally via HTML5 `<canvas>` 2D and inline SVGs.
   - All audio synthesized procedurally via `AudioContext` / `webkitAudioContext`.
3. **Cross-Device Responsive & Input Symmetry:**
   - Uses `ResizeObserver` for responsive viewport scaling.
   - Unified desktop keyboard/mouse and mobile `touchstart` / `pointerdown` virtual controls.
   - Delta-time normalized `requestAnimationFrame` loop with automatic transition to `PAUSED` on `visibilitychange` / window `blur`.
4. **Namespaced Fault-Tolerant Persistence:**
   - All `localStorage` calls wrapped in `try / catch` under key `arcade_game_<NNN>_<slug>_v1`.

## 3. `./games/registry.js` Schema

`./games/registry.js` defines `window.ARCADE_REGISTRY = [ ... ];` where each item has the schema:

```js
{
  id: "NNN",
  slug: "NNN-kebab-case-title",
  title: "Game Title",
  genre: "Axis A Sub-Genre",
  coreMechanic: "Axis B Mechanical Twist",
  description: "1-2 sentence pitch",
  controls: "Desktop & Touch summary",
  createdAt: "YYYY-MM-DD",
  path: "./games/NNN-kebab-case-title/index.html",
  accentColor: "#HEX"
}
```

## 4. Mandatory Pre-Commit Verification

Before committing or submitting any PR, you MUST run:

```bash
node ./scripts/verify.js
```

and confirm it outputs `ALL ARCADE VERIFICATION CHECKS PASSED` with exit code `0`.
