extends SceneTree
## Real MapScreen, real atlas transforms and land data. Captures are Godot renders.
var output := "/tmp/ki-map-preview"
var baseline := false
var live := false
var results: Array[Dictionary] = []
var failed := 0
var journeys: Array[String] = []

func _initialize() -> void: run.call_deferred()

func verify(ok: bool, name: String, details: Variant = null) -> void:
	results.append({"passed": ok, "name": name, "details": details})
	if not ok: failed += 1
	print(("PASS " if ok else "FAIL ") + name)

func settle() -> void:
	for i in 16: await process_frame

func capture(name: String) -> void:
	await settle()
	if DisplayServer.get_name() == "headless": return
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_jpg(output.path_join(name + ".jpg"), 0.92)

func touch_button(button: Button) -> void:
	var at := button.get_global_rect().get_center()
	for pressed in [true, false]:
		var event := InputEventMouseButton.new()
		event.button_index = MOUSE_BUTTON_LEFT
		event.pressed = pressed
		event.position = at
		root.push_input(event, true)
		await process_frame

func shader_geography(screen: MapScreen) -> void:
	if DisplayServer.get_name() == "headless": return
	var canonical := screen.atlas.texture.get_image()
	if canonical.is_compressed(): canonical.decompress()
	var viewport := SubViewport.new()
	viewport.disable_3d = true
	viewport.size = canonical.get_size()
	viewport.render_target_update_mode = SubViewport.UPDATE_ONCE
	var painted := TextureRect.new()
	painted.texture = screen.atlas.artwork.texture
	painted.material = screen.atlas.artwork.material
	painted.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	painted.size = Vector2(viewport.size)
	viewport.add_child(painted)
	root.add_child(viewport)
	await settle()
	await RenderingServer.frame_post_draw
	var actual := viewport.get_texture().get_image()
	var count := 0
	var mismatches := 0
	for y in range(4, canonical.get_height() - 4, 8):
		for x in range(4, canonical.get_width() - 4, 8):
			var source := canonical.get_pixel(x, y)
			var result := actual.get_pixel(x, y)
			var expected := source.b - maxf(source.r, source.g) - 0.035
			var observed := result.b - maxf(result.r, result.g) - 0.035
			if absf(expected) < 0.008 or absf(observed) < 0.008: continue # 8-bit readback ambiguity
			if absf(source.r - 0.5) < 0.008 or absf(source.g - 0.72) < 0.008 or absf(result.r - 0.5) < 0.008 or absf(result.g - 0.72) < 0.008: continue
			count += 1
			if (expected > 0 and source.r <= 0.5 and source.g <= 0.72) != (observed > 0 and result.r <= 0.5 and result.g <= 0.72): mismatches += 1
	verify(count > 20000 and mismatches == 0, "rendered relief retains canonical land/water class away from quantization threshold", {"samples": count, "mismatches": mismatches})
	viewport.queue_free()

func run() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--out="): output = arg.substr(6)
		if arg == "--baseline": baseline = true
		if arg == "--live": live = true
	DirAccess.make_dir_recursive_absolute(output)
	root.size = Vector2i(1280, 576)
	var world: Dictionary = PyraContinent.load_json("res://data/lands/verdant/land.json")
	var data: Dictionary = PyraContinent.load_json("res://data/map.json")
	var screen := MapScreen.new()
	screen.setup(data, world, Vector2(float(world.arrival.x), float(world.arrival.y)), "Zielona Przystań · strefa bezpieczna")
	screen.travel.connect(func(id: String): journeys.append(id))
	root.add_child(screen)
	await capture("opening")
	verify(screen.current == 1 and screen.atlas.visible, "opens on the full 2D planet")
	verify(screen.atlas.marks.size() == 22, "all 22 settlements are on the world atlas")
	verify(screen.worlds.size() == 10, "metadata available for four continents and six islands")
	for mark: Dictionary in screen.atlas.marks:
		verify(MapMath.region_at(data.regions, mark.atlas).get("id", "") == mark.land, "settlement is inside its source land: " + str(mark.label))
	for corner in [Vector2.ZERO, Vector2(2000, 1000)]:
		verify(Rect2(Vector2.ZERO, screen.atlas.size).has_point(screen.atlas.to_screen(corner)), "whole planet is visible: " + str(corner))
	verify(screen.atlas.center.is_equal_approx(Vector2(1000, 500)), "overview is centered on the planet, not the player")
	await shader_geography(screen)
	screen.focus_player()
	await capture("atlas-player-focus")
	screen.atlas.zoom_by(1.3, screen.atlas.to_screen(screen.player_atlas))
	verify(screen.current == 2 and screen.detail_id == "verdant", "close zoom enters actual land detail instead of stretching global pixels")
	for region: Dictionary in data.regions:
		screen.world_overview()
		await settle()
		screen.show_region(str(region.id))
		await touch_button(screen.tabs[2])
		await settle()
		verify(screen.detail_id == str(region.id) and screen.current == 2, "browse without travelling: " + str(region.id))
		verify(screen.continent_view.show_player == (region.id == "verdant"), "no fake player in remote land: " + str(region.id))
		verify(screen.continent_view.markers.filter(func(m: Dictionary): return m.kind == "city").size() == screen.worlds[region.id].settlements.size(), "land detail has all source settlements: " + str(region.id))
		if str(region.id) in ["pyra", "nexus", "island-3"]: await capture("detail-" + str(region.id))
	verify(journeys.is_empty(), "browsing all ten lands never triggers a journey")
	screen.open_detail("pyra")
	await touch_button(screen.travel_button)
	verify(journeys == ["pyra"], "only explicit travel button requests a journey")
	screen.open_detail("verdant")
	await capture("continent")
	screen.switch_to(0)
	await capture("globe")
	for i in 8: screen.globe.zoom_by(1.3)
	verify(screen.globe.distance >= 3.45, "globe cannot zoom until the sphere is cropped")
	await touch_button(screen.side_buttons[3])
	verify(screen.current == 1 and is_equal_approx(screen.atlas.zoom_level(), 1.0), "WORLD touch restores the entire planet")

	for viewport_size in [Vector2i(1280, 576), Vector2i(852, 393)]:
		root.size = viewport_size
		await settle()
		screen.world_overview()
		for button in screen.side_buttons:
			var rect := button.get_global_rect()
			var parent_rect: Rect2 = button.get_parent().get_parent().get_global_rect()
			verify(parent_rect.encloses(rect), "map action is not clipped at %s: %s" % [viewport_size, button.text])
		await capture("overview-%dx%d" % [viewport_size.x, viewport_size.y])
		screen.switch_to(0)
		screen.globe.focus_on(MapMath.atlas_to_lonlat(screen.player_atlas))
		await capture("globe-%dx%d" % [viewport_size.x, viewport_size.y])
		screen.world_overview()
	var file := FileAccess.open(output.path_join("results.json"), FileAccess.WRITE)
	file.store_string(JSON.stringify({"passed": results.size() - failed, "failed": failed, "checks": results, "physical_android": "not tested", "captures": "real Godot MapScreen component, not full gameplay"}, "\t"))
	print("MAP RESULTS ", results.size() - failed, "/", results.size())
	screen.queue_free()
	await settle()
	if live:
		root.size = Vector2i(1280, 576)
		var game: PyraGame = load("res://scenes/city.tscn").instantiate()
		game.skip_intro = true
		root.add_child(game)
		await settle()
		if is_instance_valid(game.screen): game.close_screen()
		game.open_map()
		await capture("live-game-atlas")
		verify(game.screen is MapScreen and game.hud.touch.blocked, "actual game map opens and blocks combat controls")
		game.screen.switch_to(0)
		await capture("live-game-globe")
		game.close_screen()
		await settle()
		verify(not is_instance_valid(game.screen) and not game.hud.touch.blocked, "closing actual map restores game controls")
		game.queue_free()
		await settle()
		file = FileAccess.open(output.path_join("results.json"), FileAccess.WRITE)
		file.store_string(JSON.stringify({"passed": results.size() - failed, "failed": failed, "checks": results, "physical_android": "not tested", "captures": "MapScreen plus real PyraGame open/close flow"}, "\t"))
	quit(1 if failed else 0)
