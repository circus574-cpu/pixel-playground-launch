class_name PyraFx
extends Node2D
## Short-lived combat effects drawn with primitives: slash arcs, bursts, auras and floating damage.

var kind := "burst"
var radius := 150.0
var ability := ""
var age := 0.0
var life := 0.5
var facing := Vector2.RIGHT
var color := Color("ff8a3d")

static func spawn(parent: Node, effect_kind: String, at: Vector2, effect_radius: float, effect_ability: String, face: Vector2 = Vector2.RIGHT) -> PyraFx:
	var fx := PyraFx.new()
	fx.kind = effect_kind
	fx.radius = effect_radius
	fx.ability = effect_ability
	fx.facing = face if face.length_squared() > 0.0 else Vector2.RIGHT
	fx.position = at
	match effect_kind:
		"burst":
			fx.life = 0.6
		"buff":
			fx.life = 1.0
		"swing":
			fx.life = 0.22
		"slash":
			fx.life = 0.26
		"dash":
			fx.life = 0.3
	if effect_ability.begins_with("C"):
		fx.color = Color("ff6a1f")
	elif effect_ability.begins_with("B"):
		fx.color = Color("ffd05a")
	elif effect_ability == "T":
		fx.color = Color("ffb347")
	parent.add_child(fx)
	return fx

func _process(delta: float) -> void:
	age += delta
	if age >= life:
		queue_free()
	queue_redraw()

func _draw() -> void:
	var t := clampf(age / life, 0.0, 1.0)
	var alpha := 1.0 - t
	match kind:
		"burst":
			var r := radius * (0.25 + 0.75 * t)
			draw_circle(Vector2(0, -40), r, Color(color.r, color.g, color.b, 0.22 * alpha))
			draw_arc(Vector2(0, -40), r, 0, TAU, 56, Color(1.0, 0.85, 0.5, 0.9 * alpha), 8.0 * alpha + 1.0, true)
			for i in 14:
				var a := TAU * float(i) / 14.0 + t * 1.4
				draw_circle(Vector2(0, -40) + Vector2.from_angle(a) * r * (0.55 + 0.4 * fmod(float(i) * 0.37, 1.0)), 7.0 * alpha, Color(1.0, 0.6, 0.2, alpha))
		"buff":
			var h := 190.0 * t
			draw_arc(Vector2(0, -2), radius * (0.5 + 0.5 * sin(t * PI)), 0, TAU, 40, Color(color.r, color.g, color.b, 0.8 * alpha), 5.0, true)
			for i in 10:
				var a2 := TAU * float(i) / 10.0
				draw_circle(Vector2(cos(a2) * 46.0, -h * (0.4 + 0.6 * fmod(float(i) * 0.23, 1.0)) - 10.0), 6.0 * alpha, Color(1.0, 0.7, 0.3, alpha))
		"swing", "slash":
			var base := facing.angle()
			var sweep := lerpf(-1.1, 1.1, t)
			draw_arc(Vector2(0, -52), 92.0, base + sweep - 0.7, base + sweep + 0.7, 18, Color(1.0, 0.82, 0.45, alpha), 10.0 * (1.0 - t * 0.5), true)
			draw_arc(Vector2(0, -52), 86.0, base + sweep - 0.55, base + sweep + 0.55, 18, Color(1.0, 0.45, 0.15, alpha * 0.8), 5.0, true)
		"dash":
			draw_line(Vector2.ZERO, -facing * 120.0 * (1.0 - t), Color(1.0, 0.6, 0.25, alpha * 0.8), 18.0 * alpha, true)

## Floating damage number rising from a point.
static func number(parent: Node, at: Vector2, amount: int, crit: bool) -> void:
	var label := Label.new()
	label.text = ("%d!" % amount) if crit else str(amount)
	label.add_theme_font_size_override("font_size", 34 if crit else 26)
	label.add_theme_color_override("font_color", Color("ffd23f") if crit else Color("ffffff"))
	label.add_theme_color_override("font_outline_color", Color(0.15, 0.03, 0.02, 0.95))
	label.add_theme_constant_override("outline_size", 8)
	label.position = at + Vector2(randf_range(-34, 34) - 30, -210)
	label.z_index = 4000
	parent.add_child(label)
	var tween := label.create_tween()
	tween.set_parallel(true)
	tween.tween_property(label, "position:y", label.position.y - 80, 0.8)
	tween.tween_property(label, "modulate:a", 0.0, 0.8).set_delay(0.3)
	tween.chain().tween_callback(label.queue_free)
