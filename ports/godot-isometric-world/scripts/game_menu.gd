extends Control
## Studio-Grade 4-Tab Forged Obsidian & Gold Game Menu for KI Legends.
## Tabs:
##   1. GRA       — Resume, Quick Map / Return to Capital, Camera Zoom slider + presets, Time-of-Day selector, Controls guide.
##   2. DŹWIĘK    — Master Mute, smooth HSliders for Continent Music, World Ambience & Combat/UI SFX, Live Test SFX, Reset.
##   3. UKŁAD HUD — Launch Live On-Screen Drag-and-Drop HUD Editor, HUD Scale slider/presets, Phone Safe-Margin preset, Reset.
##   4. KONTO     — Hero summary, Switch Character, Logout, Quit Game.

const ForgedUI := preload("res://scripts/forged_ui.gd")
const MapStyle := preload("res://scripts/map_style.gd")

var world: Node2D
var panel := PanelContainer.new()
var active_tab := "game"
var tab_btns: Dictionary = {}
var tab_pages: Dictionary = {}
var header_sub_lbl: Label

# Live synced controls
var zoom_slider := HSlider.new()
var zoom_val_lbl := Label.new()
var zoom_preset_btns: Array[Button] = []
var time_btns: Array[Button] = []

var btn_mute := Button.new()
var music_slider := HSlider.new()
var music_val_lbl := Label.new()
var amb_slider := HSlider.new()
var amb_val_lbl := Label.new()
var sfx_slider := HSlider.new()
var sfx_val_lbl := Label.new()

var hud_scale_slider := HSlider.new()
var hud_scale_lbl := Label.new()
var hud_scale_btns: Array[Button] = []
var btn_perf_hud := Button.new()

var account_info_lbl := Label.new()
var _syncing_ui := false

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	z_index = 95
	visible = false

	var dim := ColorRect.new()
	dim.color = Color(0.012, 0.010, 0.022, 0.84)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	dim.gui_input.connect(func(ev: InputEvent) -> void:
		if ev is InputEventMouseButton and ev.pressed and ev.button_index == MOUSE_BUTTON_LEFT:
			close_menu()
	)
	add_child(dim)

	panel.add_theme_stylebox_override("panel", ForgedUI.panel_box(36.0, 30.0))
	add_child(panel)

	var root_v := VBoxContainer.new()
	root_v.add_theme_constant_override("separation", 12)
	panel.add_child(root_v)

	var hdr := ForgedUI.make_header_bar("MENU GRY", close_menu, "← WZNÓW", "KI Legends • Planeta Superior")
	root_v.add_child(hdr)
	for ch in hdr.get_children():
		if ch is VBoxContainer:
			var sub_children := ch.get_children()
			if sub_children.size() >= 2 and sub_children[1] is Label:
				header_sub_lbl = sub_children[1] as Label

	# 4 Forged Navigation Tabs
	var tab_row := HBoxContainer.new()
	tab_row.add_theme_constant_override("separation", 8)
	root_v.add_child(tab_row)
	var tab_defs := [
		["game", "⚔ GRA"],
		["audio", "🔊 DŹWIĘK"],
		["hud", "✥ UKŁAD HUD"],
		["account", "👤 KONTO"],
	]
	for td: Array in tab_defs:
		var tid := str(td[0])
		var tb := Button.new()
		tb.text = str(td[1])
		tb.custom_minimum_size = Vector2(0, 48)
		tb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		tb.pressed.connect(func() -> void: _select_tab(tid, true))
		tab_row.add_child(tb)
		tab_btns[tid] = tb

	# Scrollable Tab Content Area
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	root_v.add_child(scroll)

	var pages_holder := VBoxContainer.new()
	pages_holder.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(pages_holder)

	tab_pages["game"] = _build_game_tab()
	tab_pages["audio"] = _build_audio_tab()
	tab_pages["hud"] = _build_hud_tab()
	tab_pages["account"] = _build_account_tab()
	for k in tab_pages.keys():
		var pg: Control = tab_pages[k]
		pg.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		pages_holder.add_child(pg)

	# Permanent Always-Visible Bottom Session Bar (visible immediately on ALL tabs!)
	var sep := ColorRect.new()
	sep.custom_minimum_size = Vector2(0, 2)
	sep.color = Color(0.84, 0.66, 0.30, 0.45)
	root_v.add_child(sep)

	var footer := HBoxContainer.new()
	footer.add_theme_constant_override("separation", 8)
	root_v.add_child(footer)

	var f_resume := Button.new()
	f_resume.text = "▶ WZNÓW"
	f_resume.custom_minimum_size = Vector2(0, 48)
	f_resume.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	ForgedUI.style_button(f_resume, "gold", 15, 14.0, 8.0)
	f_resume.pressed.connect(close_menu)
	footer.add_child(f_resume)

	var f_char := Button.new()
	f_char.text = "⇄ ZMIEŃ POSTAĆ"
	f_char.custom_minimum_size = Vector2(0, 48)
	f_char.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	ForgedUI.style_button(f_char, "slate", 14, 12.0, 8.0)
	f_char.pressed.connect(func() -> void:
		_play_click()
		close_menu()
		if world != null and world.has_method("request_change_character"):
			world.request_change_character()
	)
	footer.add_child(f_char)

	var f_logout := Button.new()
	f_logout.text = "WYLOGUJ"
	f_logout.custom_minimum_size = Vector2(130, 48)
	ForgedUI.style_button(f_logout, "slate", 14, 12.0, 8.0)
	f_logout.pressed.connect(func() -> void:
		_play_click()
		close_menu()
		if world != null and world.has_method("request_logout"):
			world.request_logout()
	)
	footer.add_child(f_logout)

	var f_quit := Button.new()
	f_quit.text = "✕ WYJDŹ Z GRY"
	f_quit.custom_minimum_size = Vector2(180, 48)
	f_quit.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	ForgedUI.style_button(f_quit, "crimson", 15, 14.0, 8.0)
	f_quit.pressed.connect(func() -> void:
		_play_click()
		if world != null and world.has_method("request_quit_game"):
			world.request_quit_game()
		else:
			get_tree().quit()
	)
	footer.add_child(f_quit)

	_select_tab("game", false)
	resized.connect(_layout)
	_layout()

func _section_card(title: String) -> Array:
	var card := PanelContainer.new()
	card.add_theme_stylebox_override("panel", ForgedUI.inset_card(Color(0.76, 0.58, 0.28, 0.76), Color(0.055, 0.050, 0.082, 0.95), 18, 14))
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 10)
	card.add_child(vb)
	var lbl := Label.new()
	lbl.text = title
	lbl.add_theme_font_override("font", MapStyle.font())
	lbl.add_theme_font_size_override("font_size", 19)
	lbl.add_theme_color_override("font_color", Color(1.0, 0.90, 0.56))
	vb.add_child(lbl)
	return [card, vb]

func _style_slider(sl: HSlider) -> void:
	sl.custom_minimum_size = Vector2(200, 38)
	sl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var bg := StyleBoxFlat.new()
	bg.bg_color = Color(0.08, 0.07, 0.11, 0.96)
	bg.border_color = Color(0.55, 0.42, 0.22, 0.85)
	bg.set_border_width_all(1)
	bg.set_corner_radius_all(6)
	bg.content_margin_top = 7
	bg.content_margin_bottom = 7
	var fill := StyleBoxFlat.new()
	fill.bg_color = Color(0.92, 0.70, 0.26, 0.96)
	fill.set_corner_radius_all(6)
	var fill_hl := StyleBoxFlat.new()
	fill_hl.bg_color = Color(1.0, 0.84, 0.40, 1.0)
	fill_hl.set_corner_radius_all(6)
	sl.add_theme_stylebox_override("slider", bg)
	sl.add_theme_stylebox_override("grabber_area", fill)
	sl.add_theme_stylebox_override("grabber_area_highlight", fill_hl)

func _make_slider_row(title: String, sl: HSlider, val_lbl: Label, min_v: float, max_v: float, step_v: float, on_change: Callable) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 14)
	var lbl := Label.new()
	lbl.text = title
	lbl.custom_minimum_size = Vector2(260, 0)
	lbl.add_theme_font_override("font", MapStyle.body_font())
	lbl.add_theme_font_size_override("font_size", 18)
	lbl.add_theme_color_override("font_color", Color(0.96, 0.92, 0.84))
	row.add_child(lbl)

	sl.min_value = min_v
	sl.max_value = max_v
	sl.step = step_v
	_style_slider(sl)
	sl.value_changed.connect(func(v: float) -> void:
		if not _syncing_ui:
			on_change.call(v)
	)
	row.add_child(sl)

	val_lbl.custom_minimum_size = Vector2(82, 0)
	val_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	val_lbl.add_theme_font_override("font", MapStyle.font())
	val_lbl.add_theme_font_size_override("font_size", 19)
	val_lbl.add_theme_color_override("font_color", Color(1.0, 0.90, 0.56))
	row.add_child(val_lbl)
	return row

func _build_game_tab() -> VBoxContainer:
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 12)

	# Quick primary actions
	var top_row := HBoxContainer.new()
	top_row.add_theme_constant_override("separation", 12)
	box.add_child(top_row)

	var btn_resume := Button.new()
	btn_resume.text = "▶  WZNÓW GRĘ"
	btn_resume.custom_minimum_size = Vector2(0, 60)
	btn_resume.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	ForgedUI.style_button(btn_resume, "gold", 20)
	btn_resume.pressed.connect(close_menu)
	top_row.add_child(btn_resume)

	var btn_map := Button.new()
	btn_map.text = "🗺 MAPA ŚWIATA"
	btn_map.custom_minimum_size = Vector2(0, 60)
	btn_map.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	ForgedUI.style_button(btn_map, "slate", 19)
	btn_map.pressed.connect(func() -> void:
		_play_click()
		close_menu()
		if world != null and world.has_method("open_world_map_on_hero"):
			world.open_world_map_on_hero()
	)
	top_row.add_child(btn_map)

	var btn_cap := Button.new()
	btn_cap.text = "🏰 STOLICA"
	btn_cap.custom_minimum_size = Vector2(180, 60)
	ForgedUI.style_button(btn_cap, "slate", 19)
	btn_cap.pressed.connect(func() -> void:
		_play_click()
		close_menu()
		if world != null and world.has_method("teleport_to_capital"):
			world.teleport_to_capital()
	)
	top_row.add_child(btn_cap)

	# Performance & Network Telemetry Card (FPS + Ping) — visible immediately without scrolling!
	var perf_pair := _section_card("WYDAJNOŚĆ I SIEĆ (FPS / PING)")
	box.add_child(perf_pair[0] as Control)
	var perf_vb: VBoxContainer = perf_pair[1]
	btn_perf_hud.custom_minimum_size = Vector2(0, 52)
	btn_perf_hud.pressed.connect(func() -> void:
		if world != null and world.get("rpg_hud") != null and world.rpg_hud.has_method("set_perf_hud_enabled"):
			var next_on := not bool(world.rpg_hud.is_perf_hud_enabled())
			world.rpg_hud.set_perf_hud_enabled(next_on, true)
			if world.get("audio") != null:
				world.audio.sfx("ui/toggle-on" if next_on else "ui/click", 0.85, 0.02)
		_sync_ui_values()
	)
	perf_vb.add_child(btn_perf_hud)
	var perf_desc := Label.new()
	perf_desc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	perf_desc.add_theme_font_override("font", MapStyle.body_font())
	perf_desc.add_theme_font_size_override("font_size", 17)
	perf_desc.add_theme_color_override("font_color", Color(0.82, 0.88, 0.94))
	perf_desc.text = "Wyświetla pod minimapą licznik klatek na sekundę (FPS) oraz bieżące opóźnienie do serwera (Ping ms)."
	perf_vb.add_child(perf_desc)

	# Camera Zoom Card
	var cam_pair := _section_card("KAMERA I ODDALENIE WIDOKU")
	box.add_child(cam_pair[0] as Control)
	var cam_vb: VBoxContainer = cam_pair[1]
	cam_vb.add_child(_make_slider_row("Przybliżenie kamery", zoom_slider, zoom_val_lbl, 0.72, 1.95, 0.05, func(v: float) -> void:
		if world != null and world.has_method("set_zoom"):
			world.set_zoom(v)
		_sync_ui_values()
	))
	var z_row := HBoxContainer.new()
	z_row.add_theme_constant_override("separation", 10)
	cam_vb.add_child(z_row)
	for zp: Array in [[0.85, "DALEKO (0.85×)"], [1.15, "DOMYŚLNIE (1.15×)"], [1.50, "BLISKO (1.50×)"]]:
		var zb := Button.new()
		zb.text = str(zp[1])
		zb.custom_minimum_size = Vector2(0, 50)
		zb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var zv := float(zp[0])
		zb.pressed.connect(func() -> void:
			_play_click()
			if world != null and world.has_method("set_zoom"):
				world.set_zoom(zv)
			_sync_ui_values()
		)
		z_row.add_child(zb)
		zoom_preset_btns.append(zb)

	# Time of Day Card
	var tod_pair := _section_card("PORA DNIA I ATMOSFERA ŚWIATA")
	box.add_child(tod_pair[0] as Control)
	var tod_vb: VBoxContainer = tod_pair[1]
	var tod_row := HBoxContainer.new()
	tod_row.add_theme_constant_override("separation", 10)
	tod_vb.add_child(tod_row)
	var tod_labels := ["☀ DZIEŃ", "🌤 ZŁOTA GODZ.", "🌅 ZMIERZCH", "🌙 NOC"]
	for ti in tod_labels.size():
		var tb := Button.new()
		tb.text = tod_labels[ti]
		tb.custom_minimum_size = Vector2(0, 50)
		tb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var idx := ti
		tb.pressed.connect(func() -> void:
			_play_click()
			if world != null and world.get("atmosphere") != null and world.atmosphere.has_method("set_time_mode"):
				var lbl: String = str(world.atmosphere.set_time_mode(idx))
				if world.get("rpg_hud") != null:
					world.rpg_hud.set_time_label(lbl)
			_sync_ui_values()
		)
		tod_row.add_child(tb)
		time_btns.append(tb)

	# Compact Controls Guide Card
	var help_pair := _section_card("STEROWANIE I NAWIGACJA")
	box.add_child(help_pair[0] as Control)
	var help_lbl := Label.new()
	help_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	help_lbl.add_theme_font_override("font", MapStyle.body_font())
	help_lbl.add_theme_font_size_override("font_size", 17)
	help_lbl.add_theme_color_override("font_color", Color(0.92, 0.90, 0.84))
	help_lbl.text = "• Ruch: wirtualny joystick w lewym dolnym rogu (lekkie wychylenie = chód, pełne = bieg).\n• Duża Mapa Świata (tap na minimapę): szybka podróż do Stolic i odkrytych Kamieni Szlaku (✦).\n• Kamień Powrotu [C] / przycisk POWRÓT: darmowy powrót do bezpiecznej stolicy (2,5 s).\n• Walka: prawy dolny łuk umiejętności (Combo [Q], 1–4, Forma KI [R] od Poz. 20 oraz Mikstura [H])."
	(help_pair[1] as VBoxContainer).add_child(help_lbl)
	return box

func _build_audio_tab() -> VBoxContainer:
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 12)

	var aud_pair := _section_card("MIKSER DŹWIĘKU KI LEGENDS")
	box.add_child(aud_pair[0] as Control)
	var vb: VBoxContainer = aud_pair[1]

	btn_mute.custom_minimum_size = Vector2(0, 54)
	btn_mute.pressed.connect(func() -> void:
		if world != null and world.get("audio") != null:
			var next_m := not bool(world.audio.muted)
			world.audio.set_muted(next_m)
			if not next_m:
				world.audio.sfx("ui/toggle-on", 0.85, 0.02)
		_sync_ui_values()
	)
	vb.add_child(btn_mute)

	vb.add_child(_make_slider_row("Muzyka kontynentu", music_slider, music_val_lbl, 0.0, 1.0, 0.05, func(v: float) -> void:
		_apply_audio(v, -1.0, -1.0)
	))
	vb.add_child(_make_slider_row("Otoczenie i natura", amb_slider, amb_val_lbl, 0.0, 1.0, 0.05, func(v: float) -> void:
		_apply_audio(-1.0, -1.0, v)
	))
	vb.add_child(_make_slider_row("Efekty walki i UI", sfx_slider, sfx_val_lbl, 0.0, 1.0, 0.05, func(v: float) -> void:
		_apply_audio(-1.0, v, -1.0)
	))

	var btn_row := HBoxContainer.new()
	btn_row.add_theme_constant_override("separation", 12)
	vb.add_child(btn_row)

	var btn_test := Button.new()
	btn_test.text = "▶  TESTUJ DŹWIĘK UMIEJĘTNOŚCI"
	btn_test.custom_minimum_size = Vector2(0, 54)
	btn_test.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	ForgedUI.style_button(btn_test, "gold", 18)
	btn_test.pressed.connect(func() -> void:
		if world != null and world.get("audio") != null:
			var rk: String = str(world._hero_race_key()) if world.has_method("_hero_race_key") else "legend"
			world.audio.play_test_chime(rk)
	)
	btn_row.add_child(btn_test)

	var btn_reset_a := Button.new()
	btn_reset_a.text = "↺ DOMYŚLNE"
	btn_reset_a.custom_minimum_size = Vector2(180, 54)
	ForgedUI.style_button(btn_reset_a, "slate", 18)
	btn_reset_a.pressed.connect(func() -> void:
		if world != null and world.get("audio") != null:
			world.audio.set_muted(false)
		_apply_audio(0.45, 0.80, 0.55)
		_play_click()
	)
	btn_row.add_child(btn_reset_a)

	var note := Label.new()
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	note.add_theme_font_override("font", MapStyle.body_font())
	note.add_theme_font_size_override("font_size", 17)
	note.add_theme_color_override("font_color", Color(0.82, 0.88, 0.94))
	note.text = "Aktywne ścieżki: 4 motywy kontynentów, 4 ścieżki labiryntów, tła miejskie i dziczy, 40 dźwięków umiejętności ras oraz 40 premium odgłosów potworów."
	vb.add_child(note)
	return box

func _build_hud_tab() -> VBoxContainer:
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 12)

	var ed_pair := _section_card("MODYFIKACJA POŁOŻENIA HUDU I PRZYCISKÓW")
	box.add_child(ed_pair[0] as Control)
	var vb: VBoxContainer = ed_pair[1]

	var desc := Label.new()
	desc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	desc.add_theme_font_override("font", MapStyle.body_font())
	desc.add_theme_font_size_override("font_size", 17)
	desc.add_theme_color_override("font_color", Color(0.92, 0.89, 0.82))
	desc.text = "Przeciągnij palcem każdy blok interfejsu bezpośrednio na ekranie gry: Portret i HP, Przyciski Menu, Minimapę, Przyciski Walki (łuk umiejętności + mikstura) oraz Pasek PD."
	vb.add_child(desc)

	var btn_edit := Button.new()
	btn_edit.text = "✎  EDYTUJ POŁOŻENIE HUDU NA EKRANIE"
	btn_edit.custom_minimum_size = Vector2(0, 60)
	ForgedUI.style_button(btn_edit, "gold", 19)
	btn_edit.pressed.connect(func() -> void:
		_play_click()
		if world != null and world.has_method("start_hud_editor"):
			world.start_hud_editor()
	)
	vb.add_child(btn_edit)

	vb.add_child(_make_slider_row("Skala przycisków i minimapy", hud_scale_slider, hud_scale_lbl, 0.80, 1.25, 0.05, func(v: float) -> void:
		if world != null and world.get("rpg_hud") != null and world.rpg_hud.has_method("set_hud_scale"):
			world.rpg_hud.set_hud_scale(v, true)
		_sync_ui_values()
	))

	var sc_row := HBoxContainer.new()
	sc_row.add_theme_constant_override("separation", 10)
	vb.add_child(sc_row)
	for sp: Array in [[0.85, "MAŁY (85%)"], [1.00, "STANDARD (100%)"], [1.15, "DUŻY (115%)"]]:
		var sb := Button.new()
		sb.text = str(sp[1])
		sb.custom_minimum_size = Vector2(0, 50)
		sb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var sv := float(sp[0])
		sb.pressed.connect(func() -> void:
			_play_click()
			if world != null and world.get("rpg_hud") != null and world.rpg_hud.has_method("set_hud_scale"):
				world.rpg_hud.set_hud_scale(sv, true)
			_sync_ui_values()
		)
		sc_row.add_child(sb)
		hud_scale_btns.append(sb)

	var pre_row := HBoxContainer.new()
	pre_row.add_theme_constant_override("separation", 12)
	vb.add_child(pre_row)

	var btn_safe := Button.new()
	btn_safe.text = "📱 MARGINES TELEFONU (NOTCH)"
	btn_safe.custom_minimum_size = Vector2(0, 52)
	btn_safe.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	ForgedUI.style_button(btn_safe, "slate", 18)
	btn_safe.pressed.connect(func() -> void:
		_play_click()
		if world != null and world.get("rpg_hud") != null and world.rpg_hud.has_method("apply_phone_safe_preset"):
			world.rpg_hud.apply_phone_safe_preset()
		_sync_ui_values()
	)
	pre_row.add_child(btn_safe)

	var btn_reset_h := Button.new()
	btn_reset_h.text = "↺ RESETUJ UKŁAD HUD"
	btn_reset_h.custom_minimum_size = Vector2(0, 52)
	btn_reset_h.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	ForgedUI.style_button(btn_reset_h, "slate", 18)
	btn_reset_h.pressed.connect(func() -> void:
		_play_click()
		if world != null and world.get("rpg_hud") != null and world.rpg_hud.has_method("reset_hud_layout"):
			world.rpg_hud.reset_hud_layout(true)
		_sync_ui_values()
	)
	pre_row.add_child(btn_reset_h)
	return box

func _build_account_tab() -> VBoxContainer:
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 12)

	var info_pair := _section_card("AKTYWNA POSTAĆ I SESJA")
	box.add_child(info_pair[0] as Control)
	account_info_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	account_info_lbl.add_theme_font_override("font", MapStyle.body_font())
	account_info_lbl.add_theme_font_size_override("font_size", 18)
	account_info_lbl.add_theme_color_override("font_color", Color(0.96, 0.93, 0.85))
	(info_pair[1] as VBoxContainer).add_child(account_info_lbl)

	var btn_switch := Button.new()
	btn_switch.text = "⇄  ZMIEŃ POSTAĆ"
	btn_switch.custom_minimum_size = Vector2(0, 58)
	ForgedUI.style_button(btn_switch, "gold", 19)
	btn_switch.pressed.connect(func() -> void:
		_play_click()
		close_menu()
		if world != null and world.has_method("request_change_character"):
			world.request_change_character()
	)
	box.add_child(btn_switch)

	var foot := HBoxContainer.new()
	foot.add_theme_constant_override("separation", 12)
	box.add_child(foot)

	var btn_logout := Button.new()
	btn_logout.text = "WYLOGUJ KONTO"
	btn_logout.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	btn_logout.custom_minimum_size = Vector2(0, 56)
	ForgedUI.style_button(btn_logout, "crimson", 18)
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
	btn_quit.custom_minimum_size = Vector2(0, 56)
	ForgedUI.style_button(btn_quit, "crimson", 18)
	btn_quit.pressed.connect(func() -> void:
		_play_click()
		if world != null and world.has_method("request_quit_game"):
			world.request_quit_game()
		else:
			get_tree().quit()
	)
	foot.add_child(btn_quit)
	return box

func _select_tab(tid: String, play_sfx: bool) -> void:
	active_tab = tid
	if play_sfx and world != null and world.get("audio") != null:
		world.audio.sfx("ui/tab", 0.78, 0.04)
	for k in tab_btns.keys():
		var tb: Button = tab_btns[k]
		ForgedUI.style_button(tb, "gold" if str(k) == active_tab else "slate", 18, 14.0, 9.0)
	for k in tab_pages.keys():
		(tab_pages[k] as Control).visible = (str(k) == active_tab)
	_sync_ui_values()

func _apply_audio(mv: float, sv: float, av: float) -> void:
	if world == null or world.get("audio") == null:
		return
	var cur_m := float(world.audio.music_volume) if mv < 0.0 else clampf(mv, 0.0, 1.0)
	var cur_s := float(world.audio.sfx_volume) if sv < 0.0 else clampf(sv, 0.0, 1.0)
	var cur_a := float(world.audio.ambience_volume) if av < 0.0 else clampf(av, 0.0, 1.0)
	world.audio.set_volumes(cur_m, cur_s, cur_a)
	if world.has_method("notify_audio_changed"):
		world.notify_audio_changed(cur_m, cur_s, cur_a)
	_sync_ui_values()

func _play_click() -> void:
	if world != null and world.get("audio") != null:
		world.audio.sfx("ui/click")

func _sync_ui_values() -> void:
	_syncing_ui = true
	var zl: float = float(world.zoom_level) if world != null else 1.15
	zoom_slider.value = zl
	zoom_val_lbl.text = "%.2f×" % zl
	var z_targets := [0.85, 1.15, 1.50]
	for i in mini(zoom_preset_btns.size(), z_targets.size()):
		ForgedUI.style_button(zoom_preset_btns[i], "gold" if absf(zl - float(z_targets[i])) < 0.08 else "slate", 17, 12.0, 8.0)

	var tmode := 0
	if world != null and world.get("atmosphere") != null and ("time_idx" in world.atmosphere):
		tmode = int(world.atmosphere.time_idx)
	for i in time_btns.size():
		ForgedUI.style_button(time_btns[i], "gold" if i == tmode else "slate", 17, 12.0, 8.0)

	var mv := 0.45
	var av := 0.55
	var sv := 0.80
	var is_muted := false
	if world != null and world.get("audio") != null:
		mv = float(world.audio.music_volume)
		av = float(world.audio.ambience_volume)
		sv = float(world.audio.sfx_volume)
		is_muted = bool(world.audio.muted)
	music_slider.value = mv
	amb_slider.value = av
	sfx_slider.value = sv
	music_val_lbl.text = "WYŁ" if (is_muted or mv <= 0.01) else ("%d%%" % int(round(mv * 100.0)))
	amb_val_lbl.text = "WYŁ" if (is_muted or av <= 0.01) else ("%d%%" % int(round(av * 100.0)))
	sfx_val_lbl.text = "WYŁ" if (is_muted or sv <= 0.01) else ("%d%%" % int(round(sv * 100.0)))
	btn_mute.text = "🔇  WSZYSTKIE DŹWIĘKI WYCISZONE (WŁĄCZ)" if is_muted else "🔊  DŹWIĘK AKTYWNY (WYCISZ)"
	ForgedUI.style_button(btn_mute, "crimson" if is_muted else "slate", 18, 16.0, 9.0)

	var perf_on := false
	if world != null and world.get("rpg_hud") != null and world.rpg_hud.has_method("is_perf_hud_enabled"):
		perf_on = bool(world.rpg_hud.is_perf_hud_enabled())
	btn_perf_hud.text = "📊  WYKAZ FPS I PING: WŁĄCZONY (UKRYJ)" if perf_on else "📊  WYKAZ FPS I PING: WYŁĄCZONY (WŁĄCZ)"
	ForgedUI.style_button(btn_perf_hud, "gold" if perf_on else "slate", 18, 16.0, 9.0)

	var hsc := 1.0
	if world != null and world.get("rpg_hud") != null and world.rpg_hud.has_method("get_hud_scale"):
		hsc = float(world.rpg_hud.get_hud_scale())
	hud_scale_slider.value = hsc
	hud_scale_lbl.text = "%d%%" % int(round(hsc * 100.0))
	var s_targets := [0.85, 1.00, 1.15]
	for i in mini(hud_scale_btns.size(), s_targets.size()):
		ForgedUI.style_button(hud_scale_btns[i], "gold" if absf(hsc - float(s_targets[i])) < 0.04 else "slate", 17, 12.0, 8.0)

	if world != null:
		var hname := str(world.start_name) if str(world.start_name) != "" else "Bohater"
		var hlv := int(world.rpg_hud.hero_level) if world.get("rpg_hud") != null else 1
		var hgold := int(world.rpg_hud.hero_gold) if world.get("rpg_hud") != null else 0
		var cname := str(world.region_title).split("—")[0].strip_edges()
		var hp_pos: Vector2 = world.hero_pos
		if header_sub_lbl != null:
			header_sub_lbl.text = "%s • Poz. %d • %s (%d, %d)" % [hname, hlv, cname, int(round(hp_pos.x)), int(round(hp_pos.y))]
		account_info_lbl.text = "Bohater: %s\nPoziom: %d   •   Złoto: %d szt.\nKontynent: %s   •   Współrzędne: (%d, %d)" % [
			hname, hlv, hgold, str(world.region_title), int(round(hp_pos.x)), int(round(hp_pos.y))
		]
	_syncing_ui = false

func _layout() -> void:
	var vs := get_viewport_rect().size
	if vs.x < 100.0:
		vs = size
	var pw := clampf(vs.x * 0.88, 760.0, 1280.0)
	var ph := clampf(vs.y * 0.94, 540.0, 696.0)
	panel.size = Vector2(pw, ph)
	panel.position = Vector2((vs.x - pw) * 0.5, (vs.y - ph) * 0.5)

func open_menu(tab: String = "") -> void:
	if not tab.is_empty() and tab_pages.has(tab):
		_select_tab(tab, false)
	else:
		_sync_ui_values()
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
