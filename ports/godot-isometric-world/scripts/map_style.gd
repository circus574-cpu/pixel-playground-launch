class_name MapStyle
extends RefCounted
## Shared look of the planet atlas, the detailed land map and the globe labels: Cinzel plaques, kind markers, compass,
## vignette.

const GOLD := Color("f1c77f")
const INK := Color(0.05, 0.03, 0.02, 0.92)
const PLAQUE_BG := Color(0.07, 0.05, 0.05, 0.74)
const PLAQUE_EDGE := Color(0.62, 0.45, 0.26, 0.9)

static var title_font: Font
static var vignette_texture: GradientTexture2D

static func font() -> Font:
	if title_font == null:
		if ResourceLoader.exists("res://assets/branding/cinzel-bold.ttf"):
			title_font = load("res://assets/branding/cinzel-bold.ttf")
		else:
			var abs_p := ProjectSettings.globalize_path("res://assets/branding/cinzel-bold.ttf")
			if FileAccess.file_exists(abs_p):
				var ff := FontFile.new()
				if ff.load_dynamic_font(abs_p) == OK:
					title_font = ff
		if title_font == null:
			title_font = ThemeDB.fallback_font
	return title_font

static func plaque(canvas: CanvasItem, at: Vector2, label: String, size_px: int, color: Color, strong: bool = true) -> Rect2:
	var text := label.to_upper()
	var f := font()
	var w := f.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, size_px).x
	var rect := Rect2(at - Vector2(w / 2.0 + 10.0, size_px * 0.62 + 4.0), Vector2(w + 20.0, size_px * 1.24 + 8.0))
	var box := StyleBoxFlat.new()
	box.bg_color = PLAQUE_BG if strong else Color(0.07, 0.05, 0.05, 0.5)
	box.border_color = PLAQUE_EDGE if strong else Color(0.62, 0.45, 0.26, 0.5)
	box.set_border_width_all(1)
	box.set_corner_radius_all(int(rect.size.y / 2.0))
	canvas.draw_style_box(box, rect)
	canvas.draw_string(f, Vector2(rect.position.x + 10.0, at.y + size_px * 0.34), text, HORIZONTAL_ALIGNMENT_LEFT, -1, size_px, color)
	return rect

static func halo(canvas: CanvasItem, at: Vector2, text: String, size_px: int, color: Color) -> void:
	var f := font()
	canvas.draw_string_outline(f, at, text, HORIZONTAL_ALIGNMENT_LEFT, -1, size_px, 6, INK)
	canvas.draw_string(f, at, text, HORIZONTAL_ALIGNMENT_LEFT, -1, size_px, color)

static func compass(canvas: CanvasItem, center: Vector2, radius: float) -> void:
	var f := font()
	canvas.draw_circle(center, radius + 6.0, Color(0.05, 0.04, 0.04, 0.72))
	canvas.draw_arc(center, radius + 4.0, 0.0, TAU, 36, Color(0.84, 0.66, 0.36, 0.85), 1.6, true)
	canvas.draw_arc(center, radius * 0.64, 0.0, TAU, 28, Color(0.84, 0.66, 0.36, 0.42), 1.0, true)
	# Minor diagonal points
	var d_len := radius * 0.68
	var d_w := radius * 0.14
	for i in 4:
		var ang := deg_to_rad(45.0 + float(i) * 90.0)
		var dir := Vector2(cos(ang), sin(ang))
		var perp := Vector2(-dir.y, dir.x)
		var pts := PackedVector2Array([center + dir * d_len, center + perp * d_w, center - perp * d_w])
		canvas.draw_colored_polygon(pts, Color(0.66, 0.52, 0.30, 0.82))
	# Major cardinal needles (N/E/S/W)
	var dirs := [Vector2(0, -1), Vector2(1, 0), Vector2(0, 1), Vector2(-1, 0)]
	for i in 4:
		var dir: Vector2 = dirs[i]
		var perp := Vector2(-dir.y, dir.x)
		var tip := center + dir * (radius * 1.04)
		var p_light := PackedVector2Array([tip, center + perp * (radius * 0.18), center])
		var p_dark := PackedVector2Array([tip, center - perp * (radius * 0.18), center])
		canvas.draw_colored_polygon(p_light, Color(0.98, 0.86, 0.56, 0.96) if i == 0 else Color(0.88, 0.72, 0.42, 0.92))
		canvas.draw_colored_polygon(p_dark, Color(0.56, 0.36, 0.18, 0.95))
	canvas.draw_circle(center, radius * 0.14, Color(0.98, 0.88, 0.60, 1.0))
	var letters := ["N", "E", "S", "W"]
	var offsets := [Vector2(-5, -radius - 9), Vector2(radius + 8, 4), Vector2(-4, radius + 16), Vector2(-radius - 19, 4)]
	for i in 4:
		var lpos: Vector2 = center + offsets[i]
		var lcol := Color(1.0, 0.88, 0.52) if i == 0 else Color(0.88, 0.78, 0.58)
		canvas.draw_string_outline(f, lpos, letters[i], HORIZONTAL_ALIGNMENT_LEFT, -1, 11, 3, INK)
		canvas.draw_string(f, lpos, letters[i], HORIZONTAL_ALIGNMENT_LEFT, -1, 11, lcol)

