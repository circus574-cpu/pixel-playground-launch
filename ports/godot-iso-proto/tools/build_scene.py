"""Zielona Przystań: isometric 2D prototype assets, built from independent resources (not from the concept illustration).
Run in Blender (4.x) on the GPU pod:
  blender -b -P build_scene.py -- --out /workspace/iso-proto/out [--res 2400] [--samples 48] [--only terrain,objects]
Output: terrain.png (ground + river bed, no objects), one transparent PNG per prototype object, scene.json (placements, sprite offsets,
footprints and blocked areas in screen pixels). The camera is orthographic, yaw 45, elevation 30 (same contract as ki-iso-art2)."""
import bpy, bmesh, sys, json, math, random, argparse
from pathlib import Path
from mathutils import Vector, Euler
from bpy_extras.object_utils import world_to_camera_view
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("--out", required=True); ap.add_argument("--res", type=int, default=2400)
ap.add_argument("--samples", type=int, default=48); ap.add_argument("--only", default="terrain,objects")
args = ap.parse_args(sys.argv[sys.argv.index("--") + 1:])
OUT = Path(args.out); OUT.mkdir(parents=True, exist_ok=True)
RNG = random.Random(7); NP = np.random.default_rng(7)
W, H = 84.0, 56.0          # world size in metres (x east, y north), centre at 0,0
RES_X = args.res; RES_Y = int(args.res * 0.62)
CAM_YAW, CAM_ELEV = 45.0, 30.0

def lin(h): return tuple(((int(h[i:i+2], 16) / 255) / 12.92 if int(h[i:i+2], 16) / 255 <= .04045 else (((int(h[i:i+2], 16) / 255) + .055) / 1.055) ** 2.4) for i in (0, 2, 4))
def mat(name, color, rough=.8, emit=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*lin(color), 1); b.inputs["Roughness"].default_value = rough
    if emit: b.inputs["Emission Color"].default_value = (*lin(color), 1); b.inputs["Emission Strength"].default_value = emit
    return m
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    global M
    scn = bpy.context.scene
    scn.render.engine = "CYCLES"; scn.cycles.samples = args.samples; scn.cycles.use_denoising = False
    scn.cycles.device = "CPU"
    scn.render.resolution_x = RES_X; scn.render.resolution_y = RES_Y; scn.render.film_transparent = True
    scn.render.image_settings.file_format = "PNG"; scn.render.image_settings.color_mode = "RGBA"
    scn.view_settings.view_transform = "Standard"
    w = bpy.data.worlds.new("w"); w.use_nodes = True; scn.world = w
    w.node_tree.nodes["Background"].inputs[0].default_value = (.55, .62, .75, 1); w.node_tree.nodes["Background"].inputs[1].default_value = .5
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); sun.data.energy = 3.4; sun.data.angle = math.radians(10)
    sun.rotation_euler = Euler((math.radians(52), 0, math.radians(-125)), "XYZ"); scn.collection.objects.link(sun)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); cam.data.type = "ORTHO"; cam.data.ortho_scale = 104.0
    cam.data.clip_start = 1; cam.data.clip_end = 600
    scn.collection.objects.link(cam); scn.camera = cam
    d = 200.0; e = math.radians(CAM_ELEV); y = math.radians(CAM_YAW)
    cam.location = (d * math.cos(e) * math.sin(y), -d * math.cos(e) * math.cos(y), d * math.sin(e) + 1)
    cam.rotation_euler = Euler((math.radians(90 - CAM_ELEV), 0, y), "XYZ")
    scn.render.use_freestyle = False   # ink outlines are added to the sprites in post (alpha dilation), see crop_png
    return scn, cam
scn, cam = reset()
def make_materials():
    global M
    M = {k: mat(k, v[0], v[1]) for k, v in {
        "plaster": ("c9b28f", .9), "plaster2": ("b8a07c", .9), "timber": ("4a2c1c", .85), "roofg": ("3f5a4a", .8), "roofr": ("7a3a2a", .8), "roofdark": ("34402f", .85),
        "thatch": ("5d7a34", 1.0), "stone": ("7d7d78", .95), "stone2": ("6a6a68", .95), "wood": ("6b4a2c", .9), "wood2": ("8a6a42", .9), "bark": ("4b3524", 1),
        "pine": ("1f4a2c", 1), "pine2": ("2a5c33", 1), "oak": ("3d7a2e", 1), "oak2": ("56922f", 1), "fruit": ("4f9a3a", 1), "canvasA": ("d9c9a0", .95), "canvasB": ("b4442f", .95),
        "canvasC": ("d2a23a", .95), "canvasD": ("4f6fa8", .95), "rock": ("77808a", .95), "dark": ("2a2420", .9), "sail": ("e8dcc0", .95), "hull": ("5a3b24", .9), "crate": ("8b6a3e", .9),
        "lantern": ("ffb347", .5)}.items()}
    M["lantern"].node_tree.nodes["Principled BSDF"].inputs["Emission Color"].default_value = (1, .7, .25, 1); M["lantern"].node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = 6
make_materials()

def project(p):
    """world (x, y, z) -> screen pixels (y down)"""
    v = world_to_camera_view(scn, cam, Vector(p))
    return [round(v.x * RES_X, 1), round((1 - v.y) * RES_Y, 1)]

# ---------------------------------------------------------------- terrain -------------------------------------------------------------
def river_cx(y): return 4.0 * math.sin(y * 0.11) + 1.5 * math.sin(y * 0.31 + 1.0) - 0.0
def river_half(y): return 7.5 + 1.5 * math.sin(y * 0.17 + 2.0) + (1.0 if y > 14 else 0)
BRIDGE_Y = (8.0, 12.5)     # the main bridge deck crosses the river here
def smooth(a, b, x): t = min(1, max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t)
def hnoise(x, y):
    return (math.sin(x * .13 + 1.7) * math.cos(y * .11 + .4) * 1.0 + math.sin(x * .31 + y * .23) * .45 + math.sin(x * .07 - y * .19 + 2.1) * .8) * .5
def height(x, y):
    d = x - river_cx(y); hw = river_half(y); a = abs(d)
    bank = smooth(hw - .6, hw + 1.2, a)
    h_left = .35 + smooth(-26, -42, x) * 5.5 + max(0, hnoise(x, y)) * .8 * smooth(-18, -34, x)
    h_right = .5 + smooth(14, 36, x) * 4.2 + max(0, hnoise(x, y)) * .7 * smooth(12, 32, x)
    side = h_left if d < 0 else h_right
    if d > 0 and 16 < x < 30 and -18 < y < 12:      # orchard terraces
        t = (x - 14) / 5.0; side = .6 + (math.floor(t) + smooth(.8, 1.0, t - math.floor(t))) * .7
    cliff = smooth(20, 30, y) * (2.6 + 2.4 * abs(hnoise(x * 1.3, y * 1.3)))   # rocky back wall
    bed = -1.4 + (a / hw) ** 2 * 1.2
    h = bed * (1 - bank) + (side + cliff * (1 if abs(x) > 4 else .5)) * bank
    # outer mountains
    far = smooth(-6, 26, -(x - y) * 0.7)          # the camera looks from +x,-y: far sides get mountains, near sides only foothills
    ring = smooth(40, 60, max(abs(x) * 1.0, abs(y) * 1.4)) * (4 + 11 * far)
    return h + ring * (0.45 + 0.55 * abs(hnoise(x * .8, y * .8)) * 2) * (0.25 + 0.75 * bank)
def terrain_colors(x, y, h, slope):
    d = x - river_cx(y); a = abs(d); hw = river_half(y)
    if a < hw - .3:        # water
        depth = max(0.0, min(1.0, (hw - a) / hw))
        base = np.array([.30, .78, .82]) * (.75 + .25 * (1 - depth)) + np.array([.0, .0, .05])
        foam = max(0, 1 - abs(a - (hw - .9)) / .5) * .55 + max(0, math.sin(y * .9 + x * .35 + math.sin(y * .3) * 2) - .85) * 1.2
        return np.clip(base + foam * .6, 0, 1)
    if slope > .95 or h > 9: return np.array([.42, .44, .5]) * (.88 + .16 * math.sin(x * .9 + y * .5) * math.cos(y * 1.3 - x * .4))
    if a < hw + 1.2: return np.array([.78, .72, .55])       # sand and mud banks
    plaza = (d < 0 and -26 < x < -9 and -20 < y < 14)
    road = (d < 0 and abs(y - (-4 + 0.18 * (x + 15))) < 1.7 and x > -34) or (d < 0 and abs(x + 14) < 1.5 and -22 < y < 22) or (d > 0 and abs(y - 2) < 1.2 and 9 < x < 36)
    if plaza or road: return np.array([.64, .53, .38]) * (.93 + .07 * math.sin(x * .6 + y * .4) * math.cos(y * .5 - x * .3))
    if h > 4.4 and slope > .5: return np.array([.5, .5, .5])
    g = .5 + .22 * math.sin(x * .45 + y * .33) * math.cos(y * .27 - x * .2) + .1 * math.sin(x * 1.3 + y * 0.9)
    return np.array([.20 + g * .12, .36 + g * .2, .15]) if h < 3 else np.array([.26 + g * .1, .42 + g * .16, .18])
def build_terrain():
    nx, ny = 520, 400
    xs = np.linspace(-W / 2 - 30, W / 2 + 40, nx); ys = np.linspace(-H / 2 - 40, H / 2 + 24, ny)
    Z = np.array([[height(x, y) for x in xs] for y in ys])
    gy, gx = np.gradient(Z, ys[1] - ys[0], xs[1] - xs[0]); slope = np.hypot(gx, gy)
    me = bpy.data.meshes.new("terrain"); ob = bpy.data.objects.new("terrain", me); scn.collection.objects.link(ob)
    bm = bmesh.new(); vs = [[bm.verts.new((xs[i], ys[j], Z[j, i])) for i in range(nx)] for j in range(ny)]
    for j in range(ny - 1):
        for i in range(nx - 1): bm.faces.new((vs[j][i], vs[j][i + 1], vs[j + 1][i + 1], vs[j + 1][i])).smooth = True
    bm.to_mesh(me); bm.free()
    col = me.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
    for j in range(ny):
        for i in range(nx):
            c = terrain_colors(xs[i], ys[j], Z[j, i], slope[j, i]); col.data[j * nx + i].color = (*(c ** 2.2), 1)
    m = bpy.data.materials.new("ground"); m.use_nodes = True; nt = m.node_tree
    a = nt.nodes.new("ShaderNodeVertexColor"); a.layer_name = "Col"; b = nt.nodes["Principled BSDF"]
    nt.links.new(a.outputs[0], b.inputs["Base Color"]); b.inputs["Roughness"].default_value = .9
    me.materials.append(m)
    return ob, (xs, ys, Z)

# ---------------------------------------------------------------- object kit ------------------------------------------------------------
def collect(objs, name):
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1: bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active; o.name = name; bpy.ops.object.select_all(action="DESELECT"); return o
def box(name, size, loc, material, rot=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc); o = bpy.context.active_object; o.scale = size; o.rotation_euler[2] = rot
    bpy.ops.object.transform_apply(scale=True, rotation=True); o.data.materials.append(M[material]); return o
def cyl(r, h, loc, material, verts=12, r2=None):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r if r2 is None else r2, depth=h, location=loc); o = bpy.context.active_object
    o.data.materials.append(M[material]); return o
def sphere(r, loc, material, scale=(1, 1, 1), seg=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2 + 1, radius=r, location=loc); o = bpy.context.active_object; o.scale = scale
    bpy.ops.object.transform_apply(scale=True); o.data.materials.append(M[material]); return o
def gable(name, w, d, h, loc, material, overhang=.5):
    """gabled roof, ridge along y; w across x"""
    me = bpy.data.meshes.new(name); ob = bpy.data.objects.new(name, me); scn.collection.objects.link(ob)
    hw = w / 2 + overhang; hd = d / 2 + overhang
    v = [(-hw, -hd, 0), (hw, -hd, 0), (hw, hd, 0), (-hw, hd, 0), (0, -hd, h), (0, hd, h)]
    f = [(0, 1, 4), (2, 3, 5), (1, 2, 5, 4), (3, 0, 4, 5), (0, 3, 2, 1)]
    me.from_pydata(v, [], f); me.update(); ob.location = loc; ob.data.materials.append(M[material]); return ob
def timber_house(name, w, d, floors, roof="roofg", wall="plaster", beams=True, chimney=True, porch=False):
    parts = []; fh = 2.5
    parts.append(box("b", (w, d, fh * floors), (0, 0, fh * floors / 2), wall))
    if beams:
        for k in range(floors + 1): parts.append(box("be", (w + .1, d + .1, .22), (0, 0, k * fh + .11), "timber"))
        for xx in np.linspace(-w / 2, w / 2, int(w // 2) + 2): parts.append(box("p", (.2, d + .12, fh * floors), (xx, 0, fh * floors / 2), "timber"))
        for yy in (-d / 2, d / 2):
            parts.append(box("w", (.9, .08, 1.0), (-w / 4, yy + (.05 if yy > 0 else -.05), 1.4), "dark")); parts.append(box("w", (.9, .08, 1.0), (w / 4, yy + (.05 if yy > 0 else -.05), 1.4), "dark"))
    parts.append(gable("r", w, d, 1.9 + .25 * w / 4, (0, 0, fh * floors), roof))
    if chimney: parts.append(box("c", (.6, .6, 2.4), (w / 3, d / 4, fh * floors + 1.6), "stone2"))
    if porch: parts.append(box("pt", (w * .5, 1.4, .25), (0, -d / 2 - .7, .125), "wood2"))
    o = collect(parts, name); return o, (w + 1.2, d + 1.2)
def mossy_house(name, w, d):
    parts = [box("b", (w, d, 2.3), (0, 0, 1.15), "stone"), box("bt", (w + .1, d + .1, .4), (0, 0, .2), "stone2"),
             box("dr", (.9, .1, 1.5), (0, -d / 2 - .02, .75), "timber"), box("w", (.8, .1, .8), (-w / 3, -d / 2 - .02, 1.4), "dark"),
             gable("r", w, d, 2.1, (0, 0, 2.3), "thatch", .7), cyl(.45, 2.8, (w / 3, d / 4, 3.7), "stone2", 8)]
    return collect(parts, name), (w + 1.6, d + 1.6)
def forge(name):
    parts = [box("b", (7, 5, 2.8), (0, 0, 1.4), "stone2"), gable("r", 7, 5, 2.4, (0, 0, 2.8), "roofdark", .6), cyl(.7, 7, (2.5, 1.5, 4.5), "stone", 8, .55), cyl(.6, 5.5, (-1.5, 1.8, 3.8), "stone", 8, .5),
             box("o", (1.6, 1.0, 1.0), (-4, 0, .5), "dark"), box("a", (.8, .5, .7), (-3.2, -2.9, .35), "stone")]
    return collect(parts, name), (8.5, 6.5)
def bridge(name):
    L = 17.0; parts = [box("deck", (L, 4.6, .55), (0, 0, 1.9), "stone"), box("deck2", (L - 1, 3.8, .12), (0, 0, 2.25), "wood2")]
    for k, xx in enumerate((-5.5, 0, 5.5)): parts.append(box("pier", (1.8, 4.6, 3.3), (xx, 0, 0.35), "stone2"))
    for k in range(2):
        for xx in (-L / 2 + .6, L / 2 - .6, -3, 3): parts.append(box("post", (.45, .45, 3.6), (xx, (-1 if k == 0 else 1) * 2.0, 4.0), "timber"))
        parts.append(box("beam", (L - .5, .4, .35), (0, (-1 if k == 0 else 1) * 2.0, 5.9), "timber"))
    parts.append(gable("roof", 4.8, L - .4, 1.8, (0, 0, 5.9), "roofdark", .5)); roof = parts[-1]; roof.rotation_euler[2] = math.radians(90)
    for xx in (-L / 2, L / 2): parts.append(box("abut", (2.4, 5.4, 2.4), (xx, 0, 1.2), "stone2"))
    return collect(parts, name), (L + 2, 5.4)
def dock(name, L=14.0):
    parts = [box("deck", (L, 3.0, .25), (0, 0, .7), "wood2")]
    for k in range(int(L // 1.4) + 1):
        xx = -L / 2 + k * 1.4
        for yy in (-1.4, 1.4): parts.append(cyl(.16, 2.0, (xx, yy, .1), "bark", 6))
    for k in range(int(L // .5)): parts.append(box("pl", (.04, 3.0, .27), (-L / 2 + k * .5, 0, .72), "wood"))
    parts.append(box("shed", (3.2, 2.6, 2.0), (-L / 2 + 2.2, 0, 1.9), "wood")); parts.append(gable("shr", 3.2, 2.6, 1.2, (-L / 2 + 2.2, 0, 2.9), "roofdark", .3))
    return collect(parts, name), (L, 3.0)
def boat(name, big=False):
    s = 1.3 if big else 1.0; parts = []
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=1, location=(0, 0, .35)); h = bpy.context.active_object; h.scale = (3.2 * s, 1.1 * s, .55); bpy.ops.object.transform_apply(scale=True); h.data.materials.append(M["hull"]); parts.append(h)
    parts.append(cyl(.09, 5.0 * s, (0, 0, 2.5 * s), "bark", 6)); parts.append(box("sail", (.05, 1.9 * s, 3.0 * s), (.2, 0, 3.1 * s), "sail")); parts.append(box("dk", (4.4 * s, 1.5 * s, .08), (0, 0, .55), "wood2"))
    return collect(parts, name), (6.4 * s, 2.4 * s)
def tent(name, mname, w=3.2):
    parts = [box("t", (w, w, .12), (0, 0, .06), "wood")] + [cyl(.1, 2.6, (sx * w / 2, sy * w / 2, 1.3), "bark", 6) for sx in (-1, 1) for sy in (-1, 1)]
    parts.append(cyl(w * .82, 1.2, (0, 0, 2.7), mname, 4)); parts[-1].rotation_euler[2] = math.radians(45)
    parts += [box("c", (.8, .8, .8), (w * .3, -w * .2, .5), "crate"), box("c2", (.6, .6, .6), (-w * .3, w * .2, .4), "crate")]
    return collect(parts, name), (w + .4, w + .4)
def pine(name, s=1.0):
    parts = [cyl(.28 * s, 2.2 * s, (0, 0, 1.1 * s), "bark", 6)]
    for k in range(5): parts.append(cyl((2.0 - k * .33) * s, 2.0 * s, (0, 0, (1.6 + k * 1.1) * s), "pine" if k % 2 else "pine2", 9, .05))
    return collect(parts, name), (1.6 * s, 1.6 * s)
def oak(name, s=1.0):
    parts = [cyl(.35 * s, 2.6 * s, (0, 0, 1.3 * s), "bark", 6)]
    for dx, dy, dz, r in [(0, 0, 3.6, 2.0), (1.1, .4, 3.2, 1.4), (-1.0, -.5, 3.3, 1.5), (.2, 1.0, 4.4, 1.3)]: parts.append(sphere(r * s, (dx * s, dy * s, dz * s), "oak2" if dz > 3.3 else "oak", seg=9))
    return collect(parts, name), (1.8 * s, 1.8 * s)
def fruit(name):
    parts = [cyl(.15, 1.2, (0, 0, .6), "bark", 6), sphere(1.0, (0, 0, 1.8), "fruit", (1, 1, .9), 9)]
    return collect(parts, name), (1.4, 1.4)
def rock(name, s=1.0):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1 * s, location=(0, 0, .6 * s)); o = bpy.context.active_object; o.scale = (1.4, 1.0, .8)
    bpy.ops.object.transform_apply(scale=True)
    for v in o.data.vertices: v.co += Vector((RNG.uniform(-.18, .18), RNG.uniform(-.18, .18), RNG.uniform(-.12, .12))) * s
    o.data.materials.append(M["rock"]); return o, (2.4 * s, 1.7 * s)
def crate_stack(name):
    parts = [box("a", (.9, .9, .9), (0, 0, .45), "crate"), box("b", (.9, .9, .9), (1.0, .2, .45), "crate"), box("c", (.8, .8, .8), (.4, .1, 1.3), "crate")]
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=.4, depth=.9, location=(-1.0, .3, .45)); b = bpy.context.active_object; b.data.materials.append(M["wood"]); parts.append(b)
    return collect(parts, name), (3.0, 1.6)
def fence(name):
    parts = []
    for k in range(5): parts.append(box("p", (.14, .14, 1.1), (-2 + k, 0, .55), "wood"))
    parts += [box("r", (4.2, .08, .1), (0, 0, .85), "wood2"), box("r2", (4.2, .08, .1), (0, 0, .45), "wood2")]
    return collect(parts, name), (4.2, .4)
def lamp(name):
    parts = [cyl(.08, 2.4, (0, 0, 1.2), "dark", 6), sphere(.26, (0, 0, 2.55), "lantern", seg=8)]; return collect(parts, name), (.5, .5)
def tower(name):
    parts = [cyl(1.8, 5, (0, 0, 2.5), "stone", 10), cyl(2.3, 2.2, (0, 0, 6.1), "roofdark", 10, .1)]; return collect(parts, name), (4, 4)
PROTOS = {
    "house_a": lambda: timber_house("house_a", 6, 5, 2, "roofg"), "house_b": lambda: timber_house("house_b", 7.5, 5.5, 2, "roofr", "plaster2"),
    "house_c": lambda: timber_house("house_c", 5, 4.5, 1, "roofg", "plaster", porch=True), "house_d": lambda: timber_house("house_d", 6.5, 5, 3, "roofdark", "plaster2"),
    "house_moss_a": lambda: mossy_house("house_moss_a", 5.5, 4.5), "house_moss_b": lambda: mossy_house("house_moss_b", 4.5, 4.0), "forge": lambda: forge("forge"),
    "bridge": lambda: bridge("bridge"), "dock": lambda: dock("dock", 15.0), "boat_a": lambda: boat("boat_a"), "boat_b": lambda: boat("boat_b", True),
    "tent_a": lambda: tent("tent_a", "canvasA"), "tent_b": lambda: tent("tent_b", "canvasB"), "tent_c": lambda: tent("tent_c", "canvasC"), "tent_d": lambda: tent("tent_d", "canvasD"),
    "pine_l": lambda: pine("pine_l", 1.3), "pine_s": lambda: pine("pine_s", .85), "oak_l": lambda: oak("oak_l", 1.2), "oak_s": lambda: oak("oak_s", .8), "fruit": lambda: fruit("fruit"),
    "rock_l": lambda: rock("rock_l", 1.6), "rock_s": lambda: rock("rock_s", .8), "crates": lambda: crate_stack("crates"), "fence": lambda: fence("fence"), "lamp": lambda: lamp("lamp"), "tower": lambda: tower("tower")}

# ---------------------------------------------------------------- layout ------------------------------------------------------------------
def layout(Zfun):
    P = []     # (proto, x, y, rot_deg)
    def add(p, x, y, r=0): P.append({"proto": p, "x": round(x, 2), "y": round(y, 2), "rot": r})
    cx = river_cx
    # forge district, top left
    add("forge", -33, 14, 0); add("house_d", -27, 18, 0); add("house_b", -38, 6, 0); add("tower", -41, 19)
    # market square and street houses, left bank
    for i, (x, y, p) in enumerate([(-30, 2, "house_a"), (-21, 12, "house_b"), (-24, -12, "house_c"), (-31, -9, "house_d"), (-36, -17, "house_a"), (-19, -19, "house_b"), (-12, 17, "house_c"), (-17, 21, "house_d")]): add(p, x, y)
    for i, (x, y, p) in enumerate([(-17, 2, "tent_a"), (-13, -3, "tent_b"), (-18, -4, "tent_c"), (-12.5, 3.5, "tent_d"), (-21, 0.5, "tent_b"), (-16, 7, "tent_c")]): add(p, x, y, RNG.choice([0, 90]))
    add("crates", -10.5, -8); add("crates", -20, -8.5, 90); add("lamp", -14, 0.2); add("lamp", -23, -4); add("lamp", -14, 9); add("lamp", -9, 14)
    # harbour: docks and boats on the left bank edge of the river (river centre is cx(y))
    add("dock", cx(-12) - 12.2, -12, 0); add("dock", cx(-20) - 11.4, -20, 0); add("boat_a", cx(-12) - 3, -14.5, 5); add("boat_b", cx(-12) - 2, -9.5, -4); add("boat_a", cx(-3) + 3, -2, 10); add("boat_b", cx(-3) + 1, -22, 0)
    # bridge: crosses at y = 8..12.5, the deck runs along x
    add("bridge", cx(10.25), 10.25, 0)
    # right bank: garden houses, orchard, fences
    for x, y, p in [(18, 14, "house_moss_a"), (24, 8, "house_moss_b"), (30, 14, "house_moss_a"), (21, 22, "house_moss_b"), (34, 4, "house_moss_a"), (15, 3, "house_moss_b")]: add(p, x, y, 0)
    for i in range(18):
        ox = 17 + (i % 6) * 3.0; oy = -16 + (i // 6) * 3.6
        add("fruit", ox + RNG.uniform(-.3, .3), oy + RNG.uniform(-.3, .3))
    for k in range(5): add("fence", 15 + k * 4.2, -9.5, 0)
    for k in range(5): add("fence", 15 + k * 4.2, -19.5, 0)
    # trees and rocks (scatter with minimum distance, avoiding buildings, the river and the paths)
    taken = [(p["x"], p["y"], 4.2) for p in P if p["proto"] not in ("fence", "lamp")]
    def free(x, y, r):
        d = x - cx(y)
        if abs(d) < river_half(y) + 2.2: return False
        if -27 < x < -8 and -22 < y < 16: return False
        if abs(x + 14) < 2.2: return False
        if d > 0 and 12 < x < 38 and -22 < y < 8: return False
        return all((x - tx) ** 2 + (y - ty) ** 2 > (tr + r) ** 2 for tx, ty, tr in taken)
    for i in range(520):
        x = RNG.uniform(-W / 2 - 6, W / 2 + 6); y = RNG.uniform(-H / 2 - 6, H / 2 + 8)
        z = Zfun(x, y)
        if z > 7.5: continue
        kind = RNG.choice(["pine_l", "pine_s", "pine_s", "oak_l", "oak_s", "rock_s", "rock_l"] if (abs(x) > 30 or y > 22) else ["oak_s", "oak_l", "pine_s", "rock_s", "oak_s"])
        r = 2.2 if "rock" not in kind else 1.8
        if free(x, y, r): P.append({"proto": kind, "x": round(x, 2), "y": round(y, 2), "rot": RNG.choice([0, 90, 180])}); taken.append((x, y, r))
    return P

# ---------------------------------------------------------------- render ------------------------------------------------------------------
def render(path):
    scn.render.filepath = str(path); bpy.ops.render.render(write_still=True)
def alpha_bbox(path):
    img = bpy.data.images.load(str(path)); w, h = img.size; px = np.array(img.pixels[:]).reshape(h, w, 4); bpy.data.images.remove(img)
    a = px[:, :, 3] > .02; ys, xs = np.where(a)
    if len(xs) == 0: return None
    return int(xs.min()), int(h - 1 - ys.max()), int(xs.max()) + 1, int(h - ys.min())     # x0, y0, x1, y1 with y down
def crop_png(path, box):
    import numpy as np
    img = bpy.data.images.load(str(path)); w, h = img.size; px = np.array(img.pixels[:]).reshape(h, w, 4)
    x0, y0, x1, y1 = box; sub = px[h - y1:h - y0, x0:x1, :].copy(); bpy.data.images.remove(img)
    pad = 3; sub = np.pad(sub, ((pad, pad), (pad, pad), (0, 0)))
    a = sub[:, :, 3] > .05; grow = a.copy()
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            if dx * dx + dy * dy <= 5: grow |= np.roll(np.roll(a, dy, 0), dx, 1)
    edge = grow & ~a; sub[edge] = (.06, .04, .04, 1.0)
    out = bpy.data.images.new("c", x1 - x0 + 6, y1 - y0 + 6, alpha=True); out.pixels = sub.flatten().tolist(); out.filepath_raw = str(path); out.file_format = "PNG"; out.save(); bpy.data.images.remove(out)

only = args.only.split(",")
info = {"res": [RES_X, RES_Y], "world": [W, H], "camera": {"yaw": CAM_YAW, "elev": CAM_ELEV, "ortho": 104.0}, "river": {"bridge_y": BRIDGE_Y}}
ground, (xs, ys, Z) = build_terrain()
def zfun(x, y): return height(x, y)
if "terrain" in only:
    render(OUT / "terrain.png")
placements = layout(zfun)
if "objects" in only:
    ground.hide_render = True
    protos = sorted({p["proto"] for p in placements}); sprites = {}
    for name in protos:
        obj, foot = PROTOS[name]()
        obj.location = (0, 0, 0)
        for o in bpy.context.scene.objects:
            if o.type == "MESH": o.select_set(False)
        # ground contact shadow disc so sprites are not floating
        path = OUT / f"obj_{name}.png"; render(path); bb = alpha_bbox(path)
        if bb is None: print("empty", name); continue
        crop_png(path, bb)
        sprites[name] = {"file": f"obj_{name}.png", "box": [bb[0] - 3, bb[1] - 3, bb[2] + 3, bb[3] + 3], "origin": project((0, 0, 0)), "foot": foot}
        bpy.data.objects.remove(obj, do_unlink=True)
    info["sprites"] = sprites
placed = []
for p in placements:
    z = height(p["x"], p["y"]) if p["proto"] not in ("bridge", "dock", "boat_a", "boat_b") else (0.0 if p["proto"].startswith("boat") else (0.0 if p["proto"] == "dock" else 0.0))
    if p["proto"] == "bridge": z = max(height(p["x"] - 11, 10.25), height(p["x"] + 11, 10.25)) - 1.9 + 0.35
    scr = project((p["x"], p["y"], z)); p["z"] = round(z, 2); p["screen"] = scr; p["depth"] = round(p["x"] + (-p["y"]) * 1.0, 2) * 0 + round(-(p["y"]) + (p["x"]) * 0, 2)
    placed.append(p)
info["placements"] = placed
# river geometry for collisions (screen pixels): water strips split at the bridge
def strip(y0, y1, n=14):
    ysamp = np.linspace(y0, y1, n); L = [project((river_cx(y) - river_half(y) + .6, y, 0)) for y in ysamp]; R = [project((river_cx(y) + river_half(y) - .6, y, 0)) for y in ysamp]
    return L + R[::-1]
info["water"] = [strip(-H / 2 - 12, BRIDGE_Y[0], 20), strip(BRIDGE_Y[1], H / 2 + 14, 16)]
info["start"] = project((-15.5, -1.0, height(-15.5, -1.0)))
info["bounds"] = [project((-W / 2 + 2, -H / 2 + 2, 0)), project((W / 2 - 2, -H / 2 + 2, 0)), project((W / 2 - 2, H / 2 - 2, 0)), project((-W / 2 + 2, H / 2 - 2, 0))]
(OUT / "scene.json").write_text(json.dumps(info))
print("DONE", len(placements), "placements")
