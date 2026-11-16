"""Native texture/alpha budgets and identity-reference guards, without CUDA."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).parent))
import premium_export
import premium_video
import premium_pilot


class MobileAndAnimationGuards(unittest.TestCase):
    def test_mobile_export_preserves_rectangular_size_and_every_alpha_value(self):
        from PIL import Image
        import numpy as np
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            original = Image.new("RGBA", (32, 16), (40, 70, 90, 0))
            for x in range(32):
                for y in range(16):
                    original.putpixel((x, y), (40, 70, 90, x * 8))
            source = root / "source.png"
            candidate = root / "candidate.png"
            original.save(source)
            original.resize((96, 96)).save(candidate)
            metrics = premium_export.export_candidate(source, candidate, root / "mobile.webp")
            result = Image.open(root / "mobile.webp").convert("RGBA")
            self.assertEqual(result.size, original.size)
            self.assertTrue(np.array_equal(np.asarray(result)[:, :, 3], np.asarray(original)[:, :, 3]))
            self.assertTrue(metrics["alphaIdentical"])

    def test_explicit_native_budget_rejects_upscaled_runtime_images(self):
        from PIL import Image
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / "source.png"
            Image.new("RGB", (32, 16), "red").save(source)
            job = {"id": "ground", "input": source.name, "inputSha256": premium_pilot.digest(source),
                   "strength": 0.35, "runtimeSize": [64, 32]}
            path = root / "queue.json"
            path.write_text(json.dumps({"jobs": [job]}))
            with self.assertRaises(ValueError):
                premium_pilot.read_queue(root)
            job["runtimeSize"] = [32, 16]
            path.write_text(json.dumps({"jobs": [job]}))
            self.assertEqual(len(premium_pilot.read_queue(root)["jobs"]), 1)

    def test_animation_identity_and_temporal_budget_are_checked_before_cuda(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "inputs").mkdir()
            source = root / "inputs/ref.png"
            source.write_bytes(b"fixed installed hero reference")
            job = {"id": "legend-walk", "input": "ref.png", "inputSha256": premium_video.sha(source),
                   "frames": 33, "size": [640, 640], "steps": 30, "fps": 24}
            path = root / "queue.json"
            path.write_text(json.dumps({"jobs": [job]}))
            self.assertEqual(len(premium_video.validate(root)["jobs"]), 1)
            job["frames"] = 32
            path.write_text(json.dumps({"jobs": [job]}))
            with self.assertRaises(ValueError):
                premium_video.validate(root)
            job["frames"] = 33
            path.write_text(json.dumps({"jobs": [job]}))
            source.write_bytes(b"a different character")
            with self.assertRaises(ValueError):
                premium_video.validate(root)


if __name__ == "__main__":
    unittest.main()
