#!/usr/bin/env python3
"""Opt-in integration of a tested game PR; never executes candidate code.

The GitHub strict branch rule is the final base-race boundary. Local rechecks
alone are not atomic. Missing protection, identity or evidence holds integration.
No create/merge request is retried after an ambiguous response.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone, timedelta
import json
import os
from pathlib import Path
import re
import subprocess
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
SHA = re.compile(r"[0-9a-f]{40}\Z")
REPO = re.compile(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+\Z")
CONTEXT = "Arcade gate"
WORKFLOW = "arcade_gate.yml"


class Hold(Exception):
    """A missing prerequisite; no mutation is authorized."""


class GitHubError(Exception):
    pass


def api(endpoint: str, method: str = "GET", body: dict | None = None):
    args = ["gh", "api", "--method", method, endpoint]
    environment = dict(os.environ)
    policy_token = environment.pop("ARCADE_POLICY_TOKEN", "")
    # GITHUB_TOKEN cannot request Administration:read. A separately scoped
    # read-only capability may inspect policy; it must never authorize a merge.
    if method == "GET" and re.fullmatch(r"repos/[^/]+/[^/]+/branches/main/protection", endpoint) and policy_token:
        environment["GH_TOKEN"] = policy_token
    if body is not None:
        args += ["--input", "-"]
    try:
        result = subprocess.run(args, input=json.dumps(body) if body is not None else None,
                                text=True, capture_output=True, timeout=90, check=False, env=environment)
    except (OSError, subprocess.TimeoutExpired):
        raise GitHubError("GitHub request transport outcome unavailable") from None
    if result.returncode:
        # Provider responses/commands may contain sensitive values. Do not echo them.
        raise GitHubError("GitHub request failed")
    if not result.stdout.strip():
        return {}
    try:
        return json.loads(result.stdout)
    except ValueError:
        raise GitHubError("GitHub response was not JSON") from None


def pages(endpoint: str, key: str | None = None) -> list:
    records = []
    for page in range(1, 101):
        sep = "&" if "?" in endpoint else "?"
        data = api(f"{endpoint}{sep}per_page=100&page={page}")
        items = data.get(key) if key and isinstance(data, dict) else data
        if not isinstance(items, list):
            raise Hold("incomplete GitHub inventory")
        records.extend(items)
        if len(items) < 100:
            return records
    raise Hold("GitHub inventory page limit reached")


def timestamp(value: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            raise ValueError()
        return parsed
    except (AttributeError, ValueError):
        raise Hold("invalid evidence timestamp") from None


def verify_protection(repo: str) -> None:
    try:
        policy = api(f"repos/{repo}/branches/main/protection")
        app = api("apps/github-actions")
    except GitHubError:
        raise Hold("main protection could not be verified; configure strict required checks") from None
    if not isinstance(policy, dict) or not isinstance(app, dict) or not isinstance(app.get("id"), int):
        raise Hold("invalid protection/app identity")
    required = policy.get("required_status_checks") or {}
    checks = required.get("checks") or []
    bound_check = any(c.get("context") == CONTEXT and c.get("app_id") == app["id"] for c in checks)
    if required.get("strict") is not True or not bound_check:
        raise Hold("main must strictly require Arcade gate from the GitHub Actions app")
    if (policy.get("enforce_admins") or {}).get("enabled") is not True:
        raise Hold("main protection must apply to administrators")
    for flag in ("allow_force_pushes", "allow_deletions"):
        if (policy.get(flag) or {}).get("enabled") is True:
            raise Hold(f"unsafe main protection: {flag}")
    reviews = policy.get("required_pull_request_reviews") or {}
    bypass = reviews.get("bypass_pull_request_allowances") or {}
    if any(bypass.get(kind) for kind in ("users", "teams", "apps")):
        raise Hold("review bypass allowances require separate qualification")


def git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()


def sync_tested_base(pr_number: int, base: str) -> None:
    if os.environ.get("GITHUB_ACTIONS") == "true":
        if git("rev-parse", "HEAD") != base:
            raise Hold("integration helper must execute from the tested trusted base checkout")
    else:
        git("fetch", "--no-tags", "origin", f"{base}:refs/remotes/origin/tested-base",
            f"refs/pull/{pr_number}/head:refs/remotes/pr/head")
        if git("rev-parse", "refs/remotes/origin/tested-base") != base:
            raise Hold("integration helper must execute from the tested trusted base checkout")


def verify_pr(repo: str, number: int, head: str, base: str) -> dict:
    pr = api(f"repos/{repo}/pulls/{number}")
    if not isinstance(pr, dict) or pr.get("state") != "open" or pr.get("draft") or pr.get("merged"):
        raise Hold("PR must be open, ready and unmerged")
    if pr.get("head", {}).get("sha") != head or pr.get("base", {}).get("sha") != base:
        raise Hold("PR head/base moved; require fresh validation")
    if pr.get("base", {}).get("ref") != "main":
        raise Hold("PR is not based on main")
    if pr.get("head", {}).get("repo", {}).get("full_name") != repo:
        raise Hold("automatic integration only accepts this repository's game branches")
    labels = {label.get("name") for label in pr.get("labels", [])}
    if labels & {"arcade:maintenance", "arcade:infrastructure", "factory:pause"}:
        raise Hold("maintenance/infrastructure/paused work requires owner integration")
    if pr.get("mergeable") is not True:
        raise Hold("mergeability is unresolved or conflicting")
    current = api(f"repos/{repo}/git/ref/heads/main")
    if current.get("object", {}).get("sha") != base:
        raise Hold("main moved; require fresh validation")
    compare = api(f"repos/{repo}/compare/{base}...{head}")
    if compare.get("behind_by") != 0 or compare.get("merge_base_commit", {}).get("sha") != base:
        raise Hold("PR must contain tested main; update branch and revalidate")
    return pr


def verify_main_acceptance(repo: str, base: str, clock: datetime) -> None:
    runs = pages(f"repos/{repo}/actions/workflows/{WORKFLOW}/runs?head_sha={quote(base)}", "workflow_runs")
    main_runs = [r for r in runs if r.get("head_sha") == base and r.get("event") in
                 ("push", "schedule", "workflow_dispatch") and r.get("head_branch") == "main"]
    if not main_runs:
        raise Hold("tested main has no full main-guard evidence")
    latest = max(main_runs, key=lambda r: timestamp(r.get("created_at")))
    age = clock - timestamp(latest.get("updated_at"))
    if latest.get("status") != "completed" or latest.get("conclusion") != "success" or not timedelta(0) <= age <= timedelta(hours=6):
        raise Hold("latest exact-main audit is not fresh and successful")
    jobs = pages(f"repos/{repo}/actions/runs/{latest['id']}/jobs", "jobs")
    guard = [j for j in jobs if j.get("name") == "Main guard"]
    if len(guard) != 1 or guard[0].get("status") != "completed" or guard[0].get("conclusion") != "success":
        raise Hold("Main guard did not actually succeed")


def verify_attestation(repo: str, head: str, run_id: str) -> None:
    if not run_id.isdigit():
        raise Hold("missing trusted workflow run identity")
    run = api(f"repos/{repo}/actions/runs/{run_id}")
    if (not isinstance(run, dict) or str(run.get("id")) != run_id or run.get("head_sha") != head
            or run.get("path") != f".github/workflows/{WORKFLOW}" or run.get("event") != "pull_request_target"
            or (run.get("head_repository") or {}).get("full_name") != repo):
        raise Hold("validation run source/workflow identity is unverified")
    # pull_request_target REST runs can have an empty pull_requests list; the
    # trusted workflow event binds the requested PR/base, verify_pr checks them.
    jobs = pages(f"repos/{repo}/actions/runs/{run_id}/jobs", "jobs")
    for name in ("Arcade gate", "Trusted gate feedback"):
        matches = [j for j in jobs if j.get("name") == name]
        if len(matches) != 1 or matches[0].get("status") != "completed" or matches[0].get("conclusion") != "success":
            raise Hold(f"validation prerequisite did not complete successfully: {name}")
    statuses = pages(f"repos/{repo}/commits/{head}/statuses")
    matching = [s for s in statuses if s.get("context") == CONTEXT]
    if not matching:
        raise Hold("no exact-head Arcade gate attestation")
    latest = max(matching, key=lambda s: int(s.get("id", 0)))
    expected = f"https://github.com/{repo}/actions/runs/{run_id}"
    if (latest.get("state") != "success" or latest.get("creator", {}).get("login") != "github-actions[bot]"
            or latest.get("target_url") != expected):
        raise Hold("Arcade gate attestation does not belong to this successful validation run")


def request_main_audit(repo: str, merge_sha: str) -> str:
    """A token-authored merge does not normally trigger another push workflow."""
    try:
        current = api(f"repos/{repo}/git/ref/heads/main")
        if current.get("object", {}).get("sha") != merge_sha:
            return "main_moved_requires_fresh_audit"
        api(f"repos/{repo}/actions/workflows/{WORKFLOW}/dispatches", "POST", {"ref": "main"})
        return "requested_not_yet_accepted"
    except GitHubError:
        return "request_uncertain_do_not_blindly_retry"


def integrate(repo: str, number: int, head: str, base: str, *, execute: bool, run_id: str, enabled: bool,
              clock: datetime | None = None) -> dict:
    if not REPO.fullmatch(repo) or not SHA.fullmatch(head) or not SHA.fullmatch(base) or number <= 0:
        raise Hold("invalid repository/PR/revision identity")
    if execute and not enabled:
        raise Hold("ARCADE_AUTO_MERGE is not explicitly enabled")
    verify_protection(repo)
    verify_pr(repo, number, head, base)
    verify_main_acceptance(repo, base, clock or datetime.now(timezone.utc))
    verify_attestation(repo, head, run_id)
    if not execute:
        return {"status": "READY", "mutated": False, "head": head, "base": base}
    # Recheck immediately before the one mutation. Strict server-side up-to-date
    # checks enforce the remaining race window, including other integration actors.
    verify_protection(repo)
    verify_pr(repo, number, head, base)
    verify_attestation(repo, head, run_id)
    try:
        result = api(f"repos/{repo}/pulls/{number}/merge", "PUT", {"sha": head, "merge_method": "squash"})
    except GitHubError:
        # Readback is safe; repeating PUT is not our recovery strategy.
        try:
            current = api(f"repos/{repo}/pulls/{number}")
        except GitHubError:
            return {"status": "UNCERTAIN", "mutated": "unknown", "head": head,
                    "reason": "merge response/readback unavailable; reconcile before another attempt"}
        if current.get("merged") is True and current.get("head", {}).get("sha") == head and SHA.fullmatch(current.get("merge_commit_sha") or ""):
            return {"status": "MERGED_READBACK", "mutated": True, "merge_sha": current["merge_commit_sha"],
                    "acceptance": "main audit still required", "audit": request_main_audit(repo, current["merge_commit_sha"])}
        return {"status": "UNCERTAIN", "mutated": "unknown", "head": head,
                "reason": "merge not confirmed; no blind retry"}
    if result.get("merged") is not True or not SHA.fullmatch(result.get("sha") or ""):
        return {"status": "HELD", "mutated": False, "reason": "GitHub did not confirm the merge"}
    return {"status": "MERGED", "mutated": True, "merge_sha": result["sha"],
            "acceptance": "main audit still required", "audit": request_main_audit(repo, result["sha"])}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repository", default=os.environ.get("GITHUB_REPOSITORY", ""))
    parser.add_argument("--pr", required=True, type=int)
    parser.add_argument("--head", required=True)
    parser.add_argument("--base", required=True)
    parser.add_argument("--execute", action="store_true", help="Merge once only after all independent prerequisites pass")
    args = parser.parse_args()
    try:
        sync_tested_base(args.pr, args.base)
        result = integrate(args.repository, args.pr, args.head, args.base, execute=args.execute,
                           run_id=os.environ.get("GITHUB_RUN_ID", ""), enabled=os.environ.get("ARCADE_AUTO_MERGE") == "true")
    except (Hold, GitHubError, subprocess.SubprocessError, OSError) as exc:
        result = {"status": "HELD", "mutated": False, "reason": str(exc) if isinstance(exc, (Hold, GitHubError)) else "trusted checkout unavailable"}
    print(json.dumps(result, sort_keys=True))
    return 1 if result["status"] == "UNCERTAIN" else 0


if __name__ == "__main__":
    raise SystemExit(main())
