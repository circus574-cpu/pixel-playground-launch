class_name CharacterScreen
extends Control
## Legend sheet: level, XP, final stats with their sources, the 29-node tree (3 branches + root + KI Mode), ability slots.

signal closed

const BRANCH_COLORS := {"A": Color("e8602a"), "B": Color("e3b341"), "C": Color("5aa4ff"), "R": Color("f4efe6"), "T": Color("ffcf70")}
const COL_X := 190.0
const NODE := 64.0

var kit: LegendKit
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

func setup(legend_kit: LegendKit) -> void:
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
	note.text = "W świecie nie ma jeszcze potworów, więc doświadczenie nie ma źródła. Poziom ustawiasz ręcznie, żeby wypróbować drzewko."
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
	for i in LegendKit.SLOTS:
		var slot := button("SLOT %d" % (i + 1), func(): assign(i), Vector2(100, 52))
		slot_buttons.append(slot)
		slot_box.add_child(slot)
	detail_box.add_child(actions)
	right.add_child(detail)
	kit.changed.connect(refresh)
	select("R")
	refresh()

func panel(color: Color) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = color
	style.border_color = Color("855c39")
	style.set_border_width_all(2)
	style.set_corner_radius_all(12)
	style.content_margin_left = 16
	style.content_margin_right = 16
	style.content_margin_top = 12
	style.content_margin_bottom = 12
	return style

func button(text: String, callback: Callable, minimum: Vector2) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = minimum
	b.focus_mode = Control.FOCUS_NONE
	b.add_theme_font_size_override("font_size", 18)
	b.add_theme_color_override("font_color", Color("fff0cf"))
	b.add_theme_color_override("font_disabled_color", Color("8a7a6a"))
	for state in ["normal", "hover", "pressed", "disabled"]:
		var style := StyleBoxFlat.new()
		style.bg_color = {"normal": Color("533421"), "hover": Color("704b2d"), "pressed": Color("704b2d"), "disabled": Color("2a211f")}[state]
		style.border_color = Color("986c42") if state != "disabled" else Color("453a34")
		style.set_border_width_all(2)
		style.set_corner_radius_all(12)
		style.content_margin_left = 12
		style.content_margin_right = 12
		b.add_theme_stylebox_override(state, style)
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
	level_label.text = "LEGENDA · poziom %d · %s · mechanika: %s" % [kit.level, kit.data.role, kit.data.mechanic]
	level_value.text = str(kit.level)
	points_label.text = "Punkty umiejętności: %d wolnych z %d" % [kit.free_points(), kit.skill_points_total()]
	xp_bar.max_value = LegendKit.xp_needed(kit.level)
	xp_bar.value = kit.xp
	var lines := []
	for row: Dictionary in kit.stat_breakdown():
		var digits := 1 if row.key in ["kiRegen", "crit"] else 0
		var extra := float(row.skills) + float(row.effects)
		var tail := ""
		if absf(extra) > 0.001:
			tail = "   (baza %s %s%s)" % [fmt(float(row.base), digits), "+" if extra > 0 else "−", fmt(absf(extra), digits)]
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
		for i in LegendKit.SLOTS:
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

	func _ready() -> void:
		mouse_filter = Control.MOUSE_FILTER_STOP
		clip_contents = true
		layout()

	func layout() -> void:
		var columns := {"R": 0.0, "1": 1.0, "2": 2.0, "3": 2.0, "4": 3.0, "5": 4.0, "6": 4.0, "7": 5.0, "8": 5.0, "9": 6.0, "T": 7.0}
		var rows := {"A": 0, "B": 1, "C": 2}
		for id: String in screen.kit.node_order:
			if id == "R":
				positions[id] = Vector2(80.0, 310.0)
				continue
			if id == "T":
				positions[id] = Vector2(80.0 + 7.0 * CharacterScreen.COL_X, 310.0)
				continue
			var branch := id.substr(0, 1)
			var tier := id.substr(1, 1)
			var y := 100.0 + 210.0 * float(rows[branch])
			var pair := {"2": -52.0, "3": 52.0, "5": -52.0, "6": 52.0, "7": -52.0, "8": 52.0}
			positions[id] = Vector2(80.0 + float(columns[tier]) * CharacterScreen.COL_X, y + float(pair.get(tier, 0.0)))

	func content_size() -> Vector2:
		return Vector2(80.0 + 7.0 * CharacterScreen.COL_X + 120.0, 650.0)

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
				queue_redraw()

	func pick(at: Vector2) -> void:
		update_scale()
		var local := Vector2(at.x / view_scale - offset_x, at.y / view_scale)
		var best := ""
		var best_d := CharacterScreen.NODE * 0.75
		for id: String in positions:
			var d: float = (positions[id] as Vector2).distance_to(local)
			if d < best_d:
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

	func _draw() -> void:
		update_scale()
		draw_rect(Rect2(Vector2.ZERO, size), Color("0f0b0d"))
		draw_set_transform(Vector2(offset_x * view_scale, 0.0), 0.0, Vector2(view_scale, view_scale))
		var kit := screen.kit
		# branch captions
		for entry in [["A", "OGIEŃ WALKI", 100.0], ["B", "ŻELAZNA WOLA", 310.0], ["C", "WYBUCH KI", 520.0]]:
			var name: String = kit.data.branches[entry[0]].name if kit.data.branches.has(entry[0]) else entry[1]
			draw_string(font, Vector2(18.0, float(entry[2]) - 74.0), str(name).to_upper(), HORIZONTAL_ALIGNMENT_LEFT, -1, 22, CharacterScreen.BRANCH_COLORS[entry[0]])
		for id: String in positions:
			var node: Dictionary = kit.nodes[id]
			for req: String in node.requires:
				var learned: bool = kit.has(id) and kit.has(req)
				var color: Color = CharacterScreen.BRANCH_COLORS.get(id.substr(0, 1), Color.WHITE)
				color.a = 0.95 if learned else 0.28
				draw_line(positions[req], positions[id], color, 5.0 if learned else 3.0, true)
		for id: String in positions:
			var node: Dictionary = kit.nodes[id]
			var at: Vector2 = positions[id]
			var state := node_state(id)
			var branch_color: Color = CharacterScreen.BRANCH_COLORS.get(id.substr(0, 1), Color.WHITE)
			var fill := Color(0.14, 0.1, 0.1)
			var ring := branch_color
			match state:
				"learned":
					fill = branch_color.darkened(0.35)
				"available":
					fill = Color(0.2, 0.14, 0.12)
					ring = branch_color.lightened(0.25)
				"locked":
					ring = branch_color.darkened(0.55)
				"excluded":
					fill = Color(0.08, 0.06, 0.06)
					ring = Color(0.35, 0.25, 0.25)
			var half := CharacterScreen.NODE / 2.0
			var shape := str(node.type)
			if shape in ["active", "ultimate", "ki-mode", "starting"]:
				draw_rect(Rect2(at - Vector2(half, half), Vector2(half * 2, half * 2)), fill)
				draw_rect(Rect2(at - Vector2(half, half), Vector2(half * 2, half * 2)), ring, false, 4.0 if state == "available" else 3.0)
			elif shape == "choice":
				var diamond := PackedVector2Array([at + Vector2(0, -half - 6), at + Vector2(half + 6, 0), at + Vector2(0, half + 6), at + Vector2(-half - 6, 0)])
				draw_colored_polygon(diamond, fill)
				diamond.append(diamond[0])
				draw_polyline(diamond, ring, 3.0)
			else:
				draw_circle(at, half, fill)
				draw_arc(at, half, 0, TAU, 40, ring, 3.0, true)
			if str(id) == screen.selected:
				draw_arc(at, half + 12.0, 0, TAU, 40, Color("fff2c9"), 3.0, true)
			var short := id if id != "T" else "KI"
			draw_string(font, at + Vector2(-half, 8), short, HORIZONTAL_ALIGNMENT_CENTER, half * 2, 24, Color("fff4dc") if state != "locked" else Color(0.6, 0.5, 0.45))
			var tag := str(node.name)
			draw_string_outline(font, at + Vector2(-90, half + 24), tag, HORIZONTAL_ALIGNMENT_CENTER, 180, 14, 4, Color(0.05, 0.02, 0.02, 0.95))
			draw_string(font, at + Vector2(-90, half + 24), tag, HORIZONTAL_ALIGNMENT_CENTER, 180, 14, Color("e9dcc5") if state != "locked" else Color(0.55, 0.47, 0.42))
			if kit.has(id) and kit.rank(id) > 1:
				draw_string(font, at + Vector2(half - 14, -half + 4), "×%d" % kit.rank(id), HORIZONTAL_ALIGNMENT_LEFT, -1, 18, Color("ffe08a"))
			if state == "locked" and int(node.minLevel) > kit.level:
				draw_string(font, at + Vector2(-half, -half - 6), "lv %d" % int(node.minLevel), HORIZONTAL_ALIGNMENT_CENTER, half * 2, 14, Color("ff9a7a"))
		draw_set_transform(Vector2.ZERO)
