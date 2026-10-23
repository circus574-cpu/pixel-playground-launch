"""CPU generator invariants; run with KI_WORLDGEN_CONTEXT pointing at exported context.json."""
import copy,json,os,tempfile,unittest
from pathlib import Path
import numpy as np
from generate import astar,build,canonical,digest,generate_one,validate

class WorldgenTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  path=os.environ.get('KI_WORLDGEN_CONTEXT',str(Path(__file__).with_name('context.json')))
  cls.context=json.loads(Path(path).read_text())
  cls.plan,cls.arrays,cls.report=build(cls.context,5741200)

 def test_source_geometry_identity_and_no_runtime_spawns(self):
  self.assertEqual(self.plan['acceptedSource'],self.context['worlds']['verdant'])
  self.assertEqual(self.plan['sourceWorldSha256'],digest(canonical(self.context['worlds']['verdant'])))
  self.assertEqual(self.plan['enemies'],[]);self.assertEqual(self.plan['monsters'],[])
  self.assertEqual(self.report['activeSpawns'],0)

 def test_all_24_doors_reachable_and_roads_avoid_obstacles(self):
  self.assertTrue(self.report['passed'],self.report['errors'])
  self.assertEqual(self.report['doorsChecked'],24)
  self.assertFalse(np.any(self.arrays['roads']&self.arrays['blocked']))
  self.assertGreater(self.report['reachableWalkablePercent'],95)

 def test_determinism_and_seed_changes(self):
  other,arrays,_=build(self.context,5741200)
  self.assertEqual(canonical(self.plan),canonical(other))
  for name in self.arrays:np.testing.assert_array_equal(self.arrays[name],arrays[name])
  variant,_,_=build(self.context,5741201)
  self.assertNotEqual(canonical(self.plan['resources']),canonical(variant['resources']))

 def test_validator_detects_source_tampering(self):
  plan=copy.deepcopy(self.plan);plan['acceptedSource']['spawn']['x']+=1
  self.assertIn('Accepted source modified',validate(plan,self.arrays)['errors'])

 def test_validator_detects_spawn_and_obstruction(self):
  plan=copy.deepcopy(self.plan);plan['monsters']=[{'kind':'forbidden'}]
  self.assertFalse(validate(plan,self.arrays)['passed'])
  arrays={k:v.copy() for k,v in self.arrays.items()};arrays['walkable'][:]=False
  self.assertFalse(validate(self.plan,arrays)['passed'])

 def test_chunk_coverage_integrity_resume_and_tamper_rejection(self):
  with tempfile.TemporaryDirectory() as target:
   first=generate_one(self.context,5741200,target,16384,12288,32)
   directory=Path(first['directory']);chunks=json.loads((directory/'chunks.json').read_text())
   area=sum(c['width']*c['height'] for c in chunks)
   self.assertEqual(area,16384*12288)
   reconstructed=np.zeros_like(self.arrays['biomes'])
   for c in chunks:
    x,y=c['x']//32,c['y']//32
    with np.load(directory/c['path']) as data:reconstructed[y:y+data['biomes'].shape[0],x:x+data['biomes'].shape[1]]=data['biomes']
   np.testing.assert_array_equal(self.arrays['biomes'],reconstructed)
   self.assertTrue(generate_one(self.context,5741200,target,16384,12288,32,resume=True)['resumed'])
   (directory/'minimap.png').write_bytes(b'corrupt')
   with self.assertRaises(FileExistsError):generate_one(self.context,5741200,target,16384,12288,32,resume=True)

 def test_pathfinder_reports_unreachable_instead_of_inventing_route(self):
  cost=np.ones((8,8));cost[:,4]=np.inf
  with self.assertRaises(ValueError):astar(cost,(1,1),(6,6))

if __name__=='__main__':unittest.main()
