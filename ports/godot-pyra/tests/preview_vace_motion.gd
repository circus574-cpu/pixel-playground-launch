extends SceneTree
## External trial packs only. The reference fixture is explicitly labeled and
## must never be presented as a generated animation or a production install.
var pack_file := ""
var output := "/tmp/ki-vace-preview"
var game: PyraGame
var checks: Array[Dictionary] = []

func _initialize() -> void:
	run.call_deferred()

func check(ok: bool, id: String, detail: Variant = null) -> void:
	checks.append({"passed":ok,"id":id,"detail":detail})
	if not ok: print("VACE_PREVIEW_FAIL ",id)

func settle(count := 3) -> void:
	for i in count: await process_frame

func pixel_sha(image: Image) -> String:
	image.convert(Image.FORMAT_RGBA8)
	var hashing := HashingContext.new()
	hashing.start(HashingContext.HASH_SHA256)
	hashing.update(image.get_data())
	return hashing.finish().hex_encode()

func run() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--pack="): pack_file = arg.substr(7)
		if arg.begins_with("--out="): output = arg.substr(6)
	if pack_file.is_empty():
		push_error("Use --pack=<external animation-pack.json>")
		quit(1)
		return
	DirAccess.make_dir_recursive_absolute(output)
	Engine.max_fps = 60
	root.size = Vector2i(844,390)
	var pack: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(pack_file))
	check(pack.get("kind","") in ["reference-fixture-only","vace-candidate"],"explicit-provenance")
	check(pack.get("atlas","") == "atlas.webp","bounded-atlas-path")
	check(float(pack.cell) == 200.0 and Vector2(float(pack.origin[0]),float(pack.origin[1])) == Vector2(0.5,0.95) and Vector2(float(pack["size"][0]),float(pack["size"][1])) == Vector2(133,133),"presentation-contract")
	check(FileAccess.get_sha256("res://data/actors.json") == str(pack.sourceActorSha256),"canonical-actor-unchanged")
	var atlas_path := pack_file.get_base_dir().path_join("atlas.webp")
	check(FileAccess.get_sha256(atlas_path) == str(pack.atlasSha256),"atlas-sha256")
	var image := Image.load_from_file(atlas_path)
	if image == null or checks.any(func(c): return not c.passed):
		quit(1)
		return
	check(image.get_width() <= 2048 and image.get_height() <= 2048 and image.get_width()*image.get_height()*16.0/3 <= 4194304,"atlas-mobile-budget")
	for i in pack.frames.size():
		var rect: Array = pack.frames[i].rect
		var box := Rect2i(int(rect[0]),int(rect[1]),int(rect[2]),int(rect[3]))
		var valid := box.size == Vector2i(200,200) and Rect2i(Vector2i.ZERO,image.get_size()).encloses(box)
		check(valid,"region-%d"%i)
		if valid: check(pixel_sha(image.get_region(box)) == str(pack.frames[i].rgbaSha256),"decoded-rgba-%d"%i)
	if checks.any(func(c): return not c.passed):
		quit(1)
		return
	PyraActor.sheet_cache[atlas_path] = ImageTexture.create_from_image(image)
	var title: PyraTitleScreen = load("res://scenes/title.tscn").instantiate()
	root.add_child(title)
	await settle(6)
	title.start_city()
	while is_instance_valid(title): await process_frame
	game = root.get_children().filter(func(n): return n is PyraGame)[0]
	game.skip_intro = true
	game.start_new_character("legend")
	game.set_process(false)
	game.monsters.set_process(false)
	game.monsters.clear_all()
	if is_instance_valid(game.screen): game.close_screen()
	if game.hud.modal.visible: game.hud.close_dialog()
	var actor := game.player.visual
	var original: Dictionary = actor.definition.duplicate(true)
	var updated: Dictionary = original.duplicate(true)
	var old_clip: Dictionary = original.clips.walk
	var factor_float := float(pack.fps)/float(old_clip.fps)
	var factor := roundi(factor_float)
	check(factor >= 1 and is_equal_approx(factor_float,float(factor)),"integral-fps-expansion")
	if checks.any(func(c): return not c.passed):
		quit(1)
		return
	# FPS belongs to the whole clip. Repeat fallback poses in the other seven
	# directions so their original cycle duration stays unchanged.
	for direction: String in updated.clips.walk.directions:
		var repeated: Array = []
		for item in old_clip.directions[direction]:
			for n in factor: repeated.append(item)
		updated.clips.walk.directions[direction] = repeated
	var selected: Array = []
	for frame: Dictionary in pack.frames:
		selected.append({"sheet":atlas_path,"rect":frame.rect})
	updated.clips.walk.directions[str(pack.direction)] = selected
	updated.clips.walk.fps = float(pack.fps)
	check(pack.get("orientation","") == "displayed","displayed-orientation")
	var mirrored: Array = updated.clips.walk.get("mirrored",[])
	mirrored.erase(str(pack.direction))
	updated.clips.walk.mirrored = mirrored
	actor.definition = updated
	actor.frames = SpriteFrames.new()
	actor.frames.remove_animation("default")
	actor.built.clear()
	actor.sprite.sprite_frames = actor.frames
	actor.ensure_clip("walk")
	for direction: String in PyraActor.DIRECTIONS:
		var name := "walk:"+direction
		var duration := actor.frames.get_frame_count(name)/actor.frames.get_animation_speed(name)
		var previous: float = old_clip.directions[direction].size()/float(old_clip.fps)
		check(is_equal_approx(duration,previous),"duration-"+direction,{"before":previous,"after":duration})
	check(updated.clips.idle == original.clips.idle and updated.clips.attack == original.clips.attack,"other-clips-unchanged")
	check(game.player.actor_data == original,"installed-definition-unchanged")
	var banner := CanvasLayer.new()
	banner.layer = 120
	root.add_child(banner)
	var label := Label.new()
	label.text = "TEST CPU: OBECNE KLATKI / BEZ GENERACJI GPU" if pack.kind == "reference-fixture-only" else "KANDYDAT VACE / PODGLĄD W GODOT"
	label.position = Vector2(8,128)
	label.add_theme_font_size_override("font_size",13)
	banner.add_child(label)
	for i in 90:
		game._process(0.0)
		await process_frame
	var before := game.player.position
	var speed := game.player.speed
	var walk_hash := hash(game.continent.walk)
	game.player.locked = false
	var travel_direction: Vector2 = Vector2.RIGHT.rotated(PyraActor.DIRECTIONS.find(str(pack.direction))*PI/4.0)
	game.player.touch_motion = travel_direction*0.6
	var seen: Dictionary = {}
	var native := DisplayServer.get_name() != "headless"
	if native: DirAccess.make_dir_recursive_absolute(output.path_join("frames"))
	for i in 48:
		game._process(1.0/32.0)
		await create_timer(1.0/32.0).timeout
		seen[str(actor.sprite.frame)] = true
		if native:
			await RenderingServer.frame_post_draw
			root.get_texture().get_image().save_png(output.path_join("frames/frame-%03d.png"%i))
	game.player.touch_motion = Vector2.ZERO
	check((game.player.position-before).dot(travel_direction) > 0,"real-player-moved",(game.player.position-before).dot(travel_direction))
	check(actor.sprite.animation == "walk:"+str(pack.direction),"game-selected-walk-animation",str(actor.sprite.animation))
	check(seen.size() >= 4,"spriteframes-timeline-advanced",seen.keys())
	check(game.player.speed == speed and hash(game.continent.walk) == walk_hash,"movement-speed-and-collision-unchanged")
	var failed := checks.filter(func(c): return not c.passed).size()
	var result := {"kind":pack.kind,"checks":checks.size(),"passed":checks.size()-failed,"failed":failed,"results":checks,"display":DisplayServer.get_name(),"scope":"Actual PyraGame/PyraPlayer/PyraActor. A reference-fixture result proves transport and timing only, not new GPU animation quality."}
	var file := FileAccess.open(output.path_join("result.json"),FileAccess.WRITE)
	file.store_string(JSON.stringify(result,"\t"))
	file.close()
	print("VACE_RUNTIME ",checks.size()-failed,"/",checks.size()," ",pack.kind)
	finish.call_deferred(1 if failed else 0)

func finish(code: int) -> void:
	if is_instance_valid(game):
		root.remove_child(game)
		game.queue_free()
	await settle(4)
	PyraActor.sheet_cache.clear()
	await settle(2)
	quit(code)
