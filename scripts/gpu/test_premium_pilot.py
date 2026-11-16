"""CPU safeguards for GPU input integrity, resumability and edge diagnostics."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("pilot", Path(__file__).with_name("premium_pilot.py"))
pilot = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pilot)


class PilotSafety(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.source = self.root / "source.webp"
        self.source.write_bytes(b"immutable test source")
        self.job = {"id": "pyra-b0", "input": self.source.name,
                    "inputSha256": pilot.digest(self.source), "strength": 0.35}
        self.write_queue()

    def tearDown(self):
        self.temp.cleanup()

    def write_queue(self):
        (self.root / "queue.json").write_text(json.dumps({"jobs": [self.job]}))

    def test_modified_source_is_rejected_before_gpu_load(self):
        self.assertEqual(len(pilot.read_queue(self.root)["jobs"]), 1)
        self.source.write_bytes(b"unexpected replacement")
        with self.assertRaises(ValueError):
            pilot.read_queue(self.root)

    def test_absolute_source_outside_bundle_is_rejected_even_with_correct_hash(self):
        with tempfile.TemporaryDirectory() as external:
            source = Path(external) / "secret"
            source.write_bytes(b"outside")
            self.job.update(input=str(source), inputSha256=pilot.digest(source))
            self.write_queue()
            with self.assertRaises(ValueError):
                pilot.read_queue(self.root)

    def test_duplicate_output_ids_are_rejected(self):
        (self.root / "queue.json").write_text(json.dumps({"jobs": [self.job, self.job]}))
        with self.assertRaises(ValueError):
            pilot.read_queue(self.root)

    def test_resume_requires_matching_recipe_and_intact_output(self):
        result = self.root / "candidate.png"
        result.write_bytes(b"finished output")
        record = {"fingerprint": "recipe", "sha256": pilot.digest(result)}
        self.assertTrue(pilot.reusable(record, "recipe", result))
        self.assertFalse(pilot.reusable(record, "different-model", result))
        runtime = self.root / "candidate.webp"
        self.assertFalse(pilot.reusable(record, "recipe", result, runtime))
        runtime.write_bytes(b"runtime image")
        record["runtimeSha256"] = pilot.digest(runtime)
        self.assertTrue(pilot.reusable(record, "recipe", result, runtime))
        runtime.write_bytes(b"broken runtime image")
        self.assertFalse(pilot.reusable(record, "recipe", result, runtime))
        result.write_bytes(b"interrupted output")
        self.assertFalse(pilot.reusable(record, "recipe", result))

    def test_edge_metric_detects_a_tile_boundary_jump(self):
        from PIL import Image
        smooth = Image.new("RGB", (32, 32), "gray")
        self.assertEqual(pilot.seam_metrics(smooth)["edgeMeanAbs"], 0)
        for y in range(32):
            smooth.putpixel((0, y), (255, 255, 255))
        self.assertGreater(pilot.seam_metrics(smooth)["edgeToInterior"], 10)


if __name__ == "__main__":
    unittest.main()
