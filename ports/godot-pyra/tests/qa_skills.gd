extends SceneTree
## Every active and ultimate skill of the four races has its own animation clip (`sk_<node id>`) and plays it in the game; one picture per skill (mid-cast) goes to --qa-output.
## xvfb-run -a -s '-screen 0 1600x900x24' env LIBGL_ALWAYS_SOFTWARE=1 godot --audio-driver Dummy --path ports/godot-pyra --rendering-method gl_compatibility --script res://tests/qa_skills.gd -- --qa-output /tmp/pyra-skills
const IDS := ["A1", "A4", "A9", "B1", "B4", "B9", "C1", "C4", "C9"]
var output := "/tmp/pyra-skills"
var failures := 0

func check(ok: bool, what: String) -> void:
	if not ok:
		failures += 1
		print("FAIL ", what)

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
	root.size = Vector2i(1600, 900)
	var landing: PyraTitleScreen = load("res://scenes/title.tscn").instantiate()
	root.add_child(landing)
	await frames(5)
	landing.start_city()
	while is_instance_valid(landing):
		await process_frame
	var game: PyraGame = root.get_children().filter(func(n: Node) -> bool: return n is PyraGame)[0]
	game.skip_intro = true
	await frames(10)
	var played := 0
	for race in ["legend", "planetary", "sage", "android"]:
		await game.start_new_character(race)
		await frames(20)
		game.set_process(false)
		for id in IDS:
			var clip: String = "sk_" + id
			check(game.player.visual.definition.clips.has(clip), "%s has %s" % [race, clip])
			var seconds: float = float(game.player.visual.play_once(clip))
			check(seconds > 0.4 and seconds < 2.2, "%s %s lasts %.2f s" % [race, clip, seconds])
			played += 1
			await frames(int(seconds * 30.0 * 0.55))
			await RenderingServer.frame_post_draw
			var shot: Image = root.get_texture().get_image()
			var c := Vector2i(800, 450)
			shot.get_region(Rect2i(c.x - 150, c.y - 200, 300, 330)).save_png("%s/%s-%s.png" % [output, race, id])
			await frames(int(seconds * 30.0 * 0.6) + 10)
		game.set_process(true)
	print("SKILL ANIMATIONS ", played, " played, failures ", failures)
	quit(1 if failures > 0 else 0)
