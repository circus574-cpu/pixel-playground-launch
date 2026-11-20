extends Control
## Animated Godot loading screen built from the owner's existing KI LEGENDS key art.
## This is NOT a video player or a simulated progress bar. Actual progress comes from boot.gd.
const ART := "res://assets/branding/intro-last.webp"
const ART_SIZE := Vector2(1280.0, 720.0)
const MAX_CROP := 0.10

var background := TextureRect.new()
var fade := ColorRect.new()
var stars := Control.new()
var panel := PanelContainer.new()
var status := Label.new()
var details := Label.new()
var meter := ProgressBar.new()
var specks: Array[ColorRect] = []
var positions: Array[Vector2] = []
var elapsed := 0.0

static func cropped_rect(area: Vector2) -> Rect2:
	if area.x <= 0.0 or area.y <= 0.0:
		return Rect2()
	var contain := minf(area.x / ART_SIZE.x, area.y / ART_SIZE.y)
	var cover := maxf(area.x / ART_SIZE.x, area.y / ART_SIZE.y)
	var factor := minf(cover, contain / (1.0 - MAX_CROP))
	var picture := ART_SIZE * factor
	var cut := maxf(0.0, picture.y - area.y)
	return Rect2(Vector2((area.x - picture.x) * 0.5, -cut * 0.8), picture)

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	var image := load(ART) as Texture2D
	background.texture = image
	background.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	background.stretch_mode = TextureRect.STRETCH_SCALE
	background.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(background)

	# The old last-frame image has a baked 'touch' message / fake progress at the bottom.
	# Cover that part and draw the only progress indicator in native Godot controls.
	fade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	fade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var shader := Shader.new()
	shader.code = "shader_type canvas_item;\nvoid fragment() {\n float opacity = smoothstep(0.73, 0.96, UV.y);\n COLOR = vec4(0.018, 0.031, 0.067, opacity);\n}"
	var material := ShaderMaterial.new()
	material.shader = shader
	fade.material = material
	add_child(fade)

	stars.mouse_filter = Control.MOUSE_FILTER_IGNORE
	stars.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(stars)
	# Gentle, independently animated starlight, not frames of a movie.
	for i in range(34):
		var point := ColorRect.new()
		point.mouse_filter = Control.MOUSE_FILTER_IGNORE
		point.color = Color(0.72, 0.90, 1.0, 0.6)
		var side := 1.0 + float(i % 3)
		point.size = Vector2(side, side)
		stars.add_child(point)
		specks.append(point)
		positions.append(Vector2(fract_hash(float(i) * 13.7), fract_hash(float(i) * 31.3 + 17.0) * 0.77))

	panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.025, 0.040, 0.080, 0.85)
	style.border_color = Color(0.83, 0.65, 0.30, 0.82)
	style.set_border_width_all(1)
	style.set_corner_radius_all(13)
	style.content_margin_left = 18
	style.content_margin_right = 18
	style.content_margin_top = 9
	style.content_margin_bottom = 9
	panel.add_theme_stylebox_override("panel", style)
	add_child(panel)
	var layout := VBoxContainer.new()
	layout.add_theme_constant_override("separation", 5)
	panel.add_child(layout)
	status.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	status.add_theme_font_size_override("font_size", 17)
	status.add_theme_color_override("font_color", Color("f7e3b1"))
	status.size_flags_vertical = Control.SIZE_EXPAND_FILL

	meter.show_percentage = false
	meter.indeterminate = true
	meter.max_value = 100.0
	meter.custom_minimum_size.y = 12.0
	var empty := StyleBoxFlat.new()
	empty.bg_color = Color(0.020, 0.047, 0.09, 0.96)
	empty.set_corner_radius_all(6)
	var filled := StyleBoxFlat.new()
	filled.bg_color = Color(0.33, 0.83, 1.0, 1.0)
	filled.set_corner_radius_all(6)
	meter.add_theme_stylebox_override("background", empty)
	meter.add_theme_stylebox_override("fill", filled)
	layout.add_child(meter)
	layout.add_child(status)   # operation name BELOW the real progress bar
	details.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	details.add_theme_font_size_override("font_size", 12)
	details.add_theme_color_override("font_color", Color("a8c7dd"))
	layout.add_child(details)
	set_stage("Sprawdzam aktualizacje gry…")
	resized.connect(_layout)
	_layout()

static func fract_hash(value: float) -> float:
	var n := sin(value * 12.9898) * 43758.5453
	return n - floor(n)

func _layout() -> void:
	var rect := cropped_rect(size)
	background.position = rect.position
	background.size = rect.size
	var width := minf(size.x * 0.82, 750.0)
	var height := clampf(size.y * 0.19, 96.0, 130.0)
	panel.position = Vector2((size.x - width) * 0.5, size.y - height - maxf(7.0, size.y * 0.018))
	panel.size = Vector2(width, height)

func _process(delta: float) -> void:
	elapsed += delta
	var rect := cropped_rect(size)
	# Cinematic breathing / parallax, independently timed and loopable.
	background.position = rect.position + Vector2(sin(elapsed * 0.29) * 2.1, cos(elapsed * 0.37) * 1.8)
	for i in range(specks.size()):
		var p := positions[i]
		specks[i].position = Vector2(p.x * size.x, p.y * size.y - 7.0 * sin(elapsed * 0.28 + float(i)))
		specks[i].modulate.a = clampf(0.2 + 0.65 * sin(elapsed * (0.65 + float(i % 5) * 0.11) + float(i) * 1.81), 0.0, 0.7)

## Negative fraction means progress cannot be measured, so show indeterminate animation.
## 0..1 is the real fraction of bytes received or resources loaded.
func set_stage(message: String, fraction: float = -1.0) -> void:
	meter.visible = true
	meter.indeterminate = fraction < 0.0
	status.text = message
	if fraction >= 0.0:
		meter.value = clampf(fraction, 0.0, 1.0) * 100.0
		details.text = "Rzeczywisty postęp: %d%%" % roundi(meter.value)
	else:
		details.text = "Trwa operacja — bez sztucznego odliczania"

func ready_for_touch() -> void:
	status.text = "DOTKNIJ, ABY ROZPOCZĄĆ"
	details.text = "Gra jest gotowa"
	meter.visible = false
