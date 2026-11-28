extends Control
## Upgraded Studio-Grade GM Panel for KI Legends (Android + Desktop).
## Features:
## 1. Tap-on-Map Teleport (2D Atlas + Minimap) & Quick Teleport to all 4 Capitals / Regional Strongholds.
## 2. Super-Speed multiplier (1x / 2x / 4x / 8x) + Noclip toggle.
## 3. Categorized Item Creator with scrollable list -> creates items directly into hero's backpack ([I]).
## 4. Live In-Game Stat Points & Attribute Editor (HP, KI, ATK, DEF, SPD, CRIT, Level, Gold, Skill Points).

const MapStyle := preload("res://scripts/map_style.gd")
const ForgedUI := preload("res://scripts/forged_ui.gd")

const RARITY_COLORS := {
	"common": Color(0.86, 0.86, 0.88),
	"uncommon": Color(0.36, 0.90, 0.54),
	"rare": Color(0.38, 0.74, 1.0),
	"epic": Color(0.78, 0.48, 1.0),
	"legendary": Color(1.0, 0.78, 0.28),
}

static var _catalog_cache: Array[Dictionary] = []
static var _catalog_by_id: Dictionary = {}
static var _recipes_cache: Array[Dictionary] = []
static var _sets_cache: Dictionary = {}
static var _heritage_cache: Array[Dictionary] = []
static var _enhance_cache: Array[Dictionary] = []

static func rarity_color(tier: String) -> Color:
	return RARITY_COLORS.get(tier, Color(0.86, 0.86, 0.88)) as Color

static func get_catalog() -> Array[Dictionary]:
	if not _catalog_cache.is_empty():
		return _catalog_cache
	if FileAccess.file_exists("res://data/items_catalog.json"):
		var raw: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://data/items_catalog.json"))
		if raw is Dictionary:
			var rd: Dictionary = raw as Dictionary
			var arr: Array = rd.get("items", [])
			for entry in arr:
				if not (entry is Dictionary):
					continue
				var it: Dictionary = (entry as Dictionary).duplicate(true)
				var r_tier := str(it.get("rarity", "common"))
				it["rarity_tier"] = r_tier
				it["rarity"] = rarity_color(r_tier)
				_catalog_cache.append(it)
				_catalog_by_id[str(it.get("id", ""))] = it
			_recipes_cache.clear()
			for rec: Variant in rd.get("recipes", []):
				if rec is Dictionary:
					_recipes_cache.append((rec as Dictionary).duplicate(true))
			_sets_cache = (rd.get("equipment_sets", {}) as Dictionary).duplicate(true) if rd.get("equipment_sets") is Dictionary else {}
			_heritage_cache.clear()
			for hw: Variant in rd.get("heritage_weapons", []):
				if hw is Dictionary:
					_heritage_cache.append((hw as Dictionary).duplicate(true))
			_enhance_cache.clear()
			for et: Variant in rd.get("enhance_tiers", []):
				if et is Dictionary:
					_enhance_cache.append((et as Dictionary).duplicate(true))
	return _catalog_cache

static func get_recipes() -> Array[Dictionary]:
	if _catalog_cache.is_empty():
		get_catalog()
	return _recipes_cache

static func get_equipment_sets() -> Dictionary:
	if _catalog_cache.is_empty():
		get_catalog()
	return _sets_cache

static func get_heritage_weapons(race_k: String = "") -> Array[Dictionary]:
	if _catalog_cache.is_empty():
		get_catalog()
	if race_k.is_empty():
		return _heritage_cache
	var out: Array[Dictionary] = []
	for hw: Dictionary in _heritage_cache:
		if str(hw.get("race", "")) == race_k:
			out.append(hw)
	return out

static func get_enhance_tier(current_tier: int) -> Dictionary:
	if _catalog_cache.is_empty():
		get_catalog()
	var next_t := current_tier + 1
	for et: Dictionary in _enhance_cache:
		if int(et.get("nextTier", 0)) == next_t:
			return et
	return {}

static func find_item(iid: String) -> Dictionary:
	if _catalog_cache.is_empty():
		get_catalog()
	var found: Variant = _catalog_by_id.get(iid, null)
	if found is Dictionary:
		return (found as Dictionary).duplicate(true)
	return {}


var world: Node2D
var active_tab := "teleport" # "teleport" | "items" | "stats"
var item_cat := "all"
var item_qty := 1
var status_text := "Panel GM gotowy. Wybierz funkcję."

var panel_box := PanelContainer.new()
var tab_btns: Dictionary = {}
var content_scroll := ScrollContainer.new()
var content_vbox := VBoxContainer.new()
var status_lbl := Label.new()

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP
	set_anchors_preset(Control.PRESET_FULL_RECT)
	_build_ui()
	resized.connect(_layout_panel)
	_layout_panel()

func _style_btn(btn: Button, bg: Color, border: Color, font_sz: int = 15) -> void:
	btn.custom_minimum_size.y = maxf(btn.custom_minimum_size.y, 44.0)
	var variant := "gold" if (border.r > 0.90 and border.g > 0.72) else ("crimson" if (bg.r > 0.24 and bg.g < 0.14) else "slate")
	ForgedUI.style_button(btn, variant, maxi(font_sz, 14), 14.0, 8.0)

## Crisp compact beveled control button for GM numeric +/- steppers & grids.
## Uses narrow content padding (NO wide 44px Forged texture margins) so buttons NEVER clip horizontally!
func _style_mini_btn(btn: Button, kind: String = "slate", font_sz: int = 13, min_w: float = 46.0, min_h: float = 34.0) -> void:
	btn.focus_mode = Control.FOCUS_NONE
	btn.custom_minimum_size = Vector2(min_w, min_h)
	var bg_col := Color(0.11, 0.10, 0.15, 0.96)
	var bd_col := Color(0.62, 0.52, 0.34, 0.90)
	var txt_col := Color(0.96, 0.93, 0.84)
	if kind == "plus":
		bg_col = Color(0.09, 0.24, 0.14, 0.96)
		bd_col = Color(0.38, 0.88, 0.52, 0.94)
		txt_col = Color(0.86, 1.0, 0.90)
	elif kind == "minus":
		bg_col = Color(0.26, 0.09, 0.10, 0.96)
		bd_col = Color(0.92, 0.42, 0.38, 0.94)
		txt_col = Color(1.0, 0.88, 0.86)
	elif kind == "gold":
		bg_col = Color(0.24, 0.18, 0.07, 0.96)
		bd_col = Color(0.98, 0.80, 0.34, 0.96)
		txt_col = Color(1.0, 0.95, 0.76)
	elif kind == "cyan":
		bg_col = Color(0.08, 0.20, 0.26, 0.96)
		bd_col = Color(0.36, 0.88, 1.0, 0.94)
		txt_col = Color(0.88, 0.98, 1.0)
	for st_name in ["normal", "hover", "pressed", "disabled"]:
		var sb := StyleBoxFlat.new()
		sb.bg_color = bg_col.lightened(0.12) if st_name == "hover" else (bg_col.darkened(0.18) if st_name == "pressed" else bg_col)
		sb.border_color = bd_col.lightened(0.16) if st_name == "hover" else bd_col
		sb.set_border_width_all(2)
		sb.set_corner_radius_all(6)
		sb.content_margin_left = 8
		sb.content_margin_right = 8
		sb.content_margin_top = 4
		sb.content_margin_bottom = 4
		btn.add_theme_stylebox_override(st_name, sb)
	btn.add_theme_font_override("font", MapStyle.body_font())
	btn.add_theme_font_size_override("font_size", maxi(font_sz, 16))
	btn.add_theme_color_override("font_color", txt_col)
	btn.add_theme_color_override("font_hover_color", Color.WHITE)
	btn.add_theme_color_override("font_pressed_color", Color(1.0, 0.92, 0.65))

var _opened_msec := 0

func _build_ui() -> void:
	var bg_dim := ColorRect.new()
	bg_dim.color = Color(0.015, 0.012, 0.025, 0.80)
	bg_dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg_dim.mouse_filter = Control.MOUSE_FILTER_STOP
	bg_dim.gui_input.connect(func(ev: InputEvent) -> void:
		if ev is InputEventMouseButton and (ev as InputEventMouseButton).pressed:
			if Time.get_ticks_msec() - _opened_msec < 320:
				return
			if world != null and world.has_method("toggle_gm_panel"):
				world.toggle_gm_panel(false)
	)
	add_child(bg_dim)

	panel_box.add_theme_stylebox_override("panel", ForgedUI.panel_box(32.0, 26.0))
	add_child(panel_box)

	var root_v := VBoxContainer.new()
	root_v.add_theme_constant_override("separation", 12)
	panel_box.add_child(root_v)

	# Consistent Forged Header Bar with "← WSTECZ"
	root_v.add_child(ForgedUI.make_header_bar("PANEL GM — NARZĘDZIA ADMINISTRATORA", func() -> void:
		if world != null and world.has_method("toggle_gm_panel"):
			world.toggle_gm_panel(false)
	, "← WSTECZ", "Pełna kontrola: teleportacja, przedmioty, statystyki i talenty"))

	# Tabs Row
	var tabs_row := HBoxContainer.new()
	tabs_row.add_theme_constant_override("separation", 10)
	root_v.add_child(tabs_row)
	var tab_defs := [
		["teleport", "⚡ TELEPORT & SZYBKOŚĆ"],
		["items", "🎒 PRZEDMIOTY"],
		["stats", "📊 STATYSTYKI I BOHATER"],
	]
	for td: Array in tab_defs:
		var tb := Button.new()
		tb.text = str(td[1])
		tb.custom_minimum_size = Vector2(0, 52)
		tb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var tid := str(td[0])
		tb.pressed.connect(func() -> void:
			active_tab = tid
			refresh_content()
		)
		tabs_row.add_child(tb)
		tab_btns[tid] = tb

	# Scrollable Body
	content_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	content_scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	root_v.add_child(content_scroll)

	content_vbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content_vbox.add_theme_constant_override("separation", 12)
	content_scroll.add_child(content_vbox)

	# Status Footer
	status_lbl.add_theme_font_override("font", MapStyle.body_font())
	status_lbl.add_theme_font_size_override("font_size", 18)
	status_lbl.add_theme_color_override("font_color", Color(0.56, 0.98, 0.74))
	status_lbl.text = status_text
	root_v.add_child(status_lbl)

func _layout_panel() -> void:
	var vs := get_viewport_rect().size
	if vs.x < 100.0:
		vs = Vector2(1280.0, 720.0)
	var pw := clampf(vs.x - 36.0, 760.0, 1480.0)
	var ph := clampf(vs.y - 24.0, 500.0, 696.0)
	panel_box.position = Vector2((vs.x - pw) * 0.5, (vs.y - ph) * 0.5)
	panel_box.size = Vector2(pw, ph)

func _set_status(msg: String) -> void:
	status_text = msg
	status_lbl.text = msg

var _gm_request_pending := false

func _send_gm_action(op: String, args: Dictionary = {}) -> void:
	if world == null or not world.can_use_gm() or _gm_request_pending:
		return
	if not world.is_server_authoritative():
		_set_status("Wybierz postać serwerową, aby zapisać zmiany GM.")
		return
	var payload := {"type": "gm_action", "op": op}
	payload.merge(args)
	_gm_request_pending = true
	_set_status("Oczekiwanie na serwer…")
	world.dispatch_server_action(payload, func(result: Dictionary) -> void:
		_gm_request_pending = false
		_set_status(str(result.get("notice", "Brak odpowiedzi serwera.")))
		if visible and world.can_use_gm():
			refresh_content()
		if bool(result.get("ok", false)) and op in ["full_heal", "set_level", "set_test_hp"]:
			world.notify_hero_healed()
	)

func _section_label(txt: String) -> Label:
	var l := Label.new()
	l.text = txt
	l.add_theme_font_override("font", MapStyle.font())
	l.add_theme_font_size_override("font_size", 19)
	l.add_theme_color_override("font_color", Color(1.0, 0.88, 0.50))
	return l

func refresh_content() -> void:
	if world == null or not world.can_use_gm():
		return
	_opened_msec = Time.get_ticks_msec()
	for tid in tab_btns.keys():
		var tb: Button = tab_btns[tid]
		if str(tid) == active_tab:
			_style_btn(tb, Color(0.28, 0.20, 0.08, 0.98), Color(1.0, 0.84, 0.36, 1.0), 18)
		else:
			_style_btn(tb, Color(0.11, 0.09, 0.13, 0.94), Color(0.46, 0.38, 0.26, 0.80), 18)

	for ch in content_vbox.get_children():
		content_vbox.remove_child(ch)
		ch.queue_free()

	if active_tab == "teleport":
		_build_teleport_tab()
	elif active_tab == "items":
		_build_items_tab()
	else:
		_build_stats_tab()
	status_lbl.text = status_text

func _build_teleport_tab() -> void:
	content_vbox.add_child(_section_label("0. POSTAĆ GAMEMASTERA — MODEL 3D, LOT I PRZYSPIESZENIE"))
	var gm_row := HBoxContainer.new()
	gm_row.add_theme_constant_override("separation", 10)
	content_vbox.add_child(gm_row)
	var gmf_on: bool = world != null and bool(world.gm_form_active)
	var bst_on: bool = world != null and bool(world.gm_boost_active)

	var btn_form := Button.new()
	btn_form.text = "✦ FORMA GM: %s [F2]" % ("AKTYWNA ✓" if gmf_on else "WYŁ.")
	btn_form.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_style_mini_btn(btn_form, "gold" if gmf_on else "slate", 17, 0.0, 52.0)
	btn_form.pressed.connect(func() -> void:
		if world != null and world.can_use_gm():
			world.toggle_gm_form()
			_set_status("Forma GameMastera: %s" % ("AKTYWNA" if bool(world.gm_form_active) else "WYŁĄCZONA"))
	)
	gm_row.add_child(btn_form)

	if gmf_on:
		var fly_on: bool = bool(world.gm_flying)
		var btn_fly := Button.new()
		btn_fly.text = "🕊 LOT NAD ZIEMIĄ: %s [L]" % ("LECISZ ✓" if fly_on else "WYŁ.")
		btn_fly.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_style_mini_btn(btn_fly, "cyan" if fly_on else "slate", 17, 0.0, 52.0)
		btn_fly.pressed.connect(func() -> void:
			if world != null and world.can_use_gm() and world.gm_form_active:
				world.toggle_gm_flight()
				_set_status("Lot GameMastera: %s" % ("AKTYWNY" if bool(world.gm_flying) else "WYŁĄCZONY"))
				refresh_content()
		)
		gm_row.add_child(btn_fly)

	var btn_boost := Button.new()
	btn_boost.text = "⚡ PRZYSPIESZENIE 3.5×: %s [U]" % ("ON ✓" if bst_on else "OFF")
	btn_boost.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_style_mini_btn(btn_boost, "gold" if bst_on else "slate", 17, 0.0, 52.0)
	btn_boost.pressed.connect(func() -> void:
		if world != null and world.can_use_gm():
			world.toggle_gm_boost()
			_set_status("Przyspieszenie GameMastera: %s" % ("AKTYWNE" if bool(world.gm_boost_active) else "WYŁĄCZONE"))
			refresh_content()
	)
	gm_row.add_child(btn_boost)

	content_vbox.add_child(_section_label("1. TELEPORT NA DUŻEJ MAPIE ŚWIATA"))
	var map_row := HBoxContainer.new()
	map_row.add_theme_constant_override("separation", 10)
	content_vbox.add_child(map_row)

	var btn_map_tp := Button.new()
	btn_map_tp.text = "⚡ OTWÓRZ DUŻĄ MAPĘ ŚWIATA I KLIKNIJ PUNKT TELEPORTU"
	btn_map_tp.custom_minimum_size = Vector2(0, 54)
	btn_map_tp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_style_btn(btn_map_tp, Color(0.10, 0.28, 0.34, 0.96), Color(0.36, 0.92, 1.0, 0.98), 18)
	btn_map_tp.pressed.connect(func() -> void:
		if world != null and world.can_use_gm():
			world.gm_map_teleport_mode = true
			world.toggle_gm_panel(false)
			if world.atlas_overlay != null:
				world.atlas_overlay.focus_atlas_continent(str(world.current_land), 2.8)
			world.toggle_atlas(true)
	)
	map_row.add_child(btn_map_tp)

	content_vbox.add_child(_section_label("2. SUPER SZYBKOŚĆ I PRZENIKANIE (NOCLIP)"))
	var spd_row := HBoxContainer.new()
	spd_row.add_theme_constant_override("separation", 10)
	content_vbox.add_child(spd_row)
	var cur_spd: float = float(world.gm_speed_mult) if world != null else 1.0
	for mult_def: Array in [[0.5, "0.5× Wolna"], [1.0, "1× Normalna"], [2.0, "2× Szybka"], [4.0, "4× Super"], [8.0, "8× Błyskawica"]]:
		var mv: float = float(mult_def[0])
		var sb := Button.new()
		sb.text = str(mult_def[1])
		sb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var is_sel := absf(cur_spd - mv) < 0.05
		_style_mini_btn(sb, "gold" if is_sel else "slate", 17, 0.0, 48.0)
		sb.pressed.connect(func() -> void:
			if world != null and world.can_use_gm():
				world.gm_speed_mult = mv
				_set_status("Ustawiono szybkość ruchu GM: %.1f×" % mv)
				refresh_content()
		)
		spd_row.add_child(sb)

	var noclip_on: bool = world != null and bool(world.gm_noclip)
	var btn_nc := Button.new()
	btn_nc.text = "PRZENIKANIE (NOCLIP — OMIJANIE WODY/GÓR): %s" % ("WŁĄCZONE ✓" if noclip_on else "WYŁĄCZONE")
	_style_mini_btn(btn_nc, "cyan" if noclip_on else "slate", 17, 0.0, 48.0)
	btn_nc.pressed.connect(func() -> void:
		if world != null and world.can_use_gm():
			world.gm_noclip = not world.gm_noclip
			_set_status("Przenikanie (Noclip): %s" % ("WŁĄCZONE" if world.gm_noclip else "WYŁĄCZONE"))
			refresh_content()
	)
	content_vbox.add_child(btn_nc)

	content_vbox.add_child(_section_label("3. SZYBKI TELEPORT — STOLICE 4 KONTYNENTÓW"))
	var cap_row := HBoxContainer.new()
	cap_row.add_theme_constant_override("separation", 10)
	content_vbox.add_child(cap_row)
	for land_def: Array in [["pyra", "Pyra"], ["verdant", "Verdantia"], ["aether", "Aetheria"], ["nexus", "Nexus-9"]]:
		var lid := str(land_def[0])
		var cb := Button.new()
		cb.text = str(land_def[1])
		cb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_style_mini_btn(cb, "gold" if (world != null and str(world.current_land) == lid) else "slate", 18, 0.0, 50.0)
		cb.pressed.connect(func() -> void:
			if world != null and world.can_use_gm():
				world.switch_region(lid)
				world.toggle_gm_panel(false)
		)
		cap_row.add_child(cb)

	if world != null and world.can_use_gm():
		content_vbox.add_child(_section_label("4. WAROWNIE I MIASTA NA BIEŻĄCYM KONTYNENCIE"))
		var grid := GridContainer.new()
		grid.columns = 2
		grid.add_theme_constant_override("h_separation", 10)
		grid.add_theme_constant_override("v_separation", 8)
		content_vbox.add_child(grid)
		for b: Dictionary in world.buildings:
			if str(b.get("map_kind", "")) != "town":
				continue
			var tname := str(b.get("title", "Warownia"))
			var ent = b.get("entrance", [])
			var tx: float = float(ent[0]) if (ent is Array and ent.size() >= 2) else float(b.get("x", 512.0))
			var tz: float = float(ent[1]) if (ent is Array and ent.size() >= 2) else float(b.get("z", 512.0)) + 36.0
			var tb := Button.new()
			tb.text = "🏰 %s (%d, %d)" % [tname, int(round(tx)), int(round(tz))]
			tb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			_style_mini_btn(tb, "slate", 17, 0.0, 48.0)
			tb.pressed.connect(func() -> void:
				if world != null and world.can_use_gm():
					world.teleport_to_world_pos(str(world.current_land), tx, tz)
					world.toggle_gm_panel(false)
			)
			grid.add_child(tb)

func _build_items_tab() -> void:
	content_vbox.add_child(_section_label("WYBIERZ PRZEDMIOT Z LISTY I STWÓRZ DO PLECAKA [I]"))

	var filter_row := HBoxContainer.new()
	filter_row.add_theme_constant_override("separation", 8)
	content_vbox.add_child(filter_row)
	for cat_def: Array in [["all", "Wszystkie"], ["weapon", "Broń"], ["armor", "Pancerz"], ["jewelry", "Biżuteria"], ["consumable", "Użytkowe"], ["material", "Surowce"]]:
		var cid := str(cat_def[0])
		var fb := Button.new()
		fb.text = str(cat_def[1])
		fb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var is_sel := item_cat == cid
		_style_mini_btn(fb, "gold" if is_sel else "slate", 17, 0.0, 46.0)
		fb.pressed.connect(func() -> void:
			item_cat = cid
			refresh_content()
		)
		filter_row.add_child(fb)

	var qty_row := HBoxContainer.new()
	qty_row.add_theme_constant_override("separation", 10)
	content_vbox.add_child(qty_row)
	var ql := Label.new()
	ql.text = "Ilość przy tworzeniu:"
	ql.add_theme_font_override("font", MapStyle.body_font())
	ql.add_theme_font_size_override("font_size", 18)
	ql.add_theme_color_override("font_color", Color(0.94, 0.90, 0.80))
	qty_row.add_child(ql)
	for qv: int in [1, 5, 10]:
		var qb := Button.new()
		qb.text = "×%d" % qv
		var is_q := item_qty == qv
		_style_mini_btn(qb, "plus" if is_q else "slate", 17, 68.0, 44.0)
		qb.pressed.connect(func() -> void:
			item_qty = qv
			refresh_content()
		)
		qty_row.add_child(qb)

	var btn_open_bag := Button.new()
	btn_open_bag.text = "OTWÓRZ PLECAK [I]"
	_style_mini_btn(btn_open_bag, "gold", 17, 210.0, 44.0)
	btn_open_bag.pressed.connect(func() -> void:
		if world != null and world.can_use_gm():
			world.toggle_gm_panel(false)
			if world.rpg_hud != null:
				world.rpg_hud.toggle_character()
	)
	qty_row.add_child(btn_open_bag)

	for item: Dictionary in get_catalog():
		if item_cat != "all" and str(item["cat"]) != item_cat:
			continue
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 12)
		content_vbox.add_child(row)

		var ico_rect := TextureRect.new()
		ico_rect.custom_minimum_size = Vector2(48, 48)
		ico_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		ico_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		if world != null and world.can_use_gm():
			ico_rect.texture = world.load_tex("res://assets/ui/icons/" + str(item["icon"]))
		row.add_child(ico_rect)

		var info_v := VBoxContainer.new()
		info_v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(info_v)

		var nm := Label.new()
		nm.text = "%s  [Poz.%d]" % [str(item["name"]), int(item.get("minLevel", 1))]
		nm.add_theme_font_override("font", MapStyle.body_font())
		nm.add_theme_font_size_override("font_size", 19)
		nm.add_theme_color_override("font_color", item["rarity"] as Color)
		info_v.add_child(nm)

		var ds := Label.new()
		ds.text = str(item["desc"])
		ds.add_theme_font_override("font", MapStyle.body_font())
		ds.add_theme_font_size_override("font_size", 16)
		ds.add_theme_color_override("font_color", Color(0.84, 0.82, 0.78))
		info_v.add_child(ds)

		var btn_add := Button.new()
		btn_add.text = "+ STWÓRZ ×%d" % item_qty
		_style_mini_btn(btn_add, "plus", 17, 178.0, 48.0)
		var item_id := str(item["id"])
		btn_add.pressed.connect(func() -> void:
			_send_gm_action("give_item", {"itemId": item_id, "qty": item_qty})
		)
		row.add_child(btn_add)

func _gm_card(title: String) -> VBoxContainer:
	var card := PanelContainer.new()
	card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	card.add_theme_stylebox_override("panel", ForgedUI.inset_card(Color(0.76, 0.58, 0.28, 0.72), Color(0.055, 0.050, 0.082, 0.94), 16, 12))
	content_vbox.add_child(card)
	var vb := VBoxContainer.new()
	vb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	vb.add_theme_constant_override("separation", 10)
	card.add_child(vb)
	vb.add_child(_section_label(title))
	return vb

func _build_stats_tab() -> void:
	var hud_ref = world.rpg_hud if world != null else null
	if hud_ref == null:
		return

	# Card 1: Level, Gold, Free Stat Points & Skill Points (Full +/- / Reset / Max)
	var res_vb := _gm_card("POZIOM, ZŁOTO I PUNKTY — PEŁNA KONTROLA (+ / − / RESET)")

	var resource_rows := [
		{
			"label": "Poziom bohatera: %d" % int(hud_ref.hero_level),
			"btns": [
				["Poz.1", "slate", func() -> void: _send_gm_action("set_level", {"value": 1})],
				["−5", "minus", func() -> void: _send_gm_action("set_level", {"value": int(hud_ref.hero_level) + (-5)})],
				["−1", "minus", func() -> void: _send_gm_action("set_level", {"value": int(hud_ref.hero_level) + (-1)})],
				["+1", "plus", func() -> void: _send_gm_action("set_level", {"value": int(hud_ref.hero_level) + (1)})],
				["+5", "plus", func() -> void: _send_gm_action("set_level", {"value": int(hud_ref.hero_level) + (5)})],
				["Poz.20", "gold", func() -> void: _send_gm_action("set_level", {"value": 20})],
			],
		},
		{
			"label": "Złoto: %d szt." % int(hud_ref.hero_gold),
			"btns": [
				["= 0", "slate", func() -> void: _send_gm_action("set_gold", {"value": 0})],
				["−1k", "minus", func() -> void: _send_gm_action("add_gold", {"value": -1000})],
				["−100", "minus", func() -> void: _send_gm_action("add_gold", {"value": -100})],
				["+100", "plus", func() -> void: _send_gm_action("add_gold", {"value": 100})],
				["+1k", "plus", func() -> void: _send_gm_action("add_gold", {"value": 1000})],
				["+10k", "gold", func() -> void: _send_gm_action("add_gold", {"value": 10000})],
			],
		},
		{
			"label": "Wolne pkt statystyk: %d" % int(hud_ref.free_stat_points),
			"btns": [
				["= 0", "slate", func() -> void: _send_gm_action("set_stat_points", {"value": 0})],
				["−10", "minus", func() -> void: _send_gm_action("add_stat_points", {"value": -10})],
				["−1", "minus", func() -> void: _send_gm_action("add_stat_points", {"value": -1})],
				["+1", "plus", func() -> void: _send_gm_action("add_stat_points", {"value": 1})],
				["+10", "plus", func() -> void: _send_gm_action("add_stat_points", {"value": 10})],
				["+50", "gold", func() -> void: _send_gm_action("add_stat_points", {"value": 50})],
			],
		},
		{
			"label": "Pkt umiejętności: %d" % int(hud_ref.skill_points),
			"btns": [
				["= 0", "slate", func() -> void: _send_gm_action("set_skill_points", {"value": 0})],
				["−5", "minus", func() -> void: _send_gm_action("add_skill_points", {"value": -5})],
				["−1", "minus", func() -> void: _send_gm_action("add_skill_points", {"value": -1})],
				["+1", "plus", func() -> void: _send_gm_action("add_skill_points", {"value": 1})],
				["+5", "plus", func() -> void: _send_gm_action("add_skill_points", {"value": 5})],
				["+20", "gold", func() -> void: _send_gm_action("add_skill_points", {"value": 20})],
			],
		},
	]
	for rr: Dictionary in resource_rows:
		var row := HBoxContainer.new()
		row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_theme_constant_override("separation", 8)
		res_vb.add_child(row)

		var lbl := Label.new()
		lbl.text = str(rr["label"])
		lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		lbl.clip_text = true
		lbl.add_theme_font_override("font", MapStyle.body_font())
		lbl.add_theme_font_size_override("font_size", 18)
		lbl.add_theme_color_override("font_color", Color(0.98, 0.93, 0.78))
		row.add_child(lbl)

		for bdef: Array in rr["btns"]:
			var b := Button.new()
			b.text = str(bdef[0])
			_style_mini_btn(b, str(bdef[1]), 16, 68.0, 44.0)
			var cb: Callable = bdef[2]
			b.pressed.connect(cb)
			row.add_child(b)

	# Card 2: Server-persisted attribute bonuses
	var attr_vb := _gm_card("ATRYBUTY BOHATERA — OD 0 DO 500 PKT PREMII")
	var stat_defs := [
		["hp", "Witalność (HP)", "hud-hp.webp", int(round(hud_ref.hero_max_hp)), "±25/pkt"],
		["ki", "Energia Ki", "hud-ki.webp", int(round(hud_ref.hero_max_ki)), "±15/pkt"],
		["atk", "Siła / Atak", "hud-combat.webp", hud_ref.get_total_attack(), "±5/pkt"],
		["def", "Obrona", "hud-shield.webp", hud_ref.get_total_defense(), "±4/pkt"],
		["spd", "Szybkość ruchu", "gear-boots.webp", hud_ref.get_total_speed(), "±15/pkt"],
		["crit", "Szansa Kryt.", "emblem_slash.webp", int(round(hud_ref.get_total_crit())), "±2%/pkt"],
	]
	for sd: Array in stat_defs:
		var skey := str(sd[0])
		var gm_bonus := int(hud_ref.bonus_stat_pts.get(skey, 0))
		var row := HBoxContainer.new()
		row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_theme_constant_override("separation", 8)
		attr_vb.add_child(row)

		var ico := TextureRect.new()
		ico.custom_minimum_size = Vector2(30, 30)
		ico.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		ico.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		if world != null and world.can_use_gm():
			ico.texture = world.load_tex("res://assets/ui/icons/" + str(sd[2]))
		row.add_child(ico)

		var sl := Label.new()
		var suffix := "%" if skey == "crit" else ""
		sl.text = "%s: %d%s  (GM: %+d • %s)" % [str(sd[1]), int(sd[3]), suffix, gm_bonus, str(sd[4])]
		sl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		sl.clip_text = true
		sl.add_theme_font_override("font", MapStyle.body_font())
		sl.add_theme_font_size_override("font_size", 18)
		sl.add_theme_color_override("font_color", Color(0.96, 0.92, 0.84))
		row.add_child(sl)

		for delta_def: Array in [[-10, "−10", "minus"], [-1, "−1", "minus"], [1, "+1", "plus"], [10, "+10", "plus"]]:
			var dv: int = int(delta_def[0])
			var db := Button.new()
			db.text = str(delta_def[1])
			_style_mini_btn(db, str(delta_def[2]), 16, 62.0, 44.0)
			db.pressed.connect(func() -> void:
				_send_gm_action("add_attribute", {"stat": skey, "value": dv})
			)
			row.add_child(db)

		var btn_zero := Button.new()
		btn_zero.text = "↺0"
		_style_mini_btn(btn_zero, "slate", 16, 52.0, 44.0)
		btn_zero.pressed.connect(func() -> void:
			_send_gm_action("set_attribute", {"stat": skey, "value": 0})
		)
		row.add_child(btn_zero)

	# Card 3: Instant GM Utility Actions (HP/KI, Cooldowns, Talents, Full Reset)
	var util_vb := _gm_card("AKCJE NATYCHMIASTOWE GM (HP/KI, TALENTY, COOLDOWNY, RESET)")

	var u_row1 := HBoxContainer.new()
	u_row1.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	u_row1.add_theme_constant_override("separation", 10)
	util_vb.add_child(u_row1)

	var actions_1 := [
		["♥ 100% HP / KI", "plus", func() -> void: _send_gm_action("full_heal")],
		["☠ 1 HP (Test śmierci)", "minus", func() -> void: _send_gm_action("set_test_hp")],
		["⏱ Reset Cooldownów", "cyan", func() -> void: _reset_skill_cooldowns(hud_ref)],
		["⚡ Forma KI (20s)", "gold", func() -> void: _gm_preview_ki_mode()],
	]
	for ad: Array in actions_1:
		var ab := Button.new()
		ab.text = str(ad[0])
		ab.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_style_mini_btn(ab, str(ad[1]), 17, 0.0, 48.0)
		var cb: Callable = ad[2]
		ab.pressed.connect(cb)
		u_row1.add_child(ab)

	var u_row2 := HBoxContainer.new()
	u_row2.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	u_row2.add_theme_constant_override("separation", 10)
	util_vb.add_child(u_row2)

	var actions_2 := [
		["✦ Odblokuj Wszystkie Talenty", "gold", func() -> void: _send_gm_action("unlock_talents")],
		["↺ Resetuj Talenty", "minus", func() -> void: _send_gm_action("reset_talents")],
		["↺ Reset Statów GM", "slate", func() -> void: _send_gm_action("reset_attributes")],
	]
	for ad: Array in actions_2:
		var ab := Button.new()
		ab.text = str(ad[0])
		ab.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_style_mini_btn(ab, str(ad[1]), 17, 0.0, 48.0)
		var cb: Callable = ad[2]
		ab.pressed.connect(cb)
		u_row2.add_child(ab)

func _gm_preview_ki_mode() -> void:
	if world != null and world.can_use_gm():
		world.activate_ki_mode_gm(20.0)
		_set_status("Aktywowano podgląd Formy KI + Aury (20s, GM)")

func _reset_skill_cooldowns(hud_ref: Control) -> void:
	if world != null and world.can_use_gm():
		hud_ref.reset_cooldowns_gm()
		_set_status("Zresetowano czasy odnowienia umiejętności.")
