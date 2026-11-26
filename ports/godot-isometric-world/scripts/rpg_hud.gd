extends Control
## AAA Ornate Dark-Fantasy Action-RPG HUD, 29-Node Diamond Constellation Skill Tree ([K]),
## and Paperdoll Character & Equipment Sheet ([I]) for KI Legends.
## Built strictly with painted studio textures (portraits, filigree crest, sculpted beveled rings,
## 116+ canonical icons-v3, gear icons-v2, ui-v2 emblems), custom liquid-energy bar shader,
## circular icon shader, and canonical 4-race x 29-node data from res://data/progression.json.

const MapStyle := preload("res://scripts/map_style.gd")
const ForgedUI := preload("res://scripts/forged_ui.gd")

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
		"res_name": "Ładunek",
		"res_icon": "hud-rdzen.webp",
		"res_dark": Color(0.04, 0.32, 0.42),
		"res_bright": Color(0.18, 0.96, 0.98),
		"accent": Color(0.24, 0.96, 0.98),
		"portrait": "res://assets/ui/portrait_nexus.webp",
		"race_icon": "race-android.webp",
	},
}

const HOTBAR_NODE_IDS := ["R", "A1", "B1", "C1", "A4", "T"]
const ASSIGNABLE_NODES := ["A1", "B1", "C1", "A4", "B4", "C4", "A9", "B9", "C9"]
const HOTBAR_KEYS := ["Q", "1", "2", "3", "4", "R"]
const HOTBAR_CDS := [0.65, 6.0, 7.0, 9.0, 10.0, 90.0]
const HOTBAR_KI_COSTS := [0.0, 10.0, 10.0, 12.0, 18.0, 45.0]
const BACKPACK_SLOTS := 24
const TRAINING_COOLDOWN_MS := 8000
const BLESSING_DURATION_MS := 900000

const SKILL_SPECS := {
	"legend": {
		"A1": {"cd": 6.0, "ki": 10.0, "mult": 1.80, "radius": 135.0, "clip": "sk_A1", "fb": "skill"},
		"B1": {"cd": 7.0, "ki": 10.0, "mult": 1.50, "radius": 135.0, "clip": "sk_B1", "fb": "skillb"},
		"C1": {"cd": 9.0, "ki": 14.0, "mult": 1.80, "radius": 175.0, "clip": "sk_C1", "fb": "skillc", "aoe": true},
		"A4": {"cd": 10.0, "ki": 16.0, "mult": 2.20, "radius": 240.0, "clip": "sk_A4", "fb": "skill"},
		"B4": {"cd": 16.0, "ki": 18.0, "mult": 0.0, "radius": 120.0, "clip": "sk_B4", "fb": "skillb", "self": true},
		"C4": {"cd": 14.0, "ki": 20.0, "mult": 2.00, "radius": 185.0, "clip": "sk_C4", "fb": "skillc", "aoe": true},
		"A9": {"cd": 28.0, "ki": 35.0, "mult": 4.20, "radius": 155.0, "clip": "sk_A9", "fb": "finisher"},
		"B9": {"cd": 35.0, "ki": 35.0, "mult": 0.0, "radius": 150.0, "clip": "sk_B9", "fb": "guard", "self": true},
		"C9": {"cd": 30.0, "ki": 35.0, "mult": 4.50, "radius": 250.0, "clip": "sk_C9", "fb": "skillc", "aoe": true},
		"T":  {"cd": 90.0, "ki": 45.0, "mult": 0.0, "radius": 240.0, "clip": "transform", "fb": "kitransform", "self": true},
	},
	"planetary": {
		"A1": {"cd": 6.0, "ki": 8.0, "mult": 0.0, "radius": 160.0, "clip": "dodge", "fb": "dodge", "self": true},
		"B1": {"cd": 6.0, "ki": 10.0, "mult": 1.40, "radius": 155.0, "clip": "sk_B1", "fb": "skillc", "aoe": true},
		"C1": {"cd": 12.0, "ki": 12.0, "mult": 0.0, "radius": 110.0, "clip": "channel", "fb": "channel", "self": true},
		"A4": {"cd": 10.0, "ki": 18.0, "mult": 1.80, "radius": 175.0, "clip": "sk_A4", "fb": "skill", "aoe": true},
		"B4": {"cd": 10.0, "ki": 18.0, "mult": 2.00, "radius": 230.0, "clip": "sk_B4", "fb": "skillb", "aoe": true},
		"C4": {"cd": 12.0, "ki": 16.0, "mult": 0.0, "radius": 120.0, "clip": "guard", "fb": "guard", "self": true},
		"A9": {"cd": 30.0, "ki": 35.0, "mult": 4.00, "radius": 185.0, "clip": "sk_A9", "fb": "finisher", "aoe": true},
		"B9": {"cd": 30.0, "ki": 35.0, "mult": 4.00, "radius": 235.0, "clip": "sk_B9", "fb": "skillb", "aoe": true},
		"C9": {"cd": 32.0, "ki": 35.0, "mult": 0.0, "radius": 160.0, "clip": "sk_C9", "fb": "skillc", "self": true},
		"T":  {"cd": 90.0, "ki": 45.0, "mult": 0.0, "radius": 240.0, "clip": "transform", "fb": "kitransform", "self": true},
	},
	"sage": {
		"A1": {"cd": 6.0, "ki": 10.0, "mult": 2.00, "radius": 280.0, "clip": "sk_A1", "fb": "skill"},
		"B1": {"cd": 10.0, "ki": 12.0, "mult": 0.0, "radius": 120.0, "clip": "guard", "fb": "guard", "self": true},
		"C1": {"cd": 14.0, "ki": 0.0, "mult": 0.0, "radius": 120.0, "clip": "channel", "fb": "channel", "self": true},
		"A4": {"cd": 10.0, "ki": 18.0, "mult": 2.40, "radius": 290.0, "clip": "sk_A4", "fb": "channel"},
		"B4": {"cd": 12.0, "ki": 16.0, "mult": 0.60, "radius": 270.0, "clip": "sk_B4", "fb": "skillc", "aoe": true},
		"C4": {"cd": 14.0, "ki": 16.0, "mult": 0.0, "radius": 120.0, "clip": "channel", "fb": "channel", "self": true},
		"A9": {"cd": 28.0, "ki": 35.0, "mult": 4.20, "radius": 290.0, "clip": "sk_A9", "fb": "skillb", "aoe": true},
		"B9": {"cd": 32.0, "ki": 35.0, "mult": 0.0, "radius": 230.0, "clip": "sk_B9", "fb": "skillb", "self": true},
		"C9": {"cd": 32.0, "ki": 35.0, "mult": 0.0, "radius": 150.0, "clip": "sk_C9", "fb": "skillc", "self": true},
		"T":  {"cd": 90.0, "ki": 45.0, "mult": 0.0, "radius": 240.0, "clip": "transform", "fb": "kitransform", "self": true},
	},
	"android": {
		"A1": {"cd": 6.0, "ki": 8.0, "mult": 1.15, "radius": 285.0, "clip": "sk_A1", "fb": "skill"},
		"B1": {"cd": 10.0, "ki": 12.0, "mult": 0.0, "radius": 120.0, "clip": "guard", "fb": "guard", "self": true},
		"C1": {"cd": 8.0, "ki": 15.0, "mult": 1.85, "radius": 300.0, "clip": "sk_C1", "fb": "skillc", "aoe": true},
		"A4": {"cd": 10.0, "ki": 16.0, "mult": 2.20, "radius": 285.0, "clip": "sk_A4", "fb": "attack2"},
		"B4": {"cd": 12.0, "ki": 16.0, "mult": 1.25, "radius": 180.0, "clip": "sk_B4", "fb": "skillc", "aoe": true},
		"C4": {"cd": 12.0, "ki": 0.0, "mult": 0.0, "radius": 120.0, "clip": "channel", "fb": "channel", "self": true},
		"A9": {"cd": 28.0, "ki": 35.0, "mult": 4.00, "radius": 295.0, "clip": "sk_A9", "fb": "finisher"},
		"B9": {"cd": 32.0, "ki": 35.0, "mult": 0.0, "radius": 150.0, "clip": "sk_B9", "fb": "skillb", "self": true},
		"C9": {"cd": 32.0, "ki": 35.0, "mult": 0.0, "radius": 160.0, "clip": "sk_C9", "fb": "skillc", "self": true},
		"T":  {"cd": 90.0, "ki": 45.0, "mult": 0.0, "radius": 240.0, "clip": "transform", "fb": "kitransform", "self": true},
	},
}

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
	"ki-mode": "TRANSFORMACJA TRYBU KI",
}

const EQUIP_SLOT_NAMES := ["Hełm", "Amulet", "Broń", "Rękawice", "Pancerz", "Tarcza", "Pierścień", "Buty"]

var equip_slots: Array[Dictionary] = [
	{"side": -1, "row": 0, "id": "", "icon": "", "name": "Pusty", "rarity": Color(0.56, 0.50, 0.42)},
	{"side": -1, "row": 1, "id": "", "icon": "", "name": "Pusty", "rarity": Color(0.56, 0.50, 0.42)},
	{"side": -1, "row": 2, "id": "", "icon": "", "name": "Pusty", "rarity": Color(0.56, 0.50, 0.42)},
	{"side": -1, "row": 3, "id": "", "icon": "", "name": "Pusty", "rarity": Color(0.56, 0.50, 0.42)},
	{"side": 1, "row": 0, "id": "", "icon": "", "name": "Pusty", "rarity": Color(0.56, 0.50, 0.42)},
	{"side": 1, "row": 1, "id": "", "icon": "", "name": "Pusty", "rarity": Color(0.56, 0.50, 0.42)},
	{"side": 1, "row": 2, "id": "", "icon": "", "name": "Pusty", "rarity": Color(0.56, 0.50, 0.42)},
	{"side": 1, "row": 3, "id": "", "icon": "", "name": "Pusty", "rarity": Color(0.56, 0.50, 0.42)},
]

var backpack_items: Array[Dictionary] = []

var world: Node2D
var current_land := "pyra"
var hero_land := ""
var hero_custom_name := ""
var hero_name := "Ignis"
var nearest_loc := "Twierdza Popiołu"
var in_safe_city := true
var time_mode_short := "Dzień"

var hero_hp := 140.0
var hero_max_hp := 140.0
var hero_ki := 45.0
var hero_max_ki := 45.0
var hero_res := 0.0
var hero_res_label := ""
var hero_res_ratio := -1.0
var hero_shield_hp := 0.0
var hero_shield_timer := 0.0
var hero_xp := 0.0
var hero_max_xp := 1400.0
var hero_level := 1
var hero_gold := 120
var skill_points := 0
var free_stat_points := 0
var bonus_stat_pts: Dictionary = {"hp": 0, "ki": 0, "atk": 0, "def": 0, "spd": 0, "crit": 0}
var training_ranks: Dictionary = {"hp": 0, "ki": 0, "atk": 0, "def": 0, "spd": 0, "crit": 0}
var last_training_ms := 0
var active_blessing: Dictionary = {} # {"kind": "march"|"might"|"focus", "expires_ms": int}
var stat_plus_hitboxes: Array[Dictionary] = []
var backpack_hitboxes: Array[Dictionary] = []
var equip_hitboxes: Array[Dictionary] = []
var hotbar_nodes: Array[String] = ["R", "A1", "B1", "C1", "A4", "T"]
var cooldowns: Array[float] = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
var dodge_cd := 0.0
var channel_cd := 0.0
var talent_slot_rects: Array[Dictionary] = []

# Per-race unlocked node sets (clean Lv. 1 starting state — only R unlocked by default!)
var unlocked_by_race: Dictionary = {
	"legend": {"R": true},
	"planetary": {"R": true},
	"sage": {"R": true},
	"android": {"R": true},
}

var progression_db: Dictionary = {}
var talent_rank_rules: Dictionary = {}
var talent_purchase_pending := false
var ui_tex_cache: Dictionary = {}
var bar_shader: Shader
var circle_shader: Shader

var show_talents := false
var show_character := false
var selected_node_id := "A1"
var hovered_node_id := ""
var hovered_hotbar_idx := -1
var hovered_char_item: Dictionary = {}
var selected_char_source := ""    # "backpack" or "equip"
var selected_char_idx := -1
var char_action_btn_rect := Rect2()
var _last_slot_tap_key := ""
var _last_slot_tap_ms := 0

# Customizable HUD Layout & Live On-Screen Drag-and-Drop HUD Editor
var hud_layout: Dictionary = {
	"scale": 1.0,
	"portrait": [0.0, 0.0],
	"utils": [0.0, 0.0],
	"minimap": [0.0, 0.0],
	"combat": [0.0, 0.0],
	"xp": [0.0, 0.0],
	"show_perf": false,
}
var _perf_refresh_t := 0.0
var hud_edit_mode := false
var hud_drag_zone := ""
var hud_drag_start := Vector2.ZERO
var hud_drag_origin := Vector2.ZERO
var hud_editor_bar := PanelContainer.new()
var hud_scale_bar_lbl := Label.new()

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

func _init_starter_backpack() -> void:
	backpack_items.clear()
	for _i in BACKPACK_SLOTS:
		backpack_items.append({})
	var p1 := _catalog_item_by_id("potion_hp_small")
	if not p1.is_empty():
		p1["qty"] = 3
		backpack_items[0] = p1
	var p2 := _catalog_item_by_id("potion_ki")
	if not p2.is_empty():
		p2["qty"] = 2
		backpack_items[1] = p2
	var sc := _catalog_item_by_id("scroll_tp")
	if not sc.is_empty():
		sc["qty"] = 1
		backpack_items[2] = sc

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_PASS
	_load_progression_db()
	_init_starter_backpack()
	bar_shader = load("res://shaders/rpg_bar.gdshader")
	circle_shader = load("res://shaders/circle_icon.gdshader")
	_build_shader_widgets()
	_build_modal_layer()
	_build_hud_editor_bar()
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
	if FileAccess.file_exists(path):
		var bytes := FileAccess.get_file_as_bytes(path)
		if not bytes.is_empty():
			var img := Image.new()
			var err := img.load_webp_from_buffer(bytes) if path.ends_with(".webp") else (img.load_png_from_buffer(bytes) if path.ends_with(".png") else img.load_jpg_from_buffer(bytes))
			if err == OK:
				var itex := ImageTexture.create_from_image(img)
				ui_tex_cache[path] = itex
				return itex
	return null

func _icon_tex(fname: String) -> Texture2D:
	if fname.is_empty():
		return null
	return _load_tex("res://assets/ui/icons/" + fname)

func _load_progression_db() -> void:
	var rank_rules: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://data/talent_rank_rules.json"))
	if rank_rules is Dictionary:
		talent_rank_rules = rank_rules

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

func talent_rank(nid: String) -> int:
	return int(_unlocked_map().get(nid, 0))

func talent_rank_limit(nid: String) -> int:
	var by_race: Dictionary = talent_rank_rules.get("rankable", {})
	var rankable: Array = by_race.get(_race_key(), [])
	return int(talent_rank_rules.get("maxRank", 1)) if nid in rankable else 1

func talent_power(nid: String) -> float:
	var rank := talent_rank(nid)
	return 0.5 * (1.0 + 0.1 * float(rank - 1)) if rank > 0 else 0.0

func talent_attack_multiplier(nid: String, base: float) -> float:
	var power := talent_power(nid)
	return 1.0 + (base - 1.0) * power if base >= 1.0 else base * power

func _restore_talent_ranks(nodes: Array, ranks: Dictionary) -> void:
	var umap := _unlocked_map()
	umap.clear()
	umap["R"] = 1
	for node in nodes:
		var nid := str(node)
		if nid != "R" and not _node_by_id(nid).is_empty():
			umap[nid] = clampi(int(ranks.get(nid, 1)), 1, int(talent_rank_rules.get("maxRank", 1)))

func _restore_talent_hotbar(slots: Array) -> void:
	if slots.size() < 4:
		return
	for slot in 4:
		var nid := str(slots[slot])
		if nid in ASSIGNABLE_NODES:
			hotbar_nodes[slot + 1] = nid
	_refresh_hotbar_icons()

func export_talent_progress() -> Dictionary:
	return {"talentRanks": _unlocked_map().duplicate(), "skillPoints": skill_points, "hotbarSlots": hotbar_nodes.slice(1, 5)}

func restore_talent_progress(kit: Dictionary) -> void:
	var ranks: Variant = kit.get("talentRanks", {})
	if ranks is Dictionary:
		var nodes: Array = ranks.keys()
		var legacy_nodes: Variant = kit.get("learned", [])
		if nodes.is_empty() and legacy_nodes is Array:
			nodes = legacy_nodes
		_restore_talent_ranks(nodes, ranks)
		var spent := 0
		for nid in _unlocked_map():
			if nid != "R":
				spent += talent_rank(nid)
		skill_points = clampi(int(kit.get("skillPoints", maxi(0, hero_level - spent))), 0, 200)
	var slots: Variant = kit.get("hotbarSlots", kit.get("slots", []))
	if slots is Array:
		_restore_talent_hotbar(slots)
	recalc_stats(false)

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
	var min_lv := int(nd.get("minLevel", 1))
	var reqs: Array = nd.get("requiresAny", [])
	var prereq_ok := reqs.is_empty()
	if not prereq_ok:
		for r_var in reqs:
			if umap.get(str(r_var), false):
				prereq_ok = true
				break
	if not prereq_ok:
		return "locked"
	if hero_level < min_lv:
		return "level_locked"
	return "available"

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
		if str(sl.get("id", "")) == "":
			continue
		sum += float(sl.get(key, 0.0))
	return sum

func get_total_training_sessions() -> int:
	var tot := 0
	for k in ["hp", "ki", "atk", "def", "spd", "crit"]:
		tot += maxi(0, int(training_ranks.get(k, 0)))
	return tot

func _training_mastery_rank() -> int:
	var rank := int(training_ranks.get("hp", 0))
	for stat in ["ki", "atk", "def", "spd", "crit"]:
		rank = mini(rank, int(training_ranks.get(stat, 0)))
	return rank

func get_training_mastery_title() -> String:
	var rank := _training_mastery_rank()
	if rank >= 15:
		return "Mistrz Ki"
	if rank >= 10:
		return "Weteran Stolicy"
	if rank >= 6:
		return "Wojownik Miasta"
	if rank >= 3:
		return "Adept Miasta"
	return "Rekrut"

# HP, ATK and DEF, matching computeTrainingBonuses on the server.
func _training_mastery_bonus() -> Vector3i:
	var rank := _training_mastery_rank()
	if rank >= 15:
		return Vector3i(50, 8, 6)
	if rank >= 10:
		return Vector3i(25, 4, 4)
	if rank >= 6:
		return Vector3i(10, 2, 2)
	return Vector3i.ZERO

func get_active_blessing_kind() -> String:
	if active_blessing.is_empty():
		return ""
	var exp_ms := int(active_blessing.get("expires_ms", 0))
	if exp_ms <= Time.get_ticks_msec():
		active_blessing.clear()
		return ""
	return str(active_blessing.get("kind", ""))

func has_talent(nid: String) -> bool:
	return talent_rank(nid) > 0

func get_talent_passives() -> Dictionary:
	var p := {
		"hpPct": 0.0,
		"kiPct": 0.0,
		"atkPct": 0.0,
		"defPct": 0.0,
		"spdPct": 0.0,
		"critFlat": 0.0,
		"kiRegenPct": 0.0,
		"dmgMult": 0.0,
		"kiCostMult": 1.0,
		"shieldMult": 1.0,
		"a1CdMult": 1.0,
		"b1CdMult": 1.0,
		"dodgeCdMult": 1.0,
		"atkIntervalMult": 1.0,
		"rangeMult": 0.0,
		"resGainMult": 1.0,
		"killHealPct": 0.0,
		"oocHpRegenBonus": 0.0,
	}
	var rk := _race_key()
	if rk == "planetary":
		p["spdPct"] += 0.06 * talent_power("A2")
		p["critFlat"] += 5.0 * talent_power("A6")
		p["a1CdMult"] = maxf(0.10, 1.0 - 0.30 * talent_power("A8"))
		p["dodgeCdMult"] = p["a1CdMult"]
		p["kiRegenPct"] += 0.15 * talent_power("B2")
		p["defPct"] += 0.08 * talent_power("B3")
		p["hpPct"] += 0.10 * talent_power("C2")
		p["oocHpRegenBonus"] += 0.01 * talent_power("C3")
	elif rk == "sage":
		p["dmgMult"] += 0.10 * talent_power("A2")
		p["a1CdMult"] = maxf(0.10, 1.0 - 0.20 * talent_power("A3"))
		p["critFlat"] += 8.0 * talent_power("A6")
		p["defPct"] += 0.10 * talent_power("B2")
		p["shieldMult"] += 0.30 * talent_power("B7")
		p["kiPct"] += 0.15 * talent_power("C2")
		p["kiRegenPct"] += 0.12 * talent_power("C3")
		p["kiCostMult"] = maxf(0.10, 1.0 - 0.08 * talent_power("C3"))
	elif rk == "android":
		p["critFlat"] += 6.0 * talent_power("A2")
		p["rangeMult"] += 0.15 * talent_power("A3")
		p["atkIntervalMult"] = maxf(0.10, 1.0 - 0.08 * talent_power("A6"))
		p["atkIntervalMult"] *= 1.0 + 0.10 * talent_power("A7")
		p["defPct"] += 0.08 * talent_power("B2")
		p["shieldMult"] += 0.25 * talent_power("B3")
		p["oocHpRegenBonus"] += 0.005 * talent_power("B6")
		p["b1CdMult"] = maxf(0.10, 1.0 - 0.35 * talent_power("B8"))
		p["kiPct"] += 0.12 * talent_power("C5")
		p["kiCostMult"] = maxf(0.10, 1.0 - 0.20 * talent_power("C6"))
	elif rk == "legend":
		p["atkPct"] += 0.08 * talent_power("A5")
		p["critFlat"] += 6.0 * talent_power("A6")
		p["defPct"] += 0.08 * talent_power("B2")
		p["hpPct"] += 0.10 * talent_power("B3")
		p["killHealPct"] += 0.03 * talent_power("B6")
		p["resGainMult"] += 0.50 * talent_power("C2")
		p["kiRegenPct"] += 0.25 * talent_power("C6")
	return p

func get_total_attack() -> int:
	var rd := _race_data()
	var base: Dictionary = rd.get("base", {})
	var per_lv: Dictionary = rd.get("perLevel", {})
	var lv_off := float(hero_level - 1)
	var p := get_talent_passives()
	var b_mult := 1.10 if get_active_blessing_kind() == "might" else 1.0
	var raw := float(base.get("attack", 14)) + float(per_lv.get("attack", 4)) * lv_off + float(bonus_stat_pts.get("atk", 0)) * 5.0 + float(training_ranks.get("atk", 0)) * 2.0 + _training_mastery_bonus().y + _equip_bonus("atk")
	return maxi(1, int(round(raw * (1.0 + float(p["atkPct"])) * b_mult)))

func get_total_defense() -> int:
	var rd := _race_data()
	var base: Dictionary = rd.get("base", {})
	var per_lv: Dictionary = rd.get("perLevel", {})
	var lv_off := float(hero_level - 1)
	var p := get_talent_passives()
	var b_mult := 1.10 if get_active_blessing_kind() == "might" else 1.0
	var raw := float(base.get("defense", 5)) + float(per_lv.get("defense", 2.2)) * lv_off + float(bonus_stat_pts.get("def", 0)) * 4.0 + ceilf(float(training_ranks.get("def", 0)) * 1.5) + _training_mastery_bonus().z + _equip_bonus("def")
	return maxi(0, int(round(raw * (1.0 + float(p["defPct"])) * b_mult)))

func get_total_speed() -> int:
	var rd := _race_data()
	var base: Dictionary = rd.get("base", {})
	var lv_off := float(mini(hero_level - 1, 19))
	var spd_base := float(base.get("speed", 185))
	var p := get_talent_passives()
	var b_mult := 1.15 if get_active_blessing_kind() == "march" else 1.0
	var raw := spd_base * (1.0 + 0.05 * lv_off) + float(bonus_stat_pts.get("spd", 0)) * 15.0 + float(training_ranks.get("spd", 0)) * 6.0 + _equip_bonus("spd")
	return maxi(30, int(round(raw * (1.0 + float(p["spdPct"])) * b_mult)))

func get_speed_mult() -> float:
	var rd := _race_data()
	var base: Dictionary = rd.get("base", {})
	var spd_base := maxf(float(base.get("speed", 185)), 1.0)
	return clampf(float(get_total_speed()) / spd_base, 0.25, 4.50)

func get_total_crit() -> float:
	var rd := _race_data()
	var base: Dictionary = rd.get("base", {})
	var per_lv: Dictionary = rd.get("perLevel", {})
	var lv_off := float(hero_level - 1)
	var p := get_talent_passives()
	var raw := float(base.get("criticalChancePercent", 5.0)) + float(per_lv.get("criticalChancePercent", 0.25)) * lv_off + float(bonus_stat_pts.get("crit", 0)) * 2.0 + float(training_ranks.get("crit", 0)) * 0.6 + float(p["critFlat"]) + _equip_bonus("crit")
	return clampf(raw, 0.0, 100.0)

func get_total_ki_regen() -> float:
	var rd := _race_data()
	var base: Dictionary = rd.get("base", {})
	var per_lv: Dictionary = rd.get("perLevel", {})
	var lv_off := float(hero_level - 1)
	var p := get_talent_passives()
	var b_mult := 1.25 if get_active_blessing_kind() == "focus" else 1.0
	var raw := float(base.get("kiRegen", 1.2)) + float(per_lv.get("kiRegen", 0.08)) * lv_off + float(training_ranks.get("ki", 0)) * 0.08
	return maxf(0.4, raw * (1.0 + float(p["kiRegenPct"])) * b_mult)

func get_ki_power() -> int:
	var atk := float(get_total_attack())
	var def := float(get_total_defense())
	var transformed := world != null and float(world.get("ki_mode_timer")) > 0.0
	if transformed:
		atk = roundf(atk * world.ki_form_attack_multiplier())
		def = roundf(def * (1.0 + 0.15 * world._ki_form_power()))
	return maxi(0, int(round(hero_max_hp + hero_max_ki + 10.0 * (atk + def))))


func get_basic_attack_interval() -> float:
	var rd := _race_data()
	var base: Dictionary = rd.get("base", {})
	var ms := float(base.get("attackIntervalMs", 650.0))
	var p := get_talent_passives()
	var mult := float(p["atkIntervalMult"])
	if _race_key() == "legend" and world != null and float(world.hero_buffs.get("streak_haste_t", 0.0)) > 0.05:
		mult *= maxf(0.10, 1.0 - 0.10 * talent_power("A3"))
	return clampf((ms / 1000.0) * mult, 0.32, 1.40)

func apply_local_city_training(stat_key: String) -> Dictionary:
	if not training_ranks.has(stat_key):
		return {"ok": false, "notice": "Nieznana statystyka treningu."}
	var now_ms := Time.get_ticks_msec()
	if last_training_ms > 0 and now_ms - last_training_ms < TRAINING_COOLDOWN_MS:
		var wait_s := int(ceil(float(TRAINING_COOLDOWN_MS - (now_ms - last_training_ms)) / 1000.0))
		return {"ok": false, "notice": "Odpocznij chwilę przed kolejną sesją treningową (%d s)." % wait_s}
	var cap := 3 + maxi(0, hero_level - 1) * 2
	var cur := int(training_ranks.get(stat_key, 0))
	if cur >= cap:
		return {"ok": false, "notice": "Osiągnięto limit treningu %s na Poz.%d (%d/%d). Awansuj poziom!" % [stat_key.to_upper(), hero_level, cur, cap]}
	var cost := 0 if cur < 3 else (15 + (cur - 2) * 10)
	if hero_gold < cost:
		return {"ok": false, "notice": "Za mało złota na trening (%d zł)." % cost}
	hero_gold -= cost
	training_ranks[stat_key] = cur + 1
	last_training_ms = now_ms
	# Training raises stats permanently WITHOUT granting XP or leveling up!
	recalc_stats(false)
	var cost_txt := " (-%d zł)" % cost if cost > 0 else " (darmowy)"
	return {"ok": true, "notice": "Trening w mieście [%s %d/%d]%s — statystyki wzrosły bez wbijania poziomu!" % [stat_key.to_upper(), cur + 1, cap, cost_txt]}

func apply_local_blessing(kind: String) -> void:
	active_blessing = {"kind": kind, "expires_ms": Time.get_ticks_msec() + BLESSING_DURATION_MS}
	recalc_stats(true)

func recalc_stats(refill: bool = false) -> void:
	var rd := _race_data()
	var base: Dictionary = rd.get("base", {})
	var per_lv: Dictionary = rd.get("perLevel", {})
	var lv_off := float(hero_level - 1)
	var p := get_talent_passives()
	var old_mhp := hero_max_hp
	var old_mki := hero_max_ki
	var raw_hp := float(base.get("hp", 140)) + float(per_lv.get("hp", 35)) * lv_off + float(bonus_stat_pts.get("hp", 0)) * 25.0 + float(training_ranks.get("hp", 0)) * 12.0 + _training_mastery_bonus().x + _equip_bonus("hp")
	var raw_ki := float(base.get("ki", 45)) + float(per_lv.get("ki", 4)) * lv_off + float(bonus_stat_pts.get("ki", 0)) * 15.0 + float(training_ranks.get("ki", 0)) * 8.0 + _equip_bonus("ki")
	hero_max_hp = maxf(10.0, round(raw_hp * (1.0 + float(p["hpPct"]))))
	hero_max_ki = maxf(0.0, round(raw_ki * (1.0 + float(p["kiPct"]))))
	if refill:
		hero_hp = hero_max_hp
		hero_ki = hero_max_ki
	else:
		hero_hp = clampf(hero_hp + maxf(0.0, hero_max_hp - old_mhp), 1.0, hero_max_hp)
		hero_ki = clampf(hero_ki + maxf(0.0, hero_max_ki - old_mki), 0.0, hero_max_ki)
	_sync_bar_uniforms()
	_refresh_visuals()

func reset_cooldowns_gm() -> void:
	for i in cooldowns.size():
		cooldowns[i] = 0.0
	dodge_cd = 0.0
	channel_cd = 0.0
	_refresh_visuals()

const XP_NEEDED_BY_LEVEL := [
	1400, 2400, 3500, 4700,
	11000, 15500, 20500, 25000, 30000,
	42000, 54000, 68000, 82000, 98000,
	115000, 132000, 150000, 170000, 195000, 220000,
]

static func xp_needed_for_level(lv: int) -> float:
	var idx := clampi(lv - 1, 0, XP_NEEDED_BY_LEVEL.size() - 1)
	return float(XP_NEEDED_BY_LEVEL[idx])

func grant_local_xp(rxp: int) -> bool:
	if rxp <= 0:
		return false
	hero_max_xp = xp_needed_for_level(hero_level)
	hero_xp = maxf(0.0, hero_xp + float(rxp))
	var leveled := false
	while hero_level < 20 and hero_xp >= hero_max_xp:
		hero_xp -= hero_max_xp
		hero_level += 1
		free_stat_points += 3
		skill_points += 1
		hero_max_xp = xp_needed_for_level(hero_level)
		leveled = true
	if hero_level >= 20:
		hero_xp = minf(hero_xp, hero_max_xp)
	if leveled:
		recalc_stats(true)
	else:
		_sync_bar_uniforms()
		_refresh_visuals()
	return leveled

func take_combat_damage(dmg: int) -> bool:
	if dmg <= 0:
		return false
	var rem := float(dmg)
	if world != null and ("ki_mode_timer" in world) and float(world.ki_mode_timer) > 0.0:
		rem = maxf(1.0, rem * 0.85)
	if hero_shield_hp > 0.0 and hero_shield_timer > 0.0:
		var absorbed := minf(hero_shield_hp, rem)
		hero_shield_hp = maxf(0.0, hero_shield_hp - absorbed)
		rem -= absorbed
	if rem > 0.0:
		hero_hp = maxf(0.0, hero_hp - rem)
	_sync_bar_uniforms()
	_refresh_visuals()
	return hero_hp <= 0.0

static func _catalog_item_by_id(iid: String) -> Dictionary:
	var gm_script = preload("res://scripts/gm_panel.gd")
	return gm_script.find_item(iid)

func apply_server_character(ch: Dictionary) -> void:
	var st: Dictionary = ch.get("state", {})
	var stats: Dictionary = ch.get("stats", {})
	if str(ch.get("name", "")) != "":
		hero_custom_name = str(ch.get("name", ""))
		hero_name = hero_custom_name
	hero_level = maxi(1, int(ch.get("level", hero_level)))
	hero_gold = maxi(0, int(ch.get("gold", hero_gold)))
	hero_xp = float(st.get("xp", hero_xp))
	hero_max_xp = maxf(1.0, float(stats.get("xpNeeded", xp_needed_for_level(hero_level))))
	free_stat_points = maxi(0, int(st.get("freeStatPoints", free_stat_points)))
	skill_points = maxi(0, int(st.get("skillPoints", skill_points)))
	var bs: Dictionary = st.get("bonusStats", {})
	for k in ["hp", "ki", "atk", "def", "spd", "crit"]:
		if bs.has(k):
			bonus_stat_pts[k] = maxi(0, int(bs[k]))
	var tr: Dictionary = st.get("training", {})
	for k in ["hp", "ki", "atk", "def", "spd", "crit"]:
		training_ranks[k] = maxi(0, int(tr.get(k, 0)))
	var ab: Variant = st.get("activeBlessing", null)
	if ab is Dictionary and str((ab as Dictionary).get("kind", "")) != "":
		var srv_exp := int((ab as Dictionary).get("expiresAt", 0))
		var now_epoch_ms := int(Time.get_unix_time_from_system() * 1000.0)
		var rem_ms := srv_exp - now_epoch_ms
		if rem_ms > 500:
			active_blessing = {"kind": str((ab as Dictionary).get("kind", "")), "expires_ms": Time.get_ticks_msec() + rem_ms}
		else:
			active_blessing.clear()
	else:
		active_blessing.clear()
	var nodes_arr: Array = st.get("unlockedNodes", [])
	if not nodes_arr.is_empty():
		_restore_talent_ranks(nodes_arr, st.get("talentRanks", {}))
	var hb_raw: Variant = st.get("hotbarSlots", null)
	if hb_raw is Array:
		_restore_talent_hotbar(hb_raw)
	var eq_raw: Dictionary = st.get("equipment", {})
	for si in equip_slots.size():
		var sk := str(si)
		var side_i := -1 if si < 4 else 1
		var row_i := si % 4
		if eq_raw.has(sk):
			var iid = eq_raw[sk]
			if iid == null or str(iid) == "":
				equip_slots[si] = {"side": side_i, "row": row_i, "id": "", "icon": "", "name": "Pusty", "rarity": Color(0.56, 0.50, 0.42)}
			else:
				var cdef := _catalog_item_by_id(str(iid))
				if not cdef.is_empty():
					cdef["side"] = side_i
					cdef["row"] = row_i
					equip_slots[si] = cdef
	if backpack_items.size() != BACKPACK_SLOTS:
		backpack_items.clear()
		for _i in BACKPACK_SLOTS:
			backpack_items.append({})
	var bp_raw: Array = st.get("backpack", [])
	for bi in BACKPACK_SLOTS:
		if bi >= bp_raw.size() or bp_raw[bi] == null or not (bp_raw[bi] is Dictionary):
			backpack_items[bi] = {}
		else:
			var entry: Dictionary = bp_raw[bi] as Dictionary
			var cdef := _catalog_item_by_id(str(entry.get("id", "")))
			if not cdef.is_empty():
				cdef["qty"] = maxi(1, int(entry.get("qty", 1)))
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
	if backpack_items.size() != BACKPACK_SLOTS:
		while backpack_items.size() < BACKPACK_SLOTS:
			backpack_items.append({})
	var iid := str(item_def.get("id", ""))
	if iid.is_empty():
		return false
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

func unequip_slot(slot_i: int) -> void:
	if slot_i < 0 or slot_i >= equip_slots.size():
		return
	var eq: Dictionary = equip_slots[slot_i]
	var iid := str(eq.get("id", ""))
	if iid.is_empty():
		return
	if world != null and world.has_method("dispatch_server_action") and world.dispatch_server_action({"type": "unequip_item", "equipSlot": slot_i}):
		if world.get("audio") != null:
			world.audio.sfx("ui/click")
		return
	var item_def := _catalog_item_by_id(iid)
	if item_def.is_empty():
		item_def = eq.duplicate(true)
		item_def["slot"] = slot_i
	if add_item_to_backpack(item_def, 1):
		var side_i := -1 if slot_i < 4 else 1
		var row_i := slot_i % 4
		equip_slots[slot_i] = {"side": side_i, "row": row_i, "id": "", "icon": "", "name": "Pusty", "rarity": Color(0.56, 0.50, 0.42)}
		recalc_stats(false)
		if world != null and world.has_method("show_combat_toast"):
			world.show_combat_toast("Zdjęto: %s" % str(item_def.get("name", iid)), Color(0.92, 0.86, 0.62))
	elif world != null and world.has_method("show_combat_toast"):
		world.show_combat_toast("Plecak jest pełny (24/24) — nie można zdjąć przedmiotu!", Color(1.0, 0.48, 0.36))

static func _restored_vital(item: Dictionary, field: String) -> float:
	var legacy_field := "heal_hp" if field == "healHp" else "heal_ki"
	return maxf(0.0, float(item.get(field, item.get(legacy_field, 0))))

func hp_potion_count() -> int:
	var total := 0
	for item: Dictionary in backpack_items:
		if _restored_vital(item, "healHp") > 0.0:
			total += int(item.get("qty", 1))
	return total

func use_quick_hp_potion(on_done: Callable = Callable()) -> bool:
	for idx in backpack_items.size():
		if _restored_vital(backpack_items[idx], "healHp") > 0.0:
			use_backpack_slot(idx, on_done)
			return true
	return false

var _backpack_use_pending := false

func use_backpack_slot(idx: int, on_done: Callable = Callable()) -> void:
	if _backpack_use_pending:
		return
	if idx < 0 or idx >= backpack_items.size():
		return
	var it: Dictionary = backpack_items[idx]
	if it.is_empty():
		return
	# Material click protection: NEVER destroy crafting materials on click!
	if str(it.get("cat", "")) == "material":
		if world != null and world.has_method("show_combat_toast"):
			world.show_combat_toast("%s — surowiec rzemieślniczy (Kuźnia lub sprzedaż w Sklepie)!" % str(it.get("name", "Surowiec")), Color(0.68, 0.90, 1.0))
		return
	var heal_hp := _restored_vital(it, "healHp")
	var heal_ki := _restored_vital(it, "healKi")
	var item_name := str(it.get("name", "Przedmiot"))
	var hp_before := hero_hp
	if world != null and world.is_server_authoritative():
		var damage: Array[Dictionary] = world.snapshot_unsettled_damage() if heal_hp > 0.0 else []
		_backpack_use_pending = true
		world.dispatch_server_action({"type": "use_item", "backpackIndex": idx, "expectedItemId": str(it.get("id", ""))}, func(result: Dictionary) -> void:
			_backpack_use_pending = false
			var ok := bool(result.get("ok", false))
			var hp_restored := 0.0
			if ok:
				if heal_hp > 0.0:
					# Keep the unhealed part of damage that has not reached the server yet.
					var desired_hp := minf(hero_max_hp, hp_before + heal_hp)
					var pending_before := 0
					for entry: Dictionary in damage:
						pending_before += int(entry["amount"])
					var settled := maxi(0, pending_before - ceili(maxf(0.0, hero_hp - desired_hp)))
					var outstanding: int = world.settle_potion_damage(damage, settled)
					var during := maxi(0, outstanding - (pending_before - settled))
					hero_hp = maxf(1.0, minf(hero_hp - outstanding, desired_hp - during))
					hp_restored = maxf(0.0, minf(heal_hp, desired_hp - hp_before))
					_sync_bar_uniforms()
					_refresh_visuals()
				if world.audio != null:
					world.audio.sfx("common/potion" if heal_hp > 0.0 or heal_ki > 0.0 else "ui/click")
			elif not on_done.is_valid():
				world.show_combat_toast(str(result.get("notice", "Nie można użyć przedmiotu.")), Color(1.0, 0.56, 0.36))
			if on_done.is_valid():
				on_done.call(ok, item_name, hp_restored, str(result.get("notice", "")))
		)
		return
	var slot_i := int(it.get("slot", -1))
	if slot_i >= 0 and slot_i < equip_slots.size():
		var min_lv := int(it.get("minLevel", 1))
		if hero_level < min_lv:
			if world != null and world.has_method("show_combat_toast"):
				world.show_combat_toast("Wymagany poziom %d, aby założyć %s!" % [min_lv, str(it.get("name", ""))], Color(1.0, 0.56, 0.34))
			return
		var old_eq := equip_slots[slot_i].duplicate(true)
		var had_old := not str(old_eq.get("id", "")).is_empty()
		var new_eq := it.duplicate(true)
		new_eq["side"] = -1 if slot_i < 4 else 1
		new_eq["row"] = slot_i % 4
		equip_slots[slot_i] = new_eq
		var cur_q := int(it.get("qty", 1)) - 1
		if cur_q > 0:
			backpack_items[idx]["qty"] = cur_q
			if had_old:
				old_eq["slot"] = slot_i
				old_eq["qty"] = 1
				add_item_to_backpack(old_eq, 1)
		else:
			if had_old:
				old_eq["slot"] = slot_i
				old_eq["qty"] = 1
				backpack_items[idx] = old_eq
			else:
				backpack_items[idx] = {}
		recalc_stats(false)
		return
	# In local games the use and the healing are applied in the same frame.
	if world != null and world.get("audio") != null:
		world.audio.sfx("common/potion" if heal_hp > 0.0 or heal_ki > 0.0 else "ui/click")
	if heal_hp > 0.0 or heal_ki > 0.0:
		hero_hp = minf(hero_max_hp, hero_hp + heal_hp)
		hero_ki = minf(hero_max_ki, hero_ki + heal_ki)
		if heal_hp > 0.0 and world != null:
			world.settle_potion_damage(world.snapshot_unsettled_damage(), int(hero_hp - hp_before))
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
	if on_done.is_valid():
		on_done.call(true, item_name, hero_hp - hp_before, "")

func _refresh_hotbar_icons() -> void:
	var rk := _race_key()
	for i in mini(hotbar_icon_rects.size(), hotbar_nodes.size()):
		if i == 0:
			hotbar_icon_rects[i].texture = _load_tex("res://assets/ui/obsidian/btn_attack.webp")
			hotbar_icon_rects[i].material = null
			hotbar_icon_rects[i].stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
			hotbar_ring_rects[i].visible = false
		else:
			var nid := get_hotbar_node(i)
			hotbar_icon_rects[i].texture = _icon_tex("%s-%s.webp" % [rk, nid])
			hotbar_icon_rects[i].material = hotbar_icon_mats[i]
			hotbar_icon_rects[i].stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
			hotbar_ring_rects[i].visible = true

func set_region(land: String) -> void:
	current_land = land
	var meta: Dictionary = LAND_META.get(_hero_land(), LAND_META["pyra"])
	hero_name = hero_custom_name if hero_custom_name != "" else str(meta["hero"])
	selected_node_id = "A1"

	portrait_rect.texture = _load_tex(str(meta["portrait"]))
	char_portrait_rect.texture = _load_tex(str(meta["portrait"]))
	race_badge_rect.texture = _icon_tex(str(meta["race_icon"]))
	_refresh_hotbar_icons()

	res_bar_mat.set_shader_parameter("color_dark", meta["res_dark"])
	res_bar_mat.set_shader_parameter("color_bright", meta["res_bright"])
	recalc_stats(true)
	_rebuild_talent_icon_widgets()
	_layout_all()
	_refresh_visuals()

func _sync_bar_uniforms() -> void:
	hp_bar_mat.set_shader_parameter("fill_ratio", clampf(hero_hp / maxf(hero_max_hp, 1.0), 0.0, 1.0))
	ki_bar_mat.set_shader_parameter("fill_ratio", clampf(hero_ki / maxf(hero_max_ki, 1.0), 0.0, 1.0))
	var res_fill := clampf(hero_res_ratio, 0.0, 1.0) if hero_res_ratio >= 0.0 else clampf(hero_res / 100.0, 0.0, 1.0)
	res_bar_mat.set_shader_parameter("fill_ratio", res_fill)
	xp_bar_mat.set_shader_parameter("fill_ratio", clampf(hero_xp / maxf(hero_max_xp, 1.0), 0.0, 1.0))

func sync_status(loc: String, safe: bool) -> void:
	var next_loc := loc if not loc.is_empty() else "Stolica"
	if next_loc == nearest_loc and safe == in_safe_city:
		return
	nearest_loc = next_loc
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

func get_hotbar_node(idx: int) -> String:
	if idx >= 0 and idx < hotbar_nodes.size():
		return str(hotbar_nodes[idx])
	if idx >= 0 and idx < HOTBAR_NODE_IDS.size():
		return str(HOTBAR_NODE_IDS[idx])
	return "R"

func get_skill_spec(nid: String) -> Dictionary:
	var rk := _race_key()
	var rmap: Dictionary = SKILL_SPECS.get(rk, SKILL_SPECS["legend"])
	if rmap.has(nid):
		return rmap[nid] as Dictionary
	return {"cd": 8.0, "ki": 12.0, "mult": 1.6, "radius": 165.0, "clip": "skill", "fb": "skill"}

func get_hotbar_skill_min_level(idx: int) -> int:
	if idx <= 0 or idx >= hotbar_nodes.size():
		return 1
	var nid := get_hotbar_node(idx)
	var nd := _node_by_id(nid)
	if not nd.is_empty():
		return int(nd.get("minLevel", 20 if nid == "T" else 2))
	return 20 if nid == "T" else (9 if nid in ["A4", "B4", "C4"] else (17 if nid in ["A9", "B9", "C9"] else 2))

func get_hotbar_skill_cd(idx: int) -> float:
	if idx == 0:
		return get_basic_attack_interval()
	var nid := get_hotbar_node(idx)
	var spec := get_skill_spec(nid)
	var cd_val := float(spec.get("cd", HOTBAR_CDS[clampi(idx, 0, HOTBAR_CDS.size() - 1)]))
	var p := get_talent_passives()
	if nid == "A1":
		cd_val *= float(p["a1CdMult"])
	elif nid == "B1":
		cd_val *= float(p["b1CdMult"])
	if _race_key() == "sage" and nid != "T" and world != null and float(world.get("ki_mode_timer")) > 0.0:
		cd_val *= maxf(0.10, 1.0 - 0.30 * world._ki_form_power())
	return maxf(1.2, cd_val)

func get_hotbar_skill_ki(idx: int) -> float:
	if idx == 0:
		return 0.0
	if world != null and world.has_method("is_free_ki_active") and world.is_free_ki_active():
		return 0.0
	var nid := get_hotbar_node(idx)
	var spec := get_skill_spec(nid)
	var base_ki := float(spec.get("ki", HOTBAR_KI_COSTS[clampi(idx, 0, HOTBAR_KI_COSTS.size() - 1)]))
	return base_ki * float(get_talent_passives()["kiCostMult"])

func is_hotbar_skill_unlocked(idx: int) -> bool:
	if idx <= 0:
		return true
	if idx >= hotbar_nodes.size():
		return false
	var nid := get_hotbar_node(idx)
	if not bool(_unlocked_map().get(nid, false)):
		return false
	return hero_level >= get_hotbar_skill_min_level(idx)

func assign_hotbar_slot(slot_idx: int, nid: String) -> bool:
	if slot_idx < 1 or slot_idx > 4:
		return false
	if not (nid in ASSIGNABLE_NODES):
		return false
	if not has_talent(nid):
		if world != null and world.has_method("show_combat_toast"):
			world.show_combat_toast("Najpierw odblokuj węzeł [%s], aby przypisać go na pasek!" % nid, Color(1.0, 0.68, 0.34))
		return false
	var prev_nid := hotbar_nodes[slot_idx]
	for k in range(1, 5):
		if k != slot_idx and hotbar_nodes[k] == nid:
			hotbar_nodes[k] = prev_nid
			break
	hotbar_nodes[slot_idx] = nid
	_refresh_hotbar_icons()
	_refresh_visuals()
	if world != null and world.get("audio") != null:
		world.audio.sfx("ui/confirm", 0.78, 0.04)
	if world != null and world.has_method("dispatch_server_action"):
		world.dispatch_server_action({"type": "set_hotbar", "slot": slot_idx - 1, "nodeId": nid})
	if world != null and world.has_method("show_combat_toast"):
		var nd := _node_by_id(nid)
		world.show_combat_toast("Slot [%d] → %s (%s)" % [slot_idx, str(nd.get("name", nid)), nid], Color(0.56, 0.96, 1.0))
	return true

func trigger_dodge() -> void:
	if dodge_cd > 0.05:
		return
	dodge_cd = 4.5
	if world != null and world.has_method("perform_dodge"):
		world.perform_dodge(false)
	_refresh_visuals()

func trigger_channel() -> void:
	if channel_cd > 0.05:
		return
	if hero_ki >= hero_max_ki - 0.5:
		if world != null and world.has_method("show_combat_toast"):
			world.show_combat_toast("Energia KI jest już pełna!", Color(0.56, 0.90, 1.0))
		return
	channel_cd = 2.5
	if world != null and world.has_method("start_ki_channel"):
		world.start_ki_channel(2.0, 0.28, 0.0)
	_refresh_visuals()

func trigger_skill(idx: int) -> void:
	if idx < 0 or idx >= cooldowns.size():
		return
	if cooldowns[idx] > 0.05:
		return
	var nid := get_hotbar_node(idx)
	if idx > 0 and not is_hotbar_skill_unlocked(idx):
		var req_lv := get_hotbar_skill_min_level(idx)
		if world != null and world.has_method("show_combat_toast"):
			if nid == "T":
				world.show_combat_toast("Forma KI [T] odblokowuje się od poz. %d w drzewku [K] (wymaga A9, B9 lub C9)!" % req_lv, Color(1.0, 0.68, 0.34))
			else:
				world.show_combat_toast("Odblokuj talent [%s] (Poz.%d) w drzewku [K], aby użyć tej umiejętności!" % [nid, req_lv], Color(1.0, 0.68, 0.34))
		return
	if world != null and world.has_method("can_hero_cast_skill") and not world.can_hero_cast_skill(nid):
		return
	var ki_cost := get_hotbar_skill_ki(idx)
	if ki_cost > 0.0 and hero_ki < ki_cost:
		if world != null and world.has_method("show_combat_toast"):
			world.show_combat_toast("Za mało energii KI (%d / %d)!" % [int(hero_ki), int(ceil(ki_cost))], Color(0.42, 0.84, 1.0))
		return
	cooldowns[idx] = get_hotbar_skill_cd(idx)
	hero_ki = maxf(0.0, hero_ki - ki_cost)

	if world != null and world.has_method("perform_combat_attack"):
		world.perform_combat_attack(idx, 1.0, nid)
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
		if selected_char_idx < 0:
			for bi in backpack_items.size():
				if not backpack_items[bi].is_empty():
					selected_char_source = "backpack"
					selected_char_idx = bi
					break
	_sync_modal_visibility()

func close_modals() -> void:
	show_talents = false
	show_character = false
	hovered_char_item = {}
	selected_char_source = ""
	selected_char_idx = -1
	_last_slot_tap_key = ""
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
	if dodge_cd > 0.0:
		dodge_cd = maxf(0.0, dodge_cd - delta)
		changed = true
	if channel_cd > 0.0:
		channel_cd = maxf(0.0, channel_cd - delta)
		changed = true
	if hero_shield_timer > 0.0:
		hero_shield_timer = maxf(0.0, hero_shield_timer - delta)
		if hero_shield_timer <= 0.0:
			hero_shield_hp = 0.0
		changed = true
	if hero_ki < hero_max_ki:
		hero_ki = minf(hero_max_ki, hero_ki + delta * get_total_ki_regen())
		changed = true
	if is_perf_hud_enabled():
		_perf_refresh_t += delta
		if _perf_refresh_t >= 0.45:
			_perf_refresh_t = 0.0
			changed = true
	if world != null:
		if ("ki_mode_timer" in world) and float(world.ki_mode_timer) > 0.05:
			changed = true
		if ("ki_channel_t" in world) and float(world.ki_channel_t) > 0.05:
			changed = true
		if ("locked_target_id" in world) and not str(world.locked_target_id).is_empty():
			changed = true
	if changed:
		_sync_bar_uniforms()
		_refresh_visuals()

func is_perf_hud_enabled() -> bool:
	return bool(hud_layout.get("show_perf", false))

func set_perf_hud_enabled(enabled: bool, persist: bool = true) -> void:
	hud_layout["show_perf"] = enabled
	_perf_refresh_t = 0.0
	if enabled and world != null and world.has_method("trigger_server_ping"):
		world.trigger_server_ping()
	if persist and world != null and world.has_method("notify_hud_layout_changed"):
		world.notify_hud_layout_changed(hud_layout)
	_refresh_visuals()

# ==============================================================================
# CUSTOMIZABLE HUD LAYOUT & LIVE DRAG-AND-DROP HUD EDITOR
# ==============================================================================

func _build_hud_editor_bar() -> void:
	hud_editor_bar.visible = false
	hud_editor_bar.z_index = 120
	hud_editor_bar.add_theme_stylebox_override("panel", ForgedUI.compact_panel_box(18.0, 10.0, Color(0.94, 0.76, 0.34, 0.96)))
	add_child(hud_editor_bar)

	var hbox := HBoxContainer.new()
	hbox.add_theme_constant_override("separation", 10)
	hud_editor_bar.add_child(hbox)

	var tag := Label.new()
	tag.text = "✥ EDYTOR HUD"
	tag.add_theme_font_override("font", MapStyle.font())
	tag.add_theme_font_size_override("font_size", 14)
	tag.add_theme_color_override("font_color", Color(1.0, 0.92, 0.58))
	hbox.add_child(tag)

	var b_minus := Button.new()
	b_minus.text = "−"
	b_minus.custom_minimum_size = Vector2(38, 38)
	ForgedUI.style_square_button(b_minus, "slate", 20)
	b_minus.pressed.connect(func() -> void: set_hud_scale(get_hud_scale() - 0.05, false))
	hbox.add_child(b_minus)

	hud_scale_bar_lbl.text = "100%"
	hud_scale_bar_lbl.custom_minimum_size = Vector2(52, 0)
	hud_scale_bar_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	hud_scale_bar_lbl.add_theme_font_override("font", MapStyle.font())
	hud_scale_bar_lbl.add_theme_font_size_override("font_size", 14)
	hud_scale_bar_lbl.add_theme_color_override("font_color", Color(0.54, 0.96, 1.0))
	hbox.add_child(hud_scale_bar_lbl)

	var b_plus := Button.new()
	b_plus.text = "+"
	b_plus.custom_minimum_size = Vector2(38, 38)
	ForgedUI.style_square_button(b_plus, "slate", 20)
	b_plus.pressed.connect(func() -> void: set_hud_scale(get_hud_scale() + 0.05, false))
	hbox.add_child(b_plus)

	var b_reset := Button.new()
	b_reset.text = "RESET"
	b_reset.custom_minimum_size = Vector2(96, 38)
	ForgedUI.style_button(b_reset, "slate", 13, 12.0, 6.0)
	b_reset.pressed.connect(func() -> void: reset_hud_layout(false))
	hbox.add_child(b_reset)

	var b_save := Button.new()
	b_save.text = "ZAPISZ"
	b_save.custom_minimum_size = Vector2(114, 38)
	ForgedUI.style_button(b_save, "gold", 14, 14.0, 6.0)
	b_save.pressed.connect(func() -> void: exit_hud_editor(true))
	hbox.add_child(b_save)

func get_hud_scale() -> float:
	return clampf(float(hud_layout.get("scale", 1.0)), 0.85, 1.40)

func get_zone_offset(zone: String) -> Vector2:
	var v = hud_layout.get(zone, [0.0, 0.0])
	if v is Array and (v as Array).size() >= 2:
		return Vector2(float(v[0]), float(v[1]))
	return Vector2.ZERO

func set_zone_offset(zone: String, off: Vector2) -> void:
	var vs := _vp_size()
	var max_x := maxf(vs.x * 0.45, 220.0)
	var max_y := maxf(vs.y * 0.45, 160.0)
	var clamped := Vector2(clampf(off.x, -max_x, max_x), clampf(off.y, -max_y, max_y))
	hud_layout[zone] = [snappedf(clamped.x, 1.0), snappedf(clamped.y, 1.0)]
	_layout_all()
	if world != null and world.has_method("layout_minimap"):
		world.layout_minimap()
	_refresh_visuals()

func set_hud_scale(sc: float, persist: bool = false) -> void:
	hud_layout["scale"] = snappedf(clampf(sc, 0.85, 1.40), 0.05)
	hud_scale_bar_lbl.text = "%d%%" % int(round(get_hud_scale() * 100.0))
	_layout_all()
	if world != null and world.has_method("layout_minimap"):
		world.layout_minimap()
	if persist and world != null and world.has_method("notify_hud_layout_changed"):
		world.notify_hud_layout_changed(hud_layout)
	_refresh_visuals()

func apply_hud_layout(data: Dictionary) -> void:
	if data.is_empty():
		return
	if data.has("scale"):
		hud_layout["scale"] = clampf(float(data["scale"]), 0.85, 1.40)
	if data.has("show_perf"):
		hud_layout["show_perf"] = bool(data["show_perf"])
	for zk: String in ["portrait", "utils", "minimap", "combat", "xp"]:
		var val = data.get(zk, null)
		if val is Array and (val as Array).size() >= 2:
			hud_layout[zk] = [float(val[0]), float(val[1])]
	hud_scale_bar_lbl.text = "%d%%" % int(round(get_hud_scale() * 100.0))
	_layout_all()
	if world != null and world.has_method("layout_minimap"):
		world.layout_minimap()
	_refresh_visuals()

func apply_phone_safe_preset() -> void:
	var keep_perf := is_perf_hud_enabled()
	hud_layout = {
		"scale": 1.05,
		"portrait": [18.0, 8.0],
		"utils": [18.0, 10.0],
		"minimap": [-18.0, 8.0],
		"combat": [-18.0, -10.0],
		"xp": [0.0, -8.0],
		"show_perf": keep_perf,
	}
	hud_scale_bar_lbl.text = "%d%%" % int(round(get_hud_scale() * 100.0))
	_layout_all()
	if world != null and world.has_method("notify_hud_layout_changed"):
		world.notify_hud_layout_changed(hud_layout)
	_refresh_visuals()

func reset_hud_layout(persist: bool = true) -> void:
	var keep_perf := is_perf_hud_enabled()
	hud_layout = {
		"scale": 1.0,
		"portrait": [0.0, 0.0],
		"utils": [0.0, 0.0],
		"minimap": [0.0, 0.0],
		"combat": [0.0, 0.0],
		"xp": [0.0, 0.0],
		"show_perf": keep_perf,
	}
	hud_scale_bar_lbl.text = "100%"
	_layout_all()
	if persist and world != null and world.has_method("notify_hud_layout_changed"):
		world.notify_hud_layout_changed(hud_layout)
	elif world != null and world.has_method("layout_minimap"):
		world.layout_minimap()
	_refresh_visuals()

func enter_hud_editor() -> void:
	close_modals()
	hud_edit_mode = true
	hud_drag_zone = ""
	mouse_filter = Control.MOUSE_FILTER_STOP
	hud_scale_bar_lbl.text = "%d%%" % int(round(get_hud_scale() * 100.0))
	hud_editor_bar.visible = true
	_layout_all()
	if world != null and world.get("audio") != null:
		world.audio.sfx("ui/open", 0.80, 0.03)
	_refresh_visuals()

func exit_hud_editor(save: bool = true) -> void:
	hud_edit_mode = false
	hud_drag_zone = ""
	mouse_filter = Control.MOUSE_FILTER_PASS
	hud_editor_bar.visible = false
	if save and world != null:
		if world.has_method("notify_hud_layout_changed"):
			world.notify_hud_layout_changed(hud_layout)
		if world.get("audio") != null:
			world.audio.sfx("ui/confirm", 0.85, 0.03)
		if world.has_method("show_combat_toast"):
			world.show_combat_toast("✓ Zapisano własny układ i skalę HUD!", Color(0.46, 0.98, 0.68))
	elif world != null and world.has_method("layout_minimap"):
		world.layout_minimap()
	_refresh_visuals()

func _zone_bounds_rect(zone: String) -> Rect2:
	var vs := _vp_size()
	var sc := get_hud_scale()
	match zone:
		"portrait":
			return Rect2(Vector2(10.0, 10.0) + get_zone_offset("portrait"), Vector2(512.0, 168.0))
		"utils":
			return Rect2(Vector2(12.0, 184.0) + get_zone_offset("utils"), Vector2(430.0, 178.0))
		"minimap":
			var mw := 276.0 * sc
			var mh := 256.0 * sc
			if world != null and world.get("premium_minimap") != null:
				return Rect2(world.premium_minimap.position, Vector2(mw, mh))
			var m_off := get_zone_offset("minimap")
			return Rect2(Vector2(vs.x - mw - 12.0 + m_off.x, 10.0 + m_off.y), Vector2(mw, mh))
		"combat":
			var base := _combat_base_center()
			return Rect2(base.x - 332.0 * sc, base.y - 294.0 * sc, 412.0 * sc, 376.0 * sc)
		"xp":
			return _xp_pill_rect().grow(6.0)
	return Rect2()

func _combat_base_center() -> Vector2:
	var vs := _vp_size()
	var sc := get_hud_scale()
	var c_off := get_zone_offset("combat")
	return Vector2(
		clampf(vs.x - 108.0 * sc + c_off.x, 310.0 * sc, vs.x - 76.0 * sc),
		clampf(vs.y - 108.0 * sc + c_off.y, 260.0 * sc, vs.y - 76.0 * sc)
	)

# ==============================================================================
# LAYOUT & CONSTELLATION GRAPH COORDINATES
# ==============================================================================

func _modal_rect() -> Rect2:
	var vs := _vp_size()
	var mw := minf(vs.x - 24.0, 1440.0)
	var mh := minf(vs.y - 20.0, 760.0)
	return Rect2((vs.x - mw) * 0.5, (vs.y - mh) * 0.5, mw, mh)

func _xp_pill_rect() -> Rect2:
	var vs := _vp_size()
	var x_off := get_zone_offset("xp")
	var pw := minf(470.0, vs.x * 0.35)
	var ph := 46.0
	return Rect2(
		clampf((vs.x - pw) * 0.5 + x_off.x, 12.0, maxf(vs.x - pw - 12.0, 12.0)),
		clampf(vs.y - ph - 10.0 + x_off.y, 12.0, maxf(vs.y - ph - 8.0, 12.0)),
		pw,
		ph
	)

func _wild_rift_slot_specs() -> Array[Dictionary]:
	# Ergonomic BIG mobile-readable Wild Rift right-thumb combat cluster!
	var sc := get_hud_scale()
	var base := _combat_base_center()
	var arc_r := 188.0 * sc
	var specs: Array[Dictionary] = [
		{"center": base, "r": 58.0 * sc, "keystone": true},
	]
	var arc_angles := [174.0, 205.0, 236.0, 267.0]
	for ang_deg in arc_angles:
		var rad := deg_to_rad(float(ang_deg))
		specs.append({
			"center": base + Vector2(cos(rad), sin(rad)) * arc_r,
			"r": 42.0 * sc,
			"keystone": false,
		})
	# Grand Ki-Mode Transformation / Ultimate [R] on upper-outer crown of thumb arc
	var ult_rad := deg_to_rad(221.0)
	specs.append({
		"center": base + Vector2(cos(ult_rad), sin(ult_rad)) * (282.0 * sc),
		"r": 47.0 * sc,
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
	var vs := _vp_size()
	var left_bound := 340.0
	var right_bound := vs.x - 294.0
	var avail_w := maxf(right_bound - left_bound, 500.0)
	var nav_w := minf(636.0, avail_w - 12.0)
	var nav_x := left_bound + (avail_w - nav_w) * 0.5
	return Rect2(nav_x, 94.0, nav_w, 42.0)

func _constellation_graph_rect(mr: Rect2) -> Rect2:
	return Rect2(mr.position.x + 64.0, mr.position.y + 118.0, mr.size.x * 0.625, mr.size.y - 210.0)

func _inspector_rect(mr: Rect2) -> Rect2:
	var gr := _constellation_graph_rect(mr)
	var ix := gr.position.x + gr.size.x + 18.0
	var iw := (mr.position.x + mr.size.x - 62.0) - ix
	return Rect2(ix, gr.position.y, maxf(iw, 240.0), gr.size.y + 26.0)

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
		var is_major := ntype in ["starting", "ultimate", "transformation", "ki-mode"]

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

	var active_id := hovered_node_id if not hovered_node_id.is_empty() else selected_node_id
	var sel_nd := _node_by_id(active_id)
	if not sel_nd.is_empty():
		inspector_icon_rect.texture = _icon_tex("%s-%s.webp" % [_race_key(), active_id])
		var sst := _node_state(sel_nd)
		inspector_icon_mat.set_shader_parameter("saturation", 1.08 if sst != "locked" else 0.45)
		inspector_icon_mat.set_shader_parameter("brightness", 1.05 if sst != "locked" else 0.72)
		inspector_ring_rect.texture = tex_keystone if sst == "unlocked" else (tex_avail if sst == "available" else tex_locked)

func _layout_all() -> void:
	var vs := _vp_size()
	var sc := get_hud_scale()
	var p_off := get_zone_offset("portrait")
	# 0) Floating HUD Layout Editor top-center bar (strictly inside open gap between Portrait and Minimap!)
	if hud_editor_bar != null:
		var bw := clampf(vs.x - 820.0, 480.0, 560.0)
		hud_editor_bar.size = Vector2(bw, 58.0)
		hud_editor_bar.position = Vector2(clampf((vs.x - bw) * 0.5, 524.0, maxf(vs.x - 300.0 - bw, 524.0)), 14.0)

	# 1) BIG Mobile-Readable Top-Left Hero Medallion & Vitality Plate (500x164 forged plate!)
	var p_center := Vector2(74.0, 92.0) + p_off
	var p_rad := 56.0
	portrait_rect.position = p_center - Vector2(p_rad, p_rad)
	portrait_rect.size = Vector2(p_rad * 2.0, p_rad * 2.0)
	var ring_rad := 68.0
	portrait_ring_rect.position = p_center - Vector2(ring_rad, ring_rad)
	portrait_ring_rect.size = Vector2(ring_rad * 2.0, ring_rad * 2.0)
	race_badge_rect.position = Vector2(14.0, 14.0) + p_off
	race_badge_rect.size = Vector2(34.0, 34.0)

	hp_bar_rect.position = Vector2(180.0, 52.0) + p_off
	hp_bar_rect.size = Vector2(316.0, 29.0)
	ki_bar_rect.position = Vector2(180.0, 86.0) + p_off
	ki_bar_rect.size = Vector2(286.0, 24.0)
	res_bar_rect.position = Vector2(180.0, 115.0) + p_off
	res_bar_rect.size = Vector2(162.0, 20.0)

	# 2) BIG Bottom-Center Legible XP Bar + Bottom-Right Wild Rift Combat Arc
	var xp_r := _xp_pill_rect()
	xp_bar_rect.position = Vector2(xp_r.position.x + 114.0, xp_r.position.y + 15.0)
	xp_bar_rect.size = Vector2(xp_r.size.x - 236.0, 16.0)

	var wr_specs := _wild_rift_slot_specs()
	for i in mini(wr_specs.size(), hotbar_icon_rects.size()):
		var spec: Dictionary = wr_specs[i]
		var center: Vector2 = spec["center"]
		var r: float = float(spec["r"])
		var ring_pad := (13.0 if bool(spec["keystone"]) else 10.0) * sc
		var rr := r + ring_pad
		if i == 0:
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
		if ntype == "transformation" or ntype == "ki-mode":
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

	# Character Paperdoll Portrait (centered inside the Classic RPG Silhouette on Left Half)
	var paper_cx := mr.position.x + mr.size.x * 0.245
	var paper_cy := mr.position.y + 258.0
	char_portrait_rect.position = Vector2(paper_cx - 58.0, paper_cy - 58.0)
	char_portrait_rect.size = Vector2(116.0, 116.0)
	char_portrait_ring.position = Vector2(paper_cx - 72.0, paper_cy - 72.0)
	char_portrait_ring.size = Vector2(144.0, 144.0)

# ==============================================================================
# BASE LAYER DRAW (SEAMLESS FORGED OBSIDIAN & BURNISHED GOLD PLATES)
# ==============================================================================

var _forged_panel_sb: StyleBox
var _forged_btn_slate_sb: StyleBox
var _forged_btn_gold_sb: StyleBox

func _ensure_forged_boxes() -> void:
	if _forged_panel_sb == null:
		_forged_panel_sb = ForgedUI.compact_panel_box(16.0, 12.0, Color(0.86, 0.68, 0.34, 0.94))
	if _forged_btn_slate_sb == null:
		_forged_btn_slate_sb = ForgedUI.button_box("slate", "normal", 16.0, 8.0)
	if _forged_btn_gold_sb == null:
		_forged_btn_gold_sb = ForgedUI.button_box("gold", "normal", 16.0, 8.0)

func _draw_beveled_chamfer(canvas: CanvasItem, pts: PackedVector2Array, fill: Color, border: Color, inner_border: Color) -> void:
	var sh_pts := PackedVector2Array()
	for p in pts:
		sh_pts.append(p + Vector2(0.0, 5.0))
	canvas.draw_colored_polygon(sh_pts, Color(0.0, 0.0, 0.0, 0.46))
	canvas.draw_colored_polygon(pts, fill)
	var closed := PackedVector2Array(pts)
	closed.append(pts[0])
	canvas.draw_polyline(closed, border, 2.2, true)
	if pts.size() >= 2:
		canvas.draw_line(pts[0] + Vector2(6, 2), pts[1] + Vector2(-6, 2), inner_border, 1.2, true)

func _draw_obsidian_plate(canvas: CanvasItem, rect: Rect2, border: Color) -> void:
	_ensure_forged_boxes()
	if _forged_panel_sb != null:
		_forged_panel_sb.draw(canvas.get_canvas_item(), rect)
		canvas.draw_rect(rect.grow(-4.0), Color(0.88, 0.72, 0.36, 0.24), false, 1.0)
	else:
		canvas.draw_rect(rect, Color(0.06, 0.055, 0.08, 0.94), true)
		canvas.draw_rect(rect, border, false, 2.2)

func _draw_forged_pill(canvas: CanvasItem, rect: Rect2, gold_lit: bool = false) -> void:
	_ensure_forged_boxes()
	var sb := _forged_btn_gold_sb if gold_lit else _forged_btn_slate_sb
	if sb != null:
		sb.draw(canvas.get_canvas_item(), rect)
	else:
		canvas.draw_rect(rect, Color(0.10, 0.09, 0.13, 0.94), true)
		canvas.draw_rect(rect, Color(0.86, 0.68, 0.34, 0.92), false, 2.0)

func _draw() -> void:
	if show_talents or show_character:
		return
	var meta: Dictionary = LAND_META.get(_hero_land(), LAND_META["pyra"])
	var accent: Color = meta["accent"]
	var p_off := get_zone_offset("portrait")
	var sc := get_hud_scale()

	# 1) BIG Top-Left Forged Obsidian Vitality Plate
	var wing_r := Rect2(Vector2(62.0, 12.0) + p_off, Vector2(452.0, 162.0))
	_draw_obsidian_plate(self, wing_r, Color(0.92, 0.72, 0.34, 0.94))
	draw_circle(Vector2(74.0, 92.0) + p_off, 63.0, Color(0.04, 0.035, 0.05, 0.96))

	# 2) BIG Bottom-Center Forged Obsidian XP Bar
	var xp_r := _xp_pill_rect()
	_draw_obsidian_plate(self, xp_r, Color(0.88, 0.70, 0.34, 0.94))

	# 3) BIG Bottom-Right Wild Rift Combat Cluster Molten-Gold Arc & Backings
	var wr_specs := _wild_rift_slot_specs()
	if not wr_specs.is_empty():
		var base_c: Vector2 = wr_specs[0]["center"]
		draw_arc(base_c, 164.0 * sc, deg_to_rad(170.0), deg_to_rad(273.0), 40, Color(0.04, 0.03, 0.05, 0.58), 16.0 * sc, true)
		draw_arc(base_c, 164.0 * sc, deg_to_rad(170.0), deg_to_rad(273.0), 40, Color(0.92, 0.70, 0.28, 0.62), 2.5, true)
		draw_arc(base_c, 254.0 * sc, deg_to_rad(206.0), deg_to_rad(236.0), 18, Color(accent.r, accent.g, accent.b, 0.48), 2.2, true)
		for spec: Dictionary in wr_specs:
			var sp_c: Vector2 = spec["center"]
			var sr: float = float(spec["r"])
			draw_circle(sp_c + Vector2(0.0, 4.0), sr + 7.0, Color(0.0, 0.0, 0.0, 0.54))
			draw_circle(sp_c, sr + 4.5, Color(0.04, 0.035, 0.06, 0.95))

# ==============================================================================
# FOREGROUND HUD DRAW (BIG BOLD MOBILE-READABLE 15-24px LABELS & CONTROLS)
# ==============================================================================

func _draw_hud_foreground(c: CanvasItem) -> void:
	if show_talents or show_character:
		return
	var f: Font = MapStyle.font()
	var fb: Font = MapStyle.body_font()
	var meta: Dictionary = LAND_META.get(_hero_land(), LAND_META["pyra"])
	var accent: Color = meta["accent"]
	var p_off := get_zone_offset("portrait")
	var u_off := get_zone_offset("utils")
	var sc := get_hud_scale()

	# --- A. BIG Top-Left Portrait Level Seal, Hero Title, Gold & Bold Bar Numbers ---
	var seal_c := Vector2(112.0, 138.0) + p_off
	c.draw_circle(seal_c, 22.0, Color(0.06, 0.04, 0.05, 0.98))
	c.draw_arc(seal_c, 22.0, 0.0, TAU, 28, Color(0.98, 0.76, 0.32, 0.98), 3.0, true)
	c.draw_arc(seal_c, 17.0, 0.0, TAU, 24, Color(0.72, 0.48, 0.18, 0.80), 1.4, true)
	var lv_txt := str(hero_level)
	var lv_w := f.get_string_size(lv_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 20).x
	c.draw_string(f, seal_c + Vector2(-lv_w * 0.5, 7.0), lv_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 20, Color(1.0, 0.95, 0.72))

	# Hero Name (23px bold Cinzel) + Race Title (16px)
	var disp_hero_name := (hero_custom_name if hero_custom_name != "" else str(meta["hero"])).to_upper()
	c.draw_string_outline(f, Vector2(150.0, 42.0) + p_off, disp_hero_name, HORIZONTAL_ALIGNMENT_LEFT, -1, 23, 5, Color(0.02, 0.01, 0.02, 0.98))
	c.draw_string(f, Vector2(150.0, 42.0) + p_off, disp_hero_name, HORIZONTAL_ALIGNMENT_LEFT, -1, 23, Color(1.0, 0.94, 0.74))
	var name_w := f.get_string_size(disp_hero_name, HORIZONTAL_ALIGNMENT_LEFT, -1, 23).x
	var sub_txt := str(meta["title"])
	if 150.0 + name_w + 12.0 < 502.0:
		c.draw_string_outline(fb, Vector2(150.0 + name_w + 12.0, 41.0) + p_off, sub_txt, HORIZONTAL_ALIGNMENT_LEFT, int(maxf(504.0 - (150.0 + name_w + 12.0), 40.0)), 16, 4, Color(0.02, 0.01, 0.02, 0.95))
		c.draw_string(fb, Vector2(150.0 + name_w + 12.0, 41.0) + p_off, sub_txt, HORIZONTAL_ALIGNMENT_LEFT, int(maxf(504.0 - (150.0 + name_w + 12.0), 40.0)), 16, Color(accent.r, accent.g, accent.b, 0.98))

	# Crisp Painted Icons beside HP / KI / Racial Resource bars
	var hp_ico := _icon_tex("hud-hp.webp")
	var ki_ico := _icon_tex("hud-ki.webp")
	var res_ico := _icon_tex(str(meta["res_icon"]))
	if hp_ico != null:
		c.draw_texture_rect(hp_ico, Rect2(Vector2(148.0, 52.0) + p_off, Vector2(28.0, 28.0)), false)
	if ki_ico != null:
		c.draw_texture_rect(ki_ico, Rect2(Vector2(149.0, 85.0) + p_off, Vector2(26.0, 26.0)), false)
	if res_ico != null:
		c.draw_texture_rect(res_ico, Rect2(Vector2(151.0, 114.0) + p_off, Vector2(22.0, 22.0)), false)

	# Ki Shield Overlay on HP bar when B1 shield is active!
	if hero_shield_hp > 0.5 and hero_shield_timer > 0.05:
		var sh_frac := clampf(hero_shield_hp / maxf(hero_max_hp, 1.0), 0.0, 1.0)
		var sh_r := Rect2(hp_bar_rect.position + Vector2(2.0, 1.0), Vector2((hp_bar_rect.size.x - 4.0) * sh_frac, 7.0))
		c.draw_rect(sh_r, Color(0.46, 0.94, 1.0, 0.92), true)

	var hp_str := "%d / %d" % [int(round(hero_hp)), int(round(hero_max_hp))]
	if hero_shield_hp > 0.5 and hero_shield_timer > 0.05:
		hp_str += "  [+%d OSŁ]" % int(round(hero_shield_hp))
	c.draw_string_outline(fb, Vector2(190.0, 73.0) + p_off, hp_str, HORIZONTAL_ALIGNMENT_LEFT, -1, 18, 5, Color(0.02, 0.01, 0.01, 0.98))
	c.draw_string(fb, Vector2(190.0, 73.0) + p_off, hp_str, HORIZONTAL_ALIGNMENT_LEFT, -1, 18, Color(1.0, 0.98, 0.96))

	var ki_str := "KI  %d / %d" % [int(round(hero_ki)), int(round(hero_max_ki))]
	c.draw_string_outline(fb, Vector2(190.0, 104.0) + p_off, ki_str, HORIZONTAL_ALIGNMENT_LEFT, -1, 17, 4, Color(0.02, 0.03, 0.06, 0.98))
	c.draw_string(fb, Vector2(190.0, 104.0) + p_off, ki_str, HORIZONTAL_ALIGNMENT_LEFT, -1, 17, Color(0.90, 0.97, 1.0))

	var res_str := hero_res_label if not hero_res_label.is_empty() else ("%s %d%s" % [str(meta["res_name"]), int(round(hero_res)), " ★" if hero_res >= 50.0 else ""])
	var res_hot := hero_res >= 50.0 or (hero_res_label.find("PRZEGRZ") >= 0) or (hero_res_label.find("KRĄG") >= 0)
	c.draw_string_outline(fb, Vector2(188.0, 131.0) + p_off, res_str, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, 4, Color(0.02, 0.01, 0.02, 0.98))
	c.draw_string(fb, Vector2(188.0, 131.0) + p_off, res_str, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color(1.0, 0.44, 0.34) if res_str.find("PRZEGRZ") >= 0 else (Color(1.0, 0.96, 0.64) if res_hot else Color(1.0, 0.96, 0.88)))

	var coin_tex := _icon_tex("gear-coin.webp")
	if coin_tex != null:
		c.draw_texture_rect(coin_tex, Rect2(Vector2(356.0, 113.0) + p_off, Vector2(24.0, 24.0)), false)
	c.draw_string_outline(fb, Vector2(386.0, 132.0) + p_off, str(hero_gold), HORIZONTAL_ALIGNMENT_LEFT, -1, 18, 4, Color(0.02, 0.01, 0.01, 0.98))
	c.draw_string(fb, Vector2(386.0, 132.0) + p_off, str(hero_gold), HORIZONTAL_ALIGNMENT_LEFT, -1, 18, Color(1.0, 0.90, 0.44))

	var z_col := Color(0.36, 0.96, 0.58) if in_safe_city else Color(1.0, 0.46, 0.24)
	c.draw_circle(Vector2(158.0, 154.0) + p_off, 5.5, z_col)
	c.draw_arc(Vector2(158.0, 154.0) + p_off, 8.5, 0.0, TAU, 16, Color(z_col.r, z_col.g, z_col.b, 0.48), 1.6, true)
	var zone_prefix := "STOLICA" if in_safe_city else "KONTYNENT"
	var loc_short := nearest_loc if nearest_loc.length() <= 20 else (nearest_loc.substr(0, 18) + "…")
	var b_kind := get_active_blessing_kind()
	var b_tag := ""
	if b_kind == "march": b_tag = " • ✦MARSZ"
	elif b_kind == "might": b_tag = " • ✦HART"
	elif b_kind == "focus": b_tag = " • ✦SKUPIENIE"
	c.draw_string_outline(fb, Vector2(174.0, 160.0) + p_off, "%s • %s%s" % [zone_prefix, loc_short, b_tag], HORIZONTAL_ALIGNMENT_LEFT, -1, 15, 4, Color(0.02, 0.01, 0.02, 0.95))
	c.draw_string(fb, Vector2(174.0, 160.0) + p_off, "%s • %s%s" % [zone_prefix, loc_short, b_tag], HORIZONTAL_ALIGNMENT_LEFT, -1, 15, Color(0.96, 0.92, 0.84, 0.98))

	# --- A2. BIG 4-Medallion Top-Left Utility Row (draggable as "utils" zone!) ---
	util_hitboxes.clear()

	# --- A1b. Target Lock Enemy Frame (top-center gap between Portrait & Minimap) ---
	if not hud_edit_mode and world != null and world.has_method("get_locked_target_info"):
		var tgt: Dictionary = world.get_locked_target_info()
		if not tgt.is_empty():
			var vs_t := _vp_size()
			var tw := clampf(vs_t.x - 860.0, 320.0, 440.0)
			var th := 82.0
			var tx := clampf((vs_t.x - tw) * 0.5, 526.0, maxf(vs_t.x - 304.0 - tw, 526.0))
			var ty := 14.0
			var tr := Rect2(tx, ty, tw, th)
			var is_boss := bool(tgt.get("boss", false))
			_draw_obsidian_plate(c, tr, Color(1.0, 0.52, 0.24, 0.96) if is_boss else Color(0.96, 0.76, 0.34, 0.94))
			var t_name := str(tgt.get("name", "Cel"))
			var t_lv := int(tgt.get("level", 1))
			var title_t := ("%s  [BOSS Poz.%d]" if is_boss else "%s  [Poz.%d]") % [t_name, t_lv]
			c.draw_string_outline(f, Vector2(tx + 16.0, ty + 28.0), title_t, HORIZONTAL_ALIGNMENT_LEFT, int(tw - 58.0), 16, 4, Color(0.02, 0.01, 0.02, 0.98))
			c.draw_string(f, Vector2(tx + 16.0, ty + 28.0), title_t, HORIZONTAL_ALIGNMENT_LEFT, int(tw - 58.0), 16, Color(1.0, 0.78, 0.42) if is_boss else Color(1.0, 0.94, 0.76))
			var clr_r := Rect2(tx + tw - 34.0, ty + 10.0, 24.0, 24.0)
			util_hitboxes.append({"rect": clr_r.grow(6.0), "id": "clear_target"})
			c.draw_rect(clr_r, Color(0.24, 0.08, 0.08, 0.92), true)
			c.draw_rect(clr_r, Color(0.92, 0.54, 0.36, 0.90), false, 1.4)
			c.draw_string(f, clr_r.position + Vector2(6.5, 17.5), "×", HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color(1.0, 0.90, 0.80))
			var thp := float(tgt.get("hp", 0.0))
			var tmax := maxf(1.0, float(tgt.get("max_hp", 1.0)))
			var tfrac := clampf(thp / tmax, 0.0, 1.0)
			var bar_r := Rect2(tx + 16.0, ty + 38.0, tw - 32.0, 18.0)
			c.draw_rect(bar_r, Color(0.08, 0.04, 0.05, 0.96), true)
			c.draw_rect(Rect2(bar_r.position + Vector2(1.5, 1.5), Vector2((bar_r.size.x - 3.0) * tfrac, bar_r.size.y - 3.0)), Color(0.94, 0.24, 0.16, 0.96) if is_boss else Color(0.86, 0.26, 0.22, 0.95), true)
			c.draw_rect(bar_r, Color(0.88, 0.68, 0.34, 0.88), false, 1.4)
			var hp_lbl := "%d / %d HP" % [int(round(thp)), int(round(tmax))]
			var hlw := fb.get_string_size(hp_lbl, HORIZONTAL_ALIGNMENT_LEFT, -1, 13).x
			c.draw_string_outline(fb, Vector2(bar_r.position.x + (bar_r.size.x - hlw) * 0.5, bar_r.position.y + 13.5), hp_lbl, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, 3, Color(0.0, 0.0, 0.0, 0.98))
			c.draw_string(fb, Vector2(bar_r.position.x + (bar_r.size.x - hlw) * 0.5, bar_r.position.y + 13.5), hp_lbl, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(1.0, 0.98, 0.94))
			var st_arr: Array = tgt.get("statuses", [])
			var sx := tx + 16.0
			for st_code in st_arr:
				var sc_str := str(st_code)
				var s_txt := sc_str.to_upper()
				var s_col := Color(0.95, 0.85, 0.55)
				if sc_str == "burn": s_txt = "PODPAL."; s_col = Color(1.0, 0.46, 0.18)
				elif sc_str == "stun": s_txt = "OGŁUSZ."; s_col = Color(1.0, 0.90, 0.28)
				elif sc_str == "slow": s_txt = "SPOWOL."; s_col = Color(0.46, 0.88, 1.0)
				elif sc_str == "marked": s_txt = "NAMIERZ."; s_col = Color(0.32, 0.98, 1.0)
				elif sc_str == "seal": s_txt = "PIECZĘĆ"; s_col = Color(1.0, 0.88, 0.42)
				var sw := fb.get_string_size(s_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 11).x + 10.0
				if sx + sw > tx + tw - 14.0:
					break
				var cr := Rect2(sx, ty + 60.0, sw, 16.0)
				c.draw_rect(cr, Color(s_col.r * 0.25, s_col.g * 0.25, s_col.b * 0.25, 0.92), true)
				c.draw_rect(cr, s_col, false, 1.1)
				c.draw_string(fb, Vector2(sx + 5.0, ty + 72.0), s_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, s_col)
				sx += sw + 6.0

	var ring_obs := _load_tex("res://assets/ui/obsidian/ring_star.webp")
	var ring_cyan := _load_tex("res://assets/ui/hud_node_ring_avail.png")
	var gm_active: bool = world != null and bool(world.gm_open)
	var menu_active: bool = world != null and ("game_menu" in world) and world.game_menu != null and bool(world.game_menu.visible)
	var ready_q := 0
	if world != null and world.get("quest_journal") != null and world.quest_journal.has_method("count_ready"):
		ready_q = int(world.quest_journal.count_ready())
	var spd_badge := (" %.0f×" % float(world.gm_speed_mult)) if (world != null and float(world.gm_speed_mult) > 1.05) else ""

	var all_utils: Array = [
		{"id": "char", "key": "POSTAĆ", "icon": "emblem_shield.webp", "badge": str(free_stat_points) if free_stat_points > 0 else "", "active": show_character},
		{"id": "talents", "key": "SKILLE", "icon": "emblem_crystal.webp", "badge": str(skill_points) if skill_points > 0 else "", "active": show_talents},
		{"id": "quests", "key": "ZADANIA", "icon": "emblem_scroll.webp", "badge": str(ready_q) if ready_q > 0 else "", "active": world != null and ("quest_journal" in world) and world.quest_journal != null and bool(world.quest_journal.visible)},
		{"id": "menu", "key": "MENU", "icon": "emblem_gear.webp", "badge": "", "active": menu_active},
	]
	var u_dia := 70.0
	for ui in all_utils.size():
		var u_cx := 62.0 + float(ui) * 104.0
		var u_cy := 228.0
		_draw_util_medallion(c, f, all_utils[ui], Vector2(u_cx, u_cy) + u_off, u_dia, ring_obs, ring_cyan)

	# Row 2: Two BIG Forged Buttons side-by-side: [MAPA ŚWIATA] | [PANEL GM]
	var map_rect := Rect2(Vector2(16.0, 304.0) + u_off, Vector2(212.0, 54.0))
	util_hitboxes.append({"rect": map_rect.grow(5.0), "id": "atlas"})
	_draw_forged_pill(c, map_rect, false)
	var m_txt := "MAPA ŚWIATA"
	var mtw := f.get_string_size(m_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 17).x
	c.draw_string_outline(f, Vector2(map_rect.position.x + (map_rect.size.x - mtw) * 0.5, map_rect.position.y + 34.0), m_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 17, 5, Color(0.02, 0.01, 0.01, 0.98))
	c.draw_string(f, Vector2(map_rect.position.x + (map_rect.size.x - mtw) * 0.5, map_rect.position.y + 34.0), m_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 17, Color(1.0, 0.94, 0.74))

	if world != null and world.can_use_gm():
		var gm_rect := Rect2(Vector2(236.0, 304.0) + u_off, Vector2(198.0, 54.0))
		util_hitboxes.append({"rect": gm_rect.grow(5.0), "id": "gm"})
		_draw_forged_pill(c, gm_rect, gm_active or not spd_badge.is_empty())
		var gm_txt := "PANEL GM" + spd_badge
		var gtw := f.get_string_size(gm_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 17).x
		c.draw_string_outline(f, Vector2(gm_rect.position.x + (gm_rect.size.x - gtw) * 0.5, gm_rect.position.y + 34.0), gm_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 17, 5, Color(0.02, 0.01, 0.01, 0.98))
		c.draw_string(f, Vector2(gm_rect.position.x + (gm_rect.size.x - gtw) * 0.5, gm_rect.position.y + 34.0), gm_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 17, Color(0.62, 0.98, 1.0) if gm_active else Color(1.0, 0.94, 0.72))

	# Dedicated BIG Quick-Heal Potion Orb + Free Return-to-Capital Stone (Kamień Powrotu)
	var c_base := _combat_base_center()
	var pot_c := c_base + Vector2(-284.0 * sc, 32.0 * sc)
	var pot_r := 42.0 * sc
	var pot_rect := Rect2(pot_c - Vector2(pot_r, pot_r), Vector2(pot_r * 2.0, pot_r * 2.0))
	util_hitboxes.append({"rect": pot_rect.grow(10.0), "id": "potion"})
	c.draw_circle(pot_c + Vector2(0.0, 3.0), pot_r + 3.0, Color(0.0, 0.0, 0.0, 0.52))
	c.draw_circle(pot_c, pot_r, Color(0.06, 0.04, 0.06, 0.96))
	var pot_ico := _icon_tex("gear-potion.webp")
	if pot_ico != null:
		var pr_in := pot_r * 0.72
		c.draw_texture_rect(pot_ico, Rect2(pot_c - Vector2(pr_in, pr_in), Vector2(pr_in * 2.0, pr_in * 2.0)), false)
	if ring_obs != null:
		var rr_p := pot_r + 10.0 * sc
		c.draw_texture_rect(ring_obs, Rect2(pot_c - Vector2(rr_p, rr_p), Vector2(rr_p * 2.0, rr_p * 2.0)), false)
	var pot_qty := hp_potion_count()
	if pot_qty > 0:
		var pbc := pot_c + Vector2(pot_r * 0.76, -pot_r * 0.72)
		c.draw_circle(pbc, 16.0, Color(0.78, 0.16, 0.14, 0.98))
		c.draw_arc(pbc, 16.0, 0.0, TAU, 18, Color(1.0, 0.88, 0.46, 0.98), 2.4, true)
		var pq_s := str(pot_qty)
		var pq_w := fb.get_string_size(pq_s, HORIZONTAL_ALIGNMENT_LEFT, -1, 17).x
		c.draw_string(fb, pbc + Vector2(-pq_w * 0.5, 6.0), pq_s, HORIZONTAL_ALIGNMENT_LEFT, -1, 17, Color(1.0, 0.98, 0.94))

	# Kamień Powrotu (Free Return-to-Capital Stone — 2.5s channel, 45s CD)
	var rec_c := pot_c + Vector2(-8.0 * sc, -104.0 * sc)
	var rec_r := 34.0 * sc
	var rec_rect := Rect2(rec_c - Vector2(rec_r, rec_r), Vector2(rec_r * 2.0, rec_r * 2.0))
	util_hitboxes.append({"rect": rec_rect.grow(10.0), "id": "recall"})
	c.draw_circle(rec_c + Vector2(0.0, 3.0), rec_r + 3.0, Color(0.0, 0.0, 0.0, 0.52))
	c.draw_circle(rec_c, rec_r, Color(0.05, 0.07, 0.12, 0.96))
	var rec_ico := _icon_tex("emblem_scroll.webp")
	if rec_ico != null:
		var r_in := rec_r * 0.70
		c.draw_texture_rect(rec_ico, Rect2(rec_c - Vector2(r_in, r_in), Vector2(r_in * 2.0, r_in * 2.0)), false)
	var rec_cd: float = float(world.recall_cooldown) if (world != null and ("recall_cooldown" in world)) else 0.0
	var rec_ch: float = float(world.recall_channel) if (world != null and ("recall_channel" in world)) else 0.0
	if rec_ch > 0.01:
		c.draw_arc(rec_c, rec_r + 3.0, -PI * 0.5, -PI * 0.5 + TAU * clampf(1.0 - rec_ch / 2.5, 0.0, 1.0), 28, Color(0.42, 0.96, 1.0, 0.98), 4.2, true)
		var rcs := "%.1fs" % rec_ch
		var rcw := fb.get_string_size(rcs, HORIZONTAL_ALIGNMENT_LEFT, -1, 16).x
		c.draw_string_outline(fb, rec_c + Vector2(-rcw * 0.5, 6.0), rcs, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, 4, Color(0.0, 0.0, 0.0, 0.98))
		c.draw_string(fb, rec_c + Vector2(-rcw * 0.5, 6.0), rcs, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color(0.54, 0.98, 1.0))
	elif rec_cd > 0.1:
		c.draw_circle(rec_c, rec_r - 1.0, Color(0.02, 0.02, 0.05, 0.72))
		var rcd := "%ds" % int(ceil(rec_cd))
		var rcdw := fb.get_string_size(rcd, HORIZONTAL_ALIGNMENT_LEFT, -1, 17).x
		c.draw_string(fb, rec_c + Vector2(-rcdw * 0.5, 6.0), rcd, HORIZONTAL_ALIGNMENT_LEFT, -1, 17, Color(0.92, 0.94, 0.98))
	if ring_cyan != null and rec_cd <= 0.1:
		var rr_c := rec_r + 8.0 * sc
		c.draw_texture_rect(ring_cyan, Rect2(rec_c - Vector2(rr_c, rr_c), Vector2(rr_c * 2.0, rr_c * 2.0)), false)
	var rec_lbl := "POWRÓT"
	var rlw := f.get_string_size(rec_lbl, HORIZONTAL_ALIGNMENT_LEFT, -1, 14).x
	c.draw_string_outline(f, rec_c + Vector2(-rlw * 0.5, rec_r + 18.0), rec_lbl, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, 4, Color(0.02, 0.01, 0.02, 0.98))
	c.draw_string(f, rec_c + Vector2(-rlw * 0.5, rec_r + 18.0), rec_lbl, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color(0.74, 0.96, 1.0))

	# UNIK [V] Tactical Dodge-Roll Orb (4.5s CD, 0.35s i-frames + speed dash!)
	var dodge_c := pot_c + Vector2(-92.0 * sc, -48.0 * sc)
	var dodge_r := 34.0 * sc
	util_hitboxes.append({"rect": Rect2(dodge_c - Vector2(dodge_r, dodge_r), Vector2(dodge_r * 2.0, dodge_r * 2.0)).grow(10.0), "id": "dodge"})
	c.draw_circle(dodge_c + Vector2(0.0, 3.0), dodge_r + 3.0, Color(0.0, 0.0, 0.0, 0.52))
	c.draw_circle(dodge_c, dodge_r, Color(0.06, 0.08, 0.09, 0.96))
	var dodge_ico := _icon_tex("gear-boots.webp")
	if dodge_ico != null:
		var d_in := dodge_r * 0.70
		c.draw_texture_rect(dodge_ico, Rect2(dodge_c - Vector2(d_in, d_in), Vector2(d_in * 2.0, d_in * 2.0)), false)
	if dodge_cd > 0.05:
		c.draw_circle(dodge_c, dodge_r - 1.0, Color(0.02, 0.02, 0.05, 0.72))
		c.draw_arc(dodge_c, dodge_r - 2.0, -PI * 0.5, -PI * 0.5 + TAU * clampf(dodge_cd / 4.5, 0.0, 1.0), 24, Color(0.46, 0.96, 0.72, 0.96), 3.6, true)
		var dcs := "%.1f" % dodge_cd
		var dcw := fb.get_string_size(dcs, HORIZONTAL_ALIGNMENT_LEFT, -1, 17).x
		c.draw_string(fb, dodge_c + Vector2(-dcw * 0.5, 6.0), dcs, HORIZONTAL_ALIGNMENT_LEFT, -1, 17, Color(0.96, 0.98, 0.88))
	elif ring_obs != null:
		var rr_d := dodge_r + 8.0 * sc
		c.draw_texture_rect(ring_obs, Rect2(dodge_c - Vector2(rr_d, rr_d), Vector2(rr_d * 2.0, rr_d * 2.0)), false)
	var d_lbl := "UNIK [V]"
	var dlw := f.get_string_size(d_lbl, HORIZONTAL_ALIGNMENT_LEFT, -1, 13).x
	c.draw_string_outline(f, dodge_c + Vector2(-dlw * 0.5, dodge_r + 17.0), d_lbl, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, 4, Color(0.02, 0.01, 0.02, 0.98))
	c.draw_string(f, dodge_c + Vector2(-dlw * 0.5, dodge_r + 17.0), d_lbl, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(0.68, 0.98, 0.78))

	# KI+ [X] Active Ki-Channeling Orb (2.0s focus restoring +28% KI!)
	var chan_c := dodge_c + Vector2(0.0, -96.0 * sc)
	var chan_r := 32.0 * sc
	util_hitboxes.append({"rect": Rect2(chan_c - Vector2(chan_r, chan_r), Vector2(chan_r * 2.0, chan_r * 2.0)).grow(10.0), "id": "channel"})
	c.draw_circle(chan_c + Vector2(0.0, 3.0), chan_r + 3.0, Color(0.0, 0.0, 0.0, 0.52))
	c.draw_circle(chan_c, chan_r, Color(0.04, 0.07, 0.13, 0.96))
	var chan_ico := _icon_tex("hud-ki.webp")
	if chan_ico != null:
		var ch_in := chan_r * 0.70
		c.draw_texture_rect(chan_ico, Rect2(chan_c - Vector2(ch_in, ch_in), Vector2(ch_in * 2.0, ch_in * 2.0)), false)
	var ki_ch_t: float = float(world.ki_channel_t) if (world != null and ("ki_channel_t" in world)) else 0.0
	if ki_ch_t > 0.05:
		c.draw_arc(chan_c, chan_r + 3.0, 0.0, TAU, 28, Color(0.40, 0.96, 1.0, 0.98), 4.0, true)
		var chs := "%.1fs" % ki_ch_t
		var chw := fb.get_string_size(chs, HORIZONTAL_ALIGNMENT_LEFT, -1, 15).x
		c.draw_string_outline(fb, chan_c + Vector2(-chw * 0.5, 5.5), chs, HORIZONTAL_ALIGNMENT_LEFT, -1, 15, 4, Color(0.0, 0.0, 0.0, 0.98))
		c.draw_string(fb, chan_c + Vector2(-chw * 0.5, 5.5), chs, HORIZONTAL_ALIGNMENT_LEFT, -1, 15, Color(0.46, 0.98, 1.0))
	elif channel_cd > 0.05:
		c.draw_circle(chan_c, chan_r - 1.0, Color(0.02, 0.02, 0.05, 0.70))
		var ccd := "%.1f" % channel_cd
		var ccdw := fb.get_string_size(ccd, HORIZONTAL_ALIGNMENT_LEFT, -1, 16).x
		c.draw_string(fb, chan_c + Vector2(-ccdw * 0.5, 5.5), ccd, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color(0.84, 0.92, 1.0))
	elif ring_cyan != null:
		var rr_ch := chan_r + 8.0 * sc
		c.draw_texture_rect(ring_cyan, Rect2(chan_c - Vector2(rr_ch, rr_ch), Vector2(rr_ch * 2.0, rr_ch * 2.0)), false)
	var ch_lbl := "KI+ [X]"
	var chlw := f.get_string_size(ch_lbl, HORIZONTAL_ALIGNMENT_LEFT, -1, 13).x
	c.draw_string_outline(f, chan_c + Vector2(-chlw * 0.5, chan_r + 17.0), ch_lbl, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, 4, Color(0.02, 0.01, 0.02, 0.98))
	c.draw_string(f, chan_c + Vector2(-chlw * 0.5, chan_r + 17.0), ch_lbl, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(0.56, 0.94, 1.0))

	nav_hitboxes.clear()

	# --- C. BIG Bottom-Center Legible XP Bar Labels (18px bold!) ---
	var xp_r := _xp_pill_rect()
	var xp_pct := int(round((hero_xp / maxf(hero_max_xp, 1.0)) * 100.0))
	c.draw_string_outline(f, Vector2(xp_r.position.x + 18.0, xp_r.position.y + 30.0), "POZ.%d" % hero_level, HORIZONTAL_ALIGNMENT_LEFT, -1, 18, 4, Color(0.02, 0.01, 0.01, 0.98))
	c.draw_string(f, Vector2(xp_r.position.x + 18.0, xp_r.position.y + 30.0), "POZ.%d" % hero_level, HORIZONTAL_ALIGNMENT_LEFT, -1, 18, Color(1.0, 0.90, 0.54))
	var pd_txt := "PD %d%%" % xp_pct
	var pd_w := f.get_string_size(pd_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 18).x
	c.draw_string_outline(f, Vector2(xp_r.position.x + xp_r.size.x - pd_w - 18.0, xp_r.position.y + 30.0), pd_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 18, 4, Color(0.02, 0.01, 0.01, 0.98))
	c.draw_string(f, Vector2(xp_r.position.x + xp_r.size.x - pd_w - 18.0, xp_r.position.y + 30.0), pd_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 18, Color(1.0, 0.90, 0.54))

	# --- D. BIG Bottom-Right Wild Rift Right-Thumb Circular Skill Overlays ---
	hotbar_hitboxes.clear()
	var wr_specs := _wild_rift_slot_specs()
	var ki_active: bool = world != null and ("ki_mode_timer" in world) and float(world.ki_mode_timer) > 0.05
	for i in mini(wr_specs.size(), HOTBAR_KEYS.size()):
		var spec: Dictionary = wr_specs[i]
		var center: Vector2 = spec["center"]
		var r: float = float(spec["r"])
		var hit_r := r + 10.0 * sc
		hotbar_hitboxes.append(Rect2(center - Vector2(hit_r, hit_r), Vector2(hit_r * 2.0, hit_r * 2.0)))
		var unlocked_skill := is_hotbar_skill_unlocked(i)
		var slot_nid := get_hotbar_node(i)

		# Glowing Ki-Mode transformation halo on [R] (idx == 5)
		if i == 5 and ki_active:
			var pulse_k := 0.5 + 0.5 * sin(float(world.world_time) * 7.0)
			c.draw_arc(center, r + 10.0 + pulse_k * 3.0, 0.0, TAU, 36, Color(0.32, 0.96, 1.0, 0.88), 4.0, true)
			c.draw_arc(center, r + 5.0, 0.0, TAU, 36, Color(1.0, 0.88, 0.42, 0.92), 2.5, true)
			var kt_s := "KI %ds" % int(ceil(float(world.ki_mode_timer)))
			var ktw := f.get_string_size(kt_s, HORIZONTAL_ALIGNMENT_LEFT, -1, 16).x
			c.draw_string_outline(f, center + Vector2(-ktw * 0.5, -r - 22.0), kt_s, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, 5, Color(0.02, 0.04, 0.08, 0.98))
			c.draw_string(f, center + Vector2(-ktw * 0.5, -r - 22.0), kt_s, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color(0.42, 0.98, 1.0))

		if not unlocked_skill:
			c.draw_circle(center, r - 1.0, Color(0.02, 0.02, 0.04, 0.80))
			var lk_s := slot_nid
			var req_lv := get_hotbar_skill_min_level(i)
			var lv_s := "Poz.%d" % req_lv
			var lkw := f.get_string_size(lk_s, HORIZONTAL_ALIGNMENT_LEFT, -1, 16).x
			var lvw := fb.get_string_size(lv_s, HORIZONTAL_ALIGNMENT_LEFT, -1, 14).x
			c.draw_string_outline(f, center + Vector2(-lkw * 0.5, -2.0), lk_s, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, 4, Color(0.02, 0.01, 0.02, 0.98))
			c.draw_string(f, center + Vector2(-lkw * 0.5, -2.0), lk_s, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color(0.88, 0.82, 0.68, 0.98))
			c.draw_string_outline(fb, center + Vector2(-lvw * 0.5, 16.0), lv_s, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, 4, Color(0.02, 0.01, 0.02, 0.98))
			c.draw_string(fb, center + Vector2(-lvw * 0.5, 16.0), lv_s, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color(1.0, 0.76, 0.42, 0.98) if i == 5 else Color(0.82, 0.80, 0.76, 0.96))

		# Radial cooldown veil + BOLD 22px numeric timer
		var cd := cooldowns[i]
		if cd > 0.01:
			var max_cd := get_hotbar_skill_cd(i)
			var frac := clampf(cd / maxf(max_cd, 0.1), 0.0, 1.0)
			c.draw_circle(center, r - 1.0, Color(0.02, 0.02, 0.05, 0.72))
			c.draw_arc(center, r - 3.0, -PI * 0.5, -PI * 0.5 + TAU * frac, 28, Color(0.36, 0.88, 1.0, 0.96), 4.0, true)
			var cd_txt := "%.1f" % cd
			var cw := fb.get_string_size(cd_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 22).x
			c.draw_string_outline(fb, center + Vector2(-cw * 0.5, 8.0), cd_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 22, 5, Color(0.0, 0.0, 0.0, 0.98))
			c.draw_string(fb, center + Vector2(-cw * 0.5, 8.0), cd_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 22, Color(1.0, 0.96, 0.72))

		if hovered_hotbar_idx == i and not hud_edit_mode:
			c.draw_arc(center, r + 6.0, 0.0, TAU, 32, Color(1.0, 0.90, 0.50, 0.94), 3.0, true)

		if i != 0:
			var kb := str(HOTBAR_KEYS[i])
			var k_pos := center + Vector2(0.0, r + 4.0)
			var kr := 16.0 if bool(spec["keystone"]) else 14.5
			c.draw_circle(k_pos, kr, Color(0.06, 0.04, 0.05, 0.98))
			c.draw_arc(k_pos, kr, 0.0, TAU, 20, Color(0.98, 0.76, 0.32, 0.98) if unlocked_skill else Color(0.48, 0.46, 0.50, 0.90), 2.2, true)
			var ksz := 16 if bool(spec["keystone"]) else 15
			var kw := f.get_string_size(kb, HORIZONTAL_ALIGNMENT_LEFT, -1, ksz).x
			c.draw_string(f, k_pos + Vector2(-kw * 0.5, float(ksz) * 0.36), kb, HORIZONTAL_ALIGNMENT_LEFT, -1, ksz, Color(1.0, 0.96, 0.76) if unlocked_skill else Color(0.68, 0.66, 0.64))

	# --- D2. BIG Readable FPS & Ping Performance Overlay (toggled in Menu -> GRA) ---
	if is_perf_hud_enabled():
		var vs_p := _vp_size()
		var fps_val := int(Engine.get_frames_per_second())
		var fps_col := Color(0.36, 0.96, 0.54) if fps_val >= 50 else (Color(1.0, 0.84, 0.32) if fps_val >= 30 else Color(1.0, 0.38, 0.32))
		var ping_ms := -1
		if world != null and ("last_ping_ms" in world):
			ping_ms = int(world.last_ping_ms)
		var ping_txt := ("%d ms" % ping_ms) if ping_ms >= 0 else ("LOKALNY" if (world == null or not world.is_server_authoritative()) else "…")
		var ping_col := Color(0.36, 0.96, 0.54) if (ping_ms >= 0 and ping_ms < 85) else (Color(1.0, 0.84, 0.32) if (ping_ms >= 85 and ping_ms <= 170) else (Color(1.0, 0.38, 0.32) if ping_ms > 170 else Color(0.68, 0.86, 0.98)))
		var mm_off := get_zone_offset("minimap")
		var mm_sz := 232.0 * sc
		var mm_cx := vs_p.x - 16.0 - mm_sz * 0.5 + mm_off.x
		var mm_bottom := 14.0 + mm_sz + mm_off.y
		var pill_w := 268.0
		var pill_h := 42.0
		var pill_x := clampf(mm_cx - pill_w * 0.5, 520.0, vs_p.x - pill_w - 12.0)
		var pill_y := clampf(mm_bottom + 8.0, 16.0, vs_p.y - 380.0)
		var pill_r := Rect2(pill_x, pill_y, pill_w, pill_h)
		var sb := StyleBoxFlat.new()
		sb.bg_color = Color(0.04, 0.035, 0.06, 0.92)
		sb.border_color = Color(0.88, 0.70, 0.34, 0.94)
		sb.set_border_width_all(2)
		sb.set_corner_radius_all(10)
		c.draw_style_box(sb, pill_r)
		c.draw_circle(pill_r.position + Vector2(18.0, pill_h * 0.5), 5.5, fps_col)
		c.draw_string(fb, pill_r.position + Vector2(30.0, 27.0), "FPS %d" % fps_val, HORIZONTAL_ALIGNMENT_LEFT, -1, 17, fps_col)
		c.draw_line(pill_r.position + Vector2(118.0, 8.0), pill_r.position + Vector2(118.0, pill_h - 8.0), Color(0.75, 0.60, 0.32, 0.55), 1.5)
		c.draw_circle(pill_r.position + Vector2(134.0, pill_h * 0.5), 5.5, ping_col)
		c.draw_string(fb, pill_r.position + Vector2(146.0, 27.0), "PING %s" % ping_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, ping_col)

	# Hover tooltip anchored cleanly above bottom-right Wild Rift combat cluster
	if hovered_hotbar_idx >= 0 and hovered_hotbar_idx < hotbar_nodes.size() and not (show_talents or show_character or hud_edit_mode):
		var h_nid := get_hotbar_node(hovered_hotbar_idx)
		var h_nd := _node_by_id(h_nid)
		if not h_nd.is_empty():
			var vs := _vp_size()
			var tip_w := 410.0
			var tip_h := 106.0
			var tip_r := Rect2(vs.x - tip_w - 22.0, vs.y - 404.0, tip_w, tip_h)
			_draw_obsidian_plate(c, tip_r, Color(0.92, 0.72, 0.32, 0.94))
			var locked_note := "" if is_hotbar_skill_unlocked(hovered_hotbar_idx) else " (ZABLOK. — [K])"
			var ki_c := int(round(get_hotbar_skill_ki(hovered_hotbar_idx)))
			var ki_note := (" • %d KI" % ki_c) if ki_c > 0 else ""
			c.draw_string(f, tip_r.position + Vector2(18, 28), "%s [%s·%s]%s%s" % [str(h_nd.get("name", "")).to_upper(), str(HOTBAR_KEYS[hovered_hotbar_idx]), h_nid, ki_note, locked_note], HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color(1.0, 0.92, 0.56))
			c.draw_multiline_string(fb, tip_r.position + Vector2(18, 52), str(h_nd.get("effect", "")), HORIZONTAL_ALIGNMENT_LEFT, tip_w - 36.0, 15, 2, Color(0.94, 0.92, 0.88))

	# --- E. Live On-Screen Drag-and-Drop HUD Editor Overlay ---
	if hud_edit_mode:
		var vs_e := _vp_size()
		c.draw_rect(Rect2(Vector2.ZERO, vs_e), Color(0.01, 0.015, 0.03, 0.32), true)
		var zones := [
			["portrait", "✥ PORTRET I HP"],
			["utils", "✥ PRZYCISKI MENU"],
			["minimap", "✥ MINIMAPA"],
			["combat", "✥ PRZYCISKI WALKI"],
			["xp", "✥ PASEK PD"],
		]
		for zd: Array in zones:
			var zk := str(zd[0])
			var zlbl := str(zd[1])
			var zr := _zone_bounds_rect(zk)
			var active_z := (hud_drag_zone == zk)
			var fill_c := Color(0.18, 0.72, 0.92, 0.24) if active_z else Color(0.92, 0.72, 0.24, 0.14)
			var line_c := Color(0.38, 0.98, 1.0, 0.98) if active_z else Color(1.0, 0.86, 0.42, 0.90)
			c.draw_rect(zr, fill_c, true)
			c.draw_rect(zr, line_c, false, 3.0 if active_z else 2.2)
			var tw := f.get_string_size(zlbl, HORIZONTAL_ALIGNMENT_LEFT, -1, 16).x
			var tag_r := Rect2(zr.get_center().x - tw * 0.5 - 14.0, zr.get_center().y - 16.0, tw + 28.0, 32.0)
			c.draw_rect(tag_r, Color(0.04, 0.04, 0.07, 0.94), true)
			c.draw_rect(tag_r, line_c, false, 1.8)
			c.draw_string(f, Vector2(tag_r.position.x + 14.0, tag_r.position.y + 22.0), zlbl, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color(0.56, 0.98, 1.0) if active_z else Color(1.0, 0.92, 0.62))

func _draw_util_medallion(c: CanvasItem, f: Font, item: Dictionary, center: Vector2, dia: float, ring_gold: Texture2D, ring_cyan: Texture2D) -> void:
	var r := dia * 0.5
	var active := bool(item.get("active", false))
	var pill_r := Rect2(center.x - 48.0, center.y + r - 4.0, 96.0, 29.0)
	var hit_box := Rect2(center.x - 50.0, center.y - r - 6.0, 100.0, dia + 38.0)
	util_hitboxes.append({"rect": hit_box, "id": str(item["id"])})

	# Shadow & forged obsidian orb backing
	c.draw_circle(center + Vector2(0.0, 3.0), r + 3.0, Color(0.0, 0.0, 0.0, 0.54))
	c.draw_circle(center, r, Color(0.06, 0.055, 0.08, 0.96))
	var ico := _icon_tex(str(item.get("icon", "")))
	if ico != null:
		var inner_r := r * 0.72
		c.draw_texture_rect(ico, Rect2(center - Vector2(inner_r, inner_r), Vector2(inner_r * 2.0, inner_r * 2.0)), false)
	var ring_t := ring_cyan if active else ring_gold
	if ring_t != null:
		var rr := r + 9.0
		c.draw_texture_rect(ring_t, Rect2(center - Vector2(rr, rr), Vector2(rr * 2.0, rr * 2.0)), false)
	else:
		c.draw_arc(center, r + 1.0, 0.0, TAU, 28, Color(0.38, 0.94, 1.0) if active else Color(0.88, 0.70, 0.34), 2.8, true)

	# Bold notification badge (stat points / skill points / ready quests)
	var badge := str(item.get("badge", ""))
	if not badge.is_empty():
		var bc := center + Vector2(r * 0.78, -r * 0.74)
		c.draw_circle(bc, 15.0, Color(0.84, 0.20, 0.12, 0.98))
		c.draw_arc(bc, 15.0, 0.0, TAU, 18, Color(1.0, 0.88, 0.46, 0.98), 2.2, true)
		var bw := f.get_string_size(badge, HORIZONTAL_ALIGNMENT_LEFT, -1, 16).x
		c.draw_string(f, bc + Vector2(-bw * 0.5, 5.5), badge, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color(1.0, 0.98, 0.94))

	# Sleek BIG beveled chamfered obsidian ribbon under medallion
	var px := pill_r.position.x
	var py := pill_r.position.y + 2.0
	var pw := pill_r.size.x
	var ph := 29.0
	var ch := 7.0
	var pts := PackedVector2Array([
		Vector2(px + ch, py),
		Vector2(px + pw - ch, py),
		Vector2(px + pw, py + ph * 0.5),
		Vector2(px + pw - ch, py + ph),
		Vector2(px + ch, py + ph),
		Vector2(px, py + ph * 0.5),
	])
	_draw_beveled_chamfer(
		c,
		pts,
		Color(0.05, 0.045, 0.075, 0.96),
		Color(0.38, 0.94, 1.0, 0.96) if active else Color(0.88, 0.70, 0.34, 0.94),
		Color(1.0, 0.90, 0.56, 0.30)
	)
	var ktxt := str(item["key"])
	var kw := f.get_string_size(ktxt, HORIZONTAL_ALIGNMENT_LEFT, -1, 15).x
	c.draw_string_outline(f, Vector2(center.x - kw * 0.5, py + 20.0), ktxt, HORIZONTAL_ALIGNMENT_LEFT, -1, 15, 4, Color(0.02, 0.01, 0.02, 0.98))
	c.draw_string(f, Vector2(center.x - kw * 0.5, py + 20.0), ktxt, HORIZONTAL_ALIGNMENT_LEFT, -1, 15, Color(0.62, 0.98, 1.0) if active else Color(1.0, 0.94, 0.76))

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

	# Clean translucent obsidian veil strictly BELOW ← WSTECZ and ABOVE bottom gold filigree
	var veil_r := Rect2(gr.position.x - 4.0, gr.position.y, gr.size.x + 8.0, gr.size.y + 26.0)
	c.draw_rect(veil_r, Color(0.03, 0.03, 0.05, 0.46), true)
	c.draw_rect(veil_r, Color(0.74, 0.58, 0.30, 0.36), false, 1.2)

	# Royal Engraved Obsidian Header Plaque cleanly framing the title & point counter
	var race_pl := str(rd.get("raceName", "Legendy")).to_upper()
	var realm_pl := str(meta["realm"]).to_upper()
	var title_txt := "KONSTELACJA UMIEJĘTNOŚCI — %s (%s)" % [race_pl, realm_pl]
	var sub_txt := "29 Węzłów Kanonicznych  •  Poziom %d  •  Dostępne Punkty Talentów: %d" % [hero_level, skill_points]
	_draw_modal_header_plaque(c, f, mr, title_txt, sub_txt)

	# Consistent Forged "← WSTECZ" back button at top-left inside modal border
	talent_close_rect = Rect2(mr.position.x + 48.0, mr.position.y + 52.0, 168.0, 44.0)
	_draw_forged_pill(c, talent_close_rect, false)
	var b_lbl := "← WSTECZ"
	var b_lw := f.get_string_size(b_lbl, HORIZONTAL_ALIGNMENT_LEFT, -1, 14).x
	c.draw_string(f, Vector2(talent_close_rect.position.x + (talent_close_rect.size.x - b_lw) * 0.5, talent_close_rect.position.y + 27.0), b_lbl, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color(1.0, 0.93, 0.74))

	# Branch Headers inscribed cleanly inside bottom of obsidian box (ZERO filigree overlap!)
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
		var bw := f.get_string_size(b_name, HORIZONTAL_ALIGNMENT_LEFT, -1, 12).x
		var by := veil_r.position.y + veil_r.size.y - 9.0
		c.draw_string_outline(f, Vector2(bx - bw * 0.5, by), b_name, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, 3, Color(0.02, 0.01, 0.02, 0.96))
		c.draw_string(f, Vector2(bx - bw * 0.5, by), b_name, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, b_col)

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
				c.draw_line(src, dst, Color(bcol.r, bcol.g, bcol.b, 0.34), 7.0, true)
				c.draw_line(src, dst, Color(1.0, 0.88, 0.52, 0.96), 2.4, true)
			elif src_unlocked and st == "available":
				c.draw_line(src, dst, Color(0.32, 0.86, 1.0, 0.25), 5.0, true)
				c.draw_line(src, dst, Color(0.46, 0.88, 1.0, 0.82), 1.8, true)
			else:
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

	# --- Right-Side Forged Obsidian Inspector Tablet ---
	var ix := ir.position.x
	var iy := ir.position.y
	var iw := ir.size.x
	var ih := ir.size.y
	_draw_obsidian_plate(c, ir, Color(0.84, 0.66, 0.35, 0.90))

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

		var nw := f.get_string_size(s_name.to_upper(), HORIZONTAL_ALIGNMENT_LEFT, -1, 16).x
		c.draw_string_outline(f, Vector2(ix + (iw - nw) * 0.5, iy + 132.0), s_name.to_upper(), HORIZONTAL_ALIGNMENT_LEFT, -1, 16, 4, Color(0.02, 0.01, 0.01, 0.96))
		c.draw_string(f, Vector2(ix + (iw - nw) * 0.5, iy + 132.0), s_name.to_upper(), HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color(1.0, 0.91, 0.62))

		var t_lbl := "%s · [%s] · RANGA %d" % [str(TYPE_LABELS.get(s_type, "WĘZEŁ")), active_id, talent_rank(active_id)]
		var tlw := f.get_string_size(t_lbl, HORIZONTAL_ALIGNMENT_LEFT, -1, 11).x
		c.draw_string(f, Vector2(ix + (iw - tlw) * 0.5, iy + 152.0), t_lbl, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, b_col)

		c.draw_line(Vector2(ix + 22.0, iy + 166.0), Vector2(ix + iw - 22.0, iy + 166.0), Color(0.80, 0.62, 0.32, 0.52), 1.0, true)

		c.draw_string(f, Vector2(ix + 22.0, iy + 190.0), "WYMAGANY POZIOM:", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(0.76, 0.72, 0.66))
		var lv_ok := hero_level >= s_lvl
		var lv_val := "Poz. %d" % s_lvl
		var lvw := fb.get_string_size(lv_val, HORIZONTAL_ALIGNMENT_LEFT, -1, 14).x
		c.draw_string(fb, Vector2(ix + iw - 24.0 - lvw, iy + 190.0), lv_val, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color(0.42, 0.94, 0.58) if lv_ok else Color(1.0, 0.54, 0.36))

		c.draw_string(f, Vector2(ix + 22.0, iy + 214.0), "WYMAGANIA:", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(0.76, 0.72, 0.66))
		var rqw := fb.get_string_size(s_req, HORIZONTAL_ALIGNMENT_LEFT, -1, 13).x
		c.draw_string(fb, Vector2(ix + iw - 24.0 - rqw, iy + 214.0), s_req, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(0.94, 0.88, 0.76))

		c.draw_line(Vector2(ix + 22.0, iy + 228.0), Vector2(ix + iw - 22.0, iy + 228.0), Color(0.80, 0.62, 0.32, 0.38), 1.0, true)

		c.draw_string(f, Vector2(ix + 22.0, iy + 250.0), "OPIS BAZOWY", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(0.88, 0.74, 0.44))
		c.draw_multiline_string(fb, Vector2(ix + 22.0, iy + 272.0), s_eff, HORIZONTAL_ALIGNMENT_LEFT, iw - 44.0, 14, 8, Color(0.95, 0.92, 0.86))

		# Hotbar Slot Assignment Pills [1] [2] [3] [4] for unlocked active / ultimate skills!
		talent_slot_rects.clear()
		if s_st == "unlocked" and (active_id in ASSIGNABLE_NODES):
			var sl_y := iy + ih - 156.0
			c.draw_string(f, Vector2(ix + 22.0, sl_y), "PRZYPISZ NA PASEK [1–4]:", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(0.76, 0.92, 1.0))
			var sp_gap := 8.0
			var sp_w := (iw - 40.0 - sp_gap * 3.0) / 4.0
			for s_i in range(1, 5):
				var sx_p := ix + 20.0 + float(s_i - 1) * (sp_w + sp_gap)
				var s_rect := Rect2(sx_p, sl_y + 8.0, sp_w, 34.0)
				var is_cur := (get_hotbar_node(s_i) == active_id)
				talent_slot_rects.append({"rect": s_rect.grow(3.0), "slot": s_i, "node": active_id})
				_draw_forged_pill(c, s_rect, is_cur)
				var s_lbl := "[%d] %s" % [s_i, get_hotbar_node(s_i)]
				var slw := fb.get_string_size(s_lbl, HORIZONTAL_ALIGNMENT_LEFT, -1, 12).x
				c.draw_string(fb, Vector2(s_rect.position.x + (s_rect.size.x - slw) * 0.5, s_rect.position.y + 21.5), s_lbl, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(1.0, 0.96, 0.72) if is_cur else Color(0.86, 0.88, 0.92))

		# Interactive Unlock / Status Action Plaque at Bottom of Inspector
		talent_unlock_btn_rect = Rect2(ix + 20.0, iy + ih - 98.0, iw - 40.0, 44.0)
		var rank := talent_rank(active_id)
		var can_unlock := _can_buy_talent(active_id, s_st)
		_draw_forged_pill(c, talent_unlock_btn_rect, can_unlock or s_st == "unlocked")
		var btn_txt := "WĘZEŁ ZABLOKOWANY"
		var btn_tcol := Color(0.72, 0.68, 0.62)
		if talent_purchase_pending:
			btn_txt = "ZAPISYWANIE…"
		elif can_unlock:
			btn_txt = "RANGA %d (1 PKT)" % (rank + 1)
			btn_tcol = Color(1.0, 0.98, 0.90)
		elif rank >= talent_rank_limit(active_id):
			btn_txt = "✦ MAKSYMALNA RANGA ✦"
			btn_tcol = Color(1.0, 0.92, 0.62)
		elif s_st == "level_locked":
			btn_txt = "WYMAGANY POZ. %d" % s_lvl
			btn_tcol = Color(1.0, 0.64, 0.42)
		elif s_st in ["available", "unlocked"]:
			btn_txt = "BRAK PUNKTÓW TALENTÓW"
			btn_tcol = Color(0.86, 0.80, 0.66)
		elif s_st == "excluded":
			btn_txt = "WYKLUCZONE PRZEZ WYBÓR"
			btn_tcol = Color(1.0, 0.68, 0.64)
		var btw := f.get_string_size(btn_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 13).x
		c.draw_string(f, Vector2(talent_unlock_btn_rect.position.x + (talent_unlock_btn_rect.size.x - btw) * 0.5, talent_unlock_btn_rect.position.y + 27.0), btn_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, btn_tcol)

		var ly := iy + ih - 32.0
		var leg: Array = [
			[Color(1.0, 0.82, 0.36), "Odblok."],
			[Color(0.36, 0.88, 1.0), "Dostępne"],
			[Color(0.48, 0.46, 0.44), "Zablok."],
		]
		var lx := ix + 24.0
		for lg: Array in leg:
			c.draw_circle(Vector2(lx, ly), 4.5, lg[0] as Color)
			c.draw_string(fb, Vector2(lx + 9.0, ly + 4.0), str(lg[1]), HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(0.86, 0.82, 0.76))
			lx += 88.0

func _get_selected_char_item() -> Dictionary:
	if selected_char_source == "backpack" and selected_char_idx >= 0 and selected_char_idx < backpack_items.size():
		var it: Dictionary = backpack_items[selected_char_idx]
		if not it.is_empty():
			return it
	elif selected_char_source == "equip" and selected_char_idx >= 0 and selected_char_idx < equip_slots.size():
		var eq: Dictionary = equip_slots[selected_char_idx]
		if not str(eq.get("id", "")).is_empty():
			return eq
	return hovered_char_item

func _execute_selected_char_action() -> void:
	if selected_char_source == "backpack" and selected_char_idx >= 0 and selected_char_idx < backpack_items.size():
		var it: Dictionary = backpack_items[selected_char_idx]
		if not it.is_empty():
			use_backpack_slot(selected_char_idx)
			if selected_char_idx >= backpack_items.size() or backpack_items[selected_char_idx].is_empty():
				selected_char_source = ""
				selected_char_idx = -1
	elif selected_char_source == "equip" and selected_char_idx >= 0 and selected_char_idx < equip_slots.size():
		var eq: Dictionary = equip_slots[selected_char_idx]
		if not str(eq.get("id", "")).is_empty():
			unequip_slot(selected_char_idx)
			selected_char_source = ""
			selected_char_idx = -1
	_refresh_visuals()

func _item_stat_summary(it: Dictionary, compare_eq: Dictionary) -> Array[Dictionary]:
	var lines: Array[Dictionary] = []
	var stat_defs := [
		["atk", "Atak", ""],
		["def", "Obrona", ""],
		["hp", "Maks. HP", ""],
		["ki", "Maks. KI", ""],
		["spd", "Szybkość", " j."],
		["crit", "Kryt", "%"],
		["healHp", "Leczy HP", ""],
		["healKi", "Odnawia KI", ""],
	]
	for sd in stat_defs:
		var k: String = sd[0]
		var is_heal := k in ["healHp", "healKi"]
		var val := _restored_vital(it, k) if is_heal else float(it.get(k, 0))
		if absf(val) < 0.01:
			continue
		var txt := "+%d %s%s" % [int(round(val)), sd[1], sd[2]] if k != "crit" else "+%.1f%s %s" % [val, sd[2], sd[1]]
		var col := Color(0.56, 0.98, 0.72) if is_heal else Color(0.98, 0.90, 0.62)
		if not compare_eq.is_empty() and not is_heal:
			var old_v := float(compare_eq.get(k, 0))
			var diff := val - old_v
			if diff > 0.05:
				txt += " (+%d)" % int(round(diff)) if k != "crit" else " (+%.1f%%)" % diff
				col = Color(0.42, 0.98, 0.58)
			elif diff < -0.05:
				txt += " (%d)" % int(round(diff)) if k != "crit" else " (%.1f%%)" % diff
				col = Color(1.0, 0.46, 0.38)
		lines.append({"text": txt, "color": col})
	return lines

func _draw_character_sheet(c: CanvasItem, f: Font, mr: Rect2) -> void:
	var fb: Font = MapStyle.body_font()
	var rd := _race_data()
	var meta: Dictionary = LAND_META.get(_hero_land(), LAND_META["pyra"])
	var accent: Color = meta["accent"]
	var slot_tex := _load_tex("res://assets/ui/hud_skill_slot.png")

	var title_txt := "POSTAĆ I EKWIPUNEK — %s" % (hero_custom_name if hero_custom_name != "" else str(meta["hero"])).to_upper()
	var total_tr := get_total_training_sessions()
	var tr_word := "sesja" if total_tr == 1 else ("sesje" if (total_tr % 10 >= 2 and total_tr % 10 <= 4 and (total_tr % 100 < 12 or total_tr % 100 > 14)) else "sesji")
	var sub_txt := "%s  •  Poz.%d  •  %s (%d %s)" % [str(rd.get("raceName", "")), hero_level, get_training_mastery_title(), total_tr, tr_word]
	_draw_modal_header_plaque(c, f, mr, title_txt, sub_txt)

	# Forged "← WSTECZ" back button at top-left
	char_close_rect = Rect2(mr.position.x + 28.0, mr.position.y + 30.0, 174.0, 48.0)
	_draw_forged_pill(c, char_close_rect, false)
	var b_lbl := "← WSTECZ"
	var b_lw := f.get_string_size(b_lbl, HORIZONTAL_ALIGNMENT_LEFT, -1, 16).x
	c.draw_string(f, Vector2(char_close_rect.position.x + (char_close_rect.size.x - b_lw) * 0.5, char_close_rect.position.y + 30.0), b_lbl, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color(1.0, 0.93, 0.74))

	# ==========================================================================
	# LEFT HALF: CLASSIC RPG PAPERDOLL SILHOUETTE + 8 BIG 66px EQUIPMENT SOCKETS + 2-COL STATS
	# ==========================================================================
	var lx := mr.position.x + 22.0
	var lw := mr.size.x * 0.462
	var paper_rect := Rect2(lx, mr.position.y + 98.0, lw, 328.0)
	_draw_obsidian_plate(c, paper_rect, Color(0.84, 0.66, 0.35, 0.90))

	var paper_cx := mr.position.x + mr.size.x * 0.245
	var paper_cy := mr.position.y + 258.0

	# Stylized Warrior Paperdoll Silhouette behind hero portrait (head, shoulders, torso, arms, legs)
	var sil_fill := Color(accent.r * 0.32 + 0.08, accent.g * 0.32 + 0.08, accent.b * 0.38 + 0.12, 0.34)
	var sil_edge := Color(0.88, 0.72, 0.38, 0.42)
	var torso_poly := PackedVector2Array([
		Vector2(paper_cx - 56.0, paper_cy - 34.0),
		Vector2(paper_cx - 26.0, paper_cy - 54.0),
		Vector2(paper_cx + 26.0, paper_cy - 54.0),
		Vector2(paper_cx + 56.0, paper_cy - 34.0),
		Vector2(paper_cx + 76.0, paper_cy + 46.0),
		Vector2(paper_cx + 52.0, paper_cy + 52.0),
		Vector2(paper_cx + 34.0, paper_cy + 6.0),
		Vector2(paper_cx + 38.0, paper_cy + 88.0),
		Vector2(paper_cx + 12.0, paper_cy + 88.0),
		Vector2(paper_cx, paper_cy + 44.0),
		Vector2(paper_cx - 12.0, paper_cy + 88.0),
		Vector2(paper_cx - 38.0, paper_cy + 88.0),
		Vector2(paper_cx - 34.0, paper_cy + 6.0),
		Vector2(paper_cx - 52.0, paper_cy + 52.0),
		Vector2(paper_cx - 76.0, paper_cy + 46.0),
	])
	c.draw_colored_polygon(torso_poly, sil_fill)
	c.draw_polyline(torso_poly + PackedVector2Array([torso_poly[0]]), sil_edge, 1.8, true)
	c.draw_circle(Vector2(paper_cx, paper_cy), 86.0, Color(accent.r, accent.g, accent.b, 0.12))
	c.draw_arc(Vector2(paper_cx, paper_cy), 88.0, 0.0, TAU, 48, Color(0.84, 0.68, 0.36, 0.34), 1.4, true)

	# Classic RPG Paperdoll Slot Coordinates:
	# 0:Hełm (top center), 7:Buty (bottom center)
	# Left column: 2:Broń (top-left), 4:Pancerz (mid-left), 3:Rękawice (bot-left)
	# Right column: 1:Amulet (top-right), 5:Tarcza (mid-right), 6:Pierścień (bot-right)
	var eq_sz := 62.0
	var col_dx := minf(162.0, lw * 0.345)
	var slot_centers := {
		0: Vector2(paper_cx, mr.position.y + 140.0),
		1: Vector2(paper_cx + col_dx, mr.position.y + 164.0),
		2: Vector2(paper_cx - col_dx, mr.position.y + 164.0),
		3: Vector2(paper_cx - col_dx, mr.position.y + 348.0),
		4: Vector2(paper_cx - col_dx, mr.position.y + 256.0),
		5: Vector2(paper_cx + col_dx, mr.position.y + 256.0),
		6: Vector2(paper_cx + col_dx, mr.position.y + 348.0),
		7: Vector2(paper_cx, mr.position.y + 372.0),
	}
	var anchor_targets := {
		0: Vector2(paper_cx, paper_cy - 68.0),
		1: Vector2(paper_cx + 38.0, paper_cy - 44.0),
		2: Vector2(paper_cx - 56.0, paper_cy - 22.0),
		3: Vector2(paper_cx - 60.0, paper_cy + 42.0),
		4: Vector2(paper_cx - 42.0, paper_cy),
		5: Vector2(paper_cx + 52.0, paper_cy),
		6: Vector2(paper_cx + 60.0, paper_cy + 42.0),
		7: Vector2(paper_cx, paper_cy + 78.0),
	}

	equip_hitboxes.clear()
	for ei in equip_slots.size():
		var sl: Dictionary = equip_slots[ei]
		var sc: Vector2 = slot_centers.get(ei, Vector2(paper_cx, paper_cy))
		var at: Vector2 = anchor_targets.get(ei, Vector2(paper_cx, paper_cy))
		c.draw_line(sc, at, Color(0.82, 0.66, 0.34, 0.32), 1.6, true)
		var sx := sc.x - eq_sz * 0.5
		var sy := sc.y - eq_sz * 0.5
		var sr := Rect2(sx, sy, eq_sz, eq_sz)
		equip_hitboxes.append({"rect": sr, "idx": ei})
		var has_it := not str(sl.get("id", "")).is_empty()
		var is_sel := (selected_char_source == "equip" and selected_char_idx == ei)
		var rcol: Color = sl.get("rarity", Color(0.56, 0.50, 0.42)) as Color
		c.draw_rect(sr, Color(0.06, 0.05, 0.08, 0.96), true)
		var gico := _icon_tex(str(sl.get("icon", "")))
		if has_it and gico != null:
			c.draw_texture_rect(gico, Rect2(sx + 6.0, sy + 6.0, eq_sz - 12.0, eq_sz - 12.0), false)
		c.draw_rect(sr.grow(-2.0), Color(rcol.r, rcol.g, rcol.b, 0.85 if has_it else 0.30), false, 2.0)
		if slot_tex != null:
			c.draw_texture_rect(slot_tex, Rect2(sx - 2.0, sy - 2.0, eq_sz + 4.0, eq_sz + 4.0), false)
		if is_sel:
			c.draw_rect(sr.grow(3.0), Color(1.0, 0.86, 0.28, 0.98), false, 3.0)
		var slot_hint := str(EQUIP_SLOT_NAMES[ei]) if ei < EQUIP_SLOT_NAMES.size() else "Slot"
		var gname := str(sl.get("name", slot_hint)) if has_it else slot_hint
		if gname.length() > 14:
			gname = gname.substr(0, 13) + "…"
		var gnw := fb.get_string_size(gname, HORIZONTAL_ALIGNMENT_LEFT, -1, 13).x
		c.draw_string_outline(fb, Vector2(sx + (eq_sz - gnw) * 0.5, sy + eq_sz + 15.0), gname, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, 3, Color(0.02, 0.02, 0.03, 0.95))
		c.draw_string(fb, Vector2(sx + (eq_sz - gnw) * 0.5, sy + eq_sz + 15.0), gname, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, rcol if has_it else Color(0.76, 0.72, 0.64))

	# Lower-Left Panel: BIG 2-Column Readable Stats Ledger + [+] Buttons
	var stats_y := mr.position.y + 436.0
	var stats_h := maxf(180.0, mr.position.y + mr.size.y - stats_y - 18.0)
	var stats_rect := Rect2(lx, stats_y, lw, stats_h)
	_draw_obsidian_plate(c, stats_rect, Color(0.84, 0.66, 0.35, 0.88))

	var pts_tag := "  •  WOLNE PKT: %d" % free_stat_points if free_stat_points > 0 else ""
	c.draw_string(f, Vector2(lx + 18.0, stats_y + 28.0), "ATRYBUTY BOHATERA (POZ. %d)%s" % [hero_level, pts_tag], HORIZONTAL_ALIGNMENT_LEFT, -1, 15, Color(0.46, 0.98, 0.64) if free_stat_points > 0 else Color(1.0, 0.88, 0.54))
	var ki_power_txt := "MOC KI: %d" % get_ki_power()
	var kpw := f.get_string_size(ki_power_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 15).x
	c.draw_string(f, Vector2(lx + lw - 18.0 - kpw, stats_y + 28.0), ki_power_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 15, Color(0.42, 0.96, 1.0))
	c.draw_line(Vector2(lx + 18.0, stats_y + 38.0), Vector2(lx + lw - 18.0, stats_y + 38.0), Color(0.80, 0.62, 0.32, 0.50), 1.2, true)

	var stats_rows: Array = [
		["hud-hp.webp", "Życie (HP)", "%d" % int(round(hero_max_hp)), "hp"],
		["hud-ki.webp", "Energia KI", "%d" % int(round(hero_max_ki)), "ki"],
		["hud-fist.webp", "Atak", "%d" % get_total_attack(), "atk"],
		["hud-shield.webp", "Obrona", "%d" % get_total_defense(), "def"],
		["gear-boots.webp", "Szybkość", "%d j." % get_total_speed(), "spd"],
		["emblem_slash.webp", "Kryt", "%.1f%%" % get_total_crit(), "crit"],
		["emblem_crystal.webp", "Regen KI", "%.2f/s" % get_total_ki_regen(), ""],
		["gear-coin.webp", "Złoto", "%d zł" % hero_gold, ""],
	]
	stat_plus_hitboxes.clear()
	var col_w := (lw - 36.0) * 0.5
	var row_h := minf(42.0, (stats_h - 54.0) / 4.0)
	for si in stats_rows.size():
		var scol := si / 4
		var srow := si % 4
		var cell_x := lx + 18.0 + float(scol) * (col_w + 10.0)
		var cell_y := stats_y + 62.0 + float(srow) * row_h
		var row: Array = stats_rows[si]
		var skey := str(row[3])
		var sico := _icon_tex(str(row[0]))
		if sico != null:
			c.draw_texture_rect(sico, Rect2(cell_x, cell_y - 16.0, 24.0, 24.0), false)
		c.draw_string(fb, Vector2(cell_x + 30.0, cell_y + 2.0), str(row[1]), HORIZONTAL_ALIGNMENT_LEFT, -1, 15, Color(0.94, 0.91, 0.85))
		var val_s := str(row[2])
		var vw := fb.get_string_size(val_s, HORIZONTAL_ALIGNMENT_LEFT, -1, 16).x
		var right_pad := 42.0 if (free_stat_points > 0 and not skey.is_empty()) else 12.0
		c.draw_string(fb, Vector2(cell_x + col_w - right_pad - vw, cell_y + 2.0), val_s, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color(1.0, 0.91, 0.54))
		if free_stat_points > 0 and not skey.is_empty():
			var pbtn := Rect2(cell_x + col_w - 34.0, cell_y - 15.0, 28.0, 26.0)
			c.draw_rect(pbtn, Color(0.10, 0.34, 0.20, 0.96), true)
			c.draw_rect(pbtn, Color(0.42, 0.98, 0.60, 0.98), false, 1.8)
			c.draw_string(f, Vector2(pbtn.position.x + 8.0, pbtn.position.y + 19.0), "+", HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color(0.94, 1.0, 0.96))
			stat_plus_hitboxes.append({"rect": pbtn.grow(5.0), "key": skey})

	# ==========================================================================
	# RIGHT HALF: LARGE 6x4 BACKPACK (62px CELLS) + DETAILED ITEM INSPECTOR + ACTION BUTTON
	# ==========================================================================
	var rx := lx + lw + 16.0
	var ry := mr.position.y + 98.0
	var rw_box := mr.position.x + mr.size.x - rx - 22.0
	var bp_panel_h := 328.0
	_draw_obsidian_plate(c, Rect2(rx, ry, rw_box, bp_panel_h), Color(0.84, 0.66, 0.35, 0.90))

	var used_slots := 0
	for b_it: Dictionary in backpack_items:
		if not b_it.is_empty():
			used_slots += 1
	c.draw_string(f, Vector2(rx + 20.0, ry + 28.0), "PLECAK (%d/%d)" % [used_slots, BACKPACK_SLOTS], HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color(1.0, 0.88, 0.52))
	var hint_s := "1× klik = szczegóły  •  2× klik = użyj / załóż"
	var hw := fb.get_string_size(hint_s, HORIZONTAL_ALIGNMENT_LEFT, -1, 13).x
	c.draw_string(fb, Vector2(rx + rw_box - 20.0 - hw, ry + 27.0), hint_s, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(0.76, 0.86, 0.96))
	c.draw_line(Vector2(rx + 20.0, ry + 38.0), Vector2(rx + rw_box - 20.0, ry + 38.0), Color(0.80, 0.62, 0.32, 0.50), 1.2, true)

	var cols := 6
	var gap := 8.0
	var max_cell_w := floorf((rw_box - 40.0 - float(cols - 1) * gap) / float(cols))
	var max_cell_h := floorf((bp_panel_h - 56.0 - 3.0 * gap) / 4.0)
	var cell := clampf(minf(max_cell_w, max_cell_h), 52.0, 68.0)
	var grid_w := float(cols) * cell + float(cols - 1) * gap
	var grid_x0 := rx + (rw_box - grid_w) * 0.5
	var grid_y0 := ry + 46.0
	backpack_hitboxes.clear()
	for bi in mini(backpack_items.size(), BACKPACK_SLOTS):
		var col_i := bi % cols
		var row_i := bi / cols
		var bx := grid_x0 + float(col_i) * (cell + gap)
		var by := grid_y0 + float(row_i) * (cell + gap)
		var br := Rect2(bx, by, cell, cell)
		backpack_hitboxes.append({"rect": br, "idx": bi})
		var is_sel_b := (selected_char_source == "backpack" and selected_char_idx == bi)
		c.draw_rect(br, Color(0.05, 0.04, 0.07, 0.95), true)
		var bi_d: Dictionary = backpack_items[bi]
		if not bi_d.is_empty():
			var bico := _icon_tex(str(bi_d.get("icon", "")))
			if bico != null:
				c.draw_texture_rect(bico, Rect2(bx + 6.0, by + 6.0, cell - 12.0, cell - 12.0), false)
			var rcol_b: Color = bi_d.get("rarity", Color(0.70, 0.58, 0.36)) as Color
			c.draw_rect(br.grow(-2.0), Color(rcol_b.r, rcol_b.g, rcol_b.b, 0.78), false, 2.0)
		if slot_tex != null:
			c.draw_texture_rect(slot_tex, Rect2(bx - 2.0, by - 2.0, cell + 4.0, cell + 4.0), false)
		if is_sel_b:
			c.draw_rect(br.grow(3.0), Color(1.0, 0.86, 0.28, 0.98), false, 3.0)
		var qty_i := int(bi_d.get("qty", 0))
		if qty_i > 1 or (qty_i == 1 and str(bi_d.get("cat", "")) in ["consumable", "material"]):
			var qty := str(qty_i)
			var qw := fb.get_string_size(qty, HORIZONTAL_ALIGNMENT_LEFT, -1, 14).x
			c.draw_string_outline(fb, Vector2(bx + cell - qw - 5.0, by + cell - 5.0), qty, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, 4, Color(0.0, 0.0, 0.0, 0.98))
			c.draw_string(fb, Vector2(bx + cell - qw - 5.0, by + cell - 5.0), qty, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color(1.0, 0.95, 0.76))

	# Bottom-Right Panel: BIG Detailed Item Inspector + Explicit Action Button ("ZAŁÓŻ" / "UŻYJ" / "ZDEJMIJ")
	var insp_rect := Rect2(rx, stats_y, rw_box, stats_h)
	_draw_obsidian_plate(c, insp_rect, Color(0.90, 0.72, 0.34, 0.94))
	char_action_btn_rect = Rect2()

	var sel_item := _get_selected_char_item()
	if sel_item.is_empty():
		var empty_t := "SZCZEGÓŁY PRZEDMIOTU"
		c.draw_string(f, Vector2(rx + 22.0, stats_y + 34.0), empty_t, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color(1.0, 0.88, 0.52))
		c.draw_string(fb, Vector2(rx + 22.0, stats_y + 72.0), "Dotknij dowolny przedmiot w plecaku lub na postaci,", HORIZONTAL_ALIGNMENT_LEFT, int(rw_box - 44.0), 16, Color(0.88, 0.86, 0.82))
		c.draw_string(fb, Vector2(rx + 22.0, stats_y + 98.0), "aby zobaczyć jego dokładne statystyki i opis.", HORIZONTAL_ALIGNMENT_LEFT, int(rw_box - 44.0), 16, Color(0.88, 0.86, 0.82))
		c.draw_string(fb, Vector2(rx + 22.0, stats_y + 134.0), "• Szybkie 2× kliknięcie: natychmiastowe założenie lub użycie", HORIZONTAL_ALIGNMENT_LEFT, int(rw_box - 44.0), 15, Color(0.56, 0.96, 0.72))
		c.draw_string(fb, Vector2(rx + 22.0, stats_y + 158.0), "• Lub użyj przycisku akcji obok opisu przedmiotu", HORIZONTAL_ALIGNMENT_LEFT, int(rw_box - 44.0), 15, Color(0.56, 0.96, 0.72))
	else:
		var rcol_s: Color = sel_item.get("rarity", Color(0.95, 0.90, 0.76)) as Color
		var ico_box := Rect2(rx + 20.0, stats_y + 20.0, 74.0, 74.0)
		c.draw_rect(ico_box, Color(0.05, 0.04, 0.07, 0.96), true)
		var s_ico := _icon_tex(str(sel_item.get("icon", "")))
		if s_ico != null:
			c.draw_texture_rect(s_ico, ico_box.grow(-6.0), false)
		c.draw_rect(ico_box, rcol_s, false, 2.4)

		var tx_x := rx + 108.0
		var tx_w := rw_box - 128.0
		var nm_s := "%s  [Poz.%d]" % [str(sel_item.get("name", "Przedmiot")), int(sel_item.get("minLevel", 1))]
		c.draw_string(f, Vector2(tx_x, stats_y + 38.0), nm_s, HORIZONTAL_ALIGNMENT_LEFT, int(tx_w), 19, rcol_s)

		var cat_s := str(sel_item.get("cat", ""))
		var eq_slot_i := int(sel_item.get("slot", -1))
		var type_tag := "Surowiec rzemieślniczy" if cat_s == "material" else (
			("Ekwipunek · %s" % str(EQUIP_SLOT_NAMES[eq_slot_i])) if (eq_slot_i >= 0 and eq_slot_i < EQUIP_SLOT_NAMES.size()) else "Przedmiot użytkowy"
		)
		if selected_char_source == "equip":
			type_tag += "  •  ZAŁOŻONY"
		var sell_v := int(sel_item.get("sellPrice", 0))
		if sell_v > 0:
			type_tag += "  •  Wartość: %d zł" % sell_v
		c.draw_string(fb, Vector2(tx_x, stats_y + 60.0), type_tag, HORIZONTAL_ALIGNMENT_LEFT, int(tx_w), 14, Color(0.84, 0.80, 0.70))

		# Stat bonuses + comparison vs equipped item
		var cmp_eq: Dictionary = {}
		if selected_char_source == "backpack" and eq_slot_i >= 0 and eq_slot_i < equip_slots.size():
			var cur_eq: Dictionary = equip_slots[eq_slot_i]
			if not str(cur_eq.get("id", "")).is_empty():
				cmp_eq = cur_eq
		var slines := _item_stat_summary(sel_item, cmp_eq)
		var stat_x := tx_x
		var stat_y := stats_y + 84.0
		for sli in mini(slines.size(), 4):
			var sl_d: Dictionary = slines[sli]
			var s_txt := str(sl_d["text"])
			c.draw_string(fb, Vector2(stat_x, stat_y), s_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 15, sl_d["color"] as Color)
			stat_x += fb.get_string_size(s_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 15).x + 18.0
			if stat_x > rx + rw_box - 140.0 and sli < slines.size() - 1:
				stat_x = tx_x
				stat_y += 20.0

		# Description text (bottom-left of inspector, leaving space for big Action Button on bottom-right)
		var desc_s := str(sel_item.get("desc", ""))
		var btn_w := 192.0
		var desc_max_w := rw_box - btn_w - 48.0
		c.draw_string(fb, Vector2(rx + 20.0, stats_y + stats_h - 46.0), desc_s, HORIZONTAL_ALIGNMENT_LEFT, int(maxf(140.0, desc_max_w)), 14, Color(0.90, 0.88, 0.84))
		var action_hint := "2× klik na ikonę lub przycisk obok"
		c.draw_string(fb, Vector2(rx + 20.0, stats_y + stats_h - 22.0), action_hint, HORIZONTAL_ALIGNMENT_LEFT, int(maxf(140.0, desc_max_w)), 13, Color(0.62, 0.92, 0.74))

		# Explicit BIG Forged Gold Action Button on bottom-right of Inspector
		var btn_rect := Rect2(rx + rw_box - btn_w - 18.0, stats_y + stats_h - 68.0, btn_w, 50.0)
		if selected_char_source == "equip":
			char_action_btn_rect = btn_rect
			_draw_forged_pill(c, btn_rect, false)
			var albl := "ZDEJMIJ"
			var alw := f.get_string_size(albl, HORIZONTAL_ALIGNMENT_LEFT, -1, 17).x
			c.draw_string(f, Vector2(btn_rect.position.x + (btn_rect.size.x - alw) * 0.5, btn_rect.position.y + 32.0), albl, HORIZONTAL_ALIGNMENT_LEFT, -1, 17, Color(1.0, 0.94, 0.78))
		elif selected_char_source == "backpack" and cat_s != "material":
			char_action_btn_rect = btn_rect
			_draw_forged_pill(c, btn_rect, true)
			var albl := "ZAŁÓŻ" if eq_slot_i >= 0 else "UŻYJ"
			var alw := f.get_string_size(albl, HORIZONTAL_ALIGNMENT_LEFT, -1, 18).x
			c.draw_string(f, Vector2(btn_rect.position.x + (btn_rect.size.x - alw) * 0.5, btn_rect.position.y + 32.0), albl, HORIZONTAL_ALIGNMENT_LEFT, -1, 18, Color(1.0, 0.97, 0.84))
		elif cat_s == "material":
			c.draw_rect(btn_rect, Color(0.10, 0.09, 0.12, 0.88), true)
			c.draw_rect(btn_rect, Color(0.56, 0.48, 0.34, 0.65), false, 1.4)
			var mlbl := "KUŹNIA / SKLEP"
			var mlw := fb.get_string_size(mlbl, HORIZONTAL_ALIGNMENT_LEFT, -1, 14).x
			c.draw_string(fb, Vector2(btn_rect.position.x + (btn_rect.size.x - mlw) * 0.5, btn_rect.position.y + 30.0), mlbl, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color(0.84, 0.78, 0.64))

# ==============================================================================
# INPUT HANDLING (MOUSE HOVER, MOBILE TOUCH TAPS, CONSTELLATION UNLOCKING, WILD RIFT SKILLS)
# ==============================================================================

func _can_buy_talent(nid: String, state: String) -> bool:
	return (state == "available" or state == "unlocked") and skill_points > 0 and talent_rank(nid) < talent_rank_limit(nid) and not talent_purchase_pending

func _try_unlock_node(nid: String) -> void:
	var nd := _node_by_id(nid)
	if nd.is_empty():
		return
	var st := _node_state(nd)
	if st == "level_locked":
		if world != null and world.has_method("show_combat_toast"):
			world.show_combat_toast("Wymagany poziom %d dla węzła %s!" % [int(nd.get("minLevel", 1)), nid], Color(1.0, 0.64, 0.38))
		return
	if _can_buy_talent(nid, st):
		var rank := talent_rank(nid)
		if world != null and world.has_method("is_server_authoritative") and world.is_server_authoritative():
			talent_purchase_pending = true
			world.dispatch_server_action({"type": "unlock_talent", "nodeId": nid, "expectedRank": rank}, func(result: Dictionary) -> void:
				talent_purchase_pending = false
				if not bool(result.get("ok", false)) and world != null:
					world.show_combat_toast(str(result.get("notice", "Nie zapisano rangi talentu.")), Color(1.0, 0.64, 0.38))
				_refresh_visuals()
			)
			_refresh_visuals()
			return
		var umap := _unlocked_map()
		umap[nid] = rank + 1
		skill_points -= 1
		if rank == 0 and nid in ASSIGNABLE_NODES and not (nid in hotbar_nodes.slice(1, 5)):
			for s_i in range(1, 5):
				if not bool(umap.get(hotbar_nodes[s_i], false)):
					hotbar_nodes[s_i] = nid
					_refresh_hotbar_icons()
					break
		recalc_stats(false)
		if world != null and world.get("audio") != null:
			world.audio.sfx("ui/skill-learn", 0.90, 0.04)
		_sync_talent_node_styles()
		_refresh_visuals()

func _handle_primary_tap(p: Vector2) -> bool:
	if show_talents:
		if talent_close_rect.has_point(p) or not _modal_rect().has_point(p):
			close_modals()
			return true
		for sr_d: Dictionary in talent_slot_rects:
			if (sr_d["rect"] as Rect2).has_point(p):
				assign_hotbar_slot(int(sr_d["slot"]), str(sr_d["node"]))
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
		if char_action_btn_rect.size.x > 1.0 and char_action_btn_rect.has_point(p):
			_execute_selected_char_action()
			return true
		for shb: Dictionary in stat_plus_hitboxes:
			if (shb["rect"] as Rect2).has_point(p):
				spend_free_stat_point(str(shb["key"]))
				return true
		var now_ms := Time.get_ticks_msec()
		for ehb: Dictionary in equip_hitboxes:
			if (ehb["rect"] as Rect2).has_point(p):
				var eidx := int(ehb["idx"])
				var eq_d: Dictionary = equip_slots[eidx]
				if str(eq_d.get("id", "")).is_empty():
					return true
				var tap_key := "equip:%d" % eidx
				if _last_slot_tap_key == tap_key and (now_ms - _last_slot_tap_ms) <= 450:
					_last_slot_tap_key = ""
					unequip_slot(eidx)
					selected_char_source = ""
					selected_char_idx = -1
				else:
					_last_slot_tap_key = tap_key
					_last_slot_tap_ms = now_ms
					selected_char_source = "equip"
					selected_char_idx = eidx
					if world != null and world.get("audio") != null:
						world.audio.sfx("ui/click", 0.65, 0.04)
				_refresh_visuals()
				return true
		for bhb: Dictionary in backpack_hitboxes:
			if (bhb["rect"] as Rect2).has_point(p):
				var bidx := int(bhb["idx"])
				var bg_d: Dictionary = backpack_items[bidx]
				if bg_d.is_empty():
					selected_char_source = ""
					selected_char_idx = -1
					_refresh_visuals()
					return true
				var tap_key := "bag:%d" % bidx
				if _last_slot_tap_key == tap_key and (now_ms - _last_slot_tap_ms) <= 450:
					_last_slot_tap_key = ""
					use_backpack_slot(bidx)
					if bidx >= backpack_items.size() or backpack_items[bidx].is_empty():
						selected_char_source = ""
						selected_char_idx = -1
				else:
					_last_slot_tap_key = tap_key
					_last_slot_tap_ms = now_ms
					selected_char_source = "backpack"
					selected_char_idx = bidx
					if world != null and world.get("audio") != null:
						world.audio.sfx("ui/click", 0.65, 0.04)
				_refresh_visuals()
				return true
		return true

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

	# Top-Left Utility Medallions & Forged Buttons
	for item: Dictionary in util_hitboxes:
		if (item["rect"] as Rect2).has_point(p):
			var uid := str(item["id"])
			if world != null and world.get("audio") != null and not (uid in ["potion", "dodge", "channel"]):
				world.audio.sfx("ui/click")
			match uid:
				"talents":
					toggle_talents()
				"char":
					toggle_character()
				"menu":
					if world != null and world.has_method("toggle_game_menu"):
						world.toggle_game_menu()
				"time":
					if world != null:
						world.cycle_time_of_day()
				"atlas":
					if world != null:
						if world.has_method("open_world_map_on_hero"):
							world.open_world_map_on_hero()
						else:
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
					if world != null and world.can_use_gm():
						world.toggle_gm_panel()
				"quests":
					if world != null and world.has_method("toggle_quest_journal"):
						world.toggle_quest_journal()
				"recall":
					if world != null and world.has_method("start_recall_to_capital"):
						world.start_recall_to_capital()
					elif world != null:
						world.teleport_to_capital()
				"dodge":
					trigger_dodge()
				"channel":
					trigger_channel()
				"clear_target":
					if world != null and world.has_method("set_locked_target"):
						world.set_locked_target("")
				"potion":
					if not use_quick_hp_potion() and world != null:
						world.show_combat_toast("Brak eliksirów życia w plecaku — kup w Sklepie lub odpocznij w Gospodzie!", Color(1.0, 0.56, 0.36))
			return true
	return false

var _last_tap_msec := 0

func _gui_input(event: InputEvent) -> void:
	# Live On-Screen Drag-and-Drop HUD Editor Input (works identically on Android touch & desktop mouse)
	if hud_edit_mode:
		if event is InputEventMouseButton:
			var mb_e := event as InputEventMouseButton
			if mb_e.button_index == MOUSE_BUTTON_LEFT:
				if mb_e.pressed:
					hud_drag_zone = ""
					for zk: String in ["minimap", "combat", "utils", "portrait", "xp"]:
						if _zone_bounds_rect(zk).has_point(mb_e.position):
							hud_drag_zone = zk
							hud_drag_start = mb_e.position
							hud_drag_origin = get_zone_offset(zk)
							if world != null and world.get("audio") != null:
								world.audio.sfx("ui/click", 0.65, 0.04)
							_refresh_visuals()
							break
				else:
					hud_drag_zone = ""
					_refresh_visuals()
				accept_event()
				return
		elif event is InputEventMouseMotion:
			if not hud_drag_zone.is_empty():
				var mp_e: Vector2 = (event as InputEventMouseMotion).position
				set_zone_offset(hud_drag_zone, hud_drag_origin + (mp_e - hud_drag_start))
				accept_event()
			return
		return

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
		if show_character:
			var found_h: Dictionary = {}
			for ehb: Dictionary in equip_hitboxes:
				if (ehb["rect"] as Rect2).has_point(mp):
					var eq_d: Dictionary = equip_slots[int(ehb["idx"])]
					if not str(eq_d.get("id", "")).is_empty():
						found_h = eq_d.duplicate(true)
						found_h["_hint"] = "Kliknij, aby zdjąć do plecaka"
					break
			if found_h.is_empty():
				for bhb: Dictionary in backpack_hitboxes:
					if (bhb["rect"] as Rect2).has_point(mp):
						var bg_d: Dictionary = backpack_items[int(bhb["idx"])]
						if not bg_d.is_empty():
							found_h = bg_d.duplicate(true)
							if str(bg_d.get("cat", "")) == "material":
								found_h["_hint"] = "Surowiec rzemieślniczy — Kuźnia lub sprzedaż w Sklepie"
							elif int(bg_d.get("slot", -1)) >= 0:
								found_h["_hint"] = "Kliknij, aby założyć ekwipunek"
							else:
								found_h["_hint"] = "Kliknij, aby użyć przedmiot"
						break
			if str(found_h.get("id", "")) != str(hovered_char_item.get("id", "")) or str(found_h.get("_hint", "")) != str(hovered_char_item.get("_hint", "")):
				hovered_char_item = found_h
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
		var min_gap := 75 if show_character else 180
		if now_ms - _last_tap_msec < min_gap:
			accept_event()
			return
		if _handle_primary_tap(mb.position):
			_last_tap_msec = now_ms
			accept_event()
			return
