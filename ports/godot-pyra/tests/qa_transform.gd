extends SceneTree
## The transformation into the Ki form in the real game scene: a strip of screenshots around the hero while it happens.
## xvfb-run -a -s '-screen 0 1600x900x24' env LIBGL_ALWAYS_SOFTWARE=1 godot --audio-driver Dummy --path ports/godot-pyra \
##   --rendering-method gl_compatibility --script res://tests/qa_transform.gd -- --hero3d --qa-output /tmp/pyra-transform
var game: PyraGame
var output := "/tmp/pyra-transform"
var race := "legend"

func frames(n: int) -> void:
	for i in n:
		if i % 10 == 0 and game != null and is_instance_valid(game.continent):
			for node in game.continent.sorted.get_children():   # the standing scenery would hide the hero
				if node is Sprite2D and node.visible:
					node.visible = false
		await process_frame

func _initialize() -> void:
	run.call_deferred()

func run() -> void:
	var args := OS.get_cmdline_user_args()
	for i in args.size():
		if args[i] == "--qa-output" and i + 1 < args.size():
			output = args[i + 1]
		elif args[i] == "--race" and i + 1 < args.size():
			race = args[i + 1]
	DirAccess.make_dir_recursive_absolute(output)
	root.size = Vector2i(1280, 720)
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
	game.start_new_character(race)
	await frames(10)
	game.player.position = Vector2(float(game.land.width) * 0.5, float(game.land.height) * 0.5)
	game.monsters.clear_all()
	game.monsters.set_process(false)
	game.hud.visible = false
	game.camera.zoom = Vector2.ONE * 1.0
	await frames(30)
	game.player.visual.direction = "down-right"
	if "--video" in args:
		# for the movie writer: stand, transform, walk a little in the Ki form, then the form ends
		game.hud.visible = true
		game.camera.zoom = Vector2.ONE * 2.0
		await frames(45)
		game.kit.add_buff({"id": "T", "ms": 5200.0})
		await frames(90)
		game.player.touch_motion = Vector2(1, 0.3).normalized()
		await frames(50)
		game.player.touch_motion = Vector2.ZERO
		await frames(80)
		await frames(60)
		quit(0)
		return
	game.kit.add_buff({"id": "T", "ms": 20000.0})
	for k in 14:
		await frames(5)
		await RenderingServer.frame_post_draw
		var image := root.get_texture().get_image()
		var at: Vector2 = game.player.get_global_transform_with_canvas().origin
		image.get_region(Rect2i(Vector2i(at) - Vector2i(160, 230), Vector2i(320, 300))).save_png("%s/t%02d.png" % [output, k])
	quit(0)
