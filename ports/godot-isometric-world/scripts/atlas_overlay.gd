extends Control
## Interactive 3D Planet Globe + 2D Isometric Relief Planet Atlas overlay for KI Legends (Superior).
## Integrates GlobeView (real 3D sphere with clouds, atmosphere rim, sun glint, and traced polygon outlines)
## and the 2D Relief Atlas in one unified planetary navigation screen.

const GlobeViewScript := preload("res://scripts/globe_view.gd")
const MapMathScript := preload("res://scripts/map_math.gd")
const MapStyleScript := preload("res://scripts/map_style.gd")

var world: Node2D
var atlas_tex: Texture2D
var space_tex: Texture2D
var manifest: Dictionary = {}
var map_json: Dictionary = {}
var hovered_land := ""
var mode := "globe" # "globe" or "atlas"
var globe
var btn_globe := Button.new()
var btn_atlas := Button.new()

const CONTINENT_META := {
	"verdant": {
		"label": "VERDANTIA — Zielona Przystań",
		"color": Color(0.32, 0.88, 0.44),
		"pos": Vector2(362.0, 267.0),
		"size": Vector2(680.0, 440.0),
		"dims": "77504 × 58560",
	},
	"aether": {
		"label": "AETHERIA — Sanktuarium Tysiąca Źródeł",
		"color": Color(0.38, 0.85, 0.98),
		"pos": Vector2(1337.0, 309.0),
		"size": Vector2(640.0, 420.0),
		"dims": "70208 × 53440",
	},
	"pyra": {
		"label": "PYRA — Twierdza Popiołu",
		"color": Color(1.0, 0.44, 0.16),
		"pos": Vector2(731.0, 730.0),
		"size": Vector2(620.0, 360.0),
		"dims": "65600 × 42304",
	},
	"nexus": {
		"label": "NEXUS-9 — Węzeł Świadomości",
		"color": Color(0.22, 0.94, 0.96),
		"pos": Vector2(1845.0, 709.0),
		"size": Vector2(560.0, 390.0),
		"dims": "63168 × 49728",
	},
}

const QUEST_ISLANDS := [
	{"id": "island-1", "title": "Wyspa Zefiru", "pos": Vector2(107.0, 501.0)},
	{"id": "island-2", "title": "Wyspa Koralowa", "pos": Vector2(608.0, 501.0)},
	{"id": "island-3", "title": "Wyspa Mgły", "pos": Vector2(1109.0, 501.0)},
	{"id": "island-4", "title": "Wyspa Rdzy", "pos": Vector2(1632.0, 501.0)},
	{"id": "island-5", "title": "Wyspa Północna", "pos": Vector2(480.0, 22.0)},
	{"id": "island-6", "title": "Wyspa Południowa", "pos": Vector2(640.0, 992.0)},
]

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	if world != null:
		atlas_tex = world.load_tex("res://assets/map/atlas.webp")
		if atlas_tex == null:
			atlas_tex = world.load_tex("res://atlas/planet_atlas_relief.png")
		space_tex = world.load_tex("res://assets/map/space.jpg")
	if FileAccess.file_exists("res://atlas/topography_manifest.json"):
		manifest = JSON.parse_string(FileAccess.get_file_as_string("res://atlas/topography_manifest.json"))
	if FileAccess.file_exists("res://data/map.json"):
		map_json = JSON.parse_string(FileAccess.get_file_as_string("res://data/map.json"))

	build_globe_and_tabs()
	set_mode("globe")

func build_globe_and_tabs() -> void:
	if world == null:
		return
	var color_tex: Texture2D = world.load_tex("res://assets/map/globe-color.webp")
	var cloud_tex: Texture2D = world.load_tex("res://assets/map/globe-clouds.webp")
	var regions_arr: Array = map_json.get("regions", [])
	if color_tex != null and cloud_tex != null and not regions_arr.is_empty():
		globe = GlobeViewScript.new()
		globe.position = Vector2(16, 54)
		globe.size = Vector2(size.x - 32, size.y - 102)
		var p_atlas := Vector2(731.0, 730.0)
		globe.setup(color_tex, cloud_tex, regions_arr, p_atlas)
		globe.select(world.current_land if world != null else "pyra")
		globe.focus_on(Vector2(-38.0, -18.0))
		globe.region_picked.connect(_on_globe_region_picked)
		add_child(globe)
		resized.connect(func() -> void:
			if globe != null:
				globe.size = Vector2(size.x - 32, size.y - 102)
				globe.viewport.size = Vector2i(int(globe.size.x), int(globe.size.y))
		)
		globe.viewport.size = Vector2i(int(maxf(size.x - 32, 800)), int(maxf(size.y - 102, 500)))

	btn_globe.text = "GLOBUS 3D (REAL)"
	btn_globe.position = Vector2(size.x - 340, 10)
	btn_globe.size = Vector2(155, 36)
	btn_globe.pressed.connect(func() -> void: set_mode("globe"))
	add_child(btn_globe)

	btn_atlas.text = "ATLAS 2D"
	btn_atlas.position = Vector2(size.x - 175, 10)
	btn_atlas.size = Vector2(155, 36)
	btn_atlas.pressed.connect(func() -> void: set_mode("atlas"))
	add_child(btn_atlas)

func set_mode(new_mode: String) -> void:
	mode = new_mode
	if globe != null:
		globe.visible = (mode == "globe")
		if globe.visible and world != null:
			var meta: Dictionary = CONTINENT_META.get(world.current_land, CONTINENT_META["pyra"])
			var cpos: Vector2 = meta.pos
			globe.select(world.current_land)
			globe.focus_on(MapMathScript.atlas_to_lonlat(cpos))
	btn_globe.modulate = Color(1.0, 0.92, 0.65) if mode == "globe" else Color(0.75, 0.75, 0.78)
	btn_atlas.modulate = Color(1.0, 0.92, 0.65) if mode == "atlas" else Color(0.75, 0.75, 0.78)
	queue_redraw()

func _on_globe_region_picked(rid: String) -> void:
	if world != null and CONTINENT_META.has(rid):
		world.switch_region(rid)
		world.toggle_atlas(false)

func _gui_input(event: InputEvent) -> void:
	if world == null or mode == "globe":
		return
	if event is InputEventMouseMotion:
		var prev := hovered_land
		hovered_land = pick_continent(event.position)
		if hovered_land != prev:
			queue_redraw()
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		var picked := pick_continent(event.position)
		if not picked.is_empty():
			world.switch_region(picked)
			world.toggle_atlas(false)

func pick_continent(local_pos: Vector2) -> String:
	var map_rect := Rect2(16, 54, size.x - 32, size.y - 102)
	if not map_rect.has_point(local_pos):
		return ""
	var uv := (local_pos - map_rect.position) / map_rect.size
	var wx := uv.x * 2048.0
	var wy := uv.y * 1024.0
	for cid: String in CONTINENT_META.keys():
		var meta: Dictionary = CONTINENT_META[cid]
		var cpos: Vector2 = meta.pos
		var csize: Vector2 = meta.size
		if Rect2(cpos - csize * 0.5, csize).has_point(Vector2(wx, wy)):
			return cid
	return ""

func _draw() -> void:
	var f: Font = MapStyleScript.font()
	var rect := Rect2(Vector2.ZERO, size)
	draw_rect(rect, Color(0.02, 0.03, 0.05, 0.96))
	var map_rect := Rect2(16, 54, size.x - 32, size.y - 102)
	if space_tex != null and mode == "globe":
		draw_texture_rect(space_tex, map_rect, false, Color(0.85, 0.90, 1.0, 0.85))
	draw_rect(rect, Color(0.86, 0.68, 0.36, 0.92), false, 3.0)

	var title_txt := "GLOBUS 3D PLANETY SUPERIOR — Obracaj kulę 360°, kliknij kontynent, aby podróżować" if mode == "globe" else "ATLAS 2D PLANETY SUPERIOR — 4 Kontynenty, 6 Wysp Questowych, 8 Archipelagów"
	draw_string(
		f,
		Vector2(22, 34),
		title_txt,
		HORIZONTAL_ALIGNMENT_LEFT,
		-1,
		17,
		Color(0.98, 0.90, 0.72)
	)

	if mode == "atlas":
		if atlas_tex != null:
			draw_texture_rect(atlas_tex, map_rect, false)
		draw_rect(map_rect, Color(0.82, 0.66, 0.34, 0.75), false, 2.0)

		var sx := map_rect.size.x / 2048.0
		var sy := map_rect.size.y / 1024.0

		for arch: Dictionary in manifest.get("archipelagos", []):
			var p := map_rect.position + Vector2(float(arch.get("x", 0.0)) * sx, float(arch.get("y", 0.0)) * sy)
			draw_circle(p, 5.0, Color(0.62, 0.90, 0.78, 0.85))
			draw_arc(p, 8.5, 0, TAU, 16, Color(0.62, 0.90, 0.78, 0.45), 1.5, true)

		for isl: Dictionary in QUEST_ISLANDS:
			var ipos: Vector2 = isl.pos
			var p := map_rect.position + Vector2(ipos.x * sx, ipos.y * sy)
			draw_circle(p, 6.5, Color(0.98, 0.82, 0.32, 0.92))
			draw_arc(p, 10.5, 0, TAU, 20, Color(0.08, 0.05, 0.04, 0.9), 2.0, true)
			var iname := str(isl.title)
			draw_string_outline(f, p + Vector2(-38, 22), iname, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, 4, Color(0.02, 0.02, 0.03, 0.92))
			draw_string(f, p + Vector2(-38, 22), iname, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(0.96, 0.88, 0.64))

		for cid: String in CONTINENT_META.keys():
			var meta: Dictionary = CONTINENT_META[cid]
			var cpos: Vector2 = meta.pos
			var p := map_rect.position + Vector2(cpos.x * sx, cpos.y * sy)
			var col: Color = meta.color
			var is_active: bool = (world != null and world.current_land == cid)
			var is_hover: bool = (hovered_land == cid)

			var r := 13.0 if (is_active or is_hover) else 10.0
			draw_circle(p, r + 4.0, Color(0.04, 0.03, 0.04, 0.88))
			draw_circle(p, r, col)
			draw_arc(p, r + 6.0, 0, TAU, 28, Color(1, 0.95, 0.75, 0.95) if is_active else col, 2.5, true)

			var dims := str(meta.dims)
			var offset_x := -215.0 if cid == "nexus" else -115.0
			var label_pos := p + Vector2(offset_x, -28.0)
			draw_rect(Rect2(label_pos.x - 8, label_pos.y - 18, 256, 38), Color(0.03, 0.03, 0.04, 0.86))
			draw_rect(Rect2(label_pos.x - 8, label_pos.y - 18, 256, 38), col, false, 2.2 if is_active else 1.4)
			draw_string(f, label_pos, str(meta.label), HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(1.0, 0.96, 0.86))
			draw_string(f, label_pos + Vector2(0, 15), "Wymiary: %s | Stolica aktywna" % dims if is_active else "Wymiary: %s (kliknij)" % dims, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, col)
	else:
		draw_rect(map_rect, Color(0.82, 0.66, 0.34, 0.75), false, 2.0)

	draw_string(
		f,
		Vector2(22, size.y - 16),
		"Klawisze [1] Pyra  [2] Verdantia  [3] Aetheria  [4] Nexus-9  |  [G] Globus 3D  |  [Tab] Atlas 2D  |  [M] Mapa 3D regionu",
		HORIZONTAL_ALIGNMENT_LEFT,
		-1,
		13,
		Color(0.88, 0.82, 0.68)
	)
