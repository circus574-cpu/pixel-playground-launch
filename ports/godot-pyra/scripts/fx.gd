class_name PyraFx
extends Node2D
## Short-lived combat effects, drawn in code with additive light: glows, ribbon slashes, shockwaves, sparks and embers.
## Kinds: burst (ground blast), buff (Ki aura), swing / slash (blade ribbon), dash (afterimage streaks), hit (impact flash on a foe),
## hurt (the hero is struck). Every particle is a pure function of (seed, index, age), so a frame needs no state.

var kind := "burst"
var radius := 150.0
var ability := ""
var age := 0.0
var life := 0.5
var facing := Vector2.RIGHT
var color := Color("ff8a3d")
var seed_value := 0.0

static var glow_texture: Texture2D
static var add_material: CanvasItemMaterial

static func glow() -> Texture2D:
	if glow_texture == null:
		var g := Gradient.new()
		g.offsets = PackedFloat32Array([0.0, 0.25, 0.6, 1.0])
		g.colors = PackedColorArray([Color(1, 1, 1, 1), Color(1, 1, 1, 0.55), Color(1, 1, 1, 0.12), Color(1, 1, 1, 0)])
		var t := GradientTexture2D.new()
		t.gradient = g
		t.fill = GradientTexture2D.FILL_RADIAL
		t.fill_from = Vector2(0.5, 0.5)
		t.fill_to = Vector2(1.0, 0.5)
		t.width = 128
		t.height = 128
		glow_texture = t
	return glow_texture

static func additive() -> CanvasItemMaterial:
	if add_material == null:
		add_material = CanvasItemMaterial.new()
		add_material.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	return add_material

## Soft round light of radius `r` (used by the effects and by the monster telegraphs).
static func light(canvas: CanvasItem, at: Vector2, r: float, tint: Color) -> void:
	canvas.draw_texture_rect(glow(), Rect2(at - Vector2(r, r), Vector2(r, r) * 2.0), false, Color(tint.r, tint.g, tint.b, minf(1.0, tint.a * 1.6)))

static func spawn(parent: Node, effect_kind: String, at: Vector2, effect_radius: float, effect_ability: String, face: Vector2 = Vector2.RIGHT) -> PyraFx:
	var fx := PyraFx.new()
	fx.kind = effect_kind
	fx.radius = effect_radius
	fx.ability = effect_ability
	fx.facing = face if face.length_squared() > 0.0 else Vector2.RIGHT
	fx.position = at
	fx.seed_value = randf() * 100.0
	fx.material = additive()
	fx.z_index = 20
	match effect_kind:
		"burst":
			fx.life = 0.75
		"buff":
			fx.life = 1.1
		"swing":
			fx.life = 0.26
		"slash":
			fx.life = 0.32
		"dash":
			fx.life = 0.34
		"hit":
			fx.life = 0.34
		"hurt":
			fx.life = 0.4
	if effect_ability.begins_with("C"):
		fx.color = Color("ff6a1f")
	elif effect_ability.begins_with("B"):
		fx.color = Color("ffc94a")
	elif effect_ability == "T":
		fx.color = Color("ffb347")
	elif effect_ability == "weak":
		fx.color = Color("ffd23f")
	elif effect_ability == "resist":
		fx.color = Color("9aa6b8")
	elif effect_kind == "hurt":
		fx.color = Color("ff3b2e")
	parent.add_child(fx)
	return fx

func _process(delta: float) -> void:
	age += delta
	if age >= life:
		queue_free()
	queue_redraw()

# ---- helpers ---------------------------------------------------------------------------------

## Deterministic pseudo random in [0, 1) for particle `i`, channel `c`.
func rnd(i: int, c: int) -> float:
	return fposmod(sin(seed_value * 12.9898 + float(i) * 78.233 + float(c) * 37.719) * 43758.5453, 1.0)

static func ease_out(t: float) -> float:
	return 1.0 - pow(1.0 - clampf(t, 0.0, 1.0), 3.0)

## A crescent ribbon: a filled strip along an arc whose width swells in the middle and tapers to points; `head` (0..1) is where it ends.
func ribbon(centre: Vector2, r: float, a0: float, a1: float, width: float, col: Color, steps: int = 20) -> void:
	var outer := PackedVector2Array()
	var inner := PackedVector2Array()
	for s in steps + 1:
		var u := float(s) / float(steps)
		var a := lerpf(a0, a1, u)
		var w := width * sin(u * PI) * (0.35 + 0.65 * u)
		outer.append(centre + Vector2.from_angle(a) * (r + w * 0.5))
		inner.append(centre + Vector2.from_angle(a) * (r - w * 0.5))
	inner.reverse()
	var poly := outer + inner
	draw_colored_polygon(poly, col)

func spark(from: Vector2, to: Vector2, width: float, col: Color) -> void:
	draw_line(from, to, col, width, true)
	light(self, to, width * 2.6, Color(col.r, col.g, col.b, col.a * 0.6))

# ---- drawing ---------------------------------------------------------------------------------

func _draw() -> void:
	var t := clampf(age / life, 0.0, 1.0)
	var a := 1.0 - t
	match kind:
		"burst":
			draw_burst(t, a)
		"buff":
			draw_aura(t, a)
		"swing", "slash":
			draw_blade(t, a)
		"dash":
			draw_dash(t, a)
		"hit":
			draw_hit(t, a)
		"hurt":
			draw_hurt(t, a)

func draw_burst(t: float, a: float) -> void:
	var centre := Vector2(0, -30)
	var e := ease_out(t)
	var r := radius * (0.2 + 0.8 * e)
	if t < 0.25:
		light(self, centre, radius * 0.9, Color(1.0, 0.95, 0.75, (1.0 - t / 0.25) * 0.9))
	draw_circle(centre, r, Color(color.r, color.g * 0.7, color.b * 0.5, 0.16 * a))
	light(self, centre, r * 1.25, Color(color.r, color.g, color.b, 0.65 * a))
	# the shockwave on the ground: a thick ring that thins out
	draw_arc(centre, r, 0, TAU, 72, Color(color.r, color.g, color.b, 0.55 * a), 26.0 * a + 4.0, true)
	draw_arc(centre, r, 0, TAU, 72, Color(1.0, 0.9, 0.6, 0.9 * a), 10.0 * a + 2.0, true)
	draw_arc(centre, r * 0.8, 0, TAU, 72, Color(color.r, color.g, color.b, 0.6 * a), 8.0 * a + 1.0, true)
	for i in 22:
		var ang := TAU * rnd(i, 0)
		var dist := r * (0.35 + 0.75 * rnd(i, 1)) * (0.6 + 0.4 * e)
		var p := centre + Vector2.from_angle(ang) * dist
		var tail := p - Vector2.from_angle(ang) * (10.0 + 22.0 * rnd(i, 2)) * a
		spark(tail, p, 3.0 * a + 1.0, Color(1.0, 0.72 + 0.2 * rnd(i, 3), 0.3, a))
	for i in 14:
		var drift := Vector2((rnd(i, 4) - 0.5) * radius * 0.9, -t * (60.0 + 90.0 * rnd(i, 5)))
		light(self, centre + drift, 9.0 * a + 2.0, Color(1.0, 0.55, 0.2, 0.7 * a))

func draw_aura(t: float, a: float) -> void:
	var pulse := sin(t * PI)
	var base := Vector2(0, -2)
	var rr := radius * (0.55 + 0.45 * pulse)
	# ground ring, flat like a halo on the floor
	draw_set_transform(base, 0.0, Vector2(1.0, 0.45))
	draw_arc(Vector2.ZERO, rr, 0, TAU, 56, Color(color.r, color.g, color.b, 0.85 * a), 6.0, true)
	draw_arc(Vector2.ZERO, rr * 0.7, 0, TAU, 56, Color(1.0, 0.9, 0.6, 0.5 * a), 3.0, true)
	light(self, Vector2.ZERO, rr * 1.1, Color(color.r, color.g, color.b, 0.28 * a))
	draw_set_transform(Vector2.ZERO)
	# rising flame wisps around the body
	for i in 12:
		var ph := fposmod(t * (1.1 + 0.6 * rnd(i, 0)) + rnd(i, 1), 1.0)
		var ang := TAU * rnd(i, 2) + t * 2.0
		var x := cos(ang) * radius * 0.34 * (0.7 + 0.3 * rnd(i, 3))
		var y := -ph * 190.0 - 8.0
		var w := (1.0 - ph) * (9.0 + 7.0 * rnd(i, 4))
		var tip := Vector2(x + sin(ph * 9.0 + float(i)) * 5.0, y - 26.0 * (1.0 - ph))
		draw_colored_polygon(PackedVector2Array([Vector2(x - w, y + 18.0), tip, Vector2(x + w, y + 18.0)]), Color(1.0, 0.62 + 0.3 * ph, 0.2, 0.6 * (1.0 - ph) * a * 1.6))
		light(self, Vector2(x, y), w * 2.0 + 4.0, Color(1.0, 0.78, 0.4, 0.5 * (1.0 - ph) * minf(1.0, a * 2.0)))

func draw_blade(t: float, a: float) -> void:
	var base := facing.angle()
	var centre := Vector2(0, -56)
	var sweep := lerpf(-1.25, 1.25, ease_out(t))
	var head := base + sweep
	var length := 1.25 + 0.5 * t
	var r := 96.0 if kind == "swing" else 108.0
	ribbon(centre, r, head - length, head, 30.0 * (1.0 - t * 0.4), Color(color.r, color.g * 0.8, color.b * 0.5, 0.55 * a), 24)
	ribbon(centre, r, head - length * 0.8, head, 16.0 * (1.0 - t * 0.4), Color(1.0, 0.9, 0.62, 0.9 * a), 24)
	ribbon(centre, r, head - length * 0.5, head, 6.0, Color(1.0, 1.0, 0.95, a), 16)
	var tip := centre + Vector2.from_angle(head) * r
	light(self, tip, 40.0 * a + 10.0, Color(1.0, 0.8, 0.45, 0.9 * a))
	for i in 9:
		var back := head - length * (0.15 + 0.7 * rnd(i, 0))
		var p := centre + Vector2.from_angle(back) * (r + (rnd(i, 1) - 0.4) * 26.0)
		var out := Vector2.from_angle(back + 1.57) * (6.0 + 20.0 * t)
		spark(p, p + out, 2.5 * a + 1.0, Color(1.0, 0.75, 0.35, a))

func draw_dash(t: float, a: float) -> void:
	for i in 6:
		var off := float(i) / 5.0
		var side := (rnd(i, 0) - 0.5) * 46.0
		var perp := Vector2(-facing.y, facing.x)
		var streak := (70.0 + 110.0 * rnd(i, 1)) * (1.0 - t * 0.6)
		var start := perp * side + Vector2(0, -50.0 + (rnd(i, 2) - 0.5) * 50.0)
		draw_line(start, start - facing * streak, Color(1.0, 0.7 + 0.2 * off, 0.35, 0.7 * a), 5.0 * a + 1.0, true)
	light(self, Vector2(0, -50), 70.0 * a + 20.0, Color(1.0, 0.65, 0.25, 0.45 * a))
	light(self, -facing * 70.0 * t + Vector2(0, -50), 50.0, Color(1.0, 0.85, 0.5, 0.35 * a))

func draw_hit(t: float, a: float) -> void:
	var s := clampf(radius / 60.0, 0.6, 2.0)
	var e := ease_out(t)
	var centre := Vector2(0, -50)
	if t < 0.3:
		light(self, centre, 80.0 * s, Color(1.0, 0.95, 0.8, (1.0 - t / 0.3)))
	# four-point flash
	var spike := 70.0 * s * (1.0 - t)
	for k in 4:
		var dir := Vector2.from_angle(float(k) * PI * 0.5 + 0.35)
		var side := Vector2(-dir.y, dir.x) * 7.0 * s * (1.0 - t)
		draw_colored_polygon(PackedVector2Array([centre + side, centre + dir * spike, centre - side]), Color(1.0, 0.95, 0.75, 0.95 * a))
	draw_arc(centre, 20.0 * s + 50.0 * s * e, 0, TAU, 40, Color(color.r, color.g, color.b, 0.8 * a), 5.0 * a + 1.0, true)
	for i in int(10.0 * s):
		var ang := facing.angle() + (rnd(i, 0) - 0.5) * 2.6
		var dist := (24.0 + 70.0 * rnd(i, 1)) * s * e
		var p := centre + Vector2.from_angle(ang) * dist
		spark(p - Vector2.from_angle(ang) * 14.0 * a * s, p, 3.0 * a + 1.0, Color(1.0, 0.8, 0.4, a))

func draw_hurt(t: float, a: float) -> void:
	var centre := Vector2(0, -60)
	light(self, centre, 100.0 * (0.6 + 0.4 * ease_out(t)), Color(color.r, color.g, color.b, 0.6 * a))
	draw_arc(centre, 30.0 + 60.0 * ease_out(t), 0, TAU, 40, Color(1.0, 0.4, 0.3, 0.8 * a), 5.0 * a + 1.0, true)
	for i in 8:
		var ang := TAU * rnd(i, 0)
		var p := centre + Vector2.from_angle(ang) * (30.0 + 60.0 * rnd(i, 1)) * ease_out(t)
		spark(p - Vector2.from_angle(ang) * 10.0 * a, p, 3.0 * a + 1.0, Color(1.0, 0.35, 0.25, a))

## Floating damage number rising from a point.
## Number styles: "" plain hit, "crit", "weak" (the foe is weak to it), "resist", "hurt" (the hero is hit), "heal", "xp".
const NUMBER_STYLES := {
	"": {"color": "ffffff", "size": 26, "suffix": ""},
	"crit": {"color": "ffd23f", "size": 36, "suffix": "!"},
	"weak": {"color": "ff9d3c", "size": 32, "suffix": "!"},
	"resist": {"color": "a6adb8", "size": 22, "suffix": ""},
	"hurt": {"color": "ff5a4d", "size": 28, "suffix": ""},
	"heal": {"color": "78e08f", "size": 28, "suffix": ""},
	"xp": {"color": "9fd6ff", "size": 30, "suffix": ""},
}

static func number(parent: Node, at: Vector2, amount: int, crit: bool, style: String = "") -> Label:
	var key := "crit" if crit and style == "" else style
	var look: Dictionary = NUMBER_STYLES.get(key, NUMBER_STYLES[""])
	var sign_text := "+" if key == "heal" or key == "xp" else ""
	return word(parent, at, sign_text + str(amount) + str(look.suffix), Color(str(look.color)), int(look.size), key == "crit" or key == "weak")

## A word that floats up from `at` and fades (numbers, "IDEALNY UNIK", "SŁABOŚĆ").
static func word(parent: Node, at: Vector2, text: String, color: Color, size: int = 26, pop: bool = false) -> Label:
	var label := Label.new()
	label.text = text
	label.add_theme_font_size_override("font_size", size)
	label.add_theme_color_override("font_color", color)
	label.add_theme_color_override("font_outline_color", Color(0.15, 0.03, 0.02, 0.95))
	label.add_theme_constant_override("outline_size", 8)
	label.position = at + Vector2(randf_range(-34, 34) - 30, -210)
	label.z_index = 4000
	parent.add_child(label)
	var tween := label.create_tween()
	if pop:
		label.pivot_offset = Vector2(30, 20)
		label.scale = Vector2(1.7, 1.7)
		tween.tween_property(label, "scale", Vector2.ONE, 0.16).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tween.set_parallel(true)
	tween.tween_property(label, "position:y", label.position.y - 80, 0.8)
	tween.tween_property(label, "modulate:a", 0.0, 0.8).set_delay(0.3)
	tween.chain().tween_callback(label.queue_free)
	return label
