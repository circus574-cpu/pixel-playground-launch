extends Control
## AAA Vertical-Column Character Select with Smooth Touch Scrolling & Slide-Out Stats Inspector.
## Left column: scrollable vertical list ("Jan · Poziom 7 · Planetarny") + "+ Nowa postać".
## Right panel: smoothly slides open on click, showing portrait, XP bar, and 8 painted-icon stat tiles
## (Heart = HP, Ki droplet = KI, Crossed Swords = ATK, Shield = DEF, Target = CRIT, Boots = SPD, Coin = Gold, Scroll = Talents/Quests).

const Look := preload("res://scripts/look.gd")
const Characters := preload("res://scripts/characters.gd")

const ICON_BASE := "res://service_preview/pyra/assets/ui/icons/"
const UI_BASE := "res://service_preview/pyra/assets/ui/"

const RACE_META := {
	"legend": {"name": "Legenda", "land": "pyra", "color": Color(1.0, 0.50, 0.22), "portrait": "portrait_pyra.webp", "badge": "race-legend.webp"},
	"planetary": {"name": "Planetarny", "land": "verdant", "color": Color(0.38, 0.90, 0.54), "portrait": "portrait_verdant.webp", "badge": "race-planetary.webp"},
	"sage": {"name": "Mędrzec", "land": "aether", "color": Color(0.42, 0.88, 1.0), "portrait": "portrait_aether.webp", "badge": "race-sage.webp"},
	"android": {"name": "Android", "land": "nexus", "color": Color(0.24, 0.96, 0.98), "portrait": "portrait_nexus.webp", "badge": "race-android.webp"},
}

const LAND_NAMES := {
	"pyra": "Pyra",
	"verdant": "Verdantia",
	"aether": "Aetheria",
	"nexus": "Nexus-9",
}

signal picked(id: String)
signal new_character
signal closed

var roster: Array[Dictionary] = []
var selected := ""
var locked_id := ""
var armed_delete := false

var row_panels: Dictionary = {}
var row_arrows: Dictionary = {}
var tex_cache: Dictionary = {}

var list_scroll: ScrollContainer
var inspector_wrap: Control
var inspector_panel: PanelContainer
var inspector_tween: Tween

var insp_portrait: TextureRect
var insp_badge: TextureRect
var insp_name: Label
var insp_sub: Label
var insp_xp_label: Label
var insp_xp_bar: ProgressBar
var stat_value_labels: Dictionary = {}

var play_button: Button
var delete_button: Button
var new_button: Button

# Explicit touch/mouse drag state for silky-smooth scrolling on Android
var _drag_active := false
var _drag_moved := false
var _drag_start_y := 0.0
var _drag_start_scroll := 0

func setup(list: Array[Dictionary], current: String = "") -> void:
	roster = list
	locked_id = current
	if current != "" and list.any(func(e: Dictionary) -> bool: return str(e.id) == current):
		selected = current
	elif not roster.is_empty():
		selected = str(roster[0].id)
	else:
		selected = ""

func _load_tex(path: String) -> Texture2D:
	if path.is_empty():
		return null
	if tex_cache.has(path):
		return tex_cache[path] as Texture2D
	if ResourceLoader.exists(path):
		var loaded := load(path)
		if loaded is Texture2D:
			tex_cache[path] = loaded
			return loaded
	if FileAccess.file_exists(path):
		var bytes := FileAccess.get_file_as_bytes(path)
		if not bytes.is_empty():
			var img := Image.new()
			var err := ERR_CANT_OPEN
			if path.ends_with(".webp"):
				err = img.load_webp_from_buffer(bytes)
			elif path.ends_with(".png"):
				err = img.load_png_from_buffer(bytes)
			elif path.ends_with(".jpg") or path.ends_with(".jpeg"):
				err = img.load_jpg_from_buffer(bytes)
			if err == OK:
				var tex := ImageTexture.create_from_image(img)
				tex_cache[path] = tex
				return tex
	return null

func _race_info(race: String) -> Dictionary:
	return RACE_META.get(race, RACE_META["legend"])

func _portrait_for(race: String) -> Texture2D:
	var info := _race_info(race)
	var t := _load_tex(UI_BASE + str(info["portrait"]))
	if t != null:
		return t
	return _load_tex("res://assets/races/%s.jpg" % race)

func land_name(id: String) -> String:
	if LAND_NAMES.has(id):
		return str(LAND_NAMES[id])
	return id.capitalize()

func when(time: int) -> String:
	if time <= 0:
		return "Brak danych"
	var d := Time.get_datetime_dict_from_unix_time(time + int(Time.get_time_zone_from_system().bias) * 60)
	return "%02d.%02d.%d %02d:%02d" % [int(d.day), int(d.month), int(d.year), int(d.hour), int(d.minute)]

func _make_box(bg: Color, border: Color, bw: int = 2, radius: int = 12, pad_x: int = 14, pad_y: int = 10) -> StyleBoxFlat:
	var st := StyleBoxFlat.new()
	st.bg_color = bg
	st.border_color = border
	st.set_border_width_all(bw)
	st.set_corner_radius_all(radius)
	st.content_margin_left = pad_x
	st.content_margin_right = pad_x
	st.content_margin_top = pad_y
	st.content_margin_bottom = pad_y
	return st

func _style_action_btn(btn: Button, bg: Color, border: Color, text_col: Color, font_sz: int = 22) -> void:
	btn.focus_mode = Control.FOCUS_NONE
	btn.add_theme_font_size_override("font_size", font_sz)
	btn.add_theme_color_override("font_color", text_col)
	btn.add_theme_color_override("font_hover_color", Color.WHITE)
	btn.add_theme_color_override("font_disabled_color", Color(0.55, 0.52, 0.50, 0.65))
	var n := _make_box(bg, border, 2, 12, 18, 12)
	var h := _make_box(bg.lightened(0.14), border.lightened(0.18), 2, 12, 18, 12)
	var p := _make_box(bg.darkened(0.12), border, 2, 12, 18, 12)
	var d := _make_box(Color(0.12, 0.11, 0.14, 0.72), Color(0.32, 0.30, 0.36, 0.55), 2, 12, 18, 12)
	btn.add_theme_stylebox_override("normal", n)
	btn.add_theme_stylebox_override("hover", h)
	btn.add_theme_stylebox_override("pressed", p)
	btn.add_theme_stylebox_override("disabled", d)

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	z_index = 100

	var shade := ColorRect.new()
	shade.color = Color(0.03, 0.025, 0.05, 0.97)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(shade)

	var stone := Look.backdrop(0.32)
	if stone != null:
		add_child(stone)

	var root := VBoxContainer.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.offset_left = 24
	root.offset_right = -24
	root.offset_top = 14
	root.offset_bottom = -16
	root.add_theme_constant_override("separation", 12)
	add_child(root)

	# Top Header Bar
	var bar := HBoxContainer.new()
	bar.custom_minimum_size.y = 74.0
	bar.add_theme_constant_override("separation", 14)
	var title_box := VBoxContainer.new()
	title_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title_box.add_theme_constant_override("separation", 2)
	var title := Label.new()
	title.text = "WYBIERZ BOHATERA"
	Look.style_heading(title, 34)
	title_box.add_child(title)
	var subtitle := Label.new()
	subtitle.text = "Dotknij bohatera na liście (przesuwaj palcem góra / dół), aby rozwinąć statystyki i wejść do gry"
	subtitle.add_theme_font_size_override("font_size", 15)
	subtitle.add_theme_color_override("font_color", Color(0.78, 0.74, 0.66))
	title_box.add_child(subtitle)
	bar.add_child(title_box)
	Look.reserve_close(bar)
	root.add_child(bar)

	# Main Split: Left Vertical Column List (44%) + Right Slide-Out Stats Inspector (56%)
	var split := HBoxContainer.new()
	split.size_flags_vertical = Control.SIZE_EXPAND_FILL
	split.add_theme_constant_override("separation", 18)
	root.add_child(split)

	# LEFT COLUMN — Scrollable Vertical Character List
	var left_panel := PanelContainer.new()
	left_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	left_panel.size_flags_stretch_ratio = 0.44
	left_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	left_panel.add_theme_stylebox_override("panel", _make_box(Color(0.06, 0.055, 0.09, 0.92), Color(0.54, 0.42, 0.22, 0.72), 2, 14, 10, 10))
	split.add_child(left_panel)

	var left_vbox := VBoxContainer.new()
	left_vbox.size_flags_vertical = Control.SIZE_EXPAND_FILL
	left_vbox.add_theme_constant_override("separation", 10)
	left_panel.add_child(left_vbox)

	var list_hdr := Label.new()
	list_hdr.text = "TWOJE POSTACIE (%d)" % roster.size()
	list_hdr.add_theme_font_size_override("font_size", 15)
	list_hdr.add_theme_color_override("font_color", Color(0.95, 0.80, 0.42))
	left_vbox.add_child(list_hdr)

	list_scroll = ScrollContainer.new()
	list_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	list_scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	list_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	list_scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_AUTO
	list_scroll.follow_focus = false
	list_scroll.gui_input.connect(_on_scroll_gui_input)
	left_vbox.add_child(list_scroll)

	var list_col := VBoxContainer.new()
	list_col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	list_col.add_theme_constant_override("separation", 10)
	list_col.mouse_filter = Control.MOUSE_FILTER_PASS
	list_scroll.add_child(list_col)

	row_panels.clear()
	row_arrows.clear()
	for entry: Dictionary in roster:
		list_col.add_child(_make_roster_row(entry))

	new_button = Button.new()
	new_button.text = "+ STWÓRZ NOWĄ POSTAĆ"
	new_button.custom_minimum_size = Vector2(0, 56)
	_style_action_btn(new_button, Color(0.14, 0.12, 0.07, 0.96), Color(0.94, 0.74, 0.30, 0.92), Color(1.0, 0.92, 0.66), 18)
	new_button.pressed.connect(func() -> void: new_character.emit())
	left_vbox.add_child(new_button)

	# RIGHT COLUMN — Slide-Out Character & Stats Inspector
	inspector_wrap = Control.new()
	inspector_wrap.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	inspector_wrap.size_flags_stretch_ratio = 0.56
	inspector_wrap.size_flags_vertical = Control.SIZE_EXPAND_FILL
	inspector_wrap.clip_contents = true
	split.add_child(inspector_wrap)

	inspector_panel = PanelContainer.new()
	inspector_panel.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	inspector_panel.add_theme_stylebox_override("panel", _make_box(Color(0.07, 0.06, 0.10, 0.96), Color(0.86, 0.66, 0.28, 0.88), 2, 16, 18, 16))
	inspector_wrap.add_child(inspector_panel)

	var insp_vbox := VBoxContainer.new()
	insp_vbox.size_flags_vertical = Control.SIZE_EXPAND_FILL
	insp_vbox.add_theme_constant_override("separation", 12)
	inspector_panel.add_child(insp_vbox)

	# Hero Portrait + Name + Race + XP Bar Header
	var hero_hdr := HBoxContainer.new()
	hero_hdr.add_theme_constant_override("separation", 16)
	insp_vbox.add_child(hero_hdr)

	var port_frame := PanelContainer.new()
	port_frame.custom_minimum_size = Vector2(104, 104)
	port_frame.add_theme_stylebox_override("panel", _make_box(Color(0.04, 0.03, 0.06, 1.0), Color(0.92, 0.72, 0.30, 0.95), 3, 14, 4, 4))
	hero_hdr.add_child(port_frame)

	insp_portrait = TextureRect.new()
	insp_portrait.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	insp_portrait.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	insp_portrait.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	insp_portrait.size_flags_vertical = Control.SIZE_EXPAND_FILL
	port_frame.add_child(insp_portrait)

	var info_col := VBoxContainer.new()
	info_col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	info_col.alignment = BoxContainer.ALIGNMENT_CENTER
	info_col.add_theme_constant_override("separation", 6)
	hero_hdr.add_child(info_col)

	var name_row := HBoxContainer.new()
	name_row.add_theme_constant_override("separation", 10)
	insp_badge = TextureRect.new()
	insp_badge.custom_minimum_size = Vector2(36, 36)
	insp_badge.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	insp_badge.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	name_row.add_child(insp_badge)

	insp_name = Label.new()
	Look.style_heading(insp_name, 30)
	insp_name.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	insp_name.clip_text = true
	name_row.add_child(insp_name)
	info_col.add_child(name_row)

	insp_sub = Label.new()
	insp_sub.add_theme_font_size_override("font_size", 17)
	insp_sub.add_theme_color_override("font_color", Color(0.90, 0.86, 0.78))
	info_col.add_child(insp_sub)

	# XP Progress Bar
	var xp_box := VBoxContainer.new()
	xp_box.add_theme_constant_override("separation", 4)
	insp_xp_label = Label.new()
	insp_xp_label.add_theme_font_size_override("font_size", 14)
	insp_xp_label.add_theme_color_override("font_color", Color(0.98, 0.86, 0.44))
	xp_box.add_child(insp_xp_label)

	insp_xp_bar = ProgressBar.new()
	insp_xp_bar.custom_minimum_size = Vector2(0, 14)
	insp_xp_bar.show_percentage = false
	var xp_bg := StyleBoxFlat.new()
	xp_bg.bg_color = Color(0.12, 0.10, 0.16, 0.95)
	xp_bg.border_color = Color(0.50, 0.40, 0.20, 0.8)
	xp_bg.set_border_width_all(1)
	xp_bg.set_corner_radius_all(6)
	var xp_fill := StyleBoxFlat.new()
	xp_fill.bg_color = Color(0.95, 0.74, 0.22, 0.98)
	xp_fill.set_corner_radius_all(5)
	insp_xp_bar.add_theme_stylebox_override("background", xp_bg)
	insp_xp_bar.add_theme_stylebox_override("fill", xp_fill)
	xp_box.add_child(insp_xp_bar)
	info_col.add_child(xp_box)

	# Stats Section Title
	var st_title := Label.new()
	st_title.text = "STATYSTYKI I POSTĘP BOHATERA"
	st_title.add_theme_font_size_override("font_size", 14)
	st_title.add_theme_color_override("font_color", Color(0.84, 0.74, 0.50))
	insp_vbox.add_child(st_title)

	# 2x4 Painted-Icon Stat Tiles Grid
	var grid := GridContainer.new()
	grid.columns = 2
	grid.size_flags_vertical = Control.SIZE_EXPAND_FILL
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.add_theme_constant_override("h_separation", 12)
	grid.add_theme_constant_override("v_separation", 10)
	insp_vbox.add_child(grid)

	stat_value_labels.clear()
	var stat_defs := [
		{"key": "hp", "label": "ŻYCIE (HP)", "icon": "hud-hp.webp", "accent": Color(1.0, 0.38, 0.36)},
		{"key": "ki", "label": "ENERGIA KI", "icon": "hud-ki.webp", "accent": Color(0.36, 0.86, 1.0)},
		{"key": "atk", "label": "ATAK", "icon": "hud-combat.webp", "accent": Color(1.0, 0.64, 0.26)},
		{"key": "def", "label": "OBRONA", "icon": "hud-shield.webp", "accent": Color(0.48, 0.76, 1.0)},
		{"key": "crit", "label": "KRYTYK", "icon": "hud-target.webp", "accent": Color(1.0, 0.84, 0.32)},
		{"key": "spd", "label": "SZYBKOŚĆ", "icon": "gear-boots.webp", "accent": Color(0.42, 0.94, 0.58)},
		{"key": "gold", "label": "ZŁOTO / BANK", "icon": "gear-coin.webp", "accent": Color(1.0, 0.88, 0.36)},
		{"key": "progress", "label": "TALENTY / ZLECENIA", "icon": "emblem_scroll.webp", "accent": Color(0.86, 0.68, 1.0)},
	]
	for sd: Dictionary in stat_defs:
		grid.add_child(_make_stat_tile(str(sd["key"]), str(sd["label"]), str(sd["icon"]), sd["accent"] as Color))

	# Bottom Actions Bar inside Inspector
	var actions := HBoxContainer.new()
	actions.add_theme_constant_override("separation", 14)
	insp_vbox.add_child(actions)

	play_button = Button.new()
	play_button.text = "▶ GRAJ TĄ POSTACIĄ"
	play_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	play_button.custom_minimum_size = Vector2(260, 62)
	_style_action_btn(play_button, Color(0.14, 0.42, 0.22, 0.98), Color(0.42, 0.94, 0.56, 0.98), Color(0.96, 1.0, 0.94), 22)
	play_button.pressed.connect(func() -> void:
		if selected != "":
			picked.emit(selected)
	)
	actions.add_child(play_button)

	delete_button = Button.new()
	delete_button.text = "USUŃ POSTAĆ"
	delete_button.custom_minimum_size = Vector2(190, 62)
	_style_action_btn(delete_button, Color(0.32, 0.09, 0.09, 0.94), Color(0.88, 0.34, 0.30, 0.90), Color(1.0, 0.86, 0.84), 18)
	delete_button.pressed.connect(on_delete)
	actions.add_child(delete_button)

	Look.add_close(self, func() -> void: closed.emit())
	select(selected, false)

func _make_stat_tile(key: String, label_txt: String, icon_file: String, accent: Color) -> PanelContainer:
	var tile := PanelContainer.new()
	tile.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tile.size_flags_vertical = Control.SIZE_EXPAND_FILL
	tile.custom_minimum_size = Vector2(0, 62)
	var border := accent.darkened(0.35)
	border.a = 0.72
	tile.add_theme_stylebox_override("panel", _make_box(Color(0.10, 0.09, 0.14, 0.94), border, 2, 12, 10, 8))

	var hb := HBoxContainer.new()
	hb.add_theme_constant_override("separation", 12)
	hb.alignment = BoxContainer.ALIGNMENT_BEGIN
	tile.add_child(hb)

	var icon_rect := TextureRect.new()
	icon_rect.texture = _load_tex(ICON_BASE + icon_file)
	icon_rect.custom_minimum_size = Vector2(44, 44)
	icon_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	icon_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	hb.add_child(icon_rect)

	var vb := VBoxContainer.new()
	vb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	vb.alignment = BoxContainer.ALIGNMENT_CENTER
	vb.add_theme_constant_override("separation", 1)
	hb.add_child(vb)

	var lbl := Label.new()
	lbl.text = label_txt
	lbl.add_theme_font_size_override("font_size", 12)
	lbl.add_theme_color_override("font_color", Color(0.76, 0.74, 0.72))
	vb.add_child(lbl)

	var val := Label.new()
	val.text = "—"
	val.add_theme_font_size_override("font_size", 20)
	val.add_theme_color_override("font_color", accent.lightened(0.25))
	val.clip_text = true
	vb.add_child(val)
	stat_value_labels[key] = val
	return tile

func _make_roster_row(entry: Dictionary) -> PanelContainer:
	var id := str(entry.get("id", ""))
	var race := str(entry.get("race", "legend"))
	var info := _race_info(race)
	var rcol: Color = info["color"]
	var rname := str(info["name"])
	var hero_name := str(entry.get("name", "")).strip_edges()
	if hero_name.is_empty():
		hero_name = rname
	var lv := maxi(1, int(entry.get("level", 1)))
	var land_lbl := land_name(str(entry.get("land", info["land"])))

	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(0, 78)
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.mouse_filter = Control.MOUSE_FILTER_PASS
	panel.set_meta("color", rcol)
	panel.add_theme_stylebox_override("panel", _row_style(false, rcol))

	var hb := HBoxContainer.new()
	hb.add_theme_constant_override("separation", 12)
	hb.mouse_filter = Control.MOUSE_FILTER_IGNORE
	panel.add_child(hb)

	var port_wrap := PanelContainer.new()
	port_wrap.custom_minimum_size = Vector2(56, 56)
	port_wrap.mouse_filter = Control.MOUSE_FILTER_IGNORE
	port_wrap.add_theme_stylebox_override("panel", _make_box(Color(0.04, 0.03, 0.06, 1.0), rcol, 2, 10, 2, 2))
	hb.add_child(port_wrap)

	var port := TextureRect.new()
	port.texture = _portrait_for(race)
	port.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	port.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	port.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	port.size_flags_vertical = Control.SIZE_EXPAND_FILL
	port.mouse_filter = Control.MOUSE_FILTER_IGNORE
	port_wrap.add_child(port)

	var txt_col := VBoxContainer.new()
	txt_col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	txt_col.alignment = BoxContainer.ALIGNMENT_CENTER
	txt_col.add_theme_constant_override("separation", 3)
	txt_col.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hb.add_child(txt_col)

	var line1 := Label.new()
	line1.text = "%s  ·  Poziom %d  ·  %s" % [hero_name, lv, rname]
	line1.add_theme_font_size_override("font_size", 19)
	line1.add_theme_color_override("font_color", Color(1.0, 0.96, 0.86))
	line1.clip_text = true
	line1.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	line1.mouse_filter = Control.MOUSE_FILTER_IGNORE
	txt_col.add_child(line1)

	var line2 := Label.new()
	line2.text = "%s  ·  Ostatnio: %s" % [land_lbl, when(int(entry.get("time", 0)))]
	line2.add_theme_font_size_override("font_size", 13)
	line2.add_theme_color_override("font_color", Color(0.72, 0.70, 0.68))
	line2.clip_text = true
	line2.mouse_filter = Control.MOUSE_FILTER_IGNORE
	txt_col.add_child(line2)

	var arrow := Label.new()
	arrow.text = "▸"
	arrow.add_theme_font_size_override("font_size", 24)
	arrow.add_theme_color_override("font_color", Color(0.55, 0.52, 0.48))
	arrow.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	arrow.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hb.add_child(arrow)

	panel.gui_input.connect(func(event: InputEvent) -> void:
		_handle_list_drag(event, id)
	)
	row_panels[id] = panel
	row_arrows[id] = arrow
	return panel

func _row_style(active: bool, color: Color) -> StyleBoxFlat:
	if active:
		return _make_box(Color(0.16, 0.13, 0.20, 0.98), color.lightened(0.22), 3, 12, 12, 8)
	return _make_box(Color(0.09, 0.08, 0.13, 0.88), Color(0.32, 0.28, 0.36, 0.65), 2, 12, 12, 8)

func _on_scroll_gui_input(event: InputEvent) -> void:
	_handle_list_drag(event, "")

func _handle_list_drag(event: InputEvent, tap_id: String) -> void:
	if event is InputEventScreenTouch:
		var st := event as InputEventScreenTouch
		if st.pressed:
			_drag_active = true
			_drag_moved = false
			_drag_start_y = st.position.y
			_drag_start_scroll = list_scroll.scroll_vertical
		else:
			if _drag_active and not _drag_moved and tap_id != "":
				select(tap_id, true)
			_drag_active = false
	elif event is InputEventScreenDrag and _drag_active:
		var sd := event as InputEventScreenDrag
		var dy := sd.position.y - _drag_start_y
		if absf(dy) > 10.0:
			_drag_moved = true
		list_scroll.scroll_vertical = maxi(0, _drag_start_scroll - int(dy))
	elif event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_WHEEL_UP and mb.pressed:
			list_scroll.scroll_vertical = maxi(0, list_scroll.scroll_vertical - 56)
		elif mb.button_index == MOUSE_BUTTON_WHEEL_DOWN and mb.pressed:
			list_scroll.scroll_vertical += 56
		elif mb.button_index == MOUSE_BUTTON_LEFT:
			if mb.pressed:
				_drag_active = true
				_drag_moved = false
				_drag_start_y = mb.position.y
				_drag_start_scroll = list_scroll.scroll_vertical
			else:
				if _drag_active and not _drag_moved and tap_id != "":
					select(tap_id, true)
				_drag_active = false
	elif event is InputEventMouseMotion and _drag_active:
		var mm := event as InputEventMouseMotion
		if (mm.button_mask & MOUSE_BUTTON_MASK_LEFT) != 0:
			var dy := mm.position.y - _drag_start_y
			if absf(dy) > 8.0:
				_drag_moved = true
			list_scroll.scroll_vertical = maxi(0, _drag_start_scroll - int(dy))

func _entry_by_id(id: String) -> Dictionary:
	for e: Dictionary in roster:
		if str(e.get("id", "")) == id:
			return e
	return {}

func select(id: String, animate: bool = true) -> void:
	selected = id
	armed_delete = false
	if delete_button != null:
		delete_button.text = "USUŃ POSTAĆ"

	for key: String in row_panels:
		var p := row_panels[key] as PanelContainer
		var col := p.get_meta("color") as Color
		var is_sel := (key == id)
		p.add_theme_stylebox_override("panel", _row_style(is_sel, col))
		if row_arrows.has(key):
			var arr := row_arrows[key] as Label
			arr.add_theme_color_override("font_color", Color(1.0, 0.86, 0.36) if is_sel else Color(0.55, 0.52, 0.48))

	var entry := _entry_by_id(id)
	if entry.is_empty():
		inspector_panel.visible = false
		if play_button != null:
			play_button.disabled = true
			delete_button.disabled = true
		return

	inspector_panel.visible = true
	var race := str(entry.get("race", "legend"))
	var info := _race_info(race)
	var rname := str(info["name"])
	var hname := str(entry.get("name", "")).strip_edges()
	if hname.is_empty():
		hname = rname
	var lv := maxi(1, int(entry.get("level", 1)))
	var land_lbl := land_name(str(entry.get("land", info["land"])))

	insp_portrait.texture = _portrait_for(race)
	insp_badge.texture = _load_tex(ICON_BASE + str(info["badge"]))
	insp_name.text = hname.to_upper()
	insp_sub.text = "Poziom %d  ·  %s  ·  %s" % [lv, rname, land_lbl]

	var max_hp := int(entry.get("maxHp", 140 + (lv - 1) * 24))
	var cur_hp := int(entry.get("hp", max_hp))
	var max_ki := int(entry.get("maxKi", 45 + (lv - 1) * 8))
	var cur_ki := int(entry.get("ki", max_ki))
	var atk := int(entry.get("attack", 14 + (lv - 1) * 4))
	var def_v := int(entry.get("defense", 5 + (lv - 1) * 2))
	var crit := float(entry.get("critChance", 5.0))
	var spd := int(entry.get("speedBonusPct", mini(lv - 1, 19) * 5))
	var gold := int(entry.get("gold", 0))
	var bank_gold := int(entry.get("bankGold", 0))
	var xp := int(entry.get("xp", 0))
	var xp_need := maxi(1, int(entry.get("xpNeeded", 1400)))
	var talents := int(entry.get("talentsCount", 1))
	var quests := int(entry.get("questsCount", 0))

	insp_xp_label.text = "DOŚWIADCZENIE (PD): %d / %d" % [xp, xp_need]
	insp_xp_bar.max_value = float(xp_need)
	insp_xp_bar.value = clampf(float(xp), 0.0, float(xp_need))

	(stat_value_labels["hp"] as Label).text = "%d / %d" % [cur_hp, max_hp]
	(stat_value_labels["ki"] as Label).text = "%d / %d" % [cur_ki, max_ki]
	(stat_value_labels["atk"] as Label).text = str(atk)
	(stat_value_labels["def"] as Label).text = str(def_v)
	(stat_value_labels["crit"] as Label).text = "%.1f%%" % crit
	(stat_value_labels["spd"] as Label).text = "+%d%%" % spd
	(stat_value_labels["gold"] as Label).text = ("%d zł  (Bank: %d)" % [gold, bank_gold]) if bank_gold > 0 else ("%d zł" % gold)
	(stat_value_labels["progress"] as Label).text = "%d tal. · %d zlec." % [talents, quests]

	if play_button != null:
		play_button.disabled = false
		delete_button.disabled = (id == "" or id == locked_id)

	if animate and is_inside_tree():
		if inspector_tween != null and inspector_tween.is_running():
			inspector_tween.kill()
		inspector_panel.modulate.a = 0.25
		inspector_panel.offset_left = 48.0
		inspector_panel.offset_right = 48.0
		inspector_tween = create_tween().set_parallel(true).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
		inspector_tween.tween_property(inspector_panel, "modulate:a", 1.0, 0.22)
		inspector_tween.tween_property(inspector_panel, "offset_left", 0.0, 0.24)
		inspector_tween.tween_property(inspector_panel, "offset_right", 0.0, 0.24)

func on_delete() -> void:
	if selected == "":
		return
	if not armed_delete:
		armed_delete = true
		delete_button.text = "NA PEWNO? USUŃ"
		return
	Characters.delete(selected)
	roster = roster.filter(func(e: Dictionary) -> bool: return str(e.id) != selected)
	if roster.is_empty():
		closed.emit()
		return
	for child in get_children():
		child.queue_free()
	row_panels.clear()
	row_arrows.clear()
	armed_delete = false
	selected = str(roster[0].id)
	_ready.call_deferred()
