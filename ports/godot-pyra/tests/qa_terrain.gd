extends SceneTree
## The terrain around a far spot of the land (the owner saw violet holes in the ground at "Pola Wulkaniczne"): screenshots after the chunks had time to build.
## xvfb-run -a -s '-screen 0 2000x900x24' env LIBGL_ALWAYS_SOFTWARE=1 godot --audio-driver Dummy --path ports/godot-pyra \
##   --rendering-method gl_compatibility --script res://tests/qa_terrain.gd -- --qa-output /tmp/pyra-terrain [--at 46256,11152]
var game: PyraGame
var output := "/tmp/pyra-terrain"
var at := Vector2(46256, 11152)

func frames(n: int) -> void:
	for i in n:
		await process_frame

func _initialize() -> void:
	run.call_deferred()

func run() -> void:
	var args := OS.get_cmdline_user_args()
	for i in args.size():
		if args[i] == "--qa-output" and i + 1 < args.size():
			output = args[i + 1]
		elif args[i] == "--at" and i + 1 < args.size():
			var p := args[i + 1].split(",")
			at = Vector2(float(p[0]), float(p[1]))
	DirAccess.make_dir_recursive_absolute(output)
	root.size = Vector2i(2000, 900)
	var landing: PyraTitleScreen = load("res://scenes/title.tscn").instantiate()
	root.add_child(landing)
	await frames(5)
	landing.start_city()
	var deadline := Time.get_ticks_msec() + 20000
	while is_instance_valid(landing) and Time.get_ticks_msec() < deadline:
		await process_frame
	game = root.get_children().filter(func(n): return n is PyraGame)[0]
	game.skip_intro = true
	await frames(10)
	game.start_new_character("legend")
	await frames(30)
	game.monsters.clear_all()
	game.monsters.set_process(false)
	game.player.position = at
	game.camera.reset_smoothing()
	for k in 6:
		await frames(60)
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png("%s/t%d.png" % [output, k])
		print("shot ", k, " ground queue ", game.continent.ground_queue.size(), " bake ", game.continent.ground_bake.size())
	quit(0)
