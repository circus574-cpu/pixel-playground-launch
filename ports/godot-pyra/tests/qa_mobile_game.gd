extends SceneTree
## Real game and rendering. Staff API responses use the explicitly labelled fixture from hud_mobile.gd.
const Fixture := preload("res://tests/hud_mobile.gd")
var game: PyraGame
var output := "/tmp/ki-mobile-game"
var checks: Array[Dictionary] = []

func verify(ok: bool, label: String) -> void:
	checks.append({"name":label,"passed":ok})
	if not ok:
		push_error(label)

func settle() -> void:
	for i in 10:
		await process_frame

func tap(at: Vector2) -> void:
	for pressed in [true,false]:
		var event := InputEventScreenTouch.new()
		event.index = 7
		event.pressed = pressed
		event.position = at
		root.push_input(event,true)

func shot(name: String) -> void:
	await settle()
	if DisplayServer.get_name() != "headless":
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png(output+"/"+name+".png")

func _initialize() -> void:
	run.call_deferred()

func run() -> void:
	var args := OS.get_cmdline_user_args()
	for i in args.size():
		if args[i] == "--qa-output" and i+1 < args.size():
			output = args[i+1]
	DirAccess.make_dir_recursive_absolute(output)
	root.size = Vector2i(1280,576)
	var landing: PyraTitleScreen = load("res://scenes/title.tscn").instantiate()
	root.add_child(landing)
	await settle()
	landing.start_city()
	while is_instance_valid(landing):
		await process_frame
	game = root.get_children().filter(func(n): return n is PyraGame)[0]
	game.skip_intro = true
	await settle()
	game.start_new_character("legend")
	await settle()
	await shot("hud-1280x576")
	tap(game.hud.minimap_center)
	await settle()
	verify(game.screen is MapScreen and game.hud.suspended and game.player.locked, "actual minimap tap opens the in-game map and releases gameplay input")
	if game.screen is MapScreen:
		game.screen.switch_to(1)
		await shot("map-2d-from-minimap")
		game.screen.switch_to(2)
		await shot("continent-from-minimap")
		game.screen.closed.emit()
	await settle()
	verify(game.screen == null and not game.hud.suspended and not game.player.locked and game.hud.visible, "closing the map restores HUD and movement")
	# Replace the network only in this isolated QA run, without credentials or production account changes.
	var hub := KiNet.hub()
	var old := hub.online_node
	hub.remove_child(old)
	var net := Fixture.StaffServer.new()
	hub.online_node = net
	hub.content_node.online = net
	hub.add_child(net)
	old.queue_free()
	net.access_token = "test-access"
	net.refresh_token = "test-refresh"
	net.account_id = "qa-gm-account"
	net.roles = ["gm"]
	net.session_changed.connect(game.sync_staff_access)
	game.sync_staff_access()
	await shot("hud-gm-1280x576")
	root.size = Vector2i(844,390)
	await shot("hud-gm-844x390")
	tap(game.hud.gm_button.get_global_rect().get_center())
	await settle()
	verify(is_instance_valid(game.screen) and game.screen.get_script().resource_path == "res://scripts/gm_panel.gd" and game.hud.suspended, "actual GM HUD button opens the native GM screen")
	if is_instance_valid(game.screen):
		verify(game.screen.body.text.contains("qa-1.7"), "native GM screen renders authenticated fixture response")
		await shot("gm-native-fixture-844x390")
		game.screen.closed.emit()
	await settle()
	net.sign_out_local()
	verify(not game.hud.gm_button.visible and game.screen == null and not game.player.locked, "logout removes the GM button and closed panel restores movement")
	await shot("hud-844x390")
	var failed := checks.filter(func(c): return not c.passed).size()
	var file := FileAccess.open(output+"/result.json",FileAccess.WRITE)
	file.store_string(JSON.stringify({"checks":checks.size(),"passed":checks.size()-failed,"failed":failed,"network":"staff server fixture; actual Godot game rendering","results":checks},"\t"))
	file.close()
	root.remove_child(game)
	game.queue_free()
	game = null
	await settle()
	print("MOBILE GAME QA ",checks.size()-failed,"/",checks.size())
	quit(1 if failed else 0)
