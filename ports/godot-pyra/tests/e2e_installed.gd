extends SceneTree
## Runner: scripts/godot/e2e_installed.py (the base is the APK the players have installed, not a fresh export).
## Runs on the REAL APK 1.0 base: the APK's boot.gd mounts the server's core, then the sign-in window of that core is built.

func _initialize() -> void:
	run.call_deferred()

func run() -> void:
	var boot: Control = load("res://scenes/boot.tscn").instantiate()
	boot.set("change_scene", false)
	boot.set("play_intro", false)
	var box := {"done": false, "report": {}}
	boot.connect("finished", func(report: Dictionary) -> void:
		box.report = report
		box.done = true)
	root.add_child(boot)
	var deadline := Time.get_ticks_msec() + 90000
	while not bool(box.done) and Time.get_ticks_msec() < deadline:
		await process_frame
	var gate: Control = load("res://scripts/gate_screen.gd").new()
	root.add_child(gate)
	for i in 3:
		await process_frame
	var panel: PanelContainer = gate.get("panel")
	var style: StyleBox = panel.get_theme_stylebox("panel")
	var heading: Label = gate.get("heading")
	var look: GDScript = load("res://scripts/look.gd")
	var hud: Control = load("res://scripts/hud.gd").new()
	root.add_child(hud)
	var hits := []
	var actions := []
	for i in 14:
		actions.append({"text":"TEST MENU %d" % i,"callback":func(): hits.append(i)})
	hud.show_dialog("MENU", "Sprawdzenie aktualizacji na APK 1.0", actions)
	for i in 6:
		await process_frame
	var scroll: ScrollContainer = hud.modal_box.get_children()[2]
	var first: Button = scroll.get_child(0).get_child(0)
	var point := first.get_global_rect().get_center()
	var down := InputEventScreenTouch.new()
	down.index = 4
	down.pressed = true
	down.position = point
	root.push_input(down, true)
	var drag := InputEventScreenDrag.new()
	drag.index = 4
	drag.position = point - Vector2(0,150)
	root.push_input(drag, true)
	var up := InputEventScreenTouch.new()
	up.index = 4
	up.pressed = false
	up.position = drag.position
	root.push_input(up, true)
	var menu_swipe := hits.is_empty() and scroll.scroll_vertical > 50
	scroll.scroll_vertical = 0
	for i in 3:
		await process_frame
	root.push_input(down, true)
	up.position = point
	root.push_input(up, true)
	var menu_click := hits.size() == 1
	print("E2E_GATE ", JSON.stringify({"report": box.report, "panel_in_tree": panel.is_inside_tree(), "style": style.get_class() + ("/" + str(style.get_script().resource_path) if style.get_script() != null else ""),
		"heading_font": heading.get_theme_font("font") != null, "letters": look.letters() != null, "stone": look.picture("stone") != null,
		"menu_swipe":menu_swipe,"menu_click":menu_click,
		"skin_has_background": (load("res://scripts/skin.gd") as GDScript).get_script_method_list().any(func(m: Dictionary) -> bool: return m.name == "background")}))
	root.remove_child(hud)
	hud.queue_free()
	root.remove_child(gate)
	gate.queue_free()
	root.remove_child(boot)
	boot.queue_free()
	await process_frame
	await process_frame
	quit(0)
