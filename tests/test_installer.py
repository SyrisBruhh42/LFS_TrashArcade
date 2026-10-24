"""Installer failure injection plus native, non-executing unit-parser checks."""
import argparse
import contextlib
import fcntl
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
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
        self.timer_active = False
        self.bad_loaded = False
        self.dropins = ""
        self.service_result = "success"
        self.state_contract = {"durable_intents": True, "migration_admission_hold": True, "maintenance_queue": True}
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
            active = self.active or (argv[-1] == f.UNITS[1] and self.timer_active)
            return subprocess.CompletedProcess(argv, 0 if active else 3, "active\n" if active else "inactive\n", "")
        if argv[0] == "systemctl" and "is-enabled" in argv:
            return subprocess.CompletedProcess(argv, 0 if self.enabled else 1, "enabled\n" if self.enabled else "disabled\n", "")
        if argv[0] == "systemctl" and "show" in argv:
            path = "/wrong/loaded/unit" if self.bad_loaded else str(self.units / argv[3]) if (self.units / argv[3]).exists() else ""
            active = self.active or (argv[3] == f.UNITS[1] and self.timer_active)
            return subprocess.CompletedProcess(argv, 0,
                f"FragmentPath={path}\nNeedDaemonReload=no\nDropInPaths={self.dropins}\nLoadState=loaded\n"
                f"ActiveState={'active' if active else 'inactive'}\nSubState=waiting\n"
                f"UnitFileState={'enabled' if self.enabled else 'disabled'}\n"
                f"Result={self.service_result}\nExecMainStatus={'0' if self.service_result == 'success' else '1'}\n", "")
        if argv[0] == "systemctl" and "enable" in argv:
            self.enabled = self.timer_active = True
        if argv[0] == "systemctl" and "disable" in argv:
            self.enabled = self.timer_active = False
        if argv[-1] == "--status":
            try:
                state = json.loads((self.state_home / f.NAME / "state.json").read_text())
                return subprocess.CompletedProcess(argv, 0, json.dumps({"schema": 2, "tracked": len(state["sessions"]),
                    "state_contract": self.state_contract,
                    "unresolved_intents": sum(i["status"] in {"pending", "ambiguous"} for i in state.get("intents", {}).values())}), "")
            except (ValueError, KeyError, TypeError):
                return subprocess.CompletedProcess(argv, 1, "", "state invalid")
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
        if not (self.state_home / f.NAME / "state.json").exists():
            self.seed_state()
        self.stage(revision)
        self.assertEqual(self.invoke("activate", revision), 0, self.output.getvalue())

    def seed_state(self, **extra):
        state = self.state_home / f.NAME / "state.json"
        state.parent.mkdir(parents=True, exist_ok=True)
        state.write_text(json.dumps({"schema": 2, "sessions": {}, "intents": {}, "lessons": [], **extra}))
        return state

    def snapshot(self):
        return {str(path.relative_to(self.root)): path.read_bytes()
                for path in self.root.rglob("*") if path.is_file()}

    def test_default_only_shows_help(self):
        self.assertEqual(self.invoke(), 0)
        self.assertEqual(self.calls, [])
        self.assertFalse(self.data.exists())

    def test_every_dry_run_has_no_writes_or_process_calls(self):
        for action in ("stage", "activate", "rollback", "enable", "disable", "uninstall", "status", "health"):
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
        self.seed_state()
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
        self.seed_state()
        (self.state_home / f.NAME / "tick.lock").touch()
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
        state.mkdir(parents=True, exist_ok=True)
        self.seed_state(preserve=True)
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
        state.mkdir(parents=True, exist_ok=True)
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

    def test_control_characters_and_dollars_rejected_before_processes_or_writes(self):
        for character in ("\x00", "\n", "\r", "\t", "\v", "\x1f", "\x7f", "\x85", "$"):
            with self.subTest(character=repr(character)):
                self.data = self.root / ("unsafe" + character + "path")
                self.assertEqual(self.invoke("activate", SHA), 1)
                for serializer in (f.unit_quote, f.unit_path):
                    with self.assertRaises(f.ReleaseError):
                        serializer(self.data)
        with self.assertRaises(f.ReleaseError):
            f.unit_path("relative/path")
        self.assertEqual(self.calls, [])
        self.assertEqual(list(self.root.iterdir()), [])

    def test_status_is_read_only(self):
        self.assertEqual(self.invoke("status"), 0)
        self.assertEqual(self.calls, [])
        self.assertFalse(self.data.exists())

    def test_activation_refuses_missing_legacy_corrupt_and_incompatible_state_without_replacing_it(self):
        self.stage()
        self.assertEqual(self.invoke("activate", SHA), 1)
        self.assertFalse((self.state_home / f.NAME / "state.json").exists())
        for content in ('{"sessions":{}}', '{"schema":2,"sessions":[]}', '{broken'):
            state = self.seed_state()
            state.write_text(content)
            self.assertEqual(self.invoke("activate", SHA), 1)
            self.assertEqual(state.read_text(), content)
            self.assertFalse(self.units.exists())

    def test_manual_tick_lock_excludes_activation_and_uninstall(self):
        self.activate()
        state = self.state_home / f.NAME / "state.json"
        before = state.read_bytes()
        with (state.parent / "tick.lock").open("a") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            for action in ("activate", "uninstall"):
                self.assertEqual(self.invoke(action, SHA), 1)
        self.assertEqual(state.read_bytes(), before)
        self.assertTrue((self.units / f.UNITS[0]).exists())

    def test_dropin_overrides_block_enable_even_when_fragment_path_matches(self):
        self.activate()
        self.dropins = "/tmp/override.conf"
        self.calls.clear()
        self.assertEqual(self.invoke("enable"), 1)
        self.assertFalse(any("enable" in call for call in self.calls))

    def test_health_reads_back_pinned_units_state_and_stopped_then_running_timer(self):
        self.activate()
        before = self.snapshot()
        self.calls.clear()
        self.assertEqual(self.invoke("health"), 0, self.output.getvalue())
        self.assertEqual(self.snapshot(), before)
        self.assertFalse(any("daemon-reload" in call for call in self.calls))
        self.assertEqual(self.invoke("enable"), 0)
        self.assertEqual(self.invoke("health", extra=("--expect", "running")), 0)
        self.assertEqual(self.invoke("health"), 1, 'running timer cannot pass stopped health')
        self.service_result = "exit-code"
        self.assertEqual(self.invoke("health", extra=("--expect", "running")), 1)

    def test_successful_enable_command_with_bad_readback_disables_timer_and_preserves_state(self):
        self.activate()
        state = self.seed_state(provider_receipt={"session": "new-receipt"})
        before = state.read_bytes()
        self.service_result = "exit-code"
        self.assertEqual(self.invoke("enable"), 1)
        self.assertIn(["systemctl", "--user", "disable", "--now", f.UNITS[1]], self.calls)
        self.assertFalse(self.enabled)
        self.assertFalse(self.timer_active)
        self.assertEqual(state.read_bytes(), before)
        self.assertFalse(any("stop" in call and f.UNITS[0] in call for call in self.calls))

    def test_failed_enable_stop_readback_is_reported_without_claiming_recovery(self):
        self.activate()
        self.service_result = "exit-code"
        self.fail = lambda argv: argv[0] == "systemctl" and "disable" in argv
        self.assertEqual(self.invoke("enable"), 1)
        self.assertTrue(self.timer_active)
        self.assertIn("timer stop could not be confirmed", self.output.getvalue())

    def test_rollback_and_failed_activation_never_restore_backup_state_over_new_receipts(self):
        self.activate(OLD)
        self.activate(SHA)
        state = self.seed_state(provider_receipt={"session": "created-after-old-backup"})
        events = state.parent / "events.jsonl"
        events.write_text('new durable receipt\n')
        before = state.read_bytes()
        self.assertEqual(self.invoke("rollback", OLD), 0)
        self.assertEqual(state.read_bytes(), before)
        self.assertEqual(events.read_text(), 'new durable receipt\n')
        failures = [True, False]
        self.fail = lambda argv: "daemon-reload" in argv and failures.pop(0)
        self.assertEqual(self.invoke("activate", SHA), 1)
        self.assertEqual(state.read_bytes(), before)
        self.assertEqual(events.read_text(), 'new durable receipt\n')

    def test_rollback_refuses_controller_that_cannot_load_current_state(self):
        self.activate(OLD)
        self.activate(SHA)
        state = self.seed_state(provider_receipt={"session": "current"})
        before = state.read_bytes()
        original = (self.data / "active.json").read_bytes()
        self.fail = lambda argv: argv[-1] == "--status" and OLD in str(argv[1])
        self.assertEqual(self.invoke("rollback", OLD), 1)
        self.assertEqual((self.data / "active.json").read_bytes(), original)
        self.assertEqual(state.read_bytes(), before)

    def test_rollback_refuses_readable_schema_when_target_does_not_understand_current_holds(self):
        self.activate(OLD)
        self.activate(SHA)
        self.seed_state(migration={"admission_hold": True}, maintenance={"incidents": {}})
        original = (self.data / "active.json").read_bytes()
        self.state_contract = {"durable_intents": True}
        self.assertEqual(self.invoke("rollback", OLD), 1)
        self.assertEqual((self.data / "active.json").read_bytes(), original)
        self.assertFalse(any("enable" in call for call in self.calls))

    def test_rollback_rejects_merge_history_without_matching_capability_and_preserves_state(self):
        self.activate(OLD)
        self.activate(SHA)
        state = self.seed_state(integration={"schema_version": 1, "intents": {"retained": {"status": "ambiguous"}}})
        before = state.read_bytes()
        active = (self.data / "active.json").read_bytes()
        self.assertEqual(self.invoke("rollback", OLD), 1)
        self.assertEqual(state.read_bytes(), before)
        self.assertEqual((self.data / "active.json").read_bytes(), active)
        self.state_contract["local_integration_intents"] = True
        self.assertEqual(self.invoke("rollback", OLD), 0)
        self.assertEqual(state.read_bytes(), before)

    def test_empty_merge_ledger_does_not_prevent_compatible_rollback(self):
        self.activate(OLD)
        self.activate(SHA)
        state = self.seed_state(integration={"schema_version": 1, "intents": {}})
        before = state.read_bytes()
        self.assertEqual(self.invoke("rollback", OLD), 0)
        self.assertEqual(state.read_bytes(), before)

    def test_failed_restoration_readback_keeps_disabled_timer_and_reports_unverified_recovery(self):
        self.activate(OLD)
        self.stage(SHA)
        self.fail = lambda argv: "daemon-reload" in argv
        self.assertEqual(self.invoke("activate", SHA), 1)
        self.assertEqual(json.loads((self.data / "active.json").read_text())["revision"], OLD)
        self.assertIn("restored units could not be verified", self.output.getvalue())
        self.assertFalse(self.enabled)

    def test_uninstall_refuses_inflight_service_and_never_terminates_provider_work(self):
        self.activate()
        self.active = True
        self.calls.clear()
        self.assertEqual(self.invoke("uninstall"), 1)
        self.assertTrue((self.units / f.UNITS[0]).exists())
        self.assertFalse(any("stop" in call for call in self.calls))

    def test_disable_confirms_timer_readback_without_stopping_the_service(self):
        self.activate()
        self.assertEqual(self.invoke("enable"), 0)
        self.calls.clear()
        self.assertEqual(self.invoke("disable"), 0)
        self.assertFalse(self.enabled)
        self.assertFalse(self.timer_active)
        self.assertIn(["systemctl", "--user", "is-active", f.UNITS[1]], self.calls)
        self.assertIn(["systemctl", "--user", "is-enabled", f.UNITS[1]], self.calls)
        self.assertFalse(any("stop" in call and f.UNITS[0] in call for call in self.calls))


@unittest.skipUnless(shutil.which("systemd-analyze"), "native systemd-analyze unavailable")
class NativeUnitParserTests(unittest.TestCase):
    """Parse temporary units only: no systemctl, daemon reload, or execution."""

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="factory-native-unit-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        # Hosted runners need no user manager or bus: verify constructs its own
        # parser/manager. Supply a private runtime directory and isolate user
        # configuration; a deliberately absent bus prevents accidental reliance.
        environment = patch.dict(os.environ, {
            "XDG_RUNTIME_DIR": str(self.root), "XDG_CONFIG_HOME": str(self.root / "config-home"),
            "XDG_DATA_HOME": str(self.root / "data-home"), "LC_ALL": "C", "SYSTEMD_COLORS": "0",
            "DBUS_SESSION_BUS_ADDRESS": "unix:path=" + str(self.root / "absent-bus")})
        environment.start()
        self.addCleanup(environment.stop)
        self.args = argparse.Namespace(data_dir=self.root / "data", config_dir=self.root / "config",
            state_home=self.root / "state", key_file=self.root / "unread-key")

    def verify(self, units):
        paths = []
        for name, content in units.items():
            path = self.root / name
            path.write_bytes(content)
            paths.append(str(path))
        # The debug dump gives the actual parsed path, so acceptance alone cannot
        # hide expansion, duplicated backslashes, trimmed spaces, or lost quotes.
        result = subprocess.run([shutil.which("systemd-analyze"), "--user", "verify", *paths],
            capture_output=True, text=True, timeout=30,
            env=dict(os.environ, SYSTEMD_LOG_LEVEL="debug", SYSTEMD_COLORS="0",
                     XDG_RUNTIME_DIR=str(self.root)))
        return result.returncode, result.stdout + result.stderr

    def test_rendered_units_pass_native_validation_and_old_quoted_directory_fails(self):
        units = f.render_units(self.args, SHA, sys.executable, "/usr/bin")
        directory = f.release_dir(self.args, SHA) / "repo"
        old = dict(units)
        old[f.UNITS[0]] = units[f.UNITS[0]].replace(
            f"WorkingDirectory={f.unit_path(directory)}\n".encode(),
            f"WorkingDirectory={f.unit_quote(directory)}\n".encode())
        code, output = self.verify(old)
        self.assertNotEqual(code, 0, output)
        self.assertIn("WorkingDirectory= path is not absolute", output)
        code, output = self.verify(units)
        self.assertEqual(code, 0, output)
        self.assertIn(f"\tWorkingDirectory: {directory}\n", output)
        # Exercise the exact production validator as well as debug readback.
        f.verify_units(units)

    def test_native_working_directory_preserves_spaces_specifiers_quotes_and_backslashes(self):
        for suffix in ("space dir", 'percent%h%Z%%quote"single\'dir', r"literal\n\x20\dir"):
            with self.subTest(suffix=suffix):
                self.args.data_dir = self.root / suffix
                units = f.render_units(self.args, SHA, sys.executable, "/usr/bin")
                directory = f.release_dir(self.args, SHA) / "repo"
                code, output = self.verify(units)
                self.assertEqual(code, 0, output)
                self.assertIn(f"\tWorkingDirectory: {directory}\n", output)

    def test_native_directory_trailing_space_or_backslash_cannot_trim_or_continue_line(self):
        for suffix in ("trailing ", "trailing\\", "trailing \\"):
            with self.subTest(suffix=suffix):
                directory = self.root / suffix
                units = {"path-fixture.service": (
                    f"[Service]\nType=oneshot\nWorkingDirectory={f.unit_path(directory)}\n"
                    f"ExecStart={f.unit_quote(sys.executable)} -V\n").encode()}
                code, output = self.verify(units)
                self.assertEqual(code, 0, output)
                self.assertIn(f"\tWorkingDirectory: {directory}\n", output)
                self.assertIn("Command Line:", output)


if __name__ == "__main__":
    unittest.main()
