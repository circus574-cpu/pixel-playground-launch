extends Control
## Walkable, Y-Sorted Painted Building Interiors for ALL 59 Enterable Buildings across all 4 Continents.
## Uses the 48 biome-painted GPU interior props (assets/interiors/{pyra,verdant,aether,nexus}/*.webp),
## live animated Hero & Service NPCs, wall/furniture collision, exit doorway, and interactive services:
## Shop (Buy/Sell), Smithy (Crafting), Depot (Bank Vault), Inn (Full Rest), Arena (Training), Hall/Citadel (Lore).

const ActorScript := preload("res://scripts/actor_view.gd")
const MapStyle := preload("res://scripts/map_style.gd")
const GmPanelScript := preload("res://scripts/gm_panel.gd")

const ROOM_W := 960.0
const ROOM_H := 520.0
const WALL_T := 64.0
const WALK_SPEED := 280.0

const BIOME_PALETTE := {
	"pyra": {"bg": Color(0.05, 0.03, 0.03), "wall": Color(0.20, 0.13, 0.11), "trim": Color(0.88, 0.52, 0.24), "floor_tint": Color(0.76, 0.60, 0.52), "glow": Color(1.0, 0.56, 0.20, 0.22)},
	"verdant": {"bg": Color(0.03, 0.05, 0.04), "wall": Color(0.18, 0.20, 0.14), "trim": Color(0.78, 0.68, 0.36), "floor_tint": Color(0.78, 0.74, 0.62), "glow": Color(0.96, 0.84, 0.44, 0.20)},
	"aether": {"bg": Color(0.03, 0.05, 0.08), "wall": Color(0.18, 0.24, 0.32), "trim": Color(0.56, 0.86, 1.0), "floor_tint": Color(0.78, 0.86, 0.94), "glow": Color(0.46, 0.86, 1.0, 0.22)},
	"nexus": {"bg": Color(0.03, 0.05, 0.07), "wall": Color(0.14, 0.18, 0.24), "trim": Color(0.24, 0.94, 0.96), "floor_tint": Color(0.72, 0.78, 0.84), "glow": Color(0.24, 0.94, 0.96, 0.22)},
}

const ROLE_NPC_TITLE := {
	"smithy": "Mistrz Kowalstwa (Crafting)",
	"shop": "Kupiec Gildii (Sklep i Handel)",
	"depot": "Skarbnik Banku (Depozyt)",
	"inn": "Karczmarz (Odpoczynek)",
	"arena": "Mistrz Areny (Trening)",
	"hall": "Kanclerz Rady (Kronika)",
	"landmark": "Kasztelan Warowni",
}

const ROLE_SERVICE_BTN := {
	"smithy": "⚒ KUŹNIA / CRAFTING",
	"shop": "◆ SKLEP (KUP / SPRZEDAJ)",
	"depot": "◆ BANK / DEPOZYT",
	"inn": "◆ ODPOCZYNEK (100% HP/KI)",
	"arena": "⚔ TRENING BOJOWY",
	"hall": "◆ RADA I KRONIKA",
	"landmark": "◆ KASZTELAN / BŁOGOSŁAWIEŃSTWO",
}

var world: Node2D
var current_land := "pyra"
var building_data: Dictionary = {}
var room_role := "hall"
var room_title := "Wnętrze"

var room_stage := Node2D.new()
var floor_layer := Node2D.new()
var ysort := Node2D.new()
var hero_actor
var npc_actor
var hero_local := Vector2(0.0, 175.0)
var npc_local := Vector2(0.0, -115.0)
var walk_target := Vector2(9999.0, 9999.0)
var colliders: Array[Dictionary] = [] # {"pos": Vector2, "r": float}
var exit_zone := Rect2(-72.0, ROOM_H * 0.5 - 56.0, 144.0, 62.0)

var hud_root := Control.new()
var title_lbl := Label.new()
var btn_exit := Button.new()
var btn_service := Button.new()
var service_panel := PanelContainer.new()
var service_scroll := ScrollContainer.new()
var service_vbox := VBoxContainer.new()
var service_status := Label.new()
var service_open := false
var _opened_ms := 0

# Persistent Bank Vault across visits (15 slots + bank gold)
var bank_items: Array[Dictionary] = []
var bank_gold := 500

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	set_anchors_preset(Control.PRESET_FULL_RECT)
	for _i in 15:
		bank_items.append({})

	var bg_rect := ColorRect.new()
	bg_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg_rect.color = Color(0.03, 0.025, 0.035, 0.96)
	bg_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(bg_rect)

	add_child(room_stage)
	room_stage.add_child(floor_layer)
	ysort.y_sort_enabled = true
	room_stage.add_child(ysort)

	hud_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	hud_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(hud_root)

	_build_hud()
	resized.connect(_layout_stage)
	_layout_stage()

func _style_btn(btn: Button, bg: Color, border: Color, fsz: int = 15) -> void:
	btn.custom_minimum_size.y = maxf(btn.custom_minimum_size.y, 44.0)
	var st := StyleBoxFlat.new()
	st.bg_color = bg
	st.border_color = border
	st.set_border_width_all(2)
	st.set_corner_radius_all(8)
	st.content_margin_left = 14
	st.content_margin_right = 14
	st.content_margin_top = 8
	st.content_margin_bottom = 8
	btn.add_theme_stylebox_override("normal", st)
	var sth := st.duplicate()
	sth.bg_color = bg.lightened(0.14)
	btn.add_theme_stylebox_override("hover", sth)
	btn.add_theme_font_override("font", MapStyle.body_font())
	btn.add_theme_font_size_override("font_size", fsz)
	btn.add_theme_color_override("font_color", Color(1.0, 0.95, 0.84))

func _build_hud() -> void:
	title_lbl.add_theme_font_override("font", MapStyle.font())
	title_lbl.add_theme_font_size_override("font_size", 20)
	title_lbl.add_theme_color_override("font_color", Color(1.0, 0.90, 0.56))
	hud_root.add_child(title_lbl)

	btn_exit.text = "✕ WYJDŹ NA ZEWNĄTRZ"
	_style_btn(btn_exit, Color(0.32, 0.10, 0.10, 0.96), Color(0.98, 0.56, 0.36, 0.98), 15)
	btn_exit.pressed.connect(func() -> void:
		if world != null and world.has_method("exit_building"):
			world.exit_building()
	)
	hud_root.add_child(btn_exit)

	btn_service.text = "◆ USŁUGI"
	_style_btn(btn_service, Color(0.10, 0.26, 0.32, 0.96), Color(0.38, 0.92, 1.0, 0.98), 16)
	btn_service.pressed.connect(func() -> void:
		toggle_service_panel(not service_open)
	)
	hud_root.add_child(btn_service)

	# Interactive Service Panel (Shop / Crafting / Bank / Inn / Arena / Lore)
	var pstyle := StyleBoxFlat.new()
	pstyle.bg_color = Color(0.06, 0.05, 0.08, 0.96)
	pstyle.border_color = Color(0.92, 0.72, 0.34, 0.96)
	pstyle.set_border_width_all(2)
	pstyle.set_corner_radius_all(12)
	pstyle.content_margin_left = 14
	pstyle.content_margin_right = 14
	pstyle.content_margin_top = 12
	pstyle.content_margin_bottom = 12
	service_panel.add_theme_stylebox_override("panel", pstyle)
	service_panel.visible = false
	hud_root.add_child(service_panel)

	var sv := VBoxContainer.new()
	sv.add_theme_constant_override("separation", 8)
	service_panel.add_child(sv)

	var shdr := HBoxContainer.new()
	sv.add_child(shdr)
	var sh_lbl := Label.new()
	sh_lbl.name = "HeaderLbl"
	sh_lbl.text = "USŁUGI BUDYNKU"
	sh_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	sh_lbl.add_theme_font_override("font", MapStyle.font())
	sh_lbl.add_theme_font_size_override("font_size", 16)
	sh_lbl.add_theme_color_override("font_color", Color(1.0, 0.86, 0.46))
	shdr.add_child(sh_lbl)

	var s_close := Button.new()
	s_close.text = "✕"
	_style_btn(s_close, Color(0.30, 0.10, 0.10, 0.95), Color(0.96, 0.54, 0.36, 0.95), 15)
	s_close.custom_minimum_size = Vector2(44, 38)
	s_close.pressed.connect(func() -> void: toggle_service_panel(false))
	shdr.add_child(s_close)

	service_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	service_scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	service_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	sv.add_child(service_scroll)

	service_vbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	service_vbox.add_theme_constant_override("separation", 8)
	service_scroll.add_child(service_vbox)

	service_status.add_theme_font_override("font", MapStyle.body_font())
	service_status.add_theme_font_size_override("font_size", 13)
	service_status.add_theme_color_override("font_color", Color(0.56, 0.96, 0.72))
	sv.add_child(service_status)

func _layout_stage() -> void:
	var vs := get_viewport_rect().size
	if vs.x < 100.0:
		vs = Vector2(1280.0, 720.0)
	room_stage.position = vs * 0.5 + Vector2(0.0, 18.0)
	var sc := minf((vs.x - 40.0) / (ROOM_W + 40.0), (vs.y - 110.0) / (ROOM_H + 40.0))
	sc = clampf(sc, 0.72, 1.35)
	room_stage.scale = Vector2(sc, sc)

	title_lbl.position = Vector2(280.0, 22.0)
	btn_exit.position = Vector2(vs.x - 236.0, 14.0)
	btn_exit.size = Vector2(216.0, 48.0)

	btn_service.position = Vector2((vs.x - 300.0) * 0.5, vs.y - 68.0)
	btn_service.size = Vector2(300.0, 52.0)

	var pw := clampf(vs.x - 160.0, 520.0, 740.0)
	var ph := clampf(vs.y - 130.0, 380.0, 540.0)
	service_panel.position = Vector2((vs.x - pw) * 0.5, (vs.y - ph) * 0.5 + 10.0)
	service_panel.size = Vector2(pw, ph)

func enter_building(land: String, bdata: Dictionary) -> void:
	current_land = land
	building_data = bdata
	room_role = str(bdata.get("role", "hall"))
	if not ROLE_SERVICE_BTN.has(room_role):
		room_role = "landmark"
	room_title = str(bdata.get("title", "Wnętrze Budynku"))
	service_open = false
	service_panel.visible = false
	_opened_ms = Time.get_ticks_msec()

	title_lbl.text = "%s  •  %s" % [room_title.to_upper(), str(ROLE_NPC_TITLE.get(room_role, "Wnętrze"))]
	btn_service.text = str(ROLE_SERVICE_BTN.get(room_role, "💬 USŁUGI"))

	_rebuild_room_scene()
	_layout_stage()
	queue_redraw()

func _add_prop(fname: String, pos: Vector2, w_px: float, col_r: float = 0.0, under_floor: bool = false) -> void:
	if world == null:
		return
	var tex: Texture2D = world.load_tex("res://assets/interiors/%s/%s" % [current_land, fname])
	if tex == null:
		return
	var holder := Node2D.new()
	holder.position = pos
	var sp := Sprite2D.new()
	sp.texture = tex
	var ts := tex.get_size()
	var sc := w_px / maxf(ts.x, 1.0)
	sp.scale = Vector2(sc, sc)
	if not under_floor:
		sp.offset = Vector2(0.0, -ts.y * 0.28)
		if world.has_method("add_contact_shadow"):
			world.add_contact_shadow(holder, w_px * 1.4, 0.34, 6.0)
	holder.add_child(sp)
	if under_floor:
		floor_layer.add_child(holder)
	else:
		ysort.add_child(holder)
	if col_r > 1.0:
		colliders.append({"pos": pos, "r": col_r})

func _rebuild_room_scene() -> void:
	for ch in floor_layer.get_children():
		ch.queue_free()
	for ch in ysort.get_children():
		ch.queue_free()
	colliders.clear()

	# Textured Floor Sprite (biome stone/wood/ice/titanium tile)
	var pal: Dictionary = BIOME_PALETTE.get(current_land, BIOME_PALETTE["pyra"])
	var ftex: Texture2D = world.load_tex("res://regions/%s/mat_2.png" % current_land) if world != null else null
	if ftex == null and world != null:
		ftex = world.load_tex("res://regions/%s/mat_0.png" % current_land)
	if ftex != null:
		var fsp := Sprite2D.new()
		fsp.texture = ftex
		fsp.region_enabled = true
		fsp.region_rect = Rect2(0, 0, ROOM_W, ROOM_H)
		fsp.texture_repeat = CanvasItem.TEXTURE_REPEAT_ENABLED
		fsp.modulate = pal["floor_tint"] as Color
		floor_layer.add_child(fsp)

	# Central Rug (underneath actors!)
	_add_prop("rug.webp", Vector2(0.0, 20.0), 310.0, 0.0, true)

	# Role-Specific Furniture Layout using the 48 biome GPU interior assets
	match room_role:
		"smithy":
			_add_prop("counter.webp", Vector2(0.0, -155.0), 210.0, 48.0)
			_add_prop("firepot.webp", Vector2(-240.0, -130.0), 130.0, 42.0)
			_add_prop("weapons.webp", Vector2(-360.0, -120.0), 120.0, 38.0)
			_add_prop("weapons.webp", Vector2(260.0, -140.0), 120.0, 38.0)
			_add_prop("barrels.webp", Vector2(-370.0, 120.0), 125.0, 42.0)
			_add_prop("crates.webp", Vector2(360.0, 110.0), 135.0, 44.0)
			_add_prop("chest.webp", Vector2(360.0, -120.0), 96.0, 34.0)
			_add_prop("lanterns.webp", Vector2(-140.0, -210.0), 92.0, 0.0)
			_add_prop("lanterns.webp", Vector2(140.0, -210.0), 92.0, 0.0)
		"shop":
			_add_prop("counter.webp", Vector2(0.0, -145.0), 230.0, 50.0)
			_add_prop("potions.webp", Vector2(-260.0, -165.0), 130.0, 42.0)
			_add_prop("potions.webp", Vector2(260.0, -165.0), 130.0, 42.0)
			_add_prop("crates.webp", Vector2(-365.0, 90.0), 135.0, 44.0)
			_add_prop("barrels.webp", Vector2(365.0, 90.0), 125.0, 42.0)
			_add_prop("chest.webp", Vector2(-355.0, -110.0), 98.0, 36.0)
			_add_prop("weapons.webp", Vector2(360.0, -105.0), 115.0, 38.0)
			_add_prop("lanterns.webp", Vector2(0.0, -215.0), 102.0, 0.0)
		"depot":
			_add_prop("counter.webp", Vector2(0.0, -145.0), 220.0, 50.0)
			_add_prop("chest.webp", Vector2(-240.0, -155.0), 106.0, 38.0)
			_add_prop("chest.webp", Vector2(240.0, -155.0), 106.0, 38.0)
			_add_prop("chest.webp", Vector2(-355.0, 20.0), 106.0, 38.0)
			_add_prop("chest.webp", Vector2(355.0, 20.0), 106.0, 38.0)
			_add_prop("bookshelf.webp", Vector2(-360.0, -155.0), 115.0, 40.0)
			_add_prop("bookshelf.webp", Vector2(360.0, -155.0), 115.0, 40.0)
			_add_prop("crates.webp", Vector2(-350.0, 145.0), 130.0, 42.0)
			_add_prop("barrels.webp", Vector2(350.0, 145.0), 120.0, 40.0)
			_add_prop("lanterns.webp", Vector2(0.0, -215.0), 100.0, 0.0)
		"inn":
			_add_prop("counter.webp", Vector2(0.0, -155.0), 220.0, 48.0)
			_add_prop("firepot.webp", Vector2(-245.0, -155.0), 125.0, 40.0)
			_add_prop("table.webp", Vector2(-250.0, 55.0), 175.0, 52.0)
			_add_prop("table.webp", Vector2(250.0, 55.0), 175.0, 52.0)
			_add_prop("bed.webp", Vector2(350.0, -135.0), 138.0, 44.0)
			_add_prop("barrels.webp", Vector2(-365.0, -125.0), 120.0, 40.0)
			_add_prop("lanterns.webp", Vector2(-150.0, -210.0), 92.0, 0.0)
			_add_prop("lanterns.webp", Vector2(150.0, -210.0), 92.0, 0.0)
		"arena":
			_add_prop("weapons.webp", Vector2(-360.0, -145.0), 125.0, 40.0)
			_add_prop("weapons.webp", Vector2(360.0, -145.0), 125.0, 40.0)
			_add_prop("barrels.webp", Vector2(-365.0, 130.0), 120.0, 40.0)
			_add_prop("crates.webp", Vector2(365.0, 130.0), 125.0, 42.0)
			_add_prop("firepot.webp", Vector2(-220.0, -170.0), 115.0, 38.0)
			_add_prop("firepot.webp", Vector2(220.0, -170.0), 115.0, 38.0)
			_add_prop("lanterns.webp", Vector2(0.0, -215.0), 104.0, 0.0)
		_:
			# Citadel / Hall / Stronghold / Sanctuary / Observatory
			_add_prop("bookshelf.webp", Vector2(-280.0, -165.0), 122.0, 42.0)
			_add_prop("bookshelf.webp", Vector2(280.0, -165.0), 122.0, 42.0)
			_add_prop("table.webp", Vector2(0.0, -155.0), 195.0, 48.0)
			_add_prop("weapons.webp", Vector2(-375.0, -20.0), 118.0, 38.0)
			_add_prop("potions.webp", Vector2(375.0, -20.0), 118.0, 38.0)
			_add_prop("chest.webp", Vector2(-355.0, 140.0), 100.0, 36.0)
			_add_prop("chest.webp", Vector2(355.0, 140.0), 100.0, 36.0)
			_add_prop("lanterns.webp", Vector2(-140.0, -215.0), 96.0, 0.0)
			_add_prop("lanterns.webp", Vector2(140.0, -215.0), 96.0, 0.0)

	# Room Service NPC (using real animated NPC sprite from world.actors_db!)
	npc_local = Vector2(0.0, -95.0)
	if world != null and not world.actors_db.is_empty():
		var npc_id := ""
		if not world.npcs_data.is_empty():
			npc_id = str(world.npcs_data[0].get("actor_id", ""))
		if npc_id.is_empty() or not world.actors_db.has(npc_id):
			npc_id = str(world.actors_db.keys()[0])
		npc_actor = ActorScript.new()
		npc_actor.setup(
			world.actors_db[npc_id],
			str(ROLE_NPC_TITLE.get(room_role, "Mistrz")),
			false,
			false,
			"npc",
			0,
			"!",
			room_role.capitalize()
		)
		npc_actor.scale = Vector2(0.68, 0.68)
		npc_actor.position = npc_local
		ysort.add_child(npc_actor)

	# Playable Hero inside the room!
	hero_local = Vector2(0.0, 145.0)
	walk_target = Vector2(9999.0, 9999.0)
	if world != null and world.HERO_ACTORS.has(current_land):
		var hinfo: Array = world.HERO_ACTORS[current_land]
		var hid := str(hinfo[0])
		if world.actors_db.has(hid):
			hero_actor = ActorScript.new()
			hero_actor.setup(world.actors_db[hid], str(hinfo[1]), true, false, "hero", 0, "", "")
			hero_actor.scale = Vector2(0.72, 0.72)
			hero_actor.position = hero_local
			ysort.add_child(hero_actor)

func _process(delta: float) -> void:
	if not visible:
		return
	if service_open:
		return
	var dir := Vector2.ZERO
	if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT):
		dir.x -= 1.0
	if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT):
		dir.x += 1.0
	if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP):
		dir.y -= 1.0
	if Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN):
		dir.y += 1.0
	if world != null and world.move_pointer != -1 and world.motion.length_squared() > 0.01:
		dir = world.motion
	if dir.length_squared() > 0.001:
		walk_target = Vector2(9999.0, 9999.0)
		dir = dir.normalized()
	elif walk_target.x < 9000.0:
		var diff := walk_target - hero_local
		if diff.length() < 8.0:
			walk_target = Vector2(9999.0, 9999.0)
		else:
			dir = diff.normalized()

	var spd_mult: float = float(world.gm_speed_mult) if world != null else 1.0
	if dir.length_squared() > 0.001:
		var step := dir * WALK_SPEED * clampf(spd_mult, 1.0, 3.0) * delta
		var next_p := hero_local + step
		var half_w := ROOM_W * 0.5 - 38.0
		var half_h := ROOM_H * 0.5 - 26.0
		next_p.x = clampf(next_p.x, -half_w, half_w)
		next_p.y = clampf(next_p.y, -half_h + 24.0, half_h)
		var blocked := false
		for col: Dictionary in colliders:
			if next_p.distance_to(col["pos"] as Vector2) < float(col["r"]):
				blocked = true
				break
		if not blocked:
			hero_local = next_p
	if hero_actor != null:
		hero_actor.position = hero_local
		hero_actor.animate(dir, true)
	if npc_actor != null:
		npc_actor.animate(Vector2.ZERO, false)

	# Auto-exit if hero walks onto the glowing bottom doorway after 0.6s inside
	if Time.get_ticks_msec() - _opened_ms > 700 and exit_zone.has_point(hero_local):
		if world != null and world.has_method("exit_building"):
			world.exit_building()

func _gui_input(event: InputEvent) -> void:
	if service_open:
		return
	if event is InputEventMouseButton and (event as InputEventMouseButton).pressed:
		var mb := event as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_LEFT:
			var local_pt: Vector2 = (mb.position - room_stage.position) / maxf(room_stage.scale.x, 0.1)
			if local_pt.distance_to(npc_local) < 62.0:
				toggle_service_panel(true)
			elif absf(local_pt.x) <= ROOM_W * 0.5 and absf(local_pt.y) <= ROOM_H * 0.5:
				walk_target = local_pt
			accept_event()

func _draw() -> void:
	var vs := size
	var pal: Dictionary = BIOME_PALETTE.get(current_land, BIOME_PALETTE["pyra"])
	draw_rect(Rect2(Vector2.ZERO, vs), pal["bg"] as Color, true)

	# Room Architectural Frame & Glowing Exit Threshold
	var sc := room_stage.scale.x
	var c := room_stage.position
	var rw := ROOM_W * sc
	var rh := ROOM_H * sc
	var rrect := Rect2(c - Vector2(rw * 0.5, rh * 0.5), Vector2(rw, rh))
	var wall_col: Color = pal["wall"]
	var trim_col: Color = pal["trim"]

	draw_rect(rrect.grow(16.0 * sc), wall_col, true)
	draw_rect(rrect.grow(16.0 * sc), trim_col, false, 3.0)
	draw_rect(rrect, Color(0.02, 0.02, 0.03, 0.65), false, 3.0)

	# Top wall architectural frieze
	var top_wall := Rect2(rrect.position.x, rrect.position.y - 16.0 * sc, rw, 22.0 * sc)
	draw_rect(top_wall, wall_col.lightened(0.10), true)
	draw_line(Vector2(rrect.position.x, rrect.position.y + 6.0 * sc), Vector2(rrect.end.x, rrect.position.y + 6.0 * sc), trim_col, 2.0)

	# Glowing Golden Exit Doorway Mat at bottom center
	var ex_r := Rect2(c + exit_zone.position * sc, exit_zone.size * sc)
	draw_rect(ex_r, Color(0.98, 0.78, 0.28, 0.24), true)
	draw_rect(ex_r, Color(1.0, 0.86, 0.42, 0.90), false, 2.2)
	var f: Font = MapStyle.font()
	var ex_txt := "WYJŚCIE"
	var ex_w := f.get_string_size(ex_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 13).x
	draw_string(f, Vector2(ex_r.position.x + (ex_r.size.x - ex_w) * 0.5, ex_r.position.y + ex_r.size.y * 0.64), ex_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(1.0, 0.92, 0.64))

func toggle_service_panel(open: bool) -> void:
	service_open = open
	service_panel.visible = open
	if open:
		_refresh_service_ui()

func _refresh_service_ui() -> void:
	for ch in service_vbox.get_children():
		ch.queue_free()
	var hud_ref = world.rpg_hud if world != null else null
	var hdr_lbl := service_panel.find_child("HeaderLbl", true, false) as Label
	if hdr_lbl != null:
		hdr_lbl.text = "%s  —  %s" % [room_title.to_upper(), str(ROLE_NPC_TITLE.get(room_role, "Usługi"))]

	if hud_ref == null:
		return

	var gold_lbl := Label.new()
	gold_lbl.text = "Twoje Złoto: %d szt.  •  HP: %d/%d  •  KI: %d/%d" % [
		int(hud_ref.hero_gold), int(round(hud_ref.hero_hp)), int(round(hud_ref.hero_max_hp)),
		int(round(hud_ref.hero_ki)), int(round(hud_ref.hero_max_ki))
	]
	gold_lbl.add_theme_font_override("font", MapStyle.body_font())
	gold_lbl.add_theme_font_size_override("font_size", 14)
	gold_lbl.add_theme_color_override("font_color", Color(1.0, 0.92, 0.66))
	service_vbox.add_child(gold_lbl)

	if room_role == "shop":
		_build_shop_ui(hud_ref)
	elif room_role == "smithy":
		_build_crafting_ui(hud_ref)
	elif room_role == "depot":
		_build_bank_ui(hud_ref)
	elif room_role == "inn":
		_build_inn_ui(hud_ref)
	elif room_role == "arena":
		_build_arena_ui(hud_ref)
	else:
		_build_hall_ui(hud_ref)

func _build_shop_ui(hud_ref) -> void:
	for it: Dictionary in GmPanelScript.ITEM_CATALOG:
		var price := 120 if str(it["cat"]) == "consumable" else 340
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 10)
		service_vbox.add_child(row)

		var ico := TextureRect.new()
		ico.custom_minimum_size = Vector2(34, 34)
		ico.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		ico.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		ico.texture = world.load_tex("res://assets/ui/icons/" + str(it["icon"]))
		row.add_child(ico)

		var lbl := Label.new()
		lbl.text = "%s  (%s) — %d zł" % [str(it["name"]), str(it["desc"]), price]
		lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		lbl.add_theme_font_override("font", MapStyle.body_font())
		lbl.add_theme_font_size_override("font_size", 13)
		lbl.add_theme_color_override("font_color", it["rarity"] as Color)
		row.add_child(lbl)

		var b_buy := Button.new()
		b_buy.text = "KUP (%d zł)" % price
		_style_btn(b_buy, Color(0.12, 0.28, 0.16, 0.96), Color(0.42, 0.92, 0.56, 0.95), 13)
		var it_c := it.duplicate(true)
		b_buy.pressed.connect(func() -> void:
			if int(hud_ref.hero_gold) < price:
				service_status.text = "Za mało złota! Potrzebujesz %d zł." % price
				return
			if hud_ref.add_item_to_backpack(it_c, 1):
				hud_ref.hero_gold -= price
				hud_ref.recalc_stats()
				service_status.text = "Kupiono: %s (-%d zł)" % [str(it_c["name"]), price]
				_refresh_service_ui()
			else:
				service_status.text = "Plecak jest pełny (15/15)!"
		)
		row.add_child(b_buy)

func _build_crafting_ui(hud_ref) -> void:
	for it: Dictionary in GmPanelScript.ITEM_CATALOG:
		if str(it["cat"]) == "consumable":
			continue
		var cost := 200
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 10)
		service_vbox.add_child(row)

		var ico := TextureRect.new()
		ico.custom_minimum_size = Vector2(34, 34)
		ico.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		ico.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		ico.texture = world.load_tex("res://assets/ui/icons/" + str(it["icon"]))
		row.add_child(ico)

		var lbl := Label.new()
		lbl.text = "Wykuj: %s (%s)" % [str(it["name"]), str(it["desc"])]
		lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		lbl.add_theme_font_override("font", MapStyle.body_font())
		lbl.add_theme_font_size_override("font_size", 13)
		lbl.add_theme_color_override("font_color", it["rarity"] as Color)
		row.add_child(lbl)

		var b_craft := Button.new()
		b_craft.text = "⚒ WYKUJ (%d zł)" % cost
		_style_btn(b_craft, Color(0.28, 0.16, 0.06, 0.96), Color(1.0, 0.72, 0.28, 0.96), 13)
		var it_c := it.duplicate(true)
		b_craft.pressed.connect(func() -> void:
			if int(hud_ref.hero_gold) < cost:
				service_status.text = "Za mało złota na kucie (%d zł)!" % cost
				return
			if hud_ref.add_item_to_backpack(it_c, 1):
				hud_ref.hero_gold -= cost
				hud_ref.recalc_stats()
				service_status.text = "Wykuto w kuźni: %s!" % str(it_c["name"])
				_refresh_service_ui()
			else:
				service_status.text = "Brak miejsca w plecaku!"
		)
		row.add_child(b_craft)

func _build_bank_ui(hud_ref) -> void:
	var g_row := HBoxContainer.new()
	g_row.add_theme_constant_override("separation", 8)
	service_vbox.add_child(g_row)

	var bl := Label.new()
	bl.text = "Złoto w Skarbcu Banku: %d szt." % bank_gold
	bl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	bl.add_theme_font_override("font", MapStyle.body_font())
	bl.add_theme_font_size_override("font_size", 14)
	bl.add_theme_color_override("font_color", Color(1.0, 0.88, 0.44))
	g_row.add_child(bl)

	var b_dep := Button.new()
	b_dep.text = "WPŁAĆ 100 zł"
	_style_btn(b_dep, Color(0.12, 0.26, 0.18, 0.96), Color(0.42, 0.92, 0.56, 0.95), 13)
	b_dep.pressed.connect(func() -> void:
		if int(hud_ref.hero_gold) >= 100:
			hud_ref.hero_gold -= 100
			bank_gold += 100
			hud_ref.recalc_stats()
			service_status.text = "Wpłacono 100 zł do Skarbca Banku."
			_refresh_service_ui()
	)
	g_row.add_child(b_dep)

	var b_wd := Button.new()
	b_wd.text = "WYPŁAĆ 100 zł"
	_style_btn(b_wd, Color(0.24, 0.18, 0.08, 0.96), Color(1.0, 0.82, 0.36, 0.95), 13)
	b_wd.pressed.connect(func() -> void:
		if bank_gold >= 100:
			bank_gold -= 100
			hud_ref.hero_gold += 100
			hud_ref.recalc_stats()
			service_status.text = "Wypłacono 100 zł z Banku."
			_refresh_service_ui()
	)
	g_row.add_child(b_wd)

	var sep1 := Label.new()
	sep1.text = "PRZEDMIOTY W PLECAKU (KLIK: DEPONUJ W BANKU):"
	sep1.add_theme_font_override("font", MapStyle.font())
	sep1.add_theme_font_size_override("font_size", 12)
	sep1.add_theme_color_override("font_color", Color(0.92, 0.80, 0.48))
	service_vbox.add_child(sep1)

	for i in hud_ref.backpack_items.size():
		var it: Dictionary = hud_ref.backpack_items[i]
		if it.is_empty():
			continue
		var btn := Button.new()
		btn.text = "→ Deponuj: %s ×%d" % [str(it.get("name", "Przedmiot")), int(it.get("qty", 1))]
		_style_btn(btn, Color(0.11, 0.14, 0.20, 0.95), Color(0.56, 0.78, 0.96, 0.90), 13)
		var idx: int = int(i)
		btn.pressed.connect(func() -> void:
			for bi in bank_items.size():
				if bank_items[bi].is_empty():
					bank_items[bi] = hud_ref.backpack_items[idx].duplicate(true)
					hud_ref.backpack_items[idx] = {}
					hud_ref.recalc_stats()
					service_status.text = "Zdeponowano w Skarbcu: %s" % str(bank_items[bi].get("name", ""))
					_refresh_service_ui()
					return
			service_status.text = "Skarbiec Banku jest pełny!"
		)
		service_vbox.add_child(btn)

	var sep2 := Label.new()
	sep2.text = "DEPOZYT BANKOWY (KLIK: ODBIERZ DO PLECAKA):"
	sep2.add_theme_font_override("font", MapStyle.font())
	sep2.add_theme_font_size_override("font_size", 12)
	sep2.add_theme_color_override("font_color", Color(0.56, 0.94, 0.72))
	service_vbox.add_child(sep2)

	for bi in bank_items.size():
		var bit: Dictionary = bank_items[bi]
		if bit.is_empty():
			continue
		var btn2 := Button.new()
		btn2.text = "← Odbierz: %s ×%d" % [str(bit.get("name", "Przedmiot")), int(bit.get("qty", 1))]
		_style_btn(btn2, Color(0.12, 0.24, 0.16, 0.95), Color(0.46, 0.94, 0.62, 0.92), 13)
		var bidx: int = int(bi)
		btn2.pressed.connect(func() -> void:
			if hud_ref.add_item_to_backpack(bank_items[bidx], int(bank_items[bidx].get("qty", 1))):
				var nm := str(bank_items[bidx].get("name", ""))
				bank_items[bidx] = {}
				service_status.text = "Odebrano z Banku: %s" % nm
				_refresh_service_ui()
		)
		service_vbox.add_child(btn2)

func _build_inn_ui(hud_ref) -> void:
	var b_rest := Button.new()
	b_rest.text = "🛏 PEŁNY ODPOCZYNEK I POSIŁEK (100% HP i KI — DARMOWE)"
	_style_btn(b_rest, Color(0.12, 0.28, 0.18, 0.96), Color(0.46, 0.96, 0.64, 0.98), 15)
	b_rest.pressed.connect(func() -> void:
		hud_ref.hero_hp = hud_ref.hero_max_hp
		hud_ref.hero_ki = hud_ref.hero_max_ki
		hud_ref.recalc_stats()
		service_status.text = "Wypoczęto w gospodzie! Przywrócono 100% HP i 100% KI."
		_refresh_service_ui()
	)
	service_vbox.add_child(b_rest)

func _build_arena_ui(hud_ref) -> void:
	var b_tr := Button.new()
	b_tr.text = "⚔ ODBĄDŹ TRENING BOJOWY (+60 PD i ODNOWIENIE UMIEJĘTNOŚCI)"
	_style_btn(b_tr, Color(0.28, 0.14, 0.08, 0.96), Color(1.0, 0.62, 0.28, 0.98), 15)
	b_tr.pressed.connect(func() -> void:
		hud_ref.hero_xp += 60.0
		if hud_ref.hero_xp >= hud_ref.hero_max_xp:
			hud_ref.hero_xp -= hud_ref.hero_max_xp
			hud_ref.hero_level += 1
			hud_ref.free_stat_points += 3
			hud_ref.skill_points += 1
		for i in hud_ref.cooldowns.size():
			hud_ref.cooldowns[i] = 0.0
		hud_ref.recalc_stats(true)
		service_status.text = "Trening zakończony! +60 PD oraz zresetowane czasy odnowienia."
		_refresh_service_ui()
	)
	service_vbox.add_child(b_tr)

func _build_hall_ui(hud_ref) -> void:
	var lore := Label.new()
	lore.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	lore.text = "Witaj w %s. Wewnątrz tej budowli możesz bezpiecznie planować wyprawy na całym kontynencie %s, pobierać błogosławieństwo energii Ki oraz zarządzać swoim rozwojem." % [room_title, current_land.capitalize()]
	lore.add_theme_font_override("font", MapStyle.body_font())
	lore.add_theme_font_size_override("font_size", 14)
	lore.add_theme_color_override("font_color", Color(0.92, 0.88, 0.80))
	service_vbox.add_child(lore)

	var b_bl := Button.new()
	b_bl.text = "✦ PRZYJMIJ BŁOGOSŁAWIEŃSTWO KI (100% HP/KI + 1 PKT STATYSTYK)"
	_style_btn(b_bl, Color(0.14, 0.24, 0.34, 0.96), Color(0.46, 0.90, 1.0, 0.98), 14)
	b_bl.pressed.connect(func() -> void:
		hud_ref.free_stat_points += 1
		hud_ref.recalc_stats(true)
		service_status.text = "Przyjęto błogosławieństwo! +1 wolny punkt statystyk i pełne HP/KI."
		_refresh_service_ui()
	)
	service_vbox.add_child(b_bl)
