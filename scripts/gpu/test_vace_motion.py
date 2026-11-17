"""CPU tests for real control images, timing, alpha, boundaries and failure guards.

These tests deliberately do not claim neural inference or artistic acceptance.
"""
import copy
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent))
import vace_motion as motion
import vace_pack as packing
import vace_stage as staging


class MotionContracts(unittest.TestCase):
    def setUp(self):
        from PIL import Image, ImageDraw
        self.temp = tempfile.TemporaryDirectory()
        self.base = Path(self.temp.name)
        self.repo, self.root = self.base / "repo", self.base / "trial"
        project = self.repo / "ports/godot-pyra"
        (project / "assets").mkdir(parents=True)
        (project / "data").mkdir()
        atlas = Image.new("RGBA", (1600, 200))
        frames = []
        for i in range(8):
            image = Image.new("RGBA", (200, 200))
            ImageDraw.Draw(image).rectangle((80+i,50,120+i,189), fill=(120,20+i*10,10,255))
            atlas.alpha_composite(image, (200*i,0))
            frames.append([200*i,0,200,200,0,0,0,0])
        atlas.save(project / "assets/hero.webp", lossless=True, exact=True)
        actor = {"cell":200,"origin":[0.5,0.95],"size":[133,133],
                 "clips":{"walk":{"fps":16,"loop":True,"sheet":"res://assets/hero.webp",
                                  "directions":{d:frames for d in motion.DIRECTIONS}}}}
        (project / "data/actors.json").write_text(json.dumps({"pyra.hero":actor}))
        self.plan = motion.prepare(self.repo, self.root)

    def tearDown(self):
        self.temp.cleanup()

    def change(self, callback):
        plan = copy.deepcopy(self.plan)
        callback(plan)
        motion.write_json(self.root / "control.json", plan)

    def test_actual_key_images_and_mask_polarity(self):
        video, masks = motion.controls(self.root, motion.validate(self.root))
        self.assertEqual(len(video), 33)
        self.assertEqual(video[0].tobytes(), video[32].tobytes())
        for i in range(33):
            known = i in [0,8,16,24,32]
            self.assertEqual(masks[i].getextrema(), (0,0) if known else (255,255))
            if not known:
                self.assertEqual(video[i].getpixel((0,0)), (128,128,128))

    def test_arm_release_preserves_face_feet_and_loop_endpoints(self):
        root=self.base/"arm-trial"
        plan=motion.prepare(self.repo,root,arm_swing=True)
        _,masks=motion.controls(root,plan)
        for i in [0,32]:self.assertEqual(masks[i].getextrema(),(0,0))
        for i in [8,16,24]:
            self.assertEqual(masks[i].getpixel((260,85)),0)
            self.assertEqual(masks[i].getpixel((260,410)),0)
            self.assertEqual(masks[i].getpixel((290,230)),255)
        plan['motionControl']['rect']=[0,0,512,512]
        motion.write_json(root/'control.json',plan)
        with self.assertRaises(ValueError):motion.validate(root)

    def test_diagonal_uses_its_own_source_frames_and_pack_direction(self):
        root=self.base/"diagonal-trial"
        plan=motion.prepare(self.repo,root,direction="down-right")
        self.assertEqual(plan['direction'],'down-right')
        motion.fixture(root)
        pack=packing.build(root,root/'reference-fixture/result.json',self.base/'diagonal-pack',True)
        self.assertEqual(pack['direction'],'down-right')
        with self.assertRaises(ValueError):motion.prepare(self.repo,self.base/'bad-mask',direction='down',arm_swing=True)

    def test_displayed_reference_respects_source_mirroring(self):
        from PIL import Image, ImageOps
        path=self.repo/"ports/godot-pyra/data/actors.json"
        actor=json.loads(path.read_text())["pyra.hero"]
        original,_=motion.actor_cell(self.repo,actor,"walk","right",0)
        actor["clips"]["walk"]["mirrored"]=["right"]
        mirrored,_=motion.actor_cell(self.repo,actor,"walk","right",0)
        self.assertEqual(mirrored.tobytes(),ImageOps.mirror(original).tobytes())

    def test_budget_and_cycle_duration_are_not_frame_count_dependent(self):
        self.assertEqual(self.plan["export"]["fps"],32)
        self.assertEqual(len(self.plan["export"]["indices"])/self.plan["export"]["fps"],.5)
        self.change(lambda p:p["export"].update(fps=16))
        with self.assertRaises(ValueError): motion.validate(self.root)

    def test_wrong_loop_endpoint_and_excessive_sampler_are_rejected(self):
        self.change(lambda p:p["keys"][-1].update(sourceIndex=6))
        with self.assertRaises(ValueError): motion.validate(self.root)
        self.change(lambda p:p["sampling"].update(maxSeconds=3601))
        with self.assertRaises(ValueError): motion.validate(self.root)

    def test_changed_reference_and_path_escape_are_rejected(self):
        (self.root / self.plan["keys"][0]["file"]).write_bytes(b"a changed outfit")
        with self.assertRaises(ValueError): motion.validate(self.root)
        with self.assertRaises(ValueError): motion.safe_file(self.root,"../outside.png")
        with self.assertRaises(ValueError): motion.output_root(self.repo/"public/installed")

    def test_reference_fixture_cannot_be_promoted_as_gpu_output(self):
        motion.fixture(self.root)
        result = self.root/"reference-fixture/result.json"
        with self.assertRaises(ValueError): motion.verify_result(self.root,result)
        with self.assertRaises(ValueError): packing.build(self.root,result,self.base/"pack")

    def test_full_rgba_round_trip_and_fixed_presentation(self):
        from PIL import Image
        motion.fixture(self.root)
        pack = packing.build(self.root,self.root/"reference-fixture/result.json",self.base/"pack",True)
        self.assertEqual(pack["kind"],"reference-fixture-only")
        self.assertEqual(pack["fps"],32)
        self.assertLessEqual(pack["decodedBytesWithMips"],4*1024*1024)
        with Image.open(self.base/"pack/atlas.webp") as atlas:
            for i, frame in enumerate(pack["frames"]):
                x,y,w,h=frame["rect"]
                with Image.open(self.root/self.plan["source"]["frames"][i//2]["file"]) as original:
                    self.assertEqual(atlas.convert("RGBA").crop((x,y,x+w,y+h)).tobytes(),original.convert("RGBA").tobytes())
        path=self.base/"pack/animation-pack.json"
        pack["origin"]=[.5,.8]
        motion.write_json(path,pack)
        with self.assertRaises(ValueError):packing.validate_pack(path)

    def test_white_matte_retains_enclosed_white_detail(self):
        from PIL import Image, ImageDraw
        image=Image.new("RGB",(100,100),"white")
        draw=ImageDraw.Draw(image)
        draw.rectangle((20,20,80,80),fill="black")
        draw.rectangle((40,40,60,60),fill="white")
        result=packing.white_matte(image)
        self.assertEqual(result.getpixel((0,0))[3],0)
        self.assertEqual(result.getpixel((50,50)),(255,255,255,255))

    def test_rembg_offline_path_matches_the_library_cache_contract(self):
        model=self.base/"matting/isnet-anime.onnx"
        model.parent.mkdir();model.write_bytes(b"Tiny CPU boundary fixture, not a neural model")
        expected=hashlib.md5(model.read_bytes()).hexdigest()
        pooch=types.ModuleType("pooch")
        pooch.retrieve=lambda *a,**kw:self.fail("A network downloader was called")
        def new_session(name,providers):
            self.assertEqual(name,"isnet-anime")
            self.assertEqual(providers,["CPUExecutionProvider"])
            # Real rembg constructs this path instead of using pooch's return.
            registered=Path(os.environ["U2NET_HOME"])/"isnet-anime.onnx"
            self.assertEqual(registered,model)
            self.assertEqual(pooch.retrieve("unused",known_hash="md5:"+expected),str(registered))
            return "local-session"
        rembg=types.ModuleType("rembg");rembg.new_session=new_session
        rembg.remove=lambda image,session:(image,session)
        previous=os.environ.get("U2NET_HOME")
        with patch.dict(sys.modules,{"rembg":rembg,"pooch":pooch}):
            packing.rembg_matter(model)
            model.write_bytes(b"corrupted")
            with self.assertRaisesRegex(ValueError,"checksum mismatch"):packing.rembg_matter(model)
        self.assertEqual(os.environ.get("U2NET_HOME"),previous)

    def test_one_scale_and_ground_anchor_for_whole_clip(self):
        from PIL import Image, ImageDraw
        frames=[]
        for height in [350,360,340]:
            image=Image.new("RGBA",(512,512))
            ImageDraw.Draw(image).rectangle((200,50,300,50+height),fill="red")
            frames.append(image)
        images, diagnostics=packing.normalize(frames,180)
        self.assertEqual(len(images),3)
        self.assertTrue(all(i.size==(200,200) for i in images))
        self.assertTrue(all(i["groundY"]==190 for i in diagnostics["frames"]))
        self.assertEqual(len({round(i.getbbox()[3]) for i in images}),1)

    def receipt(self):
        root=self.base/"model"
        rows=[]
        for name in ["model_index.json","transformer/weight.safetensors","vae/config.json","tokenizer/config.json","text_encoder/config.json"]:
            p=root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b"CPU guard test only")
            rows.append({"file":name,"bytes":p.stat().st_size,"sha256":motion.sha(p)})
        path=self.base/"receipt.json"
        motion.write_json(path,{"repository":motion.MODEL,"revision":motion.REVISION,"files":rows})
        return root,path

    def test_inference_checks_missing_files_without_importing_torch(self):
        root,receipt=self.receipt()
        (root/"transformer/weight.safetensors").unlink()
        with patch.dict(sys.modules,{"torch":None,"diffusers":None}):
            with self.assertRaisesRegex(ValueError,"Missing/incomplete"):
                motion.infer(self.root,root,receipt)
        self.assertFalse((self.root/"inference.lock").exists())

    def test_unavailable_cuda_releases_own_lock_and_records_failure(self):
        root,receipt=self.receipt()
        fake=types.SimpleNamespace(cuda=types.SimpleNamespace(is_available=lambda:False))
        with patch.dict(sys.modules,{"torch":fake}):
            with self.assertRaisesRegex(RuntimeError,"CUDA is required"):
                motion.infer(self.root,root,receipt)
        self.assertFalse((self.root/"inference.lock").exists())
        run=json.loads(next(self.root.glob("generated-*/run.json")).read_text())
        self.assertEqual(run["status"],"failed")
        self.assertFalse(run["gpuInference"])

    def test_existing_work_lock_is_not_removed_or_overwritten(self):
        root,receipt=self.receipt()
        lock=self.root/"inference.lock";lock.write_text("another active job")
        with self.assertRaises(FileExistsError):motion.infer(self.root,root,receipt)
        self.assertEqual(lock.read_text(),"another active job")

    def test_model_stage_preserves_source_and_reuses_verified_cache(self):
        source,receipt=self.receipt()
        cache=self.base/"cache"
        before={str(p.relative_to(source)):motion.sha(p) for p in source.rglob('*') if p.is_file()}
        first=staging.stage(source,cache,receipt,reserve_bytes=0)
        second=staging.stage(source,cache,receipt,reserve_bytes=0)
        self.assertEqual(first["files"],5)
        self.assertEqual(first["bytes"],second["bytes"])
        self.assertEqual(before,{str(p.relative_to(source)):motion.sha(p) for p in source.rglob('*') if p.is_file()})

    def test_model_stage_refuses_corrupted_cache_without_overwriting_it(self):
        source,receipt=self.receipt()
        cache=self.base/"cache";cache.mkdir()
        bad=cache/"model_index.json";bad.write_bytes(b"corrupted cache")
        with self.assertRaises(ValueError):staging.stage(source,cache,receipt,reserve_bytes=0)
        self.assertEqual(bad.read_bytes(),b"corrupted cache")
        self.assertFalse((cache/".stage.lock").exists())

    def test_model_stage_checks_space_before_copying_weights(self):
        source,receipt=self.receipt()
        with patch("vace_stage.shutil.disk_usage",return_value=types.SimpleNamespace(free=0)):
            with self.assertRaisesRegex(ValueError,"Insufficient local disk"):
                staging.stage(source,self.base/"cache",receipt,reserve_bytes=0)
        self.assertFalse((self.base/"cache/transformer/weight.safetensors").exists())


if __name__ == "__main__":
    unittest.main()
