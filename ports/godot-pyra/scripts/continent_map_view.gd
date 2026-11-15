class_name ContinentMapView
extends Control
## Painted map of the Pyra continent (65600 x 42304 units): cities, named places, the hero. Pan, pinch / wheel zoom, tap a marker.

signal marker_picked(label: String)

var texture: Texture2D
var world_size := Vector2(65600, 42304)
var markers: Array[Dictionary] = []   # {point (world), label, kind}
var player_world := Vector2.ZERO
var center := Vector2.ZERO
var scale_px := 0.01
var min_scale := 0.01
var dragging := false
var drag_moved := false
var drag_start := Vector2.ZERO
var selected := ""
var font: Font = ThemeDB.fallback_font

func setup(map_texture: Texture2D, marker_list: Array[Dictionary], player: Vector2, size_of_world: Vector2) -> void:
	world_size = size_of_world
	center = size_of_world / 2.0
	texture = map_texture
	markers = marker_list
	player_world = player
	clip_contents = true
	mouse_filter = Control.MOUSE_FILTER_STOP
	resized.connect(fit)
	fit()

func fit() -> void:
	if size.x <= 0.0:
		return
	min_scale = minf(size.x / world_size.x, size.y / world_size.y)
	scale_px = clampf(maxf(scale_px, min_scale), min_scale, min_scale * 12.0)
	clamp_view()
	queue_redraw()

func clamp_view() -> void:
	var half := size / scale_px / 2.0
	center.x = clampf(center.x, minf(half.x, world_size.x - half.x), maxf(half.x, world_size.x - half.x))
	center.y = clampf(center.y, minf(half.y, world_size.y - half.y), maxf(half.y, world_size.y - half.y))

func to_screen(p: Vector2) -> Vector2:
	return (p - center) * scale_px + size / 2.0

func to_world(s: Vector2) -> Vector2:
	return (s - size / 2.0) / scale_px + center

func zoom_level() -> float:
	return scale_px / min_scale

func focus(p: Vector2, zoom: float) -> void:
	scale_px = clampf(min_scale * zoom, min_scale, min_scale * 12.0)
	center = p
	clamp_view()
	queue_redraw()

func zoom_by(factor: float, at: Vector2) -> void:
	var anchor := to_world(at)
	scale_px = clampf(scale_px * factor, min_scale, min_scale * 12.0)
	center += anchor - to_world(at)
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
	var best := ""
	var best_d := 46.0
	for marker in markers:
		var d := to_screen(marker.point).distance_to(at)
		if d < best_d:
			best_d = d
			best = str(marker.label)
	selected = best
	if best != "":
		marker_picked.emit(best)
	queue_redraw()

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color("0b1620"))
	if texture != null:
		draw_texture_rect(texture, Rect2(to_screen(Vector2.ZERO), world_size * scale_px), false)
	# 8 x 5 grid, as a tactical map.
	for i in range(1, 8):
		var a := to_screen(Vector2(world_size.x * i / 8.0, 0))
		draw_line(a, to_screen(Vector2(world_size.x * i / 8.0, world_size.y)), Color(1, 1, 1, 0.06), 1.0)
	for j in range(1, 5):
		var b := to_screen(Vector2(0, world_size.y * j / 5.0))
		draw_line(b, to_screen(Vector2(world_size.x, world_size.y * j / 5.0)), Color(1, 1, 1, 0.06), 1.0)
	for marker in markers:
		var at := to_screen(marker.point)
		if not Rect2(Vector2(-60, -30), size + Vector2(120, 60)).has_point(at):
			continue
		var kind := str(marker.kind)
		var big := kind == "city"
		var color := Color("ffd36a") if big else (Color("9fe3ff") if kind == "famous" else Color("e8dcc4"))
		if kind == "wilderness":
			draw_string_outline(font, at - Vector2(70, 0), str(marker.label), HORIZONTAL_ALIGNMENT_LEFT, 160, 15, 5, Color(0.05, 0.03, 0.02, 0.9))
			draw_string(font, at - Vector2(70, 0), str(marker.label), HORIZONTAL_ALIGNMENT_LEFT, 160, 15, Color(1, 1, 1, 0.85))
			continue
		draw_circle(at, 7.0 if big else 4.0, color)
		draw_arc(at, 7.0 if big else 4.0, 0, TAU, 20, Color(0.1, 0.05, 0.03), 2.0, true)
		if big or zoom_level() > 2.2 or str(marker.label) == selected:
			draw_string_outline(font, at + Vector2(10, 5), str(marker.label), HORIZONTAL_ALIGNMENT_LEFT, -1, 17 if big else 14, 5, Color(0.05, 0.03, 0.02, 0.95))
			draw_string(font, at + Vector2(10, 5), str(marker.label), HORIZONTAL_ALIGNMENT_LEFT, -1, 17 if big else 14, color)
	var you := to_screen(player_world)
	var pulse := 0.5 + 0.5 * sin(Time.get_ticks_msec() / 260.0)
	draw_circle(you, 14.0 + 6.0 * pulse, Color(1.0, 0.3, 0.2, 0.3))
	draw_circle(you, 7.0, Color("ff5a3a"))
	draw_arc(you, 7.0, 0, TAU, 24, Color.WHITE, 2.0, true)
	draw_string_outline(font, you + Vector2(-34, -12), "Ty", HORIZONTAL_ALIGNMENT_LEFT, -1, 17, 5, Color(0.05, 0.03, 0.02, 0.95))
	draw_string(font, you + Vector2(-34, -12), "Ty", HORIZONTAL_ALIGNMENT_LEFT, -1, 17, Color.WHITE)

func _process(_delta: float) -> void:
	if is_visible_in_tree():
		queue_redraw()
