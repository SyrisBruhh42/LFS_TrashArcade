"""Offline adversarial local integration: all GitHub calls are deterministic mocks."""
import base64
import copy
from datetime import datetime, timezone, timedelta
import importlib.util
import json
import os
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("local_integrate_test", ROOT / "tools/local_integrate.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
BASE, HEAD, MERGE, CONTROLLER = (x * 40 for x in "abcd")
REPO, SID, CORR = "owner/arcade", "s1", "e" * 32
NOW = datetime(2026, 10, 24, 18, tzinfo=timezone.utc)


class LocalIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.calls, self.saved = [], []
        self.merged, self.lost_response, self.crash, self.readback_error = False, False, False, False
        self.main_after = False
        self.cfg = {"repo": REPO, "source": "sources/github/" + REPO, "enabled": True,
                    "local_integration_enabled": True, "inventory_max_age_seconds": 180}
        prompt = "Assignment\nFactory correlation: " + CORR
        title = "[factory:" + CORR + "] assignment"
        rec = {"correlation": CORR, "assigned_folder": "games/083-game", "game_id": "083", "phase": "9",
               "baseline_sha": BASE, "mode": "advance", "title": title, "gate_status": "passed_waiting_merge",
               "created": m.stamp(NOW), "pr": f"https://github.com/{REPO}/pull/1"}
        self.state = {"sessions": {SID: rec}, "intents": {CORR: {"status": "accepted", "session_id": SID,
                     "title": title, "prompt_hash": m.digest(prompt), "record": copy.deepcopy(rec)}},
                     "inventory": {"complete": True, "observed_at": m.stamp(NOW)}}
        self.remote = {SID: {"state": "COMPLETED", "prompt": prompt, "title": title,
                            "sourceContext": {"source": self.cfg["source"], "githubRepoContext": {"startingBranch": "main"}},
                            "outputs": [{"changeSet": {"gitPatch": {}}}, {"pullRequest": {"url": rec["pr"]}}]}}
        self.pr = {"number": 1, "state": "open", "draft": False, "merged": False, "mergeable": True,
                   "head": {"sha": HEAD, "repo": {"full_name": REPO}}, "base": {"sha": BASE, "ref": "main"}, "labels": []}
        self.policy = {"required_status_checks": {"strict": True, "checks": [{"context": "Arcade gate", "app_id": 1}]},
                       "enforce_admins": {"enabled": True}}
        self.variable = {"name": "ARCADE_AUTO_MERGE", "value": "false"}
        self.report = {"id": 10, "user": {"login": "github-actions[bot]", "type": "Bot"}, "body":
                       f"{m.MARKER}\nHead: {HEAD}\nBase: {BASE}\nRun: https://github.com/{REPO}/actions/runs/100\nMode: phase\nPASS: bounded gate checks passed."}
        self.pr_run = {"id": 100, "head_sha": HEAD, "head_repository": {"full_name": REPO}, "pull_requests": [],
                       "path": ".github/workflows/arcade_gate.yml", "event": "pull_request_target", "status": "completed", "conclusion": "success"}
        self.pr_jobs = [{"id": i, "name": name, "status": "completed", "conclusion": "success"}
                        for i, name in enumerate(("Arcade gate", "Trusted gate feedback"))]
        self.artifact = {"id": 500, "name": f"gate-evidence-1-{HEAD}", "expired": False, "workflow_run": {"id": 100, "head_sha": HEAD}}
        self.status = {"id": 20, "context": "Arcade gate", "state": "success", "creator": {"login": "github-actions[bot]"},
                       "target_url": f"https://github.com/{REPO}/actions/runs/100"}
        self.main_run = {"id": 99, "head_sha": BASE, "head_branch": "main", "event": "push", "status": "completed",
                         "conclusion": "success", "created_at": m.stamp(NOW-timedelta(minutes=10)), "updated_at": m.stamp(NOW-timedelta(minutes=5))}
        self.main_job = {"id": 1, "name": "Main guard", "status": "completed", "conclusion": "success"}
        self.files = [{"filename": "games/083-game/game.js"}, {"filename": "games/registry.js"}]
        self.manifest = {"id": "083", "slug": "083-game", "phase": "9"}

    def save(self, state):
        self.saved.append(copy.deepcopy(state))

    def api(self, endpoint, method="GET", body=None):
        self.calls.append((method, endpoint, body))
        if endpoint.endswith("/merge"):
            self.assertTrue(self.saved)
            self.assertEqual(next(iter(self.saved[-1]["integration"]["intents"].values()))["status"], "pending")
            if self.crash:
                raise SystemExit("crash at transport boundary")
            if self.lost_response == "unsent":
                raise m.GitHubError("lost")
            self.merged = True
            if self.lost_response:
                raise m.GitHubError("lost")
            return {"merged": True, "sha": MERGE}
        if endpoint.endswith("/pulls/1"):
            if self.readback_error and self.merged:
                raise m.GitHubError("read unavailable")
            pr = copy.deepcopy(self.pr)
            if self.merged:
                pr.update(merged=True, state="closed", merge_commit_sha=MERGE)
            return pr
        if endpoint.endswith("/ARCADE_AUTO_MERGE"): return copy.deepcopy(self.variable)
        if "/issues?" in endpoint: return []
        if endpoint.endswith("/protection"): return copy.deepcopy(self.policy)
        if endpoint == "apps/github-actions": return {"id": 1}
        if endpoint.endswith("git/ref/heads/main"): return {"object": {"sha": MERGE if self.merged else BASE}}
        if "/compare/" in endpoint: return {"behind_by": 0, "base_commit": {"sha": BASE}, "merge_base_commit": {"sha": BASE}, "files": copy.deepcopy(self.files)}
        if "/files?" in endpoint: return copy.deepcopy(self.files)
        if "/contents/" in endpoint:
            return {"type": "file", "encoding": "base64", "size": 100, "content": base64.b64encode(json.dumps(self.manifest).encode()).decode()}
        if "/comments?" in endpoint: return [copy.deepcopy(self.report)]
        if endpoint.endswith("/runs/100"): return copy.deepcopy(self.pr_run)
        if "/runs/100/jobs?" in endpoint: return {"total_count": len(self.pr_jobs), "jobs": copy.deepcopy(self.pr_jobs)}
        if "/artifacts?" in endpoint: return {"total_count": 1, "artifacts": [copy.deepcopy(self.artifact)]}
        if "/statuses?" in endpoint: return [copy.deepcopy(self.status)]
        if "/runs?" in endpoint:
            run = copy.deepcopy(self.main_run)
            if self.main_after: run["head_sha"] = MERGE
            return {"total_count": 1, "workflow_runs": [run]}
        if "/jobs?" in endpoint: return {"total_count": 1, "jobs": [copy.deepcopy(self.main_job)]}
        self.fail("Unexpected endpoint " + endpoint)

    def invoke(self, **kw):
        with patch.object(m, "api", side_effect=self.api), patch.object(m, "clean_controller"):
            return m.run_tick(self.cfg, self.state, self.remote, CONTROLLER, save=self.save, paused=lambda: False, clock=kw.pop("clock", NOW), **kw)

    def held(self):
        with self.assertRaises((m.Hold, m.GitHubError)):
            self.invoke()
        self.assertFalse(any(x[0] != "GET" for x in self.calls))

    def test_disabled_does_no_github_reads(self):
        self.cfg["local_integration_enabled"] = False
        self.assertEqual(self.invoke()["status"], "disabled")
        self.assertEqual(self.calls, [])

    def test_read_only_verifies_without_state_or_remote_mutation(self):
        before = copy.deepcopy(self.state)
        self.assertEqual(self.invoke(read_only=True)["status"], "ready_read_only")
        self.assertEqual(self.state, before)
        self.assertFalse(self.saved)
        self.assertTrue(all(x[0] == "GET" for x in self.calls))

    def test_merge_durable_before_one_put_fresh_readback_no_post(self):
        self.assertEqual(self.invoke()["status"], "merged_awaiting_main")
        self.assertTrue(m.blocked(self.state))
        self.assertEqual([x[0] for x in self.calls if x[0] != "GET"], ["PUT"])
        self.assertLess(len(self.calls), 45)  # Bounded independent of the account's historical session count.
        self.assertEqual(self.state["sessions"][SID]["outcome"], "merged")

    def test_empty_associations_supported_only_with_full_report_chain(self):
        self.assertEqual(self.invoke(read_only=True)["status"], "ready_read_only")
        self.artifact["name"] = f"gate-evidence-999-{HEAD}"
        self.held()

    def test_run_other_pr_or_wrong_base_rejected(self):
        for assoc in ({"number": 999, "head": {"sha": HEAD}, "base": {"sha": BASE}},
                      {"number": 1, "head": {"sha": HEAD}, "base": {"sha": MERGE}}):
            self.pr_run["pull_requests"] = [assoc]
            self.held()

    def test_missing_associations_failed_run_and_wrong_workflow_rejected(self):
        for key, value in (("pull_requests", None), ("status", "in_progress"), ("conclusion", "failure"), ("event", "push"), ("path", "evil.yml")):
            with self.subTest(key=key):
                old = self.pr_run[key]; self.pr_run[key] = value; self.held(); self.pr_run[key] = old

    def test_report_wrong_lane_revision_or_author_rejected(self):
        original = copy.deepcopy(self.report)
        for report in ({**original, "body": original["body"].replace("Mode: phase", "Mode: maintenance")},
                       {**original, "body": original["body"].replace("Base: " + BASE, "Base: " + MERGE)},
                       {**original, "body": original["body"] + "\nMode: phase"},
                       {**original, "user": {"login": "other", "type": "Bot"}}):
            self.report = report; self.held()

    def test_latest_status_must_name_same_run_and_trusted_bot(self):
        for key, value in (("target_url", f"https://github.com/{REPO}/actions/runs/999"), ("creator", {"login": "human"}), ("state", "pending")):
            old = self.status[key]; self.status[key] = value; self.held(); self.status[key] = old

    def test_artifact_expired_wrong_head_wrong_run_rejected(self):
        for key, value in (("expired", True), ("workflow_run", {"id": 999, "head_sha": HEAD}), ("workflow_run", {"id": 100, "head_sha": BASE})):
            old = self.artifact[key]; self.artifact[key] = value; self.held(); self.artifact[key] = old

    def test_scope_control_othergame_and_cross_scope_rename_rejected(self):
        for item in ({"filename": "tools/factory_dispatch.py"}, {"filename": "games/084-other/game.js"},
                     {"filename": "games/083-game/a.js", "previous_filename": "games/084-other/a.js"}):
            self.files = [item]; self.held()

    def test_scope_reads_only_immutable_diff_and_rejects_github_file_cap(self):
        self.invoke(read_only=True)
        self.assertFalse(any("/files?" in endpoint for _, endpoint, _ in self.calls))
        comparisons = [endpoint for _, endpoint, _ in self.calls if "/compare/" in endpoint]
        self.assertTrue(comparisons)
        self.assertTrue(all(endpoint.endswith(f"{BASE}...{HEAD}") for endpoint in comparisons))
        self.files = [{"filename": f"games/083-game/{i}.js"} for i in range(300)]
        self.held()

    def test_wrong_game_immutable_head_cannot_borrow_mutable_pr_file_scope(self):
        self.files = [{"filename": "games/084-other/game.js"}]
        original_api = self.api
        def branch_race(endpoint, method="GET", body=None):
            if "/files?" in endpoint:
                self.calls.append((method, endpoint, body))
                return [{"filename": "games/083-game/game.js"}]
            return original_api(endpoint, method, body)
        # Head reads remain A, while a transient B can supply an assigned-game
        # mutable file list. The immutable A diff changes game 084 and must fail.
        self.api = branch_race
        self.held()
        self.assertFalse(any("/files?" in endpoint for _, endpoint, _ in self.calls))

    def test_wrong_assigned_phase_rejected(self):
        self.manifest["phase"] = "10"; self.held()

    def test_maintenance_label_or_assignment_never_integrates(self):
        self.pr["labels"] = [{"name": "arcade:maintenance"}]; self.held()
        self.pr["labels"] = []
        self.state["sessions"][SID]["mode"] = "maintenance"
        self.assertEqual(self.invoke()["status"], "no_candidate")

    def test_legacy_held_paused_failed_or_unowned_session_never_integrates(self):
        rec = copy.deepcopy(self.state["sessions"][SID]); session = copy.deepcopy(self.remote[SID])
        for changes in ({"correlation": None}, {"hold": "needs_owner"}, {"outcome": "failed:closed"}, {"phase": "10"}):
            self.state["sessions"][SID] = {**rec, **changes}
            self.assertEqual(self.invoke()["status"], "no_candidate")
        self.state["sessions"][SID] = rec
        for changes in ({"state": "PAUSED"}, {"state": "FAILED"}, {"prompt": "edited"}, {"outputs": []},
                        {"outputs": [{"changeSet": {}}]}, {"outputs": [{"pullRequest": {}}]}):
            self.remote[SID] = {**session, **changes}
            self.assertEqual(self.invoke()["status"], "no_candidate")
        self.assertTrue(all(x[0] == "GET" for x in self.calls))

    def test_strict_admin_app_bound_protection_and_no_review_bypass(self):
        for policy in ({**self.policy, "enforce_admins": {"enabled": False}},
                       {**self.policy, "required_status_checks": {"strict": False, "checks": []}},
                       {**self.policy, "required_status_checks": {"strict": True, "checks": [{"context": "Arcade gate", "app_id": -1}]}},
                       {**self.policy, "required_pull_request_reviews": {"bypass_pull_request_allowances": {"users": [1]}}}):
            self.policy = policy; self.held()

    def test_cloud_enabled_unreadable_or_migration_hold_rejects(self):
        self.variable["value"] = "true"; self.held()
        self.variable = {}; self.held()
        self.variable = {"name": "ARCADE_AUTO_MERGE", "value": "false"}
        self.state["migration"] = {"admission_hold": True}; self.held()

    def test_stale_inventory_rejected_before_put(self):
        self.state["inventory"]["observed_at"] = m.stamp(NOW-timedelta(hours=1)); self.held()

    def test_clean_pinned_controller_independent_of_main(self):
        with patch.object(m.subprocess, "run", side_effect=[SimpleNamespace(stdout=CONTROLLER), SimpleNamespace(stdout="")]):
            m.clean_controller(CONTROLLER)
        for outputs in ((BASE, ""), (CONTROLLER, " M tools/x")):
            with patch.object(m.subprocess, "run", side_effect=[SimpleNamespace(stdout=x) for x in outputs]), self.assertRaises(m.Hold):
                m.clean_controller(CONTROLLER)

    def test_transport_never_inherits_tokens_or_provider_key(self):
        with patch.dict(os.environ, {"GH_TOKEN": "secret", "GITHUB_TOKEN": "secret", "JULES_API_KEY": "secret", "ARCADE_POLICY_TOKEN": "secret"}), \
                patch.object(m.subprocess, "run", return_value=SimpleNamespace(returncode=0, stdout="{}")) as run:
            m.api("repos/x/y")
        env = run.call_args.kwargs["env"]
        self.assertFalse(any("TOKEN" in key or "KEY" in key for key in env))
        self.assertEqual(env["GH_HOST"], "github.com")

    def test_known_unsent_pause_can_readmit_with_preserved_history(self):
        with patch.object(m, "api", side_effect=self.api), patch.object(m, "clean_controller"), self.assertRaises(m.Hold):
            m.run_tick(self.cfg, self.state, self.remote, CONTROLLER, save=self.save,
                       paused=lambda: bool(self.saved), clock=NOW)
        self.assertFalse(any(x[0] == "PUT" for x in self.calls))
        item = next(iter(self.state["integration"]["intents"].values()))
        self.assertEqual(item["status"], "not_sent")
        self.assertEqual(self.invoke()["status"], "merged_awaiting_main")
        item = next(iter(self.state["integration"]["intents"].values()))
        self.assertEqual(item["admission_history"][0]["status"], "not_sent")
        self.assertIn("pause", item["admission_history"][0]["reason"])
        self.assertEqual(sum(x[0] == "PUT" for x in self.calls), 1)

    def test_ambiguous_success_readback_resolves_without_second_put(self):
        self.lost_response = True
        self.assertEqual(self.invoke()["status"], "merged_awaiting_main")
        self.main_after = True
        self.assertEqual(self.invoke()["status"], "accepted")
        self.assertFalse(m.blocked(self.state))
        self.assertEqual(sum(x[0] == "PUT" for x in self.calls), 1)
        self.assertFalse(any(x[0] == "POST" for x in self.calls))

    def test_ambiguous_unsent_merge_and_crash_do_not_retry_on_restart(self):
        for crash in (False, True):
            with self.subTest(crash=crash):
                self.setUp(); self.crash = crash; self.lost_response = "unsent"
                with self.assertRaises(SystemExit if crash else m.Hold): self.invoke()
                self.state = copy.deepcopy(self.saved[-1])
                self.crash = False
                with self.assertRaises(m.Hold): self.invoke()
                self.assertEqual(sum(x[0] == "PUT" for x in self.calls), 1)
                self.assertTrue(m.blocked(self.state))

    def test_lost_readback_preserves_pending_then_get_recovery_only(self):
        self.readback_error = True
        with self.assertRaises(m.GitHubError): self.invoke()
        self.state = copy.deepcopy(self.saved[-1]); self.readback_error = False
        with self.assertRaises(m.Hold): self.invoke()
        self.assertEqual(sum(x[0] == "PUT" for x in self.calls), 1)
        self.assertTrue(m.blocked(self.state))

    def test_explicit_recovery_only_resolves_with_admission_disabled_and_migration_held(self):
        self.lost_response = "unsent"
        with self.assertRaises(m.Hold): self.invoke()
        self.cfg["local_integration_enabled"] = False
        self.state["migration"] = {"admission_hold": True}
        self.merged, self.main_after = True, True
        self.calls.clear()
        self.assertEqual(self.invoke(recovery_only=True)["status"], "accepted")
        self.assertTrue(all(method == "GET" for method, _, _ in self.calls))
        self.assertTrue(self.state["migration"]["admission_hold"])
        self.assertFalse(m.blocked(self.state))
        self.assertEqual(len(self.state["integration"]["intents"]), 1)

    def test_recovery_only_never_creates_intent_even_with_eligible_candidate(self):
        before = copy.deepcopy(self.state)
        self.assertEqual(self.invoke(recovery_only=True)["status"], "no_pending_merge")
        self.assertEqual(self.state, before)
        self.assertFalse(self.calls)

    def test_main_evidence_expiring_during_checks_holds_before_put(self):
        self.main_run["updated_at"] = m.stamp(NOW-timedelta(hours=5, minutes=59))
        current_time = [NOW]
        original_api = self.api
        def advance(endpoint, method="GET", body=None):
            result = original_api(endpoint, method, body)
            if "/contents/" in endpoint:
                current_time[0] = NOW+timedelta(minutes=2)
            return result
        class Clock:
            @staticmethod
            def now(_tz): return current_time[0]
        self.api = advance
        with patch.object(m, "datetime", Clock), self.assertRaises(m.Hold): self.invoke(clock=None)
        self.assertFalse(any(method != "GET" for method, _, _ in self.calls))

    def test_main_guard_deadline_rechecked_after_durable_save_before_put(self):
        self.main_run["updated_at"] = m.stamp(NOW-timedelta(hours=5, minutes=59))
        current_time = [NOW]
        original_save = self.save
        def slow_save(state):
            original_save(state)
            current_time[0] = NOW+timedelta(minutes=2)
        class Clock:
            @staticmethod
            def now(_tz): return current_time[0]
        self.save = slow_save
        with patch.object(m, "datetime", Clock), self.assertRaises(m.Hold): self.invoke(clock=None)
        self.assertFalse(any(method != "GET" for method, _, _ in self.calls))
        item = next(iter(self.state["integration"]["intents"].values()))
        self.assertEqual(item["status"], "not_sent")
        self.assertIn("acceptance expired", item["reason"])

    def test_disabling_integration_cannot_release_ambiguous_hold(self):
        self.lost_response = "unsent"
        with self.assertRaises(m.Hold): self.invoke()
        self.cfg["local_integration_enabled"] = False
        with self.assertRaises(m.Hold): self.invoke()
        self.assertTrue(m.blocked(self.state))

    def test_postmerge_requires_exact_push_actual_guard_not_manual_dispatch(self):
        self.invoke(); self.main_after = True
        self.main_run["event"] = "workflow_dispatch"
        with self.assertRaises(m.Hold): self.invoke()
        self.main_run["event"] = "push"; self.main_job["conclusion"] = "skipped"
        with self.assertRaises(m.Hold): self.invoke()
        self.assertEqual(sum(x[0] == "PUT" for x in self.calls), 1)

    def test_accepted_history_prevents_replay_even_if_session_reset(self):
        before = copy.deepcopy(self.state["sessions"][SID])
        self.invoke(); self.main_after = True; self.invoke()
        self.state["sessions"][SID] = before
        with self.assertRaises(m.Hold): self.invoke()
        self.assertEqual(sum(x[0] == "PUT" for x in self.calls), 1)

    def test_paginated_missing_total_partial_and_duplicate_evidence_rejects(self):
        for payload in ({"jobs": []}, {"jobs": [], "total_count": 1}, {"jobs": [{"id": 1}, {"id": 1}], "total_count": 2}):
            with patch.object(m, "api", return_value=payload), self.assertRaises(m.Hold): m.pages("x", "jobs")
        with patch.object(m, "api", return_value=[{"id": i} for i in range(100)]) as api, self.assertRaises(m.Hold):
            m.pages("x")
        self.assertEqual(api.call_count, 3)

    def test_malformed_ledger_fails_closed(self):
        self.state["integration"] = {"schema_version": 1, "intents": {"bad": {"status": "pending"}}}
        with self.assertRaises(m.Hold): m.blocked(self.state)


# Reuse reviewed incident construction; all source/catalog/evidence files are in
# TemporaryDirectory and all provider/GitHub transport remains mocked.
import test_factory_maintenance as maintenance_fixtures
f = maintenance_fixtures.f


class PostmergeMaintenanceTests(unittest.TestCase):
    setUp = maintenance_fixtures.MaintenanceTests.setUp
    incident = maintenance_fixtures.MaintenanceTests.incident
    catalog = maintenance_fixtures.MaintenanceTests.catalog
    evidence = maintenance_fixtures.MaintenanceTests.evidence
    install_intent = maintenance_fixtures.MaintenanceTests.install_intent
    record = maintenance_fixtures.MaintenanceTests.record
    session = maintenance_fixtures.MaintenanceTests.session
    tick_fixture = maintenance_fixtures.MaintenanceTests.tick_fixture

    def fixture(self):
        spec = self.incident()
        original, session = self.install_intent("accepted")
        self.state["sessions"]["s1"] = {**original["record"], "outcome": "merged", "provider_state": "COMPLETED",
                                        "merge_sha": BASE, "pr": f"https://github.com/{self.cfg['repo']}/pull/1"}
        item = {"repo": self.cfg["repo"], "pr": 1, "head": HEAD, "base": "f" * 40, "run_id": "100",
                "controller_sha": CONTROLLER, "session_id": "s1", "created_at": f.iso(f.now()),
                "status": "awaiting_main_acceptance", "merge_sha": BASE}
        key = f.digest({k: item[k] for k in ("repo", "pr", "head", "base", "run_id")})
        self.state["integration"] = {"schema_version": 1, "intents": {key: item}}
        f.observe_account(self.cfg, self.state, {})
        return spec, item

    def test_exact_postmerge_incident_can_create_only_one_scoped_attempt(self):
        spec, item = self.fixture()
        with patch.object(f, "gh", return_value=BASE), patch.object(f, "api", return_value={"id": "s2", "state": "QUEUED"}) as api:
            f.dispatch(self.cfg, self.state, False, BASE, self.root, incident_id=spec["id"])
        self.assertEqual(api.call_count, 1)
        prompt = api.call_args.args[2]["prompt"]
        self.assertIn("Factory incident: " + spec["id"], prompt)
        self.assertEqual(item["status"], "awaiting_main_acceptance")
        self.assertTrue(f.integration.blocked(self.state))
        self.assertEqual(self.state["sessions"]["s2"]["mode"], "maintenance")

    def test_pending_ambiguous_or_multiple_intents_never_allow_exception(self):
        spec, item = self.fixture()
        for status in ("pending", "ambiguous"):
            item["status"] = status
            with self.assertRaises(f.Hold):
                f.repair_admission(self.cfg, self.state, "Create", incident_id=spec["id"])
        item["status"] = "awaiting_main_acceptance"
        other = {**item, "pr": 2}
        key = f.digest({k: other[k] for k in ("repo", "pr", "head", "base", "run_id")})
        self.state["integration"]["intents"][key] = other
        with self.assertRaises(f.Hold):
            f.repair_admission(self.cfg, self.state, "Create", incident_id=spec["id"])

    def test_unrelated_wrong_phase_unverified_assignment_or_premerge_incident_rejected(self):
        spec, item = self.fixture()
        for changes in ({"game_id": "084", "assigned_folder": "games/084-other"}, {"protected_phase": "10"}):
            altered = {**spec, **changes}
            entry = f.maintenance.ledger(self.state)[spec["id"]]
            entry.update(spec=altered, spec_hash=f.maintenance.digest(altered))
            with self.assertRaises(f.Hold):
                f.repair_admission(self.cfg, self.state, "Create", incident_id=spec["id"])
        entry.update(spec=spec, spec_hash=f.maintenance.digest(spec))
        spec["observed_sha"] = "f" * 40
        entry["spec_hash"] = f.maintenance.digest(spec)
        with patch.object(f, "gh", return_value=json.dumps({"status": "behind", "base_commit": {"sha": BASE}, "merge_base_commit": {"sha": "f" * 40}})), self.assertRaises(f.Hold):
            f.repair_admission(self.cfg, self.state, "Create", incident_id=spec["id"])
        spec["observed_sha"] = BASE; entry["spec_hash"] = f.maintenance.digest(spec)
        self.state["sessions"]["s1"]["assigned_folder"] = "games/084-other"
        with self.assertRaises(f.Hold):
            f.repair_admission(self.cfg, self.state, "Create", incident_id=spec["id"])

    def test_descendant_diagnosis_requires_exact_ancestry_and_catalog_still_gates_create(self):
        spec, item = self.fixture()
        spec["observed_sha"] = "e" * 40
        self.state["maintenance"]["incidents"][spec["id"]]["spec_hash"] = f.maintenance.digest(spec)
        good = {"status": "ahead", "base_commit": {"sha": BASE}, "merge_base_commit": {"sha": BASE}}
        with patch.object(f, "gh", return_value=json.dumps(good)):
            f.repair_admission(self.cfg, self.state, "Create", incident_id=spec["id"])
            with patch.object(f, "api") as api, self.assertRaisesRegex(f.Hold, "catalog"):
                f.dispatch(self.cfg, self.state, False, BASE, self.root, incident_id=spec["id"])
            api.assert_not_called()
        good["base_commit"]["sha"] = "d" * 40
        with patch.object(f, "gh", return_value=json.dumps(good)), self.assertRaises(f.Hold):
            f.repair_admission(self.cfg, self.state, "Create", incident_id=spec["id"])

    def test_exception_never_releases_generic_feedback_generation_or_budget_and_migration_holds(self):
        spec, item = self.fixture()
        for operation in ("Repair", "Rebase"):
            with self.assertRaises(f.Hold):
                f.repair_admission(self.cfg, self.state, operation, incident_id=spec["id"])
        with self.assertRaises(f.Hold): f.repair_admission(self.cfg, self.state, "Create")
        self.state["migration"] = {"admission_hold": True}
        with self.assertRaisesRegex(f.Hold, "Migration"):
            f.repair_admission(self.cfg, self.state, "Create", incident_id=spec["id"])
        self.state["migration"]["admission_hold"] = False
        self.state["inventory"]["account_active"] = self.cfg["account_active_cap"]
        with self.assertRaises(f.Hold):
            f.repair_admission(self.cfg, self.state, "Create", incident_id=spec["id"])

    def test_fresh_global_stop_cannot_be_converted_to_maintenance_exception(self):
        spec, item = self.fixture()
        self.cfg.update(generation_enabled=False, healthy_ticks_required=1)
        args = self.tick_fixture()
        for error in (f.integration.Hold("Repository pause issue prevents integration"),
                      f.integration.Hold("Local integration requires the clean pinned controller"),
                      f.integration.Hold("Merge recovery ownership requires review"),
                      f.integration.GitHubError("GitHub read unavailable")):
            with patch.object(f, "inventory", return_value={}), patch.object(f.integration, "run_tick", side_effect=error), patch.object(f, "dispatch") as dispatch, patch.object(f, "reconcile") as reconcile:
                self.assertEqual(f.tick(args), 0)
            dispatch.assert_not_called()
            reconcile.assert_not_called()

    def test_red_main_tick_routes_only_matching_maintenance_and_keeps_all_feedback_dry(self):
        spec, item = self.fixture()
        self.cfg.update(generation_enabled=False, healthy_ticks_required=1)
        args = self.tick_fixture()
        with patch.object(f, "inventory", return_value={}), patch.object(f.integration, "run_tick", side_effect=f.integration.MainAcceptanceHold("Main guard failed")), patch.object(f, "reconcile") as reconcile, patch.object(f, "dispatch") as dispatch:
            self.assertEqual(f.tick(args), 0)
        self.assertEqual(dispatch.call_args.kwargs["incident_id"], spec["id"])
        self.assertTrue(all(call.args[3] is True for call in reconcile.call_args_list))
        self.assertTrue(f.integration.blocked(f.load_state()))


if __name__ == "__main__": unittest.main()
