#!/usr/bin/env python3
"""Explicit, lossless factory state migration. Default is a read-only plan.

Apply requires the plan's exact input hash, a new recovery directory, and the
dispatcher's exclusive tick lock. No credentials, network, services, initialization
or state rollback are used. A failed readback never restores an older state file.
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import sys

NAME = "lfs-trasharcade-factory"


class MigrationError(Exception):
    pass


def dependency(name):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(name + ".py"))
    module = importlib.util.module_from_spec(spec)
    previous = sys.dont_write_bytecode
    try:
        sys.dont_write_bytecode = True
        spec.loader.exec_module(module)
    finally:
        sys.dont_write_bytecode = previous
    return module


def validate(raw):
    """Exercise the real controller loader without creating even a temporary file."""
    controller = dependency("factory_dispatch")

    class Content:
        def read_text(self, encoding="utf-8"):
            return raw.decode(encoding)

    controller.STATE_FILE = Content()
    try:
        return controller.load_state()
    except Exception:
        raise MigrationError("State is not compatible with this controller; preserve it for diagnosis") from None


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def encode(value):
    return (json.dumps(value, indent=2, sort_keys=True) + "\n").encode()


def digest(value):
    return sha(json.dumps(value, sort_keys=True, separators=(",", ":")).encode())


def check_controller_revision(revision):
    if not re.fullmatch(r"[0-9a-f]{40}", revision or ""):
        raise MigrationError("Owner evidence requires a full pinned controller revision")
    try:
        dependency("factory_release").validate_checkout(Path(__file__).resolve().parents[1], revision)
    except Exception:
        raise MigrationError("Hold release must run from the clean pinned controller checkout named in the review") from None


def fresh_timestamp(value):
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        age = (datetime.now(timezone.utc) - parsed).total_seconds()
        if parsed.tzinfo is None or age < -30 or age > 900:
            raise ValueError
        return parsed
    except (ValueError, TypeError, AttributeError):
        raise MigrationError("Review and complete reconciliation must both be no more than 15 minutes old") from None


def prepare_release(raw, evidence_path):
    candidate = validate(raw)
    migration = candidate.get("migration")
    if not isinstance(migration, dict) or migration.get("version") != 1 or migration.get("admission_hold") is not True:
        raise MigrationError("No recognized migration admission hold to release")
    receipt = migration.get("reconciliation")
    if not isinstance(receipt, dict) or receipt.get("inventory_complete") is not True:
        raise MigrationError("Run a complete read-only reconciliation before reviewing hold release")
    observed = fresh_timestamp(receipt.get("observed_at"))
    if (receipt.get("tracked_sessions") != len(candidate["sessions"]) or
            receipt.get("sessions_sha256") != digest(candidate["sessions"]) or
            receipt.get("intents_sha256") != digest(candidate.get("intents", {})) or
            receipt.get("legacy_scope_annotations_sha256") != digest(candidate.get("legacy_scope_annotations", {}))):
        raise MigrationError("Reconciliation no longer matches retained sessions/intents; reconcile again")
    for field in ("missing_unresolved", "active_unresolved", "unresolved_intents"):
        if type(receipt.get(field)) is not int or receipt[field] != 0:
            raise MigrationError("Unresolved provider history remains; migration hold cannot be released")
    if any(intent.get("status") in {"pending", "ambiguous"} for intent in candidate.get("intents", {}).values()):
        raise MigrationError("Uncertain provider requests remain; migration hold cannot be released")
    if evidence_path is None or not evidence_path.is_absolute() or evidence_path.is_symlink() or not evidence_path.is_file():
        raise MigrationError("Hold release needs an absolute regular --evidence-file with reviewed owner evidence")
    evidence_raw = evidence_path.read_bytes()
    evidence = json.loads(evidence_raw)
    if (not isinstance(evidence, dict) or evidence.get("schema") != 1 or
            evidence.get("decision") != "release_migration_admission_hold" or
            evidence.get("state_sha256") != sha(raw) or
            evidence.get("reconciliation_sha256") != digest(receipt) or
            evidence.get("provider_inventory_reviewed") is not True or
            evidence.get("github_dispositions_reviewed") is not True or
            evidence.get("legacy_assignment_authority") != "not_granted" or
            not isinstance(evidence.get("reviewer"), str) or not evidence["reviewer"].strip()):
        raise MigrationError("Owner evidence does not authorize this exact reconciled state; history cannot grant new assignment authority")
    reviewed = fresh_timestamp(evidence.get("reviewed_at"))
    if reviewed < observed:
        raise MigrationError("Owner review must follow the complete reconciliation being released")
    check_controller_revision(evidence.get("controller_revision"))
    migration["admission_hold"] = False
    migration["release"] = {key: evidence[key] for key in
        ("reviewer", "reviewed_at", "controller_revision", "state_sha256", "reconciliation_sha256", "decision")}
    migration["release"]["evidence_sha256"] = sha(evidence_raw)
    candidate["healthy_ticks"] = 0
    if candidate.get("breaker", {}).get("reason") == "legacy_state_provenance_unverified":
        candidate.pop("breaker")
    validate(encode(candidate))
    return candidate, True


def prepare_change(args, raw):
    return prepare_release(raw, args.evidence_file) if args.release_hold else prepare(raw)


def prepare(raw):
    current = json.loads(raw)
    candidate = validate(raw)
    legacy = sum(not all(rec.get(key) for key in ("correlation", "assigned_folder", "baseline_sha"))
                 for rec in candidate["sessions"].values())
    if "migration" in current:
        marker = current["migration"]
        if (not isinstance(marker, dict) or marker.get("version") != 1 or
                not isinstance(marker.get("admission_hold"), bool) or
                not re.fullmatch(r"[0-9a-f]{64}", marker.get("source_sha256", ""))):
            raise MigrationError("Existing migration marker is unrecognized; it will not be overwritten")
        return candidate, False
    if current.get("schema", 1) == 2 and not legacy:
        return candidate, False
    created = datetime.now(timezone.utc).isoformat(timespec="seconds")
    candidate["migration"] = {"version": 1, "source_schema": current.get("schema", 1),
        "source_sha256": sha(raw), "applied_at": created, "legacy_sessions": legacy,
        "provenance": "unverified", "admission_hold": True}
    candidate.setdefault("breaker", {"reason": "legacy_state_provenance_unverified", "created": created})
    candidate["healthy_ticks"] = 0
    # Migration must not invent assignment scope, receipts, or provider conclusions.
    if candidate["sessions"] != current["sessions"] or candidate.get("intents", {}) != current.get("intents", {}):
        raise MigrationError("Controller normalization changed history; reviewed migration required")
    validate(encode(candidate))
    return candidate, True


def read_state(path):
    if path.is_symlink() or not path.is_file():
        raise MigrationError("Existing regular state file required; never initialize or follow a state symlink")
    return path.read_bytes()


def summary(raw, candidate, needed):
    return {"input_sha256": sha(raw), "migration_needed": needed, "schema_after": candidate["schema"],
        "tracked": len(candidate["sessions"]), "intents": len(candidate.get("intents", {})),
        "outcomes": dict(Counter(rec.get("outcome", "in_flight") for rec in candidate["sessions"].values())),
        "admission_hold": bool(candidate.get("migration", {}).get("admission_hold")),
        "legacy_provenance": candidate.get("migration", {}).get("provenance", "not_changed"),
        "history_preserved": True, "paid_work_authorized": False}


def apply(args):
    if not re.fullmatch(r"[0-9a-f]{64}", args.expect_sha256 or ""):
        raise MigrationError("Apply requires the exact input_sha256 from a reviewed dry-run")
    if args.backup_dir is None or not args.backup_dir.is_absolute() or args.backup_dir.exists():
        raise MigrationError("Apply requires a new absolute --backup-dir; existing recovery is never overwritten")
    if not args.backup_dir.parent.is_dir() or args.backup_dir.parent.is_symlink():
        raise MigrationError("Backup parent must already be an existing regular recovery directory")
    read_state(args.state_file)
    lock_path = args.state_file.parent / "tick.lock"
    if lock_path.is_symlink():
        raise MigrationError("State lock must not be a symbolic link")
    with lock_path.open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise MigrationError("A dispatcher tick owns state; disable the timer and wait") from None
        raw = read_state(args.state_file)
        if sha(raw) != args.expect_sha256:
            raise MigrationError("State changed since review; make a fresh dry-run plan")
        candidate, needed = prepare_change(args, raw)
        result = summary(raw, candidate, needed)
        if not needed:
            return {**result, "applied": False, "reason": "already_compatible"}
        atomic_write = dependency("factory_release").atomic_write
        args.backup_dir.mkdir(mode=0o700)
        parent = os.open(args.backup_dir.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(parent)
        finally:
            os.close(parent)
        atomic_write(args.backup_dir / "state.before.json", raw)
        if (args.backup_dir / "state.before.json").read_bytes() != raw:
            raise MigrationError("Backup readback failed; state not replaced")
        encoded = encode(candidate)
        receipt = {"operation": "release_migration_hold" if args.release_hold else "legacy_state_migration", "input_sha256": sha(raw),
                   "output_sha256": sha(encoded), "state_file": str(args.state_file), "status": "prepared"}
        atomic_write(args.backup_dir / "migration.json", encode(receipt))
        if read_state(args.state_file) != raw:
            raise MigrationError("State changed while preparing backup; state not replaced")
        atomic_write(args.state_file, encoded)
        if read_state(args.state_file) != encoded:
            raise MigrationError("Migration readback differs; preserve current state and backup; never restore stale receipts")
        validate(encoded)
        receipt["status"] = "committed"
        atomic_write(args.backup_dir / "migration.json", encode(receipt))
        return {**result, "applied": True, "output_sha256": sha(encoded), "backup_dir": str(args.backup_dir)}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--state-file", type=Path,
        default=Path(os.environ.get("XDG_STATE_HOME", Path.home() / ".local/state")) / NAME / "state.json")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--apply", action="store_true")
    mode.add_argument("--dry-run", action="store_true", help="Default; read-only plan, no locks or writes")
    parser.add_argument("--expect-sha256")
    parser.add_argument("--backup-dir", type=Path)
    parser.add_argument("--release-hold", action="store_true", help="Review release of the migration hold; still dry-run unless --apply is supplied")
    parser.add_argument("--evidence-file", type=Path, help="Explicit owner review binding current state, reconciliation, and pinned controller")
    args = parser.parse_args(argv)
    try:
        if not args.state_file.is_absolute():
            raise MigrationError("State file must be an absolute path")
        if args.apply:
            result = apply(args)
        else:
            raw = read_state(args.state_file)
            candidate, needed = prepare_change(args, raw)
            result = {**summary(raw, candidate, needed), "applied": False, "dry_run": True}
        result["operation"] = "release_migration_hold" if args.release_hold else "migrate_legacy_state"
        print(json.dumps(result, sort_keys=True, indent=2))
        return 0
    except MigrationError as exc:
        print(f"Factory migration held: {exc}", file=sys.stderr)
        return 1
    except Exception:
        print("Factory migration failed; preserve current state and recovery; details withheld", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
