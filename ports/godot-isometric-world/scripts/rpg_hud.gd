extends Control
## Etap 4 — Premium Action-RPG HUD for KI Legends:
## 1. Ornate Top-Left Hero Portrait & Resource Frame (HP, KI, Racial Resource, Coins, Level, Safe/Wild badge)
##    + Compact Continent Quick-Travel & Telemetry Strip.
## 2. Bottom-Center Premium RPG Action Dock with XP Progress Bar, 6 Racial Ability Slots (cooldown animations),
##    and quick access pills ([K] Drzewko 29 Węzłów, [I] Postać/Ekwipunek, [T] Pora Dnia, [Tab] Mapa, [G] Globus).
## 3. Interactive 29-Node Racial Talent Tree Overlay ([K]) & Character/Equipment Overlay ([I]).

const MapStyle := preload("res://scripts/map_style.gd")

const RACE_CONFIG := {
	"pyra": {
		"hero": "Ignis",
		"race": "Legendy",
		"res_name": "Żar",
		"res_col": Color(1.0, 0.48, 0.14),
		"accent": Color(1.0, 0.54, 0.22),
		"hp": 140,
		"ki": 40,
		"skills": [
			{"key": "Q", "name": "Cięcie Żaru", "col": Color(0.95, 0.34, 0.16), "cd": 1.2},
			{"key": "1", "name": "Fala Popiołu", "col": Color(1.0, 0.52, 0.14), "cd": 4.0},
			{"key": "2", "name": "Tarcza Bazaltu", "col": Color(0.84, 0.56, 0.28), "cd": 7.0},
			{"key": "3", "name": "Furia Wulkanu", "col": Color(1.0, 0.24, 0.12), "cd": 10.0},
			{"key": "4", "name": "Gniew Legendy", "col": Color(1.0, 0.78, 0.24), "cd": 16.0},
			{"key": "SPC", "name": "Unik", "col": Color(0.32, 0.72, 0.96), "cd": 2.5},
		],
	},
	"verdant": {
		"hero": "Sylvan",
		"race": "Planetarni",
		"res_name": "Nurt",
		"res_col": Color(0.30, 0.90, 0.52),
		"accent": Color(0.38, 0.92, 0.56),
		"hp": 135,
		"ki": 50,
		"skills": [
			{"key": "Q", "name": "Cios Korzenia", "col": Color(0.28, 0.78, 0.42), "cd": 1.2},
			{"key": "1", "name": "Pnącza Gaju", "col": Color(0.36, 0.88, 0.48), "cd": 4.5},
			{"key": "2", "name": "Aegis Natury", "col": Color(0.56, 0.84, 0.34), "cd": 7.5},
			{"key": "3", "name": "Szarża Łowcy", "col": Color(0.22, 0.84, 0.68), "cd": 9.0},
			{"key": "4", "name": "Gniew Lasu", "col": Color(0.92, 0.82, 0.34), "cd": 15.0},
			{"key": "SPC", "name": "Unik", "col": Color(0.32, 0.72, 0.96), "cd": 2.5},
		],
	},
	"aether": {
		"hero": "Aurelius",
		"race": "Mędrcy",
		"res_name": "Skupienie",
		"res_col": Color(0.42, 0.88, 1.0),
		"accent": Color(0.46, 0.88, 1.0),
		"hp": 120,
		"ki": 70,
		"skills": [
			{"key": "Q", "name": "Strzała Ki", "col": Color(0.36, 0.82, 1.0), "cd": 1.1},
			{"key": "1", "name": "Wir Źródeł", "col": Color(0.24, 0.72, 0.96), "cd": 4.0},
			{"key": "2", "name": "Bariera Eteru", "col": Color(0.58, 0.88, 0.98), "cd": 7.0},
			{"key": "3", "name": "Pieczęć Lodu", "col": Color(0.48, 0.68, 1.0), "cd": 9.5},
			{"key": "4", "name": "Harmonia Ki", "col": Color(1.0, 0.86, 0.44), "cd": 16.0},
			{"key": "SPC", "name": "Unik", "col": Color(0.32, 0.72, 0.96), "cd": 2.5},
		],
	},
	"nexus": {
		"hero": "Cypher-9",
		"race": "Androidy",
		"res_name": "Ładunek",
		"res_col": Color(0.18, 0.96, 0.98),
		"accent": Color(0.22, 0.96, 0.98),
		"hp": 150,
		"ki": 55,
		"skills": [
			{"key": "Q", "name": "Impuls Plazmy", "col": Color(0.16, 0.86, 0.98), "cd": 1.0},
			{"key": "1", "name": "Skan Taktyczny", "col": Color(0.28, 0.96, 0.80), "cd": 4.0},
			{"key": "2", "name": "Pole Siłowe", "col": Color(0.36, 0.68, 1.0), "cd": 7.0},
			{"key": "3", "name": "Przeciążenie", "col": Color(0.76, 0.44, 1.0), "cd": 10.0},
			{"key": "4", "name": "Rdzeń Alfa", "col": Color(1.0, 0.76, 0.24), "cd": 16.0},
			{"key": "SPC", "name": "Unik", "col": Color(0.32, 0.72, 0.96), "cd": 2.5},
		],
	},
}

const TALENT_BRANCHES := [
	{"name": "SZLAK WALKI", "col": Color(1.0, 0.42, 0.26), "nodes": ["Ostrze Ki", "Siła Ciosu", "Pęd Bitewny", "Krytyczny Zryw", "Przebicie Pancerza", "Mistrz Broni", "Szał Tytana", "Apogeum Siły"]},
	{"name": "SZLAK ENERGII KI", "col": Color(0.32, 0.86, 1.0), "nodes": ["Przepływ Ki", "Fala Rezonansu", "Błyskawica", "Skupienie Rdzenia", "Studnia Eteru", "Echo Mocy", "Przeciążenie Ki"]},
	{"name": "SZLAK OCHRONY", "col": Color(0.42, 0.90, 0.54), "nodes": ["Twarda Skóra", "Bariera Ducha", "Odporność", "Regeneracja", "Bastion Woli", "Niezłomny", "Aegis Superior"]},
	{"name": "SZLAK PODRÓŻY", "col": Color(1.0, 0.82, 0.34), "nodes": ["Szybki Krok +5%", "Zmysł Łowcy", "Kowalstwo", "Alchemia", "Targowanie", "Zwiadowca", "Mistrz Świata"]},
]

var world: Node2D
var current_land := "pyra"
var nearest_loc := "Stolica"
var in_safe_city := true
var hero_hp := 140.0
var hero_max_hp := 140.0
var hero_ki := 40.0
var hero_max_ki := 40.0
var hero_res := 36.0
var hero_xp := 165.0
var hero_max_xp := 500.0
var hero_level := 1
var hero_gold := 120
var skill_points := 3
var unlocked_talents: Dictionary = {"0:0": true, "1:0": true, "3:0": true}
var cooldowns: Array[float] = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0]

var show_talents := false
var show_character := false
var nav_row := HBoxContainer.new()
var dock_btns := HBoxContainer.new()
var btn_time := Button.new()

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_PASS
	_build_quick_buttons()
	if get_viewport() != null:
		get_viewport().size_changed.connect(_sync_viewport_size)
	resized.connect(_layout_controls)
	_sync_viewport_size()

func _vp_size() -> Vector2:
	if get_viewport() != null:
		var vs := get_viewport_rect().size
		if vs.x > 10.0 and vs.y > 10.0:
			return vs
	return size

func _sync_viewport_size() -> void:
	_layout_controls()
	queue_redraw()

func _style_pill(btn: Button, accent: Color = Color(0.84, 0.66, 0.36)) -> void:
	var st := StyleBoxFlat.new()
	st.bg_color = Color(0.08, 0.06, 0.06, 0.90)
	st.border_color = Color(accent.r, accent.g, accent.b, 0.82)
	st.set_border_width_all(1)
	st.set_corner_radius_all(6)
	st.content_margin_left = 8
	st.content_margin_right = 8
	st.content_margin_top = 3
	st.content_margin_bottom = 3
	btn.add_theme_stylebox_override("normal", st)
	var st_h := st.duplicate()
	st_h.bg_color = Color(0.18, 0.13, 0.09, 0.96)
	btn.add_theme_stylebox_override("hover", st_h)
	btn.add_theme_color_override("font_color", Color(0.98, 0.92, 0.78))
	btn.add_theme_font_size_override("font_size", 12)

func _build_quick_buttons() -> void:
	nav_row.add_theme_constant_override("separation", 5)
	var lands := [["pyra", "[1] Pyra"], ["verdant", "[2] Verdantia"], ["aether", "[3] Aetheria"], ["nexus", "[4] Nexus-9"]]
	for item: Array in lands:
		var lid := str(item[0])
		var b := Button.new()
		b.text = str(item[1])
		_style_pill(b)
		b.pressed.connect(func() -> void:
			if world != null:
				world.switch_region(lid)
		)
		nav_row.add_child(b)

	var b_cap := Button.new()
	b_cap.text = "[C] Stolica"
	_style_pill(b_cap, Color(0.42, 0.90, 0.56))
	b_cap.pressed.connect(func() -> void:
		if world != null:
			world.teleport_to_capital()
	)
	nav_row.add_child(b_cap)

	var b_exp := Button.new()
	b_exp.text = "[E] Expowiska (6)"
	_style_pill(b_exp, Color(1.0, 0.44, 0.24))
	b_exp.pressed.connect(func() -> void:
		if world != null:
			world.cycle_exp_zone()
	)
	nav_row.add_child(b_exp)

	add_child(nav_row)

	# Compact RPG utility buttons attached to bottom-right of Action Dock
	dock_btns.add_theme_constant_override("separation", 6)
	var b_tal := Button.new()
	b_tal.text = "[K] Drzewko"
	_style_pill(b_tal, Color(1.0, 0.82, 0.34))
	b_tal.pressed.connect(toggle_talents)
	dock_btns.add_child(b_tal)

	var b_inv := Button.new()
	b_inv.text = "[I] Postać"
	_style_pill(b_inv, Color(0.84, 0.72, 0.52))
	b_inv.pressed.connect(toggle_character)
	dock_btns.add_child(b_inv)

	btn_time.text = "[T] Dzień"
	_style_pill(btn_time, Color(0.56, 0.84, 1.0))
	btn_time.pressed.connect(func() -> void:
		if world != null:
			world.cycle_time_of_day()
	)
	dock_btns.add_child(btn_time)

	var b_2d := Button.new()
	b_2d.text = "[Tab] Mapa 2D"
	_style_pill(b_2d)
	b_2d.pressed.connect(func() -> void:
		if world != null:
			if world.atlas_overlay != null:
				world.atlas_overlay.set_mode("atlas")
			world.toggle_atlas(true)
	)
	dock_btns.add_child(b_2d)

	var b_3d := Button.new()
	b_3d.text = "[G] Globus 3D"
	_style_pill(b_3d)
	b_3d.pressed.connect(func() -> void:
		if world != null:
			if world.atlas_overlay != null:
				world.atlas_overlay.set_mode("globe")
			world.toggle_atlas(true)
	)
	dock_btns.add_child(b_3d)

	var b_m3d := Button.new()
	b_m3d.text = "[M] Relief 3D"
	_style_pill(b_m3d)
	b_m3d.pressed.connect(func() -> void:
		if world != null:
			world.toggle_map()
	)
	dock_btns.add_child(b_m3d)

	add_child(dock_btns)

func _layout_controls() -> void:
	var vs := _vp_size()
	nav_row.position = Vector2(14.0, 114.0)
	dock_btns.position = Vector2(maxf(vs.x * 0.5 - 266.0, 16.0), vs.y - 122.0)

func set_region(land: String) -> void:
	current_land = land
	var cfg: Dictionary = RACE_CONFIG.get(land, RACE_CONFIG["pyra"])
	hero_max_hp = float(cfg["hp"])
	hero_hp = hero_max_hp
	hero_max_ki = float(cfg["ki"])
	hero_ki = hero_max_ki
	hero_res = 38.0
	queue_redraw()

func set_time_label(lbl: String) -> void:
	btn_time.text = "[T] %s" % lbl

func sync_status(loc_name: String, safe: bool) -> void:
	nearest_loc = loc_name
	in_safe_city = safe
	queue_redraw()

func trigger_skill(idx: int) -> void:
	if idx < 0 or idx >= cooldowns.size():
		return
	if cooldowns[idx] > 0.0:
		return
	var cfg: Dictionary = RACE_CONFIG.get(current_land, RACE_CONFIG["pyra"])
	var skills: Array = cfg["skills"]
	cooldowns[idx] = float(skills[idx]["cd"])
	hero_ki = maxf(hero_ki - 6.0, 0.0)
	hero_res = minf(hero_res + 14.0, 100.0)
	queue_redraw()

func _sync_modal_bars() -> void:
	var modal_open := show_talents or show_character
	nav_row.visible = not modal_open
	dock_btns.visible = not modal_open

func toggle_talents() -> void:
	show_talents = not show_talents
	if show_talents:
		show_character = false
	_sync_modal_bars()
	queue_redraw()

func toggle_character() -> void:
	show_character = not show_character
	if show_character:
		show_talents = false
	_sync_modal_bars()
	queue_redraw()

func close_modals() -> void:
	show_talents = false
	show_character = false
	_sync_modal_bars()
	queue_redraw()

func _process(delta: float) -> void:
	var dirty := false
	for i in cooldowns.size():
		if cooldowns[i] > 0.0:
			cooldowns[i] = maxf(cooldowns[i] - delta, 0.0)
			dirty = true
	if hero_ki < hero_max_ki:
		hero_ki = minf(hero_ki + delta * 3.5, hero_max_ki)
		dirty = true
	if dirty and visible:
		queue_redraw()

func _gui_input(event: InputEvent) -> void:
	if not (event is InputEventMouseButton and event.pressed):
		return
	var mb: InputEventMouseButton = event
	if mb.button_index != MOUSE_BUTTON_LEFT:
		return
	# Handle clicking skill slots on the bottom dock
	var dock := _dock_rect()
	if dock.has_point(mb.position):
		var start_x := dock.position.x + 14.0
		var sy := dock.position.y + 24.0
		for i in 6:
			var sr := Rect2(start_x + float(i) * 86.0, sy, 78.0, 52.0)
			if sr.has_point(mb.position):
				trigger_skill(i)
				accept_event()
				return
	# Handle clicking talent tree nodes when [K] panel is open
	if show_talents:
		var pr := _modal_rect()
		if not pr.has_point(mb.position):
			close_modals()
			accept_event()
			return
		for b_idx in TALENT_BRANCHES.size():
			var branch: Dictionary = TALENT_BRANCHES[b_idx]
			var nodes: Array = branch["nodes"]
			var col_x := pr.position.x + 30.0 + float(b_idx) * ((pr.size.x - 60.0) / 4.0)
			for n_idx in nodes.size():
				var nr := Rect2(col_x, pr.position.y + 92.0 + float(n_idx) * 48.0, 178.0, 38.0)
				if nr.has_point(mb.position):
					var key := "%d:%d" % [b_idx, n_idx]
					if not unlocked_talents.has(key) and skill_points > 0:
						unlocked_talents[key] = true
						skill_points -= 1
						queue_redraw()
					accept_event()
					return
	elif show_character:
		var cr := _modal_rect()
		if not cr.has_point(mb.position):
			close_modals()
			accept_event()

func _dock_rect() -> Rect2:
	var vs := _vp_size()
	return Rect2(vs.x * 0.5 - 268.0, vs.y - 90.0, 536.0, 82.0)

func _modal_rect() -> Rect2:
	var vs := _vp_size()
	return Rect2(vs.x * 0.5 - 410.0, vs.y * 0.5 - 255.0, 820.0, 500.0)

func _draw_bar(r: Rect2, frac: float, col: Color, bg: Color, txt: String, f: Font) -> void:
	draw_rect(r, bg)
	var fw := maxf(r.size.x * clampf(frac, 0.0, 1.0), 0.0)
	if fw > 1.0:
		draw_rect(Rect2(r.position, Vector2(fw, r.size.y)), col)
		draw_rect(Rect2(r.position, Vector2(fw, r.size.y * 0.38)), Color(1, 1, 1, 0.16))
	draw_rect(r, Color(0.55, 0.44, 0.24, 0.85), false, 1.2)
	draw_string(f, r.position + Vector2(8.0, r.size.y - 3.5), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(1.0, 0.98, 0.94))

func _draw() -> void:
	var f: Font = MapStyle.font()
	var cfg: Dictionary = RACE_CONFIG.get(current_land, RACE_CONFIG["pyra"])
	var accent: Color = cfg["accent"]

	# 1. Ornate Top-Left Hero Portrait & Resource Frame
	var uf := Rect2(14.0, 12.0, 386.0, 96.0)
	draw_rect(uf, Color(0.05, 0.04, 0.05, 0.91))
	draw_rect(uf, Color(0.84, 0.66, 0.34, 0.92), false, 2.0)
	draw_rect(Rect2(uf.position + Vector2(3, 3), uf.size - Vector2(6, 6)), Color(accent.r, accent.g, accent.b, 0.22), false, 1.0)

	# Portrait emblem medallion
	var med := uf.position + Vector2(44.0, 48.0)
	draw_circle(med, 32.0, Color(0.08, 0.06, 0.08, 0.98))
	draw_circle(med, 26.0, Color(accent.r * 0.32, accent.g * 0.32, accent.b * 0.32, 0.95))
	draw_arc(med, 32.0, 0.0, TAU, 36, Color(0.90, 0.72, 0.38, 0.96), 2.5, true)
	draw_string(f, med + Vector2(-10, 8), "KI", HORIZONTAL_ALIGNMENT_LEFT, -1, 20, accent)
	# Level badge on medallion bottom-right
	var lv_p := med + Vector2(22.0, 22.0)
	draw_circle(lv_p, 11.0, Color(0.10, 0.06, 0.04, 0.98))
	draw_arc(lv_p, 11.0, 0.0, TAU, 18, Color(0.96, 0.78, 0.36), 1.6, true)
	draw_string(f, lv_p + Vector2(-4, 4), str(hero_level), HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(1.0, 0.94, 0.72))

	# Hero Name, Race, Coins & Safe/Wild Tag
	var tx := uf.position.x + 88.0
	draw_string(f, Vector2(tx, uf.position.y + 21.0), "%s  •  %s" % [str(cfg["hero"]), str(cfg["race"])], HORIZONTAL_ALIGNMENT_LEFT, -1, 15, Color(1.0, 0.93, 0.72))
	var z_col := Color(0.42, 0.94, 0.62) if in_safe_city else Color(1.0, 0.50, 0.32)
	var z_txt := "BEZPIECZNA STOLICA" if in_safe_city else "EXPOWISKO"
	draw_string(f, Vector2(tx, uf.position.y + 36.0), "%s  •  %d mon." % [z_txt, hero_gold], HORIZONTAL_ALIGNMENT_LEFT, -1, 11, z_col)

	# HP, KI, and Racial Resource Bars
	_draw_bar(Rect2(tx, uf.position.y + 42.0, 284.0, 15.0), hero_hp / hero_max_hp, Color(0.84, 0.20, 0.16), Color(0.18, 0.05, 0.05), "HP  %d / %d" % [int(hero_hp), int(hero_max_hp)], f)
	_draw_bar(Rect2(tx, uf.position.y + 60.0, 284.0, 14.0), hero_ki / hero_max_ki, Color(0.16, 0.52, 0.88), Color(0.05, 0.10, 0.18), "KI  %d / %d" % [int(hero_ki), int(hero_max_ki)], f)
	_draw_bar(Rect2(tx, uf.position.y + 77.0, 284.0, 13.0), hero_res / 100.0, cfg["res_col"], Color(0.08, 0.06, 0.06), "%s  %d / 100" % [str(cfg["res_name"]), int(hero_res)], f)

	# 2. Bottom-Center Premium RPG Action Dock
	var dock := _dock_rect()
	draw_rect(dock, Color(0.05, 0.04, 0.05, 0.92))
	draw_rect(dock, Color(0.84, 0.66, 0.34, 0.92), false, 2.0)

	# XP Bar across top of dock
	_draw_bar(
		Rect2(dock.position.x + 12.0, dock.position.y + 6.0, dock.size.x - 24.0, 12.0),
		hero_xp / hero_max_xp,
		Color(0.88, 0.66, 0.22),
		Color(0.10, 0.08, 0.05),
		"Poziom %d  •  XP %d / %d  •  Prędkość +%d%%" % [hero_level, int(hero_xp), int(hero_max_xp), hero_level * 5],
		f
	)

	# 6 Racial Skill Slots
	var skills: Array = cfg["skills"]
	var start_x := dock.position.x + 14.0
	var sy := dock.position.y + 24.0
	for i in skills.size():
		var sk: Dictionary = skills[i]
		var sr := Rect2(start_x + float(i) * 86.0, sy, 78.0, 52.0)
		var scol: Color = sk["col"]
		var cd := cooldowns[i]
		draw_rect(sr, Color(0.09, 0.08, 0.10, 0.96))
		draw_rect(Rect2(sr.position + Vector2(3, 3), Vector2(sr.size.x - 6, 18.0)), Color(scol.r, scol.g, scol.b, 0.34 if cd <= 0.0 else 0.12))
		draw_rect(sr, Color(scol.r, scol.g, scol.b, 0.90) if cd <= 0.0 else Color(0.45, 0.45, 0.48, 0.65), false, 1.8)
		draw_string(f, sr.position + Vector2(6, 15), "[%s]" % str(sk["key"]), HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(1.0, 0.94, 0.72))
		var sname := str(sk["name"])
		draw_string(f, sr.position + Vector2(5, 36), sname.left(11), HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color(0.92, 0.90, 0.86))
		if cd > 0.0:
			draw_rect(sr, Color(0.02, 0.02, 0.04, 0.64))
			draw_string(f, sr.position + Vector2(22, 34), "%.1fs" % cd, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(1.0, 0.86, 0.42))

	# 3. Interactive 29-Node Talent Tree Modal ([K])
	if show_talents:
		_draw_talent_modal(f)
	elif show_character:
		_draw_character_modal(f, cfg)

func _draw_talent_modal(f: Font) -> void:
	draw_rect(Rect2(Vector2.ZERO, _vp_size()), Color(0.01, 0.01, 0.02, 0.68))
	var pr := _modal_rect()
	draw_rect(pr, Color(0.05, 0.04, 0.06, 0.97))
	draw_rect(pr, Color(0.86, 0.68, 0.34, 0.95), false, 2.5)
	draw_string(f, pr.position + Vector2(24, 34), "DRZEWKO ROZWOJU KI — 4 SZLAKI / 29 WĘZŁÓW (Pozostałe punkty: %d)" % skill_points, HORIZONTAL_ALIGNMENT_LEFT, -1, 17, Color(1.0, 0.90, 0.62))
	draw_string(f, pr.position + Vector2(24, 54), "Kliknij węzeł, aby zainwestować punkt rozwoju  •  [K] lub klik poza oknem = Zamknij", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(0.76, 0.80, 0.86))

	for b_idx in TALENT_BRANCHES.size():
		var branch: Dictionary = TALENT_BRANCHES[b_idx]
		var bcol: Color = branch["col"]
		var nodes: Array = branch["nodes"]
		var col_x := pr.position.x + 30.0 + float(b_idx) * ((pr.size.x - 60.0) / 4.0)
		draw_string(f, Vector2(col_x, pr.position.y + 80.0), str(branch["name"]), HORIZONTAL_ALIGNMENT_LEFT, -1, 13, bcol)
		for n_idx in nodes.size():
			var nr := Rect2(col_x, pr.position.y + 92.0 + float(n_idx) * 48.0, 178.0, 38.0)
			if n_idx > 0:
				var prev_c := Vector2(col_x + 89.0, pr.position.y + 92.0 + float(n_idx - 1) * 48.0 + 38.0)
				draw_line(prev_c, Vector2(col_x + 89.0, nr.position.y), Color(bcol.r, bcol.g, bcol.b, 0.45), 2.0)
			var key := "%d:%d" % [b_idx, n_idx]
			var active := unlocked_talents.has(key)
			draw_rect(nr, Color(bcol.r * 0.25, bcol.g * 0.25, bcol.b * 0.25, 0.94) if active else Color(0.09, 0.08, 0.11, 0.92))
			draw_rect(nr, bcol if active else Color(0.42, 0.42, 0.46, 0.72), false, 2.0 if active else 1.2)
			draw_string(f, nr.position + Vector2(10, 24), "%s %s" % ["★" if active else "○", str(nodes[n_idx])], HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(1.0, 0.96, 0.84) if active else Color(0.76, 0.78, 0.82))

func _draw_character_modal(f: Font, cfg: Dictionary) -> void:
	draw_rect(Rect2(Vector2.ZERO, _vp_size()), Color(0.01, 0.01, 0.02, 0.68))
	var cr := _modal_rect()
	draw_rect(cr, Color(0.05, 0.04, 0.06, 0.97))
	draw_rect(cr, Color(0.86, 0.68, 0.34, 0.95), false, 2.5)
	draw_string(f, cr.position + Vector2(24, 36), "KARTA POSTACI I EKWIPUNEK — %s (%s)" % [str(cfg["hero"]), str(cfg["race"])], HORIZONTAL_ALIGNMENT_LEFT, -1, 18, Color(1.0, 0.90, 0.62))
	var stats := [
		"Poziom: %d  |  Złoto: %d monet" % [hero_level, hero_gold],
		"Zdrowie (HP): %d / %d" % [int(hero_hp), int(hero_max_hp)],
		"Energia Ki: %d / %d" % [int(hero_ki), int(hero_max_ki)],
		"Atak bazowy: 24  |  Obrona: 14  |  Szansa kryt.: 12%",
		"Premia szybkości ruchu: +%d%% (5%% na poziom do Lv. 20)" % (hero_level * 5),
		"Odblokowane węzły rozwoju: %d / 29" % unlocked_talents.size(),
	]
	for i in stats.size():
		draw_string(f, cr.position + Vector2(32, 88 + i * 32), stats[i], HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color(0.92, 0.90, 0.86))
	var gear := ["Broń: Ostrze Nowicjusza (+8 ATK)", "Pancerz: Zbroja Strażnika (+6 DEF)", "Amulet: Kryształ Ki (+10 KI)", "Plecak: 3× Mikstura Życia, 2× Zestaw Naprawczy, Mapa Superior"]
	draw_string(f, cr.position + Vector2(32, 300), "WYPOSAŻENIE:", HORIZONTAL_ALIGNMENT_LEFT, -1, 15, Color(1.0, 0.82, 0.36))
	for i in gear.size():
		draw_string(f, cr.position + Vector2(32, 332 + i * 28), "• " + gear[i], HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(0.82, 0.88, 0.92))
