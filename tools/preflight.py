#!/usr/bin/env python3
"""Fail-closed local pre-submit validation of an exact committed game revision.

No implicit fetch or network call. Fetch/rebase explicitly first. Local results do
not grant merge, provider, deployment or production acceptance authority.
"""
from __future__ import annotations
import argparse
import os
import subprocess
import sys
import tempfile
from pathlib import Path

os.environ.setdefault("PYTHONDONTWRITEBYTECODE", "1")
sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parent.parent


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", default=None)
    parser.add_argument("--head", default="HEAD")
    parser.add_argument("--mode", choices=("phase", "maintenance"), default="phase")
    parser.add_argument("--incident-id")
    parser.add_argument("--incident-spec")
    args = parser.parse_args()
    explicit_base = args.base is not None
    base_ref = args.base or "origin/main"
    status = subprocess.run(["git", "status", "--porcelain", "--", "."], cwd=ROOT, capture_output=True, text=True, check=True)
    head = subprocess.run(["git", "rev-parse", "--verify", "--end-of-options", args.head + "^{commit}"], cwd=ROOT, capture_output=True, text=True)
    checkout = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
    if head.returncode != 0 or head.stdout.strip() != checkout:
        print("PREFLIGHT FAILED: --head must resolve to this clean checkout's HEAD.")
        return 1
    if explicit_base and status.stdout.strip():
        print("PREFLIGHT FAILED: commit or preserve local changes first; working tree must match tested HEAD.")
        return 1
    base_verify = subprocess.run(["git", "rev-parse", "--verify", "--end-of-options", base_ref + "^{commit}"], cwd=ROOT, capture_output=True, text=True)
    base_sha = base_verify.stdout.strip() if base_verify.returncode == 0 else ""
    if not explicit_base and args.mode == "phase" and (not base_sha or base_sha == checkout or status.stdout.strip()):
        with tempfile.TemporaryDirectory(prefix="arcade-preflight-") as directory:
            result = subprocess.run(
                [sys.executable, "tools/check_games.py", "--strict", "--check-registry", "--static-only", "--report", str(Path(directory) / "evidence.json")],
                cwd=ROOT,
            )
            if result.returncode == 0:
                cjs_tests = sorted(str(p) for p in (ROOT / "tests").glob("*.cjs") if p.is_file() and not p.name.startswith("_"))
                if cjs_tests:
                    t_res = subprocess.run(["node", "--test", *cjs_tests], cwd=ROOT)
                    if t_res.returncode != 0:
                        result = t_res
        print("PREFLIGHT OK: bounded committed-source checks passed; owner review required for maintenance." if result.returncode == 0
              else "PREFLIGHT FAILED: resolve reported failures; never substitute static-only for browser acceptance.")
        return result.returncode
    if status.stdout.strip():
        print("PREFLIGHT FAILED: commit or preserve local changes first; working tree must match tested HEAD.")
        return 1
    with tempfile.TemporaryDirectory(prefix="arcade-preflight-") as directory:
        targets = Path(directory) / "targets.json"
        guard = [sys.executable, "tools/path_guard.py", "--base", base_ref, "--head", args.head,
                 "--mode", args.mode, "--output", str(targets)]
        if args.mode == "maintenance":
            if not args.incident_id or not args.incident_spec:
                print("PREFLIGHT FAILED: maintenance requires --incident-id and --incident-spec from the reviewed assignment.")
                return 1
            guard += ["--require-assignment", "--incident-id", args.incident_id, "--incident-spec", args.incident_spec]
        result = subprocess.run(guard, cwd=ROOT)
        if result.returncode:
            print("PREFLIGHT FAILED: path/base/phase checks failed; no validation was skipped.")
            return 1
        result = subprocess.run([sys.executable, "tools/check_games.py", "--strict", "--check-registry", "--targets-file", str(targets),
                                 "--report", str(Path(directory) / "evidence.json")], cwd=ROOT)
    print("PREFLIGHT OK: bounded committed-source checks passed; owner review required for maintenance." if result.returncode == 0
          else "PREFLIGHT FAILED: resolve reported failures; never substitute static-only for browser acceptance.")
    return result.returncode


if __name__ == "__main__":
    sys.exit(main())
