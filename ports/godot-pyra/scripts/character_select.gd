extends Control
## The choice of the character before the game starts (shown when the device holds more than one): a card per character (the race's picture, name,
## level, land, when it was played last) and a card for a new one. Tap a card, then GRAJ. USUŃ asks twice. The cross goes back to the title.
const Look := preload("res://scripts/look.gd")
const Characters := preload("res://scripts/characters.gd")

const CARD_WIDTH := 440.0

signal picked(id: String)
signal new_character
signal closed

var roster: Array[Dictionary] = []
var selected := ""
var cards: Dictionary = {}
var play_button: Button
var delete_button: Button
var details := Label.new()
var armed_delete := false
var locked_id := ""   # the character being played in the game: it cannot be deleted from here

func setup(list: Array[Dictionary], current: String = "") -> void:
	roster = list
	locked_id = current
	selected = current if current != "" and list.any(func(e: Dictionary) -> bool: return str(e.id) == current) else (str(roster[0].id) if not roster.is_empty() else "")

func land_name(id: String) -> String:
	var map: Dictionary = PyraContinent.load_json("res://data/map.json")
	for region: Dictionary in map.regions:
		if str(region.id) == id:
			return str(region.name)
	return id

func when(time: int) -> String:
	var d := Time.get_datetime_dict_from_unix_time(time + int(Time.get_time_zone_from_system().bias) * 60)
	return "%02d.%02d.%d %02d:%02d" % [int(d.day), int(d.month), int(d.year), int(d.hour), int(d.minute)]

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	z_index = 100
	var shade := ColorRect.new()
	shade.color = Color(0.02, 0.015, 0.03, 0.96)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(shade)
	var stone := Look.backdrop(0.4)
	if stone != null:
		add_child(stone)
	var root := VBoxContainer.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.offset_left = 24
	root.offset_right = -24
	root.offset_top = 14
	root.offset_bottom = -18
	root.add_theme_constant_override("separation", 12)
	add_child(root)
	var bar := HBoxContainer.new()
	bar.custom_minimum_size.y = 96.0
	var title := Label.new()
	title.text = "WYBIERZ POSTAĆ"
	Look.style_heading(title, 38)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title.clip_text = true
	title.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	title.custom_minimum_size.x = 0
	title.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	bar.add_child(title)
	Look.reserve_close(bar)
	root.add_child(bar)
	var scroll := ScrollContainer.new()
	scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	root.add_child(scroll)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 18)
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.add_child(row)
	for entry in roster:
		row.add_child(make_card(entry))
	row.add_child(make_new_card())
	details.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	details.add_theme_font_size_override("font_size", 19)
	details.add_theme_color_override("font_color", Color("efe0c8"))
	root.add_child(details)
	var actions := HBoxContainer.new()
	actions.alignment = BoxContainer.ALIGNMENT_CENTER
	actions.add_theme_constant_override("separation", 14)
	play_button = make_button("GRAJ", func() -> void: picked.emit(selected), Vector2(300, 70))
	actions.add_child(play_button)
	delete_button = make_button("USUŃ POSTAĆ", on_delete, Vector2(300, 70))
	actions.add_child(delete_button)
	root.add_child(actions)
	Look.add_close(self, func() -> void: closed.emit())
	select(selected)

func make_button(text: String, callback: Callable, minimum: Vector2) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = minimum
	b.focus_mode = Control.FOCUS_NONE
	b.add_theme_font_size_override("font_size", 24)
	PyraSkin.style_button(b)
	b.pressed.connect(callback)
	return b

func card_frame(active: bool, color: Color) -> StyleBox:
	var tint := Color.WHITE.lerp(color.lightened(0.25), 0.55) * 1.25 if active else Color(0.72, 0.72, 0.72)
	tint.a = 1.0
	return Look.window(40.0, tint)

func make_card(entry: Dictionary) -> Control:
	var data: Dictionary = PyraContinent.load_json("res://data/races/%s.json" % str(entry.race))
	var color := Color(str(data.lore.color))
	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(CARD_WIDTH, 0)
	panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	panel.mouse_filter = Control.MOUSE_FILTER_STOP
	panel.set_meta("color", color)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 6)
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	panel.add_child(box)
	var picture := TextureRect.new()
	picture.texture = load("res://assets/races/%s.jpg" % str(entry.race))
	picture.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	picture.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	picture.size_flags_vertical = Control.SIZE_EXPAND_FILL
	picture.custom_minimum_size = Vector2(0, 160)
	picture.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_child(picture)
	var name := Label.new()
	name.text = (str(entry.name).to_upper() if str(entry.get("name","")) != "" else str(data.raceName).to_upper())
	name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	Look.style_heading(name, 28)
	name.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_child(name)
	var info := Label.new()
	info.text = ("%s · " % str(data.raceName) if str(entry.get("name","")) != "" else "") + "poziom %d · %s\nostatnio: %s" % [int(entry.level), land_name(str(entry.land)), when(int(entry.time))]
	if str(entry.get("extra","")) != "":
		info.text += "\n" + str(entry.extra)
	info.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	info.add_theme_font_size_override("font_size", 18)
	info.add_theme_color_override("font_color", Color("e1d4c4"))
	info.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_child(info)
	var id := str(entry.id)
	panel.gui_input.connect(func(event: InputEvent) -> void:
		if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
			select(id))
	cards[id] = panel
	return panel

func make_new_card() -> Control:
	var panel := PanelContainer.new()
	panel.custom_minimum_size = Vector2(CARD_WIDTH, 0)
	panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	panel.add_theme_stylebox_override("panel", Look.window(40.0, Color(0.85, 0.85, 0.85)))
	var box := VBoxContainer.new()
	box.alignment = BoxContainer.ALIGNMENT_CENTER
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	panel.add_child(box)
	var plus := Label.new()
	plus.text = "+"
	plus.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	plus.add_theme_font_size_override("font_size", 120)
	plus.add_theme_color_override("font_color", Color("ffd98a"))
	plus.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_child(plus)
	var label := Label.new()
	label.text = "NOWA POSTAĆ"
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	Look.style_heading(label, 28)
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_child(label)
	panel.gui_input.connect(func(event: InputEvent) -> void:
		if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
			new_character.emit())
	return panel

func select(id: String) -> void:
	selected = id
	armed_delete = false
	if delete_button != null:
		delete_button.text = "USUŃ POSTAĆ"
	for key: String in cards:
		var panel := cards[key] as PanelContainer
		panel.add_theme_stylebox_override("panel", card_frame(key == id, panel.get_meta("color") as Color))
	details.text = "Dotknij postaci, aby ją wybrać; GRAJ wchodzi do gry. Plus tworzy nową postać (zapisane postacie zostają)."
	if play_button != null:
		play_button.disabled = id == ""
		delete_button.disabled = id == "" or id == locked_id

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
	# rebuild the cards
	for child in get_children():
		child.queue_free()
	cards.clear()
	armed_delete = false
	selected = str(roster[0].id)
	_ready.call_deferred()
