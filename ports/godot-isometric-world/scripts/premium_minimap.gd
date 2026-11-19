extends Control
## Premium Cartographic Circular Minimap Widget for KI Legends.
## Displays the real 1024x1024 top-down satellite/topographic render of the active continent
## inside an antique-gold compass bezel with tactical zoom (2.1x) / overview (1.0x),
## live moving monster/fauna/NPC markers, capital service icons, exp-zone rings,
## directional hero chevron, and a sleek location & coordinates plate.

const MapStyle := preload("res://scripts/map_style.gd")

const MAP_DIAMETER := 224.0
const MAP_RADIUS := 112.0
const MAP_CENTER := Vector2(128.0, 126.0)
const WIDGET_SIZE := Vector2(256.0, 314.0)

var world: Node2D
var map_tex_rect := TextureRect.new()
var map_mat := ShaderMaterial.new()
var overlay_canvas := Control.new()
var plate_panel := PanelContainer.new()
var loc_label := Label.new()
var coord_label := Label.new()
var btn_zoom := Button.new()
var btn_3d := Button.new()
var btn_globe := Button.new()

var tactical_zoom := true
var current_zoom := 2.10
var hero_heading := Vector2(0.0, 1.0)
var last_hero_pos := Vector2(512.0, 512.0)

func _ready() -> void:
	custom_minimum_size = WIDGET_SIZE
	size = WIDGET_SIZE
	mouse_filter = Control.MOUSE_FILTER_PASS

	map_mat.shader = load("res://shaders/minimap_circle.gdshader")
	map_mat.set_shader_parameter("center_uv", Vector2(0.5, 0.5))
	map_mat.set_shader_parameter("zoom", current_zoom)

	map_tex_rect.position = MAP_CENTER - Vector2(MAP_RADIUS, MAP_RADIUS)
	map_tex_rect.size = Vector2(MAP_DIAMETER, MAP_DIAMETER)
	map_tex_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	map_tex_rect.stretch_mode = TextureRect.STRETCH_SCALE
	map_tex_rect.material = map_mat
	map_tex_rect.mouse_filter = Control.MOUSE_FILTER_STOP
	map_tex_rect.gui_input.connect(_on_radar_input)
	add_child(map_tex_rect)

	overlay_canvas.position = Vector2.ZERO
	overlay_canvas.size = Vector2(WIDGET_SIZE.x, MAP_CENTER.y + MAP_RADIUS + 20.0)
	overlay_canvas.mouse_filter = Control.MOUSE_FILTER_IGNORE
	overlay_canvas.draw.connect(_draw_overlay)
	add_child(overlay_canvas)

	build_location_plate()

func build_location_plate() -> void:
	plate_panel.position = Vector2(8.0, MAP_CENTER.y + MAP_RADIUS + 10.0)
	plate_panel.size = Vector2(WIDGET_SIZE.x - 16.0, 62.0)
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.05, 0.04, 0.06, 0.92)
	style.border_color = Color(0.84, 0.65, 0.33, 0.92)
	style.set_border_width_all(2)
	style.set_corner_radius_all(8)
	style.content_margin_left = 10
	style.content_margin_right = 10
	style.content_margin_top = 5
	style.content_margin_bottom = 5
	plate_panel.add_theme_stylebox_override("panel", style)
	add_child(plate_panel)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 2)
	plate_panel.add_child(vbox)

	var fb: Font = MapStyle.body_font()
	loc_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	loc_label.clip_text = true
	loc_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	loc_label.custom_minimum_size = Vector2(216, 18)
	loc_label.add_theme_font_override("font", fb)
	loc_label.add_theme_font_size_override("font_size", 13)
	loc_label.add_theme_color_override("font_color", Color(1.0, 0.92, 0.72))
	loc_label.text = "Stolica"
	vbox.add_child(loc_label)

	var hbox := HBoxContainer.new()
	hbox.alignment = BoxContainer.ALIGNMENT_CENTER
	hbox.add_theme_constant_override("separation", 6)
	vbox.add_child(hbox)

	coord_label.add_theme_font_override("font", fb)
	coord_label.add_theme_font_size_override("font_size", 11)
	coord_label.add_theme_color_override("font_color", Color(0.76, 0.84, 0.86))
	coord_label.text = "512, 512"
	hbox.add_child(coord_label)

	btn_zoom.text = "2.1×"
	btn_zoom.custom_minimum_size = Vector2(44, 22)
	btn_zoom.add_theme_font_override("font", fb)
	btn_zoom.add_theme_font_size_override("font_size", 11)
	btn_zoom.pressed.connect(toggle_zoom_mode)
	hbox.add_child(btn_zoom)

	btn_3d.text = "3D"
	btn_3d.custom_minimum_size = Vector2(34, 22)
	btn_3d.add_theme_font_override("font", fb)
	btn_3d.add_theme_font_size_override("font_size", 11)
	btn_3d.pressed.connect(func() -> void:
		if world != null:
			world.toggle_map()
	)
	hbox.add_child(btn_3d)

	btn_globe.text = "Globus"
	btn_globe.custom_minimum_size = Vector2(54, 22)
	btn_globe.add_theme_font_override("font", fb)
	btn_globe.add_theme_font_size_override("font_size", 11)
	btn_globe.pressed.connect(func() -> void:
		if world != null:
			if world.atlas_overlay != null:
				world.atlas_overlay.set_mode("globe")
			world.toggle_atlas(true)
	)
	hbox.add_child(btn_globe)

func load_region_texture(land: String) -> void:
	if world == null:
		return
	var tex: Texture2D = world.load_tex("res://regions/%s/minimap_hq.png" % land)
	if tex != null:
		map_tex_rect.texture = tex
	last_hero_pos = world.hero_pos
	refresh()

func toggle_zoom_mode() -> void:
	tactical_zoom = not tactical_zoom
	current_zoom = 2.10 if tactical_zoom else 1.0
	btn_zoom.text = "2.1×" if tactical_zoom else "1.0×"
	refresh()

func _on_radar_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		var mb: InputEventMouseButton = event
		var local_c: Vector2 = mb.position - Vector2(MAP_RADIUS, MAP_RADIUS)
		if local_c.length() > MAP_RADIUS:
			return
		if mb.button_index == MOUSE_BUTTON_LEFT:
			if world != null:
				world.toggle_map()
		elif mb.button_index == MOUSE_BUTTON_RIGHT:
			toggle_zoom_mode()

func _compute_center_uv() -> Vector2:
	if world == null:
		return Vector2(0.5, 0.5)
	var ws: float = float(world.world_size)
	var hp: Vector2 = world.hero_pos
	var hero_uv := Vector2(hp.x / ws, hp.y / ws)
	if current_zoom <= 1.05:
		return Vector2(0.5, 0.5)
	var half_span := 0.5 / current_zoom
	return Vector2(
		clampf(hero_uv.x, half_span, 1.0 - half_span),
		clampf(hero_uv.y, half_span, 1.0 - half_span)
	)

func _world_to_radar(wx: float, wz: float, center_uv: Vector2) -> Vector2:
	var ws: float = float(world.world_size)
	var uv := Vector2(wx / ws, wz / ws)
	var rel := (uv - center_uv) * current_zoom
	return MAP_CENTER + rel * MAP_DIAMETER

func refresh(nearest_name: String = "", in_safe: bool = true) -> void:
	if world == null:
		return
	var hp: Vector2 = world.hero_pos
	var delta_h: Vector2 = hp - last_hero_pos
	if delta_h.length_squared() > 0.04:
		hero_heading = delta_h.normalized()
		last_hero_pos = hp
	var center_uv := _compute_center_uv()
	map_mat.set_shader_parameter("center_uv", center_uv)
	map_mat.set_shader_parameter("zoom", current_zoom)
	if not nearest_name.is_empty():
		loc_label.text = nearest_name
	coord_label.text = "%d, %d" % [int(round(hp.x)), int(round(hp.y))]
	loc_label.add_theme_color_override("font_color", Color(0.52, 0.96, 0.68) if in_safe else Color(1.0, 0.68, 0.42))
	overlay_canvas.queue_redraw()

func _draw_diamond(pos: Vector2, r: float, fill: Color, outline: Color) -> void:
	var pts := PackedVector2Array([
		pos + Vector2(0, -r),
		pos + Vector2(r, 0),
		pos + Vector2(0, r),
		pos + Vector2(-r, 0),
	])
	overlay_canvas.draw_colored_polygon(pts, fill)
	var closed := PackedVector2Array([pts[0], pts[1], pts[2], pts[3], pts[0]])
	overlay_canvas.draw_polyline(closed, outline, 1.4, true)

func _draw_overlay() -> void:
	if world == null:
		return
	var f: Font = MapStyle.font()
	var center_uv := _compute_center_uv()
	var clip_r := MAP_RADIUS - 5.0
	var pulse: float = 0.5 + 0.5 * sin(float(world.world_time) * 4.5)
	var ws: float = float(world.world_size)

	# 1. Safe Capital perimeter ring centered on real map capital_center
	var cap_c: Vector2 = world.capital_center if "capital_center" in world else Vector2(ws * 0.5, ws * 0.5)
	var cap_pt := _world_to_radar(cap_c.x, cap_c.y, center_uv)
	var cap_r: float = (float(world.safe_city_radius) / ws) * MAP_DIAMETER * current_zoom
	if cap_pt.distance_to(MAP_CENTER) + cap_r < clip_r + 12.0:
		overlay_canvas.draw_arc(cap_pt, minf(cap_r, clip_r), 0.0, TAU, 48, Color(0.38, 0.94, 0.62, 0.42), 1.4, true)

	# 2. Live Wildlife Fauna (soft emerald/amber micro-dots)
	for ag: Dictionary in world.live_agents:
		var node = ag.get("node")
		if node == null or not is_instance_valid(node):
			continue
		var ap: Vector2 = ag.get("pos", Vector2.ZERO)
		var rp := _world_to_radar(ap.x, ap.y, center_uv)
		if rp.distance_to(MAP_CENTER) > clip_r - 2.0:
			continue
		var kind := str(node.get("kind")) if "kind" in node else ""
		if kind == "animal":
			overlay_canvas.draw_circle(rp, 2.1, Color(0.56, 0.92, 0.58, 0.80))
		elif kind == "monster":
			overlay_canvas.draw_circle(rp, 2.7, Color(0.98, 0.24, 0.18, 0.92))
			overlay_canvas.draw_arc(rp, 3.6, 0.0, TAU, 10, Color(0.12, 0.02, 0.02, 0.7), 0.9, true)
		elif kind == "npc":
			overlay_canvas.draw_circle(rp, 3.0, Color(1.0, 0.86, 0.34, 0.96))
			overlay_canvas.draw_arc(rp, 4.1, 0.0, TAU, 12, Color(0.08, 0.06, 0.02, 0.85), 1.1, true)

	# 3. Capital Service Buildings (crisp vector icons)
	for b: Dictionary in world.buildings:
		var role := str(b.get("role", ""))
		if not (role in ["landmark", "hall", "smithy", "inn", "shop", "arena", "depot"]):
			continue
		var bp := _world_to_radar(float(b.get("x", 512.0)), float(b.get("z", 512.0)), center_uv)
		if bp.distance_to(MAP_CENTER) > clip_r - 3.0:
			continue
		match role:
			"landmark":
				_draw_diamond(bp, 6.2, Color(1.0, 0.82, 0.28), Color(0.14, 0.08, 0.02))
			"smithy":
				_draw_diamond(bp, 4.6, Color(1.0, 0.54, 0.20), Color(0.12, 0.05, 0.02))
			"inn":
				_draw_diamond(bp, 4.6, Color(0.98, 0.72, 0.36), Color(0.12, 0.06, 0.02))
			"shop":
				_draw_diamond(bp, 4.6, Color(0.32, 0.92, 0.56), Color(0.04, 0.14, 0.06))
			"arena":
				_draw_diamond(bp, 4.8, Color(0.96, 0.34, 0.34), Color(0.14, 0.02, 0.02))
			"depot":
				_draw_diamond(bp, 4.4, Color(0.38, 0.84, 0.98), Color(0.03, 0.10, 0.16))
			"hall":
				_draw_diamond(bp, 5.0, Color(0.88, 0.78, 0.98), Color(0.10, 0.06, 0.16))

	# 4. 6 Exp-Zone Combat Clearings (tactical battle rings)
	for ez: Dictionary in world.exp_zones:
		var ep := _world_to_radar(float(ez.get("x", 512.0)), float(ez.get("z", 512.0)), center_uv)
		var dist_c := ep.distance_to(MAP_CENTER)
		if dist_c <= clip_r - 3.0:
			overlay_canvas.draw_circle(ep, 5.2, Color(0.92, 0.20, 0.14, 0.88))
			overlay_canvas.draw_arc(ep, 7.6 + pulse * 1.4, 0.0, TAU, 18, Color(1.0, 0.80, 0.30, 0.88), 1.5, true)
			# Crossed-swords X inside badge
			overlay_canvas.draw_line(ep + Vector2(-2.6, -2.6), ep + Vector2(2.6, 2.6), Color(1.0, 0.96, 0.82), 1.3, true)
			overlay_canvas.draw_line(ep + Vector2(2.6, -2.6), ep + Vector2(-2.6, 2.6), Color(1.0, 0.96, 0.82), 1.3, true)
		else:
			# Edge indicator arrow pointing toward off-radar exp-zone
			var dir := (ep - MAP_CENTER).normalized()
			var edge_p := MAP_CENTER + dir * (clip_r - 1.5)
			overlay_canvas.draw_circle(edge_p, 3.0, Color(1.0, 0.42, 0.24, 0.85))

	# 5. Hero Directional Arrow & Radar Pulse
	var hp := _world_to_radar(world.hero_pos.x, world.hero_pos.y, center_uv)
	if hp.distance_to(MAP_CENTER) <= clip_r:
		overlay_canvas.draw_arc(hp, 8.5 + pulse * 3.5, 0.0, TAU, 24, Color(0.32, 0.94, 1.0, 0.48 - pulse * 0.22), 1.5, true)
		var fwd := hero_heading.normalized()
		var right := Vector2(-fwd.y, fwd.x)
		var arrow := PackedVector2Array([
			hp + fwd * 8.0,
			hp - fwd * 5.2 + right * 5.2,
			hp - fwd * 2.4,
			hp - fwd * 5.2 - right * 5.2,
		])
		overlay_canvas.draw_colored_polygon(arrow, Color(0.24, 0.96, 1.0, 1.0))
		var arrow_out := PackedVector2Array([arrow[0], arrow[1], arrow[2], arrow[3], arrow[0]])
		overlay_canvas.draw_polyline(arrow_out, Color(0.03, 0.06, 0.10, 0.96), 1.8, true)

	# 6. Ornate Antique-Gold Double Bezel & Compass Degree Ticks
	overlay_canvas.draw_arc(MAP_CENTER, MAP_RADIUS + 7.0, 0.0, TAU, 80, Color(0.03, 0.02, 0.03, 0.82), 6.0, true)
	overlay_canvas.draw_arc(MAP_CENTER, MAP_RADIUS + 4.5, 0.0, TAU, 80, Color(0.58, 0.42, 0.18, 0.96), 3.6, true)
	overlay_canvas.draw_arc(MAP_CENTER, MAP_RADIUS + 2.2, 0.0, TAU, 80, Color(0.92, 0.76, 0.42, 0.98), 2.4, true)
	overlay_canvas.draw_arc(MAP_CENTER, MAP_RADIUS - 0.5, 0.0, TAU, 80, Color(0.10, 0.08, 0.06, 0.95), 2.2, true)

	for deg in range(0, 360, 10):
		var rad := deg_to_rad(float(deg))
		var is_major := (deg % 30 == 0)
		var r0 := MAP_RADIUS - (5.0 if is_major else 2.5)
		var r1 := MAP_RADIUS + 1.0
		var p0 := MAP_CENTER + Vector2(cos(rad), sin(rad)) * r0
		var p1 := MAP_CENTER + Vector2(cos(rad), sin(rad)) * r1
		overlay_canvas.draw_line(p0, p1, Color(0.95, 0.80, 0.46, 0.82 if is_major else 0.45), 1.4 if is_major else 1.0, true)

	# 7. Cardinal Compass Rose Badges (N, E, S, W)
	var cardinals := [
		{"txt": "N", "ang": -PI * 0.5, "col": Color(1.0, 0.42, 0.28)},
		{"txt": "E", "ang": 0.0, "col": Color(0.96, 0.84, 0.54)},
		{"txt": "S", "ang": PI * 0.5, "col": Color(0.96, 0.84, 0.54)},
		{"txt": "W", "ang": PI, "col": Color(0.96, 0.84, 0.54)},
	]
	for c: Dictionary in cardinals:
		var ang: float = float(c["ang"])
		var cp := MAP_CENTER + Vector2(cos(ang), sin(ang)) * (MAP_RADIUS + 3.5)
		overlay_canvas.draw_circle(cp, 10.0, Color(0.07, 0.05, 0.06, 0.96))
		overlay_canvas.draw_arc(cp, 10.0, 0.0, TAU, 20, Color(0.88, 0.70, 0.36, 0.96), 1.8, true)
		var txt := str(c["txt"])
		var col: Color = c["col"]
		overlay_canvas.draw_string(f, cp + Vector2(-4.5, 4.5), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, col)
