class_name MapStyle
extends RefCounted
## Shared look of the planet atlas, the detailed land map and the globe labels: Cinzel plaques, kind markers, compass,
## vignette. Everything is drawn procedurally, nothing is a new painted asset.

const GOLD := Color("f1c77f")
const INK := Color(0.05, 0.03, 0.02, 0.92)
const PLAQUE_BG := Color(0.07, 0.05, 0.05, 0.74)
const PLAQUE_EDGE := Color(0.62, 0.45, 0.26, 0.9)

static var title_font: Font
static var vignette_texture: GradientTexture2D

static func font() -> Font:
	if title_font == null:
		title_font = load("res://assets/branding/cinzel-bold.ttf")
	return title_font

## Pill with a Cinzel caption; `at` is the centre of the pill. Returns the rectangle it covers.
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

## Text with a dark halo (for labels that sit directly on the map).
static func halo(canvas: CanvasItem, at: Vector2, text: String, size_px: int, color: Color) -> void:
	var f := font()
	canvas.draw_string_outline(f, at, text, HORIZONTAL_ALIGNMENT_LEFT, -1, size_px, 6, INK)
	canvas.draw_string(f, at, text, HORIZONTAL_ALIGNMENT_LEFT, -1, size_px, color)

## Marker per kind of place: cities are gold diamonds with a ring, villages squares, ports anchors-as-triangles, caves
## dark discs, towers and shrines stars; wilderness has no marker (its name floats on the map).
static func marker(canvas: CanvasItem, at: Vector2, kind: String, scale: float = 1.0, selected: bool = false) -> void:
	var r := 7.0 * scale
	match kind:
		"city":
			var pts := PackedVector2Array([at + Vector2(0, -r * 1.35), at + Vector2(r * 1.2, 0), at + Vector2(0, r * 1.35), at + Vector2(-r * 1.2, 0)])
			canvas.draw_colored_polygon(pts, Color("ffd36a"))
			pts.append(pts[0])
			canvas.draw_polyline(pts, Color(0.25, 0.14, 0.05), 2.0, true)
			canvas.draw_circle(at, r * 0.38, Color(0.25, 0.14, 0.05))
		"village", "port":
			canvas.draw_rect(Rect2(at - Vector2(r, r) * 0.72, Vector2(r, r) * 1.44), Color("e8d4a0") if kind == "village" else Color("9fd8e8"))
			canvas.draw_rect(Rect2(at - Vector2(r, r) * 0.72, Vector2(r, r) * 1.44), Color(0.2, 0.12, 0.06), false, 1.6)
		"cave", "maze":
			canvas.draw_circle(at, r * 0.9, Color(0.12, 0.09, 0.1))
			canvas.draw_arc(at, r * 0.9, 0, TAU, 20, Color("c9b7a0"), 1.6, true)
		"watchtower", "shrine", "famous":
			var pts := PackedVector2Array()
			for i in 10:
				var a := -PI / 2.0 + TAU * i / 10.0
				pts.append(at + Vector2(cos(a), sin(a)) * (r * 1.25 if i % 2 == 0 else r * 0.55))
			canvas.draw_colored_polygon(pts, Color("9fe3ff") if kind == "famous" else Color("f4e7c4"))
			pts.append(pts[0])
			canvas.draw_polyline(pts, Color(0.12, 0.1, 0.2), 1.4, true)
		_:
			canvas.draw_circle(at, r * 0.6, Color("e8dcc4"))
			canvas.draw_arc(at, r * 0.6, 0, TAU, 16, Color(0.2, 0.12, 0.06), 1.4, true)
	if selected:
		canvas.draw_arc(at, r * 1.9, 0, TAU, 28, Color("fff1a8"), 2.4, true)

static func hero_marker(canvas: CanvasItem, at: Vector2, label: String = "Ty") -> void:
	var pulse := 0.5 + 0.5 * sin(Time.get_ticks_msec() / 260.0)
	canvas.draw_circle(at, 16.0 + 7.0 * pulse, Color(1.0, 0.3, 0.2, 0.22))
	canvas.draw_circle(at, 9.0, Color(0.1, 0.03, 0.02))
	canvas.draw_circle(at, 7.0, Color("ff5a3a"))
	canvas.draw_arc(at, 7.0, 0, TAU, 24, Color.WHITE, 2.0, true)
	halo(canvas, at + Vector2(12, -10), label, 17, Color.WHITE)

static func compass(canvas: CanvasItem, centre: Vector2, radius: float) -> void:
	canvas.draw_circle(centre, radius, Color(0.06, 0.05, 0.06, 0.55))
	canvas.draw_arc(centre, radius, 0, TAU, 40, PLAQUE_EDGE, 1.6, true)
	canvas.draw_arc(centre, radius * 0.72, 0, TAU, 40, Color(0.62, 0.45, 0.26, 0.35), 1.0, true)
	var north := PackedVector2Array([centre + Vector2(0, -radius * 0.92), centre + Vector2(radius * 0.18, 0), centre + Vector2(-radius * 0.18, 0)])
	var south := PackedVector2Array([centre + Vector2(0, radius * 0.92), centre + Vector2(radius * 0.18, 0), centre + Vector2(-radius * 0.18, 0)])
	var east := PackedVector2Array([centre + Vector2(radius * 0.92, 0), centre + Vector2(0, radius * 0.14), centre + Vector2(0, -radius * 0.14)])
	var west := PackedVector2Array([centre + Vector2(-radius * 0.92, 0), centre + Vector2(0, radius * 0.14), centre + Vector2(0, -radius * 0.14)])
	canvas.draw_colored_polygon(north, Color("f1c77f"))
	canvas.draw_colored_polygon(south, Color(0.55, 0.45, 0.33))
	canvas.draw_colored_polygon(east, Color(0.55, 0.45, 0.33))
	canvas.draw_colored_polygon(west, Color(0.55, 0.45, 0.33))
	halo(canvas, centre + Vector2(-5, -radius - 6), "N", 14, GOLD)

static func vignette(canvas: CanvasItem, rect: Rect2) -> void:
	if vignette_texture == null:
		var g := Gradient.new()
		g.offsets = PackedFloat32Array([0.0, 0.62, 1.0])
		g.colors = PackedColorArray([Color(0, 0, 0, 0), Color(0, 0, 0, 0), Color(0.01, 0.02, 0.04, 0.72)])
		vignette_texture = GradientTexture2D.new()
		vignette_texture.gradient = g
		vignette_texture.fill = GradientTexture2D.FILL_RADIAL
		vignette_texture.fill_from = Vector2(0.5, 0.5)
		vignette_texture.fill_to = Vector2(1.0, 0.5)
		vignette_texture.width = 256
		vignette_texture.height = 256
	canvas.draw_texture_rect(vignette_texture, rect, false)

static func frame(canvas: CanvasItem, rect: Rect2) -> void:
	canvas.draw_rect(rect, Color(0.62, 0.45, 0.26, 0.9), false, 2.0)
	canvas.draw_rect(rect.grow(-5.0), Color(0.62, 0.45, 0.26, 0.35), false, 1.0)
	for corner in [rect.position, Vector2(rect.end.x, rect.position.y), rect.end, Vector2(rect.position.x, rect.end.y)]:
		canvas.draw_circle(corner, 5.0, Color("f1c77f"))
		canvas.draw_circle(corner, 2.4, Color(0.2, 0.12, 0.06))
