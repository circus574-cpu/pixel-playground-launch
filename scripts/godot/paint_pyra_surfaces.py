"""Bake repeatable city materials and a world-space street mask using the CPU."""
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import distance_transform_edt, gaussian_filter

from pyra_quarters import FRONTAGES

SIZE = 512
MAP_SIZE = 2048
# The shoulders extend beyond the buildings so clinker tapers into native rock.
URBAN_GROUND = [
    ((-5, 41), (143, 113)),
    ((-64, -152), (96, 91)),
    ((-187, -24), (108, 78)),
    ((-22, 196), (141, 72)),
]


def cyclic_noise(rng, blur):
    raw = rng.normal(size=(SIZE, SIZE))
    field = gaussian_filter(raw, blur, mode="wrap")
    return field / max(field.std(), .001)


def rgb(value, palette):
    return Image.fromarray(np.clip(value[..., None] + palette, 0, 255).astype("uint8"))


def make_paving(rng, x, y, columns, rows, palette, joint_width):
    cell_width, cell_height = SIZE / columns, SIZE / rows
    row = np.floor(y / cell_height).astype(int)
    column_x = (x + row % 2 * cell_width / 2) % SIZE
    column = np.floor(column_x / cell_width).astype(int)
    u, v = column_x % cell_width, y % cell_height
    grain = cyclic_noise(rng, 1.2)
    stone = rng.normal(0, 6, (rows, columns))[row, column]
    edge = np.minimum(np.minimum(u, cell_width - u), np.minimum(v, cell_height - v))
    face = np.clip((edge + grain * .3 - joint_width) / 2.3, 0, 1)
    bevel = ((v < joint_width + 3) | (u < joint_width + 3)) * 14 - (
        (v > cell_height - 5) | (u > cell_width - 5)
    ) * 11
    value = stone + bevel + 3 * grain + 4 * cyclic_noise(rng, 7)
    return rgb(face * value - (1 - face) * 34, palette)


def bake_city_surfaces(layout, output):
    rng = np.random.default_rng(18112026)
    y, x = np.mgrid[:SIZE, :SIZE]
    x, y = x + .5, y + .5
    dust = 1.3 * cyclic_noise(rng, .65) + 2.1 * cyclic_noise(rng, 3) + 4.5 * cyclic_noise(rng, 23)
    warp = cyclic_noise(rng, 21) * 7.0 + cyclic_noise(rng, 5) * 2.0
    layers = np.sin((y + warp) * 2 * np.pi / 64)
    fractures = np.maximum(np.cos((x + warp * 3) * 2 * np.pi / 128), 0) ** 36
    basalt = 8.0 * layers - 15.0 * fractures + 5.0 * cyclic_noise(rng, 3) + 3.0 * cyclic_noise(rng, 14)
    materials = {
        "city-soil.png": rgb(dust, (91, 76, 64)),
        "city-pavers.png": make_paving(rng, x, y, 6, 10, (125, 117, 110), 2.0),
        "city-cliff.png": rgb(basalt, (81, 75, 74)),
        "city-slabs.png": make_paving(rng, x, y, 5, 8, (137, 124, 111), 1.7),
    }
    for file, image in materials.items():
        image.resize((256, 256), Image.Resampling.LANCZOS).save(output / file)

    def pixels(point):
        return tuple((np.asarray(point) + 512) * (MAP_SIZE / 1024))

    street_mask = Image.new("L", (MAP_SIZE, MAP_SIZE))
    street = ImageDraw.Draw(street_mask)
    for item in layout["streets"]:
        width = round(item["width_m"] * MAP_SIZE / 1024)
        points = [pixels(point) for point in item["centerline"]]
        street.line(points, fill=255, width=width, joint="curve")
        radius = width / 2
        for x, y in (points[0], points[-1]):
            street.ellipse((x-radius, y-radius, x+radius, y+radius), fill=255)
    court_mask = Image.new("L", (MAP_SIZE, MAP_SIZE))
    court = ImageDraw.Draw(court_mask)
    for item in layout["plazas"]:
        court.polygon([pixels(point) for point in item["polygon"]], fill=255)

    for frontage in FRONTAGES:
        court.polygon([pixels(point) for point in frontage], fill=255)

    road = np.asarray(street_mask) > 0
    paved = np.clip((distance_transform_edt(road) - distance_transform_edt(~road)) * 19 + 128, 0, 255)
    z, x = np.ogrid[-512:512:.5, -512:512:.5]
    city = np.zeros((MAP_SIZE, MAP_SIZE), dtype=np.float32)
    for (cx, cz), (rx, rz) in URBAN_GROUND:
        radius = np.hypot((x - cx) / rx, (z - cz) / rz)
        city = np.maximum(city, np.clip((1.18 - radius) / .33, 0, 1))
    urban_map = np.stack((city * 255, paved, gaussian_filter(np.asarray(court_mask), 1.1)), axis=-1)
    mask = Image.fromarray(urban_map.astype("uint8"))
    mask.resize((1024, 1024), Image.Resampling.BOX).save(output / "city-surfaces.png")
    return [*materials, "city-surfaces.png"]
