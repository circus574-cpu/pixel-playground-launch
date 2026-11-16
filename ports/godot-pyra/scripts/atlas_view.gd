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
	var t := Time.get_ticks_msec() / 1000.0
	for copy in range(first, last + 1):
		var shift := Vector2(float(copy) * MapMath.MAP_W, 0.0)
		draw_texture_rect(texture, Rect2(to_screen(shift), Vector2(MapMath.MAP_W, MapMath.MAP_H) * scale_px), false)
		# graticule every 30 degrees of longitude / 30 of latitude
		for lon in range(-150, 180, 30):
			var x := (float(lon) + 180.0) / 360.0 * MapMath.MAP_W
			draw_line(to_screen(Vector2(x, 0) + shift), to_screen(Vector2(x, MapMath.MAP_H) + shift), Color(1, 1, 1, 0.06), 1.0)
		for lat in range(-60, 90, 30):
			var y := (90.0 - float(lat)) / 180.0 * MapMath.MAP_H
			draw_line(to_screen(Vector2(0, y) + shift), to_screen(Vector2(MapMath.MAP_W, y) + shift), Color(1, 1, 1, 0.06), 1.0)
		for region: Dictionary in regions:
			var poly: PackedVector2Array = polygons[region.id]
			var screen := PackedVector2Array()
			for p in poly:
				screen.append(to_screen(p + shift))
			var is_selected: bool = region.id == selected
			var mine: bool = bool(region.playable)
			if is_selected:
				var glow := 0.18 + 0.08 * sin(t * 3.0)
				draw_colored_polygon(screen, Color(1.0, 0.78, 0.32, glow))
			var line := Color(1.0, 0.82, 0.45, 0.98) if is_selected else (Color(1.0, 0.7, 0.35, 0.75) if mine else Color(0.85, 0.9, 1.0, 0.4))
			draw_outline(poly, shift, line, is_selected)
		for region: Dictionary in regions:
			var label_at := to_screen(Vector2(float(region.label.x), float(region.label.y)) + shift)
			var continent: bool = region.kind == "continent"
			var mine: bool = bool(region.playable)
			if not continent and zoom_level() < 1.35:
				continue
			var sp = region.get("settlementPoint")
			var plaque_at := label_at
			if sp != null:
				var city_at := to_screen(Vector2(float(sp.x), float(sp.y)) + shift)
				if zoom_level() >= 1.5 or not continent:
					MapStyle.marker(self, city_at, "city", 0.7)
				if absf(city_at.y - label_at.y) < 26.0 and absf(city_at.x - label_at.x) < 90.0:
					plaque_at = label_at + Vector2(0, -26)
			MapStyle.plaque(self, plaque_at, str(region.name), 17 if continent else 12, Color("ffe9bd") if mine else Color("e6eef7"), continent)
		for mark in marks:
			var at := to_screen(mark.atlas + shift)
			MapStyle.marker(self, at, "city", 0.55 + (0.2 if zoom_level() > 4.0 else 0.0))
			if zoom_level() > 3.0:
				MapStyle.halo(self, at + Vector2(10, 5), str(mark.label), 14, Color("fff0cc"))
		MapStyle.hero_marker(self, to_screen(player_atlas + shift))
	MapStyle.vignette(self, Rect2(Vector2.ZERO, size))
	MapStyle.compass(self, Vector2(66, 82), 34.0)
	MapStyle.frame(self, Rect2(Vector2(3, 3), size - Vector2(6, 6)))

## Region outline without the segments that only close the traced polygon along the date line (x = 0 / 2000).
func draw_outline(poly: PackedVector2Array, shift: Vector2, color: Color, bold: bool) -> void:
	var run := PackedVector2Array()
	var count := poly.size()
	for i in count + 1:
		var a := poly[i % count]
		var b := poly[(i + 1) % count]
		run.append(to_screen(a + shift))
		var on_seam := (a.x < 1.5 and b.x < 1.5) or (a.x > MapMath.MAP_W - 1.5 and b.x > MapMath.MAP_W - 1.5)
		if on_seam or i == count:
			if run.size() > 1:
				if bold:
					draw_polyline(run, Color(1.0, 0.85, 0.4, 0.28), 9.0, true)
				draw_polyline(run, color, 3.0 if bold else 1.5, true)
			run = PackedVector2Array()

func _process(_delta: float) -> void:
	if is_visible_in_tree():
		queue_redraw()
