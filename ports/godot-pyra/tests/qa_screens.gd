extends SceneTree
## Visual check of the interface in the real game scene (not part of the smoke suite): the hero frame and HUD, the inventory, the character screen, the map,
## the race choice, the chat and a dialog. Pictures go to the --qa-output folder.
## xvfb-run -a -s '-screen 0 1600x720x24' env LIBGL_ALWAYS_SOFTWARE=1 godot --audio-driver Dummy --path ports/godot-pyra \
##   --rendering-method gl_compatibility --script res://tests/qa_screens.gd -- --qa-output /tmp/pyra-screens

var game: PyraGame
var output := "/tmp/pyra-screens"

func shot(name: String) -> void:
	for i in 8:
		await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("%s/%s.png" % [output, name])
	print("shot ", name)

func _initialize() -> void:
	run.call_deferred()

func run() -> void:
	var args := OS.get_cmdline_user_args()
	for i in args.size():
		if args[i] == "--qa-output" and i + 1 < args.size():
			output = args[i + 1]
	DirAccess.make_dir_recursive_absolute(output)
	root.size = Vector2i(1600, 720)
	var landing: PyraTitleScreen = load("res://scenes/title.tscn").instantiate()
	root.add_child(landing)
	for i in 5:
		await process_frame
	landing.start_city()
	var deadline := Time.get_ticks_msec() + 20000
	while is_instance_valid(landing) and Time.get_ticks_msec() < deadline:
		await process_frame
	game = root.get_children().filter(func(n): return n is PyraGame)[0]
	game.skip_intro = true
	for i in 10:
		await process_frame
	game.start_new_character("legend")
	for i in 30:
		await process_frame
	await shot("1-hud")
	game.open_items("inventory", "PLECAK")
	await shot("2-inventory")
	game.close_screen()
	game.open_character()
	await shot("3-character")
	game.close_screen()
	game.open_map()
	await shot("4-map")
	game.close_screen()
	game.open_race_screen(true)
	await shot("5-race")
	game.close_screen()
	game.open_chat()
	await shot("6-chat")
	quit(0)
