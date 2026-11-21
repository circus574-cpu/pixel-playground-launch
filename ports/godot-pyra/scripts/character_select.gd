extends Control
## AAA Forged Obsidian & Gold Character Select for KI Legends.
## - Left column: touch-scrollable vertical list ("Jan · Poziom 7 · Planetarny") + pinned "+ NOWA POSTAĆ".
## - Right column: animated slide-out hero inspector with portrait, XP bar, scrollable 2x4 painted-medallion
##   stat tiles (Heart = ŻYCIE, Fiery Fist = ATAK, Shield = OBRONA, Ki Droplet = KI, etc.), and permanently
##   pinned, always-clickable GRAJ & USUŃ forged metallic buttons (never clipped on any phone aspect ratio).
## - Consistent "← WSTECZ" header navigation + Android display safe-area padding + server-backed deletion.

const Look := preload("res://scripts/look.gd")

const FORGED_BASE := "res://service_preview/pyra/assets/ui/forged/"
const ICON_BASE := "res://service_preview/pyra/assets/ui/icons/"
const UI_BASE := "res://service_preview/pyra/assets/ui/"

const RACE_META := {
	"legend": {"name": "Legenda", "land": "pyra", "color": Color(1.0, 0.52, 0.24), "portrait": "portrait_pyra.webp", "badge": "race-legend.webp"},
	"planetary": {"name": "Planetarny", "land": "verdant", "color": Color(0.40, 0.92, 0.56), "portrait": "portrait_verdant.webp", "badge": "race-planetary.webp"},
	"sage": {"name": "Mędrzec", "land": "aether", "color": Color(0.44, 0.88, 1.0), "portrait": "portrait_aether.webp", "badge": "race-sage.webp"},
	"android": {"name": "Android", "land": "nexus", "color": Color(0.28, 0.96, 0.98), "portrait": "portrait_nexus.webp", "badge": "race-android.webp"},
}

const LAND_NAMES := {
	"pyra": "Pyra",
	"verdant": "Verdantia",
	"aether": "Aetheria",
	"nexus": "Nexus-9",
}

signal picked(id: String)
signal new_character
signal delete_requested(id: String)
signal closed

var roster: Array[Dictionary] = []
var selected := ""
var locked_id := ""
var armed_delete := false

var root_box: VBoxContainer
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
var sfx_player := AudioStreamPlayer.new()

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

func _play_ui_sfx(name: String) -> void:
	var path := "res://assets/audio/sfx/ui/%s.mp3" % name
	if ResourceLoader.exists(path):
		var s := load(path)
		if s is AudioStream:
			sfx_player.stream = s
			sfx_player.volume_db = linear_to_db(0.55)
			sfx_player.play()

func _forged_panel(pad_x: float = 42.0, pad_y: float = 44.0, tint: Color = Color.WHITE) -> StyleBox:
	var tex := _load_tex(FORGED_BASE + "panel_forged.webp")
	var cx := maxf(pad_x, 42.0)
	var cy := maxf(pad_y, 44.0)
	if tex == null:
		return Look.window(cx, tint)
	var sb := StyleBoxTexture.new()
	sb.texture = tex
	sb.texture_margin_left = 38.0
	sb.texture_margin_right = 38.0
	sb.texture_margin_top = 38.0
	sb.texture_margin_bottom = 38.0
	sb.axis_stretch_horizontal = StyleBoxTexture.AXIS_STRETCH_MODE_STRETCH
	sb.axis_stretch_vertical = StyleBoxTexture.AXIS_STRETCH_MODE_STRETCH
	sb.content_margin_left = cx
	sb.content_margin_right = cx
	sb.content_margin_top = cy
	sb.content_margin_bottom = cy
	sb.modulate_color = tint
	return sb

func _forged_btn_box(variant: String, state: String, pad_x: float = 26.0, pad_top: float = 8.0, pad_bottom: float = 8.0) -> StyleBox:
	var fname := "btn_forged_gold.webp" if variant == "gold" else ("btn_forged_crimson.webp" if variant == "crimson" else "btn_forged_slate.webp")
	var tex := _load_tex(FORGED_BASE + fname)
	if tex == null:
		return PyraSkin.button_box(state, pad_x, pad_top)
	var sb := StyleBoxTexture.new()
	sb.texture = tex
	sb.texture_margin_left = 44.0
	sb.texture_margin_right = 44.0
	sb.texture_margin_top = 16.0
	sb.texture_margin_bottom = 16.0
	sb.axis_stretch_horizontal = StyleBoxTexture.AXIS_STRETCH_MODE_STRETCH
	sb.axis_stretch_vertical = StyleBoxTexture.AXIS_STRETCH_MODE_STRETCH
	sb.content_margin_left = pad_x
	sb.content_margin_right = pad_x
	sb.content_margin_top = pad_top
	sb.content_margin_bottom = pad_bottom
	match state:
		"hover":
			sb.modulate_color = Color(1.16, 1.14, 1.10, 1.0)
		"pressed":
			sb.modulate_color = Color(0.84, 0.80, 0.76, 1.0)
		"disabled":
			sb.modulate_color = Color(0.45, 0.44, 0.46, 0.72)
		_:
			sb.modulate_color = Color.WHITE
	return sb

func _style_forged_btn(btn: Button, variant: String = "slate", font_sz: int = 20, use_title_font: bool = true) -> void:
	btn.focus_mode = Control.FOCUS_NONE
	btn.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	var pt := 8.0 if use_title_font else 8.0
	var pb := 9.0 if use_title_font else 8.0
	for st_name in ["normal", "hover", "pressed", "disabled"]:
		btn.add_theme_stylebox_override(st_name, _forged_btn_box(variant, st_name, 26.0, pt, pb))
	btn.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	if use_title_font:
		btn.add_theme_font_override("font", Look.title_font())
	btn.add_theme_font_size_override("font_size", font_sz)
	var col := Color.WHITE if use_title_font else (Color("ffe8e2") if variant == "crimson" else Color("f6efe2"))
	btn.add_theme_color_override("font_color", col)
	btn.add_theme_color_override("font_hover_color", Color.WHITE)
	btn.add_theme_color_override("font_pressed_color", Color("ffd98a"))
	btn.add_theme_color_override("font_disabled_color", Color(0.60, 0.56, 0.54, 0.78))
	btn.add_theme_color_override("font_outline_color", Color(0.03, 0.02, 0.01, 0.96))
	btn.add_theme_constant_override("outline_size", 4)

func _inset_box(bg: Color, border: Color, bw: int = 2, radius: int = 10, pad_x: int = 10, pad_y: int = 7) -> StyleBoxFlat:
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

func _race_info(race: String) -> Dictionary:
	return RACE_META.get(race, RACE_META["legend"])

func _portrait_for(race: String) -> Texture2D:
	var info := _race_info(race)
	var t := _load_tex(UI_BASE + str(info["portrait"]))
	if t != null:
		return t
	return _load_tex("res://assets/races/%s.jpg" % race)

func land_name(id: String) -> String:
	return str(LAND_NAMES.get(id, id.capitalize()))

func when(time: int) -> String:
	if time <= 0:
		return "Brak danych"
	var d := Time.get_datetime_dict_from_unix_time(time + int(Time.get_time_zone_from_system().bias) * 60)
	return "%02d.%02d.%d %02d:%02d" % [int(d.day), int(d.month), int(d.year), int(d.hour), int(d.minute)]

func _apply_safe_margins() -> void:
	if root_box == null:
		return
	var pad_l := 20.0
	var pad_r := 20.0
	var pad_t := 12.0
	var pad_b := 16.0
	if OS.get_name() == "Android":
		var vp := get_viewport_rect().size
		var screen := DisplayServer.get_display_safe_area()
		if screen.has_area() and vp.x > 100.0 and vp.y > 100.0:
			var inv := get_tree().root.get_screen_transform().affine_inverse()
			var safe: Rect2 = (inv * Rect2(screen)).intersection(Rect2(Vector2.ZERO, vp))
			pad_l = maxf(pad_l, safe.position.x + 12.0)
			pad_r = maxf(pad_r, (vp.x - safe.end.x) + 12.0)
			pad_t = maxf(pad_t, safe.position.y + 8.0)
			pad_b = maxf(pad_b, (vp.y - safe.end.y) + 12.0)
	root_box.offset_left = pad_l
	root_box.offset_right = -pad_r
	root_box.offset_top = pad_t
	root_box.offset_bottom = -pad_b

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	z_index = 100
	add_child(sfx_player)

	var shade := ColorRect.new()
	shade.color = Color(0.025, 0.02, 0.035, 0.97)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(shade)

	var bg_art := _load_tex("res://assets/branding/intro-wide.webp")
	if bg_art != null:
		var bg := TextureRect.new()
		bg.texture = bg_art
		bg.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		bg.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
		bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
		bg.modulate = Color(0.24, 0.22, 0.28, 0.55)
		add_child(bg)

	root_box = VBoxContainer.new()
	root_box.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root_box.add_theme_constant_override("separation", 10)
	add_child(root_box)
	_apply_safe_margins()
	resized.connect(_apply_safe_margins)

	# Unified Consistent Top Navigation Bar: "← WSTECZ" + Gold Title
	var bar := HBoxContainer.new()
	bar.custom_minimum_size.y = 58.0
	bar.add_theme_constant_override("separation", 16)
	root_box.add_child(bar)

	var btn_back := Button.new()
	btn_back.text = "← WSTECZ"
	btn_back.custom_minimum_size = Vector2(172, 54)
	_style_forged_btn(btn_back, "slate", 17, false)
	btn_back.pressed.connect(func() -> void:
		_play_ui_sfx("close")
		closed.emit()
	)
	bar.add_child(btn_back)

	var title_box := VBoxContainer.new()
	title_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title_box.alignment = BoxContainer.ALIGNMENT_CENTER
	title_box.add_theme_constant_override("separation", 1)
	var title := Label.new()
	title.text = "WYBIERZ BOHATERA"
	Look.style_heading(title, 30)
	title_box.add_child(title)
	var subtitle := Label.new()
	subtitle.text = "Przesuwaj listę góra / dół i dotknij bohatera, aby rozwinąć jego statystyki"
	subtitle.add_theme_font_size_override("font_size", 14)
	subtitle.add_theme_color_override("font_color", Color("dfd2b8"))
	title_box.add_child(subtitle)
	bar.add_child(title_box)

	# Main Split: Left Vertical Column List (42%) + Right Slide-Out Stats Inspector (58%)
	var split := HBoxContainer.new()
	split.size_flags_vertical = Control.SIZE_EXPAND_FILL
	split.add_theme_constant_override("separation", 14)
	root_box.add_child(split)

	# LEFT COLUMN — Scrollable Vertical Character List + Pinned "+ NOWA POSTAĆ"
	var left_panel := PanelContainer.new()
	left_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	left_panel.size_flags_stretch_ratio = 0.42
	left_panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	left_panel.add_theme_stylebox_override("panel", _forged_panel(22.0, 18.0))
	split.add_child(left_panel)

	var left_vbox := VBoxContainer.new()
	left_vbox.size_flags_vertical = Control.SIZE_EXPAND_FILL
	left_vbox.add_theme_constant_override("separation", 8)
	left_panel.add_child(left_vbox)

	var list_hdr := Label.new()
	list_hdr.text = "TWOJE POSTACIE (%d)" % roster.size()
	Look.style_heading(list_hdr, 17)
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
	list_col.add_theme_constant_override("separation", 8)
	list_col.mouse_filter = Control.MOUSE_FILTER_PASS
	list_scroll.add_child(list_col)

	row_panels.clear()
	row_arrows.clear()
	for entry: Dictionary in roster:
		list_col.add_child(_make_roster_row(entry))

	new_button = Button.new()
	new_button.text = "+ NOWA POSTAĆ"
	new_button.custom_minimum_size = Vector2(0, 58)
	_style_forged_btn(new_button, "slate", 18, true)
	new_button.pressed.connect(func() -> void:
		_play_ui_sfx("confirm")
		new_character.emit()
	)
	left_vbox.add_child(new_button)

	# RIGHT COLUMN — Slide-Out Character & Stats Inspector with Permanently Pinned GRAJ / USUŃ Footer
	inspector_wrap = Control.new()
	inspector_wrap.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	inspector_wrap.size_flags_stretch_ratio = 0.58
	inspector_wrap.size_flags_vertical = Control.SIZE_EXPAND_FILL
	inspector_wrap.clip_contents = true
	split.add_child(inspector_wrap)

	inspector_panel = PanelContainer.new()
	inspector_panel.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	inspector_panel.add_theme_stylebox_override("panel", _forged_panel(24.0, 18.0))
	inspector_wrap.add_child(inspector_panel)

	var insp_vbox := VBoxContainer.new()
	insp_vbox.size_flags_vertical = Control.SIZE_EXPAND_FILL
	insp_vbox.add_theme_constant_override("separation", 10)
	inspector_panel.add_child(insp_vbox)

	# 1. Hero Header (Portrait + Name + Race + XP Bar)
	var hero_hdr := HBoxContainer.new()
	hero_hdr.add_theme_constant_override("separation", 14)
	insp_vbox.add_child(hero_hdr)

	var port_frame := PanelContainer.new()
	port_frame.custom_minimum_size = Vector2(88, 88)
	port_frame.add_theme_stylebox_override("panel", _inset_box(Color(0.04, 0.03, 0.05, 1.0), Color("d9a44b"), 3, 10, 3, 3))
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
	info_col.add_theme_constant_override("separation", 4)
	hero_hdr.add_child(info_col)

	var name_row := HBoxContainer.new()
	name_row.add_theme_constant_override("separation", 10)
	insp_badge = TextureRect.new()
	insp_badge.custom_minimum_size = Vector2(34, 34)
	insp_badge.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	insp_badge.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	name_row.add_child(insp_badge)

	insp_name = Label.new()
	Look.style_heading(insp_name, 26)
	insp_name.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	insp_name.clip_text = true
	name_row.add_child(insp_name)
	info_col.add_child(name_row)

	insp_sub = Label.new()
	insp_sub.add_theme_font_size_override("font_size", 16)
	insp_sub.add_theme_color_override("font_color", Color("efe0c4"))
	info_col.add_child(insp_sub)

	insp_xp_label = Label.new()
	insp_xp_label.add_theme_font_size_override("font_size", 13)
	insp_xp_label.add_theme_color_override("font_color", Color("ffd98a"))
	info_col.add_child(insp_xp_label)

	insp_xp_bar = ProgressBar.new()
	insp_xp_bar.custom_minimum_size = Vector2(0, 12)
	insp_xp_bar.show_percentage = false
	insp_xp_bar.add_theme_stylebox_override("background", _inset_box(Color(0.08, 0.07, 0.11, 0.96), Color(0.55, 0.44, 0.22, 0.8), 1, 6, 0, 0))
	var xp_fill := StyleBoxFlat.new()
	xp_fill.bg_color = Color("e89a2c")
	xp_fill.set_corner_radius_all(5)
	insp_xp_bar.add_theme_stylebox_override("fill", xp_fill)
	info_col.add_child(insp_xp_bar)

	# 2. Scrollable 2x4 Painted-Medallion Stat Tiles (scrolls if screen is short -> GRAJ/USUŃ NEVER clip!)
	var stats_scroll := ScrollContainer.new()
	stats_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	stats_scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	stats_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	insp_vbox.add_child(stats_scroll)

	var grid := GridContainer.new()
	grid.columns = 2
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.size_flags_vertical = Control.SIZE_EXPAND_FILL
	grid.add_theme_constant_override("h_separation", 10)
	grid.add_theme_constant_override("v_separation", 8)
	stats_scroll.add_child(grid)

	stat_value_labels.clear()
	var stat_defs := [
		{"key": "hp", "label": "ŻYCIE (HP)", "icon": "hud-hp.webp", "accent": Color(1.0, 0.44, 0.40)},
		{"key": "ki", "label": "ENERGIA KI", "icon": "hud-ki.webp", "accent": Color(0.42, 0.88, 1.0)},
		{"key": "atk", "label": "ATAK", "icon": "hud-fist.webp", "accent": Color(1.0, 0.68, 0.28)},
		{"key": "def", "label": "OBRONA", "icon": "hud-shield.webp", "accent": Color(0.52, 0.80, 1.0)},
		{"key": "crit", "label": "KRYTYK", "icon": "hud-target.webp", "accent": Color(1.0, 0.86, 0.36)},
		{"key": "spd", "label": "SZYBKOŚĆ", "icon": "gear-boots.webp", "accent": Color(0.46, 0.94, 0.60)},
		{"key": "gold", "label": "ZŁOTO / BANK", "icon": "gear-coin.webp", "accent": Color(1.0, 0.88, 0.38)},
		{"key": "progress", "label": "TALENTY / ZLECENIA", "icon": "emblem_scroll.webp", "accent": Color(0.90, 0.74, 1.0)},
	]
	for sd: Dictionary in stat_defs:
		grid.add_child(_make_stat_tile(str(sd["key"]), str(sd["label"]), str(sd["icon"]), sd["accent"] as Color))

	# 3. Permanently Pinned Forged Bottom Actions Bar (ALWAYS visible & clickable!)
	var actions := HBoxContainer.new()
	actions.add_theme_constant_override("separation", 12)
	insp_vbox.add_child(actions)

	play_button = Button.new()
	play_button.text = "GRAJ"
	play_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	play_button.custom_minimum_size = Vector2(220, 62)
	_style_forged_btn(play_button, "gold", 24, true)
	play_button.pressed.connect(func() -> void:
		if selected != "":
			_play_ui_sfx("confirm")
			picked.emit(selected)
	)
	actions.add_child(play_button)

	delete_button = Button.new()
	delete_button.text = "USUŃ POSTAĆ"
	delete_button.custom_minimum_size = Vector2(230, 62)
	_style_forged_btn(delete_button, "crimson", 16, false)
	delete_button.pressed.connect(on_delete)
	actions.add_child(delete_button)

	select(selected, false)

func _make_stat_tile(key: String, label_txt: String, icon_file: String, accent: Color) -> PanelContainer:
	var tile := PanelContainer.new()
	tile.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tile.size_flags_vertical = Control.SIZE_EXPAND_FILL
	tile.custom_minimum_size = Vector2(0, 62)
	var border := accent.darkened(0.32)
	border.a = 0.65
	tile.add_theme_stylebox_override("panel", _inset_box(Color(0.06, 0.055, 0.085, 0.92), border, 2, 10, 10, 6))

	var hb := HBoxContainer.new()
	hb.add_theme_constant_override("separation", 12)
	tile.add_child(hb)

	# Unified circular obsidian-and-accent medallion frame around EVERY stat icon
	var med := PanelContainer.new()
	med.custom_minimum_size = Vector2(48, 48)
	med.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var med_sb := StyleBoxFlat.new()
	med_sb.bg_color = Color(0.035, 0.03, 0.055, 0.96)
	med_sb.border_color = accent.lerp(Color("d9a44b"), 0.45)
	med_sb.set_border_width_all(2)
	med_sb.set_corner_radius_all(24)
	med_sb.content_margin_left = 5
	med_sb.content_margin_right = 5
	med_sb.content_margin_top = 5
	med_sb.content_margin_bottom = 5
	med.add_theme_stylebox_override("panel", med_sb)
	hb.add_child(med)

	var icon_rect := TextureRect.new()
	icon_rect.texture = _load_tex(ICON_BASE + icon_file)
	icon_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	icon_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	icon_rect.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	icon_rect.size_flags_vertical = Control.SIZE_EXPAND_FILL
	med.add_child(icon_rect)

	var vb := VBoxContainer.new()
	vb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	vb.alignment = BoxContainer.ALIGNMENT_CENTER
	vb.add_theme_constant_override("separation", 1)
	hb.add_child(vb)

	var lbl := Label.new()
	lbl.text = label_txt
	lbl.add_theme_font_size_override("font_size", 12)
	lbl.add_theme_color_override("font_color", Color("d2c5ab"))
	vb.add_child(lbl)

	var val := Label.new()
	val.text = "—"
	val.add_theme_font_size_override("font_size", 19)
	val.add_theme_color_override("font_color", accent.lightened(0.22))
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
	panel.custom_minimum_size = Vector2(0, 74)
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.mouse_filter = Control.MOUSE_FILTER_PASS
	panel.set_meta("color", rcol)
	panel.add_theme_stylebox_override("panel", _row_style(false, rcol))

	var hb := HBoxContainer.new()
	hb.add_theme_constant_override("separation", 12)
	hb.mouse_filter = Control.MOUSE_FILTER_IGNORE
	panel.add_child(hb)

	var port_wrap := PanelContainer.new()
	port_wrap.custom_minimum_size = Vector2(52, 52)
	port_wrap.mouse_filter = Control.MOUSE_FILTER_IGNORE
	port_wrap.add_theme_stylebox_override("panel", _inset_box(Color(0.04, 0.03, 0.05, 1.0), rcol, 2, 8, 2, 2))
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
	txt_col.add_theme_constant_override("separation", 2)
	txt_col.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hb.add_child(txt_col)

	var line1 := Label.new()
	line1.text = "%s  ·  Poziom %d  ·  %s" % [hero_name, lv, rname]
	line1.add_theme_font_size_override("font_size", 18)
	line1.add_theme_color_override("font_color", Color("fff0cf"))
	line1.clip_text = true
	line1.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	line1.mouse_filter = Control.MOUSE_FILTER_IGNORE
	txt_col.add_child(line1)

	var line2 := Label.new()
	line2.text = "%s  ·  %s" % [land_lbl, when(int(entry.get("time", 0)))]
	line2.add_theme_font_size_override("font_size", 13)
	line2.add_theme_color_override("font_color", Color("c9bba0"))
	line2.clip_text = true
	line2.mouse_filter = Control.MOUSE_FILTER_IGNORE
	txt_col.add_child(line2)

	var arrow := Label.new()
	arrow.text = "▸"
	arrow.add_theme_font_size_override("font_size", 22)
	arrow.add_theme_color_override("font_color", Color("a8987c"))
	arrow.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	arrow.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hb.add_child(arrow)

	panel.gui_input.connect(func(event: InputEvent) -> void:
		_handle_list_drag(event, id)
	)
	row_panels[id] = panel
	row_arrows[id] = arrow
	return panel

func _row_style(active: bool, color: Color) -> StyleBox:
	if active:
		var gold_b := Color(0.96, 0.78, 0.36, 0.98).lerp(color.lightened(0.25), 0.22)
		return _inset_box(Color(0.14, 0.105, 0.06, 0.96), gold_b, 3, 10, 12, 8)
	var b := color.darkened(0.50)
	b.a = 0.55
	return _inset_box(Color(0.06, 0.055, 0.085, 0.90), b, 2, 10, 12, 8)

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
				_play_ui_sfx("click")
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
					_play_ui_sfx("click")
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
			arr.add_theme_color_override("font_color", Color("ffd98a") if is_sel else Color("a8987c"))

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
	max_hp = maxi(max_hp, cur_hp)
	var max_ki := int(entry.get("maxKi", 45 + (lv - 1) * 8))
	var cur_ki := int(entry.get("ki", max_ki))
	max_ki = maxi(max_ki, cur_ki)
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
	(stat_value_labels["gold"] as Label).text = ("%d zł (Bank %d)" % [gold, bank_gold]) if bank_gold > 0 else ("%d zł" % gold)
	(stat_value_labels["progress"] as Label).text = "%d tal. · %d zlec." % [talents, quests]

	if play_button != null:
		play_button.disabled = false
		delete_button.disabled = (id == "" or id == locked_id)

	if animate and is_inside_tree():
		if inspector_tween != null and inspector_tween.is_running():
			inspector_tween.kill()
		inspector_panel.modulate.a = 0.25
		inspector_panel.offset_left = 44.0
		inspector_panel.offset_right = 44.0
		inspector_tween = create_tween().set_parallel(true).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
		inspector_tween.tween_property(inspector_panel, "modulate:a", 1.0, 0.20)
		inspector_tween.tween_property(inspector_panel, "offset_left", 0.0, 0.22)
		inspector_tween.tween_property(inspector_panel, "offset_right", 0.0, 0.22)

func on_delete() -> void:
	if selected == "":
		return
	if not armed_delete:
		_play_ui_sfx("click")
		armed_delete = true
		delete_button.text = "NA PEWNO? USUŃ"
		return
	_play_ui_sfx("cancel")
	armed_delete = false
	delete_requested.emit(selected)
