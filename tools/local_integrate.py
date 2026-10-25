#!/usr/bin/env python3
"""Phase-only local integration. The caller owns the factory lock and durable save.

No candidate code is executed, no token is forwarded, and no workflow is
manually dispatched. A recorded merge request is never sent a second time.
"""
from __future__ import annotations

import base64
from datetime import datetime, timedelta, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location("_local_integration_policy", ROOT / "tools/integrate_pr.py")
policy = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(policy)
Hold, GitHubError = policy.Hold, policy.GitHubError
SHA = policy.SHA
BLOCKING = {"pending", "ambiguous", "awaiting_main_acceptance"}
MARKER = "<!-- arcade-gate-report -->"


class MainAcceptanceHold(Hold):
    """Only confirmed postmerge acceptance failed; admission controls succeeded."""


def stamp(clock):
    return clock.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def api(endpoint, method="GET", body=None):
    # Native gh authentication is already established on this host. Never inherit
    # action/provider tokens or another process's token override.
    environment = {k: os.environ[k] for k in ("HOME", "PATH", "LANG", "XDG_CONFIG_HOME", "GH_CONFIG_DIR") if k in os.environ}
    environment.update(GH_HOST="github.com", GH_PROMPT_DISABLED="1")
    args = ["gh", "api", "--hostname", "github.com", "--method", method, endpoint]
    if body is not None:
        args += ["--input", "-"]
    try:
        result = subprocess.run(args, input=json.dumps(body) if body is not None else None,
                                capture_output=True, text=True, timeout=90, env=environment)
        if result.returncode:
            raise GitHubError("Native GitHub request failed; details withheld")
        return json.loads(result.stdout) if result.stdout.strip() else {}
    except (OSError, subprocess.TimeoutExpired, ValueError):
        raise GitHubError("Native GitHub request outcome unavailable") from None


def pages(endpoint, key=None):
    """Small explicit cap; a capped/partial collection is never acceptance."""
    records, total = [], None
    for page in range(1, 4):
        data = api(f"{endpoint}{'&' if '?' in endpoint else '?'}per_page=100&page={page}")
        items = data.get(key) if key and isinstance(data, dict) else data
        if not isinstance(items, list) or any(not isinstance(x, dict) for x in items):
            raise Hold("Incomplete integration evidence inventory")
        if key:
            count = data.get("total_count")
            if type(count) is not int or count < 0 or total is not None and count != total:
                raise Hold("Missing or changing integration evidence count")
            total = count
        records.extend(items)
        if len(items) < 100:
            if total is not None and total != len(records):
                raise Hold("Incomplete integration evidence count")
            ids = [x.get("id") for x in records]
            if all(x is not None for x in ids) and len(ids) != len(set(ids)):
                raise Hold("Duplicate integration evidence identities")
            return records
    raise Hold("Integration evidence page cap reached")


# A private module instance keeps the cloud path unchanged. Both shared validators
# and local checks use the same bounded, native-auth transport.
policy.api = lambda *a, **kw: api(*a, **kw)
policy.pages = lambda *a, **kw: pages(*a, **kw)


def ledger(state):
    value = state.get("integration", {"schema_version": 1, "intents": {}})
    if not isinstance(value, dict) or value.get("schema_version") != 1 or not isinstance(value.get("intents"), dict):
        raise Hold("Invalid local integration ledger; preserve state")
    for key, item in value["intents"].items():
        if (not isinstance(item, dict) or key != digest({k: item.get(k) for k in ("repo", "pr", "head", "base", "run_id")}) or
                item.get("status") not in BLOCKING | {"accepted", "not_sent"} or
                not policy.REPO.fullmatch(item.get("repo", "")) or type(item.get("pr")) is not int or item["pr"] < 1 or
                not all(SHA.fullmatch(item.get(k, "")) for k in ("head", "base", "controller_sha")) or
                not isinstance(item.get("session_id"), str) or not str(item.get("run_id", "")).isdigit()):
            raise Hold("Invalid durable merge intent; preserve state")
        policy.timestamp(item.get("created_at"))
        if item["status"] in {"awaiting_main_acceptance", "accepted"} and not SHA.fullmatch(item.get("merge_sha", "")):
            raise Hold("Missing durable merge identity")
    return value


def blocked(state):
    return any(i["status"] in BLOCKING for i in ledger(state)["intents"].values())


def clean_controller(expected):
    if not SHA.fullmatch(expected):
        raise Hold("Pinned controller revision missing")
    try:
        head = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True, capture_output=True, check=True).stdout.strip()
        dirty = subprocess.run(["git", "status", "--porcelain"], cwd=ROOT, text=True, capture_output=True, check=True).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        raise Hold("Pinned controller checkout unavailable") from None
    if dirty or head != expected:
        raise Hold("Local integration requires the clean pinned controller")


def local_controls(cfg, state, controller_sha, clock, paused):
    clean_controller(controller_sha)
    if not cfg.get("enabled") or paused() or state.get("migration", {}).get("admission_hold") is True:
        raise Hold("Local integration stopped by pause or migration admission hold")
    if state.get("breaker") or state.get("cooldown_until") and policy.timestamp(state["cooldown_until"]) > clock:
        raise Hold("Local integration stopped by controller breaker/cooldown")
    if any(i.get("status") in {"pending", "ambiguous"} for i in state["intents"].values()):
        raise Hold("Unresolved provider create prevents integration")
    inv = state.get("inventory", {})
    if (inv.get("complete") is not True or not timedelta(0) <= clock - policy.timestamp(inv.get("observed_at")) <=
            timedelta(seconds=cfg["inventory_max_age_seconds"])):
        raise Hold("Local integration requires fresh complete provider observation")


def controls(cfg, state, controller_sha, clock, paused):
    local_controls(cfg, state, controller_sha, clock, paused)
    variable = api(f"repos/{cfg['repo']}/actions/variables/ARCADE_AUTO_MERGE")
    if not isinstance(variable, dict) or variable.get("name") != "ARCADE_AUTO_MERGE" or variable.get("value") != "false":
        raise Hold("Cloud integration must be observably disabled before local integration")
    pauses = pages(f"repos/{cfg['repo']}/issues?labels=factory%3Apause&state=open")
    if pauses:
        raise Hold("Repository pause issue prevents integration")


def owned(cfg, state, sid, rec, session):
    intent = state["intents"].get(rec.get("correlation"), {})
    original = intent.get("record", {})
    context = session.get("sourceContext", {})
    url = f"https://github.com/{cfg['repo']}/pull/"
    outputs = {o.get("pullRequest", {}).get("url") if isinstance(o.get("pullRequest"), dict) else None
               for o in session.get("outputs", []) or [] if isinstance(o, dict) and "pullRequest" in o}
    fields = ("assigned_folder", "game_id", "phase", "baseline_sha", "title", "mode", "incident_id", "repair_owner")
    return bool(intent.get("status") == "accepted" and intent.get("session_id") == sid and
                rec.get("mode") in {"advance", "new"} and not rec.get("incident_id") and
                not rec.get("hold") and not rec.get("outcome") and rec.get("gate_status") == "passed_waiting_merge" and
                session.get("state") in {"IN_PROGRESS", "COMPLETED"} and
                context.get("source") == cfg["source"] and context.get("githubRepoContext", {}).get("startingBranch") == "main" and
                session.get("title") == intent.get("title") and digest(session.get("prompt", "")) == intent.get("prompt_hash") and
                f"Factory correlation: {rec.get('correlation')}" in session.get("prompt", "") and
                all(rec.get(k) == original.get(k) for k in fields) and
                re.fullmatch(r"games/\d{3}-[a-z0-9-]+", rec.get("assigned_folder", "")) and
                re.fullmatch(re.escape(url) + r"[1-9][0-9]*", rec.get("pr", "")) and outputs == {rec["pr"]})


def scope(repo, rec, head, base):
    # PR /files follows a mutable branch: an A->B->A head race could substitute
    # another game's file list. Compare immutable SHAs instead. GitHub caps this
    # list at 300 files, so reaching that cap is incomplete evidence, never PASS.
    comparison = api(f"repos/{repo}/compare/{base}...{head}")
    files = comparison.get("files")
    if (comparison.get("base_commit", {}).get("sha") != base or
            comparison.get("merge_base_commit", {}).get("sha") != base or
            not isinstance(files, list) or len(files) >= 300 or any(not isinstance(x, dict) for x in files)):
        raise Hold("Immutable assignment diff is unavailable or capped")
    prefix = rec["assigned_folder"] + "/"
    if not files or not any(x.get("filename", "").startswith(prefix) for x in files):
        raise Hold("PR has no assigned-game change")
    for item in files:
        for name in (item.get("filename"), item.get("previous_filename", item.get("filename"))):
            if not isinstance(name, str) or ".." in name.split("/") or not (name.startswith(prefix) or name == "games/registry.js"):
                raise Hold("PR escapes its durable game assignment")
    data = api(f"repos/{repo}/contents/{prefix}game.json?ref={head}")
    try:
        if data.get("type") != "file" or data.get("encoding") != "base64" or data.get("size", 0) > 100000:
            raise ValueError
        manifest = json.loads(base64.b64decode(data["content"]).decode())
    except (ValueError, KeyError, UnicodeError):
        raise Hold("Assigned phase manifest unavailable") from None
    if (manifest.get("id") != rec["game_id"] or manifest.get("slug") != rec["assigned_folder"].split("/")[1] or
            manifest.get("phase") != rec["phase"]):
        raise Hold("PR does not implement the exact assigned phase")


def attestation(repo, number, head, base):
    comments = pages(f"repos/{repo}/issues/{number}/comments")
    reports = [c for c in comments if c.get("user", {}).get("login") == "github-actions[bot]" and
               c.get("user", {}).get("type") == "Bot" and MARKER in c.get("body", "")]
    if not reports:
        raise Hold("No trusted PR report")
    report = max(reports, key=lambda c: int(c.get("id", 0)))
    body = report["body"]
    for field, expected in (("Head", head), ("Base", base), ("Mode", "phase")):
        if re.findall(r"^" + field + r": (.+)$", body, re.M) != [expected]:
            raise Hold("Trusted report does not bind current PR revisions and phase lane")
    if body.count("PASS: bounded gate checks passed.") != 1 or "FAILED:" in body:
        raise Hold("Trusted report does not attest successful phase validation")
    runs = re.findall(r"^Run: https://github\.com/" + re.escape(repo) + r"/actions/runs/([1-9][0-9]*)$", body, re.M)
    if len(runs) != 1:
        raise Hold("Trusted report run identity unavailable")
    run_id = runs[0]
    policy.verify_attestation(repo, head, run_id)
    run = api(f"repos/{repo}/actions/runs/{run_id}")
    associations = run.get("pull_requests")
    if run.get("status") != "completed" or run.get("conclusion") != "success" or not isinstance(associations, list):
        raise Hold("Validation run is incomplete or lacks association evidence")
    for item in associations:
        if not isinstance(item, dict) or item.get("number") != number or item.get("head", {}).get("sha") != head or item.get("base", {}).get("sha") != base:
            raise Hold("Validation run belongs to another PR/revision")
    artifacts = pages(f"repos/{repo}/actions/runs/{run_id}/artifacts", "artifacts")
    matching = [a for a in artifacts if a.get("name") == f"gate-evidence-{number}-{head}"]
    if (len(matching) != 1 or matching[0].get("expired") is not False or
            str(matching[0].get("workflow_run", {}).get("id")) != run_id or
            matching[0].get("workflow_run", {}).get("head_sha") != head):
        raise Hold("Run artifact does not bind this exact PR/head")
    return run_id


def main_deadline(repo, base, clock):
    """Retain the verified Main guard's expiry for the final local PUT boundary."""
    runs = pages(f"repos/{repo}/actions/workflows/arcade_gate.yml/runs?head_sha={base}", "workflow_runs")
    matching = [r for r in runs if r.get("head_sha") == base and r.get("head_branch") == "main" and
                r.get("event") in {"push", "schedule", "workflow_dispatch"}]
    if not matching:
        raise Hold("Current main has no Main guard evidence")
    latest = max(matching, key=lambda r: policy.timestamp(r.get("created_at")))
    observed = policy.timestamp(latest.get("updated_at"))
    deadline = observed + timedelta(hours=6)
    if (latest.get("status") != "completed" or latest.get("conclusion") != "success" or
            not observed <= clock <= deadline):
        raise Hold("Exact-main acceptance is not fresh and successful")
    jobs = pages(f"repos/{repo}/actions/runs/{latest['id']}/jobs", "jobs")
    guards = [j for j in jobs if j.get("name") == "Main guard"]
    if len(guards) != 1 or guards[0].get("status") != "completed" or guards[0].get("conclusion") != "success":
        raise Hold("Current Main guard did not actually succeed")
    return deadline


def readback(state, item, save, clock):
    pr = api(f"repos/{item['repo']}/pulls/{item['pr']}")
    if (pr.get("number") != item["pr"] or pr.get("head", {}).get("sha") != item["head"] or
            pr.get("head", {}).get("repo", {}).get("full_name") != item["repo"] or
            pr.get("base", {}).get("ref") != "main" or pr.get("merged") is not True or
            not SHA.fullmatch(pr.get("merge_commit_sha") or "") or
            item.get("response_sha", pr.get("merge_commit_sha")) != pr.get("merge_commit_sha")):
        item.update(status="ambiguous", last_observed_at=stamp(clock))
        save(state)
        raise Hold("Merge remains unconfirmed; durable intent forbids another PUT")
    item.update(status="awaiting_main_acceptance", merge_sha=pr["merge_commit_sha"], merged_observed_at=stamp(clock))
    rec = state["sessions"][item["session_id"]]
    rec.update(outcome="merged", merge_sha=item["merge_sha"], finished=stamp(clock))
    save(state)


def accept_main(state, item, save, clock):
    repo = item["repo"]
    current = api(f"repos/{repo}/git/ref/heads/main").get("object", {}).get("sha", "")
    if not SHA.fullmatch(current):
        raise Hold("Current main identity unavailable after merge")
    if current != item["merge_sha"]:
        compare = api(f"repos/{repo}/compare/{item['merge_sha']}...{current}")
        if compare.get("merge_base_commit", {}).get("sha") != item["merge_sha"] or compare.get("status") != "ahead":
            raise Hold("Merged revision is not an ancestor of current main")
    runs = pages(f"repos/{repo}/actions/workflows/arcade_gate.yml/runs?head_sha={current}", "workflow_runs")
    runs = [r for r in runs if r.get("head_sha") == current and r.get("head_branch") == "main" and r.get("event") == "push"]
    if not runs:
        raise Hold("Merged phase awaits the native push Main guard; no duplicate dispatch")
    latest = max(runs, key=lambda r: policy.timestamp(r.get("created_at")))
    if (latest.get("status") != "completed" or latest.get("conclusion") != "success" or
            not timedelta(0) <= clock - policy.timestamp(latest.get("updated_at")) <= timedelta(hours=6)):
        raise Hold("Postmerge push Main guard is not fresh and successful")
    jobs = pages(f"repos/{repo}/actions/runs/{latest['id']}/jobs", "jobs")
    guards = [j for j in jobs if j.get("name") == "Main guard"]
    if len(guards) != 1 or guards[0].get("status") != "completed" or guards[0].get("conclusion") != "success":
        raise Hold("Postmerge Main guard did not actually pass")
    if api(f"repos/{repo}/git/ref/heads/main").get("object", {}).get("sha") != current:
        raise Hold("Main advanced during acceptance readback")
    item.update(status="accepted", accepted_main_sha=current, accepted_run_id=latest["id"], accepted_at=stamp(clock))
    save(state)


def recover(state, pending, cfg, save, clock_fn, read_only):
    if len(pending) != 1 or pending[0]["repo"] != cfg["repo"]:
        raise Hold("Merge recovery ownership requires review")
    item = pending[0]
    rec = state["sessions"].get(item["session_id"], {})
    if rec.get("pr") != f"https://github.com/{item['repo']}/pull/{item['pr']}":
        raise Hold("Merge recovery no longer matches its retained session PR")
    if read_only:
        raise Hold("Unresolved merge intent requires a writable reconciliation tick")
    if item["status"] in {"pending", "ambiguous"}:
        readback(state, item, save, clock_fn())
    try:
        accept_main(state, item, save, clock_fn())
    except Hold as exc:
        raise MainAcceptanceHold(str(exc)) from None
    return {"status": "accepted", "pr": item["pr"]}


def run_tick(cfg, state, remote, controller_sha, *, save, paused, clock=None, read_only=False, recovery_only=False):
    """At most one candidate per tick; return a decision or raise a fail-closed hold."""
    clock_fn = (lambda: clock) if clock is not None else lambda: datetime.now(timezone.utc)
    observed = clock_fn()
    current = ledger(state)
    pending = [i for i in current["intents"].values() if i["status"] in BLOCKING]
    if recovery_only:
        # Explicit reconciliation remains available when admission is disabled or
        # migration is held. It can only consume an existing intent with GETs.
        clean_controller(controller_sha)
        if not pending:
            return {"status": "no_pending_merge"}
        return recover(state, pending, cfg, save, clock_fn, read_only)
    if not cfg.get("local_integration_enabled"):
        if pending:
            raise Hold("Local integration disabled with unresolved merge history")
        return {"status": "disabled"}
    controls(cfg, state, controller_sha, observed, paused)
    if pending:
        return recover(state, pending, cfg, save, clock_fn, read_only)
    candidates = sorted(sid for sid, rec in state["sessions"].items() if owned(cfg, state, sid, rec, remote.get(sid, {})))
    if not candidates:
        return {"status": "no_candidate"}
    cursor = current.get("cursor", "")
    sid = next((s for s in candidates if s > cursor), candidates[0])
    if not read_only:
        state.setdefault("integration", current)["cursor"] = sid
    rec, repo = state["sessions"][sid], cfg["repo"]
    number = int(rec["pr"].rsplit("/", 1)[1])
    pr = api(f"repos/{repo}/pulls/{number}")
    head, base = pr.get("head", {}).get("sha", ""), pr.get("base", {}).get("sha", "")
    if not SHA.fullmatch(head) or not SHA.fullmatch(base) or pr.get("number") != number:
        raise Hold("PR identity unavailable")
    if any(i["repo"] == repo and i["pr"] == number and i["status"] != "not_sent" for i in current["intents"].values()):
        raise Hold("PR already has durable integration history; no repeated merge request")
    policy.verify_protection(repo)
    policy.verify_pr(repo, number, head, base)
    deadline = main_deadline(repo, base, clock_fn())
    scope(repo, rec, head, base)
    run_id = attestation(repo, number, head, base)
    if read_only:
        return {"status": "ready_read_only", "pr": number}
    # Strict server-side checks close the remaining non-atomic base race.
    policy.verify_protection(repo)
    policy.verify_pr(repo, number, head, base)
    if attestation(repo, number, head, base) != run_id:
        raise Hold("Validation run changed during admission")
    deadline = main_deadline(repo, base, clock_fn())
    controls(cfg, state, controller_sha, clock_fn(), paused)
    local_controls(cfg, state, controller_sha, clock_fn(), paused)
    item = {"repo": repo, "pr": number, "head": head, "base": base, "run_id": run_id,
            "controller_sha": controller_sha, "session_id": sid, "created_at": stamp(clock_fn()), "status": "pending"}
    key = digest({k: item[k] for k in ("repo", "pr", "head", "base", "run_id")})
    previous = current["intents"].get(key)
    if previous:
        item["admission_history"] = previous.get("admission_history", []) + [
            {k: v for k, v in previous.items() if k != "admission_history"}]
    current["intents"][key] = item
    state["integration"] = current
    save(state)  # A crash from this point forward permits GET recovery only.
    try:
        try:
            local_controls(cfg, state, controller_sha, clock_fn(), paused)
            if clock_fn() > deadline:
                raise Hold("Exact-main acceptance expired before merge; no request sent")
        except Hold as exc:
            item.update(status="not_sent", reason=str(exc), finished_at=stamp(clock_fn()))
            save(state)
            raise
        response = api(f"repos/{repo}/pulls/{number}/merge", "PUT", {"sha": head, "merge_method": "squash"})
        if response.get("merged") is True and SHA.fullmatch(response.get("sha") or ""):
            item["response_sha"] = response["sha"]
    except GitHubError:
        item["status"] = "ambiguous"
        save(state)
    readback(state, item, save, clock_fn())
    return {"status": "merged_awaiting_main", "pr": number}
