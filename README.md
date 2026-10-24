# LFS TrashArcade

An offline HTML5 arcade with a bounded Jules game-development factory. Open `index.html` to browse games. Games use local assets and procedural graphics/audio.

The controller assigns one game and one phase, preserves uncertain provider operations for reconciliation, and admits new work only against current account inventory and accepted main-source evidence. Browser checks are bounded smoke tests; phase completion and merge counts do not establish customer or production quality.

- [Contributor contract](AGENTS.md)
- [Factory operations and recoverable rollout](docs/FACTORY-OPERATIONS.md)
- [Research, design choices and remaining limitations](docs/FACTORY-DESIGN.md)
- [Repair qualification](docs/REPAIR-QUALIFICATION.md)

Local validation requires Python 3.10+, Node 22+ and sandbox-capable Chrome/Chromium. No npm dependencies are needed.

```sh
python3 -m unittest discover -s tests -v
node --test tests/*.cjs
python3 tools/check_games.py --strict --all-runtime --check-registry --report /tmp/arcade-evidence.json
```

For a committed one-game PR, use `python3 tools/preflight.py --base origin/main --head HEAD`. Use `--mode maintenance` for a same-phase repair. Infrastructure changes need review and full checks.
