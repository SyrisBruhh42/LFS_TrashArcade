#!/usr/bin/env python3
"""Bounded browser evidence. No credentials, file URLs or sandbox bypass.

Trusted adapters observe real state/DOM and trigger normal UI events. A successful
smoke is limited evidence. Reviewed behavior profiles additionally exercise native
input and observed gameplay effects; neither approves accessibility or devices.
Source identity is supplied by the trusted caller after its exact-source check.
"""
from __future__ import annotations
import json
import math
import mimetypes
import os
import re
import secrets
import signal
import shutil
import subprocess
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent
BEHAVIOR_PROFILES = frozenset({"game083-v1", "game084-v1", "game085-v1", "game086-v1", "standard-v1"})
BEHAVIOR_SCENARIOS = ("keyboard_movement_release", "pointer_action", "touch_movement_cancel", "blur_pause_resume", "restart_from_game_over")
OPTIONAL_SCENARIOS = {"game085-v1": frozenset({"touch_secondary_action"})}
SHA_RE = re.compile(r"[0-9a-f]{40}\Z")
HASH_RE = re.compile(r"[0-9a-f]{64}\Z")
ALLOWED_FILE = re.compile(r"(?:index\.html|game\.json|[a-z0-9][a-z0-9_-]{0,40}\.(?:js|css))\Z")


def safe_asset(folder: Path, request_path: str) -> Path | None:
    name = unquote(urlsplit(request_path).path).removeprefix("/")
    if not ALLOWED_FILE.fullmatch(name):
        return None
    candidate = folder / name
    if folder.is_symlink() or candidate.is_symlink() or not candidate.is_file():
        return None
    if candidate.resolve().parent != folder.resolve():
        return None
    return candidate


def browser_command(chrome: str, profile: str, url: str) -> list[str]:
    return [chrome, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
            "--disable-background-networking", "--disable-extensions", "--disable-sync",
            "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1",
            f"--user-data-dir={profile}", "--remote-debugging-port=0", "--remote-debugging-address=127.0.0.1",
            "--enable-logging=stderr", "--v=0", url]


def assess(result: subprocess.CompletedProcess, nonce: str, *, direct_start: bool = False, required_scenarios: tuple[str, ...] = (), source_sha: str | None = None, expected_behavior_hash: str | None = None) -> dict:
    if result.returncode != 0:
        return {"status":"FAIL", "classification":"infrastructure", "reason":f"browser exited {result.returncode}", "details":result.stderr[-1000:]}
    if re.search(r"Uncaught|SMOKE_FAIL|SMOKE_UNCAUGHT", result.stderr):
        return {"status":"FAIL", "classification":"runtime", "reason":"uncaught browser error", "details":result.stderr[-1000:]}
    try:
        envelope = json.loads(result.stdout)
        if envelope.get("schema_version") != 3 or envelope.get("driver") != "cdp-native-v2" or envelope.get("nonce") != nonce:
            raise ValueError("invalid trusted driver envelope")
        if envelope.get("source_sha") != source_sha:
            raise ValueError("source SHA binding mismatch")
        if envelope.get("expected_behavior_hash") != expected_behavior_hash:
            raise ValueError("behavior expectation binding mismatch")
        evidence = envelope["evidence"]
        for key in ("frames", "playing_frames", "observation_ms", "playing_observation_ms"):
            if type(evidence.get(key)) not in (int, float) or not math.isfinite(evidence[key]) or evidence[key] < 0:
                raise ValueError("invalid counter/timing evidence")
        passed = ((evidence["title_seen"] is True or direct_start and evidence.get("title_applicable") is False) and evidence["playing_seen"] is True
                  and evidence["interaction_sent"] is True and evidence["frames"] >= 2
                  and evidence["playing_frames"] >= 2 and evidence["observation_ms"] >= 1500
                  and evidence["playing_observation_ms"] >= 900 and evidence["errors"] == [])
        scenarios = evidence.get("scenarios", [])
        if not isinstance(scenarios, list):
            raise ValueError("invalid scenario evidence")
        if required_scenarios:
            if len(scenarios) != len(required_scenarios) or {s.get("id") for s in scenarios} != set(required_scenarios):
                raise ValueError("missing or duplicate required scenario")
            for scenario in scenarios:
                if (scenario.get("source_sha") != source_sha or scenario.get("expected_behavior_hash") != expected_behavior_hash
                        or scenario.get("status") not in ("PASS", "FAIL") or type(scenario.get("elapsed_ms")) not in (float, int)
                        or not math.isfinite(scenario["elapsed_ms"]) or scenario["elapsed_ms"] < 0):
                    raise ValueError("invalid scenario source or outcome")
                classification = "browser_input_with_trusted_fixture" if scenario["id"] == "restart_from_game_over" else "browser_input"
                if scenario.get("classification") != classification:
                    raise ValueError("invalid coverage classification")
                if scenario["status"] != "PASS": passed = False
    except (ValueError, KeyError, TypeError, AttributeError):
        return {"status":"FAIL", "classification":"infrastructure", "reason":"malformed browser completion evidence"}
    return {"status":"PASS" if passed else "FAIL", "classification":"runtime",
            "evidence_schema_version":3, "driver":"cdp-native-v2", "tested_at":envelope.get("tested_at"),
            "reason":("required browser behavior scenarios completed" if required_scenarios else "bounded TITLE/PLAYING smoke completed") if passed else "state/interaction/scenario/error assertion failed",
            "evidence": evidence}


def run_browser(command: list[str], env: dict) -> subprocess.CompletedProcess:
    """Kill the entire Node/Chrome process group on timeout, never orphan a browser."""
    process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                               text=True, env=env, start_new_session=True)
    try:
        stdout, stderr = process.communicate(timeout=90)
        return subprocess.CompletedProcess(command, process.returncode, stdout, stderr)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        process.communicate()
        raise


def run_game(folder: Path, contract: dict | None, chrome: str | None = None, *, source_sha: str | None = None, require_behavior: bool = False, expected_behavior_hash: str | None = None, required_scenarios: tuple[str, ...] | None = ()) -> dict:
    record = {"game": folder.name, "scope":"title_start_playing_keyboard_smoke", "status":"UNVERIFIED", "classification":"coverage"}
    record["source_sha"] = source_sha
    record["source_binding"] = "caller_verified_sha" if source_sha else "unbound_local"
    record["expected_behavior_hash"] = expected_behavior_hash
    if source_sha is not None and (not isinstance(source_sha, str) or not SHA_RE.fullmatch(source_sha)):
        return dict(record, status="FAIL", classification="infrastructure", reason="invalid caller source SHA")
    if expected_behavior_hash is not None and (not isinstance(expected_behavior_hash, str) or not HASH_RE.fullmatch(expected_behavior_hash)):
        return dict(record, status="FAIL", classification="infrastructure", reason="invalid caller expected behavior hash")
    if not contract:
        return dict(record, status="FAIL" if require_behavior else "UNVERIFIED", reason="no reviewed runtime adapter")
    if not isinstance(contract, dict) or not isinstance(contract.get("title"), str) or not isinstance(contract.get("playing"), str) or not isinstance(contract.get("start"), dict):
        return dict(record, status="FAIL" if require_behavior else "UNVERIFIED", reason="invalid reviewed runtime adapter")
    profile = contract.get("behavior_profile")
    if profile and (not isinstance(profile, str) or profile not in BEHAVIOR_PROFILES):
        return dict(record, status="FAIL", reason="unknown trusted behavior profile")
    if require_behavior and not profile:
        return dict(record, status="FAIL", reason="required behavior coverage has no reviewed profile")
    if required_scenarios is None:
        required_scenarios = ()
    if (not isinstance(required_scenarios, (tuple, list)) or not all(isinstance(name, str) for name in required_scenarios)
            or len(set(required_scenarios)) != len(required_scenarios)
            or set(required_scenarios) - set(BEHAVIOR_SCENARIOS) - OPTIONAL_SCENARIOS.get(profile, frozenset())
            or required_scenarios and not profile):
        return dict(record, status="FAIL", reason="unsupported required behavior scenario for reviewed profile")
    scenario_ids = tuple(dict.fromkeys((*BEHAVIOR_SCENARIOS, *required_scenarios))) if profile else ()
    record["required_scenarios"] = list(scenario_ids)
    if profile:
        record["scope"] = "browser_input_behavior_with_restart_fixture"
    # Identity/expectation bindings never come from candidate game metadata.
    contract = {**contract, "source_sha": source_sha, "expected_behavior_hash": expected_behavior_hash, "required_scenarios": list(scenario_ids)}
    chrome = chrome or shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("chromium-browser")
    if not chrome:
        return dict(record, status="FAIL", classification="infrastructure", reason="required Chrome browser unavailable")
    index = safe_asset(folder, "/index.html")
    if not index:
        return dict(record, status="FAIL", classification="content", reason="unsafe or missing game index")
    nonce = secrets.token_hex(16)
    document = index.read_text(encoding="utf-8")
    # The original document receives no observer source, nonce, or verdict data.

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args): pass
        def do_GET(self):
            asset = safe_asset(folder, self.path)
            if not asset:
                self.send_error(404); return
            body = document.encode() if asset.name == "index.html" else asset.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", mimetypes.guess_type(asset.name)[0] or "application/octet-stream")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers(); self.wfile.write(body)

    try:
        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    except OSError as exc:
        return dict(record, status="FAIL", classification="infrastructure", reason=f"isolated HTTP server unavailable ({type(exc).__name__})")
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        with tempfile.TemporaryDirectory(prefix="arcade-browser-") as browser_profile:
            # Deliberately pass an allowlisted environment, never GH/Jules tokens.
            env = {key:os.environ[key] for key in ("PATH","HOME","DISPLAY","XDG_RUNTIME_DIR","LANG") if key in os.environ}
            node = shutil.which("node")
            if not node:
                return dict(record, status="FAIL", classification="infrastructure", reason="required Node22+ CDP runtime unavailable")
            result = run_browser([node, str(ROOT / "tools/runtime_browser.cjs"), nonce, browser_profile, json.dumps(contract),
                                  *browser_command(chrome, browser_profile, f"http://127.0.0.1:{server.server_port}/index.html")], env)
            return dict(record, **assess(result, nonce, direct_start=contract.get("initial_state") == "PLAYING", required_scenarios=scenario_ids, source_sha=source_sha, expected_behavior_hash=expected_behavior_hash))
    except subprocess.TimeoutExpired:
        return dict(record, status="FAIL", classification="infrastructure", reason="browser exceeded 90 second deadline")
    except (OSError, UnicodeError) as exc:
        return dict(record, status="FAIL", classification="infrastructure", reason=f"browser execution failed ({type(exc).__name__})")
    finally:
        server.shutdown(); server.server_close(); thread.join(timeout=2)


def audit(folders: list[Path], contracts_path: Path | None = None, *, source_sha: str | None = None, require_behavior: bool = False, expected_behavior_hash: str | None = None, required_scenarios: tuple[str, ...] | None = ()) -> list[dict]:
    path = contracts_path or ROOT / "tools/runtime_contracts.json"
    contracts = {}
    try:
        contracts = json.loads(path.read_text())
        if contracts.get("schema_version") != 1 or not isinstance(contracts.get("games"), dict):
            raise ValueError("unsupported catalog")
        catalog = contracts["games"]
    except (OSError, ValueError, TypeError, AttributeError):
        catalog = {}
    default = contracts.get("default") if catalog else None
    minimum = contracts.get("default_min_id", 1000) if catalog else 1000
    records = []
    for folder in folders:
        contract = catalog.get(folder.name)
        if contract is None and folder.name[:3].isdigit() and int(folder.name[:3]) >= max(86, minimum):
            contract = default
        try:
            records.append(run_game(folder, contract, source_sha=source_sha, require_behavior=require_behavior, expected_behavior_hash=expected_behavior_hash, required_scenarios=required_scenarios))
        except (OSError, ValueError, TypeError) as exc:
            records.append({"game":folder.name, "status":"FAIL", "classification":"infrastructure",
                            "reason":f"runtime setup failed ({type(exc).__name__})"})
    return records
