extends Control
## A compact, touch-sized gameplay menu; actions use the existing game screens and settings.
const Look := preload("res://scripts/look.gd")
signal closed
var frame := PanelContainer.new()
var grid := GridContainer.new()
var heading := Label.new()
var entries: Array[Dictionary] = []
var buttons: Dictionary = {}
var net: PyraOnline

func setup(actions: Array[Dictionary], connection: PyraOnline) -> void:
	entries = actions
	net = connection

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	var shade := ColorRect.new()
	shade.color = Color(0.015,0.01,0.02,0.9)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(shade)
	frame.add_theme_stylebox_override("panel",Look.window(58))
	add_child(frame)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation",16)
	frame.add_child(box)
	var bar := HBoxContainer.new()
	box.add_child(bar)
	heading.text = "KI LEGENDS · MENU"
	Look.style_heading(heading,34)
	heading.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	heading.clip_text = true
	heading.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	heading.custom_minimum_size.x = 0
	bar.add_child(heading)
	Look.reserve_close(bar)
	Look.add_close(self,func():closed.emit())
	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	box.add_child(scroll)
	grid.columns = 3
	grid.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	grid.add_theme_constant_override("h_separation",16)
	grid.add_theme_constant_override("v_separation",16)
	scroll.add_child(grid)
	for entry in entries:
		var item := make_button(str(entry.text),entry.callback)
		item.visible = not bool(entry.get("staff",false)) or net.is_staff()
		buttons[str(entry.id)] = item
		grid.add_child(item)
	var note := Label.new()
	note.text = "Ruch: lewy joystick  ·  Walka: prawa strona  ·  MAPA: minimapa lub przycisk u góry"
	note.add_theme_font_size_override("font_size",21)
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(note)
	net.session_changed.connect(sync_staff)
	resized.connect(layout)
	frame.minimum_size_changed.connect(func():layout.call_deferred())
	layout()

func make_button(text: String, callback: Callable) -> Button:
	var item := Button.new()
	item.text = text
	item.custom_minimum_size = Vector2(180,88)
	item.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	item.add_theme_font_size_override("font_size",24)
	item.focus_mode = Control.FOCUS_NONE
	PyraSkin.style_button(item)
	item.pressed.connect(callback)
	return item

func sync_staff() -> void:
	for entry in entries:
		if bool(entry.get("staff",false)):
			buttons[str(entry.id)].visible = net.is_staff()

func layout() -> void:
	var safe := Rect2(Vector2.ZERO,size)
	if OS.get_name() == "Android":
		var inset := DisplayServer.get_display_safe_area()
		if inset.has_area():
			safe = (get_tree().root.get_screen_transform().affine_inverse()*Rect2(inset)).intersection(safe)
	frame.position = safe.position+Vector2(20,16)
	frame.size = safe.size-Vector2(40,32)
	grid.columns = 4 if safe.size.x >= 1450 else 3
