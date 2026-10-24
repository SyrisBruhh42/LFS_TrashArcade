#!/usr/bin/env python3
"""Stage pinned factory releases; activate and enable by separate commands.

  install_factory.sh stage --revision <full-commit-sha>
  install_factory.sh activate --revision <full-commit-sha>
  install_factory.sh enable

Rollback: disable, rollback --revision <retained-full-commit-sha>, then enable.
Activation refuses a running timer/service. Uninstall retains releases, the old
mirror, state/logs and recovery copies. --dry-run only prints a plan.
"""
from __future__ import annotations

import argparse
import contextlib
from datetime import datetime, timezone
import fcntl
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
from urllib.parse import urlsplit
import uuid

NAME = "lfs-trasharcade-factory"
REPOSITORY = "https://github.com/SyrisBruhh42/LFS_TrashArcade.git"
UNITS = (NAME + ".service", NAME + ".timer")


class ReleaseError(Exception):
    pass


def run(argv, *, allowed=(0,), env=None):
    """Never echo child output: authentication failures can include credentials."""
    try:
        result = subprocess.run([str(x) for x in argv], capture_output=True, text=True, timeout=180, env=env)
    except (OSError, subprocess.TimeoutExpired):
        raise ReleaseError("Command unavailable or timed out; details withheld") from None
    if result.returncode not in allowed:
        raise ReleaseError(f"{Path(str(argv[0])).name} failed (exit {result.returncode}); details withheld")
    return result


def atomic_write(path, content, mode=0o600):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=".factory-", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.chmod(temporary, mode)
        os.replace(temporary, path)
        directory = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def write_json(path, value):
    atomic_write(path, (json.dumps(value, indent=2, sort_keys=True) + "\n").encode())


def read_json(path):
    try:
        value = json.loads(path.read_text())
        if not isinstance(value, dict):
            raise ValueError
        return value
    except (OSError, ValueError):
        raise ReleaseError("Missing or invalid release metadata") from None


def unit_dir(args):
    return args.config_dir / "systemd" / "user"


def release_dir(args, revision):
    return args.data_dir / "releases" / revision


def checked_revision(value):
    if not isinstance(value, str) or not re.fullmatch(r"[0-9a-f]{40}", value):
        raise ReleaseError("A full lowercase 40-character commit SHA is required")
    return value


def validate_checkout(repo, revision):
    if (repo / ".git").is_symlink() or not (repo / ".git").is_dir():
        raise ReleaseError("Release is not a retained checkout")
    if run(["git", "-C", repo, "rev-parse", "HEAD"]).stdout.strip() != revision:
        raise ReleaseError("Checkout does not match requested commit")
    if run(["git", "-C", repo, "status", "--porcelain", "--untracked-files=all", "--ignored"]).stdout.strip():
        raise ReleaseError("Release has local, untracked or ignored changes; preserve and investigate")
    for relative in ("tools/factory_dispatch.py", "factory/config.json"):
        path = repo / relative
        if not path.is_file() or path.is_symlink() or path.parent.is_symlink():
            raise ReleaseError("Required controller files are missing or unsafe")
        if not path.resolve().is_relative_to(repo.resolve()):
            raise ReleaseError("Controller path escapes release")


def validate_release(args, revision):
    checked_revision(revision)
    release = release_dir(args, revision)
    repo = release / "repo"
    if release.is_symlink() or repo.is_symlink():
        raise ReleaseError("Release paths must not be symbolic links")
    if read_json(release / "release.json").get("revision") != revision:
        raise ReleaseError("Release receipt does not match requested revision")
    validate_checkout(repo, revision)
    return repo


def stage(args):
    destination = release_dir(args, args.revision)
    if destination.exists():
        validate_release(args, args.revision)
        print(f"Already staged and verified: {args.revision}")
        return
    staging = args.data_dir / ".staging" / (args.revision + "-" + uuid.uuid4().hex)
    repo = staging / "repo"
    repo.mkdir(parents=True)
    try:
        run(["git", "init", "--quiet", repo])
        run(["git", "-C", repo, "remote", "add", "origin", args.repository])
        run(["git", "-C", repo, "fetch", "--quiet", "--no-tags", "--depth=1", "origin", args.revision])
        run(["git", "-C", repo, "-c", "core.hooksPath=/dev/null", "checkout", "--quiet", "--detach", "FETCH_HEAD"])
        validate_checkout(repo, args.revision)
        write_json(staging / "release.json", {"revision": args.revision, "repository": args.repository,
                                              "staged_at": datetime.now(timezone.utc).isoformat()})
        destination.parent.mkdir(parents=True, exist_ok=True)
        staging.rename(destination)
    except Exception:
        # Incomplete checkouts are retained for inspection and cannot activate.
        write_json(staging / "FAILED.json", {"revision": args.revision, "stage_failed": True})
        raise
    print(f"Staged {args.revision}; active units and timer unchanged")


def unit_quote(value):
    value = str(value)
    if any(c in value for c in "\r\n\x00$"):
        raise ReleaseError("Unsupported control character or dollar sign in unit path")
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"').replace("%", "%%") + '"'


def render_units(args, revision, python, gh_directory):
    repo = release_dir(args, revision) / "repo"
    environment = {"PATH": f"{gh_directory}:/usr/local/bin:/usr/bin:/bin", "PYTHONDONTWRITEBYTECODE": "1",
                   "XDG_CONFIG_HOME": str(args.config_dir), "XDG_STATE_HOME": str(args.state_home),
                   "JULES_API_KEY_FILE": str(args.key_file)}
    service = ("[Unit]\nDescription=LFS TrashArcade pinned factory tick\nAfter=network-online.target\n"
               "Wants=network-online.target\n\n[Service]\nType=oneshot\n"
               f"WorkingDirectory={unit_quote(repo)}\n")
    service += "".join(f"Environment={unit_quote(k + '=' + v)}\n" for k, v in environment.items())
    service += (f"ExecStart={unit_quote(python)} {unit_quote(repo / 'tools/factory_dispatch.py')}\n"
                "TimeoutStartSec=600\nNice=10\n")
    timer = ("[Unit]\nDescription=LFS TrashArcade pinned factory schedule\n\n"
             "[Timer]\nOnCalendar=*-*-* *:07/15:00\nAccuracySec=1s\nPersistent=false\n"
             f"Unit={NAME}.service\n\n[Install]\nWantedBy=timers.target\n")
    return {UNITS[0]: service.encode(), UNITS[1]: timer.encode()}


def verify_units(units):
    with tempfile.TemporaryDirectory(prefix="factory-unit-check-") as temporary:
        paths = []
        for name, content in units.items():
            path = Path(temporary) / name
            path.write_bytes(content)
            paths.append(path)
        run(["systemd-analyze", "--user", "verify", *paths])


def require_stopped():
    for name in UNITS:
        result = run(["systemctl", "--user", "is-active", name], allowed=(0, 3, 4))
        if result.returncode == 0 or result.stdout.strip() not in ("inactive", "failed", "unknown"):
            raise ReleaseError("Timer/service must be stopped; use disable and wait for any running tick")
    enabled = run(["systemctl", "--user", "is-enabled", UNITS[1]], allowed=(0, 1, 4))
    if enabled.stdout.strip() not in ("disabled", "not-found"):
        raise ReleaseError("Timer must be disabled before activation; use disable explicitly")


def verify_timer_disabled():
    active = run(["systemctl", "--user", "is-active", UNITS[1]], allowed=(0, 3, 4))
    enabled = run(["systemctl", "--user", "is-enabled", UNITS[1]], allowed=(0, 1, 4))
    if (active.stdout.strip() not in {"inactive", "unknown"} or active.returncode == 0 or
            enabled.stdout.strip() not in {"disabled", "not-found"}):
        raise ReleaseError("Disabled timer state could not be confirmed; inspect units before continuing")


def verify_loaded(args):
    """A successful daemon-reload alone does not establish the loaded unit path."""
    for name in UNITS:
        result = run(["systemctl", "--user", "show", name, "--property=FragmentPath", "--property=NeedDaemonReload",
                      "--property=DropInPaths", "--property=LoadState"])
        fields = dict(line.split("=", 1) for line in result.stdout.splitlines() if "=" in line)
        if (fields.get("FragmentPath") != str(unit_dir(args) / name) or fields.get("NeedDaemonReload") != "no" or
                fields.get("DropInPaths") != "" or fields.get("LoadState") != "loaded"):
            raise ReleaseError("Loaded unit path, overrides, or reload state differ from pinned activation")


@contextlib.contextmanager
def state_lock(args):
    """Share the dispatcher's lock; a stopped timer alone cannot exclude a manual tick."""
    state = args.state_home / NAME
    if not (state / "state.json").is_file():
        raise ReleaseError("Existing state required; restore history or explicitly initialize a new installation")
    path = state / "tick.lock"
    if path.is_symlink():
        raise ReleaseError("State lock must not be a symbolic link")
    with path.open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise ReleaseError("A dispatcher tick owns state; wait for it to finish") from None
        yield


def state_health(args, repo, python):
    """Use the selected controller's read-only loader, never initialize or rewrite state."""
    path = args.state_home / NAME / "state.json"
    if path.is_symlink():
        raise ReleaseError("State must be a regular file, not a symbolic link")
    raw = read_json(path)
    if raw.get("schema", 1) != 2:
        raise ReleaseError("Legacy state requires explicit backed migration before activation")
    if not isinstance(raw.get("sessions"), dict):
        raise ReleaseError("Retained state has invalid session collection")
    env = dict(os.environ, XDG_STATE_HOME=str(args.state_home), XDG_CONFIG_HOME=str(args.config_dir),
               PYTHONDONTWRITEBYTECODE="1")
    result = run([python, repo / "tools/factory_dispatch.py", "--status"], env=env)
    try:
        summary = json.loads(result.stdout)
        if (summary.get("schema") != 2 or type(summary.get("tracked")) is not int or
                summary["tracked"] != len(raw["sessions"])):
            raise ValueError
        contract = summary.get("state_contract", {})
        required = {"durable_intents"}
        if "migration" in raw:
            required.add("migration_admission_hold")
        if "maintenance" in raw:
            required.add("maintenance_queue")
        integration = raw.get("integration", {})
        if not isinstance(integration, dict) or not isinstance(integration.get("intents", {}), dict):
            raise ValueError
        if integration.get("intents"):
            required.add("local_integration_intents")
        if not isinstance(contract, dict) or any(contract.get(key) is not True for key in required):
            raise ValueError
    except (ValueError, TypeError, KeyError, AttributeError):
        raise ReleaseError("Selected controller did not confirm compatible retained state") from None
    return {"schema": 2, "tracked": summary["tracked"],
            "migration_hold": bool(raw.get("migration", {}).get("admission_hold")),
            "breaker_present": bool(raw.get("breaker")),
            "unresolved_intents": summary.get("unresolved_intents")}


def installed_health(args):
    active = read_json(args.data_dir / "active.json")
    revision = checked_revision(active.get("revision"))
    repo = validate_release(args, revision)
    for field in ("config_dir", "state_home", "key_file"):
        if active.get(field) != str(getattr(args, field)):
            raise ReleaseError("Supply the same paths used for activation")
    try:
        units = render_units(args, revision, active["python"], active["gh_directory"])
        for name, content in units.items():
            path = unit_dir(args) / name
            if path.is_symlink() or path.read_bytes() != content:
                raise ReleaseError("Installed units differ from pinned activation; re-activate explicitly")
    except (KeyError, OSError):
        raise ReleaseError("Activation metadata or installed units incomplete") from None
    verify_loaded(args)
    return active, units, state_health(args, repo, active["python"])


def runtime_health(expected):
    states = {}
    for name in UNITS:
        result = run(["systemctl", "--user", "show", name, "--property=ActiveState", "--property=SubState",
                      "--property=UnitFileState", "--property=Result", "--property=ExecMainStatus"])
        fields = dict(line.split("=", 1) for line in result.stdout.splitlines() if "=" in line)
        states[name] = fields
    timer, service = states[UNITS[1]], states[UNITS[0]]
    if expected == "running":
        if timer.get("ActiveState") != "active" or timer.get("UnitFileState") != "enabled":
            raise ReleaseError("Timer enable/readback did not confirm active and enabled")
        if service.get("ActiveState") not in {"inactive", "activating", "active"}:
            raise ReleaseError("Controller service is failed or has unknown runtime state")
    elif (timer.get("ActiveState") != "inactive" or timer.get("UnitFileState") != "disabled" or
          service.get("ActiveState") != "inactive"):
        raise ReleaseError("Expected stopped timer/service and disabled timer")
    if service.get("Result") != "success" or service.get("ExecMainStatus") != "0":
        raise ReleaseError("Last controller execution did not report success; inspect retained journal")
    return {"timer": timer["ActiveState"], "timer_enabled": timer["UnitFileState"],
            "service": service["ActiveState"], "last_exit": int(service["ExecMainStatus"])}


def health(args):
    active, _, state = installed_health(args)
    runtime = runtime_health(args.expect)
    print(json.dumps({"revision": active["revision"], "local_health": "passed", "state": state,
                      "runtime": runtime, "acceptance": "local installation only; provider/gameplay not exercised"}))


def backup(args):
    recovery = args.data_dir / "recovery" / (datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex)
    recovery.mkdir(parents=True, mode=0o700)
    originals = {name: unit_dir(args) / name for name in UNITS}
    originals["active.json"] = args.data_dir / "active.json"
    for name, path in originals.items():
        if path.is_symlink() or (path.exists() and not path.is_file()):
            raise ReleaseError("Existing units/metadata must be regular files; left untouched")
        if path.exists():
            shutil.copy2(path, recovery / name)
    state = args.state_home / NAME
    if state.exists():
        shutil.copytree(state, recovery / "state", symlinks=True)
    write_json(recovery / "backup.json", {"unit_dir": str(unit_dir(args)), "state_dir": str(state)})
    return recovery


def restore_units(args, recovery):
    for name in (*UNITS, "active.json"):
        target = args.data_dir / name if name == "active.json" else unit_dir(args) / name
        source = recovery / name
        if source.exists():
            atomic_write(target, source.read_bytes(), source.stat().st_mode & 0o777)
        elif target.exists():
            target.unlink()
    run(["systemctl", "--user", "daemon-reload"])
    for name in UNITS:
        result = run(["systemctl", "--user", "show", name, "--property=FragmentPath", "--property=NeedDaemonReload"])
        fields = dict(line.split("=", 1) for line in result.stdout.splitlines() if "=" in line)
        expected = str(unit_dir(args) / name) if (recovery / name).exists() else ""
        if fields.get("FragmentPath") != expected or fields.get("NeedDaemonReload") != "no":
            raise ReleaseError("Restored unit files could not be confirmed loaded; leave timer disabled")


def activate(args):
    require_stopped()
    with state_lock(args):
        activate_locked(args)


def activate_locked(args):
    validate_release(args, args.revision)
    require_stopped()
    python = str(Path(sys.executable).resolve())
    state_health(args, release_dir(args, args.revision) / "repo", python)
    gh = shutil.which("gh")
    if not gh:
        raise ReleaseError("gh executable required; no units changed")
    units = render_units(args, args.revision, python, str(Path(gh).parent))
    verify_units(units)
    recovery = backup(args)
    try:
        for name, content in units.items():
            atomic_write(unit_dir(args) / name, content, 0o644)
        run(["systemctl", "--user", "daemon-reload"])
        verify_loaded(args)
        write_json(args.data_dir / "active.json", {"revision": args.revision, "python": python,
                   "gh_directory": str(Path(gh).parent), "config_dir": str(args.config_dir),
                   "state_home": str(args.state_home), "key_file": str(args.key_file), "recovery": str(recovery)})
    except Exception:
        try:
            restore_units(args, recovery)
        except Exception:
            raise ReleaseError("Activation failed and restored units could not be verified; timer remains disabled; preserve recovery") from None
        raise
    print(f"Activated {args.revision}; timer remains stopped. Recovery: {recovery}")


def enable(args):
    active, units, _ = installed_health(args)
    verify_units(units)
    run(["systemctl", "--user", "daemon-reload"])
    verify_loaded(args)
    try:
        run(["systemctl", "--user", "enable", "--now", UNITS[1]])
        runtime_health("running")
    except Exception:
        try:
            run(["systemctl", "--user", "disable", "--now", UNITS[1]])
            verify_timer_disabled()
        except Exception:
            raise ReleaseError("Enable failed and timer stop could not be confirmed; inspect units immediately; state retained") from None
        raise ReleaseError("Enable/readback failed; timer disabled, existing service allowed to finish; state retained") from None
    print(f"Enabled and read back timer for {active['revision']}; provider acceptance not established")


def uninstall(args):
    require_stopped()
    with state_lock(args):
        uninstall_locked(args)


def uninstall_locked(args):
    recovery = backup(args)
    try:
        for name in UNITS:
            path = unit_dir(args) / name
            if path.exists():
                path.unlink()
        run(["systemctl", "--user", "daemon-reload"])
    except Exception:
        restore_units(args, recovery)
        raise
    print(f"Units removed; releases, mirror, state/logs and recovery retained: {recovery}")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("action", nargs="?", choices=("stage", "activate", "rollback", "enable", "disable", "uninstall", "status", "health"))
    parser.add_argument("--revision", help="Full 40-character commit SHA for stage/activate/rollback")
    parser.add_argument("--repository", default=REPOSITORY, help="Repository URL or local path for staging")
    parser.add_argument("--data-dir", type=Path, default=Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local/share")) / NAME)
    parser.add_argument("--config-dir", type=Path, default=Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config")))
    parser.add_argument("--state-home", type=Path, default=Path(os.environ.get("XDG_STATE_HOME", Path.home() / ".local/state")))
    parser.add_argument("--key-file", type=Path, default=Path.home() / ".secrets/jules_api_key", help="Path only; never read or modified by installer")
    parser.add_argument("--dry-run", action="store_true", help="No filesystem/network/service mutations or subprocesses")
    parser.add_argument("--expect", choices=("stopped", "running"), default="stopped", help="Expected runtime state for read-only health")
    argv = list(sys.argv[1:] if argv is None else argv)
    if argv and argv[0] == "--uninstall":
        argv[0] = "uninstall"
    args = parser.parse_args(argv)
    if args.action is None:
        parser.print_help()
        return 0
    try:
        for field in ("data_dir", "config_dir", "state_home", "key_file"):
            value = getattr(args, field)
            if not value.is_absolute():
                raise ReleaseError("Installer paths must be absolute")
            unit_quote(value)
        if args.action in ("stage", "activate", "rollback"):
            checked_revision(args.revision)
        source = urlsplit(args.repository)
        if source.username or source.password or source.query or source.fragment:
            raise ReleaseError("Repository credentials/query parameters forbidden")
        if source.scheme != "https" and not (not source.scheme and Path(args.repository).is_absolute()):
            raise ReleaseError("Repository must use HTTPS or an absolute local path")
        if args.data_dir.resolve().is_relative_to((args.state_home / NAME).resolve()):
            raise ReleaseError("Release data must be outside dispatcher state to keep backups finite")
        if args.dry_run:
            print(json.dumps({"dry_run": True, "action": args.action, "revision": args.revision,
                              "data_dir": str(args.data_dir)}))
            return 0
        if args.action == "status":
            active = args.data_dir / "active.json"
            print(json.dumps({"selected_revision": read_json(active).get("revision") if active.exists() else None,
                              "unit_files_present": all((unit_dir(args) / name).is_file() for name in UNITS),
                              "runtime_status": "not_queried"}))
            return 0
        if args.action == "health":
            health(args)
            return 0
        args.data_dir.mkdir(parents=True, exist_ok=True)
        with (args.data_dir / "release.lock").open("a") as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise ReleaseError("Another release operation holds the lock") from None
            if args.action == "stage":
                stage(args)
            elif args.action in ("activate", "rollback"):
                activate(args)
            elif args.action == "enable":
                enable(args)
            elif args.action == "disable":
                run(["systemctl", "--user", "disable", "--now", UNITS[1]])
                verify_timer_disabled()
                print("Timer disabled; any running tick is allowed to finish")
            else:
                uninstall(args)
        return 0
    except ReleaseError as exc:
        print(f"Factory release held: {exc}", file=sys.stderr)
        return 1
    except Exception:
        print("Factory release failed; preserve recovery and inspect locally; details withheld", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
