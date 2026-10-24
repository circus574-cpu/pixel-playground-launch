"""Planet-generation and independent combat-pass invariants."""
import copy,json,os,tempfile,unittest
from pathlib import Path
import numpy as np
from scipy import ndimage
from generate import canonical,digest
from planet_generate import geometry,mask_polygon,build,maze,validate,generate
from spawn_generate import placement,validate as validate_spawns,verify_region

class PlanetTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.context=json.loads(Path(os.environ.get('KI_WORLDGEN_CONTEXT',str(Path(__file__).with_name('context.json')))).read_text())
  cls.plan,cls.arrays,cls.objects,cls.report=build(cls.context,'island-1',5746036)
  cls.plan['spawnAffinities']=cls.context['planet']['islandEdges']['island-1']

 def test_all_ten_canonical_shapes_and_true_scale(self):
  self.assertEqual(len(self.context['planet']['features']),10)
  for feature in self.context['planet']['features']:
   g,land=geometry(self.context,feature,32);source=self.context['coastlines'][feature];scale=self.context['planet']['scale']*self.context['planet']['unitsPerMapUnit']
   self.assertEqual(len(source),len(g['outline']));self.assertTrue(land.any())
   for (x,y),(sx,sy)in zip(g['outline'],source):
    self.assertAlmostEqual(x/scale+g['sourceOrigin']['x'],sx,9);self.assertAlmostEqual(y/scale+g['sourceOrigin']['y'],sy,9)
   f=self.context['planet']['features'][feature]
   self.assertAlmostEqual(g['anchor']['x']/scale+g['sourceOrigin']['x'],f['source']['x'],9)

 def test_polygon_scanline_does_not_fill_sea_or_concavity(self):
  polygon=[[0,0],[128,0],[128,32],[32,32],[32,128],[0,128]]
  m=mask_polygon(polygon,(4,4),32);self.assertEqual(int(m.sum()),7);self.assertFalse(m[2,2])

 def test_paths_locations_and_services_reachable(self):
  self.assertTrue(self.report['passed'],self.report['errors']);self.assertEqual(self.report['serviceDoors'],6)
  self.assertFalse(np.any(self.arrays['roads']&~self.arrays['land']))
  p=copy.deepcopy(self.plan);p['locations'][0]['x']=0;p['locations'][0]['y']=0
  self.assertFalse(validate(p,self.arrays)['passed'])

 def test_maze_connectivity_solution_and_variety(self):
  a=maze(400,31);b=maze(401,31);self.assertNotEqual(a['floor'],b['floor'])
  floor=np.array([[v=='1'for v in row]for row in a['floor']]);l,n=ndimage.label(floor);self.assertEqual(n,1)
  for start,end in zip(a['solution'],a['solution'][1:]):
   x0,y0=np.array(start)//64;x1,y1=np.array(end)//64
   self.assertTrue(x0==x1 or y0==y1)
   self.assertTrue(floor[min(y0,y1):max(y0,y1)+1,min(x0,x1):max(x0,x1)+1].all())

 def test_spawns_are_separate_and_preserve_every_terrain_array(self):
  before={k:digest(v.tobytes())for k,v in self.arrays.items()};source=digest(canonical(self.plan))
  data,r=placement(self.plan,self.arrays,self.context['bestiary'],5749000)
  self.assertTrue(r['passed'],r['errors']);self.assertGreater(len(data['overworld']),0);self.assertGreater(len(data['interiors']),0)
  self.assertEqual(before,{k:digest(v.tobytes())for k,v in self.arrays.items()});self.assertEqual(source,digest(canonical(self.plan)))
  again,_=placement(self.plan,self.arrays,self.context['bestiary'],5749000);self.assertEqual(canonical(data),canonical(again))

 def test_spawn_validator_rejects_city_home_and_unknown_monster(self):
  data,_=placement(self.plan,self.arrays,self.context['bestiary'],5749000)
  bad=copy.deepcopy(data['overworld']);home=self.plan['settlements'][0];bad[0].update(x=home['x'],y=home['y'])
  self.assertFalse(validate_spawns(self.plan,self.arrays,self.context['bestiary'],bad,[])['passed'])
  bad[0]['kind']='unapproved-invented-monster'
  self.assertFalse(validate_spawns(self.plan,self.arrays,self.context['bestiary'],bad,[])['passed'])

 def test_spawn_pass_refuses_tampered_terrain(self):
  with tempfile.TemporaryDirectory()as temp:
   generate(self.context,'island-1',5746036,temp,32);directory=Path(temp)/'island-1';verify_region(directory)
   (directory/'world.json').write_text('{}')
   with self.assertRaises(ValueError):verify_region(directory)

if __name__=='__main__':unittest.main()
