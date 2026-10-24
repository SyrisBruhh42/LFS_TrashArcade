# Repair qualification — 2026-10-24

Historical checkpoint: the later [adversarial audit](ADVERSARIAL-AUDIT-2026-10-24.md) found controller and input defects outside this test coverage. See its [subsequent qualification](ADVERSARIAL-QUALIFICATION-2026-10-24.md) for the newer repairs and remaining holds. Results below remain evidence only for their named revisions.

**Status: locally qualified source candidate; not activated, published, merged into main or production accepted.**

Qualified source: `7aab8ef27d4a295333a3d6b3fed349edf1ee52cd` on `codex/repair-jules-pipeline-20261024`. Reconciled remote main through `567405654f729374615a6b1792ad23973c6f71ed`, including PR386–389. This document is a subsequent documentation-only checkpoint.

## Results

| Check | Evidence and scope | Result |
|---|---|---|
| Python regression suite | `python3 -m unittest discover -s tests -v`, source `9415dc34d19421b15f12eb3df270f61fa4af3170`; no Python changes afterward | 144 passed; includes real Chrome fault injection |
| Gameplay/input regressions | `node --test tests/*.cjs`, same source; test/game code under these regressions unchanged afterward | 29 passed, zero skipped |
| Complete catalog | `check_games.py --strict --all-runtime --check-registry`, clean exact source `9415dc34d19421b15f12eb3df270f61fa4af3170` | 85/85 browser smoke checks; zero static errors/warnings |
| Final incoming phase change | Only game083 game.js/game.json and generated registry changed from the full-audit source. Exact path guard passed from that source to qualified source; all static checks plus explicit game083 runtime repeated | PASS; other 84 game folders byte-identical by Git diff |
| Syntax/configuration | Python AST, JSON, Bash, Node driver, workflow YAML and explicit permission invariants | PASS |
| Workspace integrity | Clean tracked source at test and qualification checkpoints; whitespace checks | PASS |
| Workflow semantic lint | actionlint absent | NOT RUN; YAML parsing is not equivalent |
| Live provider, installed release and hosted workflow | No paid create/message, installer activation, service change or GitHub mutation performed | NOT RUN |

Environment: Python 3.12.3, Node 22.14.0, Google Chrome 152.0.7977.64. Browser checks keep sandboxing enabled, use bounded localhost assets and isolated profiles, and expose no provider/GitHub credentials. Driver-owned timing/verdict rejects page-forged completion. Observer frames demonstrate browser progress, not proof of every game-loop behavior.

Raw logs, machine-readable full/affected reports, prior failed audits, artifact hashes and a qualification manifest are retained in the delivered local `LFS-TrashArcade-Repair` evidence folder. Local reports explicitly distinguish working-tree investigation from committed-source qualification.

## Implemented repairs

- Durable fsynced create/message intents; complete account inventory; no blind retry after uncertain paid requests; preserved legacy records and explicit recovery holds.
- Shared-account caps/reserves, bounded WIP, main acceptance tied to current SHA and a completed successful Main guard, independent source/controller revisions, bounded repair feedback with verified run provenance.
- Compact scoped behavioral briefs; removed line inflation and repeated generic nudges. Exact generated registry joins the game PR rather than a second post-merge write.
- Explicit exact-base/head game targets, maintenance at all phases, read-only candidate execution, separate trusted feedback/integration, strict protected-base checks and a separate read-only policy capability.
- Recoverable pinned-release installation with separate stage/activate/enable, unit/state backups and retained releases. Tick-time controller fetch/reset removed from newly installed units.
- Gameplay: 005 initialization order; 009 initial title rendering; 042 undefined clock; 045 constructor dependency order; 077 unsafe initial spawn; 080 touch start/restart, save reset and scaled input coordinates; 082 independent SFX/music routing; 085 repeat-fire cooldown, mouse/tap input and missing Phase2 particle lifecycle. Game032 gains a read-only state observation accessor.

Regression falsification includes reproducing the page-forged PASS exploit before redesign, old game080/085 input failures against original source (6 of 7 initial input cases failed), and game077 geometry proving the old spawn lay inside two guards' detection zones. Earlier catalog attempts (54/85 virtual-time, 71/85 initial real-time, 84/85 first isolated-driver) remain failed/partial evidence, not overwritten successes.

## Holds and decision boundary

The existing live timer was still active at final readback and its old installed unit still self-updates from main. This candidate has not repaired that installed service yet. Current main classic protection returned 404 and rulesets were empty. Shared-account budget fields remain deliberately null. Automatic integration remains opt-in and requires live branch-protection and policy-read capability qualification; a passing local test does not provision either.

Before live cutover, approve the account allocation and controlled service transition in [FACTORY-OPERATIONS.md](FACTORY-OPERATIONS.md). Review source before any main merge because the old installed timer could otherwise deploy it automatically. Qualify a small native provider cohort and recovery path before increasing throughput. Device touch/audio, long sessions, game balance and customer acceptance remain separate checks.

No measured token/credit savings are claimed. A deterministic prompt fixture shrank 4.2% by characters; the stronger efficiency mechanisms are avoiding duplicate paid work, reducing rework/WIP, and removing redundant registry commits. Track accepted behavior per session and escaped defects rather than merge count alone. [Research and design rationale](FACTORY-DESIGN.md).
