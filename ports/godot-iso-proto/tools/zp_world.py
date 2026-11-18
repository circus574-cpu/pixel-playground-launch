"""The shape of Zielona Przystań (metres; x east, y north, z up): river, banks, terraces, cliffs and mountains. Shared by build_scene.py (Blender, objects) and
gen_t3d_data.py (heightmap and texture layers for Terrain3D), so every object sits exactly on the ground."""
import math

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
