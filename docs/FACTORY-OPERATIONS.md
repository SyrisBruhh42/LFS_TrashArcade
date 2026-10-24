# Factory operations and recoverable rollout

The repaired source is a candidate until qualified on the host and GitHub. Existing installed units may still fetch/reset main every tick. Editing the installer or publishing a branch does not replace those units. Do not merge this repair into a live auto-updating main before an explicitly authorized cutover has stopped that update path.

## Admission and paid work

`factory/config.json` keeps local limits separate from shared-account ceilings. Set `account_active_cap` and `account_daily_cap` from the operator's actual account allocation; null values deliberately hold paid work. Reserves reduce usable capacity. Existing local maximums (12 concurrent, 96 rolling-day starts, 8 open PRs) are ceilings, not dispatch targets or a claim about the account plan. Unfinished-game WIP defaults to 2, including assigned new games not yet merged. Account inventory includes other repositories.

The controller creates only explicitly allowlisted game work with `plan_policy=autonomous_game_scope`. Unexpected plan approval, unanswered questions, stale or unknown sessions, uncertain requests, malformed state, incomplete inventory, scope mismatches and broken acceptance remain holds. It never generically approves a plan or answers a question. Repair feedback uses the existing verified active session/PR, a trusted exact-head gate report and a bounded deduplication budget. Repairs can correct a red main but require account budget/freshness and clean controller policy. Terminal-session resurrection is not qualified.

Each paid create/message records intent durably before its one POST. A timeout or crash cannot authorize retry. A successful request is not an accepted result. Preserve intent/session history and resolve uncertain operations from provider/GitHub evidence; never delete state to make the loop resume. Unresolved creates remain occupied work. Failure breakers need diagnosis and an explicit local reset, followed by healthy-observation hysteresis.

## Inspection commands

These commands describe the candidate. `--status` reads saved local state without network or writes. `--dry-run` performs read-only provider/GitHub observations and never writes state/locks or creates a source checkout; it may therefore report that a fresh main snapshot is unavailable. It does not prove a live create would succeed.

```sh
python3 tools/factory_dispatch.py --status
python3 tools/factory_dispatch.py --dry-run
bash tools/install_factory.sh status
bash tools/install_factory.sh stage --revision <FULL_SHA> --dry-run
```

`--no-dispatch` **can send bounded repair feedback**; it is not a read-only flag. `--initialize-state` creates new empty state only when none exists; it must never replace an existing factory history. `--reset-breaker` clears a diagnosed local breaker, not unresolved provider intent.

Default durable state is `$XDG_STATE_HOME/lfs-trasharcade-factory` (normally `~/.local/state/lfs-trasharcade-factory`). The local stop sentinel is `$XDG_CONFIG_HOME/lfs-trasharcade-factory/PAUSE`. The existing `factory:pause` issue label also holds factory work. These paths and native authentication are operational configuration; never copy API keys into source or prompts.

## Cutover sequence (requires operator authorization)

1. Record current main/controller SHA, timer/service state, installed unit content, open PR dispositions and provider inventory. Reconcile existing sessions and uncertain actions. Preserve PR156 and conflicting/superseded branches for owner disposition; do not bulk close, merge or delete them.
2. Disable the old timer with `bash tools/install_factory.sh disable`. Wait for an already running tick to finish and verify both units are inactive. Do not kill an in-flight create merely to accelerate cutover. Preserve state/logs and installed units. The installer refuses activation while units are active or the timer enabled.
3. Review/merge the infrastructure repair manually after independent source review and applicable checks. The old main workflow cannot validate its own replacement; bootstrap acceptance is a separate owner decision. Configure approved shared-account budgets in a reviewed commit. Do not edit a staged release in place.
4. Require a complete new Main guard run for the exact new main SHA. It audits all games and executes regression tests. A scheduled/requested run, a static-only result or an old green SHA is insufficient. Confirm GitHub-hosted Chrome supports its sandbox; do not add `--no-sandbox` to obtain a green run.
5. Stage the reviewed full SHA: `bash tools/install_factory.sh stage --revision <FULL_SHA>`. This creates a new retained checkout and receipt without changing active units. Failed staging remains inspectable.
6. Activate that SHA: `bash tools/install_factory.sh activate --revision <FULL_SHA>`. Activation backs up units/metadata and state/logs, atomically installs pinned paths, reloads and verifies loaded unit paths. Failure restores prior unit files. Timer remains disabled. The existing mirror and earlier releases remain intact.
7. From the pinned release, inspect status and dry-run admission. Verify credential custody, account allocations, recovery artifacts and exact-main acceptance. Any unexplained hold is a diagnosis item, never a reason to erase history.
8. Enable only after approval of the concrete candidate and budget: `bash tools/install_factory.sh enable`. Observe a complete small cohort: no duplicate creates, correct assignment/PR linkage, correct holds, accepted behavior, complete state readback and bounded resource usage. The controller needs two healthy observations before creating work.

The controller executable/config/prompt/phase policy remain pinned. Each admitted tick obtains a bounded, credential-free temporary snapshot of accepted public main for game data only; no candidate tools execute from it. A private/unreachable source holds. Main and inventory are rechecked after preparation. This adds a small Git fetch cost without paid model context or automatic controller self-update.

## Automatic integration is separately gated

`ARCADE_AUTO_MERGE` is disabled unless the repository variable is exactly `true`. Before enabling, configure and live-qualify a main branch rule requiring `Arcade gate` from the GitHub Actions app, strict up-to-date branches, administrator enforcement, no force-push/delete permissions and no review-bypass allowances. Additional rules may impose additional holds. Current protection must be read back; historical configuration does not authorize merging. The branch-protection REST API requires Administration:read, which workflow GITHUB_TOKEN permissions cannot request. Provision an independently scoped read-only GitHub capability as the `ARCADE_POLICY_TOKEN` repository secret and live-qualify it. It is used only for the policy GET; GITHUB_TOKEN remains the merge capability. Missing/denied policy access holds integration; never grant a broad write token to bypass this prerequisite.

Integration rechecks exact head/base/main, ancestry, successful fresh Main guard and the current trusted run's status. It serializes merge attempts and submits one head-pinned merge request. Strict server protection handles the remaining base race. An ambiguous response gets readback, never a blind repeated PUT. Confirmed token merges request a new main audit explicitly. A moved base, disabled gate, unavailable policy or stale evidence holds. Maintenance/infrastructure PRs always require owner integration.

## Recovery

Disable the timer and let any running tick finish. `rollback --revision <RETAINED_FULL_SHA>` uses the same stopped-unit requirements and recoverable activation as a new release. Keep timer disabled until compatibility and provider inventory are reconciled. Never roll back to a controller that retries uncertain operations or cannot understand current state without a reviewed migration. Unit restoration and state rollback are separate decisions: restoring an old state file can lose evidence of already-created provider sessions, causing duplicate paid work.

Recovery copies live under the factory data directory's `recovery/`. `uninstall` backs up/removes units but retains releases, the old mirror, state, logs and recovery copies. It is not storage cleanup. No automated source revert or PR deletion occurs on failed main acceptance.

## Live acceptance still required

Verify configured branch protection and sandbox behavior on GitHub, a controlled provider create and its correlation readback, same-session repair eligibility, a crash/transport-uncertainty recovery without duplicate work, pinned-unit readback, and operator-led rollback. Track accepted behavior per session and escaped defects before increasing WIP. Native touch/audio/mobile/browser/long-duration gameplay remains a separate product qualification track.
