extends SceneTree
## Existing story data, inspected in actual runtime. Synthetic quest-completed
## state below is a fixture, not evidence of playing the campaign end to end.
const Places := preload("res://scripts/story_places.gd")
var output := "/tmp/ki-story-places"
var checks: Array[Dictionary] = []
var failures: Array[String] = []

func _initialize() -> void: run.call_deferred()

func check(ok: bool, label: String) -> void:
	checks.append({"name":label,"pass":ok})
	if not ok:
		failures.append(label)
		push_error(label)

func settle(n: int) -> void:
	for i in n: await process_frame

func capture(name: String) -> void:
	if DisplayServer.get_name()=="headless":return
	await settle(3)
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_jpg(output.path_join(name+".jpg"),0.94)

func run() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--out="):output=arg.substr(6)
	DirAccess.make_dir_recursive_absolute(output)
	var title: PyraTitleScreen = load("res://scenes/title.tscn").instantiate()
	root.add_child(title)
	await settle(6)
	title.start_city()
	while is_instance_valid(title):await process_frame
	var game: PyraGame = root.get_children().filter(func(n): return n is PyraGame)[0]
	game.skip_intro = true
	game.start_new_character("legend")
	game.set_process(false)
	game.world_events.set_process(false)
	game.world_events.clear()
	game.monsters.set_process(false)
	game.monsters.clear_all()
	game.player.set_physics_process(false)
	if is_instance_valid(game.screen):game.close_screen()
	game.hud.close_dialog()
	game._process(0.0)
	var controller = game.continent.get_node("StoryPlaces")
	var land_before := JSON.stringify(game.land)
	var walk_before := hash(game.continent.walk)
	var quests_before := JSON.stringify(game.quests.to_save())
	var gold_before: int = game.economy.gold
	var xp_before: int = game.kit.xp
	for source: Dictionary in game.quests.data.famous:
		var expected := str(source.lore).replace(" ("+str(source.mapPointId)+")","").replace("("+str(source.mapPointId)+") ","")
		check(game.famous_place_text(str(source.id))==expected,"Existing history, internal ID removed: "+str(source.id))
	check(JSON.stringify(game.quests.to_save())==quests_before,"Reading history gives no reward or quest progress")
	check(game.economy.gold==gold_before and game.kit.xp==xp_before,"Reading history leaves XP and coins unchanged")
	var samples: Array[Dictionary] = []
	for place: Dictionary in game.land.famous:
		var id := str(place.id)
		var at := Vector2(float(place.x),float(place.y))
		check(game.continent.walkable(at),id+" existing anchor walkable")
		game.player.position = at
		game.camera.position = Vector2(0,-55)
		game.camera.zoom = Vector2.ONE
		game.hud.visible = false
		controller.set_process(false)
		controller.clear()
		for i in 100:
			game.continent.update_view(game.camera_view())
			await process_frame
		await capture(id+"-before")
		var before := JSON.stringify(game.quests.to_save())
		controller.refresh()
		await settle(3)
		check(controller.active.has(id),id+" authored scene active")
		var entry: Dictionary = controller.active.get(id,{})
		if not entry.is_empty():
			check(int(entry.props)>0 and int(entry.props)<=6,id+" bounded visible props")
			check(controller.active.size()==1,id+" only nearby place loaded")
			check((entry.node as Node).get_parent()==game.continent.sorted,id+" world depth sorting")
		await capture(id+"-after")
		check(JSON.stringify(game.quests.to_save())==before,id+" presentation leaves quest/save state intact")
		samples.append({"id":id,"name":place.name,"x":at.x,"y":at.y,"props":int(entry.get("props",0)),"sourceLore":game.famous_place_text(id)})
		# Return to the road: no permanent off-camera story nodes may remain.
		var weak: WeakRef = weakref(entry.node)
		game.player.position = Vector2(float(game.land.arrival.x),float(game.land.arrival.y))
		controller.refresh()
		await settle(3)
		check(not controller.active.has(id) and weak.get_ref()==null,id+" distant scene freed")
	var fortress: Dictionary = game.land.famous[0]
	game.player.position = Vector2(float(fortress.x),float(fortress.y))
	controller.refresh()
	for i in 90:
		game.continent.update_view(game.camera_view())
		await process_frame
	var original: Dictionary = game.quests.to_save()
	game.quests.quests["O-P06"]["state"] = "completed"
	controller.refresh()
	check(bool(controller.active["famous-pyra-1"].resolved),"Existing quest completion changes visible scene")
	check((controller.active["famous-pyra-1"].fire as Node2D).visible,"Manual alarm restored: signal fire visible")
	var saved: Dictionary = game.quests.to_save()
	var restored := PyraQuests.new(game.quests.data)
	check(restored.from_save(saved),"Quest save round-trip accepted")
	check(str(restored.quests["O-P06"].state)=="completed","Existing completion survives reload; no new save schema")
	await capture("fortress-completed-fixture")
	game.quests.from_save(original)
	controller.refresh()
	check(not bool(controller.active["famous-pyra-1"].resolved) and not (controller.active["famous-pyra-1"].fire as Node2D).visible,"Loading earlier quest state restores earlier scene")
	check(JSON.stringify(game.land)==land_before and hash(game.continent.walk)==walk_before,"World geometry and collisions unchanged")
	game.hud.visible = true
	game._process(0.0)
	var target := game.nearest_target()
	check(str(target.get("id",""))=="famous-pyra-1","Famous site reachable by existing interaction")
	game.interact()
	check(game.hud.modal.visible,"Real interaction opens location history")
	await capture("fortress-history-dialog")
	var file := FileAccess.open(output.path_join("results.json"),FileAccess.WRITE)
	file.store_string(JSON.stringify({"renderer":DisplayServer.get_name(),"checks":checks,"failures":failures,"samples":samples,"sourceWorldUnchanged":true,"newSaveSchema":false,"physicalPhoneTested":false,"questCompletedStateWasSynthetic":true,"visualFeature":"KI_STORY_PLACES=1; default off"},"\t"))
	print("STORY PLACES ",checks.size()-failures.size(),"/",checks.size()," pass")
	controller.clear()
	for index in game.continent.requested.keys():
		var path := str(game.continent.cfg.textures[int(index)].path)
		if ResourceLoader.load_threaded_get_status(path)!=ResourceLoader.THREAD_LOAD_INVALID_RESOURCE:
			ResourceLoader.load_threaded_get(path)
		game.continent.requested.erase(index)
	game.queue_free()
	await settle(12)
	quit(0 if failures.is_empty() else 1)
