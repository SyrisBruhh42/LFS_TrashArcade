"""State migration failure injection; real controller validator, no provider or host changes."""
import contextlib
import copy
from datetime import datetime, timedelta, timezone
import fcntl
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("factory_migrate", Path(__file__).resolve().parents[1] / "tools/factory_migrate.py")
m = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(m)


class MigrationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.state = self.root / "state/state.json"
        self.state.parent.mkdir()
        self.backup = self.root / "recovery/migration"
        self.backup.parent.mkdir()
        self.old = {"sessions": {f"s{i}": {"created": "2026-10-20T01:02:03Z", "game_id": f"{i % 85 + 1:03}",
            "outcome": "merged" if i < 379 else "failed:gate", "title": "PRIVATE-PROVIDER-TITLE",
            "legacy_field": {"keep": i}} for i in range(419)}, "lessons": ["preserved"],
            "api_fail_streak": 4, "max_game_id": 85, "unknown": {"retain": True}, "healthy_ticks": 9}
        self.state.write_bytes(m.encode(self.old))
        self.events = self.state.parent / "events.jsonl"
        self.events.write_text("retained provider receipt\n")
        self.out = io.StringIO()
        self.stack = contextlib.ExitStack()
        self.addCleanup(self.stack.close)
        self.stack.enter_context(contextlib.redirect_stdout(self.out))
        self.stack.enter_context(contextlib.redirect_stderr(self.out))

    def invoke(self, apply=False, extra=(), expected=None):
        args = ["--state-file", str(self.state)]
        if apply:
            args += ["--apply", "--expect-sha256", expected or m.sha(self.state.read_bytes()),
                     "--backup-dir", str(self.backup)]
        return m.main(args + list(extra))

    def snapshot(self):
        return {str(p.relative_to(self.root)): p.read_bytes() for p in self.root.rglob("*") if p.is_file()}

    def patch_writer(self, replacement):
        dependency = m.dependency
        release = dependency("factory_release")
        original = release.atomic_write
        release.atomic_write = lambda path, content, *a, **kw: replacement(original, path, content, *a, **kw)
        self.stack.enter_context(patch.object(m, "dependency", side_effect=lambda name:
            release if name == "factory_release" else dependency(name)))

    def test_default_dry_run_reports_counts_without_writing_or_printing_provider_content(self):
        before = self.snapshot()
        self.assertEqual(self.invoke(), 0, self.out.getvalue())
        self.assertEqual(self.snapshot(), before)
        report = json.loads(self.out.getvalue())
        self.assertEqual(report["tracked"], 419)
        self.assertTrue(report["admission_hold"])
        self.assertFalse(report["paid_work_authorized"])
        self.assertNotIn("PRIVATE-PROVIDER-TITLE", self.out.getvalue())

    def test_apply_preserves_all_legacy_fields_and_adds_only_explicit_admission_controls(self):
        raw = self.state.read_bytes()
        self.assertEqual(self.invoke(True), 0, self.out.getvalue())
        after = json.loads(self.state.read_bytes())
        for field in ("sessions", "lessons", "api_fail_streak", "max_game_id", "unknown"):
            self.assertEqual(after[field], self.old[field])
        self.assertEqual(after["intents"], {})
        self.assertEqual(after["healthy_ticks"], 0)
        self.assertEqual(after["migration"]["legacy_sessions"], 419)
        self.assertEqual(after["migration"]["source_sha256"], m.sha(raw))
        self.assertTrue(after["migration"]["admission_hold"])
        self.assertEqual(after["migration"]["provenance"], "unverified")
        self.assertEqual((self.backup / "state.before.json").read_bytes(), raw)
        receipt = json.loads((self.backup / "migration.json").read_bytes())
        self.assertEqual(receipt["status"], "committed")
        self.assertEqual(receipt["output_sha256"], m.sha(self.state.read_bytes()))
        self.assertEqual(self.events.read_text(), "retained provider receipt\n")
        self.assertEqual(m.validate(self.state.read_bytes())["sessions"], self.old["sessions"])

    def test_existing_breaker_pending_intents_and_feedback_receipts_are_not_reset(self):
        correlation = "b" * 32
        record = {"correlation": correlation, "created": "2026-10-24T01:02:03Z", "game_id": "086", "phase": "1",
            "assigned_folder": "games/086-existing", "baseline_sha": "a" * 40}
        self.old["intents"] = {correlation: {"status": "ambiguous", "created": record["created"],
            "record": record, "body_hash": "c" * 64, "prompt_hash": "d" * 64,
            "title": f"[factory:{correlation}] retained"}}
        self.old["breaker"] = {"reason": "credentials_rejected", "created": record["created"]}
        self.old["sessions"]["s1"]["feedback"] = {"report": {"status": "pending"}}
        self.state.write_bytes(m.encode(self.old))
        self.assertEqual(self.invoke(True), 0, self.out.getvalue())
        after = json.loads(self.state.read_bytes())
        for field in ("sessions", "intents", "breaker"):
            self.assertEqual(after[field], self.old[field])

    def test_changed_state_requires_new_review_and_existing_backup_is_never_overwritten(self):
        expected = m.sha(self.state.read_bytes())
        self.old["new_provider_receipt"] = "created-after-review"
        self.state.write_bytes(m.encode(self.old))
        before = self.state.read_bytes()
        self.assertEqual(self.invoke(True, expected=expected), 1)
        self.assertFalse(self.backup.exists())
        self.assertEqual(self.state.read_bytes(), before)
        self.backup.mkdir(parents=True)
        (self.backup / "keep").write_text("recovery")
        self.assertEqual(self.invoke(True), 1)
        self.assertEqual((self.backup / "keep").read_text(), "recovery")
        self.assertEqual(self.state.read_bytes(), before)

    def test_missing_invalid_symlink_or_locked_state_never_initializes_or_replaces(self):
        self.state.unlink()
        self.assertEqual(self.invoke(), 1)
        self.assertFalse(self.state.exists())
        self.state.write_text("{truncated")
        self.assertEqual(self.invoke(), 1)
        self.assertEqual(self.state.read_text(), "{truncated")
        self.state.unlink()
        self.state.symlink_to(self.events)
        self.assertEqual(self.invoke(), 1)
        self.state.unlink()
        self.state.write_bytes(m.encode(self.old))
        before = self.state.read_bytes()
        with (self.state.parent / "tick.lock").open("a") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            self.assertEqual(self.invoke(True), 1)
        self.assertEqual(self.state.read_bytes(), before)
        self.assertFalse(self.backup.exists())

    def test_backup_failure_never_replaces_live_state(self):
        before = self.state.read_bytes()
        def fail_backup(write, path, content, *a, **kw):
            raise OSError("PRIVATE-STORAGE-DETAIL")
        self.patch_writer(fail_backup)
        self.assertEqual(self.invoke(True), 1)
        self.assertEqual(self.state.read_bytes(), before)
        self.assertNotIn("PRIVATE-STORAGE-DETAIL", self.out.getvalue())

    def test_atomic_replace_failure_preserves_state_and_verified_backup(self):
        before = self.state.read_bytes()
        def fail_replace(write, path, content, *a, **kw):
            if path == self.state:
                raise OSError("replace failed")
            return write(path, content, *a, **kw)
        self.patch_writer(fail_replace)
        self.assertEqual(self.invoke(True), 1)
        self.assertEqual(self.state.read_bytes(), before)
        self.assertEqual((self.backup / "state.before.json").read_bytes(), before)
        self.assertEqual(json.loads((self.backup / "migration.json").read_bytes())["status"], "prepared")

    def test_write_or_readback_uncertainty_never_restores_old_state_over_new_receipt(self):
        def newer_receipt(write, path, content, *a, **kw):
            result = write(path, content, *a, **kw)
            if path == self.state:
                current = json.loads(path.read_bytes())
                current["provider_receipt"] = "arrived-after-replacement"
                path.write_bytes(m.encode(current))
            return result
        self.patch_writer(newer_receipt)
        self.assertEqual(self.invoke(True), 1)
        after = json.loads(self.state.read_bytes())
        self.assertEqual(after["provider_receipt"], "arrived-after-replacement")
        self.assertEqual(after["sessions"], self.old["sessions"])
        self.assertTrue(after["migration"]["admission_hold"])
        self.assertIn("never restore stale receipts", self.out.getvalue())

    def test_repeat_migration_is_noop_and_cannot_clear_hold(self):
        self.assertEqual(self.invoke(True), 0)
        before = self.state.read_bytes()
        self.backup = self.root / "recovery/second"
        self.assertEqual(self.invoke(True), 0)
        self.assertEqual(self.state.read_bytes(), before)
        self.assertFalse(self.backup.exists())
        self.assertTrue(json.loads(before)["migration"]["admission_hold"])

    def test_schema_two_native_empty_state_is_a_noop(self):
        self.state.write_bytes(m.encode({"schema": 2, "sessions": {}, "intents": {}, "lessons": []}))
        before = self.state.read_bytes()
        self.assertEqual(self.invoke(True), 0)
        self.assertEqual(self.state.read_bytes(), before)
        self.assertFalse(self.backup.exists())

    def reviewed_release(self):
        self.assertEqual(self.invoke(True), 0)
        current = json.loads(self.state.read_bytes())
        stamp = datetime.now(timezone.utc).isoformat()
        reconciliation = {"observed_at": stamp, "inventory_complete": True,
            "tracked_sessions": len(current["sessions"]), "missing_unresolved": 0, "active_unresolved": 0,
            "unresolved_intents": 0, "sessions_sha256": m.digest(current["sessions"]),
            "intents_sha256": m.digest(current["intents"]), "legacy_scope_annotations_sha256": m.digest({})}
        current["migration"]["reconciliation"] = reconciliation
        self.state.write_bytes(m.encode(current))
        self.evidence = self.root / "owner-review.json"
        self.review = {"schema": 1, "decision": "release_migration_admission_hold", "reviewer": "owner",
            "reviewed_at": stamp, "controller_revision": "a" * 40,
            "state_sha256": m.sha(self.state.read_bytes()), "reconciliation_sha256": m.digest(reconciliation),
            "provider_inventory_reviewed": True, "github_dispositions_reviewed": True,
            "legacy_assignment_authority": "not_granted"}
        self.evidence.write_bytes(m.encode(self.review))
        self.backup = self.root / "recovery/hold-release"
        self.stack.enter_context(patch.object(m, "check_controller_revision"))
        return current

    def release(self, apply=True):
        return self.invoke(apply, extra=("--release-hold", "--evidence-file", str(self.evidence)))

    def test_reviewed_hold_release_is_backed_and_preserves_legacy_records_without_granting_scope(self):
        current = self.reviewed_release()
        before = self.state.read_bytes()
        self.assertEqual(self.release(False), 0, self.out.getvalue())
        self.assertEqual(self.state.read_bytes(), before, 'release is dry-run without --apply')
        self.assertEqual(self.release(), 0, self.out.getvalue())
        after = json.loads(self.state.read_bytes())
        self.assertFalse(after["migration"]["admission_hold"])
        self.assertEqual(after["migration"]["provenance"], "unverified")
        self.assertEqual(after["sessions"], current["sessions"])
        self.assertEqual(after["intents"], current["intents"])
        self.assertNotIn("breaker", after)
        self.assertEqual(after["healthy_ticks"], 0)
        self.assertEqual(after["migration"]["release"]["evidence_sha256"], m.sha(self.evidence.read_bytes()))
        self.assertEqual((self.backup / "state.before.json").read_bytes(), before)

    def test_hold_release_preserves_unrelated_breaker(self):
        self.old["breaker"] = {"reason": "recent_session_failure_rate"}
        self.state.write_bytes(m.encode(self.old))
        self.reviewed_release()
        self.assertEqual(self.release(), 0, self.out.getvalue())
        self.assertEqual(json.loads(self.state.read_bytes())["breaker"], self.old["breaker"])

    def test_hold_release_rejects_stale_incomplete_or_unresolved_reconciliation(self):
        current = self.reviewed_release()
        for changes in ({"inventory_complete": False}, {"missing_unresolved": 1}, {"active_unresolved": 1},
                        {"unresolved_intents": 1}, {"observed_at": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()}):
            modified = copy.deepcopy(current)
            modified["migration"]["reconciliation"].update(changes)
            self.state.write_bytes(m.encode(modified))
            before = self.state.read_bytes()
            self.assertEqual(self.release(), 1, self.out.getvalue())
            self.assertEqual(self.state.read_bytes(), before)
        self.assertFalse(self.backup.exists())

    def test_hold_release_rejects_changed_sessions_intents_or_annotations_and_mismatched_owner_review(self):
        current = self.reviewed_release()
        for field in ("sessions", "intents", "legacy_scope_annotations", "review"):
            modified = copy.deepcopy(current)
            if field == "sessions":
                modified["sessions"]["s1"]["new_receipt"] = "after-observation"
            elif field == "intents":
                modified["migration"]["reconciliation"]["intents_sha256"] = "f" * 64
            elif field == "legacy_scope_annotations":
                modified[field] = {"s1": {"game_id": "001"}}
            else:
                self.review["github_dispositions_reviewed"] = False
                self.evidence.write_bytes(m.encode(self.review))
            self.state.write_bytes(m.encode(modified))
            before = self.state.read_bytes()
            self.assertEqual(self.release(), 1, self.out.getvalue())
            self.assertEqual(self.state.read_bytes(), before)
        self.assertFalse(self.backup.exists())

    def test_hold_release_rejects_wrong_controller_revision(self):
        self.reviewed_release()
        before = self.state.read_bytes()
        with patch.object(m, "check_controller_revision", side_effect=m.MigrationError("wrong pinned revision")):
            self.assertEqual(self.release(), 1)
        self.assertEqual(self.state.read_bytes(), before)

    def test_actual_dispatcher_receipt_and_reviewed_legacy_annotations_match_release_contract(self):
        current = self.reviewed_release()
        controller = m.dependency("factory_dispatch")
        cfg = json.loads(controller.CONFIG_FILE.read_text())
        stamp = datetime.now(timezone.utc).isoformat()
        created = "2026-10-20T01:02:03Z"
        remote = {"s0": {"id": "s0", "state": "IN_PROGRESS", "createTime": created,
            "sourceContext": {"source": cfg["source"], "githubRepoContext": {"startingBranch": cfg["starting_branch"]}}}}
        current["inventory_started_at"] = stamp
        controller.reconciliation_receipt(cfg, current, remote)
        self.assertEqual(current["migration"]["reconciliation"]["active_unresolved"], 1)
        current["legacy_scope_annotations"] = {"s0": {"session_id": "s0", "source": cfg["source"],
            "starting_branch": cfg["starting_branch"], "game_id": current["sessions"]["s0"]["game_id"],
            "provider_create_time": created, "reviewed_by": "owner", "reviewed_at": stamp, "evidence_sha256": "f" * 64}}
        controller.reconciliation_receipt(cfg, current, remote)
        receipt = current["migration"]["reconciliation"]
        self.assertEqual(receipt["active_unresolved"], 0)
        self.state.write_bytes(m.encode(current))
        self.review.update(reviewed_at=stamp, state_sha256=m.sha(self.state.read_bytes()),
                           reconciliation_sha256=m.digest(receipt))
        self.evidence.write_bytes(m.encode(self.review))
        self.assertEqual(self.release(), 0, self.out.getvalue())
        after = json.loads(self.state.read_bytes())
        self.assertEqual(after["sessions"], self.old["sessions"])
        self.assertEqual(after["legacy_scope_annotations"], current["legacy_scope_annotations"])
        self.assertEqual(after["intents"], {})


if __name__ == "__main__":
    unittest.main()
