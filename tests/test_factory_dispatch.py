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
                        account_daily_reserve=5, healthy_ticks_required=2)
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
        pr = {"headRefOid": SHA, "baseRefOid": "d" * 40,
              "comments": [{"author": {"login": "github-actions[bot]"}, "body": body}],
              "statusCheckRollup": [{"name": self.cfg["gate_check_name"], "conclusion": "FAILURE",
                                     "detailsUrl": f"https://github.com/{self.cfg['repo']}/actions/runs/42/job/7"}]}
        run = {"path": ".github/workflows/arcade_gate.yml", "event": "pull_request_target",
               "head_sha": SHA, "status": "completed", "conclusion": "failure",
               "pull_requests": [{"number": 123, "head": {"sha": SHA}, "base": {"sha": "d" * 40}}]}
        self.patches.enter_context(patch.object(f, "gh", return_value=json.dumps(run)))
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
        self.state["sessions"]["s1"] = self.record(hold="awaiting_user_feedback")
        with patch.object(f, "api") as api:
            f.reconcile(self.cfg, self.state, {"s1": self.session()}, False)
        api.assert_not_called()
        self.assertNotIn("hold", self.state["sessions"]["s1"])
        self.assertEqual(f.capacity(self.cfg, self.state, {"s1": self.session()})["account_active"], 1)

    def test_terminal_local_outcome_does_not_release_active_assignment(self):
        self.state["sessions"]["s1"] = self.record(outcome="failed:stale")
        f.reconcile(self.cfg, self.state, {"s1": self.session()}, False)
        self.assertEqual(self.state["sessions"]["s1"]["hold"], "terminal_record_provider_active")
        with self.assertRaisesRegex(f.Hold, "terminal_record_provider_active"):
            f.capacity(self.cfg, self.state, {"s1": self.session()})

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


if __name__ == "__main__":
    unittest.main()
