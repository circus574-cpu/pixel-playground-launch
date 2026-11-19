extends Control
## Dynamic Rotating & Following Cartographic Minimap for KI Legends.
## - Hero chevron stays PERMANENTLY centered at MAP_CENTER pointing forward (UP in rotating mode).
## - The entire terrain, real roads, bridges, building footprints, capital/town crests,
##   enterable utility building dots, NPCs, monsters, and compass ring smoothly ROTATE & TRANSLATE
##   as the hero walks through the world!

const MapStyle := preload("res://scripts/map_style.gd")

const MAP_DIAMETER := 224.0
const MAP_RADIUS := 112.0
const MAP_CENTER := Vector2(138.0, 126.0)
const WIDGET_SIZE := Vector2(276.0, 344.0)
const ZOOM_LEVELS := [3.20, 1.90, 1.00]
const ISO_ALIGN_ROT := -PI * 0.25 # Exact 1:1 match with iso(x,z) camera: NW=UP, NE=RIGHT, SE=DOWN, SW=LEFT!

var world: Node2D
var map_tex_rect := TextureRect.new()
var map_mat := ShaderMaterial.new()
var overlay_canvas := Control.new()
var plate_panel := PanelContainer.new()
var loc_label := Label.new()
var coord_label := Label.new()
var btn_zoom := Button.new()
var btn_rot := Button.new()
var btn_3d := Button.new()
var btn_globe := Button.new()

var zoom_idx := 0
var current_zoom := 3.20
var rotate_with_hero := false
var hero_heading := Vector2(-0.7071, -0.7071)
var map_rotation := ISO_ALIGN_ROT
var target_rotation := ISO_ALIGN_ROT
var last_hero_pos := Vector2(512.0, 512.0)

func _ready() -> void:
	custom_minimum_size = WIDGET_SIZE
	size = WIDGET_SIZE
	mouse_filter = Control.MOUSE_FILTER_PASS

	map_mat.shader = load("res://shaders/minimap_circle.gdshader")
	map_mat.set_shader_parameter("center_uv", Vector2(0.5, 0.5))
	map_mat.set_shader_parameter("zoom", current_zoom)
	map_mat.set_shader_parameter("rotation_rad", ISO_ALIGN_ROT)

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
	plate_panel.position = Vector2(4.0, MAP_CENTER.y + MAP_RADIUS + 8.0)
	plate_panel.size = Vector2(WIDGET_SIZE.x - 8.0, 92.0)
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.05, 0.04, 0.06, 0.94)
	style.border_color = Color(0.88, 0.68, 0.34, 0.95)
	style.set_border_width_all(2)
	style.set_corner_radius_all(9)
	style.content_margin_left = 8
	style.content_margin_right = 8
	style.content_margin_top = 6
	style.content_margin_bottom = 6
	plate_panel.add_theme_stylebox_override("panel", style)
	add_child(plate_panel)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 5)
	plate_panel.add_child(vbox)

	var fb: Font = MapStyle.body_font()
	var top_info := HBoxContainer.new()
	top_info.add_theme_constant_override("separation", 6)
	vbox.add_child(top_info)

	loc_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
	loc_label.clip_text = true
	loc_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	loc_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	loc_label.add_theme_font_override("font", fb)
	loc_label.add_theme_font_size_override("font_size", 14)
	loc_label.add_theme_color_override("font_color", Color(1.0, 0.92, 0.72))
	loc_label.text = "Stolica"
	top_info.add_child(loc_label)

	coord_label.add_theme_font_override("font", fb)
	coord_label.add_theme_font_size_override("font_size", 12)
	coord_label.add_theme_color_override("font_color", Color(0.76, 0.86, 0.92))
	coord_label.text = "512, 512"
	top_info.add_child(coord_label)

	var hbox := HBoxContainer.new()
	hbox.alignment = BoxContainer.ALIGNMENT_CENTER
	hbox.add_theme_constant_override("separation", 5)
	vbox.add_child(hbox)

	btn_zoom.text = "3.2×"
	btn_zoom.custom_minimum_size = Vector2(56, 36)
	btn_zoom.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	btn_zoom.add_theme_font_override("font", fb)
	btn_zoom.add_theme_font_size_override("font_size", 13)
	btn_zoom.pressed.connect(toggle_zoom_mode)
	hbox.add_child(btn_zoom)

	btn_rot.text = "ISO"
	btn_rot.tooltip_text = "Przełącz: 1:1 z ekranem (ISO) / obrót za kierunkiem marszu (OBR)"
	btn_rot.custom_minimum_size = Vector2(52, 36)
	btn_rot.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	btn_rot.add_theme_font_override("font", fb)
	btn_rot.add_theme_font_size_override("font_size", 13)
	btn_rot.pressed.connect(toggle_rotate_mode)
	hbox.add_child(btn_rot)

	btn_3d.text = "3D"
	btn_3d.custom_minimum_size = Vector2(46, 36)
	btn_3d.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	btn_3d.add_theme_font_override("font", fb)
	btn_3d.add_theme_font_size_override("font_size", 13)
	btn_3d.pressed.connect(func() -> void:
		if world != null:
			world.toggle_map()
	)
	hbox.add_child(btn_3d)

	btn_globe.text = "Mapa"
	btn_globe.custom_minimum_size = Vector2(62, 36)
	btn_globe.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	btn_globe.add_theme_font_override("font", fb)
	btn_globe.add_theme_font_size_override("font_size", 13)
	btn_globe.pressed.connect(func() -> void:
		if world != null:
			if world.atlas_overlay != null:
				world.atlas_overlay.set_mode("atlas")
			world.toggle_atlas(true)
	)
	hbox.add_child(btn_globe)

func load_region_texture(land: String) -> void:
	if world == null:
		return
	var tex: Texture2D = world.load_tex("res://regions/%s/minimap_hq.png" % land)
	if tex != null:
		map_tex_rect.texture = tex
	var surf: Texture2D = world.load_tex("res://regions/%s/surface.png" % land)
	map_mat.set_shader_parameter("surface_tex", surf)
	map_mat.set_shader_parameter("has_surface", 1.0 if surf != null else 0.0)
	map_mat.set_shader_parameter("is_aether", 1.0 if land == "aether" else 0.0)
	map_mat.set_shader_parameter("is_pyra", 1.0 if land == "pyra" else 0.0)
	last_hero_pos = world.hero_pos
	hero_heading = Vector2(-0.7071, -0.7071)
	map_rotation = ISO_ALIGN_ROT
	target_rotation = ISO_ALIGN_ROT
	refresh()

func toggle_zoom_mode() -> void:
	zoom_idx = (zoom_idx + 1) % ZOOM_LEVELS.size()
	current_zoom = float(ZOOM_LEVELS[zoom_idx])
	btn_zoom.text = "%.1f×" % current_zoom
	refresh()

func toggle_rotate_mode() -> void:
	rotate_with_hero = not rotate_with_hero
	btn_rot.text = "OBR" if rotate_with_hero else "ISO"
	if not rotate_with_hero:
		target_rotation = ISO_ALIGN_ROT
	refresh()

func _on_radar_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		var mb: InputEventMouseButton = event
		var local_c: Vector2 = mb.position - Vector2(MAP_RADIUS, MAP_RADIUS)
		if local_c.length() > MAP_RADIUS:
			return
		if mb.button_index == MOUSE_BUTTON_LEFT:
			if world != null:
				if bool(world.gm_minimap_teleport):
					var center_uv := _hero_uv()
					var rel := (local_c / (MAP_DIAMETER * current_zoom)).rotated(map_rotation)
					var uv := center_uv + rel
					var ws: float = maxf(float(world.world_size), 1.0)
					world.teleport_to_world_pos(str(world.current_land), uv.x * ws, uv.y * ws)
				else:
					world.toggle_map()
		elif mb.button_index == MOUSE_BUTTON_RIGHT:
			toggle_zoom_mode()

func _hero_uv() -> Vector2:
	if world == null:
		return Vector2(0.5, 0.5)
	var ws: float = maxf(float(world.world_size), 1.0)
	var hp: Vector2 = world.hero_pos
	# NEVER clamp hero_uv — player ALWAYS stays dead-center while the world moves & rotates beneath!
	return Vector2(hp.x / ws, hp.y / ws)

func _world_to_radar(wx: float, wz: float, center_uv: Vector2) -> Vector2:
	var ws: float = maxf(float(world.world_size), 1.0)
	var uv := Vector2(wx / ws, wz / ws)
	var rel := (uv - center_uv).rotated(-map_rotation) * current_zoom
	return MAP_CENTER + rel * MAP_DIAMETER

func set_heading_immediate(dir: Vector2) -> void:
	if dir.length_squared() > 0.001:
		hero_heading = dir.normalized()
		if rotate_with_hero:
			# Angle so that hero_heading points straight UP (0, -1) on radar!
			target_rotation = hero_heading.angle() + PI * 0.5
			map_rotation = target_rotation
		else:
			target_rotation = ISO_ALIGN_ROT
			map_rotation = ISO_ALIGN_ROT

func refresh(nearest_name: String = "", in_safe: bool = true) -> void:
	if world == null:
		return
	var hp: Vector2 = world.hero_pos
	var delta_h: Vector2 = hp - last_hero_pos
	if delta_h.length_squared() > 0.01:
		hero_heading = delta_h.normalized()
		last_hero_pos = hp
		if rotate_with_hero:
			target_rotation = hero_heading.angle() + PI * 0.5
	if not rotate_with_hero:
		target_rotation = ISO_ALIGN_ROT
	map_rotation = lerp_angle(map_rotation, target_rotation, 0.22)

	var center_uv := _hero_uv()
	map_mat.set_shader_parameter("center_uv", center_uv)
	map_mat.set_shader_parameter("zoom", current_zoom)
	map_mat.set_shader_parameter("rotation_rad", map_rotation)

	var on_road: bool = world.is_on_road(hp.x, hp.y) if world.has_method("is_on_road") else false
	if not nearest_name.is_empty():
		loc_label.text = ("%s • Droga" % nearest_name) if on_road else nearest_name
	coord_label.text = "%d, %d" % [int(round(hp.x)), int(round(hp.y))]
	loc_label.add_theme_color_override("font_color", Color(0.52, 0.96, 0.68) if in_safe else Color(1.0, 0.72, 0.42))
	overlay_canvas.queue_redraw()

var pin_cache: Dictionary = {}

func _pin_tex(key: String) -> Texture2D:
	if pin_cache.has(key):
		return pin_cache[key] as Texture2D
	var path := "res://assets/ui/map_icons/pin_%s.webp" % key
	var tex: Texture2D = world.load_tex(path) if (world != null and world.has_method("load_tex")) else null
	if tex == null:
		var abs_p := ProjectSettings.globalize_path(path)
		if FileAccess.file_exists(abs_p):
			var img := Image.new()
			if img.load(abs_p) == OK:
				tex = ImageTexture.create_from_image(img)
	pin_cache[key] = tex
	return tex

func _draw_pin(key: String, pos: Vector2, dia: float) -> void:
	var tex := _pin_tex(key)
	if tex != null:
		overlay_canvas.draw_circle(pos + Vector2(0.0, 1.0), dia * 0.40, Color(0.02, 0.02, 0.03, 0.45))
		overlay_canvas.draw_texture_rect(tex, Rect2(pos - Vector2(dia * 0.5, dia * 0.5), Vector2(dia, dia)), false)

func _role_pin_key(role: String) -> String:
	if role in ["hall", "smithy", "inn", "shop", "arena", "depot", "landmark"]:
		return role
	return "landmark"

func _draw_clipped_polyline(pts: PackedVector2Array, clip_r: float, col: Color, width: float) -> void:
	for i in range(pts.size() - 1):
		var a: Vector2 = pts[i]
		var b: Vector2 = pts[i + 1]
		var da := a.distance_to(MAP_CENTER)
		var db := b.distance_to(MAP_CENTER)
		if da > clip_r and db > clip_r:
			continue
		if da > clip_r:
			a = MAP_CENTER + (a - MAP_CENTER).normalized() * clip_r
		if db > clip_r:
			b = MAP_CENTER + (b - MAP_CENTER).normalized() * clip_r
		overlay_canvas.draw_line(a, b, col, width, true)

func _draw_overlay() -> void:
	if world == null:
		return
	var f: Font = MapStyle.font()
	var center_uv := _hero_uv()
	var clip_r := MAP_RADIUS - 4.0
	var pulse: float = 0.5 + 0.5 * sin(float(world.world_time) * 4.5)
	var ws: float = maxf(float(world.world_size), 1.0)
	var px_per_m := (MAP_DIAMETER * current_zoom) / ws

	# 1. ALL REAL PLANAR IN-GAME VECTOR ROADS (4-tier cartographic hierarchy rotated smoothly with the hero!)
	if "roads" in world:
		var tier_order := ["footpath", "regional", "city", "highway"]
		for want_tier: String in tier_order:
			for rd: Dictionary in world.roads:
				var tier := str(rd.get("tier", "footpath"))
				if tier != want_tier:
					continue
				var raw_pts: Array = rd.get("pts", [])
				if raw_pts.size() < 2:
					continue
				var spts := PackedVector2Array()
				for pt: Array in raw_pts:
					spts.append(_world_to_radar(float(pt[0]), float(pt[1]), center_uv))
				var base_w := 3.0 if tier == "highway" else (2.4 if tier == "city" else (2.0 if tier == "regional" else 1.4))
				var rw := clampf(base_w * (current_zoom / 2.2), 1.0, 4.2)
				_draw_clipped_polyline(spts, clip_r, Color(0.08, 0.05, 0.03, 0.76), rw + 1.4)
				var rcol := Color(0.98, 0.89, 0.64, 0.92) if tier == "highway" else (
					Color(0.95, 0.87, 0.68, 0.88) if tier == "city" else (
						Color(0.88, 0.78, 0.56, 0.82) if tier == "regional" else Color(0.78, 0.68, 0.50, 0.72)
					)
				)
				_draw_clipped_polyline(spts, clip_r, rcol, rw)

	# 2. Safe Capital perimeter ring (strictly clipped inside circular radar bezel!)
	var cap_c: Vector2 = world.capital_center if "capital_center" in world else Vector2(ws * 0.5, ws * 0.5)
	var cap_pt := _world_to_radar(cap_c.x, cap_c.y, center_uv)
	var cap_r: float = float(world.safe_city_radius) * px_per_m
	if cap_pt.distance_to(MAP_CENTER) < clip_r + cap_r and cap_r > 4.0:
		var ring_pts := PackedVector2Array()
		for ri in 49:
			var ang := TAU * float(ri) / 48.0
			ring_pts.append(cap_pt + Vector2(cos(ang), sin(ang)) * cap_r)
		_draw_clipped_polyline(ring_pts, clip_r, Color(0.38, 0.94, 0.62, 0.34), 1.3)

	# 3. REAL BUILDING FOOTPRINTS & BRIDGES (shows actual city layout directly on radar!)
	for b: Dictionary in world.buildings:
		var role := str(b.get("role", ""))
		if role == "prop":
			continue
		var bp := _world_to_radar(float(b.get("x", 512.0)), float(b.get("z", 512.0)), center_uv)
		if bp.distance_to(MAP_CENTER) > clip_r - 4.0:
			continue
		if role == "bridge":
			_draw_pin("bridge", bp, 16.0 if current_zoom >= 2.0 else 12.0)
		else:
			var foot_m := float(b.get("footprint_r", 20.0))
			var fr := clampf(foot_m * px_per_m * 0.65, 2.4, 14.0)
			if current_zoom >= 1.6:
				var half_s := Vector2(fr, fr * 0.82)
				var corners := PackedVector2Array([
					bp + Vector2(-half_s.x, -half_s.y).rotated(-map_rotation),
					bp + Vector2(half_s.x, -half_s.y).rotated(-map_rotation),
					bp + Vector2(half_s.x, half_s.y).rotated(-map_rotation),
					bp + Vector2(-half_s.x, half_s.y).rotated(-map_rotation),
				])
				var roof_col := Color(0.36, 0.30, 0.28, 0.84) if role == "house" else (Color(0.46, 0.42, 0.38, 0.86) if role in ["gate", "tower"] else Color(0.56, 0.40, 0.24, 0.88))
				overlay_canvas.draw_colored_polygon(corners, roof_col)
				corners.append(corners[0])
				overlay_canvas.draw_polyline(corners, Color(0.06, 0.04, 0.03, 0.94), 1.3, true)

	# 4. Live Peaceful Wildlife Fauna & Capital NPCs
	for ag: Dictionary in world.live_agents:
		var node = ag.get("node")
		if node == null or not is_instance_valid(node):
			continue
		var ap: Vector2 = ag.get("pos", Vector2.ZERO)
		var rp := _world_to_radar(ap.x, ap.y, center_uv)
		if rp.distance_to(MAP_CENTER) > clip_r - 2.0:
			continue
		var kind := str(node.get("actor_kind")) if "actor_kind" in node else ""
		if kind == "animal":
			overlay_canvas.draw_circle(rp, 2.0, Color(0.56, 0.92, 0.58, 0.78))
		elif kind == "npc":
			overlay_canvas.draw_circle(rp, 2.5, Color(1.0, 0.90, 0.44, 0.95))

	# 5. Painted Heraldic Medallions: Capital Starburst, Town Shields & Enterable Service Medallions!
	for b: Dictionary in world.buildings:
		var mk := str(b.get("map_kind", ""))
		var is_ent := bool(b.get("enterable", false))
		var role := str(b.get("role", ""))
		if mk != "capital" and mk != "town" and not is_ent:
			continue
		var bp := _world_to_radar(float(b.get("x", 512.0)), float(b.get("z", 512.0)), center_uv)
		var dist_c := bp.distance_to(MAP_CENTER)
		if dist_c <= clip_r - 5.0:
			if mk == "capital":
				_draw_pin("capital", bp, 22.0)
			elif mk == "town":
				_draw_pin("town", bp, 18.0)
			elif is_ent:
				_draw_pin(_role_pin_key(role), bp, 14.0 if current_zoom >= 2.0 else 11.0)
		elif mk == "town":
			# Subtle directional compass hint on radar rim for distant strongholds/towns
			var dir := (bp - MAP_CENTER).normalized()
			var edge_p := MAP_CENTER + dir * (clip_r - 2.0)
			overlay_canvas.draw_circle(edge_p, 2.6, Color(0.76, 0.90, 1.0, 0.85))

	# 6. Hero Permanently Centered at MAP_CENTER! (Points straight UP in OBR mode, or exact screen-space heading in ISO mode)
	var hp := MAP_CENTER
	overlay_canvas.draw_arc(hp, 9.5 + pulse * 3.0, 0.0, TAU, 24, Color(0.32, 0.96, 1.0, 0.52 - pulse * 0.22), 1.6, true)
	var fwd := Vector2(0.0, -1.0) if rotate_with_hero else hero_heading.normalized().rotated(-map_rotation)
	var right := Vector2(-fwd.y, fwd.x)
	var arrow := PackedVector2Array([
		hp + fwd * 9.0,
		hp - fwd * 5.8 + right * 5.8,
		hp - fwd * 2.4,
		hp - fwd * 5.8 - right * 5.8,
	])
	overlay_canvas.draw_colored_polygon(arrow, Color(0.24, 0.98, 1.0, 1.0))
	var arrow_out := PackedVector2Array([arrow[0], arrow[1], arrow[2], arrow[3], arrow[0]])
	overlay_canvas.draw_polyline(arrow_out, Color(0.03, 0.06, 0.10, 0.98), 1.9, true)

	# 8. Ornate Antique-Gold Double Bezel & ROTATING Compass Degree Ticks
	overlay_canvas.draw_arc(MAP_CENTER, MAP_RADIUS + 7.0, 0.0, TAU, 80, Color(0.03, 0.02, 0.03, 0.82), 6.0, true)
	overlay_canvas.draw_arc(MAP_CENTER, MAP_RADIUS + 4.5, 0.0, TAU, 80, Color(0.58, 0.42, 0.18, 0.96), 3.6, true)
	overlay_canvas.draw_arc(MAP_CENTER, MAP_RADIUS + 2.2, 0.0, TAU, 80, Color(0.92, 0.76, 0.42, 0.98), 2.4, true)
	overlay_canvas.draw_arc(MAP_CENTER, MAP_RADIUS - 0.5, 0.0, TAU, 80, Color(0.10, 0.08, 0.06, 0.95), 2.2, true)

	for deg in range(0, 360, 10):
		var rad := deg_to_rad(float(deg)) - map_rotation
		var is_major := (deg % 30 == 0)
		var r0 := MAP_RADIUS - (5.0 if is_major else 2.5)
		var r1 := MAP_RADIUS + 1.0
		var p0 := MAP_CENTER + Vector2(cos(rad), sin(rad)) * r0
		var p1 := MAP_CENTER + Vector2(cos(rad), sin(rad)) * r1
		overlay_canvas.draw_line(p0, p1, Color(0.95, 0.80, 0.46, 0.82 if is_major else 0.45), 1.4 if is_major else 1.0, true)

	# 9. Rotating Cardinal Compass Rose Badges (N, E, S, W rotate with the world!)
	var cardinals := [
		{"txt": "N", "ang": -PI * 0.5, "col": Color(1.0, 0.42, 0.28)},
		{"txt": "E", "ang": 0.0, "col": Color(0.96, 0.84, 0.54)},
		{"txt": "S", "ang": PI * 0.5, "col": Color(0.96, 0.84, 0.54)},
		{"txt": "W", "ang": PI, "col": Color(0.96, 0.84, 0.54)},
	]
	for c: Dictionary in cardinals:
		var ang: float = float(c["ang"]) - map_rotation
		var cp := MAP_CENTER + Vector2(cos(ang), sin(ang)) * (MAP_RADIUS + 3.5)
		overlay_canvas.draw_circle(cp, 10.0, Color(0.07, 0.05, 0.06, 0.96))
		overlay_canvas.draw_arc(cp, 10.0, 0.0, TAU, 20, Color(0.88, 0.70, 0.36, 0.96), 1.8, true)
		var txt := str(c["txt"])
		var col: Color = c["col"]
		overlay_canvas.draw_string(f, cp + Vector2(-4.5, 4.5), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, col)
