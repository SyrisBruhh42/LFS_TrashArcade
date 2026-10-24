# Factory operations and recoverable rollout

This is the operational contract for the implemented controller, migration and release tools. Source review, local tests, hosted checks, installed releases and accepted provider results are separate evidence states.

**2026-10-24 checkpoint, not final cutover:** the operator has paused the old local timer and old GitHub dispatch workflow, preserved recovery data, and migrated retained state with `migration.admission_hold=true`. Revision `4b4f395783dfa30af41fb8d0c04458cabac6ead5` is an earlier qualification checkpoint preceding subsequent UI repairs; it is not evidence that the final candidate is live or accepted. Retain dated audit/qualification documents as historical records. Re-read current source, units, state, provider inventory and GitHub before continuing. Publishing a branch does not replace installed units.

## Admission, ownership and cost boundaries

The candidate defaults to `generation_enabled=false`, `local_integration_enabled=false`, `maintenance_enabled=true`, `repair_owner="native"` and `controller_native_repairs_disabled=false`. The initial pilot is **one reviewed incident with `max_attempts: 1`**. Keep generation and automatic integration disabled until independently authorized and qualified.

`factory/config.json` separates local ceilings (12 active sessions, 96 rolling-day starts, 8 open PRs, 2 unfinished games) from configured shared-account ceilings (60 active, 300 rolling-24-hour starts, reserves of 1 and 5). These are ceilings, not targets or remaining capacity. Reconfirm actual allocation and complete inventory; manual, native, scheduled and other-repository work also consumes account capacity. Session counts, token diagnostics and estimated savings are not billing receipts, refunds or evidence of credits remaining.

With native ownership, the controller observes Jules CI Fixer and does not send competing repair/rebase messages. Its message limits do not cap native repair activity or native billing. Verify native settings separately. Controller-owned feedback requires both `repair_owner="controller"` and `controller_native_repairs_disabled=true` after the operator has actually disabled native automatic repair. Eligible messages require a verified accepted assignment, exact session/source/PR correlation, an eligible active session and trusted exact-head gate evidence. Configured controller bounds are one repair message, one rebase message and at most one repair action per tick. Legacy annotations grant none of this authority.

Every paid create/message persists intent before one POST. Timeout, crash or ambiguous delivery never authorizes a blind retry or replacement. Preserve intents, receipts, session history and holds. The controller does not generically approve plans, answer questions or resurrect terminal sessions. Unknown scope/state, incomplete inventory, uncertain requests, mismatched assignments and unresolved acceptance hold work. Known other-repository work remains counted; reviewed legacy own-repository work retains its game occupancy/quarantine.

## Paths and command effects

Defaults are `$XDG_DATA_HOME/lfs-trasharcade-factory` (normally `~/.local/share/lfs-trasharcade-factory`), `$XDG_STATE_HOME/lfs-trasharcade-factory` (normally `~/.local/state/lfs-trasharcade-factory`) and the stop sentinel `$XDG_CONFIG_HOME/lfs-trasharcade-factory/PAUSE`. A `factory:pause` issue also holds ordinary/reconciliation ticks. The installer defaults to the key **path** `~/.secrets/jules_api_key`; it does not read or modify its contents. Never put credentials in source, prompts or logs.

| Command | Effects and limit |
| --- | --- |
| `python3 tools/factory_dispatch.py --status` | Saved local observations only; no network, writes or locks. |
| `python3 tools/factory_dispatch.py --dry-run` | Provider/GitHub GET observations; no state/event/lock writes, source checkout or paid calls. An unavailable current-main snapshot can hold it. |
| `python3 tools/factory_dispatch.py --reconcile-only` | Provider/GitHub reads **and durable local reconciliation writes**, including GET-only recovery of existing merge intents. Never creates sessions, sends paid messages or submits merge requests. Requires enabled/unpaused operation, credentials and clean pinned controller policy. |
| `python3 tools/factory_dispatch.py --enqueue-incident /absolute/spec.json` | Validated local evidence reads and state writes; no provider calls. |
| `python3 tools/factory_dispatch.py --retry-incident INCIDENT_ID` | Explicit local requeue after definitive failed/rejected work, within the original attempt budget. Uncertain/active work cannot be replaced. |
| `python3 tools/factory_dispatch.py --accept-incident /absolute/receipt.json` | Local evidence plus fresh GitHub acceptance reads and state writes; no paid provider call. |
| `bash tools/install_factory.sh status` | Saved installation metadata only. |
| `bash tools/install_factory.sh health --expect stopped` | Read-only local checkout, unit, runtime and retained-state verification; not provider/gameplay acceptance. |

**`--no-dispatch` can send bounded repair/rebase feedback. It is not read-only.** `--initialize-state` is only for an explicitly new installation with no state file; never use it to recover existing history. `--reset-breaker` follows diagnosis and does not remove migration holds or uncertain intents. An unexplained hold is not permission to erase state.

Installer actions are `stage`, `activate`, `rollback`, `enable`, `disable`, `uninstall`, `status` and `health`. `--dry-run` performs no filesystem/service/network mutations or subprocesses. `stage`, `activate` and `rollback` require a full lowercase 40-character revision. Staging accepts `--repository` with a credential-free HTTPS URL or absolute local repository path. If using `--data-dir`, `--config-dir`, `--state-home` or `--key-file`, use the same absolute paths for every later installer operation. Manual controller commands need matching `XDG_STATE_HOME`, `XDG_CONFIG_HOME` and `JULES_API_KEY_FILE`; use `PYTHONDONTWRITEBYTECODE=1` to keep a retained release clean.

## Stopped rollout and backed migration

These commands follow review and authorization of the concrete release; the document itself grants no cutover authority. Substitute real reviewed values. `FACTORY_STATE` names existing history, never an empty replacement to bypass a hold.

```sh
FACTORY_RELEASE_SHA='<reviewed full 40-character commit>'
FACTORY_DATA="$HOME/.local/share/lfs-trasharcade-factory"
FACTORY_STATE="$HOME/.local/state/lfs-trasharcade-factory/state.json"
FACTORY_PINNED="$FACTORY_DATA/releases/$FACTORY_RELEASE_SHA/repo"
export PYTHONDONTWRITEBYTECODE=1
```

1. Record main/controller SHAs, installed unit bytes and loaded paths, timer/service state, state hash, open PR dispositions and complete provider inventory. Preserve PR 156 and conflicting/superseded branches for owner disposition. Keep the old GitHub dispatcher paused so it cannot compete with local cutover.
2. Run `bash tools/install_factory.sh disable` if needed. It stops/disables the timer and verifies it; an already running service may finish. Wait for both units to become inactive. Do not kill an in-flight create to accelerate rollout. Preserve state, logs and units. Activation requires stopped service/timer, a disabled timer and the shared exclusive `tick.lock`.
3. Review the exact candidate and qualification evidence. The old main workflow cannot validate its own replacement. `Release qualification` runs the candidate SHA on an ephemeral runner with a read-only token and no repository secrets; candidate code also defines that check, so independent owner source review remains necessary. Its green result is not Main guard, merge/deploy authority or provider acceptance. Owner infrastructure integration is a separate bootstrap decision.
4. Stage the reviewed commit without changing active units:

   ```sh
   bash tools/install_factory.sh stage --revision "$FACTORY_RELEASE_SHA" --dry-run
   bash tools/install_factory.sh stage --revision "$FACTORY_RELEASE_SHA"
   ```

   Staging creates a retained pinned checkout and receipt. Do not edit it in place or leave generated files there. Failed staging remains inspectable.
5. Inspect existing state using the staged migration tool. Activation rejects schema 1; migrate before activation when needed:

   ```sh
   python3 "$FACTORY_PINNED/tools/factory_migrate.py" --state-file "$FACTORY_STATE" --dry-run
   ```

   For a needed migration, review `input_sha256`, history counts and holds, then apply with that exact hash and a **new** backup directory whose regular parent already exists:

   ```sh
   python3 "$FACTORY_PINNED/tools/factory_migrate.py" --state-file "$FACTORY_STATE" \
     --apply --expect-sha256 '<reviewed input_sha256>' \
     --backup-dir "$FACTORY_DATA/recovery/<unique-migration-directory>"
   ```

   The tool locks state, backs up exact bytes as `state.before.json`, writes `migration.json`, compares current bytes again, atomically writes schema 2 and verifies readback. The successful backup receipt says `status: committed`. Sessions/intents stay unchanged; unknown top-level fields remain retained. Migration adds `provenance: unverified` and `admission_hold: true`, resets healthy observations and preserves existing breakers. Already recognized migration is a no-op, not a hold release. A hash mismatch requires fresh review. After any failure preserve current state and backup; never automatically restore old bytes over possible new provider receipts.
6. Activate while held and stopped, then verify:

   ```sh
   bash tools/install_factory.sh activate --revision "$FACTORY_RELEASE_SHA"
   bash tools/install_factory.sh health --expect stopped
   python3 "$FACTORY_PINNED/tools/factory_dispatch.py" --status
   ```

   Activation backs up units/metadata and the state/log tree, installs pinned paths, reloads and reads back loaded unit paths. The selected controller must load retained schema 2 and confirm applicable `durable_intents`, `migration_admission_hold`, `maintenance_queue` and `local_integration_intents` contracts. Nonempty merge history requires the last contract even after all entries are accepted. Failure restores prior units/metadata and verifies loaded paths; **it never restores state**. Timer remains disabled. Health checks exact release/receipt and unit bytes, absence of unexpected drop-ins/pending reload, compatible state, stopped/disabled timer and successful last service exit. Diagnose a failure rather than resetting its evidence.

Generation and post-merge acceptance require a complete successful **Main guard for exact current main**, no more than the configured six hours old. A requested run, static-only output, earlier SHA or candidate `Release qualification` is insufficient. Confirm hosted browser sandbox support; do not add `--no-sandbox` to obtain green checks. A narrowly reviewed maintenance incident may repair red main using a separately qualified pinned controller, an exact trusted current-main catalog entry and a verified unchanged game baseline. This exception does not waive source review, account admission, scope checks, generation's Main guard or post-merge acceptance.

## Reconcile legacy history and release the independent hold

`--reconcile-only` writes local receipts but never paid actions. It must actually reach complete inventory: disabled config, PAUSE or a pause issue can prevent that. Disposition those stops deliberately with the timer disabled and migration hold true; successful invocation alone is not a fresh inventory receipt.

```sh
python3 "$FACTORY_PINNED/tools/factory_dispatch.py" --reconcile-only
python3 "$FACTORY_PINNED/tools/factory_dispatch.py" --status
```

`migration.reconciliation` binds inventory time/completeness, retained-session count, unresolved counts and canonical hashes of sessions, intents, `legacy_scope_annotations` and the integration ledger. Missing unresolved sessions, unknown active scope/state, unreviewed active own-repository scope or unresolved create/merge intents prevent release. Capacity/staleness observation holds may still leave a receipt; inspect its fields rather than treating existence as approval. Existing merge readback can progress under the migration hold or with local integration disabled; the hold still forbids a new merge or paid action.

Reviewed legacy scope belongs in a **separate** `legacy_scope_annotations` map keyed by provider session ID. Match current provider scope, exact provider `createTime` and the retained local game ID:

```json
{
  "SESSION_ID": {
    "session_id": "SESSION_ID",
    "source": "sources/github/SyrisBruhh42/LFS_TrashArcade",
    "starting_branch": "main",
    "game_id": "084",
    "provider_create_time": "<exact provider createTime>",
    "reviewed_by": "<reviewer>",
    "reviewed_at": "<UTC timestamp>",
    "evidence_sha256": "<64-character evidence hash>"
  }
}
```

There is no annotation-writing CLI. Needed owner annotations require a reviewed, backed atomic local state change under `tick.lock`; preserve session records verbatim and never synthesize launch intent, correlation, assigned-folder or baseline provenance. Reconcile afterward. Annotations establish scope accounting, occupancy and quarantine only. They never authorize paid messages, resumption or new assignments and never turn `provenance: unverified` into verified history.

For hold release, create a regular absolute-path owner review file from actual review. Both reconciliation and review must be at most 15 minutes old; review must follow reconciliation. Required shape, not a preapproved receipt:

```json
{
  "schema": 1,
  "decision": "release_migration_admission_hold",
  "reviewer": "<reviewer>",
  "reviewed_at": "<UTC timestamp>",
  "controller_revision": "<full pinned controller SHA>",
  "state_sha256": "<hash of exact current state file bytes>",
  "reconciliation_sha256": "<canonical hash of migration.reconciliation>",
  "provider_inventory_reviewed": true,
  "github_dispositions_reviewed": true,
  "legacy_assignment_authority": "not_granted"
}
```

Canonical hashes use Python `json.dumps(value, sort_keys=True, separators=(",", ":")).encode()` followed by SHA-256. File hashes cover exact bytes. Run from the clean retained checkout named by `controller_revision`:

```sh
python3 "$FACTORY_PINNED/tools/factory_migrate.py" --state-file "$FACTORY_STATE" \
  --release-hold --evidence-file /absolute/owner-review.json --dry-run
python3 "$FACTORY_PINNED/tools/factory_migrate.py" --state-file "$FACTORY_STATE" \
  --release-hold --evidence-file /absolute/owner-review.json \
  --apply --expect-sha256 '<fresh reviewed input_sha256>' \
  --backup-dir "$FACTORY_DATA/recovery/<unique-hold-release-directory>"
```

Release requires complete matching inventory, zero `missing_unresolved`, `active_unresolved` and `unresolved_intents`, and no actual pending/ambiguous intent. The file hash binds all other state too. Changed state or expired review requires renewed review/reconciliation, not editing a hash merely to pass. Release records the owner evidence hash, preserves history, resets healthy observations and removes only its own migration breaker. It does not start the timer or prove paid admission will pass.

## One-incident maintenance pilot

The owner reproduces a still-present defect against a named main SHA and installs a trusted scenario/adapter asserting intended behavior. Do not pay for an already repaired incident or invent a scenario ID without an implemented trusted check. Usability work needs one observable journey and protected behavior, not an unbounded overhaul. Required scenarios/protected checks do not cover every feature.

The private local incident file has exactly these fields; replace illustrative values with reviewed evidence:

```json
{
  "schema_version": 1,
  "id": "INC-YYYYMMDD-GAME-SCENARIO",
  "repository": "SyrisBruhh42/LFS_TrashArcade",
  "game_id": "085",
  "assigned_folder": "games/085-scrap-heist-retrieval",
  "observed_sha": "<full observed main SHA>",
  "scenario_id": "<implemented trusted scenario ID>",
  "expected_behavior": "<one concrete observable result>",
  "reproduction": ["<ordinary input step>"],
  "protected_phase": "10",
  "protected_behavior": ["<working behavior to preserve>"],
  "evidence": [{"path": "/absolute/reproduction.json", "sha256": "<file hash>"}],
  "reviewed_by": "<reviewer>",
  "reviewed_at": "<UTC timestamp>",
  "priority": 1,
  "max_attempts": 1,
  "repair_owner": "native"
}
```

`protected_phase` is string `1` through `10`, or `null` for legacy unphased games. Evidence is one to eight regular, non-symlink absolute local files, each at most 10 MB, with matching hashes. These paths are reviewer-local provenance, not files promised in Jules' checkout. Priority is 1–5, lower first. The general attempt range is 1–3; the initial pilot uses 1. The immutable spec hash covers the entire canonical object, including evidence references.

Before paid creation, current main must contain the matching trusted `factory/maintenance_catalog.json` entry:

```json
{
  "schema_version": 1,
  "incidents": {
    "INC-YYYYMMDD-GAME-SCENARIO": {
      "repository": "SyrisBruhh42/LFS_TrashArcade",
      "assigned_folder": "games/085-scrap-heist-retrieval",
      "game_id": "085",
      "observed_sha": "<same observed SHA>",
      "scenario_id": "<same trusted scenario ID>",
      "protected_phase": "10",
      "spec_hash": "<canonical hash of full incident spec>",
      "expected_behavior_hash": "<canonical hash of expected_behavior string>",
      "status": "approved"
    }
  }
}
```

Catalog/scenario publication is an owner infrastructure action; a game session cannot approve itself. Keep private evidence content/paths out of the catalog. The observed SHA must be current main or its verified ancestor with the **entire assigned game tree unchanged**. Catalog publication elsewhere can advance main without invalidating that diagnosis.

```sh
python3 "$FACTORY_PINNED/tools/factory_dispatch.py" --enqueue-incident /absolute/incident.json
python3 "$FACTORY_PINNED/tools/factory_dispatch.py" --status
python3 "$FACTORY_PINNED/tools/factory_dispatch.py" --dry-run
```

Inspect exact queued ID/spec hash, one remaining attempt, generation disabled, native ownership, current account headroom and no unresolved intent. Intake deduplicates identical ID/specs and fingerprints and refuses competing unresolved incidents for the same game. Queue occupancy also excludes that game from phase generation.

After hold release and pilot authorization, keep the timer disabled and run **one ordinary tick at a time**, inspecting state after each:

```sh
python3 "$FACTORY_PINNED/tools/factory_dispatch.py"
python3 "$FACTORY_PINNED/tools/factory_dispatch.py" --status
```

Two healthy observations are required after hold release; a tick is not a promise of launch. Stop creation attempts once the single durable attempt exists and observe with `--reconcile-only`. Verify exact correlation/session/assignment readback. Uncertain creation remains occupied and held; do not reset identity, enqueue another incident or increase its budget to evade that outcome. `--retry-incident` cannot retry an exhausted one-attempt pilot.

Controller/config/policy remain pinned. Game data comes from a bounded credential-free current-main snapshot; tools from that snapshot never execute. Main and inventory are rechecked before creation. Jules receives a source branch, not an API-enforced exact commit pin: the brief requires its actual checkout SHA to match the Baseline commit or stop. A green source check does not prove provider compliance.

The generated brief requires clean committed local preflight:

```sh
python3 tools/preflight.py --base origin/main --head HEAD --mode maintenance \
  --incident-id INCIDENT_ID --incident-spec SPEC_HASH
```

Its PR body must contain exact lines `Factory incident: INCIDENT_ID` and `Factory incident spec: SPEC_HASH`. The prompt requests `arcade:maintenance`; **the dispatcher does not currently apply that label**. The owner verifies PR identity/body/scope and applies the label before the maintenance gate. Trusted base catalog/fixtures bind scope and expectations; candidate prose does not. Only the assigned game and exact generated registry exception are allowed, preserving phase and identity. Owner triage, integration and post-merge review are explicit steps; this is not fully unattended acceptance.

## Independent post-merge acceptance

An incident progresses from `queued` to `dispatched`, then `needs_owner` on definitive failure or `awaiting_acceptance` after confirmed merge. Merge alone never marks it `accepted`. Independently reproduce the named scenario on exact current main after the controller observes the merge, with fresh successful Main guard and the merged commit in main's ancestry.

At least one hashed local scenario evidence file must contain matching values and actual assertions:

```json
{
  "schema_version": 1,
  "repository": "SyrisBruhh42/LFS_TrashArcade",
  "commit_sha": "<exact current main SHA>",
  "game_id": "085",
  "scenario_id": "<incident scenario ID>",
  "protected_phase": "10",
  "expected_behavior_hash": "<canonical hash of incident expected_behavior string>",
  "status": "PASS",
  "tested_at": "<UTC at or after merged_observed_at>",
  "checks": [{"name": "<actual named behavioral assertion>", "result": "PASS"}]
}
```

The owner receipt has exactly these fields:

```json
{
  "schema_version": 1,
  "incident_id": "INC-YYYYMMDD-GAME-SCENARIO",
  "repository": "SyrisBruhh42/LFS_TrashArcade",
  "main_sha": "<same exact current main SHA>",
  "scenario_id": "<same incident scenario ID>",
  "result": "PASS",
  "reviewed_by": "<reviewer>",
  "reviewed_at": "<UTC timestamp>",
  "evidence": [{"path": "/absolute/postmerge-scenario.json", "sha256": "<file hash>"}]
}
```

```sh
python3 "$FACTORY_PINNED/tools/factory_dispatch.py" --accept-incident /absolute/acceptance.json
python3 "$FACTORY_PINNED/tools/factory_dispatch.py" --status
```

Acceptance checks evidence hashes/content and merge ancestry, obtains fresh exact-main Main guard evidence and rechecks main before writing `accepted`. A bare PASS, PR gate artifact or older main result is insufficient. Receipt validation cannot establish that someone actually performed its assertions: retain underlying trustworthy test evidence. Native device, accessibility, audible output, long-session and deployment acceptance remain separate. There is no automatic arbitrary-defect discovery or automatic acceptance; a newly escaped defect needs reviewed intake.

## Automatic integration and continuing service

The local integration path uses the existing dispatcher lock and native authenticated `gh` client; it adds no service or stored credential. It is disabled unless the pinned config sets `local_integration_enabled=true`. Before enabling it, the repository variable `ARCADE_AUTO_MERGE` must be observably **exactly `false`** so the cloud workflow cannot compete. Missing variable/read access is a hold. Native CLI authentication is separate from environment tokens: the local transport strips `GH_TOKEN`, `GITHUB_TOKEN` and `ARCADE_POLICY_TOKEN` overrides and never forwards Jules credentials.

Local automatic integration accepts only verified new/advance assignments whose durable create intent, provider source/title/prompt/output, game folder and exact phase all agree. Legacy annotations, maintenance and infrastructure never gain automatic merge authority. One candidate is considered per tick before creation capacity checks, allowing accepted work to drain when WIP is full. Dry runs and `--no-dispatch` never merge.

Live-qualify a main branch rule requiring `Arcade gate` from GitHub Actions, strict up-to-date branches, administrator enforcement, no force-push/delete permissions and no review-bypass allowances. Other rules can add holds. The controller verifies exact PR/head/base, immutable base-to-head file scope, manifest phase, fresh Main guard, trusted bot report, successful validation jobs, exact-head status and matching artifact metadata. It rechecks admission and evidence expiry before sending. Strict server protection covers the remaining base race; local reads alone are not atomic.

Before the single merge PUT, the controller durably saves an intent keyed by repository, PR, head, base and validation run. A known pre-transport pause is recorded as `not_sent` and may be freshly admitted, preserving its history. Once transport may have occurred, pending/ambiguous intents receive GET readback only; neither a timeout nor disabling the feature permits another PUT. Confirmed merges remain `awaiting_main_acceptance` until a fresh successful **push-triggered** Main guard covers exact current main and includes that merge. Native-auth merges normally trigger this workflow; the controller does not issue a duplicate workflow dispatch. Readback/receipt recovery runs through `--reconcile-only` without ordinary new-work admission.

An unresolved merge holds phase generation and paid feedback. A confirmed merge awaiting failed main acceptance can permit one already reviewed maintenance incident for that exact merged game, diagnosed at or after the merge and still bound by the trusted current-main catalog and normal budgets/ownership. Pause, dirty controller, migration hold, ambiguous merge, uncertain scope and transport failures do not grant this exception. Maintenance still requires owner integration and independent acceptance; no arbitrary defect discovery or autoapproval is claimed. The merge intent remains open until main is independently accepted.

The alternate cloud integration path remains opt-in through `ARCADE_AUTO_MERGE=true` and requires a separate Administration:read capability (`ARCADE_POLICY_TOKEN`) because workflow `GITHUB_TOKEN` cannot read branch protection. It must not run alongside local integration. The cloud helper uses the read-only capability only for policy inspection and the workflow token for merging, followed by explicit main audit dispatch because workflow-token pushes normally do not trigger workflows. This alternative is not enabled by the local cutover; missing credentials are not a reason to put a broad token into repository secrets.

After the bounded pilot's provider correlation, repair ownership, acceptance and recovery evidence are reviewed, continuing service can be enabled if authorized:

```sh
bash tools/install_factory.sh enable
bash tools/install_factory.sh health --expect running
```

Enable verifies pin/units/state and timer readback; failed enable attempts to disable the timer and verify containment. It does not kill an already running service or restore old state. Observe accepted behavior, escaped defects, WIP and actual account usage before changing budgets.

## Recovery and evidence boundaries

Disable the timer, let any active tick finish, preserve current state and inspect provider receipts. Rollback has the same stopped-unit requirements and state compatibility handshake:

```sh
bash tools/install_factory.sh disable
bash tools/install_factory.sh rollback --revision '<compatible retained full SHA>'
bash tools/install_factory.sh health --expect stopped
```

Rollback changes pinned code/units, **never live state**. Older code must understand current durable intents, migration hold, maintenance queue and any nonempty local integration history. Preserving the original controller is not permission to reactivate unsafe retry semantics. With no compatible qualified rollback target, remain stopped with evidence intact. Restoring an old state copy can erase evidence of created sessions and cause duplicate paid work.

Recovery copies live under the factory data directory's `recovery/`; the initial operator checkpoint includes `end-to-end-20261024T193959Z`. `uninstall` requires stopped/disabled operation and the tick lock, backs up/removes units and retains releases, mirror, state, logs and recovery. It is not storage cleanup. No automatic source revert, provider cancellation or PR deletion follows failed acceptance.

| Evidence | What it establishes | What remains separate |
| --- | --- | --- |
| Local regression/fault tests | Exercised code paths/assertions on the recorded source/environment, including synthetic rollback failures. | Actual loaded host units, hosted policy, provider behavior and untested gameplay. |
| Exact-SHA hosted `Release qualification` | Candidate regression/catalog/browser results and available uploaded evidence for that SHA. | Independent source review, trusted main acceptance, activation and paid admission. |
| Exact-main `Main guard` / trusted PR gate | Named tested revision and specified trusted assertions. | Merge authority, native device/product coverage and provider billing. |
| Installer `health` | Pinned local installation/readback and compatible retained state. | A successful paid session or accepted repair. |
| Correlated provider attempt plus independent post-merge receipt | Observed session and named repaired behavior on accepted main. | General defect freedom, native/device testing and larger rollout reliability. |

Keep failed/unrun checks visible. Complete live qualification includes provider correlation, eligible same-session/native repair behavior, transport/crash uncertainty without duplicate work, pinned-unit readback and operator-led compatible rollback. Finite local tests, green CI and receipt existence are not end-to-end production acceptance.
