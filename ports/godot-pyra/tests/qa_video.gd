extends SceneTree
## A scripted showcase of the hero in the real game scene, for a video (Godot movie writer): idle, walking and running in the four directions (the real player moves),
## then every animation clip in turn. The standing scenery is hidden so that nothing covers the figure; no monsters.
## godot --path ports/godot-pyra --write-movie /tmp/clip.avi --fixed-fps 30 --resolution 1280x720 --rendering-method gl_compatibility \
##   --script res://tests/qa_video.gd -- [--hero3d] --race legend|android
var game: PyraGame
var race := "legend"

func frames(n: int) -> void:
	for i in n:
		if i % 10 == 0:
			clear_scenery()
		await process_frame

func seconds(s: float) -> void:
	await frames(int(s * 30.0))

func clear_scenery() -> void:
	if game == null or not is_instance_valid(game.continent):
		return
	for node in game.continent.sorted.get_children():
		if node is Sprite2D and node.visible:
			node.visible = false

func _initialize() -> void:
	run.call_deferred()

func run() -> void:
	var args := OS.get_cmdline_user_args()
	for i in args.size():
		if args[i] == "--race" and i + 1 < args.size():
			race = args[i + 1]
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
	game.camera.zoom = Vector2.ONE * 1.6
	game.camera.reset_smoothing()
	await seconds(2.0)
	# the real player walks and runs
	for step in [[Vector2(1, 0), 0.45, 2.0], [Vector2(1, 0), 1.0, 2.0], [Vector2(1, 1), 1.0, 1.5], [Vector2(0, 1), 1.0, 1.5], [Vector2(-1, 1), 1.0, 1.5], [Vector2(-1, 0), 1.0, 1.5], [Vector2(0, -1), 1.0, 2.0]]:
		game.player.touch_motion = (step[0] as Vector2).normalized() * float(step[1])
		await seconds(float(step[2]))
	game.player.touch_motion = Vector2.ZERO
	await seconds(0.8)
	# every clip, turned to three directions
	var actor: PyraActor = game.player.visual
	var clips := ["attack", "attack2", "attack3", "skill", "skillb", "skillc", "finisher", "dodge", "guard", "hit", "hitheavy", "victory", "death", "respawn"]
	var facings := ["down-right", "down", "right"]
	for n in clips.size():
		actor.direction = facings[n % facings.size()]
		actor.one_shot_until = 0.0
		var duration := actor.play_once(clips[n])
		await seconds(maxf(0.7, duration + 0.35))
	actor.one_shot_until = 0.0
	actor.direction = "down"
	actor.animate(Vector2.ZERO, false)
	await seconds(1.5)
	quit(0)
