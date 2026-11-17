"""CPU material checks: convention, constant surfaces, edges, lossless encoding."""
import tempfile
import unittest
from pathlib import Path

import numpy as np
from PIL import Image
from free_materials import derived_maps


class FreeMaterialsTests(unittest.TestCase):
    def test_flat_surface_has_upward_normal(self):
        maps=derived_maps(np.full((32,32,3),128,dtype=np.uint8),False,False)
        self.assertTrue(np.all(maps["normal-opengl"] == [128,128,255]))

    def test_horizontal_gradient_tilts_normal_against_slope(self):
        rgb=np.repeat(np.tile(np.arange(32,dtype=np.uint8)*8,(32,1))[:,:,None],3,axis=2)
        n=derived_maps(rgb,False,False)["normal-opengl"]
        self.assertTrue(np.all(n[8:24,8:24,0]<128))
        self.assertTrue(np.all(n[8:24,8:24,1]==128))

    def test_vertical_gradient_uses_opengl_y_convention(self):
        rgb=np.repeat(np.tile((np.arange(32,dtype=np.uint8)*8)[:,None],(1,32))[:,:,None],3,axis=2)
        n=derived_maps(rgb,False,False)["normal-opengl"]
        self.assertTrue(np.all(n[8:24,8:24,1]>128))

    def test_periodic_edges_and_normal_lengths(self):
        rng=np.random.default_rng(12)
        maps=derived_maps(rng.integers(0,256,(64,64,3),dtype=np.uint8),True,False)
        for image in maps.values():
            np.testing.assert_array_equal(image[0],image[-1])
            np.testing.assert_array_equal(image[:,0],image[:,-1])
        normals=maps["normal-opengl"]/127.5-1
        self.assertLess(np.max(abs(np.linalg.norm(normals,axis=-1)-1)),.015)

    def test_water_has_lower_roughness_than_stone(self):
        rgb=np.full((32,32,3),128,dtype=np.uint8)
        self.assertLess(derived_maps(rgb,True,True)["roughness-estimated"].mean(),derived_maps(rgb,True,False)["roughness-estimated"].mean())

    def test_input_is_not_modified(self):
        rgb=np.random.default_rng(2).integers(0,256,(32,32,3),dtype=np.uint8)
        before=rgb.copy();derived_maps(rgb,True,False)
        np.testing.assert_array_equal(rgb,before)

    def test_webp_round_trip_is_lossless(self):
        maps=derived_maps(np.random.default_rng(8).integers(0,256,(32,32,3),dtype=np.uint8),True,False)
        with tempfile.TemporaryDirectory() as temp:
            for name,array in maps.items():
                path=Path(temp)/(name+'.webp')
                Image.fromarray(array).save(path,lossless=True)
                np.testing.assert_array_equal(array,np.asarray(Image.open(path).convert('RGB'))[:,:,0] if array.ndim==2 else np.asarray(Image.open(path)))


if __name__ == '__main__':
    unittest.main()
