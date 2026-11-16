extends SceneTree
## Visual check of the owner's HUD buttons in the real game scene (not part of the smoke suite):
## xvfb-run -a -s '-screen 0 1600x900x24' env LIBGL_ALWAYS_SOFTWARE=1 godot --audio-driver Dummy --path ports/godot-pyra \
##   --rendering-method gl_compatibility --script res://tests/qa_menu.gd -- --qa-output /tmp/pyra-menu

var game: PyraGame
var output := "/tmp/pyra-menu"

func shot(name: String) -> void:
	for i in 4:
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
	game.show_menu()
	for i in range(6):
		await process_frame
	await shot("menu")
	quit(0)
