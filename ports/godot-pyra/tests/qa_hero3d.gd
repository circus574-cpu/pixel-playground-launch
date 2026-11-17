extends SceneTree
## Visual check of the hero's animation clips in the real game scene: a strip per clip (first, middle and last frames) around the hero.
## xvfb-run -a -s '-screen 0 1600x900x24' env LIBGL_ALWAYS_SOFTWARE=1 godot --audio-driver Dummy --path ports/godot-pyra \
##   --rendering-method gl_compatibility --script res://tests/qa_hero3d.gd -- [--hero3d] --qa-output /tmp/pyra-hero3d
var game: PyraGame
var output := "/tmp/pyra-hero3d"

func frames(n: int) -> void:
	for i in n:
		await process_frame

func clear_scenery() -> void:
	for node in game.continent.sorted.get_children():   # the standing scenery would hide the hero: look at him on bare ground
		if node is Sprite2D and node.visible:
			node.visible = false

func shot(name: String, zoom: float) -> void:
	game.camera.zoom = Vector2.ONE * zoom
	await frames(3)
	clear_scenery()
	await frames(2)
	await RenderingServer.frame_post_draw
	var image := root.get_texture().get_image()
	var at: Vector2 = game.player.get_global_transform_with_canvas().origin
	var box := Rect2i(Vector2i(at) - Vector2i(220, 330), Vector2i(440, 400))
	image.get_region(box).save_png("%s/%s.png" % [output, name])

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
	game.hud.visible = false
	for node in game.continent.sorted.get_children():   # the standing scenery would hide the hero: look at him on bare ground
		if node is Sprite2D:
			node.visible = false
	await frames(20)
	var actor: PyraActor = game.player.visual
	for dir_name in ["down", "right", "up"]:
		actor.direction = dir_name
		actor.one_shot_until = 0.0
		actor.animate(Vector2.ZERO, false)
		await frames(4)
		await shot("idle-%s" % dir_name, 2.0)
	actor.direction = "right"
	for clip in ["walk", "run", "attack", "attack2", "skill", "skillb", "skillc", "dodge", "guard", "hit", "hitheavy", "death", "respawn", "finisher", "victory", "channel"]:
		actor.one_shot_until = 0.0
		var duration := actor.play_once(clip)
		var steps := 3
		for k in steps:
			await shot("%s-%d" % [clip, k], 2.0)
			await frames(maxi(1, int(duration * 60.0 / float(steps + 1))))
	quit(0)
