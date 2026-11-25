extends Control
## Premium 3D Planet Globe + Progressive-LOD Interactive 2D Planet Atlas for KI Legends (Superior).
## - Preserves the owner-accepted canonical Planet Superior hand-painted atlas (`planet_real_world.png`).
## - Progressive Zoom (1.0x .. 12.0x): every zoom step sharpens MORE real in-game details across ALL 4 continents:
##   * Overview (1.0x): Painted continents, Capital Crown Stars, Town/Stronghold Shields & subtle highway hints.
##   * Medium Zoom (>= 1.5x): ALL real in-game roads (highways, ring avenues, city streets, footpaths) & bridges.
##   * Close Zoom (>= 2.4x): Small crisp dots for EVERY enterable utility building + building roof footprints + Exp-Zones.
##   * Street Zoom (>= 4.0x): Individual enterable building titles, houses, gates & live Hero/NPC positions.

const GlobeViewScript := preload("res://scripts/globe_view.gd")
const MapMathScript := preload("res://scripts/map_math.gd")
const MapStyleScript := preload("res://scripts/map_style.gd")
const ForgedUI := preload("res://scripts/forged_ui.gd")

var world: Node2D
var atlas_tex: Texture2D
var space_tex: Texture2D
var map_json: Dictionary = {}
var region_bboxes: Dictionary = {}
var continent_data: Dictionary = {} # rid -> parsed buildings.json (roads, buildings, exp_zones, capital_center)
var hovered_land := ""
var mode := "atlas" # "atlas" (full world 2D) or "globe" (3D)
var globe

# 2D Atlas pan/zoom state (in 2000x1000 atlas space, 1.0x whole world .. 24.0x street zoom!)
var atlas_zoom := 1.0
var atlas_center := Vector2(1000.0, 500.0)
var atlas_dragging := false
var atlas_drag_moved := false
var atlas_drag_start := Vector2.ZERO
var _pinch_pts: Dictionary = {}
var _pinch_span := 0.0
var fast_travel_pins: Array[Dictionary] = []
var atlas_notice := ""
var atlas_notice_t := 0.0

var btn_back := Button.new()
var btn_teleport := Button.new()
var btn_globe := Button.new()
var btn_atlas := Button.new()
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
		"capital": "Lodowe Sanktuarium Pieczęci",
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
	_load_all_continent_details()

	build_controls()
	set_mode("atlas")

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

func _load_all_continent_details() -> void:
	continent_data.clear()
	for rid: String in ["pyra", "verdant", "aether", "nexus"]:
		var bpath := "res://regions/%s/buildings.json" % rid
		if FileAccess.file_exists(bpath):
			var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(bpath))
			if parsed is Dictionary:
				continent_data[rid] = parsed

# Exact 6-DOF sub-pixel calibrated 1:1 affine mapping from each continent's 0..1 map_art.png into 2000x1000 planet_real_world.png
# Format: [x0, ax_u, ax_v, y0, ay_u, ay_v] -> GUARANTEED 0/2468 road vertices in outer ocean across all 4 continents!
const ATLAS_WORLD_AFFINE := {
	"verdant": [-28.53, 681.21, -10.50, -18.43, -16.00, 553.48],
	"aether": [983.55, 653.79, 24.00, 9.67, -12.00, 541.71],
	"nexus": [1484.09, 528.46, 9.50, 426.54, -11.50, 548.22],
	"pyra": [354.31, 717.29, 2.00, 434.46, 1.00, 586.52],
}

func world_to_atlas(rid: String, wx: float, wz: float, world_size: float = 1024.0) -> Vector2:
	if ATLAS_WORLD_AFFINE.has(rid):
		var m: Array = ATLAS_WORLD_AFFINE[rid]
		var u := clampf(wx / maxf(world_size, 1.0), 0.0, 1.0)
		var v := clampf(wz / maxf(world_size, 1.0), 0.0, 1.0)
		return Vector2(
			fposmod(float(m[0]) + float(m[1]) * u + float(m[2]) * v, 2000.0),
			clampf(float(m[3]) + float(m[4]) * u + float(m[5]) * v, 0.0, 1000.0)
		)
	var meta: Dictionary = CONTINENT_META.get(rid, CONTINENT_META["pyra"])
	return meta["pos"]

func atlas_to_world(rid: String, ax: float, ay: float, world_size: float = 1024.0) -> Vector2:
	if ATLAS_WORLD_AFFINE.has(rid):
		var m: Array = ATLAS_WORLD_AFFINE[rid]
		var dx := ax - float(m[0])
		if dx > 1000.0:
			dx -= 2000.0
		elif dx < -1000.0:
			dx += 2000.0
		var dy := ay - float(m[3])
		var a := float(m[1])
		var b := float(m[2])
		var c := float(m[4])
		var d := float(m[5])
		var det := a * d - b * c
		if absf(det) > 0.0001:
			var u := clampf((d * dx - b * dy) / det, 0.02, 0.98)
			var v := clampf((-c * dx + a * dy) / det, 0.02, 0.98)
			return Vector2(u * world_size, v * world_size)
	return Vector2(world_size * 0.5, world_size * 0.5)

func hero_atlas_pos() -> Vector2:
	if world == null:
		return Vector2(715.0, 725.0)
	var rid: String = str(world.current_land)
	var hp: Vector2 = world.hero_pos
	return world_to_atlas(rid, hp.x, hp.y, float(world.world_size))

func sync_live_hero() -> void:
	if globe != null:
		globe.set_player_atlas(hero_atlas_pos())
		if world != null:
			globe.set_player_land(str(world.current_land))
	if visible:
		queue_redraw()

func focus_on_hero(zoom_lvl: float = 3.8) -> void:
	mode = "atlas"
	if globe != null:
		globe.visible = false
	atlas_zoom = clampf(zoom_lvl, 1.0, 24.0)
	atlas_center = hero_atlas_pos()
	_clamp_atlas_center()
	_refresh_mode_buttons()
	queue_redraw()

func focus_atlas_continent(rid: String, zoom_lvl: float = 3.2) -> void:
	mode = "atlas"
	if globe != null:
		globe.visible = false
	atlas_zoom = clampf(zoom_lvl, 1.0, 24.0)
	if continent_data.has(rid):
		var cd: Dictionary = continent_data[rid]
		var ws := float(cd.get("world_size", 1024.0))
		var half := ws * 0.5
		var cap: Array = cd.get("capital_center", [0.0, 0.0])
		atlas_center = world_to_atlas(rid, float(cap[0]) + half, float(cap[1]) + half, ws)
	elif region_bboxes.has(rid):
		var bb: Dictionary = region_bboxes[rid]
		atlas_center = Vector2((float(bb["min_x"]) + float(bb["max_x"])) * 0.5, (float(bb["min_y"]) + float(bb["max_y"])) * 0.5)
	_clamp_atlas_center()
	_refresh_mode_buttons()
	queue_redraw()

func _refresh_mode_buttons() -> void:
	var tp_on: bool = world != null and bool(world.gm_map_teleport_mode)
	ForgedUI.style_button(btn_atlas, "gold" if mode == "atlas" else "slate", 15, 14.0, 8.0)
	ForgedUI.style_button(btn_globe, "gold" if mode == "globe" else "slate", 15, 14.0, 8.0)
	btn_teleport.visible = (mode == "atlas")
	btn_teleport.text = "⚡ TELEPORT: WŁ." if tp_on else "⚡ TELEPORT"
	ForgedUI.style_button(btn_teleport, "gold" if tp_on else "slate", 15, 14.0, 8.0)

func _map_rect() -> Rect2:
	return Rect2(16.0, 68.0, maxf(size.x - 32.0, 320.0), maxf(size.y - 178.0, 240.0))

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
		globe.setup(color_tex, cloud_tex, regions_arr, p_atlas, continent_data, ATLAS_WORLD_AFFINE)
		globe.select(str(world.current_land))
		globe.focus_on(MapMathScript.atlas_to_lonlat(p_atlas))
		globe.region_picked.connect(_on_globe_region_picked)
		add_child(globe)

	btn_back.text = "← WSTECZ"
	ForgedUI.style_button(btn_back, "slate", 16, 22.0, 8.0)
	btn_back.pressed.connect(func() -> void:
		if world != null:
			world.toggle_atlas(false)
	)
	add_child(btn_back)

	btn_teleport.text = "⚡ TELEPORT"
	ForgedUI.style_button(btn_teleport, "slate", 15, 16.0, 8.0)
	btn_teleport.tooltip_text = "Włącz tryb teleportu: kliknij dowolne miejsce na mapie świata"
	btn_teleport.pressed.connect(func() -> void:
		if world != null:
			world.gm_map_teleport_mode = not bool(world.gm_map_teleport_mode)
			_refresh_mode_buttons()
			queue_redraw()
	)
	add_child(btn_teleport)

	btn_atlas.text = "MAPA ŚWIATA"
	ForgedUI.style_button(btn_atlas, "gold", 15, 22.0, 8.0)
	btn_atlas.pressed.connect(func() -> void: focus_on_hero(3.8))
	add_child(btn_atlas)

	btn_globe.text = "GLOBUS 3D"
	ForgedUI.style_button(btn_globe, "slate", 15, 22.0, 8.0)
	btn_globe.pressed.connect(func() -> void: set_mode("globe"))
	add_child(btn_globe)

	btn_zoom_in.text = "+"
	ForgedUI.style_square_button(btn_zoom_in, "slate", 26)
	btn_zoom_in.pressed.connect(func() -> void:
		if mode == "globe" and globe != null:
			globe.zoom_by(1.22)
		else:
			_zoom_atlas(1.40)
	)
	add_child(btn_zoom_in)

	btn_zoom_out.text = "−"
	ForgedUI.style_square_button(btn_zoom_out, "slate", 26)
	btn_zoom_out.pressed.connect(func() -> void:
		if mode == "globe" and globe != null:
			globe.zoom_by(1.0 / 1.22)
		else:
			_zoom_atlas(1.0 / 1.40)
	)
	add_child(btn_zoom_out)

	btn_center.text = "◎"
	ForgedUI.style_square_button(btn_center, "gold", 24)
	btn_center.tooltip_text = "Przełącz: cały świat (1×) / pozycja bohatera (4×)"
	btn_center.pressed.connect(func() -> void:
		var p_atlas := hero_atlas_pos()
		if mode == "globe" and globe != null:
			globe.focus_on(MapMathScript.atlas_to_lonlat(p_atlas))
		else:
			if atlas_zoom > 1.25:
				atlas_zoom = 1.0
				atlas_center = Vector2(1000.0, 500.0)
			else:
				atlas_zoom = 4.0
				atlas_center = p_atlas
				_clamp_atlas_center()
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
	btn_back.position = Vector2(16.0, 10.0)
	btn_back.size = Vector2(158.0, 50.0)
	btn_globe.position = Vector2(size.x - 168.0, 10.0)
	btn_globe.size = Vector2(152.0, 50.0)
	btn_atlas.position = Vector2(size.x - 344.0, 10.0)
	btn_atlas.size = Vector2(168.0, 50.0)
	btn_teleport.position = Vector2(size.x - 548.0, 10.0)
	btn_teleport.size = Vector2(196.0, 50.0)

	var rx := mr.end.x - 68.0
	var ry := mr.position.y + mr.size.y * 0.5 - 98.0
	btn_zoom_in.position = Vector2(rx, ry)
	btn_zoom_in.size = Vector2(56.0, 56.0)
	btn_zoom_out.position = Vector2(rx, ry + 66.0)
	btn_zoom_out.size = Vector2(56.0, 56.0)
	btn_center.position = Vector2(rx, ry + 132.0)
	btn_center.size = Vector2(56.0, 56.0)

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
	_refresh_mode_buttons()
	queue_redraw()

func _zoom_atlas(factor: float, anchor_screen: Vector2 = Vector2(-1.0, -1.0)) -> void:
	var mr := _map_rect()
	var old_z := atlas_zoom
	var new_z := clampf(atlas_zoom * factor, 1.0, 24.0)
	if anchor_screen.x >= 0.0 and mr.has_point(anchor_screen) and absf(new_z - old_z) > 0.001:
		var anchor_a := _screen_to_atlas(anchor_screen, mr)
		atlas_zoom = new_z
		var sc := Vector2(mr.size.x / 2000.0, mr.size.y / 1000.0) * atlas_zoom
		atlas_center = anchor_a - (anchor_screen - (mr.position + mr.size * 0.5)) / sc
	else:
		atlas_zoom = new_z
		if old_z <= 1.05 and new_z > 1.05 and world != null:
			atlas_center = atlas_center.lerp(hero_atlas_pos(), 0.45)
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
	var dx := p.x - atlas_center.x
	if dx > 1000.0:
		dx -= 2000.0
	elif dx < -1000.0:
		dx += 2000.0
	return mr.position + mr.size * 0.5 + Vector2(dx, p.y - atlas_center.y) * sc

func _screen_to_atlas(s: Vector2, mr: Rect2) -> Vector2:
	var base_sx := mr.size.x / 2000.0
	var base_sy := mr.size.y / 1000.0
	var sc := Vector2(base_sx, base_sy) * atlas_zoom
	var raw := atlas_center + (s - (mr.position + mr.size * 0.5)) / sc
	return Vector2(fposmod(raw.x, 2000.0), clampf(raw.y, 0.0, 1000.0))

func _on_globe_region_picked(rid: String) -> void:
	if world != null and CONTINENT_META.has(rid):
		world.switch_region(rid)
		world.toggle_atlas(false)

func _gui_input(event: InputEvent) -> void:
	if world == null or mode == "globe":
		return
	var mr := _map_rect()
	if event is InputEventScreenTouch:
		var st: InputEventScreenTouch = event
		if st.pressed:
			if mr.has_point(st.position):
				_pinch_pts[st.index] = st.position
				if _pinch_pts.size() >= 2:
					var ks := _pinch_pts.keys()
					_pinch_span = (_pinch_pts[ks[0]] as Vector2).distance_to(_pinch_pts[ks[1]] as Vector2)
					atlas_dragging = false
		else:
			_pinch_pts.erase(st.index)
			if _pinch_pts.size() < 2:
				_pinch_span = 0.0
		return
	elif event is InputEventScreenDrag:
		var sd: InputEventScreenDrag = event
		if _pinch_pts.has(sd.index):
			_pinch_pts[sd.index] = sd.position
		if _pinch_pts.size() >= 2:
			var ks := _pinch_pts.keys()
			var p0: Vector2 = _pinch_pts[ks[0]]
			var p1: Vector2 = _pinch_pts[ks[1]]
			var new_span := p0.distance_to(p1)
			if _pinch_span > 12.0 and new_span > 12.0:
				var ratio := clampf(new_span / _pinch_span, 0.72, 1.38)
				_zoom_atlas(ratio, (p0 + p1) * 0.5)
			_pinch_span = new_span
			accept_event()
			return
	if event is InputEventMouseButton:
		var mb: InputEventMouseButton = event
		if mb.button_index == MOUSE_BUTTON_WHEEL_UP and mb.pressed:
			_zoom_atlas(1.26, mb.position)
		elif mb.button_index == MOUSE_BUTTON_WHEEL_DOWN and mb.pressed:
			_zoom_atlas(1.0 / 1.26, mb.position)
		elif mb.button_index == MOUSE_BUTTON_LEFT:
			if mb.pressed and mr.has_point(mb.position):
				atlas_dragging = true
				atlas_drag_moved = false
				atlas_drag_start = mb.position
			else:
				if atlas_dragging and not atlas_drag_moved and _pinch_pts.size() < 2:
					var tp_exact: bool = bool(world.gm_map_teleport_mode)
					if tp_exact:
						var picked_gm := pick_continent(mb.position, true)
						if not picked_gm.is_empty():
							var a_pt := _screen_to_atlas(mb.position, mr)
							var w_pt := atlas_to_world(picked_gm, a_pt.x, a_pt.y, float(world.world_size))
							world.gm_map_teleport_mode = false
							_refresh_mode_buttons()
							world.teleport_to_world_pos(picked_gm, w_pt.x, w_pt.y)
							world.toggle_atlas(false)
					else:
						# Check fast-travel pins (Capitals + Waystones) first!
						var best_pin: Dictionary = {}
						var best_pin_d := 34.0
						for pin: Dictionary in fast_travel_pins:
							var psp: Vector2 = pin["sp"]
							var d := mb.position.distance_to(psp)
							if d < best_pin_d:
								best_pin_d = d
								best_pin = pin
						if not best_pin.is_empty():
							if bool(best_pin.get("discovered", false)):
								var target_land := str(best_pin.get("land", "pyra"))
								world.teleport_to_world_pos(target_land, float(best_pin.get("x", 2048.0)), float(best_pin.get("z", 2048.0)))
								world.toggle_atlas(false)
							else:
								atlas_notice = "🔒 Nieodkryty Kamień Szlaku: %s — dotrzyj tam pieszo, by odblokować szybką podróż!" % str(best_pin.get("label", "Kamień Szlaku"))
								atlas_notice_t = 3.5
								queue_redraw()
						elif atlas_zoom <= 1.25:
							var picked := pick_continent(mb.position, false)
							if not picked.is_empty():
								focus_atlas_continent(picked, 3.6)
						else:
							atlas_notice = "Szybka podróż: kliknij Stolicę lub odkryty Kamień Szlaku (✦)!"
							atlas_notice_t = 3.2
							queue_redraw()
				atlas_dragging = false
	elif event is InputEventMouseMotion:
		var mm: InputEventMouseMotion = event
		if atlas_dragging and _pinch_pts.size() < 2:
			if (mm.position - atlas_drag_start).length() > 18.0:
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

func pick_continent(local_pos: Vector2, allow_nearest_coast: bool = false) -> String:
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
	if allow_nearest_coast:
		var best_rid := ""
		var best_d := 120.0
		for rid: String in region_bboxes.keys():
			if not CONTINENT_META.has(rid):
				continue
			var bb: Dictionary = region_bboxes[rid]
			var cx := clampf(atlas_p.x, float(bb["min_x"]), float(bb["max_x"]))
			var cy := clampf(atlas_p.y, float(bb["min_y"]), float(bb["max_y"]))
			var d := Vector2(atlas_p.x - cx, atlas_p.y - cy).length()
			if d < best_d:
				best_d = d
				best_rid = rid
		return best_rid
	return ""

var pin_cache: Dictionary = {}

func _pin_tex(key: String) -> Texture2D:
	if pin_cache.has(key):
		return pin_cache[key] as Texture2D
	var path := "res://assets/ui/map_icons/pin_%s.webp" % key
	var tex: Texture2D = world.load_tex(path) if (world != null and world.has_method("load_tex")) else null
	pin_cache[key] = tex
	return tex

func _draw_pin(key: String, pos: Vector2, dia: float) -> void:
	var tex := _pin_tex(key)
	if tex != null:
		draw_circle(pos + Vector2(0.0, 1.5), dia * 0.40, Color(0.02, 0.02, 0.03, 0.48))
		draw_texture_rect(tex, Rect2(pos - Vector2(dia * 0.5, dia * 0.5), Vector2(dia, dia)), false)

func _role_pin_key(role: String) -> String:
	if role in ["hall", "smithy", "inn", "shop", "arena", "depot", "landmark"]:
		return role
	return "landmark"

func _clip_seg_to_rect(a: Vector2, b: Vector2, r: Rect2) -> PackedVector2Array:
	var x0 := a.x
	var y0 := a.y
	var dx := b.x - a.x
	var dy := b.y - a.y
	var t0 := 0.0
	var t1 := 1.0
	var ps := [-dx, dx, -dy, dy]
	var qs := [x0 - r.position.x, r.end.x - x0, y0 - r.position.y, r.end.y - y0]
	for k in 4:
		var p: float = ps[k]
		var q: float = qs[k]
		if absf(p) < 1e-6:
			if q < 0.0:
				return PackedVector2Array()
		else:
			var t := q / p
			if p < 0.0:
				if t > t1:
					return PackedVector2Array()
				if t > t0:
					t0 = t
			else:
				if t < t0:
					return PackedVector2Array()
				if t < t1:
					t1 = t
	return PackedVector2Array([a + Vector2(dx, dy) * t0, a + Vector2(dx, dy) * t1])

func _draw_clipped_road(screen_pts: PackedVector2Array, mr: Rect2, casing_col: Color, core_col: Color, width: float) -> void:
	for i in range(screen_pts.size() - 1):
		var a: Vector2 = screen_pts[i]
		var b: Vector2 = screen_pts[i + 1]
		if a.distance_to(b) > mr.size.x * 0.55:
			continue
		var seg := _clip_seg_to_rect(a, b, mr)
		if seg.size() == 2:
			draw_line(seg[0], seg[1], casing_col, width + 1.5, true)
	for i in range(screen_pts.size() - 1):
		var a: Vector2 = screen_pts[i]
		var b: Vector2 = screen_pts[i + 1]
		if a.distance_to(b) > mr.size.x * 0.55:
			continue
		var seg := _clip_seg_to_rect(a, b, mr)
		if seg.size() == 2:
			draw_line(seg[0], seg[1], core_col, width, true)

func _draw_continent_real_details(rid: String, mr: Rect2, f: Font, fb: Font, placed_labels: Array[Rect2]) -> void:
	if not continent_data.has(rid):
		return
	var cd: Dictionary = continent_data[rid]
	var ws := float(cd.get("world_size", 1024.0))
	var half := ws * 0.5
	var detail_t := clampf((atlas_zoom - 1.0) / 3.5, 0.0, 1.0)

	# 1. ALL 50-80 REAL PLANAR IN-GAME ROADS — ordered footpaths -> regional -> city -> highways!
	var roads_arr: Array = cd.get("roads", [])
	var tier_order := ["footpath", "regional", "city", "highway"]
	for want_tier: String in tier_order:
		for rd: Dictionary in roads_arr:
			var tier := str(rd.get("tier", "footpath"))
			if tier != want_tier:
				continue
			if atlas_zoom < 1.15 and tier == "footpath":
				continue
			var raw_pts: Array = rd.get("pts", [])
			if raw_pts.size() < 2:
				continue
			var spts := PackedVector2Array()
			for pt: Array in raw_pts:
				var ap := world_to_atlas(rid, float(pt[0]) + half, float(pt[1]) + half, ws)
				spts.append(_atlas_to_screen(ap, mr))
			var base_w := 1.55 if tier == "highway" else (1.20 if tier == "city" else (1.10 if tier == "regional" else 0.85))
			var rw := clampf(base_w * pow(atlas_zoom, 0.48), 0.9, 3.8)
			var alpha := lerpf(0.72, 0.96, detail_t) if tier == "highway" else (lerpf(0.54, 0.92, detail_t) if tier in ["regional", "city"] else lerpf(0.42, 0.84, detail_t))
			var core_col := Color(0.98, 0.89, 0.64, alpha) if tier == "highway" else (
				Color(0.95, 0.87, 0.68, alpha) if tier == "city" else (
					Color(0.90, 0.80, 0.58, alpha) if tier == "regional" else Color(0.80, 0.70, 0.52, alpha)
				)
			)
			var casing_col := Color(0.08, 0.05, 0.03, alpha * 0.85)
			_draw_clipped_road(spts, mr, casing_col, core_col, rw)

	# 2. PAINTED HERALDIC MEDALLIONS (Pass A: Icons/Pins FIRST so no pin ever sits on top of text!)
	var safe_lbl := Rect2(mr.position.x + 12.0, mr.position.y + 20.0, mr.size.x - 104.0, mr.size.y - 32.0)
	var bldgs: Array = cd.get("buildings", [])
	var pending_caps: Array[Dictionary] = []
	var pending_towns: Array[Dictionary] = []
	var pending_bldgs: Array[Dictionary] = []

	for b: Dictionary in bldgs:
		var role := str(b.get("role", ""))
		var mk := str(b.get("map_kind", ""))
		var is_ent := bool(b.get("enterable", false))
		var bx := float(b.get("x", 0.0)) + half
		var bz := float(b.get("z", 0.0)) + half
		var sp := _atlas_to_screen(world_to_atlas(rid, bx, bz, ws), mr)
		if not mr.has_point(sp):
			continue

		if role == "bridge" and atlas_zoom >= 1.6:
			_draw_pin("bridge", sp, clampf(13.0 + (atlas_zoom - 1.6) * 1.8, 13.0, 22.0))
		elif mk == "capital":
			var cap_d := clampf(24.0 * pow(atlas_zoom, 0.28), 24.0, 42.0)
			_draw_pin("capital", sp, cap_d)
			var cap_name := str(CONTINENT_META.get(rid, {}).get("capital", "Stolica"))
			fast_travel_pins.append({
				"land": rid,
				"x": bx,
				"z": bz,
				"sp": sp,
				"label": cap_name,
				"kind": "capital",
				"discovered": true,
			})
			if atlas_zoom >= 1.8:
				pending_caps.append({"sp": sp, "d": cap_d, "text": cap_name})
		elif mk == "town":
			var td := clampf(18.0 * pow(atlas_zoom, 0.28), 18.0, 30.0)
			_draw_pin("town", sp, td)
			if atlas_zoom >= 2.0:
				pending_towns.append({"sp": sp, "d": td, "text": str(b.get("title", ""))})
		elif is_ent and atlas_zoom >= 2.2:
			var sd := clampf(12.0 + (atlas_zoom - 2.2) * 2.0, 12.0, 24.0)
			_draw_pin(_role_pin_key(role), sp, sd)
			# Only show individual interior capital building labels when zoomed closely into the city!
			if atlas_zoom >= 7.0:
				pending_bldgs.append({"sp": sp, "d": sd, "text": str(b.get("title", ""))})
		elif role in ["house", "gate", "tower"] and atlas_zoom >= 3.2:
			var hr := clampf(2.0 + (atlas_zoom - 3.2) * 0.45, 2.2, 4.6)
			draw_rect(Rect2(sp - Vector2(hr, hr), Vector2(hr * 2.0, hr * 2.0)), Color(0.56, 0.50, 0.44, 0.84))
			draw_rect(Rect2(sp - Vector2(hr, hr), Vector2(hr * 2.0, hr * 2.0)), Color(0.08, 0.06, 0.04, 0.94), false, 1.0)

	# 2b. Discoverable Fast-Travel Waystones (4 per continent)
	if atlas_zoom >= 1.35:
		var waystones: Array = cd.get("waystones", [])
		for ws_item: Dictionary in waystones:
			var wid := str(ws_item.get("id", ""))
			var wwx := float(ws_item.get("x", 0.0)) + half
			var wwz := float(ws_item.get("z", 0.0)) + half
			var wsp := _atlas_to_screen(world_to_atlas(rid, wwx, wwz, ws), mr)
			if not mr.has_point(wsp):
				continue
			var is_disc: bool = world != null and world.has_method("is_waystone_discovered") and bool(world.is_waystone_discovered(wid))
			var wd := clampf(8.5 + (atlas_zoom - 1.35) * 1.3, 8.5, 15.0)
			var wdia := PackedVector2Array([wsp + Vector2(0, -wd), wsp + Vector2(wd, 0), wsp + Vector2(0, wd), wsp + Vector2(-wd, 0)])
			if is_disc:
				draw_circle(wsp, wd * 1.45, Color(0.24, 0.92, 1.0, 0.22))
				draw_colored_polygon(wdia, Color(0.24, 0.94, 1.0, 0.96))
				wdia.append(wdia[0])
				draw_polyline(wdia, Color(1.0, 0.92, 0.46, 0.98), 2.2, true)
			else:
				draw_colored_polygon(wdia, Color(0.20, 0.24, 0.30, 0.65))
				wdia.append(wdia[0])
				draw_polyline(wdia, Color(0.60, 0.68, 0.78, 0.78), 1.6, true)
			fast_travel_pins.append({
				"land": rid,
				"x": wwx,
				"z": wwz,
				"sp": wsp,
				"label": str(ws_item.get("title", "Kamień Szlaku")),
				"kind": "waystone",
				"discovered": is_disc,
			})
			if atlas_zoom >= 2.2:
				var wlbl := ("✦ " + str(ws_item.get("title", "Kamień Szlaku"))) if is_disc else ("🔒 " + str(ws_item.get("title", "Kamień Szlaku")))
				pending_towns.append({"sp": wsp, "d": wd * 2.0, "text": wlbl})

	# 3. Monster Exp-Zones, Labyrinths & Hidden Treasures (icons/rings before labels!)
	if atlas_zoom >= 2.1:
		var zones: Array = cd.get("exp_zones", [])
		for ez: Dictionary in zones:
			var ex := float(ez.get("x", 0.0)) + half
			var ez_z := float(ez.get("z", 0.0)) + half
			var sp := _atlas_to_screen(world_to_atlas(rid, ex, ez_z, ws), mr)
			if not mr.has_point(sp):
				continue
			var zr := clampf(12.0 + (atlas_zoom - 2.1) * 3.0, 12.0, 26.0)
			var band := str(ez.get("band", "red"))
			var ring_col := Color(0.36, 0.94, 0.56, 0.82) if band == "green" else (Color(1.0, 0.80, 0.28, 0.86) if band == "gold" else Color(1.0, 0.36, 0.30, 0.88))
			draw_circle(sp, zr, Color(ring_col.r, ring_col.g, ring_col.b, 0.20))
			draw_arc(sp, zr, 0.0, TAU, 24, ring_col, 2.2, true)
			var ez_lv := int(ez.get("level", ez.get("min_lv", 1)))
			var lv_txt := "Poz.%d" % ez_lv
			var tw := fb.get_string_size(lv_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 12).x
			var lx := clampf(sp.x - tw * 0.5, mr.position.x + 8.0, mr.end.x - tw - 8.0)
			var lbox := Rect2(lx - 4.0, sp.y - 8.0, tw + 8.0, 16.0)
			if mr.encloses(Rect2(lx, sp.y - 7.0, tw, 14.0)):
				var ov := false
				for prev: Rect2 in placed_labels:
					if lbox.intersects(prev):
						ov = true
						break
				if not ov:
					placed_labels.append(lbox)
					draw_string_outline(fb, Vector2(lx, sp.y + 4.5), lv_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, 4, Color(0.04, 0.02, 0.02, 0.96))
					draw_string(fb, Vector2(lx, sp.y + 4.5), lv_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(0.86, 1.0, 0.90) if band == "green" else (Color(1.0, 0.94, 0.68) if band == "gold" else Color(1.0, 0.76, 0.70)))

	if world != null and str(world.current_land) == rid and atlas_zoom >= 1.9:
		var live_ws := float(world.world_size)
		if "labyrinths_data" in world:
			for lab: Dictionary in world.labyrinths_data:
				var lp := _atlas_to_screen(world_to_atlas(rid, float(lab.get("x", 0.0)), float(lab.get("z", 0.0)), live_ws), mr)
				if mr.has_point(lp):
					var d := clampf(7.5 + (atlas_zoom - 1.9) * 1.2, 8.0, 14.0)
					var dia := PackedVector2Array([lp + Vector2(0, -d), lp + Vector2(d, 0), lp + Vector2(0, d), lp + Vector2(-d, 0)])
					draw_colored_polygon(dia, Color(0.76, 0.34, 1.0, 0.94))
					dia.append(dia[0])
					draw_polyline(dia, Color(1.0, 0.90, 0.44, 0.98), 2.0, true)
		if atlas_zoom >= 2.8 and "treasures_data" in world:
			for tr: Dictionary in world.treasures_data:
				if world.has_method("is_treasure_opened") and bool(world.is_treasure_opened(str(tr.get("id", "")))):
					continue
				var tp := _atlas_to_screen(world_to_atlas(rid, float(tr.get("x", 0.0)), float(tr.get("z", 0.0)), live_ws), mr)
				if mr.has_point(tp):
					draw_circle(tp, 5.0, Color(1.0, 0.86, 0.24, 0.96))
					draw_arc(tp, 5.0, 0.0, TAU, 14, Color(0.10, 0.06, 0.02, 0.96), 1.5, true)

	# Pass B: Priority-Ordered, Clamped, Collision-Free Text Labels (Capital -> Towns -> Close-up Buildings)
	for cap: Dictionary in pending_caps:
		var sp: Vector2 = cap["sp"]
		var cap_d: float = float(cap["d"])
		var ctitle: String = str(cap["text"])
		var tw := f.get_string_size(ctitle, HORIZONTAL_ALIGNMENT_LEFT, -1, 15).x
		var lx := clampf(sp.x - tw * 0.5, safe_lbl.position.x + 4.0, safe_lbl.end.x - tw - 4.0)
		var ly := clampf(sp.y - cap_d * 0.68 - 6.0, safe_lbl.position.y + 16.0, safe_lbl.end.y - 6.0)
		var cbox := Rect2(lx - 8.0, ly - 16.0, tw + 16.0, 22.0)
		placed_labels.append(cbox)
		draw_rect(cbox, Color(0.04, 0.03, 0.05, 0.80), true)
		draw_rect(cbox, Color(0.92, 0.74, 0.34, 0.78), false, 1.2)
		draw_string_outline(f, Vector2(lx, ly), ctitle, HORIZONTAL_ALIGNMENT_LEFT, -1, 15, 5, Color(0.03, 0.02, 0.02, 0.96))
		draw_string(f, Vector2(lx, ly), ctitle, HORIZONTAL_ALIGNMENT_LEFT, -1, 15, Color(1.0, 0.92, 0.52))

	for twn: Dictionary in pending_towns:
		var sp: Vector2 = twn["sp"]
		var td: float = float(twn["d"])
		var tname: String = str(twn["text"])
		var tw := fb.get_string_size(tname, HORIZONTAL_ALIGNMENT_LEFT, -1, 13).x
		var lx := clampf(sp.x - tw * 0.5, safe_lbl.position.x + 2.0, safe_lbl.end.x - tw - 2.0)
		var cand_ys := [sp.y - td * 0.64 - 4.0, sp.y + td * 0.64 + 14.0]
		for cy in cand_ys:
			var ly := clampf(float(cy), safe_lbl.position.y + 14.0, safe_lbl.end.y - 4.0)
			var box := Rect2(lx - 6.0, ly - 14.0, tw + 12.0, 19.0)
			if not safe_lbl.encloses(Rect2(lx, ly - 13.0, tw, 15.0)):
				continue
			var hit := false
			for prev: Rect2 in placed_labels:
				if box.intersects(prev):
					hit = true
					break
			if not hit:
				placed_labels.append(box)
				draw_rect(box, Color(0.04, 0.05, 0.08, 0.72), true)
				draw_string_outline(fb, Vector2(lx, ly), tname, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, 4, Color(0.03, 0.04, 0.06, 0.96))
				draw_string(fb, Vector2(lx, ly), tname, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(0.90, 0.96, 1.0))
				break

	for bld: Dictionary in pending_bldgs:
		var sp: Vector2 = bld["sp"]
		var sd: float = float(bld["d"])
		var btitle: String = str(bld["text"])
		var tw := fb.get_string_size(btitle, HORIZONTAL_ALIGNMENT_LEFT, -1, 12).x
		var lx := clampf(sp.x - tw * 0.5, safe_lbl.position.x + 2.0, safe_lbl.end.x - tw - 2.0)
		var ly := clampf(sp.y - sd * 0.60 - 2.0, safe_lbl.position.y + 14.0, safe_lbl.end.y - 4.0)
		var box := Rect2(lx - 5.0, ly - 13.0, tw + 10.0, 17.0)
		if not safe_lbl.encloses(Rect2(lx, ly - 12.0, tw, 14.0)):
			continue
		var hit := false
		for prev: Rect2 in placed_labels:
			if box.intersects(prev):
				hit = true
				break
		if not hit:
			placed_labels.append(box)
			draw_string_outline(fb, Vector2(lx, ly), btitle, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, 4, Color(0.03, 0.02, 0.02, 0.96))
			draw_string(fb, Vector2(lx, ly), btitle, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(1.0, 0.94, 0.78))

func _process(delta: float) -> void:
	if atlas_notice_t > 0.0:
		atlas_notice_t = maxf(0.0, atlas_notice_t - delta)
		if atlas_notice_t <= 0.0:
			atlas_notice = ""
			queue_redraw()

func _draw() -> void:
	fast_travel_pins.clear()
	var f: Font = MapStyleScript.font()
	var fb: Font = MapStyleScript.body_font()
	var rect := Rect2(Vector2.ZERO, size)
	draw_rect(rect, Color(0.02, 0.03, 0.05, 0.97))
	if space_tex != null:
		draw_texture_rect(space_tex, rect, false, Color(0.70, 0.78, 0.92, 0.55))
	draw_rect(rect, Color(0.84, 0.66, 0.36, 0.92), false, 2.5)

	var mr := _map_rect()
	var gm_tp_on: bool = world != null and bool(world.gm_map_teleport_mode)
	var title_txt := "⚡ TELEPORT GM — DOTKNIJ PUNKT NA MAPIE (%.1f×)" % atlas_zoom if (mode == "atlas" and gm_tp_on) else ("GLOBUS PLANETY SUPERIOR" if mode == "globe" else ("MAPA ŚWIATA • %.1f× • STOLICA LUB ✦ SZLAK" % atlas_zoom if atlas_zoom >= 1.35 else "MAPA ŚWIATA SUPERIOR • %.1f×" % atlas_zoom))
	var title_col := Color(0.40, 0.96, 1.0) if (mode == "atlas" and gm_tp_on) else Color(1.0, 0.90, 0.60)
	var title_max_w := maxf(size.x - 758.0, 260.0)
	draw_string_outline(f, Vector2(188.0, 42.0), title_txt, HORIZONTAL_ALIGNMENT_LEFT, int(title_max_w), 17, 5, Color(0.02, 0.02, 0.03, 0.95))
	draw_string(f, Vector2(188.0, 42.0), title_txt, HORIZONTAL_ALIGNMENT_LEFT, int(title_max_w), 17, title_col)

	if mode == "atlas":
		draw_rect(mr, Color(0.04, 0.11, 0.20, 1.0))
		if atlas_tex != null:
			var img_sz := Vector2(mr.size.x, mr.size.y) * atlas_zoom
			var tl := mr.position + mr.size * 0.5 - Vector2(atlas_center.x / 2000.0, atlas_center.y / 1000.0) * img_sz
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

		# Reserve hero pin area & right-side zoom buttons so NO label collides with them
		var placed_labels: Array[Rect2] = []
		placed_labels.append(Rect2(mr.end.x - 94.0, mr.position.y + mr.size.y * 0.30, 94.0, 240.0))
		var h_atlas := hero_atlas_pos()
		var hp := _atlas_to_screen(h_atlas, mr)
		var hd := clampf(30.0 * pow(atlas_zoom, 0.16), 30.0, 40.0)
		if mr.has_point(hp):
			placed_labels.append(Rect2(hp - Vector2(hd * 0.72, hd * 0.72), Vector2(hd * 1.44, hd * 1.44)))

		# Progressive 1:1 sub-pixel aligned planar roads, Capital/Town/Service Medallions, Waystones, Exp-Zones & Labyrinths!
		for rid: String in ["pyra", "verdant", "aether", "nexus"]:
			_draw_continent_real_details(rid, mr, f, fb, placed_labels)

		# Region titles & subtle hover highlight ONLY at global overview (drawn AFTER roads/pins with crisp dark plaque for snow contrast!)
		var regions_arr: Array = map_json.get("regions", [])
		for reg: Dictionary in regions_arr:
			var rid := str(reg.get("id", ""))
			var is_active: bool = (world != null and str(world.current_land) == rid)
			var is_hover: bool = (hovered_land == rid)
			var is_cont: bool = (str(reg.get("kind", "")) == "continent")

			if atlas_zoom <= 1.25 and is_hover:
				var poly := MapMathScript.polygon(reg)
				for i in poly.size():
					var a: Vector2 = poly[i]
					var b: Vector2 = poly[(i + 1) % poly.size()]
					if absf(a.x - b.x) > 800.0:
						continue
					var seg := _clip_seg_to_rect(_atlas_to_screen(a, mr), _atlas_to_screen(b, mr), mr)
					if seg.size() == 2:
						draw_line(seg[0], seg[1], Color(1.0, 0.90, 0.56, 0.55), 1.6, true)

			if atlas_zoom < 2.2:
				var r_lbl = reg.get("label")
				if r_lbl is Dictionary:
					var lp := _atlas_to_screen(Vector2(float(r_lbl.get("x", 1000.0)), float(r_lbl.get("y", 500.0))), mr)
					if mr.has_point(lp):
						var rname := str(reg.get("name", rid.capitalize())).to_upper() if is_cont else str(reg.get("name", rid.capitalize()))
						var fsize := 18 if is_cont else 13
						var tcol := Color(1.0, 0.93, 0.62) if (is_active or is_hover) else (Color(0.98, 0.94, 0.84) if is_cont else Color(0.88, 0.92, 0.98))
						var tw := f.get_string_size(rname, HORIZONTAL_ALIGNMENT_LEFT, -1, fsize).x
						var draw_x := clampf(lp.x - tw * 0.5, mr.position.x + 12.0, mr.end.x - tw - 104.0)
						var draw_y := clampf(lp.y + (34.0 if is_cont else 0.0), mr.position.y + float(fsize) + 8.0, mr.end.y - 10.0)
						if is_cont:
							var pbox := Rect2(draw_x - 10.0, draw_y - float(fsize) - 1.0, tw + 20.0, float(fsize) + 8.0)
							draw_rect(pbox, Color(0.03, 0.03, 0.05, 0.78), true)
							draw_rect(pbox, Color(0.86, 0.68, 0.34, 0.72), false, 1.2)
						draw_string_outline(f, Vector2(draw_x, draw_y), rname, HORIZONTAL_ALIGNMENT_LEFT, -1, fsize, 5, Color(0.02, 0.02, 0.03, 0.98))
						draw_string(f, Vector2(draw_x, draw_y), rname, HORIZONTAL_ALIGNMENT_LEFT, -1, fsize, tcol)

		# Live Hero Portrait Medallion — ALWAYS matches hero's own race (never morphs on foreign continents!)
		if mr.has_point(hp):
			var race_land: String = str(world.hero_race_land) if (world != null and str(world.hero_race_land) != "") else (str(world.current_land) if world != null else "pyra")
			draw_arc(hp, hd * 0.64, 0.0, TAU, 24, Color(0.32, 0.98, 1.0, 0.95), 2.8, true)
			_draw_pin("hero_" + race_land, hp, hd)
			if atlas_zoom >= 2.2:
				var tag_w := f.get_string_size("TY", HORIZONTAL_ALIGNMENT_LEFT, -1, 13).x
				var tag_box := Rect2(hp.x - tag_w * 0.5 - 6.0, hp.y + hd * 0.60, tag_w + 12.0, 18.0)
				draw_rect(tag_box, Color(0.03, 0.06, 0.10, 0.88), true)
				draw_rect(tag_box, Color(0.38, 0.96, 1.0, 0.92), false, 1.2)
				draw_string(f, Vector2(hp.x - tag_w * 0.5, tag_box.position.y + 13.5), "TY", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(0.56, 0.98, 1.0))

		# Compass rose (bottom-left inside map)
		MapStyleScript.compass(self, Vector2(mr.position.x + 56.0, mr.end.y - 56.0), 30.0)

		# Inline fast-travel status notice banner
		if not atlas_notice.is_empty() and atlas_notice_t > 0.0:
			var ntw := fb.get_string_size(atlas_notice, HORIZONTAL_ALIGNMENT_LEFT, -1, 14).x
			var nbox := Rect2(mr.position.x + (mr.size.x - ntw - 32.0) * 0.5, mr.position.y + 14.0, ntw + 32.0, 32.0)
			draw_rect(nbox, Color(0.04, 0.05, 0.08, 0.92), true)
			draw_rect(nbox, Color(0.38, 0.92, 1.0, 0.90), false, 1.6)
			draw_string(fb, Vector2(nbox.position.x + 16.0, nbox.position.y + 21.0), atlas_notice, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color(0.92, 0.98, 1.0))

	draw_rect(mr, Color(0.84, 0.66, 0.36, 0.85), false, 2.2)

	# Bottom Lore, Telemetry & Painted Heraldic Medallion Legend Bar
	var bar := Rect2(16.0, mr.end.y + 10.0, size.x - 32.0, 92.0)
	draw_rect(bar, Color(0.05, 0.045, 0.065, 0.94))
	draw_rect(bar, Color(0.76, 0.58, 0.30, 0.88), false, 2.0)

	var inspect_id: String = hovered_land if not hovered_land.is_empty() else (str(world.current_land) if world != null else "pyra")
	var meta: Dictionary = CONTINENT_META.get(inspect_id, CONTINENT_META["pyra"])
	draw_string(f, bar.position + Vector2(18, 26), "%s  •  Lud: %s  •  Stolica: %s" % [
		str(meta.name), str(meta.race), str(meta.capital)
	], HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color(1.0, 0.90, 0.62))
	draw_string(fb, bar.position + Vector2(18, 48), str(meta.lore), HORIZONTAL_ALIGNMENT_LEFT, int(bar.size.x - 36.0), 13, Color(0.90, 0.88, 0.84))

	# Painted Medallion Legend Row
	var ly := bar.position.y + 74.0
	var lx := bar.position.x + 26.0
	_draw_pin("capital", Vector2(lx, ly - 3.0), 22.0)
	draw_string(fb, Vector2(lx + 16.0, ly + 2.0), "Stolica (TP)", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(1.0, 0.90, 0.56))
	lx += 116.0
	var ldia := PackedVector2Array([Vector2(lx, ly - 10.0), Vector2(lx + 7.0, ly - 3.0), Vector2(lx, ly + 4.0), Vector2(lx - 7.0, ly - 3.0)])
	draw_colored_polygon(ldia, Color(0.24, 0.94, 1.0, 0.96))
	draw_string(fb, Vector2(lx + 14.0, ly + 2.0), "Kamień Szlaku (TP)", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(0.64, 0.96, 1.0))
	lx += 158.0
	_draw_pin("smithy", Vector2(lx, ly - 3.0), 20.0)
	draw_string(fb, Vector2(lx + 15.0, ly + 2.0), "Budynki", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(0.88, 0.94, 0.86))
	lx += 94.0
	draw_arc(Vector2(lx, ly - 3.0), 7.0, 0.0, TAU, 16, Color(1.0, 0.36, 0.30, 0.92), 2.0, true)
	draw_string(fb, Vector2(lx + 14.0, ly + 2.0), "Strefy potworów", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(1.0, 0.72, 0.66))
	lx += 152.0
	draw_line(Vector2(lx - 6.0, ly - 3.0), Vector2(lx + 14.0, ly - 3.0), Color(0.96, 0.86, 0.60, 0.95), 3.0, true)
	draw_string(fb, Vector2(lx + 20.0, ly + 2.0), "Drogi (+10% SPD)", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(0.94, 0.88, 0.74))
	lx += 144.0
	draw_string(fb, Vector2(lx, ly + 2.0), "|  + / − przybliż  •  ◎ Bohater", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(0.76, 0.88, 0.98))
