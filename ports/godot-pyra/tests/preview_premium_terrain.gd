extends SceneTree
## Local visual acceptance fixture. Candidate textures are applied to this scene's
## shader only. No installed assets, save migrations, terrain masks or colliders change.
var output := "/tmp/ki-premium-preview"
var candidates := ""
var textures: Array[ImageTexture] = []

func _initialize() -> void:
	run.call_deferred()

func settle(count := 4) -> void:
	for i in count:
		await process_frame

func capture(name: String) -> void:
	await settle()
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(output.path_join(name + ".png"))

func run() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--out="): output = arg.substr(6)
		if arg.begins_with("--candidates="): candidates = arg.substr(13)
	if candidates.is_empty() or DisplayServer.get_name() == "headless":
		push_error("Needs a native renderer and --candidates=<directory>")
		quit(1)
		return
	DirAccess.make_dir_recursive_absolute(output)
	root.size = Vector2i(1280,720)
	var title: PyraTitleScreen = load("res://scenes/title.tscn").instantiate()
	root.add_child(title)
	await settle(6)
	title.start_city()
	while is_instance_valid(title): await process_frame
	var game: PyraGame = root.get_children().filter(func(n): return n is PyraGame)[0]
	game.skip_intro = true
	game.start_new_character("legend")
	game.set_process(false)
	game.monsters.set_process(false)
	game.monsters.clear_all()
	if is_instance_valid(game.screen): game.close_screen()
	if game.hud.modal.visible: game.hud.close_dialog()
	# The capital has its own accepted painted floor. Inspect natural ground nearby.
	var home := game.player.position
	var found := false
	for distance in [2800,3400,4200]:
		for i in 16:
			var point: Vector2 = home + Vector2.from_angle(TAU*i/16.0)*distance
			if game.can_stand(point, ""):
				game.player.position = point
				found = true
				break
		if found: break
	game._process(0.0)
	for i in 90:
		game._process(0.0)
		await process_frame
	# Pick a readable nearby frame; collision safety alone does not ensure the
	# hero is visible behind tall streamed trees and cliffs.
	var best := game.player.position
	var best_score := INF
	for y in range(-3,4):
		for x in range(-3,4):
			var point := game.player.position + Vector2(x,y)*150.0
			if not game.can_stand(point, ""): continue
			var score := 0.0
			for node in game.continent.sorted.get_children():
				if node is Sprite2D:
					var local: Vector2 = node.to_local(point-Vector2(0,65))
					if node.get_rect().has_point(local): score += 1.0
			if score < best_score:
				best_score = score
				best = point
	game.player.position = best
	game.continent.update_view(game.camera_view())
	for i in 90:
		game._process(0.0)
		await process_frame
	var before_position := game.player.position
	var before_land := JSON.stringify(game.land)
	var before_walk := hash(game.continent.walk)
	await capture("pyra-before")
	var material: ShaderMaterial = game.continent.ground_material
	var checks: Array[Dictionary] = []
	for role in ["b0","b1","special"]:
		var path: String = candidates.path_join("pyra-%s-s35.webp" % role)
		var image := Image.load_from_file(path)
		if image == null or image.get_size() != Vector2i(768,768):
			push_error("Missing or invalid candidate: " + path)
			quit(1)
			return
		var texture := ImageTexture.create_from_image(image)
		textures.append(texture)
		material.set_shader_parameter("t_" + role, PyraContinent.mipmapped(texture))
		checks.append({"role":role,"size":str(image.get_size()),"applied":true})
	# Refresh only this fixture's baked presentation chunks after changing the shader.
	for entry: Dictionary in game.continent.ground_bake.values():
		(entry.sprite as Node).queue_free()
		(entry.viewport as Node).queue_free()
	game.continent.ground_bake.clear()
	game.continent.ground_queue.clear()
	game.continent.update_view(game.camera_view())
	for i in 90:
		game._process(0.0)
		await process_frame
	await capture("pyra-candidate")
	var unchanged := game.player.position == before_position and JSON.stringify(game.land) == before_land and hash(game.continent.walk) == before_walk
	var file := FileAccess.open(output.path_join("runtime-preview.json"),FileAccess.WRITE)
	file.store_string(JSON.stringify({"renderer":DisplayServer.get_name(),"candidateCount":checks.size(),"checks":checks,"geometryAndPositionUnchanged":unchanged,"scope":"Actual Godot runtime; isolated preview shader. No installed art or production changes."},"\t"))
	file.close()
	print("PREMIUM PREVIEW ",checks.size(),"/3 geometry preserved=",unchanged)
	quit(0 if unchanged else 1)
