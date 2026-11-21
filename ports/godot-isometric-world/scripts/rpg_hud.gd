extends Control
## AAA Ornate Dark-Fantasy Action-RPG HUD, 29-Node Diamond Constellation Skill Tree ([K]),
## and Paperdoll Character & Equipment Sheet ([I]) for KI Legends.
## Built strictly with painted studio textures (portraits, filigree crest, sculpted beveled rings,
## 116+ canonical icons-v3, gear icons-v2, ui-v2 emblems), custom liquid-energy bar shader,
## circular icon shader, and canonical 4-race x 29-node data from res://data/progression.json.

const MapStyle := preload("res://scripts/map_style.gd")

const LAND_TO_RACE := {
	"pyra": "legend",
	"verdant": "planetary",
	"aether": "sage",
	"nexus": "android",
}

const LAND_META := {
	"pyra": {
		"hero": "Ignis",
		"title": "Wojownik Pyry",
		"realm": "Pyra",
		"res_name": "Żar",
		"res_icon": "hud-zar.webp",
		"res_dark": Color(0.46, 0.14, 0.03),
		"res_bright": Color(1.0, 0.54, 0.14),
		"accent": Color(1.0, 0.56, 0.22),
		"portrait": "res://assets/ui/portrait_pyra.webp",
		"race_icon": "race-legend.webp",
	},
	"verdant": {
		"hero": "Sylvan",
		"title": "Strażnik Verdantii",
		"realm": "Verdantia",
		"res_name": "Nurt",
		"res_icon": "hud-ki.webp",
		"res_dark": Color(0.06, 0.34, 0.16),
		"res_bright": Color(0.32, 0.92, 0.52),
		"accent": Color(0.38, 0.92, 0.56),
		"portrait": "res://assets/ui/portrait_verdant.webp",
		"race_icon": "race-planetary.webp",
	},
	"aether": {
		"hero": "Aurelius",
		"title": "Mędrzec Aetherii",
		"realm": "Aetheria",
		"res_name": "Skupienie",
		"res_icon": "hud-ki.webp",
		"res_dark": Color(0.08, 0.30, 0.48),
		"res_bright": Color(0.42, 0.88, 1.0),
		"accent": Color(0.46, 0.88, 1.0),
		"portrait": "res://assets/ui/portrait_aether.webp",
		"race_icon": "race-sage.webp",
	},
	"nexus": {
		"hero": "Cypher-9",
		"title": "Egzekutor Nexusa",
		"realm": "Nexus-9",
		"res_name": "Rdzeń",
		"res_icon": "hud-rdzen.webp",
		"res_dark": Color(0.04, 0.32, 0.42),
		"res_bright": Color(0.18, 0.96, 0.98),
		"accent": Color(0.24, 0.96, 0.98),
		"portrait": "res://assets/ui/portrait_nexus.webp",
		"race_icon": "race-android.webp",
	},
}

const HOTBAR_NODE_IDS := ["R", "A1", "B1", "C1", "A4", "T"]
const HOTBAR_KEYS := ["Q", "1", "2", "3", "4", "R"]
const HOTBAR_CDS := [1.2, 5.5, 6.5, 11.0, 10.0, 28.0]

const BRANCH_COLORS := {
	"A": Color(0.98, 0.44, 0.24),
	"B": Color(0.38, 0.90, 0.54),
	"C": Color(0.36, 0.82, 1.0),
	"R": Color(0.98, 0.82, 0.38),
	"T": Color(1.0, 0.78, 0.26),
}

const TYPE_LABELS := {
	"starting": "UMIEJĘTNOŚĆ STARTOWA",
	"active": "UMIEJĘTNOŚĆ AKTYWNA",
	"passive": "WĘZEŁ PASYWNY",
	"choice": "WYBÓR ROZŁĄCZNY",
	"ultimate": "ULTIMATE GAŁĘZI",
	"transformation": "TRANSFORMACJA TRYBU KI",
}

var equip_slots: Array[Dictionary] = [
	{"side": -1, "row": 0, "icon": "gear-helmet.webp", "name": "Hełm Żaru", "rarity": Color(0.38, 0.74, 1.0), "def": 6, "hp": 20},
	{"side": -1, "row": 1, "icon": "gear-amulet.webp", "name": "Amulet Ki", "rarity": Color(0.76, 0.46, 1.0), "ki": 12},
	{"side": -1, "row": 2, "icon": "gear-sword.webp", "name": "Ostrze Superior", "rarity": Color(1.0, 0.76, 0.28), "atk": 12},
	{"side": -1, "row": 3, "icon": "gear-gloves.webp", "name": "Rękawice Klanu", "rarity": Color(0.36, 0.88, 0.52), "atk": 4, "def": 4},
	{"side": 1, "row": 0, "icon": "gear-vest.webp", "name": "Kirys Strażnika", "rarity": Color(0.38, 0.74, 1.0), "def": 10, "hp": 35},
	{"side": 1, "row": 1, "icon": "gear-shield.webp", "name": "Tarcza Bazaltu", "rarity": Color(0.36, 0.88, 0.52), "def": 10},
	{"side": 1, "row": 2, "icon": "gear-ring.webp", "name": "Pierścień Eteru", "rarity": Color(0.76, 0.46, 1.0), "ki": 10},
	{"side": 1, "row": 3, "icon": "gear-boots.webp", "name": "Buty Szlaku +5%", "rarity": Color(0.36, 0.88, 0.52), "spd": 10},
]

var backpack_items: Array[Dictionary] = [
	{"id": "potion_hp", "name": "Wielki Eliksir Życia", "icon": "gear-potion.webp", "qty": 5, "slot": -1, "heal_hp": 150, "rarity": Color(0.95, 0.34, 0.32)},
	{"id": "potion_ki", "name": "Eliksir Energii Ki", "icon": "emblem_potion.webp", "qty": 3, "slot": -1, "heal_ki": 80, "rarity": Color(0.34, 0.78, 1.0)},
	{"id": "tusk_beast", "name": "Kieł Wilka", "icon": "gear-tusk.webp", "qty": 12, "slot": -1, "rarity": Color(0.86, 0.68, 0.44)},
	{"id": "scroll_tp", "name": "Zwój Powrotu", "icon": "emblem_scroll.webp", "qty": 2, "slot": -1, "rarity": Color(0.96, 0.84, 0.44)},
	{"id": "crystal_ki", "name": "Kryształ Ki", "icon": "emblem_crystal.webp", "qty": 4, "slot": -1, "rarity": Color(0.46, 0.88, 1.0)},
	{"id": "pouch_gold", "name": "Sakiewka Złota", "icon": "gear-coin.webp", "qty": 1, "slot": -1, "gold": 500, "rarity": Color(1.0, 0.86, 0.32)},
	{}, {}, {}, {},
	{}, {}, {}, {}, {},
]

var world: Node2D
var current_land := "pyra"
var hero_land := ""
var hero_custom_name := ""
var nearest_loc := "Twierdza Popiołu"
var in_safe_city := true
var time_mode_short := "Dzień"

var hero_hp := 140.0
var hero_max_hp := 140.0
var hero_ki := 40.0
var hero_max_ki := 40.0
var hero_res := 64.0
var hero_xp := 340.0
var hero_max_xp := 1000.0
var hero_level := 5
var hero_gold := 120
var skill_points := 4
var free_stat_points := 5
var bonus_stat_pts: Dictionary = {"hp": 0, "ki": 0, "atk": 0, "def": 0, "spd": 0, "crit": 0}
var stat_plus_hitboxes: Array[Dictionary] = []
var backpack_hitboxes: Array[Dictionary] = []
var cooldowns: Array[float] = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0]

# Per-race unlocked node sets (realistic progression showcase at Lv. 5)
var unlocked_by_race: Dictionary = {
	"legend": {"R": true, "A1": true, "A2": true, "B1": true, "C1": true},
	"planetary": {"R": true, "A1": true, "A2": true, "B1": true, "C1": true},
	"sage": {"R": true, "A1": true, "B1": true, "B2": true, "C1": true},
	"android": {"R": true, "A1": true, "B1": true, "C1": true, "C2": true},
}

var progression_db: Dictionary = {}
var ui_tex_cache: Dictionary = {}
var bar_shader: Shader
var circle_shader: Shader

var show_talents := false
var show_character := false
var selected_node_id := "A4"
var hovered_node_id := ""
var hovered_hotbar_idx := -1

# Interactive layout hitboxes (rebuilt on layout/draw)
var nav_hitboxes: Array[Dictionary] = []
var hotbar_hitboxes: Array[Rect2] = []
var util_hitboxes: Array[Dictionary] = []
var talent_node_rects: Dictionary = {}
var talent_close_rect := Rect2()
var talent_unlock_btn_rect := Rect2()
var char_close_rect := Rect2()

# Live shader-backed Controls for crisp GPU-rendered liquid bars & circular icons
var hud_widgets_root := Control.new()
var portrait_rect := TextureRect.new()
var portrait_mat := ShaderMaterial.new()
var portrait_ring_rect := TextureRect.new()
var race_badge_rect := TextureRect.new()
var hp_bar_rect: ColorRect
var hp_bar_mat := ShaderMaterial.new()
var ki_bar_rect: ColorRect
var ki_bar_mat := ShaderMaterial.new()
var res_bar_rect: ColorRect
var res_bar_mat := ShaderMaterial.new()
var xp_bar_rect: ColorRect
var xp_bar_mat := ShaderMaterial.new()
var crest_rect := TextureRect.new()
var hotbar_icon_rects: Array[TextureRect] = []
var hotbar_icon_mats: Array[ShaderMaterial] = []
var hotbar_ring_rects: Array[TextureRect] = []

var modal_backdrop := TextureRect.new()
var modal_overlay := Control.new()
var talent_icon_nodes: Dictionary = {}
var inspector_icon_rect := TextureRect.new()
var inspector_icon_mat := ShaderMaterial.new()
var inspector_ring_rect := TextureRect.new()
var char_portrait_rect := TextureRect.new()
var char_portrait_mat := ShaderMaterial.new()
var char_portrait_ring := TextureRect.new()

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_PASS
	_load_progression_db()
	bar_shader = load("res://shaders/rpg_bar.gdshader")
	circle_shader = load("res://shaders/circle_icon.gdshader")
	_build_shader_widgets()
	_build_modal_layer()
	if get_viewport() != null:
		get_viewport().size_changed.connect(_on_resized)
	resized.connect(_on_resized)
	set_region("pyra")
	_layout_all()

func _vp_size() -> Vector2:
	if get_viewport() != null:
		var vs := get_viewport_rect().size
		if vs.x > 10.0 and vs.y > 10.0:
			return vs
	return size

func _load_tex(path: String) -> Texture2D:
	if path.is_empty():
		return null
	if ui_tex_cache.has(path):
		return ui_tex_cache[path] as Texture2D
	if world != null and world.has_method("load_tex"):
		var wtex: Texture2D = world.load_tex(path)
		if wtex != null:
			ui_tex_cache[path] = wtex
			return wtex
	var abs_p := ProjectSettings.globalize_path(path)
	if FileAccess.file_exists(abs_p) or FileAccess.file_exists(path):
		var img := Image.new()
		if img.load(abs_p if FileAccess.file_exists(abs_p) else path) == OK:
			var itex := ImageTexture.create_from_image(img)
			ui_tex_cache[path] = itex
			return itex
	return null

func _icon_tex(fname: String) -> Texture2D:
	if fname.is_empty():
		return null
	return _load_tex("res://assets/ui/icons/" + fname)

func _load_progression_db() -> void:
	if FileAccess.file_exists("res://data/progression.json"):
		var raw := FileAccess.get_file_as_string("res://data/progression.json")
		var parsed: Variant = JSON.parse_string(raw)
		if parsed is Dictionary:
			progression_db = (parsed as Dictionary).get("races", {})

func set_hero_land(land: String) -> void:
	if LAND_META.has(land):
		hero_land = land

func _hero_land() -> String:
	return hero_land if hero_land != "" else current_land

func _race_key() -> String:
	return str(LAND_TO_RACE.get(_hero_land(), "legend"))

func _race_data() -> Dictionary:
	var rk := _race_key()
	if progression_db.has(rk):
		return progression_db[rk] as Dictionary
	return {}

func _unlocked_map() -> Dictionary:
	var rk := _race_key()
	if not unlocked_by_race.has(rk):
		unlocked_by_race[rk] = {"R": true}
	return unlocked_by_race[rk] as Dictionary

func _node_by_id(nid: String) -> Dictionary:
	var rd := _race_data()
	var nodes_arr: Array = rd.get("nodes", [])
	for n_var in nodes_arr:
		if n_var is Dictionary:
			var nd: Dictionary = n_var
			if str(nd.get("id", "")) == nid:
				return nd
	return {}

func _node_state(nd: Dictionary) -> String:
	var nid := str(nd.get("id", ""))
	var umap := _unlocked_map()
	if umap.get(nid, false):
		return "unlocked"
	# Check exclusive choices
	var rd := _race_data()
	var excl_arr: Array = rd.get("exclusiveChoices", [])
	for pair_var in excl_arr:
		if pair_var is Array:
			var pair: Array = pair_var
			if pair.size() == 2:
				var p0 := str(pair[0])
				var p1 := str(pair[1])
				if nid == p0 and umap.get(p1, false):
					return "excluded"
				if nid == p1 and umap.get(p0, false):
					return "excluded"
	var reqs: Array = nd.get("requiresAny", [])
	if reqs.is_empty():
		return "available"
	for r_var in reqs:
		if umap.get(str(r_var), false):
			return "available"
	return "locked"

func _make_bar_rect(mat: ShaderMaterial, dark: Color, bright: Color, taper: float, ticks: float) -> ColorRect:
	var cr := ColorRect.new()
	cr.mouse_filter = Control.MOUSE_FILTER_IGNORE
	mat.shader = bar_shader
	mat.set_shader_parameter("color_dark", dark)
	mat.set_shader_parameter("color_bright", bright)
	mat.set_shader_parameter("bg_color", Color(0.05, 0.04, 0.06, 0.90))
	mat.set_shader_parameter("border_color", Color(0.82, 0.64, 0.34, 0.92))
	mat.set_shader_parameter("taper_right", taper)
	mat.set_shader_parameter("tick_count", ticks)
	mat.set_shader_parameter("fill_ratio", 1.0)
	cr.material = mat
	return cr

func _build_shader_widgets() -> void:
	hud_widgets_root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	hud_widgets_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(hud_widgets_root)

	# Liquid energy shader bars (HP, KI, Racial Resource, XP filament)
	hp_bar_rect = _make_bar_rect(hp_bar_mat, Color(0.42, 0.04, 0.06), Color(0.96, 0.20, 0.16), 0.065, 0.0)
	ki_bar_rect = _make_bar_rect(ki_bar_mat, Color(0.05, 0.22, 0.48), Color(0.24, 0.78, 1.0), 0.065, 0.0)
	res_bar_rect = _make_bar_rect(res_bar_mat, Color(0.46, 0.14, 0.03), Color(1.0, 0.54, 0.14), 0.065, 0.0)
	xp_bar_rect = _make_bar_rect(xp_bar_mat, Color(0.48, 0.32, 0.08), Color(1.0, 0.84, 0.34), 0.0, 10.0)
	hud_widgets_root.add_child(hp_bar_rect)
	hud_widgets_root.add_child(ki_bar_rect)
	hud_widgets_root.add_child(res_bar_rect)
	hud_widgets_root.add_child(xp_bar_rect)

	# Circularly masked Hero Portrait + sculpted antique-gold bezel ring + race badge
	portrait_mat.shader = circle_shader
	portrait_mat.set_shader_parameter("saturation", 1.05)
	portrait_mat.set_shader_parameter("brightness", 1.04)
	portrait_mat.set_shader_parameter("inner_vignette", 0.32)
	portrait_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	portrait_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	portrait_rect.material = portrait_mat
	portrait_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hud_widgets_root.add_child(portrait_rect)

	portrait_ring_rect.texture = _load_tex("res://assets/ui/obsidian/ring_star.webp")
	portrait_ring_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	portrait_ring_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	portrait_ring_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hud_widgets_root.add_child(portrait_ring_rect)

	race_badge_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	race_badge_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	race_badge_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hud_widgets_root.add_child(race_badge_rect)

	# Keep crest_rect hidden in Wild Rift mobile layout so bottom-center stays ultra-clean
	crest_rect.visible = false
	hud_widgets_root.add_child(crest_rect)

	# 6 Circular Wild Rift Right-Thumb Combat Buttons (Q Basic, 1-4 Active Arc, R Ultimate)
	var ring_key := _load_tex("res://assets/ui/obsidian/ring_star.webp")
	var ring_std := _load_tex("res://assets/ui/obsidian/ring_lava.webp")
	for i in 6:
		var itr := TextureRect.new()
		itr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		itr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
		itr.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var imat := ShaderMaterial.new()
		imat.shader = circle_shader
		imat.set_shader_parameter("saturation", 1.10)
		imat.set_shader_parameter("brightness", 1.06)
		imat.set_shader_parameter("inner_vignette", 0.22)
		imat.set_shader_parameter("rim_glow", Color(1.0, 0.72, 0.24, 0.55) if (i == 0 or i == 5) else Color(0.98, 0.68, 0.22, 0.35))
		itr.material = imat
		hud_widgets_root.add_child(itr)
		hotbar_icon_rects.append(itr)
		hotbar_icon_mats.append(imat)

		var rtr := TextureRect.new()
		rtr.texture = ring_key if (i == 0 or i == 5) else ring_std
		rtr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		rtr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		rtr.mouse_filter = Control.MOUSE_FILTER_IGNORE
		hud_widgets_root.add_child(rtr)
		hotbar_ring_rects.append(rtr)

func _build_modal_layer() -> void:
	modal_overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	modal_overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	modal_overlay.visible = false
	add_child(modal_overlay)

	modal_backdrop.texture = _load_tex("res://assets/ui/talent_backdrop.webp")
	modal_backdrop.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	modal_backdrop.stretch_mode = TextureRect.STRETCH_SCALE
	modal_backdrop.mouse_filter = Control.MOUSE_FILTER_IGNORE
	modal_overlay.add_child(modal_backdrop)

	# Inspector enlarged circular icon widget (for [K] Skill Tree)
	inspector_icon_mat.shader = circle_shader
	inspector_icon_mat.set_shader_parameter("inner_vignette", 0.28)
	inspector_icon_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	inspector_icon_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	inspector_icon_rect.material = inspector_icon_mat
	inspector_icon_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	modal_overlay.add_child(inspector_icon_rect)

	inspector_ring_rect.texture = _load_tex("res://assets/ui/hud_node_ring_keystone.png")
	inspector_ring_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	inspector_ring_rect.stretch_mode = TextureRect.STRETCH_SCALE
	inspector_ring_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	modal_overlay.add_child(inspector_ring_rect)

	# Character Paperdoll Hero Portrait widget (for [I] Character Sheet)
	char_portrait_mat.shader = circle_shader
	char_portrait_mat.set_shader_parameter("inner_vignette", 0.28)
	char_portrait_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	char_portrait_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	char_portrait_rect.material = char_portrait_mat
	char_portrait_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	modal_overlay.add_child(char_portrait_rect)

	char_portrait_ring.texture = _load_tex("res://assets/ui/hud_portrait_ring.png")
	char_portrait_ring.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	char_portrait_ring.stretch_mode = TextureRect.STRETCH_SCALE
	char_portrait_ring.mouse_filter = Control.MOUSE_FILTER_IGNORE
	modal_overlay.add_child(char_portrait_ring)

	# Dedicated topmost canvas for modal graphics (constellation lines, nodes, labels, gear sockets)
	var modal_canvas := Control.new()
	modal_canvas.name = "ModalCanvas"
	modal_canvas.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	modal_canvas.mouse_filter = Control.MOUSE_FILTER_IGNORE
	modal_canvas.draw.connect(_draw_modal_canvas.bind(modal_canvas))
	modal_overlay.add_child(modal_canvas)

	# Put custom HUD text/sockets/overlays above hud_widgets_root so labels draw cleanly over liquid bars!
	var hud_fg := Control.new()
	hud_fg.name = "HudForeground"
	hud_fg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	hud_fg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hud_fg.draw.connect(_draw_hud_foreground.bind(hud_fg))
	add_child(hud_fg)
	# Ensure modal_overlay always sits on top of hud_fg
	move_child(modal_overlay, get_child_count() - 1)

func _on_resized() -> void:
	_layout_all()
	_refresh_visuals()

func _refresh_visuals() -> void:
	queue_redraw()
	var fg := get_node_or_null("HudForeground") as Control
	if fg != null:
		fg.queue_redraw()
	var mc := modal_overlay.get_node_or_null("ModalCanvas") as Control
	if mc != null:
		mc.queue_redraw()

func _equip_bonus(key: String) -> float:
	var sum := 0.0
	for sl: Dictionary in equip_slots:
		sum += float(sl.get(key, 0.0))
	return sum

func get_total_attack() -> int:
	var rd := _race_data()
	var base: Dictionary = rd.get("base", {})
	var per_lv: Dictionary = rd.get("perLevel", {})
	var lv_off := float(hero_level - 1)
	return int(round(float(base.get("attack", 14)) + float(per_lv.get("attack", 4)) * lv_off + float(bonus_stat_pts.get("atk", 0)) * 5.0 + _equip_bonus("atk")))

func get_total_defense() -> int:
	var rd := _race_data()
	var base: Dictionary = rd.get("base", {})
	var per_lv: Dictionary = rd.get("perLevel", {})
	var lv_off := float(hero_level - 1)
	return int(round(float(base.get("defense", 5)) + float(per_lv.get("defense", 2.2)) * lv_off + float(bonus_stat_pts.get("def", 0)) * 4.0 + _equip_bonus("def")))

func get_total_speed() -> int:
	var rd := _race_data()
	var base: Dictionary = rd.get("base", {})
	var lv_off := float(mini(hero_level - 1, 19))
	var spd_base := float(base.get("speed", 185))
	return int(round(spd_base * (1.0 + 0.05 * lv_off) + float(bonus_stat_pts.get("spd", 0)) * 15.0 + _equip_bonus("spd")))

func get_speed_mult() -> float:
	var rd := _race_data()
	var base: Dictionary = rd.get("base", {})
	var spd_base := maxf(float(base.get("speed", 185)), 1.0)
	return clampf(float(get_total_speed()) / spd_base, 0.8, 3.5)

func get_total_crit() -> float:
	var rd := _race_data()
	var base: Dictionary = rd.get("base", {})
	var per_lv: Dictionary = rd.get("perLevel", {})
	var lv_off := float(hero_level - 1)
	return float(base.get("criticalChancePercent", 5.0)) + float(per_lv.get("criticalChancePercent", 0.25)) * lv_off + float(bonus_stat_pts.get("crit", 0)) * 2.0 + _equip_bonus("crit")

func recalc_stats(refill: bool = false) -> void:
	var rd := _race_data()
	var base: Dictionary = rd.get("base", {})
	var per_lv: Dictionary = rd.get("perLevel", {})
	var lv_off := float(hero_level - 1)
	var old_mhp := hero_max_hp
	var old_mki := hero_max_ki
	hero_max_hp = float(base.get("hp", 140)) + float(per_lv.get("hp", 35)) * lv_off + float(bonus_stat_pts.get("hp", 0)) * 25.0 + _equip_bonus("hp")
	hero_max_ki = float(base.get("ki", 45)) + float(per_lv.get("ki", 4)) * lv_off + float(bonus_stat_pts.get("ki", 0)) * 15.0 + _equip_bonus("ki")
	if refill:
		hero_hp = hero_max_hp
		hero_ki = hero_max_ki
	else:
		hero_hp = clampf(hero_hp + maxf(0.0, hero_max_hp - old_mhp), 1.0, hero_max_hp)
		hero_ki = clampf(hero_ki + maxf(0.0, hero_max_ki - old_mki), 0.0, hero_max_ki)
	_sync_bar_uniforms()
	_refresh_visuals()

func add_stat_points_gm(stat_key: String, delta_pts: int) -> void:
	if not bonus_stat_pts.has(stat_key):
		return
	bonus_stat_pts[stat_key] = maxi(0, int(bonus_stat_pts[stat_key]) + delta_pts)
	recalc_stats(false)

static func _catalog_item_by_id(iid: String) -> Dictionary:
	var gm_script = preload("res://scripts/gm_panel.gd")
	for it: Dictionary in gm_script.ITEM_CATALOG:
		if str(it.get("id", "")) == iid:
			return it.duplicate(true)
	return {}

func apply_server_character(ch: Dictionary) -> void:
	var st: Dictionary = ch.get("state", {})
	var stats: Dictionary = ch.get("stats", {})
	if str(ch.get("name", "")) != "":
		hero_custom_name = str(ch.get("name", ""))
	hero_level = maxi(1, int(ch.get("level", hero_level)))
	hero_gold = maxi(0, int(ch.get("gold", hero_gold)))
	hero_xp = float(st.get("xp", hero_xp))
	hero_max_xp = maxf(1.0, float(stats.get("xpNeeded", 200 + (hero_level - 1) * 160)))
	free_stat_points = maxi(0, int(st.get("freeStatPoints", free_stat_points)))
	skill_points = maxi(0, int(st.get("skillPoints", skill_points)))
	var bs: Dictionary = st.get("bonusStats", {})
	for k in ["hp", "ki", "atk", "def", "spd", "crit"]:
		if bs.has(k):
			bonus_stat_pts[k] = maxi(0, int(bs[k]))
	var nodes_arr: Array = st.get("unlockedNodes", [])
	if not nodes_arr.is_empty():
		var umap := _unlocked_map()
		umap.clear()
		for n in nodes_arr:
			umap[str(n)] = true
	var eq_raw: Dictionary = st.get("equipment", {})
	for si in equip_slots.size():
		var sk := str(si)
		if eq_raw.has(sk):
			var iid = eq_raw[sk]
			if iid == null or str(iid) == "":
				equip_slots[si]["id"] = ""
				equip_slots[si]["name"] = "Pusty"
				equip_slots[si]["icon"] = ""
				for bk in ["atk", "def", "hp", "ki", "spd", "crit"]:
					equip_slots[si].erase(bk)
			else:
				var cdef := _catalog_item_by_id(str(iid))
				if not cdef.is_empty():
					cdef["side"] = equip_slots[si].get("side", "left")
					cdef["row"] = equip_slots[si].get("row", si % 4)
					equip_slots[si] = cdef
	var bp_raw: Array = st.get("backpack", [])
	if bp_raw.size() == backpack_items.size():
		for bi in backpack_items.size():
			var entry = bp_raw[bi]
			if entry == null or not (entry is Dictionary):
				backpack_items[bi] = {}
			else:
				var cdef := _catalog_item_by_id(str((entry as Dictionary).get("id", "")))
				if not cdef.is_empty():
					cdef["qty"] = maxi(1, int((entry as Dictionary).get("qty", 1)))
					backpack_items[bi] = cdef
				else:
					backpack_items[bi] = {}
	recalc_stats(false)
	hero_hp = clampf(float(st.get("hp", hero_hp)), 1.0, hero_max_hp)
	hero_ki = clampf(float(st.get("ki", hero_ki)), 0.0, hero_max_ki)
	_sync_bar_uniforms()
	_sync_talent_node_styles()
	_refresh_visuals()

func spend_free_stat_point(stat_key: String) -> bool:
	if free_stat_points <= 0 or not bonus_stat_pts.has(stat_key):
		return false
	if world != null and world.has_method("dispatch_server_action") and world.dispatch_server_action({"type": "allocate_stat", "stat": stat_key}):
		return true
	free_stat_points -= 1
	bonus_stat_pts[stat_key] = int(bonus_stat_pts[stat_key]) + 1
	recalc_stats(false)
	return true

func add_item_to_backpack(item_def: Dictionary, qty: int = 1) -> bool:
	var iid := str(item_def.get("id", ""))
	# Stack into existing slot if same item id
	for i in backpack_items.size():
		if not backpack_items[i].is_empty() and str(backpack_items[i].get("id", "")) == iid:
			backpack_items[i]["qty"] = int(backpack_items[i].get("qty", 1)) + qty
			_refresh_visuals()
			return true
	# Otherwise put into first empty slot
	for i in backpack_items.size():
		if backpack_items[i].is_empty():
			var rec := item_def.duplicate(true)
			rec["qty"] = qty
			backpack_items[i] = rec
			_refresh_visuals()
			return true
	return false

func use_backpack_slot(idx: int) -> void:
	if idx < 0 or idx >= backpack_items.size():
		return
	var it: Dictionary = backpack_items[idx]
	if it.is_empty():
		return
	if world != null and world.has_method("dispatch_server_action") and world.dispatch_server_action({"type": "use_item", "backpackIndex": idx}):
		if world.get("audio") != null:
			world.audio.sfx("common/potion" if (it.has("heal_hp") or it.has("heal_ki")) else "ui/click")
		return
	var slot_i := int(it.get("slot", -1))
	if slot_i >= 0 and slot_i < equip_slots.size():
		var old_eq := equip_slots[slot_i].duplicate(true)
		var new_eq := it.duplicate(true)
		new_eq["side"] = old_eq["side"]
		new_eq["row"] = old_eq["row"]
		equip_slots[slot_i] = new_eq
		var cur_q := int(it.get("qty", 1)) - 1
		if cur_q > 0:
			backpack_items[idx]["qty"] = cur_q
		else:
			old_eq["slot"] = slot_i
			old_eq["qty"] = 1
			backpack_items[idx] = old_eq
		recalc_stats(false)
		return
	# Consumable action
	if world != null and world.get("audio") != null:
		world.audio.sfx("common/potion" if (it.has("heal_hp") or it.has("heal_ki")) else "ui/click")
	if it.has("heal_hp"):
		hero_hp = minf(hero_max_hp, hero_hp + float(it["heal_hp"]))
	elif it.has("heal_ki"):
		hero_ki = minf(hero_max_ki, hero_ki + float(it["heal_ki"]))
	elif it.has("gold"):
		hero_gold += int(it["gold"])
	elif str(it.get("id", "")) == "scroll_tp" and world != null:
		world.teleport_to_capital()
	var nq := int(it.get("qty", 1)) - 1
	if nq > 0:
		backpack_items[idx]["qty"] = nq
	else:
		backpack_items[idx] = {}
	recalc_stats(false)

func set_region(land: String) -> void:
	current_land = land
	var meta: Dictionary = LAND_META.get(_hero_land(), LAND_META["pyra"])
	hero_res = 68.0
	selected_node_id = "A4"

	portrait_rect.texture = _load_tex(str(meta["portrait"]))
	char_portrait_rect.texture = _load_tex(str(meta["portrait"]))
	race_badge_rect.texture = _icon_tex(str(meta["race_icon"]))
	var rk := _race_key()
	for i in mini(hotbar_icon_rects.size(), HOTBAR_NODE_IDS.size()):
		if i == 0:
			hotbar_icon_rects[i].texture = _load_tex("res://assets/ui/obsidian/btn_attack.webp")
			hotbar_icon_rects[i].material = null
			hotbar_icon_rects[i].stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
			hotbar_ring_rects[i].visible = false
		elif i == 2:
			hotbar_icon_rects[i].texture = _load_tex("res://assets/ui/obsidian/btn_skill2.webp")
			hotbar_icon_rects[i].material = null
			hotbar_icon_rects[i].stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
			hotbar_ring_rects[i].visible = false
		else:
			hotbar_icon_rects[i].texture = _icon_tex("%s-%s.webp" % [rk, str(HOTBAR_NODE_IDS[i])])
			hotbar_icon_rects[i].material = hotbar_icon_mats[i]
			hotbar_ring_rects[i].visible = true

	res_bar_mat.set_shader_parameter("color_dark", meta["res_dark"])
	res_bar_mat.set_shader_parameter("color_bright", meta["res_bright"])
	recalc_stats(true)
	_rebuild_talent_icon_widgets()
	_layout_all()
	_refresh_visuals()

func _sync_bar_uniforms() -> void:
	hp_bar_mat.set_shader_parameter("fill_ratio", clampf(hero_hp / maxf(hero_max_hp, 1.0), 0.0, 1.0))
	ki_bar_mat.set_shader_parameter("fill_ratio", clampf(hero_ki / maxf(hero_max_ki, 1.0), 0.0, 1.0))
	res_bar_mat.set_shader_parameter("fill_ratio", clampf(hero_res / 100.0, 0.0, 1.0))
	xp_bar_mat.set_shader_parameter("fill_ratio", clampf(hero_xp / maxf(hero_max_xp, 1.0), 0.0, 1.0))

func sync_status(loc: String, safe: bool) -> void:
	nearest_loc = loc if not loc.is_empty() else "Stolica"
	in_safe_city = safe
	_refresh_visuals()

func set_time_label(lbl: String) -> void:
	if lbl.find("Zmierzch") >= 0:
		time_mode_short = "Zmierzch"
	elif lbl.find("Noc") >= 0:
		time_mode_short = "Noc"
	else:
		time_mode_short = "Dzień"
	_refresh_visuals()

func trigger_skill(idx: int) -> void:
	if idx < 0 or idx >= cooldowns.size():
		return
	if cooldowns[idx] > 0.05:
		return
	cooldowns[idx] = float(HOTBAR_CDS[idx])
	hero_ki = maxf(6.0, hero_ki - (8.0 if idx > 0 else 0.0))
	hero_res = minf(100.0, hero_res + 12.0)
	hero_xp = fmod(hero_xp + 55.0, hero_max_xp)
	_sync_bar_uniforms()
	_refresh_visuals()

func toggle_talents() -> void:
	show_talents = not show_talents
	if show_talents:
		show_character = false
		_rebuild_talent_icon_widgets()
	_sync_modal_visibility()

func toggle_character() -> void:
	show_character = not show_character
	if show_character:
		show_talents = false
	_sync_modal_visibility()

func close_modals() -> void:
	show_talents = false
	show_character = false
	_sync_modal_visibility()

func _sync_modal_visibility() -> void:
	var any_open := show_talents or show_character
	modal_overlay.visible = any_open
	hud_widgets_root.visible = not any_open
	var fg := get_node_or_null("HudForeground") as Control
	if fg != null:
		fg.visible = not any_open
	inspector_icon_rect.visible = show_talents
	inspector_ring_rect.visible = show_talents
	for k in talent_icon_nodes.keys():
		var pair: Dictionary = talent_icon_nodes[k]
		(pair["icon"] as TextureRect).visible = show_talents
		(pair["ring"] as TextureRect).visible = show_talents
	char_portrait_rect.visible = show_character
	char_portrait_ring.visible = show_character
	if world != null and world.has_method("layout_minimap"):
		world.layout_minimap()
	_layout_all()
	_refresh_visuals()

func _process(delta: float) -> void:
	var changed := false
	for i in cooldowns.size():
		if cooldowns[i] > 0.0:
			cooldowns[i] = maxf(0.0, cooldowns[i] - delta)
			changed = true
	if hero_ki < hero_max_ki:
		hero_ki = minf(hero_max_ki, hero_ki + delta * 3.8)
		changed = true
	if changed:
		_sync_bar_uniforms()
		_refresh_visuals()

# ==============================================================================
# LAYOUT & CONSTELLATION GRAPH COORDINATES
# ==============================================================================

func _modal_rect() -> Rect2:
	var vs := _vp_size()
	var mw := minf(vs.x - 110.0, 1280.0)
	var mh := minf(vs.y - 84.0, 718.0)
	return Rect2((vs.x - mw) * 0.5, (vs.y - mh) * 0.5, mw, mh)

func _xp_pill_rect() -> Rect2:
	var vs := _vp_size()
	var pw := 396.0
	var ph := 28.0
	return Rect2((vs.x - pw) * 0.5, vs.y - ph - 10.0, pw, ph)

func _wild_rift_slot_specs() -> Array[Dictionary]:
	# Ergonomic right-thumb Wild Rift combat cluster in bottom-right corner (large thumb-friendly orbs for mobile!)
	var vs := _vp_size()
	var base := Vector2(vs.x - 98.0, vs.y - 96.0)
	var arc_r := 148.0
	var specs: Array[Dictionary] = [
		{"center": base, "r": 48.0, "keystone": true},
	]
	var arc_angles := [175.0, 206.0, 237.0, 268.0]
	for ang_deg in arc_angles:
		var rad := deg_to_rad(float(ang_deg))
		specs.append({
			"center": base + Vector2(cos(rad), sin(rad)) * arc_r,
			"r": 34.0,
			"keystone": false,
		})
	# Grand Ultimate [R] on upper-outer crown of thumb arc
	var ult_rad := deg_to_rad(220.0)
	specs.append({
		"center": base + Vector2(cos(ult_rad), sin(ult_rad)) * 224.0,
		"r": 38.0,
		"keystone": true,
	})
	return specs

func _constellation_node_pos(nid: String, graph_rect: Rect2) -> Vector2:
	var gx := graph_rect.position.x
	var gy := graph_rect.position.y
	var gw := graph_rect.size.x
	var gh := graph_rect.size.y

	if nid == "R":
		return Vector2(gx + gw * 0.50, gy + gh * 0.928)
	if nid == "T":
		return Vector2(gx + gw * 0.50, gy + gh * 0.068)

	var branch := nid.substr(0, 1)
	var num := int(nid.substr(1))
	var bx_center := 0.50
	if branch == "A":
		bx_center = 0.175
	elif branch == "B":
		bx_center = 0.500
	elif branch == "C":
		bx_center = 0.825

	var spread := 0.088
	var nx := bx_center
	var ny := 0.50
	match num:
		1:
			nx = bx_center
			ny = 0.790
		2:
			nx = bx_center - spread
			ny = 0.665
		3:
			nx = bx_center + spread
			ny = 0.665
		4:
			nx = bx_center
			ny = 0.542
		5:
			nx = bx_center - spread
			ny = 0.422
		6:
			nx = bx_center + spread
			ny = 0.422
		7:
			nx = bx_center - spread * 0.92
			ny = 0.305
		8:
			nx = bx_center + spread * 0.92
			ny = 0.305
		9:
			nx = bx_center
			ny = 0.195
	return Vector2(gx + gw * nx, gy + gh * ny)

func _nav_ribbon_rect() -> Rect2:
	# Positioned at y=94px so it NEVER collides with the Android top-center "WRÓĆ · TRYB SERWISOWY" bar (y=0..84px)!
	var vs := _vp_size()
	var left_bound := 340.0
	var right_bound := vs.x - 294.0
	var avail_w := maxf(right_bound - left_bound, 500.0)
	var nav_w := minf(636.0, avail_w - 12.0)
	var nav_x := left_bound + (avail_w - nav_w) * 0.5
	return Rect2(nav_x, 94.0, nav_w, 42.0)

func _constellation_graph_rect(mr: Rect2) -> Rect2:
	return Rect2(mr.position.x + 58.0, mr.position.y + 114.0, mr.size.x * 0.635, mr.size.y - 172.0)

func _inspector_rect(mr: Rect2) -> Rect2:
	var gr := _constellation_graph_rect(mr)
	var ix := gr.position.x + gr.size.x + 18.0
	var iw := (mr.position.x + mr.size.x - 58.0) - ix
	return Rect2(ix, gr.position.y + 6.0, maxf(iw, 240.0), gr.size.y - 12.0)

func _rebuild_talent_icon_widgets() -> void:
	for k in talent_icon_nodes.keys():
		var pair: Dictionary = talent_icon_nodes[k]
		if is_instance_valid(pair["icon"]):
			(pair["icon"] as TextureRect).queue_free()
		if is_instance_valid(pair["ring"]):
			(pair["ring"] as TextureRect).queue_free()
	talent_icon_nodes.clear()

	var rd := _race_data()
	var rk := _race_key()
	var nodes_arr: Array = rd.get("nodes", [])
	var mc := modal_overlay.get_node_or_null("ModalCanvas")
	for n_var in nodes_arr:
		if not (n_var is Dictionary):
			continue
		var nd: Dictionary = n_var
		var nid := str(nd.get("id", ""))
		var icon_tr := TextureRect.new()
		icon_tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		icon_tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
		icon_tr.mouse_filter = Control.MOUSE_FILTER_IGNORE
		icon_tr.texture = _icon_tex("%s-%s.webp" % [rk, nid])
		var imat := ShaderMaterial.new()
		imat.shader = circle_shader
		icon_tr.material = imat
		icon_tr.visible = show_talents

		var ring_tr := TextureRect.new()
		ring_tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		ring_tr.stretch_mode = TextureRect.STRETCH_SCALE
		ring_tr.mouse_filter = Control.MOUSE_FILTER_IGNORE
		ring_tr.visible = show_talents

		modal_overlay.add_child(icon_tr)
		modal_overlay.add_child(ring_tr)
		talent_icon_nodes[nid] = {"icon": icon_tr, "ring": ring_tr, "mat": imat}

	# Keep modal_backdrop at index 0 and ModalCanvas at index 1 so star-chart conduits
	# draw underneath the circular medallions and inspector/paperdoll icons draw cleanly on top.
	if mc != null:
		modal_overlay.move_child(modal_backdrop, 0)
		modal_overlay.move_child(mc, 1)
	_sync_talent_node_styles()

func _sync_talent_node_styles() -> void:
	var rd := _race_data()
	var nodes_arr: Array = rd.get("nodes", [])
	var tex_locked := _load_tex("res://assets/ui/hud_node_ring_locked.png")
	var tex_avail := _load_tex("res://assets/ui/hud_node_ring_avail.png")
	var tex_unlocked := _load_tex("res://assets/ui/hud_node_ring_unlocked.png")
	var tex_keystone := _load_tex("res://assets/ui/hud_node_ring_keystone.png")

	for n_var in nodes_arr:
		if not (n_var is Dictionary):
			continue
		var nd: Dictionary = n_var
		var nid := str(nd.get("id", ""))
		if not talent_icon_nodes.has(nid):
			continue
		var entry: Dictionary = talent_icon_nodes[nid]
		var imat: ShaderMaterial = entry["mat"]
		var ring_tr: TextureRect = entry["ring"]
		var st := _node_state(nd)
		var ntype := str(nd.get("type", "passive"))
		var is_major := ntype in ["starting", "ultimate", "transformation"]

		if st == "unlocked":
			imat.set_shader_parameter("saturation", 1.10)
			imat.set_shader_parameter("brightness", 1.08)
			imat.set_shader_parameter("inner_vignette", 0.24)
			imat.set_shader_parameter("rim_glow", Color(1.0, 0.84, 0.36, 0.65))
			ring_tr.texture = tex_keystone if is_major else tex_unlocked
		elif st == "available":
			imat.set_shader_parameter("saturation", 0.95)
			imat.set_shader_parameter("brightness", 0.96)
			imat.set_shader_parameter("inner_vignette", 0.30)
			imat.set_shader_parameter("rim_glow", Color(0.32, 0.88, 1.0, 0.55))
			ring_tr.texture = tex_avail
		elif st == "excluded":
			imat.set_shader_parameter("saturation", 0.12)
			imat.set_shader_parameter("brightness", 0.32)
			imat.set_shader_parameter("inner_vignette", 0.52)
			imat.set_shader_parameter("rim_glow", Color(0.85, 0.18, 0.18, 0.45))
			ring_tr.texture = tex_locked
		else:
			imat.set_shader_parameter("saturation", 0.24)
			imat.set_shader_parameter("brightness", 0.50)
			imat.set_shader_parameter("inner_vignette", 0.46)
			imat.set_shader_parameter("rim_glow", Color(0.0, 0.0, 0.0, 0.0))
			ring_tr.texture = tex_locked

	# Sync Inspector showcase artwork
	var active_id := hovered_node_id if not hovered_node_id.is_empty() else selected_node_id
	var sel_nd := _node_by_id(active_id)
	if not sel_nd.is_empty():
		inspector_icon_rect.texture = _icon_tex("%s-%s.webp" % [_race_key(), active_id])
		var sst := _node_state(sel_nd)
		inspector_icon_mat.set_shader_parameter("saturation", 1.08 if sst != "locked" else 0.45)
		inspector_icon_mat.set_shader_parameter("brightness", 1.05 if sst != "locked" else 0.72)
		inspector_ring_rect.texture = tex_keystone if sst == "unlocked" else (tex_avail if sst == "available" else tex_locked)

func _layout_all() -> void:
	# 1) Top-Left Hero Medallion & Tapered Vitality Bars (compact sleek 338px width)
	var p_center := Vector2(60.0, 64.0)
	var p_rad := 40.0
	portrait_rect.position = p_center - Vector2(p_rad, p_rad)
	portrait_rect.size = Vector2(p_rad * 2.0, p_rad * 2.0)
	var ring_rad := 49.0
	portrait_ring_rect.position = p_center - Vector2(ring_rad, ring_rad)
	portrait_ring_rect.size = Vector2(ring_rad * 2.0, ring_rad * 2.0)
	race_badge_rect.position = Vector2(14.0, 14.0)
	race_badge_rect.size = Vector2(24.0, 24.0)

	hp_bar_rect.position = Vector2(128.0, 40.0)
	hp_bar_rect.size = Vector2(194.0, 18.0)
	ki_bar_rect.position = Vector2(128.0, 62.0)
	ki_bar_rect.size = Vector2(176.0, 14.0)
	res_bar_rect.position = Vector2(128.0, 80.0)
	res_bar_rect.size = Vector2(124.0, 11.0)

	# 2) Bottom-Center Slim XP Filament Pill + Bottom-Right Wild Rift Combat Arc
	var xp_r := _xp_pill_rect()
	xp_bar_rect.position = Vector2(xp_r.position.x + 62.0, xp_r.position.y + 8.5)
	xp_bar_rect.size = Vector2(xp_r.size.x - 124.0, 7.0)

	var wr_specs := _wild_rift_slot_specs()
	for i in mini(wr_specs.size(), hotbar_icon_rects.size()):
		var spec: Dictionary = wr_specs[i]
		var center: Vector2 = spec["center"]
		var r: float = float(spec["r"])
		var ring_pad := 11.0 if bool(spec["keystone"]) else 8.5
		var rr := r + ring_pad
		if i == 0 or i == 2:
			hotbar_icon_rects[i].position = center - Vector2(rr, rr)
			hotbar_icon_rects[i].size = Vector2(rr * 2.0, rr * 2.0)
		else:
			var dia := r * 2.0
			hotbar_icon_rects[i].position = center - Vector2(r, r)
			hotbar_icon_rects[i].size = Vector2(dia, dia)
		hotbar_ring_rects[i].position = center - Vector2(rr, rr)
		hotbar_ring_rects[i].size = Vector2(rr * 2.0, rr * 2.0)

	# 3) Modal Tablet Layout ([K] & [I])
	var mr := _modal_rect()
	modal_backdrop.position = mr.position
	modal_backdrop.size = mr.size

	# Constellation 29-Node Icon Widgets
	talent_node_rects.clear()
	var gr := _constellation_graph_rect(mr)
	var rd := _race_data()
	var nodes_arr: Array = rd.get("nodes", [])
	for n_var in nodes_arr:
		if not (n_var is Dictionary):
			continue
		var nd: Dictionary = n_var
		var nid := str(nd.get("id", ""))
		var ntype := str(nd.get("type", "passive"))
		var pos := _constellation_node_pos(nid, gr)
		var dia := 37.0
		if ntype == "transformation":
			dia = 50.0
		elif ntype == "starting":
			dia = 46.0
		elif ntype == "ultimate":
			dia = 42.0
		elif ntype == "active" or ntype == "choice":
			dia = 40.0
		var ring_d := dia + 14.0
		talent_node_rects[nid] = Rect2(pos - Vector2(ring_d * 0.5, ring_d * 0.5), Vector2(ring_d, ring_d))
		if talent_icon_nodes.has(nid):
			var entry: Dictionary = talent_icon_nodes[nid]
			var itr: TextureRect = entry["icon"]
			var rtr: TextureRect = entry["ring"]
			itr.position = pos - Vector2(dia * 0.5, dia * 0.5)
			itr.size = Vector2(dia, dia)
			rtr.position = pos - Vector2(ring_d * 0.5, ring_d * 0.5)
			rtr.size = Vector2(ring_d, ring_d)

	# Inspector Showcase Icon
	var ir := _inspector_rect(mr)
	var ic := Vector2(ir.position.x + ir.size.x * 0.5, ir.position.y + 64.0)
	inspector_icon_rect.position = ic - Vector2(36.0, 36.0)
	inspector_icon_rect.size = Vector2(72.0, 72.0)
	inspector_ring_rect.position = ic - Vector2(46.0, 46.0)
	inspector_ring_rect.size = Vector2(92.0, 92.0)

	# Character Paperdoll Portrait
	var paper_cx := mr.position.x + mr.size.x * 0.30
	var paper_cy := mr.position.y + mr.size.y * 0.46
	char_portrait_rect.position = Vector2(paper_cx - 72.0, paper_cy - 72.0)
	char_portrait_rect.size = Vector2(144.0, 144.0)
	char_portrait_ring.position = Vector2(paper_cx - 88.0, paper_cy - 88.0)
	char_portrait_ring.size = Vector2(176.0, 176.0)

# ==============================================================================
# BASE LAYER DRAW (CHASSIS & SCULPTED PANELS BEHIND SHADER WIDGETS)
# ==============================================================================

func _draw_beveled_chamfer(canvas: CanvasItem, pts: PackedVector2Array, fill: Color, border: Color, inner_border: Color) -> void:
	# Soft drop shadow
	var sh_pts := PackedVector2Array()
	for p in pts:
		sh_pts.append(p + Vector2(0.0, 5.0))
	canvas.draw_colored_polygon(sh_pts, Color(0.0, 0.0, 0.0, 0.46))
	canvas.draw_colored_polygon(pts, fill)
	var closed := PackedVector2Array(pts)
	closed.append(pts[0])
	canvas.draw_polyline(closed, border, 2.2, true)
	# Subtle inset gold highlight along top edge
	if pts.size() >= 2:
		canvas.draw_line(pts[0] + Vector2(6, 2), pts[1] + Vector2(-6, 2), inner_border, 1.2, true)

func _draw_obsidian_plate(canvas: CanvasItem, rect: Rect2, border: Color) -> void:
	var obs := _load_tex("res://assets/ui/obsidian/obsidian_bg.webp")
	canvas.draw_rect(Rect2(rect.position + Vector2(0, 4), rect.size), Color(0.0, 0.0, 0.0, 0.50), true)
	if obs != null:
		canvas.draw_texture_rect(obs, rect, true, Color(0.92, 0.88, 0.86, 0.94))
	else:
		canvas.draw_rect(rect, Color(0.05, 0.04, 0.06, 0.90), true)
	canvas.draw_rect(rect, border, false, 2.4)
	canvas.draw_rect(rect.grow(-2.0), Color(1.0, 0.78, 0.34, 0.32), false, 1.0)

func _draw() -> void:
	if show_talents or show_character:
		return
	var meta: Dictionary = LAND_META.get(_hero_land(), LAND_META["pyra"])
	var accent: Color = meta["accent"]
	var star_t := _load_tex("res://assets/ui/obsidian/star_gold.webp")
	var div_w := _load_tex("res://assets/ui/obsidian/divider_wide.webp")

	# 1) Top-Left Cracked Volcanic Obsidian Vitality Plate (flows behind portrait & bars)
	var wing_r := Rect2(54.0, 18.0, 286.0, 100.0)
	_draw_obsidian_plate(self, wing_r, Color(0.98, 0.68, 0.22, 0.94))
	if star_t != null:
		draw_texture_rect(star_t, Rect2(wing_r.end.x - 10.0, wing_r.position.y - 10.0, 20.0, 20.0), false)
		draw_texture_rect(star_t, Rect2(wing_r.end.x - 10.0, wing_r.end.y - 10.0, 20.0, 20.0), false)
	# Subtle dark circular backdrop behind portrait
	draw_circle(Vector2(60.0, 64.0), 46.0, Color(0.04, 0.03, 0.05, 0.96))


	# 3) Bottom-Center Cracked Obsidian XP Bar Pill
	var xp_r := _xp_pill_rect()
	_draw_obsidian_plate(self, xp_r, Color(0.98, 0.70, 0.24, 0.94))
	if star_t != null:
		draw_texture_rect(star_t, Rect2(xp_r.position.x - 9.0, xp_r.position.y + xp_r.size.y * 0.5 - 9.0, 18.0, 18.0), false)
		draw_texture_rect(star_t, Rect2(xp_r.end.x - 9.0, xp_r.position.y + xp_r.size.y * 0.5 - 9.0, 18.0, 18.0), false)

	# 4) Bottom-Right Wild Rift Right-Thumb Combat Cluster Subtle Molten-Gold Arc & Backings
	var wr_specs := _wild_rift_slot_specs()
	if not wr_specs.is_empty():
		var base_c: Vector2 = wr_specs[0]["center"]
		draw_arc(base_c, 128.0, deg_to_rad(172.0), deg_to_rad(273.0), 40, Color(0.04, 0.03, 0.05, 0.55), 14.0, true)
		draw_arc(base_c, 128.0, deg_to_rad(172.0), deg_to_rad(273.0), 40, Color(0.98, 0.66, 0.22, 0.55), 2.0, true)
		draw_arc(base_c, 198.0, deg_to_rad(208.0), deg_to_rad(236.0), 18, Color(accent.r, accent.g, accent.b, 0.36), 1.6, true)
		for spec: Dictionary in wr_specs:
			var sc: Vector2 = spec["center"]
			var sr: float = float(spec["r"])
			draw_circle(sc + Vector2(0.0, 4.0), sr + 6.0, Color(0.0, 0.0, 0.0, 0.52))
			draw_circle(sc, sr + 4.0, Color(0.04, 0.03, 0.06, 0.94))

# ==============================================================================
# FOREGROUND HUD DRAW (TEXT OVER BARS, WILD RIFT SKILLS, TOP-LEFT UTILITY ROW)
# ==============================================================================

func _draw_hud_foreground(c: CanvasItem) -> void:
	if show_talents or show_character:
		return
	var f: Font = MapStyle.font()
	var fb: Font = MapStyle.body_font()
	var meta: Dictionary = LAND_META.get(_hero_land(), LAND_META["pyra"])
	var accent: Color = meta["accent"]

	# --- A. Top-Left Portrait Level Seal, Hero Title, Gold & Bar Numbers ---
	var seal_c := Vector2(89.0, 93.0)
	c.draw_circle(seal_c, 15.0, Color(0.06, 0.04, 0.04, 0.96))
	c.draw_arc(seal_c, 15.0, 0.0, TAU, 28, Color(0.98, 0.72, 0.28, 0.98), 2.4, true)
	c.draw_arc(seal_c, 11.5, 0.0, TAU, 24, Color(0.72, 0.42, 0.14, 0.75), 1.0, true)
	var lv_txt := str(hero_level)
	var lv_w := f.get_string_size(lv_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 13).x
	c.draw_string(f, seal_c + Vector2(-lv_w * 0.5, 4.5), lv_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(1.0, 0.92, 0.66))

	# Hero Name (Cinzel) + Race Title cleanly inside the obsidian plate
	var hero_name := (hero_custom_name if hero_custom_name != "" else str(meta["hero"])).to_upper()
	c.draw_string_outline(f, Vector2(114.0, 34.0), hero_name, HORIZONTAL_ALIGNMENT_LEFT, -1, 15, 4, Color(0.02, 0.01, 0.02, 0.95))
	c.draw_string(f, Vector2(114.0, 34.0), hero_name, HORIZONTAL_ALIGNMENT_LEFT, -1, 15, Color(1.0, 0.93, 0.76))
	var sub_txt := str(meta["title"])
	c.draw_string(fb, Vector2(114.0 + f.get_string_size(hero_name, HORIZONTAL_ALIGNMENT_LEFT, -1, 15).x + 8.0, 33.5), sub_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(accent.r, accent.g, accent.b, 0.94))

	# Mini Painted Icons beside HP / KI / Racial Resource bars
	var hp_ico := _icon_tex("hud-hp.webp")
	var ki_ico := _icon_tex("hud-ki.webp")
	var res_ico := _icon_tex(str(meta["res_icon"]))
	if hp_ico != null:
		c.draw_texture_rect(hp_ico, Rect2(108.0, 40.0, 17.0, 17.0), false)
	if ki_ico != null:
		c.draw_texture_rect(ki_ico, Rect2(109.0, 61.0, 15.0, 15.0), false)
	if res_ico != null:
		c.draw_texture_rect(res_ico, Rect2(110.0, 79.0, 13.0, 13.0), false)

	var hp_str := "%d / %d" % [int(round(hero_hp)), int(round(hero_max_hp))]
	c.draw_string_outline(fb, Vector2(136.0, 53.0), hp_str, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, 3, Color(0.02, 0.01, 0.01, 0.92))
	c.draw_string(fb, Vector2(136.0, 53.0), hp_str, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(1.0, 0.96, 0.94))

	var ki_str := "KI  %d / %d" % [int(round(hero_ki)), int(round(hero_max_ki))]
	c.draw_string_outline(fb, Vector2(136.0, 72.5), ki_str, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, 3, Color(0.02, 0.03, 0.06, 0.92))
	c.draw_string(fb, Vector2(136.0, 72.5), ki_str, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(0.88, 0.96, 1.0))

	var res_str := "%s  %d" % [str(meta["res_name"]), int(round(hero_res))]
	c.draw_string(fb, Vector2(136.0, 89.5), res_str, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color(1.0, 0.94, 0.84))

	var coin_tex := _icon_tex("gear-coin.webp")
	if coin_tex != null:
		c.draw_texture_rect(coin_tex, Rect2(258.0, 77.0, 15.0, 15.0), false)
	c.draw_string(fb, Vector2(276.0, 89.5), str(hero_gold), HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(1.0, 0.85, 0.38))

	var z_col := Color(0.36, 0.94, 0.56) if in_safe_city else Color(1.0, 0.44, 0.24)
	c.draw_circle(Vector2(115.0, 106.0), 4.0, z_col)
	c.draw_arc(Vector2(115.0, 106.0), 6.0, 0.0, TAU, 16, Color(z_col.r, z_col.g, z_col.b, 0.40), 1.2, true)
	var zone_prefix := "STOLICA" if in_safe_city else "KONTYNENT"
	var loc_short := nearest_loc if nearest_loc.length() <= 21 else (nearest_loc.substr(0, 19) + "…")
	c.draw_string(fb, Vector2(125.0, 110.0), "%s  •  %s" % [zone_prefix, loc_short], HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(0.92, 0.88, 0.78, 0.94))

	# --- A2. Volcanic Obsidian Utility Medallions (Owner Painted PLECAK, MAPA, MENU + 4-Star Obsidian Ring Medallions) ---
	util_hitboxes.clear()
	var ring_obs := _load_tex("res://assets/ui/obsidian/ring_star.webp")
	var ring_cyan := _load_tex("res://assets/ui/hud_node_ring_avail.png")
	var plaque_obs := _load_tex("res://assets/ui/obsidian/plaque_obsidian.webp")
	var gm_active: bool = world != null and bool(world.gm_open)
	var spd_badge := (" %.0f×" % float(world.gm_speed_mult)) if (world != null and float(world.gm_speed_mult) > 1.05) else ""
	var all_utils: Array = [
		{"id": "char", "key": "PLECAK", "full_tex": "res://assets/ui/obsidian/btn_plecak.webp", "badge": str(free_stat_points) if free_stat_points > 0 else "", "active": show_character},
		{"id": "atlas", "key": "MAPA", "full_tex": "res://assets/ui/obsidian/btn_mapa.webp", "badge": "", "active": false},
		{"id": "gm", "key": "MENU", "full_tex": "res://assets/ui/obsidian/btn_menu.webp", "badge": "", "active": gm_active},
		{"id": "talents", "key": "SKILLE", "icon": "emblem_crystal.webp", "badge": str(skill_points) if skill_points > 0 else "", "active": show_talents},
		{"id": "globe", "key": "GLOBUS", "icon": "emblem_gear.webp", "badge": "", "active": false},
		{"id": "relief", "key": "3D", "icon": "emblem_swords.webp", "badge": "", "active": false},
	]
	var u_dia := 54.0
	for ui in all_utils.size():
		var col_u := ui % 3
		var row_u := ui / 3
		var u_cx := 48.0 + float(col_u) * 74.0
		var u_cy := 162.0 + float(row_u) * 80.0
		_draw_util_medallion(c, f, all_utils[ui], Vector2(u_cx, u_cy), u_dia, ring_obs, ring_cyan, plaque_obs)

	# Sculpted Volcanic Obsidian PANEL GM Plaque right below the 2x3 medallions!
	var gm_rect := Rect2(14.0, 294.0, 214.0, 62.0)
	util_hitboxes.append({"rect": gm_rect.grow(4.0), "id": "gm"})
	if plaque_obs != null:
		c.draw_texture_rect(plaque_obs, gm_rect, false, Color(0.76, 0.96, 1.0) if gm_active else Color(1, 1, 1))
	else:
		_draw_obsidian_plate(c, gm_rect, Color(1.0, 0.78, 0.30))
	var gm_txt := "PANEL GM" + spd_badge
	var gtw := f.get_string_size(gm_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 16).x
	c.draw_string_outline(f, Vector2(gm_rect.position.x + (gm_rect.size.x - gtw) * 0.5, gm_rect.position.y + 37.0), gm_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, 4, Color(0.02, 0.01, 0.01, 0.96))
	c.draw_string(f, Vector2(gm_rect.position.x + (gm_rect.size.x - gtw) * 0.5, gm_rect.position.y + 37.0), gm_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color(1.0, 0.92, 0.66))

	# Dedicated Quick-Heal Potion Orb (Owner's btn_potion.webp) next to Bottom-Right Combat Cluster!
	var vs_p := _vp_size()
	var pot_c := Vector2(vs_p.x - 348.0, vs_p.y - 62.0)
	var pot_r := 38.0
	var pot_rect := Rect2(pot_c - Vector2(pot_r, pot_r), Vector2(pot_r * 2.0, pot_r * 2.0))
	util_hitboxes.append({"rect": pot_rect.grow(6.0), "id": "potion"})
	var pot_tex := _load_tex("res://assets/ui/obsidian/btn_potion.webp")
	if pot_tex != null:
		c.draw_texture_rect(pot_tex, pot_rect, false)

	nav_hitboxes.clear()

	# --- C. Bottom-Center Slim XP Filament Labels ---
	var xp_r := _xp_pill_rect()
	var xp_pct := int(round((hero_xp / maxf(hero_max_xp, 1.0)) * 100.0))
	c.draw_string(f, Vector2(xp_r.position.x + 14.0, xp_r.position.y + 16.0), "POZ.%d" % hero_level, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color(0.98, 0.84, 0.48))
	var pd_txt := "PD %d%%" % xp_pct
	var pd_w := f.get_string_size(pd_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 10).x
	c.draw_string(f, Vector2(xp_r.position.x + xp_r.size.x - pd_w - 14.0, xp_r.position.y + 16.0), pd_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color(0.98, 0.84, 0.48))

	# --- D. Bottom-Right Wild Rift Right-Thumb Circular Skill Overlays (Cooldowns, Hover & Keybind Seals) ---
	hotbar_hitboxes.clear()
	var wr_specs := _wild_rift_slot_specs()
	for i in mini(wr_specs.size(), HOTBAR_KEYS.size()):
		var spec: Dictionary = wr_specs[i]
		var center: Vector2 = spec["center"]
		var r: float = float(spec["r"])
		var hit_r := r + 8.0
		hotbar_hitboxes.append(Rect2(center - Vector2(hit_r, hit_r), Vector2(hit_r * 2.0, hit_r * 2.0)))

		# Radial cooldown veil + numeric timer
		var cd := cooldowns[i]
		if cd > 0.01:
			var frac := clampf(cd / float(HOTBAR_CDS[i]), 0.0, 1.0)
			c.draw_circle(center, r - 1.0, Color(0.02, 0.02, 0.05, 0.68))
			c.draw_arc(center, r - 3.0, -PI * 0.5, -PI * 0.5 + TAU * frac, 28, Color(0.36, 0.88, 1.0, 0.92), 3.0, true)
			var cd_txt := "%.1f" % cd
			var cw := fb.get_string_size(cd_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 15).x
			c.draw_string_outline(fb, center + Vector2(-cw * 0.5, 5.0), cd_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 15, 4, Color(0.0, 0.0, 0.0, 0.96))
			c.draw_string(fb, center + Vector2(-cw * 0.5, 5.0), cd_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 15, Color(1.0, 0.94, 0.68))

		if hovered_hotbar_idx == i:
			c.draw_arc(center, r + 5.0, 0.0, TAU, 32, Color(1.0, 0.90, 0.50, 0.92), 2.4, true)

		# Skip redundant keybind badge on baked owner art orbs (0 Sword & 2 Whirlwind '2')
		if i != 0 and i != 2:
			var kb := str(HOTBAR_KEYS[i])
			var k_pos := center + Vector2(0.0, r + 2.0)
			var kr := 11.0 if bool(spec["keystone"]) else 9.5
			c.draw_circle(k_pos, kr, Color(0.06, 0.04, 0.05, 0.96))
			c.draw_arc(k_pos, kr, 0.0, TAU, 20, Color(0.98, 0.72, 0.28, 0.96), 1.6, true)
			var ksz := 11 if bool(spec["keystone"]) else 10
			var kw := f.get_string_size(kb, HORIZONTAL_ALIGNMENT_LEFT, -1, ksz).x
			c.draw_string(f, k_pos + Vector2(-kw * 0.5, float(ksz) * 0.36), kb, HORIZONTAL_ALIGNMENT_LEFT, -1, ksz, Color(1.0, 0.93, 0.70))

	# Hover tooltip anchored cleanly above the bottom-right Wild Rift combat cluster
	if hovered_hotbar_idx >= 0 and hovered_hotbar_idx < HOTBAR_NODE_IDS.size() and not (show_talents or show_character):
		var h_nid := str(HOTBAR_NODE_IDS[hovered_hotbar_idx])
		var h_nd := _node_by_id(h_nid)
		if not h_nd.is_empty():
			var vs := _vp_size()
			var tip_w := 340.0
			var tip_h := 72.0
			var tip_r := Rect2(vs.x - tip_w - 22.0, vs.y - 344.0, tip_w, tip_h)
			_draw_obsidian_plate(c, tip_r, Color(0.98, 0.70, 0.26, 0.94))
			c.draw_string(f, tip_r.position + Vector2(12, 20), "%s  [%s]" % [str(h_nd.get("name", "")).to_upper(), str(HOTBAR_KEYS[hovered_hotbar_idx])], HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(1.0, 0.88, 0.48))
			c.draw_multiline_string(fb, tip_r.position + Vector2(12, 39), str(h_nd.get("effect", "")), HORIZONTAL_ALIGNMENT_LEFT, tip_w - 24.0, 11, 2, Color(0.90, 0.88, 0.84))

func _draw_util_medallion(c: CanvasItem, f: Font, item: Dictionary, center: Vector2, dia: float, ring_gold: Texture2D, ring_cyan: Texture2D, plaque_obs: Texture2D = null) -> void:
	var r := dia * 0.5
	var full_path := str(item.get("full_tex", ""))
	if not full_path.is_empty():
		var ftex := _load_tex(full_path)
		var fw := dia + 14.0
		var fh := fw * 1.24
		var frect := Rect2(center.x - fw * 0.5, center.y - r - 6.0, fw, fh)
		util_hitboxes.append({"rect": frect.grow(3.0), "id": str(item["id"])})
		if ftex != null:
			var tint := Color(0.76, 0.96, 1.0) if bool(item.get("active", false)) else Color(1, 1, 1)
			c.draw_texture_rect(ftex, frect, false, tint)
		var badge := str(item.get("badge", ""))
		if not badge.is_empty():
			var bc := center + Vector2(r * 0.85, -r * 0.72)
			c.draw_circle(bc, 9.0, Color(0.84, 0.22, 0.12, 0.98))
			c.draw_arc(bc, 9.0, 0.0, TAU, 16, Color(1.0, 0.86, 0.46, 0.95), 1.6, true)
			var bw := f.get_string_size(badge, HORIZONTAL_ALIGNMENT_LEFT, -1, 10).x
			c.draw_string(f, bc + Vector2(-bw * 0.5, 3.5), badge, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color(1.0, 0.98, 0.90))
		return

	var rect := Rect2(center - Vector2(r, r), Vector2(dia, dia))
	util_hitboxes.append({"rect": rect.grow(5.0), "id": str(item["id"])})
	c.draw_circle(center + Vector2(0.0, 3.0), r + 2.0, Color(0.0, 0.0, 0.0, 0.48))
	c.draw_circle(center, r, Color(0.05, 0.04, 0.06, 0.96))
	var ico := _icon_tex(str(item.get("icon", "")))
	if ico != null:
		var inner_r := r * 0.70
		c.draw_texture_rect(ico, Rect2(center - Vector2(inner_r, inner_r), Vector2(inner_r * 2.0, inner_r * 2.0)), false)
	var active := bool(item.get("active", false))
	var ring_t := ring_cyan if active else ring_gold
	if ring_t != null:
		var rr := r + 7.0
		c.draw_texture_rect(ring_t, Rect2(center - Vector2(rr, rr), Vector2(rr * 2.0, rr * 2.0)), false)
	var badge := str(item.get("badge", ""))
	if not badge.is_empty():
		var bc := center + Vector2(r * 0.78, -r * 0.74)
		c.draw_circle(bc, 9.0, Color(0.84, 0.22, 0.12, 0.98))
		c.draw_arc(bc, 9.0, 0.0, TAU, 16, Color(1.0, 0.86, 0.46, 0.95), 1.6, true)
		var bw := f.get_string_size(badge, HORIZONTAL_ALIGNMENT_LEFT, -1, 10).x
		c.draw_string(f, bc + Vector2(-bw * 0.5, 3.5), badge, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color(1.0, 0.98, 0.90))
	if plaque_obs != null:
		var pr := Rect2(center.x - 32.0, center.y + r - 4.0, 64.0, 26.0)
		c.draw_texture_rect(plaque_obs, pr, false)
	var ktxt := str(item["key"])
	var kw := f.get_string_size(ktxt, HORIZONTAL_ALIGNMENT_LEFT, -1, 9).x
	c.draw_string_outline(f, Vector2(center.x - kw * 0.5, center.y + r + 12.5), ktxt, HORIZONTAL_ALIGNMENT_LEFT, -1, 9, 3, Color(0.02, 0.01, 0.02, 0.96))
	c.draw_string(f, Vector2(center.x - kw * 0.5, center.y + r + 12.5), ktxt, HORIZONTAL_ALIGNMENT_LEFT, -1, 9, Color(1.0, 0.92, 0.68))

# ==============================================================================
# MODAL CANVAS DRAW ([K] 29-NODE CONSTELLATION SKILL TREE & [I] CHARACTER PAPERDOLL)
# ==============================================================================

func _draw_outer_scrim(c: CanvasItem, vs: Vector2, mr: Rect2) -> void:
	var sc := Color(0.01, 0.01, 0.02, 0.72)
	c.draw_rect(Rect2(0.0, 0.0, vs.x, mr.position.y), sc, true)
	c.draw_rect(Rect2(0.0, mr.position.y + mr.size.y, vs.x, vs.y - (mr.position.y + mr.size.y)), sc, true)
	c.draw_rect(Rect2(0.0, mr.position.y, mr.position.x, mr.size.y), sc, true)
	c.draw_rect(Rect2(mr.position.x + mr.size.x, mr.position.y, vs.x - (mr.position.x + mr.size.x), mr.size.y), sc, true)

func _draw_modal_canvas(c: CanvasItem) -> void:
	if not (show_talents or show_character):
		return
	var vs := _vp_size()
	var f: Font = MapStyle.font()
	var mr := _modal_rect()
	_draw_outer_scrim(c, vs, mr)

	if show_talents:
		_draw_constellation_tree(c, f, mr)
	elif show_character:
		_draw_character_sheet(c, f, mr)

func _draw_modal_header_plaque(c: CanvasItem, f: Font, mr: Rect2, title_txt: String, sub_txt: String) -> void:
	var fb: Font = MapStyle.body_font()
	var pw := 610.0
	var ph := 48.0 if not sub_txt.is_empty() else 34.0
	var px := mr.position.x + (mr.size.x - pw) * 0.5
	var py := mr.position.y + 52.0
	var pts := PackedVector2Array([
		Vector2(px + 18.0, py),
		Vector2(px + pw - 18.0, py),
		Vector2(px + pw, py + ph * 0.5),
		Vector2(px + pw - 18.0, py + ph),
		Vector2(px + 18.0, py + ph),
		Vector2(px, py + ph * 0.5),
	])
	_draw_beveled_chamfer(
		c,
		pts,
		Color(0.05, 0.04, 0.06, 0.92),
		Color(0.84, 0.66, 0.35, 0.90),
		Color(1.0, 0.88, 0.56, 0.34)
	)
	var tw := f.get_string_size(title_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 17).x
	var ty := py + 23.0
	c.draw_string_outline(f, Vector2(mr.position.x + (mr.size.x - tw) * 0.5, ty), title_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 17, 4, Color(0.02, 0.01, 0.01, 0.96))
	c.draw_string(f, Vector2(mr.position.x + (mr.size.x - tw) * 0.5, ty), title_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 17, Color(1.0, 0.89, 0.56))
	if not sub_txt.is_empty():
		var sw := fb.get_string_size(sub_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 12).x
		c.draw_string(fb, Vector2(mr.position.x + (mr.size.x - sw) * 0.5, py + 41.0), sub_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(0.88, 0.84, 0.76, 0.96))

func _draw_constellation_tree(c: CanvasItem, f: Font, mr: Rect2) -> void:
	var fb: Font = MapStyle.body_font()
	var rd := _race_data()
	var meta: Dictionary = LAND_META.get(_hero_land(), LAND_META["pyra"])
	var gr := _constellation_graph_rect(mr)
	var ir := _inspector_rect(mr)
	var umap := _unlocked_map()
	var nodes_arr: Array = rd.get("nodes", [])
	var branches: Dictionary = rd.get("skillBranches", {})

	# Subtle translucent obsidian veil inside tablet interior so starlines & text have razor contrast
	c.draw_rect(gr.grow(10.0), Color(0.03, 0.03, 0.05, 0.44), true)
	c.draw_rect(gr.grow(10.0), Color(0.74, 0.58, 0.30, 0.36), false, 1.2)

	# Royal Engraved Obsidian Header Plaque cleanly framing the title & point counter
	var race_pl := str(rd.get("raceName", "Legendy")).to_upper()
	var realm_pl := str(meta["realm"]).to_upper()
	var title_txt := "KONSTELACJA UMIEJĘTNOŚCI — %s (%s)" % [race_pl, realm_pl]
	var sub_txt := "29 Węzłów Kanonicznych  •  Poziom %d  •  Dostępne Punkty Talentów: %d" % [hero_level, skill_points]
	_draw_modal_header_plaque(c, f, mr, title_txt, sub_txt)

	# Gilded Close Medallion [✕] at top-right inside filigree border
	var cl_c := Vector2(mr.position.x + mr.size.x - 62.0, mr.position.y + 62.0)
	talent_close_rect = Rect2(cl_c - Vector2(18.0, 18.0), Vector2(36.0, 36.0))
	c.draw_circle(cl_c, 16.0, Color(0.08, 0.05, 0.05, 0.94))
	c.draw_arc(cl_c, 16.0, 0.0, TAU, 24, Color(0.86, 0.68, 0.36, 0.92), 1.8, true)
	c.draw_string(fb, cl_c + Vector2(-5.5, 5.5), "✕", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color(1.0, 0.88, 0.62))

	# Branch Headers inscribed gently at bottom of each of the 3 diamond constellations
	var b_specs: Array = [
		{"k": "A", "xf": 0.175},
		{"k": "B", "xf": 0.500},
		{"k": "C", "xf": 0.825},
	]
	for bs: Dictionary in b_specs:
		var bk := str(bs["k"])
		var b_info: Dictionary = branches.get(bk, {})
		var b_name := str(b_info.get("name", "Gałąź " + bk)).to_upper()
		var b_col: Color = BRANCH_COLORS.get(bk, Color(0.9, 0.8, 0.5))
		var bx := gr.position.x + gr.size.x * float(bs["xf"])
		var bw := f.get_string_size(b_name, HORIZONTAL_ALIGNMENT_LEFT, -1, 11).x
		var by := gr.position.y + gr.size.y - 4.0 if bk != "B" else gr.position.y + gr.size.y + 16.0
		c.draw_string_outline(f, Vector2(bx - bw * 0.5, by), b_name, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, 3, Color(0.02, 0.01, 0.02, 0.95))
		c.draw_string(f, Vector2(bx - bw * 0.5, by), b_name, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, b_col)

	# Constellation Star-Chart Conduit Lines (every requiresAny edge!)
	var node_positions: Dictionary = {}
	for n_var in nodes_arr:
		if n_var is Dictionary:
			var nid := str((n_var as Dictionary).get("id", ""))
			node_positions[nid] = _constellation_node_pos(nid, gr)

	for n_var in nodes_arr:
		if not (n_var is Dictionary):
			continue
		var nd: Dictionary = n_var
		var nid := str(nd.get("id", ""))
		var dst: Vector2 = node_positions.get(nid, Vector2.ZERO)
		var bkey := nid.substr(0, 1)
		var bcol: Color = BRANCH_COLORS.get(bkey, Color(0.95, 0.80, 0.40))
		var st := _node_state(nd)
		var reqs: Array = nd.get("requiresAny", [])
		for r_var in reqs:
			var rid := str(r_var)
			if not node_positions.has(rid):
				continue
			var src: Vector2 = node_positions[rid]
			var both_unlocked := bool(umap.get(nid, false)) and bool(umap.get(rid, false))
			var src_unlocked := bool(umap.get(rid, false))
			if both_unlocked:
				# Radiant double-pass golden energy conduit
				c.draw_line(src, dst, Color(bcol.r, bcol.g, bcol.b, 0.34), 7.0, true)
				c.draw_line(src, dst, Color(1.0, 0.88, 0.52, 0.96), 2.4, true)
			elif src_unlocked and st == "available":
				# Luminous invitation conduit
				c.draw_line(src, dst, Color(0.32, 0.86, 1.0, 0.25), 5.0, true)
				c.draw_line(src, dst, Color(0.46, 0.88, 1.0, 0.82), 1.8, true)
			else:
				# Etched obsidian star-chart line
				c.draw_line(src, dst, Color(0.58, 0.48, 0.32, 0.34), 1.4, true)

	# Crimson Exclusive-Choice Arcs between A7<->A8, B7<->B8, C7<->C8
	var excl_arr: Array = rd.get("exclusiveChoices", [])
	for pair_var in excl_arr:
		if pair_var is Array and (pair_var as Array).size() == 2:
			var p0: Vector2 = node_positions.get(str((pair_var as Array)[0]), Vector2.ZERO)
			var p1: Vector2 = node_positions.get(str((pair_var as Array)[1]), Vector2.ZERO)
			c.draw_line(p0, p1, Color(0.86, 0.26, 0.24, 0.55), 1.4, true)
			var mid := (p0 + p1) * 0.5
			c.draw_circle(mid, 7.5, Color(0.08, 0.04, 0.05, 0.92))
			c.draw_string(fb, mid + Vector2(-4.5, 4.0), "⇄", HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color(0.98, 0.46, 0.38))

	# Selected / Hovered Node Radiant Halo Ring behind node medallion
	var active_id := hovered_node_id if not hovered_node_id.is_empty() else selected_node_id
	if node_positions.has(active_id):
		var ap: Vector2 = node_positions[active_id]
		c.draw_arc(ap, 32.0, 0.0, TAU, 36, Color(1.0, 0.90, 0.52, 0.86), 2.2, true)
		c.draw_arc(ap, 36.0, 0.0, TAU, 36, Color(1.0, 0.80, 0.34, 0.35), 1.4, true)

	# --- Right-Side Engraved Gilded Inspector Tablet ---
	var ix := ir.position.x
	var iy := ir.position.y
	var iw := ir.size.x
	var ih := ir.size.y
	var ins_pts := PackedVector2Array([
		Vector2(ix + 12.0, iy),
		Vector2(ix + iw - 12.0, iy),
		Vector2(ix + iw, iy + 12.0),
		Vector2(ix + iw, iy + ih - 12.0),
		Vector2(ix + iw - 12.0, iy + ih),
		Vector2(ix + 12.0, iy + ih),
		Vector2(ix, iy + ih - 12.0),
		Vector2(ix, iy + 12.0),
	])
	_draw_beveled_chamfer(
		c,
		ins_pts,
		Color(0.05, 0.04, 0.06, 0.86),
		Color(0.82, 0.65, 0.35, 0.88),
		Color(1.0, 0.88, 0.56, 0.28)
	)

	var sel_nd := _node_by_id(active_id)
	if not sel_nd.is_empty():
		var s_name := str(sel_nd.get("name", ""))
		var s_type := str(sel_nd.get("type", "passive"))
		var s_lvl := int(sel_nd.get("minLevel", 1))
		var s_req := str(sel_nd.get("requiresSource", "—"))
		var s_eff := str(sel_nd.get("effect", ""))
		var s_st := _node_state(sel_nd)
		var b_key := active_id.substr(0, 1)
		var b_col: Color = BRANCH_COLORS.get(b_key, Color(1.0, 0.84, 0.42))

		# Node Name & ID Plaque below enlarged circular showcase icon
		var nw := f.get_string_size(s_name.to_upper(), HORIZONTAL_ALIGNMENT_LEFT, -1, 15).x
		c.draw_string_outline(f, Vector2(ix + (iw - nw) * 0.5, iy + 132.0), s_name.to_upper(), HORIZONTAL_ALIGNMENT_LEFT, -1, 15, 4, Color(0.02, 0.01, 0.01, 0.96))
		c.draw_string(f, Vector2(ix + (iw - nw) * 0.5, iy + 132.0), s_name.to_upper(), HORIZONTAL_ALIGNMENT_LEFT, -1, 15, Color(1.0, 0.91, 0.62))

		var t_lbl := "%s  •  [%s]" % [str(TYPE_LABELS.get(s_type, "WĘZEŁ")), active_id]
		var tlw := f.get_string_size(t_lbl, HORIZONTAL_ALIGNMENT_LEFT, -1, 10).x
		c.draw_string(f, Vector2(ix + (iw - tlw) * 0.5, iy + 152.0), t_lbl, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, b_col)

		# Subtle engraved gold divider
		c.draw_line(Vector2(ix + 22.0, iy + 166.0), Vector2(ix + iw - 22.0, iy + 166.0), Color(0.80, 0.62, 0.32, 0.52), 1.0, true)

		# Metadata rows (uniform Polish body font for values)
		c.draw_string(f, Vector2(ix + 22.0, iy + 190.0), "WYMAGANY POZIOM:", HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color(0.72, 0.68, 0.62))
		var lv_ok := hero_level >= s_lvl
		var lv_val := "Poz. %d" % s_lvl
		var lvw := fb.get_string_size(lv_val, HORIZONTAL_ALIGNMENT_LEFT, -1, 12).x
		c.draw_string(fb, Vector2(ix + iw - 24.0 - lvw, iy + 190.0), lv_val, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(0.42, 0.94, 0.58) if lv_ok else Color(1.0, 0.54, 0.36))

		c.draw_string(f, Vector2(ix + 22.0, iy + 210.0), "WYMAGANIA:", HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color(0.72, 0.68, 0.62))
		var rqw := fb.get_string_size(s_req, HORIZONTAL_ALIGNMENT_LEFT, -1, 12).x
		c.draw_string(fb, Vector2(ix + iw - 24.0 - rqw, iy + 210.0), s_req, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(0.94, 0.88, 0.76))

		c.draw_line(Vector2(ix + 22.0, iy + 224.0), Vector2(ix + iw - 22.0, iy + 224.0), Color(0.80, 0.62, 0.32, 0.38), 1.0, true)

		# Canonical Polish Description (Alegreya Bold — 100% uniform Polish diacritics ą ć ę ł ń ó ś ź ż!)
		c.draw_string(f, Vector2(ix + 22.0, iy + 246.0), "EFEKT UMIEJĘTNOŚCI", HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color(0.86, 0.72, 0.42))
		c.draw_multiline_string(fb, Vector2(ix + 22.0, iy + 268.0), s_eff, HORIZONTAL_ALIGNMENT_LEFT, iw - 44.0, 14, 8, Color(0.95, 0.92, 0.86))

		# Interactive Unlock / Status Action Plaque at Bottom of Inspector
		talent_unlock_btn_rect = Rect2(ix + 20.0, iy + ih - 94.0, iw - 40.0, 38.0)
		var btn_fill := Color(0.14, 0.12, 0.10, 0.90)
		var btn_rim := Color(0.55, 0.48, 0.38, 0.75)
		var btn_txt := "WĘZEŁ ZABLOKOWANY"
		var btn_tcol := Color(0.70, 0.66, 0.60)
		if s_st == "unlocked":
			btn_fill = Color(0.18, 0.14, 0.06, 0.94)
			btn_rim = Color(1.0, 0.82, 0.36, 0.95)
			btn_txt = "✦ ODBLOKOWANO ✦"
			btn_tcol = Color(1.0, 0.90, 0.56)
		elif s_st == "available" and skill_points > 0:
			btn_fill = Color(0.08, 0.24, 0.32, 0.96)
			btn_rim = Color(0.38, 0.88, 1.0, 0.96)
			btn_txt = "ODBLOKUJ WĘZEŁ (1 PKT)"
			btn_tcol = Color(0.90, 0.98, 1.0)
		elif s_st == "excluded":
			btn_fill = Color(0.22, 0.08, 0.08, 0.92)
			btn_rim = Color(0.88, 0.32, 0.28, 0.85)
			btn_txt = "WYKLUCZONE PRZEZ WYBÓR"
			btn_tcol = Color(1.0, 0.68, 0.64)
		c.draw_rect(talent_unlock_btn_rect, btn_fill, true)
		c.draw_rect(talent_unlock_btn_rect, btn_rim, false, 1.8)
		var btw := f.get_string_size(btn_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 12).x
		c.draw_string(f, Vector2(talent_unlock_btn_rect.position.x + (talent_unlock_btn_rect.size.x - btw) * 0.5, talent_unlock_btn_rect.position.y + 24.0), btn_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, btn_tcol)

		# Legend strip at very bottom of Inspector
		var ly := iy + ih - 32.0
		var leg: Array = [
			[Color(1.0, 0.82, 0.36), "Odblok."],
			[Color(0.36, 0.88, 1.0), "Dostępne"],
			[Color(0.48, 0.46, 0.44), "Zablok."],
		]
		var lx := ix + 24.0
		for lg: Array in leg:
			c.draw_circle(Vector2(lx, ly), 4.5, lg[0] as Color)
			c.draw_string(fb, Vector2(lx + 9.0, ly + 4.0), str(lg[1]), HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(0.86, 0.82, 0.76))
			lx += 86.0

func _draw_character_sheet(c: CanvasItem, f: Font, mr: Rect2) -> void:
	var fb: Font = MapStyle.body_font()
	var rd := _race_data()
	var meta: Dictionary = LAND_META.get(_hero_land(), LAND_META["pyra"])
	var accent: Color = meta["accent"]
	var slot_tex := _load_tex("res://assets/ui/hud_skill_slot.png")

	# Royal Engraved Obsidian Header Plaque
	var title_txt := "KARTA POSTACI I EKWIPUNEK — %s" % (hero_custom_name if hero_custom_name != "" else str(meta["hero"])).to_upper()
	var sub_txt := "%s  •  Poziom %d  •  %s" % [str(rd.get("raceName", "")), hero_level, str(meta["realm"])]
	_draw_modal_header_plaque(c, f, mr, title_txt, sub_txt)

	var cl_c := Vector2(mr.position.x + mr.size.x - 62.0, mr.position.y + 62.0)
	char_close_rect = Rect2(cl_c - Vector2(18.0, 18.0), Vector2(36.0, 36.0))
	c.draw_circle(cl_c, 16.0, Color(0.08, 0.05, 0.05, 0.94))
	c.draw_arc(cl_c, 16.0, 0.0, TAU, 24, Color(0.86, 0.68, 0.36, 0.92), 1.8, true)
	c.draw_string(fb, cl_c + Vector2(-5.5, 5.5), "✕", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color(1.0, 0.88, 0.62))

	# Left Half: Hero Paperdoll Aura + 8 Painted Equipment Sockets
	var paper_cx := mr.position.x + mr.size.x * 0.30
	var paper_cy := mr.position.y + mr.size.y * 0.46
	c.draw_circle(Vector2(paper_cx, paper_cy), 104.0, Color(accent.r, accent.g, accent.b, 0.10))
	c.draw_arc(Vector2(paper_cx, paper_cy), 106.0, 0.0, TAU, 48, Color(0.80, 0.64, 0.34, 0.32), 1.2, true)

	var eq_sz := 62.0
	for sl: Dictionary in equip_slots:
		var side := int(sl["side"])
		var row := int(sl["row"])
		var sx := paper_cx + float(side) * 164.0 - eq_sz * 0.5
		var sy := mr.position.y + 150.0 + float(row) * 86.0
		var sr := Rect2(sx, sy, eq_sz, eq_sz)
		var rcol: Color = sl["rarity"]
		c.draw_rect(sr, Color(0.05, 0.04, 0.06, 0.94), true)
		var gico := _icon_tex(str(sl["icon"]))
		if gico != null:
			c.draw_texture_rect(gico, Rect2(sx + 6.0, sy + 6.0, eq_sz - 12.0, eq_sz - 12.0), false)
		c.draw_rect(sr.grow(-2.0), Color(rcol.r, rcol.g, rcol.b, 0.45), false, 1.6)
		if slot_tex != null:
			c.draw_texture_rect(slot_tex, Rect2(sx - 2.0, sy - 2.0, eq_sz + 4.0, eq_sz + 4.0), false)
		var gname := str(sl["name"])
		var gnw := fb.get_string_size(gname, HORIZONTAL_ALIGNMENT_LEFT, -1, 11).x
		c.draw_string(fb, Vector2(sx + (eq_sz - gnw) * 0.5, sy + eq_sz + 14.0), gname, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(0.92, 0.88, 0.80))

	# Race Identity Plaque under Paperdoll
	var role_txt := "%s  •  %s" % [str(rd.get("raceName", "")), str(rd.get("role", ""))]
	var rw := fb.get_string_size(role_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 14).x
	c.draw_string(fb, Vector2(paper_cx - rw * 0.5, mr.position.y + 528.0), role_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color(1.0, 0.88, 0.54))
	var mech_txt := "Mechanika rasy: %s" % str(rd.get("raceMechanic", ""))
	var mw := fb.get_string_size(mech_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 12).x
	c.draw_string(fb, Vector2(paper_cx - mw * 0.5, mr.position.y + 550.0), mech_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(accent.r, accent.g, accent.b, 0.94))

	# Right Half: Canonical Stats Ledger + Live [+] Stat Allocation + Painted 15-Slot Backpack Grid
	var rx := mr.position.x + mr.size.x * 0.55
	var ry := mr.position.y + 124.0
	var rw_box := mr.size.x * 0.39
	var rh_box := mr.size.y - 184.0
	var st_pts := PackedVector2Array([
		Vector2(rx + 12.0, ry),
		Vector2(rx + rw_box - 12.0, ry),
		Vector2(rx + rw_box, ry + 12.0),
		Vector2(rx + rw_box, ry + rh_box - 12.0),
		Vector2(rx + rw_box - 12.0, ry + rh_box),
		Vector2(rx + 12.0, ry + rh_box),
		Vector2(rx, ry + rh_box - 12.0),
		Vector2(rx, ry + 12.0),
	])
	_draw_beveled_chamfer(c, st_pts, Color(0.05, 0.04, 0.06, 0.86), Color(0.82, 0.65, 0.35, 0.88), Color(1.0, 0.88, 0.56, 0.25))

	var pts_tag := "  •  WOLNE PKT: %d" % free_stat_points if free_stat_points > 0 else ""
	c.draw_string(f, Vector2(rx + 22.0, ry + 30.0), "ATRYBUTY (POZ. %d)%s" % [hero_level, pts_tag], HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(0.46, 0.96, 0.64) if free_stat_points > 0 else Color(1.0, 0.88, 0.52))
	c.draw_line(Vector2(rx + 22.0, ry + 40.0), Vector2(rx + rw_box - 22.0, ry + 40.0), Color(0.80, 0.62, 0.32, 0.50), 1.0, true)

	var base: Dictionary = rd.get("base", {})
	var per_lv: Dictionary = rd.get("perLevel", {})
	var lv_off := float(hero_level - 1)
	var stats_rows: Array = [
		["hud-hp.webp", "Punkty Życia (HP)", "%d" % int(round(hero_max_hp)), "hp"],
		["hud-ki.webp", "Energia KI", "%d" % int(round(hero_max_ki)), "ki"],
		["hud-combat.webp", "Atak całkowity", "%d" % get_total_attack(), "atk"],
		["hud-shield.webp", "Obrona", "%d" % get_total_defense(), "def"],
		["gear-boots.webp", "Szybkość ruchu", "%d j." % get_total_speed(), "spd"],
		["emblem_slash.webp", "Szansa krytyczna", "%.1f%%" % get_total_crit(), "crit"],
		["emblem_crystal.webp", "Regeneracja KI", "%.2f / s" % (float(base.get("kiRegen", 1.0)) + float(per_lv.get("kiRegen", 0.05)) * lv_off), ""],
		["gear-coin.webp", "Skarbiec Złota", "%d szt." % hero_gold, ""],
	]
	stat_plus_hitboxes.clear()
	for si in stats_rows.size():
		var sr_y := ry + 60.0 + float(si) * 28.0
		var row: Array = stats_rows[si]
		var skey := str(row[3])
		var sico := _icon_tex(str(row[0]))
		if sico != null:
			c.draw_texture_rect(sico, Rect2(rx + 22.0, sr_y - 12.0, 18.0, 18.0), false)
		c.draw_string(fb, Vector2(rx + 48.0, sr_y + 2.0), str(row[1]), HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(0.88, 0.86, 0.80))
		var val_s := str(row[2])
		var vw := fb.get_string_size(val_s, HORIZONTAL_ALIGNMENT_LEFT, -1, 12).x
		var right_pad := 58.0 if (free_stat_points > 0 and not skey.is_empty()) else 24.0
		c.draw_string(fb, Vector2(rx + rw_box - right_pad - vw, sr_y + 2.0), val_s, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(1.0, 0.90, 0.56))
		if free_stat_points > 0 and not skey.is_empty():
			var pbtn := Rect2(rx + rw_box - 48.0, sr_y - 12.0, 26.0, 20.0)
			c.draw_rect(pbtn, Color(0.10, 0.30, 0.18, 0.96), true)
			c.draw_rect(pbtn, Color(0.42, 0.96, 0.58, 0.96), false, 1.4)
			c.draw_string(f, Vector2(pbtn.position.x + 8.0, pbtn.position.y + 15.0), "+", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color(0.92, 1.0, 0.94))
			stat_plus_hitboxes.append({"rect": pbtn.grow(3.0), "key": skey})
		if si < stats_rows.size() - 1:
			c.draw_line(Vector2(rx + 22.0, sr_y + 10.0), Vector2(rx + rw_box - 22.0, sr_y + 10.0), Color(0.60, 0.50, 0.34, 0.18), 1.0, true)

	# Backpack 3x5 Grid (15 live slots — tap item to equip or use!)
	var bp_y := ry + 292.0
	c.draw_string(f, Vector2(rx + 22.0, bp_y), "SAKWA WĘDROWCA (KLIK: ZAŁÓŻ / UŻYJ)", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(0.92, 0.78, 0.46))
	var cell := 52.0
	var gap := 8.0
	var grid_x0 := rx + (rw_box - (5.0 * cell + 4.0 * gap)) * 0.5
	backpack_hitboxes.clear()
	for bi in backpack_items.size():
		var col_i := bi % 5
		var row_i := bi / 5
		var bx := grid_x0 + float(col_i) * (cell + gap)
		var by := bp_y + 10.0 + float(row_i) * (cell + gap)
		var br := Rect2(bx, by, cell, cell)
		backpack_hitboxes.append({"rect": br, "idx": bi})
		c.draw_rect(br, Color(0.04, 0.03, 0.05, 0.92), true)
		var bi_d: Dictionary = backpack_items[bi]
		if not bi_d.is_empty():
			var bico := _icon_tex(str(bi_d.get("icon", "")))
			if bico != null:
				c.draw_texture_rect(bico, Rect2(bx + 6.0, by + 6.0, cell - 12.0, cell - 12.0), false)
			var rcol_b: Color = bi_d.get("rarity", Color(0.70, 0.58, 0.36))
			c.draw_rect(br.grow(-2.0), Color(rcol_b.r, rcol_b.g, rcol_b.b, 0.55), false, 1.4)
		if slot_tex != null:
			c.draw_texture_rect(slot_tex, Rect2(bx - 2.0, by - 2.0, cell + 4.0, cell + 4.0), false)
		var qty_i := int(bi_d.get("qty", 0))
		if qty_i > 0:
			var qty := str(qty_i)
			var qw := fb.get_string_size(qty, HORIZONTAL_ALIGNMENT_LEFT, -1, 10).x
			c.draw_string_outline(fb, Vector2(bx + cell - qw - 5.0, by + cell - 5.0), qty, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, 3, Color(0.0, 0.0, 0.0, 0.95))
			c.draw_string(fb, Vector2(bx + cell - qw - 5.0, by + cell - 5.0), qty, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color(1.0, 0.94, 0.76))

# ==============================================================================
# INPUT HANDLING (MOUSE HOVER, MOBILE TOUCH TAPS, CONSTELLATION UNLOCKING, WILD RIFT SKILLS)
# ==============================================================================

func _try_unlock_node(nid: String) -> void:
	var nd := _node_by_id(nid)
	if nd.is_empty():
		return
	if _node_state(nd) == "available" and skill_points > 0:
		if world != null and world.has_method("dispatch_server_action") and world.dispatch_server_action({"type": "unlock_talent", "nodeId": nid}):
			return
		var umap := _unlocked_map()
		umap[nid] = true
		skill_points -= 1
		_sync_talent_node_styles()
		_refresh_visuals()

func _handle_primary_tap(p: Vector2) -> bool:
	if show_talents:
		if talent_close_rect.has_point(p) or not _modal_rect().has_point(p):
			close_modals()
			return true
		if talent_unlock_btn_rect.has_point(p):
			_try_unlock_node(selected_node_id)
			return true
		for nid in talent_node_rects.keys():
			if (talent_node_rects[nid] as Rect2).has_point(p):
				var sid := str(nid)
				if sid == selected_node_id:
					_try_unlock_node(sid)
				else:
					selected_node_id = sid
					_sync_talent_node_styles()
					_refresh_visuals()
				return true
		return true

	if show_character:
		if char_close_rect.has_point(p) or not _modal_rect().has_point(p):
			close_modals()
			return true
		for shb: Dictionary in stat_plus_hitboxes:
			if (shb["rect"] as Rect2).has_point(p):
				spend_free_stat_point(str(shb["key"]))
				return true
		for bhb: Dictionary in backpack_hitboxes:
			if (bhb["rect"] as Rect2).has_point(p):
				use_backpack_slot(int(bhb["idx"]))
				return true
		return true

	# Top-Center Realm Navigation Ribbon
	for item: Dictionary in nav_hitboxes:
		if (item["rect"] as Rect2).has_point(p):
			var iid := str(item["id"])
			if str(item["kind"]) == "land" and world != null:
				world.switch_region(iid)
			elif iid == "capital" and world != null:
				world.teleport_to_capital()
			elif iid == "town" and world != null:
				world.cycle_town_stronghold()
			return true

	# Bottom-Right Wild Rift Right-Thumb Combat Orbs
	for i in hotbar_hitboxes.size():
		if hotbar_hitboxes[i].has_point(p):
			trigger_skill(i)
			return true

	# Top-Left Compact Utility Medallions
	for item: Dictionary in util_hitboxes:
		if (item["rect"] as Rect2).has_point(p):
			var uid := str(item["id"])
			match uid:
				"talents":
					toggle_talents()
				"char":
					toggle_character()
				"time":
					if world != null:
						world.cycle_time_of_day()
				"atlas":
					if world != null:
						if world.atlas_overlay != null:
							world.atlas_overlay.set_mode("atlas")
						world.toggle_atlas(true)
				"globe":
					if world != null:
						if world.atlas_overlay != null:
							world.atlas_overlay.set_mode("globe")
						world.toggle_atlas(true)
				"relief":
					if world != null:
						world.toggle_map()
				"gm":
					if world != null and world.has_method("toggle_gm_panel"):
						world.toggle_gm_panel()
				"potion":
					hero_hp = minf(hero_max_hp, hero_hp + hero_max_hp * 0.40)
					hero_ki = minf(hero_max_ki, hero_ki + hero_max_ki * 0.30)
					_sync_bar_uniforms()
					_refresh_visuals()
			return true
	return false

var _last_tap_msec := 0

func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion:
		var mp: Vector2 = (event as InputEventMouseMotion).position
		if show_talents:
			var new_hov := ""
			for nid in talent_node_rects.keys():
				if (talent_node_rects[nid] as Rect2).has_point(mp):
					new_hov = str(nid)
					break
			if new_hov != hovered_node_id:
				hovered_node_id = new_hov
				_sync_talent_node_styles()
				_refresh_visuals()
			return
		var new_hb := -1
		for i in hotbar_hitboxes.size():
			if hotbar_hitboxes[i].has_point(mp):
				new_hb = i
				break
		if new_hb != hovered_hotbar_idx:
			hovered_hotbar_idx = new_hb
			_refresh_visuals()
		return

	# NOTE: pointing/emulate_mouse_from_touch=true on Android converts every finger tap into InputEventMouseButton.
	# Handling ONLY InputEventMouseButton (with 180ms debounce) prevents double-toggling PANEL GM / menus open+closed!
	if event is InputEventMouseButton and (event as InputEventMouseButton).pressed:
		var mb := event as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_RIGHT and (show_talents or show_character):
			close_modals()
			accept_event()
			return
		if mb.button_index != MOUSE_BUTTON_LEFT:
			return
		var now_ms := Time.get_ticks_msec()
		if now_ms - _last_tap_msec < 180:
			accept_event()
			return
		if _handle_primary_tap(mb.position):
			_last_tap_msec = now_ms
			accept_event()
			return
