extends Control
## Volcanic Obsidian & Molten Gold Journal for Racial Heritage Chapters (6/race) and Racial Development Goals (6/race).
## Hydrates directly from authoritative server character payload (`character.goals`) and claims rewards via `claim_goal`.

const MapStyle := preload("res://scripts/map_style.gd")
const ForgedUI := preload("res://scripts/forged_ui.gd")

const FALLBACK_CHAPTERS := {
	"legend": [
		{"id": "H-P01", "title": "Rozdział 1: Imię pod popiołem", "mentor": "Kaena", "minLevel": 1, "xpReward": 100, "goldReward": 30, "summary": "Porównaj znak rodzinnej broni ze źródłami Kaeny w Twierdzy Popiołu."},
		{"id": "H-P02", "title": "Rozdział 2: Próba przerwania ciosu", "mentor": "Kaena", "minLevel": 4, "xpReward": 160, "goldReward": 40, "summary": "Opanuj kontrolę siły i osłonę przed niepotrzebnym uderzeniem."},
		{"id": "H-P03", "title": "Rozdział 3: Kowadło po mistrzu", "mentor": "Goro", "minLevel": 7, "xpReward": 240, "goldReward": 60, "summary": "Zbadaj trzy znaki na broni i dopisz własny podpis u kowala Goro."},
		{"id": "H-P04", "title": "Rozdział 4: Ci, którzy zawrócili", "mentor": "Kaena", "minLevel": 10, "xpReward": 360, "goldReward": 80, "summary": "Porównaj ślady dawnej ewakuacji z relacjami potomków straży."},
		{"id": "H-P05", "title": "Rozdział 5: Pojedynek bez widowni", "mentor": "Kaena", "minLevel": 14, "xpReward": 520, "goldReward": 100, "summary": "Stocz ćwiczebny pojedynek honorowy z poszanowaniem poddania."},
		{"id": "H-P06", "title": "Rozdział 6: Przysięga dla jutra", "mentor": "Kaena", "minLevel": 18, "xpReward": 720, "goldReward": 140, "summary": "Potwierdź własną przysięgę obrońcy Pyry osłoną odwrotu."},
	],
	"planetary": [
		{"id": "H-V01", "title": "Rozdział 1: Mapa zatopionych domów", "mentor": "Aira", "minLevel": 1, "xpReward": 100, "goldReward": 30, "summary": "Sprawdź rodzinny znacznik drogi z mapą osady u Airy."},
		{"id": "H-V02", "title": "Rozdział 2: Rzeka, która zawróciła", "mentor": "Aira", "minLevel": 4, "xpReward": 160, "goldReward": 40, "summary": "Zbadaj oba brzegi nurtu, aby naprawa nie odebrała wody sąsiadom."},
		{"id": "H-V03", "title": "Rozdział 3: Las nie rozpoznaje swoich", "mentor": "Taro", "minLevel": 7, "xpReward": 240, "goldReward": 60, "summary": "Zweryfikuj stare znaki strażników i przywróć zaufanie szlaku."},
		{"id": "H-V04", "title": "Rozdział 4: Pieśń bez ostatniej zwrotki", "mentor": "Aira", "minLevel": 10, "xpReward": 360, "goldReward": 80, "summary": "Zbierz relacje trzech rodzin i zapisz brakującą część pieśni."},
		{"id": "H-V05", "title": "Rozdział 5: Korzenie pamiętają", "mentor": "Aira", "minLevel": 14, "xpReward": 520, "goldReward": 100, "summary": "Poznaj cenę dawnego ratunku na podstawie trzech świadectw."},
		{"id": "H-V06", "title": "Rozdział 6: Nowy szlak", "mentor": "Aira", "minLevel": 18, "xpReward": 720, "goldReward": 140, "summary": "Sprawdź nowy szlak w praktyce i podpisz kronikę Verdantii."},
	],
	"sage": [
		{"id": "H-A01", "title": "Rozdział 1: Biała strona", "mentor": "Sora", "minLevel": 1, "xpReward": 100, "goldReward": 30, "summary": "Porównaj pieczęć na pustej stronie kroniki ze źródłami Sory."},
		{"id": "H-A02", "title": "Rozdział 2: Źródło dwóch wspomnień", "mentor": "Sora", "minLevel": 4, "xpReward": 160, "goldReward": 40, "summary": "Zestaw dwa świadectwa tego samego ratunku bez zacierania różnic."},
		{"id": "H-A03", "title": "Rozdział 3: Archiwista bez imienia", "mentor": "Enso", "minLevel": 7, "xpReward": 240, "goldReward": 60, "summary": "Odnajdź ślady pracy dawnego archiwisty i rozmów się z rodziną."},
		{"id": "H-A04", "title": "Rozdział 4: Biblioteka pod ogrodem", "mentor": "Sora", "minLevel": 10, "xpReward": 360, "goldReward": 80, "summary": "Uzyskaj zgodę opiekunów i sprawdź zabezpieczenia zamkniętych akt."},
		{"id": "H-A05", "title": "Rozdział 5: Cena ujawnienia", "mentor": "Sora", "minLevel": 14, "xpReward": 520, "goldReward": 100, "summary": "Zbierz trzy źródła i dwie zgody przed ogłoszeniem świadectwa."},
		{"id": "H-A06", "title": "Rozdział 6: Kronika z pustym miejscem", "mentor": "Sora", "minLevel": 18, "xpReward": 720, "goldReward": 140, "summary": "Zabezpiecz kopie archiwum i zachowaj miejsce dla przyszłych kronikarzy."},
	],
	"android": [
		{"id": "H-N01", "title": "Rozdział 1: Pakiet bez nadawcy", "mentor": "LYRA-7", "minLevel": 1, "xpReward": 100, "goldReward": 30, "summary": "Zbadaj pakiet bez podpisu razem z LYRA-7 w Węźle Świadomości."},
		{"id": "H-N02", "title": "Rozdział 2: Warsztat, którego nie ma", "mentor": "LYRA-7", "minLevel": 4, "xpReward": 160, "goldReward": 40, "summary": "Przywróć zasilanie zamkniętego warsztatu bez nadpisywania logów."},
		{"id": "H-N03", "title": "Rozdział 3: Jednostka poza listą", "mentor": "HEF-4", "minLevel": 7, "xpReward": 240, "goldReward": 60, "summary": "Zaproponuj alternatywne zasilanie odłączonej jednostce."},
		{"id": "H-N04", "title": "Rozdział 4: Rozkaz w pamięci", "mentor": "LYRA-7", "minLevel": 10, "xpReward": 360, "goldReward": 80, "summary": "Złóż trzy podpisane fragmenty rozkazu z zachowaniem pochodzenia."},
		{"id": "H-N05", "title": "Rozdział 5: Prawo do odmowy", "mentor": "LYRA-7", "minLevel": 14, "xpReward": 520, "goldReward": 100, "summary": "Zdiagnozuj usterkę rdzenia bez poświęcania cudzej pamięci."},
		{"id": "H-N06", "title": "Rozdział 6: Pierwszy zapis własny", "mentor": "LYRA-7", "minLevel": 18, "xpReward": 720, "goldReward": 140, "summary": "Przygotuj otwarty warsztat i podpisz własny wpis tożsamości."},
	],
}

var world: Node2D
var goals_data: Array = []
var active_tab := "story" # "story" | "heritage" | "development" | "adventure"
var local_claimed: Dictionary = {}

var backdrop := ColorRect.new()
var panel := Panel.new()
var status_lbl := Label.new()
var tab_story := Button.new()
var tab_heritage := Button.new()
var tab_dev := Button.new()
var tab_adv := Button.new()
var scroll := ScrollContainer.new()
var list_vbox := VBoxContainer.new()

func _ready() -> void:
	visible = false
	mouse_filter = Control.MOUSE_FILTER_STOP
	set_anchors_preset(Control.PRESET_FULL_RECT)
	_build_ui()
	resized.connect(_layout_panel)
	_layout_panel()

func _style_btn(btn: Button, bg: Color, border: Color, font_sz: int = 18) -> void:
	btn.custom_minimum_size.y = 52.0
	var variant := "gold" if (border.r > 0.90 and border.g > 0.72) else ("crimson" if (bg.r > 0.24 and bg.g < 0.14) else "slate")
	ForgedUI.style_button(btn, variant, maxi(font_sz, 17), 22.0, 9.0)

func _build_ui() -> void:
	backdrop.color = Color(0.015, 0.012, 0.025, 0.86)
	backdrop.set_anchors_preset(Control.PRESET_FULL_RECT)
	backdrop.gui_input.connect(func(ev: InputEvent) -> void:
		if ev is InputEventMouseButton and ev.pressed and ev.button_index == MOUSE_BUTTON_LEFT:
			close_journal()
	)
	add_child(backdrop)

	panel.add_theme_stylebox_override("panel", ForgedUI.panel_box(36.0, 32.0))
	panel.clip_contents = true
	add_child(panel)

	var inner_margin := MarginContainer.new()
	inner_margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	inner_margin.add_theme_constant_override("margin_left", 38)
	inner_margin.add_theme_constant_override("margin_right", 38)
	inner_margin.add_theme_constant_override("margin_top", 30)
	inner_margin.add_theme_constant_override("margin_bottom", 32)
	panel.add_child(inner_margin)

	var root_vb := VBoxContainer.new()
	root_vb.add_theme_constant_override("separation", 12)
	inner_margin.add_child(root_vb)

	root_vb.add_child(ForgedUI.make_header_bar("DZIENNIK ZADAŃ I ROZWOJU", close_journal, "← WSTECZ", "102 misje fabularne, reputacja frakcji, dziedzictwo i wyprawy"))

	var tabs_hb := HBoxContainer.new()
	tabs_hb.add_theme_constant_override("separation", 10)
	root_vb.add_child(tabs_hb)

	tab_story.text = "📜 PRZYGODY"
	tab_story.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tab_story.pressed.connect(func() -> void:
		active_tab = "story"
		_rebuild_list()
	)
	tabs_hb.add_child(tab_story)

	tab_heritage.text = "◆ DZIEDZICTWO (6)"
	tab_heritage.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tab_heritage.pressed.connect(func() -> void:
		active_tab = "heritage"
		_rebuild_list()
	)
	tabs_hb.add_child(tab_heritage)

	tab_dev.text = "★ CELE (6)"
	tab_dev.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tab_dev.pressed.connect(func() -> void:
		active_tab = "development"
		_rebuild_list()
	)
	tabs_hb.add_child(tab_dev)

	tab_adv.text = "⚔ WYPRAWY (6)"
	tab_adv.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tab_adv.pressed.connect(func() -> void:
		active_tab = "adventure"
		_rebuild_list()
	)
	tabs_hb.add_child(tab_adv)

	status_lbl.text = "Postęp i nagrody są weryfikowane oraz zapisywane na serwerze gry."
	status_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	status_lbl.add_theme_font_override("font", MapStyle.body_font())
	status_lbl.add_theme_font_size_override("font_size", 18)
	status_lbl.add_theme_color_override("font_color", Color(0.88, 0.92, 0.96))
	root_vb.add_child(status_lbl)

	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_AUTO
	scroll.clip_contents = true
	root_vb.add_child(scroll)

	list_vbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	list_vbox.add_theme_constant_override("separation", 10)
	scroll.add_child(list_vbox)

func _layout_panel() -> void:
	var vs := get_viewport_rect().size
	if vs.x < 100.0:
		vs = Vector2(1280.0, 720.0)
	var pw := clampf(vs.x - 32.0, 720.0, 1500.0)
	var ph := clampf(vs.y - 24.0, 480.0, 696.0)
	panel.set_anchors_preset(Control.PRESET_TOP_LEFT)
	panel.offset_left = (vs.x - pw) * 0.5
	panel.offset_top = (vs.y - ph) * 0.5
	panel.offset_right = panel.offset_left + pw
	panel.offset_bottom = panel.offset_top + ph
	panel.size = Vector2(pw, ph)

func apply_server_goals(goals: Array) -> void:
	goals_data = goals.duplicate(true)
	if visible:
		_rebuild_list()

func count_ready() -> int:
	var n := 0
	for g in _active_goals():
		if str((g as Dictionary).get("status", "")) == "ready":
			n += 1
	if world != null and world.get("quest_engine") != null:
		for qid: String in world.quest_engine.active_quests.keys():
			if world.quest_engine.is_quest_ready_to_turn_in(qid):
				n += 1
	return n

func open_journal() -> void:
	visible = true
	_layout_panel()
	_rebuild_list()

func close_journal() -> void:
	visible = false
	if world != null and world.has_method("layout_minimap"):
		world.layout_minimap()
	if world != null and world.get("rpg_hud") != null:
		world.rpg_hud._refresh_visuals()

func toggle_journal() -> void:
	if visible:
		close_journal()
	else:
		open_journal()

func _current_race() -> String:
	if world != null and world.rpg_hud != null and world.rpg_hud.has_method("_race_key"):
		return str(world.rpg_hud._race_key())
	return "legend"

func _active_goals() -> Array:
	if not goals_data.is_empty():
		return goals_data
	# Offline standalone QA fallback
	var rk := _current_race()
	var lv := int(world.rpg_hud.hero_level) if (world != null and world.rpg_hud != null) else 1
	var out: Array = []
	var chs: Array = FALLBACK_CHAPTERS.get(rk, FALLBACK_CHAPTERS["legend"])
	for idx in chs.size():
		var c: Dictionary = (chs[idx] as Dictionary).duplicate(true)
		var cid := str(c["id"])
		var prev_id := str((chs[idx - 1] as Dictionary)["id"]) if idx > 0 else ""
		var st := "ready"
		var ptxt := "Gotowe do ukończenia i odbioru nagrody!"
		if local_claimed.has(cid):
			st = "claimed"
			ptxt = "Ukończone ✓"
		elif idx > 0 and not local_claimed.has(prev_id):
			st = "locked"
			ptxt = "Wymaga ukończenia Rozdziału %d" % idx
		elif lv < int(c["minLevel"]):
			st = "locked"
			ptxt = "Wymagany poziom %d (masz %d)" % [int(c["minLevel"]), lv]
		c["kind"] = "heritage"
		c["status"] = st
		c["progressText"] = ptxt
		out.append(c)
	return out

func _rebuild_story_tab() -> void:
	if world == null or world.get("quest_engine") == null:
		return
	var jl: Dictionary = world.quest_engine.get_journal_lists(world.current_land)
	var fac: Dictionary = jl.get("factions", {})
	var rep_lbl := Label.new()
	rep_lbl.text = "Reputacja:  Pyra %d  •  Verdantia %d  •  Aetheria %d  •  Nexus-9 %d   |   Ukończone: %d / %d" % [
		int(fac.get("pyra", 0)), int(fac.get("verdant", 0)), int(fac.get("aether", 0)), int(fac.get("nexus", 0)),
		(jl.get("completed", []) as Array).size(), int(jl.get("total_playable", 102))
	]
	rep_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	rep_lbl.add_theme_font_override("font", MapStyle.body_font())
	rep_lbl.add_theme_font_size_override("font_size", 18)
	rep_lbl.add_theme_color_override("font_color", Color(0.56, 0.98, 0.90))
	list_vbox.add_child(rep_lbl)

	var sections := [
		["AKTYWNE MISJE", jl.get("active", []) as Array, "active"],
		["DOSTĘPNE W TYM REGIONIE", (jl.get("available", []) as Array).slice(0, 14), "available"],
	]
	for sec: Array in sections:
		var arr: Array = sec[1]
		var sh := Label.new()
		sh.text = "— %s (%d) —" % [str(sec[0]), arr.size()]
		sh.add_theme_font_override("font", MapStyle.font())
		sh.add_theme_font_size_override("font_size", 20)
		sh.add_theme_color_override("font_color", Color(1.0, 0.88, 0.44))
		list_vbox.add_child(sh)
		if arr.is_empty():
			var nl := Label.new()
			nl.text = "Brak misji w tej kategorii — porozmawiaj z NPC z wykrzyknikiem (!) w mieście."
			nl.add_theme_font_override("font", MapStyle.body_font())
			nl.add_theme_font_size_override("font_size", 18)
			nl.add_theme_color_override("font_color", Color(0.78, 0.80, 0.86))
			list_vbox.add_child(nl)
			continue
		for q: Dictionary in arr:
			var qid := str(q.get("id", ""))
			var is_act := str(sec[2]) == "active"
			var is_ready: bool = is_act and world.quest_engine.is_quest_ready_to_turn_in(qid)
			var card := PanelContainer.new()
			var cstyle := StyleBoxFlat.new()
			cstyle.bg_color = Color(0.14, 0.12, 0.07, 0.96) if is_ready else (Color(0.08, 0.12, 0.15, 0.94) if is_act else Color(0.09, 0.09, 0.13, 0.92))
			cstyle.border_color = Color(0.46, 0.98, 0.68, 0.96) if is_ready else (Color(0.36, 0.86, 1.0, 0.88) if is_act else Color(0.78, 0.64, 0.34, 0.72))
			cstyle.set_border_width_all(2)
			cstyle.set_corner_radius_all(10)
			cstyle.content_margin_left = 16
			cstyle.content_margin_right = 16
			cstyle.content_margin_top = 12
			cstyle.content_margin_bottom = 12
			card.add_theme_stylebox_override("panel", cstyle)
			list_vbox.add_child(card)
			var row := HBoxContainer.new()
			row.add_theme_constant_override("separation", 14)
			card.add_child(row)
			var left := VBoxContainer.new()
			left.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			left.add_theme_constant_override("separation", 4)
			row.add_child(left)
			var tl := Label.new()
			tl.text = "%s  [Poz.%d • %s]" % [str(q.get("title", qid)), int(q.get("recommendedLevel", 1)), str(q.get("giverName", ""))]
			tl.add_theme_font_override("font", MapStyle.font())
			tl.add_theme_font_size_override("font_size", 20)
			tl.add_theme_color_override("font_color", Color(0.46, 0.98, 0.72) if is_ready else Color(1.0, 0.92, 0.62))
			left.add_child(tl)
			var dl := Label.new()
			dl.text = str(q.get("summary", ""))
			dl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			dl.add_theme_font_override("font", MapStyle.body_font())
			dl.add_theme_font_size_override("font_size", 17)
			dl.add_theme_color_override("font_color", Color(0.88, 0.90, 0.94))
			left.add_child(dl)
			var btn := Button.new()
			btn.custom_minimum_size = Vector2(236, 54)
			if is_ready:
				btn.text = "★ ODBIERZ NAGRODĘ"
				_style_btn(btn, Color(0.28, 0.20, 0.05, 0.98), Color(1.0, 0.84, 0.30, 0.98), 18)
				btn.pressed.connect(func() -> void:
					world.quest_engine.complete_quest(qid)
					_rebuild_list()
				)
			elif is_act:
				var trk: bool = world.quest_engine.is_tracked(qid)
				btn.text = "✓ ŚLEDZONE" if trk else "★ ŚLEDŹ NA HUD"
				_style_btn(btn, Color(0.10, 0.24, 0.28, 0.95) if trk else Color(0.12, 0.12, 0.18, 0.94), Color(0.38, 0.94, 1.0, 0.94) if trk else Color(0.68, 0.60, 0.42, 0.80), 18)
				btn.pressed.connect(func() -> void:
					world.quest_engine.toggle_track(qid)
					_rebuild_list()
				)
			else:
				btn.text = "! PRZYJMIJ MISJĘ"
				_style_btn(btn, Color(0.26, 0.18, 0.05, 0.96), Color(1.0, 0.80, 0.30, 0.96), 18)
				btn.pressed.connect(func() -> void:
					world.quest_engine.accept_quest(qid)
					_rebuild_list()
				)
			row.add_child(btn)

func _rebuild_list() -> void:
	var all_g := _active_goals()
	var cnt_h := 0
	var cnt_d := 0
	var cnt_a := 0
	for item in all_g:
		var k := str((item as Dictionary).get("kind", "heritage"))
		if k == "heritage": cnt_h += 1
		elif k == "development": cnt_d += 1
		elif k == "adventure": cnt_a += 1
	var cnt_s: int = world.quest_engine.active_quests.size() if (world != null and world.get("quest_engine") != null) else 0
	tab_story.text = "📜 PRZYGODY (%d)" % cnt_s
	tab_heritage.text = "◆ DZIEDZICTWO (%d)" % cnt_h
	tab_dev.text = "★ CELE (%d)" % cnt_d
	tab_adv.text = "⚔ WYPRAWY (%d)" % cnt_a

	for pair: Array in [[tab_story, "story"], [tab_heritage, "heritage"], [tab_dev, "development"], [tab_adv, "adventure"]]:
		var tb: Button = pair[0]
		var on := active_tab == str(pair[1])
		_style_btn(
			tb,
			Color(0.30, 0.20, 0.06, 0.98) if on else Color(0.11, 0.11, 0.16, 0.94),
			Color(1.0, 0.80, 0.30, 0.98) if on else Color(0.50, 0.44, 0.34, 0.72),
			18
		)

	for ch in list_vbox.get_children():
		list_vbox.remove_child(ch)
		ch.queue_free()

	if active_tab == "story":
		_rebuild_story_tab()
		return

	var gm_script = preload("res://scripts/gm_panel.gd")
	var shown := 0
	for item in all_g:
		var g: Dictionary = item
		if str(g.get("kind", "heritage")) != active_tab:
			continue
		shown += 1
		var st := str(g.get("status", "locked"))
		var card := PanelContainer.new()
		var cstyle := StyleBoxFlat.new()
		cstyle.bg_color = Color(0.10, 0.14, 0.11, 0.94) if st == "claimed" else (Color(0.15, 0.12, 0.07, 0.96) if st == "ready" else Color(0.09, 0.09, 0.13, 0.92))
		cstyle.border_color = Color(0.38, 0.88, 0.54, 0.90) if st == "claimed" else (Color(1.0, 0.78, 0.26, 0.96) if st == "ready" else Color(0.42, 0.44, 0.54, 0.65))
		cstyle.set_border_width_all(2)
		cstyle.set_corner_radius_all(10)
		cstyle.content_margin_left = 16
		cstyle.content_margin_right = 16
		cstyle.content_margin_top = 12
		cstyle.content_margin_bottom = 12
		card.add_theme_stylebox_override("panel", cstyle)
		list_vbox.add_child(card)

		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 14)
		card.add_child(row)

		var left := VBoxContainer.new()
		left.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		left.add_theme_constant_override("separation", 4)
		row.add_child(left)

		var t_lbl := Label.new()
		t_lbl.text = "%s  (Mentor: %s)" % [str(g.get("title", "")), str(g.get("mentor", "—"))]
		t_lbl.add_theme_font_override("font", MapStyle.font())
		t_lbl.add_theme_font_size_override("font_size", 20)
		t_lbl.add_theme_color_override("font_color", Color(1.0, 0.92, 0.62) if st == "ready" else (Color(0.56, 0.96, 0.68) if st == "claimed" else Color(0.92, 0.90, 0.84)))
		left.add_child(t_lbl)

		var desc_lbl := Label.new()
		desc_lbl.text = str(g.get("summary", ""))
		desc_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		desc_lbl.add_theme_font_override("font", MapStyle.body_font())
		desc_lbl.add_theme_font_size_override("font_size", 18)
		desc_lbl.add_theme_color_override("font_color", Color(0.88, 0.90, 0.94))
		left.add_child(desc_lbl)

		var rew_txt := "Nagroda: +%d PD • +%d zł" % [int(g.get("xpReward", 0)), int(g.get("goldReward", 0))]
		if int(g.get("statPointsReward", 0)) > 0:
			rew_txt += " • +%d pkt stat." % int(g.get("statPointsReward", 0))
		if int(g.get("skillPointsReward", 0)) > 0:
			rew_txt += " • +%d pkt skilli" % int(g.get("skillPointsReward", 0))
		var irew := str(g.get("itemReward", ""))
		if not irew.is_empty():
			var idef: Dictionary = gm_script.find_item(irew)
			var iname := str(idef.get("name", irew))
			rew_txt += " • ✦ %s" % iname
		var meta_lbl := Label.new()
		meta_lbl.text = "%s   |   %s" % [rew_txt, str(g.get("progressText", ""))]
		meta_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		meta_lbl.add_theme_font_override("font", MapStyle.body_font())
		meta_lbl.add_theme_font_size_override("font_size", 17)
		meta_lbl.add_theme_color_override("font_color", Color(0.52, 0.96, 0.64) if st == "claimed" else (Color(1.0, 0.86, 0.38) if st == "ready" else Color(0.76, 0.80, 0.88)))
		left.add_child(meta_lbl)

		var act_btn := Button.new()
		act_btn.custom_minimum_size = Vector2(246, 54)
		if st == "claimed":
			act_btn.text = "✓ UKOŃCZONE"
			act_btn.disabled = true
			_style_btn(act_btn, Color(0.10, 0.22, 0.14, 0.85), Color(0.36, 0.82, 0.50, 0.75), 18)
			act_btn.add_theme_color_override("font_disabled_color", Color(0.62, 0.96, 0.72, 0.95))
		elif st == "ready":
			act_btn.text = "★ ODBIERZ NAGRODĘ"
			_style_btn(act_btn, Color(0.34, 0.22, 0.05, 0.98), Color(1.0, 0.82, 0.28, 0.98), 18)
			var gid := str(g.get("id", ""))
			var g_copy := g.duplicate(true)
			act_btn.pressed.connect(func() -> void: _claim_goal(gid, g_copy))
		else:
			act_btn.text = "W TOKU" if st == "in_progress" else "ZABLOKOWANE"
			act_btn.disabled = true
			_style_btn(act_btn, Color(0.12, 0.12, 0.16, 0.80), Color(0.40, 0.42, 0.50, 0.60), 18)
			act_btn.add_theme_color_override("font_disabled_color", Color(0.80, 0.78, 0.76, 0.92))
		row.add_child(act_btn)

	if shown == 0:
		var empty_lbl := Label.new()
		empty_lbl.text = "Połącz się z serwerem gry, aby zobaczyć cele rozwoju swojej rasy."
		empty_lbl.add_theme_font_override("font", MapStyle.body_font())
		empty_lbl.add_theme_font_size_override("font_size", 18)
		list_vbox.add_child(empty_lbl)

func _claim_goal(gid: String, g_copy: Dictionary) -> void:
	if world != null and world.has_method("dispatch_server_action") and world.dispatch_server_action({"type": "claim_goal", "goalId": gid}, func(res: Dictionary) -> void:
		status_lbl.text = str(res.get("notice", ""))
		_rebuild_list()
	):
		status_lbl.text = "Weryfikacja celu na serwerze…"
		return
	# Offline standalone QA fallback
	local_claimed[gid] = true
	if world != null and world.rpg_hud != null:
		world.rpg_hud.hero_gold += int(g_copy.get("goldReward", 30))
		world.rpg_hud.free_stat_points += int(g_copy.get("statPointsReward", 0))
		world.rpg_hud.skill_points += int(g_copy.get("skillPointsReward", 0))
		var irew := str(g_copy.get("itemReward", ""))
		if not irew.is_empty():
			var gm_script = preload("res://scripts/gm_panel.gd")
			var idef: Dictionary = gm_script.find_item(irew)
			if not idef.is_empty():
				world.rpg_hud.add_item_to_backpack(idef, 1)
		world.rpg_hud.grant_local_xp(int(g_copy.get("xpReward", 100)))
	status_lbl.text = "Ukończono (offline QA): %s" % str(g_copy.get("title", gid))
	_rebuild_list()
