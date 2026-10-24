"""Offline installer failure injection. All process calls are stubbed."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("factory_release", Path(__file__).resolve().parents[1] / "tools/factory_release.py")
f = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(f)
SHA = "a" * 40
OLD = "b" * 40


class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.data = self.root / "data"
        self.config = self.root / "config"
        self.state_home = self.root / "state-home"
        self.units = self.config / "systemd/user"
        self.calls = []
        self.fail = None
        self.dirty = False
        self.active = False
        self.bad_head = False
        self.enabled = False
        self.bad_loaded = False
        self.current_revision = SHA
        self.output = io.StringIO()
        self.patches = contextlib.ExitStack()
        self.addCleanup(self.patches.close)
        self.patches.enter_context(contextlib.redirect_stdout(self.output))
        self.patches.enter_context(contextlib.redirect_stderr(self.output))
        self.patches.enter_context(patch.object(f.subprocess, "run", side_effect=self.process))
        self.patches.enter_context(patch.object(f.shutil, "which", return_value="/usr/bin/gh"))

    def process(self, argv, **kwargs):
        self.calls.append(argv)
        if self.fail and self.fail(argv):
            return subprocess.CompletedProcess(argv, 1, "", "PRIVATE-KEY-MUST-NOT-LEAK")
        if argv[0] == "git":
            if "init" in argv:
                repo = Path(argv[-1])
                (repo / ".git").mkdir()
            elif "fetch" in argv:
                self.current_revision = argv[-1]
            elif "checkout" in argv:
                repo = Path(argv[2])
                for name in ("tools/factory_dispatch.py", "factory/config.json"):
                    path = repo / name
                    path.parent.mkdir(exist_ok=True)
                    path.write_text("{}" if name.endswith("json") else "print('fixture')\n")
                (repo / ".git/HEAD-fixture").write_text(self.current_revision)
            elif "rev-parse" in argv:
                revision = (Path(argv[2]) / ".git/HEAD-fixture").read_text()
                return subprocess.CompletedProcess(argv, 0, (OLD if self.bad_head else revision) + "\n", "")
            elif "status" in argv:
                return subprocess.CompletedProcess(argv, 0, " M tools/factory_dispatch.py\n" if self.dirty else "", "")
        if argv[0] == "systemctl" and "is-active" in argv:
            return subprocess.CompletedProcess(argv, 0 if self.active else 3, "active\n" if self.active else "inactive\n", "")
        if argv[0] == "systemctl" and "is-enabled" in argv:
            return subprocess.CompletedProcess(argv, 0 if self.enabled else 1, "enabled\n" if self.enabled else "disabled\n", "")
        if argv[0] == "systemctl" and "show" in argv:
            path = "/wrong/loaded/unit" if self.bad_loaded else str(self.units / argv[3])
            return subprocess.CompletedProcess(argv, 0, f"FragmentPath={path}\nNeedDaemonReload=no\n", "")
        return subprocess.CompletedProcess(argv, 0, "", "")

    def invoke(self, action=None, revision=None, extra=()):
        args = ([action] if action else []) + ["--data-dir", str(self.data), "--config-dir", str(self.config),
                 "--state-home", str(self.state_home), "--key-file", str(self.root / "not-read-key")]
        if revision is not None:
            args += ["--revision", revision]
        return f.main(args + list(extra))

    def stage(self, revision=SHA):
        self.assertEqual(self.invoke("stage", revision), 0, self.output.getvalue())
        return self.data / "releases" / revision

    def activate(self, revision=SHA):
        self.stage(revision)
        self.assertEqual(self.invoke("activate", revision), 0, self.output.getvalue())

    def snapshot(self):
        return {str(path.relative_to(self.root)): path.read_bytes()
                for path in self.root.rglob("*") if path.is_file()}

    def test_default_only_shows_help(self):
        self.assertEqual(self.invoke(), 0)
        self.assertEqual(self.calls, [])
        self.assertFalse(self.data.exists())

    def test_every_dry_run_has_no_writes_or_process_calls(self):
        for action in ("stage", "activate", "rollback", "enable", "disable", "uninstall", "status"):
            self.assertEqual(self.invoke(action, SHA, ("--dry-run",)), 0)
        self.assertEqual(self.calls, [])
        self.assertEqual(list(self.root.iterdir()), [])

    def test_short_or_missing_revision_rejected_without_mutation(self):
        for action in ("stage", "activate", "rollback"):
            for revision in (None, "main", "abc123", "A" * 40, "../" + SHA):
                self.assertEqual(self.invoke(action, revision), 1)
        self.assertEqual(self.calls, [])
        self.assertFalse(self.data.exists())

    def test_stage_pins_revision_and_never_resets_mirror_or_starts_service(self):
        mirror = self.data / "repo"
        mirror.mkdir(parents=True)
        (mirror / "local-work").write_text("preserve")
        release = self.stage()
        self.assertEqual((mirror / "local-work").read_text(), "preserve")
        self.assertEqual(json.loads((release / "release.json").read_text())["revision"], SHA)
        self.assertTrue(any("fetch" in x and x[-1] == SHA for x in self.calls))
        self.assertFalse(any("reset" in x or x[0] == "systemctl" for x in self.calls))
        self.assertFalse(self.units.exists())
        self.assertFalse((self.data / "active.json").exists())

    def test_fetch_failure_retains_failed_checkout_and_does_not_publish_release(self):
        self.fail = lambda argv: "fetch" in argv
        self.assertEqual(self.invoke("stage", SHA), 1)
        self.assertFalse((self.data / "releases" / SHA).exists())
        self.assertEqual(len(list((self.data / ".staging").glob("*/FAILED.json"))), 1)
        self.assertNotIn("PRIVATE-KEY", self.output.getvalue())
        self.assertFalse(any("checkout" in x for x in self.calls))

    def test_checkout_failure_never_activates(self):
        self.fail = lambda argv: "checkout" in argv
        self.assertEqual(self.invoke("stage", SHA), 1)
        self.assertFalse((self.data / "releases" / SHA).exists())
        self.assertFalse(self.units.exists())

    def test_wrong_fetched_commit_is_rejected(self):
        self.bad_head = True
        self.assertEqual(self.invoke("stage", SHA), 1)
        self.assertFalse((self.data / "releases" / SHA).exists())

    def test_existing_release_verified_without_fetching_again(self):
        self.stage()
        self.calls.clear()
        self.stage()
        self.assertFalse(any("fetch" in x or "checkout" in x for x in self.calls))

    def test_dirty_or_symlink_release_refuses_activation(self):
        release = self.stage()
        self.dirty = True
        self.assertEqual(self.invoke("activate", SHA), 1)
        self.dirty = False
        script = release / "repo/tools/factory_dispatch.py"
        script.unlink()
        script.symlink_to(self.root / "elsewhere")
        self.assertEqual(self.invoke("activate", SHA), 1)
        self.assertFalse(self.units.exists())

    def test_activation_refuses_running_timer_or_service(self):
        self.stage()
        self.active = True
        self.assertEqual(self.invoke("activate", SHA), 1)
        self.assertFalse(self.units.exists())
        self.assertFalse(any("stop" in x or "disable" in x for x in self.calls))

    def test_stopped_but_enabled_timer_cannot_bypass_separate_enable(self):
        self.stage()
        self.enabled = True
        self.assertEqual(self.invoke("activate", SHA), 1)
        self.assertFalse(self.units.exists())

    def test_loaded_unit_mismatch_restores_old_units_and_holds_enable(self):
        self.activate(OLD)
        self.stage(SHA)
        original = (self.units / f.UNITS[0]).read_bytes()
        self.bad_loaded = True
        self.assertEqual(self.invoke("activate", SHA), 1)
        self.assertEqual((self.units / f.UNITS[0]).read_bytes(), original)
        self.assertEqual(json.loads((self.data / "active.json").read_text())["revision"], OLD)
        self.calls.clear()
        self.assertEqual(self.invoke("enable"), 1)
        self.assertFalse(any("enable" in x for x in self.calls))

    def test_validation_failure_preserves_existing_units(self):
        self.stage()
        self.units.mkdir(parents=True)
        (self.units / f.UNITS[0]).write_text("old-service")
        before = self.snapshot()
        self.fail = lambda argv: argv[0] == "systemd-analyze"
        self.assertEqual(self.invoke("activate", SHA), 1)
        self.assertEqual(self.snapshot(), before)

    def test_activation_backs_up_units_state_and_uses_absolute_pinned_path(self):
        self.stage()
        self.units.mkdir(parents=True)
        (self.units / f.UNITS[0]).write_text("old-service")
        state = self.state_home / f.NAME
        state.mkdir(parents=True)
        (state / "state.json").write_text('{"preserve":true}')
        (state / "events.jsonl").write_text("retained-event\n")
        self.assertEqual(self.invoke("activate", SHA), 0, self.output.getvalue())
        active = json.loads((self.data / "active.json").read_text())
        recovery = Path(active["recovery"])
        self.assertEqual((recovery / f.UNITS[0]).read_text(), "old-service")
        self.assertEqual((recovery / "state/state.json").read_bytes(), (state / "state.json").read_bytes())
        self.assertEqual((state / "events.jsonl").read_text(), "retained-event\n")
        service = (self.units / f.UNITS[0]).read_text()
        self.assertIn(str(self.data / "releases" / SHA / "repo/tools/factory_dispatch.py"), service)
        self.assertNotIn("ExecStartPre", service)
        self.assertNotIn("origin/main", service)
        self.assertFalse(any("enable" in x or "start" in x for x in self.calls))

    def test_reload_failure_restores_previous_units_and_active_record(self):
        self.activate(OLD)
        self.stage(SHA)
        before_service = (self.units / f.UNITS[0]).read_bytes()
        before_active = (self.data / "active.json").read_bytes()
        failures = [True, False]
        self.fail = lambda argv: "daemon-reload" in argv and failures.pop(0)
        self.assertEqual(self.invoke("activate", SHA), 1)
        self.assertEqual((self.units / f.UNITS[0]).read_bytes(), before_service)
        self.assertEqual((self.data / "active.json").read_bytes(), before_active)
        self.assertGreaterEqual(len(list((self.data / "recovery").iterdir())), 2)

    def test_enable_requires_explicit_command_and_verified_installed_units(self):
        self.activate()
        self.calls.clear()
        self.assertEqual(self.invoke("enable"), 0)
        self.assertIn(["systemctl", "--user", "enable", "--now", f.UNITS[1]], self.calls)
        with (self.units / f.UNITS[0]).open("a") as stream:
            stream.write("ExecStartPre=/bin/false\n")
        self.calls.clear()
        self.assertEqual(self.invoke("enable"), 1)
        self.assertFalse(any("enable" in x for x in self.calls))

    def test_rollback_changes_only_active_units_to_retained_revision(self):
        self.activate(OLD)
        self.activate(SHA)
        self.calls.clear()
        self.assertEqual(self.invoke("rollback", OLD), 0)
        self.assertEqual(json.loads((self.data / "active.json").read_text())["revision"], OLD)
        self.assertTrue((self.data / "releases" / SHA).exists())
        self.assertFalse(any("fetch" in x or "enable" in x for x in self.calls))

    def test_uninstall_preserves_release_mirror_state_and_recovery(self):
        self.activate()
        mirror = self.data / "repo"
        mirror.mkdir()
        (mirror / "uncommitted").write_text("preserve")
        state = self.state_home / f.NAME
        state.mkdir(parents=True)
        (state / "events.jsonl").write_text("history")
        self.assertEqual(self.invoke("uninstall"), 0)
        self.assertFalse((self.units / f.UNITS[0]).exists())
        self.assertFalse((self.units / f.UNITS[1]).exists())
        self.assertEqual((mirror / "uncommitted").read_text(), "preserve")
        self.assertEqual((state / "events.jsonl").read_text(), "history")
        self.assertTrue((self.data / "releases" / SHA).exists())
        self.assertGreaterEqual(len(list((self.data / "recovery").iterdir())), 2)

    def test_secret_error_output_and_credential_urls_are_not_logged(self):
        self.assertEqual(self.invoke("stage", SHA, ("--repository", "https://user:PRIVATE-KEY@example.com/repo")), 1)
        self.assertNotIn("PRIVATE-KEY", self.output.getvalue())
        self.assertFalse(self.data.exists())

    def test_recursive_state_backup_layout_and_executable_git_helper_rejected(self):
        self.data = self.state_home / f.NAME / "releases-root"
        self.assertEqual(self.invoke("activate", SHA), 1)
        self.assertFalse(self.data.exists())
        self.data = self.root / "data"
        self.assertEqual(self.invoke("stage", SHA, ("--repository", "ext::untrusted-helper")), 1)
        self.assertEqual(self.calls, [])

    def test_paths_with_percent_spaces_and_quotes_have_safe_unit_quoting(self):
        self.assertEqual(f.unit_quote('/tmp/a b%"c'), '"/tmp/a b%%\\"c"')
        with self.assertRaises(f.ReleaseError):
            f.unit_quote('/tmp/$UNTRUSTED')

    def test_status_is_read_only(self):
        self.assertEqual(self.invoke("status"), 0)
        self.assertEqual(self.calls, [])
        self.assertFalse(self.data.exists())


if __name__ == "__main__":
    unittest.main()
