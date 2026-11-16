extends SceneTree
## One launch of the app's first scene (scripts/boot.gd) against a fake server (scripts/godot/e2e_core.py). Exported into the base PCK
## by the runner. Prints one line: E2E_CORE {"report": ..., "reward": ..., "state": ...}; "reward" is a constant of story.gd, which is
## what the test changes in the downloaded core, so it shows which code is really running.

func _initialize() -> void:
	run.call_deferred()

func run() -> void:
	var boot: Control = load("res://scenes/boot.tscn").instantiate()
	boot.set("change_scene", false)
	var box := {"done": false, "report": {}}
	boot.connect("finished", func(report: Dictionary) -> void:
		box.report = report
		box.done = true)
	root.add_child(boot)
	var deadline := Time.get_ticks_msec() + 90000
	while not bool(box.done) and Time.get_ticks_msec() < deadline:
		await process_frame
	var reward: Variant = null
	var story: Resource = load("res://scripts/story.gd")
	if story != null:
		reward = (story as GDScript).get_script_constant_map().get("REWARD_GOLD", null)
	var state: Variant = JSON.parse_string(FileAccess.get_file_as_string("user://core.json")) if FileAccess.file_exists("user://core.json") else {}
	print("E2E_CORE ", JSON.stringify({"report": box.report, "reward": reward, "state": state, "timeout": not bool(box.done)}))
	quit(0)
