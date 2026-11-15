class_name PyraTouchControls
extends Control
## Left thumb: 360° stick. Right thumb: attack, four ability slots, dodge and context interaction.
## Every finger has its own identifier, so moving and fighting at once never steal each other's touch.

signal motion_changed(value: Vector2)
signal interaction_requested
signal attack_changed(held: bool)
signal skill_requested(slot: int)
signal dodge_requested

const STICK_RADIUS := 84.0
const ATTACK_RADIUS := 76.0
const SKILL_RADIUS := 47.0
const DODGE_RADIUS := 40.0
const ACT_RADIUS := 54.0

var move_pointer := -1
var attack_pointer := -1
var other_pointers: Dictionary = {}   # touch index -> action name
var mouse_drag := false
var mouse_action := ""
var stick := Vector2.ZERO
var blocked := false
var action_text := "E"
var enabled_target := false
var left_center := Vector2.ZERO
var attack_center := Vector2.ZERO
var skill_centers: Array[Vector2] = []
var dodge_center := Vector2.ZERO
var act_center := Vector2.ZERO
var safe_area := Rect2()
var slot_view: Array = [{}, {}, {}, {}]
var attack_ratio := 1.0
var dodge_ratio := 1.0
var attack_held := false
var font: Font = ThemeDB.fallback_font

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	resized.connect(_layout)
	_layout()

func _layout() -> void:
	var area := safe_area if safe_area.has_area() else Rect2(Vector2.ZERO, size)
	left_center = Vector2(area.position.x + 140, area.end.y - 140)
	attack_center = Vector2(area.end.x - 150, area.end.y - 140)
	skill_centers.clear()
	for angle in [172.0, 203.0, 234.0, 265.0]:
		skill_centers.append(attack_center + Vector2.from_angle(deg_to_rad(angle)) * 146.0)
	dodge_center = attack_center + Vector2.from_angle(deg_to_rad(138.0)) * 118.0
	act_center = attack_center + Vector2.from_angle(deg_to_rad(302.0)) * 154.0
	queue_redraw()

func set_safe_area(area: Rect2) -> void:
	safe_area = area
	_layout()

func reset() -> void:
	move_pointer = -1
	attack_pointer = -1
	other_pointers.clear()
	mouse_drag = false
	mouse_action = ""
	stick = Vector2.ZERO
	motion_changed.emit(Vector2.ZERO)
	set_attack(false)
	queue_redraw()

func set_attack(held: bool) -> void:
	if attack_held != held:
		attack_held = held
		attack_changed.emit(held)

func update_stick(at: Vector2) -> void:
	stick = ((at - left_center) / STICK_RADIUS).limit_length(1.0)
	var output := Vector2.ZERO
	if stick.length() > 0.12:
		output = stick.normalized() * ((stick.length() - 0.12) / 0.88)
	motion_changed.emit(output)
	queue_redraw()

## Which right-hand control is under this point ("" when none).
func control_at(point: Vector2) -> String:
	if point.distance_to(attack_center) <= ATTACK_RADIUS:
		return "attack"
	for i in skill_centers.size():
		if point.distance_to(skill_centers[i]) <= SKILL_RADIUS + 6.0:
			return "skill%d" % i
	if point.distance_to(dodge_center) <= DODGE_RADIUS + 6.0:
		return "dodge"
	if point.distance_to(act_center) <= ACT_RADIUS + 4.0:
		return "act"
	return ""

func press(action: String) -> void:
	match action:
		"attack":
			set_attack(true)
		"dodge":
			dodge_requested.emit()
		"act":
			interaction_requested.emit()
		_:
			if action.begins_with("skill"):
				skill_requested.emit(int(action.substr(5)))

func release(action: String) -> void:
	if action == "attack":
		set_attack(false)

func _input(event: InputEvent) -> void:
	if blocked:
		return
	if event is InputEventScreenTouch:
		if not event.pressed or event.canceled:
			if event.index == move_pointer:
				move_pointer = -1
				stick = Vector2.ZERO
				motion_changed.emit(Vector2.ZERO)
			if other_pointers.has(event.index):
				release(other_pointers[event.index])
				other_pointers.erase(event.index)
			queue_redraw()
		else:
			var action := control_at(event.position)
			if action != "":
				other_pointers[event.index] = action
				press(action)
				get_viewport().set_input_as_handled()
			elif event.position.distance_to(left_center) <= STICK_RADIUS + 35 and move_pointer == -1:
				move_pointer = event.index
				update_stick(event.position)
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
			if mouse_action != "":
				release(mouse_action)
				mouse_action = ""
		else:
			var click := control_at(event.position)
			if click != "":
				mouse_action = click
				press(click)
			elif event.position.distance_to(left_center) <= STICK_RADIUS + 35:
				mouse_drag = true
				update_stick(event.position)
	elif event is InputEventMouseMotion and mouse_drag:
		update_stick(event.position)

func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT:
		reset()

func ring(center: Vector2, radius: float, fill: Color, border: Color) -> void:
	draw_circle(center, radius, fill)
	draw_arc(center, radius, 0, TAU, 48, border, 2.5, true)

func label_at(center: Vector2, text: String, size_px: int, color: Color = Color("fff0cf")) -> void:
	var s := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, size_px)
	draw_string_outline(font, center + Vector2(-s.x / 2, size_px * 0.35), text, HORIZONTAL_ALIGNMENT_LEFT, -1, size_px, 5, Color(0.07, 0.03, 0.02, 0.95))
	draw_string(font, center + Vector2(-s.x / 2, size_px * 0.35), text, HORIZONTAL_ALIGNMENT_LEFT, -1, size_px, color)

func _draw() -> void:
	if blocked:
		return
	draw_circle(left_center, STICK_RADIUS + 7, Color(0.06, 0.045, 0.045, 0.62))
	draw_arc(left_center, STICK_RADIUS + 7, 0, TAU, 64, Color(0.8, 0.55, 0.3, 0.75), 2, true)
	draw_circle(left_center, STICK_RADIUS, Color(0.22, 0.13, 0.11, 0.45))
	draw_circle(left_center + stick * STICK_RADIUS, 31, Color(0.92, 0.66, 0.39, 0.86))
	# attack
	ring(attack_center, ATTACK_RADIUS, Color("c1552a") if attack_held else Color(0.62, 0.27, 0.13, 0.82), Color("ffd08b"))
	if attack_ratio < 1.0:
		draw_arc(attack_center, ATTACK_RADIUS - 6, -PI / 2, -PI / 2 + TAU * attack_ratio, 40, Color(1, 0.9, 0.6, 0.8), 6.0, true)
	label_at(attack_center, "ATAK", 24)
	# abilities
	for i in skill_centers.size():
		var info: Dictionary = slot_view[i] if i < slot_view.size() else {}
		var c := skill_centers[i]
		var has_skill := not info.is_empty() and str(info.get("id", "")) != ""
		var ready := has_skill and float(info.get("cd", 0.0)) <= 0.0 and bool(info.get("ki_ok", true))
		ring(c, SKILL_RADIUS, Color(0.55, 0.22, 0.1, 0.85) if ready else Color(0.2, 0.14, 0.12, 0.72), Color("f6d18b") if has_skill else Color(0.5, 0.4, 0.3, 0.6))
		if has_skill:
			var ratio := float(info.get("cd_ratio", 0.0))
			if ratio > 0.0:
				draw_arc(c, SKILL_RADIUS - 5, -PI / 2, -PI / 2 + TAU * ratio, 32, Color(0.05, 0.03, 0.03, 0.8), 9.0, true)
			label_at(c + Vector2(0, -6), str(info.get("short", "")), 17)
			label_at(c + Vector2(0, 17), "%d KI" % int(info.get("ki", 0)), 12, Color("a9d3ff") if bool(info.get("ki_ok", true)) else Color("ff8d7a"))
			if float(info.get("cd", 0.0)) > 0.0:
				label_at(c, "%.0f" % ceilf(float(info.cd)), 22, Color("ffffff"))
		else:
			label_at(c, str(i + 1), 18, Color(0.8, 0.7, 0.6, 0.7))
	ring(dodge_center, DODGE_RADIUS, Color(0.15, 0.2, 0.26, 0.75), Color("9fc6e8"))
	label_at(dodge_center, "UNIK", 14)
	ring(act_center, ACT_RADIUS, Color("b36f35") if enabled_target else Color(0.34, 0.27, 0.21, 0.72), Color("f6d18b") if enabled_target else Color(0.6, 0.5, 0.4, 0.6))
	label_at(act_center, action_text, 16)
