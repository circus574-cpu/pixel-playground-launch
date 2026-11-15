class_name AtlasView
extends Control
## Flat planet atlas: wraps horizontally like the browser map, pan / pinch / wheel zoom, outlines traced from the painted atlas.

signal region_picked(id: String)

const MAX_ZOOM := 14.0

var texture: Texture2D
var regions: Array = []
var polygons: Dictionary = {}
var selected := ""
var player_atlas := Vector2.ZERO
var marks: Array[Dictionary] = []   # {atlas, label, kind}
var center := Vector2(1000, 500)
var scale_px := 1.0
var min_scale := 0.5
var drag_start := Vector2.ZERO
var drag_moved := false
var dragging := false
var font: Font = ThemeDB.fallback_font

func setup(atlas: Texture2D, region_list: Array, player_point: Vector2) -> void:
	texture = atlas
	regions = region_list
	player_atlas = player_point
	for region: Dictionary in regions:
		polygons[region.id] = MapMath.polygon(region)
	clip_contents = true
	mouse_filter = Control.MOUSE_FILTER_STOP
	resized.connect(fit)
	fit()

func fit() -> void:
	if size.x <= 0.0:
		return
	min_scale = maxf(size.x / MapMath.MAP_W * 0.5, size.y / MapMath.MAP_H)
	scale_px = clampf(maxf(scale_px, min_scale), min_scale, min_scale * MAX_ZOOM)
	clamp_view()
	queue_redraw()

func zoom_level() -> float:
	return scale_px / min_scale

func clamp_view() -> void:
	var half_h := size.y / scale_px / 2.0
	center.y = clampf(center.y, minf(half_h, MapMath.MAP_H - half_h), maxf(half_h, MapMath.MAP_H - half_h))
	center.x = fposmod(center.x, MapMath.MAP_W)

func to_screen(p: Vector2) -> Vector2:
	return (p - center) * scale_px + size / 2.0

func to_atlas(s: Vector2) -> Vector2:
	return (s - size / 2.0) / scale_px + center

func focus(p: Vector2, zoom: float) -> void:
	scale_px = clampf(min_scale * zoom, min_scale, min_scale * MAX_ZOOM)
	center = p
	clamp_view()
	queue_redraw()

func zoom_by(factor: float, at: Vector2) -> void:
	var anchor := to_atlas(at)
	scale_px = clampf(scale_px * factor, min_scale, min_scale * MAX_ZOOM)
	center += anchor - to_atlas(at)
	clamp_view()
	queue_redraw()

func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP and event.pressed:
			zoom_by(1.25, event.position)
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN and event.pressed:
			zoom_by(0.8, event.position)
		elif event.button_index == MOUSE_BUTTON_LEFT:
			if event.pressed:
				dragging = true
				drag_moved = false
				drag_start = event.position
			else:
				if dragging and not drag_moved:
					pick(event.position)
				dragging = false
	elif event is InputEventMouseMotion and dragging:
		if (event.position - drag_start).length() > 12.0:
			drag_moved = true
		if drag_moved:
			center -= event.relative / scale_px
			clamp_view()
			queue_redraw()
	elif event is InputEventMagnifyGesture:
		zoom_by(event.factor, event.position)

func pick(at: Vector2) -> void:
	var region := MapMath.region_at(regions, to_atlas(at))
	if region.is_empty():
		selected = ""
	else:
		selected = str(region.id)
		region_picked.emit(selected)
	queue_redraw()

func _draw() -> void:
	if texture == null:
		return
	draw_rect(Rect2(Vector2.ZERO, size), Color("0b1620"))
	var visible_w := size.x / scale_px
	var first := floori((center.x - visible_w / 2.0) / MapMath.MAP_W)
	var last := floori((center.x + visible_w / 2.0) / MapMath.MAP_W)
	for copy in range(first, last + 1):
		var shift := Vector2(float(copy) * MapMath.MAP_W, 0.0)
		draw_texture_rect(texture, Rect2(to_screen(shift), Vector2(MapMath.MAP_W, MapMath.MAP_H) * scale_px), false)
		for region: Dictionary in regions:
			var poly: PackedVector2Array = polygons[region.id]
			var screen := PackedVector2Array()
			for p in poly:
				screen.append(to_screen(p + shift))
			var is_selected: bool = region.id == selected
			if is_selected:
				draw_colored_polygon(screen, Color(1.0, 0.75, 0.3, 0.22))
			var mine: bool = bool(region.playable)
			var line := Color(1.0, 0.82, 0.45, 0.95) if is_selected else (Color(1.0, 0.7, 0.35, 0.8) if mine else Color(0.85, 0.9, 1.0, 0.45))
			screen.append(screen[0])
			draw_polyline(screen, line, 3.0 if is_selected else 1.6, true)
			var label_at := to_screen(Vector2(float(region.label.x), float(region.label.y)) + shift)
			var title := str(region.name)
			var size_px := 17 if region.kind == "continent" else 13
			var w := font.get_string_size(title, HORIZONTAL_ALIGNMENT_LEFT, -1, size_px).x
			draw_string_outline(font, label_at - Vector2(w / 2.0, 0), title, HORIZONTAL_ALIGNMENT_LEFT, -1, size_px, 5, Color(0.05, 0.03, 0.02, 0.95))
			draw_string(font, label_at - Vector2(w / 2.0, 0), title, HORIZONTAL_ALIGNMENT_LEFT, -1, size_px, Color("ffe9bd") if mine else Color("e6eef7"))
			var sp = region.get("settlementPoint")
			if sp != null:
				draw_circle(to_screen(Vector2(float(sp.x), float(sp.y)) + shift), 4.0, Color("ffd36a"))
		for mark in marks:
			var at := to_screen(mark.atlas + shift)
			draw_circle(at, 4.0 + (2.0 if zoom_level() > 4.0 else 0.0), Color("ffcf6a"))
			if zoom_level() > 3.0:
				draw_string_outline(font, at + Vector2(8, 5), str(mark.label), HORIZONTAL_ALIGNMENT_LEFT, -1, 14, 5, Color(0.05, 0.03, 0.02, 0.95))
				draw_string(font, at + Vector2(8, 5), str(mark.label), HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color("fff0cc"))
		var you := to_screen(player_atlas + shift)
		var pulse := 0.5 + 0.5 * sin(Time.get_ticks_msec() / 260.0)
		draw_circle(you, 11.0 + 5.0 * pulse, Color(1.0, 0.3, 0.2, 0.28))
		draw_circle(you, 6.0, Color("ff5a3a"))
		draw_arc(you, 6.0, 0, TAU, 24, Color.WHITE, 2.0, true)
		draw_string_outline(font, you + Vector2(10, -8), "Ty", HORIZONTAL_ALIGNMENT_LEFT, -1, 16, 5, Color(0.05, 0.03, 0.02, 0.95))
		draw_string(font, you + Vector2(10, -8), "Ty", HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color.WHITE)

func _process(_delta: float) -> void:
	if is_visible_in_tree():
		queue_redraw()
