class_name CharacterScreen
extends Control
## Legend sheet: level, XP, final stats with their sources, the 29-node tree (3 branches + root + KI Mode), ability slots.

signal closed

const BRANCH_COLORS := {"A": Color("e8602a"), "B": Color("e3b341"), "C": Color("5aa4ff"), "R": Color("f4efe6"), "T": Color("ffcf70")}
const COL_X := 190.0
const NODE := 64.0
const TREE_PANEL_MIN := 300.0

var kit: RaceKit
var tree: TreeCanvas
var stats_label := Label.new()
var level_label := Label.new()
var points_label := Label.new()
var detail_title := Label.new()
var detail_text := Label.new()
var learn_button: Button
var slot_buttons: Array[Button] = []
var slot_box := HBoxContainer.new()
var level_value := Label.new()
var xp_bar := ProgressBar.new()
var selected := ""

func setup(legend_kit: RaceKit) -> void:
	kit = legend_kit
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	var background := ColorRect.new()
	background.color = Color("120d0f")
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	background.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(background)
	var root := VBoxContainer.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.offset_left = 18
	root.offset_right = -18
	root.offset_top = 12
	root.offset_bottom = -12
	root.add_theme_constant_override("separation", 8)
	add_child(root)
	var bar := HBoxContainer.new()
	level_label.add_theme_font_size_override("font_size", 26)
	level_label.add_theme_color_override("font_color", Color("f1c77f"))
	level_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	bar.add_child(level_label)
	bar.add_child(button("ZAMKNIJ", func(): closed.emit(), Vector2(150, 60)))
	root.add_child(bar)
	var body := HBoxContainer.new()
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	body.add_theme_constant_override("separation", 14)
	root.add_child(body)
	# left: stats
	var left := PanelContainer.new()
	left.custom_minimum_size = Vector2(440, 0)
	left.add_theme_stylebox_override("panel", panel(Color(0.09, 0.07, 0.08, 0.95)))
	var left_box := VBoxContainer.new()
	left_box.add_theme_constant_override("separation", 6)
	left.add_child(left_box)
	body.add_child(left)
	points_label.add_theme_font_size_override("font_size", 20)
	points_label.add_theme_color_override("font_color", Color("b9d98d"))
	left_box.add_child(points_label)
	xp_bar.custom_minimum_size = Vector2(0, 14)
	xp_bar.show_percentage = false
	left_box.add_child(xp_bar)
	stats_label.add_theme_font_size_override("font_size", 19)
	stats_label.add_theme_color_override("font_color", Color("efe0c8"))
	left_box.add_child(stats_label)
	var test_row := HBoxContainer.new()
	test_row.add_theme_constant_override("separation", 8)
	var test_label := Label.new()
	test_label.text = "Poziom próbny"
	test_label.add_theme_font_size_override("font_size", 17)
	test_label.add_theme_color_override("font_color", Color("bdac9b"))
	test_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	test_row.add_child(test_label)
	test_row.add_child(button("−", func(): set_level(kit.level - 1), Vector2(56, 50)))
	level_value.add_theme_font_size_override("font_size", 22)
	level_value.custom_minimum_size = Vector2(44, 0)
	level_value.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	test_row.add_child(level_value)
	test_row.add_child(button("+", func(): set_level(kit.level + 1), Vector2(56, 50)))
	left_box.add_child(test_row)
	var note := Label.new()
	note.text = "Doświadczenie dają potwory poza miastami (poziomy 1–20). Poziom próbny pozwala wypróbować drzewko bez walki."
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	note.add_theme_font_size_override("font_size", 14)
	note.add_theme_color_override("font_color", Color("a69683"))
	left_box.add_child(note)
	left_box.add_child(button("ZRESETUJ DRZEWKO", func(): kit.reset_tree(); refresh(), Vector2(0, 50)))
	# right: tree + detail
	var right := VBoxContainer.new()
	right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	right.add_theme_constant_override("separation", 8)
	body.add_child(right)
	tree = TreeCanvas.new()
	tree.screen = self
	tree.size_flags_vertical = Control.SIZE_EXPAND_FILL
	tree.custom_minimum_size = Vector2(300, 280)
	right.add_child(tree)
	var detail := PanelContainer.new()
	detail.add_theme_stylebox_override("panel", panel(Color(0.09, 0.07, 0.08, 0.95)))
	var detail_box := VBoxContainer.new()
	detail_box.add_theme_constant_override("separation", 4)
	detail.add_child(detail_box)
	detail_title.add_theme_font_size_override("font_size", 22)
	detail_title.add_theme_color_override("font_color", Color("f1c77f"))
	detail_box.add_child(detail_title)
	detail_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	detail_text.custom_minimum_size = Vector2(300, 52)
	detail_text.add_theme_font_size_override("font_size", 17)
	detail_text.add_theme_color_override("font_color", Color("e1d4c4"))
	detail_box.add_child(detail_text)
	var actions := HBoxContainer.new()
	actions.add_theme_constant_override("separation", 8)
	learn_button = button("NAUCZ SIĘ", learn_selected, Vector2(200, 52))
	actions.add_child(learn_button)
	slot_box.add_theme_constant_override("separation", 6)
	actions.add_child(slot_box)
	for i in RaceKit.SLOTS:
		var slot := button("SLOT %d" % (i + 1), func(): assign(i), Vector2(100, 52))
		slot_buttons.append(slot)
		slot_box.add_child(slot)
	detail_box.add_child(actions)
	right.add_child(detail)
	kit.changed.connect(refresh)
	select("R")
	refresh()

func panel(_color: Color = Color.BLACK) -> StyleBox:
	return PyraSkin.window(34.0)

func button(text: String, callback: Callable, minimum: Vector2) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = minimum
	b.focus_mode = Control.FOCUS_NONE
	b.add_theme_font_size_override("font_size", 18)
	b.add_theme_color_override("font_color", Color("fff0cf"))
	b.add_theme_color_override("font_disabled_color", Color("8a7a6a"))
	PyraSkin.style_button(b)
	b.pressed.connect(callback)
	return b

func set_level(value: int) -> void:
	kit.set_level(value)

func branch_of(id: String) -> String:
	return id.substr(0, 1) if id != "R" else "R"

func select(id: String) -> void:
	selected = id
	refresh()

func learn_selected() -> void:
	if selected != "" and kit.learn(selected):
		refresh()

func assign(index: int) -> void:
	if selected == "" or not kit.is_active(selected) or not kit.has(selected):
		return
	kit.assign_slot(index, "" if kit.slots[index] == selected else selected)
	refresh()

func fmt(value: float, digits: int = 0) -> String:
	return ("%." + str(digits) + "f") % value if digits > 0 else str(int(round(value)))

func refresh() -> void:
	if kit == null:
		return
	level_label.text = "%s · poziom %d · %s · mechanika: %s" % [str(kit.data.raceName).to_upper(), kit.level, kit.data.role, kit.data.mechanic]
	level_value.text = str(kit.level)
	points_label.text = "Punkty umiejętności: %d wolnych z %d" % [kit.free_points(), kit.skill_points_total()]
	xp_bar.max_value = RaceKit.xp_needed(kit.level)
	xp_bar.value = kit.xp
	var lines := []
	for row: Dictionary in kit.stat_breakdown():
		var digits := 1 if row.key in ["kiRegen", "crit"] else 0
		var tail := ""
		var parts := []
		for part in [["skills", "drzewko"], ["items", "sprzęt"], ["effects", "efekty"]]:
			var amount := float(row[part[0]])
			if absf(amount) > 0.001:
				parts.append("%s %s%s" % [part[1], "+" if amount > 0 else "−", fmt(absf(amount), digits)])
		if not parts.is_empty():
			tail = "   (baza %s, %s)" % [fmt(float(row.base), digits), ", ".join(parts)]
		lines.append("%s: %s%s" % [row.label, fmt(float(row.total), digits), tail])
	stats_label.text = "\n".join(lines)
	var node: Dictionary = kit.nodes.get(selected, {})
	if not node.is_empty():
		var r := kit.rank(selected)
		var kind: String = {"starting": "zdolność startowa", "active": "zdolność czynna", "passive": "bonus bierny", "choice": "wybór (wyklucza drugi)", "ultimate": "zdolność ostateczna", "ki-mode": "Tryb KI"}.get(str(node.type), str(node.type))
		detail_title.text = "%s · %s · od poziomu %d%s" % [node.name, kind, int(node.minLevel), (" · ranga %d" % r) if r > 0 else ""]
		var effect := str(node.effect)
		if node.has("ki"):
			effect += "  [koszt %d KI, odnowienie %d s]" % [int(node.ki), int(node.cd)]
		detail_text.text = effect
		var check := kit.can_learn(selected)
		learn_button.text = ("ULEPSZ (ranga %d)" % (r + 1)) if r > 0 else "NAUCZ SIĘ (1 pkt)"
		learn_button.disabled = not bool(check.ok)
		if not bool(check.ok):
			learn_button.text = str(check.reason)
		for i in RaceKit.SLOTS:
			slot_buttons[i].visible = kit.is_active(selected) and kit.has(selected)
			slot_buttons[i].text = ("● SLOT %d" % (i + 1)) if kit.slots[i] == selected else "SLOT %d" % (i + 1)
	tree.queue_redraw()

# ---- the tree canvas --------------------------------------------------------------------------

class TreeCanvas extends Control:
	var screen: CharacterScreen
	var offset_x := 0.0
	var dragging := false
	var moved := false
	var start := Vector2.ZERO
	var positions: Dictionary = {}
	var view_scale := 1.0
	var font: Font = ThemeDB.fallback_font
	var title_font: Font = ThemeDB.fallback_font
	var icons: Dictionary = {}

	func _ready() -> void:
		mouse_filter = Control.MOUSE_FILTER_STOP
		clip_contents = true
		var cinzel := load("res://assets/branding/cinzel-bold.ttf")
		if cinzel is Font:
			title_font = cinzel
		for id: String in screen.kit.node_order:
			icons[id] = load("res://assets/icons/skills/%s/%s.png" % [screen.kit.race, id])
		layout()

	func _process(_delta: float) -> void:
		if is_visible_in_tree():
			queue_redraw()

	func layout() -> void:
		var columns := {"1": 1.0, "2": 2.0, "3": 2.0, "4": 3.0, "5": 4.0, "6": 4.0, "7": 5.0, "8": 5.0, "9": 6.0}
		var rows := {"A": 0, "B": 1, "C": 2}
		for id: String in screen.kit.node_order:
			if id == "R":
				positions[id] = Vector2(90.0, 330.0)
			elif id == "T":
				positions[id] = Vector2(90.0 + 7.0 * CharacterScreen.COL_X, 330.0)
			else:
				var branch := id.substr(0, 1)
				var tier := id.substr(1, 1)
				var y := 110.0 + 220.0 * float(rows[branch])
				var pair := {"2": -54.0, "3": 54.0, "5": -54.0, "6": 54.0, "7": -54.0, "8": 54.0}
				positions[id] = Vector2(90.0 + float(columns[tier]) * CharacterScreen.COL_X, y + float(pair.get(tier, 0.0)))

	func content_size() -> Vector2:
		return Vector2(90.0 + 7.0 * CharacterScreen.COL_X + 130.0, 680.0)

	func update_scale() -> void:
		view_scale = clampf(size.y / content_size().y, 0.35, 1.2)
		offset_x = clampf(offset_x, minf(0.0, size.x / view_scale - content_size().x), 0.0)

	func _gui_input(event: InputEvent) -> void:
		if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
			if event.pressed:
				dragging = true
				moved = false
				start = event.position
			else:
				if dragging and not moved:
					pick(event.position)
				dragging = false
		elif event is InputEventMouseMotion and dragging:
			if (event.position - start).length() > 12.0:
				moved = true
			if moved:
				offset_x += event.relative.x / view_scale
				update_scale()

	func radius_of(id: String) -> float:
		match str(screen.kit.nodes[id].type):
			"starting":
				return 50.0
			"ki-mode":
				return 56.0
			"ultimate":
				return 52.0
			"active":
				return 44.0
			"choice":
				return 38.0
		return 34.0

	func pick(at: Vector2) -> void:
		update_scale()
		var local := Vector2(at.x / view_scale - offset_x, at.y / view_scale)
		var best := ""
		var best_d := 1e9
		for id: String in positions:
			var d: float = (positions[id] as Vector2).distance_to(local)
			if d < radius_of(id) + 14.0 and d < best_d:
				best_d = d
				best = id
		if best != "":
			screen.select(best)

	func node_state(id: String) -> String:
		var kit := screen.kit
		if kit.has(id):
			return "learned"
		var node: Dictionary = kit.nodes[id]
		var excludes := str(node.excludes)
		if excludes != "" and kit.has(excludes):
			return "excluded"
		if kit.can_learn(id).ok:
			return "available"
		return "locked"

	func glow(at: Vector2, radius: float, color: Color, strength: float = 0.5) -> void:
		for i in 7:
			var t := float(i) / 7.0
			draw_circle(at, radius * (1.0 - t * 0.7), Color(color.r, color.g, color.b, strength * 0.14 * (0.35 + t)))

	func curve(a: Vector2, b: Vector2) -> PackedVector2Array:
		var points := PackedVector2Array()
		for i in 25:
			var t := float(i) / 24.0
			points.append(Vector2(lerpf(a.x, b.x, t), lerpf(a.y, b.y, smoothstep(0.0, 1.0, t))))
		return points

	func branch_color(id: String) -> Color:
		return CharacterScreen.BRANCH_COLORS.get(id.substr(0, 1), Color.WHITE)

	func _draw() -> void:
		update_scale()
		var t := Time.get_ticks_msec() / 1000.0
		var kit := screen.kit
		var content := content_size()
		# painted backdrop: deep night with a warm glow behind every branch
		draw_rect(Rect2(Vector2.ZERO, size), Color("0b0708"))
		draw_set_transform(Vector2(offset_x * view_scale, 0.0), 0.0, Vector2(view_scale, view_scale))
		for row in 3:
			var c: Color = CharacterScreen.BRANCH_COLORS[["A", "B", "C"][row]]
			for k in 6:
				draw_rect(Rect2(0, 110.0 + 220.0 * row - 108.0 + k * 6.0, content.x, 216.0 - k * 12.0), Color(c.r, c.g, c.b, 0.022))
			draw_line(Vector2(20, 110.0 + 220.0 * row + 112.0), Vector2(content.x - 20, 110.0 + 220.0 * row + 112.0), Color(c.r, c.g, c.b, 0.18), 2.0)
		for i in 44:
			var seed_x := fmod(absf(sin(float(i) * 12.9898) * 43758.5453), 1.0)
			var seed_s := fmod(absf(sin(float(i) * 78.233) * 12345.678), 1.0)
			var life := fmod(t * (0.05 + 0.05 * seed_s) + seed_s * 7.0, 1.0)
			var p := Vector2(seed_x * content.x + sin(t + float(i)) * 14.0, content.y - life * content.y)
			draw_circle(p, 1.5 + 2.0 * seed_s, Color(1.0, 0.55 + 0.3 * seed_s, 0.2, 0.55 * sin(life * PI)))
		# branch titles
		for entry in [["A", 110.0], ["B", 330.0], ["C", 550.0]]:
			var name := str(kit.data.branches[entry[0]].name).to_upper() if kit.data.branches.has(entry[0]) else str(entry[0])
			var c2: Color = CharacterScreen.BRANCH_COLORS[entry[0]]
			draw_string_outline(title_font, Vector2(20.0, float(entry[1]) - 80.0), name, HORIZONTAL_ALIGNMENT_LEFT, -1, 24, 7, Color(0.03, 0.02, 0.02, 0.95))
			draw_string(title_font, Vector2(20.0, float(entry[1]) - 80.0), name, HORIZONTAL_ALIGNMENT_LEFT, -1, 24, c2.lightened(0.15))
		# connections
		for id: String in positions:
			var node: Dictionary = kit.nodes[id]
			for req: String in node.requires:
				var points := curve(positions[req], positions[id])
				var both: bool = kit.has(id) and kit.has(req)
				var color := branch_color(id)
				if both:
					draw_polyline(points, Color(color.r, color.g, color.b, 0.22), 15.0, true)
					draw_polyline(points, color.lightened(0.15), 5.0, true)
					draw_polyline(points, Color(1, 1, 1, 0.6), 1.6, true)
					for k in 3:
						var u := fmod(t * 0.45 + float(k) / 3.0 + float(id.hash() % 7) * 0.13, 1.0)
						var idx := int(u * 24.0)
						draw_circle(points[idx], 5.5, Color(1.0, 0.95, 0.75, 0.95))
						draw_circle(points[idx], 11.0, Color(color.r, color.g, color.b, 0.3))
				else:
					var faded := node_state(id) == "available" and kit.has(req)
					draw_polyline(points, Color(color.r, color.g, color.b, 0.55 if faded else 0.2), 4.0 if faded else 3.0, true)
		# nodes
		for id: String in positions:
			draw_node(id, t)
		draw_set_transform(Vector2.ZERO)

	func draw_node(id: String, t: float) -> void:
		var kit := screen.kit
		var node: Dictionary = kit.nodes[id]
		var at: Vector2 = positions[id]
		var state := node_state(id)
		var r := radius_of(id)
		var color := branch_color(id)
		var kind := str(node.type)
		var pulse := 0.5 + 0.5 * sin(t * 3.0 + at.x * 0.01)
		if state == "learned":
			glow(at, r * (2.1 + 0.25 * pulse), color, 0.9)
		elif state == "available":
			glow(at, r * (1.8 + 0.4 * pulse), color.lightened(0.3), 0.7)
		# diamond for exclusive choices, rays for ultimates and the KI mode
		if kind == "choice":
			var d := r + 14.0
			var poly := PackedVector2Array([at + Vector2(0, -d), at + Vector2(d, 0), at + Vector2(0, d), at + Vector2(-d, 0)])
			draw_colored_polygon(poly, Color(0.08, 0.05, 0.05, 0.95))
			poly.append(poly[0])
			draw_polyline(poly, color if state != "locked" else color.darkened(0.6), 4.0, true)
		if kind in ["ultimate", "ki-mode"] and state != "locked":
			for k in 12:
				var a := TAU * float(k) / 12.0 + t * 0.35
				draw_line(at + Vector2.from_angle(a) * (r + 10.0), at + Vector2.from_angle(a) * (r + 22.0 + 6.0 * pulse), Color(1.0, 0.85, 0.45, 0.8), 3.0, true)
		draw_circle(at, r + 7.0, Color(0.05, 0.03, 0.03, 0.96))
		var ring_color := color
		match state:
			"learned":
				ring_color = color.lightened(0.2)
			"locked":
				ring_color = color.darkened(0.65)
			"excluded":
				ring_color = Color(0.4, 0.22, 0.22)
		draw_arc(at, r + 5.0, 0, TAU, 56, ring_color, 6.0, true)
		draw_arc(at, r + 1.0, 0, TAU, 56, Color(0.95, 0.8, 0.45, 0.85 if state != "locked" else 0.25), 2.0, true)
		if kind in ["active", "ultimate", "ki-mode", "starting"]:
			for k in 8:
				var a2 := TAU * float(k) / 8.0 + PI / 8.0
				draw_circle(at + Vector2.from_angle(a2) * (r + 7.0), 3.4, Color(1.0, 0.88, 0.55, 0.9 if state != "locked" else 0.25))
		var tint := Color.WHITE
		if state == "locked":
			tint = Color(0.32, 0.3, 0.33, 1.0)
		elif state == "excluded":
			tint = Color(0.25, 0.2, 0.2, 1.0)
		elif state == "available":
			tint = Color(0.85 + 0.15 * pulse, 0.85 + 0.15 * pulse, 0.85 + 0.15 * pulse, 1.0)
		var icon: Texture2D = icons.get(id)
		if icon != null:
			draw_texture_rect(icon, Rect2(at - Vector2(r, r), Vector2(r * 2.0, r * 2.0)), false, tint)
		if str(id) == screen.selected:
			for k in 10:
				var a3 := TAU * float(k) / 10.0 - t * 0.9
				draw_arc(at, r + 18.0, a3, a3 + 0.34, 8, Color("fff2c9"), 3.5, true)
		if state == "excluded":
			draw_line(at + Vector2(-r * 0.6, -r * 0.6), at + Vector2(r * 0.6, r * 0.6), Color(0.9, 0.3, 0.25, 0.9), 4.0, true)
			draw_line(at + Vector2(r * 0.6, -r * 0.6), at + Vector2(-r * 0.6, r * 0.6), Color(0.9, 0.3, 0.25, 0.9), 4.0, true)
		# labels
		var tag := str(node.name)
		draw_string_outline(title_font, at + Vector2(-100, r + 28.0), tag, HORIZONTAL_ALIGNMENT_CENTER, 200, 14, 6, Color(0.03, 0.02, 0.02, 0.95))
		draw_string(title_font, at + Vector2(-100, r + 28.0), tag, HORIZONTAL_ALIGNMENT_CENTER, 200, 14, Color("f2e5c8") if state != "locked" else Color(0.55, 0.48, 0.43))
		if state == "locked" and int(node.minLevel) > kit.level:
			var plate := Rect2(at + Vector2(-26, -r - 28.0), Vector2(52, 20))
			draw_rect(plate, Color(0.12, 0.05, 0.04, 0.92))
			draw_rect(plate, Color(0.8, 0.45, 0.3, 0.9), false, 1.5)
			draw_string(font, plate.position + Vector2(0, 15), "Lv %d" % int(node.minLevel), HORIZONTAL_ALIGNMENT_CENTER, 52, 14, Color("ffb08f"))
		if kit.has(id) and kit.rank(id) > 0 and id != "R":
			for k in mini(kit.rank(id), 5):
				draw_circle(at + Vector2((float(k) - float(mini(kit.rank(id), 5) - 1) / 2.0) * 14.0, r + 40.0), 4.0, Color("ffd36a"))
