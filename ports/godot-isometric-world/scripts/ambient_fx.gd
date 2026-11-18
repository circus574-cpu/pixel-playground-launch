extends Node2D
## Life on the scenery: flames and smoke over fires and braziers, mist over springs and vents, embers over lava rock, glints on
## crystals and energy pylons, warm halos around lamps.

static var night := 0.15

const RULES := [
	["lava-rocks", "ember"], ["sulfur-vent", "steam"], ["geyser", "steam"], ["spring", "steam"], ["fountain", "steam"], ["waterfall", "steam"],
	["bonfire", "fire"], ["brazier", "fire"], ["forge", "fire"], ["-fire", "fire"], ["camp", "fire"],
	["lantern", "lamp"], ["-lamp", "lamp"], ["pylon", "spark"], ["reactor", "spark"], ["crystal", "spark"], ["terminal", "spark"],
]

var kind := "fire"
var tone := Color(1.0, 0.6, 0.25)
var age := randf() * 10.0
var seed_value := randf() * 100.0

static func kind_for(path: String) -> String:
	var name := path.get_file().to_lower()
	for rule: Array in RULES:
		if name.contains(str(rule[0])):
			return str(rule[1])
	return ""

static func create(effect: String, at: Vector2, source_path: String) -> Node2D:
	var self_script: GDScript = load("res://scripts/ambient_fx.gd")
	var fx = self_script.new()
	fx.kind = effect
	fx.position = at
	var name := source_path.to_lower()
	match effect:
		"fire":
			fx.tone = Color(1.0, 0.55, 0.2)
		"lamp":
			fx.tone = Color(1.0, 0.82, 0.45)
		"steam":
			fx.tone = Color(0.92, 0.96, 1.0)
		"ember":
			fx.tone = Color(1.0, 0.4, 0.12)
		"spark":
			if name.contains("nexus") or name.contains("pylon") or name.contains("reactor") or name.contains("terminal"):
				fx.tone = Color(0.35, 0.92, 1.0)
			elif name.contains("aether"):
				fx.tone = Color(0.75, 0.72, 1.0)
			else:
				fx.tone = Color(0.7, 0.95, 1.0)
	var enabler := VisibleOnScreenEnabler2D.new()
	enabler.rect = Rect2(-180, -280, 360, 360)
	fx.add_child(enabler)
	return fx

func _process(delta: float) -> void:
	age += delta
	queue_redraw()

static var soft_texture: Texture2D

static func soft() -> Texture2D:
	if soft_texture == null:
		var radial := GradientTexture2D.new()
		radial.fill = GradientTexture2D.FILL_RADIAL
		radial.fill_from = Vector2(0.5, 0.5)
		radial.fill_to = Vector2(1.0, 0.5)
		radial.width = 96
		radial.height = 96
		var gradient := Gradient.new()
		gradient.colors = PackedColorArray([Color(1, 1, 1, 1), Color(1, 1, 1, 0.55), Color(1, 1, 1, 0)])
		gradient.offsets = PackedFloat32Array([0.0, 0.45, 1.0])
		radial.gradient = gradient
		soft_texture = radial
	return soft_texture

func blob(at: Vector2, radius: float, color: Color) -> void:
	draw_texture_rect(soft(), Rect2(at - Vector2(radius, radius), Vector2(radius, radius) * 2.0), false, color)

func _draw() -> void:
	var glow_boost := 1.0 + night * 0.9
	match kind:
		"fire":
			var flicker := 0.75 + 0.25 * sin(age * 11.0 + seed_value) + 0.1 * sin(age * 23.0)
			blob(Vector2(0, -24), 78.0 * flicker, Color(tone.r, tone.g, tone.b, 0.34 * glow_boost))
			blob(Vector2(0, -28), 34.0 * flicker, Color(1.0, 0.85, 0.5, 0.58 * glow_boost))
			for i in 7:
				var t := fposmod(age * 0.7 + float(i) / 7.0 + seed_value, 1.0)
				var drift := sin(age * 2.0 + float(i) * 1.7) * 10.0 * t
				blob(Vector2(drift, -34.0 - 130.0 * t), 12.0 + 26.0 * t, Color(0.3, 0.29, 0.3, 0.34 * (1.0 - t)))
			for i in 4:
				var t2 := fposmod(age * 1.3 + float(i) * 0.27 + seed_value, 1.0)
				blob(Vector2(sin(age * 3.0 + float(i)) * 8.0, -28.0 - 70.0 * t2), 4.5, Color(1.0, 0.7, 0.3, 1.0 * (1.0 - t2)))
		"lamp":
			var glow := 0.85 + 0.15 * sin(age * 4.0 + seed_value)
			blob(Vector2(0, -58), 82.0 * glow, Color(tone.r, tone.g, tone.b, 0.28 * glow_boost))
			blob(Vector2(0, -58), 26.0, Color(1.0, 0.95, 0.75, 0.55 * glow_boost))
		"steam":
			for i in 6:
				var t := fposmod(age * 0.35 + float(i) / 6.0 + seed_value, 1.0)
				var sway := sin(age * 1.4 + float(i) * 2.1) * 14.0 * t
				blob(Vector2(sway, -10.0 - 120.0 * t), 18.0 + 34.0 * t, Color(tone.r, tone.g, tone.b, 0.36 * (1.0 - t)))
		"ember":
			blob(Vector2(0, -12), 62.0, Color(tone.r, tone.g, tone.b, 0.28 * glow_boost))
			for i in 6:
				var t := fposmod(age * 0.5 + float(i) * 0.19 + seed_value, 1.0)
				blob(Vector2(sin(age + float(i) * 2.4) * 18.0, -10.0 - 100.0 * t), 5.0, Color(1.0, 0.6, 0.25, 1.0 * (1.0 - t)))
		"spark":
			var pulse := 0.5 + 0.5 * sin(age * 2.2 + seed_value)
			blob(Vector2(0, -36), 72.0, Color(tone.r, tone.g, tone.b, (0.14 + 0.20 * pulse) * glow_boost))
			for i in 3:
				var t := fposmod(age * 0.8 + float(i) / 3.0 + seed_value, 1.0)
				blob(Vector2(sin(seed_value + float(i) * 2.0) * 24.0, -20.0 - 80.0 * t), 5.5, Color(1.0, 1.0, 1.0, 0.95 * (1.0 - t)))
