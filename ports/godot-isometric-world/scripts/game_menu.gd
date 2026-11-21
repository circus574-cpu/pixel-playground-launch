extends Control
## Real In-Game Menu for KI Legends (opened by the MENU button or Android Back / ESC).
## Completely separate from GM Panel. Provides Resume, Switch Character, Live Audio Controls,
## Controls Reference, Logout, and Quit Game — all styled with the seamless Forged Obsidian & Gold UI.

const ForgedUI := preload("res://scripts/forged_ui.gd")
const MapStyle := preload("res://scripts/map_style.gd")

var world: Node2D
var panel := PanelContainer.new()
var show_help := false

var music_val_lbl := Label.new()
var sfx_val_lbl := Label.new()
var help_box := PanelContainer.new()
var btn_help := Button.new()

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	z_index = 95
	visible = false

	var dim := ColorRect.new()
	dim.color = Color(0.015, 0.012, 0.025, 0.85)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	dim.gui_input.connect(func(ev: InputEvent) -> void:
		if ev is InputEventMouseButton and ev.pressed and ev.button_index == MOUSE_BUTTON_LEFT:
			close_menu()
	)
	add_child(dim)

	panel.add_theme_stylebox_override("panel", ForgedUI.panel_box(42.0, 38.0))
	add_child(panel)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 12)
	panel.add_child(vbox)

	vbox.add_child(ForgedUI.make_header_bar("MENU GRY", close_menu, "← WSTECZ", "Ustawienia, dźwięk i nawigacja bohatera"))

	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	vbox.add_child(scroll)

	var body := VBoxContainer.new()
	body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	body.add_theme_constant_override("separation", 10)
	scroll.add_child(body)

	# 1. Resume
	var btn_resume := Button.new()
	btn_resume.text = "▶  WZNÓW GRĘ"
	btn_resume.custom_minimum_size = Vector2(0, 58)
	ForgedUI.style_button(btn_resume, "gold", 20)
	btn_resume.pressed.connect(close_menu)
	body.add_child(btn_resume)

	# 2. Switch Character
	var btn_switch := Button.new()
	btn_switch.text = "⇄  ZMIEŃ POSTAĆ"
	btn_switch.custom_minimum_size = Vector2(0, 54)
	ForgedUI.style_button(btn_switch, "slate", 18)
	btn_switch.pressed.connect(func() -> void:
		_play_click()
		close_menu()
		if world != null and world.has_method("request_change_character"):
			world.request_change_character()
	)
	body.add_child(btn_switch)

	# 3. Audio Controls Card
	var aud_card := PanelContainer.new()
	aud_card.add_theme_stylebox_override("panel", ForgedUI.inset_card(Color(0.76, 0.58, 0.28, 0.72), Color(0.06, 0.055, 0.085, 0.94), 14, 12))
	body.add_child(aud_card)

	var aud_vb := VBoxContainer.new()
	aud_vb.add_theme_constant_override("separation", 10)
	aud_card.add_child(aud_vb)

	var aud_hdr := Label.new()
	aud_hdr.text = "DŹWIĘK I MUZYKA"
	aud_hdr.add_theme_font_override("font", MapStyle.font())
	aud_hdr.add_theme_font_size_override("font_size", 16)
	aud_hdr.add_theme_color_override("font_color", Color(1.0, 0.88, 0.54))
	aud_vb.add_child(aud_hdr)

	aud_vb.add_child(_make_vol_row("Muzyka świata", music_val_lbl, func(d: float) -> void: _adjust_music(d)))
	aud_vb.add_child(_make_vol_row("Efekty walki i UI", sfx_val_lbl, func(d: float) -> void: _adjust_sfx(d)))

	# 4. Controls Guide Toggle
	btn_help.text = "STEROWANIE I POMOC  ▾"
	btn_help.custom_minimum_size = Vector2(0, 50)
	ForgedUI.style_button(btn_help, "slate", 17)
	btn_help.pressed.connect(func() -> void:
		_play_click()
		show_help = not show_help
		help_box.visible = show_help
		btn_help.text = "STEROWANIE I POMOC  ▴" if show_help else "STEROWANIE I POMOC  ▾"
	)
	body.add_child(btn_help)

	help_box.add_theme_stylebox_override("panel", ForgedUI.inset_card(Color(0.48, 0.42, 0.34, 0.70), Color(0.05, 0.045, 0.075, 0.95), 14, 12))
	help_box.visible = false
	var help_lbl := Label.new()
	help_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	help_lbl.add_theme_font_override("font", MapStyle.body_font())
	help_lbl.add_theme_font_size_override("font_size", 15)
	help_lbl.add_theme_color_override("font_color", Color(0.92, 0.88, 0.80))
	help_lbl.text = "• Lewy dolny róg ekranu: wirtualny joystick (martwa strefa 14 px) lub dotknięcie ziemi po prawej.\n• Prawy dolny róg: Atak combo (4 ciosy), 4 umiejętności rasy, Tryb Ki [R] i szybka Mikstura Życia.\n• Prawy górny róg (Minimapa): kliknięcie otwiera pełną Mapę Świata Superior z płynnym przybliżaniem.\n• Przycisk Wstecz na telefonie zawsze zamyka bieżące okno lub otwiera to Menu."
	help_box.add_child(help_lbl)
	body.add_child(help_box)

	# 5. Bottom Danger Row: Logout + Quit
	var foot := HBoxContainer.new()
	foot.add_theme_constant_override("separation", 12)
	body.add_child(foot)

	var btn_logout := Button.new()
	btn_logout.text = "WYLOGUJ KONTO"
	btn_logout.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	btn_logout.custom_minimum_size = Vector2(0, 54)
	ForgedUI.style_button(btn_logout, "crimson", 16)
	btn_logout.pressed.connect(func() -> void:
		_play_click()
		close_menu()
		if world != null and world.has_method("request_logout"):
			world.request_logout()
	)
	foot.add_child(btn_logout)

	var btn_quit := Button.new()
	btn_quit.text = "WYJDŹ Z GRY"
	btn_quit.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	btn_quit.custom_minimum_size = Vector2(0, 54)
	ForgedUI.style_button(btn_quit, "crimson", 16)
	btn_quit.pressed.connect(func() -> void:
		_play_click()
		if world != null and world.has_method("request_quit_game"):
			world.request_quit_game()
		else:
			get_tree().quit()
	)
	foot.add_child(btn_quit)

	resized.connect(_layout)
	_layout()

func _make_vol_row(label_txt: String, val_lbl: Label, cb: Callable) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)

	var lbl := Label.new()
	lbl.text = label_txt
	lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	lbl.add_theme_font_override("font", MapStyle.body_font())
	lbl.add_theme_font_size_override("font_size", 16)
	lbl.add_theme_color_override("font_color", Color(0.94, 0.90, 0.82))
	row.add_child(lbl)

	var b_minus := Button.new()
	b_minus.text = "−"
	b_minus.custom_minimum_size = Vector2(48, 44)
	ForgedUI.style_square_button(b_minus, "slate", 22)
	b_minus.pressed.connect(func() -> void: cb.call(-0.10))
	row.add_child(b_minus)

	val_lbl.custom_minimum_size = Vector2(72, 0)
	val_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	val_lbl.add_theme_font_override("font", MapStyle.font())
	val_lbl.add_theme_font_size_override("font_size", 17)
	val_lbl.add_theme_color_override("font_color", Color(1.0, 0.90, 0.56))
	row.add_child(val_lbl)

	var b_plus := Button.new()
	b_plus.text = "+"
	b_plus.custom_minimum_size = Vector2(48, 44)
	ForgedUI.style_square_button(b_plus, "slate", 22)
	b_plus.pressed.connect(func() -> void: cb.call(0.10))
	row.add_child(b_plus)
	return row

func _play_click() -> void:
	if world != null and world.get("audio") != null:
		world.audio.sfx("ui/click")

func _adjust_music(delta_v: float) -> void:
	if world == null or world.get("audio") == null:
		return
	var nv := clampf(float(world.audio.music_volume) + delta_v, 0.0, 1.0)
	world.audio.set_volumes(nv, float(world.audio.sfx_volume))
	if world.has_method("notify_audio_changed"):
		world.notify_audio_changed(nv, float(world.audio.sfx_volume))
	_play_click()
	_sync_labels()

func _adjust_sfx(delta_v: float) -> void:
	if world == null or world.get("audio") == null:
		return
	var nv := clampf(float(world.audio.sfx_volume) + delta_v, 0.0, 1.0)
	world.audio.set_volumes(float(world.audio.music_volume), nv)
	if world.has_method("notify_audio_changed"):
		world.notify_audio_changed(float(world.audio.music_volume), nv)
	_play_click()
	_sync_labels()

func _sync_labels() -> void:
	var mv := 0.35
	var sv := 0.70
	if world != null and world.get("audio") != null:
		mv = float(world.audio.music_volume)
		sv = float(world.audio.sfx_volume)
	music_val_lbl.text = "WYŁ" if mv <= 0.01 else ("%d%%" % int(round(mv * 100.0)))
	sfx_val_lbl.text = "WYŁ" if sv <= 0.01 else ("%d%%" % int(round(sv * 100.0)))

func _layout() -> void:
	var vs := get_viewport_rect().size
	if vs.x < 100.0:
		vs = size
	var pw := clampf(vs.x * 0.56, 580.0, 720.0)
	var ph := clampf(vs.y * 0.88, 520.0, 648.0)
	panel.size = Vector2(pw, ph)
	panel.position = Vector2((vs.x - pw) * 0.5, (vs.y - ph) * 0.5)

func open_menu() -> void:
	_sync_labels()
	_layout()
	visible = true
	if world != null and world.get("audio") != null:
		world.audio.sfx("ui/open")

func close_menu() -> void:
	if not visible:
		return
	visible = false
	if world != null and world.get("audio") != null:
		world.audio.sfx("ui/close")
	if world != null and world.has_method("layout_minimap"):
		world.layout_minimap()

func toggle_menu() -> void:
	if visible:
		close_menu()
	else:
		open_menu()
