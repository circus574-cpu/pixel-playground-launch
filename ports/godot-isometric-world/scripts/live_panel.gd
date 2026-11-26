extends Control

const ForgedUI := preload("res://scripts/forged_ui.gd")
const MapStyle := preload("res://scripts/map_style.gd")
const Items := preload("res://scripts/gm_panel.gd")
const RpgHud := preload("res://scripts/rpg_hud.gd")
const CHANNELS := {"world": "Świat", "land": "Kontynent", "local": "Lokalny", "whisper": "Szept"}
const MAX_HISTORY := 80

var world: Node2D
var link: Node
var trigger := Button.new()
var panel := PanelContainer.new()
var chat_body := VBoxContainer.new()
var profile_body := VBoxContainer.new()
var tabs := GridContainer.new()
var status := Label.new()
var connection_ok := false
var history := []
var channel := "local"
var scroll := ScrollContainer.new()
var transcript := Label.new()
var input := LineEdit.new()
var recipient := LineEdit.new()
var send_button := Button.new()
var buttons := {}
var power := 0
var online := 0
var _keyboard := 0
var _draft_sent := ""
var _send_deadline := 0
var _transcript_dirty := false

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_style_button(trigger, "CZAT")
	trigger.pressed.connect(func() -> void:
		if panel.visible:
			close_panel()
		else:
			open_chat()
	)
	add_child(trigger)
	panel.add_theme_stylebox_override("panel", ForgedUI.panel_box(12, 12))
	panel.hide()
	add_child(panel)

	var root := VBoxContainer.new()
	root.add_theme_constant_override("separation", 7)
	panel.add_child(root)
	var header := HBoxContainer.new()
	root.add_child(header)
	status.text = "Łączenie…"
	status.clip_text = true
	status.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	status.add_theme_font_override("font", MapStyle.body_font())
	status.add_theme_font_size_override("font_size", 15)
	header.add_child(status)
	var close := Button.new()
	_style_button(close, "Zamknij")
	close.pressed.connect(close_panel)
	header.add_child(close)
	root.add_child(chat_body)
	chat_body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	root.add_child(profile_body)
	profile_body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	profile_body.hide()

	for key: String in CHANNELS:
		var button := Button.new()
		_style_button(button, CHANNELS[key])
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.toggle_mode = true
		button.pressed.connect(func() -> void: _select_channel(key))
		tabs.add_child(button)
		buttons[key] = button
	chat_body.add_child(tabs)
	recipient.placeholder_text = "Nick adresata"
	recipient.max_length = 32
	recipient.custom_minimum_size.y = 44
	chat_body.add_child(recipient)

	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	chat_body.add_child(scroll)
	transcript.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	transcript.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	transcript.add_theme_font_override("font", MapStyle.body_font())
	transcript.add_theme_font_size_override("font_size", 16)
	scroll.add_child(transcript)

	var composer := HBoxContainer.new()
	chat_body.add_child(composer)
	input.placeholder_text = "Napisz wiadomość"
	input.max_length = 120
	input.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	input.custom_minimum_size.y = 44
	input.text_submitted.connect(func(_message: String) -> void: _send())
	composer.add_child(input)
	_style_button(send_button, "Wyślij")
	send_button.pressed.connect(_send)
	composer.add_child(send_button)
	get_viewport().size_changed.connect(_layout)
	_select_channel(channel)
	set_status(false, "Łączenie…")
	_layout()

func is_open() -> bool:
	return panel.visible

func open_chat() -> void:
	if world != null:
		world.motion = Vector2.ZERO
		world.move_pointer = -1
		world.target_pos = Vector2(-1.0, -1.0)
		world.stick_layer.queue_redraw()
	profile_body.hide()
	chat_body.show()
	_refresh_transcript()
	panel.show()
	mouse_filter = Control.MOUSE_FILTER_STOP
	_layout()

func close_panel() -> void:
	input.release_focus()
	recipient.release_focus()
	panel.hide()
	mouse_filter = Control.MOUSE_FILTER_IGNORE

func set_available(enabled: bool) -> void:
	trigger.visible = enabled
	if not enabled and panel.visible:
		close_panel()

func _style_button(btn: Button, title: String) -> void:
	btn.text = title
	ForgedUI.style_button(btn, "slate", 15, 8, 5)
	btn.custom_minimum_size = Vector2(44, 44)

func _layout() -> void:
	var viewport := get_viewport_rect()
	var safe := viewport
	if OS.get_name() == "Android":
		var display := DisplayServer.get_display_safe_area()
		if display.has_area():
			var root := get_tree().root
			var root_safe := root.get_screen_transform().affine_inverse() * Rect2(display)
			var root_rect := root.get_visible_rect()
			if root_rect.has_area():
				var scale_to_child := viewport.size / root_rect.size
				safe = Rect2(root_safe.position * scale_to_child, root_safe.size * scale_to_child).intersection(viewport)
	if not safe.has_area():
		safe = viewport
	var allowed_bottom := safe.end.y
	if _keyboard > 0:
		var display_height := maxf(float(DisplayServer.window_get_size().y), 1.0)
		allowed_bottom = minf(allowed_bottom, viewport.size.y * (1.0 - float(_keyboard) / display_height))
	var width := minf(safe.size.x - 20.0, 610.0)
	var min_height := 138.0 if _keyboard > 0 else 190.0
	var panel_height := clampf(allowed_bottom - safe.position.y - 16.0, min_height, 400.0)
	tabs.columns = 2 if width < 430.0 else 4
	if _keyboard > 0:
		tabs.hide()
	else:
		tabs.show()
	panel.size = Vector2(width, panel_height)
	panel.position = Vector2(safe.get_center().x - width * 0.5, maxf(safe.position.y + 8.0, allowed_bottom - panel_height - 8.0))
	trigger.size = Vector2(154.0, 44.0)
	trigger.position = Vector2(safe.get_center().x - 77.0, safe.end.y - 62.0)

func _process(_delta: float) -> void:
	if not panel.visible:
		return
	if _transcript_dirty and chat_body.visible:
		_refresh_transcript()
	if not DisplayServer.has_feature(DisplayServer.FEATURE_VIRTUAL_KEYBOARD):
		return
	var height := DisplayServer.virtual_keyboard_get_height()
	if _keyboard != height:
		_keyboard = height
		_layout()

func set_status(connected: bool, message: String) -> void:
	connection_ok = connected
	status.text = message
	input.editable = connected
	send_button.disabled = not connected
	if not connected or message != "Połączono":
		_draft_sent = ""
	if not connected:
		update_online(0, 0)

func update_online(count: int, ki_power: int) -> void:
	online = count
	power = ki_power
	trigger.text = "CZAT %d  ⚡ %d" % [count, ki_power] if connection_ok else "CZAT"

func _select_channel(key: String) -> void:
	channel = key
	for entry: String in buttons:
		buttons[entry].set_pressed_no_signal(entry == key)
	recipient.visible = channel == "whisper"
	_refresh_transcript()

func add_line(frame: Dictionary) -> void:
	if link != null and str(frame.get("id", "")) == str(link.peer_id) and str(frame.get("text", "")) == _draft_sent:
		if input.text.strip_edges() == _draft_sent:
			input.clear()
		_draft_sent = ""
		status.text = "Połączono"
	history.append(frame)
	if history.size() > MAX_HISTORY:
		history.pop_front()
	_transcript_dirty = true

func _refresh_transcript() -> void:
	_transcript_dirty = false
	var lines := PackedStringArray()
	for line: Dictionary in history:
		if line.get("scope") != channel:
			continue
		var sender := str(line.get("nick", ""))
		if line.has("toNick"):
			sender += " → " + str(line["toNick"])
		lines.append("%s: %s" % [sender, str(line.get("text", ""))])
	transcript.text = "\n".join(lines)
	if scroll.is_inside_tree():
		_scroll_to_end.call_deferred()

func _scroll_to_end() -> void:
	if is_instance_valid(scroll):
		scroll.scroll_vertical = int(scroll.get_v_scroll_bar().max_value)

func _send() -> void:
	if channel == "whisper" and recipient.text.strip_edges().is_empty():
		status.text = "Wpisz nick adresata."
		return
	if not _draft_sent.is_empty() and Time.get_ticks_msec() < _send_deadline:
		return
	if link.send_chat(channel, input.text, recipient.text):
		_draft_sent = input.text.strip_edges()
		_send_deadline = Time.get_ticks_msec() + 3000

func show_profile(frame: Dictionary) -> void:
	open_chat()
	chat_body.hide()
	for child in profile_body.get_children():
		profile_body.remove_child(child)
		child.queue_free()
	profile_body.show()
	var name := Label.new()
	name.text = "%s (%s)  ·  Poz. %d  ·  ⚡ %d" % [
		str(frame.get("name", "")), str(frame.get("nick", "")), int(frame.get("level", 1)), int(frame.get("power", 0)),
	]
	name.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	name.add_theme_font_size_override("font_size", 17)
	profile_body.add_child(name)
	var equipment_scroll := ScrollContainer.new()
	equipment_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	equipment_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	profile_body.add_child(equipment_scroll)
	var gear := HBoxContainer.new()
	gear.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	equipment_scroll.add_child(gear)
	var left := VBoxContainer.new()
	var right := VBoxContainer.new()
	var portrait := TextureRect.new()
	var race_land := str(world.RACE_TO_LAND.get(str(frame.get("race", "")), "pyra"))
	portrait.texture = world.load_tex("res://assets/ui/portrait_%s.webp" % race_land)
	portrait.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	portrait.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	portrait.custom_minimum_size = Vector2(62, 142)
	for column: Control in [left, portrait, right]:
		column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		gear.add_child(column)
	var equipment: Dictionary = frame.get("equipment", {})
	var slot_names: Array = RpgHud.EQUIP_SLOT_NAMES
	for i in slot_names.size():
		var slot := Label.new()
		var item: Dictionary = Items.find_item(str(equipment.get(str(i), "")))
		slot.text = "%s\n%s" % [slot_names[i], str(item.get("name", "Pusty slot"))]
		slot.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		slot.add_theme_font_size_override("font_size", 12)
		var column := left if i < 4 else right
		column.add_child(slot)
	var whisper := Button.new()
	_style_button(whisper, "Szept")
	whisper.pressed.connect(func() -> void:
		open_chat()
		recipient.text = str(frame.get("nick", ""))
		_select_channel("whisper")
		input.grab_focus()
	)
	profile_body.add_child(whisper)
	_layout()
