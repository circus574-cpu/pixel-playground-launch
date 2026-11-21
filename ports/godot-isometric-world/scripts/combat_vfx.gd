extends Node2D
## Racial Combat Skill VFX, Transformation Pillar, Projectiles, Shield Domes & World Pickup/Heal Effects.
## Pure smooth procedural Gaussian glow textures + anti-aliased ribbons & isometric shockwaves.

const RACE_COLORS := {
	"legend": {
		"main": Color(1.0, 0.48, 0.14, 1.0),
		"core": Color(1.0, 0.94, 0.72, 1.0),
		"edge": Color(1.0, 0.22, 0.08, 1.0),
	},
	"planetary": {
		"main": Color(0.24, 0.92, 0.48, 1.0),
		"core": Color(0.86, 1.0, 0.80, 1.0),
		"edge": Color(0.96, 0.82, 0.26, 1.0),
	},
	"sage": {
		"main": Color(0.32, 0.84, 1.0, 1.0),
		"core": Color(0.90, 0.98, 1.0, 1.0),
		"edge": Color(0.56, 0.46, 1.0, 1.0),
	},
	"android": {
		"main": Color(0.14, 0.96, 0.98, 1.0),
		"core": Color(0.88, 0.98, 1.0, 1.0),
		"edge": Color(0.76, 0.34, 1.0, 1.0),
	},
}

static var _glow_tex: Texture2D
var effects: Array[Dictionary] = []

func _ready() -> void:
	z_index = 18
	_ensure_glow_tex()

static func _ensure_glow_tex() -> Texture2D:
	if _glow_tex != null:
		return _glow_tex
	var sz := 64
	var img := Image.create(sz, sz, false, Image.FORMAT_RGBA8)
	var half := float(sz) * 0.5
	for y in sz:
		for x in sz:
			var dx := (float(x) + 0.5 - half) / half
			var dy := (float(y) + 0.5 - half) / half
			var r2 := dx * dx + dy * dy
			var a := clampf(exp(-r2 * 4.4) - exp(-4.4), 0.0, 1.0)
			img.set_pixel(x, y, Color(1.0, 1.0, 1.0, a))
	_glow_tex = ImageTexture.create_from_image(img)
	return _glow_tex

func _pal(race_k: String) -> Dictionary:
	return RACE_COLORS.get(race_k, RACE_COLORS["legend"])

func spawn_slash(pos: Vector2, dir: Vector2, race_k: String, scale_mult: float = 1.0, flip_sweep: bool = false) -> void:
	var ang := dir.angle() if dir.length_squared() > 0.01 else 0.0
	var pal := _pal(race_k)
	var sparks: Array[Dictionary] = []
	for i in 10:
		var sa := ang + randf_range(-1.15, 1.15)
		sparks.append({
			"dir": Vector2(cos(sa), sin(sa) * 0.62),
			"spd": randf_range(95.0, 210.0) * scale_mult,
			"sz": randf_range(2.2, 4.4),
		})
	effects.append({
		"kind": "slash",
		"pos": pos + Vector2(0.0, -34.0),
		"ang": ang,
		"flip": flip_sweep,
		"scale": scale_mult,
		"main": pal["main"],
		"core": pal["core"],
		"edge": pal["edge"],
		"sparks": sparks,
		"age": 0.0,
		"dur": 0.36,
	})
	queue_redraw()

func spawn_bolt(from_pos: Vector2, to_pos: Vector2, race_k: String, scale_mult: float = 1.0) -> void:
	var pal := _pal(race_k)
	effects.append({
		"kind": "bolt",
		"from": from_pos + Vector2(0.0, -38.0),
		"to": to_pos + Vector2(0.0, -34.0),
		"scale": scale_mult,
		"main": pal["main"],
		"core": pal["core"],
		"edge": pal["edge"],
		"race": race_k,
		"impacted": false,
		"age": 0.0,
		"dur": 0.28,
	})
	queue_redraw()

func spawn_shield_dome(pos: Vector2, race_k: String) -> void:
	var pal := _pal(race_k)
	effects.append({
		"kind": "shield",
		"pos": pos + Vector2(0.0, -34.0),
		"main": pal["main"],
		"core": pal["core"],
		"edge": pal["edge"],
		"age": 0.0,
		"dur": 0.85,
	})
	queue_redraw()

func spawn_ki_burst(pos: Vector2, race_k: String, radius: float = 155.0) -> void:
	var pal := _pal(race_k)
	var sparks: Array[Dictionary] = []
	for i in 18:
		var sa := (float(i) / 18.0) * TAU + randf_range(-0.14, 0.14)
		sparks.append({
			"dir": Vector2(cos(sa), sin(sa) * 0.56),
			"spd": randf_range(radius * 0.9, radius * 1.9),
			"sz": randf_range(2.6, 5.2),
		})
	effects.append({
		"kind": "burst",
		"pos": pos,
		"radius": radius,
		"main": pal["main"],
		"core": pal["core"],
		"edge": pal["edge"],
		"sparks": sparks,
		"age": 0.0,
		"dur": 0.58,
	})
	queue_redraw()

func spawn_transform_pillar(pos: Vector2, race_k: String) -> void:
	var pal := _pal(race_k)
	var bolts: Array[PackedVector2Array] = []
	for i in 6:
		var pts := PackedVector2Array()
		var bx := randf_range(-44.0, 44.0)
		for seg in 7:
			var fy := -float(seg) * 34.0
			pts.append(Vector2(bx + randf_range(-16.0, 16.0), fy))
		bolts.append(pts)
	effects.append({
		"kind": "pillar",
		"pos": pos,
		"main": pal["main"],
		"core": pal["core"],
		"edge": pal["edge"],
		"bolts": bolts,
		"age": 0.0,
		"dur": 0.92,
	})
	spawn_ki_burst(pos, race_k, 175.0)
	queue_redraw()

func spawn_impact(pos: Vector2, race_k: String, is_crit: bool = false) -> void:
	var pal := _pal(race_k)
	var sparks: Array[Dictionary] = []
	var cnt := 14 if is_crit else 8
	for i in cnt:
		var sa := (float(i) / float(cnt)) * TAU + randf_range(-0.22, 0.22)
		sparks.append({
			"dir": Vector2(cos(sa), sin(sa)),
			"spd": randf_range(60.0, 185.0 if is_crit else 125.0),
			"sz": randf_range(2.4, 5.2 if is_crit else 3.8),
		})
	effects.append({
		"kind": "impact",
		"pos": pos + Vector2(0.0, -34.0),
		"crit": is_crit,
		"main": Color(1.0, 0.86, 0.22) if is_crit else pal["main"],
		"core": Color(1.0, 0.98, 0.85),
		"sparks": sparks,
		"age": 0.0,
		"dur": 0.40 if is_crit else 0.28,
	})
	queue_redraw()

func spawn_heal_aura(pos: Vector2, col: Color = Color(0.36, 0.98, 0.62)) -> void:
	var motes: Array[Dictionary] = []
	for i in 14:
		motes.append({
			"ox": randf_range(-38.0, 38.0),
			"oy": randf_range(-12.0, 10.0),
			"rise": randf_range(75.0, 145.0),
			"sz": randf_range(3.0, 5.8),
			"ph": randf_range(0.0, TAU),
		})
	effects.append({
		"kind": "heal",
		"pos": pos,
		"main": col,
		"core": Color(0.92, 1.0, 0.88),
		"motes": motes,
		"age": 0.0,
		"dur": 0.95,
	})
	queue_redraw()

func _process(delta: float) -> void:
	if effects.is_empty():
		return
	var kept: Array[Dictionary] = []
	for fx: Dictionary in effects:
		fx["age"] = float(fx["age"]) + delta
		if str(fx["kind"]) == "bolt" and not bool(fx["impacted"]) and float(fx["age"]) >= float(fx["dur"]) * 0.78:
			fx["impacted"] = true
			spawn_impact(fx["to"] as Vector2 - Vector2(0.0, -34.0), str(fx.get("race", "sage")), false)
		if float(fx["age"]) < float(fx["dur"]):
			kept.append(fx)
	effects = kept
	queue_redraw()

func _draw_glow(pos: Vector2, rx: float, ry: float, col: Color) -> void:
	var tex := _ensure_glow_tex()
	draw_texture_rect(tex, Rect2(pos.x - rx, pos.y - ry, rx * 2.0, ry * 2.0), false, col)

func _draw() -> void:
	if effects.is_empty():
		return
	for fx: Dictionary in effects:
		var kind := str(fx["kind"])
		var age := float(fx["age"])
		var dur := maxf(float(fx["dur"]), 0.05)
		var p := clampf(age / dur, 0.0, 1.0)
		var fade := pow(1.0 - p, 1.35)
		var main_c: Color = fx["main"]
		var core_c: Color = fx["core"]

		if kind == "slash":
			var pos: Vector2 = fx["pos"]
			var ang: float = float(fx["ang"])
			var sc: float = float(fx["scale"])
			var flip_s: bool = bool(fx["flip"])
			var edge_c: Color = fx["edge"]
			var sweep_dir := -1.0 if flip_s else 1.0
			var head_a := ang + sweep_dir * lerpf(-1.25, 1.32, clampf(p * 1.45, 0.0, 1.0))
			var tail_a := ang + sweep_dir * lerpf(-1.30, 0.65, clampf(p * 1.10, 0.0, 1.0))
			var outer_r := (82.0 + p * 36.0) * sc
			var inner_r := (46.0 + p * 26.0) * sc
			var poly := PackedVector2Array()
			var steps := 14
			for i in steps + 1:
				var t := float(i) / float(steps)
				var a := lerpf(tail_a, head_a, t)
				var taper := sin(t * PI)
				var r_o := lerpf(inner_r, outer_r, 0.35 + 0.65 * taper)
				poly.append(pos + Vector2(cos(a) * r_o, sin(a) * r_o * 0.64))
			for i in range(steps, -1, -1):
				var t := float(i) / float(steps)
				var a := lerpf(tail_a, head_a, t)
				poly.append(pos + Vector2(cos(a) * inner_r, sin(a) * inner_r * 0.64))
			var glow_p := pos + Vector2(cos(head_a) * outer_r * 0.85, sin(head_a) * outer_r * 0.54)
			_draw_glow(glow_p, 64.0 * sc, 46.0 * sc, Color(edge_c.r, edge_c.g, edge_c.b, 0.64 * fade))
			draw_colored_polygon(poly, Color(main_c.r, main_c.g, main_c.b, 0.78 * fade))
			var arc_pts := PackedVector2Array()
			for i in steps + 1:
				var a := lerpf(tail_a, head_a, float(i) / float(steps))
				arc_pts.append(pos + Vector2(cos(a) * outer_r, sin(a) * outer_r * 0.64))
			draw_polyline(arc_pts, Color(edge_c.r, edge_c.g, edge_c.b, 0.92 * fade), 7.5 * sc, true)
			draw_polyline(arc_pts, Color(core_c.r, core_c.g, core_c.b, 0.98 * fade), 3.6 * sc, true)
			for sp: Dictionary in fx["sparks"]:
				var sp_p := pos + (sp["dir"] as Vector2) * (float(sp["spd"]) * age)
				draw_circle(sp_p, float(sp["sz"]) * (1.0 - p * 0.55) + 1.2, Color(edge_c.r, edge_c.g, edge_c.b, 0.80 * fade))
				draw_circle(sp_p, float(sp["sz"]) * (1.0 - p * 0.6), Color(core_c.r, core_c.g, core_c.b, 0.95 * fade))

		elif kind == "bolt":
			var from_p: Vector2 = fx["from"]
			var to_p: Vector2 = fx["to"]
			var sc: float = float(fx["scale"])
			var edge_c: Color = fx["edge"]
			var head := from_p.lerp(to_p, clampf(p * 1.18, 0.0, 1.0))
			var tail := from_p.lerp(to_p, clampf(p * 1.18 - 0.48, 0.0, 1.0))
			draw_line(tail, head, Color(edge_c.r, edge_c.g, edge_c.b, 0.78 * fade), 15.0 * sc, true)
			draw_line(tail, head, Color(main_c.r, main_c.g, main_c.b, 0.92 * fade), 9.0 * sc, true)
			draw_line(tail.lerp(head, 0.30), head, Color(core_c.r, core_c.g, core_c.b, 0.98 * fade), 4.2 * sc, true)
			_draw_glow(head, 44.0 * sc, 44.0 * sc, Color(edge_c.r, edge_c.g, edge_c.b, 0.84 * fade))
			draw_circle(head, 9.0 * sc, Color(core_c.r, core_c.g, core_c.b, 0.98 * fade))

		elif kind == "shield":
			var pos: Vector2 = fx["pos"]
			var edge_c: Color = fx["edge"]
			var rad := lerpf(28.0, 78.0, minf(p * 3.0, 1.0)) + sin(p * 16.0) * 2.5
			_draw_glow(pos, rad * 1.35, rad * 1.15, Color(edge_c.r, edge_c.g, edge_c.b, 0.42 * fade))
			var hex := PackedVector2Array()
			for i in 9:
				var a := (float(i) / 8.0) * TAU + p * 0.8
				hex.append(pos + Vector2(cos(a) * rad, sin(a) * rad * 0.84))
			draw_colored_polygon(hex, Color(edge_c.r * 0.65, edge_c.g * 0.75, edge_c.b, 0.28 * fade))
			draw_polyline(hex, Color(edge_c.r, edge_c.g, edge_c.b, 0.94 * fade), 6.0, true)
			draw_polyline(hex, Color(core_c.r, core_c.g, core_c.b, 0.96 * fade), 2.6, true)
			draw_arc(pos, rad * 0.76, 0.0, TAU, 28, Color(main_c.r, main_c.g, main_c.b, 0.86 * fade), 3.0, true)

		elif kind == "burst":
			var pos: Vector2 = fx["pos"]
			var edge_c: Color = fx["edge"]
			var max_r: float = float(fx["radius"])
			var cur_r := lerpf(20.0, max_r, 1.0 - pow(1.0 - p, 2.2))
			_draw_glow(pos, cur_r * 1.18, cur_r * 0.72, Color(edge_c.r, edge_c.g, edge_c.b, 0.56 * fade))
			draw_set_transform(pos, 0.0, Vector2(1.0, 0.54))
			draw_arc(Vector2.ZERO, cur_r, 0.0, TAU, 36, Color(edge_c.r, edge_c.g, edge_c.b, 0.94 * fade), 8.5 * fade + 2.0, true)
			draw_arc(Vector2.ZERO, cur_r * 0.86, 0.0, TAU, 32, Color(main_c.r, main_c.g, main_c.b, 0.92 * fade), 4.5 * fade + 1.5, true)
			draw_arc(Vector2.ZERO, cur_r * 0.68, 0.0, TAU, 28, Color(core_c.r, core_c.g, core_c.b, 0.96 * fade), 2.8 * fade + 1.0, true)
			draw_set_transform(Vector2.ZERO)
			for sp: Dictionary in fx["sparks"]:
				var sp_p := pos + (sp["dir"] as Vector2) * (float(sp["spd"]) * age) + Vector2(0.0, -18.0 * p)
				draw_circle(sp_p, float(sp["sz"]) * (1.0 - p * 0.50) + 1.4, Color(edge_c.r, edge_c.g, edge_c.b, 0.84 * fade))
				draw_circle(sp_p, float(sp["sz"]) * (1.0 - p * 0.55), Color(core_c.r, core_c.g, core_c.b, 0.95 * fade))

		elif kind == "pillar":
			var pos: Vector2 = fx["pos"]
			var edge_c: Color = fx["edge"]
			var pw := lerpf(24.0, 86.0, sin(minf(p * 2.2, 1.0) * PI * 0.5)) * (1.0 - p * 0.42)
			var ph := 310.0
			_draw_glow(pos + Vector2(0.0, -ph * 0.42), pw * 2.4, ph * 0.62, Color(edge_c.r, edge_c.g, edge_c.b, 0.58 * fade))
			_draw_glow(pos + Vector2(0.0, -ph * 0.40), pw * 1.15, ph * 0.56, Color(main_c.r, main_c.g, main_c.b, 0.72 * fade))
			_draw_glow(pos + Vector2(0.0, -ph * 0.36), pw * 0.46, ph * 0.48, Color(core_c.r, core_c.g, core_c.b, 0.92 * fade))
			for bpts: PackedVector2Array in fx["bolts"]:
				var shifted := PackedVector2Array()
				for pt: Vector2 in bpts:
					shifted.append(pos + pt + Vector2(sin(p * 24.0 + pt.y * 0.05) * 6.0, 0.0))
				draw_polyline(shifted, Color(edge_c.r, edge_c.g, edge_c.b, 0.76 * fade), 5.0, true)
				draw_polyline(shifted, Color(core_c.r, core_c.g, core_c.b, 0.96 * fade), 2.4, true)

		elif kind == "impact":
			var pos: Vector2 = fx["pos"]
			var is_c: bool = bool(fx["crit"])
			var rad := (62.0 if is_c else 40.0) * (0.65 + p * 0.75)
			_draw_glow(pos, rad, rad, Color(main_c.r, main_c.g, main_c.b, 0.78 * fade))
			draw_arc(pos, rad * 0.62, 0.0, TAU, 24, Color(core_c.r, core_c.g, core_c.b, 0.96 * fade), 3.6 if is_c else 2.4, true)
			for sp: Dictionary in fx["sparks"]:
				var sp_p := pos + (sp["dir"] as Vector2) * (float(sp["spd"]) * age)
				draw_circle(sp_p, float(sp["sz"]) * (1.0 - p * 0.6), Color(core_c.r, core_c.g, core_c.b, 0.95 * fade))

		elif kind == "heal":
			var pos: Vector2 = fx["pos"]
			_draw_glow(pos + Vector2(0.0, -34.0), 68.0, 54.0, Color(main_c.r, main_c.g, main_c.b, 0.48 * fade))
			draw_set_transform(pos, 0.0, Vector2(1.0, 0.45))
			draw_arc(Vector2.ZERO, lerpf(20.0, 62.0, p), 0.0, TAU, 28, Color(main_c.r, main_c.g, main_c.b, 0.90 * fade), 4.0, true)
			draw_set_transform(Vector2.ZERO)
			for m: Dictionary in fx["motes"]:
				var mx := pos.x + float(m["ox"]) + sin(p * 6.0 + float(m["ph"])) * 8.0
				var my := pos.y + float(m["oy"]) - float(m["rise"]) * p
				draw_circle(Vector2(mx, my), float(m["sz"]) * (1.0 - p * 0.45) + 1.2, Color(main_c.r, main_c.g, main_c.b, 0.82 * fade))
				draw_circle(Vector2(mx, my), float(m["sz"]) * (1.0 - p * 0.45), Color(core_c.r, core_c.g, core_c.b, 0.96 * fade))
