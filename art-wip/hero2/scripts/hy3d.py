import sys, os, math, numpy as np
os.environ["PYOPENGL_PLATFORM"] = "egl"
from PIL import Image
race = sys.argv[1]; base = f"/workspace/hero2/{race}"; out = f"{base}/3d"; os.makedirs(out, exist_ok=True)
img = Image.open(f"{base}/final/cut-birefnet-general.png").convert("RGBA")
img = img.crop(img.getbbox())
sq = max(img.size); canvas = Image.new("RGBA", (sq, sq), (0, 0, 0, 0)); canvas.paste(img, ((sq - img.width) // 2, (sq - img.height) // 2)); img = canvas
from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline, FloaterRemover, DegenerateFaceRemover, FaceReducer
from hy3dgen.texgen import Hunyuan3DPaintPipeline
sp = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained("/root/m/Hunyuan3D-2")
mesh = sp(image=img, num_inference_steps=50, octree_resolution=380, generator=__import__("torch").manual_seed(1))[0]
pass  # pymeshlab cleanup unavailable here
mesh.export(f"{out}/shape.glb"); print("SHAPE_DONE", flush=True)
del sp; __import__("torch").cuda.empty_cache()
tp = Hunyuan3DPaintPipeline.from_pretrained("/root/m/Hunyuan3D-2")
mesh = tp(mesh, image=img); mesh.export(f"{out}/{race}.glb"); print("TEX_DONE", flush=True)
import trimesh, pyrender
scene_mesh = trimesh.load(f"{out}/{race}.glb", force="mesh")
scene_mesh.apply_translation(-scene_mesh.bounds.mean(0)); s = 1.8 / scene_mesh.extents.max(); scene_mesh.apply_scale(s)
pm = pyrender.Mesh.from_trimesh(scene_mesh, smooth=False)
r = pyrender.OffscreenRenderer(512, 640)
views = []
for k in range(8):
    sc = pyrender.Scene(bg_color=[0.27, 0.35, 0.24, 1], ambient_light=[0.9, 0.9, 0.9])
    a = 2 * math.pi * k / 8
    rot = trimesh.transformations.rotation_matrix(a, [0, 1, 0])
    sc.add(pm, pose=rot)
    cam = pyrender.OrthographicCamera(xmag=0.75, ymag=0.95)
    cp = np.eye(4); cp[2, 3] = 3; sc.add(cam, pose=cp)
    sc.add(pyrender.DirectionalLight(intensity=2.0), pose=cp)
    col, _ = r.render(sc); views.append(Image.fromarray(col))
sheet = Image.new("RGB", (512 * 4, 640 * 2))
for k, v in enumerate(views): sheet.paste(v, ((k % 4) * 512, (k // 4) * 640))
sheet.save(f"{out}/turntable.jpg", quality=85); print("RENDER_DONE", flush=True)
