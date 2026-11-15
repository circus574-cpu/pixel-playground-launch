class_name PyraHud
extends Control

signal menu_requested
signal dialog_changed(open: bool)

var touch := PyraTouchControls.new()
var place := Label.new()
var hint := Label.new()
var notice := Label.new()
var modal := PanelContainer.new()
var modal_box := VBoxContainer.new()
var buttons: Array[Button] = []
var menu_button: Button
var header: PanelContainer
var notice_until := 0

func panel_style(background: Color, border: Color = Color("855c39")) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = background
	style.border_color = border
	style.set_border_width_all(2)
	style.set_corner_radius_all(14)
	style.content_margin_left = 22
	style.content_margin_right = 22
	style.content_margin_top = 16
	style.content_margin_bottom = 16
	return style

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(touch)
	header = PanelContainer.new()
	header.position = Vector2(22, 20)
	header.add_theme_stylebox_override("panel", panel_style(Color(0.075, 0.055, 0.06, 0.9)))
	var column := VBoxContainer.new()
	var brand := Label.new()
	brand.text = "KI LEGENDS  /  PYRA"
	brand.add_theme_font_size_override("font_size", 15)
	brand.add_theme_color_override("font_color", Color("e5ad6c"))
	column.add_child(brand)
	place.text = "Twierdza Popiołu"
	place.add_theme_font_size_override("font_size", 25)
	place.add_theme_color_override("font_color", Color("fff0cc"))
	column.add_child(place)
	var subtitle := Label.new()
	subtitle.text = "GODOT 4 · PRÓBA MIASTA · STREFA BEZPIECZNA"
	subtitle.add_theme_font_size_override("font_size", 11)
	subtitle.add_theme_color_override("font_color", Color("bdac9b"))
	column.add_child(subtitle)
	header.add_child(column)
	add_child(header)
	menu_button = make_button("MENU  /  Esc", func(): menu_requested.emit())
	menu_button.position = Vector2(size.x - 212, 26)
	menu_button.size = Vector2(188, 80)
	add_child(menu_button)
	menu_button.resized.connect(queue_redraw)
	hint.position = Vector2(size.x / 2 - 250, size.y - 85)
	hint.size = Vector2(500, 50)
	hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	hint.add_theme_font_size_override("font_size", 21)
	hint.add_theme_color_override("font_color", Color("ffe8b4"))
	hint.add_theme_color_override("font_shadow_color", Color.BLACK)
	hint.add_theme_constant_override("shadow_offset_x", 2)
	hint.add_theme_constant_override("shadow_offset_y", 2)
	add_child(hint)
	notice.position = Vector2(size.x / 2 - 250, 145)
	notice.size = Vector2(500, 60)
	notice.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	notice.add_theme_font_size_override("font_size", 20)
	notice.add_theme_color_override("font_color", Color("fff0c7"))
	notice.add_theme_color_override("font_shadow_color", Color.BLACK)
	notice.add_theme_constant_override("shadow_offset_x", 2)
	add_child(notice)
	modal.add_theme_stylebox_override("panel", panel_style(Color("191315"), Color("c18a4b")))
	modal.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	modal.offset_left = -375
	modal.offset_right = 375
	modal.offset_top = -200
	modal.offset_bottom = 200
	modal.mouse_filter = Control.MOUSE_FILTER_STOP
	modal_box.add_theme_constant_override("separation", 15)
	modal.add_child(modal_box)
	add_child(modal)
	modal.hide()
	resized.connect(_layout)
	_layout()

func _layout() -> void:
	var area := Rect2(Vector2.ZERO,size)
	if OS.get_name() == "Android":
		var safe := DisplayServer.get_display_safe_area()
		if safe.has_area():
			area = (get_tree().root.get_screen_transform().affine_inverse() * Rect2(safe)).intersection(area)
	header.position = area.position + Vector2(22,20)
	menu_button.position = Vector2(area.end.x - 212, area.position.y+26)
	hint.position = Vector2(area.get_center().x - 250, area.end.y - 85)
	notice.position = Vector2(area.get_center().x - 250, area.position.y+145)
	touch.set_safe_area(area)

func make_button(text: String, callback: Callable) -> Button:
	var button := Button.new()
	button.text = text
	button.mouse_filter = Control.MOUSE_FILTER_IGNORE
	button.focus_mode = Control.FOCUS_NONE
	button.custom_minimum_size = Vector2(160, 80)
	button.add_theme_font_size_override("font_size", 23)
	button.add_theme_color_override("font_color", Color("fff0cf"))
	button.add_theme_stylebox_override("normal", panel_style(Color("533421"), Color("986c42")))
	button.add_theme_stylebox_override("hover", panel_style(Color("704b2d"), Color("d4aa68")))
	button.pressed.connect(callback)
	buttons.append(button)
	return button

func show_dialog(title: String, text: String, actions: Array = []) -> void:
	for child in modal_box.get_children():
		child.hide()
		child.queue_free()
	buttons = [menu_button]
	var heading := Label.new()
	heading.text = title
	heading.add_theme_font_size_override("font_size", 30)
	heading.add_theme_color_override("font_color", Color("f1c77f"))
	modal_box.add_child(heading)
	var body := Label.new()
	body.text = text
	body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	body.custom_minimum_size = Vector2(660, 0)
	body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	body.add_theme_font_size_override("font_size", 23)
	body.add_theme_color_override("font_color", Color("e1d4c4"))
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(680, 160)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.add_child(body)
	modal_box.add_child(scroll)
	for action: Dictionary in actions:
		modal_box.add_child(make_button(action.text, action.callback))
	modal_box.add_child(make_button("ZAMKNIJ", close_dialog))
	modal.show()
	touch.blocked = true
	touch.reset()
	dialog_changed.emit(true)

func close_dialog() -> void:
	modal.hide()
	touch.blocked = false
	touch.reset()
	dialog_changed.emit(false)

func toast(text: String) -> void:
	notice.text = text
	notice_until = Time.get_ticks_msec() + 3200

func _process(_delta: float) -> void:
	if Time.get_ticks_msec() > notice_until:
		notice.text = ""

func _input(event: InputEvent) -> void:
	var pressed := false
	var point := Vector2.ZERO
	if event is InputEventScreenTouch:
		pressed = event.pressed and not event.canceled
		point = event.position
	elif event is InputEventMouseButton and event.device != InputEvent.DEVICE_ID_EMULATION:
		pressed = event.pressed and event.button_index == MOUSE_BUTTON_LEFT
		point = event.position
	if not pressed:
		return
	# Custom dispatch handles every finger; these visual Button nodes ignore the emulated mouse.
	for button in buttons:
		if is_instance_valid(button) and button.is_visible_in_tree() and button.get_global_rect().has_point(point):
			button.pressed.emit()
			get_viewport().set_input_as_handled()
			return
