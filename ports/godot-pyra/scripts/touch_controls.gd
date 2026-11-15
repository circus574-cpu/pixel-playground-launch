class_name PyraTouchControls
extends Control

signal motion_changed(value: Vector2)
signal interaction_requested

var move_pointer := -1
var action_pointer := -1
var mouse_drag := false
var stick := Vector2.ZERO
var blocked := false
var action_text := "E · INTERAKCJA"
var enabled_target := false
var left_center := Vector2.ZERO
var right_center := Vector2.ZERO
var safe_area := Rect2()
const STICK_RADIUS := 84.0
const ACTION_RADIUS := 65.0

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	resized.connect(_layout)
	_layout()

func _layout() -> void:
	var area := safe_area if safe_area.has_area() else Rect2(Vector2.ZERO,size)
	left_center = Vector2(area.position.x+126, area.end.y - 126)
	right_center = Vector2(area.end.x - 112, area.end.y - 120)
	queue_redraw()

func set_safe_area(area: Rect2) -> void:
	safe_area = area
	_layout()

func reset() -> void:
	move_pointer = -1
	action_pointer = -1
	mouse_drag = false
	stick = Vector2.ZERO
	motion_changed.emit(Vector2.ZERO)
	queue_redraw()

func update_stick(at: Vector2) -> void:
	stick = ((at - left_center) / STICK_RADIUS).limit_length(1.0)
	var output := Vector2.ZERO
	if stick.length() > 0.12:
		output = stick.normalized() * ((stick.length() - 0.12) / 0.88)
	motion_changed.emit(output)
	queue_redraw()

func _input(event: InputEvent) -> void:
	if blocked:
		return
	if event is InputEventScreenTouch:
		if not event.pressed or event.canceled:
			if event.index == move_pointer:
				move_pointer = -1
				stick = Vector2.ZERO
				motion_changed.emit(Vector2.ZERO)
			if event.index == action_pointer:
				action_pointer = -1
			queue_redraw()
		elif event.position.distance_to(left_center) <= STICK_RADIUS + 35 and move_pointer == -1:
			move_pointer = event.index
			update_stick(event.position)
			get_viewport().set_input_as_handled()
		elif event.position.distance_to(right_center) <= ACTION_RADIUS and action_pointer == -1:
			action_pointer = event.index
			interaction_requested.emit()
			get_viewport().set_input_as_handled()
	elif event is InputEventScreenDrag and event.index == move_pointer:
		update_stick(event.position)
		get_viewport().set_input_as_handled()
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT and event.device != InputEvent.DEVICE_ID_EMULATION:
		if not event.pressed:
			if mouse_drag:
				mouse_drag = false
				stick = Vector2.ZERO
				motion_changed.emit(Vector2.ZERO)
		elif event.position.distance_to(left_center) <= STICK_RADIUS + 35:
			mouse_drag = true
			update_stick(event.position)
		elif event.position.distance_to(right_center) <= ACTION_RADIUS:
			interaction_requested.emit()
	elif event is InputEventMouseMotion and mouse_drag:
		update_stick(event.position)

func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT:
		reset()

func _draw() -> void:
	if blocked:
		return
	draw_circle(left_center, STICK_RADIUS + 7, Color(0.06, 0.045, 0.045, 0.72))
	draw_arc(left_center, STICK_RADIUS + 7, 0, TAU, 64, Color(0.8, 0.55, 0.3, 0.75), 2, true)
	draw_circle(left_center, STICK_RADIUS, Color(0.22, 0.13, 0.11, 0.55))
	draw_circle(left_center + stick * STICK_RADIUS, 31, Color(0.92, 0.66, 0.39, 0.86))
	draw_circle(right_center, ACTION_RADIUS, Color("b36f35") if enabled_target else Color("584436"))
	draw_arc(right_center, ACTION_RADIUS, 0, TAU, 64, Color("f6d18b"), 2, true)
	var font := ThemeDB.fallback_font
	var text_size := font.get_string_size(action_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 14)
	draw_string(font, right_center - Vector2(text_size.x / 2, -5), action_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color("fff0cf"))
	draw_string(font, left_center + Vector2(-40, STICK_RADIUS + 29), "WASD / DOTYK", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color("ead4b4"))
