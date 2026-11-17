extends SceneTree
## Several characters on one device: every character keeps its own slot, the game can switch between them, and the title screen asks which one enters the game.
## xvfb-run -a -s '-screen 0 2000x900x24' env LIBGL_ALWAYS_SOFTWARE=1 godot --audio-driver Dummy --path ports/godot-pyra --rendering-method gl_compatibility --script res://tests/characters_test.gd -- --qa-output /tmp/pyra-characters
const Characters := preload("res://scripts/characters.gd")
var output := "/tmp/pyra-characters"
var failures := 0

func frames(n: int) -> void:
	for i in n:
		await process_frame

func check(ok: bool, what: String) -> void:
	print(("ok   " if ok else "FAIL ") + what)
	if not ok:
		failures += 1

func shot(name: String) -> void:
	await frames(10)
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("%s/%s.png" % [output, name])

func start_game() -> PyraGame:
	var landing: PyraTitleScreen = load("res://scenes/title.tscn").instantiate()
	root.add_child(landing)
	await frames(5)
	landing.start_city()
	return null

func wait_game(landing_gone: bool = true) -> PyraGame:
	var deadline := Time.get_ticks_msec() + 20000
	while Time.get_ticks_msec() < deadline:
		var found := root.get_children().filter(func(n: Node) -> bool: return n is PyraGame)
		if not found.is_empty():
			return found[0] as PyraGame
		await process_frame
	return null

func _initialize() -> void:
	run.call_deferred()

func run() -> void:
	var args := OS.get_cmdline_user_args()
	for i in args.size():
		if args[i] == "--qa-output" and i + 1 < args.size():
			output = args[i + 1]
	DirAccess.make_dir_recursive_absolute(output)
	root.size = Vector2i(2000, 900)
	# a clean device
	for path in ["user://city-checkpoint-v1.json", "user://cave-test.json", "user://core.json"]:
		DirAccess.remove_absolute(ProjectSettings.globalize_path(path))
	var dir := DirAccess.open("user://characters")
	if dir != null:
		for f in dir.get_files():
			DirAccess.remove_absolute(ProjectSettings.globalize_path("user://characters/" + f))
	await start_game()
	var game := await wait_game()
	check(game != null, "the game starts on a device without characters")
	game.skip_intro = true
	await frames(10)
	check(root.get_children().filter(func(n: Node) -> bool: return n is Control and n.get_script() != null and str(n.get_script().resource_path).ends_with("character_select.gd")).is_empty(), "no picker without characters")
	await game.start_new_character("legend")
	await frames(10)
	var first_id: String = game.character_id
	check(first_id != "", "the first character has an id")
	game.kit.set_level(7)
	game.save_checkpoint(game.SAVE_PATH, true)
	await game.start_new_character("planetary")
	await frames(10)
	var second_id: String = game.character_id
	check(second_id != "" and second_id != first_id, "a new character gets its own id")
	var roster := Characters.list()
	check(roster.size() == 2, "both characters are kept (%d)" % roster.size())
	var legend_entry := roster.filter(func(e: Dictionary) -> bool: return e.id == first_id)
	check(not legend_entry.is_empty() and int(legend_entry[0].level) == 7 and legend_entry[0].race == "legend", "the first character keeps its race and level 7")
	game.show_menu()
	await shot("01-menu-with-switch")
	game.close_screen()
	game.open_character_select()
	await shot("02-select-in-game")
	check(is_instance_valid(game.screen), "the picker opens in the game")
	game.close_screen()
	await game.switch_character(first_id)
	await frames(20)
	check(game.race == "legend" and game.character_id == first_id and game.kit.level == 7, "switching restores the legend, level 7 (race=%s level=%d)" % [game.race, game.kit.level])
	game.save_checkpoint(game.SAVE_PATH, true)
	# the next start: the title asks
	game.queue_free()
	await frames(5)
	await start_game()
	await frames(20)
	var pickers := root.get_children().filter(func(n: Node) -> bool: return n is PyraTitleScreen)
	var picker: Control = null
	for t in pickers:
		for c in t.get_children():
			if c.get_script() != null and str(c.get_script().resource_path).ends_with("character_select.gd"):
				picker = c
	check(picker != null, "the title shows the picker with two characters")
	await shot("03-select-at-title")
	if picker != null:
		picker.picked.emit(second_id)
	var game2 := await wait_game()
	await frames(20)
	check(game2 != null and game2.race == "planetary" and game2.character_id == second_id, "the chosen character enters the game")
	print("FAILURES ", failures)
	quit(1 if failures > 0 else 0)
