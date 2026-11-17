class_name ContinentMapView
extends Control
## Painted map of the Pyra continent (65600 x 42304 units): cities, named places, the hero. Pan, pinch / wheel zoom, tap a marker.

signal marker_picked(label: String)

var texture: Texture2D
var world_size := Vector2(65600, 42304)
var markers: Array[Dictionary] = []   # {point (world), label, kind}
var player_world := Vector2.ZERO
var show_player := true
var center := Vector2.ZERO
var scale_px := 0.01
var min_scale := 0.01
var fitted := false
var dragging := false
var drag_moved := false
var drag_start := Vector2.ZERO
var selected := ""
var font: Font = ThemeDB.fallback_font
var sea_color := Color("0c2f40")

func setup(map_texture: Texture2D, marker_list: Array[Dictionary], player: Vector2, size_of_world: Vector2) -> void:
	fitted = false
	world_size = size_of_world
	center = size_of_world / 2.0
	texture = map_texture
	var corner := map_texture.get_image()
	if corner != null and not corner.is_empty():
		if corner.is_compressed():
			corner.decompress()
		var sample := Image.create(1, 1, false, corner.get_format())
		sample.blit_rect(corner, Rect2i(8, 8, 1, 1), Vector2i.ZERO)
		sea_color = sample.get_pixel(0, 0).darkened(0.12)
	markers = marker_list
	player_world = player
	clip_contents = true
	mouse_filter = Control.MOUSE_FILTER_STOP
	if not resized.is_connected(fit):
		resized.connect(fit)
	fit()
	focus(world_size / 2.0, 1.0)

func fit() -> void:
	if size.x <= 0.0:
		return
	var relative_zoom := zoom_level() if fitted else 1.0
	min_scale = minf(size.x / world_size.x, size.y / world_size.y) * 0.96
	scale_px = min_scale * relative_zoom
	fitted = true
	clamp_view()
	queue_redraw()

func clamp_view() -> void:
	var half := size / scale_px / 2.0
	center.x = world_size.x / 2.0 if half.x >= world_size.x / 2.0 else clampf(center.x, half.x, world_size.x - half.x)
	center.y = world_size.y / 2.0 if half.y >= world_size.y / 2.0 else clampf(center.y, half.y, world_size.y - half.y)

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

const PRIORITY := {"city": 0, "famous": 1, "port": 2, "village": 2, "watchtower": 3, "shrine": 3, "cave": 4, "maze": 4}

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), sea_color)
	if texture != null:
		var map_rect := Rect2(to_screen(Vector2.ZERO), world_size * scale_px)
		draw_texture_rect(texture, map_rect, false)
		# The map's edge melts into the sea colour around it, so a map smaller than the screen has no hard border.
		var fade := 46.0
		var clear := Color(sea_color.r, sea_color.g, sea_color.b, 0.0)
		var edge := [[map_rect.position, Vector2(map_rect.end.x, map_rect.position.y), Vector2(0, 1)], [Vector2(map_rect.position.x, map_rect.end.y), map_rect.end, Vector2(0, -1)],
			[map_rect.position, Vector2(map_rect.position.x, map_rect.end.y), Vector2(1, 0)], [Vector2(map_rect.end.x, map_rect.position.y), map_rect.end, Vector2(-1, 0)]]
		for e in edge:
			var a: Vector2 = e[0]
			var b: Vector2 = e[1]
			var inward: Vector2 = (e[2] as Vector2) * fade
			draw_polygon(PackedVector2Array([a, b, b + inward, a + inward]), PackedColorArray([sea_color, sea_color, clear, clear]))
	# 8 x 5 grid, as a tactical map; labelled on the edges while zoomed out.
	for i in range(1, 8):
		var a := to_screen(Vector2(world_size.x * i / 8.0, 0))
		draw_line(a, to_screen(Vector2(world_size.x * i / 8.0, world_size.y)), Color(1, 1, 1, 0.07), 1.0)
	for j in range(1, 5):
		var b := to_screen(Vector2(0, world_size.y * j / 5.0))
		draw_line(b, to_screen(Vector2(world_size.x, world_size.y * j / 5.0)), Color(1, 1, 1, 0.07), 1.0)
	var screen_rect := Rect2(Vector2(-80, -40), size + Vector2(160, 80))
	var order: Array[Dictionary] = []
	for marker in markers:
		if screen_rect.has_point(to_screen(marker.point)):
			order.append(marker)
	order.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return int(PRIORITY.get(str(a.kind), 5)) < int(PRIORITY.get(str(b.kind), 5)))
	var taken: Array[Rect2] = []
	var plaques: Array[Dictionary] = []
	var zoom := zoom_level()
	for marker in order:
		var at := to_screen(marker.point)
		var kind := str(marker.kind)
		var is_selected := str(marker.label) == selected
		if kind == "wilderness":
			if zoom < 1.6 or zoom > 5.5:
				continue
			var wild := MapStyle.font().get_string_size(str(marker.label), HORIZONTAL_ALIGNMENT_LEFT, -1, 16).x
			var wild_rect := Rect2(at - Vector2(wild / 2.0, 16), Vector2(wild, 22))
			if overlaps(taken, wild_rect):
				continue
			taken.append(wild_rect)
			MapStyle.halo(self, at + Vector2(-wild / 2.0, 0), str(marker.label), 16, Color(1, 1, 1, 0.62))
			continue
		var level := int(PRIORITY.get(kind, 5))
		if level >= 3 and zoom < 1.5 and not is_selected:
			continue
		MapStyle.marker(self, at, kind, 1.0 + (0.25 if kind == "city" else 0.0), is_selected)
		var show_label := is_selected or level == 0 or (level <= 2 and zoom > 1.7) or zoom > 3.2
		if not show_label:
			continue
		var big := kind == "city"
		var text := str(marker.label)
		var px := 17 if big else 14
		var w := MapStyle.font().get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, px).x
		var rect := Rect2(at + Vector2(14, -px * 0.8), Vector2(w + 22, px * 1.7))
		if overlaps(taken, rect) and not is_selected:
			continue
		taken.append(rect)
		plaques.append({"at": at + Vector2(14 + (w + 20) / 2.0, 0), "text": text, "px": px, "color": Color("ffe9bd") if big else Color("efe7d6"), "strong": big})
	for plaque in plaques:   # captions go over every marker, so no pin sits on a name
		MapStyle.plaque(self, plaque.at, str(plaque.text), int(plaque.px), plaque.color, bool(plaque.strong))
	if show_player:
		MapStyle.hero_marker(self, to_screen(player_world))
	MapStyle.vignette(self, Rect2(Vector2.ZERO, size))
	MapStyle.compass(self, Vector2(66, 82), 34.0)
	draw_legend()
	MapStyle.frame(self, Rect2(Vector2(3, 3), size - Vector2(6, 6)))

func overlaps(taken: Array[Rect2], rect: Rect2) -> bool:
	for other in taken:
		if other.intersects(rect):
			return true
	return false

func draw_legend() -> void:
	var entries := [["city", "Miasto"], ["village", "Wioska"], ["port", "Port"], ["cave", "Jaskinia / labirynt"], ["shrine", "Wieża, kapliczka"], ["famous", "Słynne miejsce"]]
	var origin := Vector2(16, size.y - 24.0 - 26.0 * entries.size())
	var panel := Rect2(origin - Vector2(10, 14), Vector2(198, 26.0 * entries.size() + 20))
	var box := StyleBoxFlat.new()
	box.bg_color = Color(0.06, 0.05, 0.06, 0.66)
	box.border_color = MapStyle.PLAQUE_EDGE
	box.set_border_width_all(1)
	box.set_corner_radius_all(10)
	draw_style_box(box, panel)
	for i in entries.size():
		var row := origin + Vector2(0, 26.0 * i)
		MapStyle.marker(self, row + Vector2(8, 0), str(entries[i][0]), 0.8)
		draw_string(MapStyle.font(), row + Vector2(26, 5), str(entries[i][1]), HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color("efe0c8"))

func _process(_delta: float) -> void:
	if is_visible_in_tree():
		queue_redraw()
