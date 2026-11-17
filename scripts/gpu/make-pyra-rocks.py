"""Run with Blender --background --python. Four original low-poly basalt meshes; no external model input."""
import bpy, random, math
from pathlib import Path
from mathutils import noise, Vector
out=Path('/workspace/ki-terrain3d/project/models');out.mkdir(parents=True,exist_ok=True)
for index in range(4):
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1)
    obj=bpy.context.object;obj.name='PyraBasalt'+str(index)
    rng=random.Random(17112026+index)
    for v in obj.data.vertices:
        q=v.co.copy();factor=1+0.30*noise.noise(q*2.7+Vector((index,index*.7,index*.4)))
        v.co.x*=factor*(1+index*.12);v.co.y*=factor;v.co.z*=factor*.7
        v.co.z+=rng.uniform(-.04,.04)
    bottom=min(v.co.z for v in obj.data.vertices)
    for v in obj.data.vertices:v.co.z-=bottom
    for p in obj.data.polygons:p.use_smooth=False
    bpy.ops.export_scene.gltf(filepath=str(out/('rock-%d.glb'%index)),export_format='GLB',export_materials='NONE',use_selection=True)
    print('PYRA_ROCK',index,len(obj.data.polygons))
