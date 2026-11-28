extends Control
## Walkable, Y-Sorted Painted Building Interiors for ALL 59 Enterable Buildings across all 4 Continents.
## Uses the 48 biome-painted GPU interior props (assets/interiors/{pyra,verdant,aether,nexus}/*.webp),
## live animated Hero & Service NPCs, wall/furniture collision, exit doorway, and interactive services:
## Shop (Buy/Sell), Smithy (Crafting), Depot (Bank Vault), Inn (Full Rest), Arena (Training), Hall/Citadel (Lore).

const ActorScript := preload("res://scripts/actor_view.gd")
const MapStyle := preload("res://scripts/map_style.gd")
const ForgedUI := preload("res://scripts/forged_ui.gd")
const GmPanelScript := preload("res://scripts/gm_panel.gd")

const ROOM_W := 960.0
const ROOM_H := 600.0
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

const ROLE_NPC_TAG := {
	"smithy": "Kowal",
	"shop": "Kupiec",
	"depot": "Skarbnik",
	"inn": "Karczmarz",
	"arena": "Mistrz Areny",
	"hall": "Rada Miasta",
	"landmark": "Kasztelan",
}

const ROLE_SERVICE_BTN := {
	"smithy": "⚒ KUŹNIA / CRAFTING",
	"shop": "◆ SKLEP (KUP / SPRZEDAJ)",
	"depot": "◆ BANK / DEPOZYT (24)",
	"inn": "◆ ODPOCZYNEK (100% HP/KI)",
	"arena": "⚔ TRENING W MIEŚCIE (0 PD)",
	"hall": "✦ SANKTUARIUM I TRENING KI",
	"landmark": "✦ KASZTELAN I BŁOGOSŁAWIEŃSTWA",
}

var world: Node2D
var current_land := "pyra"
var building_data: Dictionary = {}
var room_role := "hall"
var room_title := "Wnętrze"
var painted_specs: Dictionary = {}

var room_stage := Node2D.new()
var floor_layer := Node2D.new()
var ysort := Node2D.new()
var hero_actor
var npc_actor
var hero_local := Vector2(0.0, 215.0)
var npc_local := Vector2(0.0, 60.0)
var walk_target := Vector2(9999.0, 9999.0)
var colliders: Array[Dictionary] = [] # {"pos": Vector2, "r": float}
var block_rects: Array[Rect2] = []
var room_wall_y := -40.0
var exit_zone := Rect2(-72.0, ROOM_H * 0.5 - 52.0, 144.0, 56.0)

var hud_root := Control.new()
var bg_rect := ColorRect.new()
var top_bar := PanelContainer.new()
var title_lbl := Label.new()
var btn_exit := Button.new()
var btn_service := Button.new()
var service_scrim := ColorRect.new()
var service_panel := Panel.new()
var service_hdr_lbl := Label.new()
var service_scroll := ScrollContainer.new()
var service_vbox := VBoxContainer.new()
var service_status := Label.new()
var service_open := false
var _opened_ms := 0

# Interactive Ki Rhythm & Focus City Training Drill (3-strike timing bar + live hero animations!)
var drill_active := false
var drill_stat := ""
var drill_title := ""
var drill_gain := ""
var drill_phase := 0.15
var drill_dir := 1.0
var drill_speed := 1.55
var drill_step := 0
var drill_perfects := 0
var drill_hits: Array[int] = [0, 0, 0] # 0=pending, 1=ok, 2=good, 3=perfect
var drill_feedback := ""
var drill_canvas: Control = null
var drill_strike_btn: Button = null
var drill_info_lbl: Label = null
var drill_dojo_trial_id := ""

# Stage 4: 3-Tab Smithy state (Crafting 265 recipes | Enhance +1..+9 | Heritage Weapons I..VI)
var smithy_tab := "craft"
var smithy_filter := "all"

# Persistent Bank Vault across visits (24 slots + bank gold, matching server BANK_SIZE = 24)
const BANK_SLOTS := 24
var bank_items: Array[Dictionary] = []
var bank_gold := 0

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	set_anchors_preset(Control.PRESET_FULL_RECT)
	bank_items.clear()
	for _i in BANK_SLOTS:
		bank_items.append({})
	if FileAccess.file_exists("res://data/painted_rooms.json"):
		var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://data/painted_rooms.json"))
		if parsed is Dictionary:
			painted_specs = parsed

	bg_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg_rect.color = Color(0.03, 0.022, 0.028, 1.0)
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

func _style_btn(btn: Button, bg: Color, border: Color, fsz: int = 18) -> void:
	btn.custom_minimum_size.x = maxf(btn.custom_minimum_size.x, 196.0)
	btn.custom_minimum_size.y = maxf(btn.custom_minimum_size.y, 52.0)
	var variant := "slate"
	if bg.r > bg.b + 0.14 and bg.g < 0.14:
		variant = "crimson"
	elif border.r > 0.85 and border.g > 0.65:
		variant = "gold"
	elif bg.g > bg.r + 0.08:
		variant = "gold"
	ForgedUI.style_button(btn, variant, maxi(fsz, 17), 20.0, 9.0)

func _make_row_card(accent_border: Color = Color(0.68, 0.54, 0.28, 0.72)) -> HBoxContainer:
	var card := PanelContainer.new()
	card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	card.add_theme_stylebox_override("panel", ForgedUI.inset_card(accent_border, Color(0.06, 0.055, 0.09, 0.94), 14, 10))
	service_vbox.add_child(card)
	var row := HBoxContainer.new()
	row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 14)
	card.add_child(row)
	return row

func _build_hud() -> void:
	# Clean floating top-left Exit + Title strip over the fullscreen interior (no bulky windowed chrome!)
	top_bar.add_theme_stylebox_override("panel", ForgedUI.compact_panel_box(16.0, 8.0, Color(0.86, 0.68, 0.34, 0.90)))
	hud_root.add_child(top_bar)
	var top_h := HBoxContainer.new()
	top_h.add_theme_constant_override("separation", 18)
	top_bar.add_child(top_h)

	btn_exit.text = "← WYJDŹ"
	btn_exit.custom_minimum_size = Vector2(188.0, 56.0)
	ForgedUI.style_button(btn_exit, "slate", 21, 24.0, 10.0)
	btn_exit.pressed.connect(func() -> void:
		if world != null and world.has_method("exit_building"):
			world.exit_building()
	)
	top_h.add_child(btn_exit)

	title_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title_lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	title_lbl.add_theme_font_override("font", MapStyle.font())
	title_lbl.add_theme_font_size_override("font_size", 24)
	title_lbl.add_theme_color_override("font_color", Color(1.0, 0.92, 0.60))
	title_lbl.add_theme_color_override("font_outline_color", Color(0.03, 0.02, 0.01, 0.98))
	title_lbl.add_theme_constant_override("outline_size", 5)
	top_h.add_child(title_lbl)

	btn_service.text = "◆ USŁUGI"
	ForgedUI.style_button(btn_service, "gold", 22, 28.0, 12.0)
	btn_service.pressed.connect(func() -> void:
		toggle_service_panel(not service_open)
	)
	hud_root.add_child(btn_service)

	# Dark scrim + full-width Forged Obsidian & Gold Service Modal (big readable mobile fonts)
	service_scrim.set_anchors_preset(Control.PRESET_FULL_RECT)
	service_scrim.color = Color(0.015, 0.012, 0.025, 0.86)
	service_scrim.mouse_filter = Control.MOUSE_FILTER_STOP
	service_scrim.visible = false
	hud_root.add_child(service_scrim)

	service_panel.add_theme_stylebox_override("panel", ForgedUI.panel_box(34.0, 28.0))
	service_panel.visible = false
	hud_root.add_child(service_panel)

	var mg := MarginContainer.new()
	mg.set_anchors_preset(Control.PRESET_FULL_RECT)
	mg.add_theme_constant_override("margin_left", 36)
	mg.add_theme_constant_override("margin_right", 36)
	mg.add_theme_constant_override("margin_top", 26)
	mg.add_theme_constant_override("margin_bottom", 24)
	service_panel.add_child(mg)

	var sv := VBoxContainer.new()
	sv.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	sv.size_flags_vertical = Control.SIZE_EXPAND_FILL
	sv.add_theme_constant_override("separation", 12)
	mg.add_child(sv)

	var shdr := HBoxContainer.new()
	shdr.add_theme_constant_override("separation", 18)
	sv.add_child(shdr)

	var s_close := Button.new()
	s_close.text = "← WSTECZ"
	s_close.custom_minimum_size = Vector2(196.0, 58.0)
	ForgedUI.style_button(s_close, "slate", 21, 24.0, 10.0)
	s_close.pressed.connect(func() -> void: toggle_service_panel(false))
	shdr.add_child(s_close)

	service_hdr_lbl.name = "HeaderLbl"
	service_hdr_lbl.text = "USŁUGI BUDYNKU"
	service_hdr_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	service_hdr_lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	service_hdr_lbl.add_theme_font_override("font", MapStyle.font())
	service_hdr_lbl.add_theme_font_size_override("font_size", 27)
	service_hdr_lbl.add_theme_color_override("font_color", Color(1.0, 0.92, 0.58))
	service_hdr_lbl.add_theme_color_override("font_outline_color", Color(0.03, 0.02, 0.01, 0.98))
	service_hdr_lbl.add_theme_constant_override("outline_size", 5)
	shdr.add_child(service_hdr_lbl)

	service_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	service_scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	service_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	sv.add_child(service_scroll)

	service_vbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	service_vbox.add_theme_constant_override("separation", 10)
	service_scroll.add_child(service_vbox)

	service_status.add_theme_font_override("font", MapStyle.body_font())
	service_status.add_theme_font_size_override("font_size", 19)
	service_status.add_theme_color_override("font_color", Color(0.56, 0.98, 0.74))
	service_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	sv.add_child(service_status)

func _layout_stage() -> void:
	var vs := get_viewport_rect().size
	if vs.x < 100.0:
		vs = Vector2(1280.0, 720.0)
	# TRUE FULLSCREEN EDGE-TO-EDGE ROOM: fills 100% of viewport width & height (zero black borders!)
	room_stage.position = vs * 0.5
	var sx := vs.x / ROOM_W
	var sy := vs.y / ROOM_H
	room_stage.scale = Vector2(sx, sy)
	# Counter-scale actors horizontally so sprites stay crisp 1:1 aspect ratio on ultrawide 20:9 phones
	var aspect_fix := sy / maxf(sx, 0.01)
	if hero_actor != null and is_instance_valid(hero_actor):
		hero_actor.scale = Vector2(0.76 * aspect_fix, 0.76)
	if npc_actor != null and is_instance_valid(npc_actor):
		npc_actor.scale = Vector2(0.72 * aspect_fix, 0.72)

	top_bar.position = Vector2(14.0, 10.0)
	top_bar.size = Vector2(minf(vs.x - 28.0, 820.0), 72.0)

	var srv_w := clampf(vs.x * 0.36, 400.0, 500.0)
	btn_service.position = Vector2((vs.x - srv_w) * 0.5, vs.y - 80.0)
	btn_service.size = Vector2(srv_w, 66.0)

	var pw := clampf(vs.x - 28.0, 720.0, 1520.0)
	var ph := clampf(vs.y - 24.0, 500.0, 696.0)
	service_panel.position = Vector2((vs.x - pw) * 0.5, (vs.y - ph) * 0.5)
	service_panel.size = Vector2(pw, ph)

func enter_building(land: String, bdata: Dictionary) -> void:
	current_land = land
	building_data = bdata
	room_role = str(bdata.get("role", "hall"))
	if not ROLE_SERVICE_BTN.has(room_role):
		room_role = "landmark"
	room_title = str(bdata.get("title", "Wnętrze Budynku"))
	service_open = false
	service_scrim.visible = false
	service_panel.visible = false
	_opened_ms = Time.get_ticks_msec()

	title_lbl.text = "%s  •  %s" % [room_title.to_upper(), str(ROLE_NPC_TITLE.get(room_role, "Wnętrze"))]
	btn_service.text = str(ROLE_SERVICE_BTN.get(room_role, "◆ USŁUGI"))

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

func _spec_pt(nx: float, ny: float) -> Vector2:
	return Vector2((nx / 1000.0 - 0.5) * ROOM_W, (ny / 1000.0 - 0.5) * ROOM_H)

func _pick_interior_npc_actor_id() -> String:
	if world == null or world.actors_db.is_empty():
		return ""
	var prefs: Dictionary = {
		"shop": ["merchant", "alchemist", "keeper"],
		"smithy": ["blacksmith", "smith", "warden", "alchemist"],
		"depot": ["keeper", "merchant", "elder"],
		"inn": ["innkeeper", "alchemist", "keeper", "elder"],
		"arena": ["hunter", "warden", "champion"],
		"hall": ["elder", "keeper", "warden"],
		"landmark": ["warden", "keeper", "elder"],
	}
	var suffixes: Array = prefs.get(room_role, ["keeper", "warden"])
	for suf in suffixes:
		var cand := "%s.npc.%s" % [current_land, str(suf)]
		if world.actors_db.has(cand):
			return cand
	if not world.npcs_data.is_empty():
		var idx: int = absi(room_role.hash()) % maxi(1, int(world.npcs_data.size()))
		var nid := str(world.npcs_data[idx].get("actor_id", ""))
		if world.actors_db.has(nid):
			return nid
	return str(world.actors_db.keys()[0])

func _rebuild_room_scene() -> void:
	for ch in floor_layer.get_children():
		ch.queue_free()
	for ch in ysort.get_children():
		ch.queue_free()
	colliders.clear()
	block_rects.clear()

	# Use the exact 24 browser-game studio-painted special building interiors!
	var painted_role := room_role if room_role in ["hall", "shop", "arena", "depot", "smithy", "inn"] else "hall"
	var ptex: Texture2D = world.load_tex("res://assets/interiors/painted/%s-%s.webp" % [current_land, painted_role]) if world != null else null
	var spec: Dictionary = {}
	if painted_specs.has(current_land) and (painted_specs[current_land] as Dictionary).has(painted_role):
		spec = (painted_specs[current_land] as Dictionary)[painted_role]

	if ptex != null:
		var psp := Sprite2D.new()
		psp.texture = ptex
		var ts := ptex.get_size()
		psp.scale = Vector2(ROOM_W / maxf(ts.x, 1.0), ROOM_H / maxf(ts.y, 1.0))
		floor_layer.add_child(psp)
		room_wall_y = _spec_pt(500.0, float(spec.get("wallY", 440.0))).y
		for br: Array in spec.get("blocks", []):
			if br.size() >= 4:
				var p0 := _spec_pt(float(br[0]), float(br[1]))
				var p1 := _spec_pt(float(br[2]), float(br[3]))
				block_rects.append(Rect2(p0, p1 - p0))
		var npc_arr: Array = spec.get("npc", [500.0, 680.0])
		npc_local = _spec_pt(float(npc_arr[0]), float(npc_arr[1])) if npc_arr.size() >= 2 else Vector2(0.0, 40.0)
	else:
		room_wall_y = -ROOM_H * 0.5 + 32.0
		var pal: Dictionary = BIOME_PALETTE.get(current_land, BIOME_PALETTE["pyra"])
		var ftex: Texture2D = world.load_tex("res://regions/%s/mat_2.png" % current_land) if world != null else null
		if ftex != null:
			var fsp := Sprite2D.new()
			fsp.texture = ftex
			fsp.region_enabled = true
			fsp.region_rect = Rect2(0, 0, ROOM_W, ROOM_H)
			fsp.texture_repeat = CanvasItem.TEXTURE_REPEAT_ENABLED
			fsp.modulate = pal["floor_tint"] as Color
			floor_layer.add_child(fsp)
		npc_local = Vector2(0.0, -45.0)

	# Glowing Golden Exit Threshold Mat right on the fullscreen floor
	var ex_mat := Node2D.new()
	ex_mat.draw.connect(func() -> void:
		ex_mat.draw_rect(exit_zone, Color(0.98, 0.78, 0.28, 0.22), true)
		ex_mat.draw_rect(exit_zone, Color(1.0, 0.86, 0.42, 0.90), false, 2.4)
		var f: Font = MapStyle.font()
		var ex_txt := "WYJŚCIE"
		var ex_w := f.get_string_size(ex_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 15).x
		ex_mat.draw_string_outline(f, Vector2(exit_zone.position.x + (exit_zone.size.x - ex_w) * 0.5, exit_zone.position.y + exit_zone.size.y * 0.64), ex_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 15, 4, Color(0.02, 0.01, 0.01, 0.96))
		ex_mat.draw_string(f, Vector2(exit_zone.position.x + (exit_zone.size.x - ex_w) * 0.5, exit_zone.position.y + exit_zone.size.y * 0.64), ex_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 15, Color(1.0, 0.94, 0.68))
	)
	floor_layer.add_child(ex_mat)

	# Room Service NPC (distinct biome sprite per role + Polish role tag!)
	if world != null and not world.actors_db.is_empty():
		var npc_id := _pick_interior_npc_actor_id()
		if not npc_id.is_empty() and world.actors_db.has(npc_id):
			npc_actor = ActorScript.new()
			npc_actor.setup(
				world.actors_db[npc_id],
				str(ROLE_NPC_TITLE.get(room_role, "Mistrz")),
				false,
				false,
				"npc",
				0,
				"!",
				str(ROLE_NPC_TAG.get(room_role, "Opiekun"))
			)
			npc_actor.scale = Vector2(0.68, 0.68)
			npc_actor.position = npc_local
			ysort.add_child(npc_actor)

	# Playable Hero inside the painted browser room — ALWAYS uses hero_race_land (never morphs race on foreign continents!)
	hero_local = _spec_pt(500.0, 845.0)
	walk_target = Vector2(9999.0, 9999.0)
	var hero_land := str(world.hero_race_land) if (world != null and not str(world.hero_race_land).is_empty()) else current_land
	if world != null and world.HERO_ACTORS.has(hero_land):
		var hinfo: Array = world.HERO_ACTORS[hero_land]
		var use_gm: bool = bool(world.gm_form_active) and bool(world.can_use_gm()) and bool(world.actors_db.has("gm.hero"))
		var hid := "gm.hero" if use_gm else str(hinfo[0])
		var hname := str(world.rpg_hud.hero_name) if (world.rpg_hud != null and not str(world.rpg_hud.hero_name).is_empty()) else str(hinfo[1])
		if use_gm:
			hname = "✦ [GM] %s" % hname
		if world.actors_db.has(hid):
			hero_actor = ActorScript.new()
			hero_actor.setup(world.actors_db[hid], hname, true, use_gm, "hero", 0, "", "")
			hero_actor.scale = Vector2(0.72, 0.72)
			hero_actor.position = hero_local
			ysort.add_child(hero_actor)

func _is_blocked(pt: Vector2) -> bool:
	for col: Dictionary in colliders:
		if pt.distance_to(col["pos"] as Vector2) < float(col["r"]):
			return true
	for r: Rect2 in block_rects:
		if r.grow(10.0).has_point(pt):
			return true
	return false

func _process(delta: float) -> void:
	if not visible:
		return
	if service_open:
		if drill_active:
			drill_phase += drill_dir * drill_speed * delta
			if drill_phase >= 1.0:
				drill_phase = 1.0
				drill_dir = -1.0
			elif drill_phase <= 0.0:
				drill_phase = 0.0
				drill_dir = 1.0
			if drill_canvas != null and is_instance_valid(drill_canvas):
				drill_canvas.queue_redraw()
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
		var half_w := ROOM_W * 0.5 - 38.0
		var half_h := ROOM_H * 0.5 - 18.0
		for cand: Vector2 in [hero_local + step, Vector2(hero_local.x + step.x, hero_local.y), Vector2(hero_local.x, hero_local.y + step.y)]:
			cand.x = clampf(cand.x, -half_w, half_w)
			cand.y = clampf(cand.y, room_wall_y, half_h)
			if not _is_blocked(cand):
				hero_local = cand
				break
	if hero_actor != null:
		hero_actor.position = hero_local
		hero_actor.animate(dir, true)
	if npc_actor != null:
		npc_actor.animate(Vector2.ZERO, false)

	var dlg_open: bool = world != null and world.dialogue_strip != null and bool(world.dialogue_strip.is_open)
	btn_service.visible = not dlg_open and not service_open
	if dlg_open and hero_local.distance_to(npc_local) > 295.0:
		world.dialogue_strip.close_dialogue(true)

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
			var local_pt := Vector2(
				(mb.position.x - room_stage.position.x) / maxf(room_stage.scale.x, 0.1),
				(mb.position.y - room_stage.position.y) / maxf(room_stage.scale.y, 0.1)
			)
			if local_pt.distance_to(npc_local) < 82.0:
				if world != null and world.has_method("open_interior_dialogue"):
					world.open_interior_dialogue(
						str(ROLE_NPC_TITLE.get(room_role, "Opiekun")),
						room_title,
						room_role,
						npc_actor,
						func() -> void: toggle_service_panel(true)
					)
				else:
					toggle_service_panel(true)
			elif absf(local_pt.x) <= ROOM_W * 0.5 and absf(local_pt.y) <= ROOM_H * 0.5:
				walk_target = local_pt
			accept_event()

func _draw() -> void:
	var vs := size
	var pal: Dictionary = BIOME_PALETTE.get(current_land, BIOME_PALETTE["pyra"])
	draw_rect(Rect2(Vector2.ZERO, vs), pal["bg"] as Color, true)

func toggle_service_panel(open: bool) -> void:
	service_open = open
	service_scrim.visible = open
	service_panel.visible = open
	btn_service.visible = not open
	if not open:
		drill_active = false
		drill_canvas = null
		drill_strike_btn = null
		drill_info_lbl = null
	else:
		_refresh_service_ui()

func _refresh_service_ui() -> void:
	drill_canvas = null
	drill_strike_btn = null
	drill_info_lbl = null
	for ch in service_vbox.get_children():
		service_vbox.remove_child(ch)
		ch.queue_free()
	var hud_ref = world.rpg_hud if world != null else null
	var hdr_lbl := service_panel.find_child("HeaderLbl", true, false) as Label
	if hdr_lbl != null:
		hdr_lbl.text = "%s  —  %s" % [room_title.to_upper(), str(ROLE_NPC_TITLE.get(room_role, "Usługi"))]

	if hud_ref == null:
		return

	var gold_lbl := Label.new()
	gold_lbl.text = "Złoto: %d szt.   •   HP: %d/%d   •   KI: %d/%d" % [
		int(hud_ref.hero_gold), int(round(hud_ref.hero_hp)), int(round(hud_ref.hero_max_hp)),
		int(round(hud_ref.hero_ki)), int(round(hud_ref.hero_max_ki))
	]
	gold_lbl.add_theme_font_override("font", MapStyle.body_font())
	gold_lbl.add_theme_font_size_override("font_size", 20)
	gold_lbl.add_theme_color_override("font_color", Color(1.0, 0.93, 0.66))
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

func apply_server_bank(st: Dictionary) -> void:
	bank_gold = maxi(0, int(st.get("bankGold", bank_gold)))
	if bank_items.size() != BANK_SLOTS:
		bank_items.clear()
		for _i in BANK_SLOTS:
			bank_items.append({})
	var bi_raw: Array = st.get("bankItems", [])
	for i in BANK_SLOTS:
		if i >= bi_raw.size() or bi_raw[i] == null or not (bi_raw[i] is Dictionary):
			bank_items[i] = {}
		else:
			var entry: Dictionary = bi_raw[i] as Dictionary
			var iid := str(entry.get("id", ""))
			var found := GmPanelScript.find_item(iid)
			if not found.is_empty():
				found["qty"] = maxi(1, int(entry.get("qty", 1)))
			bank_items[i] = found
	if service_open:
		_refresh_service_ui()

func _srv_act(payload: Dictionary) -> bool:
	if world != null and world.has_method("dispatch_server_action"):
		return world.dispatch_server_action(payload, func(res: Dictionary) -> void:
			if payload.get("type") == "inn_rest" and bool(res.get("ok", false)):
				world.notify_hero_healed()
			service_status.text = str(res.get("notice", ""))
			_refresh_service_ui()
		)
	return false

func _section_hdr(txt: String, col: Color = Color(0.98, 0.85, 0.48)) -> Label:
	var l := Label.new()
	l.text = txt
	l.add_theme_font_override("font", MapStyle.font())
	l.add_theme_font_size_override("font_size", 20)
	l.add_theme_color_override("font_color", col)
	return l

func _count_item_in_backpack(hud_ref, iid: String) -> int:
	var total := 0
	for it: Dictionary in hud_ref.backpack_items:
		if not it.is_empty() and str(it.get("id", "")) == iid:
			total += maxi(1, int(it.get("qty", 1)))
	return total

func _consume_item_from_backpack(hud_ref, iid: String, qty: int) -> bool:
	if _count_item_in_backpack(hud_ref, iid) < qty:
		return false
	var rem := qty
	for i in hud_ref.backpack_items.size():
		var it: Dictionary = hud_ref.backpack_items[i]
		if it.is_empty() or str(it.get("id", "")) != iid:
			continue
		var have := maxi(1, int(it.get("qty", 1)))
		if have <= rem:
			rem -= have
			hud_ref.backpack_items[i] = {}
		else:
			it["qty"] = have - rem
			hud_ref.backpack_items[i] = it
			rem = 0
		if rem <= 0:
			break
	return rem <= 0

func _build_shop_ui(hud_ref) -> void:
	var note := Label.new()
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	note.text = "Sklep oferuje mikstury oraz podstawowy ekwipunek Tier 1 (Poz. 1–2). Wyższe tiery wykuwasz w Kuźni z surowców i trofeów!"
	note.add_theme_font_override("font", MapStyle.body_font())
	note.add_theme_font_size_override("font_size", 17)
	note.add_theme_color_override("font_color", Color(0.88, 0.85, 0.78))
	service_vbox.add_child(note)

	service_vbox.add_child(_section_hdr("KUP W SKLEPIE (MIKSTURY I SPRZĘT):"))
	for it: Dictionary in GmPanelScript.get_catalog():
		var sp_raw: Variant = it.get("shopPrice", null)
		if sp_raw == null:
			continue
		var price := int(sp_raw)
		if price <= 0:
			continue
		var row := _make_row_card(Color(0.76, 0.60, 0.30, 0.75))

		var ico := TextureRect.new()
		ico.custom_minimum_size = Vector2(52, 52)
		ico.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		ico.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		ico.texture = world.load_tex("res://assets/ui/icons/" + str(it["icon"]))
		row.add_child(ico)

		var min_lv := int(it.get("minLevel", 1))
		var info_v := VBoxContainer.new()
		info_v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		info_v.add_theme_constant_override("separation", 3)
		row.add_child(info_v)

		var lbl := Label.new()
		lbl.text = "%s  [Poz.%d]  —  %d zł" % [str(it["name"]), min_lv, price]
		lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		lbl.add_theme_font_override("font", MapStyle.body_font())
		lbl.add_theme_font_size_override("font_size", 20)
		lbl.add_theme_color_override("font_color", it["rarity"] as Color)
		info_v.add_child(lbl)

		var d_lbl := Label.new()
		d_lbl.text = str(it.get("desc", ""))
		d_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		d_lbl.add_theme_font_override("font", MapStyle.body_font())
		d_lbl.add_theme_font_size_override("font_size", 17)
		d_lbl.add_theme_color_override("font_color", Color(0.84, 0.86, 0.90))
		info_v.add_child(d_lbl)

		var b_buy := Button.new()
		b_buy.text = "KUP (%d zł)" % price
		b_buy.custom_minimum_size = Vector2(210.0, 54.0)
		_style_btn(b_buy, Color(0.12, 0.28, 0.16, 0.96), Color(0.42, 0.92, 0.56, 0.95), 19)
		var it_c := it.duplicate(true)
		b_buy.pressed.connect(func() -> void:
			if _srv_act({"type": "shop_buy", "itemId": str(it_c["id"])}):
				return
			if int(hud_ref.hero_gold) < price:
				service_status.text = "Za mało złota! Potrzebujesz %d zł." % price
				return
			if hud_ref.add_item_to_backpack(it_c, 1):
				hud_ref.hero_gold -= price
				hud_ref.recalc_stats()
				service_status.text = "Kupiono: %s (-%d zł)" % [str(it_c["name"]), price]
				_refresh_service_ui()
			else:
				service_status.text = "Plecak jest pełny (24/24)!"
		)
		row.add_child(b_buy)

	service_vbox.add_child(_section_hdr("SPRZEDAJ PRZEDMIOTY Z PLECAKA:", Color(0.56, 0.96, 0.72)))
	var sell_any := false
	for i in hud_ref.backpack_items.size():
		var bag_it: Dictionary = hud_ref.backpack_items[i]
		if bag_it.is_empty():
			continue
		var iid := str(bag_it.get("id", ""))
		var def := GmPanelScript.find_item(iid)
		var unit_sell := int(def.get("sellPrice", bag_it.get("sellPrice", 0)))
		if unit_sell <= 0:
			continue
		sell_any = true
		var qty := maxi(1, int(bag_it.get("qty", 1)))
		var row := _make_row_card(Color(0.42, 0.72, 0.54, 0.68))

		var ico := TextureRect.new()
		ico.custom_minimum_size = Vector2(46, 46)
		ico.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		ico.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		ico.texture = world.load_tex("res://assets/ui/icons/" + str(bag_it.get("icon", "gear-coin.webp")))
		row.add_child(ico)

		var lbl := Label.new()
		lbl.text = "%s ×%d  (+%d zł/szt.)" % [str(bag_it.get("name", iid)), qty, unit_sell]
		lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		lbl.add_theme_font_override("font", MapStyle.body_font())
		lbl.add_theme_font_size_override("font_size", 19)
		var rcol: Color = bag_it.get("rarity", Color(0.9, 0.9, 0.9)) as Color
		lbl.add_theme_color_override("font_color", rcol)
		row.add_child(lbl)

		var slot_idx: int = int(i)
		var b_sell1 := Button.new()
		b_sell1.text = "SPRZEDAJ 1 (+%d zł)" % unit_sell
		b_sell1.custom_minimum_size = Vector2(228.0, 52.0)
		_style_btn(b_sell1, Color(0.24, 0.16, 0.08, 0.96), Color(0.96, 0.78, 0.34, 0.95), 18)
		b_sell1.pressed.connect(func() -> void:
			if _srv_act({"type": "shop_sell", "slotIndex": slot_idx}):
				return
			var cur: Dictionary = hud_ref.backpack_items[slot_idx]
			if cur.is_empty():
				return
			var cur_q := maxi(1, int(cur.get("qty", 1)))
			if cur_q <= 1:
				hud_ref.backpack_items[slot_idx] = {}
			else:
				cur["qty"] = cur_q - 1
				hud_ref.backpack_items[slot_idx] = cur
			hud_ref.hero_gold += unit_sell
			hud_ref.recalc_stats()
			service_status.text = "Sprzedano: %s (+%d zł)" % [str(cur.get("name", "")), unit_sell]
			_refresh_service_ui()
		)
		row.add_child(b_sell1)

		if qty > 1:
			var b_sell_all := Button.new()
			b_sell_all.text = "×%d (+%d zł)" % [qty, unit_sell * qty]
			b_sell_all.custom_minimum_size = Vector2(168.0, 52.0)
			ForgedUI.style_button(b_sell_all, "crimson", 18, 16.0, 8.0)
			b_sell_all.pressed.connect(func() -> void:
				if _srv_act({"type": "shop_sell", "slotIndex": slot_idx, "sellAll": true}):
					return
				var cur: Dictionary = hud_ref.backpack_items[slot_idx]
				if cur.is_empty():
					return
				var cur_q := maxi(1, int(cur.get("qty", 1)))
				hud_ref.backpack_items[slot_idx] = {}
				hud_ref.hero_gold += unit_sell * cur_q
				hud_ref.recalc_stats()
				service_status.text = "Sprzedano: %s ×%d (+%d zł)" % [str(cur.get("name", "")), cur_q, unit_sell * cur_q]
				_refresh_service_ui()
			)
			row.add_child(b_sell_all)
	if not sell_any:
		var emp := Label.new()
		emp.text = "Brak przedmiotów na sprzedaż w plecaku."
		emp.add_theme_font_override("font", MapStyle.body_font())
		emp.add_theme_font_size_override("font_size", 18)
		emp.add_theme_color_override("font_color", Color(0.76, 0.74, 0.70))
		service_vbox.add_child(emp)

func _recipe_filter_bucket(out_def: Dictionary, station: String) -> String:
	var cat := str(out_def.get("cat", ""))
	if cat == "consumable" or station == "alchemik":
		return "alchemy"
	var sl := int(out_def.get("slot", -1))
	if sl == 2:
		return "weapon"
	if sl == 1 or sl == 6:
		return "jewel"
	if sl >= 0:
		return "armor"
	return "alchemy"

func _build_crafting_ui(hud_ref) -> void:
	var v2_recipes: Array[Dictionary] = GmPanelScript.get_recipes()
	var heritage_stage_cur := int(hud_ref.heritage_stage) if hud_ref.get("heritage_stage") != null else 0

	# Top 3-Tab Smithy Switcher — BIG mobile tabs
	var tab_row := HBoxContainer.new()
	tab_row.add_theme_constant_override("separation", 10)
	service_vbox.add_child(tab_row)
	var tab_specs := [
		["craft", "⚒ CRAFTING (%d)" % v2_recipes.size()],
		["enhance", "✦ ULEPSZ (+1..+9)"],
		["heritage", "★ DZIEDZICTWO (%d/6)" % heritage_stage_cur],
	]
	for ts: Array in tab_specs:
		var tkey := str(ts[0])
		var tb := Button.new()
		tb.text = str(ts[1])
		tb.custom_minimum_size = Vector2(0, 54)
		tb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var active_t := (smithy_tab == tkey)
		ForgedUI.style_button(tb, "gold" if active_t else "slate", 19, 18.0, 10.0)
		tb.pressed.connect(func() -> void:
			smithy_tab = tkey
			_refresh_service_ui()
		)
		tab_row.add_child(tb)

	if smithy_tab == "enhance":
		_build_smithy_enhance_tab(hud_ref)
		return
	if smithy_tab == "heritage":
		_build_smithy_heritage_tab(hud_ref)
		return

	# Category filter pills — BIG readable pills
	var f_row := HBoxContainer.new()
	f_row.add_theme_constant_override("separation", 8)
	service_vbox.add_child(f_row)
	var filters := [
		["all", "Wszystkie"],
		["ready", "✓ Gotowe"],
		["weapon", "Broń"],
		["armor", "Pancerz"],
		["jewel", "Biżuteria"],
		["alchemy", "Alchemia"],
	]
	for fl: Array in filters:
		var fkey := str(fl[0])
		var fb := Button.new()
		fb.text = str(fl[1])
		fb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		fb.custom_minimum_size = Vector2(0, 48)
		var is_sel := (smithy_filter == fkey)
		ForgedUI.style_button(fb, "gold" if is_sel else "slate", 17, 14.0, 8.0)
		fb.pressed.connect(func() -> void:
			smithy_filter = fkey
			_refresh_service_ui()
		)
		f_row.add_child(fb)

	var entries: Array[Dictionary] = []
	var seen_out := {}
	# Legacy starter/core craftable items
	for it: Dictionary in GmPanelScript.get_catalog():
		if it.get("craftCost", null) != null:
			var iid := str(it.get("id", ""))
			seen_out[iid] = true
			entries.append({
				"is_v2": false,
				"id": iid,
				"name": str(it.get("name", iid)),
				"minLevel": int(it.get("minLevel", 1)),
				"cost": int(it.get("craftCost", 120)),
				"ingredients": it.get("craftIngredients", it.get("craftRecipe", [])),
				"resultItem": it,
				"resultCount": 1,
				"station": "kowal",
			})
	# Full 265 V2 recipes
	for rec: Dictionary in v2_recipes:
		var res_id := str(rec.get("resultItemId", ""))
		var out_def := GmPanelScript.find_item(res_id)
		if out_def.is_empty():
			continue
		entries.append({
			"is_v2": true,
			"id": str(rec.get("id", "")),
			"name": str(rec.get("name", out_def.get("name", res_id))),
			"minLevel": int(rec.get("requiredLevel", out_def.get("minLevel", 1))),
			"cost": int(rec.get("cost", 50)),
			"ingredients": rec.get("ingredients", []),
			"resultItem": out_def,
			"resultCount": maxi(1, int(rec.get("resultCount", 1))),
			"station": str(rec.get("station", "kowal")),
		})

	var hero_lv := int(hud_ref.hero_level)
	var hero_g := int(hud_ref.hero_gold)
	var filtered: Array[Dictionary] = []
	for e: Dictionary in entries:
		var out_def: Dictionary = e["resultItem"]
		var bucket := _recipe_filter_bucket(out_def, str(e["station"]))
		var cost := int(e["cost"])
		var min_lv := int(e["minLevel"])
		var ings: Array = e["ingredients"]
		var missing := false
		for ing in ings:
			if ing is Dictionary:
				var ing_d: Dictionary = ing as Dictionary
				var ing_id := str(ing_d.get("id", ing_d.get("itemId", "")))
				var need := int(ing_d.get("qty", 1))
				if _count_item_in_backpack(hud_ref, ing_id) < need:
					missing = true
					break
		var can_c := (hero_lv >= min_lv) and (hero_g >= cost) and (not missing)
		e["_can"] = can_c
		e["_bucket"] = bucket
		if smithy_filter == "ready" and not can_c:
			continue
		elif smithy_filter != "all" and smithy_filter != "ready" and bucket != smithy_filter:
			continue
		filtered.append(e)

	filtered.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		var ca := bool(a.get("_can", false))
		var cb := bool(b.get("_can", false))
		if ca != cb:
			return ca
		var la := int(a.get("minLevel", 1))
		var lb := int(b.get("minLevel", 1))
		if la != lb:
			return la < lb
		return int(a.get("cost", 0)) < int(b.get("cost", 0))
	)

	var max_rows := mini(filtered.size(), 36)
	var cnt_lbl := Label.new()
	cnt_lbl.text = "Receptury: %d z %d (gotowe do wykucia na górze)" % [max_rows, filtered.size()]
	cnt_lbl.add_theme_font_override("font", MapStyle.body_font())
	cnt_lbl.add_theme_font_size_override("font_size", 17)
	cnt_lbl.add_theme_color_override("font_color", Color(0.76, 0.86, 0.96))
	service_vbox.add_child(cnt_lbl)

	if max_rows == 0:
		var emp := Label.new()
		emp.text = "Brak receptur spełniających ten filtr — zbierz surowce w świecie lub wybierz kategorię."
		emp.add_theme_font_override("font", MapStyle.body_font())
		emp.add_theme_font_size_override("font_size", 18)
		emp.add_theme_color_override("font_color", Color(0.84, 0.80, 0.74))
		service_vbox.add_child(emp)
		return

	for ri in max_rows:
		var e: Dictionary = filtered[ri]
		var it: Dictionary = e["resultItem"]
		var cost := int(e["cost"])
		var min_lv := int(e["minLevel"])
		var recipe_arr: Array = e["ingredients"]
		var can_craft := bool(e["_can"])
		var is_v2 := bool(e["is_v2"])
		var rec_id := str(e["id"])
		var res_cnt := int(e["resultCount"])
		var mat_parts: PackedStringArray = []
		for ing in recipe_arr:
			if ing is Dictionary:
				var ing_d: Dictionary = ing as Dictionary
				var ing_id := str(ing_d.get("id", ing_d.get("itemId", "")))
				var need := int(ing_d.get("qty", 1))
				var have := _count_item_in_backpack(hud_ref, ing_id)
				var ing_def := GmPanelScript.find_item(ing_id)
				var ing_name := str(ing_def.get("name", ing_id))
				mat_parts.append("%s %d/%d" % [ing_name, have, need])

		var row := _make_row_card(Color(0.42, 0.92, 0.56, 0.85) if can_craft else Color(0.62, 0.50, 0.30, 0.65))

		var ico := TextureRect.new()
		ico.custom_minimum_size = Vector2(52, 52)
		ico.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		ico.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		ico.texture = world.load_tex("res://assets/ui/icons/" + str(it.get("icon", "gear-sword.webp")))
		row.add_child(ico)

		var info_v := VBoxContainer.new()
		info_v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		info_v.add_theme_constant_override("separation", 4)
		row.add_child(info_v)

		var set_tag := (" [%s]" % str(it.get("setCode", ""))) if not str(it.get("setCode", "")).is_empty() else ""
		var qty_tag := (" ×%d" % res_cnt) if res_cnt > 1 else ""
		var lbl := Label.new()
		lbl.text = "%s%s%s [Poz.%d] — %s" % [str(it.get("name", rec_id)), qty_tag, set_tag, min_lv, str(it.get("desc", ""))]
		lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		lbl.add_theme_font_override("font", MapStyle.body_font())
		lbl.add_theme_font_size_override("font_size", 20)
		lbl.add_theme_color_override("font_color", it.get("rarity", Color(0.96, 0.94, 0.90)) as Color)
		info_v.add_child(lbl)

		var sub := Label.new()
		var mats_txt := ", ".join(mat_parts) if not mat_parts.is_empty() else "Tylko złoto"
		sub.text = "Składniki: %s  •  Koszt: %d zł" % [mats_txt, cost]
		sub.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		sub.add_theme_font_override("font", MapStyle.body_font())
		sub.add_theme_font_size_override("font_size", 17)
		sub.add_theme_color_override("font_color", Color(0.56, 0.98, 0.72) if can_craft else Color(1.0, 0.68, 0.56))
		info_v.add_child(sub)

		var b_craft := Button.new()
		b_craft.text = "⚒ WYKUJ (%d zł)" % cost if hero_lv >= min_lv else "🔒 POZ. %d" % min_lv
		b_craft.custom_minimum_size = Vector2(226.0, 56.0)
		_style_btn(b_craft, Color(0.28, 0.16, 0.06, 0.96) if can_craft else Color(0.14, 0.12, 0.16, 0.92), Color(1.0, 0.72, 0.28, 0.96) if can_craft else Color(0.42, 0.38, 0.36, 0.8), 19)
		var it_c := it.duplicate(true)
		b_craft.pressed.connect(func() -> void:
			var payload: Dictionary = {"type": "craft_recipe", "recipeId": rec_id} if is_v2 else {"type": "craft", "itemId": str(it_c["id"])}
			if _srv_act(payload):
				return
			if int(hud_ref.hero_level) < min_lv:
				service_status.text = "Wymagany poziom %d, aby wykuć %s!" % [min_lv, str(it_c["name"])]
				return
			if int(hud_ref.hero_gold) < cost:
				service_status.text = "Za mało złota na kucie (%d zł)!" % cost
				return
			for ing in recipe_arr:
				if ing is Dictionary:
					var ing_d: Dictionary = ing as Dictionary
					var ing_id := str(ing_d.get("id", ing_d.get("itemId", "")))
					var need := int(ing_d.get("qty", 1))
					if _count_item_in_backpack(hud_ref, ing_id) < need:
						var ing_def := GmPanelScript.find_item(ing_id)
						service_status.text = "Brak składnika: %s (wymagane ×%d)!" % [str(ing_def.get("name", ing_id)), need]
						return
			for ing in recipe_arr:
				if ing is Dictionary:
					var ing_d: Dictionary = ing as Dictionary
					_consume_item_from_backpack(hud_ref, str(ing_d.get("id", ing_d.get("itemId", ""))), int(ing_d.get("qty", 1)))
			if hud_ref.add_item_to_backpack(it_c, res_cnt):
				hud_ref.hero_gold -= cost
				hud_ref.recalc_stats()
				service_status.text = "Wykuto w kuźni: %s%s!" % [str(it_c["name"]), (" ×%d" % res_cnt) if res_cnt > 1 else ""]
				_refresh_service_ui()
			else:
				service_status.text = "Brak miejsca w plecaku (24/24)!"
		)
		row.add_child(b_craft)

func _build_smithy_enhance_tab(hud_ref) -> void:
	var note := Label.new()
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	note.text = "Kowalskie Ulepszanie (+1 do +9): każdy poziom wzmacnia statystyki slotu o +8% (max +72%). Broń od +3/+6/+9 zyskuje aurę Ki!"
	note.add_theme_font_override("font", MapStyle.body_font())
	note.add_theme_font_size_override("font_size", 17)
	note.add_theme_color_override("font_color", Color(0.76, 0.94, 1.0))
	service_vbox.add_child(note)

	var slot_names := ["Hełm", "Amulet", "Broń", "Rękawice", "Pancerz", "Tarcza", "Pierścień", "Buty"]
	for si in mini(8, hud_ref.equip_slots.size()):
		var eq: Dictionary = hud_ref.equip_slots[si]
		var eq_id := str(eq.get("id", ""))
		var sname: String = str(slot_names[si]) if si < slot_names.size() else ("Slot %d" % si)
		var cur_rank: int = int(hud_ref.get_slot_upgrade_rank(si)) if hud_ref.has_method("get_slot_upgrade_rank") else 0

		var row := _make_row_card(Color(0.46, 0.86, 1.0, 0.72) if not eq_id.is_empty() else Color(0.40, 0.38, 0.42, 0.50))

		var ico := TextureRect.new()
		ico.custom_minimum_size = Vector2(52, 52)
		ico.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		ico.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		var icon_file := str(eq.get("icon", ""))
		ico.texture = world.load_tex("res://assets/ui/icons/" + (icon_file if not icon_file.is_empty() else "gear-shield.webp"))
		row.add_child(ico)

		var info_v := VBoxContainer.new()
		info_v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		info_v.add_theme_constant_override("separation", 4)
		row.add_child(info_v)

		var lbl := Label.new()
		if eq_id.is_empty():
			lbl.text = "%s — Pusty slot" % sname
			lbl.add_theme_color_override("font_color", Color(0.68, 0.66, 0.64))
		else:
			var plus_txt := (" +%d" % cur_rank) if cur_rank > 0 else ""
			lbl.text = "%s: %s%s  (Premia: +%d%%)" % [sname, str(eq.get("name", eq_id)), plus_txt, cur_rank * 8]
			lbl.add_theme_color_override("font_color", eq.get("rarity", Color(0.95, 0.92, 0.86)) as Color)
		lbl.add_theme_font_override("font", MapStyle.body_font())
		lbl.add_theme_font_size_override("font_size", 20)
		info_v.add_child(lbl)

		if eq_id.is_empty():
			var sub_e := Label.new()
			sub_e.text = "Załóż przedmiot w oknie Postaci [I], aby go ulepszyć."
			sub_e.add_theme_font_override("font", MapStyle.body_font())
			sub_e.add_theme_font_size_override("font_size", 17)
			sub_e.add_theme_color_override("font_color", Color(0.66, 0.66, 0.72))
			info_v.add_child(sub_e)
			continue

		if cur_rank >= 9:
			var sub_m := Label.new()
			sub_m.text = "★ Maksymalne mistrzowskie ulepszenie +9 (+72% statystyk)!"
			sub_m.add_theme_font_override("font", MapStyle.body_font())
			sub_m.add_theme_font_size_override("font_size", 17)
			sub_m.add_theme_color_override("font_color", Color(1.0, 0.88, 0.34))
			info_v.add_child(sub_m)
			continue

		var spec: Dictionary = GmPanelScript.get_enhance_tier(cur_rank)
		var next_t := int(spec.get("nextTier", cur_rank + 1))
		var g_cost := int(spec.get("gold", 50 + cur_rank * 45))
		var ings: Array = spec.get("ingredients", [])
		var missing := false
		var parts: PackedStringArray = []
		for ing in ings:
			if ing is Dictionary:
				var ing_d: Dictionary = ing as Dictionary
				var iid := str(ing_d.get("id", ""))
				var need := int(ing_d.get("qty", 1))
				var have := _count_item_in_backpack(hud_ref, iid)
				if have < need:
					missing = true
				var idef := GmPanelScript.find_item(iid)
				parts.append("%s %d/%d" % [str(idef.get("name", iid)), have, need])
		var can_up := (int(hud_ref.hero_gold) >= g_cost) and (not missing)

		var sub := Label.new()
		sub.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		sub.text = "Następny: +%d (+%d%%)  •  Koszt: %d zł  •  %s" % [next_t, next_t * 8, g_cost, ", ".join(parts) if not parts.is_empty() else "Tylko złoto"]
		sub.add_theme_font_override("font", MapStyle.body_font())
		sub.add_theme_font_size_override("font_size", 17)
		sub.add_theme_color_override("font_color", Color(0.56, 0.98, 0.72) if can_up else Color(1.0, 0.68, 0.56))
		info_v.add_child(sub)

		var slot_idx: int = int(si)
		var b_up := Button.new()
		b_up.text = "✦ ULEPSZ → +%d (%d zł)" % [next_t, g_cost]
		b_up.custom_minimum_size = Vector2(246.0, 56.0)
		_style_btn(b_up, Color(0.14, 0.24, 0.34, 0.96) if can_up else Color(0.14, 0.12, 0.16, 0.90), Color(0.46, 0.94, 1.0, 0.96) if can_up else Color(0.42, 0.40, 0.44, 0.78), 18)
		b_up.pressed.connect(func() -> void:
			if _srv_act({"type": "enhance_equip", "equipSlot": slot_idx}):
				return
			if int(hud_ref.hero_gold) < g_cost:
				service_status.text = "Za mało złota na ulepszenie +%d (%d zł)!" % [next_t, g_cost]
				return
			for ing in ings:
				if ing is Dictionary:
					var ing_d: Dictionary = ing as Dictionary
					var iid := str(ing_d.get("id", ""))
					var need := int(ing_d.get("qty", 1))
					if _count_item_in_backpack(hud_ref, iid) < need:
						var idef := GmPanelScript.find_item(iid)
						service_status.text = "Brak składnika: %s (×%d)!" % [str(idef.get("name", iid)), need]
						return
			for ing in ings:
				if ing is Dictionary:
					var ing_d: Dictionary = ing as Dictionary
					_consume_item_from_backpack(hud_ref, str(ing_d.get("id", "")), int(ing_d.get("qty", 1)))
			hud_ref.hero_gold -= g_cost
			hud_ref.equip_upgrades[str(slot_idx)] = next_t
			hud_ref.recalc_stats()
			if world != null and world.get("audio") != null:
				world.audio.sfx("common/level-up", 0.88, 0.04)
			service_status.text = "✦ Ulepszono %s do +%d (+%d%% statystyk)!" % [str(eq.get("name", sname)), next_t, next_t * 8]
			_refresh_service_ui()
		)
		row.add_child(b_up)

func _build_smithy_heritage_tab(hud_ref) -> void:
	var rkey: String = str(hud_ref._race_key()) if hud_ref.has_method("_race_key") else "legend"
	var cur_stage: int = clampi(int(hud_ref.heritage_stage), 0, 6)
	var stages: Array[Dictionary] = GmPanelScript.get_heritage_weapons(rkey)

	var note := Label.new()
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	note.text = "Broń Dziedzictwa (Etapy I–VI) — osobista broń Twojej rasy, przekuwana na kolejnych etapach przygody (Postęp: %d/6)." % cur_stage
	note.add_theme_font_override("font", MapStyle.body_font())
	note.add_theme_font_size_override("font_size", 17)
	note.add_theme_color_override("font_color", Color(1.0, 0.90, 0.56))
	service_vbox.add_child(note)

	for hw: Dictionary in stages:
		var st_num := int(hw.get("stage", 1))
		var min_lv := int(hw.get("minLevel", 1))
		var g_cost := int(hw.get("goldCost", 120))
		var ings: Array = hw.get("ingredients", [])
		var is_done := st_num <= cur_stage
		var is_next := st_num == cur_stage + 1
		var missing := false
		var parts: PackedStringArray = []
		for ing in ings:
			if ing is Dictionary:
				var ing_d: Dictionary = ing as Dictionary
				var iid := str(ing_d.get("id", ""))
				var need := int(ing_d.get("qty", 1))
				var have := _count_item_in_backpack(hud_ref, iid)
				if have < need:
					missing = true
				var idef := GmPanelScript.find_item(iid)
				parts.append("%s %d/%d" % [str(idef.get("name", iid)), have, need])
		var can_forge := is_next and (int(hud_ref.hero_level) >= min_lv) and (int(hud_ref.hero_gold) >= g_cost) and (not missing)

		var row := _make_row_card(Color(0.46, 0.96, 0.64, 0.78) if is_done else (Color(1.0, 0.84, 0.32, 0.92) if is_next else Color(0.46, 0.44, 0.50, 0.55)))

		var hw_def := GmPanelScript.find_item(str(hw.get("id", "")))
		var ico := TextureRect.new()
		ico.custom_minimum_size = Vector2(54, 54)
		ico.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		ico.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		ico.texture = world.load_tex("res://assets/ui/icons/" + str(hw_def.get("icon", "gear-sword.webp")))
		row.add_child(ico)

		var info_v := VBoxContainer.new()
		info_v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		info_v.add_theme_constant_override("separation", 4)
		row.add_child(info_v)

		var lbl := Label.new()
		lbl.text = "Etap %d/6: %s [Poz.%d] — +%d ATK, +%.1f%% KRYT, +%d HP" % [
			st_num, str(hw.get("name", "")), min_lv, int(hw.get("atk", 0)), float(hw.get("crit", 0.0)) * 100.0, int(hw.get("hp", 0))
		]
		lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		lbl.add_theme_font_override("font", MapStyle.body_font())
		lbl.add_theme_font_size_override("font_size", 20)
		lbl.add_theme_color_override("font_color", Color(0.56, 0.98, 0.70) if is_done else (Color(1.0, 0.90, 0.40) if is_next else Color(0.76, 0.76, 0.80)))
		info_v.add_child(lbl)

		var sub := Label.new()
		sub.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		sub.text = "%s  •  Koszt: %d zł, %s" % [str(hw.get("desc", "")), g_cost, ", ".join(parts) if not parts.is_empty() else "Tylko złoto"]
		sub.add_theme_font_override("font", MapStyle.body_font())
		sub.add_theme_font_size_override("font_size", 17)
		sub.add_theme_color_override("font_color", Color(0.80, 0.86, 0.92) if is_done else (Color(0.56, 0.98, 0.72) if can_forge else Color(0.96, 0.70, 0.58)))
		info_v.add_child(sub)

		var btn := Button.new()
		btn.custom_minimum_size = Vector2(246.0, 56.0)
		if is_done:
			btn.text = "✓ WYKUTO"
			_style_btn(btn, Color(0.10, 0.24, 0.14, 0.92), Color(0.46, 0.94, 0.60, 0.88), 18)
			btn.disabled = true
		elif is_next:
			btn.text = "★ WYKUJ ETAP %d (%d zł)" % [st_num, g_cost]
			_style_btn(btn, Color(0.30, 0.20, 0.06, 0.98) if can_forge else Color(0.14, 0.12, 0.16, 0.92), Color(1.0, 0.84, 0.32, 0.98) if can_forge else Color(0.46, 0.42, 0.38, 0.80), 18)
			var hw_c := hw.duplicate(true)
			var hw_def_c := hw_def.duplicate(true)
			btn.pressed.connect(func() -> void:
				if _srv_act({"type": "forge_heritage_weapon"}):
					return
				if int(hud_ref.hero_level) < min_lv:
					service_status.text = "Etap %d/6 wymaga poziomu %d!" % [st_num, min_lv]
					return
				if int(hud_ref.hero_gold) < g_cost:
					service_status.text = "Za mało złota (%d zł)!" % g_cost
					return
				for ing in ings:
					if ing is Dictionary:
						var ing_d: Dictionary = ing as Dictionary
						var iid := str(ing_d.get("id", ""))
						var need := int(ing_d.get("qty", 1))
						if _count_item_in_backpack(hud_ref, iid) < need:
							var idef := GmPanelScript.find_item(iid)
							service_status.text = "Brak składnika: %s (×%d)!" % [str(idef.get("name", iid)), need]
							return
				for ing in ings:
					if ing is Dictionary:
						var ing_d: Dictionary = ing as Dictionary
						_consume_item_from_backpack(hud_ref, str(ing_d.get("id", "")), int(ing_d.get("qty", 1)))
				hud_ref.hero_gold -= g_cost
				hud_ref.heritage_stage = st_num
				var eq_item: Dictionary = hw_def_c if not hw_def_c.is_empty() else {
					"id": str(hw_c.get("id", "heritage_wep")),
					"name": str(hw_c.get("name", "Broń Dziedzictwa")),
					"icon": "gear-sword.webp",
					"slot": 2,
					"cat": "equip",
					"atk": int(hw_c.get("atk", 15)),
					"crit": float(hw_c.get("crit", 0.02)),
					"hp": int(hw_c.get("hp", 20)),
					"ki": int(hw_c.get("ki", 10)),
					"rarity": Color(1.0, 0.82, 0.28),
					"desc": str(hw_c.get("desc", "")),
				}
				if hud_ref.equip_slots.size() > 2:
					eq_item["side"] = -1
					eq_item["row"] = 2
					hud_ref.equip_slots[2] = eq_item
				else:
					hud_ref.add_item_to_backpack(eq_item, 1)
				hud_ref.recalc_stats()
				if world != null and world.get("audio") != null:
					world.audio.sfx("common/level-up", 0.94, 0.02)
				service_status.text = "★ Wykuto Broń Dziedzictwa Etap %d/6: %s!" % [st_num, str(hw_c.get("name", ""))]
				_refresh_service_ui()
			)
		else:
			btn.text = "🔒 ETAP %d" % st_num
			_style_btn(btn, Color(0.12, 0.12, 0.16, 0.84), Color(0.38, 0.38, 0.44, 0.72), 17)
			btn.disabled = true
		row.add_child(btn)

func _build_bank_ui(hud_ref) -> void:
	var g_row := _make_row_card(Color(1.0, 0.84, 0.36, 0.85))

	var bl := Label.new()
	bl.text = "Złoto w Skarbcu Banku: %d szt.  •  Pojemność: %d slotów" % [bank_gold, BANK_SLOTS]
	bl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	bl.add_theme_font_override("font", MapStyle.body_font())
	bl.add_theme_font_size_override("font_size", 20)
	bl.add_theme_color_override("font_color", Color(1.0, 0.90, 0.48))
	g_row.add_child(bl)

	var b_dep := Button.new()
	b_dep.text = "WPŁAĆ 100 zł"
	_style_btn(b_dep, Color(0.12, 0.26, 0.18, 0.96), Color(0.42, 0.92, 0.56, 0.95), 18)
	b_dep.pressed.connect(func() -> void:
		if _srv_act({"type": "bank_deposit_gold", "amount": 100}):
			return
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
	_style_btn(b_wd, Color(0.24, 0.18, 0.08, 0.96), Color(1.0, 0.82, 0.36, 0.95), 18)
	b_wd.pressed.connect(func() -> void:
		if _srv_act({"type": "bank_withdraw_gold", "amount": 100}):
			return
		if bank_gold >= 100:
			bank_gold -= 100
			hud_ref.hero_gold += 100
			hud_ref.recalc_stats()
			service_status.text = "Wypłacono 100 zł z Banku."
			_refresh_service_ui()
	)
	g_row.add_child(b_wd)

	service_vbox.add_child(_section_hdr("PRZEDMIOTY W PLECAKU (KLIK: DEPONUJ W BANKU):"))

	for i in hud_ref.backpack_items.size():
		var it: Dictionary = hud_ref.backpack_items[i]
		if it.is_empty():
			continue
		var btn := Button.new()
		btn.text = "→ Deponuj: %s ×%d" % [str(it.get("name", "Przedmiot")), int(it.get("qty", 1))]
		_style_btn(btn, Color(0.11, 0.14, 0.20, 0.95), Color(0.56, 0.78, 0.96, 0.90), 18)
		var idx: int = int(i)
		btn.pressed.connect(func() -> void:
			if _srv_act({"type": "bank_deposit_item", "backpackIndex": idx}):
				return
			for bi in bank_items.size():
				if bank_items[bi].is_empty():
					bank_items[bi] = hud_ref.backpack_items[idx].duplicate(true)
					hud_ref.backpack_items[idx] = {}
					hud_ref.recalc_stats()
					service_status.text = "Zdeponowano w Skarbcu: %s" % str(bank_items[bi].get("name", ""))
					_refresh_service_ui()
					return
			service_status.text = "Skarbiec Banku jest pełny (%d/%d)!" % [BANK_SLOTS, BANK_SLOTS]
		)
		service_vbox.add_child(btn)

	service_vbox.add_child(_section_hdr("DEPOZYT BANKOWY (KLIK: ODBIERZ DO PLECAKA):", Color(0.56, 0.94, 0.72)))

	for bi in bank_items.size():
		var bit: Dictionary = bank_items[bi]
		if bit.is_empty():
			continue
		var btn2 := Button.new()
		btn2.text = "← Odbierz: %s ×%d" % [str(bit.get("name", "Przedmiot")), int(bit.get("qty", 1))]
		_style_btn(btn2, Color(0.12, 0.24, 0.16, 0.95), Color(0.46, 0.94, 0.62, 0.92), 18)
		var bidx: int = int(bi)
		btn2.pressed.connect(func() -> void:
			if _srv_act({"type": "bank_withdraw_item", "bankIndex": bidx}):
				return
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
	b_rest.custom_minimum_size = Vector2(0, 62)
	_style_btn(b_rest, Color(0.12, 0.28, 0.18, 0.96), Color(0.46, 0.96, 0.64, 0.98), 20)
	b_rest.pressed.connect(func() -> void:
		if world != null:
			if world.recent_world_combat():
				service_status.text = "Odpocznij po zakończeniu walki."
				return
			var point: Vector2 = world.hero_pos
			if _srv_act({"type": "inn_rest", "siteId": str(building_data["id"]), "position": {"x": point.x, "z": point.y}}):
				return
		hud_ref.hero_hp = hud_ref.hero_max_hp
		hud_ref.hero_ki = hud_ref.hero_max_ki
		hud_ref.recalc_stats()
		service_status.text = "Wypoczęto w gospodzie! Przywrócono 100% HP i 100% KI."
		_refresh_service_ui()
	)
	service_vbox.add_child(b_rest)

func _start_training_drill(hud_ref, stat_key: String, title: String, gain_desc: String) -> void:
	var lv := int(hud_ref.hero_level)
	var cap: int = 3 + maxi(0, lv - 1) * 2
	var cur_rank: int = int(hud_ref.training_ranks.get(stat_key, 0)) if hud_ref.get("training_ranks") is Dictionary else 0
	if cur_rank >= cap:
		service_status.text = "Osiągnięto limit %d/%d dla Poz.%d — awansuj poziom, aby trenować dalej!" % [cur_rank, cap, lv]
		return
	var cost: int = 0 if cur_rank < 3 else (15 + (cur_rank - 2) * 10)
	if int(hud_ref.hero_gold) < cost:
		service_status.text = "Za mało złota (%d / %d zł)!" % [int(hud_ref.hero_gold), cost]
		return
	drill_dojo_trial_id = ""
	drill_active = true
	drill_stat = stat_key
	drill_title = title
	drill_gain = gain_desc
	drill_phase = 0.08
	drill_dir = 1.0
	drill_speed = 1.35 + float(mini(cur_rank, 10)) * 0.06
	drill_step = 0
	drill_perfects = 0
	drill_hits = [0, 0, 0]
	drill_feedback = "Trafiaj w ZŁOTĄ STREFĘ, aby zdobyć premię Perfekcyjnej Serii!"
	if world != null and world.get("audio") != null:
		world.audio.sfx("ui/open", 0.85)
	_refresh_service_ui()

func _start_dojo_trial(hud_ref, trial_id: String, title: String, gain_desc: String, anim_stat: String) -> void:
	drill_dojo_trial_id = trial_id
	drill_active = true
	drill_stat = anim_stat
	drill_title = title
	drill_gain = gain_desc
	drill_phase = 0.08
	drill_dir = 1.0
	drill_speed = 1.50
	drill_step = 0
	drill_perfects = 0
	drill_hits = [0, 0, 0]
	drill_feedback = "Próba Mistrza Dojo! Ukończ 3 idealne reakcje rytmu Ki!"
	if world != null and world.get("audio") != null:
		world.audio.sfx("ui/open", 0.85)
	_refresh_service_ui()

func _trigger_drill_strike(hud_ref) -> void:
	if not drill_active or drill_step >= 3:
		return
	var dist := absf(drill_phase - 0.5)
	var perfect_half := maxf(0.075, 0.11 - float(drill_step) * 0.015)
	var good_half := 0.24
	var tier := 1
	var pop_txt := "• PRÓBA"
	var pop_col := Color(0.76, 0.84, 0.94)
	if dist <= perfect_half:
		tier = 3
		drill_perfects += 1
		pop_txt = "★ IDEALNIE!"
		pop_col = Color(1.0, 0.90, 0.34)
		if world != null and world.get("audio") != null:
			world.audio.sfx("common/hit-crit", 0.92, 0.04)
	elif dist <= good_half:
		tier = 2
		pop_txt = "✓ DOBRZE!"
		pop_col = Color(0.42, 0.96, 1.0)
		if world != null and world.get("audio") != null:
			world.audio.sfx("common/hit", 0.85, 0.05)
	else:
		if world != null and world.get("audio") != null:
			world.audio.sfx("ui/click", 0.80, 0.04)

	drill_hits[drill_step] = tier
	drill_step += 1
	drill_speed += 0.32
	drill_feedback = "%s  (Uderzenie %d/3 • Idealne: %d)" % [pop_txt, drill_step, drill_perfects]

	# Play live hero training animation + floating feedback inside the hall!
	if hero_actor != null and is_instance_valid(hero_actor):
		var clip := "attack"
		if drill_stat == "atk":
			clip = ["attack", "attack2", "finisher"][mini(drill_step - 1, 2)]
		elif drill_stat == "def":
			clip = "guard"
		elif drill_stat == "spd":
			clip = "dodge"
		elif drill_stat == "ki":
			clip = "channel"
		elif drill_stat == "crit":
			clip = "skill"
		elif drill_stat == "hp":
			clip = "attack3" if drill_step < 3 else "victory"
		if hero_actor.has_method("play_action"):
			hero_actor.play_action(clip, "attack")
		if hero_actor.has_method("show_damage_number"):
			hero_actor.show_damage_number(pop_txt, pop_col, tier == 3)

	if drill_step >= 3:
		var perfect_series := drill_perfects >= 2
		var finished_stat := drill_stat
		var finished_gain := drill_gain
		var finished_trial := drill_dojo_trial_id
		drill_dojo_trial_id = ""
		drill_active = false
		var perf_note := ""
		if perfect_series:
			hud_ref.hero_hp = minf(float(hud_ref.hero_max_hp), float(hud_ref.hero_hp) + float(hud_ref.hero_max_hp) * 0.20)
			hud_ref.hero_ki = minf(float(hud_ref.hero_max_ki), float(hud_ref.hero_ki) + float(hud_ref.hero_max_ki) * 0.20)
			perf_note = " ★ PERFEKCYJNA SERIA (+20% HP/KI)!"
			if world != null and world.get("audio") != null:
				world.audio.sfx("common/level-up", 0.88, 0.02)
		if not finished_trial.is_empty():
			if hero_actor != null and is_instance_valid(hero_actor) and hero_actor.has_method("show_damage_number"):
				hero_actor.show_damage_number("🥋 PRÓBA DOJO UKOŃCZONA!", Color(0.42, 0.98, 0.72), true)
			if _srv_act({"type": "complete_dojo_trial", "trialId": finished_trial}):
				if perfect_series:
					service_status.text += perf_note
				return
			var first_time := not bool(hud_ref.dojo_trials.get(finished_trial, false))
			hud_ref.dojo_trials[finished_trial] = true
			if first_time:
				hud_ref.hero_gold += 35
			hud_ref.recalc_stats()
			service_status.text = ("🥋 Ukończono %s! (+35 zł)" % drill_title if first_time else "🥋 Powtórzono %s!" % drill_title) + perf_note
			_refresh_service_ui()
			return
		if hero_actor != null and is_instance_valid(hero_actor) and hero_actor.has_method("show_damage_number"):
			hero_actor.show_damage_number("%s (0 PD)" % finished_gain, Color(1.0, 0.90, 0.36), true)
		if _srv_act({"type": "city_train", "stat": finished_stat}):
			if perfect_series:
				service_status.text += perf_note
			return
		var res: Dictionary = hud_ref.apply_local_city_training(finished_stat)
		service_status.text = str(res.get("notice", "")) + perf_note
		_refresh_service_ui()
	else:
		if drill_info_lbl != null and is_instance_valid(drill_info_lbl):
			drill_info_lbl.text = drill_feedback
		if drill_strike_btn != null and is_instance_valid(drill_strike_btn):
			drill_strike_btn.text = "⚡ UDERZ / SKUP KI!  (Próba %d / 3)" % (drill_step + 1)
		if drill_canvas != null and is_instance_valid(drill_canvas):
			drill_canvas.queue_redraw()

func _draw_drill_bar() -> void:
	if drill_canvas == null or not is_instance_valid(drill_canvas):
		return
	var c := drill_canvas
	var sz := c.size
	if sz.x < 40.0 or sz.y < 16.0:
		return
	var bar_r := Rect2(8.0, 6.0, sz.x - 16.0, sz.y - 12.0)
	c.draw_rect(bar_r, Color(0.05, 0.04, 0.08, 0.96), true)
	# Good zone (cyan)
	var good_x := bar_r.position.x + bar_r.size.x * 0.26
	var good_w := bar_r.size.x * 0.48
	c.draw_rect(Rect2(good_x, bar_r.position.y + 2.0, good_w, bar_r.size.y - 4.0), Color(0.14, 0.42, 0.56, 0.65), true)
	# Perfect golden sweet-spot
	var perf_half := maxf(0.075, 0.11 - float(drill_step) * 0.015)
	var perf_x := bar_r.position.x + bar_r.size.x * (0.5 - perf_half)
	var perf_w := bar_r.size.x * (perf_half * 2.0)
	c.draw_rect(Rect2(perf_x, bar_r.position.y + 1.0, perf_w, bar_r.size.y - 2.0), Color(1.0, 0.78, 0.22, 0.88), true)
	# Center crosshair
	var cx := bar_r.position.x + bar_r.size.x * 0.5
	c.draw_line(Vector2(cx, bar_r.position.y), Vector2(cx, bar_r.position.y + bar_r.size.y), Color(1.0, 0.98, 0.86, 0.95), 2.0)
	# Outer gold border
	c.draw_rect(bar_r, Color(0.88, 0.70, 0.34, 0.92), false, 2.0)
	# Moving luminous Ki cursor
	var mx := bar_r.position.x + bar_r.size.x * clampf(drill_phase, 0.0, 1.0)
	c.draw_rect(Rect2(mx - 6.0, bar_r.position.y - 3.0, 12.0, bar_r.size.y + 6.0), Color(0.32, 0.96, 1.0, 0.55), true)
	c.draw_rect(Rect2(mx - 3.0, bar_r.position.y - 4.0, 6.0, bar_r.size.y + 8.0), Color(1.0, 1.0, 1.0, 0.98), true)

func _build_active_drill_card(hud_ref) -> void:
	if not drill_active:
		return
	var card := PanelContainer.new()
	card.add_theme_stylebox_override("panel", ForgedUI.inset_card(Color(1.0, 0.80, 0.32, 0.95), Color(0.07, 0.055, 0.10, 0.98), 16, 14))
	service_vbox.add_child(card)
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 10)
	card.add_child(vb)

	var top_r := HBoxContainer.new()
	vb.add_child(top_r)
	var t_lbl := Label.new()
	t_lbl.text = "🔥 AKTYWNA PRÓBA: %s  (%s)" % [drill_title.to_upper(), drill_gain]
	t_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	t_lbl.add_theme_font_override("font", MapStyle.font())
	t_lbl.add_theme_font_size_override("font_size", 20)
	t_lbl.add_theme_color_override("font_color", Color(1.0, 0.90, 0.44))
	top_r.add_child(t_lbl)

	var b_cancel := Button.new()
	b_cancel.text = "✕ ANULUJ"
	_style_btn(b_cancel, Color(0.24, 0.08, 0.08, 0.94), Color(0.90, 0.40, 0.36, 0.90), 17)
	b_cancel.pressed.connect(func() -> void:
		drill_active = false
		drill_dojo_trial_id = ""
		_refresh_service_ui()
	)
	top_r.add_child(b_cancel)

	drill_canvas = Control.new()
	drill_canvas.custom_minimum_size = Vector2(0, 48)
	drill_canvas.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	drill_canvas.draw.connect(_draw_drill_bar)
	vb.add_child(drill_canvas)

	drill_info_lbl = Label.new()
	drill_info_lbl.text = drill_feedback
	drill_info_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	drill_info_lbl.add_theme_font_override("font", MapStyle.body_font())
	drill_info_lbl.add_theme_font_size_override("font_size", 18)
	drill_info_lbl.add_theme_color_override("font_color", Color(0.86, 0.96, 1.0))
	vb.add_child(drill_info_lbl)

	drill_strike_btn = Button.new()
	drill_strike_btn.text = "⚡ UDERZ / SKUP KI!  (Próba %d / 3)" % (drill_step + 1)
	drill_strike_btn.custom_minimum_size = Vector2(0, 60)
	ForgedUI.style_button(drill_strike_btn, "gold", 21)
	drill_strike_btn.pressed.connect(func() -> void: _trigger_drill_strike(hud_ref))
	vb.add_child(drill_strike_btn)

func _build_mastery_header_card(hud_ref, subtitle: String) -> void:
	var lv := int(hud_ref.hero_level)
	var cap: int = 3 + maxi(0, lv - 1) * 2
	var mastery_title := str(hud_ref.get_training_mastery_title()) if hud_ref.has_method("get_training_mastery_title") else "Rekrut"
	var total_tr: int = int(hud_ref.get_total_training_sessions()) if hud_ref.has_method("get_total_training_sessions") else 0
	var min_r := 999
	if hud_ref.get("training_ranks") is Dictionary:
		for sk: String in ["hp", "ki", "atk", "def", "spd", "crit"]:
			min_r = mini(min_r, int(hud_ref.training_ranks.get(sk, 0)))
	if min_r == 999:
		min_r = 0
	var next_tier_txt := "Mistrz Ki (MAX)"
	for td: Array in [[3, "Adept (+5% regen OOC)"], [6, "Wojownik Miasta (+10% regen OOC)"], [10, "Weteran (+15% regen OOC)"], [15, "Mistrz Ki (+20% regen OOC)"]]:
		if min_r < int(td[0]):
			next_tier_txt = "%s — osiągnij %d w każdej z 6 dyscyplin (min. %d/%d)" % [str(td[1]), int(td[0]), min_r, int(td[0])]
			break

	var card := PanelContainer.new()
	card.add_theme_stylebox_override("panel", ForgedUI.inset_card(Color(0.84, 0.66, 0.30, 0.85), Color(0.055, 0.048, 0.080, 0.95), 16, 12))
	service_vbox.add_child(card)
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 6)
	card.add_child(vb)

	var h1 := Label.new()
	h1.text = "★ RANGA MISTRZOSTWA MIASTA: %s  (%d sesji • 0 PD)" % [mastery_title.to_upper(), total_tr]
	h1.add_theme_font_override("font", MapStyle.font())
	h1.add_theme_font_size_override("font_size", 20)
	h1.add_theme_color_override("font_color", Color(1.0, 0.88, 0.46))
	vb.add_child(h1)

	var h2 := Label.new()
	h2.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	h2.text = "%s\nNastępna ranga: %s  •  Limit na Poz.%d: %d sesji/stat  •  Pierwsze 3 sesje DARMOWE!" % [subtitle, next_tier_txt, lv, cap]
	h2.add_theme_font_override("font", MapStyle.body_font())
	h2.add_theme_font_size_override("font_size", 17)
	h2.add_theme_color_override("font_color", Color(0.90, 0.88, 0.82))
	vb.add_child(h2)

func _add_training_drill_row(hud_ref, stat_key: String, title: String, gain_desc: String) -> void:
	var lv := int(hud_ref.hero_level)
	var cap: int = 3 + maxi(0, lv - 1) * 2
	var cur_rank: int = int(hud_ref.training_ranks.get(stat_key, 0)) if hud_ref.get("training_ranks") is Dictionary else 0
	var cost: int = 0 if cur_rank < 3 else (15 + (cur_rank - 2) * 10)
	var row := _make_row_card(Color(0.46, 0.94, 0.64, 0.78) if cur_rank >= cap else Color(0.84, 0.66, 0.30, 0.72))

	var info_v := VBoxContainer.new()
	info_v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	info_v.add_theme_constant_override("separation", 5)
	row.add_child(info_v)

	var lbl := Label.new()
	lbl.text = "%s  (%s)  —  Ranga %d/%d" % [title, gain_desc, cur_rank, cap]
	lbl.add_theme_font_override("font", MapStyle.body_font())
	lbl.add_theme_font_size_override("font_size", 20)
	lbl.add_theme_color_override("font_color", Color(0.98, 0.92, 0.72) if cur_rank < cap else Color(0.56, 0.94, 0.68))
	info_v.add_child(lbl)

	var pbar := ProgressBar.new()
	pbar.min_value = 0.0
	pbar.max_value = float(maxi(cap, 1))
	pbar.value = float(cur_rank)
	pbar.show_percentage = false
	pbar.custom_minimum_size = Vector2(0, 10)
	var pbg := StyleBoxFlat.new()
	pbg.bg_color = Color(0.08, 0.07, 0.12, 0.96)
	pbg.set_corner_radius_all(4)
	var pfill := StyleBoxFlat.new()
	pfill.bg_color = Color(0.36, 0.92, 0.56, 0.95) if cur_rank >= cap else Color(0.94, 0.74, 0.28, 0.95)
	pfill.set_corner_radius_all(4)
	pbar.add_theme_stylebox_override("background", pbg)
	pbar.add_theme_stylebox_override("fill", pfill)
	info_v.add_child(pbar)

	var sub := Label.new()
	sub.text = "Koszt: %s  •  0 PD (nie wbija poziomu)  •  Próba rytmu Ki (3 uderzenia)" % ("DARMOWY" if cost == 0 else "%d zł" % cost)
	sub.add_theme_font_override("font", MapStyle.body_font())
	sub.add_theme_font_size_override("font_size", 17)
	sub.add_theme_color_override("font_color", Color(0.80, 0.88, 0.96))
	info_v.add_child(sub)

	var btn := Button.new()
	btn.custom_minimum_size = Vector2(220.0, 56.0)
	if cur_rank >= cap:
		btn.text = "MAX (POZ. %d)" % lv
		_style_btn(btn, Color(0.14, 0.14, 0.18, 0.90), Color(0.44, 0.44, 0.48, 0.80), 18)
	else:
		btn.text = "⚔ ĆWICZ (%s)" % ("FREE" if cost == 0 else "%d zł" % cost)
		_style_btn(btn, Color(0.28, 0.15, 0.07, 0.96), Color(1.0, 0.72, 0.28, 0.98), 19)
	btn.pressed.connect(func() -> void: _start_training_drill(hud_ref, stat_key, title, gain_desc))
	row.add_child(btn)

func _build_dojo_trials_section(hud_ref) -> void:
	var core_done := 0
	for tid: String in ["dojo_dodge", "dojo_skill", "dojo_ki"]:
		if bool(hud_ref.dojo_trials.get(tid, false)):
			core_done += 1
	var dojo_rank := "Mistrz Dojo" if core_done >= 3 else ("Adept Dojo" if core_done == 2 else ("Uczeń Dojo" if core_done == 1 else "Rekrut Dojo"))
	service_vbox.add_child(_section_hdr("🥋 PRÓBY MISTRZA DOJO (%d/3 • Ranga: %s):" % [core_done, dojo_rank], Color(0.48, 0.98, 0.74)))
	var trial_defs := [
		["dojo_dodge", "Próba I: Krok Poza Strefę", "Wyćwicz unik czerwonych stref AoE bossów (+35 zł, tytuł Dojo)", "spd"],
		["dojo_skill", "Próba II: Uderzenie Techniki Ki", "Wprowadź serię czystych uderzeń Techniki Ki (+35 zł, tytuł Dojo)", "atk"],
		["dojo_ki", "Próba III: Dyscyplina Przepływu Ki", "Utrzymaj stabilny przepływ Ki podczas kanału (+35 zł, tytuł Dojo)", "ki"],
	]
	for td: Array in trial_defs:
		var tid := str(td[0])
		var ttitle := str(td[1])
		var tdesc := str(td[2])
		var anim_s := str(td[3])
		var done := bool(hud_ref.dojo_trials.get(tid, false))

		var row := _make_row_card(Color(0.46, 0.96, 0.64, 0.78) if done else Color(0.46, 0.90, 1.0, 0.72))

		var iv := VBoxContainer.new()
		iv.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		iv.add_theme_constant_override("separation", 4)
		row.add_child(iv)

		var l1 := Label.new()
		l1.text = "%s%s" % ["✓ " if done else "○ ", ttitle]
		l1.add_theme_font_override("font", MapStyle.body_font())
		l1.add_theme_font_size_override("font_size", 20)
		l1.add_theme_color_override("font_color", Color(0.56, 0.98, 0.70) if done else Color(1.0, 0.94, 0.68))
		iv.add_child(l1)

		var l2 := Label.new()
		l2.text = tdesc
		l2.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		l2.add_theme_font_override("font", MapStyle.body_font())
		l2.add_theme_font_size_override("font_size", 17)
		l2.add_theme_color_override("font_color", Color(0.82, 0.88, 0.94))
		iv.add_child(l2)

		var b := Button.new()
		b.text = "✓ POWTÓRZ" if done else "🥋 ROZPOCZNIJ"
		b.custom_minimum_size = Vector2(220.0, 56.0)
		_style_btn(
			b,
			Color(0.10, 0.24, 0.16, 0.94) if done else Color(0.14, 0.24, 0.34, 0.96),
			Color(0.46, 0.96, 0.64, 0.94) if done else Color(0.46, 0.94, 1.0, 0.96),
			18
		)
		b.pressed.connect(func() -> void: _start_dojo_trial(hud_ref, tid, ttitle, "Próba Mistrza Dojo", anim_s))
		row.add_child(b)

func _build_arena_ui(hud_ref) -> void:
	_build_mastery_header_card(hud_ref, "Trwały rozwój siły, wytrzymałości, gardy i zwinności bez wbijania poziomu.")
	_build_active_drill_card(hud_ref)
	service_vbox.add_child(_section_hdr("TRENING BOJOWY NA ARENIE (KLIKNIJ ĆWICZ → PRÓBA RYTMU KI):"))
	_add_training_drill_row(hud_ref, "atk", "Próba Siły Ciosu (ATK)", "+2 ATK na stałe")
	_add_training_drill_row(hud_ref, "hp", "Hart Ciała i Wytrzymałość (HP)", "+12 Max HP na stałe")
	_add_training_drill_row(hud_ref, "def", "Szkoła Gardy i Parowania (DEF)", "+1–2 DEF na stałe")
	_add_training_drill_row(hud_ref, "spd", "Bieg Zwiadowcy i Zwinność (SPD)", "+6 Szybkości na stałe")
	_build_dojo_trials_section(hud_ref)

func _build_hall_ui(hud_ref) -> void:
	_build_mastery_header_card(hud_ref, "Medytacja Ki i Oko Mistrza w %s (0 PD) oraz 15-minutowe Błogosławieństwa Wyprawy." % room_title)
	_build_active_drill_card(hud_ref)
	service_vbox.add_child(_section_hdr("TRENING SANKTUARIUM (KI I KRYT — 0 PD):"))
	_add_training_drill_row(hud_ref, "ki", "Medytacja Przepływu Ki (KI)", "+8 Max KI oraz +0.08 KI/s na stałe")
	_add_training_drill_row(hud_ref, "crit", "Oko Mistrza i Precyzja (KRYT)", "+0.6% Szansy Kryt na stałe")
	_build_dojo_trials_section(hud_ref)

	service_vbox.add_child(_section_hdr("BŁOGOSŁAWIEŃSTWA MIEJSKIE (15 MIN + 100% HP/KI):", Color(0.46, 0.90, 1.0)))
	var bless_defs := [
		["march", "✦ Błogosławieństwo Marszu (+15% Szybkości ruchu — 15 min)"],
		["might", "✦ Błogosławieństwo Hartu (+10% Ataku i Obrony — 15 min)"],
		["focus", "✦ Błogosławieństwo Skupienia (+25% Regeneracji KI — 15 min)"],
	]
	for bd: Array in bless_defs:
		var bkind := str(bd[0])
		var b_bl := Button.new()
		b_bl.text = str(bd[1])
		b_bl.custom_minimum_size = Vector2(0, 56)
		_style_btn(b_bl, Color(0.10, 0.22, 0.30, 0.96), Color(0.46, 0.90, 1.0, 0.98), 18)
		b_bl.pressed.connect(func() -> void:
			if _srv_act({"type": "city_blessing", "kind": bkind}):
				return
			hud_ref.apply_local_blessing(bkind)
			service_status.text = "Przyjęto %s oraz pełne HP/KI!" % str(bd[1])
			_refresh_service_ui()
		)
		service_vbox.add_child(b_bl)

