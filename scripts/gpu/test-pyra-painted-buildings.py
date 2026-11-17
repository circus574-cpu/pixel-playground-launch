"""Validate the actual packaged bytes and unchanged prototype geography."""
import hashlib
import json
import unittest
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
PROJECT = ROOT / "ports/godot-isometric-pyra"
EXPECTED = {
    "hall": ([-20, -60], [30, 24]), "inn": ([-75, -20], [22, 18]),
    "shop": ([60, -40], [20, 18]), "arena": ([65, 40], [20, 20]),
    "smithy": ([45, 100], [24, 18]), "depot": ([-80, 115], [22, 18]),
}


class BuildingArtTest(unittest.TestCase):
    def test_geography_and_art(self):
        buildings = json.loads((PROJECT / "data/buildings.json").read_text())
        bindings = json.loads((PROJECT / "data/building-art.json").read_text())["buildings"]
        self.assertEqual(set(bindings), set(EXPECTED))
        self.assertEqual({b["id"] for b in buildings}, set(EXPECTED))
        for building in buildings:
            role = building["id"]
            with self.subTest(building=role):
                self.assertEqual((building["xz"], building["size"]), EXPECTED[role])
                self.assertTrue((PROJECT / building["texture"].removeprefix("res://")).is_file())
                binding = bindings[role]
                path = PROJECT / binding["texture"].removeprefix("res://")
                self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), binding["sha256"])
                source = ROOT / binding["source"]
                self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(), binding["source_sha256"])
                image = Image.open(path)
                self.assertEqual(image.mode, "RGBA")
                self.assertLessEqual(max(image.size), 768)
                alpha = image.getchannel("A")
                bbox = alpha.getbbox()
                self.assertIsNotNone(bbox)
                self.assertGreater(bbox[0], 0)
                self.assertGreater(bbox[1], 0)
                self.assertLess(bbox[2], image.width)
                self.assertLess(bbox[3], image.height)
                self.assertLess(sum(alpha.histogram()[1:]), image.width * image.height)
                self.assertTrue(all(0 < a < 1 for a in binding["origin"]))
                self.assertGreater(binding["scale"], 0)
                visible_width = image.width - 32
                expected_width = sum(building["size"]) * 8
                self.assertAlmostEqual(visible_width * binding["scale"], expected_width, places=4)


if __name__ == "__main__":
    unittest.main(verbosity=2)
