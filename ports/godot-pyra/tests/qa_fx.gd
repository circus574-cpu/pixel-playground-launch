extends SceneTree
## Visual check of the combat effects in the real game scene (not part of the smoke suite):
## xvfb-run -a -s '-screen 0 1600x900x24' env LIBGL_ALWAYS_SOFTWARE=1 godot --audio-driver Dummy --path ports/godot-pyra \
##   --rendering-method gl_compatibility --script res://tests/qa_fx.gd -- --qa-output /tmp/pyra-fx
var game: PyraGame
var output := "/tmp/pyra-fx"

func shot(name: String) -> void:
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("%s/%s.png" % [output, name])
	print("shot ", name)

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
	game.start_new_character("legend")
	await frames(10)
	game.player.position = Vector2(float(game.land.width) * 0.5, float(game.land.height) * 0.5)
	game.player.locked = true
	game.monsters.clear_all()
	game.monsters.set_process(false)
	game.camera.zoom = Vector2.ONE * 1.0
	game.hud.hide_dialog() if game.hud.has_method("hide_dialog") else null
	await frames(20)
	var parent: Node = game.fx_parent()
	var p: Vector2 = game.player.position
	var kinds := [["burst", 220.0, "C4"], ["buff", 160.0, "B4"], ["slash", 0.0, "A1"], ["swing", 0.0, "R"], ["dash", 0.0, "A4"], ["hit", 60.0, ""], ["hit", 100.0, "weak"], ["hurt", 60.0, ""]]
	for step in [0.25, 0.5, 0.75]:
		for n in kinds.size():
			var k: Array = kinds[n]
			var fx := PyraFx.spawn(parent, k[0], p + Vector2(-480 + (n % 4) * 320, -120 + (n / 4) * 300), k[1], k[2], Vector2.RIGHT)
			fx.age = fx.life * step
			fx.set_process(false)
		await frames(2)
		await shot("fx-%d" % int(step * 100))
		for c in parent.get_children():
			if c is PyraFx:
				c.queue_free()
		await frames(2)
	quit(0)
