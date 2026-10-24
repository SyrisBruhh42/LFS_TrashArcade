import copy
from datetime import datetime, timezone
import importlib.util
from pathlib import Path
import unittest
from types import SimpleNamespace
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("integrate_pr", Path(__file__).resolve().parents[1] / "tools/integrate_pr.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
BASE, HEAD, MERGE = "a" * 40, "b" * 40, "c" * 40
REPO = "owner/arcade"
NOW = datetime(2026, 10, 24, 18, 0, tzinfo=timezone.utc)


class IntegrationTests(unittest.TestCase):
    def setUp(self):
        self.calls = []
        self.merged = False
        self.merge_error = False
        self.policy = {"required_status_checks": {"strict": True, "checks": [{"context": "Arcade gate", "app_id": 15368}]},
                       "enforce_admins": {"enabled": True}}
        self.pr = {"state": "open", "draft": False, "merged": False, "mergeable": True,
                   "head": {"sha": HEAD, "repo": {"full_name": REPO}}, "base": {"sha": BASE, "ref": "main"}, "labels": []}
        self.run = {"id": 99, "event": "push", "head_sha": BASE, "head_branch": "main", "status": "completed",
                    "conclusion": "success", "created_at": "2026-10-24T17:30:00Z", "updated_at": "2026-10-24T17:40:00Z"}
        self.status = {"id": 123, "context": "Arcade gate", "state": "success", "creator": {"login": "github-actions[bot]"},
                       "target_url": f"https://github.com/{REPO}/actions/runs/100"}
        self.job = {"name": "Main guard", "status": "completed", "conclusion": "success"}
        self.pr_run = {"id": 100, "head_sha": HEAD, "path": ".github/workflows/arcade_gate.yml", "event": "pull_request_target", "head_repository": {"full_name": REPO}, "pull_requests": []}
        self.pr_jobs = [{"name": name, "status": "completed", "conclusion": "success"} for name in ("Arcade gate", "Trusted gate feedback")]
        self.compare = {"behind_by": 0, "merge_base_commit": {"sha": BASE}}
        self.main_reads = 0
        self.move_on_second_read = False

    def api(self, endpoint, method="GET", body=None):
        self.calls.append((method, endpoint, body))
        if endpoint == "apps/github-actions": return {"id": 15368}
        if endpoint.endswith("/protection"): return copy.deepcopy(self.policy)
        if endpoint.endswith("/merge"):
            self.merged = True
            if self.merge_error: raise m.GitHubError("lost response")
            return {"merged": True, "sha": MERGE}
        if endpoint.endswith("/dispatches"): return {}
        if endpoint.endswith("/pulls/1"):
            p = copy.deepcopy(self.pr)
            if self.merged: p.update(merged=True, merge_commit_sha=MERGE)
            return p
        if endpoint.endswith("git/ref/heads/main"):
            self.main_reads += 1
            sha = MERGE if self.merged or self.move_on_second_read and self.main_reads > 1 else BASE
            return {"object": {"sha": sha}}
        if "/compare/" in endpoint: return copy.deepcopy(self.compare)
        if "/statuses?" in endpoint: return [copy.deepcopy(self.status)]
        if endpoint.endswith("/runs/100"): return copy.deepcopy(self.pr_run)
        if "/runs/100/jobs?" in endpoint: return {"jobs": copy.deepcopy(self.pr_jobs)}
        if "/jobs?" in endpoint: return {"jobs": [copy.deepcopy(self.job)]}
        if "/runs?" in endpoint: return {"workflow_runs": [copy.deepcopy(self.run)]}
        self.fail("Unexpected endpoint " + endpoint)

    def invoke(self, execute=True, enabled=True):
        with patch.object(m, "api", self.api):
            return m.integrate(REPO, 1, HEAD, BASE, execute=execute, enabled=enabled, run_id="100", clock=NOW)

    def assert_held(self, message=None):
        with self.assertRaises(m.Hold): self.invoke()
        self.assertFalse(any(c[0] != "GET" for c in self.calls), message)

    def test_disabled_no_requests(self):
        with self.assertRaises(m.Hold): self.invoke(enabled=False)
        self.assertEqual(self.calls, [])

    def test_check_only_reads(self):
        self.assertEqual(self.invoke(execute=False)["status"], "READY")
        self.assertTrue(all(c[0] == "GET" for c in self.calls))

    def test_merge_once_then_request_audit_without_registry_push(self):
        r = self.invoke()
        self.assertEqual(r["status"], "MERGED")
        mutations = [(method, body) for method, _, body in self.calls if method != "GET"]
        self.assertEqual(mutations, [("PUT", {"sha": HEAD, "merge_method": "squash"}), ("POST", {"ref": "main"})])

    def test_ambiguous_merge_readback_never_retries(self):
        self.merge_error = True
        self.assertEqual(self.invoke()["status"], "MERGED_READBACK")
        self.assertEqual(sum(method == "PUT" for method, _, _ in self.calls), 1)

    def test_missing_strict_rules(self):
        self.policy["required_status_checks"]["strict"] = False
        self.assert_held()

    def test_gate_bound_to_wrong_app(self):
        self.policy["required_status_checks"]["checks"][0]["app_id"] = -1
        self.assert_held()

    def test_admin_bypass_rejected(self):
        self.policy["enforce_admins"]["enabled"] = False
        self.assert_held()

    def test_review_bypass_rejected(self):
        self.policy["required_pull_request_reviews"] = {"bypass_pull_request_allowances": {"apps": [1]}}
        self.assert_held()

    def test_head_moved(self):
        self.pr["head"]["sha"] = MERGE
        self.assert_held()

    def test_base_moves_at_last_moment(self):
        self.move_on_second_read = True
        self.assert_held()

    def test_unupdated_branch(self):
        self.compare["behind_by"] = 1
        self.assert_held()

    def test_maintenance_never_auto_merges(self):
        self.pr["labels"] = [{"name": "arcade:maintenance"}]
        self.assert_held()

    def test_skipped_main_job_not_success(self):
        self.job["conclusion"] = "skipped"
        self.assert_held()

    def test_stale_main_run(self):
        self.run["updated_at"] = "2026-10-24T10:00:00Z"
        self.assert_held()

    def test_forged_status_actor(self):
        self.status["creator"]["login"] = "owner"
        self.assert_held()

    def test_status_for_other_run(self):
        self.status["target_url"] += "0"
        self.assert_held()

    def test_page_limit_is_not_complete_inventory(self):
        with patch.object(m, "api", return_value=[{}] * 100):
            with self.assertRaises(m.Hold): m.pages("endpoint")

    def test_policy_lookup_denied_holds_without_merge(self):
        with patch.object(m, "api", side_effect=m.GitHubError("HTTP 403")) as api:
            with self.assertRaises(m.Hold): m.verify_protection(REPO)
            self.assertEqual(api.call_count, 1)

    def test_other_workflow_cannot_attest(self):
        self.pr_run["path"] = ".github/workflows/other.yml"
        self.assert_held()

    def test_wrong_run_head_cannot_attest(self):
        self.pr_run["head_sha"] = BASE
        self.assert_held()

    def test_missing_or_failed_gate_job_cannot_attest(self):
        self.pr_jobs[0]["conclusion"] = "failure"
        self.assert_held()
        self.pr_jobs = []
        self.assert_held()

    def test_incomplete_main_job_cannot_accept(self):
        self.job["status"] = "in_progress"
        self.assert_held()

    def test_policy_capability_only_used_for_policy_get(self):
        with patch.dict(m.os.environ, {"GH_TOKEN": "fixture-merge", "ARCADE_POLICY_TOKEN": "fixture-policy"}), patch.object(m.subprocess, "run", return_value=SimpleNamespace(returncode=0, stdout="{}")) as run:
            m.api(f"repos/{REPO}/branches/main/protection")
            self.assertEqual(run.call_args.kwargs["env"]["GH_TOKEN"], "fixture-policy")
            self.assertNotIn("ARCADE_POLICY_TOKEN", run.call_args.kwargs["env"])
            m.api(f"repos/{REPO}/pulls/1/merge", "PUT", {"sha": HEAD})
            self.assertEqual(run.call_args.kwargs["env"]["GH_TOKEN"], "fixture-merge")
            self.assertNotIn("ARCADE_POLICY_TOKEN", run.call_args.kwargs["env"])


if __name__ == "__main__": unittest.main()
