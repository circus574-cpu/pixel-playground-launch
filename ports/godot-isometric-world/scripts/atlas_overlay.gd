extends Control
## Interactive 2D Isometric Relief Planet Atlas overlay for KI Legends (Superior).
## Displays the 4 continents, 6 quest islands, 8 ocean archipelagos, and capital pins,
## and allows clicking any continent to travel directly to its 2D isometric capital region.

var world: Node2D
var atlas_tex: Texture2D
var manifest: Dictionary = {}
var hovered_land := ""

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
		atlas_tex = world.load_tex("res://atlas/planet_atlas_relief.png")
	if FileAccess.file_exists("res://atlas/topography_manifest.json"):
		manifest = JSON.parse_string(FileAccess.get_file_as_string("res://atlas/topography_manifest.json"))

func _gui_input(event: InputEvent) -> void:
	if world == null:
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
	var map_rect := Rect2(16, 48, size.x - 32, size.y - 92)
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
	var f: Font = ThemeDB.fallback_font
	var rect := Rect2(Vector2.ZERO, size)
	draw_rect(rect, Color(0.03, 0.03, 0.04, 0.94))
	draw_rect(rect, Color(0.86, 0.68, 0.36, 0.88), false, 3.0)

	draw_string(
		f,
		Vector2(22, 32),
		"ATLAS PLANETY SUPERIOR — 4 Kontynenty, 6 Wysp Questowych, 8 Archipelagów (kliknij kontynent, aby przejść do stolicy)",
		HORIZONTAL_ALIGNMENT_LEFT,
		-1,
		16,
		Color(0.98, 0.90, 0.72)
	)

	var map_rect := Rect2(16, 48, size.x - 32, size.y - 92)
	if atlas_tex != null:
		draw_texture_rect(atlas_tex, map_rect, false)
	draw_rect(map_rect, Color(0.82, 0.66, 0.34, 0.75), false, 2.0)

	var sx := map_rect.size.x / 2048.0
	var sy := map_rect.size.y / 1024.0

	# Draw ocean archipelagos
	for arch: Dictionary in manifest.get("archipelagos", []):
		var p := map_rect.position + Vector2(float(arch.get("x", 0.0)) * sx, float(arch.get("y", 0.0)) * sy)
		draw_circle(p, 5.0, Color(0.62, 0.90, 0.78, 0.85))
		draw_arc(p, 8.5, 0, TAU, 16, Color(0.62, 0.90, 0.78, 0.45), 1.5, true)

	# Draw 6 quest islands
	for isl: Dictionary in QUEST_ISLANDS:
		var ipos: Vector2 = isl.pos
		var p := map_rect.position + Vector2(ipos.x * sx, ipos.y * sy)
		draw_circle(p, 6.5, Color(0.98, 0.82, 0.32, 0.92))
		draw_arc(p, 10.5, 0, TAU, 20, Color(0.08, 0.05, 0.04, 0.9), 2.0, true)
		var iname := str(isl.title)
		draw_string_outline(f, p + Vector2(-38, 22), iname, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, 4, Color(0.02, 0.02, 0.03, 0.92))
		draw_string(f, p + Vector2(-38, 22), iname, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(0.96, 0.88, 0.64))

	# Draw 4 continents and their capital beacons
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
		draw_rect(Rect2(label_pos.x - 8, label_pos.y - 18, 248, 38), Color(0.03, 0.03, 0.04, 0.86))
		draw_rect(Rect2(label_pos.x - 8, label_pos.y - 18, 248, 38), col, false, 2.2 if is_active else 1.4)
		draw_string(f, label_pos, str(meta.label), HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(1.0, 0.96, 0.86))
		draw_string(f, label_pos + Vector2(0, 15), "Wymiary: %s | Stolica aktywna" % dims if is_active else "Wymiary: %s (kliknij)" % dims, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, col)

	draw_string(
		f,
		Vector2(22, size.y - 16),
		"Klawisze [1] Pyra  [2] Verdantia  [3] Aetheria  [4] Nexus-9  |  [G] Zamknij Atlas  |  [M] Mapa 3D regionu",
		HORIZONTAL_ALIGNMENT_LEFT,
		-1,
		13,
		Color(0.84, 0.78, 0.64)
	)
