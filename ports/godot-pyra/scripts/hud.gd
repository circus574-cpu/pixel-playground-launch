class_name PyraHud
extends Control

signal menu_requested
signal map_requested
signal character_requested
signal zoom_requested
signal dialog_changed(open: bool)

var touch := PyraTouchControls.new()
var place := Label.new()
var hint := Label.new()
var notice := Label.new()
var meter := Label.new()
var modal := PanelContainer.new()
var modal_box := VBoxContainer.new()
var buttons: Array[Button] = []
var top_buttons: Array[Button] = []
var menu_button: Button
var map_button: Button
var character_button: Button
var zoom_button: Button
var header: PanelContainer
var notice_until := 0
var kit: LegendKit
var suspended := false
var area := Rect2()
var status_rect := Rect2()
var status_canvas := StatusCanvas.new()

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

func outlined(label: Label, size_px: int, color: Color) -> void:
	label.add_theme_font_size_override("font_size", size_px)
	label.add_theme_color_override("font_color", color)
	label.add_theme_color_override("font_outline_color", Color(0.06, 0.03, 0.02, 0.95))
	label.add_theme_constant_override("outline_size", 7)

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(touch)
	header = PanelContainer.new()
	header.add_theme_stylebox_override("panel", panel_style(Color(0.075, 0.055, 0.06, 0.82)))
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 2)
	var brand := Label.new()
	brand.text = "KI LEGENDS  /  PYRA"
	brand.add_theme_font_size_override("font_size", 13)
	brand.add_theme_color_override("font_color", Color("e5ad6c"))
	column.add_child(brand)
	place.text = "Twierdza Popiołu"
	place.add_theme_font_size_override("font_size", 23)
	place.add_theme_color_override("font_color", Color("fff0cc"))
	column.add_child(place)
	var spacer := Control.new()
	spacer.custom_minimum_size = Vector2(318, 112)
	column.add_child(spacer)
	header.add_child(column)
	add_child(header)
	status_canvas.hud = self
	status_canvas.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	status_canvas.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(status_canvas)
	map_button = make_top_button("MAPA", func(): map_requested.emit())
	character_button = make_top_button("POSTAĆ", func(): character_requested.emit())
	zoom_button = make_top_button("ZOOM", func(): zoom_requested.emit())
	menu_button = make_top_button("MENU", func(): menu_requested.emit())
	outlined(hint, 21, Color("ffe8b4"))
	hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	hint.size = Vector2(560, 40)
	add_child(hint)
	outlined(notice, 20, Color("fff0c7"))
	notice.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	notice.size = Vector2(620, 60)
	notice.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	add_child(notice)
	outlined(meter, 17, Color("c8e2ff"))
	meter.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	meter.size = Vector2(340, 28)
	add_child(meter)
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

func make_top_button(text: String, callback: Callable) -> Button:
	var button := make_button(text, callback)
	button.custom_minimum_size = Vector2(130, 64)
	button.size = Vector2(130, 64)
	button.add_theme_font_size_override("font_size", 19)
	add_child(button)
	top_buttons.append(button)
	return button

func _layout() -> void:
	area = Rect2(Vector2.ZERO, size)
	if OS.get_name() == "Android":
		var safe := DisplayServer.get_display_safe_area()
		if safe.has_area():
			area = (get_tree().root.get_screen_transform().affine_inverse() * Rect2(safe)).intersection(area)
	header.position = area.position + Vector2(18, 14)
	status_rect = Rect2(header.position + Vector2(22, 100), Vector2(318, 82))
	var x := area.end.x - 18.0
	for button in [menu_button, zoom_button, character_button, map_button]:
		x -= 130.0
		button.position = Vector2(x, area.position.y + 18)
		button.size = Vector2(130, 64)
		x -= 10.0
	hint.position = Vector2(area.get_center().x - 280, area.end.y - 62)
	notice.position = Vector2(area.get_center().x - 310, area.position.y + 120)
	meter.position = Vector2(area.end.x - 358, area.position.y + 92)
	touch.set_safe_area(area)
	status_canvas.queue_redraw()

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
	buttons = top_buttons.duplicate()
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

class StatusCanvas extends Control:
	var hud: PyraHud
	func _draw() -> void:
		hud.draw_status(self)

func bar(canvas: Control, rect: Rect2, ratio: float, fill: Color, text: String) -> void:
	canvas.draw_rect(rect, Color(0.04, 0.025, 0.025, 0.9))
	canvas.draw_rect(Rect2(rect.position + Vector2(2, 2), Vector2(maxf(0.0, (rect.size.x - 4) * clampf(ratio, 0.0, 1.0)), rect.size.y - 4)), fill)
	canvas.draw_rect(rect, Color(0.74, 0.55, 0.3, 0.85), false, 1.5)
	var font := ThemeDB.fallback_font
	canvas.draw_string_outline(font, rect.position + Vector2(8, rect.size.y - 5), text, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, 5, Color(0.05, 0.02, 0.02, 0.95))
	canvas.draw_string(font, rect.position + Vector2(8, rect.size.y - 5), text, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color("fff4dc"))

func draw_status(canvas: Control) -> void:
	if kit == null:
		return
	var s := kit.stats()
	var r := status_rect
	var font := ThemeDB.fallback_font
	canvas.draw_string_outline(font, r.position + Vector2(0, -3), "Legenda · poziom %d" % kit.level, HORIZONTAL_ALIGNMENT_LEFT, -1, 15, 5, Color(0.05, 0.02, 0.02, 0.95))
	canvas.draw_string(font, r.position + Vector2(0, -3), "Legenda · poziom %d" % kit.level, HORIZONTAL_ALIGNMENT_LEFT, -1, 15, Color("f1c77f"))
	bar(canvas, Rect2(r.position + Vector2(0, 6), Vector2(r.size.x, 22)), kit.hp / float(s.maxHp), Color("c23b2b"), "HP %d / %d" % [int(ceil(kit.hp)), int(s.maxHp)])
	bar(canvas, Rect2(r.position + Vector2(0, 31), Vector2(r.size.x, 22)), kit.ki / float(s.maxKi), Color("3977c9"), "KI %d / %d" % [int(kit.ki), int(s.maxKi)])
	bar(canvas, Rect2(r.position + Vector2(0, 56), Vector2(r.size.x, 22)), kit.ember / 100.0, Color("e0832a") if kit.ember < 100.0 else Color("ffc24a"), kit.resource_label())
	var needed := LegendKit.xp_needed(kit.level)
	canvas.draw_rect(Rect2(r.position + Vector2(0, 82), Vector2(r.size.x, 5)), Color(0.04, 0.025, 0.025, 0.9))
	canvas.draw_rect(Rect2(r.position + Vector2(0, 82), Vector2(r.size.x * float(kit.xp) / float(needed), 5)), Color("b9d98d"))

func refresh(game_kit: LegendKit) -> void:
	kit = game_kit
	var s := kit.stats()
	var views := []
	for i in LegendKit.SLOTS:
		var id := kit.slots[i]
		if id == "":
			views.append({})
			continue
		var def: Dictionary = kit.nodes[id]
		var cd := kit.cooldown_left(id)
		views.append({"id": id, "short": id, "ki": def.ki, "cd": cd, "cd_ratio": cd / float(def.cd), "ki_ok": kit.ki >= float(def.ki)})
	touch.slot_view = views
	touch.attack_ratio = clampf((kit.next_basic_at - kit.now) / maxf(0.05, kit.interval()), 0.0, 1.0)
	touch.queue_redraw()
	status_canvas.queue_redraw()

func _process(_delta: float) -> void:
	if Time.get_ticks_msec() > notice_until:
		notice.text = ""

func _input(event: InputEvent) -> void:
	if suspended:
		return
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
