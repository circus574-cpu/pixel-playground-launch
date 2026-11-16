extends SceneTree
## Visual check of the peaceful animals in the real game scene (not part of the smoke suite): all of them are placed around the hero (their world does not
## matter here), first standing and walking, then fleeing after a hit, then fallen.
## xvfb-run -a -s '-screen 0 1600x900x24' env LIBGL_ALWAYS_SOFTWARE=1 godot --audio-driver Dummy --path ports/godot-pyra \
##   --rendering-method gl_compatibility --script res://tests/qa_animals.gd -- --qa-output /tmp/pyra-animals

const Animals := preload("res://scripts/animals.gd")
var game: PyraGame
var output := "/tmp/pyra-animals"

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
	root.size = Vector2i(1280, 720)
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
	for i in 10:
		await process_frame
	var food_data: Dictionary = PyraContinent.load_json("res://data/food.json")
	var art := Animals.art_data()
	# the hero stands in the open land, away from the city
	game.player.position = Vector2(float(game.land.width) * 0.5, float(game.land.height) * 0.5)
	game.player.locked = true
	game.monsters.clear_all()
	game.monsters.set_process(false)
	game.monsters.defs = game.monsters.defs.duplicate()
	var placed: Array[PyraMonster] = []
	var ids: Array = (art.animals as Dictionary).keys()
	ids.sort()
	for n in ids.size():
		var id: String = ids[n]
		var animal: Dictionary = {}
		for a: Dictionary in food_data.animals:
			if str(a.id) == id:
				animal = a
		game.monsters.defs[id] = Animals.definition(animal, art.animals[id].actor)
		var at: Vector2 = game.player.position + Vector2(-330 + (n % 5) * 165, -90 + (n / 5) * 150)
		var m := game.monsters.place_monster(id, at)
		m.set_physics_process(false)
		m.set_process(false)
		placed.append(m)
	game.camera.zoom = Vector2.ONE * 1.0
	for i in 20:
		await process_frame
	await shot("animals-stand")
	for m in placed:
		m.actor.animate(Vector2(1, 0), false)
	await shot("animals-walk")
	for m in placed:
		m.actor.animate(Vector2(1, 0), true)
	await shot("animals-run")
	for m in placed:
		m.actor.animate(Vector2(-1, 0), true)
	await shot("animals-run-left")
	for m in placed:
		m.actor.play_once("death")
	for i in 60:
		await process_frame
	await shot("animals-fallen")
	game.camera.zoom = Vector2.ONE * 0.6
	for m in placed:
		m.actor.animate(Vector2(1, 0), false)
	await shot("animals-far")
	quit(0)
