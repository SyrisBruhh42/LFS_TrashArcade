#!/usr/bin/env python3
"""Render bounded trusted feedback from data; never echo PR-provided prose/code."""
import argparse
import json
import re
from pathlib import Path


def render(directory: Path, head: str, base: str, run: str, result: str, mode: str) -> str:
    if not re.fullmatch(r"[a-f0-9]{40}", head) or not re.fullmatch(r"[a-f0-9]{40}", base):
        raise ValueError("invalid pinned revision")
    if not re.fullmatch(r"https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/actions/runs/[0-9]+", run):
        raise ValueError("invalid workflow run URL")
    classification = "infrastructure"
    for name in ("gate-evidence.json", "targets.json"):
        path = directory / name
        if not path.is_file() or path.is_symlink() or path.stat().st_size > 2_000_000:
            continue
        try:
            item = json.loads(path.read_text())
            if item.get("schema_version") != 1 or item.get("head_sha") != head or item.get("base_sha") != base:
                continue
            if item.get("classification") in ("content", "coverage", "runtime", "infrastructure"):
                classification = item["classification"]
                break
        except (ValueError, OSError, AttributeError):
            continue
    message = "PASS: bounded gate checks passed." if result == "success" else "FAILED: validation failed; inspect the gate-evidence artifact in the linked run."
    return ("<!-- arcade-gate-report -->\n### Arcade gate evidence\n\n"
            f"Head: {head}\nBase: {base}\nRun: {run}\nClassification: {classification}\nMode: {mode}\n\n"
            f"{message}\n\nIntegration is a separate decision. An owner must review maintenance/infrastructure changes; "
            "phase integration requires the enabled protected-integration job and its independent evidence.\n")


def main():
    p = argparse.ArgumentParser(description=__doc__)
    for field in ("head","base","run","result","mode"):
        p.add_argument("--"+field, required=True)
    p.add_argument("--directory",type=Path,required=True)
    p.add_argument("--output",type=Path,required=True)
    a = p.parse_args()
    a.output.write_text(render(a.directory,a.head,a.base,a.run,a.result,a.mode))


if __name__ == "__main__": main()
