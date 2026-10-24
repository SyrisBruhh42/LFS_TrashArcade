"""Offline failure-injection tests: no credentials, GitHub or Jules service required."""
import argparse
import contextlib
import copy
import importlib.util
import io
import json
import subprocess
import tempfile
import unittest
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch, Mock

SPEC = importlib.util.spec_from_file_location("factory_dispatch", Path(__file__).resolve().parents[1] / "tools/factory_dispatch.py")
f = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(f)
SHA = "a" * 40
CORRELATION = "b" * 32


class FactoryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.addCleanup(self.temp.cleanup)
        self.cfg = json.loads(f.CONFIG_FILE.read_text())
        self.cfg.update(account_active_cap=20, account_daily_cap=100, account_active_reserve=1,
                        account_daily_reserve=5, healthy_ticks_required=2, generation_enabled=True,
                        repair_owner="controller", controller_native_repairs_disabled=True)
        self.state = f.empty_state()
        self.patches = contextlib.ExitStack()
        self.addCleanup(self.patches.close)
        for name, value in {"STATE_DIR": self.root / "state", "STATE_FILE": self.root / "state/state.json",
                            "EVENTS_FILE": self.root / "state/events.jsonl", "LOCK_FILE": self.root / "state/tick.lock",
                            "PAUSE_FILE": self.root / "config/PAUSE", "READ_ONLY": False}.items():
            self.patches.enter_context(patch.object(f, name, value))
        self.patches.enter_context(contextlib.redirect_stdout(io.StringIO()))

    def session(self, sid="s1", state="IN_PROGRESS", hours=1, source=None):
        return {"id": sid, "state": state, "createTime": f.iso(f.now() - timedelta(hours=hours)),
                "sourceContext": {"source": source or self.cfg["source"], "githubRepoContext": {"startingBranch": "main"}}}

    def record(self, **extra):
        return {"created": f.iso(f.now() - timedelta(hours=1)), "game_id": "083", "phase": "9", **extra}

    def install_intent(self, status="pending"):
        prompt = f"Assignment\nFactory correlation: {CORRELATION}"
        title = f"[factory:{CORRELATION}] assigned game"
        rec = self.record(correlation=CORRELATION, assigned_folder="games/083-game", title=title, baseline_sha=SHA, mode="advance")
        intent = {"status": status, "created": rec["created"], "title": title,
                  "body_hash": "c" * 64, "prompt_hash": f.digest(prompt), "record": rec}
        if status == "accepted":
            intent["session_id"] = "s1"
        self.state["intents"][CORRELATION] = intent
        session = self.session()
        session.update(prompt=prompt, title=title)
        return intent, session

    def dispatch_fixture(self):
        (self.root / "games").mkdir()
        prompt = self.root / "prompt.md"
        prompt.write_text("Bounded test assignment")
        self.patches.enter_context(patch.object(f, "ROOT", self.root))
        self.patches.enter_context(patch.object(f, "PROMPT_FILE", prompt))
        brief = {"id": "001", "slug": "001-game", "phase": "1", "mode": "new", "label": "test",
                 "genre": "g", "twist": "t", "setting": "s", "markdown": "Acceptance"}
        self.patches.enter_context(patch.object(f.subprocess, "run", return_value=Mock(stdout=json.dumps(brief))))
        self.patches.enter_context(patch.object(f, "gh", return_value=SHA))
        f.observe_account(self.cfg, self.state, {})

    def test_legacy_412_records_preserved_in_memory_and_after_save(self):
        old = {"sessions": {f"s{i}": self.record(outcome="merged", legacy_field=i) for i in range(412)},
               "lessons": ["one retained lesson"], "api_fail_streak": 0}
        f.STATE_DIR.mkdir()
        f.STATE_FILE.write_text(json.dumps(old))
        state = f.load_state()
        self.assertEqual(len(state["sessions"]), 412)
        self.assertEqual(state["schema"], 2)
        self.assertEqual(state["sessions"]["s411"]["legacy_field"], 411)
        self.assertEqual(json.loads(f.STATE_FILE.read_text()), old)
        f.save_state(state)
        self.assertEqual(len(f.load_state()["sessions"]), 412)

    def test_missing_and_corrupt_state_fail_closed(self):
        with self.assertRaises(f.StateError):
            f.load_state()
        f.STATE_DIR.mkdir()
        for bad in ("{truncated", "[]", '{"sessions":[],"lessons":[]}',
                    '{"sessions":{"s1":{"created":"wrong"}},"lessons":[]}'):
            f.STATE_FILE.write_text(bad)
            with self.assertRaises(f.StateError):
                f.load_state()
            self.assertEqual(f.STATE_FILE.read_text(), bad)

    def test_state_save_fsyncs_file_and_parent_directory(self):
        with patch.object(f.os, "fsync", wraps=f.os.fsync) as fsync:
            f.save_state(self.state)
        self.assertEqual(fsync.call_count, 2)
        self.assertEqual(f.load_state()["sessions"], {})

    def test_post_never_retried_but_reads_are_bounded(self):
        with patch.object(f, "api", side_effect=f.ApiError(0)) as api, patch.object(f.time, "sleep"):
            with self.assertRaises(f.ApiError):
                f.api_retry("POST", "/sessions", {})
            self.assertEqual(api.call_count, 1)
            api.reset_mock()
            with self.assertRaises(f.ApiError):
                f.api_retry("GET", "/sessions")
            self.assertEqual(api.call_count, 3)

    def test_api_error_never_contains_provider_detail_or_key(self):
        self.assertNotIn("secret-key", str(f.ApiError(403, "secret-key")))

    def test_inventory_reads_all_account_pages(self):
        pages = [{"sessions": [self.session(f"s{i}") for i in range(100)], "nextPageToken": "next/a+"},
                 {"sessions": [self.session(f"s{i}") for i in range(100, 200)], "nextPageToken": "last"},
                 {"sessions": [self.session(f"s{i}") for i in range(200, 251)]}]
        with patch.object(f, "api_retry", side_effect=pages) as api:
            result = f.inventory(self.cfg)
        self.assertEqual(len(result), 251)
        self.assertIn("pageSize=100", api.call_args_list[0].args[1])
        self.assertIn("pageToken=next%2Fa%2B", api.call_args_list[1].args[1])

    def test_inventory_cap_cycle_duplicate_and_malformed_fail(self):
        cases = [({"inventory_max_pages": 1}, [{"sessions": [], "nextPageToken": "next"}]),
                 ({}, [{"sessions": [], "nextPageToken": "x"}] * 2),
                 ({}, [{"sessions": [self.session()], "nextPageToken": "x"}, {"sessions": [self.session()]}]),
                 ({}, [{"sessions": "not-a-list"}])]
        for override, pages in cases:
            with self.subTest(override=override, pages=len(pages)):
                with patch.object(f, "api_retry", side_effect=pages), self.assertRaises(f.Hold):
                    f.inventory({**self.cfg, **override})

    def test_intent_is_durable_before_create_and_timeout_never_recreates(self):
        self.dispatch_fixture()
        def timeout(*args, **kwargs):
            persisted = f.load_state()
            intent = next(iter(persisted["intents"].values()))
            self.assertEqual(intent["status"], "pending")
            self.assertRegex(intent["body_hash"], r"^[a-f0-9]{64}$")
            raise f.ApiError(0)
        with patch.object(f, "api", side_effect=timeout) as api:
            with self.assertRaises(f.ApiError):
                f.dispatch(self.cfg, self.state, False, SHA)
            self.assertEqual(api.call_count, 1)
            restored = f.load_state()
            self.assertEqual(next(iter(restored["intents"].values()))["status"], "ambiguous")
            with self.assertRaises(f.Hold):
                f.dispatch(self.cfg, restored, False, SHA)
            self.assertEqual(api.call_count, 1)

    def test_crash_after_post_retains_pending_intent_for_reconciliation(self):
        self.dispatch_fixture()
        with patch.object(f, "api", side_effect=KeyboardInterrupt), self.assertRaises(KeyboardInterrupt):
            f.dispatch(self.cfg, self.state, False, SHA)
        restored = f.load_state()
        self.assertEqual(next(iter(restored["intents"].values()))["status"], "pending")
        with self.assertRaises(f.Hold):
            f.dispatch(self.cfg, restored, False, SHA)

    def test_success_create_has_correlation_hash_and_scoped_autonomy(self):
        self.dispatch_fixture()
        with patch.object(f, "api", return_value=self.session()) as api:
            f.dispatch(self.cfg, self.state, False, SHA)
        body = api.call_args.args[2]
        self.assertFalse(body["requirePlanApproval"])
        self.assertEqual(body["sourceContext"]["source"], self.cfg["source"])
        record = f.load_state()["sessions"]["s1"]
        self.assertEqual(record["baseline_sha"], SHA)
        self.assertEqual(record["assigned_folder"], "games/001-game")

    def test_create_4xx_rejection_retains_failed_intent_without_retry(self):
        self.dispatch_fixture()
        with patch.object(f, "api", side_effect=f.ApiError(429)) as api, self.assertRaises(f.ApiError):
            f.dispatch(self.cfg, self.state, False, SHA)
        self.assertEqual(api.call_count, 1)
        self.assertEqual(next(iter(f.load_state()["intents"].values()))["status"], "rejected")

    def test_exact_intent_recovery_and_wrong_source_rejection(self):
        intent, session = self.install_intent()
        wrong = copy.deepcopy(session)
        wrong["sourceContext"]["githubRepoContext"]["startingBranch"] = "other"
        f.resolve_intents(self.cfg, self.state, {"s1": wrong}, True)
        self.assertEqual(intent["status"], "ambiguous")
        self.assertFalse(self.state["sessions"])
        f.resolve_intents(self.cfg, self.state, {"s1": session}, False)
        self.assertEqual(intent["status"], "accepted")
        self.assertEqual(f.load_state()["sessions"]["s1"]["correlation"], CORRELATION)

    def test_intent_matching_title_alone_is_insufficient(self):
        intent, session = self.install_intent()
        session["prompt"] += " wrong body"
        f.resolve_intents(self.cfg, self.state, {"s1": session}, True)
        self.assertEqual(intent["status"], "ambiguous")

    def test_multiple_matches_never_choose_arbitrarily(self):
        _, session = self.install_intent()
        duplicate = {**session, "id": "s2"}
        with self.assertRaises(f.Hold):
            f.resolve_intents(self.cfg, self.state, {"s1": session, "s2": duplicate}, True)

    def test_absent_list_prompt_enriched_by_id_before_recovery(self):
        intent, session = self.install_intent()
        sparse = {k: v for k, v in session.items() if k != "prompt"}
        with patch.object(f, "api_retry", return_value=session) as api:
            f.resolve_intents(self.cfg, self.state, {"s1": sparse}, True)
        api.assert_called_once_with("GET", "/sessions/s1")
        self.assertEqual(intent["status"], "accepted")

    def test_account_usage_counts_other_repositories_and_terminal_tasks(self):
        remote = {f"s{i}": self.session(f"s{i}", "COMPLETED", source="sources/github/other/repo") for i in range(95)}
        with self.assertRaisesRegex(f.Hold, "rolling-24h"):
            f.capacity(self.cfg, self.state, remote)
        self.assertEqual(self.state["inventory"]["account_created_24h"], 95)

    def test_account_concurrency_includes_other_sources(self):
        remote = {f"s{i}": self.session(f"s{i}", source="sources/github/other/repo") for i in range(19)}
        with self.assertRaisesRegex(f.Hold, "concurrency"):
            f.capacity(self.cfg, self.state, remote)

    def test_unknown_stale_missing_scope_and_untracked_sessions_hold(self):
        cases = [self.session(state="STATE_UNSPECIFIED"), self.session(hours=7), self.session()]
        missing_scope = self.session()
        missing_scope.pop("sourceContext")
        cases.append(missing_scope)
        for session in cases:
            with self.subTest(session=session), self.assertRaises(f.Hold):
                f.capacity(self.cfg, self.state, {"s1": session})

    def test_legacy_stale_outcome_cannot_free_provider_capacity(self):
        self.state["sessions"]["s1"] = self.record(outcome="failed:stale")
        with self.assertRaisesRegex(f.Hold, "stale provider"):
            f.capacity(self.cfg, self.state, {"s1": self.session(hours=7)})

    def test_missing_shared_account_budget_blocks(self):
        self.cfg["account_daily_cap"] = None
        with self.assertRaisesRegex(f.Hold, "explicitly configured"):
            f.capacity(self.cfg, self.state, {})

    def test_pending_plan_or_question_is_never_auto_answered(self):
        for st in ("AWAITING_PLAN_APPROVAL", "AWAITING_USER_FEEDBACK"):
            self.state["sessions"]["s1"] = self.record()
            with patch.object(f, "api") as api:
                f.reconcile(self.cfg, self.state, {"s1": self.session(state=st)}, False)
            api.assert_not_called()
            self.assertEqual(self.state["sessions"]["s1"]["hold"], st.lower())

    def report_fixture(self, classification="runtime"):
        intent, session = self.install_intent("accepted")
        rec = intent["record"].copy()
        rec["pr"] = "https://github.com/" + self.cfg["repo"] + "/pull/123"
        self.state["sessions"]["s1"] = rec
        body = (f"{f.GATE_MARKER}\nHead: {SHA}\nBase: {'d' * 40}\nClassification: {classification}\n"
                f"Run: https://github.com/{self.cfg['repo']}/actions/runs/42\nFAILED: runtime defect")
        pr = {"state": "OPEN", "headRefOid": SHA, "baseRefOid": "d" * 40,
              "comments": [{"author": {"login": "github-actions[bot]"}, "body": body}],
              "statusCheckRollup": [{"name": self.cfg["gate_check_name"], "conclusion": "FAILURE",
                                     "detailsUrl": f"https://github.com/{self.cfg['repo']}/actions/runs/42/job/7"}]}
        self.feedback_run = {"id": 42, "path": ".github/workflows/arcade_gate.yml", "event": "pull_request_target",
               "head_sha": SHA, "status": "completed", "conclusion": "failure",
               "head_repository": {"full_name": self.cfg["repo"]}, "pull_requests": []}
        self.feedback_jobs = {"total_count": 2, "jobs": [
            {"name": "Arcade gate", "status": "completed", "conclusion": "failure"},
            {"name": "Trusted gate feedback", "status": "completed", "conclusion": "success"}]}
        self.feedback_artifacts = {"total_count": 1, "artifacts": [
            {"name": f"gate-evidence-123-{SHA}", "expired": False, "workflow_run": {"id": 42, "head_sha": SHA}}]}
        self.feedback_statuses = [{"id": 1, "context": self.cfg["gate_check_name"], "state": "failure",
                                   "target_url": f"https://github.com/{self.cfg['repo']}/actions/runs/42",
                                   "creator": {"login": "github-actions[bot]"}}]
        def evidence(*args):
            endpoint = args[1]
            if endpoint.endswith("/runs/42"): return json.dumps(self.feedback_run)
            if endpoint.endswith("/jobs?per_page=100"): return json.dumps(self.feedback_jobs)
            if endpoint.endswith("/artifacts?per_page=100"): return json.dumps(self.feedback_artifacts)
            if endpoint.endswith("/statuses?per_page=100"): return json.dumps(self.feedback_statuses)
            self.fail("Unexpected feedback evidence endpoint: " + endpoint)
        self.patches.enter_context(patch.object(f, "gh", side_effect=evidence))
        f.observe_account(self.cfg, self.state, {"s1": session})
        return rec, session, pr

    def test_bounded_repair_deduplicates_and_persists_before_message(self):
        rec, session, pr = self.report_fixture()
        def sent(*args, **kwargs):
            saved = f.load_state()["sessions"]["s1"]["feedback"]
            self.assertEqual(next(iter(saved.values()))["status"], "pending")
            return {}
        with patch.object(f, "api", side_effect=sent) as api:
            f.repair_feedback(self.cfg, self.state, "s1", rec, session, pr, False)
            f.repair_feedback(self.cfg, self.state, "s1", rec, session, pr, False)
        self.assertEqual(api.call_count, 1)
        self.assertEqual(len(rec["feedback"]), 1)
        self.assertIn("games/083-game/", api.call_args.args[2]["prompt"])

    def test_graphql_actions_bot_login_is_recognized(self):
        rec, session, pr = self.report_fixture()
        pr["comments"][0]["author"]["login"] = "github-actions"
        self.assertIsNotNone(f.gate_feedback(self.cfg, pr))

    def test_ambiguous_repair_is_never_retried(self):
        rec, session, pr = self.report_fixture()
        with patch.object(f, "api", side_effect=f.ApiError(0)) as api:
            with self.assertRaises(f.ApiError):
                f.repair_feedback(self.cfg, self.state, "s1", rec, session, pr, False)
            f.repair_feedback(self.cfg, self.state, "s1", rec, session, pr, False)
        self.assertEqual(api.call_count, 1)
        self.assertEqual(next(iter(rec["feedback"].values()))["status"], "ambiguous")

    def test_repair_rejects_spoof_stale_head_scope_and_infrastructure(self):
        for defect in ("author", "head", "scope", "infrastructure"):
            rec, session, pr = self.report_fixture("infrastructure" if defect == "infrastructure" else "runtime")
            if defect == "author":
                pr["comments"][0]["author"]["login"] = "untrusted"
            if defect == "head":
                pr["headRefOid"] = "e" * 40
            if defect == "scope":
                session["sourceContext"]["source"] = "sources/github/other/repo"
            with patch.object(f, "api") as api:
                f.repair_feedback(self.cfg, self.state, "s1", rec, session, pr, False)
            api.assert_not_called()

    def test_dry_run_never_creates_state_events_or_mutates_provider(self):
        self.dispatch_fixture()
        with patch.object(f, "READ_ONLY", True), patch.object(f, "api") as api:
            f.dispatch(self.cfg, self.state, True, SHA)
            with self.assertRaises(f.StateError):
                f.save_state(self.state)
            f.log("read_only_event")
        api.assert_not_called()
        self.assertFalse(f.STATE_DIR.exists())

    def test_status_cli_does_not_require_config_key_or_create_lock(self):
        f.save_state(self.state)
        before = {p.name: p.read_bytes() for p in f.STATE_DIR.iterdir()}
        with patch.object(f.sys, "argv", ["factory_dispatch.py", "--status"]), patch.object(f, "gh") as gh, patch.object(f, "api") as api:
            self.assertEqual(f.main(), 0)
        self.assertEqual(before, {p.name: p.read_bytes() for p in f.STATE_DIR.iterdir()})
        gh.assert_not_called()
        api.assert_not_called()

    def test_main_requires_exact_fresh_latest_success_and_clean_checkout(self):
        base = {"event": "push", "status": "completed", "conclusion": "success", "headSha": SHA,
                "updatedAt": f.iso(f.now()), "url": "https://github.com/run", "databaseId": 42}
        variants = [[], [{**base, "headSha": "b" * 40}], [{**base, "conclusion": "failure"}],
                    [{**base, "updatedAt": f.iso(f.now() - timedelta(hours=7))}],
                    [base, {**base, "status": "in_progress", "updatedAt": f.iso(f.now() + timedelta(seconds=1))}]]
        for runs in variants:
            with patch.object(f, "gh", side_effect=[SHA, json.dumps(runs)]), self.assertRaises(f.Hold):
                f.main_acceptance(self.cfg)
        with patch.object(f, "gh", side_effect=[SHA, json.dumps([base]), json.dumps({"total_count": 1, "jobs": [{"name": "Main guard", "status": "completed", "conclusion": "success"}]})]):
            self.assertEqual(f.main_acceptance(self.cfg), SHA)
        with patch.object(f, "git_read", side_effect=[SHA, " M file"]), self.assertRaises(f.Hold):
            f.control_revision()


    def tick_fixture(self):
        config_path = self.root / "config.json"
        config_path.write_text(json.dumps(self.cfg))
        key_path = self.root / "fake-key"
        key_path.write_text("test-only-not-a-credential")
        self.patches.enter_context(patch.object(f, "CONFIG_FILE", config_path))
        self.patches.enter_context(patch.object(f, "KEY_FILE", key_path))
        self.patches.enter_context(patch.object(f, "gh", side_effect=lambda *args: "[]" if args[0] == "issue" else SHA))
        self.patches.enter_context(patch.object(f, "control_revision", return_value=SHA))
        f.save_state(self.state)
        return argparse.Namespace(status=False, dry_run=False, no_dispatch=False)

    def test_local_integration_precedes_capacity_and_stops_paid_work_after_merge(self):
        self.cfg["local_integration_enabled"] = True
        args = self.tick_fixture()
        with patch.object(f, "inventory", return_value={}), patch.object(f.integration, "run_tick", return_value={"status": "merged_awaiting_main", "pr": 1}) as integrate, patch.object(f, "capacity", side_effect=f.Hold("full")) as capacity, patch.object(f, "reconcile") as reconcile, patch.object(f, "dispatch") as dispatch:
            self.assertEqual(f.tick(args), 0)
        integrate.assert_called_once()
        capacity.assert_not_called()
        reconcile.assert_not_called()
        dispatch.assert_not_called()

    def test_unknown_provider_scope_prevents_local_integration(self):
        self.cfg["local_integration_enabled"] = True
        args = self.tick_fixture()
        with patch.object(f, "inventory", return_value={"s1": self.session(state="UNKNOWN")}), patch.object(f.integration, "run_tick") as integrate:
            self.assertEqual(f.tick(args), 0)
        integrate.assert_not_called()

    def test_local_integration_pending_prevents_paid_feedback_when_disabled(self):
        args = self.tick_fixture()
        with patch.object(f, "inventory", return_value={}), patch.object(f.integration, "run_tick", side_effect=f.integration.Hold("unresolved merge")), patch.object(f, "reconcile") as reconcile, patch.object(f, "dispatch") as dispatch:
            self.assertEqual(f.tick(args), 0)
        reconcile.assert_not_called()
        dispatch.assert_not_called()

    def test_paid_admission_independently_honors_merge_ledger(self):
        with patch.object(f.integration, "blocked", return_value=True), self.assertRaisesRegex(f.Hold, "durable merge"):
            f.repair_admission(self.cfg, self.state)

    def test_no_dispatch_and_dry_run_pass_read_only_integration_flag(self):
        args = self.tick_fixture()
        args.no_dispatch = True
        with patch.object(f, "inventory", return_value={}), patch.object(f.integration, "run_tick", return_value={"status": "no_candidate"}) as integrate, patch.object(f, "main_acceptance", return_value=SHA):
            self.assertEqual(f.tick(args), 0)
        self.assertTrue(integrate.call_args.kwargs["read_only"])

    def test_reconcile_only_invokes_get_only_merge_recovery_without_paid_actions(self):
        self.state["migration"] = {"admission_hold": True}
        args = self.tick_fixture()
        args.reconcile_only = True
        with patch.object(f, "inventory", return_value={}), patch.object(f.integration, "run_tick", return_value={"status": "no_pending_merge"}) as integrate, patch.object(f, "dispatch") as dispatch, patch.object(f, "api") as api:
            self.assertEqual(f.tick(args), 0)
        self.assertTrue(integrate.call_args.kwargs["recovery_only"])
        self.assertTrue(f.load_state()["migration"]["admission_hold"])
        dispatch.assert_not_called()
        api.assert_not_called()

    def test_two_consecutive_healthy_ticks_required_before_create(self):
        args = self.tick_fixture()
        with patch.object(f, "inventory", return_value={}), patch.object(f, "main_acceptance", return_value=SHA), patch.object(f, "dispatch") as dispatch:
            self.assertEqual(f.tick(args), 0)
            dispatch.assert_not_called()
            self.assertEqual(f.load_state()["healthy_ticks"], 1)
            self.assertEqual(f.tick(args), 0)
            dispatch.assert_called_once()

    def test_inventory_uncertainty_blocks_repair_before_mutation(self):
        args = self.tick_fixture()
        with patch.object(f, "inventory", return_value={"s1": self.session(state="STATE_UNSPECIFIED")}), patch.object(f, "reconcile") as reconcile, patch.object(f, "dispatch") as dispatch:
            self.assertEqual(f.tick(args), 0)
            reconcile.assert_not_called()
            dispatch.assert_not_called()

    def test_tick_dry_run_changes_no_files_and_makes_no_provider_post(self):
        args = self.tick_fixture()
        args.dry_run = True
        before = {p.name: p.read_bytes() for p in f.STATE_DIR.iterdir()}
        with patch.object(f, "READ_ONLY", True), patch.object(f, "inventory", return_value={}), patch.object(f, "main_acceptance", return_value=SHA), patch.object(f, "api") as api:
            self.assertEqual(f.tick(args), 0)
        api.assert_not_called()
        self.assertEqual(before, {p.name: p.read_bytes() for p in f.STATE_DIR.iterdir()})

    def test_disabled_or_local_pause_never_reads_provider_or_sends_feedback(self):
        args = self.tick_fixture()
        f.PAUSE_FILE.parent.mkdir(parents=True)
        f.PAUSE_FILE.write_text("paused")
        with patch.object(f, "inventory") as inventory, patch.object(f, "reconcile") as reconcile:
            self.assertEqual(f.tick(args), 0)
        inventory.assert_not_called()
        reconcile.assert_not_called()

    def test_resolved_provider_question_releases_hold_without_nudge(self):
        intent, session = self.install_intent("accepted")
        self.state["sessions"]["s1"] = {**intent["record"], "hold": "awaiting_user_feedback"}
        with patch.object(f, "api") as api:
            f.reconcile(self.cfg, self.state, {"s1": session}, False)
        api.assert_not_called()
        self.assertNotIn("hold", self.state["sessions"]["s1"])
        self.assertEqual(f.capacity(self.cfg, self.state, {"s1": session})["account_active"], 1)

    def test_terminal_local_outcome_does_not_release_active_assignment(self):
        intent, session = self.install_intent("accepted")
        self.state["sessions"]["s1"] = {**intent["record"], "outcome": "failed:stale"}
        f.reconcile(self.cfg, self.state, {"s1": session}, False)
        self.assertEqual(self.state["sessions"]["s1"]["hold"], "terminal_record_provider_active")
        with self.assertRaisesRegex(f.Hold, "terminal_record_provider_active"):
            f.capacity(self.cfg, self.state, {"s1": session})

    def test_corrupt_accepted_intent_fails_closed(self):
        self.install_intent("accepted")
        f.save_state(self.state)
        with self.assertRaisesRegex(f.StateError, "matching durable session"):
            f.load_state()

    def test_open_breaker_suppresses_paid_feedback(self):
        self.state["breaker"] = {"reason": "test", "created": f.iso(f.now())}
        args = self.tick_fixture()
        with patch.object(f, "inventory", return_value={}), patch.object(f, "main_acceptance", return_value=SHA), patch.object(f, "reconcile") as reconcile, patch.object(f, "dispatch") as dispatch:
            self.assertEqual(f.tick(args), 0)
        self.assertTrue(reconcile.call_args.args[3])
        dispatch.assert_not_called()


    def test_source_snapshot_can_advance_while_controller_stays_pinned(self):
        roots = []
        def git(root, *args):
            roots.append(Path(root))
            if args[0] == "checkout":
                (Path(root) / "games").mkdir()
            if args == ("rev-parse", "HEAD"):
                return SHA
            return ""
        with patch.object(f, "git_read", side_effect=git) as call:
            with f.source_snapshot(self.cfg, SHA, False, "b" * 40) as source:
                self.assertTrue(source.exists())
                self.assertNotEqual(source, f.ROOT)
                self.assertIn("https://github.com/" + self.cfg["repo"] + ".git", str(call.call_args_list))
            self.assertFalse(source.exists())
        self.assertTrue(all(root == source for root in roots))

    def test_dry_run_does_not_fetch_or_create_source_snapshot(self):
        with patch.object(f.tempfile, "TemporaryDirectory") as temporary, patch.object(f, "git_read") as git:
            with self.assertRaisesRegex(f.Hold, "no temporary clone"):
                with f.source_snapshot(self.cfg, SHA, True, "b" * 40):
                    self.fail("Must not yield an unavailable snapshot")
        temporary.assert_not_called()
        git.assert_not_called()

    def test_source_fetch_failure_cleans_up_only_owned_temporary_directory(self):
        roots = []
        def fail(root, *args):
            roots.append(Path(root))
            raise f.Hold("offline")
        with patch.object(f, "git_read", side_effect=fail), self.assertRaises(f.Hold):
            with f.source_snapshot(self.cfg, SHA, False, "b" * 40):
                self.fail("Fetch should fail")
        self.assertFalse(roots[0].exists())
        self.assertTrue(f.ROOT.exists())

    def test_completed_session_is_not_sent_unqualified_repair(self):
        rec, session, pr = self.report_fixture()
        session["state"] = "COMPLETED"
        with patch.object(f, "api") as api:
            f.repair_feedback(self.cfg, self.state, "s1", rec, session, pr, False)
        api.assert_not_called()
        self.assertEqual(rec["hold"], "repair_session_not_message_eligible")

    def test_unrelated_workflow_cannot_authorize_repair(self):
        rec, session, pr = self.report_fixture()
        with patch.object(f, "gh", return_value=json.dumps({"path": ".github/workflows/other.yml"})), patch.object(f, "api") as api:
            f.repair_feedback(self.cfg, self.state, "s1", rec, session, pr, False)
        api.assert_not_called()
        self.assertEqual(rec["hold"], "repair_run_provenance_unverified")

    def test_unconfigured_account_caps_suppress_all_paid_feedback(self):
        self.cfg["account_daily_cap"] = None
        args = self.tick_fixture()
        with patch.object(f, "inventory", return_value={}), patch.object(f, "reconcile") as reconcile:
            self.assertEqual(f.tick(args), 0)
        self.assertTrue(reconcile.call_args.args[3])


    def test_workflow_success_with_skipped_or_incomplete_main_guard_is_not_acceptance(self):
        run = {"event": "push", "status": "completed", "conclusion": "success", "headSha": SHA,
               "updatedAt": f.iso(f.now()), "databaseId": 42}
        pages = [{"total_count": 1, "jobs": [{"name": "Main guard", "status": "completed", "conclusion": "skipped"}]},
                 {"total_count": 1, "jobs": [{"name": "Other job", "status": "completed", "conclusion": "success"}]},
                 {"total_count": 101, "jobs": []}, {"total_count": 2, "jobs": []}]
        for jobs in pages:
            with patch.object(f, "gh", side_effect=[SHA, json.dumps([run]), json.dumps(jobs)]), self.assertRaises(f.Hold):
                f.main_acceptance(self.cfg)

    def test_stale_inventory_never_authorizes_repair_post(self):
        rec, session, pr = self.report_fixture()
        self.state["inventory"]["observed_at"] = f.iso(f.now() - timedelta(seconds=181))
        with patch.object(f, "api") as api, self.assertRaisesRegex(f.Hold, "inventory stale"):
            f.repair_feedback(self.cfg, self.state, "s1", rec, session, pr, False)
        api.assert_not_called()
        self.assertEqual(rec["feedback"], {})

    def test_exhausted_account_headroom_blocks_repair(self):
        for metric, limit in (("account_active", 19), ("account_created_24h", 95)):
            rec, session, pr = self.report_fixture()
            self.state["inventory"][metric] = limit
            with patch.object(f, "api") as api, self.assertRaisesRegex(f.Hold, "headroom"):
                f.repair_feedback(self.cfg, self.state, "s1", rec, session, pr, False)
            api.assert_not_called()

    def test_dirty_controller_prevents_paid_repair_reconciliation(self):
        args = self.tick_fixture()
        with patch.object(f, "control_revision", side_effect=f.Hold("dirty")), patch.object(f, "reconcile") as reconcile:
            self.assertEqual(f.tick(args), 0)
        reconcile.assert_not_called()


    def test_exact_head_status_context_report_authorizes_bounded_repair(self):
        rec, session, pr = self.report_fixture()
        pr["statusCheckRollup"] = [{"context": self.cfg["gate_check_name"], "state": "FAILURE",
                                    "targetUrl": f"https://github.com/{self.cfg['repo']}/actions/runs/42"}]
        with patch.object(f, "api", return_value={}) as api:
            f.repair_feedback(self.cfg, self.state, "s1", rec, session, pr, False)
        api.assert_called_once()

    def test_source_snapshot_rejects_symlink_game_data(self):
        outside = self.root / "outside"
        outside.mkdir()
        snapshot = self.root / "snapshot"
        snapshot.mkdir()
        (snapshot / "games").symlink_to(outside, target_is_directory=True)
        with self.assertRaises(f.Hold):
            f.validate_game_snapshot(snapshot)


    def test_record_scope_drift_cannot_send_repair_to_another_game(self):
        rec, session, pr = self.report_fixture()
        rec["assigned_folder"] = "games/084-other"
        with patch.object(f, "api") as api:
            f.repair_feedback(self.cfg, self.state, "s1", rec, session, pr, False)
        api.assert_not_called()
        self.assertEqual(rec["hold"], "repair_scope_unverified")


    def test_pause_after_intent_before_post_is_known_rejection_not_ambiguity(self):
        self.dispatch_fixture()
        original_save = f.save_state
        def save_then_pause(state):
            original_save(state)
            if any(intent["status"] == "pending" for intent in state["intents"].values()):
                f.PAUSE_FILE.parent.mkdir(parents=True, exist_ok=True)
                f.PAUSE_FILE.write_text("pause before request")
        with patch.object(f, "save_state", side_effect=save_then_pause), patch.object(f, "api") as api:
            with self.assertRaisesRegex(f.Hold, "before POST"):
                f.dispatch(self.cfg, self.state, False, SHA)
            restored = f.load_state()
            intent = next(iter(restored["intents"].values()))
            self.assertEqual(intent["status"], "rejected")
            self.assertEqual(intent["reason"], "local_pause_no_request")
            self.assertRegex(intent["body_hash"], r"^[0-9a-f]{64}$")
            self.assertFalse(restored["sessions"])
            with self.assertRaises(f.Hold):
                f.dispatch(self.cfg, restored, False, SHA)
            api.assert_not_called()
            self.assertEqual(len(restored["intents"]), 1)

    def test_empty_rest_pr_associations_need_complete_report_attestation(self):
        rec, session, pr = self.report_fixture()
        self.assertEqual(self.feedback_run["pull_requests"], [])
        with patch.object(f, "api", return_value={}) as api:
            f.repair_feedback(self.cfg, self.state, "s1", rec, session, pr, False)
        api.assert_called_once()
        self.assertEqual(rec["hold"], "repair_requested")

    def test_conflicting_nonempty_run_associations_reject_even_with_other_attestation(self):
        for change in ({"number": 999}, {"head": {"sha": "e" * 40}}, {"base": {"sha": "e" * 40}}):
            with self.subTest(change=change):
                rec, session, pr = self.report_fixture()
                valid = {"number": 123, "head": {"sha": SHA}, "base": {"sha": "d" * 40}}
                self.feedback_run["pull_requests"] = [valid, {**valid, **change}]
                with patch.object(f, "api") as api:
                    f.repair_feedback(self.cfg, self.state, "s1", rec, session, pr, False)
                api.assert_not_called()
                self.assertEqual(rec["hold"], "repair_run_provenance_unverified")

    def test_repair_attestation_rejects_missing_spoofed_stale_and_partial_evidence(self):
        cases = (
            ("run_identity", lambda: self.feedback_run.update(id=43)),
            ("wrong_head", lambda: self.feedback_run.update(head_sha="d" * 40)),
            ("foreign_repository", lambda: self.feedback_run.update(head_repository={"full_name": "other/repo"})),
            ("missing_association_field", lambda: self.feedback_run.pop("pull_requests")),
            ("reporter_failed", lambda: self.feedback_jobs["jobs"][1].update(conclusion="failure")),
            ("gate_succeeded", lambda: self.feedback_jobs["jobs"][0].update(conclusion="success")),
            ("jobs_partial", lambda: self.feedback_jobs.update(total_count=101)),
            ("jobs_malformed", lambda: self.feedback_jobs.update(jobs=[None, None])),
            ("artifact_other_pr", lambda: self.feedback_artifacts["artifacts"][0].update(name=f"gate-evidence-999-{SHA}")),
            ("artifact_expired", lambda: self.feedback_artifacts["artifacts"][0].update(expired=True)),
            ("artifact_other_run", lambda: self.feedback_artifacts["artifacts"][0]["workflow_run"].update(id=43)),
            ("artifact_other_head", lambda: self.feedback_artifacts["artifacts"][0]["workflow_run"].update(head_sha="d" * 40)),
            ("artifact_partial", lambda: self.feedback_artifacts.update(total_count=2)),
            ("artifact_missing", lambda: self.feedback_artifacts.update(total_count=0, artifacts=[])),
            ("status_spoofed", lambda: self.feedback_statuses[0].update(creator={"login": "owner"})),
            ("status_other_run", lambda: self.feedback_statuses[0].update(target_url="https://github.com/other/repo/actions/runs/42")),
            ("status_now_success", lambda: self.feedback_statuses.append({**self.feedback_statuses[0], "id": 2, "state": "success"})),
            ("status_page_full", lambda: self.feedback_statuses.extend([self.feedback_statuses[0]] * 99)),
            ("status_malformed", lambda: self.feedback_statuses[0].update(creator=[])),
        )
        for label, corrupt in cases:
            with self.subTest(label=label):
                rec, session, pr = self.report_fixture()
                corrupt()
                with patch.object(f, "api") as api:
                    f.repair_feedback(self.cfg, self.state, "s1", rec, session, pr, False)
                api.assert_not_called()
                self.assertEqual(rec["hold"], "repair_run_provenance_unverified")

    def test_old_report_cannot_authorize_after_current_pr_base_changes(self):
        rec, session, pr = self.report_fixture()
        report = f.gate_feedback(self.cfg, pr)
        pr["baseRefOid"] = "e" * 40
        self.assertFalse(f.verified_feedback_run(self.cfg, report, pr, rec["pr"]))

    def test_merged_or_closed_pr_keeps_assignment_until_provider_terminal(self):
        for pr_state in ("MERGED", "CLOSED"):
            with self.subTest(pr_state=pr_state):
                intent, session = self.install_intent("accepted")
                rec = {**intent["record"], "pr": f"https://github.com/{self.cfg['repo']}/pull/123"}
                self.state["sessions"]["s1"] = rec
                with patch.object(f, "gh", return_value=json.dumps({"state": pr_state})):
                    f.reconcile(self.cfg, self.state, {"s1": session}, False)
                    f.reconcile(self.cfg, self.state, {"s1": session}, False)
                self.assertEqual(rec["hold"], "terminal_record_provider_active")
                self.assertTrue(f.assignment_occupied(rec))
                with self.assertRaisesRegex(f.Hold, "terminal_record_provider_active"):
                    f.capacity(self.cfg, self.state, {"s1": session})
                session["state"] = "COMPLETED"
                with patch.object(f, "gh", return_value=json.dumps({"state": pr_state})):
                    f.reconcile(self.cfg, self.state, {"s1": session}, False)
                self.assertNotIn("hold", rec)
                self.assertFalse(f.assignment_occupied(rec))
                f.capacity(self.cfg, self.state, {"s1": session})

    def test_dispatch_excludes_provider_active_assignment_even_with_historical_outcome(self):
        self.dispatch_fixture()
        self.state["sessions"]["s1"] = self.record(outcome="merged", provider_state="IN_PROGRESS", triple=["g", "t", "s"])
        f.dispatch(self.cfg, self.state, True, SHA)
        command = f.subprocess.run.call_args.args[0]
        self.assertEqual(json.loads(command[command.index("--exclude-ids") + 1]), ["083"])
        self.assertEqual(json.loads(command[command.index("--exclude-json") + 1]), [["g", "t", "s"]])

    def test_late_pr_restores_wip_and_preserves_failed_observation_without_paid_action(self):
        rec = self.record(outcome="failed:no_pr", finished="2026-10-24T01:00:00Z")
        self.state["sessions"]["s1"] = rec
        session = self.session(state="COMPLETED")
        session["outputs"] = [{"pullRequest": {"url": f"https://github.com/{self.cfg['repo']}/pull/123"}}]
        with patch.object(f, "gh", return_value=json.dumps({"state": "OPEN"})) as gh, patch.object(f, "api") as api:
            f.reconcile(self.cfg, self.state, {"s1": session}, False)
            f.reconcile(self.cfg, self.state, {"s1": session}, False)
        self.assertEqual(gh.call_count, 2)
        api.assert_not_called()
        self.assertNotIn("outcome", rec)
        self.assertTrue(f.assignment_occupied(rec))
        self.assertEqual(len(rec["outcome_history"]), 1)
        self.assertEqual(rec["outcome_history"][0]["outcome"], "failed:no_pr")
        self.assertEqual(rec["outcome_history"][0]["finished"], "2026-10-24T01:00:00Z")

    def test_reopened_failed_pr_keeps_message_deduplication(self):
        rec, session, pr = self.report_fixture()
        report = f.gate_feedback(self.cfg, pr)
        rec.update(outcome="failed:closed", breaker_reset=True, feedback={report["key"]: {"status": "ambiguous"}})
        def github(*args):
            self.assertEqual(args[0], "pr")  # Deduplication must avoid another evidence/message cycle.
            return json.dumps(pr)
        with patch.object(f, "gh", side_effect=github), patch.object(f, "api") as api:
            f.reconcile(self.cfg, self.state, {"s1": session}, False)
        api.assert_not_called()
        self.assertNotIn("outcome", rec)
        self.assertNotIn("breaker_reset", rec)
        self.assertEqual(rec["feedback"][report["key"]]["status"], "ambiguous")
        self.assertEqual(rec["outcome_history"][0]["outcome"], "failed:closed")
        self.assertTrue(rec["outcome_history"][0]["breaker_reset"])

    def test_no_pr_failure_keeps_original_completion_time_on_later_observations(self):
        rec = self.record(outcome="failed:no_pr", finished="2026-10-24T01:00:00Z")
        self.state["sessions"]["s1"] = rec
        f.reconcile(self.cfg, self.state, {"s1": self.session(state="COMPLETED")}, False)
        self.assertEqual(rec["finished"], "2026-10-24T01:00:00Z")
        self.assertNotIn("outcome_history", rec)

    def test_failed_reclassification_does_not_promote_old_event_into_breaker_window(self):
        current = f.now()
        # Five recent failures are below the 6/12 breaker. Observing an old closed
        # PR must not insert a sixth failure into that operational event window.
        for index in range(12):
            self.state["sessions"][f"recent{index}"] = self.record(
                created=f.iso(current - timedelta(days=2)),
                outcome="failed:closed" if index >= 7 else "merged",
                finished=f.iso(current - timedelta(hours=12-index)))
        original_finished = f.iso(current - timedelta(days=3))
        rec = self.record(created=f.iso(current - timedelta(days=4)), outcome="failed:gate",
                          finished=original_finished, pr=f"https://github.com/{self.cfg['repo']}/pull/118")
        self.state["sessions"]["old"] = rec
        session = self.session(sid="old", state="COMPLETED", hours=96)
        with patch.object(f, "gh", return_value=json.dumps({"state": "CLOSED"})), patch.object(f, "api") as api:
            f.reconcile(self.cfg, self.state, {"old": session}, False)
        api.assert_not_called()
        args = self.tick_fixture()
        args.no_dispatch = True
        with patch.object(f, "inventory", return_value={}), patch.object(f, "main_acceptance", return_value=SHA), patch.object(f, "dispatch") as dispatch:
            self.assertEqual(f.tick(args), 0)
        saved = f.load_state()
        self.assertNotIn("breaker", saved)
        self.assertEqual(saved["healthy_ticks"], 1)
        self.assertEqual(saved["sessions"]["old"]["finished"], original_finished)
        self.assertEqual(saved["sessions"]["old"]["outcome"], "failed:closed")
        self.assertEqual(saved["sessions"]["old"]["outcome_history"][0]["finished"], original_finished)
        dispatch.assert_not_called()
        # An actual reopen followed by another failure is new work, and must
        # still become the sixth recent failure and trip the same real tick gate.
        f.set_outcome(saved["sessions"]["old"], None)
        f.set_outcome(saved["sessions"]["old"], "failed:closed")
        f.save_state(saved)
        with patch.object(f, "inventory", return_value={}), patch.object(f, "main_acceptance", return_value=SHA), patch.object(f, "dispatch") as dispatch:
            self.assertEqual(f.tick(args), 0)
        self.assertEqual(f.load_state()["breaker"]["reason"], "recent_session_failure_rate")
        self.assertEqual(f.load_state()["healthy_ticks"], 0)
        dispatch.assert_not_called()

    def test_failure_reclassification_preserves_review_and_repeated_observation_is_noop(self):
        original = f.now() - timedelta(days=3)
        observed = original + timedelta(days=2)
        rec = self.record(outcome="failed:gate", finished=f.iso(original), breaker_reset=True)
        with patch.object(f, "now", return_value=observed):
            f.set_outcome(rec, "failed:closed")
        self.assertTrue(rec.get("breaker_reset"))
        self.assertEqual(rec["finished"], f.iso(original))
        self.assertEqual(rec["outcome_observed_at"], f.iso(observed))
        self.assertEqual(rec["outcome_history"], [{"outcome": "failed:gate", "finished": f.iso(original),
            "superseded_at": f.iso(observed), "breaker_reset": True}])
        unchanged = copy.deepcopy(rec)
        with patch.object(f, "now", return_value=observed + timedelta(hours=1)):
            f.set_outcome(rec, "failed:closed")
        self.assertEqual(rec, unchanged)
        with patch.object(f, "now", return_value=observed + timedelta(hours=2)):
            f.set_outcome(rec, "failed:session_failed")
        self.assertTrue(rec["breaker_reset"])
        self.assertEqual(rec["finished"], f.iso(original))
        self.assertEqual(rec["outcome_history"][-1]["outcome_observed_at"], f.iso(observed))

    def test_reopened_reclassified_failure_is_a_new_event_without_old_reset_exemption(self):
        original = f.now() - timedelta(days=3)
        rec = self.record(outcome="failed:gate", finished=f.iso(original), breaker_reset=True)
        with patch.object(f, "now", return_value=original + timedelta(days=1)):
            f.set_outcome(rec, "failed:closed")
        with patch.object(f, "now", return_value=original + timedelta(days=2)):
            f.set_outcome(rec, None)
        for field in ("outcome", "finished", "outcome_observed_at", "breaker_reset"):
            self.assertNotIn(field, rec)
        new_failure = original + timedelta(days=3)
        with patch.object(f, "now", return_value=new_failure):
            f.set_outcome(rec, "failed:closed")
        self.assertNotIn("breaker_reset", rec)
        self.assertEqual(rec["finished"], f.iso(new_failure))
        self.assertEqual(rec.get("outcome_observed_at"), f.iso(new_failure))
        self.assertEqual([h["outcome"] for h in rec["outcome_history"]], ["failed:gate", "failed:closed"])
        self.assertTrue(all(h["finished"] == f.iso(original) and h["breaker_reset"] for h in rec["outcome_history"]))
        # Optional observation metadata survives the existing schema-2 loader.
        self.state["sessions"]["s1"] = rec
        f.save_state(self.state)
        self.assertEqual(f.load_state()["sessions"]["s1"], rec)

    def test_observed_provider_reactivation_without_pr_starts_new_failure_event(self):
        current = f.now()
        original_finished = f.iso(current - timedelta(days=3))
        rec = self.record(created=f.iso(current - timedelta(days=4)), outcome="failed:session_failed",
                          finished=original_finished, breaker_reset=True, provider_state="FAILED")
        self.state["sessions"]["s1"] = rec
        active = self.session(state="IN_PROGRESS", hours=96)
        with patch.object(f, "now", return_value=current), patch.object(f, "api") as api:
            f.reconcile(self.cfg, self.state, {"s1": active}, False)
            self.assertNotIn("outcome", rec)
            self.assertNotIn("breaker_reset", rec)
            self.assertTrue(f.assignment_occupied(rec))
            self.assertEqual(rec["outcome_history"][0]["finished"], original_finished)
            self.assertTrue(rec["outcome_history"][0]["breaker_reset"])
            f.reconcile(self.cfg, self.state, {"s1": active}, False)
            self.assertEqual(len(rec["outcome_history"]), 1)
            completed = {**active, "state": "COMPLETED", "updateTime": f.iso(current - timedelta(hours=1))}
            f.reconcile(self.cfg, self.state, {"s1": completed}, False)
        api.assert_not_called()
        self.assertEqual(rec["outcome"], "failed:no_pr")
        self.assertEqual(rec["finished"], f.iso(current))
        self.assertNotIn("breaker_reset", rec)
        self.assertFalse(f.assignment_occupied(rec))
        # The newly failed work must count toward the real failure-rate gate.
        for index in range(12):
            self.state["sessions"][f"recent{index}"] = self.record(
                created=f.iso(current - timedelta(days=2)),
                outcome="failed:closed" if index >= 7 else "merged",
                finished=f.iso(current - timedelta(hours=12-index)))
        args = self.tick_fixture()
        args.no_dispatch = True
        with patch.object(f, "inventory", return_value={}), patch.object(f, "main_acceptance", return_value=SHA), patch.object(f, "dispatch") as dispatch:
            self.assertEqual(f.tick(args), 0)
        self.assertEqual(f.load_state()["breaker"]["reason"], "recent_session_failure_rate")
        dispatch.assert_not_called()

    def test_provider_reactivation_with_closed_pr_does_not_invent_new_failure_event(self):
        current = f.now()
        for retained_pr in (True, False):
            with self.subTest(retained_pr=retained_pr):
                rec = self.record(outcome="failed:closed" if retained_pr else "failed:no_pr",
                                  finished=f.iso(current - timedelta(days=1)),
                                  breaker_reset=True, provider_state="COMPLETED")
                url = f"https://github.com/{self.cfg['repo']}/pull/118"
                if retained_pr:
                    rec["pr"] = url
                self.state["sessions"] = {"s1": rec}
                active = self.session(state="IN_PROGRESS")
                active["outputs"] = [{"pullRequest": {"url": url}}]
                with patch.object(f, "gh", return_value=json.dumps({"state": "CLOSED"})), patch.object(f, "api") as api:
                    with patch.object(f, "now", return_value=current):
                        f.reconcile(self.cfg, self.state, {"s1": active}, False)
                    self.assertEqual(rec["finished"], f.iso(current - timedelta(days=1)))
                    self.assertTrue(rec["breaker_reset"])
                    self.assertTrue(f.assignment_occupied(rec))
                    first = copy.deepcopy(rec)
                    with patch.object(f, "now", return_value=current + timedelta(minutes=1)):
                        f.reconcile(self.cfg, self.state, {"s1": active}, False)
                api.assert_not_called()
                self.assertEqual(rec, first)
                self.assertEqual(len(rec.get("outcome_history", [])), 0 if retained_pr else 1)

    def test_legacy_always_active_failure_reclassification_preserves_original_review(self):
        original_finished = f.iso(f.now() - timedelta(days=3))
        for previous_state in (None, "IN_PROGRESS", "AWAITING_USER_FEEDBACK"):
            with self.subTest(previous_state=previous_state):
                rec = self.record(outcome="failed:gate", finished=original_finished, breaker_reset=True,
                                  pr=f"https://github.com/{self.cfg['repo']}/pull/118")
                if previous_state:
                    rec["provider_state"] = previous_state
                self.state["sessions"] = {"s1": rec}
                with patch.object(f, "gh", return_value=json.dumps({"state": "CLOSED"})), patch.object(f, "api") as api:
                    f.reconcile(self.cfg, self.state, {"s1": self.session(state="IN_PROGRESS")}, False)
                api.assert_not_called()
                self.assertEqual(rec["outcome"], "failed:closed")
                self.assertEqual(rec["finished"], original_finished)
                self.assertTrue(rec["breaker_reset"])
                self.assertTrue(f.assignment_occupied(rec))
                self.assertEqual(rec["outcome_history"][0]["outcome"], "failed:gate")

    def test_provider_reactivation_keeps_confirmed_merge_accepted_but_occupied(self):
        rec = self.record(outcome="merged", finished=f.iso(f.now() - timedelta(days=1)),
                          provider_state="COMPLETED", merge_sha=SHA,
                          pr=f"https://github.com/{self.cfg['repo']}/pull/118")
        original_finished = rec["finished"]
        self.state["sessions"]["s1"] = rec
        with patch.object(f, "gh", return_value=json.dumps({"state": "MERGED", "mergeCommit": {"oid": SHA}})), patch.object(f, "api") as api:
            f.reconcile(self.cfg, self.state, {"s1": self.session(state="IN_PROGRESS")}, False)
        api.assert_not_called()
        self.assertEqual(rec["outcome"], "merged")
        self.assertEqual(rec["finished"], original_finished)
        self.assertEqual(rec["merge_sha"], SHA)
        self.assertNotIn("outcome_history", rec)
        self.assertEqual(rec["hold"], "terminal_record_provider_active")
        self.assertTrue(f.assignment_occupied(rec))

    def test_repair_pause_after_intent_is_known_unsent_and_can_retry_once(self):
        rec, session, pr = self.report_fixture()
        original_save = f.save_state
        def save_then_pause(state):
            original_save(state)
            f.PAUSE_FILE.parent.mkdir(parents=True, exist_ok=True)
            f.PAUSE_FILE.write_text("pause after durable repair intent")
        with patch.object(f, "save_state", side_effect=save_then_pause), patch.object(f, "api") as api:
            with self.assertRaisesRegex(f.Hold, "kill switch"):
                f.repair_feedback(self.cfg, self.state, "s1", rec, session, pr, False)
        api.assert_not_called()
        saved = f.load_state()["sessions"]["s1"]
        self.assertEqual(next(iter(saved["feedback"].values()))["status"], "not_sent")
        self.assertEqual(f.paid_feedback_count(saved), 0)
        f.PAUSE_FILE.unlink()
        with patch.object(f, "api", return_value={}) as api:
            f.repair_feedback(self.cfg, self.state, "s1", rec, session, pr, False)
            f.repair_feedback(self.cfg, self.state, "s1", rec, session, pr, False)
        api.assert_called_once()
        attempt = next(iter(rec["feedback"].values()))
        self.assertEqual(attempt["status"], "sent")
        self.assertEqual(attempt["admission_history"][0]["status"], "not_sent")
        self.assertEqual(f.paid_feedback_count(rec), 1)

    def test_crash_pending_repair_is_not_treated_as_known_unsent(self):
        rec, session, pr = self.report_fixture()
        report = f.gate_feedback(self.cfg, pr)
        rec["feedback"] = {report["key"]: {"status": "pending"}}
        with patch.object(f, "api") as api:
            f.repair_feedback(self.cfg, self.state, "s1", rec, session, pr, False)
        api.assert_not_called()
        self.assertEqual(f.paid_feedback_count(rec), 1)

    def test_historical_pr_cohort_is_bounded_fair_and_survives_restart(self):
        remote = {}
        for index in range(3):
            sid = f"s{index}"
            self.state["sessions"][sid] = self.record(outcome="failed:closed", pr=f"https://github.com/{self.cfg['repo']}/pull/{index + 1}")
            remote[sid] = self.session(sid=sid, state="COMPLETED")
        visited = []
        for _ in range(4):
            with patch.object(f, "gh", return_value=json.dumps({"state": "CLOSED"})) as gh, patch.object(f, "api") as api:
                f.reconcile(self.cfg, self.state, remote, False)
            api.assert_not_called()
            self.assertEqual(gh.call_count, f.TERMINAL_PR_RECHECKS_PER_TICK)
            visited.append(gh.call_args.args[2])
            f.save_state(self.state)
            self.state = f.load_state()
        self.assertEqual(visited, [f"https://github.com/{self.cfg['repo']}/pull/{number}" for number in (1, 2, 3, 1)])

    def test_active_and_new_outputs_bypass_historical_cohort_without_resuming_completed_session(self):
        self.state["sessions"] = {
            "s0": self.record(outcome="failed:closed", pr=f"https://github.com/{self.cfg['repo']}/pull/1"),
            "s1": self.record(outcome="failed:no_pr"),
            "s2": self.record(outcome="failed:closed", pr=f"https://github.com/{self.cfg['repo']}/pull/3"),
        }
        remote = {sid: self.session(sid=sid, state="IN_PROGRESS" if sid == "s2" else "COMPLETED") for sid in self.state["sessions"]}
        remote["s1"]["outputs"] = [{"pullRequest": {"url": f"https://github.com/{self.cfg['repo']}/pull/2"}}]
        with patch.object(f, "gh", return_value=json.dumps({"state": "OPEN"})) as gh, patch.object(f, "api") as api:
            f.reconcile(self.cfg, self.state, remote, False)
        self.assertEqual(gh.call_count, 3)
        api.assert_not_called()
        self.assertTrue(all(f.assignment_occupied(rec) for rec in self.state["sessions"].values()))

    def test_completed_merged_record_is_not_reopened_or_messaged_by_readback(self):
        self.state["sessions"]["s1"] = self.record(outcome="merged", pr=f"https://github.com/{self.cfg['repo']}/pull/123")
        with patch.object(f, "gh") as gh, patch.object(f, "api") as api:
            f.reconcile(self.cfg, self.state, {"s1": self.session(state="COMPLETED")}, False)
        gh.assert_not_called()
        api.assert_not_called()
        self.assertEqual(self.state["sessions"]["s1"]["outcome"], "merged")

    def test_reopened_completed_failed_pr_cannot_resurrect_provider_work(self):
        rec, session, pr = self.report_fixture()
        rec["outcome"] = "failed:closed"
        session["state"] = "COMPLETED"
        with patch.object(f, "gh", return_value=json.dumps(pr)), patch.object(f, "api") as api:
            f.reconcile(self.cfg, self.state, {"s1": session}, False)
        api.assert_not_called()
        self.assertNotIn("outcome", rec)
        self.assertEqual(rec["hold"], "repair_session_not_message_eligible")

    def test_known_unsent_retry_still_consumes_per_tick_message_cap(self):
        self.state["sessions"] = {sid: self.record(pr=f"https://github.com/{self.cfg['repo']}/pull/{index}",
            feedback={"report": {"status": "not_sent"}}) for index, sid in enumerate(("s1", "s2"), 1)}
        remote = {sid: self.session(sid=sid) for sid in self.state["sessions"]}
        pr = {"state": "OPEN", "statusCheckRollup": [{"context": self.cfg["gate_check_name"], "state": "FAILURE"}]}
        def send_once(_cfg, _state, _sid, rec, *_rest):
            rec["feedback"]["report"]["status"] = "sent"
        with patch.object(f, "gh", return_value=json.dumps(pr)), patch.object(f, "repair_feedback", side_effect=send_once) as repair:
            f.reconcile(self.cfg, self.state, remote, False)
        repair.assert_called_once()
        self.assertEqual(self.state["sessions"]["s2"]["hold"], "repair_tick_budget")

    def test_malformed_existing_feedback_cannot_become_retry_authority(self):
        for previous in ({}, None, "not_sent"):
            with self.subTest(previous=previous):
                rec, session, pr = self.report_fixture()
                report = f.gate_feedback(self.cfg, pr)
                rec["feedback"] = {report["key"]: previous}
                with patch.object(f, "api") as api:
                    f.repair_feedback(self.cfg, self.state, "s1", rec, session, pr, False)
                api.assert_not_called()

    def test_reopened_second_historical_pr_blocks_selected_game_before_create(self):
        self.dispatch_fixture()
        urls = [f"https://github.com/{self.cfg['repo']}/pull/{number}" for number in (1, 2)]
        self.state["sessions"] = {
            "s1": self.record(game_id="002", outcome="failed:closed", pr=urls[0]),
            "s2": self.record(game_id="001", outcome="failed:closed", pr=urls[1]),
        }
        remote = {sid: self.session(sid=sid, state="COMPLETED") for sid in self.state["sessions"]}
        def github(*args):
            self.assertEqual(args[0], "pr")
            return json.dumps({"url": args[2], "state": "CLOSED" if args[2] == urls[0] else "OPEN", "baseRefName": "main"})
        with patch.object(f, "gh", side_effect=github) as gh, patch.object(f, "api") as api:
            f.reconcile(self.cfg, self.state, remote, False)
            self.assertEqual(gh.call_count, 1, "archive scan only visits the first historical record")
            self.assertEqual(self.state["sessions"]["s2"]["outcome"], "failed:closed")
            f.capacity(self.cfg, self.state, remote)
            with self.assertRaisesRegex(f.Hold, "reopened historical PR"):
                f.dispatch(self.cfg, self.state, False, SHA)
        api.assert_not_called()
        self.assertEqual([call.args[2] for call in gh.call_args_list], urls)
        self.assertNotIn("outcome", self.state["sessions"]["s2"])
        self.assertTrue(f.assignment_occupied(self.state["sessions"]["s2"]))
        self.assertEqual(self.state["intents"], {})

    def test_closed_selected_game_history_allows_create_without_querying_other_games(self):
        self.dispatch_fixture()
        urls = [f"https://github.com/{self.cfg['repo']}/pull/{number}" for number in (1, 2)]
        self.state["sessions"] = {
            "s1": self.record(game_id="001", outcome="failed:closed", pr=urls[0]),
            "s2": self.record(game_id="001", outcome="failed:closed", pr=urls[1]),
            "s3": self.record(game_id="002", outcome="failed:closed", pr="https://github.com/other/repo/pull/3"),
        }
        def github(*args):
            if args[0] == "api": return SHA
            self.assertIn(args[2], urls)
            return json.dumps({"url": args[2], "state": "CLOSED", "baseRefName": "main"})
        with patch.object(f, "gh", side_effect=github) as gh, patch.object(f, "api", return_value=self.session("new")) as api:
            f.dispatch(self.cfg, self.state, False, SHA)
        api.assert_called_once()
        self.assertEqual([call.args[2] for call in gh.call_args_list if call.args[0] == "pr"], urls)

    def test_selected_history_limit_and_cross_scope_hold_without_create(self):
        self.dispatch_fixture()
        for kind in ("limit", "foreign_pr", "foreign_folder"):
            with self.subTest(kind=kind):
                rec = self.record(game_id="001", outcome="failed:closed", pr=f"https://github.com/{self.cfg['repo']}/pull/1")
                if kind == "foreign_pr": rec["pr"] = "https://github.com/other/repo/pull/1"
                if kind == "foreign_folder": rec["assigned_folder"] = "games/001-other"
                self.state["sessions"] = {f"s{index}": rec.copy() for index in range(f.ASSIGNMENT_PR_RECHECK_LIMIT + 1 if kind == "limit" else 1)}
                with patch.object(f, "gh") as gh, patch.object(f, "api") as api, self.assertRaises(f.Hold):
                    f.dispatch(self.cfg, self.state, False, SHA)
                gh.assert_not_called()
                api.assert_not_called()
                self.assertEqual(self.state["intents"], {})

    def test_selected_history_unknown_identity_state_or_read_failure_restores_occupied_work(self):
        self.dispatch_fixture()
        url = f"https://github.com/{self.cfg['repo']}/pull/1"
        valid = {"url": url, "state": "CLOSED", "baseRefName": "main"}
        responses = ["not JSON", json.dumps({}), json.dumps({**valid, "state": "UNKNOWN"}),
                     json.dumps({**valid, "baseRefName": "other"}), json.dumps({**valid, "url": url + "0"}), f.Hold("read unavailable")]
        for response in responses:
            with self.subTest(response=str(response)):
                rec = self.record(game_id="001", outcome="failed:closed", pr=url)
                self.state["sessions"] = {"s1": rec}
                kwargs = {"side_effect": response} if isinstance(response, Exception) else {"return_value": response}
                with patch.object(f, "gh", **kwargs), patch.object(f, "api") as api, self.assertRaisesRegex(f.Hold, "readback is unverified"):
                    f.dispatch(self.cfg, self.state, False, SHA)
                api.assert_not_called()
                self.assertTrue(f.assignment_occupied(rec))
                self.assertEqual(rec["hold"], "gate_assignment_pr_unverified")

    def test_main_move_or_expired_inventory_after_assignment_checks_is_known_unsent(self):
        self.dispatch_fixture()
        for failure in ("main_moved", "inventory_expired"):
            with self.subTest(failure=failure):
                self.state = f.empty_state()
                f.observe_account(self.cfg, self.state, {})
                def main_read(*args):
                    if failure == "inventory_expired":
                        self.state["inventory"]["observed_at"] = f.iso(f.now() - timedelta(seconds=181))
                    return "d" * 40 if failure == "main_moved" else SHA
                with patch.object(f, "gh", side_effect=main_read), patch.object(f, "api") as api, self.assertRaises(f.Hold):
                    f.dispatch(self.cfg, self.state, False, SHA)
                api.assert_not_called()
                intent = next(iter(f.load_state()["intents"].values()))
                self.assertEqual(intent["status"], "rejected")
                self.assertEqual(intent["reason"], "create_admission_no_request")


if __name__ == "__main__":
    unittest.main()
