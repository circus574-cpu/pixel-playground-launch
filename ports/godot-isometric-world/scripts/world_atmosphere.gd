extends Control
## Living Atmospheric World Layer:
## Drifting FBM cloud shadows, 4-phase Time-of-Day cycle ([T]: Dzień / Złota Godzina / Zmierzch / Noc),
## rich biome-specific weather particles (Pyra ash & glowing embers, Verdantia golden fireflies & leaves,
## Aetheria sakura petals & snow flurries, Nexus-9 holographic rain & cyan sparks), plus drifting sky birds/wisps!

const TIME_MODES := [
	{"id": "day", "label": "Dzień", "tint": Color(1.0, 0.98, 0.92, 0.0), "cloud": 0.10},
	{"id": "golden", "label": "Złota Godzina", "tint": Color(1.0, 0.62, 0.24, 0.14), "cloud": 0.12},
	{"id": "dusk", "label": "Zmierzch", "tint": Color(0.24, 0.16, 0.42, 0.22), "cloud": 0.14},
	{"id": "night", "label": "Noc", "tint": Color(0.04, 0.07, 0.18, 0.34), "cloud": 0.07},
]

var world: Node2D
var cloud_rect := ColorRect.new()
var cloud_mat := ShaderMaterial.new()
var time_idx := 0
var land_id := "pyra"
var particles: Array[Dictionary] = []
var flyers: Array[Dictionary] = []
var _redraw_acc := 0.0

func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE

	cloud_mat.shader = load("res://shaders/cloud_shadows.gdshader")
	cloud_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	cloud_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	cloud_rect.material = cloud_mat
	add_child(cloud_rect)

	_seed_particles()
	apply_time_mode()

func _seed_particles() -> void:
	particles.clear()
	flyers.clear()
	var rng := RandomNumberGenerator.new()
	rng.seed = 20261122
	for i in 28:
		particles.append({
			"x": rng.randf(),
			"y": rng.randf(),
			"vx": rng.randf_range(-0.028, 0.032),
			"vy": rng.randf_range(0.018, 0.068),
			"sz": rng.randf_range(2.2, 5.0),
			"ph": rng.randf_range(0.0, TAU),
			"kind": i % 3,
		})
	# Ambient flocks of distant sky birds / luminous forest butterflies / floating holo-drones
	for j in 4:
		flyers.append({
			"x": rng.randf(),
			"y": rng.randf_range(0.10, 0.78),
			"vx": rng.randf_range(0.035, 0.075) * (1.0 if j % 2 == 0 else -1.0),
			"vy": rng.randf_range(-0.008, 0.008),
			"wing": rng.randf_range(0.0, TAU),
			"sz": rng.randf_range(6.5, 10.5),
		})

func set_region(new_land: String) -> void:
	land_id = new_land
	queue_redraw()

func set_time_mode(idx: int) -> String:
	time_idx = posmod(idx, TIME_MODES.size())
	apply_time_mode()
	return str(TIME_MODES[time_idx]["label"])

func cycle_time_mode() -> String:
	return set_time_mode(time_idx + 1)

func current_time_label() -> String:
	return str(TIME_MODES[time_idx]["label"])

func apply_time_mode() -> void:
	var tm: Dictionary = TIME_MODES[time_idx]
	cloud_mat.set_shader_parameter("tint_color", tm["tint"])
	cloud_mat.set_shader_parameter("intensity", float(tm["cloud"]))
	queue_redraw()

func _process(delta: float) -> void:
	if not visible:
		return
	_redraw_acc += delta
	if _redraw_acc < 0.042:
		return
	var step := _redraw_acc
	_redraw_acc = 0.0
	var dir_y := -1.0 if (land_id == "pyra" or land_id == "nexus") else 1.0
	for p: Dictionary in particles:
		p["x"] = fposmod(float(p["x"]) + float(p["vx"]) * step + 1.0, 1.0)
		p["y"] = fposmod(float(p["y"]) + float(p["vy"]) * dir_y * step + 1.0, 1.0)
		p["ph"] = float(p["ph"]) + step * 2.6
	for fl: Dictionary in flyers:
		fl["x"] = fposmod(float(fl["x"]) + float(fl["vx"]) * step + 1.0, 1.0)
		fl["y"] = clampf(float(fl["y"]) + sin(float(fl["wing"]) * 0.45) * 0.012 * step, 0.08, 0.84)
		fl["wing"] = float(fl["wing"]) + step * 7.8
	queue_redraw()

func _draw() -> void:
	var s := size
	if s.x < 10.0 or s.y < 10.0:
		return
	for p: Dictionary in particles:
		var px := float(p["x"]) * s.x
		var py := float(p["y"]) * s.y
		var ph := float(p["ph"])
		var sz := float(p["sz"])
		var k := int(p["kind"])
		var pulse := 0.48 + 0.52 * sin(ph)
		var pos := Vector2(px + sin(ph * 0.75) * 11.0, py)

		match land_id:
			"pyra":
				if k == 0:
					draw_circle(pos, sz * 2.2, Color(1.0, 0.32, 0.05, 0.22 * pulse))
					draw_circle(pos, sz * 0.72, Color(1.0, 0.86, 0.34, 0.88 * pulse))
				else:
					draw_circle(pos, sz * 1.15, Color(0.24, 0.18, 0.16, 0.42 * pulse))
			"verdant":
				if k == 0:
					draw_circle(pos, sz * 2.4, Color(0.68, 1.0, 0.38, 0.20 * pulse))
					draw_circle(pos, sz * 0.70, Color(1.0, 0.98, 0.65, 0.86 * pulse))
				else:
					var ang := ph * 0.9
					var dvec := Vector2(cos(ang), sin(ang)) * sz
					draw_line(pos - dvec, pos + dvec, Color(0.46, 0.88, 0.36, 0.62 * pulse), 2.2, true)
			"aether":
				if k == 0:
					var ang := ph * 0.8
					var dvec := Vector2(cos(ang), sin(ang)) * (sz * 1.1)
					draw_line(pos - dvec, pos + dvec, Color(1.0, 0.74, 0.86, 0.78 * pulse), 2.6, true)
				else:
					draw_circle(pos, sz * 1.5, Color(0.76, 0.94, 1.0, 0.20 * pulse))
					draw_circle(pos, sz * 0.78, Color(0.94, 0.99, 1.0, 0.80 * pulse))
			"nexus":
				draw_circle(pos, sz * 2.1, Color(0.12, 0.88, 1.0, 0.20 * pulse))
				draw_rect(Rect2(pos - Vector2(sz * 0.55, sz * 0.55), Vector2(sz * 1.1, sz * 1.1)), Color(0.42, 0.98, 1.0, 0.82 * pulse))

	# Ambient sky wildlife (gliding birds / glowing butterflies / micro-drones)
	for fl: Dictionary in flyers:
		var fx := float(fl["x"]) * s.x
		var fy := float(fl["y"]) * s.y
		var w := float(fl["sz"])
		var flap := sin(float(fl["wing"])) * w * 0.58
		var fpos := Vector2(fx, fy)
		match land_id:
			"pyra":
				# Ash-hawks gliding in thermals
				var col := Color(0.18, 0.10, 0.08, 0.62)
				draw_line(fpos + Vector2(-w, -flap), fpos, col, 2.2, true)
				draw_line(fpos, fpos + Vector2(w, -flap), col, 2.2, true)
			"verdant":
				# Bright forest butterflies / songbirds
				var col := Color(1.0, 0.88, 0.34, 0.75)
				draw_circle(fpos + Vector2(-w * 0.38, -flap * 0.4), w * 0.34, col)
				draw_circle(fpos + Vector2(w * 0.38, -flap * 0.4), w * 0.34, col)
			"aether":
				# Pale frost-cranes / spirit wisps gliding across the snow
				var col := Color(0.86, 0.96, 1.0, 0.66)
				draw_line(fpos + Vector2(-w * 1.1, -flap), fpos, col, 2.0, true)
				draw_line(fpos, fpos + Vector2(w * 1.1, -flap), col, 2.0, true)
			"nexus":
				# Tiny cyan patrol micro-drones blinking overhead
				draw_circle(fpos, w * 0.55, Color(0.16, 0.92, 1.0, 0.24))
				draw_circle(fpos, 2.4, Color(0.68, 0.98, 1.0, 0.86))
