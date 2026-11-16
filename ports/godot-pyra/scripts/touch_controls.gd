class_name PyraTouchControls
extends Control
## Left thumb: 360° stick. Right thumb: attack, four ability slots, dodge and context interaction.
## Every finger has its own identifier, so moving and fighting at once never steal each other's touch.

signal motion_changed(value: Vector2)
signal interaction_requested
signal attack_changed(held: bool)
signal skill_requested(slot: int)
signal dodge_requested
signal potion_requested

const STICK_RADIUS := 84.0
const ATTACK_RADIUS := 76.0
const SKILL_RADIUS := 47.0
const DODGE_RADIUS := 40.0
const ACT_RADIUS := 54.0
const POTION_RADIUS := 34.0

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
var potion_center := Vector2.ZERO
var potion_count := 0
var potion_ratio := 0.0
var potion_icon: Texture2D = load("res://assets/icons/items/potion.webp")
var safe_area := Rect2()
var slot_view: Array = [{}, {}, {}, {}]
var attack_ratio := 1.0
var dodge_ratio := 1.0
var attack_held := false
var font: Font = ThemeDB.fallback_font
var cv: CanvasItem
signal art_changed

func invalidate() -> void:
	art_changed.emit()

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
	potion_center = dodge_center + Vector2(-86.0, 12.0)
	invalidate()

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
	invalidate()

func set_attack(held: bool) -> void:
	if attack_held != held:
		attack_held = held
		attack_changed.emit(held)
		invalidate()

func update_stick(at: Vector2) -> void:
	stick = ((at - left_center) / STICK_RADIUS).limit_length(1.0)
	var output := Vector2.ZERO
	if stick.length() > 0.12:
		output = stick.normalized() * ((stick.length() - 0.12) / 0.88)
	motion_changed.emit(output)
	invalidate()

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
	if point.distance_to(potion_center) <= POTION_RADIUS + 6.0:
		return "potion"
	return ""

func press(action: String) -> void:
	match action:
		"attack":
			set_attack(true)
		"dodge":
			dodge_requested.emit()
		"act":
			interaction_requested.emit()
		"potion":
			potion_requested.emit()
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
			invalidate()
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

const GOLD := Color("f1c77f")

func ring(center: Vector2, radius: float, fill: Color, border: Color) -> void:
	cv.draw_circle(center, radius + 3.0, Color(0, 0, 0, 0.32))
	cv.draw_circle(center, radius, fill)
	cv.draw_arc(center, radius, 0, TAU, 48, border, 2.5, true)
	cv.draw_arc(center, radius - 4.0, PI * 1.08, PI * 1.92, 20, Color(1, 1, 1, 0.14), 2.0, true)

func label_at(center: Vector2, text: String, size_px: int, color: Color = Color("fff0cf")) -> void:
	var f: Font = MapStyle.font() if size_px >= 14 and text.length() > 1 and not text.is_valid_int() else font
	var s := f.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, size_px)
	cv.draw_string_outline(f, center + Vector2(-s.x / 2, size_px * 0.35), text, HORIZONTAL_ALIGNMENT_LEFT, -1, size_px, 5, Color(0.07, 0.03, 0.02, 0.95))
	cv.draw_string(f, center + Vector2(-s.x / 2, size_px * 0.35), text, HORIZONTAL_ALIGNMENT_LEFT, -1, size_px, color)

## Pie that sweeps clockwise from the top: the part of a cooldown that is still left.
func cooldown_pie(c: Vector2, radius: float, ratio: float) -> void:
	if ratio <= 0.0:
		return
	var pts := PackedVector2Array([c])
	var steps := 36
	for i in steps + 1:
		var a := -PI / 2.0 + TAU * ratio * float(i) / float(steps)
		pts.append(c + Vector2.from_angle(a) * radius)
	cv.draw_colored_polygon(pts, Color(0.02, 0.02, 0.03, 0.72))

func draw_disc_icon(c: Vector2, radius: float, tex: Texture2D) -> void:
	var pts := PackedVector2Array()
	var uvs := PackedVector2Array()
	for i in 36:
		var d := Vector2.from_angle(TAU * i / 36.0)
		pts.append(c + d * radius)
		uvs.append(Vector2(0.5, 0.5) + d * 0.5)
	cv.draw_colored_polygon(pts, Color.WHITE, uvs, tex)

func paint() -> void:
	if blocked:
		return
	# stick
	cv.draw_circle(left_center, STICK_RADIUS + 9, Color(0.05, 0.04, 0.045, 0.55))
	cv.draw_arc(left_center, STICK_RADIUS + 9, 0, TAU, 64, Color(0.62, 0.45, 0.26, 0.85), 3, true)
	cv.draw_arc(left_center, STICK_RADIUS - 4, 0, TAU, 64, Color(0.62, 0.45, 0.26, 0.28), 1.5, true)
	for i in 4:
		var d := Vector2.from_angle(i * PI / 2.0)
		var tip := left_center + d * (STICK_RADIUS - 14.0)
		var side := Vector2(-d.y, d.x) * 7.0
		cv.draw_colored_polygon(PackedVector2Array([tip + d * 7.0, tip - d * 4.0 + side, tip - d * 4.0 - side]), Color(0.9, 0.7, 0.4, 0.32))
	var knob := left_center + stick * STICK_RADIUS
	cv.draw_circle(knob + Vector2(0, 3), 33, Color(0, 0, 0, 0.3))
	cv.draw_circle(knob, 31, Color(0.88, 0.62, 0.36, 0.92))
	cv.draw_arc(knob, 31, 0, TAU, 36, Color(1, 0.9, 0.7, 0.9), 2.5, true)
	cv.draw_circle(knob + Vector2(-6, -8), 10, Color(1, 1, 1, 0.16))
	# attack: ring, sword glyph and the swing cooldown
	ring(attack_center, ATTACK_RADIUS, Color("c1552a") if attack_held else Color(0.55, 0.22, 0.11, 0.88), Color("ffd08b"))
	var sw := attack_center
	cv.draw_line(sw + Vector2(-22, 24), sw + Vector2(24, -22), Color(0.95, 0.92, 0.85), 5.0, true)
	cv.draw_line(sw + Vector2(-26, 8), sw + Vector2(-8, 26), GOLD, 5.0, true)
	cv.draw_line(sw + Vector2(-26, 26), sw + Vector2(-17, 17), Color(0.45, 0.22, 0.1), 5.0, true)
	if attack_ratio < 1.0:
		cv.draw_arc(attack_center, ATTACK_RADIUS - 6, -PI / 2, -PI / 2 + TAU * attack_ratio, 40, Color(1, 0.9, 0.6, 0.85), 6.0, true)
	# abilities: painted icon, cooldown sweep, KI cost pip, slot number
	for i in skill_centers.size():
		var info: Dictionary = slot_view[i] if i < slot_view.size() else {}
		var c := skill_centers[i]
		var has_skill := not info.is_empty() and str(info.get("id", "")) != ""
		var ready := has_skill and float(info.get("cd", 0.0)) <= 0.0 and bool(info.get("ki_ok", true))
		ring(c, SKILL_RADIUS, Color(0.13, 0.09, 0.08, 0.86), Color("f6d18b") if ready else (Color(0.62, 0.48, 0.32, 0.9) if has_skill else Color(0.5, 0.4, 0.3, 0.5)))
		if has_skill:
			var icon: Texture2D = info.get("icon", null)
			if icon != null:
				draw_disc_icon(c, SKILL_RADIUS - 5.0, icon)
			else:
				label_at(c, str(info.get("short", "")), 17)
			var ratio := float(info.get("cd_ratio", 0.0))
			if float(info.get("cd", 0.0)) > 0.0:
				cooldown_pie(c, SKILL_RADIUS - 5.0, ratio)
				label_at(c, "%.0f" % ceilf(float(info.cd)), 22, Color("ffffff"))
			elif not bool(info.get("ki_ok", true)):
				cv.draw_circle(c, SKILL_RADIUS - 5.0, Color(0.05, 0.1, 0.25, 0.6))
			if ready:
				cv.draw_arc(c, SKILL_RADIUS + 3.0, 0, TAU, 40, Color(1, 0.88, 0.5, 0.55), 2.0, true)
			var pip := c + Vector2(0, SKILL_RADIUS - 2.0)
			cv.draw_circle(pip, 11.0, Color(0.05, 0.08, 0.2, 0.95))
			cv.draw_arc(pip, 11.0, 0, TAU, 20, Color("6fa8f0") if bool(info.get("ki_ok", true)) else Color("ff8d7a"), 1.8, true)
			label_at(pip, "%d" % int(info.get("ki", 0)), 12, Color("c7e0ff") if bool(info.get("ki_ok", true)) else Color("ff8d7a"))
		else:
			label_at(c, str(i + 1), 18, Color(0.8, 0.7, 0.6, 0.7))
	# dodge
	ring(dodge_center, DODGE_RADIUS, Color(0.12, 0.17, 0.23, 0.8), Color("9fc6e8"))
	for k in 2:
		var o := dodge_center + Vector2(-8 + 11 * k, 0)
		cv.draw_polyline(PackedVector2Array([o + Vector2(-5, -9), o + Vector2(5, 0), o + Vector2(-5, 9)]), Color("cfe6fa"), 3.2, true)
	if dodge_ratio < 1.0:
		cooldown_pie(dodge_center, DODGE_RADIUS - 3.0, 1.0 - dodge_ratio)
	# potion quick slot
	ring(potion_center, POTION_RADIUS, Color(0.15, 0.09, 0.1, 0.82), Color("e58f8f") if potion_count > 0 else Color(0.5, 0.4, 0.35, 0.5))
	if potion_icon != null:
		cv.draw_texture_rect(potion_icon, Rect2(potion_center - Vector2.ONE * 21.0, Vector2.ONE * 42.0), false, Color(1, 1, 1, 1.0 if potion_count > 0 else 0.35))
	if potion_ratio > 0.0:
		cooldown_pie(potion_center, POTION_RADIUS - 3.0, potion_ratio)
	var badge := potion_center + Vector2(20, 22)
	cv.draw_circle(badge, 11.0, Color(0.1, 0.05, 0.05, 0.95))
	cv.draw_arc(badge, 11.0, 0, TAU, 20, Color("e58f8f"), 1.6, true)
	label_at(badge, str(potion_count), 13)
	# interaction
	ring(act_center, ACT_RADIUS, Color("b36f35") if enabled_target else Color(0.3, 0.23, 0.18, 0.75), Color("f6d18b") if enabled_target else Color(0.6, 0.5, 0.4, 0.55))
	label_at(act_center, action_text, 22, Color("fff0cf") if enabled_target else Color(0.8, 0.72, 0.62, 0.7))
