# Factory repair: evidence and design decisions

This retains the initial research and design checkpoint. Later implementation and operating commands are documented in [Factory operations](FACTORY-OPERATIONS.md); live-unqualified items below describe this checkpoint rather than a current account or deployment readback.

Research checked 2026-10-24. Initial baseline source: `b6e98cd5ba85541cf679485cd5f595e448587b97`; reconciled through live main `567405654f729374615a6b1792ad23973c6f71ed`, preserving PR386–389 phase additions. The five-day activity review covers 2026-10-19 17:13:01 UTC through 2026-10-24 17:13:01 UTC. It observed 384 PR creations, 372 merges, 751 main commits (371 registry rebuilds), 401 Actions runs and no formal GitHub PR reviews. Median creation-to-merge was 21 seconds. These are delivery-activity measures, not quality or savings measures.

## Observations and falsification

The old PR workflow overlaid candidate files onto a main checkout but selected changed games through `origin/main...HEAD`. The empty commit diff caused a latest-game fallback. Missing Chrome, subprocess failures and timeouts could pass. Game JavaScript ran with browser sandbox/file-access bypass flags in a write-token job. Reproductions demonstrated wrong-target validation, fail-open execution and access outside the game folder. The phase guard prohibited legacy/final-phase repairs and required code growth irrespective of behavior.

A first strengthened all-catalog audit passed only 71/85 games. Some failures were incorrect test adapters (CSS opacity, pointer-only buttons, tutorials); others were actual startup exceptions and a blank title screen. The earlier virtual-time attempt passed 54/85 and was superseded after discovering unreliable animation-frame progression. Preserve these failures; they explain changes to real-time observation and explicit adapters. Independent adversarial review then demonstrated that a game could forge the injected DOM completion marker. The final gate must keep verdict/timing outside page control; a marker is not an attestation.

| Hypothesis | Supporting evidence | Contradicting evidence / boundary |
|---|---|---|
| High merge volume reflects healthy output | Many completed PRs and successful workflows | Wrong-target/fail-open checks and reproduced gameplay defects invalidate that inference |
| Failures are mostly bad games | Real uncaught exceptions and blank startup | Several failures came from test assumptions; repair the adapter only after inspecting the ordinary UI path |
| More sessions improve delivery | Parallel capacity can reduce waiting | Broad WIP, retries and unreviewed output can increase defects and waste; measure accepted behavior per session |
| A pinned controller is sufficient | Prevents accidental self-update | It needs a separate fresh game-data snapshot after main advances |

## Provider contracts and engineering response

| Verified contract | Implemented response |
|---|---|
| Jules [sessions.list](https://developers.google.com/jules/api/reference/rest/v1alpha/sessions/list) paginates (default 30, maximum 100) and documents no ordering guarantee | Exhaust bounded pagination; cycles, duplicates, unknown states or incomplete inventory hold mutations. Count all account sources rather than only this repo |
| [sessions.create](https://developers.google.com/jules/api/reference/rest/v1alpha/sessions/create) documents no idempotency key | Persist and fsync unique launch intent and body hash before POST. Reconcile ambiguous outcomes by exact correlation and source; never blind retry |
| [Session source context](https://developers.google.com/jules/api/reference/rest/v1alpha/sessions) accepts startingBranch, not an exact startingCommit | Record the observed accepted SHA in the brief; verify it in downstream GitHub checks. Do not claim provider checkout pinning |
| [Plan policy](https://jules.google/docs/api/reference/sessions/) defaults requirePlanApproval to false; approvePlan has no expected-plan-ID field | Explicit autonomous game scope uses false. Unexpected approval/questions hold. No loop automatically approves changed plans or sends generic answers |
| [Plan review](https://jules.google/docs/review-plan/) follows VM setup and repository cloning | Plan approval is not a sandbox or a guarantee of zero provider work |
| [Published limits](https://jules.google/docs/usage-limits/) are plan ceilings | Require operator-configured shared-account ceilings and reserves. Session counts are not authoritative remaining credits, billing or entitlement |
| [Activities](https://developers.google.com/jules/api/reference/rest/v1alpha/sessions.activities/list) and feedback are bounded API surfaces | One deduplicated actionable repair per session by default, only verified active eligible sessions; uncertain delivery is retained |
| [GITHUB_TOKEN events](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token) generally do not trigger subsequent workflows | After a confirmed token merge, request an explicit main workflow_dispatch. Request success is not main acceptance |
| [Merge API](https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request) SHA guards the head, not the base | Require strict protected-branch up-to-date checks, app-bound required status, admin enforcement, current base/head checks and serialized integration. Rechecks alone are not atomic |
| [Protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) can accept neutral/skipped checks | Controller and integration require an explicitly successful Main guard job for current main |
| [Workflow concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency) is not a durable queue | Treat integration as a serialized attempt; held/replaced jobs remain visible PR work, never assumed merged |

The [branch-protection GET API](https://docs.github.com/en/rest/branches/branch-protection#get-branch-protection) requires Administration:read for installation tokens. Automatic integration therefore supports a separate read-only policy capability; the ordinary workflow token is insufficient for that inspection. Missing access remains a hold. This credential path still requires live qualification.

The [pull_request_target security guidance](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target) motivates separate read-only execution and privileged reporting/integration. Trusted tools come from the event's exact base. Game files are validated data, never shell/Python code in privileged jobs. Infrastructure changes require owner authorship and manual review.

## Controls and tradeoffs

- **Engineering:** retain the existing Python/stdlib and GitHub architecture. No new coordinator service, database, npm dependency tree, or cross-project orchestrator. Exact registry generation joins the same game commit, removing a second write/CI cycle; concurrent branches must regenerate after rebase.
- **Quality:** explicit target manifests, static checks, real browser observations, fault injection and every-game main coverage replace line-count proxies. Title/start/play smoke remains narrow: it cannot prove combat balance, save compatibility, audio mix, accessibility, long-session stability or mobile experience.
- **Operations:** pinned controller releases and temporary exact-main game snapshots separate executable policy from changing content. State history, uncertain intents, failed releases and prior units remain recoverable. Null budgets, stale main/inventory and malformed state hold work. Operational holds can reduce throughput intentionally.
- **Security:** sandbox-enabled Chrome, isolated profiles, local bounded asset serving, CSP, sanitized environment, no browser file URLs and no PR execution with write credentials reduce blast radius. Browser isolation is not a proof against browser/kernel vulnerabilities; disposable CI remains the execution boundary. Page state is still untrusted product data, so human adversarial review remains necessary.
- **Customer:** repair normal input, reset, volume and cooldown behavior; allow maintenance at all phases. Avoid announcing a “masterpiece” merely because phase 10 was reached.
- **Financial:** reduce unnecessary context, code padding, generic nudges, duplicate creates, redundant registry writes and excessive WIP. No measured credit/token savings are claimed. API pages and catalog checks add bounded infrastructure work in exchange for fewer paid mistakes.

## Outcome measures and invalidation criteria

Track accepted changes per created session, first-pass PR acceptance, repair messages per accepted change, escaped defects, age of open PRs/unfinished games, uncertain creates, held ticks by reason, and actual account usage where the provider exposes it. Prompt bytes are context diagnostics, not token billing or subscription cost. Keep failed/abandoned work in the denominator. No automatic optimization should chase high utilization or lower prompt size at the expense of accepted behavior.

Start with low WIP and one bounded repair. Adjust only after a representative measured cohort. Stop new dispatch immediately for ambiguous creates, unknown inventory, exhausted budget/reserve, unaccepted current main, altered controller release, unresolved scope, or a qualified breaker. A spoofed pass, stale-head merge, duplicate paid launch, missing recovery artifact or real escaped regression invalidates the corresponding control and requires diagnosis before resumption.

Undefined/live-unqualified: actual shared account entitlement and budget, concurrent activity outside the controller, native provider create/feedback behavior, configured branch protection, GitHub-hosted browser behavior, device playtests and production release criteria. Local tests do not settle these.
