extends Control
## Etap 3 — Atmospheric World Layer:
## Drifting FBM cloud shadows, 4-phase Time-of-Day cycle ([T]: Dzień / Złota Godzina / Zmierzch / Noc),
## and live biome-specific ambient weather particles (Pyra embers, Verdantia golden fireflies & leaves,
## Aetheria sakura petals & alpine snow motes, Nexus-9 cyan holographic data motes).

const TIME_MODES := [
	{"id": "day", "label": "Dzień", "tint": Color(1.0, 0.98, 0.92, 0.0), "cloud": 0.09},
	{"id": "golden", "label": "Złota Godzina", "tint": Color(1.0, 0.62, 0.24, 0.12), "cloud": 0.11},
	{"id": "dusk", "label": "Zmierzch", "tint": Color(0.24, 0.16, 0.42, 0.22), "cloud": 0.13},
	{"id": "night", "label": "Noc", "tint": Color(0.04, 0.07, 0.18, 0.34), "cloud": 0.06},
]

var world: Node2D
var cloud_rect := ColorRect.new()
var cloud_mat := ShaderMaterial.new()
var time_idx := 0
var land_id := "pyra"
var particles: Array[Dictionary] = []

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
	var rng := RandomNumberGenerator.new()
	rng.seed = 20261118
	for i in 48:
		particles.append({
			"x": rng.randf(),
			"y": rng.randf(),
			"vx": rng.randf_range(-0.022, 0.022),
			"vy": rng.randf_range(0.015, 0.055),
			"sz": rng.randf_range(2.0, 4.8),
			"ph": rng.randf_range(0.0, TAU),
		})

func set_region(new_land: String) -> void:
	land_id = new_land
	queue_redraw()

func cycle_time_mode() -> String:
	time_idx = (time_idx + 1) % TIME_MODES.size()
	apply_time_mode()
	return str(TIME_MODES[time_idx]["label"])

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
	var dir_y := -1.0 if (land_id == "pyra" or land_id == "nexus") else 1.0
	for p: Dictionary in particles:
		p["x"] = fposmod(float(p["x"]) + float(p["vx"]) * delta + 1.0, 1.0)
		p["y"] = fposmod(float(p["y"]) + float(p["vy"]) * dir_y * delta + 1.0, 1.0)
		p["ph"] = float(p["ph"]) + delta * 2.4
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
		var pulse := 0.45 + 0.55 * sin(ph)
		var pos := Vector2(px + sin(ph * 0.7) * 8.0, py)

		match land_id:
			"pyra":
				# Glowing volcanic embers & rising ash sparks
				draw_circle(pos, sz * 1.6, Color(1.0, 0.36, 0.06, 0.16 * pulse))
				draw_circle(pos, sz * 0.65, Color(1.0, 0.78, 0.24, 0.78 * pulse))
			"verdant":
				# Warm golden fireflies & forest pollen motes
				draw_circle(pos, sz * 1.9, Color(0.72, 1.0, 0.42, 0.14 * pulse))
				draw_circle(pos, sz * 0.65, Color(1.0, 0.96, 0.62, 0.72 * pulse))
			"aether":
				# Delicate sakura petals & sparkling alpine snow motes
				var is_petal := int(ph * 10.0) % 3 == 0
				if is_petal:
					draw_circle(pos, sz * 0.9, Color(1.0, 0.74, 0.84, 0.68 * pulse))
				else:
					draw_circle(pos, sz * 0.75, Color(0.88, 0.96, 1.0, 0.62 * pulse))
			"nexus":
				# Floating cyan holographic data motes
				draw_circle(pos, sz * 1.7, Color(0.14, 0.86, 1.0, 0.14 * pulse))
				draw_rect(Rect2(pos - Vector2(sz * 0.5, sz * 0.5), Vector2(sz, sz)), Color(0.36, 0.96, 1.0, 0.70 * pulse))
