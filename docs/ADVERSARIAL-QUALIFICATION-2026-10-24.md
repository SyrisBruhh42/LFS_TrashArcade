# Adversarial repair qualification — 2026-10-24

**Historical checkpoint:** this receipt remains bound to `e2caaa4`. Later implementation and qualification do not change its results or unrun checks. Consult [Factory operations](FACTORY-OPERATIONS.md) for the current source contract and fresh external readbacks for deployment state.

**Status: bounded local source qualification passed. No live provider, hosted workflow, installation, deployment or release qualification.**

Tested clean source: `e2caaa4c9603cdea3da249c8e280d05e08d36041`, branch `codex/repair-jules-pipeline-20261024`. Incoming main was reconciled through `0b14fff4649de68a3eb8e244b54e8f913b3b7e83` at local merge checkpoint `dd24a78`. The receipt itself and final audit clarifications are subsequent documentation-only changes.

## Implemented repairs

- Controller: validate real empty-association GitHub run records using independent attestations; keep provider-active game assignments occupied after merge/closure; adopt late outputs and rediscovered open PRs while retaining outcome history; retry only proven-unsent admission attempts; preserve ambiguous-request holds.
- Efficiency without lost ownership: rotate one historical failed PR per tick, then completely recheck the selected game's failed-PR history before reassignment, bounded at 20 records. Reopened, uncertain or over-limit histories hold. Main revision and account-observation freshness are rechecked before POST. This is not a distributed reservation across other actors.
- 083: fix options frame ordering; separate physical/virtual controls; clear release/cancel/blur/hidden input; suppress held-key autorepeat after clearing; make D-pad direction and Dash heading match their controls; validate and persist imports before replacing live data, preserving the prior save on invalid input or storage failure.
- 084: implement touch movement/aim, visible semantic Pause/Resume and Dash controls, normal keyboard activation, consumed transition gestures and corrected control descriptions; preserve phase5 bosses. Remove the viewport zoom prohibition, without claiming full accessibility compliance.
- 085: resume after blur with a fresh tap/click, consume the resume action, clear stale input and reject autorepeat; reconcile phase3 hazards/parallax with the existing cooldown/particle repairs without a duplicate Particle class or double particle update.
- Added an inert maintenance prompt and a proposed task/incident cycle. **No maintenance dispatcher, stale-PR convergence engine or automatic incident closure was implemented.**

## Final checks

| Check | Result | Boundary |
|---|---|---|
| Python suite | **166 passed**, including 72 dispatcher cases and real-Chrome fault tests | Fixtures/local process evidence; no paid provider calls |
| Direct Node test files | **61 passed**, zero skipped: 21 game083, 8 game084, 14 earlier gameplay, 12 input/integration, 6 legacy | Deterministic production-class fixtures plus five legacy browser startups; mocks do not establish hardware/audio behavior |
| Strict catalog/static + registry | **85 games; zero errors/warnings** | Static evidence only |
| Changed-game browser smoke | **083, 084, 085 passed** | TITLE/start/short PLAYING observation and captured errors |
| Chromium input journeys | **3 passed**, no captured page errors | Normal browser key/touch/click inputs; touch emulation and explicit blur fault injection |
| Source continuity | Other **82 game folders byte-identical** to prior full 85-game browser audit source `9415dc34d19421b15f12eb3df270f61fa4af3170` | Earlier smoke evidence is retained for those folders, not relabelled as a new full-catalog runtime audit |
| Whitespace/syntax/source state | Passed; tested checkpoint clean | Final subsequent edits are documentation only |
| Hosted Actions / provider / physical devices / audible audio / long-session balance | **NOT RUN** | No acceptance claim |

Browser: Google Chrome `152.0.7977.64`; Node `22.14.0`; Python `3.12.3`. Browser tests retained Chrome sandboxing, used temporary localhost-only serving and isolated profiles, and passed an allowlisted environment without provider/GitHub credentials. Temporary servers/browser processes were closed by the test harness.

The richer journeys verified:

1. 083 opens Options with O, navigates and returns through the normal keyboard menu, starts, moves right from its right D-pad and clears that input on release. Actual player x changed from 400 to approximately 436.66 in the captured run.
2. 084 changes actual player position under touch, activates Dash, preserves position/score while paused, resumes without held input, responds to injected blur, and keeps controls reachable across 390×844 portrait and 844×390 landscape. Escape pause/resume also passes.
3. 085 resumes after injected blur without spending ammunition, then a fresh tap fires an actual projectile.

Screenshots were visually inspected for 083 Options and 084 portrait pause controls. This is bounded layout evidence, not a portfolio-wide UX or accessibility certification. Game-over journeys, long sessions, every option and every physical input device were not comprehensively qualified.

## Falsification and retained failures

- Six original controller failure/missing-capability reproductions replay successfully against archived `6c9e25f` source. They demonstrate the old behaviors; candidate regressions assert corrected behavior for the repaired subset.
- 083 transactional/options/input tests failed 13/14 on the initial baseline, with the valid milestone roundtrip also passing baseline. Subsequent autorepeat and directional probes separately falsified their immediate pre-fix source. The final 21-case suite passes.
- 084's same eight tests failed seven cases on `dd24a78` and pass all eight after repair.
- Independent review caught a reopened-PR ownership window in the first bounded-polling draft; the selected-game pre-create guard now covers it, including an open second record outside that tick's archival cohort.
- The first rich Chromium run failed 083's movement direction assertion while 084/085 passed. That failure was retained, the direction conflict repaired, and the combined journeys rerun successfully.
- A restricted-browser attempt failed at localhost binding (`EPERM`) before Chrome launched. A scoped escalation subsequently allowed the bounded local tests. The denial was a sandbox limitation, not a product failure or automatic approval rejection.

Evidence directory: `/home/joe/Documents/Codex/2026-10-24/LFS-TrashArcade-Adversarial-Audit/`. `qualification.json` names source, commands, counts, changed paths and log hashes; `browser-journeys.json` contains the richer input results; `browser-journeys-first-failed.json` preserves the failing run; baseline sources, TAP logs and controller reproductions remain alongside them. Earlier evidence remains in the adjacent Review/Repair folders.

## Remaining holds

The live timer still used the older self-updating controller at readback. This branch has not been pushed, merged remotely, installed or activated. Account allocation and native repair/settings behavior remain unqualified. New PR comments or native CI repair may cause remote work independently of this controller's local message limit or pause.

The proposed maintenance cycle still needs intake/deduplication, explicit repair ownership, scoped red-main admission, stale/conflict convergence, assignment-bound behavioral checks and post-merge acceptance. Existing game PRs do not automatically run the full regression suite before merge. Remaining launcher/save/accessibility issues are listed in the [audit](ADVERSARIAL-AUDIT-2026-10-24.md). Review the [maintenance prompt](../.github/JULES_MAINTENANCE_PROMPT.md) as a task contract, not an operational feature.

Before publication or cutover, refresh current remote main and reconcile any later changes, qualify protection/provider settings and review the controlled transition in [FACTORY-OPERATIONS.md](FACTORY-OPERATIONS.md). Publishing main can affect the existing self-updating service; local qualification does not authorize or prove that transition. No cost or credit savings are claimed without account-consumption evidence.

Final remote readback: `fed9c5bf53fb1474a19b90c02e2ae23ba8503276`, after PR393, is four commits beyond the incorporated main checkpoint. It changes 084 and adds 086. Those changes are not included in this qualification. The candidate is a reproducible reviewed checkpoint, not a claim of readiness to merge onto the moving live branch.
