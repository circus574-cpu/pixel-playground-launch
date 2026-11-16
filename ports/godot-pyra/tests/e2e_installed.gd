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
	print("E2E_GATE ", JSON.stringify({"report": box.report, "panel_in_tree": panel.is_inside_tree(), "style": style.get_class() + ("/" + str(style.get_script().resource_path) if style.get_script() != null else ""),
		"heading_font": heading.get_theme_font("font") != null, "letters": look.letters() != null, "stone": look.picture("stone") != null,
		"skin_has_background": (load("res://scripts/skin.gd") as GDScript).get_script_method_list().any(func(m: Dictionary) -> bool: return m.name == "background")}))
	quit(0)
