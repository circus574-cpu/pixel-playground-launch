extends SceneTree
## Renders the real ground of every land (the terrain shader itself: biomes, shore, water, roads, plazas) into assets/lands/<id>/minimap.webp, the picture the
## minimap and the detailed map show, so that they look like the world and not like a different game. Run when a land's terrain changes.
## xvfb-run -a -s '-screen 0 1600x900x24' env LIBGL_ALWAYS_SOFTWARE=1 godot --audio-driver Dummy --path ports/godot-pyra \
##   --rendering-method gl_compatibility --script res://tests/render_minimaps.gd -- [--lands pyra,verdant]
const LANDS := ["pyra", "verdant", "aether", "nexus", "island-1", "island-2", "island-3", "island-4", "island-5", "island-6"]
const WIDTH := 2048

func frames(n: int) -> void:
	for i in n:
		await process_frame

func _initialize() -> void:
	run.call_deferred()

func run() -> void:
	var wanted: Array = LANDS
	var args := OS.get_cmdline_user_args()
	for i in args.size():
		if args[i] == "--lands" and i + 1 < args.size():
			wanted = Array(args[i + 1].split(","))
	root.size = Vector2i(1600, 900)
	var landing: PyraTitleScreen = load("res://scenes/title.tscn").instantiate()
	root.add_child(landing)
	await frames(5)
	landing.start_city()
	var deadline := Time.get_ticks_msec() + 20000
	while is_instance_valid(landing) and Time.get_ticks_msec() < deadline:
		await process_frame
	var game: PyraGame = root.get_children().filter(func(n): return n is PyraGame)[0]
	game.skip_intro = true
	await frames(10)
	game.start_new_character("legend")
	await frames(20)
	for id: String in wanted:
		game.enter_land(id)
		await frames(10)
		var world: Vector2 = game.continent.world_size
		var scale := float(WIDTH) / world.x
		var size := Vector2i(WIDTH, int(round(world.y * scale)))
		var viewport := SubViewport.new()
		viewport.size = size
		viewport.disable_3d = true
		viewport.transparent_bg = false
		viewport.render_target_update_mode = SubViewport.UPDATE_ONCE
		viewport.canvas_item_default_texture_filter = Viewport.DEFAULT_CANVAS_ITEM_TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
		viewport.canvas_transform = Transform2D().scaled(Vector2(scale, scale))
		var paint := ColorRect.new()
		paint.size = world
		paint.material = game.continent.ground_material
		viewport.add_child(paint)
		root.add_child(viewport)
		await frames(6)
		await RenderingServer.frame_post_draw
		var image := viewport.get_texture().get_image()
		image.convert(Image.FORMAT_RGB8)
		image.save_webp("res://assets/lands/%s/minimap.webp" % id, true, 0.9)
		viewport.queue_free()
		print("minimap ", id, " ", size)
	quit(0)
