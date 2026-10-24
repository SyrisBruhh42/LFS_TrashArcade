"""Security and admission regressions for the autonomous game boundary."""
import argparse
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import path_guard
import check_games
import gate_feedback
import build_registry


class GuardTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.repo = Path(self.temp.name)
        self.patch = patch.object(path_guard,"ROOT",self.repo); self.patch.start()
        self.check_patch = patch.object(check_games,"ROOT",self.repo);self.check_patch.start()
        self.git("init","-q")
        self.git("config","user.email","fixture@example.invalid")
        self.git("config","user.name","Gate test fixture")
        self.game = self.repo/"games/080-fixture"
        self.game.mkdir(parents=True)
        self.meta = {"id":"080","slug":"080-fixture","genre":"genre","coreMechanic":"mechanic",
                     "setting":"setting","createdAt":"2026-01-01","phase":"9"}
        self.write_manifest()
        (self.game/"index.html").write_text("<!doctype html><canvas></canvas>")
        (self.game/"game.js").write_text("window.state='TITLE';\n")
        self.commit()
        self.base = self.git("rev-parse","HEAD").strip()

    def tearDown(self): self.patch.stop();self.check_patch.stop(); self.temp.cleanup()
    def git(self,*args): return subprocess.run(["git",*args],cwd=self.repo,capture_output=True,text=True,check=True).stdout
    def commit(self, registry=True):
        if registry:
            with patch.object(build_registry,"GAMES",self.repo/"games"):
                (self.repo/"games/registry.js").write_text(build_registry.build())
        self.git("add","."); self.git("commit","-qm","fixture")
    def write_manifest(self): (self.game/"game.json").write_text(json.dumps(self.meta))
    def upgrade(self):
        self.meta["phase"]="10"; self.write_manifest()
        (self.game/"game.js").write_text("window.state='PLAYING';\n")
        self.commit()
    def validate(self,mode="phase"): return path_guard.validate(self.base,"HEAD",mode)

    def test_tiny_behavioral_phase_is_valid_without_line_incentive(self):
        self.upgrade(); result=self.validate()
        self.assertEqual("PASS",result["status"])
        self.assertEqual(["080-fixture"],result["targets"])
        self.assertTrue(result["automatic_merge_eligible"])

    def test_registry_tampering_is_rejected(self):
        (self.game/"game.js").write_text("fixed()")
        (self.repo/"games/registry.js").write_text("window.ARCADE_REGISTRY=[]; steal();")
        self.commit(registry=False)
        self.assertEqual("FAIL",self.validate("maintenance")["status"])

    def test_metadata_change_requires_current_generated_registry(self):
        self.meta["phase"]="10";self.write_manifest()
        (self.game/"game.js").write_text("fixed()")
        self.commit(registry=False)
        self.assertEqual("FAIL",self.validate()["status"])

    def test_protected_tool_edit_never_allowed(self):
        (self.repo/"tools").mkdir(); (self.repo/"tools/gate.py").write_text("pass")
        self.upgrade(); self.assertEqual("FAIL",self.validate()["status"])

    def test_symlink_rejected_even_when_name_allowed(self):
        (self.game/"escape.js").symlink_to("/etc/passwd")
        self.upgrade(); self.assertEqual("FAIL",self.validate()["status"])

    def test_executable_blob_rejected(self):
        (self.game/"game.js").chmod(0o755)
        self.upgrade(); self.assertEqual("FAIL",self.validate()["status"])

    def test_directory_and_traversal_names_rejected(self):
        (self.game/"nested").mkdir(); (self.game/"nested/escape.js").write_text("1")
        self.upgrade(); self.assertEqual("FAIL",self.validate()["status"])
        self.assertIsNone(path_guard.GAME_FILE_RE.fullmatch("games/080-fixture/../game.js"))

    def test_maintenance_preserves_phase_and_never_auto_merges(self):
        (self.game/"game.js").write_text("fixed()")
        self.commit()
        self.assertEqual("FAIL",self.validate()["status"])
        result=self.validate("maintenance")
        self.assertEqual("PASS",result["status"])
        self.assertFalse(result["automatic_merge_eligible"])

    def test_maintenance_cannot_change_identity_or_phase(self):
        self.upgrade(); self.assertEqual("FAIL",self.validate("maintenance")["status"])
        self.meta["phase"]="9"; self.meta["genre"]="changed"; self.write_manifest();self.commit()
        self.assertEqual("FAIL",self.validate("maintenance")["status"])

    def test_stale_base_is_not_silently_overlaid(self):
        self.upgrade(); head=self.git("rev-parse","HEAD").strip()
        self.git("checkout","--detach",self.base)
        (self.repo/"main-only.txt").write_text("advanced");self.commit()
        current_base=self.git("rev-parse","HEAD").strip()
        result=path_guard.validate(current_base,head)
        self.assertEqual("FAIL",result["status"])
        self.assertIn("rebased",result["errors"][0])

    def test_overlay_checks_base_and_uses_exact_validated_files(self):
        self.upgrade(); result=self.validate()
        with self.assertRaises(ValueError):path_guard.overlay(result)
        self.git("checkout","--detach",self.base)
        path_guard.overlay(result)
        self.assertEqual("window.state='PLAYING';\n",(self.game/"game.js").read_text())
        self.assertEqual(self.base,self.git("rev-parse","HEAD").strip())

    def test_stale_target_file_cannot_test_a_different_working_tree(self):
        self.upgrade();result=self.validate()
        evidence=self.repo/"targets.json";evidence.write_text(json.dumps(result))
        (self.game/"game.js").write_text("untested different source")
        with self.assertRaises(ValueError):
            check_games.runtime_targets(argparse.Namespace(targets_file=evidence),[self.game])

    def test_wrong_target_fallback_cannot_choose_newest_game(self):
        self.upgrade(); result=self.validate()
        evidence=self.repo/"targets.json";evidence.write_text(json.dumps(result))
        newer=self.repo/"games/099-newest";newer.mkdir()
        args=argparse.Namespace(targets_file=evidence)
        targets, provenance=check_games.runtime_targets(args,[self.game,newer])
        self.assertEqual([self.game],targets)
        self.assertEqual(result["head_sha"],provenance["head_sha"])
        result["targets"]=["999-missing"];evidence.write_text(json.dumps(result))
        with self.assertRaises(ValueError):check_games.runtime_targets(args,[self.game,newer])


class FeedbackTests(unittest.TestCase):
    def test_feedback_does_not_echo_injected_diagnostic_content(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d); head="a"*40;base="b"*40
            (root/"gate-evidence.json").write_text(json.dumps({"schema_version":1,"head_sha":head,"base_sha":base,
                "classification":"runtime","errors":["$(echo bad)\n@everyone"]}))
            report=gate_feedback.render(root,head,base,"https://github.com/owner/repo/actions/runs/123","failure","phase")
            self.assertIn("Classification: runtime",report)
            self.assertIn("Head: "+head,report)
            self.assertNotIn("@everyone",report);self.assertNotIn("$(",report)

    def test_mismatched_head_is_infrastructure_not_current_game_error(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d)
            (root/"gate-evidence.json").write_text(json.dumps({"schema_version":1,"head_sha":"c"*40,"base_sha":"b"*40,"classification":"content"}))
            report=gate_feedback.render(root,"a"*40,"b"*40,"https://github.com/o/r/actions/runs/1","failure","phase")
            self.assertIn("Classification: infrastructure",report)

    def test_validation_and_privileged_workflow_boundaries(self):
        text=(ROOT/".github/workflows/arcade_gate.yml").read_text()
        validation=text.split("  pr-gate:",1)[1].split("  pr-report:",1)[0]
        main=text.split("  main-guard:",1)[1]
        integrate=text.split("  integrate:",1)[1].split("  main-guard:",1)[0]
        self.assertNotIn("secrets.",validation);self.assertNotIn("GH_TOKEN",validation)
        self.assertNotIn("contents: write",validation);self.assertNotIn("pull-requests: write",validation)
        self.assertIn("persist-credentials: false",validation)
        self.assertNotIn("git revert",main);self.assertNotIn("git push",main)
        self.assertIn("vars.ARCADE_AUTO_MERGE == 'true'",integrate)
        self.assertIn("needs.pr-gate.outputs.mode == 'phase'",integrate)
        self.assertNotIn("download-artifact",integrate)
        self.assertNotIn("check_games.py",integrate)


if __name__=="__main__":unittest.main()
