extends SceneTree
## Actual game preview, isolated user directory. No source image/data/save writes.
var output := "/tmp/ki-building-grounding"
var checks: Array[Dictionary] = []
var failures: Array[String] = []
const Grounding = preload("res://scripts/building_grounding.gd")
var grounding = Grounding.new()

func _initialize() -> void:
	run.call_deferred()

func check(ok: bool, name: String) -> void:
	checks.append({"name":name,"pass":ok})
	if not ok:
		failures.append(name)
		push_error(name)

func settle(count: int) -> void:
	for i in count: await process_frame

func capture(name: String) -> void:
	await settle(3)
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_jpg(output.path_join(name+".jpg"),0.94)

func drain_requests(continent: PyraContinent) -> void:
	# Fixtures switch worlds much faster than normal play. Retrieve outstanding
	# background loads before dropping their owner, including off-camera requests.
	for index in continent.requested.keys():
		var path := str(continent.cfg.textures[int(index)].path)
		if ResourceLoader.load_threaded_get_status(path)!=ResourceLoader.THREAD_LOAD_INVALID_RESOURCE:
			ResourceLoader.load_threaded_get(path)
		continent.requested.erase(index)

func geometry(game: PyraGame) -> Dictionary:
	var sprites: Array = []
	for item: Dictionary in game.continent.building_contacts.values():
		var sprite: Sprite2D = item.sprite.get_ref()
		if sprite != null:
			sprites.append([sprite.position,sprite.scale,sprite.offset,sprite.texture.resource_path])
	return {"position":game.player.position,"land":JSON.stringify(game.land),"walk":hash(game.continent.walk),"sprites":sprites}

func shader_checks() -> void:
	if DisplayServer.get_name()=="headless":return
	var viewport := SubViewport.new()
	viewport.size = Vector2i(64,64)
	viewport.transparent_bg = true
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	root.add_child(viewport)
	var image := Image.create(64,64,false,Image.FORMAT_RGBA8)
	image.fill(Color.TRANSPARENT)
	image.fill_rect(Rect2i(12,8,40,36),Color(0.63,0.17,0.11,1.0))
	image.fill_rect(Rect2i(8,44,48,16),Color(0.25,0.70,0.12,1.0))
	var sprite := Sprite2D.new()
	sprite.centered = false
	sprite.texture = ImageTexture.create_from_image(image)
	viewport.add_child(sprite)
	await settle(3)
	await RenderingServer.frame_post_draw
	var before := viewport.get_texture().get_image()
	sprite.material = grounding.platform_material()
	await settle(3)
	await RenderingServer.frame_post_draw
	var after := viewport.get_texture().get_image()
	check(before.get_pixel(30,20).is_equal_approx(after.get_pixel(30,20)),"Shader preserves opaque roof RGB and alpha")
	check(after.get_pixel(9,58).a<before.get_pixel(9,58).a,"Shader feathers grass edge")
	check(after.get_pixel(30,52).a>0.99,"Shader preserves interior ground opacity")
	viewport.queue_free()
	await settle(2)

func run() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--out="):output=arg.substr(6)
	DirAccess.make_dir_recursive_absolute(output)
	check(Grounding.profile("res://assets/objects/1-verdant-leaf-shop.webp")=="grass-platform","Leaf platform detected")
	check(Grounding.profile("res://assets/objects/1-pyra-painted-hall.webp")=="contact","Painted service detected")
	check(Grounding.profile("res://assets/objects/1-ki-v2-buildings-nexus-inn.webp")=="","Embedded old shadow not doubled")
	check(Grounding.profile("res://assets/objects/1-verdant-city-tree.webp")=="","Non-building untouched")
	check(grounding.shadow_image()==grounding.shadow_image(),"Shadow texture shared")
	check(grounding.shadow_image().get_image().get_pixel(0,0).a==0.0,"Contact texture corners transparent")
	await shader_checks()
	var disabled := PyraContinent.new()
	disabled.building_grounding_enabled = false
	disabled.setup_land("pyra")
	root.add_child(disabled)
	var sample := PyraContinent.make_sprite(grounding.shadow_image(),Vector2(100,100),Vector2(128,64),Vector2(0.5,0.92))
	disabled.sorted.add_child(sample)
	var before_children := disabled.below.get_child_count()
	disabled.add_building_contact(sample,"res://assets/objects/1-pyra-painted-hall.webp")
	check(disabled.building_contacts.is_empty() and disabled.below.get_child_count()==before_children,"Disabled feature adds no contacts")
	disabled.queue_free()
	await settle(3)
	var title: PyraTitleScreen = load("res://scenes/title.tscn").instantiate()
	root.add_child(title)
	await settle(6)
	title.start_city()
	while is_instance_valid(title):await process_frame
	var game: PyraGame = root.get_children().filter(func(n): return n is PyraGame)[0]
	game.skip_intro = true
	game.set_process(false)
	var samples: Array[Dictionary] = []
	for race: String in ["legend","planetary","sage","android"]:
		game.start_new_character(race)
		game.monsters.set_process(false)
		game.monsters.clear_all()
		if is_instance_valid(game.screen):game.close_screen()
		if game.hud.modal.visible:game.hud.close_dialog()
		for i in 100:
			game._process(0.0)
			await process_frame
		var count: int = game.continent.building_contacts.size()
		check(count>0,race+" building contacts exist")
		# Frame the nearest service building; only this review camera/HUD changes.
		var selected: Sprite2D
		var nearest := INF
		for item: Dictionary in game.continent.building_contacts.values():
			var sprite: Sprite2D = item.sprite.get_ref()
			var distance := sprite.position.distance_squared_to(game.player.position)
			if distance<nearest:
				nearest=distance
				selected=sprite
		game.camera.position = selected.position-game.player.position-Vector2(0,100)
		game.camera.zoom = Vector2.ONE
		game.hud.visible = false
		for i in 45:
			game.continent.update_view(game.camera_view())
			await process_frame
		var before := geometry(game)
		game.continent.set_building_grounding_visible(false)
		if DisplayServer.get_name()!="headless":await capture(race+"-before")
		game.continent.set_building_grounding_visible(true)
		if DisplayServer.get_name()!="headless":await capture(race+"-after")
		check(before==geometry(game),race+" geometry, anchors and player unchanged")
		for item: Dictionary in game.continent.building_contacts.values():
			var shadow: Sprite2D = item.shadow.get_ref()
			check(shadow!=null and shadow.get_parent()==game.continent.below,race+" shadow below actors")
		# Exercise the chunk owner: contact nodes must die with a streamed building.
		var ids: Array = game.continent.building_contacts.keys()
		var probe: Dictionary = game.continent.building_contacts[ids[0]]
		var probe_sprite: Sprite2D = probe.sprite.get_ref()
		var probe_shadow: Sprite2D = probe.shadow.get_ref()
		var tracked := false
		var preserved := before==geometry(game)
		for key: String in game.continent.loaded:
			var holder: Array = game.continent.loaded[key]
			if holder.has(probe_sprite):
				check(holder.has(probe_shadow),race+" streamed contact shares chunk lifecycle")
				tracked = true
				var sprite_id := probe_sprite.get_instance_id()
				game.continent.unload_chunk(key)
				for i in 80:
					if game.continent.free_queue.is_empty():break
					game.continent._process(0.0)
					await process_frame
				await settle(2)
				check(not is_instance_valid(probe_sprite) and not is_instance_valid(probe_shadow),race+" streamed contact freed with building")
				check(not game.continent.building_contacts.has(sprite_id),race+" contact registry cleaned after unload")
				break
		if race!="legend":check(tracked,race+" streamed buildings tested")
		samples.append({"race":race,"land":game.land_id,"contacts":count,"geometryPreserved":preserved,"reviewCameraZoom":1.0,"reviewHudHidden":true})
		drain_requests(game.continent)
	var file:=FileAccess.open(output.path_join("results.json"),FileAccess.WRITE)
	file.store_string(JSON.stringify({"renderer":DisplayServer.get_name(),"checks":checks,"failures":failures,"samples":samples,"physicalPhoneTested":false,"feature":"KI_BUILDING_GROUNDING=1; default off","sourceImagesModified":false},"\t"))
	file.close()
	print("BUILDING GROUNDING ",checks.size()-failures.size(),"/",checks.size()," pass")
	game.queue_free()
	await settle(4)
	grounding = null
	await settle(2)
	quit(0 if failures.is_empty() else 1)
