extends Control
## Non-Obstructive Live-World NPC Dialogue Strip (Layer 2) + Ambient Bark Library (Layer 1).
## Occupies only the bottom ~21% of the viewport so the top ~79% of the game world stays live & visible.
## Walking away automatically closes the conversation; inside buildings a pill opens the functional Service Window.

const MapStyle := preload("res://scripts/map_style.gd")

const BIOME_LORE := {
	"pyra": "Twierdza Popiołu stoi nad żyłami magmy od czasów Pierwszej Przysięgi. Każda droga prowadzi tu między bazaltowymi mostami a gorącymi kuźniami.",
	"verdant": "Zielona Przystań żyje w harmonii ze szmaragdową doliną. Kupcy z portu i rzemieślnicy strzegą dawnych traktów przez lasy i rzeki.",
	"aether": "Lodowe Sanktuarium wzniesiono tam, gdzie kryształy Ki zamarzają w czyste pieczęcie. Mędrcy Aetherii badają tu echa planety.",
	"nexus": "Węzeł Świadomości Nexus-9 łączy sieci energetyczne całego kontynentu. Każdy sektor synchronizuje tu dane, sprzęt i rdzenie Ki.",
}

const ROLE_ICON := {
	"guide": "emblem_compass.webp",
	"steward": "emblem_crown.webp",
	"smith": "emblem_anvil.webp",
	"smithy": "emblem_anvil.webp",
	"innkeeper": "emblem_scroll.webp",
	"inn": "emblem_scroll.webp",
	"merchant": "emblem_coin.webp",
	"shop": "emblem_coin.webp",
	"banker": "emblem_vault.webp",
	"depot": "emblem_vault.webp",
	"arena": "emblem_swords.webp",
	"hall": "emblem_crown.webp",
	"landmark": "emblem_crown.webp",
}

const AMBIENT_BARKS := {
	"pyra": [
		"Ogień w piecach dziś nie gaśnie!",
		"Uważaj na krawędziach lawowych traktów, wędrowcze.",
		"Chwała Twierdzy Popiołu! Potrzebujesz wieści?",
		"Stal wykuta w Pyrze wytrzyma każde starcie.",
	],
	"verdant": [
		"Świeży wiatr znad przystani zapowiada dobry dzień.",
		"Trakty przez dolinę są dziś bezpieczne i czyste.",
		"Zajrzyj do naszych rzemieślników, podróżniku!",
		"Szmaragdowy gaj pamięta kroki każdego bohatera.",
	],
	"aether": [
		"Kryształy w sanktuarium drżą spokojnym rytmem Ki.",
		"Cisza śnieżnych szczytów wyostrza umysł.",
		"Szukasz mądrości Rady czy pieczęci ochronnej?",
		"Zimny wiatr niesie echa z północy.",
	],
	"nexus": [
		"Sygnał rdzenia stabilny. Witaj w sektorze Nexus-9.",
		"Wszystkie węzły komunikacyjne działają na 100%.",
		"Potrzebujesz kalibracji sprzętu albo danych mapy?",
		"Synchronizacja kontynentu przebiega bez zakłóceń.",
	],
}

var world: Node2D
var panel := PanelContainer.new()
var icon_rect := TextureRect.new()
var name_lbl := Label.new()
var role_lbl := Label.new()
var body_lbl := Label.new()
var choices_vbox := VBoxContainer.new()

var is_open := false
var active_npc: Dictionary = {} # {"id", "name", "role", "quest_mark", "land", "actor", "is_interior", "building_role", "service_cb"}
var completed_quests: Dictionary = {} # npc_key -> true
var full_text := ""
var shown_chars := 0.0
var _opened_ms := 0

static func pick_ambient_bark(land: String, role_str: String, seed_idx: int) -> String:
	var rl := role_str.to_lower()
	if "kowal" in rl or "smith" in rl or "uzbrojen" in rl:
		return "Młot i żar czekają — wpadnij do kuźni!"
	if "kupiec" in rl or "handl" in rl or "sklep" in rl:
		return "Świeże towary prosto z karawan! Podejdź!"
	if "bank" in rl or "skarbn" in rl or "depozyt" in rl:
		return "Twoje złoto i skarby są bezpieczne w skarbcu."
	if "karczm" in rl or "gospodyn" in rl or "herbat" in rl or "regenerac" in rl:
		return "Odpocznij chwilę i odzyskaj pełnię sił Ki."
	var arr: Array = AMBIENT_BARKS.get(land, AMBIENT_BARKS["pyra"])
	return str(arr[abs(seed_idx) % arr.size()])

func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	visible = false

	var st := StyleBoxFlat.new()
	st.bg_color = Color(0.05, 0.045, 0.065, 0.94)
	st.border_color = Color(0.98, 0.70, 0.24, 0.98)
	st.set_border_width_all(3)
	st.set_corner_radius_all(12)
	st.content_margin_left = 14
	st.content_margin_right = 14
	st.content_margin_top = 10
	st.content_margin_bottom = 10
	panel.add_theme_stylebox_override("panel", st)
	panel.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(panel)

	var hbox := HBoxContainer.new()
	hbox.add_theme_constant_override("separation", 14)
	panel.add_child(hbox)

	# Left: Role emblem + speaker identity
	var left_v := VBoxContainer.new()
	left_v.custom_minimum_size = Vector2(180.0, 0.0)
	left_v.add_theme_constant_override("separation", 4)
	hbox.add_child(left_v)

	var id_row := HBoxContainer.new()
	id_row.add_theme_constant_override("separation", 10)
	left_v.add_child(id_row)

	icon_rect.custom_minimum_size = Vector2(46, 46)
	icon_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	icon_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	id_row.add_child(icon_rect)

	var name_v := VBoxContainer.new()
	name_v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	name_v.add_theme_constant_override("separation", 2)
	id_row.add_child(name_v)

	name_lbl.add_theme_font_override("font", MapStyle.font())
	name_lbl.add_theme_font_size_override("font_size", 17)
	name_lbl.add_theme_color_override("font_color", Color(1.0, 0.88, 0.48))
	name_v.add_child(name_lbl)

	role_lbl.add_theme_font_override("font", MapStyle.body_font())
	role_lbl.add_theme_font_size_override("font_size", 12)
	role_lbl.add_theme_color_override("font_color", Color(0.54, 0.90, 0.98))
	role_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	name_v.add_child(role_lbl)

	var hint := Label.new()
	hint.text = "Odejdź, aby zakończyć"
	hint.add_theme_font_override("font", MapStyle.body_font())
	hint.add_theme_font_size_override("font_size", 11)
	hint.add_theme_color_override("font_color", Color(0.68, 0.66, 0.72))
	left_v.add_child(hint)

	# Center: Compact readable dialogue text (1-2 crisp sentences)
	body_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	body_lbl.size_flags_vertical = Control.SIZE_EXPAND_FILL
	body_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	body_lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	body_lbl.add_theme_font_override("font", MapStyle.body_font())
	body_lbl.add_theme_font_size_override("font_size", 15)
	body_lbl.add_theme_color_override("font_color", Color(0.98, 0.95, 0.88))
	body_lbl.mouse_filter = Control.MOUSE_FILTER_STOP
	body_lbl.gui_input.connect(func(ev: InputEvent) -> void:
		if ev is InputEventMouseButton and ev.pressed:
			shown_chars = float(full_text.length())
			body_lbl.text = full_text
	)
	hbox.add_child(body_lbl)

	# Right: 2-3 compact pill choices
	choices_vbox.custom_minimum_size = Vector2(215.0, 0.0)
	choices_vbox.alignment = BoxContainer.ALIGNMENT_CENTER
	choices_vbox.add_theme_constant_override("separation", 6)
	hbox.add_child(choices_vbox)

	resized.connect(_layout)
	_layout()

func _layout() -> void:
	var vs := get_viewport_rect().size
	if vs.x < 100.0:
		vs = Vector2(1280.0, 720.0)
	var pw := clampf(vs.x - 48.0, 620.0, 1140.0)
	var ph := 148.0
	panel.size = Vector2(pw, ph)
	panel.position = Vector2((vs.x - pw) * 0.5, vs.y - ph - 12.0)

func _style_pill(btn: Button, bg: Color, border: Color) -> void:
	btn.custom_minimum_size = Vector2(205.0, 36.0)
	var st := StyleBoxFlat.new()
	st.bg_color = bg
	st.border_color = border
	st.set_border_width_all(2)
	st.set_corner_radius_all(8)
	st.content_margin_left = 10
	st.content_margin_right = 10
	st.content_margin_top = 4
	st.content_margin_bottom = 4
	btn.add_theme_stylebox_override("normal", st)
	var sth := st.duplicate()
	sth.bg_color = bg.lightened(0.14)
	btn.add_theme_stylebox_override("hover", sth)
	btn.add_theme_font_override("font", MapStyle.body_font())
	btn.add_theme_font_size_override("font_size", 13)
	btn.add_theme_color_override("font_color", Color(1.0, 0.96, 0.86))

func _icon_for(npc: Dictionary) -> Texture2D:
	if world == null:
		return null
	var brole := str(npc.get("building_role", ""))
	if ROLE_ICON.has(brole):
		return world.load_tex("res://assets/ui/icons/" + str(ROLE_ICON[brole]))
	var aid := str(npc.get("id", "")).to_lower()
	for k: String in ROLE_ICON.keys():
		if k in aid:
			return world.load_tex("res://assets/ui/icons/" + str(ROLE_ICON[k]))
	return world.load_tex("res://assets/ui/icons/emblem_scroll.webp")

func _set_text(msg: String) -> void:
	full_text = msg
	shown_chars = 0.0
	body_lbl.text = ""

func apply_server_quests(st: Dictionary) -> void:
	var cq: Dictionary = st.get("completedQuests", {})
	completed_quests.clear()
	for k in cq.keys():
		completed_quests[str(k)] = true

func open_dialogue(npc: Dictionary) -> void:
	if world != null and world.get("audio") != null:
		world.audio.sfx("ui/open")
	active_npc = npc
	is_open = true
	visible = true
	_opened_ms = Time.get_ticks_msec()
	_layout()

	var n_name := str(npc.get("name", "Mieszkaniec"))
	var n_role := str(npc.get("role", "Obywatel"))
	var land := str(npc.get("land", "pyra"))
	name_lbl.text = n_name
	role_lbl.text = n_role
	icon_rect.texture = _icon_for(npc)

	var actor = npc.get("actor", null)
	if is_instance_valid(actor) and actor.has_method("hide_bubble"):
		actor.hide_bubble()

	var greeting := _greeting_for(n_name, n_role, land, bool(npc.get("is_interior", false)))
	_set_text(greeting)
	_rebuild_choices()

func close_dialogue(farewell: bool = false) -> void:
	if not is_open:
		return
	if farewell:
		var actor = active_npc.get("actor", null)
		if is_instance_valid(actor) and actor.has_method("show_bubble"):
			actor.show_bubble("Powodzenia na szlaku!", 2.8)
	is_open = false
	visible = false
	active_npc = {}

func _greeting_for(n_name: String, n_role: String, land: String, is_int: bool) -> String:
	if is_int:
		return "Witaj w środku! Jestem %s. W czym mogę Ci dziś pomóc? Możesz spokojnie się rozejrzeć albo od razu skorzystać z moich usług." % n_name
	var qm := str(active_npc.get("quest_mark", ""))
	if qm == "!":
		return "Dobrze, że jesteś, wędrowcze! Nazywam się %s (%s). Mam dla Ciebie pilne zadanie w tym regionie." % [n_name, n_role]
	if qm == "?":
		return "Witaj ponownie! Jako %s czekam na wieści z okolicy. Jeśli sprawdziłeś już szlaki, odbierz swoją nagrodę." % n_role
	return "Witaj, podróżniku! Jestem %s (%s). %s" % [n_name, n_role, pick_ambient_bark(land, n_role, n_name.length())]

func _rebuild_choices() -> void:
	for ch in choices_vbox.get_children():
		ch.queue_free()

	var q_key := "%s:%s" % [str(active_npc.get("land", "pyra")), str(active_npc.get("name", ""))]
	var qm := str(active_npc.get("quest_mark", ""))
	var has_quest := (qm == "!" or qm == "?") and not completed_quests.has(q_key)

	# 1) Inside building: Direct pill to open the functional Service Window!
	if bool(active_npc.get("is_interior", false)):
		var b_srv := Button.new()
		b_srv.text = "◆ OTWÓRZ USŁUGI"
		_style_pill(b_srv, Color(0.10, 0.28, 0.34, 0.96), Color(0.38, 0.92, 1.0, 0.98))
		b_srv.pressed.connect(func() -> void:
			var cb = active_npc.get("service_cb", null)
			close_dialogue(false)
			if cb is Callable and (cb as Callable).is_valid():
				(cb as Callable).call()
		)
		choices_vbox.add_child(b_srv)
	elif has_quest:
		var b_q := Button.new()
		b_q.text = "! ZADANIE (+45 XP / +80 zł)" if qm == "!" else "? ODBIERZ NAGRODĘ"
		_style_pill(b_q, Color(0.28, 0.20, 0.06, 0.96), Color(1.0, 0.84, 0.30, 0.98))
		b_q.pressed.connect(func() -> void:
			if world != null and world.has_method("dispatch_server_action") and world.dispatch_server_action({"type": "quest_complete", "questId": q_key}, func(res: Dictionary) -> void:
				if bool(res.get("ok", false)):
					completed_quests[q_key] = true
					active_npc["quest_mark"] = ""
					var actor = active_npc.get("actor", null)
					if is_instance_valid(actor):
						actor.quest_mark = ""
						actor.queue_redraw()
					_set_text(str(res.get("notice", "Nagroda przyznana przez serwer!")))
					_rebuild_choices()
				else:
					_set_text(str(res.get("notice", "Serwer odrzucił odbiór nagrody.")))
			):
				return
			completed_quests[q_key] = true
			active_npc["quest_mark"] = ""
			var actor = active_npc.get("actor", null)
			if is_instance_valid(actor):
				actor.quest_mark = ""
				actor.queue_redraw()
			if world != null and world.rpg_hud != null:
				world.rpg_hud.hero_gold += 80
				world.rpg_hud.hero_xp += 45
				world.rpg_hud.recalc_stats()
			_set_text("Znakomicie! Przyjmij 80 sztuk złota oraz 45 PD za pomoc dla naszej stolicy. Twoja sława rośnie!")
			_rebuild_choices()
		)
		choices_vbox.add_child(b_q)

	# 2) Region / Building Lore
	var b_lore := Button.new()
	b_lore.text = "◆ O REGIONIE"
	_style_pill(b_lore, Color(0.12, 0.14, 0.22, 0.95), Color(0.64, 0.78, 0.96, 0.92))
	b_lore.pressed.connect(func() -> void:
		var land := str(active_npc.get("land", "pyra"))
		_set_text(str(BIOME_LORE.get(land, BIOME_LORE["pyra"])))
	)
	choices_vbox.add_child(b_lore)

	# 3) Close
	var b_bye := Button.new()
	b_bye.text = "✕ ŻEGNAJ"
	_style_pill(b_bye, Color(0.24, 0.10, 0.10, 0.95), Color(0.92, 0.50, 0.36, 0.92))
	b_bye.pressed.connect(func() -> void:
		close_dialogue(true)
	)
	choices_vbox.add_child(b_bye)

func _process(delta: float) -> void:
	if not is_open:
		return
	if shown_chars < float(full_text.length()):
		shown_chars = minf(float(full_text.length()), shown_chars + 78.0 * delta)
		body_lbl.text = full_text.substr(0, int(shown_chars))
