"""Color correction must not become a pose, alpha or race identity change."""
import sys
from pathlib import Path
import unittest

sys.path.insert(0,str(Path(__file__).parent))
from character_color import grade


class ColorContracts(unittest.TestCase):
    def test_every_alpha_byte_and_hidden_rgb_are_preserved(self):
        from PIL import Image
        image=Image.new('RGBA',(256,1))
        image.putdata([(120,45,35,a) for a in range(256)])
        result=grade(image)
        self.assertEqual(result.getchannel('A').tobytes(),image.getchannel('A').tobytes())
        self.assertEqual(result.getpixel((0,0)),image.getpixel((0,0)))
        self.assertEqual(result.size,image.size)

    def test_gray_metal_white_hair_and_black_remain_neutral(self):
        from PIL import Image
        image=Image.new('RGBA',(256,1));image.putdata([(v,v,v,255) for v in range(256)])
        pixels=list(grade(image).getdata())
        self.assertTrue(all(r==g==b for r,g,b,a in pixels))
        self.assertEqual(pixels[0],(0,0,0,255));self.assertEqual(pixels[-1],(255,255,255,255))

    def test_richer_red_preserves_hue_and_skin_has_limited_shift(self):
        from PIL import Image
        import colorsys
        image=Image.new('RGBA',(2,1));image.putdata([(170,65,45,255),(220,170,145,255)])
        red,skin=list(grade(image).getdata())
        before=colorsys.rgb_to_hsv(170/255,65/255,45/255);after=colorsys.rgb_to_hsv(*(c/255 for c in red[:3]))
        self.assertGreater(after[1],before[1]);self.assertLess(abs(after[0]-before[0]),.01)
        self.assertLessEqual(max(abs(a-b) for a,b in zip(skin[:3],(220,170,145))),15)

    def test_no_frame_local_auto_exposure(self):
        from PIL import Image
        one=Image.new('RGBA',(1,1),(80,130,190,253));many=Image.new('RGBA',(80,80),'white')
        many.putpixel((20,30),one.getpixel((0,0)))
        self.assertEqual(grade(one).getpixel((0,0)),grade(many).getpixel((20,30)))


if __name__=='__main__':unittest.main()
