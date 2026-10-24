"""Offline brief selection and bounded work-in-progress acceptance tests."""
import contextlib
import importlib.util
import io
import json
import random
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("pick_brief", Path(__file__).resolve().parents[1] / "tools/pick_brief.py")
b = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(b)
SHA = "a" * 40


class BriefTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.patch = patch.object(b, "ROOT", self.root)
        self.patch.start()
        self.addCleanup(self.patch.stop)

    def game(self, gid="052", phase="1"):
        folder = self.root / "games" / f"{gid}-fixture"
        folder.mkdir(parents=True)
        meta = {"id": gid, "slug": folder.name, "phase": phase, "title": "Test " + gid,
                "genre": b.AXES["genres"][0], "coreMechanic": b.AXES["twists"][0], "setting": b.AXES["settings"][0]}
        (folder / "game.json").write_text(json.dumps(meta))
        (folder / "index.html").write_text("<!doctype html><title>Fixture</title>")
        return folder, meta

    def cli(self, *args):
        output = io.StringIO()
        with patch.object(b.sys, "argv", ["pick_brief.py", "--json", "--baseline-sha", SHA, *args]), contextlib.redirect_stdout(output):
            self.assertEqual(b.main(), 0)
        return json.loads(output.getvalue())

    def test_unfinished_idle_game_precedes_new_game(self):
        self.game("052", "7")
        self.game("053", "9")
        result = self.cli("--id", "054")
        self.assertEqual(result["mode"], "advance")
        self.assertEqual(result["id"], "052")
        self.assertEqual(result["phase"], "8")
        self.assertIn(SHA, result["markdown"])

    def test_all_unfinished_active_at_limit_holds_instead_of_creating(self):
        self.game("052", "7")
        self.game("053", "3")
        result = self.cli("--exclude-ids", '["052","053"]', "--max-unfinished-games", "2")
        self.assertEqual(result["mode"], "hold")
        self.assertEqual(result["unfinished"], 2)

    def test_quarantined_unfinished_games_still_occupy_wip(self):
        self.game("052", "7")
        result = self.cli("--exclude-ids", '["052"]', "--max-unfinished-games", "1")
        self.assertEqual(result["mode"], "hold")

    def test_new_title_and_exact_scope_are_deterministic_without_catalog_replay(self):
        games = [self.game("052", "10")]
        first = b.pick_new_game("053", games, [], random.Random(42), SHA)
        second = b.pick_new_game("053", games, [], random.Random(42), SHA)
        self.assertEqual(first, second)
        self.assertRegex(first["slug"], r"^053-[a-z0-9-]+$")
        self.assertLessEqual(len(first["slug"]), 48)
        self.assertLessEqual(len(first["title"]), 60)
        self.assertIn(first["slug"], first["markdown"])
        self.assertNotIn("Existing titles", first["markdown"])
        self.assertNotIn("Test 052", first["markdown"])

    def test_briefs_require_behavior_instead_of_line_growth(self):
        folder, meta = self.game("052", "1")
        advanced = b.build_advance_brief(folder, meta, SHA)
        new = b.pick_new_game("053", [(folder, meta)], [], random.Random(42), SHA)
        for brief in (advanced, new):
            self.assertNotIn("min_js_lines", brief["markdown"])
            self.assertNotIn("net lines", brief["markdown"])
            self.assertNotIn("Minimum non-empty", brief["markdown"])
            self.assertIn("Acceptance", brief["markdown"])
            self.assertIn("touch", brief["markdown"])
            self.assertIn("reset", brief["markdown"])

    def test_completed_game_cannot_advance(self):
        folder, meta = self.game("052", "10")
        with self.assertRaises(ValueError):
            b.build_advance_brief(folder, meta, SHA)

    def test_corrupt_manifest_cannot_evade_wip_or_uniqueness(self):
        folder, _ = self.game()
        (folder / "game.json").write_text("{broken")
        with self.assertRaises(ValueError):
            b.existing_games()

    def test_unmerged_new_assignments_also_consume_wip(self):
        result = self.cli("--id", "054", "--inflight-new-ids", '["052","053"]', "--max-unfinished-games", "2")
        self.assertEqual(result["mode"], "hold")
        self.assertEqual(result["unfinished"], 2)

    def test_merged_new_assignment_is_not_double_counted_as_pending(self):
        self.game("052", "1")
        result = self.cli("--id", "053", "--exclude-ids", '["052"]', "--inflight-new-ids", '["052"]', "--max-unfinished-games", "2", "--seed", "42")
        self.assertEqual(result["mode"], "new")

    def test_under_wip_limit_can_create_one_game(self):
        self.game("052", "1")
        result = self.cli("--id", "053", "--exclude-ids", '["052"]', "--max-unfinished-games", "2", "--seed", "42")
        self.assertEqual(result["mode"], "new")
        self.assertEqual(result["id"], "053")


if __name__ == "__main__":
    unittest.main()
