class_name MapMath
extends RefCounted
## Shared geometry of the planet atlas (2000 x 1000 map units, equirectangular): the 2D map and the 3D globe pick regions
## from the same traced outlines and place the player through the same per-cell affine transforms as the browser /mapa.

const MAP_W := 2000.0
const MAP_H := 1000.0

static func lonlat_to_atlas(lon: float, lat: float) -> Vector2:
	return Vector2((lon + 180.0) / 360.0 * MAP_W, (90.0 - lat) / 180.0 * MAP_H)

static func atlas_to_lonlat(p: Vector2) -> Vector2:
	return Vector2(p.x / MAP_W * 360.0 - 180.0, 90.0 - p.y / MAP_H * 180.0)

static func world_to_atlas(land_tiles: Dictionary, x: float, y: float) -> Vector2:
	var upp := float(land_tiles.get("upp", 32.0))
	var px := x / upp
	var py := y / upp
	var best: Dictionary = {}
	var best_d := INF
	var tiles: Array = land_tiles.get("tiles", [])
	for tile: Dictionary in tiles:
		var crop: Array = tile.get("crop", [0, 0, 100, 100])
		var dx := maxf(maxf(float(crop[0]) - px, 0.0), px - (float(crop[0]) + float(crop[2])))
		var dy := maxf(maxf(float(crop[1]) - py, 0.0), py - (float(crop[1]) + float(crop[3])))
		var d := dx * dx + dy * dy
		if d < best_d:
			best_d = d
			best = tile
			if d == 0.0:
				break
	if best.is_empty():
		return Vector2(MAP_W / 2.0, MAP_H / 2.0)
	var m: Array = best.get("m", [1, 0, 0, 1, 1000, 500])
	return Vector2(float(m[0]) * px + float(m[2]) * py + float(m[4]), float(m[1]) * px + float(m[3]) * py + float(m[5]))

static func polygon(region: Dictionary) -> PackedVector2Array:
	var points := PackedVector2Array()
	var outline: Array = region.get("outline", [])
	for p: Array in outline:
		points.append(Vector2(float(p[0]), float(p[1])))
	return points

static func region_at(regions: Array, p: Vector2) -> Dictionary:
	var q := Vector2(fposmod(p.x, MAP_W), p.y)
	for region: Dictionary in regions:
		if Geometry2D.is_point_in_polygon(q, polygon(region)):
			return region
	return {}
