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
static var _wisp_tex: Texture2D
var effects: Array[Dictionary] = []

func _ready() -> void:
	z_index = 18
	var add_mat := CanvasItemMaterial.new()
	add_mat.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	material = add_mat
	_ensure_glow_tex()

static func _ensure_glow_tex() -> Texture2D:
	if _glow_tex == null:
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
	if _wisp_tex == null:
		var w := 48
		var h := 112
		var img2 := Image.create(w, h, false, Image.FORMAT_RGBA8)
		for y in h:
			var ny := float(y) / float(h - 1)
			var profile := sin(pow(ny, 0.72) * PI)
			for x in w:
				var nx := (float(x) + 0.5 - float(w) * 0.5) / (float(w) * 0.5)
				var sw := maxf(profile * 0.92, 0.01)
				var dx := absf(nx) / sw
				var a := clampf(pow(maxf(0.0, 1.0 - dx), 2.1) * profile * (1.0 - ny * 0.35), 0.0, 1.0)
				var core_hot := clampf(1.0 - dx * 1.4, 0.0, 1.0)
				img2.set_pixel(x, y, Color(1.0, 0.92 + 0.08 * core_hot, 0.75 + 0.25 * core_hot, a))
		_wisp_tex = ImageTexture.create_from_image(img2)
	return _glow_tex

func _draw_tapered_ray(center: Vector2, ang: float, length: float, half_w: float, col: Color, y_squash: float = 0.78) -> void:
	if length < 2.0 or half_w < 0.35 or col.a <= 0.005:
		return
	var dir := Vector2(cos(ang), sin(ang) * y_squash)
	var perp := Vector2(-sin(ang), cos(ang) * y_squash).normalized()
	var poly := PackedVector2Array([
		center - dir * (length * 0.08),
		center + dir * (length * 0.14) + perp * half_w,
		center + dir * length,
		center + dir * (length * 0.14) - perp * half_w,
	])
	draw_colored_polygon(poly, col)

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
	for i in 24:
		var sa := (float(i) / 24.0) * TAU + randf_range(-0.12, 0.12)
		sparks.append({
			"dir": Vector2(cos(sa), sin(sa) * 0.56),
			"spd": randf_range(radius * 0.95, radius * 2.15),
			"sz": randf_range(2.8, 5.8),
		})
	var cracks: Array[PackedVector2Array] = []
	for ci in 8:
		var ca := (float(ci) / 8.0) * TAU + randf_range(-0.18, 0.18)
		var pts := PackedVector2Array([Vector2.ZERO])
		for seg in range(1, 5):
			var frac := float(seg) / 4.0
			var jitter := randf_range(-0.18, 0.18)
			var r_c := radius * frac * 0.92
			pts.append(Vector2(cos(ca + jitter) * r_c, sin(ca + jitter) * r_c * 0.54))
		cracks.append(pts)
	effects.append({
		"kind": "burst",
		"pos": pos,
		"radius": radius,
		"main": pal["main"],
		"core": pal["core"],
		"edge": pal["edge"],
		"sparks": sparks,
		"cracks": cracks,
		"age": 0.0,
		"dur": 0.64,
	})
	queue_redraw()

func spawn_teleport_flash(pos: Vector2, race_k: String = "sage") -> void:
	var pal := _pal(race_k)
	var motes: Array[Dictionary] = []
	for i in 18:
		motes.append({
			"ang": (float(i) / 18.0) * TAU,
			"rad": randf_range(18.0, 58.0),
			"rise": randf_range(110.0, 230.0),
			"sz": randf_range(2.6, 5.4),
		})
	effects.append({
		"kind": "teleport",
		"pos": pos,
		"main": Color(0.36, 0.94, 1.0, 1.0),
		"core": Color(0.96, 1.0, 1.0, 1.0),
		"edge": pal["main"],
		"motes": motes,
		"age": 0.0,
		"dur": 0.72,
	})
	queue_redraw()

func spawn_transform_pillar(pos: Vector2, race_k: String) -> void:
	var pal := _pal(race_k)
	var bolts: Array[Dictionary] = []
	for i in 14:
		var bx := randf_range(-92.0, 92.0)
		var bh := randf_range(220.0, 440.0)
		bolts.append({
			"bx": bx,
			"bh": bh,
			"ground_ang": (float(i) / 14.0) * TAU + randf_range(-0.2, 0.2),
			"ground_r": randf_range(65.0, 175.0),
			"is_ground": (i >= 8),
			"seed": i * 37 + 11,
		})
	var rocks: Array[Dictionary] = []
	for ri in 18:
		var ra := (float(ri) / 18.0) * TAU + randf_range(-0.18, 0.18)
		rocks.append({
			"ang": ra,
			"rad": randf_range(34.0, 145.0),
			"rise": randf_range(90.0, 240.0),
			"sz": randf_range(4.5, 9.5),
			"rot": randf_range(0.0, TAU),
			"spin": randf_range(-4.5, 4.5),
			"delay": randf_range(0.08, 0.34),
		})
	var embers: Array[Dictionary] = []
	for ei in 42:
		embers.append({
			"ang": randf_range(0.0, TAU),
			"rad": randf_range(16.0, 130.0),
			"rise": randf_range(180.0, 450.0),
			"sz": randf_range(2.6, 6.2),
			"swirl": randf_range(2.5, 6.5) * (-1.0 if ei % 2 == 0 else 1.0),
			"delay": randf_range(0.0, 0.32),
		})
	var cracks: Array[PackedVector2Array] = []
	for ci in 14:
		var ca := (float(ci) / 14.0) * TAU + randf_range(-0.14, 0.14)
		var pts := PackedVector2Array([Vector2.ZERO])
		for seg in range(1, 6):
			var frac := float(seg) / 5.0
			var jitter := randf_range(-0.20, 0.20)
			var r_c := 235.0 * frac
			pts.append(Vector2(cos(ca + jitter) * r_c, sin(ca + jitter) * r_c * 0.50))
		cracks.append(pts)
	effects.append({
		"kind": "pillar",
		"pos": pos,
		"main": pal["main"],
		"core": pal["core"],
		"edge": pal["edge"],
		"bolts": bolts,
		"rocks": rocks,
		"embers": embers,
		"cracks": cracks,
		"age": 0.0,
		"dur": 1.65,
	})
	spawn_ki_burst(pos, race_k, 240.0)
	queue_redraw()

func spawn_impact(pos: Vector2, race_k: String, is_crit: bool = false) -> void:
	var pal := _pal(race_k)
	var sparks: Array[Dictionary] = []
	var cnt := 18 if is_crit else 11
	for i in cnt:
		var sa := (float(i) / float(cnt)) * TAU + randf_range(-0.22, 0.22)
		sparks.append({
			"dir": Vector2(cos(sa), sin(sa)),
			"spd": randf_range(70.0, 215.0 if is_crit else 145.0),
			"sz": randf_range(2.6, 5.8 if is_crit else 4.2),
		})
	effects.append({
		"kind": "impact",
		"pos": pos + Vector2(0.0, -34.0),
		"crit": is_crit,
		"main": Color(1.0, 0.86, 0.22) if is_crit else pal["main"],
		"core": Color(1.0, 0.98, 0.88),
		"sparks": sparks,
		"age": 0.0,
		"dur": 0.44 if is_crit else 0.32,
	})
	queue_redraw()

func spawn_heal_aura(pos: Vector2, col: Color = Color(0.36, 0.98, 0.62)) -> void:
	var motes: Array[Dictionary] = []
	for i in 16:
		motes.append({
			"ox": randf_range(-40.0, 40.0),
			"oy": randf_range(-12.0, 10.0),
			"rise": randf_range(80.0, 155.0),
			"sz": randf_range(3.0, 6.0),
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
			var cur_r := lerpf(24.0, max_r, 1.0 - pow(1.0 - p, 2.2))
			_draw_glow(pos, cur_r * 1.25, cur_r * 0.78, Color(edge_c.r, edge_c.g, edge_c.b, 0.62 * fade))
			var cracks: Array = fx.get("cracks", [])
			for cr_pts: PackedVector2Array in cracks:
				var shifted := PackedVector2Array()
				for pt: Vector2 in cr_pts:
					shifted.append(pos + pt * clampf(p * 2.2, 0.25, 1.0))
				draw_polyline(shifted, Color(edge_c.r, edge_c.g, edge_c.b, 0.78 * fade), 4.6 * fade + 1.0, true)
				draw_polyline(shifted, Color(core_c.r, core_c.g, core_c.b, 0.92 * fade), 2.0 * fade + 0.6, true)
			draw_set_transform(pos, 0.0, Vector2(1.0, 0.54))
			draw_arc(Vector2.ZERO, cur_r, 0.0, TAU, 36, Color(edge_c.r, edge_c.g, edge_c.b, 0.96 * fade), 9.5 * fade + 2.2, true)
			draw_arc(Vector2.ZERO, cur_r * 0.85, 0.0, TAU, 32, Color(main_c.r, main_c.g, main_c.b, 0.94 * fade), 5.0 * fade + 1.5, true)
			draw_arc(Vector2.ZERO, cur_r * 0.66, 0.0, TAU, 28, Color(core_c.r, core_c.g, core_c.b, 0.98 * fade), 3.0 * fade + 1.0, true)
			draw_set_transform(Vector2.ZERO)
			for sp: Dictionary in fx["sparks"]:
				var sp_p := pos + (sp["dir"] as Vector2) * (float(sp["spd"]) * age) + Vector2(0.0, -22.0 * p)
				draw_circle(sp_p, float(sp["sz"]) * (1.0 - p * 0.50) + 1.5, Color(edge_c.r, edge_c.g, edge_c.b, 0.86 * fade))
				draw_circle(sp_p, float(sp["sz"]) * (1.0 - p * 0.55), Color(core_c.r, core_c.g, core_c.b, 0.96 * fade))

		elif kind == "teleport":
			var pos: Vector2 = fx["pos"]
			var edge_c: Color = fx["edge"]
			var bw := lerpf(42.0, 12.0, p)
			var bh := 260.0 * (1.0 - p * 0.25)
			_draw_glow(pos + Vector2(0.0, -bh * 0.42), bw * 2.2, bh * 0.60, Color(main_c.r, main_c.g, main_c.b, 0.62 * fade))
			_draw_glow(pos + Vector2(0.0, -bh * 0.38), bw * 0.85, bh * 0.54, Color(core_c.r, core_c.g, core_c.b, 0.92 * fade))
			draw_set_transform(pos, 0.0, Vector2(1.0, 0.48))
			var tr1 := lerpf(16.0, 88.0, 1.0 - pow(1.0 - p, 2.0))
			draw_arc(Vector2.ZERO, tr1, 0.0, TAU, 32, Color(main_c.r, main_c.g, main_c.b, 0.94 * fade), 5.0 * fade + 1.5, true)
			draw_arc(Vector2.ZERO, tr1 * 0.68, 0.0, TAU, 24, Color(edge_c.r, edge_c.g, edge_c.b, 0.88 * fade), 3.0 * fade + 1.0, true)
			draw_set_transform(Vector2.ZERO)
			for m: Dictionary in fx["motes"]:
				var a := float(m["ang"]) + p * 4.2
				var r := float(m["rad"]) * (1.0 - p * 0.45)
				var mp := pos + Vector2(cos(a) * r, sin(a) * r * 0.48 - float(m["rise"]) * p)
				draw_circle(mp, float(m["sz"]) * (1.0 - p * 0.5) + 1.2, Color(main_c.r, main_c.g, main_c.b, 0.85 * fade))
				draw_circle(mp, float(m["sz"]) * (1.0 - p * 0.5), Color(core_c.r, core_c.g, core_c.b, 0.98 * fade))

		elif kind == "pillar":
			var pos: Vector2 = fx["pos"]
			var edge_c: Color = fx["edge"]
			# Stage 1 (p < 0.24): Inward Ki Convergence Implosion
			if p < 0.24:
				var imp := p / 0.24
				var imp_r := lerpf(210.0, 22.0, imp * imp)
				draw_set_transform(pos, 0.0, Vector2(1.0, 0.50))
				draw_arc(Vector2.ZERO, imp_r, 0.0, TAU, 40, Color(main_c.r, main_c.g, main_c.b, (1.0 - imp * 0.25) * 0.72), 4.0, true)
				draw_arc(Vector2.ZERO, imp_r * 0.65, 0.0, TAU, 32, Color(core_c.r, core_c.g, core_c.b, 0.80), 2.0, true)
				draw_set_transform(Vector2.ZERO)
				for si in 14:
					var sa := (float(si) / 14.0) * TAU + imp * 1.4
					_draw_tapered_ray(pos + Vector2(cos(sa) * imp_r * 0.45, sin(sa) * imp_r * 0.22 - 30.0), sa, imp_r * 0.72, 3.8, Color(core_c.r, core_c.g, core_c.b, 0.65), 0.52)

			# Stage 2 & 3: Additive Plasma Pillar, Roaring Feathered Flame Wisps, Starburst, Ground Cracks & Crisp Lightning
			var beam_p := clampf((p - 0.06) / 0.94, 0.0, 1.0)
			var beam_fade := pow(1.0 - beam_p, 1.25)
			var grow := sin(minf(beam_p * 3.4, 1.0) * PI * 0.5)

			# 14 Fractured glowing ground cracks radiating outward
			var cracks: Array = fx.get("cracks", [])
			for cr_pts: PackedVector2Array in cracks:
				var shifted := PackedVector2Array()
				for pt: Vector2 in cr_pts:
					shifted.append(pos + pt * clampf(beam_p * 3.2, 0.20, 1.0))
				draw_polyline(shifted, Color(edge_c.r, edge_c.g, edge_c.b, 0.58 * beam_fade), 3.4 * beam_fade + 0.8, true)
				draw_polyline(shifted, Color(core_c.r, core_c.g, core_c.b, 0.78 * beam_fade), 1.4 * beam_fade + 0.4, true)

			# Triple expanding crater shockwave rings + rotating ground Ki rune circle
			draw_set_transform(pos, 0.0, Vector2(1.0, 0.50))
			var cr_r1 := lerpf(32.0, 265.0, 1.0 - pow(1.0 - beam_p, 2.5))
			var cr_r2 := lerpf(20.0, 195.0, 1.0 - pow(1.0 - beam_p, 1.9))
			_draw_glow(Vector2.ZERO, cr_r2 * 1.15, cr_r2 * 1.15, Color(edge_c.r, edge_c.g, edge_c.b, 0.44 * beam_fade))
			draw_arc(Vector2.ZERO, cr_r1, 0.0, TAU, 48, Color(edge_c.r, edge_c.g, edge_c.b, 0.74 * beam_fade), 6.5 * beam_fade + 1.5, true)
			draw_arc(Vector2.ZERO, cr_r2, 0.0, TAU, 40, Color(main_c.r, main_c.g, main_c.b, 0.82 * beam_fade), 4.0 * beam_fade + 1.0, true)
			draw_arc(Vector2.ZERO, cr_r2 * 0.62, 0.0, TAU, 32, Color(core_c.r, core_c.g, core_c.b, 0.90 * beam_fade), 2.2 * beam_fade + 0.6, true)
			for seg in 8:
				var ra0 := age * 3.8 + float(seg) * (TAU / 8.0)
				draw_arc(Vector2.ZERO, 86.0 * grow + 14.0, ra0, ra0 + 0.44, 8, Color(core_c.r, core_c.g, core_c.b, 0.88 * beam_fade), 2.8, true)
			draw_set_transform(Vector2.ZERO)

			# Towering 500px additive multi-layer sky plasma beam
			var pw := lerpf(38.0, 136.0, grow) * (1.0 - beam_p * 0.42) * (1.0 + sin(age * 28.0) * 0.08)
			var ph := 500.0 * clampf(beam_p * 4.5, 0.35, 1.0)
			_draw_glow(pos + Vector2(0.0, -ph * 0.46), pw * 2.4, ph * 0.68, Color(edge_c.r, edge_c.g, edge_c.b, 0.56 * beam_fade))
			_draw_glow(pos + Vector2(0.0, -ph * 0.44), pw * 1.25, ph * 0.62, Color(main_c.r, main_c.g, main_c.b, 0.68 * beam_fade))
			_draw_glow(pos + Vector2(0.0, -ph * 0.40), pw * 0.48, ph * 0.54, Color(core_c.r, core_c.g, core_c.b, 0.82 * beam_fade))

			# 18 Roaring feathered plasma flame wisps shooting skyward around the hero!
			if _wisp_tex != null:
				for wi in 18:
					var h0 := fposmod(sin(float(wi * 83 + 17)) * 43758.5453, 1.0)
					var h1 := fposmod(sin(float(wi * 173 + 29)) * 43758.5453, 1.0)
					var wph := fposmod(beam_p * (1.6 + 0.9 * h0) + h1 * 0.55, 1.0)
					var side_f := (h0 - 0.5) * 2.0
					var wx := pos.x + side_f * (pw * (0.35 + 0.82 * (1.0 - wph * 0.45))) + sin(wph * 9.0 + float(wi)) * 10.0
					var wy := pos.y - 12.0 - wph * (ph * 0.78)
					var ww := (1.0 - wph * 0.42) * (42.0 + 28.0 * h1)
					var wh := (1.0 - wph * 0.28) * (105.0 + 68.0 * h0)
					var wcol := edge_c.lerp(main_c, wph * 0.65)
					wcol.a = sin(wph * PI) * 0.68 * beam_fade
					draw_texture_rect(_wisp_tex, Rect2(wx - ww * 0.5, wy - wh * 0.75, ww, wh), false, wcol)

			# Blinding razor-tapered 12-ray anime starburst lens flare at detonation peak
			if beam_p < 0.52:
				var fl_a := sin((beam_p / 0.52) * PI)
				var fc := pos + Vector2(0.0, -48.0)
				_draw_glow(fc, 195.0 * (0.6 + beam_p), 155.0 * (0.6 + beam_p), Color(main_c.r, main_c.g, main_c.b, 0.52 * fl_a))
				_draw_glow(fc, 95.0 * (0.6 + beam_p), 80.0 * (0.6 + beam_p), Color(core_c.r, core_c.g, core_c.b, 0.78 * fl_a))
				for ray_i in 12:
					var ra := float(ray_i) * (TAU / 12.0) + age * 1.1
					var is_major := (ray_i % 2 == 0)
					var rlen := (235.0 if is_major else 135.0) * (0.55 + fl_a * 0.65)
					var hw := (11.0 if is_major else 6.0) * fl_a
					_draw_tapered_ray(fc, ra, rlen, hw, Color(main_c.r, main_c.g, main_c.b, 0.48 * fl_a), 0.72)
					_draw_tapered_ray(fc, ra, rlen * 0.82, hw * 0.40, Color(core_c.r, core_c.g, core_c.b, 0.85 * fl_a), 0.72)

			# Sleek luminous double-helix plasma coils spiraling upward
			for strand in 2:
				var hpts := PackedVector2Array()
				for hi in 32:
					var frac := float(hi) / 31.0
					var ha := frac * 13.0 - age * 15.0 + float(strand) * PI
					var hrad := lerpf(pw * 1.05, pw * 0.36, frac)
					hpts.append(pos + Vector2(cos(ha) * hrad, -10.0 - frac * ph))
				draw_polyline(hpts, Color(main_c.r, main_c.g, main_c.b, 0.52 * beam_fade), 4.6 * beam_fade + 1.0, true)
				draw_polyline(hpts, Color(core_c.r, core_c.g, core_c.b, 0.82 * beam_fade), 1.7 * beam_fade + 0.5, true)

			# 14 Crisp razor-sharp live-crackling Ki lightning arcs (vertical + ground snaps)
			var tick := int(age * 16.0)
			for bd: Dictionary in fx["bolts"]:
				var bseed := int(bd["seed"])
				var pts := PackedVector2Array()
				if bool(bd.get("is_ground", false)):
					var ga := float(bd["ground_ang"]) + sin(age * 3.0 + float(bseed)) * 0.15
					var gr := float(bd["ground_r"]) * (0.45 + 0.65 * grow)
					var g_end := pos + Vector2(cos(ga) * gr, sin(ga) * gr * 0.50)
					var g_start := pos + Vector2(cos(ga) * 20.0, -54.0)
					var perp := (g_end - g_start).orthogonal().normalized()
					pts.append(g_start)
					for seg in range(1, 6):
						var frac := float(seg) / 6.0
						var h_j := fposmod(sin(float(bseed * 17 + seg * 43 + tick * 61)) * 43758.5453, 1.0)
						pts.append(g_start.lerp(g_end, frac) + perp * ((h_j - 0.5) * 32.0))
					pts.append(g_end)
				else:
					var bx := float(bd["bx"]) * (0.55 + 0.55 * grow)
					var bh := float(bd["bh"])
					for seg in 10:
						var frac := float(seg) / 9.0
						var h_j := fposmod(sin(float(bseed * 23 + seg * 31 + tick * 59)) * 43758.5453, 1.0)
						pts.append(pos + Vector2(bx + (h_j - 0.5) * 38.0, -frac * bh))
				draw_polyline(pts, Color(main_c.r, main_c.g, main_c.b, 0.60 * beam_fade), 3.6 * beam_fade + 0.9, true)
				draw_polyline(pts, Color(core_c.r, core_c.g, core_c.b, 0.94 * beam_fade), 1.4 * beam_fade + 0.5, true)

			# 18 Glowing levitating magma/Ki rock shards rising in the updraft
			for rk: Dictionary in fx.get("rocks", []):
				var rp := clampf((p - float(rk["delay"])) / maxf(1.0 - float(rk["delay"]), 0.1), 0.0, 1.0)
				if rp <= 0.0:
					continue
				var r_fade := sin(rp * PI)
				var ra := float(rk["ang"]) + rp * 0.7
				var rrad := float(rk["rad"]) * (0.82 + rp * 0.32)
				var rpos := pos + Vector2(cos(ra) * rrad, sin(ra) * rrad * 0.50 - float(rk["rise"]) * pow(rp, 0.80))
				var rsz := float(rk["sz"]) * (1.0 - rp * 0.25)
				var rrot := float(rk["rot"]) + float(rk["spin"]) * age
				var poly := PackedVector2Array()
				for v in 5:
					var va := rrot + float(v) * (TAU / 5.0)
					var vr := rsz * (1.0 if v % 2 == 0 else 0.68)
					poly.append(rpos + Vector2(cos(va) * vr, sin(va) * vr))
				_draw_glow(rpos, rsz * 2.2, rsz * 2.2, Color(edge_c.r, edge_c.g, edge_c.b, 0.42 * r_fade))
				draw_colored_polygon(poly, Color(edge_c.r * 0.65, edge_c.g * 0.55, edge_c.b * 0.45, 0.72 * r_fade))
				poly.append(poly[0])
				draw_polyline(poly, Color(core_c.r, core_c.g, core_c.b, 0.90 * r_fade), 1.6, true)

			# 42 Soaring spiraling Ki flame embers shooting skyward
			for em: Dictionary in fx.get("embers", []):
				var ep := clampf((p - float(em["delay"])) / maxf(1.0 - float(em["delay"]), 0.1), 0.0, 1.0)
				if ep <= 0.0:
					continue
				var efade := pow(1.0 - ep, 1.15)
				var ea := float(em["ang"]) + float(em["swirl"]) * ep
				var erad := float(em["rad"]) * (1.0 - ep * 0.35)
				var epos := pos + Vector2(cos(ea) * erad, sin(ea) * erad * 0.48 - float(em["rise"]) * ep)
				var esz := float(em["sz"]) * (1.0 - ep * 0.45)
				_draw_glow(epos, esz * 2.8, esz * 2.8, Color(main_c.r, main_c.g, main_c.b, 0.68 * efade))
				draw_circle(epos, maxf(1.2, esz * 0.65), Color(core_c.r, core_c.g, core_c.b, 0.92 * efade))

		elif kind == "impact":
			var pos: Vector2 = fx["pos"]
			var is_c: bool = bool(fx["crit"])
			var rad := (72.0 if is_c else 46.0) * (0.65 + p * 0.75)
			_draw_glow(pos, rad * 1.15, rad * 1.15, Color(main_c.r, main_c.g, main_c.b, 0.84 * fade))
			draw_arc(pos, rad * 0.65, 0.0, TAU, 24, Color(core_c.r, core_c.g, core_c.b, 0.98 * fade), 4.2 if is_c else 2.8, true)
			if is_c:
				var fl := rad * 0.95 * (1.0 - p * 0.35)
				draw_line(pos - Vector2(fl, 0.0), pos + Vector2(fl, 0.0), Color(core_c.r, core_c.g, core_c.b, 0.95 * fade), 4.2 * fade, true)
				draw_line(pos - Vector2(0.0, fl), pos + Vector2(0.0, fl), Color(core_c.r, core_c.g, core_c.b, 0.95 * fade), 4.2 * fade, true)
			for sp: Dictionary in fx["sparks"]:
				var sp_p := pos + (sp["dir"] as Vector2) * (float(sp["spd"]) * age)
				draw_circle(sp_p, float(sp["sz"]) * (1.0 - p * 0.55) + 1.0, Color(main_c.r, main_c.g, main_c.b, 0.80 * fade))
				draw_circle(sp_p, float(sp["sz"]) * (1.0 - p * 0.6), Color(core_c.r, core_c.g, core_c.b, 0.96 * fade))

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
