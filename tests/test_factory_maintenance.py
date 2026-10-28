"""Maintenance failure injection. All provider/GitHub effects are local mocks."""
import copy
import hashlib
import json
import re
import shlex
import unittest
from datetime import timedelta
from unittest.mock import patch

import test_factory_dispatch as base

f, SHA, CORRELATION = base.f, base.SHA, base.CORRELATION
m = f.maintenance


class MaintenanceTests(unittest.TestCase):
    setUp = base.FactoryTests.setUp
    session = base.FactoryTests.session
    record = base.FactoryTests.record
    install_intent = base.FactoryTests.install_intent
    report_fixture = base.FactoryTests.report_fixture
    tick_fixture = base.FactoryTests.tick_fixture
    dispatch_fixture = base.FactoryTests.dispatch_fixture

    def evidence(self, name, data):
        path = self.root / name
        path.write_text(json.dumps(data))
        return {"path": str(path), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}

    def incident(self, **changes):
        spec = {"schema_version": 1, "id": "controls-083", "repository": self.cfg["repo"], "game_id": "083",
                "assigned_folder": "games/083-game", "observed_sha": SHA, "scenario_id": "key-release",
                "expected_behavior": "Movement stops after key release", "reproduction": ["Start game", "Press then release Right"],
                "protected_phase": "9", "protected_behavior": ["Preserve save identity"],
                "evidence": [self.evidence("diagnosis.json", {"observed": "movement continued"})],
                "reviewed_by": "owner", "reviewed_at": f.iso(f.now()), "priority": 1, "max_attempts": 2,
                "repair_owner": "native", **changes}
        m.enqueue(self.state, spec, self.cfg["repo"], f.iso(f.now()))
        folder = self.root / spec["assigned_folder"]
        folder.mkdir(parents=True, exist_ok=True)
        (folder / "game.json").write_text(json.dumps({"id": spec["game_id"], "slug": folder.name,
                                                    "phase": spec["protected_phase"]}))
        self.catalog(spec)
        return spec

    def catalog(self, spec):
        entry = {key: spec[key] for key in ("repository", "assigned_folder", "game_id", "observed_sha", "scenario_id", "protected_phase")}
        entry.update(spec_hash=m.digest(spec), expected_behavior_hash=m.digest(spec["expected_behavior"]), status="approved")
        folder = self.root / "factory"
        folder.mkdir(exist_ok=True)
        (folder / "maintenance_catalog.json").write_text(json.dumps({"schema_version": 1, "incidents": {spec["id"]: entry}}))

    def merged(self):
        spec = self.incident()
        intent, _ = self.install_intent("accepted")
        intent["record"]["incident_id"] = spec["id"]
        m.start_attempt(self.state, spec["id"], CORRELATION)
        self.state["sessions"]["s1"] = {**intent["record"], "outcome": "merged", "provider_state": "COMPLETED",
                                         "merge_sha": SHA, "finished": f.iso(f.now() - timedelta(minutes=1))}
        m.reconcile(self.state)
        return spec

    def acceptance(self, spec, **changes):
        result = {"schema_version": 1, "repository": self.cfg["repo"], "commit_sha": SHA, "game_id": spec["game_id"],
                  "scenario_id": spec["scenario_id"], "protected_phase": spec["protected_phase"],
                  "expected_behavior_hash": m.digest(spec["expected_behavior"]), "status": "PASS",
                  "tested_at": f.iso(f.now()), "checks": [{"name": "release stops movement", "result": "PASS"}], **changes}
        return {"schema_version": 1, "incident_id": spec["id"], "repository": self.cfg["repo"], "main_sha": SHA,
                "scenario_id": spec["scenario_id"], "result": "PASS", "reviewed_by": "independent owner",
                "reviewed_at": f.iso(f.now()), "evidence": [self.evidence("behavior.json", result)]}

    def annotate(self, session, sid="s1"):
        self.state.setdefault("legacy_scope_annotations", {})[sid] = {
            "session_id": sid, "source": self.cfg["source"], "starting_branch": "main", "game_id": self.state["sessions"][sid]["game_id"],
            "provider_create_time": session["createTime"], "reviewed_by": "owner", "reviewed_at": f.iso(f.now()),
            "evidence_sha256": "e" * 64}

    def test_enqueue_deduplicates_id_and_evidence_identity_and_claims_one_game(self):
        spec = self.incident()
        self.assertEqual(m.enqueue(self.state, spec, self.cfg["repo"], f.iso(f.now())), (spec["id"], False))
        self.assertEqual(m.enqueue(self.state, {**spec, "id": "same-incident"}, self.cfg["repo"], f.iso(f.now())), (spec["id"], False))
        for changed in ({**spec, "expected_behavior": "changed"}, {**spec, "id": "different", "scenario_id": "other"}):
            with self.assertRaises(m.IncidentError):
                m.enqueue(self.state, changed, self.cfg["repo"], f.iso(f.now()))
        self.assertEqual(m.claimed_games(self.state), {"083"})

    def test_intake_rejects_wrong_repo_scope_phase_budget_and_changed_evidence(self):
        spec = self.incident()
        for changes in ({"repository": "evil/repo"}, {"assigned_folder": "games/084-other"}, {"protected_phase": 10},
                        {"max_attempts": 4}, {"repair_owner": "unknown"}, {"id": 123}, {"evidence": []}):
            with self.subTest(changes=changes), self.assertRaises(m.IncidentError):
                m.validate_spec({**spec, **changes}, self.cfg["repo"])
        (self.root / "diagnosis.json").write_text("changed after review")
        with self.assertRaisesRegex(m.IncidentError, "hash changed"):
            m.validate_spec(spec, self.cfg["repo"])

    def test_maintenance_brief_preserves_legacy_and_completed_phase_and_binds_pr(self):
        for phase in (None, "10"):
            self.state = f.empty_state()
            spec = self.incident(protected_phase=phase)
            brief = m.brief(self.state, spec["id"], self.root, SHA, self.cfg["repo"])
            self.assertEqual(brief["phase"], phase)
            self.assertEqual(brief["mode"], "maintenance")
            self.assertIn("Factory incident: " + spec["id"], brief["markdown"])
            self.assertIn("Factory incident spec: " + m.digest(spec), brief["markdown"])
            command = re.search(r"```sh\n([^\n]+)\n```", brief["markdown"]).group(1)
            self.assertEqual(shlex.split(command), ["python3", "tools/preflight.py", "--base", "origin/main", "--head", "HEAD",
                                                  "--mode", "maintenance", "--incident-id", spec["id"], "--incident-spec", m.digest(spec)])
            self.assertIn("arcade:maintenance", brief["markdown"])

    def test_maintenance_changed_phase_and_unverified_new_main_fail_closed(self):
        spec = self.incident()
        with self.assertRaises(m.IncidentError):
            m.brief(self.state, spec["id"], self.root, "d" * 40, self.cfg["repo"])
        path = self.root / spec["assigned_folder"] / "game.json"
        metadata = json.loads(path.read_text())
        metadata["phase"] = "10"
        path.write_text(json.dumps(metadata))
        with self.assertRaisesRegex(m.IncidentError, "protected phase"):
            m.brief(self.state, spec["id"], self.root, SHA, self.cfg["repo"])

    def test_catalog_rejects_candidate_only_or_mismatched_authority(self):
        spec = self.incident()
        f.maintenance_baseline(self.cfg, spec, SHA, self.root)
        path = self.root / "factory/maintenance_catalog.json"
        data = json.loads(path.read_text())
        data["incidents"][spec["id"]]["spec_hash"] = "f" * 64
        path.write_text(json.dumps(data))
        with self.assertRaises(f.Hold):
            f.maintenance_baseline(self.cfg, spec, SHA, self.root)
        path.unlink()
        with self.assertRaises(f.Hold):
            f.maintenance_baseline(self.cfg, spec, SHA, self.root)

    def test_catalog_publication_allows_ancestor_only_when_game_tree_unchanged(self):
        spec = self.incident()
        comparison = {"status": "ahead", "base_commit": {"sha": SHA}, "merge_base_commit": {"sha": SHA}}
        trees = [{"truncated": False, "tree": [{"path": "games", "type": "tree", "sha": "b" * 40}]},
                 {"truncated": False, "tree": [{"path": "083-game", "type": "tree", "sha": "c" * 40}]}]
        for current_tree, succeeds in (("c" * 40, True), ("d" * 40, False)):
            with patch.object(f, "gh", side_effect=[json.dumps(comparison), *map(json.dumps, trees)]) as gh, patch.object(f, "git_read", return_value=current_tree):
                if succeeds:
                    f.maintenance_baseline(self.cfg, spec, "e" * 40, self.root)
                    self.assertEqual(gh.call_count, 3)
                else:
                    with self.assertRaisesRegex(f.Hold, "game changed"):
                        f.maintenance_baseline(self.cfg, spec, "e" * 40, self.root)
        comparison["merge_base_commit"]["sha"] = "f" * 40
        with patch.object(f, "gh", return_value=json.dumps(comparison)), self.assertRaisesRegex(f.Hold, "not an ancestor"):
            f.maintenance_baseline(self.cfg, spec, "e" * 40, self.root)

    def test_catalog_truncated_tree_never_certifies_unchanged_game(self):
        spec = self.incident()
        comparison = {"status": "ahead", "base_commit": {"sha": SHA}, "merge_base_commit": {"sha": SHA}}
        with patch.object(f, "gh", side_effect=[json.dumps(comparison), json.dumps({"truncated": True, "tree": []})]), self.assertRaises(f.Hold):
            f.maintenance_baseline(self.cfg, spec, "e" * 40, self.root)

    def test_maintenance_create_durable_attempt_and_timeout_never_duplicate(self):
        spec = self.incident(protected_phase=None)
        f.observe_account(self.cfg, self.state, {})
        def timeout(*args, **kwargs):
            persisted = f.load_state()
            item = m.ledger(persisted)[spec["id"]]
            self.assertEqual(len(item["attempts"]), 1)
            intent = persisted["intents"][item["attempts"][0]]
            self.assertEqual(intent["status"], "pending")
            self.assertIsNone(intent["record"]["phase"])
            self.assertIn("Factory incident spec: " + m.digest(spec), args[2]["prompt"])
            raise f.ApiError(0)
        with patch.object(f, "gh", return_value=SHA), patch.object(f, "api", side_effect=timeout) as api:
            with self.assertRaises(f.ApiError):
                f.dispatch(self.cfg, self.state, False, SHA, self.root, spec["id"])
            m.reconcile(self.state)
            with self.assertRaises(m.IncidentError):
                m.retry(self.state, spec["id"])
            with self.assertRaises(f.Hold):
                f.dispatch(self.cfg, self.state, False, SHA, self.root, spec["id"])
            self.assertEqual(api.call_count, 1)

    def test_known_unsent_create_failure_is_recorded_and_explicit_retry_bounded(self):
        spec = self.incident(max_attempts=1)
        f.observe_account(self.cfg, self.state, {})
        with patch.object(f, "gh", return_value="d" * 40), patch.object(f, "api") as api, self.assertRaises(f.Hold):
            f.dispatch(self.cfg, self.state, False, SHA, self.root, spec["id"])
        api.assert_not_called()
        self.assertEqual(next(iter(self.state["intents"].values()))["status"], "rejected")
        m.reconcile(self.state)
        self.assertEqual(m.ledger(self.state)[spec["id"]]["status"], "needs_owner")
        with self.assertRaises(m.IncidentError):
            m.retry(self.state, spec["id"])

    def test_retry_requires_definitive_terminal_failure_not_failed_active_provider(self):
        spec = self.merged()
        item = m.ledger(self.state)[spec["id"]]
        rec = self.state["sessions"]["s1"]
        rec.update(outcome="failed:closed", provider_state="IN_PROGRESS")
        m.reconcile(self.state)
        with self.assertRaises(m.IncidentError):
            m.retry(self.state, spec["id"])
        rec["provider_state"] = "COMPLETED"
        m.retry(self.state, spec["id"])
        self.assertEqual(item["status"], "queued")

    def test_priority_maintenance_on_red_main_without_generation(self):
        spec = self.incident()
        self.cfg.update(generation_enabled=False, healthy_ticks_required=1)
        args = self.tick_fixture()
        with patch.object(f, "inventory", return_value={}), patch.object(f, "main_acceptance", side_effect=f.Hold("red")) as guard, patch.object(f, "dispatch") as dispatch:
            self.assertEqual(f.tick(args), 0)
        guard.assert_not_called()
        self.assertEqual(dispatch.call_args.kwargs["incident_id"], spec["id"])

    def test_no_incident_does_not_generate_when_pilot_disabled(self):
        self.cfg["generation_enabled"] = False
        args = self.tick_fixture()
        with patch.object(f, "inventory", return_value={}), patch.object(f, "dispatch") as dispatch, patch.object(f, "main_acceptance") as guard:
            self.assertEqual(f.tick(args), 0)
        dispatch.assert_not_called()
        guard.assert_not_called()

    def test_migration_hold_blocks_create_and_reset_breaker_does_not_clear_it(self):
        spec = self.incident()
        self.state["migration"] = {"version": 1, "admission_hold": True}
        f.observe_account(self.cfg, self.state, {})
        with patch.object(f, "api") as api, self.assertRaisesRegex(f.Hold, "Migration admission hold"):
            f.dispatch(self.cfg, self.state, False, SHA, self.root, spec["id"])
        api.assert_not_called()
        f.save_state(self.state)
        with patch.object(f.sys, "argv", ["factory_dispatch.py", "--reset-breaker"]):
            self.assertEqual(f.main(), 0)
        self.assertTrue(f.load_state()["migration"]["admission_hold"])

    def test_migration_hold_blocks_existing_paid_feedback(self):
        rec, session, pr = self.report_fixture()
        self.state["migration"] = {"admission_hold": True}
        with patch.object(f, "api") as api, self.assertRaisesRegex(f.Hold, "Migration admission hold"):
            f.repair_feedback(self.cfg, self.state, "s1", rec, session, pr, False)
        api.assert_not_called()

    def test_native_default_and_native_overlap_never_send_feedback(self):
        rec, session, pr = self.report_fixture()
        for owner, disabled, hold in (("native", False, "repair_native_observation"), ("controller", False, "repair_native_overlap_unresolved")):
            self.cfg.update(repair_owner=owner, controller_native_repairs_disabled=disabled)
            with patch.object(f, "api") as api:
                f.repair_feedback(self.cfg, self.state, "s1", rec, session, pr, False)
            api.assert_not_called()
            self.assertEqual(rec["hold"], hold)

    def test_merge_stays_unaccepted_until_matching_postmerge_behavior(self):
        spec = self.merged()
        self.assertEqual(m.ledger(self.state)[spec["id"]]["status"], "awaiting_acceptance")
        receipt = self.acceptance(spec)
        m.accept(self.state, receipt, self.cfg["repo"], SHA, f.iso(f.now()))
        self.assertEqual(m.ledger(self.state)[spec["id"]]["status"], "accepted")
        self.assertEqual(m.claimed_games(self.state), set())

    def test_wrong_or_premerge_behavior_evidence_never_accepts(self):
        spec = self.merged()
        for changes in ({"commit_sha": "d" * 40}, {"scenario_id": "wrong"}, {"game_id": "084"},
                        {"protected_phase": "10"}, {"expected_behavior_hash": "f" * 64}, {"checks": []},
                        {"checks": [{"name": "release", "result": "FAIL"}]}, {"tested_at": f.iso(f.now() - timedelta(days=1))}):
            with self.subTest(changes=changes), self.assertRaises(m.IncidentError):
                m.accept(self.state, self.acceptance(spec, **changes), self.cfg["repo"], SHA, f.iso(f.now()))
        self.assertEqual(m.ledger(self.state)[spec["id"]]["status"], "awaiting_acceptance")

    def test_acceptance_live_main_move_does_not_mutate_incident(self):
        spec = self.merged()
        receipt = self.acceptance(spec)
        with patch.object(f, "control_revision", return_value=SHA), patch.object(f, "main_acceptance", return_value=SHA), patch.object(f, "gh", return_value="d" * 40), self.assertRaises(f.Hold):
            f.accept_incident(self.cfg, self.state, receipt)
        self.assertEqual(m.ledger(self.state)[spec["id"]]["status"], "awaiting_acceptance")

    def test_stale_other_repository_counts_capacity_without_global_hold(self):
        remote = {"other": self.session("other", hours=100, source="sources/github/other/repo")}
        observation = f.capacity(self.cfg, self.state, remote)
        self.assertEqual(observation["account_active"], 1)
        self.assertEqual(observation["stale_active"], 1)
        remote["other"]["state"] = "UNKNOWN"
        with self.assertRaises(f.Hold):
            f.capacity(self.cfg, self.state, remote)

    def test_scoped_legacy_annotation_keeps_wip_but_permits_other_game(self):
        session = self.session(hours=100)
        self.state["sessions"]["s1"] = self.record(hold="stale_provider_session", provider_state="IN_PROGRESS")
        with self.assertRaises(f.Hold):
            f.capacity(self.cfg, self.state, {"s1": session})
        self.annotate(session)
        self.assertEqual(f.capacity(self.cfg, self.state, {"s1": session})["account_active"], 1)
        self.assertTrue(f.assignment_occupied(self.state["sessions"]["s1"]))
        self.assertEqual(self.state["sessions"]["s1"]["hold"], "stale_provider_session")
        self.assertFalse(f.verified_assignment(self.cfg, self.state, "s1", self.state["sessions"]["s1"], session))
        self.state["legacy_scope_annotations"]["s1"]["game_id"] = "084"
        with self.assertRaises(f.Hold):
            f.capacity(self.cfg, self.state, {"s1": session})

    def test_reconcile_only_saves_bound_receipt_without_paid_actions_even_migration_hold(self):
        session = self.session(hours=100)
        self.state["sessions"]["s1"] = self.record()
        self.state["migration"] = {"version": 1, "admission_hold": True}
        self.annotate(session)
        args = self.tick_fixture()
        args.reconcile_only = True
        with patch.object(f, "inventory", return_value={"s1": session}), patch.object(f, "api") as api:
            self.assertEqual(f.tick(args), 0)
        api.assert_not_called()
        saved = f.load_state()
        receipt = saved["migration"]["reconciliation"]
        self.assertEqual(receipt["active_unresolved"], 0)
        self.assertEqual(receipt["missing_unresolved"], 0)
        self.assertEqual(receipt["unresolved_intents"], 0)
        self.assertEqual(receipt["sessions_sha256"], f.digest(saved["sessions"]))
        self.assertEqual(receipt["legacy_scope_annotations_sha256"], f.digest(saved["legacy_scope_annotations"]))
        self.assertTrue(saved["migration"]["admission_hold"])

    def test_conflicting_legacy_or_terminal_or_native_pr_needs_owner_without_message(self):
        rec, session, pr = self.report_fixture()
        pr.update(mergeable="CONFLICTING", mergeStateStatus="DIRTY")
        for mutation, expected in ((lambda: rec.pop("correlation"), "needs_owner:rebase_scope_unverified"),):
            mutation()
            with patch.object(f, "api") as api:
                f.rebase_feedback(self.cfg, self.state, "s1", rec, session, pr, False)
            api.assert_not_called()
            self.assertEqual(rec["hold"], expected)
        rec["correlation"] = CORRELATION
        session["state"] = "COMPLETED"
        with patch.object(f, "api") as api:
            f.rebase_feedback(self.cfg, self.state, "s1", rec, session, pr, False)
        api.assert_not_called()
        self.assertEqual(rec["hold"], "needs_owner:rebase_session_not_message_eligible")
        session["state"] = "IN_PROGRESS"
        self.cfg["repair_owner"] = "native"
        with patch.object(f, "api") as api:
            f.rebase_feedback(self.cfg, self.state, "s1", rec, session, pr, False)
        api.assert_not_called()
        self.assertEqual(rec["hold"], "needs_rebase:native_observation")

    def test_rebase_message_durable_deduplicated_and_head_bound(self):
        rec, session, pr = self.report_fixture()
        def sent(*args, **kwargs):
            saved = f.load_state()
            self.assertEqual(next(iter(saved["sessions"]["s1"]["rebases"].values()))["status"], "pending")
            return {}
        with patch.object(f, "gh", return_value=json.dumps(pr)), patch.object(f, "api", side_effect=sent) as api:
            f.rebase_feedback(self.cfg, self.state, "s1", rec, session, pr, False)
            f.rebase_feedback(self.cfg, self.state, "s1", rec, session, pr, False)
        self.assertEqual(api.call_count, 1)
        pr["headRefOid"] = "e" * 40
        with patch.object(f, "api") as api:
            f.rebase_feedback(self.cfg, self.state, "s1", rec, session, pr, False)
        api.assert_not_called()
        self.assertEqual(rec["hold"], "needs_owner:rebase_budget_exhausted")

    def test_rebase_ambiguous_delivery_never_repeats(self):
        rec, session, pr = self.report_fixture()
        with patch.object(f, "gh", return_value=json.dumps(pr)), patch.object(f, "api", side_effect=f.ApiError(0)) as api:
            with self.assertRaises(f.ApiError):
                f.rebase_feedback(self.cfg, self.state, "s1", rec, session, pr, False)
            f.rebase_feedback(self.cfg, self.state, "s1", rec, session, pr, False)
        self.assertEqual(api.call_count, 1)
        self.assertEqual(next(iter(rec["rebases"].values()))["status"], "ambiguous")

    def test_rebase_head_changed_before_post_known_unsent_and_retryable(self):
        rec, session, pr = self.report_fixture()
        with patch.object(f, "gh", return_value=json.dumps({**pr, "headRefOid": "f" * 40})), patch.object(f, "api") as api, self.assertRaises(f.Hold):
            f.rebase_feedback(self.cfg, self.state, "s1", rec, session, pr, False)
        api.assert_not_called()
        self.assertEqual(next(iter(rec["rebases"].values()))["status"], "not_sent")
        with patch.object(f, "gh", return_value=json.dumps(pr)), patch.object(f, "api", return_value={}) as api:
            f.rebase_feedback(self.cfg, self.state, "s1", rec, session, pr, False)
        api.assert_called_once()


if __name__ == "__main__":
    unittest.main()
