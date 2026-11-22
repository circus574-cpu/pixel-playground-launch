extends Control
## Upgraded Studio-Grade GM Panel for KI Legends (Android + Desktop).
## Features:
## 1. Tap-on-Map Teleport (2D Atlas + Minimap) & Quick Teleport to all 4 Capitals / Regional Strongholds.
## 2. Super-Speed multiplier (1x / 2x / 4x / 8x) + Noclip toggle.
## 3. Categorized Item Creator with scrollable list -> creates items directly into hero's backpack ([I]).
## 4. Live In-Game Stat Points & Attribute Editor (HP, KI, ATK, DEF, SPD, CRIT, Level, Gold, Skill Points).

const MapStyle := preload("res://scripts/map_style.gd")
const ForgedUI := preload("res://scripts/forged_ui.gd")

const ITEM_CATALOG: Array[Dictionary] = [
	{"id": "sword_superior", "name": "Ostrze Superior", "cat": "weapon", "icon": "gear-sword.webp", "slot": 2, "desc": "+28 Atak • +4% Kryt", "rarity": Color(1.0, 0.76, 0.28), "atk": 28, "crit": 4.0},
	{"id": "blade_pyra", "name": "Obsydianowy Miecz Żaru", "cat": "weapon", "icon": "emblem_swords.webp", "slot": 2, "desc": "+42 Atak • Ogień Pyry", "rarity": Color(1.0, 0.46, 0.24), "atk": 42, "crit": 5.0},
	{"id": "staff_aether", "name": "Kostur Tysiąca Źródeł", "cat": "weapon", "icon": "emblem_crystal.webp", "slot": 2, "desc": "+30 Atak • +45 KI", "rarity": Color(0.46, 0.88, 1.0), "atk": 30, "ki": 45},
	{"id": "blade_nexus", "name": "Klinga Plazmowa MK-IX", "cat": "weapon", "icon": "emblem_slash.webp", "slot": 2, "desc": "+38 Atak • +8% Kryt", "rarity": Color(0.24, 0.96, 0.98), "atk": 38, "crit": 8.0},
	{"id": "helm_pyra", "name": "Hełm Żaru Cytadeli", "cat": "armor", "icon": "gear-helmet.webp", "slot": 0, "desc": "+16 Obrona • +60 HP", "rarity": Color(0.38, 0.74, 1.0), "def": 16, "hp": 60},
	{"id": "helm_aether", "name": "Korona Lodowego Mędrca", "cat": "armor", "icon": "gear-helmet.webp", "slot": 0, "desc": "+24 Obrona • +75 KI", "rarity": Color(0.46, 0.88, 1.0), "def": 24, "ki": 75},
	{"id": "vest_guardian", "name": "Kirys Strażnika Gaju", "cat": "armor", "icon": "gear-vest.webp", "slot": 4, "desc": "+26 Obrona • +120 HP", "rarity": Color(0.36, 0.88, 0.52), "def": 26, "hp": 120},
	{"id": "shield_basalt", "name": "Tarcza Bazaltowej Grani", "cat": "armor", "icon": "gear-shield.webp", "slot": 5, "desc": "+32 Obrona • +90 HP", "rarity": Color(0.76, 0.46, 1.0), "def": 32, "hp": 90},
	{"id": "gloves_clan", "name": "Rękawice Mistrza Ki", "cat": "armor", "icon": "gear-gloves.webp", "slot": 3, "desc": "+14 Atak • +12 Obrona", "rarity": Color(0.38, 0.74, 1.0), "atk": 14, "def": 12},
	{"id": "boots_wind", "name": "Buty Wichru Superior", "cat": "jewelry", "icon": "gear-boots.webp", "slot": 7, "desc": "+35 Szybkość • +10 Obrona", "rarity": Color(0.36, 0.88, 0.52), "spd": 35, "def": 10},
	{"id": "amulet_ki", "name": "Amulet Czystego Ki", "cat": "jewelry", "icon": "gear-amulet.webp", "slot": 1, "desc": "+65 KI • +5% Kryt", "rarity": Color(0.76, 0.46, 1.0), "ki": 65, "crit": 5.0},
	{"id": "ring_aether", "name": "Pierścień Eteru", "cat": "jewelry", "icon": "gear-ring.webp", "slot": 6, "desc": "+18 Atak • +35 KI", "rarity": Color(0.76, 0.46, 1.0), "atk": 18, "ki": 35},
	{"id": "ring_titan", "name": "Sygnet Tytana", "cat": "jewelry", "icon": "emblem_shield.webp", "slot": 6, "desc": "+140 HP • +22 Obrona", "rarity": Color(1.0, 0.76, 0.28), "hp": 140, "def": 22},
	{"id": "potion_hp", "name": "Wielki Eliksir Życia", "cat": "consumable", "icon": "gear-potion.webp", "slot": -1, "desc": "Przywraca +150 HP", "rarity": Color(0.95, 0.34, 0.32), "heal_hp": 150},
	{"id": "potion_ki", "name": "Eliksir Energii Ki", "cat": "consumable", "icon": "emblem_potion.webp", "slot": -1, "desc": "Przywraca +80 KI", "rarity": Color(0.34, 0.78, 1.0), "heal_ki": 80},
	{"id": "scroll_tp", "name": "Zwój Powrotu do Stolicy", "cat": "consumable", "icon": "emblem_scroll.webp", "slot": -1, "desc": "Natychmiastowy powrót", "rarity": Color(0.96, 0.84, 0.44)},
	{"id": "crystal_ki", "name": "Kryształ Skupienia Ki", "cat": "consumable", "icon": "emblem_crystal.webp", "slot": -1, "desc": "Surowiec alchemiczny", "rarity": Color(0.46, 0.88, 1.0)},
	{"id": "tusk_beast", "name": "Kieł Płomiennego Wilka", "cat": "consumable", "icon": "gear-tusk.webp", "slot": -1, "desc": "Trofeum rzemieślnicze", "rarity": Color(0.86, 0.68, 0.44)},
	{"id": "pouch_gold", "name": "Sakiewka Złota (+500)", "cat": "consumable", "icon": "gear-coin.webp", "slot": -1, "desc": "Dodaje 500 złota", "rarity": Color(1.0, 0.86, 0.32), "gold": 500},
]

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

var _opened_msec := 0

func _build_ui() -> void:
	var bg_dim := ColorRect.new()
	bg_dim.color = Color(0.015, 0.012, 0.025, 0.74)
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

	panel_box.add_theme_stylebox_override("panel", ForgedUI.panel_box(28.0, 22.0))
	add_child(panel_box)

	var root_v := VBoxContainer.new()
	root_v.add_theme_constant_override("separation", 10)
	panel_box.add_child(root_v)

	# Consistent Forged Header Bar with "← WSTECZ"
	root_v.add_child(ForgedUI.make_header_bar("PANEL GM — NARZĘDZIA ADMINISTRATORA", func() -> void:
		if world != null and world.has_method("toggle_gm_panel"):
			world.toggle_gm_panel(false)
	, "← WSTECZ", "Teleportacja, przedmioty i testy balansu"))

	# Tabs Row
	var tabs_row := HBoxContainer.new()
	tabs_row.add_theme_constant_override("separation", 8)
	root_v.add_child(tabs_row)
	var tab_defs := [
		["teleport", "⚡ TELEPORT & SZYBKOŚĆ"],
		["items", "🎒 TWORZENIE PRZEDMIOTÓW"],
		["stats", "📊 PUNKTY STATYSTYK"],
	]
	for td: Array in tab_defs:
		var tb := Button.new()
		tb.text = str(td[1])
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
	content_vbox.add_theme_constant_override("separation", 10)
	content_scroll.add_child(content_vbox)

	# Status Footer
	status_lbl.add_theme_font_override("font", MapStyle.body_font())
	status_lbl.add_theme_font_size_override("font_size", 13)
	status_lbl.add_theme_color_override("font_color", Color(0.56, 0.96, 0.72))
	status_lbl.text = status_text
	root_v.add_child(status_lbl)

func _layout_panel() -> void:
	var vs := get_viewport_rect().size
	if vs.x < 100.0:
		vs = Vector2(1280.0, 720.0)
	var pw := clampf(vs.x - 120.0, 560.0, 820.0)
	var ph := clampf(vs.y - 84.0, 440.0, 620.0)
	panel_box.position = Vector2((vs.x - pw) * 0.5, (vs.y - ph) * 0.5)
	panel_box.size = Vector2(pw, ph)

func _set_status(msg: String) -> void:
	status_text = msg
	status_lbl.text = msg

func _section_label(txt: String) -> Label:
	var l := Label.new()
	l.text = txt
	l.add_theme_font_override("font", MapStyle.font())
	l.add_theme_font_size_override("font_size", 13)
	l.add_theme_color_override("font_color", Color(1.0, 0.86, 0.48))
	return l

func refresh_content() -> void:
	_opened_msec = Time.get_ticks_msec()
	for tid in tab_btns.keys():
		var tb: Button = tab_btns[tid]
		if str(tid) == active_tab:
			_style_btn(tb, Color(0.28, 0.20, 0.08, 0.98), Color(1.0, 0.84, 0.36, 1.0), 13)
		else:
			_style_btn(tb, Color(0.11, 0.09, 0.13, 0.94), Color(0.46, 0.38, 0.26, 0.80), 13)

	for ch in content_vbox.get_children():
		ch.queue_free()

	if active_tab == "teleport":
		_build_teleport_tab()
	elif active_tab == "items":
		_build_items_tab()
	else:
		_build_stats_tab()
	status_lbl.text = status_text

func _build_teleport_tab() -> void:
	content_vbox.add_child(_section_label("1. TELEPORT NA DUŻEJ MAPIE ŚWIATA"))
	var map_row := HBoxContainer.new()
	map_row.add_theme_constant_override("separation", 8)
	content_vbox.add_child(map_row)

	var btn_map_tp := Button.new()
	btn_map_tp.text = "⚡ OTWÓRZ DUŻĄ MAPĘ ŚWIATA I KLIKNIJ PUNKT TELEPORTU"
	btn_map_tp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_style_btn(btn_map_tp, Color(0.10, 0.28, 0.34, 0.96), Color(0.36, 0.92, 1.0, 0.98), 14)
	btn_map_tp.pressed.connect(func() -> void:
		if world != null:
			world.gm_map_teleport_mode = true
			world.toggle_gm_panel(false)
			if world.atlas_overlay != null:
				world.atlas_overlay.focus_atlas_continent(str(world.current_land), 2.8)
			world.toggle_atlas(true)
	)
	map_row.add_child(btn_map_tp)

	content_vbox.add_child(_section_label("2. SUPER SZYBKOŚĆ I PRZENIKANIE (NOCLIP)"))
	var spd_row := HBoxContainer.new()
	spd_row.add_theme_constant_override("separation", 8)
	content_vbox.add_child(spd_row)
	var cur_spd: float = float(world.gm_speed_mult) if world != null else 1.0
	for mult_def: Array in [[1.0, "1× Normalna"], [2.0, "2× Szybka"], [4.0, "4× Super"], [8.0, "8× Błyskawica"]]:
		var mv: float = float(mult_def[0])
		var sb := Button.new()
		sb.text = str(mult_def[1])
		sb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var is_sel := absf(cur_spd - mv) < 0.1
		_style_btn(
			sb,
			Color(0.32, 0.22, 0.06, 0.98) if is_sel else Color(0.12, 0.10, 0.14, 0.94),
			Color(1.0, 0.84, 0.36, 1.0) if is_sel else Color(0.55, 0.45, 0.30, 0.85),
			13
		)
		sb.pressed.connect(func() -> void:
			if world != null:
				world.gm_speed_mult = mv
				_set_status("Ustawiono szybkość ruchu GM: %.0f×" % mv)
				refresh_content()
		)
		spd_row.add_child(sb)

	var noclip_on: bool = world != null and bool(world.gm_noclip)
	var btn_nc := Button.new()
	btn_nc.text = "PRZENIKANIE (NOCLIP — OMIJANIE WODY/GÓR): %s" % ("WŁĄCZONE ✓" if noclip_on else "WYŁĄCZONE")
	_style_btn(
		btn_nc,
		Color(0.24, 0.12, 0.34, 0.96) if noclip_on else Color(0.12, 0.10, 0.14, 0.94),
		Color(0.80, 0.56, 1.0, 0.96) if noclip_on else Color(0.55, 0.45, 0.30, 0.85),
		13
	)
	btn_nc.pressed.connect(func() -> void:
		if world != null:
			world.gm_noclip = not world.gm_noclip
			_set_status("Przenikanie (Noclip): %s" % ("WŁĄCZONE" if world.gm_noclip else "WYŁĄCZONE"))
			refresh_content()
	)
	content_vbox.add_child(btn_nc)

	content_vbox.add_child(_section_label("3. SZYBKI TELEPORT — STOLICE 4 KONTYNENTÓW"))
	var cap_row := HBoxContainer.new()
	cap_row.add_theme_constant_override("separation", 8)
	content_vbox.add_child(cap_row)
	for land_def: Array in [["pyra", "Pyra"], ["verdant", "Verdantia"], ["aether", "Aetheria"], ["nexus", "Nexus-9"]]:
		var lid := str(land_def[0])
		var cb := Button.new()
		cb.text = str(land_def[1])
		cb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_style_btn(cb, Color(0.14, 0.11, 0.16, 0.95), Color(0.84, 0.66, 0.34, 0.90), 13)
		cb.pressed.connect(func() -> void:
			if world != null:
				world.switch_region(lid)
				world.toggle_gm_panel(false)
		)
		cap_row.add_child(cb)

	if world != null:
		content_vbox.add_child(_section_label("4. WAROWNIE I MIASTA NA BIEŻĄCYM KONTYNENCIE"))
		var grid := GridContainer.new()
		grid.columns = 2
		grid.add_theme_constant_override("h_separation", 8)
		grid.add_theme_constant_override("v_separation", 6)
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
			_style_btn(tb, Color(0.11, 0.13, 0.18, 0.94), Color(0.54, 0.72, 0.92, 0.85), 12)
			tb.pressed.connect(func() -> void:
				if world != null:
					world.teleport_to_world_pos(str(world.current_land), tx, tz)
					world.toggle_gm_panel(false)
			)
			grid.add_child(tb)

func _build_items_tab() -> void:
	content_vbox.add_child(_section_label("WYBIERZ PRZEDMIOT Z LISTY I STWÓRZ DO PLECAKA [I]"))

	var filter_row := HBoxContainer.new()
	filter_row.add_theme_constant_override("separation", 6)
	content_vbox.add_child(filter_row)
	for cat_def: Array in [["all", "Wszystkie"], ["weapon", "Broń"], ["armor", "Pancerz"], ["jewelry", "Biżuteria"], ["consumable", "Użytkowe"]]:
		var cid := str(cat_def[0])
		var fb := Button.new()
		fb.text = str(cat_def[1])
		fb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var is_sel := item_cat == cid
		_style_btn(
			fb,
			Color(0.28, 0.20, 0.08, 0.98) if is_sel else Color(0.11, 0.10, 0.14, 0.94),
			Color(1.0, 0.84, 0.36, 1.0) if is_sel else Color(0.46, 0.40, 0.30, 0.82),
			12
		)
		fb.pressed.connect(func() -> void:
			item_cat = cid
			refresh_content()
		)
		filter_row.add_child(fb)

	var qty_row := HBoxContainer.new()
	qty_row.add_theme_constant_override("separation", 8)
	content_vbox.add_child(qty_row)
	var ql := Label.new()
	ql.text = "Ilość przy tworzeniu:"
	ql.add_theme_font_override("font", MapStyle.body_font())
	ql.add_theme_font_size_override("font_size", 13)
	ql.add_theme_color_override("font_color", Color(0.92, 0.88, 0.78))
	qty_row.add_child(ql)
	for qv: int in [1, 5, 10]:
		var qb := Button.new()
		qb.text = "×%d" % qv
		var is_q := item_qty == qv
		_style_btn(
			qb,
			Color(0.14, 0.30, 0.20, 0.96) if is_q else Color(0.12, 0.10, 0.14, 0.94),
			Color(0.46, 0.96, 0.62, 0.96) if is_q else Color(0.46, 0.40, 0.30, 0.82),
			12
		)
		qb.pressed.connect(func() -> void:
			item_qty = qv
			refresh_content()
		)
		qty_row.add_child(qb)

	var btn_open_bag := Button.new()
	btn_open_bag.text = "OTWÓRZ PLECAK [I]"
	_style_btn(btn_open_bag, Color(0.18, 0.14, 0.08, 0.96), Color(0.92, 0.74, 0.36, 0.95), 12)
	btn_open_bag.pressed.connect(func() -> void:
		if world != null:
			world.toggle_gm_panel(false)
			if world.rpg_hud != null:
				world.rpg_hud.toggle_character()
	)
	qty_row.add_child(btn_open_bag)

	for item: Dictionary in ITEM_CATALOG:
		if item_cat != "all" and str(item["cat"]) != item_cat:
			continue
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 10)
		content_vbox.add_child(row)

		var ico_rect := TextureRect.new()
		ico_rect.custom_minimum_size = Vector2(36, 36)
		ico_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		ico_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		if world != null:
			ico_rect.texture = world.load_tex("res://assets/ui/icons/" + str(item["icon"]))
		row.add_child(ico_rect)

		var info_v := VBoxContainer.new()
		info_v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(info_v)

		var nm := Label.new()
		nm.text = str(item["name"])
		nm.add_theme_font_override("font", MapStyle.body_font())
		nm.add_theme_font_size_override("font_size", 14)
		nm.add_theme_color_override("font_color", item["rarity"] as Color)
		info_v.add_child(nm)

		var ds := Label.new()
		ds.text = str(item["desc"])
		ds.add_theme_font_override("font", MapStyle.body_font())
		ds.add_theme_font_size_override("font_size", 11)
		ds.add_theme_color_override("font_color", Color(0.80, 0.78, 0.72))
		info_v.add_child(ds)

		var btn_add := Button.new()
		btn_add.text = "+ STWÓRZ ×%d" % item_qty
		_style_btn(btn_add, Color(0.12, 0.28, 0.16, 0.96), Color(0.42, 0.92, 0.56, 0.95), 12)
		var it_copy := item.duplicate(true)
		btn_add.pressed.connect(func() -> void:
			if world != null and world.rpg_hud != null:
				var ok: bool = world.rpg_hud.add_item_to_backpack(it_copy, item_qty)
				if ok:
					_set_status("Stworzono do plecaka: %s ×%d" % [str(it_copy["name"]), item_qty])
				else:
					_set_status("Plecak jest pełny (15/15 slotów)! Kliknij przedmiot w [I], aby użyć/założyć.")
		)
		row.add_child(btn_add)

func _build_stats_tab() -> void:
	var hud_ref = world.rpg_hud if world != null else null
	if hud_ref == null:
		return

	content_vbox.add_child(_section_label("PUNKTY STATYSTYK, POZIOM I ZASOBY BOHATERA"))

	var sum_lbl := Label.new()
	sum_lbl.text = "Poziom: %d  •  Wolne pkt statystyk: %d  •  Pkt umiejętności: %d  •  Złoto: %d" % [
		int(hud_ref.hero_level), int(hud_ref.free_stat_points), int(hud_ref.skill_points), int(hud_ref.hero_gold)
	]
	sum_lbl.add_theme_font_override("font", MapStyle.body_font())
	sum_lbl.add_theme_font_size_override("font_size", 14)
	sum_lbl.add_theme_color_override("font_color", Color(0.98, 0.92, 0.72))
	content_vbox.add_child(sum_lbl)

	var quick_row := HBoxContainer.new()
	quick_row.add_theme_constant_override("separation", 6)
	content_vbox.add_child(quick_row)

	var quick_defs := [
		["+5 Pkt Statystyk", "stat5"],
		["+5 Pkt Umiejęt.", "skill5"],
		["+1 Poziom", "lvl1"],
		["+1000 Złota", "gold1000"],
		["Pełne HP/KI", "heal"],
	]
	for qa: Array in quick_defs:
		var qb := Button.new()
		qb.text = str(qa[0])
		qb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_style_btn(qb, Color(0.22, 0.16, 0.08, 0.96), Color(0.92, 0.72, 0.34, 0.92), 12)
		var act := str(qa[1])
		qb.pressed.connect(func() -> void: _apply_quick_stat(act))
		quick_row.add_child(qb)

	content_vbox.add_child(_section_label("BEZPOŚREDNIE ROZDAWANIE ATRYBUTÓW (DZIAŁA NA ŻYWO W GRZE I W [I])"))
	var stat_defs := [
		["hp", "Witalność (+25 Maks. HP / pkt)", "hud-hp.webp", int(round(hud_ref.hero_max_hp))],
		["ki", "Energia Ki (+15 Maks. KI / pkt)", "hud-ki.webp", int(round(hud_ref.hero_max_ki))],
		["atk", "Siła / Atak (+5 Ataku / pkt)", "hud-combat.webp", hud_ref.get_total_attack()],
		["def", "Obrona (+4 Obrony / pkt)", "hud-shield.webp", hud_ref.get_total_defense()],
		["spd", "Szybkość (+15 j. ruchu / pkt)", "gear-boots.webp", hud_ref.get_total_speed()],
		["crit", "Szansa Krytyczna (+2% / pkt)", "emblem_slash.webp", int(round(hud_ref.get_total_crit()))],
	]
	for sd: Array in stat_defs:
		var skey := str(sd[0])
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 8)
		content_vbox.add_child(row)

		var ico := TextureRect.new()
		ico.custom_minimum_size = Vector2(26, 26)
		ico.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		ico.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		if world != null:
			ico.texture = world.load_tex("res://assets/ui/icons/" + str(sd[2]))
		row.add_child(ico)

		var sl := Label.new()
		var suffix := "%" if skey == "crit" else ""
		sl.text = "%s  →  Aktualnie: %d%s" % [str(sd[1]), int(sd[3]), suffix]
		sl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		sl.add_theme_font_override("font", MapStyle.body_font())
		sl.add_theme_font_size_override("font_size", 13)
		sl.add_theme_color_override("font_color", Color(0.94, 0.90, 0.82))
		row.add_child(sl)

		for delta_def: Array in [[1, "+1"], [5, "+5"], [-1, "-1"]]:
			var dv: int = int(delta_def[0])
			var db := Button.new()
			db.text = str(delta_def[1])
			db.custom_minimum_size = Vector2(48, 30)
			var col_bg := Color(0.12, 0.28, 0.16, 0.96) if dv > 0 else Color(0.28, 0.12, 0.12, 0.94)
			var col_bd := Color(0.42, 0.92, 0.56, 0.95) if dv > 0 else Color(0.90, 0.44, 0.40, 0.90)
			_style_btn(db, col_bg, col_bd, 12)
			db.pressed.connect(func() -> void:
				hud_ref.add_stat_points_gm(skey, dv)
				_set_status("Zmieniono atrybut %s o %+d pkt!" % [skey.to_upper(), dv])
				refresh_content()
			)
			row.add_child(db)

func _apply_quick_stat(act: String) -> void:
	var hud_ref = world.rpg_hud if world != null else null
	if hud_ref == null:
		return
	match act:
		"stat5":
			hud_ref.free_stat_points += 5
			hud_ref.recalc_stats()
			_set_status("Dodano +5 wolnych punktów statystyk (łącznie: %d)" % int(hud_ref.free_stat_points))
		"skill5":
			hud_ref.skill_points += 5
			hud_ref.recalc_stats()
			_set_status("Dodano +5 punktów umiejętności (łącznie: %d)" % int(hud_ref.skill_points))
		"lvl1":
			hud_ref.hero_level += 1
			hud_ref.free_stat_points += 3
			hud_ref.skill_points += 1
			hud_ref.recalc_stats(true)
			_set_status("Awansowano na Poziom %d (+3 pkt statystyk, +1 pkt umiejętności)!" % int(hud_ref.hero_level))
		"gold1000":
			hud_ref.hero_gold += 1000
			hud_ref.recalc_stats()
			_set_status("Dodano +1000 złota (łącznie: %d)" % int(hud_ref.hero_gold))
		"heal":
			hud_ref.hero_hp = hud_ref.hero_max_hp
			hud_ref.hero_ki = hud_ref.hero_max_ki
			hud_ref.recalc_stats()
			_set_status("Przywrócono 100% HP i KI!")
	refresh_content()
