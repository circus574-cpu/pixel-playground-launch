extends Control
## Gameplay GM tools for the current character, following the web game's StaffTools.
const Look := preload("res://scripts/look.gd")
signal closed
var net: PyraOnline
var game: Node
var tools: RefCounted
var frame := PanelContainer.new()
var body := Label.new()
var refresh_button: Button
var actions: Array[BaseButton] = []
var level_input := SpinBox.new()
var gold_input := SpinBox.new()
var x_input := LineEdit.new()
var y_input := LineEdit.new()
var land_picker := OptionButton.new()
var place_picker := OptionButton.new()
var god_button: Button
var cooldown_button: Button
var command_buttons: Dictionary = {}
var busy := false
var authorized := false
var request_generation := 0
var place_list: Array[Dictionary] = []
var grid := GridContainer.new()

func setup(connection: PyraOnline, scene: Node = null, command_tools: RefCounted = null) -> void:
	net = connection
	game = scene
	tools = command_tools

func button(text: String, callback: Callable, id := "") -> Button:
	var item := Button.new()
	item.text = text
	item.custom_minimum_size = Vector2(180, 88)
	item.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	item.add_theme_font_size_override("font_size", 24)
	item.focus_mode = Control.FOCUS_NONE
	PyraSkin.style_button(item)
	item.pressed.connect(callback)
	if id != "":
		actions.append(item)
		command_buttons[id] = item
	return item

func label(text: String, parent: Node, px := 24) -> Label:
	var item := Label.new()
	item.text = text
	item.add_theme_font_size_override("font_size", px)
	item.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	parent.add_child(item)
	return item

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	var shade := ColorRect.new()
	shade.color = Color(0.01,0.01,0.02,0.92)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(shade)
	frame.add_theme_stylebox_override("panel", Look.window(28))
	add_child(frame)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation",12)
	frame.add_child(box)
	var header := HBoxContainer.new()
	box.add_child(header)
	var title := label("NARZĘDZIA GM",header,32)
	title.add_theme_font_override("font",Look.title_font())
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	refresh_button = button("SPRAWDŹ DOSTĘP",refresh_data)
	header.add_child(refresh_button)
	header.add_child(button("WRÓĆ DO GRY",func():closed.emit()))
	body.add_theme_font_size_override("font_size",23)
	body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	body.text = "Sprawdzanie uprawnień GM…"
	box.add_child(body)
	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	box.add_child(scroll)
	var content := VBoxContainer.new()
	content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content.add_theme_constant_override("separation",14)
	scroll.add_child(content)
	grid.columns = 3
	grid.add_theme_constant_override("h_separation",12)
	grid.add_theme_constant_override("v_separation",12)
	content.add_child(grid)
	grid.add_child(button("LECZ HP / KI",func():run_command({"action":"heal"}),"heal"))
	god_button = button("NIEŚMIERTELNOŚĆ: NIE",func():run_command({"action":"god"}),"god")
	grid.add_child(god_button)
	cooldown_button = button("BRAK COOLDOWNÓW: NIE",func():run_command({"action":"unlimited"}),"unlimited")
	grid.add_child(cooldown_button)
	grid.add_child(button("+1 POZIOM",func():run_command({"action":"level"}),"level"))
	grid.add_child(button("+1000 MONET",func():run_command({"action":"gold"}),"gold"))
	grid.add_child(button("+10 MIKSTUR",func():run_command({"action":"potions"}),"potions"))
	var edits := HBoxContainer.new()
	edits.add_theme_constant_override("separation",12)
	content.add_child(edits)
	level_input.min_value = 1
	level_input.max_value = 20
	level_input.value = game.kit.level if game != null else 1
	level_input.custom_minimum_size = Vector2(160,88)
	edits.add_child(level_input)
	edits.add_child(button("USTAW POZIOM 1–20",func():run_command({"action":"setLevel","value":level_input.value}),"setLevel"))
	gold_input.min_value = 0
	gold_input.max_value = 1000000
	gold_input.value = game.economy.gold if game != null else 0
	gold_input.custom_minimum_size = Vector2(190,88)
	for spin in [level_input,gold_input]:
		spin.get_line_edit().add_theme_font_size_override("font_size",26)
		spin.get_line_edit().virtual_keyboard_type = LineEdit.KEYBOARD_TYPE_NUMBER
	edits.add_child(gold_input)
	edits.add_child(button("USTAW MONETY",func():run_command({"action":"setGold","value":gold_input.value}),"setGold"))
	label("TELEPORT — KRAINA / MIEJSCE / WSPÓŁRZĘDNE",content,26)
	land_picker.custom_minimum_size = Vector2(0,88)
	land_picker.add_theme_font_size_override("font_size",24)
	PyraSkin.style_button(land_picker)
	content.add_child(land_picker)
	actions.append(land_picker)
	if game != null:
		for id: String in game.ALL_LANDS:
			var index := land_picker.item_count
			var land_title := id
			for region: Dictionary in game.map_data.regions:
				if str(region.id) == id:
					land_title = str(region.name)
			land_picker.add_item(land_title)
			land_picker.set_item_metadata(index,id)
			if id == game.land_id:
				land_picker.select(index)
	land_picker.item_selected.connect(func(_index:int):fill_places())
	var places := HBoxContainer.new()
	places.add_theme_constant_override("separation",12)
	content.add_child(places)
	place_picker.custom_minimum_size = Vector2(400,88)
	place_picker.fit_to_longest_item = false
	place_picker.clip_text = true
	place_picker.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	place_picker.add_theme_font_size_override("font_size",24)
	PyraSkin.style_button(place_picker)
	places.add_child(place_picker)
	actions.append(place_picker)
	places.add_child(button("TELEPORT DO MIEJSCA",teleport_place,"place"))
	var coords := HBoxContainer.new()
	coords.add_theme_constant_override("separation",12)
	content.add_child(coords)
	for edit in [x_input,y_input]:
		edit.custom_minimum_size = Vector2(180,88)
		edit.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		edit.add_theme_font_size_override("font_size",24)
		edit.virtual_keyboard_type = LineEdit.KEYBOARD_TYPE_NUMBER_DECIMAL
		coords.add_child(edit)
	x_input.placeholder_text = "X"
	y_input.placeholder_text = "Y"
	coords.add_child(button("TELEPORT X / Y",teleport_coords,"teleport"))
	label("Teleport: miasta, słynne i ukryte miejsca, wejścia do podziemi oraz wszystkie 10 krain. Woda i punkty poza mapą są odrzucane. Zmiany postaci zapisują się normalnie; tryby GM są tylko na tę sesję.",content,21)
	net.session_changed.connect(account_changed)
	resized.connect(layout)
	frame.minimum_size_changed.connect(func():layout.call_deferred())
	layout()
	fill_places()
	set_commands(false)
	refresh_data.call_deferred()

func layout() -> void:
	var safe := Rect2(Vector2.ZERO,size)
	if OS.get_name() == "Android":
		var screen_safe := DisplayServer.get_display_safe_area()
		if screen_safe.has_area():
			safe = (get_tree().root.get_screen_transform().affine_inverse()*Rect2(screen_safe)).intersection(safe)
	frame.position = safe.position+Vector2(20,16)
	frame.size = safe.size-Vector2(40,32)

func set_commands(enabled: bool) -> void:
	for action in actions:
		action.disabled = not enabled
	level_input.editable = enabled
	gold_input.editable = enabled
	x_input.editable = enabled
	y_input.editable = enabled

func account_changed() -> void:
	if not net.is_staff():
		request_generation += 1
		authorized = false
		set_commands(false)
		body.text = "Brak dostępu GM/admin."

func refresh_data() -> void:
	if busy:
		return
	busy = true
	refresh_button.disabled = true
	set_commands(false)
	request_generation += 1
	var generation := request_generation
	var account := net.account_id
	authorized = await net.verify_staff()
	authorized = authorized and generation == request_generation and account == net.account_id
	busy = false
	refresh_button.disabled = false
	set_commands(authorized and tools != null)
	body.text = "GM aktywny. Wybierz komendę poniżej." if authorized else "Nie potwierdzono uprawnień GM. Sprawdź konto i połączenie."
	update_buttons()

func update_buttons() -> void:
	if game == null:
		return
	level_input.value = game.kit.level
	gold_input.value = game.economy.gold
	god_button.text = "NIEŚMIERTELNOŚĆ: " + ("TAK" if game.kit.gm_invulnerable else "NIE")
	cooldown_button.text = "BRAK COOLDOWNÓW: " + ("TAK" if game.kit.gm_no_cooldowns else "NIE")

func run_command(command: Dictionary) -> void:
	if busy or not authorized or tools == null:
		return
	busy = true
	set_commands(false)
	body.text = "Wykonywanie komendy…"
	var result: Dictionary = await tools.execute(command)
	busy = false
	body.text = str(result.message)
	authorized = net.is_staff()
	set_commands(authorized)
	update_buttons()
	if bool(result.ok) and str(command.action) == "teleport":
		closed.emit()

func selected_land() -> String:
	return str(land_picker.get_item_metadata(land_picker.selected)) if land_picker.item_count > 0 else ""

func fill_places() -> void:
	place_picker.clear()
	place_list.clear()
	if game == null or selected_land() == "":
		return
	var id := selected_land()
	# All destination labels/coordinates come from the existing world data, never invented map points.
	var cfg: Dictionary = PyraContinent.load_json("res://data/lands/%s/land.json" % id) if FileAccess.file_exists("res://data/lands/%s/land.json" % id) else {}
	place_list.append({"name":"Punkt przybycia", "arrival":true})
	for key in ["settlements","famous","places"]:
		for place: Dictionary in cfg.get(key,[]):
			var title := str(place.get("name",""))
			if title != "":
				place_list.append({"name":title,"x":float(place.x),"y":float(place.y)})
	for place in place_list:
		place_picker.add_item(str(place.name))
	if id == game.land_id:
		x_input.text = str(roundi(game.player.position.x))
		y_input.text = str(roundi(game.player.position.y))
	else:
		x_input.clear()
		y_input.clear()

func teleport_place() -> void:
	if place_picker.selected < 0 or place_picker.selected >= place_list.size():
		return
	var target := {"action":"teleport","land":selected_land()}
	var point: Dictionary = place_list[place_picker.selected]
	if not bool(point.get("arrival",false)):
		target.x = point.x
		target.y = point.y
	run_command(target)

func teleport_coords() -> void:
	if not x_input.text.is_valid_float() or not y_input.text.is_valid_float():
		body.text = "Wpisz prawidłowe X oraz Y."
		return
	run_command({"action":"teleport","land":selected_land(),"x":x_input.text.to_float(),"y":y_input.text.to_float()})
