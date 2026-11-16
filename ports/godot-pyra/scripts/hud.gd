class_name PyraHud
extends Control
const Look := preload("res://scripts/look.gd")   # the look that can change with server updates (see look.gd)
## Full game HUD: character medallion with HP / KI / race-resource bars and buffs, location banner, target frame, round
## minimap painted from the land's own map, round menu buttons, quest tracker, toasts and a thin XP bar. The art is
## drawn procedurally; it is redrawn only when something it shows has changed (no per-frame redraw cost while idle).

signal menu_requested
signal map_requested
signal character_requested
signal inventory_requested
signal zoom_requested
signal dialog_changed(open: bool)

const MINIMAP_SPAN := 9000.0
const MINIMAP_RADIUS := 74.0
const BUTTON_RADIUS := 27.0
const TOP_BUTTON_SIZE := Vector2(68, 84)   # the owner's button art (label inside the picture), see scripts/godot/prepare_hud.py
const BUTTON_ART := {"MAPA": "mapa", "POSTAĆ": "postac", "PLECAK": "plecak", "ZOOM": "zoom", "MENU": "menu"}
const GOLD := Color("f1c77f")
const GOLD_DARK := Color(0.62, 0.45, 0.26, 0.95)
const INK := Color(0.05, 0.02, 0.02, 0.95)
const MINIMAP_SHADER := """
shader_type canvas_item;
uniform sampler2D map : filter_linear, repeat_disable;
uniform vec2 center_uv = vec2(0.5);
uniform vec2 span_uv = vec2(0.1);
void fragment() {
	vec2 p = UV * 2.0 - 1.0;
	float d = length(p);
	if (d > 1.0) discard;
	vec3 c = texture(map, center_uv + p * 0.5 * span_uv).rgb;
	c *= 1.0 - smoothstep(0.6, 1.0, d) * 0.5;
	COLOR = vec4(c, 1.0);
}
"""

var touch := PyraTouchControls.new()
var place := Label.new()
var hint := Label.new()
var notice := Label.new()
var meter := Label.new()
var modal := PanelContainer.new()
var modal_box := VBoxContainer.new()
var buttons: Array[Button] = []
var top_buttons: Array[Button] = []
var menu_button: Button
var map_button: Button
var character_button: Button
var inventory_button: Button
var zoom_button: Button
var gold := 0
var coin_icon: Texture2D = load("res://assets/icons/coin.webp")
var notice_until := 0
var kit: RaceKit
var suspended := false
var area := Rect2()
var art := HudArt.new()
var art_layer := CachedLayer.new()
var touch_art := TouchArt.new()
var touch_layer := CachedLayer.new()
var minimap_view := ColorRect.new()
var minimap_material := ShaderMaterial.new()
var cinzel: Font = load("res://assets/branding/cinzel-bold.ttf")
var letters: Font = Look.title_font()   # the owner's gold letters for place names
var body_font: Font = ThemeDB.fallback_font

# layout (all rectangles in HUD coordinates)
var frame_rect := Rect2()
var medallion := Vector2.ZERO
var bars_x := 0.0
var banner_center := Vector2.ZERO
var minimap_center := Vector2.ZERO
var cave: PyraDungeon = null              # inside a cave the round map shows its automap instead of the land
var cave_position := Vector2.ZERO
var button_centers: Array[Vector2] = []
var button_art_cache: Dictionary = {}
var button_order: Array[Button] = []
var tracker_rect := Rect2()

# state shown by the art
var land_id := ""
var world_size := Vector2(1, 1)
var player_position := Vector2.ZERO
var player_facing := Vector2.DOWN
var map_markers: Array[Dictionary] = []   # {point, kind}
var target := {}                          # {name, hp, max, level} or empty
var quests: Array[Dictionary] = []        # {title, lines: [String]}
var buff_view: Array[Dictionary] = []     # {id, left, total}
var show_fps := false
var fps_text := ""
var portrait: Texture2D
var portrait_race := ""
var skill_icons: Dictionary = {}
var signature := ""
var potion_count := 0

func panel_style(_background: Color = Color.BLACK, _border: Color = Color.BLACK) -> StyleBox:
	return Look.window()   # the stone window of the owner's frame art; the colours of the earlier flat look are no longer used

func outlined(label: Label, size_px: int, color: Color) -> void:
	label.add_theme_font_size_override("font_size", size_px)
	label.add_theme_color_override("font_color", color)
	label.add_theme_color_override("font_outline_color", Color(0.06, 0.03, 0.02, 0.95))
	label.add_theme_constant_override("outline_size", 7)

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(touch)
	minimap_view.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var shader := Shader.new()
	shader.code = MINIMAP_SHADER
	minimap_material.shader = shader
	minimap_view.material = minimap_material
	minimap_view.size = Vector2.ONE * MINIMAP_RADIUS * 2.0
	add_child(minimap_view)
	touch_art.touch = touch
	touch_art.mouse_filter = Control.MOUSE_FILTER_IGNORE
	touch_layer.setup(touch_art)
	touch.art_changed.connect(touch_layer.invalidate)
	add_child(touch_layer)
	art.hud = self
	art.mouse_filter = Control.MOUSE_FILTER_IGNORE
	art.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	touch_art.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	art_layer.setup(art)
	add_child(art_layer)
	map_button = make_top_button("MAPA", func(): map_requested.emit())
	character_button = make_top_button("POSTAĆ", func(): character_requested.emit())
	inventory_button = make_top_button("PLECAK", func(): inventory_requested.emit())
	zoom_button = make_top_button("ZOOM", func(): zoom_requested.emit())
	menu_button = make_top_button("MENU", func(): menu_requested.emit())
	for label in [place, hint, notice, meter]:
		label.visible_characters = -1
		label.add_theme_font_size_override("font_size", 16)
		label.modulate = Color(1, 1, 1, 0)   # the art draws these; the nodes only carry the text
	hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	place.text = "Twierdza Popiołu"
	for label in [place, hint, notice, meter]:
		add_child(label)
	modal.add_theme_stylebox_override("panel", panel_style(Color("191315"), Color("c18a4b")))
	modal.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	modal.offset_left = -375
	modal.offset_right = 375
	modal.offset_top = -200
	modal.offset_bottom = 200
	modal.mouse_filter = Control.MOUSE_FILTER_STOP
	modal_box.add_theme_constant_override("separation", 15)
	modal.add_child(modal_box)
	add_child(modal)
	modal.hide()
	resized.connect(_layout)
	_layout()

func make_top_button(text: String, callback: Callable) -> Button:
	var button := Button.new()
	button.text = ""
	button.name = text
	button.flat = true
	button.mouse_filter = Control.MOUSE_FILTER_IGNORE
	button.focus_mode = Control.FOCUS_NONE
	button.size = Vector2(60, 70)
	button.custom_minimum_size = Vector2(60, 70)
	button.pressed.connect(callback)
	add_child(button)
	top_buttons.append(button)
	buttons.append(button)
	return button

func _layout() -> void:
	area = Rect2(Vector2.ZERO, size)
	if OS.get_name() == "Android":
		var safe := DisplayServer.get_display_safe_area()
		if safe.has_area():
			area = (get_tree().root.get_screen_transform().affine_inverse() * Rect2(safe)).intersection(area)
	frame_rect = Rect2(area.position + Vector2(14, 12), Vector2(404, 120))
	medallion = frame_rect.position + Vector2(62, 62)
	bars_x = frame_rect.position.x + 124.0
	banner_center = Vector2(area.get_center().x, area.position.y + 34)
	minimap_center = Vector2(area.end.x - 14 - MINIMAP_RADIUS, area.position.y + 12 + MINIMAP_RADIUS)
	minimap_view.position = minimap_center - Vector2.ONE * (MINIMAP_RADIUS - 5.0)
	minimap_view.size = Vector2.ONE * (MINIMAP_RADIUS - 5.0) * 2.0
	button_centers.clear()
	button_order = [menu_button, zoom_button, inventory_button, character_button, map_button]
	var x := minimap_center.x - MINIMAP_RADIUS - 18.0
	for button: Button in button_order:
		x -= TOP_BUTTON_SIZE.x
		var rect := Rect2(Vector2(x, area.position.y + 8.0), TOP_BUTTON_SIZE)
		button_centers.append(rect.get_center())
		button.position = rect.position
		button.size = rect.size
		x -= 4.0
	# the place banner and the target frame stay between the hero frame and the top buttons instead of sitting under them
	var half_banner := 175.0
	var low := frame_rect.end.x + 10.0 + half_banner
	var high := x + 4.0 - 10.0 - half_banner
	banner_center.x = clampf(area.get_center().x, low, high) if low <= high else (low + high) / 2.0
	tracker_rect = Rect2(Vector2(area.end.x - 278, minimap_center.y + MINIMAP_RADIUS + 12), Vector2(264, 120))
	hint.position = Vector2(area.get_center().x - 280, area.end.y - 62)
	hint.size = Vector2(560, 30)
	touch.set_safe_area(area)
	signature = ""
	art_layer.resize_to(size)
	touch_layer.resize_to(size)

## Called when a land is entered: minimap texture and the points drawn on it.
func set_land(id: String, size_of_world: Vector2, markers: Array[Dictionary]) -> void:
	land_id = id
	world_size = size_of_world
	map_markers = markers
	var texture: Texture2D = load("res://assets/lands/%s/map.webp" % id)
	minimap_material.set_shader_parameter("map", texture)
	signature = ""

func set_cave(dungeon: PyraDungeon) -> void:
	cave = dungeon
	minimap_view.visible = dungeon == null
	signature = ""

func set_cave_position(position: Vector2, facing: Vector2) -> void:
	cave_position = position
	player_facing = facing

func set_player(position: Vector2, facing: Vector2) -> void:
	player_position = position
	player_facing = facing
	minimap_material.set_shader_parameter("center_uv", Vector2(position.x / world_size.x, position.y / world_size.y))
	minimap_material.set_shader_parameter("span_uv", Vector2(MINIMAP_SPAN / world_size.x, MINIMAP_SPAN / world_size.y))

func set_target(info: Dictionary) -> void:
	target = info

func skill_icon(id: String) -> Texture2D:
	if kit == null:
		return null
	var key := "%s/%s" % [kit.race, id]
	if not skill_icons.has(key):
		var path := "res://assets/icons/skills/%s.png" % key
		skill_icons[key] = load(path) if ResourceLoader.exists(path) else null
	return skill_icons[key]

func portrait_for(race: String) -> Texture2D:
	if portrait_race != race:
		portrait_race = race
		var full: Texture2D = load("res://assets/races/%s.jpg" % race)
		var crop := AtlasTexture.new()
		crop.atlas = full
		var w := float(full.get_width())
		crop.region = Rect2(w * 0.25, w * 0.03, w * 0.5, w * 0.5)
		portrait = crop
	return portrait

## Everything the art shows, as one string: the art is redrawn only when this changes.
func compute_signature() -> String:
	if kit == null:
		return "none"
	var s := kit.stats()
	var parts: Array[String] = [str(int(ceil(kit.hp))), str(int(s.maxHp)), str(int(kit.ki)), str(int(s.maxKi)), kit.resource_label(), str(snappedf(kit.resource_ratio(), 0.01)),
		str(kit.level), str(kit.xp), str(gold), place.text, notice.text, hint.text, meter.text, str(land_id), kit.race, str(int(kit.shield_total()))]
	for b in buff_view:
		parts.append("%s%d" % [b.id, int(b.left * 2.0)])
	if not target.is_empty():
		parts.append("%s%d" % [target.name, int(target.hp)])
	parts.append("%d,%d" % [int(player_position.x / 24.0), int(player_position.y / 24.0)])
	if cave != null:
		parts.append("c%d,%d,%d,%d" % [int(cave_position.x / 40.0), int(cave_position.y / 40.0), cave.explored.size(), cave.floor_index])
	parts.append(str(int(rad_to_deg(player_facing.angle()) / 15.0)))
	parts.append(str(quests.hash()))
	parts.append(fps_text)
	parts.append(str(potion_count))
	return "|".join(parts)

class HudArt extends Control:
	var hud: PyraHud
	func _draw() -> void:
		hud.draw_art(self)

class TouchArt extends Control:
	var touch: PyraTouchControls
	func _draw() -> void:
		touch.cv = self
		touch.paint()

# ---- drawing helpers ------------------------------------------------------------------------

func text_outlined(canvas: Control, font: Font, at: Vector2, text: String, size_px: int, color: Color, outline: int = 5) -> void:
	canvas.draw_string_outline(font, at, text, HORIZONTAL_ALIGNMENT_LEFT, -1, size_px, outline, INK)
	canvas.draw_string(font, at, text, HORIZONTAL_ALIGNMENT_LEFT, -1, size_px, color)

func text_centered(canvas: Control, font: Font, center: Vector2, text: String, size_px: int, color: Color, outline: int = 5) -> void:
	var w := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, size_px).x
	text_outlined(canvas, font, center + Vector2(-w / 2.0, size_px * 0.34), text, size_px, color, outline)

func rounded(canvas: Control, rect: Rect2, fill: Color, border: Color, radius: float, border_width: float = 1.5) -> void:
	var box := StyleBoxFlat.new()
	box.bg_color = fill
	box.border_color = border
	box.set_border_width_all(int(border_width))
	box.set_corner_radius_all(int(radius))
	canvas.draw_style_box(box, rect)

## Ornate bar: dark inset, gradient fill with a gloss line, tick marks, gold frame; text centred.
func ornate_bar(canvas: Control, rect: Rect2, ratio: float, fill: Color, text: String, size_px: int, shield: float = 0.0) -> void:
	rounded(canvas, rect, Color(0.035, 0.022, 0.025, 0.92), GOLD_DARK, rect.size.y * 0.5, 1.6)
	var inner := rect.grow(-2.5)
	var w := inner.size.x * clampf(ratio, 0.0, 1.0)
	if w > 1.0:
		var lit := fill.lightened(0.28)
		var dark := fill.darkened(0.32)
		var fill_rect := Rect2(inner.position, Vector2(w, inner.size.y))
		rounded(canvas, fill_rect, dark, Color(0, 0, 0, 0), inner.size.y * 0.5, 0)
		rounded(canvas, Rect2(fill_rect.position + Vector2(0, 0), Vector2(w, inner.size.y * 0.6)), fill, Color(0, 0, 0, 0), inner.size.y * 0.4, 0)
		rounded(canvas, Rect2(fill_rect.position + Vector2(inner.size.y * 0.35, 1.0), Vector2(maxf(0.0, w - inner.size.y * 0.7), maxf(1.5, inner.size.y * 0.18))), Color(lit.r, lit.g, lit.b, 0.55), Color(0, 0, 0, 0), 2.0, 0)
	if shield > 0.0:
		canvas.draw_rect(Rect2(inner.position + Vector2(0, inner.size.y - 3.0), Vector2(inner.size.x * clampf(shield, 0.0, 1.0), 3.0)), Color("9fe3ff"))
	for i in range(1, 4):
		var x := inner.position.x + inner.size.x * i / 4.0
		canvas.draw_line(Vector2(x, inner.position.y + 2.0), Vector2(x, inner.end.y - 2.0), Color(0, 0, 0, 0.22), 1.0)
	text_centered(canvas, body_font, rect.get_center() + Vector2(0, 0.5), text, size_px, Color("fff4dc"), 4)

func draw_glyph(canvas: Control, kind: String, c: Vector2, scale: float) -> void:
	var gold := GOLD
	match kind:
		"MAPA":   # folded map with a pin
			var pts := PackedVector2Array([c + Vector2(-13, -9) * scale, c + Vector2(-4, -12) * scale, c + Vector2(4, -9) * scale, c + Vector2(13, -12) * scale, c + Vector2(13, 9) * scale, c + Vector2(4, 12) * scale, c + Vector2(-4, 9) * scale, c + Vector2(-13, 12) * scale])
			canvas.draw_colored_polygon(pts, Color(0.86, 0.74, 0.5, 0.95))
			canvas.draw_line(c + Vector2(-4, -12) * scale, c + Vector2(-4, 9) * scale, Color(0.4, 0.28, 0.14), 1.4)
			canvas.draw_line(c + Vector2(4, -9) * scale, c + Vector2(4, 12) * scale, Color(0.4, 0.28, 0.14), 1.4)
			canvas.draw_circle(c + Vector2(6, -3) * scale, 3.4 * scale, Color("d9402b"))
		"POSTAĆ":   # bust
			canvas.draw_circle(c + Vector2(0, -6) * scale, 6.0 * scale, gold)
			canvas.draw_colored_polygon(PackedVector2Array([c + Vector2(-11, 12) * scale, c + Vector2(-9, 3) * scale, c + Vector2(0, 0) * scale, c + Vector2(9, 3) * scale, c + Vector2(11, 12) * scale]), gold)
		"PLECAK":   # satchel
			rounded(canvas, Rect2(c + Vector2(-11, -5) * scale, Vector2(22, 17) * scale), Color(0.72, 0.48, 0.24), Color(0.28, 0.16, 0.07), 4.0 * scale, 1.5)
			canvas.draw_arc(c + Vector2(0, -5) * scale, 6.5 * scale, PI, TAU, 14, gold, 2.2 * scale, true)
			canvas.draw_rect(Rect2(c + Vector2(-3, 1) * scale, Vector2(6, 5) * scale), gold)
		"ZOOM":   # magnifier
			canvas.draw_arc(c + Vector2(-2, -2) * scale, 8.0 * scale, 0, TAU, 20, gold, 2.6 * scale, true)
			canvas.draw_line(c + Vector2(4, 4) * scale, c + Vector2(12, 12) * scale, gold, 3.4 * scale, true)
			canvas.draw_line(c + Vector2(-5, -2) * scale, c + Vector2(1, -2) * scale, gold, 1.6 * scale)
		_:   # MENU: three bars
			for i in 3:
				canvas.draw_line(c + Vector2(-10, -7 + 7 * i) * scale, c + Vector2(10, -7 + 7 * i) * scale, gold, 2.8 * scale, true)

## The owner's button picture of a top button, or null when this install does not have it (then the code-drawn button below is used).
func button_texture(label: String) -> Texture2D:
	if not button_art_cache.has(label):
		var path := "res://assets/ui/hud/btn-%s.webp" % str(BUTTON_ART.get(label, ""))
		button_art_cache[label] = load(path) if BUTTON_ART.has(label) and ResourceLoader.exists(path) else null
	return button_art_cache[label]

func round_button(canvas: Control, c: Vector2, label: String) -> void:
	var art_texture := button_texture(label)
	if art_texture != null:
		canvas.draw_texture_rect(art_texture, Rect2(c - TOP_BUTTON_SIZE / 2.0, TOP_BUTTON_SIZE), false)
		return
	canvas.draw_circle(c + Vector2(0, 2), BUTTON_RADIUS + 1.0, Color(0, 0, 0, 0.35))
	canvas.draw_circle(c, BUTTON_RADIUS, Color(0.12, 0.08, 0.07, 0.9))
	canvas.draw_arc(c, BUTTON_RADIUS, 0, TAU, 36, GOLD_DARK, 2.0, true)
	canvas.draw_arc(c, BUTTON_RADIUS - 4.0, PI * 1.1, PI * 1.9, 14, Color(1, 1, 1, 0.12), 2.0, true)
	draw_glyph(canvas, label, c + Vector2(0, -1), 1.0)
	text_centered(canvas, cinzel, c + Vector2(0, BUTTON_RADIUS + 11.0), label, 11, Color("e6d3ae"), 4)

func world_to_minimap(p: Vector2) -> Vector2:
	return (p - player_position) / MINIMAP_SPAN * (MINIMAP_RADIUS * 2.0 - 10.0)

func draw_minimap(canvas: Control) -> void:
	var c := minimap_center
	canvas.draw_circle(c + Vector2(0, 3), MINIMAP_RADIUS + 3.0, Color(0, 0, 0, 0.4))
	if cave != null:
		draw_cave_map(canvas, c)
	for m in (map_markers if cave == null else []):
		var d := world_to_minimap(m.point)
		var inside := d.length() < MINIMAP_RADIUS - 12.0
		var kind := str(m.kind)
		if inside:
			MapStyle.marker(canvas, c + d, kind, 0.62)
		elif kind == "city":
			var dir := d.normalized()
			var edge := c + dir * (MINIMAP_RADIUS - 7.0)
			var tip := edge + dir * 5.0
			var side := Vector2(-dir.y, dir.x) * 4.0
			canvas.draw_colored_polygon(PackedVector2Array([tip, edge + side, edge - side]), Color("ffd36a"))
	# player arrow
	var a := player_facing.angle()
	var forward := Vector2.from_angle(a)
	var right := Vector2.from_angle(a + PI / 2.0)
	canvas.draw_colored_polygon(PackedVector2Array([c + forward * 9.0, c - forward * 6.0 + right * 6.0, c - forward * 3.0, c - forward * 6.0 - right * 6.0]), Color("fff0b8"))
	canvas.draw_polyline(PackedVector2Array([c + forward * 9.0, c - forward * 6.0 + right * 6.0, c - forward * 3.0, c - forward * 6.0 - right * 6.0, c + forward * 9.0]), Color(0.3, 0.12, 0.05), 1.6, true)
	canvas.draw_arc(c, MINIMAP_RADIUS, 0, TAU, 64, GOLD_DARK, 4.0, true)
	canvas.draw_arc(c, MINIMAP_RADIUS - 5.0, 0, TAU, 64, Color(0.1, 0.06, 0.04, 0.9), 2.0, true)
	canvas.draw_arc(c, MINIMAP_RADIUS + 2.0, 0, TAU, 64, Color(1, 0.9, 0.6, 0.35), 1.2, true)
	text_centered(canvas, cinzel, c + Vector2(0, -MINIMAP_RADIUS + 9.0), "N", 13, GOLD, 5)

## The automap of a cave floor: explored cells around the hero, with what has been seen (key, gate, stairs, chests, ways out).
func draw_cave_map(canvas: Control, c: Vector2) -> void:
	var cell_px := 8.0
	var radius := MINIMAP_RADIUS - 8.0
	canvas.draw_circle(c, MINIMAP_RADIUS - 5.0, Color(0.04, 0.035, 0.05, 0.94))
	var here := cave.cell_of(cave_position)
	var frac := cave_position / PyraDungeon.CELL - Vector2(here)
	var span := int(radius / cell_px) + 2
	var spots: Array[Dictionary] = []
	for dy in range(-span, span + 1):
		for dx in range(-span, span + 1):
			var cell := here + Vector2i(dx, dy)
			if not cave.explored.has(cell):
				continue
			var p := c + (Vector2(dx, dy) - frac + Vector2(0.5, 0.5)) * cell_px
			if (p - c).length() > radius - 2.0:
				continue
			var color := Color(0.17, 0.14, 0.13)
			if cave.open_cell(cell):
				color = Color(0.80, 0.70, 0.52)
			elif cave.is_floor(cell):
				color = Color(0.6, 0.2, 0.18)   # a closed gate
			canvas.draw_rect(Rect2(p - Vector2.ONE * cell_px * 0.5, Vector2.ONE * cell_px), color)
	var marks: Array[Dictionary] = []
	if cave.key_cell.x >= 0 and not (cave.state.keys as Array).has(cave.key_id()):
		marks.append({"cell": cave.key_cell, "color": Color("ffd24a"), "shape": "dot"})
	if cave.stairs_cell.x >= 0:
		marks.append({"cell": cave.stairs_cell, "color": Color("9fe3ff"), "shape": "down"})
	if cave.floor_index > 0:
		marks.append({"cell": cave.room_center(cave.start_room) + Vector2i(1, 0), "color": Color("9fe3ff"), "shape": "up"})
	marks.append({"cell": cave.cell_of(cave.exit_point() if cave.floor_index == 0 else cave.stairs_up_point()), "color": Color("7fe08a"), "shape": "door"})
	if cave.role == "transit":
		marks.append({"cell": cave.cell_of(cave.link_point()), "color": Color("8ab4ff"), "shape": "door"})
	for chest: Dictionary in cave.chests:
		if not (cave.state.chests as Array).has(chest.id) and not bool(chest.get("secret", false)):
			marks.append({"cell": chest.cell, "color": Color("ff9d3a"), "shape": "box"})
	for m: Dictionary in marks:
		var cell: Vector2i = m.cell
		if not cave.explored.has(cell):
			continue
		var p := c + (Vector2(cell - here) - frac + Vector2(0.5, 0.5)) * cell_px
		if (p - c).length() > radius - 4.0:
			continue
		var color: Color = m.color
		match str(m.shape):
			"dot":
				canvas.draw_circle(p, 3.4, color)
			"box":
				canvas.draw_rect(Rect2(p - Vector2(3, 3), Vector2(6, 6)), color)
			"door":
				canvas.draw_rect(Rect2(p - Vector2(3.5, 4.5), Vector2(7, 9)), color)
			"down":
				canvas.draw_colored_polygon(PackedVector2Array([p + Vector2(-4, -3), p + Vector2(4, -3), p + Vector2(0, 4)]), color)
			"up":
				canvas.draw_colored_polygon(PackedVector2Array([p + Vector2(-4, 3), p + Vector2(4, 3), p + Vector2(0, -4)]), color)

func draw_frame(canvas: Control) -> void:
	var s := kit.stats()
	var r := frame_rect
	rounded(canvas, Rect2(r.position + Vector2(40, 8), r.size - Vector2(40, 16)), Color(0.07, 0.05, 0.055, 0.86), GOLD_DARK, 16.0, 2.0)
	# medallion with xp ring
	var xp_ratio := float(kit.xp) / float(maxi(1, RaceKit.xp_needed(kit.level)))
	canvas.draw_circle(medallion + Vector2(0, 3), 53.0, Color(0, 0, 0, 0.4))
	canvas.draw_circle(medallion, 51.0, Color(0.11, 0.07, 0.06))
	canvas.draw_arc(medallion, 49.0, -PI / 2.0, -PI / 2.0 + TAU, 48, Color(0.2, 0.15, 0.1), 5.0, true)
	if xp_ratio > 0.0:
		canvas.draw_arc(medallion, 49.0, -PI / 2.0, -PI / 2.0 + TAU * xp_ratio, 48, Color("b9d98d"), 5.0, true)
	var tex := portrait_for(kit.race)
	if tex != null:
		var points := PackedVector2Array()
		var uvs := PackedVector2Array()
		for i in 40:
			var ang := TAU * i / 40.0
			var dir := Vector2.from_angle(ang)
			points.append(medallion + dir * 42.0)
			uvs.append(Vector2(0.5, 0.5) + dir * 0.5)
		canvas.draw_colored_polygon(points, Color.WHITE, uvs, tex)
	canvas.draw_arc(medallion, 42.0, 0, TAU, 48, GOLD, 2.4, true)
	canvas.draw_arc(medallion, 53.0, 0, TAU, 48, GOLD_DARK, 2.0, true)
	# level badge
	var badge := medallion + Vector2(-34, 36)
	canvas.draw_circle(badge, 15.0, Color(0.1, 0.06, 0.04))
	canvas.draw_arc(badge, 15.0, 0, TAU, 28, GOLD, 2.2, true)
	text_centered(canvas, cinzel, badge, str(kit.level), 15, Color("fff0c8"), 4)
	# name
	text_outlined(canvas, cinzel, Vector2(bars_x, r.position.y + 28), str(kit.data.raceName).to_upper(), 17, GOLD)
	# bars
	var shield := kit.shield_total() / maxf(1.0, float(s.maxHp))
	ornate_bar(canvas, Rect2(bars_x, r.position.y + 36, 270, 25), kit.hp / float(s.maxHp), Color("c93b2c"), "%d / %d" % [int(ceil(kit.hp)), int(s.maxHp)], 14, shield)
	ornate_bar(canvas, Rect2(bars_x, r.position.y + 65, 270, 20), kit.ki / float(s.maxKi), Color("3f7fd6"), "KI  %d / %d" % [int(kit.ki), int(s.maxKi)], 13)
	var resource_colors := {"legend": Color("e0832a"), "planetary": Color("6fbf4a"), "sage": Color("e8c25a"), "android": Color("39c5d9")}
	var resource_color: Color = resource_colors.get(kit.race, Color("e0832a"))
	ornate_bar(canvas, Rect2(bars_x, r.position.y + 89, 270, 17), kit.resource_ratio(), resource_color.lightened(0.22 if kit.resource_full() else 0.0), kit.resource_label(), 12)
	# coins
	var coins := str(gold)
	var coin_w := body_font.get_string_size(coins, HORIZONTAL_ALIGNMENT_LEFT, -1, 16).x
	var cx := r.position.x + 72.0
	canvas.draw_texture_rect(coin_icon, Rect2(Vector2(cx, r.end.y + 2), Vector2(22, 22)), false)
	text_outlined(canvas, body_font, Vector2(cx + 28, r.end.y + 19), coins, 16, Color("ffd76a"))
	# buffs
	var bx := bars_x + 44.0
	for b in buff_view:
		var icon := skill_icon(str(b.id))
		var c := Vector2(bx + 15, r.end.y + 15)
		if icon != null:
			canvas.draw_texture_rect(icon, Rect2(c - Vector2(15, 15), Vector2(30, 30)), false)
		else:
			canvas.draw_circle(c, 15.0, Color(0.3, 0.2, 0.12))
		var ratio: float = clampf(float(b.left) / maxf(0.1, float(b.total)), 0.0, 1.0)
		canvas.draw_arc(c, 15.5, -PI / 2.0, -PI / 2.0 + TAU * ratio, 24, Color("ffe08a"), 2.6, true)
		text_centered(canvas, body_font, c + Vector2(0, 21), "%d" % int(ceil(float(b.left))), 11, Color("fff0c8"), 4)
		bx += 36.0

func draw_banner(canvas: Control) -> void:
	var parts := place.text.split(" · ")
	var title := parts[0].to_upper()
	var sub := parts[1] if parts.size() > 1 else ""
	var w := letters.get_string_size(title, HORIZONTAL_ALIGNMENT_LEFT, -1, 26).x
	var width := maxf(w + 64.0, 230.0)
	var rect := Rect2(banner_center - Vector2(width / 2.0, 20), Vector2(width, 44 if sub != "" else 38))
	rounded(canvas, rect, Color(0.07, 0.05, 0.055, 0.8), GOLD_DARK, 14.0, 2.0)
	for dir in [-1.0, 1.0]:
		var tip := Vector2(rect.get_center().x + dir * (width / 2.0 + 14.0), rect.position.y + 19.0)
		canvas.draw_colored_polygon(PackedVector2Array([tip, tip - Vector2(dir * 12.0, 7.0), tip - Vector2(dir * 12.0, -7.0)]), GOLD_DARK)
	text_centered(canvas, letters, Vector2(rect.get_center().x, rect.position.y + 19), title, 26, Color.WHITE, 0)
	if sub != "":
		var safe := sub.contains("bezpieczna")
		var chip := Color("8fe3a0") if safe else Color("ffb27a")
		canvas.draw_circle(Vector2(rect.get_center().x - body_font.get_string_size(sub, HORIZONTAL_ALIGNMENT_LEFT, -1, 12).x / 2.0 - 8.0, rect.position.y + 36), 3.5, chip)
		text_centered(canvas, body_font, Vector2(rect.get_center().x, rect.position.y + 36), sub, 12, chip, 4)

func draw_target(canvas: Control) -> void:
	if target.is_empty():
		return
	var rect := Rect2(Vector2(banner_center.x - 165, banner_center.y + 36), Vector2(330, 48))
	rounded(canvas, rect, Color(0.09, 0.04, 0.045, 0.86), Color(0.7, 0.28, 0.2, 0.95), 12.0, 2.0)
	text_outlined(canvas, cinzel, rect.position + Vector2(14, 20), str(target.name).to_upper(), 14, Color("ffd9c8"))
	if target.has("level"):
		var lv := "poz. %d" % int(target.level)
		var lw := body_font.get_string_size(lv, HORIZONTAL_ALIGNMENT_LEFT, -1, 13).x
		text_outlined(canvas, body_font, rect.position + Vector2(rect.size.x - lw - 14, 20), lv, 13, Color("e6d3ae"))
	ornate_bar(canvas, Rect2(rect.position + Vector2(12, 27), Vector2(rect.size.x - 24, 15)), float(target.hp) / maxf(1.0, float(target.max)), Color("c9573a"), "%d / %d" % [int(target.hp), int(target.max)], 11)

func draw_tracker(canvas: Control) -> void:
	if quests.is_empty():
		return
	var lines := 0
	for q in quests:
		lines += 1 + (q.lines as Array).size()
	var rect := Rect2(tracker_rect.position, Vector2(tracker_rect.size.x, 18.0 + 22.0 * lines))
	rounded(canvas, rect, Color(0.06, 0.05, 0.06, 0.68), GOLD_DARK, 12.0, 1.5)
	var y := rect.position.y + 20.0
	for q in quests:
		text_outlined(canvas, cinzel, Vector2(rect.position.x + 12, y), str(q.title), 14, GOLD)
		y += 22.0
		for line in q.lines:
			text_outlined(canvas, body_font, Vector2(rect.position.x + 20, y), "• " + str(line), 13, Color("e8dcc4"), 4)
			y += 22.0

func draw_notice(canvas: Control) -> void:
	if notice.text == "":
		return
	var w := minf(760.0, body_font.get_string_size(notice.text, HORIZONTAL_ALIGNMENT_LEFT, -1, 19).x + 56.0)
	var rect := Rect2(Vector2(area.get_center().x - w / 2.0, area.position.y + 118), Vector2(w, 40))
	rounded(canvas, rect, Color(0.08, 0.06, 0.06, 0.9), GOLD, 20.0, 2.0)
	text_centered(canvas, body_font, rect.get_center(), notice.text, 19, Color("fff0c7"), 5)

func draw_art(canvas: Control) -> void:
	if kit == null:
		return
	draw_minimap(canvas)
	draw_frame(canvas)
	draw_banner(canvas)
	draw_target(canvas)
	for i in button_order.size():
		round_button(canvas, button_centers[i], str(button_order[i].name))
	draw_tracker(canvas)
	draw_notice(canvas)
	if hint.text != "":
		var hw := minf(640.0, body_font.get_string_size(hint.text, HORIZONTAL_ALIGNMENT_LEFT, -1, 20).x + 50.0)
		var rect := Rect2(Vector2(area.get_center().x - hw / 2.0, area.end.y - 70), Vector2(hw, 36))
		rounded(canvas, rect, Color(0.08, 0.06, 0.06, 0.78), GOLD_DARK, 18.0, 1.5)
		text_centered(canvas, body_font, rect.get_center(), hint.text, 20, Color("ffe8b4"), 5)
	if meter.text != "":
		text_outlined(canvas, body_font, Vector2(area.get_center().x - 160, banner_center.y + 108), meter.text, 16, Color("c8e2ff"))
	if show_fps:
		text_outlined(canvas, body_font, Vector2(frame_rect.position.x + 4, area.end.y - 14), fps_text, 14, Color("9fe3a0"), 4)
	# thin XP bar on the bottom edge
	var xp_ratio := float(kit.xp) / float(maxi(1, RaceKit.xp_needed(kit.level)))
	canvas.draw_rect(Rect2(area.position.x, area.end.y - 5, area.size.x, 5), Color(0.04, 0.03, 0.03, 0.8))
	canvas.draw_rect(Rect2(area.position.x, area.end.y - 5, area.size.x * xp_ratio, 5), Color("b9d98d"))

# ---- inherited behaviour --------------------------------------------------------------------

func make_button(text: String, callback: Callable) -> Button:
	var button := Button.new()
	button.text = text
	button.mouse_filter = Control.MOUSE_FILTER_IGNORE
	button.focus_mode = Control.FOCUS_NONE
	button.custom_minimum_size = Vector2(160, 80)
	button.add_theme_font_size_override("font_size", 23)
	button.add_theme_color_override("font_color", Color("fff0cf"))
	PyraSkin.style_button(button)
	button.pressed.connect(callback)
	buttons.append(button)
	return button

func show_dialog(title: String, text: String, actions: Array = []) -> void:
	for child in modal_box.get_children():
		child.hide()
		child.queue_free()
	buttons = top_buttons.duplicate()
	var heading := Label.new()
	heading.text = title
	heading.add_theme_font_override("font", cinzel)
	heading.add_theme_font_size_override("font_size", 30)
	heading.add_theme_color_override("font_color", Color("f1c77f"))
	modal_box.add_child(heading)
	var body := Label.new()
	body.text = text
	body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	body.custom_minimum_size = Vector2(660, 0)
	body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	body.add_theme_font_size_override("font_size", 23)
	body.add_theme_color_override("font_color", Color("e1d4c4"))
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(680, 160)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.add_child(body)
	modal_box.add_child(scroll)
	for action: Dictionary in actions:
		modal_box.add_child(make_button(action.text, action.callback))
	modal_box.add_child(make_button("ZAMKNIJ", close_dialog))
	modal.show()
	touch.blocked = true
	touch.reset()
	dialog_changed.emit(true)

func close_dialog() -> void:
	modal.hide()
	touch.blocked = false
	touch.reset()
	dialog_changed.emit(false)

func toast(text: String) -> void:
	notice.text = text
	notice_until = Time.get_ticks_msec() + 3200

func refresh(game_kit: RaceKit) -> void:
	kit = game_kit
	var views := []
	for i in RaceKit.SLOTS:
		var id := kit.slots[i]
		if id == "":
			views.append({})
			continue
		var def: Dictionary = kit.nodes[id]
		var cd := kit.cooldown_left(id)
		views.append({"id": id, "short": id, "ki": def.ki, "cd": cd, "cd_ratio": cd / float(def.cd), "ki_ok": kit.ki >= float(def.ki), "icon": skill_icon(id)})
	touch.slot_view = views
	touch.attack_ratio = clampf((kit.next_basic_at - kit.now) / maxf(0.05, kit.interval()), 0.0, 1.0)
	touch.potion_count = potion_count
	touch.potion_ratio = potion_cooldown_ratio
	touch.dodge_ratio = clampf(1.0 - maxf(0.0, kit.next_dodge_at - kit.now) / RaceKit.DODGE_COOLDOWN, 0.0, 1.0)
	var touch_signature := "%d|%d|%d|%d|%s" % [int(touch.attack_ratio * 24.0), int(touch.dodge_ratio * 24.0), int(touch.potion_ratio * 24.0), touch.potion_count, touch.enabled_target]
	for v: Dictionary in views:
		touch_signature += "|%s%d%s" % [v.get("id", ""), int(float(v.get("cd", 0.0)) * 10.0), v.get("ki_ok", true)]
	if touch_signature != last_touch_signature:
		last_touch_signature = touch_signature
		touch.invalidate()
	buff_view.clear()
	for b in kit.buffs:
		if kit.nodes.has(str(b.id)):
			buff_view.append({"id": str(b.id), "left": maxf(0.0, float(b.until) - kit.now), "total": float(b.ms) / 1000.0})
	var now_signature := compute_signature()
	if now_signature != signature:
		signature = now_signature
		art_layer.invalidate()

var potion_cooldown_ratio := 0.0
var last_touch_signature := ""

func _process(_delta: float) -> void:
	if Time.get_ticks_msec() > notice_until and notice.text != "":
		notice.text = ""
	if show_fps:
		fps_text = "%d FPS · %.1f ms · %d wywołań · %d MiB" % [Engine.get_frames_per_second(), 1000.0 / maxf(1.0, Engine.get_frames_per_second()), int(RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_DRAW_CALLS_IN_FRAME)), int(RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TEXTURE_MEM_USED) / 1048576)]

func _input(event: InputEvent) -> void:
	if suspended:
		return
	var pressed := false
	var point := Vector2.ZERO
	if event is InputEventScreenTouch:
		pressed = event.pressed and not event.canceled
		point = event.position
	elif event is InputEventMouseButton and event.device != InputEvent.DEVICE_ID_EMULATION:
		pressed = event.pressed and event.button_index == MOUSE_BUTTON_LEFT
		point = event.position
	if not pressed:
		return
	# Custom dispatch handles every finger; these visual Button nodes ignore the emulated mouse.
	for button in buttons:
		if is_instance_valid(button) and button.is_visible_in_tree() and button.get_global_rect().has_point(point):
			button.pressed.emit()
			get_viewport().set_input_as_handled()
			return
