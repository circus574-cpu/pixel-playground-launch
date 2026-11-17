class_name PyraChat
extends Control
const Look := preload("res://scripts/look.gd")   # the look that can change with server updates (see look.gd)
## The local chat line of the land (players near you see it). Opened from MENU; lines also appear as short notices.

signal closed

const KEEP := 40

var lines: Array[String] = []
var log_label := RichTextLabel.new()
var input := LineEdit.new()

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var shade := ColorRect.new()
	shade.color = Color(0, 0, 0, 0.55)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(shade)
	var panel := PanelContainer.new()
	panel.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	panel.position = Vector2(-340, 70)
	panel.custom_minimum_size = Vector2(680, 330)
	panel.add_theme_stylebox_override("panel", Look.window(50.0))
	add_child(panel)
	var box := VBoxContainer.new()
	panel.add_child(box)
	var title := Label.new()
	title.text = "CZAT OKOLICY"
	title.add_theme_font_size_override("font_size", 22)
	title.add_theme_color_override("font_color", Color("ffe2a8"))
	box.add_child(title)
	log_label.bbcode_enabled = false
	log_label.scroll_following = true
	log_label.custom_minimum_size = Vector2(0, 190)
	log_label.add_theme_font_size_override("normal_font_size", 17)
	box.add_child(log_label)
	var row := HBoxContainer.new()
	box.add_child(row)
	input.placeholder_text = "Napisz do graczy w pobliżu…"
	input.max_length = 120
	input.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	input.custom_minimum_size = Vector2(0, 50)
	input.add_theme_font_size_override("font_size", 18)
	input.text_submitted.connect(func(_t: String) -> void: send())
	row.add_child(input)
	var send_button := Button.new()
	send_button.text = "WYŚLIJ"
	send_button.custom_minimum_size = Vector2(110, 50)
	send_button.pressed.connect(send)
	row.add_child(send_button)
	var close_button := Button.new()
	close_button.text = "ZAMKNIJ"
	close_button.custom_minimum_size = Vector2(0, 46)
	close_button.pressed.connect(func() -> void:
		closed.emit()
		queue_free())
	box.add_child(close_button)
	Look.add_close(self, func() -> void:
		closed.emit()
		queue_free())
	refresh()

func add_line(nick: String, text: String) -> void:
	lines.append("%s: %s" % [nick, text])
	if lines.size() > KEEP:
		lines.pop_front()
	if is_inside_tree():
		refresh()

func refresh() -> void:
	log_label.text = "\n".join(lines) if not lines.is_empty() else "Nikt jeszcze nic nie napisał."

func send() -> void:
	var text := input.text.strip_edges()
	if text == "":
		return
	KiNet.online().say(text)
	add_line(KiNet.online().nick, text)
	input.text = ""
