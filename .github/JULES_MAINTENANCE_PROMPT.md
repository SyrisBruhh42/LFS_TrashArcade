# Bounded maintenance assignment template

Status: reviewed design template; the current picker does not automatically select it. Fill every field and admit the task through the authoritative owner/budget record before submitting it. A template is not authorization to launch a session. Do not launch a task for an already repaired incident.

```text
TASK {task_id}; INCIDENT {incident_id}; TYPE {defect_repair|ux_improvement}
Repository: {owner/repository}
Assigned folder: games/{id-slug}/
Observed main: {sha}; current phase: {phase}; preserve phase and identity.
Actual checkout: record its SHA before editing; reconcile any mismatch.
Repair owner/channel: {native_ci|controller_message|owner_review}
Attempt and time allowance: {admitted limits}; stop on exhaustion.

Problem: {one specific observed failure or user friction}
Expected behavior: {observable result}
Evidence: {trusted report URL/path, tested SHA, scenario ID, artifact hash}
Reproduce: {ordinary input steps, viewport, fixture/seed}
Protected behavior: {working controls, save format and game identity}
Acceptance: {named repro plus neighboring regression and player journey}
Expectation owner: {trusted reviewer/fixture reference}

Read AGENTS.md and the assigned files. Reproduce before editing. If the
failure does not reproduce or evidence is stale/unavailable, report the
discrepancy and stop; a no-change result is acceptable.

Make the smallest coherent repair within the assigned folder. Do not
change another game, launcher, controller, CI, governance or trusted tests.
The sole external-file exception is exact games/registry.js output from
python3 tools/build_registry.py. Preserve phase and save compatibility.
If an essential regression requires a protected test file, provide its
proposed scenario/fixture in the PR for the trusted reviewer; do not grant
yourself test-writing authority outside the assigned path.

Verify the original reproduction and the named regressions. Use normal
keyboard/pointer/touch-emulated inputs through browser hit testing and
focus. Assert gameplay effects, reachable menus and recovery, not only
input events. Check title/start, pause/resume, restart and Back as relevant.
For changed controls, check release/cancel/blur and the specified layouts.
For imports, reject invalid data and retain the prior working save.

Record actual checkout/tested SHA, commands, exit codes, tool versions,
viewports, scenario outcomes and useful before/after screenshots. Keep
browser emulation, physical-device testing and audible output distinct.
Never claim unrun checks or edit acceptance code to make a result pass.

Preserve changes before synchronizing. Reconcile current main without
force-pushing. Generate registry, commit the intended changes, then run:
python3 tools/preflight.py --base origin/main --head HEAD --mode maintenance
If main/head changes, invalidate old integration evidence and recheck.

Open or update one maintenance PR with task/incident IDs and evidence.
Request the arcade:maintenance review lane; no automatic merge or release.
If an admitted existing PR/session owns this repair, keep that PR. Do not
create a replacement to reset failures. If native repair is already
working, report that activity rather than starting competing work.

Stop on scope expansion, unknown ownership, unavailable dependencies,
ambiguous provider delivery or exhausted budget. Return a concise result:
implemented behavior; exact evidence; unresolved/unrun checks; PR identity.
Merge is intermediate: the incident owner closes only after independent
verification of the merged main revision and the required user journey.
```

For a usability assignment, replace vague “professional overhaul” language with one journey and measurable friction: for example, “resume the existing run after app switching using a visible touch control, without firing or losing progress.” A visual redesign or shared launcher change needs its own reviewed assignment and acceptance examples.
