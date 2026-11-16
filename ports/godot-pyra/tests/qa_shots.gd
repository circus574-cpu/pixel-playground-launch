extends SceneTree
## Visual check of the late additions (cave, boss, ambient effects at night, world event, citizens). Not part of the smoke suite:
## xvfb-run -a -s '-screen 0 1600x900x24' env LIBGL_ALWAYS_SOFTWARE=1 godot --audio-driver Dummy --path ports/godot-pyra \
##   --rendering-method gl_compatibility --script res://tests/qa_shots.gd -- --qa-output /tmp/pyra-shots

var game: PyraGame
var output := "/tmp/pyra-shots"

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
	var landing: PyraTitleScreen = load(ProjectSettings.get_setting("application/run/main_scene")).instantiate()
	root.add_child(landing)
	for i in 5:
		await process_frame
	landing.start_city()
	var deadline := Time.get_ticks_msec() + 20000
	while is_instance_valid(landing) and Time.get_ticks_msec() < deadline:
		await process_frame
	game = root.get_children().filter(func(n): return n is PyraGame)[0]
	for i in 10:
		await process_frame
	game.start_new_character("legend")
	for i in 10:
		await process_frame
	game.kit.set_level(12)
	game.kit.hp = float(game.kit.stats().maxHp)
	# 1. a cave
	var entrance: Dictionary = {}
	for t: Dictionary in game.outdoor_targets:
		if t.kind == "dungeon":
			entrance = t.entrance
	game.enter_dungeon(entrance)
	for i in 20:
		await process_frame
	game.camera.zoom = Vector2.ONE * 0.8
	await shot("cave-entrance")
	game.player.position = game.dungeon.center(game.dungeon.key_cell)
	for i in 20:
		await process_frame
	await shot("cave-key")
	var room: Rect2i = game.dungeon.vault_room
	game.player.position = game.dungeon.center(room.position + Vector2i(room.size.x / 2, room.size.y / 2)) + Vector2(0, 160)
	for i in 20:
		await process_frame
	await shot("cave-vault")
	game.load_space("", game.city_return)
	for i in 20:
		await process_frame
	# 2. a boss
	var kharzul := game.monsters.spawn_boss("kharzul", game.player.position + Vector2(380, -40))
	kharzul.hp = kharzul.max_hp * 0.2
	kharzul.hurt(1.0, false, [])
	game.camera.zoom = Vector2.ONE * 0.7
	for i in 90:
		await process_frame
	await shot("boss-kharzul-phase3")
	kharzul.phase = "dead"
	kharzul.queue_free()
	game.monsters.active.erase(kharzul.spawn_index)
	# 3. ambient effects at night
	var fire: PyraAmbient = null
	for node in game.continent.sorted.get_children():
		if node is PyraAmbient:
			fire = node
			break
	if fire != null:
		game.player.position = fire.position + Vector2(0, 150)
		game.continent.update_view(game.camera_view(), true)
		game.world_time = 385.0
		for i in 30:
			await process_frame
		await shot("ambient-night")
		game.world_time = 20.0
		for i in 10:
			await process_frame
		await shot("ambient-day")
	# 4. a world event
	game.kit.set_level(8)
	game.world_time = 20.0
	var ev: Dictionary = game.world_events.list[1]
	game.player.position = ev.anchor
	game.continent.update_view(game.camera_view(), true)
	game.world_events.timer = 0.0
	for i in 40:
		await process_frame
	await shot("event-" + str(ev.def.id))
	print("done")
	quit()
