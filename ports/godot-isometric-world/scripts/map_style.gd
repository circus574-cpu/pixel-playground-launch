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
