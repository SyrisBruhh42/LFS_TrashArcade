# LFS TrashArcade

An offline HTML5 arcade with a bounded Jules game-development factory. Open `index.html` to browse games. Games use local assets and procedural graphics/audio.

The controller assigns one game and one phase or reviewed repair incident, preserves uncertain provider operations for reconciliation, and checks current account inventory before paid work. Phase generation requires accepted main-source evidence; narrowly reviewed maintenance can repair a failed main check. Browser coverage combines every-game startup checks with named input journeys for selected games; phase completion and merge counts do not establish customer or production quality.

- [Contributor contract](AGENTS.md)
- [Factory operations and recoverable rollout](docs/FACTORY-OPERATIONS.md)
- [Research, design choices and remaining limitations](docs/FACTORY-DESIGN.md)
- [Repair qualification](docs/REPAIR-QUALIFICATION.md)
- [Historical adversarial audit and five-day activity census](docs/ADVERSARIAL-AUDIT-2026-10-24.md)

Local validation requires Python 3.10+, Node 22+ and sandbox-capable Chrome/Chromium. No npm dependencies are needed.

```sh
python3 -m unittest discover -s tests -v
node --test tests/*.cjs
python3 tools/check_games.py --strict --all-runtime --check-registry --report /tmp/arcade-evidence.json
```

For a committed one-game phase PR, use `python3 tools/preflight.py --base origin/main --head HEAD`. Same-phase repairs require `--mode maintenance --incident-id ID --incident-spec HASH` and a matching reviewed incident catalog entry; see the operations guide. Infrastructure changes need review and full checks. Generation and local automatic integration default to disabled during release qualification.

---

## Legal, Licensing, Credits & Security

* **License**: [`LICENSE`](./LICENSE) — Copyright (c) 2026 SyrisBruhh42. All Rights Reserved.
* **Legal & IP Notice**: [`LEGAL.md`](./LEGAL.md) & [`NOTICE`](./NOTICE) — Intellectual property reservation, warranty disclaimer, and compliance terms.
* **Open-Source & Font Attributions**: [`CREDITS.md`](./CREDITS.md) — Third-party engine, runtime, and SIL Open Font License 1.1 typography credits.
* **Security Policy**: [`SECURITY.md`](./SECURITY.md) — Zero-Trust security invariants and private vulnerability disclosure policy.
