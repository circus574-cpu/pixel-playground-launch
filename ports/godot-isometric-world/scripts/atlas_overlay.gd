extends Control
## Premium 3D Planet Globe + Interactive Pan/Zoom 2D Planet Atlas for KI Legends (Superior).
## Displays the canonical hand-painted Planet Superior continents (Verdantia, Aetheria, Pyra, Nexus-9)
## and 6 quest islands with exact traced coastlines from data/map.json, live hero position tracking,
## clean unobstructed Cinzel cartography plaques, compass rose, and bottom lore/telemetry bar.

const GlobeViewScript := preload("res://scripts/globe_view.gd")
const MapMathScript := preload("res://scripts/map_math.gd")
const MapStyleScript := preload("res://scripts/map_style.gd")

var world: Node2D
var atlas_tex: Texture2D
var space_tex: Texture2D
var map_json: Dictionary = {}
var region_bboxes: Dictionary = {}
var hovered_land := ""
var mode := "globe" # "globe" or "atlas"
var globe

# 2D Atlas pan/zoom state (in 2000x1000 atlas space)
var atlas_zoom := 1.0
var atlas_center := Vector2(1000.0, 500.0)
var atlas_dragging := false
var atlas_drag_moved := false
var atlas_drag_start := Vector2.ZERO

var btn_globe := Button.new()
var btn_atlas := Button.new()
var btn_close := Button.new()
var btn_zoom_in := Button.new()
var btn_zoom_out := Button.new()
var btn_center := Button.new()

const CONTINENT_META := {
	"verdant": {
		"name": "Verdantia",
		"race": "Planetarni",
		"capital": "Zielona Przystań",
		"lore": "Stary Las, Wielkie Jezioro i ośnieżone północne pasmo górskie. Zielona dolina rzek i przystani.",
		"color": Color(0.42, 0.90, 0.52),
		"pos": Vector2(340.0, 265.0),
	},
	"aether": {
		"name": "Aetheria",
		"race": "Mędrcy",
		"capital": "Sanktuarium Tysiąca Źródeł",
		"lore": "Śnieżne szczyty, lodowce i tarasowe sanktuaria źródeł z jedyną szmaragdową górą w sercu mrozów.",
		"color": Color(0.56, 0.88, 1.0),
		"pos": Vector2(1310.0, 310.0),
	},
	"pyra": {
		"name": "Pyra",
		"race": "Legendy",
		"capital": "Twierdza Popiołu",
		"lore": "Czynne wulkany, rzeki lawy spływające kanionami do morza, bazaltowe granie i północne fiordy.",
		"color": Color(1.0, 0.54, 0.24),
		"pos": Vector2(715.0, 725.0),
	},
	"nexus": {
		"name": "Nexus-9",
		"race": "Androidy",
		"capital": "Węzeł Świadomości",
		"lore": "Pustynno-tytanowy kontynent przecięty wielkim kanałem chłodzącym, estakadami i portami przemysłowymi.",
		"color": Color(0.32, 0.94, 0.96),
		"pos": Vector2(1760.0, 705.0),
	},
}

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	if world != null:
		atlas_tex = world.load_tex("res://atlas/planet_real_world.png")
		if atlas_tex == null:
			atlas_tex = world.load_tex("res://assets/map/globe-real-world.webp")
		if atlas_tex == null:
			atlas_tex = world.load_tex("res://assets/map/atlas.webp")
		space_tex = world.load_tex("res://assets/map/space.jpg")
	if FileAccess.file_exists("res://data/map.json"):
		map_json = JSON.parse_string(FileAccess.get_file_as_string("res://data/map.json"))
		_cache_region_bboxes()

	build_controls()
	set_mode("globe")

func _cache_region_bboxes() -> void:
	region_bboxes.clear()
	for reg: Dictionary in map_json.get("regions", []):
		var rid := str(reg.get("id", ""))
		var outline: Array = reg.get("outline", [])
		if outline.is_empty():
			continue
		var xs: Array[float] = []
		var ys: Array[float] = []
		for pt: Array in outline:
			xs.append(float(pt[0]))
			ys.append(float(pt[1]))
		var min_x: float = xs.min()
		var max_x: float = xs.max()
		var min_y: float = ys.min()
		var max_y: float = ys.max()
		region_bboxes[rid] = {
			"min_x": min_x,
			"max_x": max_x,
			"min_y": min_y,
			"max_y": max_y,
		}

func hero_atlas_pos() -> Vector2:
	if world == null:
		return Vector2(715.0, 725.0)
	var rid: String = str(world.current_land)
	if region_bboxes.has(rid):
		var bb: Dictionary = region_bboxes[rid]
		var ws: float = maxf(float(world.world_size), 1.0)
		var hp: Vector2 = world.hero_pos
		var u := clampf(hp.x / ws, 0.12, 0.88)
		var v := clampf(hp.y / ws, 0.14, 0.86)
		return Vector2(
			lerpf(float(bb["min_x"]), float(bb["max_x"]), u),
			lerpf(float(bb["min_y"]), float(bb["max_y"]), v)
		)
	var meta: Dictionary = CONTINENT_META.get(rid, CONTINENT_META["pyra"])
	return meta["pos"]

func sync_live_hero() -> void:
	if globe != null:
		globe.set_player_atlas(hero_atlas_pos())
	if visible:
		queue_redraw()

func _style_nav_btn(btn: Button) -> void:
	var st := StyleBoxFlat.new()
	st.bg_color = Color(0.16, 0.10, 0.06, 0.92)
	st.border_color = Color(0.84, 0.66, 0.36, 0.92)
	st.set_border_width_all(2)
	st.set_corner_radius_all(8)
	btn.add_theme_stylebox_override("normal", st)
	var st_h := st.duplicate()
	st_h.bg_color = Color(0.28, 0.18, 0.10, 0.96)
	btn.add_theme_stylebox_override("hover", st_h)
	btn.add_theme_color_override("font_color", Color(0.98, 0.92, 0.78))
	btn.add_theme_font_size_override("font_size", 14)

func _map_rect() -> Rect2:
	return Rect2(16.0, 58.0, maxf(size.x - 32.0, 320.0), maxf(size.y - 166.0, 240.0))

func build_controls() -> void:
	if world == null:
		return
	var color_tex: Texture2D = world.load_tex("res://assets/map/globe-real-world.webp")
	if color_tex == null:
		color_tex = world.load_tex("res://assets/map/globe-color.webp")
	var cloud_tex: Texture2D = world.load_tex("res://assets/map/globe-clouds.webp")
	var regions_arr: Array = map_json.get("regions", [])
	if color_tex != null and cloud_tex != null and not regions_arr.is_empty():
		globe = GlobeViewScript.new()
		var mr := _map_rect()
		globe.position = mr.position
		globe.size = mr.size
		var p_atlas := hero_atlas_pos()
		globe.setup(color_tex, cloud_tex, regions_arr, p_atlas)
		globe.select(str(world.current_land))
		globe.focus_on(MapMathScript.atlas_to_lonlat(p_atlas))
		globe.region_picked.connect(_on_globe_region_picked)
		add_child(globe)

	btn_globe.text = "GLOBUS 3D"
	_style_nav_btn(btn_globe)
	btn_globe.pressed.connect(func() -> void: set_mode("globe"))
	add_child(btn_globe)

	btn_atlas.text = "MAPA 2D"
	_style_nav_btn(btn_atlas)
	btn_atlas.pressed.connect(func() -> void: set_mode("atlas"))
	add_child(btn_atlas)

	btn_close.text = "ZAMKNIJ"
	_style_nav_btn(btn_close)
	btn_close.pressed.connect(func() -> void:
		if world != null:
			world.toggle_atlas(false)
	)
	add_child(btn_close)

	btn_zoom_in.text = "+"
	_style_nav_btn(btn_zoom_in)
	btn_zoom_in.pressed.connect(func() -> void:
		if mode == "globe" and globe != null:
			globe.zoom_by(1.18)
		else:
			_zoom_atlas(1.30)
	)
	add_child(btn_zoom_in)

	btn_zoom_out.text = "−"
	_style_nav_btn(btn_zoom_out)
	btn_zoom_out.pressed.connect(func() -> void:
		if mode == "globe" and globe != null:
			globe.zoom_by(1.0 / 1.18)
		else:
			_zoom_atlas(1.0 / 1.30)
	)
	add_child(btn_zoom_out)

	btn_center.text = "◎"
	_style_nav_btn(btn_center)
	btn_center.pressed.connect(func() -> void:
		var p_atlas := hero_atlas_pos()
		if mode == "globe" and globe != null:
			globe.focus_on(MapMathScript.atlas_to_lonlat(p_atlas))
		else:
			atlas_zoom = 1.0
			atlas_center = Vector2(1000.0, 500.0)
			queue_redraw()
	)
	add_child(btn_center)

	resized.connect(_layout_controls)
	_layout_controls()

func _layout_controls() -> void:
	var mr := _map_rect()
	if globe != null:
		globe.position = mr.position
		globe.size = mr.size
	btn_close.position = Vector2(size.x - 134.0, 10.0)
	btn_close.size = Vector2(116.0, 38.0)
	btn_atlas.position = Vector2(size.x - 274.0, 10.0)
	btn_atlas.size = Vector2(130.0, 38.0)
	btn_globe.position = Vector2(size.x - 414.0, 10.0)
	btn_globe.size = Vector2(130.0, 38.0)

	var rx := mr.end.x - 56.0
	var ry := mr.position.y + mr.size.y * 0.5 - 76.0
	btn_zoom_in.position = Vector2(rx, ry)
	btn_zoom_in.size = Vector2(44.0, 44.0)
	btn_zoom_out.position = Vector2(rx, ry + 52.0)
	btn_zoom_out.size = Vector2(44.0, 44.0)
	btn_center.position = Vector2(rx, ry + 104.0)
	btn_center.size = Vector2(44.0, 44.0)

func set_mode(new_mode: String) -> void:
	mode = new_mode
	if globe != null:
		globe.visible = (mode == "globe")
		if globe.visible and world != null:
			var p_atlas := hero_atlas_pos()
			globe.set_player_atlas(p_atlas)
			globe.select(str(world.current_land))
			globe.focus_on(MapMathScript.atlas_to_lonlat(p_atlas))
	if mode == "atlas":
		atlas_zoom = 1.0
		atlas_center = Vector2(1000.0, 500.0)
	btn_globe.modulate = Color(1.0, 0.94, 0.72) if mode == "globe" else Color(0.72, 0.72, 0.76)
	btn_atlas.modulate = Color(1.0, 0.94, 0.72) if mode == "atlas" else Color(0.72, 0.72, 0.76)
	queue_redraw()

func _zoom_atlas(factor: float) -> void:
	atlas_zoom = clampf(atlas_zoom * factor, 1.0, 6.0)
	_clamp_atlas_center()
	queue_redraw()

func _clamp_atlas_center() -> void:
	var half_h := 500.0 / atlas_zoom
	atlas_center.y = clampf(atlas_center.y, half_h, 1000.0 - half_h)
	if atlas_zoom <= 1.01:
		atlas_center.x = 1000.0
	else:
		atlas_center.x = fposmod(atlas_center.x, 2000.0)

func _atlas_to_screen(p: Vector2, mr: Rect2) -> Vector2:
	var base_sx := mr.size.x / 2000.0
	var base_sy := mr.size.y / 1000.0
	var sc := Vector2(base_sx, base_sy) * atlas_zoom
	return mr.position + mr.size * 0.5 + (p - atlas_center) * sc

func _screen_to_atlas(s: Vector2, mr: Rect2) -> Vector2:
	var base_sx := mr.size.x / 2000.0
	var base_sy := mr.size.y / 1000.0
	var sc := Vector2(base_sx, base_sy) * atlas_zoom
	return atlas_center + (s - (mr.position + mr.size * 0.5)) / sc

func _on_globe_region_picked(rid: String) -> void:
	if world != null and CONTINENT_META.has(rid):
		world.switch_region(rid)
		world.toggle_atlas(false)

func _gui_input(event: InputEvent) -> void:
	if world == null or mode == "globe":
		return
	var mr := _map_rect()
	if event is InputEventMouseButton:
		var mb: InputEventMouseButton = event
		if mb.button_index == MOUSE_BUTTON_WHEEL_UP and mb.pressed:
			_zoom_atlas(1.22)
		elif mb.button_index == MOUSE_BUTTON_WHEEL_DOWN and mb.pressed:
			_zoom_atlas(1.0 / 1.22)
		elif mb.button_index == MOUSE_BUTTON_LEFT:
			if mb.pressed and mr.has_point(mb.position):
				atlas_dragging = true
				atlas_drag_moved = false
				atlas_drag_start = mb.position
			else:
				if atlas_dragging and not atlas_drag_moved:
					var picked := pick_continent(mb.position)
					if not picked.is_empty():
						world.switch_region(picked)
						world.toggle_atlas(false)
				atlas_dragging = false
	elif event is InputEventMouseMotion:
		var mm: InputEventMouseMotion = event
		if atlas_dragging:
			if (mm.position - atlas_drag_start).length() > 8.0:
				atlas_drag_moved = true
			if atlas_drag_moved and atlas_zoom > 1.01:
				var sc := Vector2(mr.size.x / 2000.0, mr.size.y / 1000.0) * atlas_zoom
				atlas_center -= mm.relative / sc
				_clamp_atlas_center()
				queue_redraw()
		else:
			var prev := hovered_land
			hovered_land = pick_continent(mm.position)
			if hovered_land != prev:
				queue_redraw()

func pick_continent(local_pos: Vector2) -> String:
	var mr := _map_rect()
	if not mr.has_point(local_pos):
		return ""
	var atlas_p := _screen_to_atlas(local_pos, mr)
	var regions_arr: Array = map_json.get("regions", [])
	var hit := MapMathScript.region_at(regions_arr, atlas_p)
	if not hit.is_empty():
		var rid := str(hit.get("id", ""))
		if CONTINENT_META.has(rid):
			return rid
	return ""

func _draw() -> void:
	var f: Font = MapStyleScript.font()
	var rect := Rect2(Vector2.ZERO, size)
	draw_rect(rect, Color(0.02, 0.03, 0.05, 0.96))
	if space_tex != null:
		draw_texture_rect(space_tex, rect, false, Color(0.70, 0.78, 0.92, 0.55))
	draw_rect(rect, Color(0.84, 0.66, 0.36, 0.92), false, 2.5)

	var mr := _map_rect()
	var title_txt := "GLOBUS PLANETY SUPERIOR" if mode == "globe" else "MAPA PLANETY SUPERIOR — ATLAS 2D"
	draw_string(f, Vector2(22, 36), title_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 19, Color(0.98, 0.88, 0.62))

	if mode == "atlas":
		draw_rect(mr, Color(0.04, 0.11, 0.20, 1.0))
		if atlas_tex != null:
			var tl := _atlas_to_screen(Vector2(0.0, 0.0), mr)
			var br := _atlas_to_screen(Vector2(2000.0, 1000.0), mr)
			var img_sz := br - tl
			# Draw central + wrapped horizontal copies clipped visually inside mr
			for copy in [-1, 0, 1]:
				var c_rect := Rect2(tl + Vector2(float(copy) * img_sz.x, 0.0), img_sz)
				var inter := c_rect.intersection(mr)
				if inter.size.x > 1.0 and inter.size.y > 1.0:
					var src_pos := (inter.position - c_rect.position) / img_sz * atlas_tex.get_size()
					var src_sz := inter.size / img_sz * atlas_tex.get_size()
					draw_texture_rect_region(atlas_tex, inter, Rect2(src_pos, src_sz))

		# Subtle lat/lon cartographic graticule
		for gx in range(1, 12):
			var ax := float(gx) / 12.0 * 2000.0
			var x_s := _atlas_to_screen(Vector2(ax, 0.0), mr).x
			if x_s > mr.position.x and x_s < mr.end.x:
				draw_line(Vector2(x_s, mr.position.y), Vector2(x_s, mr.end.y), Color(1.0, 0.95, 0.80, 0.07), 1.0)
		for gy in range(1, 6):
			var ay := float(gy) / 6.0 * 1000.0
			var y_s := _atlas_to_screen(Vector2(0.0, ay), mr).y
			if y_s > mr.position.y and y_s < mr.end.y:
				draw_line(Vector2(mr.position.x, y_s), Vector2(mr.end.x, y_s), Color(1.0, 0.95, 0.80, 0.07), 1.0)

		# Traced golden coastlines + clean Cinzel region names (unobstructed!)
		var regions_arr: Array = map_json.get("regions", [])
		for reg: Dictionary in regions_arr:
			var rid := str(reg.get("id", ""))
			var poly := MapMathScript.polygon(reg)
			if poly.size() < 3:
				continue
			var is_active: bool = (world != null and str(world.current_land) == rid)
			var is_hover: bool = (hovered_land == rid)
			var is_cont: bool = (str(reg.get("kind", "")) == "continent")
			var line_col := Color(1.0, 0.88, 0.44, 0.96) if (is_active or is_hover) else (Color(0.95, 0.76, 0.42, 0.72) if is_cont else Color(0.88, 0.80, 0.56, 0.52))
			var line_w := 2.6 if (is_active or is_hover) else 1.4
			for i in poly.size():
				var a: Vector2 = poly[i]
				var b: Vector2 = poly[(i + 1) % poly.size()]
				if absf(a.x - b.x) > 800.0:
					continue
				var sa := _atlas_to_screen(a, mr)
				var sb := _atlas_to_screen(b, mr)
				if mr.has_point(sa) and mr.has_point(sb):
					draw_line(sa, sb, line_col, line_w, true)

			# Settlement gold pin
			var sp = reg.get("settlementPoint")
			if sp is Dictionary:
				var sp_s := _atlas_to_screen(Vector2(float(sp.get("x", 0.0)), float(sp.get("y", 0.0))), mr)
				if mr.has_point(sp_s):
					draw_circle(sp_s, 5.0, Color(0.06, 0.04, 0.02, 0.90))
					draw_circle(sp_s, 3.4, Color(1.0, 0.84, 0.34, 1.0))

			# Clean floating cartographic title (no giant opaque box hiding the map!)
			var r_lbl = reg.get("label")
			if r_lbl is Dictionary:
				var lp := _atlas_to_screen(Vector2(float(r_lbl.get("x", 1000.0)), float(r_lbl.get("y", 500.0))), mr)
				if mr.has_point(lp):
					var rname := str(reg.get("name", rid.capitalize()))
					var fsize := 17 if is_cont else 12
					var tcol := Color(1.0, 0.93, 0.68) if (is_active or is_hover) else (Color(0.98, 0.92, 0.80) if is_cont else Color(0.88, 0.92, 0.98))
					var tw := f.get_string_size(rname, HORIZONTAL_ALIGNMENT_LEFT, -1, fsize).x
					var draw_y := clampf(lp.y, mr.position.y + float(fsize) + 6.0, mr.end.y - 8.0)
					if is_cont and is_active:
						draw_y += 22.0
					draw_string_outline(f, Vector2(lp.x - tw * 0.5, draw_y), rname, HORIZONTAL_ALIGNMENT_LEFT, -1, fsize, 5, Color(0.03, 0.02, 0.02, 0.96))
					draw_string(f, Vector2(lp.x - tw * 0.5, draw_y), rname, HORIZONTAL_ALIGNMENT_LEFT, -1, fsize, tcol)

		# Live Hero Position Marker ("Ty") placed cleanly above active continent title
		var h_atlas := hero_atlas_pos()
		var hp := _atlas_to_screen(h_atlas, mr)
		if mr.has_point(hp):
			draw_circle(hp, 11.0, Color(1.0, 0.32, 0.18, 0.30))
			draw_circle(hp, 6.6, Color(1.0, 0.30, 0.18, 1.0))
			draw_circle(hp, 3.0, Color(1.0, 1.0, 1.0, 1.0))
			var tag_pos := hp + Vector2(10.0, -10.0)
			draw_string_outline(f, tag_pos, "Ty", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, 5, Color(0.02, 0.02, 0.03, 0.96))
			draw_string(f, tag_pos, "Ty", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color(1.0, 0.96, 0.84))

		# Compass rose (bottom-left inside map)
		MapStyleScript.compass(self, Vector2(mr.position.x + 58.0, mr.end.y - 58.0), 30.0)

	draw_rect(mr, Color(0.84, 0.66, 0.36, 0.82), false, 2.0)

	# Bottom Lore & Telemetry Bar (matches docs/zmiany/2026-11-15/qa/godot-world/map-2d.jpg & map-globe.jpg)
	var bar := Rect2(16.0, mr.end.y + 10.0, size.x - 32.0, 88.0)
	draw_rect(bar, Color(0.06, 0.04, 0.04, 0.92))
	draw_rect(bar, Color(0.68, 0.50, 0.28, 0.85), false, 1.8)

	var inspect_id: String = hovered_land if not hovered_land.is_empty() else (str(world.current_land) if world != null else "pyra")
	var meta: Dictionary = CONTINENT_META.get(inspect_id, CONTINENT_META["pyra"])
	draw_string(f, bar.position + Vector2(16, 24), "%s  •  Lud: %s  •  Stolica: %s" % [
		str(meta.name), str(meta.race), str(meta.capital)
	], HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color(1.0, 0.90, 0.64))
	draw_string(f, bar.position + Vector2(16, 48), str(meta.lore), HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(0.90, 0.88, 0.84))
	if world != null:
		var hp_w: Vector2 = world.hero_pos
		draw_string(f, bar.position + Vector2(16, 72), "Tu jesteś: %s (%.0f, %.0f) m  •  Expowiska: %d  •  NPC: %d  •  Potwory: %d  •  Kliknij kontynent, aby podróżować  |  [G] Globus  [Tab] Atlas 2D  [M] Mapa 3D" % [
			str(CONTINENT_META.get(str(world.current_land), meta).capital), hp_w.x, hp_w.y,
			world.exp_zones.size(), world.npcs_data.size(), world.monsters_data.size()
		], HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(0.78, 0.86, 0.92))
