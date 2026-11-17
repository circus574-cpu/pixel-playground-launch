extends SceneTree
## Every menu and full-screen view of the game on a phone-sized screen (the owner's phone: 2000x900), for a visual check of the interface:
## titles inside their frames, a close button on every screen, themed lists, nothing cut off. Pictures go to --qa-output.
## xvfb-run -a -s '-screen 0 2000x900x24' env LIBGL_ALWAYS_SOFTWARE=1 godot --audio-driver Dummy --path ports/godot-pyra \
##   --rendering-method gl_compatibility --script res://tests/qa_menus.gd -- --qa-output /tmp/pyra-menus
var game: PyraGame
var output := "/tmp/pyra-menus"

func frames(n: int) -> void:
	for i in n:
		await process_frame

func shot(name: String) -> void:
	await frames(10)
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
	game.start_new_character("planetary" if "--planetary" in args else "legend")
	await frames(40)
	game.kit.set_level(20)
	await shot("01-hud")
	game.show_menu()
	await shot("02-menu")
	game.close_screen()
	game.open_character()
	await shot("03-character")
	game.close_screen()
	game.open_items("inventory", "Plecak i wyposażenie")
	await shot("04-inventory")
	game.close_screen()
	game.open_items("shop", "Sklep")
	await shot("05-shop")
	game.close_screen()
	game.open_map()
	await shot("06-map")
	var map_view: MapScreen = game.screen
	map_view.switch_to(2)
	await shot("06b-map-detail")
	game.close_screen()
	var gm: Control = load("res://scripts/gm_panel.gd").new()
	gm.setup(KiNet.online(), game, game.gm_tools)
	game.open_screen(gm)
	await shot("07-gm")
	gm.get("land_picker").show_popup()
	await shot("07b-gm-list")
	gm.get("land_picker").get_popup().hide()
	game.close_screen()
	game.show_journal()
	await shot("08-journal")
	game.hud.close_dialog()
	game.open_race_screen(true)
	await shot("09-race")
	game.close_screen()
	game.open_chat()
	await shot("10-chat")
	game.close_screen()
	quit(0)
