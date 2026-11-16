class_name RaceScreen
extends Control
const Look := preload("res://scripts/look.gd")   # the look that can change with server updates (see look.gd)
## New character: the four races, each with its portrait, world, mechanic and role. Choosing one starts the adventure
## in that race's capital.

signal chosen(race: String)
signal closed

const RACES := ["planetary", "sage", "android", "legend"]
var selected := ""
var cards: Dictionary = {}
var confirm: Button
var details := Label.new()
var allow_close := false

func setup(can_close: bool = false) -> void:
	allow_close = can_close
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	var background := TextureRect.new()
	background.texture = load("res://assets/branding/intro-wide.webp")
	background.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	background.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	background.mouse_filter = Control.MOUSE_FILTER_IGNORE
	background.modulate = Color(0.28, 0.28, 0.32)
	add_child(background)
	var root := VBoxContainer.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.offset_left = 22
	root.offset_right = -22
	root.offset_top = 14
	root.offset_bottom = -14
	root.add_theme_constant_override("separation", 10)
	add_child(root)
	var title := Label.new()
	title.text = "WYBIERZ SWOJĄ RASĘ"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_override("font", Look.title_font())
	title.add_theme_font_size_override("font_size", 34)
	title.add_theme_color_override("font_color", Color("f1c77f"))
	root.add_child(title)
	var row := HBoxContainer.new()
	row.size_flags_vertical = Control.SIZE_EXPAND_FILL
	row.add_theme_constant_override("separation", 14)
	root.add_child(row)
	for race in RACES:
		var data: Dictionary = PyraContinent.load_json("res://data/races/%s.json" % race)
		var card := make_card(race, data)
		cards[race] = card
		row.add_child(card)
	details.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	details.custom_minimum_size = Vector2(0, 54)
	details.add_theme_font_size_override("font_size", 17)
	details.add_theme_color_override("font_color", Color("efe0c8"))
	details.text = "Dotknij rasy, aby zobaczyć jej cechy."
	root.add_child(details)
	var bar := HBoxContainer.new()
	bar.alignment = BoxContainer.ALIGNMENT_CENTER
	bar.add_theme_constant_override("separation", 12)
	confirm = make_button("ZACZNIJ JAKO …", func(): if selected != "": chosen.emit(selected), Vector2(430, 64))
	confirm.disabled = true
	bar.add_child(confirm)
	if allow_close:
		bar.add_child(make_button("ANULUJ", func(): closed.emit(), Vector2(200, 64)))
	root.add_child(bar)

func make_card(race: String, data: Dictionary) -> Control:
	var lore: Dictionary = data.lore
	var panel := PanelContainer.new()
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	panel.mouse_filter = Control.MOUSE_FILTER_STOP
	panel.add_theme_stylebox_override("panel", card_style(false, Color(str(lore.color))))
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 6)
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	panel.add_child(box)
	var picture := TextureRect.new()
	picture.texture = load("res://assets/races/%s.jpg" % race)
	picture.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	picture.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	picture.size_flags_vertical = Control.SIZE_EXPAND_FILL
	picture.custom_minimum_size = Vector2(0, 150)
	picture.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_child(picture)
	var name := Label.new()
	name.text = str(data.raceName).to_upper()
	name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	name.add_theme_font_override("font", Look.title_font())
	name.add_theme_font_size_override("font_size", 24)
	name.add_theme_color_override("font_color", Color(str(lore.color)))
	name.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_child(name)
	var line := Label.new()
	line.text = "%s · %s\n%s" % [lore.world, str(data.role), "Mechanika: %s" % data.mechanic]
	line.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	line.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	line.add_theme_font_size_override("font_size", 15)
	line.add_theme_color_override("font_color", Color("e1d4c4"))
	line.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_child(line)
	panel.gui_input.connect(func(event: InputEvent) -> void:
		if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
			select(race))
	return panel

func card_style(active: bool, color: Color) -> StyleBox:
	# the stone window; the chosen race lights it up in its own colour
	var tint := Color(1.0, 1.0, 1.0).lerp(color.lightened(0.25), 0.55) * 1.25 if active else Color(0.72, 0.72, 0.72)
	tint.a = 1.0
	return Look.window(46.0, tint)

func select(race: String) -> void:
	selected = race
	var data: Dictionary = PyraContinent.load_json("res://data/races/%s.json" % race)
	for r: String in cards:
		var color := Color(str(PyraContinent.load_json("res://data/races/%s.json" % r).lore.color))
		(cards[r] as PanelContainer).add_theme_stylebox_override("panel", card_style(r == race, color))
	var lore: Dictionary = data.lore
	var base: Dictionary = data.base
	details.text = "%s — %s. %s\nStart: %s (%s). HP %d · KI %d · Atak %d · Obrona %d · Szybkość %d." % [data.raceName, lore.title, lore.description, lore.city, lore.world, int(base.hp), int(base.ki), int(base.attack), int(base.defense), int(base.speed)]
	confirm.text = "ZACZNIJ JAKO %s" % str(data.raceName).to_upper()
	confirm.disabled = false

func make_button(text: String, callback: Callable, minimum: Vector2) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = minimum
	b.focus_mode = Control.FOCUS_NONE
	b.add_theme_font_size_override("font_size", 21)
	b.add_theme_color_override("font_color", Color("fff0cf"))
	b.add_theme_color_override("font_disabled_color", Color("8a7a6a"))
	PyraSkin.style_button(b)
	b.pressed.connect(callback)
	return b
